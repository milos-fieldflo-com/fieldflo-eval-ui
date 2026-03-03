"""Langfuse sessions API — filtered traces from Langfuse."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from langfuse import Langfuse
from pydantic import BaseModel

from ..config import settings
from ..providers.langfuse import (
    JUDGE_NAME_TO_KEY,
    _build_dir_index,
    _extract_score,
    resolve_video_key,
)
from ..services.eval_runner import eval_runner
from ._time_range import parse_from_timestamp

router = APIRouter(prefix="/api/v1", tags=["langfuse-sessions"])

# Cache the dir index at module level (built once)
_dir_index: dict[str, Path] | None = None


def _get_dir_index() -> dict[str, Path]:
    global _dir_index
    if _dir_index is None:
        _dir_index = _build_dir_index()
    return _dir_index


def _get_langfuse() -> Langfuse:
    if not settings.langfuse_secret_key or not settings.langfuse_public_key:
        raise HTTPException(status_code=503, detail="Langfuse not configured")
    return Langfuse(
        public_key=settings.langfuse_public_key,
        secret_key=settings.langfuse_secret_key,
        host=settings.langfuse_base_url,
        timeout=30,
    )


class LangfuseSessionSummary(BaseModel):
    id: str
    name: Optional[str] = None
    timestamp: Optional[datetime] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    release: Optional[str] = None
    version: Optional[str] = None
    tags: list[str] = []
    latency: Optional[float] = None
    total_cost: Optional[float] = None
    input_preview: Optional[str] = None
    output_preview: Optional[str] = None
    # Eval-related fields
    can_eval: bool = False
    eval_session_id: Optional[str] = None
    run_status: Optional[str] = None  # "running" | "completed" | "failed" | None
    judges_completed: Optional[int] = None
    judges_total: Optional[int] = None


class LangfuseSessionDetail(BaseModel):
    id: str
    name: Optional[str] = None
    timestamp: Optional[datetime] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    release: Optional[str] = None
    version: Optional[str] = None
    tags: list[str] = []
    metadata: Optional[Any] = None
    latency: Optional[float] = None
    total_cost: Optional[float] = None
    input: Optional[Any] = None
    output: Optional[Any] = None
    observations: list[Any] = []
    scores: list[Any] = []


def _preview(value: Any, max_len: int = 200) -> Optional[str]:
    """Truncate a value to a short preview string."""
    if value is None:
        return None
    text = str(value) if not isinstance(value, str) else value
    return text[:max_len] + "..." if len(text) > max_len else text


@router.get("/langfuse-sessions")
def list_langfuse_sessions(
    filter: Optional[str] = "jha-chat",
    time_range: Optional[str] = "7d",
) -> list[LangfuseSessionSummary]:
    lf = _get_langfuse()
    kwargs: dict[str, Any] = {"limit": 100}
    if filter == "jha-chat":
        kwargs["name"] = "jha-chat"
        kwargs["tags"] = ["video"]

    from_ts = parse_from_timestamp(time_range)
    if from_ts:
        kwargs["from_timestamp"] = from_ts

    response = lf.api.trace.list(**kwargs)

    dir_idx = _get_dir_index()
    all_runs = eval_runner.get_all_runs()

    results: list[LangfuseSessionSummary] = []
    for t in response.data:
        # Check if video resolves locally
        vk = str((t.metadata or {}).get("video_key", "") or "")
        video_path, _ = resolve_video_key(vk, dir_idx) if vk else (None, None)
        can_eval = video_path is not None

        eval_session_id = f"eval_{t.id}" if can_eval else None

        # Check if there's a running eval for this trace
        run_status = None
        judges_completed = None
        judges_total = None
        if eval_session_id:
            run = all_runs.get(eval_session_id)
            if run:
                run_status = run.status.value
                if run.status.value == "running":
                    # Check Langfuse for partial judge results
                    # Count distinct judge types that have scores
                    judge_traces = lf.api.trace.list(
                        session_id=eval_session_id, limit=20
                    )
                    seen_judges: set[str] = set()
                    for jt in judge_traces.data:
                        if jt.name in JUDGE_NAME_TO_KEY:
                            output = jt.output if hasattr(jt, "output") else None
                            if _extract_score(output) is not None:
                                seen_judges.add(jt.name)
                    judges_completed = len(seen_judges)
                    judges_total = 4

        results.append(
            LangfuseSessionSummary(
                id=t.id,
                name=t.name,
                timestamp=t.timestamp,
                user_id=t.user_id,
                session_id=t.session_id,
                release=t.release,
                version=t.version,
                tags=t.tags or [],
                latency=t.latency,
                total_cost=t.total_cost,
                input_preview=_preview(t.input),
                output_preview=_preview(t.output),
                can_eval=can_eval,
                eval_session_id=eval_session_id,
                run_status=run_status,
                judges_completed=judges_completed,
                judges_total=judges_total,
            )
        )

    return results


@router.get("/langfuse-sessions/{trace_id}")
def get_langfuse_session(trace_id: str) -> LangfuseSessionDetail:
    lf = _get_langfuse()
    try:
        t = lf.api.trace.get(trace_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Trace not found: {exc}")
    return LangfuseSessionDetail(
        id=t.id,
        name=t.name,
        timestamp=t.timestamp,
        user_id=t.user_id,
        session_id=t.session_id,
        release=t.release,
        version=t.version,
        tags=t.tags or [],
        metadata=t.metadata,
        latency=t.latency,
        total_cost=t.total_cost,
        input=t.input,
        output=t.output,
        observations=[obs.dict() if hasattr(obs, "dict") else obs for obs in (t.observations or [])],
        scores=[s.dict() if hasattr(s, "dict") else s for s in (t.scores or [])],
    )


# ---------------------------------------------------------------------------
# Eval Status Detail
# ---------------------------------------------------------------------------

JUDGE_DISPLAY_NAMES = {
    "gemini-groundedness-judge": "Groundedness",
    "gemini-completeness-judge": "Completeness",
    "gemini-form-groundedness-judge": "Form Groundedness",
    "gemini-form-completeness-judge": "Form Completeness",
}


class JudgeStatus(BaseModel):
    judge_name: str
    display_name: str
    status: str  # "pending" | "running" | "completed" | "error"
    score: Optional[int] = None
    error: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


class EvalStatusDetail(BaseModel):
    eval_session_id: str
    trace_id: str
    run_status: str  # "running" | "completed" | "failed"
    started_at: Optional[str] = None
    elapsed_seconds: Optional[float] = None
    judges: list[JudgeStatus] = []


@router.get("/langfuse-sessions/{trace_id}/eval-status")
def get_eval_status(trace_id: str) -> EvalStatusDetail:
    eval_session_id = f"eval_{trace_id}"

    # 1. Check subprocess status
    run = eval_runner.get_run(eval_session_id)
    if not run:
        raise HTTPException(status_code=404, detail="No eval run found for this trace")

    run_status = run.status.value
    started_at = run.started_at.isoformat() if run.started_at else None
    elapsed_seconds = None
    if run.started_at:
        elapsed_seconds = (datetime.now(timezone.utc) - run.started_at).total_seconds()

    # 2. Query Langfuse for judge traces
    lf = _get_langfuse()
    try:
        judge_traces = lf.api.trace.list(session_id=eval_session_id, limit=20)
    except Exception:
        judge_traces = None

    # Build map of judge_name -> trace data
    judge_trace_map: dict[str, Any] = {}
    if judge_traces:
        for jt in judge_traces.data:
            if jt.name in JUDGE_NAME_TO_KEY:
                judge_trace_map[jt.name] = jt

    # 3. Build per-judge status
    judges: list[JudgeStatus] = []
    for judge_name, display_name in JUDGE_DISPLAY_NAMES.items():
        jt = judge_trace_map.get(judge_name)
        if jt is None:
            # No trace yet
            judges.append(JudgeStatus(
                judge_name=judge_name,
                display_name=display_name,
                status="pending",
            ))
            continue

        jt_timestamp = str(jt.timestamp) if jt.timestamp else None
        output = jt.output if hasattr(jt, "output") else None
        score = _extract_score(output)

        if score is not None:
            judges.append(JudgeStatus(
                judge_name=judge_name,
                display_name=display_name,
                status="completed",
                score=score,
                started_at=jt_timestamp,
                completed_at=jt_timestamp,
            ))
        else:
            # Check for error in observations
            error_msg = None
            try:
                full_trace = lf.api.trace.get(jt.id)
                for obs in full_trace.observations or []:
                    level = getattr(obs, "level", None)
                    if level == "ERROR":
                        error_msg = getattr(obs, "status_message", None) or "Unknown error"
                        break
            except Exception:
                pass

            if error_msg:
                judges.append(JudgeStatus(
                    judge_name=judge_name,
                    display_name=display_name,
                    status="error",
                    error=error_msg,
                    started_at=jt_timestamp,
                ))
            else:
                judges.append(JudgeStatus(
                    judge_name=judge_name,
                    display_name=display_name,
                    status="running",
                    started_at=jt_timestamp,
                ))

    return EvalStatusDetail(
        eval_session_id=eval_session_id,
        trace_id=trace_id,
        run_status=run_status,
        started_at=started_at,
        elapsed_seconds=elapsed_seconds,
        judges=judges,
    )
