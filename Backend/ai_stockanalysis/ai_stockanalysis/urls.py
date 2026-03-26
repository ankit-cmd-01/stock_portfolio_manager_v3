import mimetypes

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import FileResponse, Http404, HttpResponse, JsonResponse
from django.urls import include, path, re_path


FRONTEND_DIST_DIR = settings.BASE_DIR.parent.parent / "Frontend" / "dist"
FRONTEND_ASSETS_DIR = FRONTEND_DIST_DIR / "assets"
FRONTEND_INDEX_FILE = FRONTEND_DIST_DIR / "index.html"


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


def frontend_index_view(request, *args, **kwargs):
    if FRONTEND_INDEX_FILE.exists():
        return FileResponse(FRONTEND_INDEX_FILE.open("rb"), content_type="text/html; charset=utf-8")
    return root_view(request)


def frontend_asset_view(request, path):
    asset_path = (FRONTEND_ASSETS_DIR / path).resolve()
    if not str(asset_path).startswith(str(FRONTEND_ASSETS_DIR.resolve())):
        raise Http404("Asset not found.")
    if not asset_path.exists() or not asset_path.is_file():
        raise Http404("Asset not found.")

    content_type, _ = mimetypes.guess_type(asset_path.name)
    return FileResponse(asset_path.open("rb"), content_type=content_type or "application/octet-stream")


urlpatterns = [
    path("", frontend_index_view, name="root"),
    path("favicon.ico", favicon_view, name="favicon"),
    path("assets/<path:path>", frontend_asset_view, name="frontend-asset"),
    path("admin/", admin.site.urls),
    path("accounts/", include("accounts.urls")),
    path("portfolio/", include("portfolio.urls")),
    path("api/portfolio/", include("portfolio.forecast_urls")),
    path("stock_master/", include("stock_master.urls")),
    path("user_stocks/", include("user_stock.urls")),
    path("api/chat/", include("chatbot.urls")),
    path("api/metals/", include("metals.urls")),
    path("api/advanced/", include("advanced.urls")),
    re_path(
        r"^(dashboard|portfolios|portfolio/.*|stock/.*|metals(?:/.*)?|advanced/.*|login)$",
        frontend_index_view,
        name="frontend-spa-route",
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
