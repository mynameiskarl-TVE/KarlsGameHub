"""Shared application settings and constants."""
from pathlib import Path
import hashlib
import sys

# The game version. This is the ONE place the desktop version is set. It must match
# web-version/package.json and the release folder name (run tools/check_release.py).
# It is shown in the window title and on screen, and sent to the server, which can refuse
# online play for versions older than the minimum you set (see supabase_version_gate_setup.sql).
APP_NAME = "Mini Arcade Hub"
APP_VERSION = "10.10"

# In a PyInstaller build, keep user-editable config and saves beside the EXE.
# In a normal Python run, keep them beside the source files.
if getattr(sys, "frozen", False):
    APP_DIR = Path(sys.executable).resolve().parent
else:
    APP_DIR = Path(__file__).resolve().parent


def resource_path(name: str) -> Path:
    """Find a read-only file bundled with the game (works from source and from the PyInstaller build)."""
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    return base / name


ICON_ICO = resource_path("icon.ico")  # Windows window/taskbar icon
ICON_PNG = resource_path("icon.png")  # used on other platforms
BACKGROUND_MUSIC = resource_path("BeepBox-Song.mp3")
SAVE_FILE = APP_DIR / "blackjack_save.json"  # Legacy/offline save.
SETTINGS_FILE = APP_DIR / "game_settings.json"  # Shared device-level audio preferences.
LOCAL_SAVE_DIR = APP_DIR / "local_saves"


def account_save_file(user_id: str) -> Path:
    """Return a safe per-account local cache path without using user input as a filename."""
    digest = hashlib.sha256(str(user_id).encode("utf-8")).hexdigest()[:24]
    return LOCAL_SAVE_DIR / f"{digest}.json"


STARTING_BALANCE = 500
DEFAULT_DAILY_REWARD = 100
MAX_FLIP_BET = 100
MAX_SLOT_BET = 100
MAX_BALANCE = 1_000_000_000
MAX_REWARD = 100_000


SUITS = ["♠", "♥", "♦", "♣"]
RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
STAT_KEYS = (
    "blackjack_wins", "blackjack_losses", "blackjack_pushes",
    "coin_flips", "coin_flip_wins", "number_hunt_games", "number_hunt_wins",
    "rps_games", "rps_wins", "trivia_games", "trivia_correct", "daily_logins",
    "rigged_openings", "dealer_high_cards_avoided", "slot_spins", "slot_wins",
)
