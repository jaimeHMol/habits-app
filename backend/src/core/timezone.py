from typing import Optional
from zoneinfo import ZoneInfo

DEFAULT_TIMEZONE = "America/Bogota"


def get_user_zone(tz_name: Optional[str]) -> ZoneInfo:
    """
    Safely resolves a ZoneInfo object for a given IANA timezone name.
    Falls back to 'America/Bogota' if invalid or not specified.
    """
    if tz_name and isinstance(tz_name, str) and len(tz_name) <= 64:
        try:
            return ZoneInfo(tz_name.strip())
        except Exception:
            pass
    return ZoneInfo(DEFAULT_TIMEZONE)


def normalize_timezone_name(tz_name: Optional[str]) -> str:
    """
    Validates an IANA timezone string and returns its canonical name.
    Raises ValueError if the provided timezone string is invalid.
    """
    if not tz_name:
        return DEFAULT_TIMEZONE
    cleaned = tz_name.strip()
    if len(cleaned) > 64 or ".." in cleaned or cleaned.startswith("/"):
        raise ValueError(f"Invalid timezone identifier: {tz_name}")
    try:
        ZoneInfo(cleaned)
        return cleaned
    except Exception as exc:
        raise ValueError(f"Invalid timezone identifier: {tz_name}") from exc
