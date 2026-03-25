from math import sqrt

import yfinance as yf
from django.db.models import Case, IntegerField, OuterRef, Prefetch, Q, Subquery, Value, When
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from user_stock.models import UserStock, UserStockData

from .models import StockCategory, StockMaster
from .serializers import StockMasterSerializer
from .yahoo import configure_yfinance_cache


def _fallback_symbol(stock: StockMaster) -> str:
    if stock.yahoo_ticker:
        return stock.yahoo_ticker

    base_ticker = (stock.ticker or "").strip()
    exchange = (stock.exchange or "").strip().upper()
    if not base_ticker:
        return ""
    if "." in base_ticker:
        return base_ticker
    if exchange == "NSE":
        return f"{base_ticker}.NS"
    if exchange == "BSE":
        return f"{base_ticker}.BO"
    return base_ticker


def _extract_recent_return(history_frame) -> float | None:
    if history_frame is None or history_frame.empty or "Close" not in history_frame.columns:
        return None

    closes = history_frame["Close"].dropna()
    if len(closes) < 2:
        return None

    first_close = float(closes.iloc[0])
    last_close = float(closes.iloc[-1])
    if first_close == 0:
        return None

    return float(((last_close - first_close) / first_close) * 100)


def _download_market_returns(stocks: list[StockMaster]) -> dict[int, float]:
    symbol_to_stock_ids = {}
    for stock in stocks:
        symbol = _fallback_symbol(stock)
        if not symbol:
            continue
        symbol_to_stock_ids.setdefault(symbol, []).append(stock.id)

    if not symbol_to_stock_ids:
        return {}

    try:
        configure_yfinance_cache()
    except Exception:
        pass

    returns_by_stock_id = {}
    symbols = list(symbol_to_stock_ids.keys())
    batch_size = 40

    for batch_start in range(0, len(symbols), batch_size):
        batch = symbols[batch_start : batch_start + batch_size]
        try:
            downloaded = yf.download(
                tickers=batch,
                period="1mo",
                interval="1d",
                auto_adjust=True,
                progress=False,
                threads=False,
                group_by="ticker",
            )
        except Exception:
            continue

        if downloaded is None or downloaded.empty:
            continue

        if len(batch) == 1:
            batch_return = _extract_recent_return(downloaded)
            if batch_return is None:
                continue
            for stock_id in symbol_to_stock_ids[batch[0]]:
                returns_by_stock_id[stock_id] = batch_return
            continue

        for symbol in batch:
            if symbol not in downloaded.columns.get_level_values(0):
                continue
            symbol_frame = downloaded[symbol]
            batch_return = _extract_recent_return(symbol_frame)
            if batch_return is None:
                continue
            for stock_id in symbol_to_stock_ids[symbol]:
                returns_by_stock_id[stock_id] = batch_return

    return returns_by_stock_id


class StockMasterSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = (request.query_params.get("q") or "").strip()
        try:
            limit = int(request.query_params.get("limit", 12))
        except (TypeError, ValueError):
            limit = 12

        limit = max(1, min(limit, 25))

        stocks = StockMaster.objects.all()
        if query:
            stocks = stocks.filter(
                Q(ticker__icontains=query)
                | Q(yahoo_ticker__icontains=query)
                | Q(stock_name__icontains=query)
            ).annotate(
                search_rank=Case(
                    When(ticker__iexact=query, then=Value(0)),
                    When(yahoo_ticker__iexact=query, then=Value(0)),
                    When(stock_name__iexact=query, then=Value(1)),
                    When(ticker__istartswith=query, then=Value(2)),
                    When(yahoo_ticker__istartswith=query, then=Value(2)),
                    When(stock_name__istartswith=query, then=Value(3)),
                    default=Value(4),
                    output_field=IntegerField(),
                )
            )
        else:
            stocks = stocks.annotate(
                search_rank=Value(5, output_field=IntegerField())
            )

        stocks = stocks.order_by("search_rank", "stock_name", "ticker")[:limit]
        serializer = StockMasterSerializer(stocks, many=True)
        return Response(
            {
                "count": len(serializer.data),
                "query": query,
                "results": serializer.data,
            }
        )


class SuggestedPortfolioCategoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        categories = list(
            StockCategory.objects.filter(is_active=True)
            .prefetch_related(
                Prefetch(
                    "stocks",
                    queryset=StockMaster.objects.only(
                        "id",
                        "stock_name",
                        "ticker",
                        "yahoo_ticker",
                        "market",
                        "exchange",
                        "market_cap",
                    ).order_by("stock_name", "ticker"),
                )
            )
            .order_by("sort_order", "name")
        )
        stock_ids = {
            stock.id
            for category in categories
            for stock in category.stocks.all()
        }

        performance_map = {}
        latest_close = Subquery(
            UserStockData.objects.filter(user_stock=OuterRef("pk"))
            .order_by("-timestamp")
            .values("close")[:1]
        )
        previous_close = Subquery(
            UserStockData.objects.filter(user_stock=OuterRef("pk"))
            .order_by("-timestamp")
            .values("close")[1:2]
        )
        tracked_stocks = (
            UserStock.objects.filter(stock_id__in=stock_ids)
            .select_related("stock", "portfolio")
            .annotate(latest_close=latest_close, previous_close=previous_close)
            .order_by("stock_id", "-modified_at")
        )

        seen_stock_ids = set()
        for user_stock in tracked_stocks:
            if user_stock.stock_id in seen_stock_ids:
                continue

            seen_stock_ids.add(user_stock.stock_id)
            if user_stock.latest_close is None or user_stock.previous_close in (None, 0):
                continue

            performance_map[user_stock.stock_id] = float(
                ((user_stock.latest_close - user_stock.previous_close) / user_stock.previous_close) * 100
            )

        missing_stocks = [
            stock
            for category in categories
            for stock in category.stocks.all()
            if stock.id not in performance_map
        ]
        performance_map.update(_download_market_returns(missing_stocks))

        payload = []
        for category in categories:
            category_stocks = list(category.stocks.all())
            stock_ids_for_category = [stock.id for stock in category_stocks]
            tracked_changes = [
                performance_map[stock_id]
                for stock_id in stock_ids_for_category
                if stock_id in performance_map
            ]
            avg_return = None
            volatility = None
            risk_level = "New"

            if tracked_changes:
                avg_return = round(sum(tracked_changes) / len(tracked_changes), 2)
                mean = avg_return
                if len(tracked_changes) > 1:
                    variance = sum((value - mean) ** 2 for value in tracked_changes) / len(tracked_changes)
                    volatility = round(sqrt(variance), 2)
                    risk_level = "High" if volatility >= 4 else "Medium" if volatility >= 2 else "Low"
                else:
                    volatility = 0.0
                    risk_level = "Low"

            stock_payloads = [
                {
                    "id": stock.id,
                    "stock_name": stock.stock_name,
                    "ticker": stock.yahoo_ticker or stock.ticker,
                    "market": stock.market,
                    "exchange": stock.exchange,
                    "market_cap": stock.market_cap,
                    "performance_pct": performance_map.get(stock.id),
                }
                for stock in category_stocks
            ]
            payload.append(
                {
                    "id": category.id,
                    "name": category.name,
                    "slug": category.slug,
                    "category_type": category.category_type,
                    "description": category.description,
                    "stock_count": len(category_stocks),
                    "avg_return": avg_return,
                    "risk_level": risk_level,
                    "volatility": volatility,
                    "default_stock_ids": stock_ids_for_category,
                    "stocks": stock_payloads,
                }
            )

        return Response(
            {
                "count": len(payload),
                "categories": payload,
            }
        )
