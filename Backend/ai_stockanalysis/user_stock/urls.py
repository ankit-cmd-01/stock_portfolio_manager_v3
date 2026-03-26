from django.urls import path

from .views import (
    UserStockByPortfolioView,
    UserStockDetailView,
    UserStockListCreateView,
    UserStockPortfolioTableView,
)

urlpatterns = [
    path(
        "",
        UserStockListCreateView.as_view(),
        name="user-stock-list-create",
    ),
    path(
        "<int:pk>/",
        UserStockDetailView.as_view(),
        name="user-stock-detail",
    ),
    path(
        "portfolio/<int:portfolio_pk>/",
        UserStockByPortfolioView.as_view(),
        name="user-stock-by-portfolio",
    ),
    path(
        "portfolio/<int:portfolio_pk>/table/",
        UserStockPortfolioTableView.as_view(),
        name="user-stock-portfolio-table",
    ),
]
