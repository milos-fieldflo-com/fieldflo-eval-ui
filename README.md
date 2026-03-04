# FieldFlo Evals UI

Web interface for browsing and running JHA evaluation results stored in Langfuse.

## Architecture

```
evals-ui/
  frontend (Vite + React)  ->  nginx (:3100)  ->  /api/* proxy
  backend  (FastAPI)        ->  uvicorn (:3101)
```

The backend Docker image vendors code from the sibling `evals/` directory
(evaluators, runner scripts, JHA reference data) so it can spawn eval
subprocesses without a separate install. The build context is set to the
parent `ms/` directory to make both `evals-ui/` and `evals/` available
during the build.

## Prerequisites

- Docker & Docker Compose

## Environment variables

Create `backend/.env` with the following:

| Variable | Required | Description |
|----------|----------|-------------|
| `LANGFUSE_PUBLIC_KEY` | yes | Langfuse project public key |
| `LANGFUSE_SECRET_KEY` | yes | Langfuse project secret key |
| `LANGFUSE_BASE_URL` | no | Langfuse host (default: `https://us.cloud.langfuse.com`) |
| `GEMINI_API_KEY` | yes | Google Gemini API key (used by eval judges) |
| `S3_BUCKET` | no | S3 bucket name for video storage (e.g. `fieldflo-eval-data`). When set, videos and thumbnails are served via presigned S3 URLs instead of local files. |
| `AWS_ACCESS_KEY_ID` | if S3 | AWS / S3-compatible access key |
| `AWS_SECRET_ACCESS_KEY` | if S3 | AWS / S3-compatible secret key |
| `AWS_ENDPOINT_URL_S3` | if S3 | Custom S3 endpoint (e.g. `https://t3.storage.dev` for Tigris) |
| `AWS_REGION` | if S3 | AWS region (use `auto` for Tigris) |

## Build & run

From the `evals-ui/` directory:

```bash
docker compose up -d --build
```

The frontend is served at **http://localhost:3100**.

### Build targets

The backend Dockerfile has two targets:

- **`base`** (default) — no local video data; requires `S3_BUCKET` to serve videos.
- **`dev`** — copies `evals/resources/data/` into the image so videos are available locally without S3.

To use the dev target:

```bash
BUILD_TARGET=dev docker compose up -d --build
```

### Vendored evals code

The backend Dockerfile copies specific files from the `evals/` repo into the image:

- `evals/evaluators/` — judge implementations
- `evals/run_evals_langfuse.py`, `evals/run_evals.py` — eval runner scripts
- `evals/resources/jha_json/` — reference JHA data for judges

This means the backend can spawn eval subprocesses directly. Changes to
evaluator code require a Docker rebuild to take effect.

## Local development (without Docker)

From the `evals-ui/` directory:

```bash
npm run dev
```

This starts both the Vite dev server (:3100) and the FastAPI backend (:3101)
with hot reload via `concurrently`. Requires Node.js 20+ and Python 3.11+
with `uv` installed.
