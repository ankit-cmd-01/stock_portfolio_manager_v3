from django.urls import path

from . import views


urlpatterns = [
    path("news-sentiment/", views.news_sentiment_view, name="news-sentiment"),
    path("earnings/", views.earnings_view, name="earnings"),
]
