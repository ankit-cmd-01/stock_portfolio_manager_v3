from django.db import IntegrityError
from django.db.models import Q
from decimal import Decimal, InvalidOperation
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from portfolio.models import Portfolio
from stock_master.models import StockMaster

from .models import UserStock
from .serializers import UserStockDetailSerializer, UserStockSerializer
from .services import fetch_and_save_historical_stock_data, sync_user_stock_history_if_stale


def get_user_stock(pk, user):
    try:
        return UserStock.objects.get(pk=pk, user=user)
    except UserStock.DoesNotExist:
        return None


def parse_quantity(raw_value):
    if raw_value in (None, ""):
        return Decimal("1")
    try:
        quantity = Decimal(str(raw_value))
    except (InvalidOperation, ValueError):
        raise ValueError("Quantity must be a valid number.")
    if quantity <= 0:
        raise ValueError("Quantity must be greater than zero.")
    return quantity


class UserStockListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    # List all stocks saved by the authenticated user across all portfolios.
    def get(self, request):
        user_stocks = (
            UserStock.objects.filter(user=request.user)
            .select_related("stock", "portfolio")
            .prefetch_related("stock_data")
        )
        serializer = UserStockSerializer(user_stocks, many=True)
        return Response(
            {
                "count": user_stocks.count(),
                "user_stocks": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    # Add a stock to one of the authenticated user's portfolios and sync its chart data.
    def post(self, request):
        portfolio = Portfolio.objects.filter(
            pk=request.data.get("portfolio"),
            user=request.user,
        ).first()
        if portfolio is None:
            return Response(
                {"error": "Portfolio not found or access denied"},
                status=status.HTTP_404_NOT_FOUND,
        )

        ticker = (request.data.get("ticker") or request.data.get("yahoo_ticker") or "").strip()
        stock = StockMaster.objects.filter(
            Q(ticker__iexact=ticker) | Q(yahoo_ticker__iexact=ticker)
        ).first()
        if stock is None:
            return Response(
                {"error": "Ticker not found in stock master"},
                status=status.HTTP_404_NOT_FOUND,
            )

        exists = UserStock.objects.filter(
            user=request.user,
            portfolio=portfolio,
            stock=stock,
        ).exists()
        if exists:
            return Response(
                {"error": "This stock already exists in this portfolio"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            quantity = parse_quantity(request.data.get("quantity"))
        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user_stock = UserStock.objects.create(
            user=request.user,
            portfolio=portfolio,
            stock=stock,
            quantity=quantity,
        )

        try:
            records_saved = fetch_and_save_historical_stock_data(user_stock)
        except ValueError as exc:
            user_stock.delete()
            return Response(
                {"error": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        serializer = UserStockSerializer(user_stock)
        return Response(
            {
                "message": "Stock added and chart data synced successfully!",
                "records_saved": records_saved,
                "user_stock": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


class UserStockDetailView(APIView):
    permission_classes = [IsAuthenticated]

    # Retrieve a single saved stock with its saved OHLCV and P/E data.
    def get(self, request, pk):
        user_stock = UserStock.objects.filter(pk=pk, user=request.user).select_related(
            "stock",
            "portfolio",
        ).first()
        if user_stock is None:
            return Response(
                {"error": "User stock not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            sync_user_stock_history_if_stale(user_stock)
        except ValueError:
            pass

        user_stock = (
            UserStock.objects.filter(pk=pk, user=request.user)
            .select_related("stock", "portfolio")
            .prefetch_related("stock_data")
            .first()
        )

        serializer = UserStockDetailSerializer(user_stock)
        return Response({"user_stock": serializer.data}, status=status.HTTP_200_OK)

    # Move a saved stock to another portfolio owned by the authenticated user.
    def patch(self, request, pk):
        user_stock = get_user_stock(pk, request.user)
        if user_stock is None:
            return Response(
                {"error": "User stock not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if set(request.data.keys()) - {"portfolio", "quantity"}:
            return Response(
                {"error": "Only portfolio and quantity can be updated"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if "portfolio" in request.data:
            target_portfolio = Portfolio.objects.filter(
                pk=request.data.get("portfolio"),
                user=request.user,
            ).first()
            if target_portfolio is None:
                return Response(
                    {"error": "Target portfolio does not belong to you"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if "quantity" in request.data:
            try:
                request.data._mutable = True
            except AttributeError:
                pass
            try:
                request.data["quantity"] = str(parse_quantity(request.data.get("quantity")))
            except ValueError as exc:
                return Response(
                    {"error": str(exc)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        serializer = UserStockSerializer(user_stock, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            serializer.save()
        except IntegrityError:
            return Response(
                {"error": "This stock already exists in this portfolio"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message": "Stock updated successfully!",
                "user_stock": UserStockSerializer(user_stock).data,
            },
            status=status.HTTP_200_OK,
        )

    # Delete a saved stock and cascade-delete its historical data.
    def delete(self, request, pk):
        user_stock = get_user_stock(pk, request.user)
        if user_stock is None:
            return Response(
                {"error": "User stock not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        user_stock.delete()
        return Response(
            {"message": "Stock removed from portfolio successfully!"},
            status=status.HTTP_200_OK,
        )


class UserStockByPortfolioView(APIView):
    permission_classes = [IsAuthenticated]

    # List all saved stocks inside a single portfolio owned by the user.
    def get(self, request, portfolio_pk):
        portfolio = Portfolio.objects.filter(pk=portfolio_pk, user=request.user).first()
        if portfolio is None:
            return Response(
                {"error": "Portfolio not found or access denied"},
                status=status.HTTP_404_NOT_FOUND,
            )

        user_stocks = list(
            UserStock.objects.filter(user=request.user, portfolio_id=portfolio_pk)
            .select_related("stock", "portfolio")
            .prefetch_related("stock_data")
        )
        for user_stock in user_stocks:
            latest_timestamp = None
            prefetched_rows = list(user_stock.stock_data.all())
            if prefetched_rows:
                latest_timestamp = prefetched_rows[-1].timestamp
            try:
                sync_user_stock_history_if_stale(
                    user_stock,
                    latest_timestamp=latest_timestamp,
                )
            except ValueError:
                continue

        user_stocks = (
            UserStock.objects.filter(user=request.user, portfolio_id=portfolio_pk)
            .select_related("stock", "portfolio")
            .prefetch_related("stock_data")
        )
        serializer = UserStockSerializer(user_stocks, many=True)
        return Response(
            {
                "portfolio": portfolio.title,
                "count": user_stocks.count(),
                "user_stocks": serializer.data,
            },
            status=status.HTTP_200_OK,
        )
