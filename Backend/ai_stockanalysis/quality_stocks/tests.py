from datetime import datetime, timedelta, timezone as dt_timezone
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from portfolio.models import Portfolio
from stock_master.models import StockCategory, StockMaster
from user_stock.models import UserStock, UserStockData

from .models import QualityStock
from .services import get_quality_stock_detail


class QualityStockAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="quality_owner",
            email="quality@example.com",
            phone_number="+911234567801",
            password="StrongPassword123!",
            is_active=True,
        )
        self.other_user = user_model.objects.create_user(
            username="quality_other",
            email="quality-other@example.com",
            phone_number="+911234567802",
            password="StrongPassword123!",
            is_active=True,
        )
        self.portfolio = Portfolio.objects.create(
            user=self.user,
            title="Quality Portfolio",
            description="Portfolio for quality stock tests",
        )
        self.other_portfolio = Portfolio.objects.create(
            user=self.other_user,
            title="Other Portfolio",
            description="Should remain hidden",
        )

        self.sector = StockCategory.objects.create(
            name="Banking",
            slug="banking",
            category_type=StockCategory.CategoryType.SECTOR,
        )
        self.stock = StockMaster.objects.create(
            stock_name="Alpha Industries",
            ticker="ALPHA",
            yahoo_ticker="ALPHA.NS",
            market="Equity",
            exchange="NSE",
        )
        self.stock.categories.add(self.sector)
        self.other_stock = StockMaster.objects.create(
            stock_name="Beta Industries",
            ticker="BETA",
            yahoo_ticker="BETA.NS",
            market="Equity",
            exchange="NSE",
        )
        self.other_stock.categories.add(self.sector)

        self.user_stock = UserStock.objects.create(
            user=self.user,
            portfolio=self.portfolio,
            stock=self.stock,
            quantity=2,
        )
        self.other_user_stock = UserStock.objects.create(
            user=self.other_user,
            portfolio=self.other_portfolio,
            stock=self.other_stock,
            quantity=1,
        )

        base_time = timezone.make_aware(datetime(2026, 1, 1, 9, 15, 0), dt_timezone.utc)
        for index in range(100):
            UserStockData.objects.create(
                user_stock=self.user_stock,
                timestamp=base_time + timedelta(days=index),
                open=100 + index,
                high=101 + index,
                low=99 + index,
                close=100 + index,
                volume=10_000 + index * 50,
                pe_ratio=18,
            )
        for index in range(40):
            UserStockData.objects.create(
                user_stock=self.other_user_stock,
                timestamp=base_time + timedelta(days=index),
                open=200 + index,
                high=201 + index,
                low=199 + index,
                close=200 + index,
                volume=8_000 + index * 20,
                pe_ratio=22,
            )

    def _forecast_payload(self, user_stock, predicted_price):
        latest_close = float(user_stock.stock_data.order_by("timestamp").last().close)
        quantity = float(user_stock.quantity)
        return {
            "portfolio_id": user_stock.portfolio_id,
            "portfolio_title": user_stock.portfolio.title,
            "current_value": round(latest_close * quantity, 4),
            "predicted_value": round(predicted_price * quantity, 4),
            "growth_pct": round(((predicted_price - latest_close) / latest_close) * 100, 4),
            "stock_predictions": [
                {
                    "user_stock_id": user_stock.id,
                    "symbol": user_stock.stock.yahoo_ticker,
                    "stock_name": user_stock.stock.stock_name,
                    "quantity": quantity,
                    "current_price": latest_close,
                    "predicted_price": predicted_price,
                    "current_value": round(latest_close * quantity, 4),
                    "predicted_value": round(predicted_price * quantity, 4),
                    "growth_pct": round(((predicted_price - latest_close) / latest_close) * 100, 4),
                    "model_status": "ready",
                    "trained_at": None,
                    "metrics": {},
                }
            ],
        }

    def test_list_filters_reports_to_authenticated_user(self):
        own_report = QualityStock.objects.create(
            portfolio=self.portfolio,
            stock=self.stock,
            ai_rating=77.0,
            buy_signal=QualityStock.BuySignal.BUY,
            report_json={"symbol": "ALPHA.NS", "justification": "Own report"},
            graphs_data={"price_history": [], "financial_metrics": []},
        )
        QualityStock.objects.create(
            portfolio=self.other_portfolio,
            stock=self.other_stock,
            ai_rating=40.0,
            buy_signal=QualityStock.BuySignal.SELL,
            report_json={"symbol": "BETA.NS", "justification": "Other report"},
            graphs_data={"price_history": [], "financial_metrics": []},
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/quality-stocks/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["count"], 1)
        self.assertEqual(response.json()["quality_stocks"][0]["id"], own_report.id)

        detail_response = self.client.get(f"/api/quality-stocks/{own_report.id + 999}/")
        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)

    @mock.patch("quality_stocks.services._analyze_with_llm")
    @mock.patch("quality_stocks.services.predict_portfolio")
    def test_generate_flow_persists_quality_report(self, predict_portfolio_mock, analyze_mock):
        predict_portfolio_mock.return_value = self._forecast_payload(self.user_stock, predicted_price=235.0)
        analyze_mock.return_value = (
            {
                "symbol": "ALPHA.NS",
                "ai_rating": 82.5,
                "signal": "BUY",
                "justification": "Quality setup looks strong.",
                "risks": ["Valuation could compress.", "Trend may cool off."],
                "catalysts": ["Earnings beat.", "Sector tailwind."],
                "key_metrics_summary": "Strong price trend and supportive valuation.",
            },
            "deepseek",
            "deepseek-chat",
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/quality-stocks/generate/",
            {
                "portfolio_id": self.portfolio.id,
                "stock_ids": [self.stock.id],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["count"], 1)
        saved = QualityStock.objects.get(portfolio=self.portfolio, stock=self.stock)
        self.assertAlmostEqual(saved.ai_rating, 82.5)
        self.assertEqual(saved.buy_signal, QualityStock.BuySignal.BUY)
        self.assertEqual(saved.report_json["provider"], "deepseek")

    @mock.patch("quality_stocks.services._analyze_with_llm", side_effect=RuntimeError("provider down"))
    @mock.patch("quality_stocks.services.predict_portfolio")
    def test_generate_uses_deterministic_fallback_when_llm_fails(self, predict_portfolio_mock, _analyze_mock):
        predict_portfolio_mock.return_value = self._forecast_payload(self.user_stock, predicted_price=225.0)

        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/quality-stocks/generate/",
            {
                "portfolio_id": self.portfolio.id,
                "stock_ids": [self.stock.id],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        saved = QualityStock.objects.get(portfolio=self.portfolio, stock=self.stock)
        self.assertEqual(saved.report_json["provider"], "deterministic-fallback")
        self.assertIn(
            saved.buy_signal,
            {
                QualityStock.BuySignal.BUY,
                QualityStock.BuySignal.HOLD,
                QualityStock.BuySignal.SELL,
            },
        )

    def test_detail_normalizes_legacy_revenue_to_billions(self):
        quality_stock = QualityStock.objects.create(
            portfolio=self.portfolio,
            stock=self.stock,
            ai_rating=74.0,
            buy_signal=QualityStock.BuySignal.HOLD,
            report_json={
                "symbol": "ALPHA.NS",
                "ai_rating": 74.0,
                "signal": "HOLD",
                "justification": "Legacy revenue normalization test.",
                "risks": ["Risk 1", "Risk 2"],
                "catalysts": ["Catalyst 1", "Catalyst 2"],
                "key_metrics_summary": "Summary",
                "provider": "deterministic-fallback",
                "model_used": "deterministic-fallback",
            },
            graphs_data={
                "price_history": [{"date": "2026-01-01", "close": 123.4}],
                "financial_metrics": [
                    {"label": "Revenue", "value": 12_500_000_000, "unit": None},
                    {"label": "PE", "value": 18.5, "unit": None},
                ],
            },
        )

        detail = get_quality_stock_detail(self.user, quality_stock.id)
        revenue_metric = next(
            metric
            for metric in detail["graphs_data"]["financial_metrics"]
            if metric["label"] == "Revenue (B)"
        )

        self.assertEqual(revenue_metric["unit"], "B")
        self.assertEqual(revenue_metric["value"], 12.5)
