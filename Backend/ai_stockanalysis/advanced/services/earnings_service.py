import json
import logging
import math
from datetime import date, datetime
from decimal import Decimal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import yfinance as yf
from django.conf import settings

logger = logging.getLogger(__name__)


def _safe_float(value):
    try:
        if value is None:
            return None
        number = float(value)
        if math.isnan(number) or math.isinf(number):
            return None
        return number
    except (TypeError, ValueError):
        return None


def _to_serializable(value):
    if value is None:
        return None
    if isinstance(value, dict):
        return {str(key): _to_serializable(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_to_serializable(item) for item in value]
    if isinstance(value, tuple):
        return [_to_serializable(item) for item in value]
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        if value.is_nan():
            return None
        return float(value)
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    if hasattr(value, "item"):
        try:
            return _to_serializable(value.item())
        except Exception:
            return str(value)
    return value


def _find_first_matching_column(dataframe, candidates):
    columns_by_key = {
        str(column).strip().lower(): column
        for column in getattr(dataframe, "columns", [])
    }
    for candidate in candidates:
        match = columns_by_key.get(candidate.strip().lower())
        if match is not None:
            return match
    return None


def fetch_last_quarter_earnings(ticker: str) -> dict:
    try:
        stock = yf.Ticker(ticker)
        qf = stock.quarterly_financials
        raw_financials = {}
        revenue_data = {}

        if qf is not None and not qf.empty:
            last_two_quarters = qf.iloc[:, :2]
            raw_financials = _to_serializable(last_two_quarters.to_dict())

            if "Total Revenue" in qf.index:
                rev_row = qf.loc["Total Revenue"]
                revenue_actual = _safe_float(rev_row.iloc[0]) if len(rev_row) > 0 else None
                revenue_prev_quarter = _safe_float(rev_row.iloc[1]) if len(rev_row) > 1 else None
                revenue_data = {
                    "revenue_actual": revenue_actual,
                    "revenue_prev_quarter": revenue_prev_quarter,
                    "revenue_surprise_pct": None,
                }
                if revenue_actual and revenue_prev_quarter:
                    revenue_data["revenue_surprise_pct"] = round(
                        ((revenue_actual - revenue_prev_quarter) / abs(revenue_prev_quarter)) * 100,
                        2,
                    )

        earnings_data = {}
        try:
            earnings_dates = stock.earnings_dates
            if earnings_dates is not None and not earnings_dates.empty:
                eps_actual_col = _find_first_matching_column(earnings_dates, ["EPS Actual", "EPSActual"])
                eps_estimate_col = _find_first_matching_column(earnings_dates, ["EPS Estimate", "EPSEstimate"])
                eps_surprise_col = _find_first_matching_column(earnings_dates, ["Surprise(%)", "Surprise %", "Surprise"])

                filtered_dates = earnings_dates
                if eps_actual_col is not None:
                    filtered_dates = earnings_dates.dropna(subset=[eps_actual_col], how="all")
                if filtered_dates.empty:
                    filtered_dates = earnings_dates

                latest = filtered_dates.iloc[0]
                latest_name = getattr(latest, "name", None)
                latest_date = latest_name.date() if hasattr(latest_name, "date") else None
                earnings_data = {
                    "quarter_date": latest_date.isoformat() if latest_date else None,
                    "eps_actual": _safe_float(latest.get(eps_actual_col)) if eps_actual_col else None,
                    "eps_estimate": _safe_float(latest.get(eps_estimate_col)) if eps_estimate_col else None,
                    "eps_surprise_pct": _safe_float(latest.get(eps_surprise_col)) if eps_surprise_col else None,
                }
        except Exception as exc:
            logger.warning("EPS fetch failed for %s: %s", ticker, exc)

        return {
            **earnings_data,
            **revenue_data,
            "raw_financials": raw_financials,
        }
    except Exception as exc:
        logger.error("yfinance fetch failed for %s: %s", ticker, exc)
        return {}


def _fallback_summary(ticker: str, company: str, earnings_data: dict) -> str:
    eps_actual = earnings_data.get("eps_actual")
    eps_estimate = earnings_data.get("eps_estimate")
    revenue_actual = earnings_data.get("revenue_actual")
    revenue_prev_quarter = earnings_data.get("revenue_prev_quarter")
    revenue_change = earnings_data.get("revenue_surprise_pct")

    if eps_actual is None and revenue_actual is None:
        return (
            f"{company} ({ticker}) has limited quarterly data available right now. "
            "The latest earnings snapshot could not be completed from upstream data sources.\n\n"
            "You can still use this section as a cache point for the next refresh window. "
            "Once yfinance returns a fuller earnings record, the page will store and reuse it automatically.\n\n"
            "For now, treat this as a watchlist signal rather than a conviction call."
        )

    performance = "in line"
    if eps_actual is not None and eps_estimate is not None:
        if eps_actual > eps_estimate:
            performance = "ahead of expectations"
        elif eps_actual < eps_estimate:
            performance = "below expectations"

    revenue_line = "Revenue trend is unavailable."
    if revenue_actual is not None:
        revenue_line = f"Revenue came in around {revenue_actual:,.0f}."
        if revenue_prev_quarter is not None:
            revenue_line += f" Previous-quarter revenue was {revenue_prev_quarter:,.0f}."
        if revenue_change is not None:
            direction = "up" if revenue_change >= 0 else "down"
            revenue_line += f" That leaves revenue {direction} {abs(revenue_change):.2f}% versus the prior quarter."

    return (
        f"{company} ({ticker}) delivered a quarter that was {performance}. "
        f"EPS actual was {eps_actual if eps_actual is not None else 'N/A'} versus an estimate of "
        f"{eps_estimate if eps_estimate is not None else 'N/A'}.\n\n"
        f"{revenue_line} This gives us a practical read on momentum even without a full call transcript. "
        "The signal is strongest when EPS and revenue are both moving in the same direction.\n\n"
        "Investor takeaway: keep this name in buy territory only if execution is improving across both profit and sales. "
        "If the numbers are mixed, this is better treated as a hold or watch candidate until the next update."
    )


def generate_ai_summary(ticker: str, company: str, earnings_data: dict) -> tuple[str, str]:
    api_key = getattr(settings, "GROQ_API_KEY", "") or getattr(settings, "DEEPSEEK_API_KEY", "")
    model = getattr(settings, "GROQ_MODEL", "llama-3.3-70b-versatile")
    base_url = getattr(settings, "GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")

    if not api_key:
        logger.warning("No Groq API key is configured. Falling back to deterministic summary.")
        return _fallback_summary(ticker, company, earnings_data), "deterministic-fallback"

    prompt = f"""
You are a senior financial analyst writing for retail investors in India.

Here is the last quarter earnings data for {company} ({ticker}):

EPS Actual: {earnings_data.get("eps_actual", "N/A")}
EPS Estimate: {earnings_data.get("eps_estimate", "N/A")}
EPS Surprise: {earnings_data.get("eps_surprise_pct", "N/A")}%
Revenue Actual: {earnings_data.get("revenue_actual", "N/A")}
Previous Quarter Revenue: {earnings_data.get("revenue_prev_quarter", "N/A")}
Revenue Change: {earnings_data.get("revenue_surprise_pct", "N/A")}%
Quarter Date: {earnings_data.get("quarter_date", "N/A")}

Write exactly 3 short paragraphs:
Paragraph 1: How did the quarter perform versus expectations?
Paragraph 2: Revenue trend, profitability clues, and key risks.
Paragraph 3: Investor takeaway using Buy, Hold, or Watch and a short reason.

Keep the language simple, factual, and actionable.
Do not add disclaimers.
"""

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You write concise, factual earnings summaries."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 500,
    }

    request = Request(
        f"{base_url}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
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
        if not content:
            raise ValueError("Groq returned an empty summary.")
        return content, model
    except (HTTPError, URLError, TimeoutError, ValueError) as exc:
        logger.error("Groq summary generation failed for %s: %s", ticker, exc)
    except Exception as exc:
        logger.error("Unexpected Groq error for %s: %s", ticker, exc)

    return _fallback_summary(ticker, company, earnings_data), "deterministic-fallback"
