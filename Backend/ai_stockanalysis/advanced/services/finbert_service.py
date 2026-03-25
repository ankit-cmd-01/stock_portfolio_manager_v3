"""
FinBERT sentiment analysis with lazy loading.
"""

import logging
import math

from advanced.services.news_scraper import sanitize_news_text

logger = logging.getLogger(__name__)

_finbert_pipeline = None
_finbert_unavailable = False
POSITIVE_HINTS = {
    "above",
    "beat",
    "beats",
    "breakout",
    "bullish",
    "gain",
    "gains",
    "higher",
    "jump",
    "jumps",
    "outperform",
    "outperforms",
    "profit",
    "rally",
    "rises",
    "strong",
    "surge",
    "surges",
    "upgrade",
    "upgraded",
}
NEGATIVE_HINTS = {
    "bearish",
    "concern",
    "concerns",
    "decline",
    "declines",
    "downgrade",
    "downgraded",
    "drop",
    "drops",
    "falls",
    "hit",
    "hits",
    "low",
    "lower",
    "miss",
    "misses",
    "pressure",
    "sell-off",
    "selloff",
    "sink",
    "sinks",
    "skid",
    "skids",
    "slump",
    "weak",
    "worries",
    "worry",
}


def get_finbert_pipeline():
    global _finbert_pipeline, _finbert_unavailable
    if _finbert_unavailable:
        return None
    if _finbert_pipeline is None:
        logger.info("Loading FinBERT model for the first time.")
        try:
            from transformers import pipeline
        except Exception as exc:
            _finbert_unavailable = True
            logger.warning("Transformers unavailable, using heuristic sentiment fallback: %s", exc)
            return None
        try:
            _finbert_pipeline = pipeline(
                task="text-classification",
                model="ProsusAI/finbert",
                tokenizer="ProsusAI/finbert",
                truncation=True,
                max_length=512,
            )
            logger.info("FinBERT model loaded successfully.")
        except Exception as exc:
            _finbert_unavailable = True
            logger.warning("FinBERT unavailable, using heuristic sentiment fallback: %s", exc)
            return None
    return _finbert_pipeline


def _heuristic_sentiment(text: str) -> dict:
    clean_text = sanitize_news_text(text).lower()
    tokens = clean_text.replace("/", " ").replace(",", " ").split()

    positive_hits = sum(1 for token in tokens if token in POSITIVE_HINTS)
    negative_hits = sum(1 for token in tokens if token in NEGATIVE_HINTS)

    score_gap = positive_hits - negative_hits
    if score_gap > 0:
        confidence = min(0.92, 0.57 + math.log1p(score_gap) * 0.18)
        return {"label": "POSITIVE", "score": round(confidence, 4)}
    if score_gap < 0:
        confidence = min(0.92, 0.57 + math.log1p(abs(score_gap)) * 0.18)
        return {"label": "NEGATIVE", "score": round(confidence, 4)}
    return {"label": "NEUTRAL", "score": 0.5}


def analyze_sentiment(text: str) -> dict:
    if not text or not text.strip():
        return {"label": "NEUTRAL", "score": 0.5}

    try:
        finbert = get_finbert_pipeline()
        if finbert is None:
            return _heuristic_sentiment(text)
        result = finbert(text[:512])[0]
        return {
            "label": str(result.get("label", "NEUTRAL")).upper(),
            "score": round(float(result.get("score", 0.5)), 4),
        }
    except Exception as exc:
        logger.error("FinBERT inference error: %s", exc)
        return _heuristic_sentiment(text)


def batch_analyze(articles: list[dict]) -> list[dict]:
    analyzed = []
    for article in articles:
        title = sanitize_news_text(article.get("title"))
        description = sanitize_news_text(article.get("description"))
        content = sanitize_news_text(article.get("content")) or description
        text = ". ".join(part for part in [title, content] if part)
        sentiment = analyze_sentiment(text)
        analyzed.append(
            {
                **article,
                "title": title,
                "description": description,
                "content": content,
                "sentiment_label": sentiment["label"],
                "sentiment_score": sentiment["score"],
            }
        )
    return analyzed


def compute_overall_sentiment(articles_qs) -> dict:
    total = articles_qs.count()
    if total == 0:
        return {
            "overall_sentiment": "NEUTRAL",
            "positive_pct": 0.0,
            "negative_pct": 0.0,
            "neutral_pct": 100.0,
            "article_count": 0,
        }

    pos = articles_qs.filter(sentiment_label="POSITIVE").count()
    neg = articles_qs.filter(sentiment_label="NEGATIVE").count()
    neu = articles_qs.filter(sentiment_label="NEUTRAL").count()

    scores = {"POSITIVE": pos, "NEGATIVE": neg, "NEUTRAL": neu}
    overall = max(scores, key=scores.get)

    return {
        "overall_sentiment": overall,
        "positive_pct": round((pos / total) * 100, 1),
        "negative_pct": round((neg / total) * 100, 1),
        "neutral_pct": round((neu / total) * 100, 1),
        "article_count": total,
    }
