#!/usr/bin/env python3
"""
One-time data load: transform charging-stations-germany.csv to MongoDB schema.
Writes JSON files to scripts/output/ for manual import (e.g. mongoimport).
"""

import argparse
import logging
import sys
from pathlib import Path

import pandas as pd
from bson import json_util
from bson.objectid import ObjectId
from tqdm import tqdm

from scripts.transformers.point_transformer import transform_row_to_charging_points
from scripts.transformers.station_transformer import transform_row_to_station

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Paths relative to simulator/ (run from simulator/)
DEFAULT_CSV_PATH = "data/charging-stations-germany.csv"
DEFAULT_OUTPUT_DIR = "scripts/output"


def _resolve_paths() -> tuple[Path, Path]:
    """Resolve CSV and output paths relative to simulator root."""
    script_dir = Path(__file__).resolve().parent
    simulator_root = script_dir.parent
    csv_path = simulator_root / DEFAULT_CSV_PATH
    output_dir = simulator_root / DEFAULT_OUTPUT_DIR
    return csv_path, output_dir


def _convert_to_extended_json(docs: list) -> str:
    """Convert docs to MongoDB Extended JSON string."""
    return json_util.dumps(docs, indent=2)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Transform charging stations CSV to MongoDB schema JSON files."
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Max number of CSV rows to process (default: all)",
    )
    args = parser.parse_args()

    csv_path, output_dir = _resolve_paths()
    if not csv_path.exists():
        logger.error("CSV not found: %s", csv_path)
        return 1

    logger.info("Loading CSV from %s", csv_path)
    df = pd.read_csv(csv_path, sep=";")
    if args.limit is not None:
        df = df.head(args.limit)
        logger.info("Limited to %d rows", len(df))

    stations: list[dict] = []
    points: list[dict] = []
    evse_seq = 1
    skipped = 0

    for idx, row in tqdm(
        df.iterrows(),
        total=len(df),
        unit="row",
        desc="Processing rows",
    ):
        row_index = int(idx) + 1
        station_code = f"station-{row_index:05d}"
        station_id = ObjectId()

        try:
            row_dict = row.to_dict()
            points_batch, evse_seq = transform_row_to_charging_points(
                row_dict,
                station_id=station_id,
                station_code=station_code,
                is_fast=str(row_dict.get("Art der Ladeeinrichung", "")).strip().lower()
                == "schnellladeeinrichtung",
                row_index=row_index,
                evse_seq=evse_seq,
            )
        except Exception as e:
            logger.warning("Skipping row %d: %s", row_index, e)
            skipped += 1
            continue

        if not points_batch:
            logger.debug("Row %d: no valid charging points, skipping", row_index)
            skipped += 1
            continue

        try:
            station_doc = transform_row_to_station(
                row_dict,
                station_id=station_id,
                station_code=station_code,
                point_docs=points_batch,
                row_index=row_index,
            )
        except ValueError as e:
            logger.warning("Skipping row %d: %s", row_index, e)
            skipped += 1
            continue

        stations.append(station_doc)
        points.extend(points_batch)

    output_dir.mkdir(parents=True, exist_ok=True)

    stations_path = output_dir / "chargingStations.json"
    points_path = output_dir / "chargingPoints.json"

    stations_json = _convert_to_extended_json(stations)
    points_json = _convert_to_extended_json(points)

    stations_path.write_text(stations_json, encoding="utf-8")
    points_path.write_text(points_json, encoding="utf-8")

    logger.info(
        "Wrote %d stations, %d points to %s (skipped %d rows)",
        len(stations),
        len(points),
        output_dir,
        skipped,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
