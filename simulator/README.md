# Simulator (FastAPI)

Small telemetry simulator service implemented with **FastAPI**.

It supports:

- `POST /start` to start a background loop
- `POST /stop` to stop the loop
- `GET /status` to check whether it’s running

While running, it inserts simple random telemetry documents into MongoDB.

## Prerequisites

- Python 3.12+
- A reachable MongoDB instance (local or Atlas)

## Environment variables

For local development, this service expects a `.env` file **in this folder**.

Recommended approach (single source of truth):

```bash
# from repo root
cp .env.example .env
cp .env simulator/.env
```

Key vars used by the simulator:

- `MONGODB_URI` (default `mongodb://localhost:27017/charging_demo`)
- `MONGODB_DATABASE` (default `charging_demo`)
- `SIMULATOR_URL` (default `http://localhost:8000`) – simulator derives its bind port from this
- `SIMULATION_INTERVAL_SECONDS` (default `2`)

## Install

```bash
cd simulator
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run (local dev, without Docker)

```bash
cd simulator
source .venv/bin/activate
python run.py
```

### Endpoints

- Health: `{SIMULATOR_URL}/health` (e.g. `http://localhost:8000/health`)
- Status: `{SIMULATOR_URL}/status`
- Start: `POST {SIMULATOR_URL}/start`
- Stop: `POST {SIMULATOR_URL}/stop`
