"""Application class assembled from focused feature modules."""
import sys
import tkinter as tk
from config import APP_NAME, ICON_ICO, ICON_PNG
from player_data import default_save
from ui import UIMixin
from blackjack import BlackjackMixin
from minigames import MinigamesMixin
from player import PlayerMixin
from admin import AdminMixin
from account_ui import AccountUIMixin
from leaderboard import LeaderboardMixin
from suspension import SuspensionMixin
from audio_settings import AudioSettingsMixin
from prank_events import PrankEventsMixin
from version_check import display_version
from version_ui import VersionMixin


class MiniArcade(
    UIMixin, BlackjackMixin, MinigamesMixin, PlayerMixin, AdminMixin, AccountUIMixin, LeaderboardMixin,
    SuspensionMixin, AudioSettingsMixin, PrankEventsMixin, VersionMixin,
):
    """Main app, composed from UI, account, player, and game feature modules."""

    def apply_window_icon(self):
        """Use the Karl Games icon for the window, taskbar and every pop-up. Never blocks startup."""
        try:
            if sys.platform == "win32" and ICON_ICO.exists():
                self.root.iconbitmap(default=str(ICON_ICO))
            elif ICON_PNG.exists():
                self._icon_image = tk.PhotoImage(file=str(ICON_PNG))  # keep a reference so it is not freed
                self.root.iconphoto(True, self._icon_image)
        except tk.TclError:
            pass

    def __init__(self, root):
        self.root = root
        root.title(f"{APP_NAME} v{display_version()}")
        root.geometry("960x760")
        root.minsize(800, 650)
        root.configure(bg="#142b26")
        self.apply_window_icon()
        root.protocol("WM_DELETE_WINDOW", self.close_game)

        # A profile is loaded only after the player signs in or chooses offline play.
        self.data = default_save()
        self.balance = self.data["balance"]
        self.account_service = None
        self.cloud_worker = None
        self.current_user_id = None
        self.account_username = None
        self.online_mode = False

        self.admin_window = None
        self.admin_role = None

        # Blackjack state
        self.deck = []
        self.player = []
        self.dealer = []
        self.bet = 0
        self.round_active = False
        self.player_hands = []
        self.hand_bets = []
        self.hand_statuses = []
        self.hand_doubled = []
        self.active_hand_index = 0
        self.split_used = False

        # Number Hunt state
        self.number_target = None
        self.number_attempts = 0
        self.number_active = False

        # Trivia state
        self.quiz_questions = []
        self.quiz_index = 0
        self.quiz_score = 0
        self.quiz_active = False

        # Shared UI variables are created before the first screen is displayed.
        self.balance_var = tk.StringVar()
        self.banner_var = tk.StringVar()
        self.status_var = tk.StringVar(value="Welcome to your arcade!")
        self.player_var = tk.StringVar(value="Your hand: —")
        self.dealer_var = tk.StringVar(value="Dealer: —")
        self.rigging_indicator = tk.StringVar(value="")

        self.setup_style()
        self.init_audio_settings()
        self.build_account_screen()
