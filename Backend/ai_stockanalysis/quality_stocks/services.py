from __future__ import annotations

import json
import logging
import math
from statistics import mean
from typing import Any, TypedDict
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.db import transaction
from django.db.models import Prefetch

from advanced.models import EarningsCache, OverallSentimentCache
from portfolio.models import Portfolio
from portfolio.services.forecast_service import predict_portfolio
from stock_master.models import StockCategory
from user_stock.models import UserStock, UserStockData

from .models import QualityStock

try:
    from langgraph.graph import END, START, StateGraph

    LANGGRAPH_AVAILABLE = True
except ImportError:  # pragma: no cover - runtime fallback
    END = "END"
    START = "START"
    StateGraph = None
    LANGGRAPH_AVAILABLE = False

logger = logging.getLogger(__name__)

PRICE_HISTORY_LIMIT = 90
RANKED_CANDIDATE_LIMIT = 3
SIGNAL_BONUS = {
    QualityStock.BuySignal.BUY: 10.0,
    QualityStock.BuySignal.HOLD: 4.0,
    QualityStock.BuySignal.SELL: -8.0,
}
SENTIMENT_BONUS = {
    "POSITIVE": 4.0,
    "NEUTRAL": 0.0,
    "NEGATIVE": -4.0,
}


class QualityStockState(TypedDict, total=False):
    stage_payloads: list[dict[str, Any]]
    analyzed_payloads: list[dict[str, Any]]
    saved_ids: list[int]


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if math.isnan(number) or math.isinf(number):
        return default
    return number


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def _resolve_symbol(user_stock: UserStock) -> str:
    return user_stock.stock.yahoo_ticker or user_stock.stock.ticker


def _resolve_company_name(user_stock: UserStock) -> str:
    return getattr(user_stock.stock, "company_name", None) or user_stock.stock.stock_name


def _normalize_signal(value: Any) -> str:
    signal = str(value or "").strip().upper()
    if signal in {choice for choice, _ in QualityStock.BuySignal.choices}:
        return signal
    return QualityStock.BuySignal.HOLD


def _signal_from_expected_change(expected_change_pct: float) -> str:
    if expected_change_pct >= 4.0:
        return QualityStock.BuySignal.BUY
    if expected_change_pct <= -3.0:
        return QualityStock.BuySignal.SELL
    return QualityStock.BuySignal.HOLD


def _extract_json_object(content: str) -> dict[str, Any]:
    cleaned = (content or "").strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.replace("json", "", 1).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("LLM response did not contain a JSON object.")
    return json.loads(cleaned[start : end + 1])


def _provider_candidates() -> list[dict[str, str]]:
    candidates: list[dict[str, str]] = []
    if getattr(settings, "XAI_API_KEY", ""):
        candidates.append(
            {
                "provider": "grok",
                "api_key": settings.XAI_API_KEY,
                "model": getattr(settings, "XAI_MODEL", "grok-beta"),
                "base_url": getattr(settings, "XAI_BASE_URL", "https://api.x.ai/v1").rstrip("/"),
            }
        )
    if getattr(settings, "DEEPSEEK_API_KEY", ""):
        candidates.append(
            {
                "provider": "deepseek",
                "api_key": settings.DEEPSEEK_API_KEY,
                "model": getattr(settings, "DEEPSEEK_MODEL", "deepseek-chat"),
                "base_url": getattr(settings, "DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/"),
            }
        )
    if getattr(settings, "GROQ_API_KEY", ""):
        candidates.append(
            {
                "provider": "groq",
                "api_key": settings.GROQ_API_KEY,
                "model": getattr(settings, "GROQ_MODEL", "llama-3.3-70b-versatile"),
                "base_url": getattr(settings, "GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/"),
            }
        )
    return candidates


def _find_metric_value(raw_financials: Any, keys: list[str]) -> float | None:
    if not isinstance(raw_financials, dict):
        return None
    normalized_keys = {key.strip().lower(): value for key, value in raw_financials.items()}
    for candidate in keys:
        matched = normalized_keys.get(candidate.lower())
        if matched is not None:
            return _safe_float(matched, default=0.0)
    for key, value in normalized_keys.items():
        if any(candidate.lower() in key for candidate in keys):
            number = _safe_float(value, default=float("nan"))
            if not math.isnan(number):
                return number
    return None


def _normalize_graphs_data(graphs_data: Any) -> dict[str, Any]:
    payload = graphs_data if isinstance(graphs_data, dict) else {}
    normalized = {
        "price_history": payload.get("price_history") or [],
        "financial_metrics": [],
    }

    for metric in payload.get("financial_metrics") or []:
        if not isinstance(metric, dict):
            continue
        label = str(metric.get("label") or "").strip() or "Metric"
        value = metric.get("value")
        unit = metric.get("unit")
        numeric_value = _safe_float(value, default=float("nan"))

        if label in {"Revenue", "Revenue (B)"}:
            if not math.isnan(numeric_value) and abs(numeric_value) >= 1_000_000:
                numeric_value = numeric_value / 1_000_000_000
            normalized["financial_metrics"].append(
                {
                    "label": "Revenue (B)",
                    "value": None if math.isnan(numeric_value) else round(numeric_value, 2),
                    "unit": "B",
                }
            )
            continue

        normalized["financial_metrics"].append(
            {
                "label": label,
                "value": value,
                "unit": unit,
            }
        )

    return normalized


def _build_price_history(rows: list[UserStockData]) -> list[dict[str, Any]]:
    history = rows[-PRICE_HISTORY_LIMIT:]
    return [
        {
            "date": row.timestamp.date().isoformat(),
            "close": round(_safe_float(row.close), 4),
        }
        for row in history
    ]


def _momentum(prices: list[float], window: int) -> float:
    if not prices:
        return 0.0
    baseline = prices[0] if len(prices) <= window else prices[-window - 1]
    current = prices[-1]
    if baseline <= 0:
        return 0.0
    return ((current - baseline) / baseline) * 100.0


def _volatility(prices: list[float], window: int = 20) -> float:
    if len(prices) < 2:
        return 0.0
    recent = prices[-(window + 1) :]
    returns = []
    for index in range(1, len(recent)):
        previous = recent[index - 1]
        current = recent[index]
        if previous > 0:
            returns.append(abs(((current - previous) / previous) * 100.0))
    return round(mean(returns), 2) if returns else 0.0


def _build_prediction_lookup(portfolio: Portfolio) -> dict[int, dict[str, Any]]:
    try:
        forecast_payload = predict_portfolio(portfolio.id)
    except Exception as exc:  # pragma: no cover - feature should keep working without forecast
        logger.warning("Quality stock forecast fetch failed for portfolio %s: %s", portfolio.id, exc)
        forecast_payload = {"stock_predictions": []}

    lookup: dict[int, dict[str, Any]] = {}
    for row in forecast_payload.get("stock_predictions", []):
        user_stock_id = row.get("user_stock_id")
        if user_stock_id:
            lookup[int(user_stock_id)] = row
    return lookup


def _build_sector_averages(user_stock: UserStock) -> dict[str, Any]:
    sector_categories = list(
        user_stock.stock.categories.filter(category_type=StockCategory.CategoryType.SECTOR).values_list("name", flat=True)[:3]
    )
    if not sector_categories:
        return {"sector_labels": [], "avg_pe": None, "avg_revenue_growth": None}

    peer_qs = (
        UserStock.objects.filter(stock__categories__name__in=sector_categories)
        .select_related("stock")
        .prefetch_related(
            Prefetch("stock_data", queryset=UserStockData.objects.order_by("timestamp")),
            "stock__categories",
        )
        .distinct()[:40]
    )

    peer_symbols = [_resolve_symbol(stock) for stock in peer_qs]
    earnings_lookup = {
        item.ticker: item
        for item in EarningsCache.objects.filter(ticker__in=peer_symbols)
    }

    peer_pes = []
    peer_revenue_growth = []
    for peer in peer_qs:
        rows = list(peer.stock_data.all())
        if rows and rows[-1].pe_ratio is not None:
            peer_pes.append(_safe_float(rows[-1].pe_ratio))
        earnings = earnings_lookup.get(_resolve_symbol(peer))
        if earnings and earnings.revenue_surprise_pct is not None:
            peer_revenue_growth.append(_safe_float(earnings.revenue_surprise_pct))

    return {
        "sector_labels": sector_categories,
        "avg_pe": round(mean(peer_pes), 2) if peer_pes else None,
        "avg_revenue_growth": round(mean(peer_revenue_growth), 2) if peer_revenue_growth else None,
    }


def _build_financial_metrics(
    *,
    pe_ratio: float | None,
    eps: float | None,
    roe: float | None,
    debt_to_equity: float | None,
    revenue: float | None,
    revenue_growth: float | None,
) -> list[dict[str, Any]]:
    metrics: list[dict[str, Any]] = []
    if pe_ratio is not None:
        metrics.append({"label": "PE", "value": round(pe_ratio, 2), "unit": None})
    if eps is not None:
        metrics.append({"label": "EPS", "value": round(eps, 2), "unit": None})
    if roe is not None:
        metrics.append({"label": "ROE", "value": round(roe, 2), "unit": "%"})
    if debt_to_equity is not None:
        metrics.append({"label": "Debt/Equity", "value": round(debt_to_equity, 2), "unit": None})
    if revenue is not None:
        metrics.append({"label": "Revenue (B)", "value": round(revenue / 1_000_000_000, 2), "unit": "B"})
    if revenue_growth is not None:
        metrics.append({"label": "Revenue Growth", "value": round(revenue_growth, 2), "unit": "%"})
    return metrics


def _valuation_bonus(pe_ratio: float | None, sector_avg_pe: float | None) -> float:
    if pe_ratio is None or pe_ratio <= 0:
        return 0.0
    if sector_avg_pe and sector_avg_pe > 0:
        return _clamp(((sector_avg_pe - pe_ratio) / sector_avg_pe) * 18, -8, 10)
    return _clamp((20.0 - pe_ratio) / 2.5, -6, 8)


def _build_quality_payload(
    user_stock: UserStock,
    prediction_lookup: dict[int, dict[str, Any]],
    sentiment_lookup: dict[str, OverallSentimentCache],
    earnings_lookup: dict[str, EarningsCache],
) -> dict[str, Any]:
    symbol = _resolve_symbol(user_stock)
    company_name = _resolve_company_name(user_stock)
    rows = list(user_stock.stock_data.all())
    closes = [_safe_float(row.close) for row in rows if _safe_float(row.close) > 0]
    latest_row = rows[-1] if rows else None
    current_price = _safe_float(latest_row.close) if latest_row else 0.0
    pe_ratio = (
        _safe_float(latest_row.pe_ratio, default=float("nan"))
        if latest_row and latest_row.pe_ratio is not None
        else float("nan")
    )
    pe_ratio_value = None if math.isnan(pe_ratio) else pe_ratio

    prediction = prediction_lookup.get(user_stock.id, {})
    predicted_price = _safe_float(prediction.get("predicted_price"), current_price)
    expected_change_pct = ((predicted_price - current_price) / current_price * 100.0) if current_price > 0 else 0.0
    signal = _signal_from_expected_change(expected_change_pct)
    momentum_30 = _momentum(closes, 30)
    momentum_90 = _momentum(closes, 90)
    trend_volatility = _volatility(closes)

    sentiment = sentiment_lookup.get(symbol)
    sentiment_label = sentiment.overall_sentiment if sentiment else "NEUTRAL"
    sentiment_score = (
        (sentiment.positive_pct - sentiment.negative_pct) / 100.0
        if sentiment and sentiment.article_count
        else 0.0
    )

    earnings = earnings_lookup.get(symbol)
    raw_financials = earnings.raw_financials if earnings else {}
    eps = None if not earnings else (earnings.eps_actual if earnings.eps_actual is not None else earnings.eps_estimate)
    revenue = earnings.revenue_actual if earnings and earnings.revenue_actual is not None else None
    revenue_growth = earnings.revenue_surprise_pct if earnings and earnings.revenue_surprise_pct is not None else None
    roe = _find_metric_value(raw_financials, ["roe", "return on equity"])
    debt_to_equity = _find_metric_value(raw_financials, ["debt to equity", "debt/equity", "debt_to_equity"])

    sector_averages = _build_sector_averages(user_stock)
    valuation_bonus = _valuation_bonus(pe_ratio_value, sector_averages.get("avg_pe"))
    momentum_bonus = _clamp((momentum_30 * 0.35) + (momentum_90 * 0.18), -8, 12)
    base_score = _clamp(
        50.0
        + (expected_change_pct * 1.8)
        + valuation_bonus
        + momentum_bonus
        + SIGNAL_BONUS[signal]
        + SENTIMENT_BONUS.get(sentiment_label, 0.0),
        0.0,
        100.0,
    )

    graphs_data = _normalize_graphs_data(
        {
            "price_history": _build_price_history(rows),
            "financial_metrics": _build_financial_metrics(
                pe_ratio=pe_ratio_value,
                eps=eps,
                roe=roe,
                debt_to_equity=debt_to_equity,
                revenue=revenue,
                revenue_growth=revenue_growth,
            ),
        }
    )

    return {
        "portfolio_id": user_stock.portfolio_id,
        "portfolio_title": user_stock.portfolio.title,
        "user_stock_id": user_stock.id,
        "stock_id": user_stock.stock_id,
        "symbol": symbol,
        "stock_name": company_name,
        "current_price": round(current_price, 4),
        "predicted_price": round(predicted_price, 4),
        "expected_change_pct": round(expected_change_pct, 2),
        "signal": signal,
        "fundamentals": {
            "pe_ratio": None if pe_ratio_value is None else round(pe_ratio_value, 2),
            "eps": None if eps is None else round(_safe_float(eps), 2),
            "roe": None if roe is None else round(roe, 2),
            "debt_to_equity": None if debt_to_equity is None else round(debt_to_equity, 2),
            "revenue_growth": None if revenue_growth is None else round(_safe_float(revenue_growth), 2),
            "revenue": revenue,
        },
        "trend_metrics": {
            "momentum_30d": round(momentum_30, 2),
            "momentum_90d": round(momentum_90, 2),
            "volatility_20d": trend_volatility,
        },
        "sentiment": {
            "label": sentiment_label,
            "score": round(sentiment_score, 4),
            "article_count": sentiment.article_count if sentiment else 0,
        },
        "sector_averages": sector_averages,
        "graphs_data": graphs_data,
        "ranking_components": {
            "expected_change_pct": round(expected_change_pct, 2),
            "valuation_bonus": round(valuation_bonus, 2),
            "momentum_bonus": round(momentum_bonus, 2),
            "signal_bonus": SIGNAL_BONUS[signal],
            "sentiment_bonus": SENTIMENT_BONUS.get(sentiment_label, 0.0),
            "base_score": round(base_score, 2),
        },
    }


def _portfolio_user_stocks(portfolio: Portfolio) -> list[UserStock]:
    return list(
        UserStock.objects.filter(portfolio=portfolio, user=portfolio.user)
        .select_related("portfolio", "stock")
        .prefetch_related(
            Prefetch("stock_data", queryset=UserStockData.objects.order_by("timestamp")),
            "stock__categories",
        )
        .order_by("stock__stock_name", "stock__ticker")
    )


def _shared_context(
    portfolio: Portfolio,
) -> tuple[list[UserStock], dict[int, dict[str, Any]], dict[str, OverallSentimentCache], dict[str, EarningsCache]]:
    user_stocks = _portfolio_user_stocks(portfolio)
    prediction_lookup = _build_prediction_lookup(portfolio)
    symbols = [_resolve_symbol(user_stock) for user_stock in user_stocks]
    sentiment_lookup = {
        item.ticker: item
        for item in OverallSentimentCache.objects.filter(ticker__in=symbols)
    }
    earnings_lookup = {
        item.ticker: item
        for item in EarningsCache.objects.filter(ticker__in=symbols)
    }
    return user_stocks, prediction_lookup, sentiment_lookup, earnings_lookup


def _build_fallback_report(payload: dict[str, Any]) -> dict[str, Any]:
    score = _clamp(_safe_float(payload["ranking_components"].get("base_score")), 0.0, 100.0)
    signal = _signal_from_expected_change(_safe_float(payload.get("expected_change_pct")))
    fundamentals = payload.get("fundamentals", {})
    trend = payload.get("trend_metrics", {})
    sentiment = payload.get("sentiment", {})
    valuation_note = (
        f"PE is {fundamentals.get('pe_ratio')}, compared with sector average {payload.get('sector_averages', {}).get('avg_pe')}."
        if fundamentals.get("pe_ratio") is not None
        else "PE data is limited, so the score leans more on price trend and forecast spread."
    )
    justification = (
        f"{payload['symbol']} shows an expected move of {payload['expected_change_pct']:.2f}% with "
        f"30-day momentum at {trend.get('momentum_30d', 0):.2f}% and 90-day momentum at {trend.get('momentum_90d', 0):.2f}%. "
        f"{valuation_note}"
    )
    risks = [
        "Forecast upside is model-driven and can compress quickly if recent price leadership fades.",
        "Fundamental coverage is partial, so conviction is sensitive to missing balance-sheet metrics.",
    ]
    catalysts = [
        "A sustained positive earnings and price trend would strengthen the quality score further.",
        "Improving sector-relative valuation or sentiment could lift the signal quality.",
    ]
    if sentiment.get("label") == "NEGATIVE":
        risks[0] = "Recent news sentiment is negative, which could pressure the stock despite model upside."
    if sentiment.get("label") == "POSITIVE":
        catalysts[1] = "Positive news flow is supporting the current technical and quality setup."

    return {
        "symbol": payload["symbol"],
        "ai_rating": round(score, 2),
        "signal": signal,
        "justification": justification,
        "risks": risks[:2],
        "catalysts": catalysts[:2],
        "key_metrics_summary": (
            f"Current price {payload['current_price']:.2f}, predicted price {payload['predicted_price']:.2f}, "
            f"PE {fundamentals.get('pe_ratio')}, EPS {fundamentals.get('eps')}, "
            f"revenue growth {fundamentals.get('revenue_growth')}%."
        ),
        "provider": "deterministic-fallback",
        "model_used": "deterministic-fallback",
    }


def _normalize_llm_report(payload: dict[str, Any], report: dict[str, Any], provider: str, model: str) -> dict[str, Any]:
    fallback = _build_fallback_report(payload)
    signal = _normalize_signal(report.get("signal") or report.get("buy_signal"))
    ai_rating = _clamp(_safe_float(report.get("ai_rating"), 0.0), 0.0, 100.0)
    risks = [str(item).strip() for item in (report.get("risks") or []) if str(item).strip()][:2]
    catalysts = [str(item).strip() for item in (report.get("catalysts") or []) if str(item).strip()][:2]
    while len(risks) < 2:
        risks.append("Risk data was limited, so the fallback highlighted general execution and market sensitivity.")
    while len(catalysts) < 2:
        catalysts.append("Catalyst detail was incomplete, so the fallback emphasized trend and earnings follow-through.")

    return {
        "symbol": report.get("symbol") or payload["symbol"],
        "ai_rating": round(ai_rating, 2),
        "signal": signal,
        "justification": str(report.get("justification") or "").strip() or fallback["justification"],
        "risks": risks,
        "catalysts": catalysts,
        "key_metrics_summary": str(report.get("key_metrics_summary") or "").strip() or fallback["key_metrics_summary"],
        "provider": provider,
        "model_used": model,
    }


def _analyze_with_llm(payload: dict[str, Any]) -> tuple[dict[str, Any], str, str] | None:
    candidates = _provider_candidates()
    if not candidates:
        return None

    prompt = (
        "You are a strict stock-quality analysis engine.\n"
        "Return ONLY valid JSON matching this schema:\n"
        "{"
        '"symbol": string, "ai_rating": float, "signal": "BUY"|"HOLD"|"SELL", '
        '"justification": string, "risks": [string, string], '
        '"catalysts": [string, string], "key_metrics_summary": string'
        "}\n\n"
        "Use the payload below.\n"
        f"{json.dumps(payload, indent=2, default=str)}"
    )

    for candidate in candidates:
        body = {
            "model": candidate["model"],
            "messages": [
                {"role": "system", "content": "Return strict JSON only. No markdown, no explanations."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
            "max_tokens": 700,
        }
        request = Request(
            f"{candidate['base_url']}/chat/completions",
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {candidate['api_key']}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=60) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
            content = (
                response_payload.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            if not content:
                continue
            parsed = _extract_json_object(content)
            return parsed, candidate["provider"], candidate["model"]
        except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
            logger.warning("Quality stock LLM analysis failed via %s: %s", candidate["provider"], exc)
        except Exception as exc:  # pragma: no cover - runtime protection
            logger.exception("Unexpected quality stock LLM failure via %s: %s", candidate["provider"], exc)
    return None


def _analyze_quality_payload(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        generated = _analyze_with_llm(payload)
    except Exception as exc:  # pragma: no cover - defensive wrapper
        logger.warning("Quality stock analysis wrapper falling back for %s: %s", payload["symbol"], exc)
        generated = None

    if generated is None:
        return _build_fallback_report(payload)

    report, provider, model = generated
    try:
        return _normalize_llm_report(payload, report, provider, model)
    except Exception as exc:  # pragma: no cover - invalid model output should never crash feature
        logger.warning("Quality stock normalization failed for %s: %s", payload["symbol"], exc)
        return _build_fallback_report(payload)


def _persist_quality_reports(portfolio: Portfolio, analyzed_payloads: list[dict[str, Any]], selected_by_user: bool) -> list[int]:
    saved_ids: list[int] = []
    with transaction.atomic():
        for item in analyzed_payloads:
            quality_stock, _ = QualityStock.objects.update_or_create(
                portfolio=portfolio,
                stock_id=item["stock_id"],
                defaults={
                    "ai_rating": item["report_json"]["ai_rating"],
                    "buy_signal": _normalize_signal(item["report_json"]["signal"]),
                    "report_json": item["report_json"],
                    "graphs_data": _normalize_graphs_data(item["graphs_data"]),
                    "selected_by_user": selected_by_user,
                },
            )
            saved_ids.append(quality_stock.id)
    return saved_ids


def _generation_stage_payloads(portfolio: Portfolio, stock_ids: list[int]) -> list[dict[str, Any]]:
    user_stocks, prediction_lookup, sentiment_lookup, earnings_lookup = _shared_context(portfolio)
    requested = [user_stock for user_stock in user_stocks if user_stock.stock_id in stock_ids]
    found_ids = {user_stock.stock_id for user_stock in requested}
    missing_ids = sorted(set(stock_ids) - found_ids)
    if missing_ids:
        raise ValueError("One or more selected stocks do not belong to this portfolio.")

    payloads = []
    for user_stock in requested:
        payloads.append(_build_quality_payload(user_stock, prediction_lookup, sentiment_lookup, earnings_lookup))
    return payloads


def _run_generation_sequential(portfolio: Portfolio, stock_ids: list[int], selected_by_user: bool) -> list[int]:
    stage_payloads = _generation_stage_payloads(portfolio, stock_ids)
    analyzed_payloads = []
    for payload in stage_payloads:
        analyzed_payloads.append(
            {
                "stock_id": payload["stock_id"],
                "report_json": _analyze_quality_payload(payload),
                "graphs_data": payload["graphs_data"],
            }
        )
    return _persist_quality_reports(portfolio, analyzed_payloads, selected_by_user)


def _run_generation_graph(portfolio: Portfolio, stock_ids: list[int], selected_by_user: bool) -> list[int]:
    if not LANGGRAPH_AVAILABLE or StateGraph is None:
        return _run_generation_sequential(portfolio, stock_ids, selected_by_user)

    graph = StateGraph(QualityStockState)

    def fetch_node(state: QualityStockState) -> QualityStockState:
        return {"stage_payloads": _generation_stage_payloads(portfolio, stock_ids)}

    def analyze_node(state: QualityStockState) -> QualityStockState:
        analyzed_payloads = []
        for payload in state.get("stage_payloads", []):
            analyzed_payloads.append(
                {
                    "stock_id": payload["stock_id"],
                    "report_json": _analyze_quality_payload(payload),
                    "graphs_data": payload["graphs_data"],
                }
            )
        return {"analyzed_payloads": analyzed_payloads}

    def persist_node(state: QualityStockState) -> QualityStockState:
        return {
            "saved_ids": _persist_quality_reports(
                portfolio,
                state.get("analyzed_payloads", []),
                selected_by_user,
            )
        }

    graph.add_node("fetch", fetch_node)
    graph.add_node("analyze", analyze_node)
    graph.add_node("persist", persist_node)
    graph.add_edge(START, "fetch")
    graph.add_edge("fetch", "analyze")
    graph.add_edge("analyze", "persist")
    graph.add_edge("persist", END)
    compiled = graph.compile()
    state = compiled.invoke({})
    return state.get("saved_ids", [])


def build_quality_snapshot(portfolio: Portfolio) -> list[dict[str, Any]]:
    user_stocks, prediction_lookup, sentiment_lookup, earnings_lookup = _shared_context(portfolio)
    candidates = []
    for user_stock in user_stocks:
        payload = _build_quality_payload(user_stock, prediction_lookup, sentiment_lookup, earnings_lookup)
        signal = _signal_from_expected_change(payload["expected_change_pct"])
        score = payload["ranking_components"]["base_score"]
        candidates.append(
            {
                "stock_id": payload["stock_id"],
                "user_stock_id": payload["user_stock_id"],
                "symbol": payload["symbol"],
                "stock_name": payload["stock_name"],
                "ai_rating": round(score, 2),
                "buy_signal": signal,
                "current_price": payload["current_price"],
                "predicted_price": payload["predicted_price"],
                "expected_change_pct": payload["expected_change_pct"],
                "trend_metrics": payload["trend_metrics"],
                "fundamentals": payload["fundamentals"],
                "sector_averages": payload["sector_averages"],
                "ranking_components": payload["ranking_components"],
            }
        )
    candidates.sort(key=lambda item: (item["ai_rating"], item["expected_change_pct"]), reverse=True)
    return candidates[:RANKED_CANDIDATE_LIMIT]


def generate_quality_reports(portfolio: Portfolio, stock_ids: list[int], selected_by_user: bool = True) -> list[dict[str, Any]]:
    if not stock_ids:
        return []
    saved_ids = _run_generation_graph(portfolio, stock_ids, selected_by_user)
    saved_reports = (
        QualityStock.objects.filter(id__in=saved_ids, portfolio__user=portfolio.user)
        .select_related("portfolio", "stock")
        .order_by("-generated_at", "-id")
    )
    return [get_quality_stock_detail(portfolio.user, quality_stock.id) for quality_stock in saved_reports]


def build_quality_stock_rows(user, portfolio_id: int | None = None, signal: str = "all") -> list[dict[str, Any]]:
    queryset = QualityStock.objects.filter(portfolio__user=user).select_related("portfolio", "stock")
    if portfolio_id is not None:
        queryset = queryset.filter(portfolio_id=portfolio_id)
    normalized_signal = _normalize_signal(signal) if signal and signal.lower() != "all" else "all"
    if normalized_signal != "all":
        queryset = queryset.filter(buy_signal=normalized_signal)

    rows = []
    for quality_stock in queryset.order_by("-generated_at", "-id"):
        report = quality_stock.report_json if isinstance(quality_stock.report_json, dict) else {}
        rows.append(
            {
                "id": quality_stock.id,
                "portfolio_id": quality_stock.portfolio_id,
                "portfolio_title": quality_stock.portfolio.title,
                "stock_id": quality_stock.stock_id,
                "symbol": quality_stock.stock.yahoo_ticker or quality_stock.stock.ticker,
                "stock_name": quality_stock.stock.stock_name,
                "ai_rating": round(_safe_float(quality_stock.ai_rating), 2),
                "buy_signal": _normalize_signal(quality_stock.buy_signal),
                "selected_by_user": quality_stock.selected_by_user,
                "generated_at": quality_stock.generated_at,
                "justification": report.get("justification"),
                "provider": report.get("provider"),
            }
        )
    return rows


def get_quality_stock_detail(user, quality_stock_id: int) -> dict[str, Any]:
    quality_stock = (
        QualityStock.objects.filter(id=quality_stock_id, portfolio__user=user)
        .select_related("portfolio", "stock")
        .first()
    )
    if quality_stock is None:
        raise QualityStock.DoesNotExist

    report = quality_stock.report_json if isinstance(quality_stock.report_json, dict) else {}
    return {
        "id": quality_stock.id,
        "portfolio_id": quality_stock.portfolio_id,
        "portfolio_title": quality_stock.portfolio.title,
        "stock_id": quality_stock.stock_id,
        "symbol": quality_stock.stock.yahoo_ticker or quality_stock.stock.ticker,
        "stock_name": quality_stock.stock.stock_name,
        "ai_rating": round(_safe_float(quality_stock.ai_rating), 2),
        "buy_signal": _normalize_signal(quality_stock.buy_signal),
        "selected_by_user": quality_stock.selected_by_user,
        "generated_at": quality_stock.generated_at,
        "report_json": {
            "symbol": report.get("symbol") or (quality_stock.stock.yahoo_ticker or quality_stock.stock.ticker),
            "ai_rating": round(_safe_float(report.get("ai_rating"), quality_stock.ai_rating), 2),
            "signal": _normalize_signal(report.get("signal") or quality_stock.buy_signal),
            "justification": report.get("justification"),
            "risks": report.get("risks") or [],
            "catalysts": report.get("catalysts") or [],
            "key_metrics_summary": report.get("key_metrics_summary"),
            "provider": report.get("provider"),
            "model_used": report.get("model_used"),
        },
        "graphs_data": _normalize_graphs_data(quality_stock.graphs_data),
    }
