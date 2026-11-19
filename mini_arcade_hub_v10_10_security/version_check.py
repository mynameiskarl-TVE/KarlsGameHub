"""Game version helpers: what version this is, whether it is too old, and what the server says.

The server (supabase_version_gate_setup.sql) refuses online requests from versions older than
a minimum you set. This module sends our version with every request and lets the game explain
the problem to the player instead of showing a confusing network error.
"""
from __future__ import annotations

import re
from typing import Any

from config import APP_VERSION

VERSION_HEADER = "x-mini-arcade-version"
UPDATE_REQUIRED_CODE = "update_required"
_VERSION_PATTERN = re.compile(r"^[0-9]{1,4}(\.[0-9]{1,4}){0,2}$")


def parse_version(text: Any) -> tuple[int, int, int] | None:
    """'10.10' -> (10, 10, 0). Returns None for anything that is not a plain version number."""
    value = str(text if text is not None else "").strip()
    if not _VERSION_PATTERN.fullmatch(value):
        return None
    parts = [int(piece) for piece in value.split(".")]
    while len(parts) < 3:
        parts.append(0)
    return (parts[0], parts[1], parts[2])


def is_older(have: Any, need: Any) -> bool:
    """True when `have` is older than `need`. Numbers are compared one by one, so 10.10 > 10.9.

    An unreadable `have` counts as older (it cannot be shown to be new enough); an unreadable or
    empty `need` means no minimum is set, so nothing is older.
    """
    required = parse_version(need)
    if required is None:
        return False
    current = parse_version(have)
    return current is None or current < required


def display_version(text: Any = APP_VERSION) -> str:
    """The version as shown to players, for example '10.10'."""
    parsed = parse_version(text)
    if parsed is None:
        return str(text)
    major, minor, patch = parsed
    return f"{major}.{minor}" + (f".{patch}" if patch else "")


def client_headers() -> dict[str, str]:
    """Headers sent with every request to the server so it can check our version."""
    return {VERSION_HEADER: str(APP_VERSION)}


def fetch_client_requirements(client) -> dict[str, str] | None:
    """Ask the server for the minimum version. Returns None if there is no minimum or it cannot be read."""
    response = client.rpc("mini_arcade_client_requirements", {}).execute()
    rows = getattr(response, "data", None) or []
    if isinstance(rows, dict):
        rows = [rows]
    if not rows:
        return None
    row = rows[0]
    minimum = str(row.get("min_client_version") or "").strip()
    if not minimum:
        return None
    return {"min_version": minimum, "message": str(row.get("update_message") or "").strip()[:300]}


def is_update_required_error(exc: BaseException) -> bool:
    """True when the server refused a request because this version is too old."""
    if getattr(exc, "code", None) == UPDATE_REQUIRED_CODE:
        return True
    return UPDATE_REQUIRED_CODE in str(exc)


def update_required_text(exc: BaseException | None = None, minimum: str = "", message: str = "") -> str:
    """Player-friendly explanation. Uses your server message when you set one."""
    server_message = message.strip()
    if not server_message and exc is not None:
        server_message = str(getattr(exc, "message", "") or "").strip()
    base = f"This is version {display_version()}."
    if minimum:
        base += f" Online play needs version {minimum} or newer."
    if server_message:
        base += f"\n\n{server_message}"
    else:
        base += "\n\nPlease get the newest Mini Arcade Hub from the game owner."
    return base + "\n\nYou can still play offline, and your progress on this computer is safe."
