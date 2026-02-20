"""
Synthetic data generators for fields not present in the source CSV.
Uses seeded random for reproducibility per station/point.
"""

import random
import re
from typing import Any

DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
AMENITIES = ["RESTROOM", "CAFE", "SHOP", "MALL", "TOILET"]
PARKING_TYPES = ["PUBLIC", "PUBLIC", "PUBLIC", "PRIVATE", "PRIVATE", "CUSTOMER_ONLY"]
OPERATIONAL = ["OPERATIONAL"] * 95 + ["MAINTENANCE"] * 4 + ["BROKEN"] * 1
AVAILABILITY = ["AVAILABLE"] * 60 + ["CHARGING"] * 25 + ["RESERVED"] * 10 + ["OUT_OF_SERVICE"] * 5


def _seed_for(row_index: int, slot: int | None = None) -> None:
    """Set random seed for reproducible output."""
    seed_val = row_index * 10000 + (slot or 0)
    random.seed(seed_val)


def _sanitize_operator_code(betreiber: str) -> str:
    """Extract short code from operator name for evseId."""
    s = str(betreiber or "").strip().upper()
    # Take first 2-4 alphanumeric chars from first word, or "UNK"
    words = re.findall(r"[A-Z0-9]+", s)
    if not words:
        return "UNK"
    first = words[0]
    if len(first) >= 4:
        return first[:4]
    return first[:4].ljust(4, "X")[:4]


def generate_characteristics(row_index: int, is_fast: bool) -> dict[str, Any]:
    """Generate parkingType, amenities, access."""
    _seed_for(row_index)
    parking_type = random.choice(PARKING_TYPES)
    n_amenities = random.randint(0, 3)
    amenities = random.sample(AMENITIES, n_amenities)
    open24h = is_fast and random.random() < 0.3

    if open24h:
        opening_hours: list[dict[str, str]] = []
    else:
        opening_hours = [
            {"day": d, "open": "08:00", "close": "22:00"}
            for d in DAYS
        ]
        # Weekend slightly different
        opening_hours[5]["open"] = "09:00"
        opening_hours[5]["close"] = "23:00"
        opening_hours[6]["open"] = "09:00"
        opening_hours[6]["close"] = "21:00"

    return {
        "parkingType": parking_type,
        "amenities": amenities,
        "access": {
            "open24h": open24h,
            "openingHours": opening_hours,
        },
    }


def generate_pricing(row_index: int, is_fast: bool) -> dict[str, Any]:
    """Generate pricing (currency, tariff)."""
    _seed_for(row_index)
    if is_fast:
        price = random.randint(55, 85)
    else:
        price = random.randint(45, 75)
    idle_after = random.randint(15, 30)
    return {
        "currency": "EUR",
        "defaultTariff": {
            "priceCentsPerKwh": price,
            "priceCentsPerMinuteIdleAfterMinutes": idle_after,
        },
    }


def generate_evse_id(betreiber: str, seq: int, slot: int) -> str:
    """Generate evseId: DE*{operator_code}*E{seq:05d}*{slot}."""
    code = _sanitize_operator_code(betreiber)
    return f"DE*{code}*E{seq:05d}*{slot}"


def generate_point_label(slot: int, is_fast: bool, row_index: int) -> str:
    """Generate label: Bay N or Schnellladung N."""
    _seed_for(row_index, slot)
    if is_fast:
        return f"Schnellladung {slot}"
    return f"Bay {slot}"


def generate_point_status(row_index: int, slot: int) -> dict[str, str]:
    """Generate operational and availability status."""
    _seed_for(row_index, slot)
    return {
        "operational": random.choice(OPERATIONAL),
        "availability": random.choice(AVAILABILITY),
    }
