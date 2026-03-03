FROM python:3.11-slim

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

COPY evals/ .

# Run backend
WORKDIR /app/backend
EXPOSE 3101
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3101"]
