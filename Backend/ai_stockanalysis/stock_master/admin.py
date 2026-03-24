from django.contrib import admin

from .models import StockCategory, StockMaster


@admin.register(StockCategory)
class StockCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "category_type", "sort_order", "is_active")
    search_fields = ("name", "slug", "category_type")
    list_filter = ("category_type", "is_active")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(StockMaster)
class StockMasterAdmin(admin.ModelAdmin):
    list_display = ("id", "stock_name", "ticker", "yahoo_ticker", "market", "exchange", "market_cap")
    search_fields = ("stock_name", "ticker", "yahoo_ticker", "market", "exchange")
    list_filter = ("market", "exchange", "categories")
    filter_horizontal = ("categories",)
