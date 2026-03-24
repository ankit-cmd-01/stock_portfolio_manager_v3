from django.core.management.base import BaseCommand
from django.db import transaction

from stock_master.models import StockMaster
from stock_master.yahoo import resolve_yahoo_symbol


class Command(BaseCommand):
    help = "Resolve and store exact Yahoo Finance symbols for stock master rows."

    def add_arguments(self, parser):
        parser.add_argument(
            "--overwrite-ticker",
            action="store_true",
            help="Replace the existing ticker column with the resolved Yahoo symbol.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Optional limit for testing the resolver on a subset.",
        )

    def handle(self, *args, **options):
        qs = StockMaster.objects.all().order_by("stock_name", "ticker")
        if options["limit"] and options["limit"] > 0:
            qs = qs[: options["limit"]]

        updated = 0
        unchanged = 0
        missing = 0

        for stock in qs:
            resolved = resolve_yahoo_symbol(
                stock_name=stock.stock_name,
                ticker=stock.ticker,
                exchange=stock.exchange,
            )
            if not resolved:
                missing += 1
                self.stdout.write(self.style.WARNING(f"MISS  {stock.stock_name} -> {stock.ticker}"))
                continue

            if stock.yahoo_ticker == resolved and (
                not options["overwrite_ticker"] or stock.ticker == resolved
            ):
                unchanged += 1
                self.stdout.write(self.style.SUCCESS(f"OK    {stock.stock_name} -> {resolved}"))
                continue

            stock.yahoo_ticker = resolved
            if options["overwrite_ticker"]:
                stock.ticker = resolved

            with transaction.atomic():
                stock.save(update_fields=["yahoo_ticker"] + (["ticker"] if options["overwrite_ticker"] else []))

            updated += 1
            self.stdout.write(self.style.SUCCESS(f"UPDATE {stock.stock_name} -> {resolved}"))

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. updated={updated}, unchanged={unchanged}, missing={missing}"
            )
        )
