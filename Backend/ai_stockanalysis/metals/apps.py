import logging
import os
import threading

from django.apps import AppConfig
from django.conf import settings

logger = logging.getLogger(__name__)
_scheduler_started = False


class MetalsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "metals"

    def ready(self):
        global _scheduler_started

        if _scheduler_started:
            return

        run_main = os.environ.get("RUN_MAIN") == "true"
        scheduler_enabled = os.environ.get("METALS_ENABLE_SCHEDULER") == "1"

        if settings.DEBUG and not run_main:
            return

        if not run_main and not scheduler_enabled:
            return

        if os.environ.get("METALS_DISABLE_SCHEDULER") == "1":
            logger.info("Metals scheduler disabled via METALS_DISABLE_SCHEDULER.")
            return

        try:
            from .services.scheduler import start_scheduler, sync_all_metals

            start_scheduler()
            threading.Thread(target=sync_all_metals, daemon=True).start()
            _scheduler_started = True
            logger.info("Metals scheduler bootstrapped.")
        except Exception as exc:
            logger.warning("Metals scheduler could not start: %s", exc)
