import mimetypes
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..providers.langfuse import LangfuseProvider

router = APIRouter(prefix="/api/v1/resources", tags=["resources"])
provider = LangfuseProvider()


class VideoKeyMapping(BaseModel):
    session_id: str
    video_key: str
    video_path: Optional[str] = None
    thumbnail_path: Optional[str] = None


@router.get("/{session_id}/video-mapping", response_model=VideoKeyMapping)
def get_video_mapping(session_id: str) -> VideoKeyMapping:
    """Debug endpoint: show how a session's video_key maps to local files."""
    vk = provider._get_video_key_for_session(session_id)
    video_path, thumb_path = provider._resolve_video_key(vk) if vk else (None, None)
    return VideoKeyMapping(
        session_id=session_id,
        video_key=vk,
        video_path=str(video_path) if video_path else None,
        thumbnail_path=str(thumb_path) if thumb_path else None,
    )


@router.get("/{session_id}/video")
def get_video(session_id: str) -> FileResponse:
    path = provider.get_video_path(session_id)
    if not path:
        raise HTTPException(status_code=404, detail="Video not found")
    media_type = mimetypes.guess_type(str(path))[0] or "video/mp4"
    return FileResponse(path, media_type=media_type)


@router.get("/{session_id}/thumbnail")
def get_thumbnail(session_id: str) -> FileResponse:
    path = provider.get_thumbnail_path(session_id)
    if not path:
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    media_type = mimetypes.guess_type(str(path))[0] or "image/jpeg"
    return FileResponse(path, media_type=media_type)
