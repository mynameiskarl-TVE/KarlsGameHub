"""Shared window styling and main navigation UI."""
import tkinter as tk
from tkinter import ttk

class UIMixin:
    """Shared visual components and Home-tab construction."""

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
            self.build_version_badge(header).pack(side="left", padx=(12, 0), pady=(16, 0))
            right = tk.Frame(header, bg="#142b26")
            right.pack(side="right")
            if self.current_user_id:
                self.build_suspension_badge(header)
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
            self.leaderboard_tab = tk.Frame(self.tabs, bg="#142b26")
            self.tabs.add(self.home_tab, text="Home")
            self.tabs.add(self.blackjack_tab, text="Blackjack")
            self.tabs.add(self.arcade_tab, text="Arcade games")
            self.tabs.add(self.profile_tab, text="Profile & stats")
            self.tabs.add(self.leaderboard_tab, text="Leaderboard")
            self.build_home()
            self.build_blackjack()
            self.build_arcade()
            self.build_profile()
            self.build_leaderboard()
            self.refresh_rigging_indicator()

            footer = tk.Frame(self.root, bg="#142b26", padx=18, pady=6)
            footer.pack(fill="x")
            tk.Label(footer, textvariable=self.status_var, fg="#e7d9ae", bg="#142b26",
                     font=("Segoe UI", 9), anchor="w").pack(side="left", fill="x", expand=True)
            if self.current_user_id:
                self.button(footer, "Log out", self.logout_account).pack(side="right", padx=(0, 8))
            self.button(footer, "Settings", self.open_settings).pack(side="right", padx=(0, 8))
            self.button(footer, "Admin console", self.unlock_admin).pack(side="right", padx=(0, 8))
            mode_note = "Online account • Cloud save enabled" if self.current_user_id else "Offline play • Fictional points only"
            self.label(self.root, mode_note, size=8, color="#8ea99b", bg="#142b26").pack(pady=(0, 7))

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
            self.button(row, "🏆  Leaderboard", lambda: self.tabs.select(self.leaderboard_tab), False, 18).pack(side="left", padx=8)

            achievements = self.make_card(self.home_tab, "TROPHY SHELF", "A few milestones to chase.")
            achievements.pack(fill="both", expand=True, padx=17, pady=(0, 15))
            self.achievement_text = self.label(achievements, "", size=10, color="#e7e2d5", bg="#203c34", justify="left")
            self.achievement_text.pack(anchor="w", pady=(4, 0))
