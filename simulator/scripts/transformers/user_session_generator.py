"""
Profile-based on-demand charging session generator for one user.
"""

import hashlib
import random
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from bson.objectid import ObjectId
from app.session_pricing import build_pricing_snapshot, calculate_booked_idle_cents

DEFAULT_HOME_LAT = 48.137154
DEFAULT_HOME_LON = 11.576124
DEFAULT_CAR_MODEL = "BMW i3"
DEFAULT_PERIOD = "3 months"
DEFAULT_SESSIONS_PER_WEEK = 2.0

DEFAULT_PRICE_CENTS_PER_KWH = 55
DEFAULT_IDLE_FEE_CENTS_PER_MIN = 20
DEFAULT_IDLE_FEE_AFTER_MINUTES = 5

_PERIOD_RE = re.compile(r"^\s*(\d+)\s*(day|days|week|weeks|month|months)\s*$", re.IGNORECASE)


def parse_period_to_days(period: str) -> int:
    """Parse period strings like '3 months' into number of days."""
    match = _PERIOD_RE.match(period or "")
    if not match:
        raise ValueError("Invalid period format. Examples: '30 days', '12 weeks', '3 months'")

    value = int(match.group(1))
    unit = match.group(2).lower()
    if value <= 0:
        raise ValueError("Period value must be greater than zero")

    if unit.startswith("day"):
        return value
    if unit.startswith("week"):
        return value * 7
    return value * 30


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


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def _deterministic_rng(seed_value: str) -> random.Random:
    seed_int = int(hashlib.md5(seed_value.encode()).hexdigest(), 16)
    return random.Random(seed_int)


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute great-circle distance in kilometers."""
    import math

    r = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def _parse_vehicle_make_model(vehicle_model_raw: str) -> Tuple[str, str]:
    cleaned = _safe_str(vehicle_model_raw) or DEFAULT_CAR_MODEL
    parts = cleaned.split()
    if len(parts) == 1:
        return parts[0], cleaned
    return parts[0], " ".join(parts[1:])


def _vehicle_battery_capacity_kwh(vehicle_model_raw: str) -> float:
    model = _safe_str(vehicle_model_raw).lower()
    if "model 3" in model:
        return 75.0
    if "model y" in model:
        return 78.0
    if "kona" in model:
        return 64.0
    if "leaf" in model:
        return 40.0
    if "bolt" in model:
        return 66.0
    if "id.4" in model:
        return 77.0
    if "i3" in model:
        return 42.2
    return 60.0


def _make_address_short(station: Dict[str, Any]) -> str:
    address = station.get("address") or {}
    street = _safe_str(address.get("street"))
    city = _safe_str(address.get("city"))
    if street and city:
        return f"{street}, {city}"
    if city:
        return city
    return _safe_str(station.get("name")) or "Unknown address"


def _get_price_snapshot(station: Dict[str, Any]) -> Dict[str, Any]:
    return build_pricing_snapshot(station)


def _build_candidates(
    stations: List[Dict[str, Any]],
    points_by_station: Dict[ObjectId, List[Dict[str, Any]]],
    home_lat: float,
    home_lon: float,
) -> List[Dict[str, Any]]:
    """
    Build station/point candidates that support TYPE2 connectors.
    """
    candidates: List[Dict[str, Any]] = []
    for station in stations:
        station_id = station.get("_id")
        location = station.get("location") or {}
        coordinates = location.get("coordinates") or []
        if not station_id or len(coordinates) != 2:
            continue

        lon = _safe_float(coordinates[0])
        lat = _safe_float(coordinates[1])
        if lon is None or lat is None:
            continue

        points = points_by_station.get(station_id, [])
        for point in points:
            connectors = point.get("connectors") or []
            for connector in connectors:
                if _safe_str(connector.get("type")).upper() != "TYPE2":
                    continue
                power = _safe_float(connector.get("power"))
                if power is None or power <= 0:
                    continue

                candidates.append(
                    {
                        "station": station,
                        "point": point,
                        "connector": connector,
                        "distanceKm": _haversine_km(home_lat, home_lon, lat, lon),
                    }
                )
                break
    return candidates


def _select_candidate(
    candidates: List[Dict[str, Any]],
    rng: random.Random,
    is_long_trip: bool,
) -> Dict[str, Any]:
    near = [c for c in candidates if c["distanceKm"] <= 15.0]
    mid = [c for c in candidates if 15.0 < c["distanceKm"] <= 60.0]
    far = [c for c in candidates if c["distanceKm"] > 60.0]

    if is_long_trip:
        bucket = far or mid or near or candidates
    else:
        bucket = near or mid or far or candidates

    # Weighted by inverse distance with a small base to avoid zeros.
    weights = [1.0 / (1.0 + c["distanceKm"]) for c in bucket]
    return rng.choices(bucket, weights=weights, k=1)[0]


def _sample_start_time(
    start_window: datetime,
    end_window: datetime,
    rng: random.Random,
    is_long_trip: bool,
) -> datetime:
    total_seconds = max(1, int((end_window - start_window).total_seconds()))
    base = start_window + timedelta(seconds=rng.randint(0, total_seconds))

    weekday = base.weekday()
    if is_long_trip:
        preferred_hour = rng.choice([7, 8, 9, 10, 11, 14, 15, 16, 17])
    elif weekday < 5:
        preferred_hour = rng.choice([7, 8, 18, 19, 20, 21])
    else:
        preferred_hour = rng.choice([10, 11, 12, 16, 17, 18])

    minute = rng.choice([0, 5, 10, 15, 20, 30, 35, 40, 45, 50, 55])
    return base.replace(hour=preferred_hour, minute=minute, second=0, microsecond=0)


def generate_user_sessions(
    *,
    stations: List[Dict[str, Any]],
    points_by_station: Dict[ObjectId, List[Dict[str, Any]]],
    user_id: ObjectId,
    vehicle_id: ObjectId,
    car_model: str,
    period_days: int,
    home_lat: float,
    home_lon: float,
    sessions_per_week: float = DEFAULT_SESSIONS_PER_WEEK,
) -> List[Dict[str, Any]]:
    """
    Generate realistic sessions for one user profile.
    """
    if period_days <= 0:
        raise ValueError("period_days must be greater than zero")
    if sessions_per_week <= 0:
        raise ValueError("sessions_per_week must be greater than zero")

    seed = f"user-sessions:{user_id}:{vehicle_id}:{car_model}:{period_days}:{home_lat:.5f}:{home_lon:.5f}"
    rng = _deterministic_rng(seed)

    make, model = _parse_vehicle_make_model(car_model)
    vin_last6 = "".join(rng.choices("0123456789", k=6))
    battery_capacity_kwh = _vehicle_battery_capacity_kwh(car_model)

    candidates = _build_candidates(stations, points_by_station, home_lat, home_lon)
    if not candidates:
        raise ValueError("No TYPE2-compatible charging points found in provided stations data")

    now = datetime.now(timezone.utc)
    start_window = now - timedelta(days=period_days)
    end_window = now + timedelta(days=1)

    target_sessions = max(1, int(round((period_days / 7.0) * sessions_per_week)))
    sessions: List[Dict[str, Any]] = []

    for idx in range(target_sessions):
        # Mostly local charging, with occasional long trips.
        is_long_trip = rng.random() < 0.18
        candidate = _select_candidate(candidates, rng, is_long_trip)
        station = candidate["station"]
        point = candidate["point"]
        connector = candidate["connector"]

        session_start = _sample_start_time(start_window, end_window, rng, is_long_trip)
        connector_power = max(3.7, _safe_float(connector.get("power")) or 11.0)

        # Status distribution follows timeline and keeps most sessions completed.
        if idx == target_sessions - 1 and rng.random() < 0.10:
            status = "BOOKED"
            session_start = now + timedelta(minutes=rng.randint(5, 25))
            session_end = session_start + timedelta(minutes=rng.randint(25, 90))
        elif idx >= target_sessions - 2 and rng.random() < 0.20:
            status = "ACTIVE"
            session_start = now - timedelta(minutes=rng.randint(10, 90))
            session_end = session_start + timedelta(minutes=rng.randint(45, 180))
        else:
            status = "COMPLETED"
            if session_start > now:
                session_start = now - timedelta(minutes=rng.randint(60, 300))
            session_end = session_start + timedelta(minutes=rng.randint(35, 190))

        if status == "BOOKED":
            booked_at = now - timedelta(minutes=rng.randint(1, 10))
        else:
            booked_at = session_start - timedelta(minutes=rng.randint(2, 25))
        expires_at = booked_at + timedelta(minutes=30)

        if status == "BOOKED":
            energy_delivered_kwh = None
            started_at = None
            ended_at = None
            meter_start_kwh = None
            meter_stop_kwh = None
            soc_start = None
            soc_stop = None
        else:
            started_at = session_start
            duration_minutes = max(15.0, (session_end - session_start).total_seconds() / 60.0)

            if is_long_trip:
                target_soc_delta = rng.uniform(0.35, 0.70)
            else:
                target_soc_delta = rng.uniform(0.18, 0.45)
            expected_energy = battery_capacity_kwh * target_soc_delta

            practical_limit = connector_power * (duration_minutes / 60.0) * 1.05
            completed_energy = round(_clamp(expected_energy, 4.0, practical_limit), 2)

            if status == "ACTIVE":
                progress = rng.uniform(0.2, 0.85)
                energy_delivered_kwh = round(completed_energy * progress, 2)
                ended_at = None
            else:
                energy_delivered_kwh = completed_energy
                ended_at = session_end

            meter_start_kwh = round(rng.uniform(7000.0, 26000.0), 2)
            meter_stop_kwh = (
                round(meter_start_kwh + energy_delivered_kwh, 2)
                if status == "COMPLETED"
                else None
            )

            if is_long_trip:
                soc_start = round(rng.uniform(8.0, 40.0), 1)
            else:
                soc_start = round(rng.uniform(15.0, 65.0), 1)

            if status == "ACTIVE":
                soc_stop = None
            else:
                delta_percent = (energy_delivered_kwh / max(1.0, battery_capacity_kwh)) * 100.0
                soc_stop = round(_clamp(soc_start + delta_percent, soc_start, 100.0), 1)

        pricing_snapshot = _get_price_snapshot(station)
        price_cents_per_kwh = pricing_snapshot["priceCentsPerKwh"]
        idle_fee = pricing_snapshot["idleFee"]

        energy_cents = (
            int(round(energy_delivered_kwh * price_cents_per_kwh))
            if energy_delivered_kwh is not None
            else 0
        )
        idle_reference = min(now, expires_at) if status == "BOOKED" else started_at
        idle_cents = calculate_booked_idle_cents(
            booked_at=booked_at,
            reference_time=idle_reference,
            idle_fee=idle_fee,
            expires_at=expires_at,
        )
        total_cents = energy_cents + idle_cents

        feedback = None
        if status == "COMPLETED" and rng.random() < 0.30:
            feedback = {
                "rating": rng.choice([4, 5]),
                "comment": rng.choice(
                    [
                        "Smooth session and easy parking.",
                        "Charging started quickly with no issues.",
                        "Good location for my route.",
                    ]
                ),
                "createdAt": session_end + timedelta(minutes=rng.randint(2, 30)),
            }

        session_doc: Dict[str, Any] = {
            "_id": ObjectId(),
            "userId": user_id,
            "vehicleId": vehicle_id,
            "stationId": station["_id"],
            "chargingPointId": point["_id"],
            "stationSnapshot": {
                "name": station.get("name", "Unknown Station"),
                "location": station.get("location"),
                "addressShort": _make_address_short(station),
                "chargingPointLabel": point.get("label", "Unknown Point"),
            },
            "vehicleSnapshot": {
                "vinLast6": vin_last6,
                "make": make,
                "model": model,
            },
            "status": status,
            "booking": {
                "bookedAt": booked_at,
                "expiresAt": expires_at,
                "canceledAt": None,
                "cancelReason": None,
            },
            "charging": {
                "startedAt": started_at,
                "endedAt": ended_at,
                "connectorUsed": {
                    "type": "TYPE2",
                    "power": float(connector_power),
                    "tethered": (
                        bool(connector.get("tethered"))
                        if connector.get("tethered") is not None
                        else None
                    ),
                },
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
            "updatedAt": ended_at if ended_at is not None else now,
        }
        sessions.append(session_doc)

    sessions.sort(key=lambda s: s["createdAt"])
    return sessions
