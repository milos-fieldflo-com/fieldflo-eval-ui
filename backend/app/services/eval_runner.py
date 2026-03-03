"""Subprocess manager for running evaluations via the evals repo."""

from __future__ import annotations

import logging
import os
import subprocess
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import IO, Optional

from pydantic import BaseModel

from ..config import settings

logger = logging.getLogger(__name__)


class RunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class EvalRun(BaseModel):
    trace_id: str
    eval_session_id: str
    status: RunStatus
    started_at: datetime
    error: Optional[str] = None
    log_file: Optional[str] = None


class EvalRunManager:
    """Manages subprocess lifecycle for eval runs."""

    def __init__(self) -> None:
        self._runs: dict[str, EvalRun] = {}
        self._procs: dict[str, subprocess.Popen] = {}
        self._log_files: dict[str, IO] = {}

    def start_run(self, trace_id: str) -> EvalRun:
        eval_session_id = f"eval_{trace_id}"

        # Check for already-running
        existing = self._runs.get(eval_session_id)
        if existing and existing.status in (RunStatus.PENDING, RunStatus.RUNNING):
            proc = self._procs.get(eval_session_id)
            if proc and proc.poll() is None:
                raise ValueError(f"Evaluation {eval_session_id} is already running")

        evals_dir = settings.project_root / "evals"

        env = os.environ.copy()
        if settings.langfuse_public_key:
            env["LANGFUSE_PUBLIC_KEY"] = settings.langfuse_public_key
        if settings.langfuse_secret_key:
            env["LANGFUSE_SECRET_KEY"] = settings.langfuse_secret_key
        if settings.langfuse_base_url:
            env["LANGFUSE_HOST"] = settings.langfuse_base_url

        cmd = [
            "uv", "run", "python", "run_evals_langfuse.py",
            "--trace-id", trace_id,
        ]

        # Write subprocess output to a log file in the session results dir
        session_dir = settings.sessions_dir / eval_session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        log_path = session_dir / "subprocess.log"
        log_fh = open(log_path, "w")

        logger.info("Starting eval subprocess: %s (cwd=%s, log=%s)", " ".join(cmd), evals_dir, log_path)

        proc = subprocess.Popen(
            cmd,
            cwd=str(evals_dir),
            env=env,
            stdout=log_fh,
            stderr=subprocess.STDOUT,
        )

        run = EvalRun(
            trace_id=trace_id,
            eval_session_id=eval_session_id,
            status=RunStatus.RUNNING,
            started_at=datetime.now(timezone.utc),
            log_file=str(log_path),
        )

        self._runs[eval_session_id] = run
        self._procs[eval_session_id] = proc
        self._log_files[eval_session_id] = log_fh
        return run

    def get_run(self, eval_session_id: str) -> EvalRun | None:
        run = self._runs.get(eval_session_id)
        if not run:
            return None

        # Poll subprocess to update status
        proc = self._procs.get(eval_session_id)
        if proc and run.status == RunStatus.RUNNING:
            returncode = proc.poll()
            if returncode is not None:
                self._close_log(eval_session_id)
                if returncode == 0:
                    run.status = RunStatus.COMPLETED
                else:
                    run.status = RunStatus.FAILED
                    run.error = self._read_log_tail(run.log_file)

        return run

    def _close_log(self, eval_session_id: str) -> None:
        """Close the log file handle for a finished subprocess."""
        fh = self._log_files.pop(eval_session_id, None)
        if fh:
            try:
                fh.close()
            except Exception:
                pass

    @staticmethod
    def _read_log_tail(log_path: str | None, max_chars: int = 2000) -> str:
        """Read the tail of a log file for error context."""
        if not log_path:
            return "No log file available"
        try:
            text = Path(log_path).read_text()
            if len(text) > max_chars:
                return f"...\n{text[-max_chars:]}"
            return text
        except Exception:
            return f"Failed to read log file: {log_path}"

    def get_all_running(self) -> dict[str, EvalRun]:
        result: dict[str, EvalRun] = {}
        for eval_session_id in list(self._runs.keys()):
            run = self.get_run(eval_session_id)
            if run and run.status in (RunStatus.PENDING, RunStatus.RUNNING):
                result[eval_session_id] = run
        return result

    def get_all_runs(self) -> dict[str, EvalRun]:
        # Poll all runs to refresh status
        for eval_session_id in list(self._runs.keys()):
            self.get_run(eval_session_id)
        return dict(self._runs)


# Module-level singleton
eval_runner = EvalRunManager()
