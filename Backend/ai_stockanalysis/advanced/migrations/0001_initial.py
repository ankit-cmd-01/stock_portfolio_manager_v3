from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="EarningsCache",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("ticker", models.CharField(max_length=20, unique=True)),
                ("company", models.CharField(max_length=100)),
                ("quarter_date", models.DateField(blank=True, null=True)),
                ("eps_actual", models.FloatField(blank=True, null=True)),
                ("eps_estimate", models.FloatField(blank=True, null=True)),
                ("eps_surprise_pct", models.FloatField(blank=True, null=True)),
                ("revenue_actual", models.FloatField(blank=True, null=True)),
                ("revenue_estimate", models.FloatField(blank=True, null=True)),
                ("revenue_surprise_pct", models.FloatField(blank=True, null=True)),
                ("raw_financials", models.JSONField(default=dict)),
                ("ai_summary", models.TextField()),
                ("ai_model_used", models.CharField(default="deepseek-chat", max_length=50)),
                ("fetched_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="NewsArticle",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("ticker", models.CharField(db_index=True, max_length=20)),
                ("company", models.CharField(max_length=100)),
                ("title", models.TextField()),
                ("description", models.TextField(blank=True, null=True)),
                ("content_snippet", models.TextField(blank=True, null=True)),
                ("source", models.CharField(max_length=100)),
                ("source_domain", models.CharField(blank=True, max_length=200, null=True)),
                ("link", models.URLField(max_length=500, unique=True)),
                ("published_at", models.DateTimeField(blank=True, null=True)),
                (
                    "sentiment_label",
                    models.CharField(
                        blank=True,
                        choices=[("POSITIVE", "POSITIVE"), ("NEGATIVE", "NEGATIVE"), ("NEUTRAL", "NEUTRAL")],
                        max_length=10,
                        null=True,
                    ),
                ),
                ("sentiment_score", models.FloatField(blank=True, null=True)),
                ("scraped_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["-published_at", "-scraped_at"],
            },
        ),
        migrations.CreateModel(
            name="OverallSentimentCache",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("ticker", models.CharField(max_length=20, unique=True)),
                ("overall_sentiment", models.CharField(max_length=10)),
                ("positive_pct", models.FloatField(default=0.0)),
                ("negative_pct", models.FloatField(default=0.0)),
                ("neutral_pct", models.FloatField(default=0.0)),
                ("article_count", models.IntegerField(default=0)),
                ("last_computed_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.AddIndex(
            model_name="newsarticle",
            index=models.Index(fields=["ticker", "published_at"], name="advanced_ne_ticker__3f4489_idx"),
        ),
    ]
