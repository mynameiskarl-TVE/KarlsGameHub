"""Player save-data defaults, validation, and loading."""
import json
from config import (
    SAVE_FILE, STARTING_BALANCE, DEFAULT_DAILY_REWARD,
    MAX_BALANCE, MAX_REWARD, STAT_KEYS,
)

def default_save():
    return {
        "balance": STARTING_BALANCE,
        "last_daily_reward": "",
        "daily_reward": DEFAULT_DAILY_REWARD,
        "number_reward": 20,
        "rps_reward": 10,
        "trivia_reward": 5,
        "rigging_enabled": False,
        "rig_player_hand_chance": 95,
        "rig_dealer_reduction": 95,
        "nickname": "Player",
        "announcement": "Welcome to Mini Arcade! Have fun and enjoy the games.",
        "activity": [],
        **{key: 0 for key in STAT_KEYS},
    }

def sanitize_save(data):
    clean = default_save()
    if isinstance(data, dict):
        clean.update(data)
    try:
        clean["balance"] = min(MAX_BALANCE, max(0, int(clean["balance"])))
    except (ValueError, TypeError):
        clean["balance"] = STARTING_BALANCE
    for key in ("daily_reward", "number_reward", "rps_reward", "trivia_reward"):
        try:
            clean[key] = min(MAX_REWARD, max(0, int(clean[key])))
        except (ValueError, TypeError):
            clean[key] = default_save()[key]
    clean["rigging_enabled"] = clean.get("rigging_enabled") is True
    for key in ("rig_player_hand_chance", "rig_dealer_reduction"):
        try:
            clean[key] = min(100, max(0, int(clean[key])))
        except (ValueError, TypeError):
            clean[key] = default_save()[key]
    for key in STAT_KEYS:
        try:
            clean[key] = min(MAX_BALANCE, max(0, int(clean.get(key, 0))))
        except (ValueError, TypeError):
            clean[key] = 0
    if not isinstance(clean.get("last_daily_reward"), str):
        clean["last_daily_reward"] = ""
    if not isinstance(clean.get("nickname"), str):
        clean["nickname"] = "Player"
    clean["nickname"] = clean["nickname"][:18] or "Player"
    if not isinstance(clean.get("announcement"), str):
        clean["announcement"] = ""
    clean["announcement"] = clean["announcement"][:160]
    if not isinstance(clean.get("activity"), list):
        clean["activity"] = []
    clean["activity"] = [str(item)[:180] for item in clean["activity"][-15:]]
    return clean

def load_save(path=SAVE_FILE):
    """Load a save from the requested path, falling back to a fresh profile."""
    try:
        return sanitize_save(json.loads(path.read_text(encoding="utf-8")))
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return default_save()
