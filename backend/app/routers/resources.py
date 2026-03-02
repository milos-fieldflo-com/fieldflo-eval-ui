import mimetypes

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..providers.filesystem import FilesystemProvider

router = APIRouter(prefix="/api/v1/resources", tags=["resources"])
provider = FilesystemProvider()


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
