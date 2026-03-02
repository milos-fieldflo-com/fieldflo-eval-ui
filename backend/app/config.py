from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Project root (ms/)
    project_root: Path = Path(__file__).resolve().parents[3]
    # Path to evals/results/sessions/
    sessions_dir: Path = Path(__file__).resolve().parents[3] / "evals" / "results" / "sessions"
    # Path to evals/resources/data/
    resources_dir: Path = Path(__file__).resolve().parents[3] / "evals" / "resources" / "data"
    # CORS
    cors_origins: list[str] = ["http://127.0.0.1:3100", "http://localhost:3100"]


settings = Settings()
