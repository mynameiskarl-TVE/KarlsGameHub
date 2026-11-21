"""Arcade tab and the non-Blackjack minigames."""
import random
import threading
import time
import tkinter as tk
from tkinter import messagebox, ttk
import slots
from config import MAX_BALANCE, MAX_FLIP_BET, MAX_SLOT_BET
from trivia_daily import (
    TRIVIA_MAX_BET, fetch_status, format_countdown, pick_questions, start_game,
    trivia_payout, validate_bet,
)
from version_check import is_update_required_error, update_required_text

class MinigamesMixin:
    """Methods for Coin Flip, Number Hunt, RPS, Trivia, and the Slot Machine."""

    # Trivia questions, bets and the daily limit live in trivia_daily.py (25 questions, one game a day,
    # decided by the server's clock).
    _trivia_generation = 0
    _trivia_busy = False
    _trivia_state = None        # last answer from the server: {"can_play": bool, ...}, or None while unknown
    _trivia_clock = (0, 0.0)    # (seconds the server said remain, time.monotonic() when it said so)
    _trivia_job = None
    _trivia_error = ""
    _quiz_answered = False
    trivia_bet = 0

    def make_scrollable_area(self, parent, bg):
            """A frame that stretches to fill the tab, and scrolls instead of clipping when the window is small."""
            outer = tk.Frame(parent, bg=bg)
            outer.pack(fill="both", expand=True)
            outer.columnconfigure(0, weight=1)
            outer.rowconfigure(0, weight=1)
            canvas = tk.Canvas(outer, bg=bg, highlightthickness=0, bd=0)
            bar = ttk.Scrollbar(outer, orient="vertical", command=canvas.yview)
            canvas.configure(yscrollcommand=bar.set)
            canvas.grid(row=0, column=0, sticky="nsew")
            bar.grid(row=0, column=1, sticky="ns")
            inner = tk.Frame(canvas, bg=bg, padx=14, pady=14)
            window = canvas.create_window((0, 0), window=inner, anchor="nw")

            def refit(_event=None):
                view_height = canvas.winfo_height()
                content_height = inner.winfo_reqheight()
                canvas.itemconfigure(window, width=canvas.winfo_width(), height=max(view_height, content_height))
                canvas.configure(scrollregion=(0, 0, canvas.winfo_width(), max(view_height, content_height)))
                if content_height > view_height:
                    bar.grid()
                else:
                    bar.grid_remove()
                    canvas.yview_moveto(0)

            def wheel(event):
                if inner.winfo_reqheight() > canvas.winfo_height():
                    step = -1 if (event.delta > 0 or event.num == 4) else 1
                    canvas.yview_scroll(step * 2, "units")

            def start_wheel(_event):
                canvas.bind_all("<MouseWheel>", wheel)
                canvas.bind_all("<Button-4>", wheel)
                canvas.bind_all("<Button-5>", wheel)

            def stop_wheel(_event):
                for sequence in ("<MouseWheel>", "<Button-4>", "<Button-5>"):
                    canvas.unbind_all(sequence)

            canvas.bind("<Configure>", refit)
            inner.bind("<Configure>", refit)
            outer.bind("<Enter>", start_wheel)
            outer.bind("<Leave>", stop_wheel)
            return inner

    def build_arcade(self):
            frame = self.make_scrollable_area(self.arcade_tab, "#142b26")
            self.label(frame, "ARCADE GAMES", size=20, color="#f1dfad", bold=True, bg="#142b26").pack(anchor="w")
            self.label(frame, "Small games for a quick break. All rewards are fictional points.",
                       size=9, color="#c2d4c9", bg="#142b26").pack(anchor="w", pady=(2, 4))

            top = tk.Frame(frame, bg="#142b26")
            top.pack(fill="x", expand=True)
            self.build_coinflip_card(top).pack(side="left", fill="both", expand=True, padx=(0, 7), pady=2)
            self.build_number_card(top).pack(side="left", fill="both", expand=True, padx=(7, 0), pady=2)
            bottom = tk.Frame(frame, bg="#142b26")
            bottom.pack(fill="both", expand=True)
            self.build_rps_card(bottom).pack(side="left", fill="both", expand=True, padx=(0, 7), pady=2)
            self.build_trivia_card(bottom).pack(side="left", fill="both", expand=True, padx=(7, 0), pady=2)
            self.build_slots_card(frame).pack(fill="x", pady=(2, 0))

    def build_coinflip_card(self, parent):
            card = self.make_card(parent, "COIN FLIP", "Pick Heads or Tails. Maximum play: 100 points.")
            row = tk.Frame(card, bg="#203c34")
            row.pack(anchor="w", pady=4)
            self.flip_entry = tk.Entry(row, width=7, justify="center")
            self.flip_entry.insert(0, "25")
            self.flip_entry.pack(side="left", padx=(0, 8))
            self.button(row, "Heads", lambda: self.coin_flip("Heads"), True).pack(side="left", padx=3)
            self.button(row, "Tails", lambda: self.coin_flip("Tails")).pack(side="left", padx=3)
            self.flip_result = self.label(card, "Ready for a flip.", size=9, color="#f0e3bd", bg="#203c34")
            self.flip_result.pack(anchor="w", pady=(5, 0))
            return card

    def build_number_card(self, parent):
            card = self.make_card(parent, "NUMBER HUNT", "Find the secret number from 1 to 20 in five tries.")
            self.number_hint = self.label(card, "Start a round to get a secret number.", size=9, color="#f0e3bd", bg="#203c34")
            self.number_hint.pack(anchor="w", pady=4)
            row = tk.Frame(card, bg="#203c34")
            row.pack(anchor="w", pady=4)
            self.number_entry = tk.Entry(row, width=7, justify="center")
            self.number_entry.pack(side="left", padx=(0, 8))
            self.number_start_btn = self.button(row, "Start", self.start_number_hunt)
            self.number_start_btn.pack(side="left", padx=3)
            self.number_guess_btn = self.button(row, "Guess", self.guess_number, True)
            self.number_guess_btn.pack(side="left", padx=3)
            self.number_guess_btn.config(state="disabled")
            return card

    def build_rps_card(self, parent):
            card = self.make_card(parent, "ROCK • PAPER • SCISSORS", "Beat the computer to earn points. Ties give a small bonus.")
            row = tk.Frame(card, bg="#203c34")
            row.pack(anchor="w", pady=5)
            for move in ("Rock", "Paper", "Scissors"):
                self.button(row, move, lambda m=move: self.play_rps(m), move == "Rock").pack(side="left", padx=(0, 5))
            self.rps_result = self.label(card, "Choose your move.", size=9, color="#f0e3bd", bg="#203c34")
            self.rps_result.pack(anchor="w", pady=(5, 0))
            return card

    def build_trivia_card(self, parent):
        card = self.make_card(parent, "QUICK TRIVIA",
                              f"One quiz a day. Optional bet up to {TRIVIA_MAX_BET:,} points (0 = no bet).")
        self._trivia_generation += 1
        self._trivia_busy = False
        self._trivia_state = None
        self._trivia_error = ""
        self._trivia_job = None
        self.trivia_question = self.label(card, "Start a quiz when you're ready.", size=9, color="#f0e3bd", bg="#203c34", wraplength=350, justify="left")
        self.trivia_question.pack(anchor="w", pady=4)
        self.trivia_options = tk.Frame(card, bg="#203c34")
        self.trivia_options.pack(anchor="w", fill="x")
        self.trivia_status = self.label(card, "", size=9, color="#e7d9ae", bg="#203c34", wraplength=350, justify="left")
        self.trivia_status.pack(anchor="w", pady=(2, 0))
        bet_row = tk.Frame(card, bg="#203c34")
        bet_row.pack(anchor="w", pady=(6, 0))
        self.label(bet_row, "Bet:", bg="#203c34").pack(side="left", padx=(0, 6))
        self.trivia_bet_entry = tk.Entry(bet_row, width=8, justify="center")
        self.trivia_bet_entry.insert(0, "0")
        self.trivia_bet_entry.pack(side="left", padx=(0, 6))
        self.button(bet_row, "Max", self._set_max_trivia_bet).pack(side="left")
        self.label(card, "5 correct pays 3x, 4 pays 2x, 3 returns your bet, 2 returns half, 0-1 loses it. "
                         "No bet: points for each correct answer.",
                   size=8, color="#c2d4c9", bg="#203c34", wraplength=350, justify="left").pack(anchor="w", pady=(4, 0))
        self.trivia_start_btn = self.button(card, "Start quiz", self.start_quiz, True)
        self.trivia_start_btn.pack(anchor="w", pady=(7, 0))
        self.render_trivia_panel()
        self.refresh_trivia_status()
        return card

    def _set_max_trivia_bet(self):
        self.trivia_bet_entry.delete(0, "end")
        self.trivia_bet_entry.insert(0, str(max(0, min(TRIVIA_MAX_BET, self.balance))))

    def _trivia_online(self):
        return bool(self.online_mode and self.account_service)

    def _trivia_seconds_left(self):
        seconds, at = self._trivia_clock
        # time.monotonic() ignores changes to the computer's date and time, so setting the clock
        # forward cannot shorten the wait.
        return max(0, int(seconds - (time.monotonic() - at)))

    def render_trivia_panel(self):
        """Show the right message and enable the Start button only when the server says today's game is free."""
        if not hasattr(self, "trivia_start_btn") or not self.trivia_start_btn.winfo_exists():
            return
        if not self._trivia_online():
            text, can_start = "Sign in to play Trivia. It can be played once a day, and the server keeps track of the day.", False
        elif self.quiz_active:
            text, can_start = "", False
        elif self._trivia_busy:
            text, can_start = "Checking with the server...", False
        elif self._trivia_error:
            text, can_start = self._trivia_error, False
        elif self._trivia_state is None:
            text, can_start = "Checking today's game...", False
        elif self._trivia_state["can_play"]:
            text, can_start = "Today's game is available.", True
        else:
            text, can_start = (f"You have played Trivia today. Next game in "
                               f"{format_countdown(self._trivia_seconds_left())}."), False
        self.trivia_status.config(text=text)
        self.trivia_start_btn.config(state="normal" if can_start else "disabled")

    def refresh_trivia_status(self):
        """Ask the server (off the UI thread) whether today's game is available."""
        if not self._trivia_online():
            self.render_trivia_panel()
            return
        generation = self._trivia_generation
        client = self.account_service.client

        def worker():
            try:
                state, error = fetch_status(client), None
            except Exception as exc:  # offline, suspended, or supabase_trivia_daily_setup.sql not run yet
                state, error = None, exc
            try:
                self.root.after(0, lambda: self._apply_trivia_status(state, error, generation))
            except (tk.TclError, RuntimeError):
                pass

        threading.Thread(target=worker, name="MiniArcadeTriviaStatus", daemon=True).start()

    def _apply_trivia_status(self, state, error, generation):
        if generation != self._trivia_generation:
            return  # signed out, or a different account, since this check began
        if error is not None:
            if is_update_required_error(error):
                self.handle_update_required(update_required_text(error))
            self._trivia_error = "Could not check today's game: " + " ".join(str(getattr(error, "message", "") or error).split())[:160]
            self._trivia_state = None
        else:
            self._trivia_error = ""
            self._apply_trivia_state(state)
        self.render_trivia_panel()

    def _apply_trivia_state(self, state):
        self._trivia_state = state
        self._trivia_clock = (state["seconds_until_reset"], time.monotonic())
        self._schedule_trivia_tick()

    def _schedule_trivia_tick(self):
        if self._trivia_job is not None:
            try:
                self.root.after_cancel(self._trivia_job)
            except tk.TclError:
                pass
            self._trivia_job = None
        if self._trivia_state is None or self._trivia_state["can_play"]:
            return
        generation = self._trivia_generation

        def tick():
            self._trivia_job = None
            if generation != self._trivia_generation or not self._trivia_online():
                return  # signed out, or the card was rebuilt
            self.render_trivia_panel()
            if self._trivia_seconds_left() <= 0:
                self.refresh_trivia_status()  # the server decides when the new day has started
            else:
                self._trivia_job = self.root.after(1000, tick)

        self._trivia_job = self.root.after(1000, tick)

    SLOT_COLORS = {"7": "#c62828", "BAR": "#1d2b26", "\u2666": "#c62828", "\u2665": "#c62828",
                   "\u2663": "#1d2b26", "\u2660": "#1d2b26"}
    SLOT_STOP_FRAMES = (8, 13, 18)  # the reels stop one after another
    SLOT_FRAME_MS = 70

    def build_slots_card(self, parent):
            card = self.make_card(parent, "SLOT MACHINE", slots.paytable_text())
            card.config(pady=8)
            row = tk.Frame(card, bg="#203c34")
            row.pack(anchor="w")
            reels = tk.Frame(row, bg="#203c34")
            reels.pack(side="left")
            self.slot_reel_labels = []
            for _ in range(3):
                reel = tk.Label(reels, text="?", width=5, font=("Segoe UI", 22, "bold"),
                                bg="#f4ecd2", fg="#1d2b26", relief="ridge", bd=3, pady=1)
                reel.pack(side="left", padx=4)
                self.slot_reel_labels.append(reel)
            controls = tk.Frame(row, bg="#203c34")
            controls.pack(side="left", padx=(22, 0))
            bet_row = tk.Frame(controls, bg="#203c34")
            bet_row.pack(anchor="w")
            self.label(bet_row, f"Bet (max {MAX_SLOT_BET})", size=9, color="#c2d4c9", bg="#203c34").pack(side="left", padx=(0, 6))
            self.slot_entry = tk.Entry(bet_row, width=7, justify="center")
            self.slot_entry.insert(0, "10")
            self.slot_entry.pack(side="left", padx=(0, 8))
            self.slot_spin_btn = self.button(bet_row, "Spin", self.play_slots, True)
            self.slot_spin_btn.pack(side="left")
            self.slot_result = self.label(controls, "Place a bet and spin the reels.", size=9, color="#f0e3bd",
                                          bg="#203c34", wraplength=470, justify="left")
            self.slot_result.pack(anchor="w", pady=(7, 0))
            self.slot_spinning = False
            return card

    def play_slots(self):
            if self.slot_spinning:
                return
            try:
                bet = int(self.slot_entry.get())
            except ValueError:
                messagebox.showwarning("Invalid bet", "Enter a whole-number slot machine bet.", parent=self.root)
                return
            if bet < 1 or bet > MAX_SLOT_BET:
                messagebox.showwarning("Bet limit", f"Slot machine plays must be from 1 to {MAX_SLOT_BET} points.", parent=self.root)
                return
            if bet > self.balance:
                messagebox.showwarning("Not enough points", "Your balance is too low for that play.", parent=self.root)
                return
            # The result is decided and applied right now; the animation only reveals it.
            reels = slots.spin()
            mult = slots.multiplier(reels)
            payout = bet * mult
            self.balance = min(MAX_BALANCE, self.balance - bet + payout)
            self.data["slot_spins"] += 1
            if mult > 1:
                self.data["slot_wins"] += 1
            line = " ".join(reels)
            if mult > 1:
                text = f"{line} \u2014 three of a kind! \u00d7{mult}: net gain {payout - bet:,} points."
            elif mult == 1:
                text = f"{line} \u2014 a pair! Your {bet} points are returned."
            else:
                text = f"{line} \u2014 no match. {bet} points used."
            self.slot_spinning = True
            self.slot_spin_btn.config(state="disabled")
            self.slot_result.config(text="Spinning...", fg="#f0e3bd")
            self._animate_slots(list(self.slot_reel_labels), reels, text, mult, 0)

    def _animate_slots(self, labels, reels, text, mult, frame):
            try:
                for index, label in enumerate(labels):
                    if frame < self.SLOT_STOP_FRAMES[index]:
                        label.config(text=random.choice(slots.SYMBOLS), fg="#8a948d")
                    elif frame == self.SLOT_STOP_FRAMES[index]:
                        label.config(text=reels[index], fg=self.SLOT_COLORS[reels[index]])
                if frame < self.SLOT_STOP_FRAMES[-1]:
                    self.root.after(self.SLOT_FRAME_MS,
                                    lambda: self._animate_slots(labels, reels, text, mult, frame + 1))
                    return
                self.slot_spinning = False
                self.slot_spin_btn.config(state="normal")
                self.slot_result.config(text=text, fg="#ffd76a" if mult > 1 else "#f0e3bd")
            except tk.TclError:
                # The window was rebuilt (signed out) while the reels were still spinning.
                self.slot_spinning = False
                return
            self.set_status("Slot machine: " + text)
            self.log_event("Slot machine: " + text)

    def coin_flip(self, choice):
            try:
                bet = int(self.flip_entry.get())
            except ValueError:
                messagebox.showwarning("Invalid bet", "Enter a whole-number coin-flip bet.", parent=self.root)
                return
            if bet < 1 or bet > MAX_FLIP_BET:
                messagebox.showwarning("Bet limit", "Coin-flip plays must be from 1 to 100 points.", parent=self.root)
                return
            if bet > self.balance:
                messagebox.showwarning("Not enough points", "Your balance is too low for that play.", parent=self.root)
                return
            outcome = random.choice(("Heads", "Tails"))
            self.balance -= bet
            self.data["coin_flips"] += 1
            if outcome == choice:
                self.data["coin_flip_wins"] += 1
                self.balance += bet * 2
                result = f"{outcome}! Correct — net gain: {bet} points."
            else:
                result = f"{outcome}! Not this time — {bet} points used."
            self.flip_result.config(text=result)
            self.set_status("Coin flip: " + result)
            self.log_event("Coin flip: " + result)

    def start_number_hunt(self):
            self.number_target = random.randint(1, 20)
            self.number_attempts = 5
            self.number_active = True
            self.number_hint.config(text="I picked a number. You have five guesses!")
            self.number_guess_btn.config(state="normal")
            self.number_start_btn.config(state="disabled")
            self.number_entry.delete(0, "end")
            self.number_entry.focus_set()

    def guess_number(self):
            if not self.number_active:
                return
            try:
                guess = int(self.number_entry.get())
                if not 1 <= guess <= 20:
                    raise ValueError
            except ValueError:
                messagebox.showwarning("Choose 1–20", "Enter a whole number from 1 to 20.", parent=self.root)
                return
            self.number_attempts -= 1
            if guess == self.number_target:
                reward = self.data["number_reward"]
                self.balance += reward
                self.data["number_hunt_games"] += 1
                self.data["number_hunt_wins"] += 1
                self.number_hint.config(text=f"You found it! +{reward} points. Start another round.")
                self.end_number_hunt(f"Number Hunt win +{reward}")
            elif self.number_attempts <= 0:
                self.data["number_hunt_games"] += 1
                self.number_hint.config(text=f"Out of guesses! The number was {self.number_target}. Try again.")
                self.end_number_hunt("Number Hunt completed")
            else:
                direction = "Higher" if guess < self.number_target else "Lower"
                self.number_hint.config(text=f"{direction}! {self.number_attempts} guesses left.")
            self.set_status(self.number_hint.cget("text"))

    def end_number_hunt(self, event):
            self.number_active = False
            self.number_guess_btn.config(state="disabled")
            self.number_start_btn.config(state="normal")
            self.log_event(event)

    def play_rps(self, player_move):
            computer = random.choice(("Rock", "Paper", "Scissors"))
            self.data["rps_games"] += 1
            if player_move == computer:
                reward = 2
                self.balance += reward
                result = f"You both chose {computer}. Tie bonus: +{reward}."
            elif (player_move, computer) in (("Rock", "Scissors"), ("Paper", "Rock"), ("Scissors", "Paper")):
                reward = self.data["rps_reward"]
                self.balance += reward
                self.data["rps_wins"] += 1
                result = f"You chose {player_move}; computer chose {computer}. You win +{reward}!"
            else:
                result = f"You chose {player_move}; computer chose {computer}. Computer wins this round."
            self.rps_result.config(text=result)
            self.set_status(result)
            self.log_event("Rock Paper Scissors: " + result)

    def start_quiz(self):
        if self.quiz_active or self._trivia_busy:
            return
        if not self._trivia_online():
            self.render_trivia_panel()
            return
        try:
            bet = validate_bet(self.trivia_bet_entry.get(), self.balance)
        except ValueError as exc:
            messagebox.showinfo("Trivia bet", str(exc), parent=self.root)
            return

        # The server uses up today's game first. Only if it says yes do we take the bet and start.
        self._trivia_busy = True
        self.render_trivia_panel()
        generation = self._trivia_generation
        client = self.account_service.client

        def worker():
            try:
                result, error = start_game(client, bet), None
            except Exception as exc:
                result, error = None, exc
            try:
                self.root.after(0, lambda: self._finish_trivia_start(result, error, bet, generation))
            except (tk.TclError, RuntimeError):
                pass

        threading.Thread(target=worker, name="MiniArcadeTriviaStart", daemon=True).start()

    def _finish_trivia_start(self, result, error, bet, generation):
        if generation != self._trivia_generation:
            return
        self._trivia_busy = False
        if error is not None:
            if is_update_required_error(error):
                self.handle_update_required(update_required_text(error))
            # Nothing was used up on the server, so the player can simply try again.
            self._trivia_error = ""
            self.render_trivia_panel()
            messagebox.showwarning(
                "Trivia", "Trivia could not start, and today's game was not used up.\n\n"
                + " ".join(str(getattr(error, "message", "") or error).split())[:200], parent=self.root)
            return
        self._apply_trivia_state(result)
        if not result["ok"]:
            self.render_trivia_panel()
            messagebox.showinfo("Trivia", "You have already played Trivia today.", parent=self.root)
            return

        stake = bet
        if stake > self.balance:  # the balance dropped while we were asking the server
            stake = 0
            messagebox.showinfo("Trivia", "Your balance changed, so this game is played without a bet.", parent=self.root)
        self.trivia_bet = stake
        self.balance -= stake
        self.quiz_questions = pick_questions()
        self.quiz_index = 0
        self.quiz_score = 0
        self.quiz_active = True
        self.data["trivia_games"] += 1
        self.render_trivia_panel()
        if stake:
            self.set_status(f"Trivia: you bet {stake:,} points.")
        self.show_quiz_question()

    def show_quiz_question(self):
        self._quiz_answered = False
        for child in self.trivia_options.winfo_children():
            child.destroy()
        if self.quiz_index >= len(self.quiz_questions):
            if self.trivia_bet:
                payout = trivia_payout(self.trivia_bet, self.quiz_score)
                self.balance += payout
                net = payout - self.trivia_bet
                msg = (f"Quiz complete: {self.quiz_score}/5 correct. Bet {self.trivia_bet:,}, paid back {payout:,} "
                       f"({'+' if net >= 0 else '-'}{abs(net):,}).")
            else:
                bonus = 10 if self.quiz_score == 5 else 0
                self.balance += bonus
                msg = f"Quiz complete: {self.quiz_score}/5 correct. Bonus: +{bonus}."
            self.trivia_question.config(text=msg)
            self.quiz_active = False
            self.render_trivia_panel()
            self.set_status(msg)
            self.log_event(f"Trivia finished {self.quiz_score}/5" + (f", bet {self.trivia_bet}" if self.trivia_bet else ""))
            self.trivia_bet = 0
            return
        question, options, answer = self.quiz_questions[self.quiz_index]
        self.trivia_question.config(text=f"Question {self.quiz_index + 1}/5: {question}")
        for index, option in enumerate(options):
            self.button(self.trivia_options, option,
                        lambda i=index: self.answer_quiz(i), False).pack(anchor="w", fill="x", pady=2)

    def answer_quiz(self, choice):
        # One answer per question: a double-click must not score twice or skip ahead.
        if not self.quiz_active or self._quiz_answered or self.quiz_index >= len(self.quiz_questions):
            return
        self._quiz_answered = True
        question, options, correct = self.quiz_questions[self.quiz_index]
        if choice == correct:
            self.quiz_score += 1
            self.data["trivia_correct"] += 1
            if self.trivia_bet:
                message = "Correct!"  # with a bet, the payout comes at the end
            else:
                reward = self.data["trivia_reward"]
                self.balance += reward
                message = f"Correct! +{reward} points."
        else:
            message = f"Not quite — the answer was {options[correct]}."
        self.trivia_question.config(text=message)
        self.quiz_index += 1
        for child in self.trivia_options.winfo_children():
            child.destroy()  # no double-clicking an answer while the result is showing
        self.root.after(850, self.show_quiz_question)
        self.set_status(message)
