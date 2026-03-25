import logging
import re
import socket
from datetime import datetime
from difflib import SequenceMatcher
from email.utils import parsedate_to_datetime
from html import unescape
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen
from xml.etree import ElementTree

import pandas as pd
import yfinance as yf
from django.utils import timezone

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 4
DEFAULT_LIMIT = 12
TAG_RE = re.compile(r"<[^>]+>")
WHITESPACE_RE = re.compile(r"\s+")
SCRIPT_STYLE_RE = re.compile(r"<(script|style|noscript)\b.*?>.*?</\1>", re.IGNORECASE | re.DOTALL)
META_DESCRIPTION_RE = re.compile(
    r"""<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["'](.*?)["']""",
    re.IGNORECASE | re.DOTALL,
)
PARAGRAPH_RE = re.compile(r"<p\b[^>]*>(.*?)</p>", re.IGNORECASE | re.DOTALL)
ABSOLUTE_URL_RE = re.compile(r"https?://[^\s\"'<>\\]+", re.IGNORECASE)
GENERIC_GOOGLE_NEWS_TEXT = (
    "Comprehensive, up-to-date news coverage, aggregated from sources all over the world by Google News."
)
COMPANY_SUFFIX_RE = re.compile(r"\b(ltd|limited|inc|incorporated|corp|corporation|plc)\b\.?", re.IGNORECASE)
GENERIC_COMPANY_TOKENS = {
    "class",
    "co",
    "company",
    "corp",
    "corporation",
    "group",
    "holdings",
    "hotel",
    "hotels",
    "inc",
    "incorporated",
    "india",
    "indian",
    "industries",
    "limited",
    "ltd",
    "market",
    "markets",
    "news",
    "plc",
    "price",
    "share",
    "shares",
    "stock",
    "systems",
    "tech",
    "technologies",
    "technology",
}


def sanitize_news_text(value):
    text = unescape((value or "").strip()).replace("\xa0", " ")
    text = TAG_RE.sub(" ", text)
    return WHITESPACE_RE.sub(" ", text).strip()


def normalize_news_text(value):
    return re.sub(r"[^a-z0-9]+", " ", sanitize_news_text(value).lower()).strip()


def is_google_news_domain(value):
    domain = (value or "").lower()
    return domain == "news.google.com" or domain.endswith(".news.google.com")


def is_generic_google_news_text(value):
    normalized = normalize_news_text(value)
    return normalized == normalize_news_text(GENERIC_GOOGLE_NEWS_TEXT)


def _company_search_variants(company: str, ticker_candidates=None) -> list[str]:
    variants = []

    company = sanitize_news_text(company)
    if company:
        variants.append(company)
        simplified = WHITESPACE_RE.sub(" ", COMPANY_SUFFIX_RE.sub(" ", company)).strip(" -,.")
        if simplified and simplified.lower() != company.lower():
            variants.append(simplified)

    for candidate in ticker_candidates or []:
        symbol = sanitize_news_text(candidate)
        if symbol and symbol not in variants:
            variants.append(symbol)

    deduped = []
    seen = set()
    for variant in variants:
        key = variant.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(variant)
    return deduped


def _company_anchor_tokens(company: str) -> list[str]:
    raw_tokens = [token.strip(".,()").lower() for token in sanitize_news_text(company).split()]
    anchors = []
    for token in raw_tokens:
        normalized = re.sub(r"[^a-z0-9]+", "", token)
        if not normalized or normalized in GENERIC_COMPANY_TOKENS:
            continue
        if len(normalized) >= 4 or token.isupper():
            anchors.append(normalized)
    return anchors


def article_matches_company(article, company: str, ticker_candidates=None) -> bool:
    company = sanitize_news_text(company)
    if not company:
        return True

    text = " ".join(
        sanitize_news_text(article.get(field))
        for field in ("title", "description", "content")
        if article.get(field)
    )
    normalized_text = normalize_news_text(text)
    if not normalized_text:
        return False

    for variant in _company_search_variants(company):
        normalized_variant = normalize_news_text(variant)
        if normalized_variant and normalized_variant in normalized_text:
            return True

    text_tokens = set(normalized_text.split())
    anchor_tokens = _company_anchor_tokens(company)
    if anchor_tokens and any(token in text_tokens for token in anchor_tokens):
        return True

    ticker_bases = {
        normalize_news_text(candidate.rsplit(".", 1)[0])
        for candidate in (ticker_candidates or [])
        if candidate
    }
    ticker_bases = {token for token in ticker_bases if token and token not in GENERIC_COMPANY_TOKENS}
    if ticker_bases.intersection(text_tokens) and any(token in text_tokens for token in anchor_tokens):
        return True

    return False


def _google_news_search_urls(company: str, ticker_candidates=None, market_hint: str = "") -> list[str]:
    variants = _company_search_variants(company, ticker_candidates=ticker_candidates)
    if not variants:
        return []

    market_hint = (market_hint or "").lower()
    locales = [("en-US", "US", "US:en"), ("en-IN", "IN", "IN:en")]
    if "indian" in market_hint or "india" in market_hint:
        locales = [("en-IN", "IN", "IN:en"), ("en-US", "US", "US:en")]

    query_templates = [
        '{name}',
        '"{name}"',
        '{name} stock',
        '{name} share price',
        '{name} earnings',
        '{name} news',
    ]

    urls = []
    seen = set()
    for variant in variants[:3]:
        for template in query_templates:
            raw_query = template.format(name=variant).strip()
            if not raw_query:
                continue
            for hl, gl, ceid in locales:
                key = (raw_query.lower(), hl, gl, ceid)
                if key in seen:
                    continue
                seen.add(key)
                urls.append(
                    f"https://news.google.com/rss/search?q={quote(raw_query)}&hl={hl}&gl={gl}&ceid={ceid}"
                )
    return urls


def looks_like_duplicate_text(left, right, threshold=0.84):
    left_norm = normalize_news_text(left)
    right_norm = normalize_news_text(right)
    if not left_norm or not right_norm:
        return False
    if left_norm == right_norm:
        return True
    shorter, longer = sorted((left_norm, right_norm), key=len)
    if len(shorter) >= 24 and shorter in longer:
        return True
    return SequenceMatcher(None, left_norm, right_norm).ratio() >= threshold


def _fetch_xml(url):
    request = Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
            )
        },
    )
    with urlopen(request, timeout=DEFAULT_TIMEOUT) as response:
        return response.read()


def _fetch_html(url):
    request = Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
            )
        },
    )
    with urlopen(request, timeout=DEFAULT_TIMEOUT) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        html = response.read().decode(charset, errors="ignore")
        return html, response.geturl()


def _extract_external_url_from_google_html(html, preferred_domain=""):
    preferred_domain = (preferred_domain or "").lower()
    candidates = []
    for match in ABSOLUTE_URL_RE.findall(unescape(html or "")):
        url = match.rstrip(").,;\"'")
        domain = urlparse(url).netloc.lower()
        if not domain:
            continue
        if domain.endswith(".google.com") or domain == "google.com" or domain.endswith(".gstatic.com"):
            continue
        if domain in {"schema.org", "fonts.googleapis.com", "fonts.gstatic.com"}:
            continue
        candidates.append((url, domain))

    if preferred_domain:
        for url, domain in candidates:
            if domain == preferred_domain or domain.endswith(f".{preferred_domain}"):
                return url
    return candidates[0][0] if candidates else ""


def extract_article_details(link, title="", fallback_description="", preferred_domain="", depth=0):
    title = sanitize_news_text(title)
    fallback_description = sanitize_news_text(fallback_description)
    details = {
        "description": fallback_description,
        "content": fallback_description,
        "source_domain": preferred_domain or (urlparse(link).netloc if link else ""),
    }

    if not link:
        return details

    try:
        html, final_url = _fetch_html(link)
    except (socket.timeout, TimeoutError):
        logger.warning("Article detail fetch timed out: %s", link)
        return details
    except Exception as exc:
        logger.debug("Article detail fetch failed for %s: %s", link, exc)
        return details

    details["source_domain"] = urlparse(final_url).netloc or details["source_domain"]
    if depth < 2 and is_google_news_domain(details["source_domain"]):
        external_url = _extract_external_url_from_google_html(html, preferred_domain=preferred_domain)
        if external_url:
            return extract_article_details(
                external_url,
                title=title,
                fallback_description=fallback_description,
                preferred_domain=preferred_domain,
                depth=depth + 1,
            )

    body_html = SCRIPT_STYLE_RE.sub(" ", html)
    meta_match = META_DESCRIPTION_RE.search(body_html)
    meta_description = sanitize_news_text(meta_match.group(1) if meta_match else "")

    paragraphs = []
    for raw_paragraph in PARAGRAPH_RE.findall(body_html):
        paragraph = sanitize_news_text(raw_paragraph)
        if len(paragraph) < 80:
            continue
        if looks_like_duplicate_text(paragraph, title):
            continue
        if any(looks_like_duplicate_text(paragraph, existing) for existing in paragraphs):
            continue
        paragraphs.append(paragraph)
        if sum(len(item) for item in paragraphs) >= 2400:
            break

    content = " ".join(paragraphs).strip()
    if is_generic_google_news_text(meta_description):
        meta_description = ""
    if not content and meta_description:
        content = meta_description
    if not content:
        content = fallback_description

    description = meta_description or fallback_description
    if looks_like_duplicate_text(description, title) and content and not looks_like_duplicate_text(content, title):
        description = content[:320].rsplit(" ", 1)[0].strip() or content[:320]
    if looks_like_duplicate_text(content, description) and len(content) <= max(len(description) + 40, 180):
        content = description

    details["description"] = sanitize_news_text(description)
    details["content"] = sanitize_news_text(content)
    return details


def _parse_rss_items(xml_bytes, source_name):
    root = ElementTree.fromstring(xml_bytes)
    rows = []
    for item in root.findall(".//item"):
        link = (item.findtext("link") or "").strip()
        title = sanitize_news_text(item.findtext("title"))
        description = sanitize_news_text(item.findtext("description"))
        pub_date = _parse_datetime(item.findtext("pubDate"))
        source_label = source_name
        domain = urlparse(link).netloc if link else ""
        source_el = item.find("source")
        if source_el is not None:
            source_label = sanitize_news_text(source_el.text) or source_label
            source_url = (source_el.attrib.get("url") or "").strip()
            if source_url:
                domain = urlparse(source_url).netloc or domain
        if not title or not link:
            continue
        rows.append(
            {
                "title": title,
                "description": description,
                "link": link,
                "source": source_label,
                "source_domain": domain,
                "date": pub_date,
            }
        )
    return rows


def _parse_datetime(value):
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError, IndexError):
        return None
    if parsed.tzinfo is None:
        return timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed.astimezone(timezone.get_current_timezone())


def _parse_news_datetime(value):
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value, tz=timezone.get_current_timezone())
        except (OSError, OverflowError, ValueError):
            return None
    if isinstance(value, str):
        return _parse_datetime(value)
    return None


def _safe_fetch(source_name, url):
    try:
        xml_bytes = _fetch_xml(url)
        return _parse_rss_items(xml_bytes, source_name)
    except (socket.timeout, TimeoutError):
        logger.warning("%s news feed timed out: %s", source_name, url)
    except Exception as exc:
        logger.warning("%s news feed failed: %s", source_name, exc)
    return []


def _extract_yfinance_news_rows(symbol: str, limit: int = DEFAULT_LIMIT):
    rows = []
    try:
        ticker = yf.Ticker(symbol)
        items = []
        get_news = getattr(ticker, "get_news", None)
        if callable(get_news):
            try:
                items = get_news() or []
            except Exception as exc:
                logger.debug("yfinance get_news failed for %s: %s", symbol, exc)
        if not items:
            try:
                items = getattr(ticker, "news", None) or []
            except Exception as exc:
                logger.debug("yfinance news property failed for %s: %s", symbol, exc)

        for item in items:
            content = item.get("content") if isinstance(item, dict) else {}
            if not isinstance(content, dict):
                content = {}
            title = sanitize_news_text(
                content.get("title") or item.get("title") or ""
            )
            link = (
                (content.get("canonicalUrl") or {}).get("url")
                or (content.get("clickThroughUrl") or {}).get("url")
                or item.get("link")
                or item.get("url")
                or ""
            ).strip()
            description = sanitize_news_text(
                content.get("summary")
                or item.get("summary")
                or item.get("description")
                or ""
            )
            published = _parse_news_datetime(
                content.get("pubDate")
                or item.get("providerPublishTime")
                or item.get("published_at")
            )
            source = sanitize_news_text(
                (content.get("provider") or {}).get("displayName")
                or item.get("publisher")
                or "Yahoo Finance"
            )
            source_domain = urlparse(link).netloc if link else ""
            if not title or not link:
                continue
            rows.append(
                {
                    "title": title,
                    "description": description,
                    "link": link,
                    "source": source,
                    "source_domain": source_domain,
                    "date": published,
                }
            )
            if len(rows) >= limit:
                break
    except Exception as exc:
        logger.warning("yfinance news fetch failed for %s: %s", symbol, exc)
    return rows


def fetch_stock_news(ticker, company, limit=DEFAULT_LIMIT, ticker_candidates=None, market_hint=""):
    ticker_candidates = [candidate for candidate in (ticker_candidates or [ticker]) if candidate]
    sources = [
        ("Yahoo Finance", f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={quote(ticker_candidates[0])}&region=US&lang=en-US"),
    ]
    for url in _google_news_search_urls(company, ticker_candidates=ticker_candidates, market_hint=market_hint):
        sources.append(("Google News", url))

    rows = []
    for candidate in ticker_candidates:
        rows.extend(_extract_yfinance_news_rows(candidate, limit=limit))
    for source_name, url in sources:
        rows.extend(_safe_fetch(source_name, url))

    if not rows:
        return pd.DataFrame(columns=["title", "description", "link", "source", "source_domain", "date"])

    deduped = {}
    for row in rows:
        deduped.setdefault(row["link"], row)

    filtered_rows = [
        row
        for row in deduped.values()
        if article_matches_company(row, company, ticker_candidates=ticker_candidates)
    ]
    dataframe = pd.DataFrame(filtered_rows)
    if dataframe.empty and company:
        return pd.DataFrame(columns=["title", "description", "link", "source", "source_domain", "date"])
    if "date" in dataframe.columns:
        dataframe = dataframe.sort_values(by="date", ascending=False, na_position="last")
    return dataframe.head(limit).reset_index(drop=True)


def enrich_news(dataframe):
    if dataframe.empty:
        return dataframe.copy()

    try:
        from newspaper import Article
    except Exception as exc:
        logger.warning("newspaper3k unavailable, skipping article enrichment: %s", exc)
        enriched = dataframe.copy()
        details = enriched.apply(
            lambda row: extract_article_details(
                row.get("link"),
                row.get("title"),
                row.get("description"),
                row.get("source_domain"),
            ),
            axis=1,
        )
        enriched["description"] = details.map(lambda item: item.get("description", ""))
        enriched["content"] = details.map(lambda item: item.get("content", ""))
        enriched["source_domain"] = details.map(lambda item: item.get("source_domain", ""))
        return enriched

    rows = []
    for _, row in dataframe.iterrows():
        article_row = row.to_dict()
        content = sanitize_news_text(article_row.get("description"))
        description = sanitize_news_text(article_row.get("description"))
        link = article_row.get("link")
        if link:
            try:
                article = Article(link)
                article.download()
                article.parse()
                extracted_text = sanitize_news_text(article.text)
                if extracted_text:
                    content = extracted_text
                details = extract_article_details(
                    link,
                    article_row.get("title"),
                    article_row.get("description"),
                    article_row.get("source_domain"),
                )
                description = details.get("description") or description
                if not extracted_text:
                    content = details.get("content") or content
                article_row["source_domain"] = details.get("source_domain") or article_row.get("source_domain")
            except Exception as exc:
                logger.debug("Article enrichment failed for %s: %s", link, exc)
                details = extract_article_details(
                    link,
                    article_row.get("title"),
                    article_row.get("description"),
                    article_row.get("source_domain"),
                )
                description = details.get("description") or description
                content = details.get("content") or content
                article_row["source_domain"] = details.get("source_domain") or article_row.get("source_domain")
        if is_generic_google_news_text(description):
            description = ""
        if is_generic_google_news_text(content):
            content = ""
        article_row["description"] = description
        article_row["content"] = content
        rows.append(article_row)

    return pd.DataFrame(rows)


def get_new_articles_only(ticker: str, scraped_articles: list[dict]) -> list[dict]:
    from advanced.models import NewsArticle

    existing_links = set(
        NewsArticle.objects.filter(ticker=ticker).values_list("link", flat=True)
    )

    new_articles = [
        article
        for article in scraped_articles
        if article.get("link") and article["link"] not in existing_links
    ]

    logger.info(
        "[%s] Incremental check: %s scraped -> %s new -> %s already cached",
        ticker,
        len(scraped_articles),
        len(new_articles),
        len(scraped_articles) - len(new_articles),
    )
    return new_articles
