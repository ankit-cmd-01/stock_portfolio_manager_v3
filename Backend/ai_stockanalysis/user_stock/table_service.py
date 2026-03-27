import logging
import math
import threading
from datetime import datetime, timedelta

from advanced.services.finbert_service import batch_analyze
from advanced.services.news_scraper import _safe_fetch, article_matches_company
from django.utils import timezone
from advanced.models import OverallSentimentCache


logger = logging.getLogger(__name__)

ET_FEED_URLS = (
    "https://economictimes.indiatimes.com/rssfeeds/2143429.cms",
    "https://economictimes.indiatimes.com/rssfeeds/2146842.cms",
)
ET_FEED_CACHE_TTL = timedelta(minutes=15)
MIN_PRICE_HISTORY = 20
LR_LOOKBACK = 30
SENTIMENT_LIMIT = 10

_et_feed_cache = {"rows": [], "expires_at": None}
_et_feed_lock = threading.Lock()


def _clamp(value, lower, upper):
    return max(lower, min(upper, value))


def _to_float(value, default=0.0):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if math.isnan(number) or math.isinf(number):
        return default
    return number


def _build_ticker_candidates(user_stock):
    stock = user_stock.stock
    raw_candidates = [
        stock.yahoo_ticker,
        stock.ticker,
    ]
    exchange = (stock.exchange or "").strip().upper()
    base_ticker = (stock.ticker or "").strip().upper()
    if base_ticker and "." in base_ticker:
        base_ticker = base_ticker.rsplit(".", 1)[0]
    if base_ticker and exchange == "NSE":
        raw_candidates.append(f"{base_ticker}.NS")
    if base_ticker and exchange == "BSE":
        raw_candidates.append(f"{base_ticker}.BO")
    if base_ticker:
        raw_candidates.append(base_ticker)

    ordered = []
    seen = set()
    for candidate in raw_candidates:
        cleaned = (candidate or "").strip().upper()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        ordered.append(cleaned)
    return ordered


def _load_economic_times_rows():
    now = timezone.now()
    with _et_feed_lock:
        cached_rows = _et_feed_cache.get("rows") or []
        expires_at = _et_feed_cache.get("expires_at")
        if cached_rows and expires_at and expires_at > now:
            return cached_rows

    rows = []
    for url in ET_FEED_URLS:
        rows.extend(_safe_fetch("Economic Times", url))

    deduped = {}
    for row in rows:
        link = row.get("link")
        if link and link not in deduped:
            deduped[link] = row

    sorted_rows = sorted(
        deduped.values(),
        key=lambda row: row.get("date") or timezone.make_aware(datetime.min),
        reverse=True,
    )

    with _et_feed_lock:
        _et_feed_cache["rows"] = sorted_rows
        _et_feed_cache["expires_at"] = now + ET_FEED_CACHE_TTL

    return sorted_rows


def _match_economic_times_articles(user_stock, limit=SENTIMENT_LIMIT):
    company_name = user_stock.stock.stock_name
    ticker_candidates = _build_ticker_candidates(user_stock)
    matches = []
    for row in _load_economic_times_rows():
        if article_matches_company(row, company_name, ticker_candidates=ticker_candidates):
            matches.append(row)
        if len(matches) >= limit:
            break
    return matches


def _score_sentiment(articles):
    if not articles:
        return {
            "sentiment": "NEUTRAL",
            "sentiment_score": 0.0,
            "news_count": 0,
        }

    analyzed = batch_analyze(articles)
    weighted_score = 0.0
    for article in analyzed:
        label = (article.get("sentiment_label") or "NEUTRAL").upper()
        score = _to_float(article.get("sentiment_score"), 0.5)
        if label == "POSITIVE":
            weighted_score += score
        elif label == "NEGATIVE":
            weighted_score -= score

    average_score = weighted_score / max(len(analyzed), 1)
    if average_score >= 0.18:
        label = "POSITIVE"
    elif average_score <= -0.18:
        label = "NEGATIVE"
    else:
        label = "NEUTRAL"

    return {
        "sentiment": label,
        "sentiment_score": round(average_score, 4),
        "news_count": len(analyzed),
    }


def _cached_sentiment_lookup(user_stocks):
    candidate_map = {}
    normalized_candidates = set()

    for user_stock in user_stocks:
        candidates = _build_ticker_candidates(user_stock)
        if not candidates:
            candidates = [user_stock.stock.yahoo_ticker or user_stock.stock.ticker]
        candidate_map[user_stock.id] = [(candidate or "").strip().upper() for candidate in candidates if candidate]
        normalized_candidates.update(candidate_map[user_stock.id])

    cache_lookup = {
        (item.ticker or "").strip().upper(): item
        for item in OverallSentimentCache.objects.filter(ticker__in=normalized_candidates)
    }

    sentiment_lookup = {}
    for user_stock in user_stocks:
        matched = None
        for candidate in candidate_map.get(user_stock.id, []):
            matched = cache_lookup.get(candidate)
            if matched is not None:
                break
        if matched is None:
            continue
        sentiment_lookup[user_stock.id] = {
            "sentiment": (matched.overall_sentiment or "NEUTRAL").upper(),
            "sentiment_score": round((matched.positive_pct - matched.negative_pct) / 100.0, 4),
            "news_count": matched.article_count or 0,
        }

    return sentiment_lookup


def _linear_regression_forecast(prices):
    series = [_to_float(price) for price in prices if _to_float(price) > 0]
    if not series:
        return {"predicted_price": 0.0, "confidence_pct": 0.0}
    if len(series) == 1:
        return {
            "predicted_price": round(series[-1], 2),
            "confidence_pct": 50.0,
        }

    count = len(series)
    mean_x = (count - 1) / 2
    mean_y = sum(series) / count
    denominator = sum((index - mean_x) ** 2 for index in range(count))
    if denominator <= 0:
        return {
            "predicted_price": round(series[-1], 2),
            "confidence_pct": 50.0,
        }

    slope = sum((index - mean_x) * (value - mean_y) for index, value in enumerate(series)) / denominator
    intercept = mean_y - slope * mean_x
    predicted_price = intercept + slope * count
    fitted = [intercept + slope * index for index in range(count)]

    residual_sum = sum((actual - fit) ** 2 for actual, fit in zip(series, fitted))
    total_sum = sum((actual - mean_y) ** 2 for actual in series)
    if total_sum <= 0:
        r_squared = 1.0
    else:
        r_squared = 1 - (residual_sum / total_sum)

    confidence_pct = _clamp(40 + max(0.0, r_squared) * 55, 40, 95)
    return {
        "predicted_price": round(max(predicted_price, 0.0), 2),
        "confidence_pct": round(confidence_pct, 1),
    }


def _signal_from_prices(current_price, predicted_price):
    if predicted_price >= current_price:
        return "BUY"
    return "SELL"


def _build_row(user_stock, sentiment_lookup=None):
    history = list(user_stock.stock_data.all())
    closes = [_to_float(item.close) for item in history if _to_float(item.close) > 0]
    cached_sentiment = (sentiment_lookup or {}).get(user_stock.id)
    if not closes:
        sentiment = cached_sentiment or {
            "sentiment": "NEUTRAL",
            "sentiment_score": 0.0,
            "news_count": 0,
        }
        ticker = user_stock.stock.yahoo_ticker or user_stock.stock.ticker
        return {
            "user_stock_id": user_stock.id,
            "ticker": ticker,
            "company_name": user_stock.stock.stock_name,
            "price": 0.0,
            "min_price": 0.0,
            "max_price": 0.0,
            "predicted_price": 0.0,
            "change_pct": 0.0,
            "signal": "SELL",
            "confidence_pct": 0.0,
            "discount_pct": 0.0,
            "sentiment": sentiment["sentiment"],
            "sentiment_score": sentiment["sentiment_score"],
            "news_count": sentiment["news_count"],
        }

    current_price = closes[-1]
    trailing_prices = closes[-MIN_PRICE_HISTORY:] if len(closes) >= MIN_PRICE_HISTORY else closes
    regression_prices = closes[-LR_LOOKBACK:] if len(closes) >= LR_LOOKBACK else closes
    regression = _linear_regression_forecast(regression_prices)
    predicted_price = regression["predicted_price"] or current_price
    recent_min = min(trailing_prices)
    recent_max = max(trailing_prices)
    change_pct = ((predicted_price - current_price) / current_price) * 100 if current_price > 0 else 0.0
    discount_pct = ((recent_max - current_price) / recent_max) * 100 if recent_max > 0 else 0.0

    if cached_sentiment is not None:
        sentiment = cached_sentiment
    else:
        articles = _match_economic_times_articles(user_stock)
        sentiment = _score_sentiment(articles)
    ticker = user_stock.stock.yahoo_ticker or user_stock.stock.ticker

    return {
        "user_stock_id": user_stock.id,
        "ticker": ticker,
        "company_name": user_stock.stock.stock_name,
        "price": round(current_price, 2),
        "min_price": round(recent_min, 2),
        "max_price": round(recent_max, 2),
        "predicted_price": round(predicted_price, 2),
        "change_pct": round(change_pct, 2),
        "signal": _signal_from_prices(current_price, predicted_price),
        "confidence_pct": regression["confidence_pct"],
        "discount_pct": round(max(discount_pct, 0.0), 2),
        "sentiment": sentiment["sentiment"],
        "sentiment_score": sentiment["sentiment_score"],
        "news_count": sentiment["news_count"],
    }


def build_portfolio_table_rows(user_stocks):
    sentiment_lookup = _cached_sentiment_lookup(user_stocks)
    rows = []
    for user_stock in user_stocks:
        try:
            rows.append(_build_row(user_stock, sentiment_lookup=sentiment_lookup))
        except Exception as exc:
            ticker = user_stock.stock.yahoo_ticker or user_stock.stock.ticker
            logger.warning("Portfolio table row build failed for %s: %s", ticker, exc)
            rows.append(
                {
                    "user_stock_id": user_stock.id,
                    "ticker": ticker,
                    "company_name": user_stock.stock.stock_name,
                    "price": 0.0,
                    "min_price": 0.0,
                    "max_price": 0.0,
                    "predicted_price": 0.0,
                    "change_pct": 0.0,
                    "signal": "SELL",
                    "confidence_pct": 0.0,
                    "discount_pct": 0.0,
                    "sentiment": "NEUTRAL",
                    "sentiment_score": 0.0,
                    "news_count": 0,
                }
            )
    return rows
