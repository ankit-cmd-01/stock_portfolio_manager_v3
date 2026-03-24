from rest_framework import serializers

from .models import StockCategory, StockMaster


class StockCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = StockCategory
        fields = ["id", "name", "slug", "category_type", "description"]
        read_only_fields = fields


class StockMasterSummarySerializer(serializers.ModelSerializer):
    categories = StockCategorySerializer(many=True, read_only=True)

    class Meta:
        model = StockMaster
        fields = [
            "id",
            "stock_name",
            "ticker",
            "yahoo_ticker",
            "market",
            "exchange",
            "market_cap",
            "categories",
        ]
        read_only_fields = fields

class StockMasterSerializer(serializers.ModelSerializer):
    categories = StockCategorySerializer(many=True, read_only=True)

    class Meta:
        model = StockMaster
        fields = [
            "id",
            "stock_name",
            "ticker",
            "yahoo_ticker",
            "market",
            "exchange",
            "market_cap",
            "categories",
        ]
        read_only_fields = fields
