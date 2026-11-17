"""Shared leaderboard screen for online Mini Arcade Hub accounts."""
import threading
import tkinter as tk
from tkinter import ttk

from cloud_save import fetch_leaderboard


class LeaderboardMixin:
    """Display the shared, player-reported leaderboard."""

    def build_leaderboard(self):
        frame = tk.Frame(self.leaderboard_tab, bg="#142b26", padx=18, pady=16)
        frame.pack(fill="both", expand=True)

        self.label(frame, "ARCADE LEADERBOARD", size=20, color="#f1dfad", bold=True,
                   bg="#142b26").pack(anchor="w")
        self.label(
            frame,
            "Historical player-reported totals. New score updates are paused until verified server scoring is available.",
            size=10, color="#c2d4c9", bg="#142b26",
        ).pack(anchor="w", pady=(3, 12))

        card = self.make_card(
            frame, "TOP PLAYERS",
            "Only signed-in players can view the shared standings. Your username is visible here.",
        )
        card.pack(fill="both", expand=True)

        toolbar = tk.Frame(card, bg="#203c34")
        toolbar.pack(fill="x", pady=(2, 8))
        self.leaderboard_status = tk.StringVar(value="Sign in to view the shared leaderboard.")
        self.label(toolbar, variable=self.leaderboard_status, size=9,
                   color="#e7d9ae", bg="#203c34").pack(side="left", fill="x", expand=True)
        self.leaderboard_refresh_button = self.button(
            toolbar, "Refresh", self.refresh_leaderboard, True
        )
        self.leaderboard_refresh_button.pack(side="right")

        columns = ("rank", "username", "nickname", "points", "wins", "blackjack", "mini_games")
        self.leaderboard_tree = ttk.Treeview(
            card, columns=columns, show="headings", height=16
        )
        headings = {
            "rank": ("#", 48, "center"),
            "username": ("Username", 125, "w"),
            "nickname": ("Nickname", 135, "w"),
            "points": ("Points", 115, "e"),
            "wins": ("Total wins", 90, "e"),
            "blackjack": ("Blackjack", 90, "e"),
            "mini_games": ("Mini-games", 95, "e"),
        }
        for column, (caption, width, anchor) in headings.items():
            self.leaderboard_tree.heading(column, text=caption)
            self.leaderboard_tree.column(column, width=width, minwidth=55,
                                         anchor=anchor, stretch=(column in ("username", "nickname")))
        self.leaderboard_tree.pack(fill="both", expand=True)

        self.label(
            card,
            "Score totals are currently frozen. The server rejects direct client updates to points and wins; "
            "older totals may reflect the previous player-reported system.",
            size=8, color="#9db6a9", bg="#203c34", wraplength=790, justify="left",
        ).pack(anchor="w", pady=(8, 0))

        if self.online_mode:
            self.root.after(250, self.refresh_leaderboard)
        else:
            self.leaderboard_refresh_button.config(state="disabled")

    def refresh_leaderboard(self):
        if not self.online_mode or not self.account_service:
            self.leaderboard_status.set("Sign in with an online account to view the shared leaderboard.")
            return
        self.leaderboard_refresh_button.config(state="disabled")
        self.leaderboard_status.set("Loading leaderboard...")
        self.check_suspension_status()

        def load_rows():
            try:
                rows = fetch_leaderboard(self.account_service.client, limit=100)
                error = None
            except Exception as exc:
                rows = []
                error = " ".join(str(exc).split())[:220]
            try:
                self.root.after(0, lambda: self._show_leaderboard(rows, error))
            except tk.TclError:
                pass

        threading.Thread(target=load_rows, name="MiniArcadeLeaderboard", daemon=True).start()

    def _show_leaderboard(self, rows, error=None):
        if not hasattr(self, "leaderboard_tree") or not self.leaderboard_tree.winfo_exists():
            return
        self.leaderboard_refresh_button.config(state="normal")
        for item in self.leaderboard_tree.get_children():
            self.leaderboard_tree.delete(item)
        if error:
            self.leaderboard_status.set("Could not load the leaderboard. Check the connection and setup SQL.")
            return
        for rank, row in enumerate(rows, start=1):
            points = int(row.get("points") or 0)
            total_wins = int(row.get("total_wins") or 0)
            blackjack_wins = int(row.get("blackjack_wins") or 0)
            mini_game_wins = int(row.get("mini_game_wins") or 0)
            self.leaderboard_tree.insert(
                "", "end",
                values=(rank, row.get("username", "Player"), row.get("nickname", "Player"),
                        f"{points:,}", f"{total_wins:,}", f"{blackjack_wins:,}",
                        f"{mini_game_wins:,}"),
            )
        message = (
            f"Showing {len(rows)} historical row(s). Score submissions are paused."
            if rows else "No historical leaderboard rows are available yet."
        )
        if self.is_suspended:
            message += " You are suspended, so you do not appear on it."
        self.leaderboard_status.set(message)
