"""
Transforms CSV row into charging point documents.
Each valid slot (SteckertypenN + P N [kW]) becomes one charging point.
"""

from datetime import UTC, datetime
from typing import Any

from bson.objectid import ObjectId

from scripts.transformers.connector_mapping import parse_steckertypen_field
from scripts.synthetic.generators import (
    generate_evse_id,
    generate_point_label,
    generate_point_status,
)

SLOT_COLUMNS = [
    ("Steckertypen1", "P1 [kW]"),
    ("Steckertypen2", "P2 [kW]"),
    ("Steckertypen3", "P3 [kW]"),
    ("Steckertypen4", "P4 [kW]"),
    ("Steckertypen5", "P5 [kW]"),
    ("Steckertypen6", "P6 [kW]"),
]


def _safe_float(val: Any, default: float) -> float:
    """Parse float, return default if invalid."""
    if val is None or (isinstance(val, float) and str(val) == "nan"):
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def transform_row_to_charging_points(
    row: Any,
    station_id: ObjectId,
    station_code: str,
    is_fast: bool,
    row_index: int,
    evse_seq: int,
) -> tuple[list[dict[str, Any]], int]:
    """
    Transform a CSV row into charging point documents.
    Returns (list of point docs, next evse_seq).
    """
    points: list[dict[str, Any]] = []
    now = datetime.now(UTC)

    for slot_num, (steckertyp_col, power_col) in enumerate(SLOT_COLUMNS, start=1):
        steckertyp = row.get(steckertyp_col)
        power_val = row.get(power_col)

        if not steckertyp or (isinstance(steckertyp, float) and str(steckertyp) == "nan"):
            continue

        power_kw = _safe_float(power_val, 22.0 if "AC" in str(steckertyp) else 50.0)
        connectors = parse_steckertypen_field(str(steckertyp), power_kw)
        if not connectors:
            continue

        point_id = ObjectId()
        charging_point_code = f"cp_{station_code}_{slot_num:02d}"
        label = generate_point_label(slot_num, is_fast, row_index)
        evse_id = generate_evse_id(row.get("Betreiber", "Unknown"), evse_seq, slot_num)
        status = generate_point_status(row_index, slot_num)

        point_doc: dict[str, Any] = {
            "_id": point_id,
            "stationId": station_id,
            "chargingPointCode": charging_point_code,
            "label": label,
            "evseId": evse_id,
            "connectors": connectors,
            "status": {
                "operational": status["operational"],
                "availability": status["availability"],
                "updatedAt": now,
            },
            "pricingOverride": None,
            "createdAt": now,
            "updatedAt": now,
        }
        points.append(point_doc)
        evse_seq += 1

    return points, evse_seq
