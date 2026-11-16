"""Mini Arcade Hub — offline Windows game with owner-only admin console.

Python 3.10+ and the standard library only (Tkinter included with standard Python).
All points are fictional. The game has no real-money features or online services.
"""

import base64
import ctypes
import hashlib
import hmac
import json
import random
import sys
from ctypes import wintypes
from datetime import date, datetime
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, simpledialog, ttk

APP_DIR = Path(__file__).resolve().parent
SAVE_FILE = APP_DIR / "blackjack_save.json"
STARTING_BALANCE = 500
DEFAULT_DAILY_REWARD = 100
MAX_FLIP_BET = 100
MAX_BALANCE = 1_000_000_000
MAX_REWARD = 100_000

# The extra owner-console phrase requested by the owner.
# Store a digest rather than the literal text; this is an extra speed-bump,
# not a replacement for the signed owner token and Windows DPAPI protection.
ADMIN_CODE_SHA256 = ""  # filled with SHA-256 digest of the owner phrase below
ADMIN_CODE_SHA256 = hashlib.sha256(b"tea").hexdigest()

# Public verification key only. The private signing key is NOT included here.
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


def load_save():
    try:
        return sanitize_save(json.loads(SAVE_FILE.read_text(encoding="utf-8")))
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return default_save()


def card_value(card):
    rank = card[0]
    if rank in ("J", "Q", "K"):
        return 10
    if rank == "A":
        return 11
    return int(rank)


def hand_value(hand):
    total = sum(card_value(card) for card in hand)
    aces = sum(1 for card in hand if card[0] == "A")
    while total > 21 and aces:
        total -= 10
        aces -= 1
    return total


RIGGED_OPENING_TOTALS = (10, 19, 20, 21)


def choose_player_opening_hand(deck, target_chance):
    """Deal a normal pair, or bias it toward one of the configured totals.

    The deck remains a standard 52-card deck: selected cards are removed from
    it, so no duplicate cards are introduced by the mechanic.
    Returns (hand, target_total_or_None).
    """
    if deck and random.random() < max(0, min(100, int(target_chance))) / 100.0:
        target = random.choice(RIGGED_OPENING_TOTALS)
        pairs = []
        for i in range(len(deck)):
            for j in range(i + 1, len(deck)):
                if hand_value((deck[i], deck[j])) == target:
                    pairs.append((deck[i], deck[j]))
        if pairs:
            hand = list(random.choice(pairs))
            deck.remove(hand[0])
            deck.remove(hand[1])
            return hand, target
    if len(deck) < 2:
        raise ValueError("Not enough cards remain to deal an opening hand.")
    return [deck.pop(), deck.pop()], None


def choose_dealer_card(deck, dealer_hand, rigging_enabled, reduction_percent):
    """Draw one dealer card, optionally lowering odds of reaching 20 or 21.

    Returns (card, had_target_card_available, selected_target_card).
    If every remaining card would reach 20/21, one is selected normally so
    the game can always finish a hand.
    """
    if not deck:
        raise ValueError("The deck is empty.")
    if not rigging_enabled or not dealer_hand:
        return deck.pop(), False, False

    reduction = max(0, min(100, int(reduction_percent))) / 100.0
    target_flags = [hand_value(dealer_hand + [card]) in (20, 21) for card in deck]
    had_target = any(target_flags)
    if not had_target:
        return deck.pop(), False, False

    target_weight = 1.0 - reduction
    weights = [target_weight if is_target else 1.0 for is_target in target_flags]
    if sum(weights) <= 0:
        # At 100% reduction, use a non-target card whenever one remains.
        safe_indices = [i for i, is_target in enumerate(target_flags) if not is_target]
        if safe_indices:
            selected_index = random.choice(safe_indices)
        else:
            selected_index = random.randrange(len(deck))
    else:
        selected_index = random.choices(range(len(deck)), weights=weights, k=1)[0]
    selected_target = target_flags[selected_index]
    return deck.pop(selected_index), had_target, selected_target


def dpapi_unprotect(encrypted_bytes):
    """Decrypt a Windows DPAPI key file for the current Windows user."""
    if sys.platform != "win32":
        raise OSError("Owner key files can only be opened on Windows.")
    if not encrypted_bytes:
        raise ValueError("The selected key file is empty.")
    raw = (ctypes.c_byte * len(encrypted_bytes)).from_buffer_copy(encrypted_bytes)
    source = DATA_BLOB(len(encrypted_bytes), ctypes.cast(raw, ctypes.POINTER(ctypes.c_byte)))
    output = DATA_BLOB()
    crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    crypt32.CryptUnprotectData.argtypes = [
        ctypes.POINTER(DATA_BLOB), ctypes.POINTER(wintypes.LPWSTR),
        ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p,
        wintypes.DWORD, ctypes.POINTER(DATA_BLOB)
    ]
    crypt32.CryptUnprotectData.restype = wintypes.BOOL
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    kernel32.LocalFree.restype = ctypes.c_void_p
    if not crypt32.CryptUnprotectData(ctypes.byref(source), None, None, None, None,
                                      0x1, ctypes.byref(output)):
        raise OSError(ctypes.get_last_error(),
                      "Windows could not decrypt this key. It may belong to another Windows account or PC.")
    try:
        return ctypes.string_at(output.pbData, output.cbData)
    finally:
        kernel32.LocalFree(output.pbData)


class DATA_BLOB(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_byte))]


def verify_rsa_sha256(payload_bytes, signature_bytes):
    """Verify an RSA/SHA-256 PKCS#1 v1.5 signature using stdlib math."""
    modulus = ADMIN_PUBLIC_KEY_N
    key_size = (modulus.bit_length() + 7) // 8
    if len(signature_bytes) != key_size:
        return False
    signature_int = int.from_bytes(signature_bytes, "big")
    if signature_int >= modulus:
        return False
    encoded = pow(signature_int, ADMIN_PUBLIC_KEY_E, modulus).to_bytes(key_size, "big")
    digest_info = bytes.fromhex("3031300d060960864801650304020105000420") + hashlib.sha256(payload_bytes).digest()
    padding_length = key_size - len(digest_info) - 3
    if padding_length < 8:
        return False
    expected = b"\x00\x01" + (b"\xff" * padding_length) + b"\x00" + digest_info
    return hmac.compare_digest(encoded, expected)


def validate_admin_token(token_bytes):
    try:
        envelope = json.loads(token_bytes.decode("utf-8"))
        if not isinstance(envelope, dict) or envelope.get("format") != ADMIN_TOKEN_FORMAT:
            return False
        payload = base64.b64decode(envelope["payload"], validate=True)
        signature = base64.b64decode(envelope["signature"], validate=True)
        if not verify_rsa_sha256(payload, signature):
            return False
        return json.loads(payload.decode("utf-8")) == EXPECTED_LICENSE
    except (ValueError, TypeError, KeyError, UnicodeDecodeError, json.JSONDecodeError):
        return False


class MiniArcade:
    def __init__(self, root):
        self.root = root
        root.title("Mini Arcade Hub")
        root.geometry("960x760")
        root.minsize(800, 650)
        root.configure(bg="#142b26")

        self.data = load_save()
        self.balance = self.data["balance"]
        self.admin_window = None

        # Blackjack state
        self.deck = []
        self.player = []
        self.dealer = []
        self.bet = 0
        self.round_active = False

        # Number Hunt state
        self.number_target = None
        self.number_attempts = 0
        self.number_active = False

        # Trivia state
        self.quiz_questions = []
        self.quiz_index = 0
        self.quiz_score = 0
        self.quiz_active = False

        self.balance_var = tk.StringVar()
        self.banner_var = tk.StringVar()
        self.status_var = tk.StringVar(value="Welcome to your arcade!")
        self.player_var = tk.StringVar(value="Your hand: —")
        self.dealer_var = tk.StringVar(value="Dealer: —")
        self.rigging_indicator = tk.StringVar(value="")

        self.setup_style()
        self.build_ui()
        self.claim_daily_reward()
        self.refresh_header()
        self.refresh_home()

    def setup_style(self):
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure("TNotebook", background="#142b26", borderwidth=0)
        style.configure("TNotebook.Tab", background="#29473f", foreground="#f1ead8",
                        padding=(18, 10), font=("Segoe UI", 10, "bold"))
        style.map("TNotebook.Tab", background=[("selected", "#d9c58c")],
                  foreground=[("selected", "#18352c")])
        style.configure("Treeview", rowheight=25, background="#213c34",
                        fieldbackground="#213c34", foreground="#f5f3e8")
        style.configure("Treeview.Heading", background="#d9c58c", foreground="#17342b")

    def button(self, parent, text, command, primary=False, width=None):
        options = {"text": text, "command": command, "relief": "flat", "padx": 12, "pady": 7,
                   "font": ("Segoe UI", 9, "bold")}
        if primary:
            options.update(bg="#e5cf91", fg="#17342b", activebackground="#f2dfa9")
        else:
            options.update(bg="#31594c", fg="#f6f0dd", activebackground="#416d5c")
        if width:
            options["width"] = width
        return tk.Button(parent, **options)

    def label(self, parent, text=None, variable=None, size=10, color="#f6f0dd", bold=False, **kwargs):
        return tk.Label(parent, text=text, textvariable=variable,
                        font=("Segoe UI", size, "bold" if bold else "normal"),
                        fg=color, bg=kwargs.pop("bg", "#203c34"), **kwargs)

    def make_card(self, parent, title, subtitle=None):
        frame = tk.Frame(parent, bg="#203c34", padx=16, pady=14,
                         highlightthickness=1, highlightbackground="#35584d")
        self.label(frame, title, size=13, color="#e6d49e", bold=True, bg="#203c34").pack(anchor="w")
        if subtitle:
            self.label(frame, subtitle, size=9, color="#c2d4c9", bg="#203c34").pack(anchor="w", pady=(2, 8))
        return frame

    def build_ui(self):
        header = tk.Frame(self.root, bg="#142b26", padx=22, pady=14)
        header.pack(fill="x")
        tk.Label(header, text="MINI ARCADE", font=("Segoe UI", 25, "bold"),
                 fg="#f1dfad", bg="#142b26").pack(side="left")
        right = tk.Frame(header, bg="#142b26")
        right.pack(side="right")
        tk.Label(right, textvariable=self.balance_var, font=("Segoe UI", 15, "bold"),
                 fg="#f1dfad", bg="#142b26").pack(anchor="e")
        self.label(right, variable=self.banner_var, size=9, color="#c2d4c9", bg="#142b26").pack(anchor="e")

        self.banner = tk.Label(self.root, text="", bg="#29473f", fg="#f4e8c7",
                               font=("Segoe UI", 9), padx=12, pady=8, anchor="w")
        self.banner.pack(fill="x", padx=20, pady=(0, 10))

        self.tabs = ttk.Notebook(self.root)
        self.tabs.pack(fill="both", expand=True, padx=18, pady=(0, 10))
        self.home_tab = tk.Frame(self.tabs, bg="#142b26")
        self.blackjack_tab = tk.Frame(self.tabs, bg="#142b26")
        self.arcade_tab = tk.Frame(self.tabs, bg="#142b26")
        self.profile_tab = tk.Frame(self.tabs, bg="#142b26")
        self.tabs.add(self.home_tab, text="Home")
        self.tabs.add(self.blackjack_tab, text="Blackjack")
        self.tabs.add(self.arcade_tab, text="Arcade games")
        self.tabs.add(self.profile_tab, text="Profile & stats")
        self.build_home()
        self.build_blackjack()
        self.build_arcade()
        self.build_profile()
        self.refresh_rigging_indicator()

        footer = tk.Frame(self.root, bg="#142b26", padx=18, pady=6)
        footer.pack(fill="x")
        tk.Label(footer, textvariable=self.status_var, fg="#e7d9ae", bg="#142b26",
                 font=("Segoe UI", 9), anchor="w").pack(side="left", fill="x", expand=True)
        self.button(footer, "Owner console", self.unlock_admin).pack(side="right")
        self.label(self.root, "Offline single-player • Fictional points only", size=8,
                   color="#8ea99b", bg="#142b26").pack(pady=(0, 7))

    def build_home(self):
        top = tk.Frame(self.home_tab, bg="#142b26", padx=16, pady=16)
        top.pack(fill="x")
        self.home_welcome = self.label(top, "", size=21, color="#f1dfad", bold=True, bg="#142b26")
        self.home_welcome.pack(anchor="w")
        self.home_announcement = self.label(top, "", size=10, color="#c2d4c9", bg="#142b26", wraplength=820, justify="left")
        self.home_announcement.pack(anchor="w", pady=(5, 12))

        cards = tk.Frame(self.home_tab, bg="#142b26", padx=12)
        cards.pack(fill="x")
        self.daily_card = self.make_card(cards, "DAILY LOGIN", "Collect 100 points once per calendar day.")
        self.daily_card.pack(side="left", fill="both", expand=True, padx=5)
        self.label(self.daily_card, "Your daily reward is handled automatically when you open the game.",
                   size=9, color="#e5e1d4", bg="#203c34", wraplength=260, justify="left").pack(anchor="w")
        self.stats_card = self.make_card(cards, "YOUR ARCADE", "Your personal local progress.")
        self.stats_card.pack(side="left", fill="both", expand=True, padx=5)
        self.home_stats = self.label(self.stats_card, "", size=9, color="#e5e1d4", bg="#203c34", justify="left")
        self.home_stats.pack(anchor="w")

        launch = self.make_card(self.home_tab, "QUICK LAUNCH", "Pick a game and jump right in.")
        launch.pack(fill="x", padx=17, pady=14)
        row = tk.Frame(launch, bg="#203c34")
        row.pack(fill="x", pady=(6, 0))
        self.button(row, "♠  Blackjack", lambda: self.tabs.select(self.blackjack_tab), True, 18).pack(side="left", padx=(0, 8))
        self.button(row, "★  Mini-games", lambda: self.tabs.select(self.arcade_tab), False, 18).pack(side="left", padx=8)
        self.button(row, "♟  Profile & stats", lambda: self.tabs.select(self.profile_tab), False, 18).pack(side="left", padx=8)

        achievements = self.make_card(self.home_tab, "TROPHY SHELF", "A few milestones to chase.")
        achievements.pack(fill="both", expand=True, padx=17, pady=(0, 15))
        self.achievement_text = self.label(achievements, "", size=10, color="#e7e2d5", bg="#203c34", justify="left")
        self.achievement_text.pack(anchor="w", pady=(4, 0))

    def build_blackjack(self):
        outer = tk.Frame(self.blackjack_tab, bg="#142b26", padx=18, pady=16)
        outer.pack(fill="both", expand=True)
        self.label(outer, "BLACKJACK", size=21, color="#f1dfad", bold=True, bg="#142b26").pack(pady=(0, 5))
        self.label(outer, "Beat the dealer without going over 21.", size=10, color="#c2d4c9", bg="#142b26").pack(pady=(0, 4))
        self.rigging_badge = self.label(outer, variable=self.rigging_indicator, size=9,
                                        color="#ffcf83", bold=True, bg="#142b26")
        self.rigging_badge.pack(pady=(0, 10))
        table = tk.Frame(outer, bg="#1d5948", padx=22, pady=28,
                         highlightthickness=1, highlightbackground="#5b8875")
        table.pack(fill="both", expand=True)
        self.label(table, variable=self.dealer_var, size=15, bg="#1d5948", color="white", wraplength=760).pack(anchor="w", pady=(12, 40))
        self.label(table, variable=self.player_var, size=15, bg="#1d5948", color="white", wraplength=760).pack(anchor="w", pady=(0, 30))
        self.blackjack_status = self.label(table, "Place a bet and deal when ready.", size=11, bg="#1d5948", color="#ffe6a8", wraplength=760)
        self.blackjack_status.pack(anchor="w", pady=10)
        control = tk.Frame(outer, bg="#142b26")
        control.pack(pady=14)
        self.label(control, "Bet", bg="#142b26").grid(row=0, column=0, padx=5)
        self.bet_entry = tk.Entry(control, width=9, justify="center", font=("Segoe UI", 11))
        self.bet_entry.insert(0, "25")
        self.bet_entry.grid(row=0, column=1, padx=5)
        self.deal_btn = self.button(control, "Deal", self.start_round, True, 10)
        self.deal_btn.grid(row=0, column=2, padx=5)
        self.hit_btn = self.button(control, "Hit", self.hit, False, 10)
        self.hit_btn.grid(row=0, column=3, padx=5)
        self.stand_btn = self.button(control, "Stand", self.stand, False, 10)
        self.stand_btn.grid(row=0, column=4, padx=5)
        self.hit_btn.config(state="disabled")
        self.stand_btn.config(state="disabled")
        self.button(control, "Clear table", self.reset_table, False, 11).grid(row=0, column=5, padx=5)
        self.label(outer, "Natural blackjack pays 3:2. A normal win pays 1:1 profit; a tie returns the bet.",
                   size=9, color="#9fb7aa", bg="#142b26").pack(pady=(4, 0))

    def build_arcade(self):
        frame = tk.Frame(self.arcade_tab, bg="#142b26", padx=14, pady=14)
        frame.pack(fill="both", expand=True)
        self.label(frame, "ARCADE GAMES", size=20, color="#f1dfad", bold=True, bg="#142b26").pack(anchor="w")
        self.label(frame, "Small games for a quick break. All rewards are fictional points.",
                   size=9, color="#c2d4c9", bg="#142b26").pack(anchor="w", pady=(2, 10))

        top = tk.Frame(frame, bg="#142b26")
        top.pack(fill="x", expand=True)
        self.build_coinflip_card(top).pack(side="left", fill="both", expand=True, padx=(0, 7), pady=4)
        self.build_number_card(top).pack(side="left", fill="both", expand=True, padx=(7, 0), pady=4)
        bottom = tk.Frame(frame, bg="#142b26")
        bottom.pack(fill="both", expand=True)
        self.build_rps_card(bottom).pack(side="left", fill="both", expand=True, padx=(0, 7), pady=8)
        self.build_trivia_card(bottom).pack(side="left", fill="both", expand=True, padx=(7, 0), pady=8)

    def build_coinflip_card(self, parent):
        card = self.make_card(parent, "COIN FLIP", "Pick Heads or Tails. Maximum play: 100 points.")
        row = tk.Frame(card, bg="#203c34")
        row.pack(anchor="w", pady=4)
        self.flip_entry = tk.Entry(row, width=7, justify="center")
        self.flip_entry.insert(0, "25")
        self.flip_entry.pack(side="left", padx=(0, 8))
        self.button(row, "Heads", lambda: self.coin_flip("Heads"), True).pack(side="left", padx=3)
        self.button(row, "Tails", lambda: self.coin_flip("Tails")).pack(side="left", padx=3)
        self.flip_result = self.label(card, "Ready for a flip.", size=9, color="#f0e3bd", bg="#203c34")
        self.flip_result.pack(anchor="w", pady=(5, 0))
        return card

    def build_number_card(self, parent):
        card = self.make_card(parent, "NUMBER HUNT", "Find the secret number from 1 to 20 in five tries.")
        self.number_hint = self.label(card, "Start a round to get a secret number.", size=9, color="#f0e3bd", bg="#203c34")
        self.number_hint.pack(anchor="w", pady=4)
        row = tk.Frame(card, bg="#203c34")
        row.pack(anchor="w", pady=4)
        self.number_entry = tk.Entry(row, width=7, justify="center")
        self.number_entry.pack(side="left", padx=(0, 8))
        self.number_start_btn = self.button(row, "Start", self.start_number_hunt)
        self.number_start_btn.pack(side="left", padx=3)
        self.number_guess_btn = self.button(row, "Guess", self.guess_number, True)
        self.number_guess_btn.pack(side="left", padx=3)
        self.number_guess_btn.config(state="disabled")
        return card

    def build_rps_card(self, parent):
        card = self.make_card(parent, "ROCK • PAPER • SCISSORS", "Beat the computer to earn points. Ties give a small bonus.")
        row = tk.Frame(card, bg="#203c34")
        row.pack(anchor="w", pady=5)
        for move in ("Rock", "Paper", "Scissors"):
            self.button(row, move, lambda m=move: self.play_rps(m), move == "Rock").pack(side="left", padx=(0, 5))
        self.rps_result = self.label(card, "Choose your move.", size=9, color="#f0e3bd", bg="#203c34")
        self.rps_result.pack(anchor="w", pady=(5, 0))
        return card

    def build_trivia_card(self, parent):
        card = self.make_card(parent, "QUICK TRIVIA", "Answer five questions. Earn points for each correct answer.")
        self.trivia_question = self.label(card, "Start a quiz when you're ready.", size=9, color="#f0e3bd", bg="#203c34", wraplength=350, justify="left")
        self.trivia_question.pack(anchor="w", pady=4)
        self.trivia_options = tk.Frame(card, bg="#203c34")
        self.trivia_options.pack(anchor="w", fill="x")
        self.trivia_start_btn = self.button(card, "Start quiz", self.start_quiz, True)
        self.trivia_start_btn.pack(anchor="w", pady=(7, 0))
        return card

    def build_profile(self):
        frame = tk.Frame(self.profile_tab, bg="#142b26", padx=18, pady=16)
        frame.pack(fill="both", expand=True)
        self.label(frame, "PROFILE & STATS", size=20, color="#f1dfad", bold=True, bg="#142b26").pack(anchor="w")
        profile = self.make_card(frame, "PLAYER PROFILE", "Your profile and save file live on this computer.")
        profile.pack(fill="x", pady=10)
        line = tk.Frame(profile, bg="#203c34")
        line.pack(anchor="w", pady=4)
        self.label(line, "Nickname", bg="#203c34").pack(side="left", padx=(0, 8))
        self.nickname_entry = tk.Entry(line, width=20)
        self.nickname_entry.insert(0, self.data["nickname"])
        self.nickname_entry.pack(side="left")
        self.button(line, "Save nickname", self.save_nickname, True).pack(side="left", padx=8)
        self.label(profile, "Progress is saved automatically. Export a backup before moving the game to another PC.",
                   size=9, color="#c2d4c9", bg="#203c34").pack(anchor="w", pady=5)

        stats = self.make_card(frame, "LIFETIME STATS", "Local totals stored in your save file.")
        stats.pack(fill="both", expand=True)
        self.profile_stats = self.label(stats, "", size=10, color="#e9e5d9", bg="#203c34", justify="left")
        self.profile_stats.pack(anchor="w", pady=5)
        buttons = tk.Frame(stats, bg="#203c34")
        buttons.pack(anchor="w", pady=8)
        self.button(buttons, "Export save backup", self.export_backup).pack(side="left", padx=(0, 8))
        self.button(buttons, "Import save backup", self.import_backup).pack(side="left")

    def save(self):
        self.data["balance"] = self.balance
        try:
            SAVE_FILE.write_text(json.dumps(self.data, indent=2), encoding="utf-8")
        except OSError as exc:
            messagebox.showerror("Save error", f"Couldn't save your game data.\n\n{exc}", parent=self.root)

    def log_event(self, message):
        stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        self.data.setdefault("activity", []).append(f"{stamp} — {message}")
        self.data["activity"] = self.data["activity"][-15:]
        self.save()

    def refresh_header(self):
        self.balance = min(MAX_BALANCE, max(0, int(self.balance)))
        self.data["balance"] = self.balance
        self.balance_var.set(f"{self.balance:,} pts")
        self.banner_var.set(f"Signed in as {self.data['nickname']}")
        self.banner.config(text=self.data.get("announcement") or "Welcome to Mini Arcade!")
        self.save()

    def set_status(self, message):
        self.status_var.set(message)
        self.refresh_header()
        self.refresh_home()
        self.refresh_profile_stats()

    def change_balance(self, amount, reason=None):
        self.balance = min(MAX_BALANCE, max(0, self.balance + int(amount)))
        self.data["balance"] = self.balance
        self.refresh_header()
        if reason:
            self.log_event(reason)

    def claim_daily_reward(self):
        today = date.today().isoformat()
        if self.data.get("last_daily_reward") != today:
            reward = int(self.data["daily_reward"])
            self.balance = min(MAX_BALANCE, self.balance + reward)
            self.data["last_daily_reward"] = today
            self.data["daily_logins"] += 1
            self.status_var.set(f"Daily login reward: +{reward:,} points. Welcome back!")
            self.log_event(f"Daily login reward +{reward:,}")
        else:
            self.status_var.set("Welcome back! Today's daily reward has already been collected.")

    def refresh_home(self):
        if not hasattr(self, "home_welcome"):
            return
        self.home_welcome.config(text=f"Welcome to the arcade, {self.data['nickname']}!")
        self.home_announcement.config(text=self.data.get("announcement") or "Pick a game and have fun.")
        self.home_stats.config(text=(
            f"Blackjack wins: {self.data['blackjack_wins']}\n"
            f"Mini-game wins: {self.data['number_hunt_wins'] + self.data['rps_wins']}\n"
            f"Trivia answers correct: {self.data['trivia_correct']}\n"
            f"Daily logins: {self.data['daily_logins']}"
        ))
        medals = []
        total_wins = self.data["blackjack_wins"] + self.data["number_hunt_wins"] + self.data["rps_wins"]
        medals.append(("First victory", total_wins >= 1))
        medals.append(("Arcade regular", self.data["daily_logins"] >= 7))
        medals.append(("Quiz whiz", self.data["trivia_correct"] >= 10))
        medals.append(("Mini-game explorer", self.data["number_hunt_games"] > 0 and self.data["rps_games"] > 0 and self.data["trivia_games"] > 0))
        medals.append(("Point collector", self.balance >= 1000))
        self.achievement_text.config(text="\n".join(("★  " if earned else "☆  ") + name for name, earned in medals))

    def refresh_profile_stats(self):
        if not hasattr(self, "profile_stats"):
            return
        self.profile_stats.config(text=(
            f"Balance: {self.balance:,} points\n"
            f"Blackjack — {self.data['blackjack_wins']} wins / {self.data['blackjack_losses']} losses / {self.data['blackjack_pushes']} pushes\n"
            f"Coin flip — {self.data['coin_flips']} played / {self.data['coin_flip_wins']} won\n"
            f"Number Hunt — {self.data['number_hunt_games']} played / {self.data['number_hunt_wins']} won\n"
            f"Rock Paper Scissors — {self.data['rps_games']} played / {self.data['rps_wins']} won\n"
            f"Trivia — {self.data['trivia_games']} quizzes / {self.data['trivia_correct']} correct answers\n"
            f"Daily logins: {self.data['daily_logins']}  |  Last reward: {self.data['last_daily_reward'] or 'Never'}"
        ))

    def start_round(self):
        if self.round_active:
            return
        try:
            bet = int(self.bet_entry.get())
        except ValueError:
            messagebox.showwarning("Invalid bet", "Enter a whole-number bet.", parent=self.root)
            return
        if bet < 1 or bet > self.balance:
            messagebox.showwarning("Invalid bet", "Bet must be at least 1 and no more than your balance.", parent=self.root)
            return
        self.bet = bet
        self.balance -= bet
        self.deck = [(rank, suit) for suit in SUITS for rank in RANKS]
        random.shuffle(self.deck)
        if self.data.get("rigging_enabled", False):
            self.player, chosen_target = choose_player_opening_hand(
                self.deck, self.data.get("rig_player_hand_chance", 95)
            )
            if chosen_target is not None:
                self.data["rigged_openings"] += 1
                self.log_event(f"Rig mode selected a {chosen_target}-point opening hand")
        else:
            self.player = [self.deck.pop(), self.deck.pop()]
        self.dealer = [self.deck.pop()]
        self.dealer.append(self.draw_dealer_card())
        self.round_active = True
        self.deal_btn.config(state="disabled")
        self.hit_btn.config(state="normal")
        self.stand_btn.config(state="normal")
        self.refresh_hands(hide_dealer=True)
        self.refresh_header()
        self.log_event(f"Started blackjack round with {bet} points")
        if hand_value(self.player) == 21:
            self.finish_round()

    @staticmethod
    def show_hand(hand, hide_second=False):
        if not hand:
            return "—"
        return "   ".join("[Hidden]" if hide_second and i == 1 else f"{rank}{suit}"
                         for i, (rank, suit) in enumerate(hand))

    def refresh_rigging_indicator(self):
        if not hasattr(self, "rigging_indicator"):
            return
        if self.data.get("rigging_enabled", False):
            chance = int(self.data.get("rig_player_hand_chance", 95))
            reduction = int(self.data.get("rig_dealer_reduction", 95))
            self.rigging_indicator.set(
                f"OWNER RIG MODE ACTIVE • opening hand targets 10 / 19 / 20 / 21 ({chance}%) • dealer 20/21 odds reduced ({reduction}%)"
            )
        else:
            self.rigging_indicator.set("STANDARD MODE • normally shuffled cards")

    def draw_dealer_card(self):
        card, had_target, selected_target = choose_dealer_card(
            self.deck,
            self.dealer,
            bool(self.data.get("rigging_enabled", False)),
            int(self.data.get("rig_dealer_reduction", 95)),
        )
        if had_target and not selected_target and self.data.get("rigging_enabled", False):
            self.data["dealer_high_cards_avoided"] += 1
        return card

    def refresh_hands(self, hide_dealer=False):
        dealer_text = self.show_hand(self.dealer, hide_second=hide_dealer)
        if self.dealer and not hide_dealer:
            dealer_text += f"   (total: {hand_value(self.dealer)})"
        player_text = self.show_hand(self.player)
        if self.player:
            player_text += f"   (total: {hand_value(self.player)})"
        self.dealer_var.set("Dealer: " + dealer_text)
        self.player_var.set("Your hand: " + player_text)

    def hit(self):
        if not self.round_active:
            return
        self.player.append(self.deck.pop())
        self.refresh_hands(hide_dealer=True)
        if hand_value(self.player) > 21:
            self.finish_round("bust")

    def stand(self):
        if not self.round_active:
            return
        while hand_value(self.dealer) < 17 and self.deck:
            self.dealer.append(self.draw_dealer_card())
        self.finish_round()

    def finish_round(self, reason=None):
        self.round_active = False
        self.hit_btn.config(state="disabled")
        self.stand_btn.config(state="disabled")
        self.deal_btn.config(state="normal")
        player_total, dealer_total = hand_value(self.player), hand_value(self.dealer)
        player_bj = len(self.player) == 2 and player_total == 21
        dealer_bj = len(self.dealer) == 2 and dealer_total == 21
        if reason == "bust" or player_total > 21:
            self.data["blackjack_losses"] += 1
            result = f"Bust! You lose {self.bet} points."
        elif player_bj and not dealer_bj:
            self.data["blackjack_wins"] += 1
            winnings = int(self.bet * 2.5)
            self.balance += winnings
            result = f"Blackjack! You receive {winnings} points total."
        elif dealer_total > 21 or player_total > dealer_total:
            self.data["blackjack_wins"] += 1
            winnings = self.bet * 2
            self.balance += winnings
            result = f"You win! You receive {winnings} points total."
        elif player_total == dealer_total:
            self.data["blackjack_pushes"] += 1
            self.balance += self.bet
            result = "Push — your bet is returned."
        else:
            self.data["blackjack_losses"] += 1
            result = f"Dealer wins. You lose {self.bet} points."
        self.refresh_hands(False)
        self.blackjack_status.config(text=result)
        self.set_status(result)
        self.log_event("Blackjack: " + result)

    def reset_table(self):
        if self.round_active:
            messagebox.showinfo("Round in progress", "Finish the current hand first.", parent=self.root)
            return
        self.player, self.dealer, self.bet = [], [], 0
        self.refresh_hands(False)
        self.blackjack_status.config(text="Place a bet and deal when ready.")

    def coin_flip(self, choice):
        try:
            bet = int(self.flip_entry.get())
        except ValueError:
            messagebox.showwarning("Invalid bet", "Enter a whole-number coin-flip bet.", parent=self.root)
            return
        if bet < 1 or bet > MAX_FLIP_BET:
            messagebox.showwarning("Bet limit", "Coin-flip plays must be from 1 to 100 points.", parent=self.root)
            return
        if bet > self.balance:
            messagebox.showwarning("Not enough points", "Your balance is too low for that play.", parent=self.root)
            return
        outcome = random.choice(("Heads", "Tails"))
        self.balance -= bet
        self.data["coin_flips"] += 1
        if outcome == choice:
            self.data["coin_flip_wins"] += 1
            self.balance += bet * 2
            result = f"{outcome}! Correct — net gain: {bet} points."
        else:
            result = f"{outcome}! Not this time — {bet} points used."
        self.flip_result.config(text=result)
        self.set_status("Coin flip: " + result)
        self.log_event("Coin flip: " + result)

    def start_number_hunt(self):
        self.number_target = random.randint(1, 20)
        self.number_attempts = 5
        self.number_active = True
        self.number_hint.config(text="I picked a number. You have five guesses!")
        self.number_guess_btn.config(state="normal")
        self.number_start_btn.config(state="disabled")
        self.number_entry.delete(0, "end")
        self.number_entry.focus_set()

    def guess_number(self):
        if not self.number_active:
            return
        try:
            guess = int(self.number_entry.get())
            if not 1 <= guess <= 20:
                raise ValueError
        except ValueError:
            messagebox.showwarning("Choose 1–20", "Enter a whole number from 1 to 20.", parent=self.root)
            return
        self.number_attempts -= 1
        if guess == self.number_target:
            reward = self.data["number_reward"]
            self.balance += reward
            self.data["number_hunt_games"] += 1
            self.data["number_hunt_wins"] += 1
            self.number_hint.config(text=f"You found it! +{reward} points. Start another round.")
            self.end_number_hunt(f"Number Hunt win +{reward}")
        elif self.number_attempts <= 0:
            self.data["number_hunt_games"] += 1
            self.number_hint.config(text=f"Out of guesses! The number was {self.number_target}. Try again.")
            self.end_number_hunt("Number Hunt completed")
        else:
            direction = "Higher" if guess < self.number_target else "Lower"
            self.number_hint.config(text=f"{direction}! {self.number_attempts} guesses left.")
        self.set_status(self.number_hint.cget("text"))

    def end_number_hunt(self, event):
        self.number_active = False
        self.number_guess_btn.config(state="disabled")
        self.number_start_btn.config(state="normal")
        self.log_event(event)

    def play_rps(self, player_move):
        computer = random.choice(("Rock", "Paper", "Scissors"))
        self.data["rps_games"] += 1
        if player_move == computer:
            reward = 2
            self.balance += reward
            result = f"You both chose {computer}. Tie bonus: +{reward}."
        elif (player_move, computer) in (("Rock", "Scissors"), ("Paper", "Rock"), ("Scissors", "Paper")):
            reward = self.data["rps_reward"]
            self.balance += reward
            self.data["rps_wins"] += 1
            result = f"You chose {player_move}; computer chose {computer}. You win +{reward}!"
        else:
            result = f"You chose {player_move}; computer chose {computer}. Computer wins this round."
        self.rps_result.config(text=result)
        self.set_status(result)
        self.log_event("Rock Paper Scissors: " + result)

    TRIVIA = [
        ("Which planet is known as the Red Planet?", ["Venus", "Mars", "Jupiter", "Mercury"], 1),
        ("How many sides does a hexagon have?", ["Five", "Six", "Seven", "Eight"], 1),
        ("What is the largest ocean on Earth?", ["Atlantic", "Indian", "Pacific", "Arctic"], 2),
        ("Which animal is the largest living land animal?", ["Giraffe", "Hippo", "African elephant", "Rhino"], 2),
        ("What is H2O commonly called?", ["Oxygen", "Hydrogen", "Salt", "Water"], 3),
        ("How many minutes are in two hours?", ["90", "100", "120", "140"], 2),
        ("Which instrument usually has 88 keys?", ["Violin", "Piano", "Flute", "Trumpet"], 1),
        ("What is the process plants use to make food from sunlight?", ["Evaporation", "Photosynthesis", "Digestion", "Condensation"], 1),
        ("Which is the closest star to Earth?", ["Sirius", "Polaris", "The Sun", "Vega"], 2),
        ("What is 9 × 7?", ["56", "63", "72", "79"], 1),
        ("Which continent is the Sahara Desert in?", ["Asia", "Africa", "Australia", "South America"], 1),
        ("What do bees collect from flowers?", ["Nectar", "Sand", "Bark", "Dew only"], 0),
    ]

    def start_quiz(self):
        self.quiz_questions = random.sample(self.TRIVIA, 5)
        self.quiz_index = 0
        self.quiz_score = 0
        self.quiz_active = True
        self.data["trivia_games"] += 1
        self.trivia_start_btn.config(state="disabled")
        self.show_quiz_question()

    def show_quiz_question(self):
        for child in self.trivia_options.winfo_children():
            child.destroy()
        if self.quiz_index >= len(self.quiz_questions):
            bonus = 10 if self.quiz_score == 5 else 0
            self.balance += bonus
            msg = f"Quiz complete: {self.quiz_score}/5 correct. Bonus: +{bonus}."
            self.trivia_question.config(text=msg)
            self.quiz_active = False
            self.trivia_start_btn.config(state="normal")
            self.set_status(msg)
            self.log_event(f"Trivia finished {self.quiz_score}/5")
            return
        question, options, answer = self.quiz_questions[self.quiz_index]
        self.trivia_question.config(text=f"Question {self.quiz_index + 1}/5: {question}")
        for index, option in enumerate(options):
            self.button(self.trivia_options, option,
                        lambda i=index: self.answer_quiz(i), False).pack(anchor="w", fill="x", pady=2)

    def answer_quiz(self, choice):
        if not self.quiz_active:
            return
        question, options, correct = self.quiz_questions[self.quiz_index]
        if choice == correct:
            reward = self.data["trivia_reward"]
            self.quiz_score += 1
            self.data["trivia_correct"] += 1
            self.balance += reward
            message = f"Correct! +{reward} points."
        else:
            message = f"Not quite — the answer was {options[correct]}."
        self.trivia_question.config(text=message)
        self.quiz_index += 1
        self.root.after(850, self.show_quiz_question)
        self.set_status(message)

    def save_nickname(self):
        nickname = self.nickname_entry.get().strip()[:18]
        self.data["nickname"] = nickname or "Player"
        self.set_status(f"Profile name saved as {self.data['nickname']}.")
        self.log_event("Profile nickname changed")

    def export_backup(self):
        path = filedialog.asksaveasfilename(parent=self.root, title="Export game save",
                                            defaultextension=".json", initialfile="mini_arcade_backup.json",
                                            filetypes=[("JSON save", "*.json")])
        if not path:
            return
        try:
            self.save()
            Path(path).write_text(json.dumps(self.data, indent=2), encoding="utf-8")
            messagebox.showinfo("Backup exported", "Your save backup was exported.", parent=self.root)
        except OSError as exc:
            messagebox.showerror("Export failed", str(exc), parent=self.root)

    def import_backup(self):
        path = filedialog.askopenfilename(parent=self.root, title="Import game save backup",
                                          filetypes=[("JSON save", "*.json"), ("All files", "*.*")])
        if not path:
            return
        if not messagebox.askyesno("Import save", "Replace your current local progress with this backup?", parent=self.root):
            return
        try:
            imported = sanitize_save(json.loads(Path(path).read_text(encoding="utf-8")))
            self.data = imported
            self.balance = imported["balance"]
            self.refresh_header()
            self.refresh_home()
            self.refresh_profile_stats()
            self.nickname_entry.delete(0, "end")
            self.nickname_entry.insert(0, self.data["nickname"])
            self.set_status("Save backup imported successfully.")
        except (OSError, ValueError, TypeError, json.JSONDecodeError) as exc:
            messagebox.showerror("Import failed", f"That save file could not be imported.\n\n{exc}", parent=self.root)

    def unlock_admin(self):
        if sys.platform != "win32":
            messagebox.showerror("Windows required", "Owner-key files use Windows DPAPI and only work on Windows.", parent=self.root)
            return
        key_path = filedialog.askopenfilename(
            parent=self.root, title="Select your encrypted owner admin.key",
            filetypes=[("Encrypted owner key", "*.key"), ("All files", "*.*")]
        )
        if not key_path:
            return
        try:
            signed_token = dpapi_unprotect(Path(key_path).read_bytes())
            if not validate_admin_token(signed_token):
                raise ValueError("This file is not an authorized owner key for Mini Arcade.")
        except Exception as exc:
            messagebox.showerror("Admin access denied", str(exc), parent=self.root)
            return
        code = simpledialog.askstring("Owner code", "Enter the owner code to open the console:",
                                      show="•", parent=self.root)
        if code is None:
            return
        entered_digest = hashlib.sha256(code.encode("utf-8")).hexdigest()
        if not hmac.compare_digest(entered_digest, ADMIN_CODE_SHA256):
            messagebox.showerror("Admin access denied", "Incorrect owner code.", parent=self.root)
            return
        self.open_admin_panel()

    def open_admin_panel(self):
        if self.admin_window is not None and self.admin_window.winfo_exists():
            self.admin_window.lift()
            return
        win = tk.Toplevel(self.root)
        self.admin_window = win
        win.title("Mini Arcade — Owner Console")
        win.geometry("820x720")
        win.minsize(760, 650)
        win.configure(bg="#202a35")
        win.transient(self.root)
        tk.Label(win, text="OWNER CONSOLE", font=("Segoe UI", 20, "bold"),
                 fg="#9fe4c1", bg="#202a35").pack(pady=(14, 3))
        tk.Label(win, text="Privileged local controls • all currency is fictional",
                 font=("Segoe UI", 9), fg="#c2cbd3", bg="#202a35").pack(pady=(0, 10))

        notebook = ttk.Notebook(win)
        notebook.pack(fill="both", expand=True, padx=14, pady=(0, 10))
        overview = tk.Frame(notebook, bg="#202a35", padx=14, pady=12)
        points = tk.Frame(notebook, bg="#202a35", padx=14, pady=12)
        hub = tk.Frame(notebook, bg="#202a35", padx=14, pady=12)
        lab = tk.Frame(notebook, bg="#202a35", padx=14, pady=12)
        weird = tk.Frame(notebook, bg="#202a35", padx=14, pady=12)
        maintenance = tk.Frame(notebook, bg="#202a35", padx=14, pady=12)
        notebook.add(overview, text="Overview")
        notebook.add(points, text="Points & rewards")
        notebook.add(hub, text="Hub settings")
        notebook.add(lab, text="Blackjack lab")
        notebook.add(weird, text="Weird stuff")
        notebook.add(maintenance, text="Maintenance")

        stats_label = tk.Label(overview, text="", justify="left", font=("Consolas", 10),
                               fg="white", bg="#2c3a49", padx=12, pady=12, anchor="w")
        stats_label.pack(fill="x", pady=(0, 12))
        tk.Label(overview, text="Recent activity", fg="#9fe4c1", bg="#202a35",
                 font=("Segoe UI", 11, "bold")).pack(anchor="w")
        activity_box = tk.Listbox(overview, height=12, bg="#17232e", fg="#e6edf0",
                                  selectbackground="#456c5d", relief="flat")
        activity_box.pack(fill="both", expand=True, pady=5)

        amount_frame = tk.LabelFrame(points, text="Balance controls", bg="#202a35", fg="#9fe4c1",
                                     padx=12, pady=10)
        amount_frame.pack(fill="x", pady=(0, 10))
        tk.Label(amount_frame, text="Amount", fg="white", bg="#202a35").grid(row=0, column=0, sticky="w")
        amount_entry = tk.Entry(amount_frame, width=18)
        amount_entry.insert(0, "500")
        amount_entry.grid(row=0, column=1, padx=8, pady=5, sticky="w")

        def read_amount(entry, minimum=0, maximum=MAX_BALANCE):
            try:
                value = int(entry.get())
                if not minimum <= value <= maximum:
                    raise ValueError
                return value
            except ValueError:
                messagebox.showwarning("Invalid amount", f"Enter a whole number from {minimum:,} to {maximum:,}.", parent=win)
                return None

        def grant_points():
            value = read_amount(amount_entry)
            if value is None:
                return
            self.balance = min(MAX_BALANCE, self.balance + value)
            self.log_event(f"Owner granted {value:,} points")
            refresh_admin()

        def set_balance():
            value = read_amount(amount_entry)
            if value is None:
                return
            self.balance = value
            self.log_event(f"Owner set balance to {value:,}")
            refresh_admin()

        self.button(amount_frame, "Grant points", grant_points, True).grid(row=0, column=2, padx=5)
        self.button(amount_frame, "Set balance", set_balance).grid(row=0, column=3, padx=5)

        daily_frame = tk.LabelFrame(points, text="Daily and mini-game rewards", bg="#202a35", fg="#9fe4c1",
                                    padx=12, pady=10)
        daily_frame.pack(fill="x", pady=4)
        reward_entries = {}
        reward_fields = [
            ("daily_reward", "Daily login reward"),
            ("number_reward", "Number Hunt win"),
            ("rps_reward", "Rock Paper Scissors win"),
            ("trivia_reward", "Trivia correct answer"),
        ]
        for row_index, (key, caption) in enumerate(reward_fields):
            tk.Label(daily_frame, text=caption, fg="white", bg="#202a35").grid(row=row_index, column=0, sticky="w", pady=4)
            entry = tk.Entry(daily_frame, width=12)
            entry.insert(0, str(self.data[key]))
            entry.grid(row=row_index, column=1, padx=8, sticky="w")
            reward_entries[key] = entry

        def apply_rewards():
            values = {}
            for key, entry in reward_entries.items():
                value = read_amount(entry, 0, MAX_REWARD)
                if value is None:
                    return
                values[key] = value
            self.data.update(values)
            self.log_event("Owner updated reward settings")
            refresh_admin()
            messagebox.showinfo("Rewards updated", "Reward settings saved.", parent=win)

        self.button(daily_frame, "Save reward settings", apply_rewards, True).grid(row=4, column=0, columnspan=2, sticky="w", pady=(8, 0))
        quick = tk.Frame(points, bg="#202a35")
        quick.pack(fill="x", pady=10)

        def give_daily():
            amount = self.data["daily_reward"]
            self.balance = min(MAX_BALANCE, self.balance + amount)
            self.data["last_daily_reward"] = date.today().isoformat()
            self.log_event(f"Owner granted daily reward +{amount:,}")
            refresh_admin()

        def reset_daily():
            self.data["last_daily_reward"] = ""
            self.log_event("Owner reset daily reward availability")
            refresh_admin()

        self.button(quick, "Grant today's daily reward", give_daily).pack(side="left", padx=(0, 8))
        self.button(quick, "Reset daily reward timer", reset_daily).pack(side="left")

        tk.Label(hub, text="Player profile", fg="#9fe4c1", bg="#202a35",
                 font=("Segoe UI", 12, "bold")).pack(anchor="w")
        tk.Label(hub, text="Nickname (up to 18 characters)", fg="white", bg="#202a35").pack(anchor="w", pady=(10, 3))
        admin_name = tk.Entry(hub, width=35)
        admin_name.insert(0, self.data["nickname"])
        admin_name.pack(anchor="w")
        tk.Label(hub, text="Home-screen announcement (up to 160 characters)", fg="white", bg="#202a35").pack(anchor="w", pady=(14, 3))
        announcement = tk.Text(hub, width=64, height=4, wrap="word")
        announcement.insert("1.0", self.data.get("announcement", ""))
        announcement.pack(anchor="w", fill="x")

        def save_hub_settings():
            self.data["nickname"] = admin_name.get().strip()[:18] or "Player"
            self.data["announcement"] = announcement.get("1.0", "end-1c").strip()[:160]
            self.log_event("Owner changed hub profile/announcement")
            self.nickname_entry.delete(0, "end")
            self.nickname_entry.insert(0, self.data["nickname"])
            self.refresh_header()
            self.refresh_home()
            refresh_admin()
            messagebox.showinfo("Hub updated", "Profile and announcement saved.", parent=win)

        self.button(hub, "Save hub settings", save_hub_settings, True).pack(anchor="w", pady=10)
        tk.Label(hub, text="These settings affect this local save only.", fg="#c2cbd3",
                 bg="#202a35", font=("Segoe UI", 9)).pack(anchor="w")

        # Blackjack lab: owner-only, explicitly marked rigging for this local game.
        rig_frame = tk.LabelFrame(lab, text="Blackjack rigging mechanic", bg="#202a35",
                                  fg="#ffcf83", padx=12, pady=10)
        rig_frame.pack(fill="x", pady=(0, 12))
        tk.Label(rig_frame,
                 text="When enabled, the player's two-card opening hand is strongly biased toward 10, 19, 20 or 21. Dealer cards that would make 20 or 21 are made less likely. This affects future rounds only.",
                 fg="white", bg="#202a35", wraplength=700, justify="left").pack(anchor="w", pady=(0, 8))
        rig_enabled_var = tk.BooleanVar(value=bool(self.data.get("rigging_enabled", False)))
        rig_toggle = tk.Checkbutton(
            rig_frame, text="ENABLE RIGGING MECHANIC", variable=rig_enabled_var,
            bg="#202a35", fg="#ffcf83", selectcolor="#17232e", activebackground="#202a35",
            activeforeground="#ffcf83", font=("Segoe UI", 10, "bold"),
        )
        rig_toggle.pack(anchor="w", pady=(0, 8))

        rig_player_var = tk.IntVar(value=int(self.data.get("rig_player_hand_chance", 95)))
        rig_dealer_var = tk.IntVar(value=int(self.data.get("rig_dealer_reduction", 95)))
        rig_values = tk.Frame(rig_frame, bg="#202a35")
        rig_values.pack(fill="x")
        tk.Label(rig_values, text="Target opening-hand chance", fg="white", bg="#202a35").grid(row=0, column=0, sticky="w")
        player_scale = tk.Scale(rig_values, from_=50, to=100, orient="horizontal", variable=rig_player_var,
                                length=330, bg="#202a35", fg="white", troughcolor="#45675b",
                                highlightthickness=0)
        player_scale.grid(row=0, column=1, padx=8, sticky="w")
        tk.Label(rig_values, text="Dealer 20/21 odds reduction", fg="white", bg="#202a35").grid(row=1, column=0, sticky="w")
        dealer_scale = tk.Scale(rig_values, from_=50, to=100, orient="horizontal", variable=rig_dealer_var,
                                length=330, bg="#202a35", fg="white", troughcolor="#45675b",
                                highlightthickness=0)
        dealer_scale.grid(row=1, column=1, padx=8, sticky="w")

        def apply_rigging_settings():
            if self.round_active:
                rig_enabled_var.set(bool(self.data.get("rigging_enabled", False)))
                messagebox.showinfo("Finish current hand", "Finish the current blackjack hand before changing rigging settings. The current hand keeps its existing rules.", parent=win)
                return
            enabled = bool(rig_enabled_var.get())
            self.data["rigging_enabled"] = enabled
            self.data["rig_player_hand_chance"] = int(rig_player_var.get())
            self.data["rig_dealer_reduction"] = int(rig_dealer_var.get())
            self.refresh_rigging_indicator()
            state_text = "enabled" if enabled else "disabled"
            self.log_event(f"Owner {state_text} blackjack rig mode (opening {self.data['rig_player_hand_chance']}%, dealer reduction {self.data['rig_dealer_reduction']}%)")
            refresh_admin()
            messagebox.showinfo("Rig settings saved", f"Rig mode is {state_text}. New rounds will use these settings.", parent=win)

        self.button(rig_frame, "Apply rigging settings", apply_rigging_settings, True).pack(anchor="w", pady=(8, 4))
        rig_counters = tk.Label(rig_frame, text="", fg="#c2cbd3", bg="#202a35", justify="left")
        rig_counters.pack(anchor="w", pady=(5, 0))

        tk.Label(lab, text="The rigging badge is shown on the Blackjack screen whenever this mode is enabled. Turn it off to restore normal card draws on the next round.",
                 fg="#c2cbd3", bg="#202a35", wraplength=720, justify="left").pack(anchor="w", pady=3)

        # Odd little owner-only toys.
        tk.Label(weird, text="ODD LITTLE ARCADE POWERS", fg="#9fe4c1", bg="#202a35",
                 font=("Segoe UI", 13, "bold")).pack(anchor="w")
        tk.Label(weird, text="Harmless local surprises for your own arcade save.", fg="white",
                 bg="#202a35").pack(anchor="w", pady=(3, 12))
        mystery_frame = tk.LabelFrame(weird, text="Mystery cache", bg="#202a35", fg="#ffcf83",
                                      padx=12, pady=10)
        mystery_frame.pack(fill="x", pady=6)
        tk.Label(mystery_frame, text="Open a strange cache for a random fictional-point drop.",
                 fg="white", bg="#202a35").pack(anchor="w")

        def open_mystery_cache():
            roll = random.randint(1, 100)
            if roll <= 55:
                reward, rarity = random.randint(25, 75), "Common pocket change"
            elif roll <= 85:
                reward, rarity = random.randint(76, 150), "Uncommon sparkle"
            elif roll <= 97:
                reward, rarity = random.randint(151, 300), "Rare arcade meteor"
            else:
                reward, rarity = random.randint(301, 500), "LEGENDARY cosmic vending machine"
            self.balance = min(MAX_BALANCE, self.balance + reward)
            self.log_event(f"Owner opened mystery cache: +{reward} points ({rarity})")
            refresh_admin()
            messagebox.showinfo("Mystery cache", f"{rarity}!\n\nYou found {reward:,} fictional points.", parent=win)

        self.button(mystery_frame, "Open mystery cache", open_mystery_cache, True).pack(anchor="w", pady=(8, 0))

        broadcast_frame = tk.LabelFrame(weird, text="Reality broadcast", bg="#202a35", fg="#ffcf83",
                                        padx=12, pady=10)
        broadcast_frame.pack(fill="x", pady=6)
        tk.Label(broadcast_frame, text="Replace the home-screen announcement with a randomly generated arcade oddity.",
                 fg="white", bg="#202a35", wraplength=700, justify="left").pack(anchor="w")
        weird_announcements = [
            "A tiny wizard has moved into the prize machine. Please respect its privacy.",
            "The dealer has requested a short vacation from probability.",
            "Arcade weather report: 100% chance of imaginary confetti.",
            "A mysterious duck has been promoted to assistant manager.",
            "The vending machine is thinking about becoming a detective.",
            "Please ignore the suspiciously confident houseplant near the lobby.",
            "Tonight's forecast: scattered stars, occasional bonus points.",
            "A portal to the snack dimension opened. It only accepts coupons.",
        ]

        def send_reality_broadcast():
            self.data["announcement"] = random.choice(weird_announcements)
            self.log_event("Owner sent a reality-glitch broadcast")
            self.refresh_header()
            self.refresh_home()
            refresh_admin()

        self.button(broadcast_frame, "Send random weird broadcast", send_reality_broadcast, True).pack(anchor="w", pady=(8, 0))

        fortune_frame = tk.LabelFrame(weird, text="Arcade fortune cookie", bg="#202a35", fg="#ffcf83",
                                      padx=12, pady=10)
        fortune_frame.pack(fill="x", pady=6)
        fortunes = [
            "A suspiciously lucky number will find you. It may be 7.",
            "Beware of silent ducks carrying tiny briefcases.",
            "Your next shuffle contains exactly the right amount of chaos.",
            "A great achievement is near. It might involve pressing a button.",
            "The stars say: back up your save file.",
            "A wise toaster once said: crumbs are just tiny beginnings.",
            "You will soon encounter a door that is probably just a cupboard.",
        ]

        def read_fortune():
            fortune = random.choice(fortunes)
            self.log_event("Owner consulted the arcade fortune cookie")
            refresh_admin()
            messagebox.showinfo("Your arcade fortune", fortune, parent=win)

        self.button(fortune_frame, "Crack open a fortune", read_fortune).pack(anchor="w", pady=(8, 0))

        tk.Label(maintenance, text="Save file tools", fg="#9fe4c1", bg="#202a35",
                 font=("Segoe UI", 12, "bold")).pack(anchor="w")
        tk.Label(maintenance, text="Export backups before making major changes.", fg="white",
                 bg="#202a35").pack(anchor="w", pady=(4, 10))
        tools_row = tk.Frame(maintenance, bg="#202a35")
        tools_row.pack(anchor="w")
        self.button(tools_row, "Export backup", self.export_backup).pack(side="left", padx=(0, 8))
        self.button(tools_row, "Import backup", self.import_backup).pack(side="left")

        def reset_stats():
            if not messagebox.askyesno("Reset statistics", "Clear all game statistics? Your balance will stay unchanged.", parent=win):
                return
            for key in STAT_KEYS:
                self.data[key] = 0
            self.log_event("Owner reset statistics")
            refresh_admin()

        def reset_game():
            if not messagebox.askyesno("Reset entire save", "Restore 500 points and reset stats, rewards, profile and announcement? This cannot be undone unless you have a backup.", parent=win):
                return
            self.data = default_save()
            self.balance = STARTING_BALANCE
            rig_enabled_var.set(False)
            rig_player_var.set(self.data["rig_player_hand_chance"])
            rig_dealer_var.set(self.data["rig_dealer_reduction"])
            self.refresh_rigging_indicator()
            self.nickname_entry.delete(0, "end")
            self.nickname_entry.insert(0, "Player")
            self.log_event("Owner reset the entire game save")
            refresh_admin()

        danger = tk.LabelFrame(maintenance, text="Reset controls", bg="#202a35", fg="#e4a99b", padx=10, pady=10)
        danger.pack(fill="x", pady=18)
        self.button(danger, "Reset statistics", reset_stats).pack(side="left", padx=5)
        tk.Button(danger, text="Reset entire save", command=reset_game, relief="flat",
                  bg="#9e584d", fg="white", padx=12, pady=7).pack(side="left", padx=5)
        tk.Label(maintenance, text="Save data is stored locally beside the game as blackjack_save.json.",
                 fg="#c2cbd3", bg="#202a35", font=("Segoe UI", 9)).pack(anchor="w", pady=5)

        def refresh_admin():
            self.refresh_header()
            self.refresh_home()
            self.refresh_profile_stats()
            self.refresh_rigging_indicator()
            stats_label.config(text=(
                f"Player: {self.data['nickname']}\n"
                f"Balance: {self.balance:,} points\n"
                f"Blackjack: {self.data['blackjack_wins']} wins | {self.data['blackjack_losses']} losses | {self.data['blackjack_pushes']} pushes\n"
                f"Coin flips: {self.data['coin_flips']} played | {self.data['coin_flip_wins']} won\n"
                f"Number Hunt: {self.data['number_hunt_wins']} wins / {self.data['number_hunt_games']} played\n"
                f"RPS: {self.data['rps_wins']} wins / {self.data['rps_games']} played\n"
                f"Trivia: {self.data['trivia_correct']} correct answers | {self.data['trivia_games']} quizzes\n"
                f"Daily reward: {self.data['daily_reward']} | Last claimed: {self.data['last_daily_reward'] or 'Never'}\n"
                f"Rig mode: {'ON' if self.data.get('rigging_enabled') else 'OFF'} | Target starts: {self.data['rigged_openings']} | Dealer high cards avoided: {self.data['dealer_high_cards_avoided']}"
            ))
            rig_counters.config(text=(
                f"Rig mode: {'ON' if self.data.get('rigging_enabled') else 'OFF'}\n"
                f"Targeted opening hands: {self.data['rigged_openings']}\n"
                f"Dealer 20/21 draws avoided: {self.data['dealer_high_cards_avoided']}"
            ))
            activity_box.delete(0, "end")
            for item in reversed(self.data.get("activity", [])[-15:]):
                activity_box.insert("end", item)
            self.save()

        def close_admin():
            self.admin_window = None
            win.destroy()

        tk.Button(win, text="Close owner console", command=close_admin, width=22,
                  relief="flat", bg="#d7e8df", fg="#192a24", pady=6).pack(pady=(0, 10))
        win.protocol("WM_DELETE_WINDOW", close_admin)
        refresh_admin()


if __name__ == "__main__":
    root = tk.Tk()
    app = MiniArcade(root)
    root.mainloop()
