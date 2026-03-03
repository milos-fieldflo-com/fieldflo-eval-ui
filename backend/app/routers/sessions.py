from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..providers.langfuse import LangfuseProvider
from ..schemas.session import SessionDetail, SessionSummary
from ..services.eval_runner import eval_runner
from ._time_range import parse_from_timestamp

router = APIRouter(prefix="/api/v1/evaluations", tags=["evaluations"])
provider = LangfuseProvider()


# --- Request/response models ---

class RunEvalRequest(BaseModel):
    trace_id: str


class RunEvalResponse(BaseModel):
    eval_session_id: str
    status: str
    message: str


class EvalStatusEntry(BaseModel):
    eval_session_id: str
    status: str
    judges_completed: int
    judges_total: int
    scores: dict[str, int | None]
    error: str | None = None


# --- Endpoints ---

@router.get("", response_model=list[SessionSummary])
def list_evaluations(time_range: str | None = "7d", refresh: bool = False) -> list[SessionSummary]:
    from_ts = parse_from_timestamp(time_range)
    # Skip cache when eval runs exist so new scores appear promptly
    has_active_runs = bool(eval_runner.get_all_runs())
    sessions = provider.list_sessions(
        from_timestamp=from_ts,
        time_range=time_range or "all",
        refresh=refresh or has_active_runs,
    )

    # Overlay running state from eval_runner
    all_runs = eval_runner.get_all_runs()
    for session in sessions:
        # Strip #runN suffix to match eval_runner keys
        base_id = session.id.split("#")[0]
        run = all_runs.get(base_id)
        if run:
            session.run_status = run.status.value
            # Always overlay fresh scores when a run exists (Langfuse
            # indexing can lag behind the subprocess finishing).
            scores = provider.get_session_scores(base_id)
            completed = sum(
                1 for v in [
                    scores.groundedness,
                    scores.completeness,
                    scores.form_groundedness,
                    scores.form_completeness,
                ] if v is not None
            )
            session.judges_completed = completed
            session.judges_total = 4
            session.scores = scores

    return sessions


@router.get("/status", response_model=list[EvalStatusEntry])
def get_eval_status() -> list[EvalStatusEntry]:
    """Return status of all running/recently-completed eval runs."""
    all_runs = eval_runner.get_all_runs()
    entries: list[EvalStatusEntry] = []

    for eval_session_id, run in all_runs.items():
        scores = provider.get_session_scores(eval_session_id)
        scores_dict = {
            "groundedness": scores.groundedness,
            "completeness": scores.completeness,
            "form_groundedness": scores.form_groundedness,
            "form_completeness": scores.form_completeness,
        }
        completed = sum(1 for v in scores_dict.values() if v is not None)

        entries.append(
            EvalStatusEntry(
                eval_session_id=eval_session_id,
                status=run.status.value,
                judges_completed=completed,
                judges_total=4,
                scores=scores_dict,
                error=run.error,
            )
        )

    return entries


@router.post("/run", response_model=RunEvalResponse)
def run_evaluation(req: RunEvalRequest) -> RunEvalResponse:
    """Start an evaluation run for a specific trace."""
    provider.invalidate_cache()
    try:
        run = eval_runner.start_run(req.trace_id)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    return RunEvalResponse(
        eval_session_id=run.eval_session_id,
        status=run.status.value,
        message=f"Evaluation started for trace {req.trace_id}",
    )


@router.get("/{session_id}", response_model=SessionDetail)
def get_evaluation(session_id: str, refresh: bool = False) -> SessionDetail:
    session = provider.get_session(session_id, refresh=refresh)
    if not session:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    return session
