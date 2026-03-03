"""Langfuse-backed data provider — reads eval results from Langfuse traces."""

from __future__ import annotations

import json
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from langfuse import Langfuse

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

logger = logging.getLogger(__name__)

JUDGE_NAME_TO_KEY = {
    "gemini-groundedness-judge": "groundedness",
    "gemini-completeness-judge": "completeness",
    "gemini-form-groundedness-judge": "form_groundedness",
    "gemini-form-completeness-judge": "form_completeness",
}

KEY_TO_RESULT_CLS: dict[str, type] = {
    "groundedness": GroundednessResult,
    "completeness": CompletenessResult,
    "form_groundedness": FormGroundednessResult,
    "form_completeness": FormCompletenessResult,
}

VIDEO_EXTENSIONS = {".mov", ".mp4", ".avi", ".mkv", ".webm"}


# ---------------------------------------------------------------------------
# Local video / thumbnail resolution
# ---------------------------------------------------------------------------

def _build_dir_index() -> dict[str, Path]:
    """Build a lookup from subdir name (e.g. 'multi_1772467594') to its Path."""
    data_dir = settings.resources_dir
    index: dict[str, Path] = {}
    if not data_dir.is_dir():
        return index
    for subdir in data_dir.iterdir():
        if subdir.is_dir() and not subdir.name.startswith("."):
            index[subdir.name] = subdir
    return index


def _find_video_in_dir(directory: Path) -> Path | None:
    """Find the first video file in a directory."""
    for f in directory.iterdir():
        if f.suffix.lower() in VIDEO_EXTENSIONS:
            return f
    return None


def _find_thumbnail_in_dir(directory: Path, video_path: Path | None = None) -> Path | None:
    """Find a thumbnail image in a directory, preferring one matching the video stem."""
    if video_path:
        stem = video_path.stem
        for ext in (".jpg", ".jpeg", ".png"):
            candidate = directory / f"{stem}{ext}"
            if candidate.exists():
                return candidate
    # Fall back to any image that isn't a frame capture (image*_N.jpg)
    for f in sorted(directory.iterdir()):
        if f.suffix.lower() in (".jpg", ".jpeg", ".png"):
            if not re.search(r"image\d+_\d+", f.name):
                return f
    return None


def _extract_subdir_name(video_key: str) -> str | None:
    """Extract the multi_* (or text_*) subdir name from a video_key path.

    video_key example: 'demo-sales/psi_jha/Mar_02_2026/multi_1772467594/608_...9385.mov'
    Returns: 'multi_1772467594'
    """
    parts = Path(video_key).parts
    for part in parts:
        if re.match(r"^(multi|text)_\d+$", part):
            return part
    return None


def resolve_video_key(video_key: str, dir_index: dict[str, Path]) -> tuple[Path | None, Path | None]:
    """Map a Langfuse video_key to a local (video_path, thumbnail_path) pair."""
    subdir_name = _extract_subdir_name(video_key)
    if not subdir_name:
        return None, None
    subdir = dir_index.get(subdir_name)
    if not subdir:
        return None, None
    video_path = _find_video_in_dir(subdir)
    thumbnail_path = _find_thumbnail_in_dir(subdir, video_path)
    return video_path, thumbnail_path


def _extract_score(output: Any) -> int | None:
    """Extract a score from a trace output, whether it's a dict or JSON string."""
    if isinstance(output, dict) and "score" in output:
        return output["score"]
    if isinstance(output, str):
        try:
            parsed = json.loads(output)
            if isinstance(parsed, dict) and "score" in parsed:
                return parsed["score"]
        except (json.JSONDecodeError, ValueError):
            pass
        # Fallback: regex for malformed JSON from Gemini
        m = re.search(r'"score"\s*:\s*(\d+)', output)
        if m:
            return int(m.group(1))
    return None


def _parse_output(raw: Any, cls: type) -> Any | None:
    """Parse a generation output (string or dict) into a Pydantic model."""
    if raw is None:
        return None
    try:
        if isinstance(raw, str):
            return cls.model_validate_json(raw)
        if isinstance(raw, dict):
            return cls.model_validate(raw)
    except Exception:
        logger.warning("Failed to parse %s output", cls.__name__, exc_info=True)
    return None


def _fetch_all_traces(lf: Langfuse, name: str, **kwargs: Any) -> list:
    """Paginate through all traces with the given name."""
    all_traces = []
    page = 1
    while True:
        resp = lf.api.trace.list(limit=100, name=name, page=page, **kwargs)
        all_traces.extend(resp.data)
        if len(resp.data) < 100:
            break
        page += 1
    return all_traces


class _CacheEntry:
    __slots__ = ("data", "expires_at")

    def __init__(self, data: Any, ttl: float) -> None:
        self.data = data
        self.expires_at = time.monotonic() + ttl

    @property
    def valid(self) -> bool:
        return time.monotonic() < self.expires_at


class LangfuseProvider(DataProvider):
    _LIST_SESSIONS_TTL = 30  # seconds

    def __init__(self) -> None:
        self._lf = Langfuse(
            public_key=settings.langfuse_public_key,
            secret_key=settings.langfuse_secret_key,
            host=settings.langfuse_base_url,
            timeout=30,
        )
        self._dir_index: dict[str, Path] | None = None
        self._list_sessions_cache: dict[str, _CacheEntry] = {}

    def invalidate_cache(self) -> None:
        self._list_sessions_cache.clear()

    @property
    def dir_index(self) -> dict[str, Path]:
        if self._dir_index is None:
            self._dir_index = _build_dir_index()
        return self._dir_index

    def _resolve_video_key(self, video_key: str) -> tuple[Path | None, Path | None]:
        """Resolve a video_key to (video_path, thumbnail_path)."""
        return resolve_video_key(video_key, self.dir_index)

    def _get_video_key_for_session(self, session_id: str) -> str:
        """Fetch the video_key from the jha-chat trace for a session."""
        trace_id = session_id.removeprefix("eval_")
        try:
            t = self._lf.api.trace.get(trace_id)
            return str((t.metadata or {}).get("video_key", "") or "")
        except Exception:
            return ""

    # ------------------------------------------------------------------
    # get_session_scores — check Langfuse for judge traces on a session
    # ------------------------------------------------------------------

    def get_session_scores(self, session_id: str) -> SessionScores:
        """Query Langfuse for judge traces for a session, returning partial scores."""
        try:
            judge_traces = self._lf.api.trace.list(
                session_id=session_id, limit=100
            )
        except Exception:
            logger.warning("Failed to fetch judge traces for %s", session_id)
            return SessionScores()

        scores: dict[str, int | None] = {}
        for t in judge_traces.data:
            if t.name not in JUDGE_NAME_TO_KEY:
                continue
            key = JUDGE_NAME_TO_KEY[t.name]
            output = t.output if hasattr(t, "output") else None
            score = _extract_score(output)
            if score is not None:
                scores[key] = score

        return SessionScores(
            groundedness=scores.get("groundedness"),
            completeness=scores.get("completeness"),
            form_groundedness=scores.get("form_groundedness"),
            form_completeness=scores.get("form_completeness"),
        )

    # ------------------------------------------------------------------
    # list_sessions — unified view of all jha-chat traces with local video
    # ------------------------------------------------------------------

    def list_sessions(
        self,
        from_timestamp: datetime | None = None,
        evaluated_only: bool = True,
        time_range: str = "7d",
    ) -> list[SessionSummary]:
        ts_kwargs: dict[str, Any] = {}
        if from_timestamp:
            ts_kwargs["from_timestamp"] = from_timestamp

        # Check cache (key on time_range string, not the computed datetime)
        cache_key = f"{time_range}:{evaluated_only}"
        cached = self._list_sessions_cache.get(cache_key)
        if cached and cached.valid:
            return cached.data

        # 1) Fetch all jha-chat video traces
        jha_traces = _fetch_all_traces(
            self._lf, "jha-chat", tags=["video"], **ts_kwargs
        )
        if not jha_traces:
            return []

        # 2) For each trace, resolve video_key -> local video
        #    Only include traces where the video resolves locally.
        dir_idx = self.dir_index

        def _resolve_trace(trace: Any) -> dict | None:
            vk = str((trace.metadata or {}).get("video_key", "") or "")
            if not vk:
                return None
            video_path, thumb_path = resolve_video_key(vk, dir_idx)
            if not video_path:
                return None
            eval_session_id = f"eval_{trace.id}"
            video_name = video_path.name if video_path else Path(vk).name
            thumb_url = (
                f"/api/v1/resources/{eval_session_id}/thumbnail"
                if thumb_path else None
            )
            ts = str(trace.timestamp) if trace.timestamp else ""
            return {
                "trace_id": trace.id,
                "eval_session_id": eval_session_id,
                "video_name": video_name,
                "thumbnail_url": thumb_url,
                "timestamp": ts,
            }

        resolved: list[dict] = []
        with ThreadPoolExecutor(max_workers=8) as pool:
            futs = [pool.submit(_resolve_trace, t) for t in jha_traces]
            for fut in futs:
                result = fut.result()
                if result:
                    resolved.append(result)

        if not resolved:
            return []

        # 3) Fetch judge traces per resolved session (much faster than global fetch)
        def _fetch_session_judges(session_id: str) -> tuple[str, list]:
            try:
                resp = self._lf.api.trace.list(session_id=session_id, limit=100)
                judges = [t for t in resp.data if t.name in JUDGE_NAME_TO_KEY]
                return session_id, judges
            except Exception:
                return session_id, []

        session_ids = [info["eval_session_id"] for info in resolved]
        all_judge_by_session: dict[str, list] = {}
        with ThreadPoolExecutor(max_workers=8) as pool:
            futs = [pool.submit(_fetch_session_judges, sid) for sid in session_ids]
            for fut in futs:
                sid, judges = fut.result()
                if judges:
                    all_judge_by_session[sid] = judges


        # Cluster into runs: traces within 5 minutes = same run
        run_gap_seconds = 300
        runs_map: dict[str, list[dict]] = {}  # sid -> [{scores, timestamp}, ...]

        for sid, traces in all_judge_by_session.items():
            traces.sort(key=lambda t: t.timestamp)
            clusters: list[list] = []
            current: list = [traces[0]]

            for t in traces[1:]:
                gap = (t.timestamp - current[-1].timestamp).total_seconds()
                if gap > run_gap_seconds:
                    clusters.append(current)
                    current = [t]
                else:
                    current.append(t)
            clusters.append(current)

            runs = []
            for cluster in clusters:
                scores: dict[str, int | None] = {}
                for t in cluster:
                    name = t.name if hasattr(t, "name") else None
                    if name not in JUDGE_NAME_TO_KEY:
                        continue
                    key = JUDGE_NAME_TO_KEY[name]
                    output = t.output if hasattr(t, "output") else None
                    score = _extract_score(output)
                    if score is not None:
                        scores[key] = score
                ts = str(cluster[0].timestamp) if cluster[0].timestamp else ""
                runs.append({"scores": scores, "timestamp": ts})

            runs_map[sid] = runs

        # 5) Build unified list — one row per (trace, run)
        summaries: list[SessionSummary] = []
        for info in resolved:
            sid = info["eval_session_id"]
            runs = runs_map.get(sid, [])

            if not runs:
                # No eval runs yet — show the trace with empty scores
                summaries.append(
                    SessionSummary(
                        id=sid,
                        trace_id=info["trace_id"],
                        video_name=info["video_name"],
                        evaluated_at=info["timestamp"][:19].replace("T", " "),
                        scores=SessionScores(),
                        thumbnail_url=info["thumbnail_url"],
                    )
                )
            else:
                for i, run in enumerate(runs):
                    scores = run["scores"]
                    ts_raw = run["timestamp"]
                    evaluated_at = ts_raw[:19].replace("T", " ") if ts_raw else ""
                    # Use run index suffix for uniqueness when multiple runs
                    row_id = f"{sid}#run{i + 1}" if len(runs) > 1 else sid

                    summaries.append(
                        SessionSummary(
                            id=row_id,
                            trace_id=info["trace_id"],
                            video_name=info["video_name"],
                            evaluated_at=evaluated_at,
                            scores=SessionScores(
                                groundedness=scores.get("groundedness"),
                                completeness=scores.get("completeness"),
                                form_groundedness=scores.get("form_groundedness"),
                                form_completeness=scores.get("form_completeness"),
                            ),
                            thumbnail_url=info["thumbnail_url"],
                        )
                    )

        if evaluated_only:
            summaries = [
                s for s in summaries
                if s.scores.groundedness is not None
                or s.scores.completeness is not None
                or s.scores.form_groundedness is not None
                or s.scores.form_completeness is not None
                or s.run_status is not None
            ]

        summaries.sort(key=lambda s: s.evaluated_at, reverse=True)

        self._list_sessions_cache[cache_key] = _CacheEntry(summaries, self._LIST_SESSIONS_TTL)
        return summaries

    # ------------------------------------------------------------------
    # get_session
    # ------------------------------------------------------------------

    def get_session(self, session_id: str) -> SessionDetail | None:
        trace_id = session_id.removeprefix("eval_")

        # 1) Fetch jha-chat trace for transcript + form
        try:
            jha_trace = self._lf.api.trace.get(trace_id)
        except Exception:
            logger.warning("jha-chat trace %s not found", trace_id)
            jha_trace = None

        video_name = ""
        video_url: str | None = None
        model = ""
        evaluated_at = ""
        transcript: TranscriptData | None = None
        form: dict[str, Any] | None = None

        if jha_trace:
            vk = str((jha_trace.metadata or {}).get("video_key", "") or "")
            video_path, _ = self._resolve_video_key(vk)
            video_name = video_path.name if video_path else Path(vk).name if vk else ""
            if video_path:
                video_url = f"/api/v1/resources/{session_id}/video"

            model = str((jha_trace.metadata or {}).get("model_name", "") or "")
            if jha_trace.timestamp:
                evaluated_at = str(jha_trace.timestamp)[:19].replace("T", " ")

            # Extract transcript and form from observations
            for obs in jha_trace.observations or []:
                obs_name = obs.name if hasattr(obs, "name") else None
                obs_output = obs.output if hasattr(obs, "output") else None
                if not obs_output:
                    continue

                if obs_name == "multimodal-processing" and isinstance(obs_output, dict):
                    transcript = TranscriptData(
                        observation=obs_output.get("observations", []),
                        transcript=obs_output.get("transcript", ""),
                    )

                elif obs_name == "gemini-chat" and isinstance(obs_output, dict):
                    form = obs_output

        # 2) Fetch judge traces for this session
        judge_traces = self._lf.api.trace.list(session_id=session_id, limit=100)

        groundedness: GroundednessResult | None = None
        completeness: CompletenessResult | None = None
        form_groundedness: FormGroundednessResult | None = None
        form_completeness: FormCompletenessResult | None = None

        judge_by_name: dict[str, list] = {}
        for t in judge_traces.data:
            if t.name in JUDGE_NAME_TO_KEY:
                judge_by_name.setdefault(t.name, []).append(t)

        for judge_name, traces in judge_by_name.items():
            traces.sort(key=lambda x: x.timestamp, reverse=True)
            latest = traces[0]

            try:
                full_trace = self._lf.api.trace.get(latest.id)
            except Exception:
                logger.warning("Failed to fetch judge trace %s", latest.id)
                continue

            raw_output = None
            for obs in full_trace.observations or []:
                obs_name = getattr(obs, "name", None)
                if obs_name == judge_name:
                    raw_output = getattr(obs, "output", None)
                    break

            key = JUDGE_NAME_TO_KEY[judge_name]
            cls = KEY_TO_RESULT_CLS[key]
            result = _parse_output(raw_output, cls)

            if key == "groundedness":
                groundedness = result
            elif key == "completeness":
                completeness = result
            elif key == "form_groundedness":
                form_groundedness = result
            elif key == "form_completeness":
                form_completeness = result

        return SessionDetail(
            id=session_id,
            video_name=video_name,
            evaluated_at=evaluated_at,
            model=model,
            video_url=video_url,
            transcript=transcript,
            form=form,
            groundedness=groundedness,
            completeness=completeness,
            form_groundedness=form_groundedness,
            form_completeness=form_completeness,
        )

    # ------------------------------------------------------------------
    # Video / thumbnail paths
    # ------------------------------------------------------------------

    def get_video_path(self, session_id: str) -> Path | None:
        vk = self._get_video_key_for_session(session_id)
        if not vk:
            return None
        video_path, _ = self._resolve_video_key(vk)
        return video_path

    def get_thumbnail_path(self, session_id: str) -> Path | None:
        vk = self._get_video_key_for_session(session_id)
        if not vk:
            return None
        _, thumb_path = self._resolve_video_key(vk)
        return thumb_path
