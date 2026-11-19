"""Tkinter account screen and account lifecycle for Mini Arcade Hub."""
import tkinter as tk
from tkinter import messagebox

from auth import (
    UsernameAuth,
    AuthSetupError,
    AccountInputError,
    get_error_message,
    normalize_username,
)
from cloud_save import CloudSaveWorker, fetch_player_save
from config import SAVE_FILE, account_save_file
from player_data import default_save, load_save, sanitize_save


class AccountUIMixin:
    """Login/register screens, cloud profile loading, offline mode, and logout."""

    def build_account_screen(self):
        self.auth_frame = tk.Frame(self.root, bg="#142b26", padx=24, pady=24)
        self.auth_frame.pack(fill="both", expand=True)

        tk.Label(
            self.auth_frame, text="MINI ARCADE", font=("Segoe UI", 27, "bold"),
            fg="#f1dfad", bg="#142b26",
        ).pack(pady=(25, 4))
        self.build_version_badge(self.auth_frame).pack(pady=(0, 8))
        tk.Label(
            self.auth_frame, text="Sign in to load your player profile and cloud save.",
            font=("Segoe UI", 10), fg="#c2d4c9", bg="#142b26",
        ).pack(pady=(0, 18))

        card = tk.Frame(
            self.auth_frame, bg="#203c34", padx=24, pady=22,
            highlightthickness=1, highlightbackground="#35584d",
        )
        card.pack(pady=8, ipadx=30)
        self.auth_heading = tk.Label(
            card, text="PLAYER LOGIN", font=("Segoe UI", 15, "bold"),
            fg="#e6d49e", bg="#203c34",
        )
        self.auth_heading.pack(anchor="w", pady=(0, 12))

        switch = tk.Frame(card, bg="#203c34")
        switch.pack(fill="x", pady=(0, 12))
        self.auth_login_button = tk.Button(
            switch, text="Sign in", command=lambda: self.show_account_form("login"),
            relief="flat", bg="#e5cf91", fg="#17342b", padx=14, pady=6,
        )
        self.auth_login_button.pack(side="left", padx=(0, 7))
        self.auth_register_button = tk.Button(
            switch, text="Create account", command=lambda: self.show_account_form("register"),
            relief="flat", bg="#31594c", fg="#f6f0dd", padx=14, pady=6,
        )
        self.auth_register_button.pack(side="left")

        self.auth_form = tk.Frame(card, bg="#203c34")
        self.auth_form.pack(fill="x")
        self.auth_notice = tk.Label(
            card, text="", font=("Segoe UI", 9), fg="#e7d9ae", bg="#203c34",
            wraplength=420, justify="left",
        )
        self.auth_notice.pack(anchor="w", pady=(12, 0))
        self.show_account_form("login")

        tk.Label(
            self.auth_frame,
            text="No email is requested. Your username appears on the shared leaderboard. Use a unique password.",
            font=("Segoe UI", 9), fg="#8ea99b", bg="#142b26",
        ).pack(pady=(12, 5))
        bottom = tk.Frame(self.auth_frame, bg="#142b26")
        bottom.pack(pady=12)
        tk.Button(
            bottom, text="Play offline", command=self.start_offline_game,
            relief="flat", bg="#31594c", fg="#f6f0dd", padx=16, pady=8,
        ).pack(side="left", padx=5)
        tk.Button(
            bottom, text="Settings", command=self.open_settings,
            relief="flat", bg="#e5cf91", fg="#17342b", padx=16, pady=8,
        ).pack(side="left", padx=5)
        tk.Button(
            bottom, text="Supabase setup guide", command=self.open_setup_guide,
            relief="flat", bg="#29473f", fg="#f6f0dd", padx=16, pady=8,
        ).pack(side="left", padx=5)
        self.start_version_check()

    def show_account_form(self, mode: str):
        self.auth_mode = mode
        for child in self.auth_form.winfo_children():
            child.destroy()
        self.auth_heading.config(text="PLAYER LOGIN" if mode == "login" else "CREATE PLAYER ACCOUNT")
        self.auth_login_button.config(bg="#e5cf91" if mode == "login" else "#31594c",
                                      fg="#17342b" if mode == "login" else "#f6f0dd")
        self.auth_register_button.config(bg="#e5cf91" if mode == "register" else "#31594c",
                                         fg="#17342b" if mode == "register" else "#f6f0dd")
        self.auth_notice.config(text="")

        tk.Label(self.auth_form, text="Username", fg="#f6f0dd", bg="#203c34",
                 font=("Segoe UI", 9, "bold")).pack(anchor="w")
        self.username_entry = tk.Entry(self.auth_form, width=34, font=("Segoe UI", 11))
        self.username_entry.pack(fill="x", pady=(4, 10), ipady=4)

        tk.Label(self.auth_form, text="Password", fg="#f6f0dd", bg="#203c34",
                 font=("Segoe UI", 9, "bold")).pack(anchor="w")
        self.password_entry = tk.Entry(self.auth_form, width=34, show="●", font=("Segoe UI", 11))
        self.password_entry.pack(fill="x", pady=(4, 10), ipady=4)

        if mode == "register":
            tk.Label(self.auth_form, text="Confirm password", fg="#f6f0dd", bg="#203c34",
                     font=("Segoe UI", 9, "bold")).pack(anchor="w")
            self.confirm_password_entry = tk.Entry(
                self.auth_form, width=34, show="●", font=("Segoe UI", 11)
            )
            self.confirm_password_entry.pack(fill="x", pady=(4, 10), ipady=4)
            action_text, command = "Create account", self.register_account
        else:
            self.confirm_password_entry = None
            action_text, command = "Sign in", self.login_account

        self.auth_action_button = tk.Button(
            self.auth_form, text=action_text, command=command,
            relief="flat", bg="#e5cf91", fg="#17342b", padx=16, pady=8,
            font=("Segoe UI", 10, "bold"),
        )
        self.auth_action_button.pack(fill="x", pady=(4, 0))
        self.username_entry.focus_set()
        self._show_online_block()  # no-op unless this copy is too old for online play

    def _account_request_started(self, message: str):
        self.auth_notice.config(text=message, fg="#e7d9ae")
        self.auth_action_button.config(state="disabled")
        self.auth_frame.update_idletasks()

    def _account_request_finished(self):
        if hasattr(self, "auth_action_button") and self.auth_action_button.winfo_exists():
            self.auth_action_button.config(state="normal")
        self._show_online_block()

    def _get_auth_service(self):
        if self.account_service is None:
            self.account_service = UsernameAuth()
        return self.account_service

    def login_account(self):
        username = self.username_entry.get().strip()
        password = self.password_entry.get()
        try:
            username = normalize_username(username)
            if not password:
                raise AccountInputError("Enter your password.")
            self._account_request_started("Signing in...")
            user = self._get_auth_service().login(username, password)
            self._complete_online_login(user, username)
        except (AuthSetupError, AccountInputError) as exc:
            self.auth_notice.config(text=str(exc), fg="#f2bd9b")
        except Exception as exc:
            self.auth_notice.config(text=get_error_message(exc), fg="#f2bd9b")
        finally:
            self._account_request_finished()

    def register_account(self):
        username = self.username_entry.get().strip()
        password = self.password_entry.get()
        confirm = self.confirm_password_entry.get() if self.confirm_password_entry else ""
        try:
            username = normalize_username(username)
            if len(password) < 8:
                raise AccountInputError("Your password must be at least 8 characters long.")
            if password != confirm:
                raise AccountInputError("The passwords do not match.")
            self._account_request_started("Creating account...")
            user = self._get_auth_service().register(username, password)
            self._complete_online_login(user, username, is_new_account=True)
        except (AuthSetupError, AccountInputError) as exc:
            self.auth_notice.config(text=str(exc), fg="#f2bd9b")
        except Exception as exc:
            self.auth_notice.config(text=get_error_message(exc), fg="#f2bd9b")
        finally:
            self._account_request_finished()

    def _complete_online_login(self, user, username: str, is_new_account: bool = False):
        user_id = str(user.id)
        client = self.account_service.client
        try:
            remote_data = fetch_player_save(client, user_id)
        except Exception as exc:
            raise RuntimeError(
                "Your login worked, but your cloud save could not be loaded. Check that "
                "you ran supabase_setup.sql and enabled the Data API. Details: "
                + get_error_message(exc)
            ) from exc

        if remote_data is not None:
            game_data = sanitize_save(remote_data)
        else:
            per_account_file = account_save_file(user_id)
            if per_account_file.exists():
                game_data = load_save(per_account_file)
            elif SAVE_FILE.exists() and messagebox.askyesno(
                "Import existing local progress?",
                "This account does not have a cloud save yet. Import the existing save "
                "from this computer into this account?\n\nChoose No on a shared computer "
                "if that save belongs to someone else.",
                parent=self.root,
            ):
                game_data = load_save(SAVE_FILE)
            else:
                game_data = default_save()
            if game_data.get("nickname") == "Player":
                game_data["nickname"] = username[:18]

        self.admin_role = None
        self.current_user_id = user_id
        self.account_username = username
        self.online_mode = True
        self.data = sanitize_save(game_data)
        self.balance = self.data["balance"]
        self.cloud_worker = CloudSaveWorker(client, user_id, username)
        self._start_game_ui()
        self.cloud_worker.enqueue(self.data)
        self.start_prank_services()

    def start_offline_game(self):
        self.current_user_id = None
        self.account_username = None
        self.online_mode = False
        self.data = load_save()
        self.balance = self.data["balance"]
        self._start_game_ui()

    def _start_game_ui(self):
        if self.auth_frame.winfo_exists():
            self.auth_frame.destroy()
        self.build_ui()
        self.claim_daily_reward()
        self.refresh_header()
        self.refresh_home()
        self.refresh_profile_stats()
        self.start_suspension_checks()
        self.root.protocol("WM_DELETE_WINDOW", self.close_game)

    def logout_account(self):
        if not messagebox.askyesno("Sign out", "Save progress and sign out of this account?", parent=self.root):
            return
        self.save()
        self.leave_prank_presence()
        if self.cloud_worker:
            flushed = self.cloud_worker.close(timeout=4.0)
            if not flushed:
                messagebox.showwarning(
                    "Cloud save still pending",
                    "Your latest progress is saved on this computer, but the cloud upload "
                    "did not finish. Sign back in while online to sync again.", parent=self.root,
                )
            if self.cloud_worker.last_error:
                messagebox.showwarning(
                    "Cloud save warning",
                    "Your local save is safe, but the most recent cloud upload failed. "
                    "Check your internet connection and Supabase settings before closing.",
                    parent=self.root,
                )
        try:
            if self.account_service:
                self.account_service.logout()
        except Exception as exc:
            messagebox.showwarning("Sign-out warning", get_error_message(exc), parent=self.root)
        self.cloud_worker = None
        self.stop_prank_services()
        self.stop_suspension_checks()
        self.reset_suspension_state()
        self.admin_role = None
        self.admin_window = None
        self.current_user_id = None
        self.account_username = None
        self.online_mode = False
        for child in self.root.winfo_children():
            child.destroy()
        self.show_style_for_login()
        self.build_account_screen()
        self.root.protocol("WM_DELETE_WINDOW", self.close_game)

    def show_style_for_login(self):
        # ttk styles are global to the Tcl interpreter; reapply after account screen rebuild.
        self.setup_style()

    def close_game(self):
        self.stop_prank_services()
        self.leave_prank_presence()
        self.stop_background_music()
        if self.cloud_worker:
            self.save()
            self.cloud_worker.close(timeout=3.0)
        try:
            self.root.destroy()
        except tk.TclError:
            pass

    def open_setup_guide(self):
        from pathlib import Path
        import os
        guide = Path(__file__).resolve().parent / "SUPABASE_SETUP.md"
        if guide.exists():
            try:
                os.startfile(str(guide))
                return
            except AttributeError:
                pass
        messagebox.showinfo(
            "Supabase setup guide",
            "Open the SUPABASE_SETUP.md file in the Mini Arcade Hub folder.", parent=self.root,
        )
