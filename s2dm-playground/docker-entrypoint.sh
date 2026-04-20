#!/usr/bin/env bash
# Runs the S2DM playground in the slim runtime image:
#   - FastAPI served by uvicorn on port 51264
#   - Pre-built Vite bundle served as static files by Python's stdlib
#     http.server on port 51265
# There is no Vite dev server and no Node.js in this image. The API base URL
# was baked into the JS bundle at image-build time via VITE_API_BASE_URL.
set -euo pipefail

API_PORT="${S2DM_API_PORT:-51264}"
REACT_PORT="${S2DM_REACT_PORT:-51265}"
DIST_DIR="${S2DM_DIST_DIR:-/opt/s2dm/playground/dist}"

cd /opt/s2dm

uvicorn s2dm.api.main:app \
    --host 0.0.0.0 \
    --port "${API_PORT}" &
API_PID=$!

python -m http.server "${REACT_PORT}" \
    --bind 0.0.0.0 \
    --directory "${DIST_DIR}" &
HTTP_PID=$!

cleanup() {
    kill "${API_PID}" "${HTTP_PID}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Exit as soon as either process dies so Docker can restart/stop the container.
wait -n
