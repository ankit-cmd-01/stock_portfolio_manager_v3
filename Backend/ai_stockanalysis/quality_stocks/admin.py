from django.contrib import admin

from .models import QualityStock


@admin.register(QualityStock)
class QualityStockAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "portfolio",
        "stock",
        "ai_rating",
        "buy_signal",
        "selected_by_user",
        "generated_at",
    )
    list_filter = ("buy_signal", "selected_by_user", "generated_at")
    search_fields = ("portfolio__title", "stock__stock_name", "stock__ticker", "stock__yahoo_ticker")
    readonly_fields = ("generated_at",)

