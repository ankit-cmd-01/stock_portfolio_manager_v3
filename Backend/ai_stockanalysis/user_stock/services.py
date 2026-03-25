from decimal import Decimal
from datetime import timedelta

import yfinance as yf
from django.utils import timezone

from .models import UserStock, UserStockData
from stock_master.models import StockMaster
from stock_master.yahoo import configure_yfinance_cache, resolve_yahoo_symbol, symbol_match_score


def _exchange_candidate(ticker: str, exchange: str) -> str | None:
    base_ticker = (ticker or "").strip()
    exchange = (exchange or "").strip().upper()
    if not base_ticker:
        return None
    if "." in base_ticker:
        return base_ticker
    if exchange == "NSE":
        return f"{base_ticker}.NS"
    if exchange == "BSE":
        return f"{base_ticker}.BO"
    return base_ticker


def _ordered_candidates(*candidate_groups: list[str]) -> list[str]:
    seen = set()
    ordered = []
    for group in candidate_groups:
        for candidate in group:
            cleaned = (candidate or "").strip()
            if not cleaned or cleaned in seen:
                continue
            seen.add(cleaned)
            ordered.append(cleaned)
    return ordered


def build_ticker_candidates(user_stock: UserStock) -> list[str]:
    stock_ticker = (user_stock.stock.ticker or "").strip()
    primary_ticker = (user_stock.stock.yahoo_ticker or stock_ticker).strip()
    exchange = (user_stock.stock.exchange or "").strip().upper()
    resolved = resolve_yahoo_symbol(
        stock_name=user_stock.stock.stock_name,
        ticker=stock_ticker,
        exchange=exchange,
    )
    exact_exchange_candidate = _exchange_candidate(stock_ticker, exchange)

    preferred = []
    fallback = []

    if resolved and symbol_match_score(resolved, stock_ticker) == 3:
        preferred.append(resolved)
    if primary_ticker and symbol_match_score(primary_ticker, stock_ticker) == 3:
        preferred.append(primary_ticker)
    if exact_exchange_candidate:
        preferred.append(exact_exchange_candidate)
    if stock_ticker:
        preferred.append(stock_ticker)

    if resolved and symbol_match_score(resolved, stock_ticker) < 3:
        fallback.append(resolved)
    if primary_ticker and symbol_match_score(primary_ticker, stock_ticker) < 3:
        fallback.append(primary_ticker)

    return _ordered_candidates(preferred, fallback)


def normalize_history_columns(df):
    if getattr(df.columns, "nlevels", 1) > 1:
        df = df.copy()
        df.columns = df.columns.get_level_values(0)
    return df


def _fast_info_value(fast_info, key: str):
    if fast_info is None:
        return None
    try:
        value = fast_info.get(key)
    except Exception:
        value = None
    if value is not None:
        return value
    try:
        return fast_info[key]
    except Exception:
        return None


def _fetch_market_metadata(candidate: str, user_stock: UserStock) -> float | None:
    stock_ticker = yf.Ticker(candidate)
    market_cap = None

    try:
        fast_info = stock_ticker.fast_info
        if fast_info is not None:
            market_cap = _fast_info_value(fast_info, "market_cap")
            if market_cap is None:
                market_cap = _fast_info_value(fast_info, "marketCap")
    except Exception:
        market_cap = None

    if market_cap is not None:
        StockMaster.objects.filter(pk=user_stock.stock_id).update(
            market_cap=Decimal(str(market_cap))
        )
    return None


def _persist_yahoo_ticker(user_stock: UserStock, candidate: str) -> None:
    if candidate and user_stock.stock.yahoo_ticker != candidate:
        StockMaster.objects.filter(pk=user_stock.stock_id).update(yahoo_ticker=candidate)
        user_stock.stock.yahoo_ticker = candidate


def _download_history(candidate: str, *, period: str | None = None, start=None, end=None):
    download_kwargs = {
        "interval": "1h",
        "auto_adjust": True,
        "progress": False,
        "threads": False,
    }
    if period is not None:
        download_kwargs["period"] = period
    if start is not None:
        download_kwargs["start"] = start
    if end is not None:
        download_kwargs["end"] = end
    return yf.download(candidate, **download_kwargs)


def _save_history_rows(user_stock: UserStock, history, trailing_eps: float | None) -> int:
    records = []
    existing_count = UserStockData.objects.filter(user_stock=user_stock).count()

    for row in history.itertuples():
        pe_ratio = None
        if trailing_eps and trailing_eps != 0:
            pe_ratio = Decimal(str(round(float(row.Close) / trailing_eps, 4)))

        records.append(
            UserStockData(
                user_stock=user_stock,
                timestamp=row.Index,
                open=Decimal(str(row.Open)),
                high=Decimal(str(row.High)),
                low=Decimal(str(row.Low)),
                close=Decimal(str(row.Close)),
                volume=int(row.Volume),
                pe_ratio=pe_ratio,
            )
        )

    UserStockData.objects.bulk_create(records, ignore_conflicts=True)
    return UserStockData.objects.filter(user_stock=user_stock).count() - existing_count


def _fetch_history_frame(
    user_stock: UserStock,
    candidate: str,
    *,
    period: str | None = None,
    start=None,
    end=None,
):
    trailing_eps = None
    try:
        trailing_eps = _fetch_market_metadata(candidate, user_stock)
    except Exception:
        trailing_eps = None

    df = _download_history(candidate, period=period, start=start, end=end)
    df = normalize_history_columns(df)
    required_columns = {"Open", "High", "Low", "Close", "Volume"}
    if not required_columns.issubset(df.columns):
        missing = ", ".join(sorted(required_columns - set(df.columns)))
        raise ValueError(f"Missing required price columns: {missing}")
    df = df.dropna(subset=["Close"])
    return df, trailing_eps


def _incremental_period_for_gap(gap: timedelta) -> str:
    if gap <= timedelta(days=5):
        return "5d"
    if gap <= timedelta(days=30):
        return "1mo"
    if gap <= timedelta(days=90):
        return "3mo"
    if gap <= timedelta(days=180):
        return "6mo"
    return "1y"


def fetch_and_save_historical_stock_data(user_stock: UserStock) -> int:
    ticker = user_stock.stock.yahoo_ticker or user_stock.stock.ticker
    resolved_symbol = ticker
    last_error = None

    try:
        configure_yfinance_cache()

        for candidate in build_ticker_candidates(user_stock):
            try:
                history, trailing_eps = _fetch_history_frame(
                    user_stock,
                    candidate,
                    period="1y",
                )
                if not history.empty:
                    resolved_symbol = candidate
                    _persist_yahoo_ticker(user_stock, candidate)
                    return _save_history_rows(user_stock, history, trailing_eps)
            except Exception as candidate_exc:
                last_error = candidate_exc
                continue

        if last_error is not None:
            raise ValueError(str(last_error)) from last_error
        raise ValueError("No market data returned for the selected ticker.")
    except Exception as exc:
        raise ValueError(
            f"Failed to fetch 1-year data for ticker: {resolved_symbol}. Reason: {str(exc)}"
        ) from exc


def fetch_and_save_incremental_stock_data(
    user_stock: UserStock,
    *,
    latest_timestamp,
) -> int:
    ticker = user_stock.stock.yahoo_ticker or user_stock.stock.ticker
    resolved_symbol = ticker
    last_error = None
    now = timezone.now()
    gap = now - latest_timestamp
    period = _incremental_period_for_gap(gap)

    try:
        configure_yfinance_cache()

        for candidate in build_ticker_candidates(user_stock):
            try:
                history, trailing_eps = _fetch_history_frame(
                    user_stock,
                    candidate,
                    period=period,
                )
                if history.empty:
                    continue

                resolved_symbol = candidate
                _persist_yahoo_ticker(user_stock, candidate)

                incremental_history = history[history.index > latest_timestamp]
                if incremental_history.empty:
                    return 0

                return _save_history_rows(user_stock, incremental_history, trailing_eps)
            except Exception as candidate_exc:
                last_error = candidate_exc
                continue

        if last_error is not None:
            raise ValueError(str(last_error)) from last_error
        return 0
    except Exception as exc:
        raise ValueError(
            f"Failed to fetch incremental data for ticker: {resolved_symbol}. Reason: {str(exc)}"
        ) from exc


def sync_user_stock_history_if_stale(
    user_stock: UserStock,
    *,
    latest_timestamp=None,
) -> int:
    latest_timestamp = latest_timestamp or UserStockData.objects.filter(
        user_stock=user_stock
    ).order_by("-timestamp").values_list("timestamp", flat=True).first()

    if latest_timestamp is None:
        return fetch_and_save_historical_stock_data(user_stock)

    if timezone.is_naive(latest_timestamp):
        latest_timestamp = timezone.make_aware(
            latest_timestamp,
            timezone.get_current_timezone(),
        )

    now = timezone.now()
    if now - latest_timestamp <= timedelta(hours=1):
        return 0

    return fetch_and_save_incremental_stock_data(
        user_stock,
        latest_timestamp=latest_timestamp,
    )


def sync_user_stock_history(user_stock: UserStock) -> int:
    return fetch_and_save_historical_stock_data(user_stock)
