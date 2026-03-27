from decimal import Decimal

from rest_framework import serializers

from .models import UserStock, UserStockData


class UserStockDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserStockData
        fields = [
            "id",
            "timestamp",
            "open",
            "high",
            "low",
            "close",
            "volume",
            "pe_ratio",
        ]
        read_only_fields = ["id"]


class UserStockSerializer(serializers.ModelSerializer):
    ticker = serializers.SerializerMethodField(read_only=True)
    company_name = serializers.SerializerMethodField(read_only=True)
    portfolio_title = serializers.SerializerMethodField(read_only=True)
    data_count = serializers.SerializerMethodField(read_only=True)
    quantity = serializers.DecimalField(
        max_digits=14,
        decimal_places=4,
        min_value=Decimal("0.0001"),
    )

    class Meta:
        model = UserStock
        fields = [
            "id",
            "ticker",
            "company_name",
            "portfolio",
            "portfolio_title",
            "quantity",
            "data_count",
            "created_at",
            "modified_at",
        ]
        read_only_fields = [
            "id",
            "ticker",
            "company_name",
            "portfolio_title",
            "data_count",
            "created_at",
            "modified_at",
        ]

    def get_ticker(self, obj):
        return obj.stock.yahoo_ticker or obj.stock.ticker

    def get_company_name(self, obj):
        return getattr(obj.stock, "company_name", getattr(obj.stock, "stock_name", None))

    def get_portfolio_title(self, obj):
        return obj.portfolio.title

    def get_data_count(self, obj):
        annotated_count = getattr(obj, "data_count", None)
        if annotated_count is not None:
            return annotated_count
        prefetched = getattr(obj, "_prefetched_objects_cache", {})
        if "stock_data" in prefetched:
            return len(prefetched["stock_data"])
        return obj.stock_data.count()


class UserStockDetailSerializer(UserStockSerializer):
    stock_data = UserStockDataSerializer(many=True, read_only=True)

    class Meta(UserStockSerializer.Meta):
        fields = UserStockSerializer.Meta.fields + ["stock_data"]
