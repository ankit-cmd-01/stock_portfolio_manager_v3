import logging
from datetime import date

import pandas as pd
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from advanced.models import EarningsCache, NewsArticle, OverallSentimentCache
from advanced.services.earnings_service import (
    _to_serializable,
    fetch_last_quarter_earnings,
    generate_ai_summary,
)
from advanced.services.finbert_service import batch_analyze
from advanced.services.news_scraper import (
    article_matches_company,
    enrich_news,
    fetch_stock_news,
    get_new_articles_only,
    is_generic_google_news_text,
    looks_like_duplicate_text,
    sanitize_news_text,
)
from advanced.utils.cache_helpers import (
    recompute_overall_sentiment,
    save_new_articles_to_db,
    should_run_incremental_fetch,
)
from stock_master.models import StockMaster
from stock_master.yahoo import resolve_yahoo_symbol

logger = logging.getLogger(__name__)


def _exchange_candidate(symbol: str, exchange: str) -> str | None:
    base_symbol = (symbol or "").strip().upper()
    exchange = (exchange or "").strip().upper()
    if not base_symbol:
        return None
    if "." in base_symbol:
        base_symbol = base_symbol.rsplit(".", 1)[0]
    if exchange == "NSE":
        return f"{base_symbol}.NS"
    if exchange == "BSE":
        return f"{base_symbol}.BO"
    return base_symbol


def _find_stock_record(ticker: str, company: str = ""):
    company = (company or "").strip()
    stock = StockMaster.objects.filter(
        Q(yahoo_ticker__iexact=ticker) | Q(ticker__iexact=ticker)
    ).first()
    if stock or not company:
        return stock
    return StockMaster.objects.filter(stock_name__iexact=company).first()


def _build_ticker_candidates(ticker: str, stock: StockMaster | None) -> list[str]:
    raw_candidates = [ticker]
    exchange = (getattr(stock, "exchange", "") or "").upper()
    market = (getattr(stock, "market", "") or "").lower()
    if stock:
        raw_candidates.extend([stock.yahoo_ticker, stock.ticker])
        try:
            resolved_symbol = resolve_yahoo_symbol(
                stock_name=stock.stock_name,
                ticker=stock.ticker,
                exchange=stock.exchange,
            )
        except Exception as exc:
            logger.debug("Yahoo symbol resolution failed for %s: %s", stock.stock_name, exc)
            resolved_symbol = None
        raw_candidates.append(resolved_symbol)

    candidates = []
    for raw in raw_candidates:
        symbol = (raw or "").strip().upper()
        base_symbol = symbol.rsplit(".", 1)[0] if "." in symbol else symbol
        exact_exchange_symbol = _exchange_candidate(base_symbol, exchange)
        candidate_group = [symbol]
        if base_symbol:
            candidate_group.append(base_symbol)
        if exact_exchange_symbol:
            candidate_group.append(exact_exchange_symbol)
        if base_symbol and exchange == "NSE" and "indian" in market:
            candidate_group.append(f"{base_symbol}.BO")

        for candidate in candidate_group:
            if not candidate or candidate in candidates:
                continue
            candidates.append(candidate)
    return candidates


def _resolve_stock_context(ticker: str, company: str = "") -> dict:
    stock = _find_stock_record(ticker, company)
    resolved_company = (company or "").strip() or (stock.stock_name if stock else ticker)
    ticker_candidates = _build_ticker_candidates(ticker, stock)
    return {
        "company": resolved_company,
        "stock": stock,
        "ticker_candidates": ticker_candidates,
        "yahoo_ticker": ticker_candidates[0] if ticker_candidates else ticker,
        "market_hint": getattr(stock, "market", "") if stock else "",
    }


def _clone_alias_articles_to_ticker(ticker: str, company: str, stock_context: dict) -> int:
    if not company or NewsArticle.objects.filter(ticker=ticker).exists():
        return 0

    alias_tickers = [candidate for candidate in stock_context["ticker_candidates"] if candidate and candidate != ticker]
    company_names = {
        sanitize_news_text(company),
        sanitize_news_text(getattr(stock_context.get("stock"), "stock_name", "")),
    }
    company_names = {name for name in company_names if name}

    alias_query = Q()
    if alias_tickers:
        alias_query |= Q(ticker__in=alias_tickers)
    for name in company_names:
        alias_query |= Q(company__iexact=name)
    if not alias_query:
        return 0

    cloned_count = 0
    alias_articles = NewsArticle.objects.filter(alias_query).order_by("-published_at", "-scraped_at")[:30]
    for article in alias_articles:
        _, created = NewsArticle.objects.get_or_create(
            ticker=ticker,
            link=article.link,
            defaults={
                "company": company,
                "title": article.title,
                "description": article.description,
                "content_snippet": article.content_snippet,
                "source": article.source,
                "source_domain": article.source_domain,
                "published_at": article.published_at,
                "sentiment_label": article.sentiment_label,
                "sentiment_score": article.sentiment_score,
            },
        )
        if created:
            cloned_count += 1
    return cloned_count


def _prune_irrelevant_cached_articles(ticker: str, company: str, stock_context: dict) -> int:
    if not company:
        return 0

    deleted_count = 0
    articles = NewsArticle.objects.filter(ticker=ticker)
    for article in articles:
        if article_matches_company(
            {
                "title": article.title,
                "description": article.description,
                "content": article.content_snippet,
            },
            company,
            ticker_candidates=stock_context["ticker_candidates"],
        ):
            continue
        article.delete()
        deleted_count += 1
    return deleted_count


def _default_overall_payload():
    return {
        "overall_sentiment": "NEUTRAL",
        "positive_pct": 0.0,
        "negative_pct": 0.0,
        "neutral_pct": 100.0,
        "article_count": 0,
        "last_updated": None,
    }


def _serialize_article(article: NewsArticle) -> dict:
    title = sanitize_news_text(article.title)
    description = sanitize_news_text(article.description)
    content = sanitize_news_text(article.content_snippet)
    if is_generic_google_news_text(description):
        description = ""
    if is_generic_google_news_text(content):
        content = ""
    if looks_like_duplicate_text(description, title):
        description = ""
    if looks_like_duplicate_text(content, title) or looks_like_duplicate_text(content, description):
        if len(content) <= max(len(description) + 40, 180):
            content = ""

    return {
        "id": article.id,
        "title": title,
        "description": description,
        "content_snippet": content,
        "source": article.source,
        "source_domain": article.source_domain,
        "link": article.link,
        "published_at": article.published_at.isoformat() if article.published_at else None,
        "sentiment_label": article.sentiment_label,
        "sentiment_score": article.sentiment_score,
        "scraped_at": article.scraped_at.isoformat(),
    }


def _repair_cached_news_articles(ticker: str) -> bool:
    articles = list(NewsArticle.objects.filter(ticker=ticker).order_by("-published_at", "-scraped_at")[:12])
    if not articles:
        return False

    repair_payload = []
    article_by_link = {}
    needs_recompute = False

    for article in articles:
        title = sanitize_news_text(article.title)
        description = sanitize_news_text(article.description)
        content = sanitize_news_text(article.content_snippet)
        sentiment_is_fallback = article.sentiment_label in {None, "", "NEUTRAL"} and (
            article.sentiment_score is None or abs((article.sentiment_score or 0.5) - 0.5) < 1e-9
        )
        needs_content = (
            not content
            or len(content) < 180
            or looks_like_duplicate_text(content, title)
            or looks_like_duplicate_text(content, description)
        )
        needs_description = not description or looks_like_duplicate_text(description, title)
        if not (needs_content or needs_description or sentiment_is_fallback):
            continue

        repair_payload.append(
            {
                "title": title,
                "description": description or content,
                "content": content,
                "link": article.link,
                "source": article.source,
                "source_domain": article.source_domain,
                "date": article.published_at,
            }
        )
        article_by_link[article.link] = article

    if not repair_payload:
        return False

    repaired_df = enrich_news(pd.DataFrame(repair_payload))
    repaired_articles = batch_analyze(repaired_df.to_dict(orient="records"))

    for repaired in repaired_articles:
        article = article_by_link.get(repaired.get("link"))
        if not article:
            continue

        new_description = sanitize_news_text(repaired.get("description"))
        new_content = sanitize_news_text(repaired.get("content"))
        updated_fields = []

        if new_description and not looks_like_duplicate_text(new_description, article.title):
            if new_description != sanitize_news_text(article.description):
                article.description = new_description
                updated_fields.append("description")
        elif is_generic_google_news_text(article.description):
            article.description = ""
            updated_fields.append("description")

        if new_content and not looks_like_duplicate_text(new_content, article.title):
            if new_content != sanitize_news_text(article.content_snippet):
                article.content_snippet = new_content
                updated_fields.append("content_snippet")
        elif is_generic_google_news_text(article.content_snippet):
            article.content_snippet = ""
            updated_fields.append("content_snippet")

        if repaired.get("source_domain") and repaired.get("source_domain") != article.source_domain:
            article.source_domain = repaired.get("source_domain")
            updated_fields.append("source_domain")

        if repaired.get("sentiment_label") and repaired.get("sentiment_label") != article.sentiment_label:
            article.sentiment_label = repaired.get("sentiment_label")
            updated_fields.append("sentiment_label")
            needs_recompute = True

        if repaired.get("sentiment_score") != article.sentiment_score:
            article.sentiment_score = repaired.get("sentiment_score")
            updated_fields.append("sentiment_score")
            needs_recompute = True

        if updated_fields:
            article.save(update_fields=updated_fields)

    return needs_recompute


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def news_sentiment_view(request):
    ticker = request.GET.get("ticker", "").strip().upper()
    stock_context = _resolve_stock_context(ticker, request.GET.get("company", ""))
    company = stock_context["company"]
    repair_cached = request.GET.get("repair", "").strip() == "1"

    if not ticker:
        return Response(
            {"error": "The 'ticker' query param is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    new_count = 0
    try:
        if should_run_incremental_fetch(ticker):
            logger.info("[%s] Starting incremental news fetch.", ticker)
            raw_df = fetch_stock_news(
                stock_context["yahoo_ticker"],
                company,
                ticker_candidates=stock_context["ticker_candidates"],
                market_hint=stock_context["market_hint"],
            )
            raw_articles = raw_df.to_dict(orient="records") if not raw_df.empty else []
            new_articles_raw = get_new_articles_only(ticker, raw_articles)

            if new_articles_raw:
                new_df = pd.DataFrame(new_articles_raw)
                enriched_df = enrich_news(new_df)
                analyzed = batch_analyze(enriched_df.to_dict(orient="records"))
                new_count = save_new_articles_to_db(ticker, company, analyzed)
                logger.info("[%s] Saved %s new articles to DB.", ticker, new_count)

            recompute_overall_sentiment(ticker)
        elif not OverallSentimentCache.objects.filter(ticker=ticker).exists():
            recompute_overall_sentiment(ticker)
    except Exception as exc:
        logger.error("[%s] News sentiment refresh failed: %s", ticker, exc)

    try:
        all_articles_qs = NewsArticle.objects.filter(ticker=ticker)
        if _prune_irrelevant_cached_articles(ticker, company, stock_context):
            recompute_overall_sentiment(ticker)
            all_articles_qs = NewsArticle.objects.filter(ticker=ticker)
        if not all_articles_qs.exists():
            cloned_count = _clone_alias_articles_to_ticker(ticker, company, stock_context)
            if cloned_count:
                recompute_overall_sentiment(ticker)
                all_articles_qs = NewsArticle.objects.filter(ticker=ticker)
        if repair_cached and _repair_cached_news_articles(ticker):
            recompute_overall_sentiment(ticker)
            all_articles_qs = NewsArticle.objects.filter(ticker=ticker)
        article_total = all_articles_qs.count()
        overall_obj = OverallSentimentCache.objects.filter(ticker=ticker).first()
        if overall_obj and (overall_obj.article_count != article_total or (article_total > 0 and overall_obj.is_stale())):
            overall_obj = recompute_overall_sentiment(ticker)
        elif article_total > 0 and overall_obj is None:
            overall_obj = recompute_overall_sentiment(ticker)

        articles_data = [
            _serialize_article(article)
            for article in all_articles_qs.order_by("-published_at", "-scraped_at")[:30]
        ]

        overall_data = _default_overall_payload()
        if overall_obj:
            overall_data = {
                "overall_sentiment": overall_obj.overall_sentiment,
                "positive_pct": overall_obj.positive_pct,
                "negative_pct": overall_obj.negative_pct,
                "neutral_pct": overall_obj.neutral_pct,
                "article_count": overall_obj.article_count,
                "last_updated": overall_obj.last_computed_at.isoformat(),
            }

        return Response(
            {
                "ticker": ticker,
                "company": company,
                "new_articles_added": new_count,
                "overall": overall_data,
                "articles": articles_data,
            }
        )
    except Exception as exc:
        logger.error("[%s] News sentiment response assembly failed: %s", ticker, exc)
        return Response(
            {
                "ticker": ticker,
                "company": company,
                "new_articles_added": 0,
                "overall": _default_overall_payload(),
                "articles": [],
            }
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def earnings_view(request):
    ticker = request.GET.get("ticker", "").strip().upper()
    stock_context = _resolve_stock_context(ticker, request.GET.get("company", ""))
    company = stock_context["company"]

    if not ticker:
        return Response(
            {"error": "The 'ticker' query param is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    cached = EarningsCache.objects.filter(ticker=ticker).first()
    if cached and not cached.is_stale():
        logger.info("[%s] Returning cached earnings data.", ticker)
        return Response(_serialize_earnings(cached, is_cached=True))

    logger.info("[%s] Fetching fresh earnings from yfinance.", ticker)
    earnings_data = fetch_last_quarter_earnings(stock_context["yahoo_ticker"])
    if not earnings_data:
        if cached:
            logger.warning("[%s] Fresh fetch failed. Returning stale cached earnings.", ticker)
            return Response(_serialize_earnings(cached, is_cached=True, is_stale=True))
        return Response(
            {"error": "Could not fetch earnings data from yfinance."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    logger.info("[%s] Generating DeepSeek earnings summary.", ticker)
    ai_summary, ai_model_used = generate_ai_summary(ticker, company, earnings_data)

    quarter_value = earnings_data.get("quarter_date")
    if isinstance(quarter_value, str):
        try:
            quarter_value = date.fromisoformat(quarter_value)
        except ValueError:
            quarter_value = None

    cached, _ = EarningsCache.objects.update_or_create(
        ticker=ticker,
        defaults={
            "company": company,
            "quarter_date": quarter_value,
            "eps_actual": _to_serializable(earnings_data.get("eps_actual")),
            "eps_estimate": _to_serializable(earnings_data.get("eps_estimate")),
            "eps_surprise_pct": _to_serializable(earnings_data.get("eps_surprise_pct")),
            "revenue_actual": _to_serializable(earnings_data.get("revenue_actual")),
            "revenue_estimate": _to_serializable(earnings_data.get("revenue_prev_quarter")),
            "revenue_surprise_pct": _to_serializable(earnings_data.get("revenue_surprise_pct")),
            "raw_financials": _to_serializable(earnings_data.get("raw_financials", {})),
            "ai_summary": ai_summary,
            "ai_model_used": ai_model_used,
        },
    )
    return Response(_serialize_earnings(cached, is_cached=False))


def _serialize_earnings(obj: EarningsCache, *, is_cached: bool, is_stale: bool = False) -> dict:
    return {
        "ticker": obj.ticker,
        "company": obj.company,
        "quarter_date": str(obj.quarter_date) if obj.quarter_date else None,
        "eps_actual": obj.eps_actual,
        "eps_estimate": obj.eps_estimate,
        "eps_surprise_pct": obj.eps_surprise_pct,
        "revenue_actual": obj.revenue_actual,
        "revenue_estimate": obj.revenue_estimate,
        "revenue_surprise_pct": obj.revenue_surprise_pct,
        "raw_financials": obj.raw_financials,
        "ai_summary": obj.ai_summary,
        "ai_model_used": obj.ai_model_used,
        "fetched_at": obj.fetched_at.isoformat(),
        "is_cached": is_cached,
        "is_stale": is_stale,
    }
