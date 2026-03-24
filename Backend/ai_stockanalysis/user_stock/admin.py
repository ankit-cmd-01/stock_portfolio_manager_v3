from django.contrib import admin

from .models import UserStock, UserStockData


@admin.register(UserStock)
class UserStockAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "portfolio", "stock", "created_at", "modified_at")
    list_select_related = ("user", "portfolio", "stock")
    search_fields = ("user__username", "portfolio__title", "stock__ticker")
    list_filter = ("created_at", "modified_at")


@admin.register(UserStockData)
class UserStockDataAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user_stock",
        "timestamp",
        "open",
        "high",
        "low",
        "close",
        "volume",
        "pe_ratio",
    )
    list_select_related = ("user_stock__stock",)
    search_fields = ("user_stock__stock__ticker",)
    list_filter = ("timestamp",)
