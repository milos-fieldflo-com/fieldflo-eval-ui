"""Abstract data provider for future S3/Langfuse swap."""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from ..schemas.session import SessionDetail, SessionSummary


class DataProvider(ABC):
    @abstractmethod
    def list_sessions(self) -> list[SessionSummary]:
        ...

    @abstractmethod
    def get_session(self, session_id: str) -> Optional[SessionDetail]:
        ...

    @abstractmethod
    def get_video_path(self, session_id: str) -> Optional[Path]:
        ...

    @abstractmethod
    def get_thumbnail_path(self, session_id: str) -> Optional[Path]:
        ...
