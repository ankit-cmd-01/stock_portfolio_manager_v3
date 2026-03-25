from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from advanced.models import NewsArticle
from advanced.services.news_scraper import article_matches_company
from advanced.utils.cache_helpers import save_new_articles_to_db
from advanced.views import _build_ticker_candidates, news_sentiment_view
from stock_master.models import StockMaster


class AdvancedNewsSentimentTests(TestCase):
    def setUp(self):
        self.user_model = get_user_model()
        self.user = self.user_model.objects.create_user(
            username="advanced_user",
            email="advanced@example.com",
            phone_number="+911234567891",
            password="StrongPassword123!",
            is_active=True,
        )
        self.factory = APIRequestFactory()

    def test_build_ticker_candidates_adds_exchange_corrected_symbol_for_mismatched_saved_symbol(self):
        stock = StockMaster.objects.create(
            stock_name="ITC Hotels Ltd.",
            ticker="ITC.BO",
            yahoo_ticker="ITC.BO",
            market="Indian",
            exchange="NSE",
        )

        with mock.patch("advanced.views.resolve_yahoo_symbol", return_value=None):
            candidates = _build_ticker_candidates("ITC.BO", stock)

        self.assertIn("ITC.NS", candidates)
        self.assertLess(candidates.index("ITC.NS"), len(candidates))

    def test_save_new_articles_to_db_allows_same_link_for_multiple_tickers(self):
        article = {
            "title": "Palantir wins fresh enterprise contract",
            "description": "A new enterprise contract adds momentum.",
            "content": "Palantir wins a new enterprise contract and investors react positively.",
            "source": "Example News",
            "source_domain": "example.com",
            "link": "https://example.com/articles/palantir-contract",
            "date": None,
            "sentiment_label": "POSITIVE",
            "sentiment_score": 0.84,
        }

        first_saved = save_new_articles_to_db("PLTR", "Palantir Technologies", [article])
        second_saved = save_new_articles_to_db("PLTR.US", "Palantir Technologies", [article])

        self.assertEqual(first_saved, 1)
        self.assertEqual(second_saved, 1)
        self.assertEqual(
            NewsArticle.objects.filter(link="https://example.com/articles/palantir-contract").count(),
            2,
        )

    def test_article_matches_company_filters_generic_ticker_noise(self):
        self.assertFalse(
            article_matches_company(
                {
                    "title": "2 Tech Stocks Most Investors Haven't Heard of That Could Go Parabolic",
                    "description": "A broad story about technology names.",
                    "content": "",
                },
                "Tech Mahindra Ltd.",
                ticker_candidates=["TECH", "TECH.NS"],
            )
        )
        self.assertTrue(
            article_matches_company(
                {
                    "title": "Tech Mahindra wins a large telecom transformation mandate",
                    "description": "Mahindra expands its telecom and enterprise work.",
                    "content": "",
                },
                "Tech Mahindra Ltd.",
                ticker_candidates=["TECH", "TECH.NS"],
            )
        )

    def test_news_sentiment_view_clones_company_matched_articles_for_alias_ticker(self):
        StockMaster.objects.create(
            stock_name="ITC Hotels Ltd.",
            ticker="ITC.BO",
            yahoo_ticker="ITC.BO",
            market="Indian",
            exchange="NSE",
        )
        NewsArticle.objects.create(
            ticker="ITC.BO",
            company="ITC Hotels Ltd.",
            title="ITC Hotels launches a new property",
            description="ITC Hotels expands its hospitality footprint.",
            content_snippet="ITC Hotels expands its hospitality footprint with a new launch in Rajasthan.",
            source="Example News",
            source_domain="example.com",
            link="https://example.com/articles/itc-hotels-launch",
            sentiment_label="POSITIVE",
            sentiment_score=0.81,
        )

        request = self.factory.get(
            "/api/advanced/news-sentiment/",
            {"ticker": "ITCHOTELS.NS", "company": "ITC Hotels Ltd."},
        )
        force_authenticate(request, user=self.user)

        with mock.patch("advanced.views.should_run_incremental_fetch", return_value=False), mock.patch(
            "advanced.views.resolve_yahoo_symbol",
            return_value=None,
        ):
            response = news_sentiment_view(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["overall"]["article_count"], 1)
        self.assertEqual(len(response.data["articles"]), 1)
        self.assertEqual(response.data["articles"][0]["title"], "ITC Hotels launches a new property")
        self.assertTrue(
            NewsArticle.objects.filter(
                ticker="ITCHOTELS.NS",
                link="https://example.com/articles/itc-hotels-launch",
            ).exists()
        )
