"""Shared utility to parse time_range query string into a from_timestamp datetime."""

from datetime import datetime, timedelta, timezone

TIME_RANGE_MAP = {
    "1h": timedelta(hours=1),
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
}


def parse_from_timestamp(time_range: str | None) -> datetime | None:
    if not time_range or time_range == "all":
        return None
    delta = TIME_RANGE_MAP.get(time_range)
    if not delta:
        return None
    return datetime.now(timezone.utc) - delta
