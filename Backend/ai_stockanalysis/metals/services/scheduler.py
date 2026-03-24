import logging
import threading
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

logger = logging.getLogger(__name__)


class _FallbackBackgroundScheduler:
    def __init__(self):
        self._jobs = {}
        self._running = False
        self._thread = None

    def add_jobstore(self, *_args, **_kwargs):
        return None

    def add_job(self, func, trigger="interval", minutes=30, id=None, replace_existing=True, max_instances=1):
        if id is None:
            id = func.__name__
        if replace_existing or id not in self._jobs:
            self._jobs[id] = {
                "func": func,
                "interval": max(1, int(minutes * 60)),
                "next_run": time.time(),
            }

    def _run_loop(self):
        while self._running:
            now = time.time()
            for job in self._jobs.values():
                if now >= job["next_run"]:
                    try:
                        job["func"]()
                    except Exception as exc:
                        logger.warning("Fallback scheduler job failed: %s", exc)
                    finally:
                        job["next_run"] = time.time() + job["interval"]
            time.sleep(5)

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()


def _scheduler_factory():
    if APSBackgroundScheduler is not None:
        return APSBackgroundScheduler()
    return _FallbackBackgroundScheduler()


def sync_all_metals():
    from .data_fetcher import run_sync

    for metal in ("gold", "silver"):
        try:
            run_sync(metal)
        except Exception as exc:
            logger.warning("Scheduled sync failed for %s: %s", metal, exc)


def start_scheduler():
    scheduler = _scheduler_factory()
    scheduler.add_jobstore(DjangoJobStore(), "default")
    scheduler.add_job(
        sync_all_metals,
        trigger="interval",
        minutes=30,
        id="metals_sync",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()
    logger.info("Metals scheduler started.")
