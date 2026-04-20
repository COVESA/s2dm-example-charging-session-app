# syntax=docker/dockerfile:1.6
#
# Two-stage build of the COVESA/s2dm GUI playground (feat/json-mongo-exporters
# branch, pinned to a specific commit).
#
# The builder stage has Node.js, git, uv, and all dev tooling needed to clone,
# patch, and build the React bundle with Vite. The runtime stage is a slim
# Python-only image that only ships the FastAPI venv and the pre-built static
# bundle — no Node.js, no node_modules, no .git, no build toolchain.
#
# Frontend is served as static files by Python's stdlib http.server. The API
# base URL is baked into the Vite bundle at build time via VITE_API_BASE_URL.

# ---- builder stage ---------------------------------------------------------
FROM python:3.12-slim AS builder

ARG S2DM_REPO_URL=https://github.com/COVESA/s2dm.git
ARG S2DM_BRANCH=feat/json-mongo-exporters
ARG S2DM_COMMIT=e6e310f5246ba871a4dd91c24adb8108a5feb853

# Demo schema files to pre-populate in the playground file list. Pulled from
# `main` at image build time (not pinned); force a refresh with either
# `--no-cache` or `--build-arg MODEL_CACHEBUST=$(date +%s)`.
ARG MODEL_REPO_URL=https://github.com/COVESA/s2dm-example-charging-session-model.git
ARG MODEL_BRANCH=main
ARG MODEL_CACHEBUST=

# Inlined into the Vite bundle. Must match the published host port for the API.
ARG VITE_API_BASE_URL=http://localhost:51264

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    NODE_MAJOR=22 \
    VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      git \
      gnupg \
 && mkdir -p /etc/apt/keyrings \
 && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
      | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
 && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
      > /etc/apt/sources.list.d/nodesource.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir "uv>=0.5.0"

RUN git clone --branch "${S2DM_BRANCH}" "${S2DM_REPO_URL}" /opt/s2dm \
 && git -C /opt/s2dm checkout "${S2DM_COMMIT}"

WORKDIR /opt/s2dm

COPY playground-preload.patch /tmp/playground-preload.patch
RUN git apply --verbose /tmp/playground-preload.patch

RUN echo "MODEL_CACHEBUST=${MODEL_CACHEBUST}" \
 && git clone --depth 1 --branch "${MODEL_BRANCH}" "${MODEL_REPO_URL}" /tmp/model \
 && mkdir -p /opt/s2dm/playground/public/preload \
 && cp /tmp/model/spec/*.graphql /opt/s2dm/playground/public/preload/ \
 && python -c "import json, pathlib; d=pathlib.Path('/opt/s2dm/playground/public/preload'); (d / 'manifest.json').write_text(json.dumps({'files': sorted(f.name for f in d.glob('*.graphql'))}, indent=2) + '\n')" \
 && rm -rf /tmp/model \
 && cat /opt/s2dm/playground/public/preload/manifest.json

# Install runtime Python deps only (skip dev group: jupyter, mypy, pytest, ...),
# and install s2dm as a regular wheel so the runtime stage can import it
# without needing /opt/s2dm/src copied over.
RUN uv sync --frozen --no-dev --no-editable

# Build the static bundle. Vite copies public/preload/* into dist/preload/* and
# inlines VITE_API_BASE_URL into the JS. node_modules is discarded afterward.
RUN cd /opt/s2dm/playground \
 && npm ci --no-audit --no-fund --loglevel=error \
 && npm run build \
 && rm -rf node_modules /root/.npm /root/.cache

# ---- runtime stage ---------------------------------------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/s2dm/.venv/bin:${PATH}"

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/s2dm/.venv /opt/s2dm/.venv
COPY --from=builder /opt/s2dm/playground/dist /opt/s2dm/playground/dist

WORKDIR /opt/s2dm

COPY docker-entrypoint.sh /opt/s2dm/docker-entrypoint.sh
RUN chmod +x /opt/s2dm/docker-entrypoint.sh

EXPOSE 51264 51265

ENTRYPOINT ["/opt/s2dm/docker-entrypoint.sh"]
