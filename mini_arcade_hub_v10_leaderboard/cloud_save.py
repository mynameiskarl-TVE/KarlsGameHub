"""Account-isolated Supabase cloud save loading and background uploading."""
from __future__ import annotations

from copy import deepcopy
import queue
import threading
import time
from typing import Any


class CloudSaveError(RuntimeError):
    pass


def fetch_player_save(client, user_id: str):
    """Fetch the signed-in player's save. RLS must limit rows to auth.uid()."""
    response = (
        client.table("player_saves")
        .select("save_data")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    rows = getattr(response, "data", None) or []
    if not rows:
        return None
    return rows[0].get("save_data")


def upload_player_save(client, user_id: str, save_data: dict[str, Any]):
    """Upsert one JSON save row for this authenticated user."""
    response = (
        client.table("player_saves")
        .upsert(
            {"user_id": user_id, "save_data": deepcopy(save_data)},
            on_conflict="user_id",
        )
        .execute()
    )
    return response


def leaderboard_payload(username: str, save_data: dict[str, Any]) -> dict[str, Any]:
    """Build the small set of public, player-reported leaderboard fields."""
    safe = deepcopy(save_data) if isinstance(save_data, dict) else {}

    def number(key: str) -> int:
        try:
            return max(0, int(safe.get(key, 0)))
        except (TypeError, ValueError):
            return 0

    blackjack_wins = number("blackjack_wins")
    mini_game_wins = number("coin_flip_wins") + number("number_hunt_wins") + number("rps_wins")
    total_wins = blackjack_wins + mini_game_wins
    nickname = str(safe.get("nickname") or username).strip()[:18] or username
    return {
        "nickname": nickname,
        "points": min(1_000_000_000, number("balance")),
        "total_wins": min(1_000_000_000, total_wins),
        "blackjack_wins": min(1_000_000_000, blackjack_wins),
        "mini_game_wins": min(1_000_000_000, mini_game_wins),
        "trivia_correct": min(1_000_000_000, number("trivia_correct")),
    }


def sync_leaderboard_profile(client, user_id: str, username: str, save_data: dict[str, Any]):
    """Update only the signed-in user's pre-created leaderboard row."""
    return (
        client.table("leaderboard")
        .update(leaderboard_payload(username, save_data))
        .eq("user_id", user_id)
        .execute()
    )


def fetch_leaderboard(client, limit: int = 100):
    """Read the shared scoreboard. RLS restricts access to signed-in users."""
    safe_limit = min(100, max(1, int(limit)))
    response = (
        client.table("leaderboard")
        .select("username,nickname,points,total_wins,blackjack_wins,mini_game_wins,trivia_correct,updated_at")
        .order("points", desc=True)
        .order("total_wins", desc=True)
        .limit(safe_limit)
        .execute()
    )
    return getattr(response, "data", None) or []


class CloudSaveWorker:
    """Serialize cloud uploads off the Tkinter UI thread; local saves stay immediate."""

    _STOP = object()

    def __init__(self, client, user_id: str, username: str):
        self.client = client
        self.user_id = user_id
        self.username = username
        self._queue: queue.Queue = queue.Queue()
        self._thread = threading.Thread(target=self._run, name="MiniArcadeCloudSave", daemon=True)
        self._closed = False
        self._last_error = ""
        self._error_lock = threading.Lock()
        self._thread.start()

    def enqueue(self, save_data: dict[str, Any]):
        if not self._closed:
            self._queue.put(deepcopy(save_data))

    @property
    def last_error(self) -> str:
        with self._error_lock:
            return self._last_error

    def _run(self):
        while True:
            item = self._queue.get()
            try:
                if item is self._STOP:
                    return
                try:
                    upload_player_save(self.client, self.user_id, item)
                    sync_leaderboard_profile(self.client, self.user_id, self.username, item)
                    with self._error_lock:
                        self._last_error = ""
                except Exception as exc:  # offline play remains available
                    with self._error_lock:
                        self._last_error = " ".join(str(exc).split())[:220]
            finally:
                self._queue.task_done()

    def flush(self, timeout: float = 3.0) -> bool:
        deadline = time.monotonic() + timeout
        while self._queue.unfinished_tasks and time.monotonic() < deadline:
            time.sleep(0.05)
        return self._queue.unfinished_tasks == 0

    def close(self, timeout: float = 3.0) -> bool:
        if self._closed:
            return not self._thread.is_alive()
        self._closed = True
        flushed = self.flush(timeout)
        self._queue.put(self._STOP)
        self._thread.join(timeout=max(0.1, timeout))
        return flushed and not self._thread.is_alive()
