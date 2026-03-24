from django.urls import path

from .views import PortfolioForecastView


urlpatterns = [
    path("<int:pk>/forecast/", PortfolioForecastView.as_view(), name="portfolio-forecast"),
]
