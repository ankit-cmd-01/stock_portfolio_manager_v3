from __future__ import annotations

import re
from typing import Optional

from django.conf import settings
from yfinance import Search
from yfinance import cache as yf_cache


EXCHANGE_SUFFIX_MAP = {
    "NSE": ".NS",
    "BSE": ".BO",
}

_STOPWORDS = {
    "ltd",
    "limited",
    "co",
    "company",
    "corp",
    "corporation",
    "india",
    "ind",
    "the",
    "and",
}


def configure_yfinance_cache() -> None:
    cache_dir = settings.BASE_DIR / ".cache" / "yfinance"
    cache_dir.mkdir(parents=True, exist_ok=True)
    yf_cache.set_cache_location(str(cache_dir))


def normalize_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).strip()


def normalize_symbol_code(value: str) -> str:
    symbol = (value or "").strip().upper()
    if "." in symbol:
        symbol = symbol.rsplit(".", 1)[0]
    return re.sub(r"[^A-Z0-9]+", "", symbol)


def symbol_match_score(symbol: str, ticker: str) -> int:
    normalized_symbol = normalize_symbol_code(symbol)
    normalized_ticker = normalize_symbol_code(ticker)

    if not normalized_symbol or not normalized_ticker:
        return 0
    if normalized_symbol == normalized_ticker:
        return 3
    if normalized_symbol.startswith(normalized_ticker) or normalized_ticker.startswith(normalized_symbol):
        return 2
    if normalized_ticker in normalized_symbol:
        return 1
    return 0


def symbol_has_extra_qualifier(symbol: str) -> bool:
    base_symbol = (symbol or "").strip().upper()
    if "." in base_symbol:
        base_symbol = base_symbol.rsplit(".", 1)[0]
    return "-" in base_symbol


def significant_tokens(value: str) -> list[str]:
    tokens = [token for token in normalize_text(value).split() if token and token not in _STOPWORDS]
    return tokens


def quote_score(quote: dict, *, stock_name: str, ticker: str, exchange: str) -> int:
    symbol = (quote.get("symbol") or "").strip()
    shortname = normalize_text(quote.get("shortname") or "")
    longname = normalize_text(quote.get("longname") or "")
    quote_type = normalize_text(quote.get("quoteType") or quote.get("typeDisp") or "")
    desired_suffix = EXCHANGE_SUFFIX_MAP.get(exchange.upper(), "")
    match_quality = symbol_match_score(symbol, ticker)

    score = 0

    if desired_suffix and symbol.endswith(desired_suffix):
        score += 50
    elif desired_suffix and "." not in symbol:
        score -= 10

    if match_quality == 3:
        score += 60
    elif match_quality == 2:
        score += 12
    elif match_quality == 1:
        score += 4

    if symbol_has_extra_qualifier(symbol) and match_quality < 3:
        score -= 20

    tokens = significant_tokens(stock_name)
    if tokens:
        matched_tokens = sum(1 for token in tokens if token in shortname or token in longname)
        score += matched_tokens * 8

    if "equity" in quote_type or "stock" in quote_type:
        score += 10

    return score


def resolve_yahoo_symbol(stock_name: str, ticker: str, exchange: str) -> Optional[str]:
    configure_yfinance_cache()

    queries = [stock_name]
    if ticker and ticker.lower() != normalize_text(stock_name):
        queries.append(ticker)

    best_symbol = None
    best_score = -10**9

    for query in queries:
        try:
            results = Search(
                query,
                max_results=8,
                enable_fuzzy_query=True,
                raise_errors=False,
            ).quotes
        except Exception:
            continue

        for quote in results:
            symbol = (quote.get("symbol") or "").strip()
            if not symbol:
                continue
            score = quote_score(
                quote,
                stock_name=stock_name,
                ticker=ticker,
                exchange=exchange,
            )
            if score > best_score:
                best_score = score
                best_symbol = symbol

    return best_symbol
