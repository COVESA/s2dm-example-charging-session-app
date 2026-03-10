"""
Transforms CSV row into a charging station document.
"""

from datetime import UTC, datetime
from typing import Any

from bson.objectid import ObjectId

from scripts.synthetic.generators import (
    generate_characteristics,
    generate_pricing,
)


def _parse_coordinates(koordinaten: Any) -> tuple[float, float] | None:
    """Parse 'lat, lon' string to (lon, lat) for GeoJSON."""
    if koordinaten is None or (
        isinstance(koordinaten, float) and str(koordinaten) == "nan"
    ):
        return None
    s = str(koordinaten).strip()
    if not s:
        return None
    parts = [p.strip() for p in s.split(",")]
    if len(parts) < 2:
        return None
    try:
        lat = float(parts[0])
        lon = float(parts[1])
        return (lon, lat)
    except (ValueError, TypeError):
        return None


def _build_address(row: Any) -> dict[str, str]:
    """Build address dict from row."""
    street = str(row.get("Straße", "") or "").strip()
    hausnummer = str(row.get("Hausnummer", "") or "").strip()
    street_full = f"{street} {hausnummer}".strip() or "Unknown"
    city = str(row.get("Ort", "") or "").strip() or "Unknown"
    postal = str(row.get("Postleitzahl", "") or "").strip() or ""
    return {
        "street": street_full,
        "city": city,
        "country": "DE",
        "postalCode": postal,
    }


def _get_station_name(row: Any) -> str:
    """Name from Anzeigename (Karte) or Betreiber – Ort."""
    anzeige = row.get("Anzeigename (Karte)")
    if anzeige and str(anzeige).strip() and str(anzeige) != "nan":
        return str(anzeige).strip()
    betreiber = str(row.get("Betreiber", "") or "").strip() or "Unknown"
    ort = str(row.get("Ort", "") or "").strip() or ""
    if ort:
        return f"{betreiber} – {ort}"
    return betreiber


def transform_row_to_station(
    row: Any,
    station_id: ObjectId,
    station_code: str,
    point_docs: list[dict[str, Any]],
    row_index: int,
) -> dict[str, Any]:
    """
    Transform a CSV row into a charging station document.
    point_docs are the charging point documents for this station (from point_transformer).
    """
    koordinaten = row.get("koordinaten")
    coords = _parse_coordinates(koordinaten)
    if coords is None:
        raise ValueError(f"Row {row_index}: invalid or missing koordinaten")

    operator = str(row.get("Betreiber", "") or "").strip() or "Unknown"
    is_fast = (
        str(row.get("Art der Ladeeinrichung", "")).strip().lower()
        == "schnellladeeinrichtung"
    )

    characteristics = generate_characteristics(row_index, is_fast)
    pricing = generate_pricing(row_index, is_fast)

    # Embedded chargingPoints for search (simplified connectors: type, power, tethered)
    embedded_points = []
    operational_count = 0
    available_now_count = 0

    for pt in point_docs:
        connectors_simple = [
            {"type": c["type"], "power": c["power"], "tethered": c["tethered"]}
            for c in pt["connectors"]
        ]
        operational = pt["status"]["operational"] in ("OPERATIONAL",)
        availability = pt["status"]["availability"]
        available_now = operational and availability == "AVAILABLE"
        out_of_service = (
            pt["status"]["operational"] in ("BROKEN", "OFFLINE")
            or availability == "OUT_OF_SERVICE"
        )

        if operational:
            operational_count += 1
        if available_now:
            available_now_count += 1

        embedded_points.append(
            {
                "chargingPointId": pt["_id"],
                "connectors": connectors_simple,
                "availableNow": available_now,
                "outOfService": out_of_service,
            }
        )

    now = datetime.now(UTC)

    return {
        "_id": station_id,
        "stationCode": station_code,
        "name": _get_station_name(row),
        "operator": operator,
        "location": {"type": "Point", "coordinates": list(coords)},
        "address": _build_address(row),
        "timezone": "Europe/Berlin",
        "hasFastCharging": is_fast,
        "characteristics": characteristics,
        "pricing": pricing,
        "chargingPoints": embedded_points,
        "availability": {
            "totalPoints": len(point_docs),
            "operationalPoints": operational_count,
            "availableNowPoints": available_now_count,
            "lastComputedAt": now,
        },
        "createdAt": now,
        "updatedAt": now,
    }
