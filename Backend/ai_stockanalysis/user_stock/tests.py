from datetime import datetime, timezone as dt_timezone
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from portfolio.models import Portfolio
from stock_master.models import StockMaster
from user_stock.models import UserStock, UserStockData
from user_stock.services import sync_user_stock_history_if_stale


class UserStockSyncTests(TestCase):
    def setUp(self):
        self.user_model = get_user_model()
        self.user = self.user_model.objects.create_user(
            username="sync_user",
            email="sync@example.com",
            phone_number="+911234567890",
            password="StrongPassword123!",
            is_active=True,
        )
        self.portfolio = Portfolio.objects.create(
            user=self.user,
            title="Core",
            description="Core holdings",
        )
        self.stock = StockMaster.objects.create(
            stock_name="Test Corp",
            ticker="TEST",
            yahoo_ticker="TEST.NS",
            market="Equity",
            exchange="NSE",
        )
        self.user_stock = UserStock.objects.create(
            user=self.user,
            portfolio=self.portfolio,
            stock=self.stock,
        )

    def test_sync_user_stock_history_if_stale_fetches_incremental_rows(self):
        last_timestamp = timezone.make_aware(
            datetime(2026, 3, 24, 10, 0, 0),
            dt_timezone.utc,
        )
        UserStockData.objects.create(
            user_stock=self.user_stock,
            timestamp=last_timestamp,
            open=100,
            high=110,
            low=95,
            close=105,
            volume=1000,
            pe_ratio=10,
        )
        now = timezone.make_aware(
            datetime(2026, 3, 24, 12, 30, 0),
            dt_timezone.utc,
        )

        with mock.patch("user_stock.services.timezone.now", return_value=now), mock.patch(
            "user_stock.services.fetch_and_save_incremental_stock_data",
            return_value=4,
        ) as incremental_sync:
            inserted = sync_user_stock_history_if_stale(
                self.user_stock,
                latest_timestamp=last_timestamp,
            )

        self.assertEqual(inserted, 4)
        incremental_sync.assert_called_once()
        _, kwargs = incremental_sync.call_args
        self.assertEqual(kwargs["latest_timestamp"], last_timestamp)

    def test_sync_user_stock_history_if_stale_skips_recent_rows(self):
        recent_timestamp = timezone.make_aware(
            datetime(2026, 3, 24, 11, 45, 0),
            dt_timezone.utc,
        )
        now = timezone.make_aware(
            datetime(2026, 3, 24, 12, 30, 0),
            dt_timezone.utc,
        )

        with mock.patch("user_stock.services.timezone.now", return_value=now), mock.patch(
            "user_stock.services.fetch_and_save_incremental_stock_data",
        ) as incremental_sync:
            inserted = sync_user_stock_history_if_stale(
                self.user_stock,
                latest_timestamp=recent_timestamp,
            )

        self.assertEqual(inserted, 0)
        incremental_sync.assert_not_called()
