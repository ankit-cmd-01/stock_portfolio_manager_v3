from rest_framework import serializers

from .models import EarningsCache, NewsArticle, OverallSentimentCache


class NewsArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsArticle
        fields = [
            "id",
            "ticker",
            "company",
            "title",
            "description",
            "content_snippet",
            "source",
            "source_domain",
            "link",
            "published_at",
            "sentiment_label",
            "sentiment_score",
            "scraped_at",
        ]
        read_only_fields = fields


class OverallSentimentCacheSerializer(serializers.ModelSerializer):
    class Meta:
        model = OverallSentimentCache
        fields = [
            "ticker",
            "overall_sentiment",
            "positive_pct",
            "negative_pct",
            "neutral_pct",
            "article_count",
            "last_computed_at",
        ]
        read_only_fields = fields


class EarningsCacheSerializer(serializers.ModelSerializer):
    class Meta:
        model = EarningsCache
        fields = [
            "ticker",
            "company",
            "quarter_date",
            "eps_actual",
            "eps_estimate",
            "eps_surprise_pct",
            "revenue_actual",
            "revenue_estimate",
            "revenue_surprise_pct",
            "raw_financials",
            "ai_summary",
            "ai_model_used",
            "fetched_at",
        ]
        read_only_fields = fields
