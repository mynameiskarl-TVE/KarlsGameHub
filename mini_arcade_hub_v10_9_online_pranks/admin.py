"""Server-authorized admin console and account role management."""
import random
import platform
import sys
import time
from datetime import date
import tkinter as tk
from tkinter import messagebox, ttk

from auth import AccountInputError, normalize_username
from config import MAX_BALANCE, MAX_REWARD, STAT_KEYS, STARTING_BALANCE
from player_data import default_save
from prank_events import PRANK_LABELS

class AdminMixin:
    """Methods for the server-authorized admin console."""

    def unlock_admin(self):
            """Ask Supabase whether the currently signed-in account is an admin."""
            self.admin_role = None  # Never reuse a role cached from an earlier check/account.
            if not self.online_mode or not self.current_user_id or not self.account_service:
                messagebox.showerror(
                    "Admin access denied",
                    "Sign in to an online account before opening the admin console.",
                    parent=self.root,
                )
                return
            try:
                response = self.account_service.client.rpc(
                    "mini_arcade_admin_check", {}
                ).execute()
                role = response.data
                if isinstance(role, list):
                    role = role[0] if role else None
                if isinstance(role, dict):
                    role = role.get("role")
                if role not in ("owner", "admin"):
                    messagebox.showerror(
                        "Admin access denied",
                        "This account does not have administrator permissions.",
                        parent=self.root,
                    )
                    return
                self.admin_role = role
                self.open_admin_panel()
            except Exception as exc:
                messagebox.showerror(
                    "Could not verify admin access",
                    "Supabase could not verify your administrator permissions. "
                    "Check your internet connection and run supabase_admin_setup.sql.\n\n"
                    + " ".join(str(exc).split())[:220],
                    parent=self.root,
                )

    def build_moderation_tab(self, frame, win):
            """Leaderboard moderation. Every action is checked and enforced by Supabase."""
            client = self.account_service.client

            def short(exc):
                return " ".join(str(exc).split())[:200]

            tk.Label(frame, text="PLAYER MODERATION", fg="#9fe4c1", bg="#202a35",
                     font=("Segoe UI", 13, "bold")).pack(anchor="w")
            tk.Label(
                frame, fg="white", bg="#202a35", wraplength=720, justify="left",
                text="Suspending a player hides them from the leaderboard and makes the server ignore "
                     "their score updates. The player sees a red SUSPENDED badge and your reason in the game. It does not delete the account. Only the owner can suspend "
                     "an administrator, and the owner cannot be suspended.",
            ).pack(anchor="w", pady=(4, 10))
            suspended_box = tk.Listbox(frame, height=8, bg="#17232e", fg="#e6edf0",
                                       selectbackground="#456c5d", relief="flat")
            suspended_box.pack(fill="both", expand=True, pady=(0, 8))
            status = tk.Label(frame, text="", fg="#c2cbd3", bg="#202a35", justify="left",
                              wraplength=720)
            status.pack(anchor="w")

            def refresh_suspended():
                try:
                    rows = client.rpc("mini_arcade_admin_list_suspended", {}).execute().data or []
                    suspended_box.delete(0, "end")
                    for row in rows:
                        suspended_box.insert(
                            "end", f"{row.get('username', '?')}  —  {row.get('reason') or 'no reason given'}")
                    if not rows:
                        suspended_box.insert("end", "No suspended players.")
                    status.config(text=f"{len(rows)} suspended player(s).")
                except Exception as exc:
                    status.config(text="Could not load moderation data: " + short(exc))

            def read_username():
                try:
                    return normalize_username(username_entry.get())
                except AccountInputError as exc:
                    messagebox.showwarning("Username needed", str(exc), parent=win)
                    return None

            def suspend():
                username = read_username()
                if username is None:
                    return
                reset = bool(reset_var.get())
                prompt = f"Suspend '{username}' and hide them from the leaderboard?"
                if reset:
                    prompt += "\n\nTheir leaderboard score will also be reset."
                if not messagebox.askyesno("Confirm suspension", prompt, parent=win):
                    return
                try:
                    client.rpc("mini_arcade_admin_suspend_player", {
                        "p_username": username,
                        "p_reason": reason_entry.get().strip()[:200],
                        "p_reset_score": reset,
                    }).execute()
                    status.config(text=f"Suspended {username}.")
                    self.log_event(f"Moderation: suspended {username}")
                    refresh_suspended()
                except Exception as exc:
                    messagebox.showerror("Suspension failed", "Supabase rejected the change.\n\n" + short(exc), parent=win)

            def unsuspend():
                username = read_username()
                if username is None:
                    return
                try:
                    client.rpc("mini_arcade_admin_unsuspend_player", {"p_username": username}).execute()
                    status.config(text=f"Unsuspended {username}.")
                    self.log_event(f"Moderation: unsuspended {username}")
                    refresh_suspended()
                except Exception as exc:
                    messagebox.showerror("Change failed", "Supabase rejected the change.\n\n" + short(exc), parent=win)

            form = tk.Frame(frame, bg="#202a35")
            form.pack(fill="x", pady=(8, 0))
            tk.Label(form, text="Username", fg="white", bg="#202a35").grid(row=0, column=0, sticky="w")
            username_entry = tk.Entry(form, width=24)
            username_entry.grid(row=1, column=0, padx=(0, 8), pady=4, sticky="w")
            tk.Label(form, text="Reason (the player will see this, 200 characters max)", fg="white", bg="#202a35").grid(row=0, column=1, sticky="w")
            reason_entry = tk.Entry(form, width=44)
            reason_entry.grid(row=1, column=1, padx=(0, 8), pady=4, sticky="w")
            reset_var = tk.BooleanVar(value=True)
            tk.Checkbutton(form, text="Also reset their leaderboard score", variable=reset_var,
                           bg="#202a35", fg="white", selectcolor="#17232e", activebackground="#202a35",
                           activeforeground="white").grid(row=2, column=0, columnspan=2, sticky="w")
            self.button(form, "Suspend player", suspend, True).grid(row=3, column=0, pady=(6, 0), sticky="w")
            self.button(form, "Unsuspend player", unsuspend).grid(row=3, column=1, pady=(6, 0), sticky="w")
            self.button(frame, "Refresh list", refresh_suspended).pack(anchor="w", pady=(8, 0))
            refresh_suspended()

    def open_admin_panel(self):
            if self.admin_window is not None and self.admin_window.winfo_exists():
                self.admin_window.lift()
                return
            win = tk.Toplevel(self.root)
            self.admin_window = win
            win.title("Mini Arcade — Admin Console")
            win.geometry("1020x720")
            win.minsize(1000, 650)
            win.configure(bg="#202a35")
            win.transient(self.root)
            tk.Label(win, text="ADMIN CONSOLE", font=("Segoe UI", 20, "bold"),
                     fg="#9fe4c1", bg="#202a35").pack(pady=(14, 3))
            tk.Label(win, text="Server-verified access • local game controls affect this account's save only",
                     font=("Segoe UI", 9), fg="#c2cbd3", bg="#202a35").pack(pady=(0, 10))

            admin_style = ttk.Style()
            admin_style.configure("Admin.TNotebook", background="#202a35", borderwidth=0)
            admin_style.configure("Admin.TNotebook.Tab", background="#29473f", foreground="#f1ead8",
                                  padding=(10, 8), font=("Segoe UI", 10, "bold"))
            admin_style.map("Admin.TNotebook.Tab", background=[("selected", "#d9c58c")],
                            foreground=[("selected", "#18352c")])
            notebook = ttk.Notebook(win, style="Admin.TNotebook")
            notebook.pack(fill="both", expand=True, padx=14, pady=(0, 10))
            overview = tk.Frame(notebook, bg="#202a35", padx=14, pady=12)
            points = tk.Frame(notebook, bg="#202a35", padx=14, pady=12)
            hub = tk.Frame(notebook, bg="#202a35", padx=14, pady=12)
            lab = tk.Frame(notebook, bg="#202a35", padx=14, pady=12)
            # The Weird Stuff tab can be taller than the available screen height.
            # Put its contents in a scrollable canvas so the online-prank controls
            # remain reachable on smaller displays.
            weird_tab = tk.Frame(notebook, bg="#202a35")
            weird_canvas = tk.Canvas(weird_tab, bg="#202a35", highlightthickness=0)
            weird_scrollbar = ttk.Scrollbar(weird_tab, orient="vertical", command=weird_canvas.yview)
            weird_canvas.configure(yscrollcommand=weird_scrollbar.set)
            weird_scrollbar.pack(side="right", fill="y")
            weird_canvas.pack(side="left", fill="both", expand=True)
            weird = tk.Frame(weird_canvas, bg="#202a35", padx=14, pady=12)
            weird_window = weird_canvas.create_window((0, 0), window=weird, anchor="nw")

            def _update_weird_scrollregion(_event=None):
                weird_canvas.configure(scrollregion=weird_canvas.bbox("all"))

            def _resize_weird_content(event):
                weird_canvas.itemconfigure(weird_window, width=event.width)
                _update_weird_scrollregion()

            weird.bind("<Configure>", _update_weird_scrollregion)
            weird_canvas.bind("<Configure>", _resize_weird_content)

            def _weird_mousewheel(event):
                if getattr(event, "delta", 0):
                    weird_canvas.yview_scroll(int(-event.delta / 120), "units")

            weird_canvas.bind("<MouseWheel>", _weird_mousewheel)
            weird.bind("<MouseWheel>", _weird_mousewheel)
            weird_canvas.bind("<Button-4>", lambda _event: weird_canvas.yview_scroll(-1, "units"))
            weird_canvas.bind("<Button-5>", lambda _event: weird_canvas.yview_scroll(1, "units"))
            maintenance = tk.Frame(notebook, bg="#202a35", padx=14, pady=12)
            admin_management = tk.Frame(notebook, bg="#202a35", padx=14, pady=12)
            moderation = tk.Frame(notebook, bg="#202a35", padx=14, pady=12)
            debug_tab = tk.Frame(notebook, bg="#202a35", padx=14, pady=12)
            notebook.add(overview, text="Overview")
            notebook.add(points, text="Points & rewards")
            notebook.add(hub, text="Hub settings")
            notebook.add(lab, text="Blackjack lab")
            notebook.add(weird_tab, text="Weird stuff")
            notebook.add(maintenance, text="Maintenance")
            notebook.add(admin_management, text="Admin management")
            notebook.add(moderation, text="Moderation")
            notebook.add(debug_tab, text="Debugging")
            self.build_moderation_tab(moderation, win)

            # Lightweight diagnostics. The counter measures Tkinter's scheduled
            # UI tick rate, not the monitor's GPU-rendered FPS.
            tk.Label(debug_tab, text="GAME DIAGNOSTICS", fg="#9fe4c1", bg="#202a35",
                     font=("Segoe UI", 13, "bold")).pack(anchor="w")
            tk.Label(
                debug_tab,
                text="Optional performance monitoring for troubleshooting. Monitoring runs only while this tab is open and enabled.",
                fg="white", bg="#202a35", wraplength=760, justify="left"
            ).pack(anchor="w", pady=(4, 12))

            debug_stats = tk.LabelFrame(
                debug_tab, text="Live performance", bg="#202a35", fg="#9fe4c1",
                padx=14, pady=12
            )
            debug_stats.pack(fill="x", pady=(0, 12))
            fps_value = tk.Label(debug_stats, text="Estimated UI rate: -- ticks/sec",
                                 fg="#f1dfad", bg="#202a35", font=("Consolas", 18, "bold"))
            fps_value.pack(anchor="w", pady=(0, 6))
            delay_value = tk.Label(debug_stats, text="Maximum callback delay: -- ms",
                                   fg="white", bg="#202a35", font=("Consolas", 11))
            delay_value.pack(anchor="w")
            debug_state = tk.Label(debug_stats, text="Monitor stopped",
                                   fg="#c2cbd3", bg="#202a35")
            debug_state.pack(anchor="w", pady=(6, 0))

            debug_enabled = tk.BooleanVar(value=False)
            debug_after_id = None
            debug_last_tick = None
            debug_sample_start = None
            debug_tick_count = 0
            debug_max_delay = 0.0

            def stop_debug_monitor():
                nonlocal debug_after_id, debug_last_tick, debug_sample_start
                nonlocal debug_tick_count, debug_max_delay
                if debug_after_id is not None:
                    try:
                        win.after_cancel(debug_after_id)
                    except tk.TclError:
                        pass
                debug_after_id = None
                debug_last_tick = None
                debug_sample_start = None
                debug_tick_count = 0
                debug_max_delay = 0.0
                debug_state.config(text="Monitor stopped")
                fps_value.config(text="Estimated UI rate: -- ticks/sec")
                delay_value.config(text="Maximum callback delay: -- ms")

            def debug_tick():
                nonlocal debug_after_id, debug_last_tick, debug_sample_start
                nonlocal debug_tick_count, debug_max_delay
                debug_after_id = None
                if not win.winfo_exists() or not debug_enabled.get():
                    return
                if notebook.select() != str(debug_tab):
                    debug_state.config(text="Paused while another admin tab is selected")
                    return

                now = time.perf_counter()
                if debug_last_tick is not None:
                    interval = now - debug_last_tick
                    debug_max_delay = max(debug_max_delay, max(0.0, interval - 0.016) * 1000.0)
                debug_last_tick = now
                if debug_sample_start is None:
                    debug_sample_start = now
                debug_tick_count += 1

                elapsed = now - debug_sample_start
                if elapsed >= 1.0:
                    rate = debug_tick_count / elapsed
                    fps_value.config(text=f"Estimated UI rate: {rate:5.1f} ticks/sec")
                    delay_value.config(text=f"Maximum callback delay: {debug_max_delay:5.1f} ms")
                    debug_state.config(text="Monitoring • higher callback delays can indicate UI stalls")
                    debug_sample_start = now
                    debug_tick_count = 0
                    debug_max_delay = 0.0

                debug_after_id = win.after(16, debug_tick)

            def toggle_debug_monitor():
                nonlocal debug_last_tick, debug_sample_start, debug_tick_count, debug_max_delay
                if not debug_enabled.get():
                    stop_debug_monitor()
                else:
                    debug_last_tick = None
                    debug_sample_start = None
                    debug_tick_count = 0
                    debug_max_delay = 0.0
                    debug_state.config(text="Starting monitor…")
                    debug_tick()

            tk.Checkbutton(
                debug_tab, text="Enable live performance monitor",
                variable=debug_enabled, command=toggle_debug_monitor,
                bg="#202a35", fg="white", selectcolor="#17232e",
                activebackground="#202a35", activeforeground="white",
                font=("Segoe UI", 10, "bold")
            ).pack(anchor="w", pady=(0, 12))

            system_frame = tk.LabelFrame(
                debug_tab, text="Runtime information", bg="#202a35", fg="#9fe4c1",
                padx=14, pady=12
            )
            system_frame.pack(fill="x")
            tk.Label(
                system_frame,
                text=f"Python: {sys.version.split()[0]}\\nPlatform: {platform.platform()}\\n"
                     f"Window: {self.root.winfo_width()} × {self.root.winfo_height()}\\n"
                     f"Connection: {'Online' if self.online_mode else 'Offline'}",
                fg="white", bg="#202a35", justify="left", font=("Consolas", 10)
            ).pack(anchor="w")

            def on_admin_tab_changed(_event=None):
                nonlocal debug_after_id, debug_last_tick, debug_sample_start
                nonlocal debug_tick_count, debug_max_delay
                if not debug_enabled.get():
                    return
                if notebook.select() == str(debug_tab):
                    if debug_after_id is None:
                        debug_last_tick = None
                        debug_sample_start = None
                        debug_tick_count = 0
                        debug_max_delay = 0.0
                        debug_tick()
                else:
                    if debug_after_id is not None:
                        try:
                            win.after_cancel(debug_after_id)
                        except tk.TclError:
                            pass
                        debug_after_id = None
                    debug_last_tick = None
                    debug_sample_start = None
                    debug_tick_count = 0
                    debug_state.config(text="Paused while another admin tab is selected")

            notebook.bind("<<NotebookTabChanged>>", on_admin_tab_changed, add="+")

            tk.Label(
                admin_management,
                text="SERVER-MANAGED ADMINISTRATORS",
                fg="#9fe4c1", bg="#202a35", font=("Segoe UI", 13, "bold")
            ).pack(anchor="w")
            tk.Label(
                admin_management,
                text="Only the permanent owner account can grant or revoke admin access. "
                     "Changes are checked and stored by Supabase.",
                fg="white", bg="#202a35", wraplength=720, justify="left"
            ).pack(anchor="w", pady=(4, 10))
            admin_roster = tk.Listbox(
                admin_management, height=10, bg="#17232e", fg="#e6edf0",
                selectbackground="#456c5d", relief="flat"
            )
            admin_roster.pack(fill="both", expand=True, pady=(0, 10))
            role_status = tk.Label(admin_management, text="", fg="#c2cbd3", bg="#202a35", justify="left")
            role_status.pack(anchor="w", pady=(8, 0))

            def refresh_admin_roles():
                try:
                    result = self.account_service.client.rpc(
                        "mini_arcade_admin_list_roles", {}
                    ).execute()
                    rows = result.data or []
                    admin_roster.delete(0, "end")
                    for row in rows:
                        admin_roster.insert(
                            "end", f"{row.get('username', '?')}  —  {row.get('role', '?')}"
                        )
                    if not rows:
                        admin_roster.insert("end", "No administrator accounts returned.")
                    role_status.config(text=f"Loaded {len(rows)} administrator account(s) from Supabase.")
                    audit_box.delete(0, "end")
                    audit_result = self.account_service.client.rpc(
                        "mini_arcade_admin_audit_list", {}
                    ).execute()
                    for event in (audit_result.data or []):
                        audit_box.insert(
                            "end",
                            f"{event.get('action', '?')} — {event.get('target_username') or '(unknown)'} — {event.get('created_at', '')}"
                        )
                except Exception as exc:
                    role_status.config(text="Could not load admin data: " + " ".join(str(exc).split())[:180])

            def change_admin_role(role):
                if getattr(self, "admin_role", None) != "owner":
                    messagebox.showerror(
                        "Owner permission required",
                        "Only the permanent owner can change administrator permissions.",
                        parent=win,
                    )
                    return
                username = role_username.get().strip().lower()
                if not username:
                    messagebox.showwarning("Username required", "Enter the account username first.", parent=win)
                    return
                if username == "mynameiskarl":
                    messagebox.showinfo("Permanent owner", "The permanent owner account cannot be changed here.", parent=win)
                    return
                if role == "admin":
                    prompt = f"Grant administrator access to '{username}'?"
                else:
                    prompt = f"Remove administrator access from '{username}'?"
                if not messagebox.askyesno("Confirm admin change", prompt, parent=win):
                    return
                try:
                    self.account_service.client.rpc(
                        "mini_arcade_admin_set_role",
                        {"p_username": username, "p_role": role},
                    ).execute()
                    role_status.config(text=f"Updated permissions for {username}.")
                    self.log_event(f"Server admin role changed for {username}: {role}")
                    refresh_admin_roles()
                except Exception as exc:
                    messagebox.showerror(
                        "Admin update failed",
                        "Supabase rejected the change. Confirm the username exists and "
                        "that your account is the permanent owner.\n\n"
                        + " ".join(str(exc).split())[:220],
                        parent=win,
                    )

            if getattr(self, "admin_role", None) == "owner":
                role_controls = tk.Frame(admin_management, bg="#202a35")
                role_controls.pack(fill="x", pady=(6, 0))
                tk.Label(role_controls, text="Account username", fg="white", bg="#202a35").grid(row=0, column=0, sticky="w")
                role_username = tk.Entry(role_controls, width=28)
                role_username.grid(row=1, column=0, padx=(0, 8), pady=5, sticky="w")
                self.button(role_controls, "Grant admin", lambda: change_admin_role("admin"), True).grid(row=1, column=1, padx=4)
                self.button(role_controls, "Remove admin", lambda: change_admin_role("none")).grid(row=1, column=2, padx=4)
            tk.Label(
                admin_management, text="Recent administrator changes", fg="#9fe4c1",
                bg="#202a35", font=("Segoe UI", 10, "bold")
            ).pack(anchor="w", pady=(14, 4))
            audit_box = tk.Listbox(
                admin_management, height=6, bg="#17232e", fg="#e6edf0",
                selectbackground="#456c5d", relief="flat"
            )
            audit_box.pack(fill="both", expand=True)
            self.button(admin_management, "Refresh admin list and audit", refresh_admin_roles).pack(anchor="w", pady=(8, 0))
            refresh_admin_roles()

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
            tk.Label(weird, text="Local arcade oddities plus server-delivered surprises for online players.", fg="white",
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

            # Online pranks: the server checks the caller's admin role and target presence.
            prank_frame = tk.LabelFrame(weird, text="Online player pranks", bg="#202a35", fg="#ffcf83",
                                        padx=12, pady=10)
            prank_frame.pack(fill="x", pady=8)
            tk.Label(prank_frame,
                     text="Send a temporary, dismissible surprise to a player currently online. These do not change saves, balances, or profile data.",
                     fg="white", bg="#202a35", wraplength=720, justify="left").pack(anchor="w", pady=(0, 8))
            target_row = tk.Frame(prank_frame, bg="#202a35")
            target_row.pack(fill="x")
            online_box = tk.Listbox(target_row, height=5, width=34, bg="#17232e", fg="#e6edf0",
                                    selectbackground="#456c5d", relief="flat", exportselection=False)
            online_box.pack(side="left", fill="y", padx=(0, 10))
            online_status = tk.Label(target_row, text="Refresh to load online players.", fg="#c2cbd3",
                                     bg="#202a35", justify="left", wraplength=440)
            online_status.pack(side="left", anchor="n", fill="x", expand=True)
            online_targets = []

            def refresh_online_players():
                try:
                    rows = self.account_service.client.rpc("mini_arcade_admin_online_players", {}).execute().data or []
                    online_targets.clear()
                    online_box.delete(0, "end")
                    for row in rows:
                        online_targets.append(row)
                        online_box.insert("end", row.get("username", "Unknown"))
                    online_status.config(text=f"{len(rows)} player(s) online. Presence updates about every 25 seconds.")
                    if not rows:
                        online_box.insert("end", "No players online")
                except Exception as exc:
                    online_status.config(text="Could not load online players: " + " ".join(str(exc).split())[:180])

            self.button(target_row, "Refresh players", refresh_online_players).pack(side="right", padx=(8, 0), anchor="n")
            prank_choices = [(label, event_type) for event_type, label in PRANK_LABELS.items()]
            prank_var = tk.StringVar(value=prank_choices[0][0])
            prank_menu = ttk.Combobox(prank_frame, textvariable=prank_var,
                                      values=[item[0] for item in prank_choices], state="readonly", width=30)
            prank_menu.pack(anchor="w", pady=(10, 6))

            def send_online_prank():
                selected = online_box.curselection()
                if not selected or selected[0] >= len(online_targets):
                    messagebox.showwarning("Choose a player", "Select an online player first.", parent=win)
                    return
                label = prank_var.get()
                event_type = next((key for name, key in prank_choices if name == label), None)
                if not event_type:
                    return
                target = online_targets[selected[0]]
                target_name = target.get("username", "player")
                if not messagebox.askyesno("Send prank", f"Send '{label}' to {target_name}?", parent=win):
                    return
                try:
                    self.account_service.client.rpc("mini_arcade_admin_send_prank", {
                        "p_target_user_id": target.get("user_id"),
                        "p_event_type": event_type,
                    }).execute()
                    online_status.config(text=f"Sent {label} to {target_name}.")
                    self.log_event(f"Sent online prank '{event_type}' to {target_name}")
                except Exception as exc:
                    messagebox.showerror("Prank not sent", "Supabase rejected the event. " + " ".join(str(exc).split())[:200], parent=win)

            self.button(prank_frame, "Send selected prank", send_online_prank, True).pack(anchor="w", pady=(2, 0))
            refresh_online_players()

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
            tk.Label(maintenance, text="Local save cache is stored beside the game; online progress also syncs to your own Supabase account.",
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
                    f"Slots: {self.data['slot_wins']} big wins / {self.data['slot_spins']} spins\n"
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
                stop_debug_monitor()
                debug_enabled.set(False)
                self.admin_window = None
                win.destroy()

            tk.Button(win, text="Close admin console", command=close_admin, width=22,
                      relief="flat", bg="#d7e8df", fg="#192a24", pady=6).pack(pady=(0, 10))
            win.protocol("WM_DELETE_WINDOW", close_admin)
            refresh_admin()
