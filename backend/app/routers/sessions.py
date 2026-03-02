from fastapi import APIRouter, HTTPException

from ..providers.filesystem import FilesystemProvider
from ..schemas.session import SessionDetail, SessionSummary

router = APIRouter(prefix="/api/v1/sessions", tags=["sessions"])
provider = FilesystemProvider()


@router.get("", response_model=list[SessionSummary])
def list_sessions() -> list[SessionSummary]:
    return provider.list_sessions()


@router.get("/{session_id}", response_model=SessionDetail)
def get_session(session_id: str) -> SessionDetail:
    session = provider.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
