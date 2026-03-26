from django.urls import path

from .views import PortfolioAISummaryView, PortfolioForecastView


urlpatterns = [
    path("<int:pk>/forecast/", PortfolioForecastView.as_view(), name="portfolio-forecast"),
    path("<int:pk>/ai-summary/", PortfolioAISummaryView.as_view(), name="portfolio-ai-summary"),
]
