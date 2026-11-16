"""Owner-console authorization and administration UI."""
import base64
import ctypes
import hashlib
import hmac
import json
import sys
from ctypes import wintypes
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, simpledialog, ttk
from config import (
    ADMIN_PUBLIC_KEY_N, ADMIN_PUBLIC_KEY_E, ADMIN_TOKEN_FORMAT,
    EXPECTED_LICENSE, ADMIN_CODE_SHA256,
)

class DATA_BLOB(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_byte))]

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

class AdminMixin:
    """Methods for the optional local owner console."""

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
