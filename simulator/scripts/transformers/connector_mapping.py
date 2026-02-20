"""
Maps Steckertypen (connector type strings from CSV) to schema connector format.
Source: simulator/data/README.md value mappings.
"""

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# Original value -> (type, current, tethered)
# Order matters: longer/more specific matches first
_CONNECTOR_MAP: list[tuple[str | re.Pattern, tuple[str, str, bool]]] = [
    # DC connectors (check before AC)
    (re.compile(r"DC\s+Fahrzeugkupplung\s+Typ\s+Combo\s+2\s*\(CCS\)", re.I), ("CCS", "DC", True)),
    (re.compile(r"DC\s+Typ\s+Combo\s+2\s*\(CCS\)", re.I), ("CCS", "DC", True)),
    (re.compile(r"DC\s+CHAdeMO", re.I), ("CHAdeMO", "DC", True)),
    # AC connectors
    (re.compile(r"AC\s+Typ\s+2\s+Fahrzeugkupplung", re.I), ("TYPE2", "AC", True)),
    (re.compile(r"AC\s+Typ\s+2\s+Steckdose", re.I), ("TYPE2", "AC", False)),
    (re.compile(r"AC\s+Typ\s+1\s+Steckdose", re.I), ("TYPE1", "AC", False)),
    (re.compile(r"AC\s+Schuko", re.I), ("SCHUKO", "AC", False)),
]

# Fallback for unknown types
_FALLBACK = ("TYPE2", "AC", False)


def _normalize(value: str) -> str:
    """Normalize whitespace for display/logging."""
    return " ".join(value.split()) if value else ""


def map_steckertyp_to_connector(steckertyp: str, power_kw: float) -> dict[str, Any] | None:
    """
    Map a single Steckertyp string to a connector dict.
    Returns { type, current, power, tethered } or None if unmapped.
    """
    normalized = _normalize(steckertyp.strip())
    if not normalized:
        return None

    for pattern_or_str, (conn_type, current, tethered) in _CONNECTOR_MAP:
        if isinstance(pattern_or_str, re.Pattern):
            if pattern_or_str.search(normalized):
                return {
                    "type": conn_type,
                    "current": current,
                    "power": round(float(power_kw), 1),
                    "tethered": tethered,
                }
        elif normalized.lower() == pattern_or_str.lower():
            return {
                "type": conn_type,
                "current": current,
                "power": round(float(power_kw), 1),
                "tethered": tethered,
            }

    logger.warning("Unknown connector type: %r, using fallback TYPE2", normalized)
    return {
        "type": _FALLBACK[0],
        "current": _FALLBACK[1],
        "power": round(float(power_kw), 1),
        "tethered": _FALLBACK[2],
    }


def parse_steckertypen_field(value: str, power_kw: float) -> list[dict[str, Any]]:
    """
    Parse a Steckertypen field that may contain multiple values (e.g. "AC Typ 2 Steckdose; AC Schuko").
    Returns list of connector dicts, each with same power.
    """
    if not value or (isinstance(value, float) and str(value) == "nan"):
        return []

    connectors: list[dict[str, Any]] = []
    seen: set[str] = set()

    for part in str(value).split(";"):
        part = part.strip()
        if not part:
            continue
        conn = map_steckertyp_to_connector(part, power_kw)
        if conn:
            key = (conn["type"], conn["current"], conn["tethered"])
            if key not in seen:
                seen.add(key)
                connectors.append(conn)

    return connectors
