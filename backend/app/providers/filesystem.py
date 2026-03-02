"""Filesystem-based data provider reading from local evals directories."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Optional

from ..config import settings
from ..schemas.eval import (
    CompletenessResult,
    FormCompletenessResult,
    FormGroundednessResult,
    GroundednessResult,
)
from ..schemas.session import (
    SessionDetail,
    SessionScores,
    SessionSummary,
    TranscriptData,
)
from .base import DataProvider


def _read_json(path: Path) -> Optional[dict[str, Any]]:
    try:
        return json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def _parse_timestamp(session_id: str) -> str:
    """Extract YYYYMMDD_HHMMSS from session ID and format as readable date."""
    match = re.search(r"(\d{8})_(\d{6})$", session_id)
    if not match:
        return ""
    date_str, time_str = match.group(1), match.group(2)
    return (
        f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]} "
        f"{time_str[:2]}:{time_str[2:4]}:{time_str[4:6]}"
    )


def _extract_video_name(video_file: str) -> str:
    """Extract just the filename from a video path."""
    return Path(video_file).name if video_file else ""


def _resolve_path(path_str: str) -> Path:
    """Resolve a path, trying absolute, project root, and evals/ subdirectory."""
    p = Path(path_str)
    if p.is_absolute() and p.exists():
        return p
    # Try relative to project root
    candidate = settings.project_root / p
    if candidate.exists():
        return candidate
    # Try relative to evals/ (some eval.json files use paths like "resources/data/...")
    candidate = settings.project_root / "evals" / p
    if candidate.exists():
        return candidate
    # Return best guess
    return settings.project_root / p if not p.is_absolute() else p


def _find_video_file(video_path_str: str) -> Optional[Path]:
    """Find the video file, handling relative paths and case-insensitive extensions."""
    video_path = _resolve_path(video_path_str)
    if video_path.exists():
        return video_path
    # Try case variations
    parent = video_path.parent
    stem = video_path.stem
    if parent.exists():
        for ext in [".mp4", ".MP4", ".mov", ".MOV"]:
            candidate = parent / f"{stem}{ext}"
            if candidate.exists():
                return candidate
    return None


def _find_thumbnail(video_path_str: str) -> Optional[Path]:
    """Find a thumbnail image in the same directory as the video."""
    video_path = _resolve_path(video_path_str)
    parent = video_path.parent
    if not parent.exists():
        return None
    # Look for jpg files with similar name prefix
    stem = video_path.stem
    # Try exact stem match first
    for ext in [".jpg", ".jpeg", ".png"]:
        candidate = parent / f"{stem}{ext}"
        if candidate.exists():
            return candidate
    # Try finding any jpg with matching prefix (e.g. _1.jpg, _2.jpg)
    base_stem = re.sub(r"_\d+$", "", stem)
    for f in sorted(parent.glob(f"{base_stem}*")):
        if f.suffix.lower() in (".jpg", ".jpeg", ".png"):
            return f
    return None


class FilesystemProvider(DataProvider):
    def __init__(self) -> None:
        self.sessions_dir = settings.sessions_dir

    def _load_eval(self, session_dir: Path) -> Optional[dict[str, Any]]:
        """Load eval.json, falling back to individual files."""
        eval_data = _read_json(session_dir / "eval.json")
        if eval_data:
            return eval_data

        # Fall back to individual files
        result: dict[str, Any] = {"session_id": session_dir.name}
        for name in ("groundedness", "completeness", "form_groundedness", "form_completeness"):
            data = _read_json(session_dir / f"{name}.json")
            if data:
                result[name] = data
        return result if len(result) > 1 else None

    def list_sessions(self) -> list[SessionSummary]:
        if not self.sessions_dir.exists():
            return []

        summaries: list[SessionSummary] = []
        for session_dir in sorted(self.sessions_dir.iterdir(), reverse=True):
            if not session_dir.is_dir():
                continue

            eval_data = self._load_eval(session_dir)
            scores = SessionScores()
            video_name = ""
            evaluated_at = _parse_timestamp(session_dir.name)
            thumbnail_url: Optional[str] = None

            if eval_data:
                video_file = eval_data.get("video_file", "")
                video_name = _extract_video_name(video_file)

                if eval_data.get("evaluated_at"):
                    evaluated_at = eval_data["evaluated_at"]

                g = eval_data.get("groundedness")
                c = eval_data.get("completeness")
                fg = eval_data.get("form_groundedness")
                fc = eval_data.get("form_completeness")

                scores = SessionScores(
                    groundedness=g["score"] if g else None,
                    completeness=c["score"] if c else None,
                    form_groundedness=fg["score"] if fg else None,
                    form_completeness=fc["score"] if fc else None,
                )

                if video_file and _find_thumbnail(video_file):
                    thumbnail_url = f"/api/v1/resources/{session_dir.name}/thumbnail"

            summaries.append(
                SessionSummary(
                    id=session_dir.name,
                    video_name=video_name,
                    evaluated_at=evaluated_at,
                    scores=scores,
                    thumbnail_url=thumbnail_url,
                )
            )
        return summaries

    def get_session(self, session_id: str) -> Optional[SessionDetail]:
        session_dir = self.sessions_dir / session_id
        if not session_dir.is_dir():
            return None

        eval_data = self._load_eval(session_dir)
        transcript_data = _read_json(session_dir / "transcript.json")
        form_data = _read_json(session_dir / "form.json")

        video_url: Optional[str] = None
        video_name = ""
        model = ""
        evaluated_at = _parse_timestamp(session_id)

        if eval_data:
            video_file = eval_data.get("video_file", "")
            video_name = _extract_video_name(video_file)
            model = eval_data.get("model", "")
            if eval_data.get("evaluated_at"):
                evaluated_at = eval_data["evaluated_at"]
            if video_file and _find_video_file(video_file):
                video_url = f"/api/v1/resources/{session_id}/video"

        transcript = None
        if transcript_data:
            transcript = TranscriptData(
                observation=transcript_data.get("observation", []),
                transcript=transcript_data.get("transcript", ""),
            )

        groundedness = None
        completeness = None
        form_groundedness = None
        form_completeness = None

        if eval_data:
            if eval_data.get("groundedness"):
                groundedness = GroundednessResult(**eval_data["groundedness"])
            if eval_data.get("completeness"):
                completeness = CompletenessResult(**eval_data["completeness"])
            if eval_data.get("form_groundedness"):
                form_groundedness = FormGroundednessResult(**eval_data["form_groundedness"])
            if eval_data.get("form_completeness"):
                form_completeness = FormCompletenessResult(**eval_data["form_completeness"])

        return SessionDetail(
            id=session_id,
            video_name=video_name,
            evaluated_at=evaluated_at,
            model=model,
            video_url=video_url,
            transcript=transcript,
            form=form_data,
            groundedness=groundedness,
            completeness=completeness,
            form_groundedness=form_groundedness,
            form_completeness=form_completeness,
        )

    def get_video_path(self, session_id: str) -> Optional[Path]:
        session_dir = self.sessions_dir / session_id
        eval_data = _read_json(session_dir / "eval.json")
        if not eval_data:
            return None
        video_file = eval_data.get("video_file", "")
        if not video_file:
            return None
        return _find_video_file(video_file)

    def get_thumbnail_path(self, session_id: str) -> Optional[Path]:
        session_dir = self.sessions_dir / session_id
        eval_data = _read_json(session_dir / "eval.json")
        if not eval_data:
            return None
        video_file = eval_data.get("video_file", "")
        if not video_file:
            return None
        return _find_thumbnail(video_file)
