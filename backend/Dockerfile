# Build stage
FROM node:24-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# mongorestore fetch stage - kept separate so the download layer is cached
# and nothing from this stage leaks into the final image beyond the binary.
FROM debian:bookworm-slim AS tools
ARG TARGETARCH
ARG MONGO_TOOLS_VERSION=100.12.2
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && case "$TARGETARCH" in \
      amd64) TOOLS_FILE="mongodb-database-tools-debian12-x86_64-${MONGO_TOOLS_VERSION}.tgz" ;; \
      arm64) TOOLS_FILE="mongodb-database-tools-ubuntu2204-arm64-${MONGO_TOOLS_VERSION}.tgz" ;; \
      *) echo "unsupported arch: $TARGETARCH" && exit 1 ;; \
    esac \
 && curl -fsSL -o /tmp/tools.tgz "https://fastdl.mongodb.org/tools/db/${TOOLS_FILE}" \
 && tar -xzf /tmp/tools.tgz -C /tmp \
 && mv /tmp/mongodb-database-tools-*/bin/mongorestore /usr/local/bin/mongorestore \
 && chmod +x /usr/local/bin/mongorestore

# Production stage
FROM node:24-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# mongorestore is used on first boot to seed an empty database from backend/seed/charging-demo.gz.
# The binary itself (fetched in the tools stage) plus its runtime shared library (Kerberos)
# are all that's pulled in to keep the final image lean.
COPY --from=tools /usr/local/bin/mongorestore /usr/local/bin/mongorestore
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgssapi-krb5-2 \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/schema ./schema
COPY seed ./seed

EXPOSE 4000

CMD ["node", "dist/server/index.js"]
