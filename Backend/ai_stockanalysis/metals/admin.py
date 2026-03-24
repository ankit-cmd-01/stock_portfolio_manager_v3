from django.contrib import admin

from .models import EDAReport, GoldPrice, SilverPrice, SyncLog


@admin.register(GoldPrice)
class GoldPriceAdmin(admin.ModelAdmin):
    list_display = ("timestamp", "close", "volume", "rsi_14", "macd")
    ordering = ("-timestamp",)


@admin.register(SilverPrice)
class SilverPriceAdmin(admin.ModelAdmin):
    list_display = ("timestamp", "close", "volume", "rsi_14", "macd")
    ordering = ("-timestamp",)


@admin.register(EDAReport)
class EDAReportAdmin(admin.ModelAdmin):
    list_display = ("metal", "run_type", "run_timestamp", "rows_before", "rows_after")
    ordering = ("-run_timestamp",)


@admin.register(SyncLog)
class SyncLogAdmin(admin.ModelAdmin):
    list_display = ("metal", "sync_time", "rows_added", "status")
    ordering = ("-sync_time",)
