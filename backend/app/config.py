import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load .env from the backend directory
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def _find_project_root() -> Path:
    """Find the project root (ms/).

    Uses PROJECT_ROOT env var if set (e.g. in Docker), otherwise walks up
    from this file looking for evals/resources as a landmark.
    """
    env_root = os.environ.get("PROJECT_ROOT")
    if env_root:
        return Path(env_root)
    candidate = Path(__file__).resolve().parent.parent  # backend/
    for _ in range(8):
        candidate = candidate.parent
        if (candidate / "evals" / "resources").is_dir():
            return candidate
    # Fallback to original heuristic
    return Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    # Project root (ms/)
    project_root: Path = _find_project_root()
    # Path to evals/results/sessions/
    sessions_dir: Path = _find_project_root() / "evals" / "results" / "sessions"
    # Path to evals/resources/data/
    resources_dir: Path = _find_project_root() / "evals" / "resources" / "data"
    # CORS
    cors_origins: list[str] = ["http://127.0.0.1:3100", "http://localhost:3100"]
    # Langfuse
    langfuse_public_key: Optional[str] = None
    langfuse_secret_key: Optional[str] = None
    langfuse_base_url: str = "https://us.cloud.langfuse.com"


settings = Settings()
