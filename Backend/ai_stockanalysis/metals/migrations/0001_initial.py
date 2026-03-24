# Generated manually for the Metals module bootstrap.
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="GoldPrice",
            fields=[
                ("timestamp", models.DateTimeField(primary_key=True, serialize=False)),
                ("open", models.FloatField()),
                ("high", models.FloatField()),
                ("low", models.FloatField()),
                ("close", models.FloatField()),
                ("volume", models.BigIntegerField()),
                ("sma_20", models.FloatField(blank=True, null=True)),
                ("sma_50", models.FloatField(blank=True, null=True)),
                ("ema_20", models.FloatField(blank=True, null=True)),
                ("rsi_14", models.FloatField(blank=True, null=True)),
                ("bb_upper", models.FloatField(blank=True, null=True)),
                ("bb_lower", models.FloatField(blank=True, null=True)),
                ("macd", models.FloatField(blank=True, null=True)),
                ("signal", models.FloatField(blank=True, null=True)),
                ("atr_14", models.FloatField(blank=True, null=True)),
                ("obv", models.FloatField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"db_table": "gold_prices", "ordering": ["-timestamp"]},
        ),
        migrations.CreateModel(
            name="SilverPrice",
            fields=[
                ("timestamp", models.DateTimeField(primary_key=True, serialize=False)),
                ("open", models.FloatField()),
                ("high", models.FloatField()),
                ("low", models.FloatField()),
                ("close", models.FloatField()),
                ("volume", models.BigIntegerField()),
                ("sma_20", models.FloatField(blank=True, null=True)),
                ("sma_50", models.FloatField(blank=True, null=True)),
                ("ema_20", models.FloatField(blank=True, null=True)),
                ("rsi_14", models.FloatField(blank=True, null=True)),
                ("bb_upper", models.FloatField(blank=True, null=True)),
                ("bb_lower", models.FloatField(blank=True, null=True)),
                ("macd", models.FloatField(blank=True, null=True)),
                ("signal", models.FloatField(blank=True, null=True)),
                ("atr_14", models.FloatField(blank=True, null=True)),
                ("obv", models.FloatField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"db_table": "silver_prices", "ordering": ["-timestamp"]},
        ),
        migrations.CreateModel(
            name="EDAReport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("metal", models.CharField(choices=[("gold", "Gold"), ("silver", "Silver")], max_length=10)),
                ("run_type", models.CharField(choices=[("initial", "Initial"), ("incremental", "Incremental")], max_length=20)),
                ("run_timestamp", models.DateTimeField(auto_now_add=True)),
                ("rows_before", models.IntegerField()),
                ("rows_after", models.IntegerField()),
                ("missing_filled", models.IntegerField(default=0)),
                ("missing_dropped", models.IntegerField(default=0)),
                ("outliers_capped", models.IntegerField(default=0)),
                ("is_stationary", models.BooleanField(default=False)),
                ("adf_p_value", models.FloatField(default=1.0)),
                ("annualized_vol", models.FloatField(default=0.0)),
                ("mean_close", models.FloatField(default=0.0)),
                ("std_close", models.FloatField(default=0.0)),
                ("skewness", models.FloatField(default=0.0)),
                ("kurtosis", models.FloatField(default=0.0)),
                ("correlation_matrix", models.JSONField(default=dict)),
                ("full_report", models.JSONField(default=dict)),
            ],
            options={"db_table": "metals_eda_reports", "ordering": ["-run_timestamp"]},
        ),
        migrations.CreateModel(
            name="SyncLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("metal", models.CharField(max_length=10)),
                ("sync_time", models.DateTimeField(auto_now_add=True)),
                ("rows_added", models.IntegerField(default=0)),
                ("last_ts_before", models.DateTimeField(blank=True, null=True)),
                ("last_ts_after", models.DateTimeField(blank=True, null=True)),
                ("status", models.CharField(choices=[("success", "Success"), ("skipped", "Skipped"), ("error", "Error")], max_length=10)),
                ("message", models.TextField()),
            ],
            options={"db_table": "metals_sync_log", "ordering": ["-sync_time"]},
        ),
    ]
