from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.health_check, name="metals-health"),
    path("sync/", views.trigger_sync, name="metals-sync"),
    path("ratio/", views.gold_silver_ratio, name="metals-ratio"),
    path("sync-log/", views.sync_log_list, name="metals-sync-log"),
    path("<str:metal>/prices/", views.metal_prices, name="metals-prices"),
    path("<str:metal>/eda/", views.metal_eda, name="metals-eda"),
    path("<str:metal>/summary/", views.metal_summary, name="metals-summary"),
    path("<str:metal>/ohlc/", views.metal_ohlc, name="metals-ohlc"),
]
