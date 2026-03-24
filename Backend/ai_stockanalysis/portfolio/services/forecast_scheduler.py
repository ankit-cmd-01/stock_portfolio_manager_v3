import logging
import os
import time

try:
    from apscheduler.schedulers.background import BackgroundScheduler as APSBackgroundScheduler
except ImportError:  # pragma: no cover - fallback for local development without the package
    APSBackgroundScheduler = None

try:
    from django_apscheduler.jobstores import DjangoJobStore
except ImportError:  # pragma: no cover - fallback for local development without the package
    class DjangoJobStore:  # type: ignore[override]
        def __init__(self, *args, **kwargs):
            pass

from .forecast_service import train_all_stock_models

logger = logging.getLogger(__name__)


class _FallbackBackgroundScheduler:
    def __init__(self):
        self._jobs = {}
        self._running = False
        self._thread = None

    def add_jobstore(self, *_args, **_kwargs):
        return None

    def add_job(self, func, trigger="interval", minutes=1440, id=None, replace_existing=True, max_instances=1):
        if id is None:
            id = func.__name__
        if replace_existing or id not in self._jobs:
            self._jobs[id] = {
                "func": func,
                "interval": max(60, int(minutes * 60)),
                "next_run": time.time(),
            }

    def _run_loop(self):
        import threading

        while self._running:
            now = time.time()
            for job in self._jobs.values():
                if now >= job["next_run"]:
                    threading.Thread(target=job["func"], daemon=True).start()
                    job["next_run"] = time.time() + job["interval"]
            time.sleep(5)

    def start(self):
        if self._running:
            return
        import threading

        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()


def _scheduler_factory():
    if APSBackgroundScheduler is not None:
        return APSBackgroundScheduler()
    return _FallbackBackgroundScheduler()


def retrain_all_forecasts():
    try:
        result = train_all_stock_models()
        logger.info(
            "Portfolio forecast retraining completed: trained=%s skipped=%s failed=%s",
            result["trained_count"],
            result["skipped_count"],
            result["failed_count"],
        )
    except Exception as exc:  # pragma: no cover - runtime scheduler path
        logger.warning("Portfolio forecast retraining failed: %s", exc)


def start_scheduler():
    scheduler = _scheduler_factory()
    scheduler.add_jobstore(DjangoJobStore(), "default")
    scheduler.add_job(
        retrain_all_forecasts,
        trigger="interval",
        minutes=max(60, int(os.environ.get("FORECAST_RETRAIN_MINUTES", "1440"))),
        id="portfolio_forecast_retrain",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()
    logger.info("Portfolio forecast scheduler started.")
