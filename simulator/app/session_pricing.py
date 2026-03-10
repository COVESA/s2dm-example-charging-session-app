from __future__ import annotations

from datetime import datetime
from typing import Any

DEFAULT_PRICE_CENTS_PER_KWH = 55
DEFAULT_IDLE_FEE_CENTS_PER_MIN = 20
DEFAULT_IDLE_FEE_AFTER_MINUTES = 5


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _safe_non_negative_int(value: Any, fallback: int) -> int:
    if isinstance(value, (int, float)):
        return max(int(value), 0)
    return fallback


def _extract_currency(source: dict[str, Any]) -> str:
    if isinstance(source.get("currency"), str) and source["currency"].strip():
        return source["currency"]

    pricing = _as_dict(source.get("pricing"))
    if isinstance(pricing.get("currency"), str) and pricing["currency"].strip():
        return pricing["currency"]

    return "EUR"


def _extract_tariff(source: dict[str, Any]) -> dict[str, Any]:
    pricing = _as_dict(source.get("pricing"))
    if pricing:
        return _extract_tariff(pricing)

    default_tariff = _as_dict(source.get("defaultTariff"))
    if default_tariff:
        return default_tariff

    return source


def resolve_idle_fee(source: Any) -> dict[str, int]:
    source_dict = _as_dict(source)
    idle_fee = _as_dict(source_dict.get("idleFee"))

    if idle_fee:
        return {
            "priceCentsPerMinute": _safe_non_negative_int(
                idle_fee.get("priceCentsPerMinute"),
                DEFAULT_IDLE_FEE_CENTS_PER_MIN,
            ),
            "afterMinutes": _safe_non_negative_int(
                idle_fee.get("afterMinutes"),
                DEFAULT_IDLE_FEE_AFTER_MINUTES,
            ),
        }

    tariff = _extract_tariff(source_dict)
    return {
        "priceCentsPerMinute": _safe_non_negative_int(
            tariff.get("priceCentsPerMinuteIdleAfterMinutes"),
            DEFAULT_IDLE_FEE_CENTS_PER_MIN,
        ),
        "afterMinutes": _safe_non_negative_int(
            tariff.get("idleFeeAfterMinutes"),
            DEFAULT_IDLE_FEE_AFTER_MINUTES,
        ),
    }


def build_pricing_snapshot(source: Any) -> dict[str, Any]:
    source_dict = _as_dict(source)
    tariff = _extract_tariff(source_dict)

    return {
        "currency": _extract_currency(source_dict),
        "priceCentsPerKwh": _safe_non_negative_int(
            tariff.get("priceCentsPerKwh"),
            DEFAULT_PRICE_CENTS_PER_KWH,
        ),
        "idleFee": resolve_idle_fee(source_dict),
    }


def calculate_booked_idle_cents(
    *,
    booked_at: datetime | None,
    reference_time: datetime | None,
    idle_fee: dict[str, int],
    expires_at: datetime | None = None,
) -> int:
    if booked_at is None or reference_time is None:
        return 0

    effective_end = reference_time
    if expires_at is not None and expires_at < effective_end:
        effective_end = expires_at

    if effective_end <= booked_at:
        return 0

    elapsed_minutes = int((effective_end - booked_at).total_seconds() // 60)
    billable_minutes = max(elapsed_minutes - idle_fee["afterMinutes"], 0)
    return billable_minutes * idle_fee["priceCentsPerMinute"]
