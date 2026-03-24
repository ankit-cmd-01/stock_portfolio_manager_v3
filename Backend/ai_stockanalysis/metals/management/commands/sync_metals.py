from django.core.management.base import BaseCommand, CommandError

from metals.services.data_fetcher import run_sync


class Command(BaseCommand):
    help = "Synchronize gold and silver data from yfinance."

    def add_arguments(self, parser):
        parser.add_argument(
            "--metal",
            choices=["gold", "silver"],
            help="Sync only a single metal.",
        )
        parser.add_argument(
            "--force-initial",
            action="store_true",
            help="Force a full 12-month initial sync.",
        )

    def handle(self, *args, **options):
        metal = options.get("metal")
        force_initial = bool(options.get("force_initial"))

        metals = [metal] if metal else ["gold", "silver"]
        results = {}

        for item in metals:
            try:
                results[item] = run_sync(item, force_initial=force_initial)
            except Exception as exc:
                raise CommandError(str(exc)) from exc

        for metal_name, result in results.items():
            self.stdout.write(
                self.style.SUCCESS(
                    f"{metal_name.title()}: {result.get('status')} ({result.get('rows_added', 0)} rows) - {result.get('message')}"
                )
            )
