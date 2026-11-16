"""Application class assembled from focused feature modules."""
import tkinter as tk
from config import MAX_BALANCE
from player_data import default_save
from ui import UIMixin
from blackjack import BlackjackMixin
from minigames import MinigamesMixin
from player import PlayerMixin
from admin import AdminMixin
from account_ui import AccountUIMixin
from leaderboard import LeaderboardMixin


class MiniArcade(
    UIMixin, BlackjackMixin, MinigamesMixin, PlayerMixin, AdminMixin, AccountUIMixin, LeaderboardMixin
):
    """Main app, composed from UI, account, player, and game feature modules."""

    def __init__(self, root):
        self.root = root
        root.title("Mini Arcade Hub")
        root.geometry("960x760")
        root.minsize(800, 650)
        root.configure(bg="#142b26")
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
        self.build_account_screen()
