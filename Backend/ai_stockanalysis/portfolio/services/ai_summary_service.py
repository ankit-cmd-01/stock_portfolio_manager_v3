from __future__ import annotations

import json
import logging
import math
from statistics import mean
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings

from portfolio.models import Portfolio
from portfolio.services.forecast_service import predict_portfolio
from user_stock.models import UserStock, UserStockData

logger = logging.getLogger(__name__)


def _safe_float(value, default: float = 0.0) -> float:
    try:
        number = float(value)
        if math.isnan(number) or math.isinf(number):
            return default
        return number
    except (TypeError, ValueError):
        return default


def _compute_stock_signal(user_stock: UserStock) -> dict:
    history = list(
        UserStockData.objects.filter(user_stock=user_stock)
        .order_by("-timestamp")
        .values("timestamp", "close", "volume")[:21]
    )
    history.reverse()

    latest_row = history[-1] if history else {}
    latest_close = _safe_float(latest_row.get("close"))
    latest_volume = _safe_float(latest_row.get("volume"))
    quantity = _safe_float(user_stock.quantity)
    holding_value = latest_close * quantity

    base_close = _safe_float(history[0].get("close")) if history else 0.0
    momentum_20 = ((latest_close - base_close) / base_close * 100.0) if base_close > 0 else 0.0

    recent_volumes = [_safe_float(item.get("volume")) for item in history[-10:] if item.get("volume") is not None]
    avg_volume = mean(recent_volumes) if recent_volumes else 0.0
    volume_ratio = (latest_volume / avg_volume) if avg_volume > 0 else 0.0

    closes = [_safe_float(item.get("close")) for item in history if item.get("close") is not None]
    returns = []
    for index in range(1, len(closes)):
        previous_close = closes[index - 1]
        current_close = closes[index]
        if previous_close > 0:
            returns.append(((current_close - previous_close) / previous_close) * 100.0)
    volatility = mean([abs(value) for value in returns[-10:]]) if returns else 0.0

    return {
        "ticker": user_stock.stock.yahoo_ticker or user_stock.stock.ticker,
        "company": getattr(user_stock.stock, "company_name", None) or getattr(user_stock.stock, "stock_name", None),
        "quantity": round(quantity, 4),
        "holding_value": round(holding_value, 2),
        "momentum_20": round(momentum_20, 2),
        "volume_ratio": round(volume_ratio, 2),
        "volatility": round(volatility, 2),
        "has_history": bool(history),
    }


def _fallback_portfolio_summary(portfolio: Portfolio, signals: list[dict], forecast_payload: dict | None) -> str:
    tracked = [item for item in signals if item["has_history"]]
    if not tracked:
        return (
            f"{portfolio.title} does not have enough synced stock history yet to build a model-backed portfolio summary.\n\n"
            "Add or refresh stock data first, then reopen this AI Summary tab to generate a stronger readout.\n\n"
            "For now, treat this portfolio as a watchlist until price history and forecast signals are available."
        )

    strongest = max(tracked, key=lambda item: item["momentum_20"])
    largest = max(tracked, key=lambda item: item["holding_value"])
    avg_momentum = mean(item["momentum_20"] for item in tracked)
    avg_volume_ratio = mean(item["volume_ratio"] for item in tracked)
    forecast_growth = _safe_float((forecast_payload or {}).get("growth_pct"))
    stance = "Buy" if forecast_growth >= 3 else "Hold" if forecast_growth >= -2 else "Watch"

    return (
        f"{portfolio.title} currently tracks {len(tracked)} synced holdings. Average 20-session momentum is {avg_momentum:.2f}% and average participation is running at {avg_volume_ratio:.2f}x recent volume, which gives a quick read on overall portfolio conviction.\n\n"
        f"The strongest momentum name is {strongest['ticker']} at {strongest['momentum_20']:.2f}%, while the largest capital concentration is {largest['ticker']} at roughly Rs {largest['holding_value']:,.2f}. That means both upside and risk are still concentrated in a small set of holdings.\n\n"
        f"Investor takeaway: {stance}. The forecast model implies a portfolio move of {forecast_growth:.2f}% from current value, so the portfolio looks strongest when leadership remains broad instead of depending on only one or two positions."
    )


def _build_prompt(portfolio: Portfolio, signals: list[dict], forecast_payload: dict | None) -> str:
    tracked = [item for item in signals if item["has_history"]]
    top_momentum = sorted(tracked, key=lambda item: item["momentum_20"], reverse=True)[:3]
    top_holdings = sorted(tracked, key=lambda item: item["holding_value"], reverse=True)[:3]
    forecast_rows = sorted(
        forecast_payload.get("stock_predictions", []) if forecast_payload else [],
        key=lambda item: _safe_float(item.get("growth_pct")),
        reverse=True,
    )[:4]

    payload = {
        "portfolio_title": portfolio.title,
        "tracked_stock_count": len(signals),
        "synced_stock_count": len(tracked),
        "portfolio_forecast_growth_pct": round(_safe_float((forecast_payload or {}).get("growth_pct")), 2),
        "portfolio_current_value": round(_safe_float((forecast_payload or {}).get("current_value")), 2),
        "portfolio_predicted_value": round(_safe_float((forecast_payload or {}).get("predicted_value")), 2),
        "top_momentum": top_momentum,
        "largest_holdings": top_holdings,
        "forecast_leaders": [
            {
                "symbol": item.get("symbol"),
                "growth_pct": round(_safe_float(item.get("growth_pct")), 2),
                "model_status": item.get("model_status"),
            }
            for item in forecast_rows
        ],
    }

    return (
        "You are a senior stock portfolio analyst writing for a retail investor in India.\n\n"
        "Use the portfolio signal payload below to generate an actionable portfolio summary.\n"
        "Write exactly 3 short paragraphs.\n"
        "Paragraph 1: overall portfolio pulse and what the current positioning looks like.\n"
        "Paragraph 2: strongest names, concentration, risk, and any behavior clusters you can infer from momentum and volatility.\n"
        "Paragraph 3: investor takeaway using Buy, Hold, or Watch with one clear reason.\n"
        "Keep it simple, factual, concise, and avoid disclaimers.\n\n"
        f"Portfolio signals:\n{json.dumps(payload, indent=2)}"
    )


def _provider_candidates() -> list[dict]:
    candidates = []

    xai_api_key = getattr(settings, "XAI_API_KEY", "")
    if xai_api_key:
        candidates.append(
            {
                "provider": "grok",
                "api_key": xai_api_key,
                "model": getattr(settings, "XAI_MODEL", "grok-beta"),
                "base_url": getattr(settings, "XAI_BASE_URL", "https://api.x.ai/v1"),
            }
        )

    deepseek_api_key = getattr(settings, "DEEPSEEK_API_KEY", "")
    if deepseek_api_key:
        candidates.append(
            {
                "provider": "deepseek",
                "api_key": deepseek_api_key,
                "model": getattr(settings, "DEEPSEEK_MODEL", "deepseek-chat"),
                "base_url": getattr(settings, "DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
            }
        )

    groq_api_key = getattr(settings, "GROQ_API_KEY", "")
    if groq_api_key:
        candidates.append(
            {
                "provider": "groq",
                "api_key": groq_api_key,
                "model": getattr(settings, "GROQ_MODEL", "llama-3.3-70b-versatile"),
                "base_url": getattr(settings, "GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
            }
        )

    return candidates


def _run_chat_completion(prompt: str) -> tuple[str, str, str] | None:
    for candidate in _provider_candidates():
        payload = {
            "model": candidate["model"],
            "messages": [
                {"role": "system", "content": "You write concise portfolio summaries for retail investors."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.25,
            "max_tokens": 500,
        }
        request = Request(
            f"{candidate['base_url'].rstrip('/')}/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {candidate['api_key']}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urlopen(request, timeout=45) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
            content = (
                response_payload.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            if content:
                return content, candidate["provider"], candidate["model"]
            logger.warning("Empty portfolio AI summary response from %s.", candidate["provider"])
        except HTTPError as exc:
            if exc.code in {401, 403}:
                logger.info(
                    "Portfolio AI summary provider %s rejected credentials or access (HTTP %s). Falling back.",
                    candidate["provider"],
                    exc.code,
                )
            else:
                logger.warning("Portfolio AI summary failed via %s: %s", candidate["provider"], exc)
        except (URLError, TimeoutError, ValueError) as exc:
            logger.warning("Portfolio AI summary failed via %s: %s", candidate["provider"], exc)
        except Exception as exc:  # pragma: no cover - defensive runtime guard
            logger.exception("Unexpected portfolio AI summary failure via %s: %s", candidate["provider"], exc)

    return None


def generate_portfolio_ai_summary(portfolio_id: int) -> dict:
    portfolio = Portfolio.objects.filter(pk=portfolio_id).first()
    if portfolio is None:
        raise ValueError("Portfolio not found.")

    user_stocks = list(
        UserStock.objects.filter(portfolio_id=portfolio_id)
        .select_related("stock", "portfolio")
        .order_by("stock__stock_name", "stock__ticker")
    )

    signals = [_compute_stock_signal(user_stock) for user_stock in user_stocks]
    try:
        forecast_payload = predict_portfolio(portfolio_id)
    except Exception as exc:  # pragma: no cover - keep summary resilient even if forecast fails
        logger.warning("Portfolio forecast unavailable while generating AI summary for %s: %s", portfolio_id, exc)
        forecast_payload = None

    prompt = _build_prompt(portfolio, signals, forecast_payload)
    generated = _run_chat_completion(prompt)

    if generated is not None:
        summary, provider, model = generated
    else:
        summary = _fallback_portfolio_summary(portfolio, signals, forecast_payload)
        provider = "deterministic"
        model = "deterministic-fallback"

    return {
        "portfolio_id": portfolio.id,
        "portfolio_title": portfolio.title,
        "summary": summary,
        "provider": provider,
        "model_used": model,
        "stock_count": len(user_stocks),
        "forecast_growth_pct": round(_safe_float((forecast_payload or {}).get("growth_pct")), 2),
    }
