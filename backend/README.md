# Backend (GraphQL API)

Schema-first GraphQL API implemented with **Express + Apollo Server**.

## Prerequisites

- Node.js 24+
- npm 10+

## Environment variables

For local development, this service expects a `.env` file **in this folder**.

Recommended approach (single source of truth):

```bash
# from repo root
cp .env.example .env
cp .env backend/.env
```

Key vars used by the backend:

- `BACKEND_URL` (default `http://localhost:4000`) – backend derives its bind port from this
- `BACKEND_CORS_ORIGIN` (default `http://localhost:3000`)
- `SIMULATOR_URL` (default `http://localhost:8000`) – backend calls the simulator at this URL

## Install

From the repo root (recommended):

```bash
npm install
```

## Generate types (schema-first workflow)

The SDL is the source of truth: `backend/schema/schema.graphql`.

Run codegen:

```bash
# from repo root
npm run codegen -w backend
```

## Run (local dev, without Docker)

```bash
cd backend
npm run dev
```

### Endpoints

- GraphQL: `{BACKEND_URL}/graphql` (e.g. `http://localhost:4000/graphql`)
- Health: `{BACKEND_URL}/health`
