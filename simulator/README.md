# Simulator (FastAPI)

FastAPI service that watches charging sessions in MongoDB and emits simulated telemetry for active sessions.

On startup, it:

- listens to MongoDB change streams on `chargingSessions`
- starts telemetry simulation when a session becomes `ACTIVE`
- stops telemetry simulation when a session is no longer `ACTIVE`
- prevents duplicate simulations for the same session ID

## Prerequisites

- Docker and Docker Compose, or Python 3.12+ for local development
- A reachable MongoDB replica set or compatible deployment with change streams enabled

## Run With Docker Compose

From the repository root:

```bash
cp .env.example .env
docker compose up --build mongodb simulator
```

The simulator is exposed on `http://localhost:8000`.

Health check:

```bash
curl http://localhost:8000/health
```

To start the full application stack instead of only MongoDB and the simulator:

```bash
docker compose up --build
```

## Run Locally Without Docker

For direct local runs, place a `.env` file in `simulator/` or export the same variables in your shell.

```bash
cd simulator
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python run.py
```

## Environment Variables

Key variables used by the simulator:

- `MONGODB_URI` (default `mongodb://localhost:27017/charging_demo`)
- `MONGODB_DATABASE` (default `charging_demo`)
- `SIMULATOR_URL` (default `http://localhost:8000`)
- `SESSION_TELEMETRY_INTERVAL_SECONDS` (default `2`)
- `SESSION_RECONCILIATION_INTERVAL_SECONDS` (default `10`)
- `CHANGE_STREAM_RETRY_SECONDS` (default `2`)
