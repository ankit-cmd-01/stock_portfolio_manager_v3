from django.db import models


class PriceBase(models.Model):
    timestamp = models.DateTimeField(primary_key=True)
    open = models.FloatField()
    high = models.FloatField()
    low = models.FloatField()
    close = models.FloatField()
    volume = models.BigIntegerField()
    sma_20 = models.FloatField(null=True, blank=True)
    sma_50 = models.FloatField(null=True, blank=True)
    ema_20 = models.FloatField(null=True, blank=True)
    rsi_14 = models.FloatField(null=True, blank=True)
    bb_upper = models.FloatField(null=True, blank=True)
    bb_lower = models.FloatField(null=True, blank=True)
    macd = models.FloatField(null=True, blank=True)
    signal = models.FloatField(null=True, blank=True)
    atr_14 = models.FloatField(null=True, blank=True)
    obv = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.timestamp:%Y-%m-%d %H:%M:%S}"


class GoldPrice(PriceBase):
    class Meta:
        db_table = "gold_prices"
        ordering = ["-timestamp"]


class SilverPrice(PriceBase):
    class Meta:
        db_table = "silver_prices"
        ordering = ["-timestamp"]


class EDAReport(models.Model):
    METAL_CHOICES = [("gold", "Gold"), ("silver", "Silver")]
    RUN_CHOICES = [("initial", "Initial"), ("incremental", "Incremental")]

    metal = models.CharField(max_length=10, choices=METAL_CHOICES)
    run_type = models.CharField(max_length=20, choices=RUN_CHOICES)
    run_timestamp = models.DateTimeField(auto_now_add=True)
    rows_before = models.IntegerField()
    rows_after = models.IntegerField()
    missing_filled = models.IntegerField(default=0)
    missing_dropped = models.IntegerField(default=0)
    outliers_capped = models.IntegerField(default=0)
    is_stationary = models.BooleanField(default=False)
    adf_p_value = models.FloatField(default=1.0)
    annualized_vol = models.FloatField(default=0.0)
    mean_close = models.FloatField(default=0.0)
    std_close = models.FloatField(default=0.0)
    skewness = models.FloatField(default=0.0)
    kurtosis = models.FloatField(default=0.0)
    correlation_matrix = models.JSONField(default=dict)
    full_report = models.JSONField(default=dict)

    class Meta:
        db_table = "metals_eda_reports"
        ordering = ["-run_timestamp"]

    def __str__(self):
        return f"{self.metal} {self.run_type} @ {self.run_timestamp:%Y-%m-%d %H:%M:%S}"


class SyncLog(models.Model):
    STATUS_CHOICES = [("success", "Success"), ("skipped", "Skipped"), ("error", "Error")]

    metal = models.CharField(max_length=10)
    sync_time = models.DateTimeField(auto_now_add=True)
    rows_added = models.IntegerField(default=0)
    last_ts_before = models.DateTimeField(null=True, blank=True)
    last_ts_after = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)
    message = models.TextField()

    class Meta:
        db_table = "metals_sync_log"
        ordering = ["-sync_time"]

    def __str__(self):
        return f"{self.metal} {self.status} @ {self.sync_time:%Y-%m-%d %H:%M:%S}"
