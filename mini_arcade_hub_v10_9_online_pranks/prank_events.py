"""Server-delivered, temporary admin prank events for online players.

All authority lives in Supabase RPCs. This desktop client never receives a
service-role key and never writes directly to the prank/presence tables.
"""
from __future__ import annotations

import random
import threading
import time
import tkinter as tk
from PIL import Image, ImageTk, ImageSequence
from config import resource_path


PRANK_LABELS = {
    "jumpscare": "Jumpscare popup",
    "reality_glitch": "Reality glitch",
    "nickname_swap": "Silly temporary nickname",
    "confetti": "Confetti celebration",
    "fake_announcement": "Fake system announcement",
    "duck_invasion": "Duck invasion",
    "fortune": "Fortune message",
}

PRANK_MESSAGES = {
    "reality_glitch": [
        "REALITY CHECK FAILED\nThe arcade briefly misplaced Tuesday.",
        "A tiny error has escaped the prize machine. It seems harmless.",
        "The laws of arcade physics are taking a very short coffee break.",
    ],
    "nickname_swap": [
        "Captain Waffle", "The Mysterious Turnip", "Sir Buttonmasher",
        "Local Arcade Wizard", "Definitely A Duck", "Professor Sidequest",
    ],
    "fake_announcement": [
        "SYSTEM NOTICE: The prize machine has requested a tiny hat.",
        "ARCADE BULLETIN: Please thank your nearest imaginary houseplant.",
        "IMPORTANT: The dealer is not qualified to give weather forecasts.",
    ],
    "fortune": [
        "A suspiciously lucky number will find you. It may be 7.",
        "Beware of silent ducks carrying tiny briefcases.",
        "Your next shuffle contains exactly the right amount of chaos.",
        "A great achievement is near. It might involve pressing a button.",
        "The stars say: back up your save file.",
        "A wise toaster once said: crumbs are just tiny beginnings.",
    ],
}


class PrankEventsMixin:
    """Presence heartbeat, event polling, and safe temporary UI effects."""

    def start_prank_services(self):
        self._prank_services_active = True
        self._prank_poll_busy = False
        self._prank_last_heartbeat = 0.0
        self._schedule_prank_poll(1200)

    def stop_prank_services(self):
        self._prank_services_active = False

    def leave_prank_presence(self):
        """Best-effort immediate presence removal before sign-out or app close."""
        if self.online_mode and self.account_service and self.current_user_id:
            try:
                self.account_service.client.rpc("mini_arcade_prank_leave", {}).execute()
            except Exception:
                pass  # The 90-second heartbeat timeout is the fallback.

    def _schedule_prank_poll(self, delay_ms=3000):
        if not getattr(self, "_prank_services_active", False):
            return
        try:
            self.root.after(delay_ms, self._poll_prank_events)
        except tk.TclError:
            self._prank_services_active = False

    def _poll_prank_events(self):
        if not getattr(self, "_prank_services_active", False):
            return
        if not self.online_mode or not self.account_service or not self.current_user_id:
            self._schedule_prank_poll(5000)
            return
        if self._prank_poll_busy:
            self._schedule_prank_poll(1500)
            return
        self._prank_poll_busy = True
        client = self.account_service.client
        username = self.account_username or "Player"
        do_heartbeat = (time.monotonic() - self._prank_last_heartbeat) >= 25

        def worker():
            events, error = [], None
            try:
                if do_heartbeat:
                    client.rpc("mini_arcade_prank_heartbeat", {"p_username": username}).execute()
                    self._prank_last_heartbeat = time.monotonic()
                response = client.rpc("mini_arcade_prank_poll", {}).execute()
                events = getattr(response, "data", None) or []
            except Exception as exc:  # transient network errors should not interrupt play
                error = exc
            try:
                self.root.after(0, lambda: self._finish_prank_poll(events, error))
            except tk.TclError:
                self._prank_poll_busy = False

        threading.Thread(target=worker, name="MiniArcadePrankPoll", daemon=True).start()

    def _finish_prank_poll(self, events, error):
        self._prank_poll_busy = False
        if not getattr(self, "_prank_services_active", False):
            return
        for event in events:
            try:
                self.show_prank_event(str(event.get("event_type", "")))
            except Exception:
                # A malformed/unknown event must never crash the game loop.
                continue
        self._schedule_prank_poll(3000 if error is None else 7000)

    def show_prank_event(self, event_type: str):
        if event_type == "confetti":
            if self._show_confetti_overlay():
                return
            # If transparent overlays are unavailable, keep the original accessible popup.
        if event_type not in PRANK_LABELS:
            return
        if event_type == "jumpscare":
            title, message, accent = "SURPRISE!", "BOO!\nYou have been visited by the arcade ghost.", "#ef9b8c"
            try:
                self.root.bell()
            except tk.TclError:
                pass
        elif event_type == "reality_glitch":
            title, message, accent = "REALITY GLITCH", random.choice(PRANK_MESSAGES[event_type]), "#a9a3ef"
        elif event_type == "nickname_swap":
            title = "PROFILE TEMPORARILY MISFILED"
            message = f"For the next few seconds, the arcade thinks your name is:\n\n{random.choice(PRANK_MESSAGES[event_type])}\n\nYour real profile was not changed."
            accent = "#e6cf91"
        elif event_type == "confetti":
            title, message, accent = "A LITTLE CELEBRATION", "CONGRATULATIONS!\nConfetti has been detected in your general vicinity.", "#e6cf91"
        elif event_type == "fake_announcement":
            title, message, accent = "ARCADE SYSTEM NOTICE", random.choice(PRANK_MESSAGES[event_type]), "#9ed8bd"
        elif event_type == "duck_invasion":
            title, message, accent = "DUCK INVASION", "QUACK!  QUACK!  QUACK!\n\nA small committee of imaginary ducks has entered the arcade.\nThey have declined to comment.", "#e6cf91"
        else:
            title, message, accent = "ARCADE FORTUNE", random.choice(PRANK_MESSAGES["fortune"]), "#9ed8bd"
        self._show_prank_popup(title, message, accent)


    def _show_confetti_overlay(self):
        """Play the supplied transparent GIF over the game window without pausing play."""
        gif_path = resource_path("confetti_celebration.gif")
        if not gif_path.is_file():
            return False

        # Windows supports a transparent color key for borderless Tk windows.
        # On other platforms, fall back to the normal dismissible prank popup.
        if not hasattr(self, "_confetti_overlay") or self._confetti_overlay is None:
            overlay = tk.Toplevel(self.root)
            overlay.withdraw()
            overlay.overrideredirect(True)
            overlay.configure(bg="#010203")
            try:
                overlay.wm_attributes("-transparentcolor", "#010203")
            except tk.TclError:
                overlay.destroy()
                return False
            overlay.wm_attributes("-topmost", True)
            overlay.transient(self.root)
            canvas = tk.Canvas(overlay, bg="#010203", bd=0, highlightthickness=0)
            canvas.pack(fill="both", expand=True)
            self._confetti_overlay = overlay
            self._confetti_canvas = canvas
        else:
            overlay = self._confetti_overlay
            canvas = self._confetti_canvas

        # Stop an earlier animation cleanly if another confetti event arrives.
        if getattr(self, "_confetti_after_id", None):
            try:
                self.root.after_cancel(self._confetti_after_id)
            except tk.TclError:
                pass
            self._confetti_after_id = None

        try:
            frames = []
            durations = []
            with Image.open(gif_path) as gif:
                for frame in ImageSequence.Iterator(gif):
                    frames.append(frame.convert("RGBA"))
                    durations.append(max(20, int(frame.info.get("duration", 70))))
            if not frames:
                return False
        except Exception:
            return False

        self._confetti_frames = frames
        self._confetti_durations = durations
        self._confetti_photo = None
        self._confetti_index = 0
        overlay.deiconify()
        overlay.lift()
        try:
            overlay.attributes("-topmost", True)
        except tk.TclError:
            pass
        self._position_confetti_overlay()
        self._animate_confetti_frame()
        return True

    def _position_confetti_overlay(self):
        overlay = getattr(self, "_confetti_overlay", None)
        canvas = getattr(self, "_confetti_canvas", None)
        if not overlay or not canvas or not overlay.winfo_exists():
            return
        try:
            self.root.update_idletasks()
            x, y = self.root.winfo_rootx(), self.root.winfo_rooty()
            width, height = max(1, self.root.winfo_width()), max(1, self.root.winfo_height())
            overlay.geometry(f"{width}x{height}+{x}+{y}")
            canvas.configure(width=width, height=height)
        except tk.TclError:
            pass

    def _animate_confetti_frame(self):
        overlay = getattr(self, "_confetti_overlay", None)
        if not overlay or not overlay.winfo_exists():
            return
        frames = getattr(self, "_confetti_frames", [])
        if self._confetti_index >= len(frames):
            overlay.withdraw()
            self._confetti_after_id = None
            return
        try:
            self._position_confetti_overlay()
            width = max(1, self.root.winfo_width())
            height = max(1, self.root.winfo_height())
            frame = frames[self._confetti_index].resize((width, height), Image.Resampling.LANCZOS)
            self._confetti_photo = ImageTk.PhotoImage(frame)
            self._confetti_canvas.delete("all")
            self._confetti_canvas.create_image(0, 0, image=self._confetti_photo, anchor="nw")
            delay = self._confetti_durations[self._confetti_index]
            self._confetti_index += 1
            self._confetti_after_id = self.root.after(delay, self._animate_confetti_frame)
        except Exception:
            try:
                overlay.withdraw()
            except tk.TclError:
                pass
            self._confetti_after_id = None

    def _show_prank_popup(self, title, message, accent):
        popup = tk.Toplevel(self.root)
        popup.title(title)
        popup.configure(bg="#172d28")
        popup.resizable(False, False)
        popup.transient(self.root)
        panel = tk.Frame(popup, bg="#203c34", padx=22, pady=18)
        panel.pack(fill="both", expand=True, padx=10, pady=10)
        tk.Label(panel, text=title, font=("Segoe UI", 15, "bold"), fg=accent,
                 bg="#203c34").pack(anchor="w", pady=(0, 12))
        tk.Label(panel, text=message, font=("Segoe UI", 11), fg="#f6f0dd",
                 bg="#203c34", justify="left", wraplength=380).pack(anchor="w")
        close = tk.Button(panel, text="Dismiss", command=popup.destroy, relief="flat",
                          bg="#e5cf91", fg="#17342b", padx=18, pady=6)
        close.pack(anchor="e", pady=(18, 0))
        popup.protocol("WM_DELETE_WINDOW", popup.destroy)
        popup.update_idletasks()
        x = self.root.winfo_rootx() + max(0, (self.root.winfo_width() - popup.winfo_width()) // 2)
        y = self.root.winfo_rooty() + max(0, (self.root.winfo_height() - popup.winfo_height()) // 2)
        popup.geometry(f"+{x}+{y}")
        # Non-modal and self-closing: it never traps the player or blocks gameplay.
        popup.after(12000, lambda: popup.destroy() if popup.winfo_exists() else None)
