from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone

import pandas as pd
import yfinance as yf
from django.db import transaction

from metals.models import GoldPrice, SilverPrice, SyncLog

from .eda_pipeline import run_eda

METAL_CONFIG = {
    "gold": {"ticker": "GC=F", "model": GoldPrice},
    "silver": {"ticker": "SI=F", "model": SilverPrice},
}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _get_model(metal: str):
    if metal not in METAL_CONFIG:
        raise ValueError("Metal must be 'gold' or 'silver'.")
    return METAL_CONFIG[metal]["model"]


def _get_ticker(metal: str) -> str:
    if metal not in METAL_CONFIG:
        raise ValueError("Metal must be 'gold' or 'silver'.")
    return METAL_CONFIG[metal]["ticker"]


def _normalize_frame(df: pd.DataFrame) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame()

    data = df.copy()
    if getattr(data.columns, "nlevels", 1) > 1:
        data.columns = data.columns.get_level_values(0)

    data = data.sort_index()
    data.index = pd.to_datetime(data.index, utc=True)
    data = data[~data.index.duplicated(keep="last")]

    required_columns = ["Open", "High", "Low", "Close", "Volume"]
    if not set(required_columns).issubset(data.columns):
        missing = ", ".join(sorted(set(required_columns) - set(data.columns)))
        raise ValueError(f"Missing required price columns: {missing}")

    ordered_columns = required_columns + [column for column in data.columns if column not in required_columns]
    return data[ordered_columns]


def get_last_timestamp(metal: str) -> datetime | None:
    model = _get_model(metal)
    return model.objects.order_by("-timestamp").values_list("timestamp", flat=True).first()


def get_last_sync_time(metal: str) -> datetime | None:
    return (
        SyncLog.objects.filter(metal=metal, status="success")
        .order_by("-sync_time")
        .values_list("sync_time", flat=True)
        .first()
    )


def _download_window(ticker: str, start: datetime, end: datetime) -> pd.DataFrame:
    frame = yf.download(
        ticker,
        start=start,
        end=end,
        interval="1h",
        auto_adjust=False,
        progress=False,
        threads=False,
    )
    return _normalize_frame(frame)


def fetch_initial_data(metal: str) -> pd.DataFrame:
    ticker = _get_ticker(metal)
    end = _utc_now()
    chunks: list[pd.DataFrame] = []

    for _ in range(12):
        start = end - timedelta(days=30)
        window = _download_window(ticker, start, end)
        if not window.empty:
            chunks.append(window)
        end = start
        time.sleep(1)

    if not chunks:
        return pd.DataFrame()

    combined = pd.concat(chunks).sort_index()
    combined = combined[~combined.index.duplicated(keep="last")]
    return combined


def fetch_incremental_data(metal: str, from_dt: datetime, to_dt: datetime) -> pd.DataFrame:
    ticker = _get_ticker(metal)
    return _download_window(ticker, from_dt, to_dt)


def _row_to_model_kwargs(row) -> dict:
    return {
        "timestamp": pd.Timestamp(row.Index).to_pydatetime(),
        "open": float(row.Open),
        "high": float(row.High),
        "low": float(row.Low),
        "close": float(row.Close),
        "volume": int(row.Volume),
        "sma_20": None if pd.isna(getattr(row, "sma_20", None)) else float(row.sma_20),
        "sma_50": None if pd.isna(getattr(row, "sma_50", None)) else float(row.sma_50),
        "ema_20": None if pd.isna(getattr(row, "ema_20", None)) else float(row.ema_20),
        "rsi_14": None if pd.isna(getattr(row, "rsi_14", None)) else float(row.rsi_14),
        "bb_upper": None if pd.isna(getattr(row, "bb_upper", None)) else float(row.bb_upper),
        "bb_lower": None if pd.isna(getattr(row, "bb_lower", None)) else float(row.bb_lower),
        "macd": None if pd.isna(getattr(row, "macd", None)) else float(row.macd),
        "signal": None if pd.isna(getattr(row, "signal", None)) else float(row.signal),
        "atr_14": None if pd.isna(getattr(row, "atr_14", None)) else float(row.atr_14),
        "obv": None if pd.isna(getattr(row, "obv", None)) else float(row.obv),
    }


def bulk_upsert(metal: str, df: pd.DataFrame) -> int:
    if df.empty:
        return 0

    model = _get_model(metal)
    timestamps = [pd.Timestamp(index).to_pydatetime() for index in df.index]
    existing_timestamps = set(model.objects.filter(timestamp__in=timestamps).values_list("timestamp", flat=True))

    records = []
    for row in df.itertuples():
        timestamp = pd.Timestamp(row.Index).to_pydatetime()
        if timestamp in existing_timestamps:
            continue
        records.append(model(**_row_to_model_kwargs(row)))

    if not records:
        return 0

    with transaction.atomic():
        model.objects.bulk_create(records, batch_size=500)

    return len(records)


def _save_sync_log(
    metal: str,
    status: str,
    message: str,
    rows_added: int = 0,
    last_ts_before: datetime | None = None,
    last_ts_after: datetime | None = None,
):
    SyncLog.objects.create(
        metal=metal,
        status=status,
        message=message,
        rows_added=rows_added,
        last_ts_before=last_ts_before,
        last_ts_after=last_ts_after,
    )


def run_sync(metal: str, force_initial: bool = False) -> dict:
    if metal not in METAL_CONFIG:
        raise ValueError("Metal must be 'gold' or 'silver'.")

    last_ts = get_last_timestamp(metal)
    now = _utc_now()

    try:
        if force_initial or last_ts is None:
            raw_df = fetch_initial_data(metal)
            if raw_df.empty:
                message = "No initial market data returned."
                _save_sync_log(metal, "skipped", message, 0, last_ts, last_ts)
                return {"status": "skipped", "rows_added": 0, "message": message}

            cleaned_df, report = run_eda(raw_df, metal, "initial")
            rows_added = bulk_upsert(metal, cleaned_df)
            current_last_ts = get_last_timestamp(metal)
            _save_sync_log(
                metal,
                "success",
                f"Initial sync completed with {rows_added} new rows.",
                rows_added,
                last_ts,
                current_last_ts,
            )
            return {
                "status": "success",
                "rows_added": rows_added,
                "message": "Initial sync completed.",
                "report": report,
            }

        if now - last_ts <= timedelta(hours=1):
            message = "Data up to date."
            _save_sync_log(metal, "skipped", message, 0, last_ts, last_ts)
            return {"status": "skipped", "rows_added": 0, "message": message}

        from_dt = last_ts + timedelta(hours=1)
        raw_df = fetch_incremental_data(metal, from_dt, now)
        if raw_df.empty:
            message = "No incremental rows returned."
            _save_sync_log(metal, "skipped", message, 0, last_ts, last_ts)
            return {"status": "skipped", "rows_added": 0, "message": message}

        cleaned_df, report = run_eda(raw_df, metal, "incremental")
        rows_added = bulk_upsert(metal, cleaned_df)
        current_last_ts = get_last_timestamp(metal)

        if rows_added == 0:
            message = "No new rows to persist."
            _save_sync_log(metal, "skipped", message, 0, last_ts, current_last_ts)
            return {"status": "skipped", "rows_added": 0, "message": message}

        _save_sync_log(
            metal,
            "success",
            f"Incremental sync completed with {rows_added} new rows.",
            rows_added,
            last_ts,
            current_last_ts,
        )
        return {
            "status": "success",
            "rows_added": rows_added,
            "message": "Incremental sync completed.",
            "report": report,
        }
    except Exception as exc:
        _save_sync_log(metal, "error", str(exc), 0, last_ts, last_ts)
        return {"status": "error", "rows_added": 0, "message": str(exc)}
