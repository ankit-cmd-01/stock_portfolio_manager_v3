import json
from decimal import Decimal

from django.db.models import Prefetch

from portfolio.models import Portfolio
from user_stock.models import UserStock, UserStockData


def _safe_float(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _format_money(value):
    if value is None:
        return None
    return round(float(value), 2)


def build_authenticated_user_context(user):
    portfolios = list(
        Portfolio.objects.filter(user=user).order_by("-created_at")
    )
    user_stocks = list(
        UserStock.objects.filter(user=user)
        .select_related("stock", "portfolio")
        .prefetch_related(
            "stock__categories",
            Prefetch("stock_data", queryset=UserStockData.objects.order_by("-timestamp")),
        )
        .order_by("portfolio__title", "stock__stock_name")
    )

    holdings = []
    portfolio_summary = {}
    total_market_value = 0.0
    valued_holdings = 0

    for user_stock in user_stocks:
        stock_rows = list(user_stock.stock_data.all())
        latest = stock_rows[0] if stock_rows else None
        previous = stock_rows[1] if len(stock_rows) > 1 else None
        latest_close = _safe_float(getattr(latest, "close", None))
        previous_close = _safe_float(getattr(previous, "close", None))
        quantity = _safe_float(user_stock.quantity) or 0.0
        market_value = latest_close * quantity if latest_close is not None else None
        change_pct = None
        if latest_close is not None and previous_close not in (None, 0):
            change_pct = round(((latest_close - previous_close) / previous_close) * 100, 2)

        holding = {
            "ticker": user_stock.stock.yahoo_ticker or user_stock.stock.ticker,
            "company_name": user_stock.stock.stock_name,
            "portfolio": user_stock.portfolio.title,
            "quantity": round(quantity, 4),
            "latest_close": _format_money(latest_close),
            "market_value": _format_money(market_value),
            "change_pct": change_pct,
            "market": user_stock.stock.market,
            "exchange": user_stock.stock.exchange,
            "categories": [category.name for category in user_stock.stock.categories.all()],
        }
        holdings.append(holding)

        portfolio_bucket = portfolio_summary.setdefault(
            user_stock.portfolio.title,
            {
                "description": user_stock.portfolio.description or "",
                "stock_count": 0,
                "tickers": [],
                "estimated_value": 0.0,
            },
        )
        portfolio_bucket["stock_count"] += 1
        portfolio_bucket["tickers"].append(holding["ticker"])

        if market_value is not None:
            portfolio_bucket["estimated_value"] += market_value
            total_market_value += market_value
            valued_holdings += 1

    top_gainers = sorted(
        [holding for holding in holdings if holding["change_pct"] is not None],
        key=lambda item: item["change_pct"],
        reverse=True,
    )[:3]
    top_losers = sorted(
        [holding for holding in holdings if holding["change_pct"] is not None],
        key=lambda item: item["change_pct"],
    )[:3]

    snapshot = {
        "user": {
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
        },
        "portfolio_count": len(portfolios),
        "tracked_stock_count": len(holdings),
        "valued_holdings": valued_holdings,
        "estimated_total_market_value": round(total_market_value, 2),
        "portfolios": [
            {
                "title": portfolio.title,
                "description": portfolio.description or "",
                "created_at": portfolio.created_at.isoformat(),
                "modified_at": portfolio.modified_at.isoformat(),
                "stock_count": portfolio_summary.get(portfolio.title, {}).get("stock_count", 0),
                "tickers": portfolio_summary.get(portfolio.title, {}).get("tickers", []),
                "estimated_value": round(portfolio_summary.get(portfolio.title, {}).get("estimated_value", 0.0), 2),
            }
            for portfolio in portfolios
        ],
        "holdings": holdings,
        "top_gainers": top_gainers,
        "top_losers": top_losers,
    }

    context_text = json.dumps(snapshot, ensure_ascii=False, indent=2)
    return {
        "snapshot": snapshot,
        "context_text": context_text,
    }
