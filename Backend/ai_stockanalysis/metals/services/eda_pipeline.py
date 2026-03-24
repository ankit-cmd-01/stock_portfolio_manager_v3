import json
from math import isfinite

import numpy as np
import pandas as pd

from .indicators import add_all_indicators

try:
    from scipy.stats import kurtosis, skew, zscore
except ImportError:  # pragma: no cover - fallback when scipy is unavailable
    def skew(values, bias=False):
        series = np.asarray(values, dtype=float)
        series = series[np.isfinite(series)]
        if series.size < 3:
            return 0.0
        mean = series.mean()
        std = series.std(ddof=0)
        if std == 0:
            return 0.0
        centered = (series - mean) / std
        return float(np.mean(centered**3))

    def kurtosis(values, bias=False):
        series = np.asarray(values, dtype=float)
        series = series[np.isfinite(series)]
        if series.size < 4:
            return 0.0
        mean = series.mean()
        std = series.std(ddof=0)
        if std == 0:
            return 0.0
        centered = (series - mean) / std
        return float(np.mean(centered**4) - 3.0)

    def zscore(values, nan_policy="omit"):
        series = np.asarray(values, dtype=float)
        valid = series[np.isfinite(series)]
        if valid.size == 0:
            return np.asarray([], dtype=float)
        mean = valid.mean()
        std = valid.std(ddof=0)
        if std == 0:
            return np.zeros_like(series, dtype=float)
        return (series - mean) / std

try:
    from statsmodels.tsa.stattools import adfuller
except ImportError:  # pragma: no cover - fallback when statsmodels is unavailable
    def adfuller(values):
        series = np.asarray(values, dtype=float)
        series = series[np.isfinite(series)]
        if series.size < 5:
            raise ValueError("Not enough data for ADF fallback")
        return 0.0, 1.0, 0, series.size, {}, 0.0

PRICE_COLUMNS = ["Open", "High", "Low", "Close", "Volume"]


def _ensure_jsonable(value):
    if isinstance(value, dict):
        return {key: _ensure_jsonable(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_ensure_jsonable(item) for item in value]
    if isinstance(value, tuple):
        return [_ensure_jsonable(item) for item in value]
    if isinstance(value, (pd.Timestamp, np.datetime64)):
        return pd.Timestamp(value).isoformat()
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, float) and not isfinite(value):
        return None
    return value


def compute_descriptive_stats(df: pd.DataFrame) -> dict:
    stats = {}
    for column in PRICE_COLUMNS:
        series = df[column].dropna()
        if series.empty:
            stats[column] = {
                "mean": None,
                "median": None,
                "std": None,
                "min": None,
                "max": None,
                "skewness": None,
                "kurtosis": None,
            }
            continue

        stats[column] = {
            "mean": round(float(series.mean()), 4),
            "median": round(float(series.median()), 4),
            "std": round(float(series.std(ddof=0)), 4),
            "min": round(float(series.min()), 4),
            "max": round(float(series.max()), 4),
            "skewness": round(float(skew(series, bias=False)), 4) if len(series) > 2 else 0.0,
            "kurtosis": round(float(kurtosis(series, bias=False)), 4) if len(series) > 3 else 0.0,
        }
    return stats


def handle_missing(df: pd.DataFrame, report: dict) -> pd.DataFrame:
    before_missing = int(df[PRICE_COLUMNS].isna().sum().sum())
    df = df.sort_index().copy()
    df = df.ffill(limit=3)
    dropped = int(df["Close"].isna().sum())
    df = df.dropna(subset=["Close"])
    after_missing = int(df[PRICE_COLUMNS].isna().sum().sum())
    report["missing_filled"] = max(0, before_missing - after_missing - dropped)
    report["missing_dropped"] = dropped
    return df


def detect_and_cap_outliers(df: pd.DataFrame):
    capped_total = 0
    outliers = {}
    capped_df = df.copy()

    for column in PRICE_COLUMNS:
        series = capped_df[column].astype(float)
        if series.dropna().empty:
            outliers[column] = {"iqr_lower": None, "iqr_upper": None, "zscore_outliers": 0, "capped": 0}
            continue

        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr

        clipped = series.clip(lower=lower, upper=upper)
        capped_count = int((clipped != series).sum())
        capped_total += capped_count
        capped_df[column] = clipped

        zscores = zscore(series.fillna(series.mean()), nan_policy="omit")
        zscore_outliers = int(np.sum(np.abs(zscores) > 3)) if len(zscores) else 0

        outliers[column] = {
            "iqr_lower": round(float(lower), 4),
            "iqr_upper": round(float(upper), 4),
            "zscore_outliers": zscore_outliers,
            "capped": capped_count,
        }

    return capped_df, {"columns": outliers, "total_capped": capped_total}


def save_eda_report(metal: str, run_type: str, df: pd.DataFrame, report: dict):
    from metals.models import EDAReport

    payload = report.copy()
    payload.setdefault("rows_before", int(len(df)))
    payload.setdefault("rows_after", int(len(df)))
    payload.setdefault("missing_filled", 0)
    payload.setdefault("missing_dropped", 0)
    payload.setdefault("outliers_capped", 0)
    payload.setdefault("is_stationary", False)
    payload.setdefault("adf_p_value", 1.0)
    payload.setdefault("annualized_vol_pct", 0.0)
    payload.setdefault("mean_close", 0.0)
    payload.setdefault("std_close", 0.0)
    payload.setdefault("skewness", 0.0)
    payload.setdefault("kurtosis", 0.0)

    EDAReport.objects.create(
        metal=metal,
        run_type=run_type,
        rows_before=int(payload.get("rows_before", 0)),
        rows_after=int(payload.get("rows_after", 0)),
        missing_filled=int(payload.get("missing_filled", 0)),
        missing_dropped=int(payload.get("missing_dropped", 0)),
        outliers_capped=int(payload.get("outliers_capped", 0)),
        is_stationary=bool(payload.get("is_stationary", False)),
        adf_p_value=float(payload.get("adf_p_value", 1.0)),
        annualized_vol=float(payload.get("annualized_vol_pct", payload.get("annualized_vol", 0.0))),
        mean_close=float(payload.get("mean_close", 0.0)),
        std_close=float(payload.get("std_close", 0.0)),
        skewness=float(payload.get("skewness", 0.0)),
        kurtosis=float(payload.get("kurtosis", 0.0)),
        correlation_matrix=_ensure_jsonable(payload.get("correlation_matrix", {})),
        full_report=json.loads(json.dumps(_ensure_jsonable(payload), default=str)),
    )


def run_eda(df: pd.DataFrame, metal: str, run_type: str) -> tuple[pd.DataFrame, dict]:
    if df.empty:
        report = {
            "metal": metal,
            "run_type": run_type,
            "rows_before": 0,
            "rows_after": 0,
            "missing_filled": 0,
            "missing_dropped": 0,
            "outliers_capped": 0,
            "is_stationary": False,
            "adf_p_value": 1.0,
            "annualized_vol": 0.0,
            "annualized_vol_pct": 0.0,
            "mean_close": 0.0,
            "std_close": 0.0,
            "skewness": 0.0,
            "kurtosis": 0.0,
            "correlation_matrix": {},
            "full_report": {},
        }
        save_eda_report(metal, run_type, df, report)
        return df, report

    report = {
        "metal": metal,
        "run_type": run_type,
        "rows_before": int(len(df)),
        "date_range_start": pd.Timestamp(df.index.min()).isoformat(),
        "date_range_end": pd.Timestamp(df.index.max()).isoformat(),
    }

    cleaned_df = handle_missing(df.copy(), report)
    report["descriptive_stats"] = compute_descriptive_stats(cleaned_df)

    cleaned_df, outlier_report = detect_and_cap_outliers(cleaned_df)
    report["outliers"] = outlier_report
    report["outliers_capped"] = int(outlier_report["total_capped"])

    report["correlation_matrix"] = (
        cleaned_df[["Open", "High", "Low", "Close", "Volume"]].corr().round(4).to_dict()
    )

    try:
        adf_result = adfuller(cleaned_df["Close"].dropna())
        report["adf_statistic"] = round(float(adf_result[0]), 4)
        report["adf_p_value"] = round(float(adf_result[1]), 6)
        report["is_stationary"] = bool(adf_result[1] < 0.05)
    except Exception:
        report["adf_statistic"] = None
        report["adf_p_value"] = 1.0
        report["is_stationary"] = False

    returns = cleaned_df["Close"].pct_change().dropna()
    if returns.empty:
        report["daily_return_mean"] = 0.0
        report["daily_return_std"] = 0.0
        report["annualized_vol_pct"] = 0.0
    else:
        report["daily_return_mean"] = round(float(returns.mean()), 6)
        report["daily_return_std"] = round(float(returns.std()), 6)
        report["annualized_vol_pct"] = round(float(returns.std() * np.sqrt(252) * 100), 2)
    report["annualized_vol"] = report["annualized_vol_pct"]

    rolling_volatility = returns.rolling(20).std() * np.sqrt(252) * 100 if not returns.empty else pd.Series(dtype=float)
    report["rolling_volatility"] = [
        {
            "timestamp": pd.Timestamp(index).isoformat(),
            "value": round(float(value), 4),
        }
        for index, value in rolling_volatility.dropna().items()
    ]

    cleaned_df = add_all_indicators(cleaned_df)

    report["rows_after"] = int(len(cleaned_df))
    report["mean_close"] = round(float(cleaned_df["Close"].mean()), 4)
    report["std_close"] = round(float(cleaned_df["Close"].std(ddof=0)), 4)
    report["skewness"] = round(float(skew(cleaned_df["Close"].dropna(), bias=False)), 4) if len(cleaned_df) > 2 else 0.0
    report["kurtosis"] = round(float(kurtosis(cleaned_df["Close"].dropna(), bias=False)), 4) if len(cleaned_df) > 3 else 0.0
    report["full_report"] = _ensure_jsonable(report.copy())

    save_eda_report(metal, run_type, cleaned_df, report)
    return cleaned_df, report
