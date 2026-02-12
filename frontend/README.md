# Frontend (Next.js)

Next.js (App Router) client that calls the backend GraphQL API and provides basic simulator controls.

## Prerequisites

- Node.js 24+
- npm 10+

## Environment variables

For local development, Next.js expects a `.env` file **in this folder**.

Recommended approach (single source of truth):

```bash
# from repo root
cp .env.example .env
cp .env frontend/.env
```

Key vars used by the frontend (URLs include the port when needed):

- `NEXT_PUBLIC_GRAPHQL_URL` (default `http://localhost:4000/graphql`)
- `NEXT_PUBLIC_SIMULATOR_URL` (default `http://localhost:8000`)

## Install

From the repo root (recommended):

```bash
npm install
```

## Generate types (operations + schema)

Frontend codegen reads the schema directly from `../backend/schema/schema.graphql`.

Run codegen:

```bash
# from repo root
npm run codegen -w frontend
```

## Run (local dev, without Docker)

```bash
cd frontend
npm run dev
```

Then open `http://localhost:3000`.

