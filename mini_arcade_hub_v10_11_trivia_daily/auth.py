"""Supabase username/password authentication for Mini Arcade Hub.

Supabase Auth's password sign-in accepts email or phone identifiers. This module
maps a username to a deterministic reserved .invalid email address internally;
players never enter or receive an email address.
"""
from __future__ import annotations

import json
import re

from config import APP_DIR
from version_check import client_headers

CONFIG_FILE = APP_DIR / "supabase_config.json"
USERNAME_PATTERN = re.compile(r"^[a-z0-9_]{3,20}$")
INTERNAL_EMAIL_DOMAIN = "accounts.miniarcade.invalid"


class AuthSetupError(RuntimeError):
    """Raised when the local Supabase settings are missing or invalid."""


class AccountInputError(ValueError):
    """Raised when a username or password does not meet local rules."""


def normalize_username(username: str) -> str:
    """Normalize and validate a username before making any network request."""
    value = (username or "").strip().lower()
    if not USERNAME_PATTERN.fullmatch(value):
        raise AccountInputError(
            "Usernames must be 3–20 characters and use only letters, numbers, or underscores."
        )
    return value


def username_identity_email(username: str) -> str:
    """Build the internal, non-deliverable Auth identifier for a username."""
    safe_username = normalize_username(username)
    return f"{safe_username}@{INTERNAL_EMAIL_DOMAIN}"


def load_supabase_settings() -> dict[str, str]:
    if not CONFIG_FILE.exists():
        raise AuthSetupError(
            "Supabase is not configured yet. Copy supabase_config.example.json to "
            "supabase_config.json and enter your Project URL and publishable key."
        )
    try:
        settings = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AuthSetupError(f"Could not read supabase_config.json: {exc}") from exc

    url = str(settings.get("url", "")).strip().rstrip("/")
    key = str(settings.get("publishable_key", "")).strip()
    if not url.startswith("https://") or not key:
        raise AuthSetupError(
            "supabase_config.json needs a valid https Project URL and a publishable key."
        )
    if "service_role" in key.lower() or key.lower().startswith("sb_secret_"):
        raise AuthSetupError(
            "Do not put a service-role or secret key in the game. Use the publishable/anon key."
        )
    return {"url": url, "publishable_key": key}


class UsernameAuth:
    """Thin wrapper around Supabase Auth. Sessions stay in memory for this run."""

    def __init__(self):
        settings = load_supabase_settings()
        try:
            from supabase import ClientOptions, create_client
        except ImportError as exc:
            raise AuthSetupError(
                "The Supabase Python package is missing. Open Command Prompt in the game "
                "folder and run: pip install -r requirements.txt"
            ) from exc
        # Every request carries the game version so the server can refuse versions that are too old.
        self.client = create_client(
            settings["url"], settings["publishable_key"],
            options=ClientOptions(headers=client_headers()),
        )

    def register(self, username: str, password: str):
        username = normalize_username(username)
        if len(password) < 8:
            raise AccountInputError("Your password must be at least 8 characters long.")
        response = self.client.auth.sign_up({
            "email": username_identity_email(username),
            "password": password,
            "options": {"data": {"username": username}},
        })
        if getattr(response, "session", None) is None:
            raise AuthSetupError(
                "Supabase created the account but did not start a session. In Supabase, "
                "turn OFF email confirmation before registering username-only accounts. "
                "No email address is collected, so players cannot click a confirmation link."
            )
        user = getattr(response, "user", None)
        if user is None or not getattr(user, "id", None):
            raise AuthSetupError("Supabase did not return an account ID. Please try again.")
        return user

    def login(self, username: str, password: str):
        username = normalize_username(username)
        response = self.client.auth.sign_in_with_password({
            "email": username_identity_email(username),
            "password": password,
        })
        user = getattr(response, "user", None)
        if user is None or not getattr(user, "id", None):
            raise AuthSetupError("Supabase did not return an account ID. Please try again.")
        return user

    def logout(self):
        # The SDK's documented default is global sign-out, which also revokes
        # refresh tokens on this account's other devices.
        self.client.auth.sign_out()


def get_error_message(exc: Exception) -> str:
    """Return a short provider error without printing credentials or request data."""
    message = getattr(exc, "message", None) or str(exc)
    message = " ".join(str(message).split())
    return message[:240] or "The account request failed. Please try again."
