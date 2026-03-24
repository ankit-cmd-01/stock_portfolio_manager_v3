from rest_framework import serializers

from .models import EDAReport, GoldPrice, SilverPrice, SyncLog


class GoldPriceSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoldPrice
        fields = "__all__"


class SilverPriceSerializer(serializers.ModelSerializer):
    class Meta:
        model = SilverPrice
        fields = "__all__"


class EDAReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = EDAReport
        fields = "__all__"


class SyncLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncLog
        fields = "__all__"


class MetalSummarySerializer(serializers.Serializer):
    metal = serializers.CharField()
    current_price = serializers.FloatField(allow_null=True)
    prev_close = serializers.FloatField(allow_null=True)
    change_1h = serializers.FloatField(allow_null=True)
    change_1h_pct = serializers.FloatField(allow_null=True)
    change_24h = serializers.FloatField(allow_null=True)
    change_24h_pct = serializers.FloatField(allow_null=True)
    change_7d = serializers.FloatField(allow_null=True)
    change_7d_pct = serializers.FloatField(allow_null=True)
    high_52w = serializers.FloatField(allow_null=True)
    low_52w = serializers.FloatField(allow_null=True)
    rsi_14 = serializers.FloatField(allow_null=True)
    sma_20 = serializers.FloatField(allow_null=True)
    sma_50 = serializers.FloatField(allow_null=True)
    ema_20 = serializers.FloatField(allow_null=True)
    macd = serializers.FloatField(allow_null=True)
    signal = serializers.FloatField(allow_null=True)
    bb_upper = serializers.FloatField(allow_null=True)
    bb_lower = serializers.FloatField(allow_null=True)
    atr_14 = serializers.FloatField(allow_null=True)
    obv = serializers.FloatField(allow_null=True)
    annualized_vol = serializers.FloatField(allow_null=True)
    last_updated = serializers.DateTimeField(allow_null=True)


class GoldSilverRatioSerializer(serializers.Serializer):
    timestamps = serializers.ListField(child=serializers.DateTimeField())
    ratios = serializers.ListField(child=serializers.FloatField())
    current_ratio = serializers.FloatField(allow_null=True)
    avg_ratio = serializers.FloatField(allow_null=True)
    min_ratio = serializers.FloatField(allow_null=True)
    max_ratio = serializers.FloatField(allow_null=True)
