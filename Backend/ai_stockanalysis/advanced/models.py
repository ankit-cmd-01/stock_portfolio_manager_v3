from datetime import timedelta

from django.db import models
from django.utils import timezone


class NewsArticle(models.Model):
    ticker = models.CharField(max_length=20, db_index=True)
    company = models.CharField(max_length=100)
    title = models.TextField()
    description = models.TextField(null=True, blank=True)
    content_snippet = models.TextField(null=True, blank=True)
    source = models.CharField(max_length=100)
    source_domain = models.CharField(max_length=200, null=True, blank=True)
    link = models.URLField(max_length=500)
    published_at = models.DateTimeField(null=True, blank=True)
    sentiment_label = models.CharField(
        max_length=10,
        choices=[
            ("POSITIVE", "POSITIVE"),
            ("NEGATIVE", "NEGATIVE"),
            ("NEUTRAL", "NEUTRAL"),
        ],
        null=True,
        blank=True,
    )
    sentiment_score = models.FloatField(null=True, blank=True)
    scraped_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-published_at", "-scraped_at"]
        indexes = [models.Index(fields=["ticker", "published_at"])]
        constraints = [
            models.UniqueConstraint(fields=["ticker", "link"], name="advanced_newsarticle_ticker_link_uniq")
        ]

    def __str__(self):
        return f"[{self.ticker}] {self.title[:60]}"


class OverallSentimentCache(models.Model):
    ticker = models.CharField(max_length=20, unique=True)
    overall_sentiment = models.CharField(max_length=10)
    positive_pct = models.FloatField(default=0.0)
    negative_pct = models.FloatField(default=0.0)
    neutral_pct = models.FloatField(default=0.0)
    article_count = models.IntegerField(default=0)
    last_computed_at = models.DateTimeField(auto_now=True)

    def is_stale(self):
        return timezone.now() - self.last_computed_at > timedelta(hours=6)

    def __str__(self):
        return f"{self.ticker} -> {self.overall_sentiment} ({self.article_count} articles)"


class EarningsCache(models.Model):
    ticker = models.CharField(max_length=20, unique=True)
    company = models.CharField(max_length=100)
    quarter_date = models.DateField(null=True, blank=True)
    eps_actual = models.FloatField(null=True, blank=True)
    eps_estimate = models.FloatField(null=True, blank=True)
    eps_surprise_pct = models.FloatField(null=True, blank=True)
    revenue_actual = models.FloatField(null=True, blank=True)
    revenue_estimate = models.FloatField(null=True, blank=True)
    revenue_surprise_pct = models.FloatField(null=True, blank=True)
    raw_financials = models.JSONField(default=dict)
    ai_summary = models.TextField()
    ai_model_used = models.CharField(max_length=50, default="deepseek-chat")
    fetched_at = models.DateTimeField(auto_now=True)

    def is_stale(self):
        return timezone.now() - self.fetched_at >= timedelta(days=30)

    def __str__(self):
        return f"{self.ticker} earnings - Q{self.quarter_date}"
