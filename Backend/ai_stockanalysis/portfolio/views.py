from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Portfolio
from .serializers import PortfolioCreateSerializer, PortfolioSerializer
from .services.forecast_service import predict_portfolio
from stock_master.models import StockMaster
from user_stock.models import UserStock
from user_stock.services import sync_user_stock_history


def get_user_portfolio(pk, user):
    try:
        return Portfolio.objects.get(pk=pk, user=user)
    except Portfolio.DoesNotExist:
        return None


class PortfolioListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    # List all portfolios that belong to the authenticated user.
    def get(self, request):
        portfolios = Portfolio.objects.filter(user=request.user)
        serializer = PortfolioSerializer(portfolios, many=True)
        return Response(
            {
                "count": portfolios.count(),
                "portfolios": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    # Create a new portfolio for the authenticated user only.
    def post(self, request):
        serializer = PortfolioCreateSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            stock_ids = serializer.validated_data.pop("stock_ids", [])
            portfolio = serializer.save(user=request.user)

            seeded = []
            skipped = []
            failed = []
            if stock_ids:
                stock_master_qs = StockMaster.objects.filter(id__in=stock_ids).order_by("stock_name", "ticker")
                for stock in stock_master_qs:
                    if UserStock.objects.filter(user=request.user, portfolio=portfolio, stock=stock).exists():
                        skipped.append(stock.yahoo_ticker or stock.ticker)
                        continue

                    user_stock = UserStock.objects.create(
                        user=request.user,
                        portfolio=portfolio,
                        stock=stock,
                    )

                    try:
                        records_saved = sync_user_stock_history(user_stock)
                        seeded.append(
                            {
                                "ticker": stock.yahoo_ticker or stock.ticker,
                                "records_saved": records_saved,
                            }
                        )
                    except ValueError as exc:
                        user_stock.delete()
                        failed.append(
                            {
                                "ticker": stock.yahoo_ticker or stock.ticker,
                                "error": str(exc),
                            }
                        )

            return Response(
                {
                    "message": "Portfolio created successfully!",
                    "portfolio": PortfolioSerializer(portfolio).data,
                    "seeded_stocks": seeded,
                    "skipped_stocks": skipped,
                    "failed_stocks": failed,
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PortfolioDetailView(APIView):
    permission_classes = [IsAuthenticated]

    # Fetch a single portfolio only if it belongs to the authenticated user.
    def get(self, request, pk):
        portfolio = get_user_portfolio(pk, request.user)
        if portfolio is None:
            return Response(
                {"error": "Portfolio not found or access denied"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = PortfolioSerializer(portfolio)
        return Response({"portfolio": serializer.data}, status=status.HTTP_200_OK)

    # Fully update a portfolio while keeping ownership restricted to the user.
    def put(self, request, pk):
        portfolio = get_user_portfolio(pk, request.user)
        if portfolio is None:
            return Response(
                {"error": "Portfolio not found or access denied"},
                status=status.HTTP_404_NOT_FOUND,
            )

        errors = {}
        if "title" not in request.data:
            errors["title"] = ["This field is required."]
        if "description" not in request.data:
            errors["description"] = ["This field is required."]
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        serializer = PortfolioSerializer(portfolio, data=request.data)
        if serializer.is_valid():
            updated_portfolio = serializer.save()
            return Response(
                {
                    "message": "Portfolio updated!",
                    "portfolio": PortfolioSerializer(updated_portfolio).data,
                },
                status=status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # Partially update a portfolio while keeping ownership restricted to the user.
    def patch(self, request, pk):
        portfolio = get_user_portfolio(pk, request.user)
        if portfolio is None:
            return Response(
                {"error": "Portfolio not found or access denied"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = PortfolioSerializer(portfolio, data=request.data, partial=True)
        if serializer.is_valid():
            updated_portfolio = serializer.save()
            return Response(
                {
                    "message": "Portfolio partially updated!",
                    "portfolio": PortfolioSerializer(updated_portfolio).data,
                },
                status=status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # Delete a portfolio only if it belongs to the authenticated user.
    def delete(self, request, pk):
        portfolio = get_user_portfolio(pk, request.user)
        if portfolio is None:
            return Response(
                {"error": "Portfolio not found or access denied"},
                status=status.HTTP_404_NOT_FOUND,
            )

        portfolio.delete()
        return Response(
            {"message": "Portfolio deleted successfully!"},
            status=status.HTTP_200_OK,
        )


class PortfolioForecastView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        import threading
        from .services import forecast_service

        portfolio = get_user_portfolio(pk, request.user)
        if portfolio is None:
            return Response(
                {"error": "Portfolio not found or access denied"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check for missing/outdated models and trigger background retraining if needed
        user_stocks = forecast_service.UserStock.objects.filter(portfolio_id=portfolio.id)
        stocks_to_retrain = []
        for user_stock in user_stocks:
            try:
                artifact = forecast_service._load_model_artifact(user_stock)
                # Check if model is outdated: compare latest_training_timestamp to latest data timestamp
                latest_data = forecast_service.UserStockData.objects.filter(user_stock=user_stock).order_by('-timestamp').first()
                if latest_data and artifact.get('latest_training_timestamp'):
                    import dateutil.parser
                    model_time = dateutil.parser.isoparse(artifact['latest_training_timestamp'])
                    data_time = latest_data.timestamp
                    if data_time > model_time:
                        stocks_to_retrain.append(user_stock)
            except Exception:
                stocks_to_retrain.append(user_stock)

        if stocks_to_retrain:
            import logging
            logger = logging.getLogger(__name__)
            def retrain_async(stocks):
                try:
                    logger.info(f"Triggering background retraining for {len(stocks)} user stocks in portfolio {portfolio.id}")
                    result = forecast_service.train_all_stock_models(stocks)
                    logger.info(f"Background retraining complete for portfolio {portfolio.id}: {result}")
                except Exception as exc:
                    logger.exception(f"Background retraining failed for portfolio {portfolio.id}: {exc}")
            threading.Thread(target=retrain_async, args=(stocks_to_retrain,), daemon=True).start()

        try:
            payload = forecast_service.predict_portfolio(portfolio.id)
        except RuntimeError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(payload, status=status.HTTP_200_OK)
