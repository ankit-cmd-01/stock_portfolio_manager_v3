from rest_framework import serializers

from .models import Portfolio


class PortfolioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Portfolio
        fields = ["id", "title", "description", "created_at", "modified_at"]
        read_only_fields = ["id", "created_at", "modified_at"]


class PortfolioCreateSerializer(PortfolioSerializer):
    stock_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=True,
        write_only=True,
    )

    class Meta(PortfolioSerializer.Meta):
        fields = PortfolioSerializer.Meta.fields + ["stock_ids"]
