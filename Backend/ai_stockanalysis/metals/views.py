from datetime import timedelta, timezone as dt_timezone

import pandas as pd
from django.db import connections
from django.utils.dateparse import parse_datetime
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import EDAReport, GoldPrice, SilverPrice, SyncLog
from .serializers import (
    EDAReportSerializer,
    GoldPriceSerializer,
    GoldSilverRatioSerializer,
    MetalSummarySerializer,
    SilverPriceSerializer,
    SyncLogSerializer,
)
from .services.data_fetcher import get_last_sync_time, run_sync

MODEL_MAP = {
    "gold": GoldPrice,
    "silver": SilverPrice,
}

SERIALIZER_MAP = {
    "gold": GoldPriceSerializer,
    "silver": SilverPriceSerializer,
}


def _validate_metal(metal: str):
    metal = (metal or "").lower().strip()
    if metal not in MODEL_MAP:
        return None, Response({"error": "metal must be 'gold' or 'silver'."}, status=status.HTTP_400_BAD_REQUEST)
    return metal, None


def _parse_datetime_param(value):
    if not value:
        return None
    parsed = parse_datetime(value)
    if parsed is None:
        return None
    if timezone.is_naive(parsed):
        return timezone.make_aware(parsed, dt_timezone.utc)
    return parsed


def _summary_for_metal(metal: str):
    model = MODEL_MAP[metal]
    latest = model.objects.order_by("-timestamp").first()
    if latest is None:
        payload = {
            "metal": metal,
            "current_price": None,
            "prev_close": None,
            "change_1h": None,
            "change_1h_pct": None,
            "change_24h": None,
            "change_24h_pct": None,
            "change_7d": None,
            "change_7d_pct": None,
            "high_52w": None,
            "low_52w": None,
            "rsi_14": None,
            "sma_20": None,
            "sma_50": None,
            "ema_20": None,
            "macd": None,
            "signal": None,
            "bb_upper": None,
            "bb_lower": None,
            "atr_14": None,
            "obv": None,
            "annualized_vol": None,
            "last_updated": None,
        }
        return MetalSummarySerializer(payload).data

    def previous_close(hours: int):
        target = latest.timestamp - timedelta(hours=hours)
        return (
            model.objects.filter(timestamp__lte=target).order_by("-timestamp").first()
            or model.objects.filter(timestamp__lt=latest.timestamp).order_by("-timestamp").first()
        )

    prev_1h = previous_close(1)
    prev_24h = previous_close(24)
    prev_7d = previous_close(24 * 7)
    window_52w = model.objects.filter(timestamp__gte=latest.timestamp - timedelta(days=365))
    closes = list(window_52w.values_list("close", flat=True))
    returns = pd.Series(closes).pct_change().dropna() if len(closes) > 1 else pd.Series(dtype=float)

    def delta(current, previous):
        if current is None or previous is None:
            return None, None
        diff = float(current.close - previous.close)
        pct = None if previous.close == 0 else float((diff / previous.close) * 100)
        return diff, pct

    change_1h, change_1h_pct = delta(latest, prev_1h)
    change_24h, change_24h_pct = delta(latest, prev_24h)
    change_7d, change_7d_pct = delta(latest, prev_7d)

    annualized_vol = None
    if not returns.empty:
        annualized_vol = float(returns.std() * (252 ** 0.5) * 100)

    payload = {
        "metal": metal,
        "current_price": float(latest.close),
        "prev_close": float(prev_1h.close) if prev_1h else None,
        "change_1h": change_1h,
        "change_1h_pct": change_1h_pct,
        "change_24h": change_24h,
        "change_24h_pct": change_24h_pct,
        "change_7d": change_7d,
        "change_7d_pct": change_7d_pct,
        "high_52w": float(max(closes)) if closes else None,
        "low_52w": float(min(closes)) if closes else None,
        "rsi_14": latest.rsi_14,
        "sma_20": latest.sma_20,
        "sma_50": latest.sma_50,
        "ema_20": latest.ema_20,
        "macd": latest.macd,
        "signal": latest.signal,
        "bb_upper": latest.bb_upper,
        "bb_lower": latest.bb_lower,
        "atr_14": latest.atr_14,
        "obv": latest.obv,
        "annualized_vol": annualized_vol,
        "last_updated": latest.timestamp,
    }
    return MetalSummarySerializer(payload).data


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def health_check(request):
    try:
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        db_connected = True
    except Exception:
        db_connected = False

    return Response(
        {
            "status": "ok" if db_connected else "degraded",
            "db_connected": db_connected,
            "gold_last_sync": get_last_sync_time("gold"),
            "silver_last_sync": get_last_sync_time("silver"),
            "gold_total_rows": GoldPrice.objects.count(),
            "silver_total_rows": SilverPrice.objects.count(),
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def trigger_sync(request):
    return Response(
        {
            "gold": run_sync("gold"),
            "silver": run_sync("silver"),
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gold_silver_ratio(request):
    try:
        days = int(request.query_params.get("days", 30))
    except (TypeError, ValueError):
        days = 30
    days = max(1, min(days, 365))

    since = pd.Timestamp.now(tz="UTC") - pd.Timedelta(days=days)
    gold = pd.DataFrame(list(GoldPrice.objects.filter(timestamp__gte=since).values("timestamp", "close")))
    silver = pd.DataFrame(list(SilverPrice.objects.filter(timestamp__gte=since).values("timestamp", "close")))

    if gold.empty or silver.empty:
        payload = {"timestamps": [], "ratios": [], "current_ratio": None, "avg_ratio": None, "min_ratio": None, "max_ratio": None}
        return Response(GoldSilverRatioSerializer(payload).data)

    gold["timestamp"] = pd.to_datetime(gold["timestamp"], utc=True)
    silver["timestamp"] = pd.to_datetime(silver["timestamp"], utc=True)
    merged = pd.merge(gold, silver, on="timestamp", how="inner", suffixes=("_gold", "_silver"))

    if merged.empty:
        payload = {"timestamps": [], "ratios": [], "current_ratio": None, "avg_ratio": None, "min_ratio": None, "max_ratio": None}
        return Response(GoldSilverRatioSerializer(payload).data)

    merged["ratio"] = merged["close_gold"] / merged["close_silver"]
    ratios = merged["ratio"].tolist()
    payload = {
        "timestamps": merged["timestamp"].dt.to_pydatetime().tolist(),
        "ratios": [float(value) for value in ratios],
        "current_ratio": float(ratios[-1]),
        "avg_ratio": float(merged["ratio"].mean()),
        "min_ratio": float(merged["ratio"].min()),
        "max_ratio": float(merged["ratio"].max()),
    }
    return Response(GoldSilverRatioSerializer(payload).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sync_log_list(request):
    metal = (request.query_params.get("metal") or "all").lower()
    try:
        limit = int(request.query_params.get("limit", 20))
    except (TypeError, ValueError):
        limit = 20
    limit = max(1, min(limit, 100))

    queryset = SyncLog.objects.all()
    if metal in {"gold", "silver"}:
        queryset = queryset.filter(metal=metal)
    elif metal != "all":
        return Response({"error": "metal must be gold, silver, or all."}, status=status.HTTP_400_BAD_REQUEST)

    logs = queryset[:limit]
    serializer = SyncLogSerializer(logs, many=True)
    return Response({"count": queryset.count(), "limit": limit, "results": serializer.data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def metal_prices(request, metal):
    metal, error_response = _validate_metal(metal)
    if error_response is not None:
        return error_response

    queryset = MODEL_MAP[metal].objects.all()
    from_value = _parse_datetime_param(request.query_params.get("from"))
    to_value = _parse_datetime_param(request.query_params.get("to"))
    if from_value is not None:
        queryset = queryset.filter(timestamp__gte=from_value)
    if to_value is not None:
        queryset = queryset.filter(timestamp__lte=to_value)

    try:
        limit = int(request.query_params.get("limit", 500))
    except (TypeError, ValueError):
        limit = 500
    limit = max(1, min(limit, 2000))

    rows = list(queryset.order_by("-timestamp")[:limit])
    rows.reverse()
    serializer = SERIALIZER_MAP[metal](rows, many=True)
    return Response({"count": len(serializer.data), "results": serializer.data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def metal_ohlc(request, metal):
    metal, error_response = _validate_metal(metal)
    if error_response is not None:
        return error_response

    ranges = {
        "1d": timedelta(days=1),
        "1w": timedelta(days=7),
        "1m": timedelta(days=30),
        "3m": timedelta(days=90),
        "6m": timedelta(days=180),
        "1y": timedelta(days=365),
    }
    range_key = (request.query_params.get("range") or "1m").lower()
    delta = ranges.get(range_key, ranges["1m"])
    since = pd.Timestamp.now(tz="UTC") - pd.Timedelta(delta)

    rows = list(MODEL_MAP[metal].objects.filter(timestamp__gte=since).order_by("timestamp"))
    serializer = SERIALIZER_MAP[metal](rows, many=True)
    return Response({"range": range_key, "count": len(serializer.data), "results": serializer.data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def metal_eda(request, metal):
    metal, error_response = _validate_metal(metal)
    if error_response is not None:
        return error_response

    report = EDAReport.objects.filter(metal=metal).order_by("-run_timestamp").first()
    if report is None:
        return Response({"error": "No EDA report found."}, status=status.HTTP_404_NOT_FOUND)
    serializer = EDAReportSerializer(report)
    return Response({"metal": metal, "report": serializer.data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def metal_summary(request, metal):
    metal, error_response = _validate_metal(metal)
    if error_response is not None:
        return error_response
    return Response(_summary_for_metal(metal))
