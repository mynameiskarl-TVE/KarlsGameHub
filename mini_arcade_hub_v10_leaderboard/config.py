"""Shared application settings and constants."""
from pathlib import Path
import hashlib

APP_DIR = Path(__file__).resolve().parent
SAVE_FILE = APP_DIR / "blackjack_save.json"  # Legacy/offline save.
LOCAL_SAVE_DIR = APP_DIR / "local_saves"


def account_save_file(user_id: str) -> Path:
    """Return a safe per-account local cache path without using user input as a filename."""
    digest = hashlib.sha256(str(user_id).encode("utf-8")).hexdigest()[:24]
    return LOCAL_SAVE_DIR / f"{digest}.json"


STARTING_BALANCE = 500
DEFAULT_DAILY_REWARD = 100
MAX_FLIP_BET = 100
MAX_BALANCE = 1_000_000_000
MAX_REWARD = 100_000

ADMIN_CODE_SHA256 = hashlib.sha256(b"tea").hexdigest()
ADMIN_PUBLIC_KEY_N = int("bd201fc6b984acbad774150193550a1dd6a54ae7801f01fe532aba69b102cd94198cc20ce07c7ca94612960f2acc7ae6c194a8d15cff314d29f9034c98624d07145b6a8b7947c5b83d3149c2587c58603cd302fce1e9b90f5b2bf99b0d87795dfbffe462a029a55403c559aa59881c5bbf0831db6ae46967a1f40c7b37ca69657796d8f2d031705f384b710303c8ff1b07b97f60739d5b1e4787a7ad46944b284a7c4e0bc2736016f28c2e5b7027e41dad76b1d480575f6e8c0e4992a02abe910d4104f5cbed522964768ed19b73c92434669eb7a5a81cc1e65f2a35cf0e1504649bdd53989147f35d02511be744601f956b9e2a177ea67f496eb242accfd061", 16)
ADMIN_PUBLIC_KEY_E = 65537
ADMIN_TOKEN_FORMAT = "mini-blackjack-admin-token-v1"
EXPECTED_LICENSE = {
    "product": "Mini Blackjack",
    "edition": "Owner Admin",
    "license_id": "MB-OWNER-2026-01",
    "version": 1,
}
SUITS = ["♠", "♥", "♦", "♣"]
RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
STAT_KEYS = (
    "blackjack_wins", "blackjack_losses", "blackjack_pushes",
    "coin_flips", "coin_flip_wins", "number_hunt_games", "number_hunt_wins",
    "rps_games", "rps_wins", "trivia_games", "trivia_correct", "daily_logins",
    "rigged_openings", "dealer_high_cards_avoided",
)
