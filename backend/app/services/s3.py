"""S3 helpers for video/thumbnail resolution."""

from __future__ import annotations

import re
import time
from typing import Any

import boto3
from botocore.exceptions import ClientError

from ..config import settings

_client: Any | None = None


class _CacheEntry:
    __slots__ = ("data", "expires_at")

    def __init__(self, data: Any, ttl: float) -> None:
        self.data = data
        self.expires_at = time.monotonic() + ttl

    @property
    def valid(self) -> bool:
        return time.monotonic() < self.expires_at


_head_cache: dict[str, _CacheEntry] = {}
_thumb_cache: dict[str, _CacheEntry] = {}
_CACHE_TTL = 3600  # 1 hour


def _get_client() -> Any:
    global _client
    if _client is None:
        _client = boto3.client("s3")
    return _client


def head_object(key: str) -> bool:
    """Return True if the object exists in the configured bucket."""
    cached = _head_cache.get(key)
    if cached and cached.valid:
        return cached.data

    try:
        _get_client().head_object(Bucket=settings.s3_bucket, Key=key)
        result = True
    except ClientError:
        result = False

    _head_cache[key] = _CacheEntry(result, _CACHE_TTL)
    return result


def generate_presigned_url(key: str, expires_in: int = 3600) -> str:
    """Generate a presigned GET URL for the object."""
    return _get_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": key},
        ExpiresIn=expires_in,
    )


def find_thumbnail_key(video_key: str) -> str | None:
    """List objects in the same prefix as video_key, return the first
    .jpg/.jpeg/.png that isn't the video file itself and doesn't match
    the frame-capture pattern (image\\d+_\\d+)."""
    cached = _thumb_cache.get(video_key)
    if cached and cached.valid:
        return cached.data

    from pathlib import PurePosixPath

    prefix = str(PurePosixPath(video_key).parent) + "/"
    video_name = PurePosixPath(video_key).name

    try:
        resp = _get_client().list_objects_v2(
            Bucket=settings.s3_bucket, Prefix=prefix, MaxKeys=50
        )
    except ClientError:
        _thumb_cache[video_key] = _CacheEntry(None, _CACHE_TTL)
        return None

    for obj in resp.get("Contents", []):
        obj_key = obj["Key"]
        name = PurePosixPath(obj_key).name
        if name == video_name:
            continue
        suffix = PurePosixPath(name).suffix.lower()
        if suffix not in (".jpg", ".jpeg", ".png"):
            continue
        if re.search(r"image\d+_\d+", name):
            continue
        _thumb_cache[video_key] = _CacheEntry(obj_key, _CACHE_TTL)
        return obj_key

    _thumb_cache[video_key] = _CacheEntry(None, _CACHE_TTL)
    return None
