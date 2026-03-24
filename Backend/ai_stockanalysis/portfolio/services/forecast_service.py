from __future__ import annotations

import logging
import pickle
import re
import threading
from pathlib import Path

import numpy as np
import pandas as pd
from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from portfolio.models import Portfolio
from user_stock.models import UserStock, UserStockData

logger = logging.getLogger(__name__)

FEATURE_COLUMNS = [
    "close",
    "volume",
    "ma_10",
    "ma_50",
    "return_1",
    "return_3",
    "volatility_10",
    "volatility_24",
    "rsi_14",
    "lag_close_1",
    "lag_close_3",
    "lag_volume_1",
]
MIN_TRAINING_ROWS = 120
MODEL_CACHE = {}
MODEL_CACHE_LOCK = threading.Lock()


def _import_sklearn():
    try:
        from sklearn.ensemble import RandomForestRegressor
        from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error, mean_squared_error
        from sklearn.model_selection import ParameterGrid, TimeSeriesSplit
    except ImportError as exc:  # pragma: no cover - depends on local environment
        raise RuntimeError(
            "scikit-learn is required for portfolio forecasting. Install project dependencies first."
        ) from exc

    return {
        "RandomForestRegressor": RandomForestRegressor,
        "mean_absolute_error": mean_absolute_error,
        "mean_absolute_percentage_error": mean_absolute_percentage_error,
        "mean_squared_error": mean_squared_error,
        "ParameterGrid": ParameterGrid,
        "TimeSeriesSplit": TimeSeriesSplit,
    }


def _forecast_model_dir() -> Path:
    model_dir = settings.BASE_DIR / ".cache" / "portfolio_forecasts"
    model_dir.mkdir(parents=True, exist_ok=True)
    return model_dir


def _safe_symbol(symbol: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", symbol or "unknown")


def _model_path(user_stock: UserStock) -> Path:
    symbol = user_stock.stock.yahoo_ticker or user_stock.stock.ticker or f"stock_{user_stock.stock_id}"
    return _forecast_model_dir() / f"user_stock_{user_stock.pk}_{_safe_symbol(symbol)}.pkl"


def _load_history_frame(user_stock: UserStock) -> pd.DataFrame:
    rows = list(
        UserStockData.objects.filter(user_stock=user_stock)
        .order_by("timestamp")
        .values("timestamp", "close", "volume")
    )
    if not rows:
        return pd.DataFrame(columns=["timestamp", "close", "volume"])

    frame = pd.DataFrame(rows)
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True)
    frame["close"] = pd.to_numeric(frame["close"], errors="coerce")
    frame["volume"] = pd.to_numeric(frame["volume"], errors="coerce")
    frame = frame.dropna(subset=["close", "volume"]).sort_values("timestamp").reset_index(drop=True)
    return frame


def _compute_rsi(close_series: pd.Series, period: int = 14) -> pd.Series:
    delta = close_series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(period).mean()
    avg_loss = loss.rolling(period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(50)


def _engineer_feature_frame(history_frame: pd.DataFrame) -> pd.DataFrame:
    if history_frame.empty:
        return history_frame.copy()

    feature_frame = history_frame.copy()
    feature_frame["ma_10"] = feature_frame["close"].rolling(10).mean()
    feature_frame["ma_50"] = feature_frame["close"].rolling(50).mean()
    feature_frame["return_1"] = feature_frame["close"].pct_change()
    feature_frame["return_3"] = feature_frame["close"].pct_change(3)
    feature_frame["volatility_10"] = feature_frame["return_1"].rolling(10).std()
    feature_frame["volatility_24"] = feature_frame["return_1"].rolling(24).std()
    feature_frame["rsi_14"] = _compute_rsi(feature_frame["close"], period=14)
    feature_frame["lag_close_1"] = feature_frame["close"].shift(1)
    feature_frame["lag_close_3"] = feature_frame["close"].shift(3)
    feature_frame["lag_volume_1"] = feature_frame["volume"].shift(1)
    return feature_frame


def _prepare_training_frame(history_frame: pd.DataFrame) -> pd.DataFrame:
    training_frame = _engineer_feature_frame(history_frame)
    if training_frame.empty:
        return training_frame

    training_frame["target_next_close"] = training_frame["close"].shift(-1)
    return training_frame.dropna(subset=FEATURE_COLUMNS + ["target_next_close"]).reset_index(drop=True)


def _prepare_latest_feature_vector(history_frame: pd.DataFrame) -> pd.DataFrame:
    feature_frame = _engineer_feature_frame(history_frame)
    feature_frame = feature_frame.dropna(subset=FEATURE_COLUMNS).reset_index(drop=True)
    if feature_frame.empty:
        raise ValueError("Not enough clean rows to build prediction features.")
    return feature_frame.iloc[[-1]][FEATURE_COLUMNS]


def _validation_window_size(training_frame: pd.DataFrame) -> int:
    return min(max(24, len(training_frame) // 5), 120)


def _time_series_splits(train_size: int) -> int:
    if train_size < 60:
        return 2
    return min(5, max(2, train_size // 60))


def _score_params(train_frame: pd.DataFrame):
    sklearn = _import_sklearn()
    RandomForestRegressor = sklearn["RandomForestRegressor"]
    ParameterGrid = sklearn["ParameterGrid"]
    TimeSeriesSplit = sklearn["TimeSeriesSplit"]
    mean_squared_error = sklearn["mean_squared_error"]

    x_train = train_frame[FEATURE_COLUMNS]
    y_train = train_frame["target_next_close"]
    n_splits = _time_series_splits(len(train_frame))
    splitter = TimeSeriesSplit(n_splits=n_splits)
    param_grid = ParameterGrid(
        {
            "n_estimators": [100, 150],
            "max_depth": [4, 6, 8],
            "min_samples_split": [8, 12],
            "min_samples_leaf": [3, 5],
        }
    )

    best_params = None
    best_rmse = float("inf")
    for params in param_grid:
        fold_scores = []
        for split_train_idx, split_test_idx in splitter.split(x_train):
            fold_model = RandomForestRegressor(
                random_state=42,
                n_jobs=-1,
                **params,
            )
            fold_model.fit(x_train.iloc[split_train_idx], y_train.iloc[split_train_idx])
            fold_predictions = fold_model.predict(x_train.iloc[split_test_idx])
            fold_rmse = float(
                np.sqrt(mean_squared_error(y_train.iloc[split_test_idx], fold_predictions))
            )
            fold_scores.append(fold_rmse)

        avg_rmse = float(np.mean(fold_scores))
        if avg_rmse < best_rmse:
            best_rmse = avg_rmse
            best_params = params

    return best_params or {
        "n_estimators": 100,
        "max_depth": 6,
        "min_samples_split": 8,
        "min_samples_leaf": 3,
    }, best_rmse


def train_stock_model(user_stock: UserStock) -> dict:
    sklearn = _import_sklearn()
    RandomForestRegressor = sklearn["RandomForestRegressor"]
    mean_absolute_error = sklearn["mean_absolute_error"]
    mean_absolute_percentage_error = sklearn["mean_absolute_percentage_error"]
    mean_squared_error = sklearn["mean_squared_error"]

    history_frame = _load_history_frame(user_stock)
    training_frame = _prepare_training_frame(history_frame)
    if len(training_frame) < MIN_TRAINING_ROWS:
        raise ValueError(
            f"Not enough training rows for {(user_stock.stock.yahoo_ticker or user_stock.stock.ticker)}."
        )

    validation_size = _validation_window_size(training_frame)
    if len(training_frame) - validation_size < 60:
        raise ValueError(
            f"Not enough rows to create a stable time-series validation split for {(user_stock.stock.yahoo_ticker or user_stock.stock.ticker)}."
        )

    train_frame = training_frame.iloc[:-validation_size].reset_index(drop=True)
    validation_frame = training_frame.iloc[-validation_size:].reset_index(drop=True)
    best_params, cv_rmse = _score_params(train_frame)

    eval_model = RandomForestRegressor(
        random_state=42,
        n_jobs=-1,
        **best_params,
    )
    eval_model.fit(train_frame[FEATURE_COLUMNS], train_frame["target_next_close"])
    validation_predictions = eval_model.predict(validation_frame[FEATURE_COLUMNS])
    validation_rmse = float(
        np.sqrt(mean_squared_error(validation_frame["target_next_close"], validation_predictions))
    )
    validation_mae = float(
        mean_absolute_error(validation_frame["target_next_close"], validation_predictions)
    )
    validation_mape = float(
        mean_absolute_percentage_error(
            validation_frame["target_next_close"],
            validation_predictions,
        )
        * 100
    )

    final_model = RandomForestRegressor(
        random_state=42,
        n_jobs=-1,
        **best_params,
    )
    final_model.fit(training_frame[FEATURE_COLUMNS], training_frame["target_next_close"])

    artifact = {
        "model": final_model,
        "feature_columns": FEATURE_COLUMNS,
        "best_params": best_params,
        "metrics": {
            "cv_rmse": round(cv_rmse, 4),
            "validation_rmse": round(validation_rmse, 4),
            "validation_mae": round(validation_mae, 4),
            "validation_mape": round(validation_mape, 4),
        },
        "trained_at": timezone.now().isoformat(),
        "latest_training_timestamp": history_frame["timestamp"].iloc[-1].isoformat(),
        "data_points": int(len(training_frame)),
        "user_stock_id": user_stock.pk,
        "symbol": user_stock.stock.yahoo_ticker or user_stock.stock.ticker,
        "stock_name": user_stock.stock.stock_name,
    }

    model_path = _model_path(user_stock)
    with model_path.open("wb") as handle:
        pickle.dump(artifact, handle)

    with MODEL_CACHE_LOCK:
        MODEL_CACHE.pop(str(model_path), None)

    return {
        "user_stock_id": user_stock.pk,
        "symbol": artifact["symbol"],
        "stock_name": artifact["stock_name"],
        "model_path": str(model_path),
        "trained_at": artifact["trained_at"],
        "metrics": artifact["metrics"],
        "data_points": artifact["data_points"],
    }


def train_all_stock_models(user_stocks=None) -> dict:
    queryset = user_stocks
    if queryset is None:
        queryset = UserStock.objects.select_related("stock", "portfolio").all()

    trained = []
    skipped = []
    failed = []

    for user_stock in queryset:
        try:
            trained.append(train_stock_model(user_stock))
        except ValueError as exc:
            skipped.append(
                {
                    "user_stock_id": user_stock.pk,
                    "symbol": user_stock.stock.yahoo_ticker or user_stock.stock.ticker,
                    "reason": str(exc),
                }
            )
        except Exception as exc:  # pragma: no cover - unexpected ML/runtime issue
            logger.exception("Forecast training failed for user_stock=%s", user_stock.pk)
            failed.append(
                {
                    "user_stock_id": user_stock.pk,
                    "symbol": user_stock.stock.yahoo_ticker or user_stock.stock.ticker,
                    "reason": str(exc),
                }
            )

    return {
        "trained_count": len(trained),
        "skipped_count": len(skipped),
        "failed_count": len(failed),
        "trained": trained,
        "skipped": skipped,
        "failed": failed,
    }


def _load_model_artifact(user_stock: UserStock) -> dict:
    model_path = _model_path(user_stock)
    if not model_path.exists():
        raise FileNotFoundError(f"Forecast model not found for {user_stock.pk}.")

    cache_key = str(model_path)
    modified_at = model_path.stat().st_mtime
    with MODEL_CACHE_LOCK:
        cached = MODEL_CACHE.get(cache_key)
        if cached and cached["mtime"] == modified_at:
            return cached["artifact"]

    with model_path.open("rb") as handle:
        artifact = pickle.load(handle)

    model = artifact.get("model")
    if model is not None:
        try:
            params = model.get_params()
        except Exception:  # pragma: no cover - defensive for unrecognized estimators
            params = {}
        if "n_jobs" in params:
            model.set_params(n_jobs=1)

    with MODEL_CACHE_LOCK:
        MODEL_CACHE[cache_key] = {
            "mtime": modified_at,
            "artifact": artifact,
        }

    return artifact


def _predict_user_stock(user_stock: UserStock) -> dict:
    symbol = user_stock.stock.yahoo_ticker or user_stock.stock.ticker
    history_frame = _load_history_frame(user_stock)
    if history_frame.empty:
        raise ValueError(f"No historical data available for {symbol}.")

    current_price = float(history_frame["close"].iloc[-1])
    quantity = float(user_stock.quantity)
    current_value = current_price * quantity

    try:
        artifact = _load_model_artifact(user_stock)
        latest_features = _prepare_latest_feature_vector(history_frame)
        predicted_price = float(artifact["model"].predict(latest_features)[0])
        predicted_price = max(predicted_price, 0.0)
        model_status = "ready"
        metrics = artifact.get("metrics", {})
        trained_at = artifact.get("trained_at")
    except (FileNotFoundError, ValueError):
        predicted_price = current_price
        model_status = "fallback_current_price"
        metrics = {}
        trained_at = None

    predicted_value = predicted_price * quantity
    growth_pct = ((predicted_value - current_value) / current_value * 100) if current_value else 0.0

    return {
        "user_stock_id": user_stock.pk,
        "symbol": symbol,
        "stock_name": user_stock.stock.stock_name,
        "quantity": round(quantity, 4),
        "current_price": round(current_price, 4),
        "predicted_price": round(predicted_price, 4),
        "current_value": round(current_value, 4),
        "predicted_value": round(predicted_value, 4),
        "growth_pct": round(growth_pct, 4),
        "model_status": model_status,
        "trained_at": trained_at,
        "metrics": metrics,
    }


def predict_stock_price(symbol: str) -> dict:
    user_stock = (
        UserStock.objects.select_related("stock", "portfolio")
        .filter(Q(stock__ticker__iexact=symbol) | Q(stock__yahoo_ticker__iexact=symbol))
        .order_by("-modified_at")
        .first()
    )
    if user_stock is None:
        raise ValueError(f"No tracked stock found for symbol: {symbol}")
    return _predict_user_stock(user_stock)


def predict_portfolio(portfolio_id: int) -> dict:
    portfolio = Portfolio.objects.filter(pk=portfolio_id).first()
    if portfolio is None:
        raise ValueError("Portfolio not found.")

    user_stocks = list(
        UserStock.objects.filter(portfolio_id=portfolio_id)
        .select_related("stock", "portfolio")
        .order_by("stock__stock_name", "stock__ticker")
    )
    if not user_stocks:
        return {
            "portfolio_id": portfolio.id,
            "portfolio_title": portfolio.title,
            "current_value": 0.0,
            "predicted_value": 0.0,
            "growth_pct": 0.0,
            "stock_predictions": [],
        }

    stock_predictions = [_predict_user_stock(user_stock) for user_stock in user_stocks]
    current_value = sum(item["current_value"] for item in stock_predictions)
    predicted_value = sum(item["predicted_value"] for item in stock_predictions)
    growth_pct = ((predicted_value - current_value) / current_value * 100) if current_value else 0.0

    return {
        "portfolio_id": portfolio.id,
        "portfolio_title": portfolio.title,
        "current_value": round(current_value, 4),
        "predicted_value": round(predicted_value, 4),
        "growth_pct": round(growth_pct, 4),
        "stock_predictions": stock_predictions,
    }
