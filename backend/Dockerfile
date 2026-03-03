FROM python:3.11-slim AS base

# Install uv (needed for backend deps AND spawning eval subprocesses)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install backend dependencies
WORKDIR /app/backend
COPY evals-ui/backend/pyproject.toml evals-ui/backend/uv.lock* ./
RUN uv sync --frozen 2>/dev/null || uv sync
COPY evals-ui/backend/ .

# Install evals package dependencies (for subprocess spawning)
WORKDIR /app/evals
COPY evals/pyproject.toml evals/uv.lock* ./
RUN uv sync --frozen 2>/dev/null || uv sync

# Copy only the evals code needed at runtime (no video data)
COPY evals/evaluators/ ./evaluators/
COPY evals/run_evals_langfuse.py evals/run_evals.py ./
COPY evals/resources/jha_json/ ./resources/jha_json/

# Create dirs that may be needed at runtime
RUN mkdir -p /app/evals/resources/data /app/evals/results/sessions

# Run backend
WORKDIR /app/backend
EXPOSE 3101
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3101"]

# Dev target: includes video data baked into the image
FROM base AS dev
COPY evals/resources/data/ /app/evals/resources/data/
