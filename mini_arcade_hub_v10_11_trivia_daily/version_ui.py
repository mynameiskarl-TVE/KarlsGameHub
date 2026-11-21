"""On-screen version indicator and the 'update required' notices for Mini Arcade Hub.

* A small "v10.10" badge is shown on the sign-in screen and in the main window header, and the
  window title carries the version too.
* On the sign-in screen the game asks the server for the minimum version. If this copy is too
  old, sign-in and account creation are switched off with a clear message. Offline play stays
  available. (The server also refuses an old copy's online requests, so this is only the
  friendly explanation, not the lock.)
"""
import threading
import tkinter as tk
from tkinter import messagebox

from config import APP_VERSION
from version_check import (
    display_version,
    fetch_client_requirements,
    is_older,
    update_required_text,
)


class VersionMixin:
    online_blocked = False
    online_block_text = ""
    _update_notice_shown = False

    def build_version_badge(self, parent):
        """A small pill showing the game version. The caller places it."""
        return tk.Label(
            parent, text=f"v{display_version()}", bg="#29473f", fg="#f1dfad",
            font=("Segoe UI", 9, "bold"), padx=8, pady=2,
        )

    def start_version_check(self):
        """Ask the server for the minimum version without freezing the window."""
        try:
            client = self._get_auth_service().client
        except Exception:  # Supabase is not set up on this computer: nothing online to block
            return

        def worker():
            try:
                requirements = fetch_client_requirements(client)
            except Exception:  # offline, or the version-gate script is not installed yet
                requirements = None
            try:
                self.root.after(0, lambda: self._apply_version_requirements(requirements))
            except (tk.TclError, RuntimeError):
                pass

        threading.Thread(target=worker, name="MiniArcadeVersionCheck", daemon=True).start()

    def _apply_version_requirements(self, requirements):
        minimum = (requirements or {}).get("min_version", "")
        self.online_blocked = bool(requirements) and is_older(APP_VERSION, minimum)
        self.online_block_text = ""
        if self.online_blocked:
            self.online_block_text = update_required_text(
                minimum=minimum, message=(requirements or {}).get("message", ""),
            )
        self._show_online_block()

    def _show_online_block(self):
        """Show the red notice and switch off sign-in, if this copy is too old and the screen is up."""
        if not self.online_blocked:
            return
        try:
            notice = getattr(self, "auth_notice", None)
            button = getattr(self, "auth_action_button", None)
            if notice is not None and notice.winfo_exists():
                notice.config(text="UPDATE REQUIRED\n" + self.online_block_text, fg="#f2bd9b")
            if button is not None and button.winfo_exists():
                button.config(state="disabled")
        except tk.TclError:
            pass

    def handle_update_required(self, text):
        """The server refused a request mid-game because the minimum version was raised."""
        self.online_blocked = True
        self.online_block_text = text
        try:
            self.set_status("Update required: online play is paused for this version.")
        except Exception:
            pass
        if self._update_notice_shown:
            return
        self._update_notice_shown = True
        messagebox.showwarning(
            "Update required",
            "Online play is paused for this version.\n\n" + text,
            parent=self.root,
        )
