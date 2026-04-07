#!/usr/bin/env python3
"""
Unified data loader script for the EV Charging Demo.

Supports generating:
1. Charging Stations & Points (from German government CSV)
2. Charging Sessions (from Kaggle CSV, adapted to our schema)

Usage:
    python -m scripts.load_data stations --input-file data/stations.csv
    python -m scripts.load_data sessions --input-file data/sessions.csv
    python -m scripts.load_data all
    python -m scripts.load_data sessions-user
"""

import argparse
import logging
import sys
from pathlib import Path
from typing import Any

import pandas as pd
from bson import json_util
from bson.objectid import ObjectId
from tqdm import tqdm

from scripts.transformers.point_transformer import transform_row_to_charging_points
from scripts.transformers.station_transformer import transform_row_to_station
from scripts.transformers.session_transformer import transform_row_to_session
from scripts.transformers.user_session_generator import (
    DEFAULT_CAR_MODEL,
    DEFAULT_HOME_LAT,
    DEFAULT_HOME_LON,
    DEFAULT_PERIOD,
    DEFAULT_SESSIONS_PER_WEEK,
    generate_user_sessions,
    parse_period_to_days,
)

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Default Paths (relative to simulator root when running from there)
DEFAULT_STATIONS_CSV = "data/charging-stations-germany.csv"
DEFAULT_SESSIONS_CSV = "data/charging-sessions.csv"
DEFAULT_OUTPUT_DIR = "scripts/output"


def _resolve_path(path_str: str) -> Path:
    """Resolve a path relative to the current working directory."""
    return Path(path_str).resolve()


def _convert_to_extended_json(docs: list) -> str:
    """Convert docs to MongoDB Extended JSON string."""
    return json_util.dumps(docs, indent=2)


def _parse_coordinates(koordinaten: Any) -> tuple[float, float] | None:
    """Parse 'lat, lon' string to (lon, lat) for deduplication."""
    if koordinaten is None or (isinstance(koordinaten, float) and str(koordinaten) == "nan"):
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


def load_stations(args: argparse.Namespace) -> int:
    """Logic to load charging stations and points."""
    csv_path = _resolve_path(args.input_file)
    output_dir = _resolve_path(args.output_dir)

    if not csv_path.exists():
        logger.error("Stations CSV not found: %s", csv_path)
        return 1

    logger.info("Loading Stations CSV from %s", csv_path)
    # The original script used sep=";" for the German CSV
    try:
        df = pd.read_csv(csv_path, sep=";")
    except Exception as e:
        logger.error("Failed to read CSV: %s", e)
        return 1

    if args.limit is not None:
        df = df.head(args.limit)
        logger.info("Limited to %d rows", len(df))

    stations: list[dict] = []
    points: list[dict] = []
    evse_seq = 1
    skipped = 0
    skipped_duplicate_coords = 0
    seen_coords: dict[tuple[float, float], str] = {}

    for idx, row in tqdm(
        df.iterrows(),
        total=len(df),
        unit="row",
        desc="Processing stations",
    ):
        row_index = int(idx) + 1
        station_code = f"station-{row_index:05d}"
        station_id = ObjectId()
        row_dict = row.to_dict()

        def skip_station(*, duplicate_coords: bool = False) -> None:
            nonlocal skipped
            nonlocal skipped_duplicate_coords
            skipped += 1
            if duplicate_coords:
                skipped_duplicate_coords += 1

        try:
            points_batch, evse_seq = transform_row_to_charging_points(
                row_dict,
                station_id=station_id,
                station_code=station_code,
                is_fast=str(row_dict.get("Art der Ladeeinrichung", "")).strip().lower()
                == "schnellladeeinrichtung",
                row_index=row_index,
                evse_seq=evse_seq,
            )
        except Exception:
            skip_station()
            continue

        if not points_batch:
            # logger.debug("Row %d: no valid charging points, skipping", row_index)
            skip_station()
            continue

        coords = _parse_coordinates(row_dict.get("koordinaten"))
        if coords is not None and coords in seen_coords:
            skip_station(duplicate_coords=True)
            continue

        try:
            station_doc = transform_row_to_station(
                row_dict,
                station_id=station_id,
                station_code=station_code,
                point_docs=points_batch,
                row_index=row_index,
            )
        except ValueError:
            skip_station()
            continue

        station_coords = tuple(station_doc["location"]["coordinates"])
        seen_coords[station_coords] = station_code
        stations.append(station_doc)
        points.extend(points_batch)

    output_dir.mkdir(parents=True, exist_ok=True)

    stations_path = output_dir / "chargingStations.json"
    points_path = output_dir / "chargingPoints.json"

    logger.info("Writing output files...")
    stations_path.write_text(_convert_to_extended_json(stations), encoding="utf-8")
    points_path.write_text(_convert_to_extended_json(points), encoding="utf-8")

    logger.info(
        "Wrote %d stations, %d points to %s (skipped %d rows)",
        len(stations),
        len(points),
        output_dir,
        skipped,
    )
    if skipped_duplicate_coords > 0:
        logger.info("Skipped due to duplicate coordinates: %d", skipped_duplicate_coords)
    
    return 0


def load_sessions(args: argparse.Namespace) -> int:
    """Logic to generate charging sessions."""
    csv_path = _resolve_path(args.input_file)
    output_dir = _resolve_path(args.output_dir)
    stations_path = output_dir / args.stations_file
    points_path = output_dir / args.points_file

    # 1. Check prerequisites
    if not csv_path.exists():
        logger.error("Sessions CSV not found: %s", csv_path)
        return 1
    if not stations_path.exists():
        logger.error(
            "Stations JSON not found: %s. Run 'stations' command first.", stations_path
        )
        return 1
    if not points_path.exists():
        logger.error(
            "Points JSON not found: %s. Run 'stations' command first.", points_path
        )
        return 1

    logger.info(
        "Loading metadata from %s and %s...", stations_path.name, points_path.name
    )

    # 2. Load stations and points
    try:
        with open(stations_path, "r", encoding="utf-8") as f:
            stations_data = json_util.loads(f.read())
        with open(points_path, "r", encoding="utf-8") as f:
            points_data = json_util.loads(f.read())
    except Exception as e:
        logger.error("Failed to load JSON files: %s", e)
        return 1

    logger.info(
        "Loaded %d stations and %d points.", len(stations_data), len(points_data)
    )

    # 3. Index points by stationId for fast lookup
    points_by_station = {}
    for p in points_data:
        s_id = p["stationId"]
        if s_id not in points_by_station:
            points_by_station[s_id] = []
        points_by_station[s_id].append(p)

    # 4. Process CSV
    logger.info("Loading Sessions CSV from %s", csv_path)
    try:
        # Check delimiter - the example sessions CSV seemed to be comma separated
        df = pd.read_csv(csv_path, sep=",")
    except Exception as e:
        logger.error("Failed to read CSV: %s", e)
        return 1

    if args.limit is not None:
        df = df.head(args.limit)
        logger.info("Limited to %d rows", len(df))

    sessions = []
    skipped = 0

    for idx, row in tqdm(
        df.iterrows(),
        total=len(df),
        unit="row",
        desc="Processing sessions",
    ):
        row_index = int(idx) + 1
        row_dict = row.to_dict()

        session_doc = transform_row_to_session(
            row_dict, stations_data, points_by_station, row_index
        )

        if session_doc:
            sessions.append(session_doc)
        else:
            skipped += 1

    # 5. Write output
    sessions_path = output_dir / "chargingSessions.json"
    logger.info("Writing output to %s...", sessions_path)
    sessions_path.write_text(_convert_to_extended_json(sessions), encoding="utf-8")

    logger.info("Wrote %d sessions (skipped %d rows)", len(sessions), skipped)

    return 0


def load_all(args: argparse.Namespace) -> int:
    """Run station generation first, then session generation."""
    logger.info("Running full load: stations -> sessions")

    stations_args = argparse.Namespace(
        input_file=args.stations_input_file,
        output_dir=args.output_dir,
        limit=args.stations_limit,
    )
    stations_rc = load_stations(stations_args)
    if stations_rc != 0:
        return stations_rc

    sessions_args = argparse.Namespace(
        input_file=args.sessions_input_file,
        output_dir=args.output_dir,
        limit=args.sessions_limit,
        stations_file=args.stations_file,
        points_file=args.points_file,
    )
    return load_sessions(sessions_args)


def _parse_object_id(value: str | None, field_name: str) -> ObjectId | None:
    if value is None:
        return None
    candidate = value.strip()
    if not candidate:
        return None
    try:
        return ObjectId(candidate)
    except Exception:
        raise ValueError(f"{field_name} must be a valid ObjectId hex string")


def _sanitize_filename_fragment(value: str) -> str:
    safe = "".join(ch if ch.isalnum() or ch in ("-", "_", ".") else "-" for ch in value)
    return safe.strip("-._") or "user"


def load_sessions_user(args: argparse.Namespace) -> int:
    """Generate on-demand sessions for a single user profile."""
    output_dir = _resolve_path(args.output_dir)
    stations_path = output_dir / args.stations_file
    points_path = output_dir / args.points_file

    if not stations_path.exists():
        logger.error(
            "Stations JSON not found: %s. Run 'stations' command first.", stations_path
        )
        return 1
    if not points_path.exists():
        logger.error(
            "Points JSON not found: %s. Run 'stations' command first.", points_path
        )
        return 1

    try:
        with open(stations_path, "r", encoding="utf-8") as f:
            stations_data = json_util.loads(f.read())
        with open(points_path, "r", encoding="utf-8") as f:
            points_data = json_util.loads(f.read())
    except Exception as e:
        logger.error("Failed to load station/point JSON files: %s", e)
        return 1

    points_by_station: dict[ObjectId, list[dict]] = {}
    for p in points_data:
        s_id = p["stationId"]
        points_by_station.setdefault(s_id, []).append(p)

    try:
        period_days = parse_period_to_days(args.period)
    except ValueError as e:
        logger.error("Invalid period: %s", e)
        return 1

    try:
        user_id = _parse_object_id(args.user_id, "userId") or ObjectId()
        vehicle_id = _parse_object_id(args.vehicle_id, "vehicleId") or ObjectId()
    except ValueError as e:
        logger.error("%s", e)
        return 1

    try:
        sessions = generate_user_sessions(
            stations=stations_data,
            points_by_station=points_by_station,
            user_id=user_id,
            vehicle_id=vehicle_id,
            car_model=args.car_model,
            period_days=period_days,
            home_lat=args.start_lat,
            home_lon=args.start_lon,
            sessions_per_week=args.sessions_per_week,
        )
    except ValueError as e:
        logger.error("Could not generate user sessions: %s", e)
        return 1

    output_dir.mkdir(parents=True, exist_ok=True)

    if args.output_file:
        output_name = args.output_file
    else:
        output_name = f"chargingSessions.user.{_sanitize_filename_fragment(str(user_id))}.json"

    sessions_path = output_dir / output_name
    sessions_path.write_text(_convert_to_extended_json(sessions), encoding="utf-8")

    logger.info(
        "Wrote %d user sessions to %s (userId=%s, vehicleId=%s)",
        len(sessions),
        sessions_path,
        user_id,
        vehicle_id,
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Data loader for EV Charging Demo."
    )
    subparsers = parser.add_subparsers(dest="command", required=True, help="Command to run")

    # Subcommand: stations
    cmd_stations = subparsers.add_parser("stations", help="Generate chargingStations and chargingPoints")
    cmd_stations.add_argument(
        "--input-file",
        type=str,
        default=DEFAULT_STATIONS_CSV,
        help=f"Path to input CSV (default: {DEFAULT_STATIONS_CSV})",
    )
    cmd_stations.add_argument(
        "--output-dir",
        type=str,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directory to write JSON files (default: {DEFAULT_OUTPUT_DIR})",
    )
    cmd_stations.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Max number of rows to process",
    )

    # Subcommand: sessions
    cmd_sessions = subparsers.add_parser("sessions", help="Generate chargingSessions")
    cmd_sessions.add_argument(
        "--input-file",
        type=str,
        default=DEFAULT_SESSIONS_CSV,
        help=f"Path to input CSV (default: {DEFAULT_SESSIONS_CSV})",
    )
    cmd_sessions.add_argument(
        "--output-dir",
        type=str,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directory to write JSON files and read station/point data (default: {DEFAULT_OUTPUT_DIR})",
    )
    cmd_sessions.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Max number of rows to process",
    )
    cmd_sessions.add_argument(
        "--stations-file",
        type=str,
        default="chargingStations.json",
        help="Name of stations JSON file in output-dir (default: chargingStations.json)",
    )
    cmd_sessions.add_argument(
        "--points-file",
        type=str,
        default="chargingPoints.json",
        help="Name of points JSON file in output-dir (default: chargingPoints.json)",
    )

    # Subcommand: all
    cmd_all = subparsers.add_parser(
        "all",
        help="Generate chargingStations, chargingPoints, and chargingSessions in sequence",
    )
    cmd_all.add_argument(
        "--stations-input-file",
        type=str,
        default=DEFAULT_STATIONS_CSV,
        help=f"Path to stations CSV (default: {DEFAULT_STATIONS_CSV})",
    )
    cmd_all.add_argument(
        "--sessions-input-file",
        type=str,
        default=DEFAULT_SESSIONS_CSV,
        help=f"Path to sessions CSV (default: {DEFAULT_SESSIONS_CSV})",
    )
    cmd_all.add_argument(
        "--output-dir",
        type=str,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directory to write/read JSON files (default: {DEFAULT_OUTPUT_DIR})",
    )
    cmd_all.add_argument(
        "--stations-limit",
        type=int,
        default=None,
        help="Max number of station rows to process",
    )
    cmd_all.add_argument(
        "--sessions-limit",
        type=int,
        default=None,
        help="Max number of session rows to process",
    )
    cmd_all.add_argument(
        "--stations-file",
        type=str,
        default="chargingStations.json",
        help="Name of stations JSON file in output-dir (default: chargingStations.json)",
    )
    cmd_all.add_argument(
        "--points-file",
        type=str,
        default="chargingPoints.json",
        help="Name of points JSON file in output-dir (default: chargingPoints.json)",
    )

    # Subcommand: sessions-user
    cmd_sessions_user = subparsers.add_parser(
        "sessions-user",
        help="Generate realistic on-demand chargingSessions for one user profile",
    )
    cmd_sessions_user.add_argument(
        "--output-dir",
        type=str,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directory to read stations/points and write output (default: {DEFAULT_OUTPUT_DIR})",
    )
    cmd_sessions_user.add_argument(
        "--stations-file",
        type=str,
        default="chargingStations.json",
        help="Name of stations JSON file in output-dir (default: chargingStations.json)",
    )
    cmd_sessions_user.add_argument(
        "--points-file",
        type=str,
        default="chargingPoints.json",
        help="Name of points JSON file in output-dir (default: chargingPoints.json)",
    )
    cmd_sessions_user.add_argument(
        "--user-id",
        type=str,
        default=None,
        help="Optional user ObjectId. If omitted, a new one is generated per run.",
    )
    cmd_sessions_user.add_argument(
        "--vehicle-id",
        type=str,
        default=None,
        help="Optional vehicle ObjectId. If omitted, a new one is generated per run.",
    )
    cmd_sessions_user.add_argument(
        "--period",
        type=str,
        default=DEFAULT_PERIOD,
        help=f"Generation period, e.g. '3 months' (default: {DEFAULT_PERIOD})",
    )
    cmd_sessions_user.add_argument(
        "--start-lat",
        type=float,
        default=DEFAULT_HOME_LAT,
        help=f"Home latitude anchor (default: {DEFAULT_HOME_LAT})",
    )
    cmd_sessions_user.add_argument(
        "--start-lon",
        type=float,
        default=DEFAULT_HOME_LON,
        help=f"Home longitude anchor (default: {DEFAULT_HOME_LON})",
    )
    cmd_sessions_user.add_argument(
        "--car-model",
        type=str,
        default=DEFAULT_CAR_MODEL,
        help=f"Car model for vehicle snapshot (default: '{DEFAULT_CAR_MODEL}')",
    )
    cmd_sessions_user.add_argument(
        "--sessions-per-week",
        type=float,
        default=DEFAULT_SESSIONS_PER_WEEK,
        help=f"Average charging cadence per week (default: {DEFAULT_SESSIONS_PER_WEEK})",
    )
    cmd_sessions_user.add_argument(
        "--output-file",
        type=str,
        default=None,
        help="Optional output filename. Default is chargingSessions.user.<userId>.json",
    )

    args = parser.parse_args()

    if args.command == "stations":
        return load_stations(args)
    elif args.command == "sessions":
        return load_sessions(args)
    elif args.command == "all":
        return load_all(args)
    elif args.command == "sessions-user":
        return load_sessions_user(args)
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
