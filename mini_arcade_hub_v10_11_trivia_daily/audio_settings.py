"""Background music playback and persistent audio settings."""
import json
import tkinter as tk
from tkinter import messagebox
from config import SETTINGS_FILE, BACKGROUND_MUSIC


class AudioSettingsMixin:
    def init_audio_settings(self):
        self.music_enabled = True
        self.music_volume = 0.35
        try:
            if SETTINGS_FILE.exists():
                saved = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
                self.music_enabled = bool(saved.get("music_enabled", True))
                self.music_volume = max(0.0, min(1.0, float(saved.get("music_volume", 0.35))))
        except (OSError, ValueError, TypeError, json.JSONDecodeError):
            pass

        self._pygame = None
        self._music_ready = False
        try:
            import pygame
            pygame.mixer.init()
            self._pygame = pygame
            if BACKGROUND_MUSIC.exists():
                pygame.mixer.music.load(str(BACKGROUND_MUSIC))
                pygame.mixer.music.set_volume(self.music_volume)
                self._music_ready = True
                if self.music_enabled:
                    pygame.mixer.music.play(loops=-1)
                    self._schedule_music_watchdog()
        except Exception:
            # Game remains fully usable if audio output or the optional mixer is unavailable.
            self._music_ready = False

    def _schedule_music_watchdog(self):
        """Restart the track if a decoder/device unexpectedly stops it."""
        try:
            if not getattr(self, "_music_watchdog_started", False):
                self._music_watchdog_started = True
                self.root.after(4000, self._music_watchdog)
        except Exception:
            pass

    def _music_watchdog(self):
        self._music_watchdog_started = False
        if self._music_ready and self.music_enabled and self._pygame:
            try:
                if not self._pygame.mixer.music.get_busy():
                    self._pygame.mixer.music.play(loops=-1)
            except Exception:
                pass
            self._schedule_music_watchdog()

    def save_audio_settings(self):
        try:
            SETTINGS_FILE.write_text(json.dumps({
                "music_enabled": self.music_enabled,
                "music_volume": round(self.music_volume, 3),
            }, indent=2), encoding="utf-8")
        except OSError:
            pass

    def set_music_enabled(self, enabled):
        self.music_enabled = bool(enabled)
        if self._music_ready:
            try:
                if self.music_enabled:
                    self._pygame.mixer.music.unpause()
                    if not self._pygame.mixer.music.get_busy():
                        self._pygame.mixer.music.play(loops=-1)
                    self._schedule_music_watchdog()
                else:
                    self._pygame.mixer.music.pause()
            except Exception:
                pass
        self.save_audio_settings()

    def set_music_volume(self, value):
        try:
            self.music_volume = max(0.0, min(1.0, float(value)))
        except (TypeError, ValueError):
            return
        if self._music_ready:
            try:
                self._pygame.mixer.music.set_volume(self.music_volume)
            except Exception:
                pass
        self.save_audio_settings()

    def open_settings(self):
        window = tk.Toplevel(self.root)
        window.title("Settings")
        window.configure(bg="#142b26")
        window.resizable(False, False)
        window.transient(self.root)
        window.grab_set()

        panel = tk.Frame(window, bg="#203c34", padx=22, pady=20)
        panel.pack(padx=14, pady=14, fill="both", expand=True)
        tk.Label(panel, text="SETTINGS", font=("Segoe UI", 16, "bold"),
                 fg="#e6d49e", bg="#203c34").pack(anchor="w", pady=(0, 14))

        enabled_var = tk.BooleanVar(value=self.music_enabled)
        tk.Checkbutton(
            panel, text="Enable background music", variable=enabled_var,
            command=lambda: self.set_music_enabled(enabled_var.get()),
            font=("Segoe UI", 10, "bold"), fg="#f6f0dd", bg="#203c34",
            activebackground="#203c34", activeforeground="#f6f0dd",
            selectcolor="#31594c", relief="flat",
        ).pack(anchor="w")

        tk.Label(panel, text="Music volume", font=("Segoe UI", 10),
                 fg="#c2d4c9", bg="#203c34").pack(anchor="w", pady=(14, 2))
        volume_var = tk.DoubleVar(value=round(self.music_volume * 100))
        scale = tk.Scale(
            panel, from_=0, to=100, orient="horizontal", variable=volume_var,
            command=lambda value: self.set_music_volume(float(value) / 100),
            length=280, showvalue=True, resolution=1,
            bg="#203c34", fg="#f6f0dd", troughcolor="#31594c",
            highlightthickness=0, activebackground="#e5cf91",
        )
        scale.pack(fill="x")
        if not self._music_ready:
            tk.Label(
                panel, text="Audio playback is unavailable. Install the game requirements and check your audio device.",
                wraplength=300, justify="left", font=("Segoe UI", 8),
                fg="#f2bd9b", bg="#203c34",
            ).pack(anchor="w", pady=(8, 0))
        tk.Button(
            panel, text="Done", command=window.destroy, relief="flat",
            bg="#e5cf91", fg="#17342b", padx=18, pady=7,
        ).pack(anchor="e", pady=(16, 0))
        window.update_idletasks()
        x = self.root.winfo_rootx() + (self.root.winfo_width() - window.winfo_width()) // 2
        y = self.root.winfo_rooty() + (self.root.winfo_height() - window.winfo_height()) // 2
        window.geometry(f"+{max(0, x)}+{max(0, y)}")

    def stop_background_music(self):
        self.save_audio_settings()
        if self._pygame:
            try:
                self._pygame.mixer.music.stop()
                self._pygame.mixer.quit()
            except Exception:
                pass
