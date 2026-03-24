from django.urls import path

from .views import PortfolioDetailView, PortfolioListCreateView


urlpatterns = [
    path("", PortfolioListCreateView.as_view(), name="portfolio-list-create"),
    path("<int:pk>/", PortfolioDetailView.as_view(), name="portfolio-detail"),
]
