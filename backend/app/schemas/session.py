"""Response models for session endpoints."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel

from .eval import (
    CompletenessResult,
    FormCompletenessResult,
    FormGroundednessResult,
    GroundednessResult,
)


class SessionScores(BaseModel):
    groundedness: Optional[int] = None
    completeness: Optional[int] = None
    form_groundedness: Optional[int] = None
    form_completeness: Optional[int] = None


class SessionSummary(BaseModel):
    id: str
    video_name: str = ""
    evaluated_at: str = ""
    scores: SessionScores = SessionScores()
    thumbnail_url: Optional[str] = None
    trace_id: Optional[str] = None
    run_status: Optional[str] = None  # "running" | "completed" | "failed" | None
    judges_completed: Optional[int] = None
    judges_total: Optional[int] = None


class TranscriptData(BaseModel):
    observation: list[str] = []
    transcript: str = ""


class SessionDetail(BaseModel):
    id: str
    video_name: str = ""
    evaluated_at: str = ""
    model: str = ""
    video_url: Optional[str] = None
    transcript: Optional[TranscriptData] = None
    form: Optional[dict[str, Any]] = None
    groundedness: Optional[GroundednessResult] = None
    completeness: Optional[CompletenessResult] = None
    form_groundedness: Optional[FormGroundednessResult] = None
    form_completeness: Optional[FormCompletenessResult] = None
