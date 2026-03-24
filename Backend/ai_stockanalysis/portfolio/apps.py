import logging
import os

from django.apps import AppConfig
from django.conf import settings

logger = logging.getLogger(__name__)
_scheduler_started = False


class PortfolioConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "portfolio"

    def ready(self):
        global _scheduler_started

        if _scheduler_started:
            return

        run_main = os.environ.get("RUN_MAIN") == "true"
        scheduler_enabled = os.environ.get("FORECAST_ENABLE_SCHEDULER") == "1"

        if settings.DEBUG and not run_main:
            return

        if not run_main and not scheduler_enabled:
            return

        if os.environ.get("FORECAST_DISABLE_SCHEDULER") == "1":
            logger.info("Portfolio forecast scheduler disabled via FORECAST_DISABLE_SCHEDULER.")
            return

        try:
            from .services.forecast_scheduler import start_scheduler

            start_scheduler()
            _scheduler_started = True
            logger.info("Portfolio forecast scheduler bootstrapped.")
        except Exception as exc:
            logger.warning("Portfolio forecast scheduler could not start: %s", exc)
