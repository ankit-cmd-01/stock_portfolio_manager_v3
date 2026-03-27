from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("portfolio", "0001_initial"),
        ("stock_master", "0003_stockcategory_stockmaster_market_cap_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="QualityStock",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("ai_rating", models.FloatField(default=0.0)),
                (
                    "buy_signal",
                    models.CharField(
                        choices=[("BUY", "Buy"), ("HOLD", "Hold"), ("SELL", "Sell")],
                        default="HOLD",
                        max_length=4,
                    ),
                ),
                ("report_json", models.JSONField(blank=True, default=dict)),
                ("graphs_data", models.JSONField(blank=True, default=dict)),
                ("generated_at", models.DateTimeField(auto_now=True)),
                ("selected_by_user", models.BooleanField(default=True)),
                (
                    "portfolio",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="quality_stocks",
                        to="portfolio.portfolio",
                    ),
                ),
                (
                    "stock",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="quality_stock_reports",
                        to="stock_master.stockmaster",
                    ),
                ),
            ],
            options={
                "ordering": ["-generated_at", "-id"],
            },
        ),
        migrations.AddConstraint(
            model_name="qualitystock",
            constraint=models.UniqueConstraint(
                fields=("portfolio", "stock"),
                name="quality_stocks_portfolio_stock_uniq",
            ),
        ),
    ]
