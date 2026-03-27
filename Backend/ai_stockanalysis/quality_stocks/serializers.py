from rest_framework import serializers


class QualityStockSnapshotRequestSerializer(serializers.Serializer):
    portfolio_id = serializers.IntegerField(min_value=1)


class QualityStockGenerateRequestSerializer(serializers.Serializer):
    portfolio_id = serializers.IntegerField(min_value=1)
    stock_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )


class QualityStockRowSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    portfolio_id = serializers.IntegerField()
    portfolio_title = serializers.CharField()
    stock_id = serializers.IntegerField()
    symbol = serializers.CharField()
    stock_name = serializers.CharField()
    ai_rating = serializers.FloatField()
    buy_signal = serializers.CharField()
    selected_by_user = serializers.BooleanField()
    generated_at = serializers.DateTimeField()
    justification = serializers.CharField(allow_null=True, required=False)
    provider = serializers.CharField(allow_null=True, required=False)


class QualityStockDetailSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    portfolio_id = serializers.IntegerField()
    portfolio_title = serializers.CharField()
    stock_id = serializers.IntegerField()
    symbol = serializers.CharField()
    stock_name = serializers.CharField()
    ai_rating = serializers.FloatField()
    buy_signal = serializers.CharField()
    selected_by_user = serializers.BooleanField()
    generated_at = serializers.DateTimeField()
    report_json = serializers.JSONField()
    graphs_data = serializers.JSONField()


class QualityStockSnapshotRowSerializer(serializers.Serializer):
    stock_id = serializers.IntegerField()
    user_stock_id = serializers.IntegerField()
    symbol = serializers.CharField()
    stock_name = serializers.CharField()
    ai_rating = serializers.FloatField()
    buy_signal = serializers.CharField()
    current_price = serializers.FloatField()
    predicted_price = serializers.FloatField()
    expected_change_pct = serializers.FloatField()
    trend_metrics = serializers.JSONField()
    fundamentals = serializers.JSONField()
    sector_averages = serializers.JSONField()
    ranking_components = serializers.JSONField()

