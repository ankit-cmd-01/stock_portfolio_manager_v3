from django.urls import path

from .views import SuggestedPortfolioCategoryView, StockMasterSearchView

urlpatterns = [
    path("", StockMasterSearchView.as_view(), name="stock-master-search"),
    path(
        "suggested-portfolios/",
        SuggestedPortfolioCategoryView.as_view(),
        name="stock-master-suggested-portfolios",
    ),
]
