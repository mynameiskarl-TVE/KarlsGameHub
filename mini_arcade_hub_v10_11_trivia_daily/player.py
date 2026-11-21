"""Player profile, balance, statistics, and save-backup UI."""
import json
from datetime import date, datetime
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox
from config import SAVE_FILE, MAX_BALANCE, account_save_file
from player_data import sanitize_save

class PlayerMixin:
    """Methods that manage local player information and progress."""

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
            self.label(profile, "Progress saves automatically. Export a backup before moving the game to another PC.",
                       size=9, color="#c2d4c9", bg="#203c34").pack(anchor="w", pady=5)

            stats = self.make_card(frame, "LIFETIME STATS", "Totals stored in this player profile.")
            stats.pack(fill="both", expand=True)
            self.profile_stats = self.label(stats, "", size=10, color="#e9e5d9", bg="#203c34", justify="left")
            self.profile_stats.pack(anchor="w", pady=5)
            buttons = tk.Frame(stats, bg="#203c34")
            buttons.pack(anchor="w", pady=8)
            self.button(buttons, "Export save backup", self.export_backup).pack(side="left", padx=(0, 8))
            self.button(buttons, "Import save backup", self.import_backup).pack(side="left")

    def save(self):
            self.data["balance"] = self.balance
            path = account_save_file(self.current_user_id) if self.current_user_id else SAVE_FILE
            try:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(self.data, indent=2), encoding="utf-8")
            except OSError as exc:
                messagebox.showerror("Save error", f"Couldn't save your game data.\n\n{exc}", parent=self.root)
                return
            if self.cloud_worker:
                self.cloud_worker.enqueue(self.data)

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
                f"Slot machine — {self.data['slot_spins']} spins / {self.data['slot_wins']} big wins\n"
                f"Trivia — {self.data['trivia_games']} quizzes / {self.data['trivia_correct']} correct answers\n"
                f"Daily logins: {self.data['daily_logins']}  |  Last reward: {self.data['last_daily_reward'] or 'Never'}"
            ))

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
