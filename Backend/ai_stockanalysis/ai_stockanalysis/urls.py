from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse, JsonResponse
from django.urls import include, path


def root_view(request):
    return JsonResponse(
        {
            "message": "AI Stock Analysis API",
            "admin_url": "/admin/",
            "accounts_base_url": "/accounts/",
            "portfolio_base_url": "/portfolio/",
            "stock_master_base_url": "/stock_master/",
            "user_stocks_base_url": "/user_stocks/",
            "metals_base_url": "/api/metals/",
            "advanced_base_url": "/api/advanced/",
        }
    )


def favicon_view(request):
    return HttpResponse(status=204)


urlpatterns = [
    path("", root_view, name="root"),
    path("favicon.ico", favicon_view, name="favicon"),
    path("admin/", admin.site.urls),
    path("accounts/", include("accounts.urls")),
    path("portfolio/", include("portfolio.urls")),
    path("api/portfolio/", include("portfolio.forecast_urls")),
    path("stock_master/", include("stock_master.urls")),
    path("user_stocks/", include("user_stock.urls")),
    path("api/metals/", include("metals.urls")),
    path("api/advanced/", include("advanced.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
