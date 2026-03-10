"""
Transformer for charging sessions data.
"""

import hashlib
import random
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from bson.objectid import ObjectId
from app.session_pricing import build_pricing_snapshot, calculate_booked_idle_cents

# Constants
TARGET_YEAR = 2026
DEFAULT_PRICE_CENTS_PER_KWH = 55
DEFAULT_IDLE_FEE_CENTS_PER_MIN = 20
DEFAULT_IDLE_FEE_AFTER_MINUTES = 5

# Cache for User/Vehicle mapping to ensure consistency for the same CSV User ID
_user_vehicle_cache: Dict[str, Dict[str, Any]] = {}


def _deterministic_rng(seed_value: str) -> random.Random:
    """Create a deterministic random generator from a stable string seed."""
    seed_int = int(hashlib.md5(seed_value.encode()).hexdigest(), 16)
    return random.Random(seed_int)


def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    s = str(value).strip()
    if s.lower() == "nan":
        return ""
    return s


def _safe_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        s = str(value).strip()
        if not s or s.lower() == "nan":
            return None
        return float(s)
    except (TypeError, ValueError):
        return None


def _parse_vehicle_make_model(vehicle_model_raw: str) -> Tuple[str, str]:
    """
    Build a simple make/model split from source vehicle model string.
    Examples:
      "Tesla Model 3" -> ("Tesla", "Model 3")
      "BMW i3" -> ("BMW", "i3")
    """
    cleaned = _safe_str(vehicle_model_raw) or "Unknown Vehicle"
    parts = cleaned.split()
    if len(parts) == 1:
        return parts[0], cleaned
    return parts[0], " ".join(parts[1:])


def _get_or_create_user_vehicle(csv_user_id: str, vehicle_model: str) -> Dict[str, Any]:
    """
    Get existing user/vehicle data for a CSV user ID or create new ones.
    Returns a dict with userId, vehicleId, and vehicleSnapshot.
    """
    if csv_user_id in _user_vehicle_cache:
        return _user_vehicle_cache[csv_user_id]

    user_id = ObjectId()
    vehicle_id = ObjectId()
    make, model = _parse_vehicle_make_model(vehicle_model)
    rng = _deterministic_rng(f"vehicle:{csv_user_id}")

    vehicle_snapshot = {
        "vinLast6": "".join(rng.choices("0123456789", k=6)),
        "make": make,
        "model": model,
    }

    data = {
        "userId": user_id,
        "vehicleId": vehicle_id,
        "vehicleSnapshot": vehicle_snapshot,
    }
    _user_vehicle_cache[csv_user_id] = data
    return data


def _map_station_and_point(
    csv_station_id: str,
    stations: List[Dict[str, Any]],
    points_by_station: Dict[ObjectId, List[Dict[str, Any]]],
    rng: random.Random,
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """
    Map a CSV station ID to a generated station and pick a deterministic point.
    """
    if not stations:
        return None, None

    hash_val = int(hashlib.md5(csv_station_id.encode()).hexdigest(), 16)
    station_idx = hash_val % len(stations)
    station = stations[station_idx]

    station_id = station["_id"]
    available_points = points_by_station.get(station_id, [])

    if not available_points:
        return station, None

    point = rng.choice(available_points)
    return station, point


def _adjust_year(dt_str: str) -> datetime:
    """
    Parse datetime string and adjust year to TARGET_YEAR.
    Expected format: "YYYY-MM-DD HH:MM:SS" (from pandas/CSV)
    """
    try:
        dt = datetime.strptime(str(dt_str), "%Y-%m-%d %H:%M:%S")
    except ValueError:
        dt = datetime.fromisoformat(str(dt_str))

    return dt.replace(year=TARGET_YEAR).replace(tzinfo=timezone.utc)


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def _make_address_short(station: Dict[str, Any]) -> str:
    address = station.get("address") or {}
    street = _safe_str(address.get("street"))
    city = _safe_str(address.get("city"))
    if street and city:
        return f"{street}, {city}"
    if city:
        return city
    return _safe_str(station.get("name")) or "Unknown address"


def _get_price_snapshot(
    station: Dict[str, Any],
) -> Dict[str, Any]:
    return build_pricing_snapshot(station)


def transform_row_to_session(
    row: Dict[str, Any],
    stations: List[Dict[str, Any]],
    points_by_station: Dict[ObjectId, List[Dict[str, Any]]],
    row_index: int,
) -> Optional[Dict[str, Any]]:
    """
    Transform a CSV row into a charging session document.
    """
    csv_user_id = _safe_str(row.get("User ID")) or f"unknown-user-{row_index}"
    csv_station_id = _safe_str(row.get("Charging Station ID")) or f"unknown-station-{row_index}"
    vehicle_model = _safe_str(row.get("Vehicle Model")) or "Unknown Vehicle"
    rng = _deterministic_rng(f"session:{csv_user_id}:{csv_station_id}:{row_index}")

    # 1. User & Vehicle
    uv_data = _get_or_create_user_vehicle(csv_user_id, vehicle_model)

    # 2. Station & Point
    station, point = _map_station_and_point(csv_station_id, stations, points_by_station, rng)
    if not station or not point:
        return None

    # 3. Timestamps & Status
    try:
        start_time = _adjust_year(row.get("Charging Start Time"))
        end_time = _adjust_year(row.get("Charging End Time"))
    except Exception:
        return None

    if end_time <= start_time:
        end_time = start_time + timedelta(minutes=30)

    now = datetime.now(timezone.utc)
    status = "COMPLETED"
    if start_time > now:
        status = "BOOKED"
    elif start_time <= now < end_time:
        status = "ACTIVE"

    # 4. Snapshots
    station_snapshot = {
        "name": station.get("name", "Unknown Station"),
        "location": station.get("location"),
        "addressShort": _make_address_short(station),
        "chargingPointLabel": point.get("label", "Unknown Point"),
    }

    # 5. Booking lifecycle
    if status == "BOOKED":
        booked_at = now - timedelta(minutes=rng.randint(1, 10))
        expires_at = booked_at + timedelta(minutes=30)
    else:
        lead_minutes = rng.randint(2, 20)
        booked_at = start_time - timedelta(minutes=lead_minutes)
        expires_at = booked_at + timedelta(minutes=30)

    booking = {
        "bookedAt": booked_at,
        "expiresAt": expires_at,
        "canceledAt": None,
        "cancelReason": None,
    }

    # 6. Connector and charging profile
    connectors = point.get("connectors") or []
    selected_connector = rng.choice(connectors) if connectors else None
    connector_power = None
    connector_used = {"type": None, "power": None, "tethered": None}
    if selected_connector is not None:
        connector_power_val = _safe_float(selected_connector.get("power"))
        connector_power = (
            round(max(1.0, connector_power_val), 1) if connector_power_val is not None else None
        )
        connector_used = {
            "type": _safe_str(selected_connector.get("type")) or None,
            "power": connector_power,
            "tethered": (
                bool(selected_connector.get("tethered"))
                if selected_connector.get("tethered") is not None
                else None
            ),
        }

    duration_minutes = max(1.0, (end_time - start_time).total_seconds() / 60.0)
    raw_energy_kwh = _safe_float(row.get("Energy Consumed (kWh)"))
    csv_rate_kw = _safe_float(row.get("Charging Rate (kW)"))

    max_rate_kw = connector_power or csv_rate_kw or 22.0
    # Keep simulated sessions plausible: delivered energy should not exceed a practical ceiling.
    practical_energy_limit = max_rate_kw * (duration_minutes / 60.0) * 1.05
    base_energy_kwh = max(0.1, raw_energy_kwh if raw_energy_kwh is not None else practical_energy_limit * 0.75)
    completed_energy_kwh = round(min(base_energy_kwh, practical_energy_limit), 2)

    if status == "BOOKED":
        energy_delivered_kwh = None
    elif status == "ACTIVE":
        progress = _clamp((now - start_time).total_seconds() / max(1.0, (end_time - start_time).total_seconds()), 0.05, 0.95)
        energy_delivered_kwh = round(completed_energy_kwh * progress, 2)
    else:
        energy_delivered_kwh = completed_energy_kwh

    meter_start_kwh = None
    meter_stop_kwh = None
    if status in ["ACTIVE", "COMPLETED"]:
        meter_start_kwh = round(rng.uniform(8000.0, 24000.0), 2)
        if energy_delivered_kwh is not None:
            if status == "ACTIVE":
                meter_stop_kwh = None
            else:
                meter_stop_kwh = round(meter_start_kwh + energy_delivered_kwh, 2)

    # 7. SoC consistency
    battery_capacity_kwh = _safe_float(row.get("Battery Capacity (kWh)")) or 70.0
    soc_start = _safe_float(row.get("State of Charge (Start %)"))
    soc_stop = _safe_float(row.get("State of Charge (End %)"))

    if status == "BOOKED":
        soc_start, soc_stop = None, None
    elif status == "ACTIVE":
        if soc_start is None:
            soc_start = rng.uniform(10.0, 70.0)
        soc_start = round(_clamp(soc_start, 0.0, 100.0), 1)
        soc_stop = None
    else:
        expected_delta = (
            (energy_delivered_kwh / battery_capacity_kwh) * 100.0
            if energy_delivered_kwh is not None and battery_capacity_kwh > 0
            else 20.0
        )
        if soc_start is None:
            soc_start = rng.uniform(5.0, 70.0)
        soc_start = _clamp(soc_start, 0.0, 95.0)

        if soc_stop is None or soc_stop < soc_start:
            soc_stop = soc_start + expected_delta * rng.uniform(0.8, 1.2)
        soc_stop = _clamp(soc_stop, soc_start, 100.0)

        soc_start = round(soc_start, 1)
        soc_stop = round(soc_stop, 1)

    # 8. Pricing and cost
    pricing_snapshot = _get_price_snapshot(station)
    price_cents_per_kwh = pricing_snapshot["priceCentsPerKwh"]
    idle_fee = pricing_snapshot["idleFee"]

    energy_cents = (
        int(round(energy_delivered_kwh * price_cents_per_kwh))
        if energy_delivered_kwh is not None
        else 0
    )
    idle_reference = min(now, expires_at) if status == "BOOKED" else start_time
    idle_cents = calculate_booked_idle_cents(
        booked_at=booked_at,
        reference_time=idle_reference,
        idle_fee=idle_fee,
        expires_at=expires_at,
    )
    total_cents = energy_cents + idle_cents

    feedback = None
    if status == "COMPLETED" and rng.random() < 0.35:
        feedback = {
            "rating": rng.choice([4, 5]),
            "comment": rng.choice(
                [
                    "Easy start and stable charging session.",
                    "No issues; charger worked as expected.",
                    "Good location and straightforward experience.",
                ]
            ),
            "createdAt": end_time + timedelta(minutes=rng.randint(2, 45)),
        }

    session_doc: Dict[str, Any] = {
        "_id": ObjectId(),
        "userId": uv_data["userId"],
        "vehicleId": uv_data["vehicleId"],
        "stationId": station["_id"],
        "chargingPointId": point["_id"],

        "stationSnapshot": station_snapshot,
        "vehicleSnapshot": uv_data["vehicleSnapshot"],

        "status": status,

        "booking": booking,

        "charging": {
            "startedAt": start_time if status in ["ACTIVE", "COMPLETED"] else None,
            "endedAt": end_time if status == "COMPLETED" else None,
            "connectorUsed": connector_used,
            "meterStartKwh": meter_start_kwh,
            "meterStopKwh": meter_stop_kwh,
            "energyDeliveredKwh": energy_delivered_kwh,
            "socStartPercent": soc_start,
            "socStopPercent": soc_stop,
        },

        "pricingSnapshot": pricing_snapshot,

        "cost": {
            "totalCents": total_cents,
            "energyCents": energy_cents,
            "idleCents": idle_cents,
        },

        "feedback": feedback,

        "createdAt": booked_at,
        "updatedAt": end_time if status == "COMPLETED" else now,
    }

    return session_doc
