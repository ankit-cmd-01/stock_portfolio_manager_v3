from django.http import Http404
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from portfolio.models import Portfolio

from .models import QualityStock
from .serializers import (
    QualityStockDetailSerializer,
    QualityStockGenerateRequestSerializer,
    QualityStockRowSerializer,
    QualityStockSnapshotRequestSerializer,
    QualityStockSnapshotRowSerializer,
)
from .services import (
    build_quality_snapshot,
    build_quality_stock_rows,
    generate_quality_reports,
    get_quality_stock_detail,
)


class QualityStockViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _get_portfolio_or_404(self, portfolio_id: int) -> Portfolio:
        portfolio = Portfolio.objects.filter(id=portfolio_id, user=self.request.user).first()
        if portfolio is None:
            raise Http404("Portfolio not found.")
        return portfolio

    def list(self, request):
        portfolio_id = request.query_params.get("portfolio")
        signal = request.query_params.get("signal", "all")
        rows = build_quality_stock_rows(
            request.user,
            portfolio_id=int(portfolio_id) if str(portfolio_id or "").isdigit() else None,
            signal=signal,
        )
        serializer = QualityStockRowSerializer(rows, many=True)
        return Response(
            {"count": len(serializer.data), "quality_stocks": serializer.data},
            status=status.HTTP_200_OK,
        )

    def retrieve(self, request, pk=None):
        try:
            payload = get_quality_stock_detail(request.user, int(pk))
        except (QualityStock.DoesNotExist, TypeError, ValueError):
            raise Http404("Quality stock report not found.")
        serializer = QualityStockDetailSerializer(payload)
        return Response({"quality_stock": serializer.data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="snapshot")
    def snapshot(self, request):
        serializer = QualityStockSnapshotRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        portfolio = self._get_portfolio_or_404(serializer.validated_data["portfolio_id"])
        candidates = build_quality_snapshot(portfolio)
        response_serializer = QualityStockSnapshotRowSerializer(candidates, many=True)
        return Response(
            {
                "portfolio_id": portfolio.id,
                "count": len(response_serializer.data),
                "candidates": response_serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="generate")
    def generate(self, request):
        serializer = QualityStockGenerateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        portfolio = self._get_portfolio_or_404(serializer.validated_data["portfolio_id"])
        try:
            generated = generate_quality_reports(
                portfolio,
                serializer.validated_data["stock_ids"],
                selected_by_user=True,
            )
        except ValueError as exc:
            raise serializers.ValidationError({"stock_ids": str(exc)}) from exc
        response_serializer = QualityStockDetailSerializer(generated, many=True)
        return Response(
            {
                "portfolio_id": portfolio.id,
                "count": len(response_serializer.data),
                "quality_stocks": response_serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="rerun")
    def rerun(self, request, pk=None):
        quality_stock = (
            QualityStock.objects.filter(id=pk, portfolio__user=request.user)
            .select_related("portfolio")
            .first()
        )
        if quality_stock is None:
            raise Http404("Quality stock report not found.")

        generated = generate_quality_reports(
            quality_stock.portfolio,
            [quality_stock.stock_id],
            selected_by_user=quality_stock.selected_by_user,
        )
        payload = generated[0] if generated else get_quality_stock_detail(request.user, quality_stock.id)
        serializer = QualityStockDetailSerializer(payload)
        return Response({"quality_stock": serializer.data}, status=status.HTTP_200_OK)
