from django.core.management.base import BaseCommand

from portfolio.services.forecast_service import train_all_stock_models
from user_stock.models import UserStock


class Command(BaseCommand):
    help = "Train Random Forest forecast models for tracked user stocks."

    def add_arguments(self, parser):
        parser.add_argument("--portfolio-id", type=int, help="Only train models for a single portfolio.")
        parser.add_argument("--user-stock-id", type=int, help="Only train a single user stock model.")

    def handle(self, *args, **options):
        queryset = UserStock.objects.select_related("stock", "portfolio")
        if options["portfolio_id"]:
            queryset = queryset.filter(portfolio_id=options["portfolio_id"])
        if options["user_stock_id"]:
            queryset = queryset.filter(pk=options["user_stock_id"])

        result = train_all_stock_models(queryset)
        self.stdout.write(
            self.style.SUCCESS(
                "Forecast training finished: "
                f"trained={result['trained_count']} "
                f"skipped={result['skipped_count']} "
                f"failed={result['failed_count']}"
            )
        )
