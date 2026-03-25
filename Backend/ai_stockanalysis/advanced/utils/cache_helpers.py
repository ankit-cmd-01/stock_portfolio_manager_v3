from django.utils import timezone

from advanced.models import NewsArticle, OverallSentimentCache


def save_new_articles_to_db(ticker: str, company: str, analyzed_articles: list[dict]):
    saved_count = 0
    for article in analyzed_articles:
        link = article.get("link")
        if not link:
            continue

        _, created = NewsArticle.objects.update_or_create(
            ticker=ticker,
            link=link,
            defaults={
                "ticker": ticker,
                "company": company,
                "title": article.get("title") or "",
                "description": article.get("description"),
                "content_snippet": article.get("content"),
                "source": article.get("source", ""),
                "source_domain": article.get("source_domain"),
                "published_at": article.get("date"),
                "sentiment_label": article.get("sentiment_label", "NEUTRAL"),
                "sentiment_score": article.get("sentiment_score", 0.5),
            },
        )
        if created:
            saved_count += 1

    return saved_count


def recompute_overall_sentiment(ticker: str):
    from advanced.services.finbert_service import compute_overall_sentiment

    articles_qs = NewsArticle.objects.filter(ticker=ticker)
    stats = compute_overall_sentiment(articles_qs)
    obj, _ = OverallSentimentCache.objects.update_or_create(
        ticker=ticker,
        defaults=stats,
    )
    return obj


def should_run_incremental_fetch(ticker: str) -> bool:
    latest = NewsArticle.objects.filter(ticker=ticker).order_by("-scraped_at").first()
    if not latest:
        return True

    hours_since = (timezone.now() - latest.scraped_at).total_seconds() / 3600
    return hours_since > 6
