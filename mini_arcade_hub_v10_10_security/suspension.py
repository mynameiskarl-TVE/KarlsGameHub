"""Tells a suspended player they are suspended: a red header badge plus a one-time notice.

The server hides a suspended player's leaderboard row from them, so the game asks the
server about the signed-in account's own status instead (mini_arcade_my_status).
"""
import threading
import tkinter as tk
from tkinter import messagebox

from cloud_save import fetch_my_status
from version_check import is_update_required_error, update_required_text

CHECK_INTERVAL_MS = 120_000  # re-check every 2 minutes so a suspension made mid-session shows up


class SuspensionMixin:
    is_suspended = False
    suspension_reason = ""
    suspension_badge = None
    _suspension_job = None
    _suspension_generation = 0

    def build_suspension_badge(self, parent):
        """Create the red badge. It stays hidden until the server says the player is suspended."""
        self.suspension_badge = tk.Label(
            parent, text="SUSPENDED", bg="#b3261e", fg="white",
            font=("Segoe UI", 10, "bold"), padx=10, pady=3, cursor="hand2",
        )
        self.suspension_badge.bind("<Button-1>", lambda _event: self.show_suspension_details())

    def start_suspension_checks(self):
        self.stop_suspension_checks()
        if self.online_mode and self.account_service:
            self.check_suspension_status()

    def stop_suspension_checks(self):
        # Bumping the generation makes any check that is still in flight ignore its result.
        self._suspension_generation += 1
        if self._suspension_job is not None:
            try:
                self.root.after_cancel(self._suspension_job)
            except tk.TclError:
                pass
            self._suspension_job = None

    def reset_suspension_state(self):
        self.is_suspended = False
        self.suspension_reason = ""
        self.suspension_badge = None

    def check_suspension_status(self):
        if not (self.online_mode and self.account_service):
            return
        generation = self._suspension_generation
        client = self.account_service.client

        def worker():
            try:
                status = fetch_my_status(client)
            except Exception as exc:  # offline, or the server script has not been updated yet
                status = None
                if is_update_required_error(exc):  # the minimum version was raised during this session
                    notice = update_required_text(exc)
                    try:
                        self.root.after(0, lambda: self.handle_update_required(notice))
                    except (tk.TclError, RuntimeError):
                        pass
            try:
                self.root.after(0, lambda: self._apply_suspension_status(status, generation))
            except (tk.TclError, RuntimeError):
                pass

        threading.Thread(target=worker, name="MiniArcadeSuspensionCheck", daemon=True).start()

    def _apply_suspension_status(self, status, generation):
        if generation != self._suspension_generation:
            return  # signed out, or a different account, since this check began
        if status is not None:
            was_suspended = self.is_suspended
            self.is_suspended = bool(status["suspended"])
            self.suspension_reason = status["reason"]
            self._update_suspension_badge()
            if self.is_suspended and not was_suspended:
                self.show_suspension_details()
            elif was_suspended and not self.is_suspended:
                self.set_status("Your leaderboard suspension has been lifted.")
        # Keep exactly one timer running, even if several checks overlap.
        if self._suspension_job is not None:
            try:
                self.root.after_cancel(self._suspension_job)
            except tk.TclError:
                pass
        try:
            self._suspension_job = self.root.after(CHECK_INTERVAL_MS, self.check_suspension_status)
        except tk.TclError:
            self._suspension_job = None

    def _update_suspension_badge(self):
        badge = self.suspension_badge
        if badge is None:
            return
        try:
            if not badge.winfo_exists():
                return
            if self.is_suspended:
                badge.pack(side="right", padx=(0, 18))
            else:
                badge.pack_forget()
        except tk.TclError:
            pass

    def show_suspension_details(self):
        reason = self.suspension_reason or "No reason was given."
        messagebox.showwarning(
            "Leaderboard suspension",
            "Your account is suspended from the leaderboard.\n\n"
            "You are hidden from the leaderboard and your scores are not recorded there. "
            "You can still play, and your progress is still saved.\n\n"
            f"Reason: {reason}\n\n"
            "If you think this is a mistake, contact the game owner.",
            parent=self.root,
        )
