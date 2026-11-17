"""Arcade tab and the non-Blackjack minigames."""
import random
import tkinter as tk
from tkinter import messagebox, ttk
import slots
from config import MAX_BALANCE, MAX_FLIP_BET, MAX_SLOT_BET

class MinigamesMixin:
    """Methods for Coin Flip, Number Hunt, RPS, Trivia, and the Slot Machine."""

    TRIVIA = [
            ("Which planet is known as the Red Planet?", ["Venus", "Mars", "Jupiter", "Mercury"], 1),
            ("How many sides does a hexagon have?", ["Five", "Six", "Seven", "Eight"], 1),
            ("What is the largest ocean on Earth?", ["Atlantic", "Indian", "Pacific", "Arctic"], 2),
            ("Which animal is the largest living land animal?", ["Giraffe", "Hippo", "African elephant", "Rhino"], 2),
            ("What is H2O commonly called?", ["Oxygen", "Hydrogen", "Salt", "Water"], 3),
            ("How many minutes are in two hours?", ["90", "100", "120", "140"], 2),
            ("Which instrument usually has 88 keys?", ["Violin", "Piano", "Flute", "Trumpet"], 1),
            ("What is the process plants use to make food from sunlight?", ["Evaporation", "Photosynthesis", "Digestion", "Condensation"], 1),
            ("Which is the closest star to Earth?", ["Sirius", "Polaris", "The Sun", "Vega"], 2),
            ("What is 9 × 7?", ["56", "63", "72", "79"], 1),
            ("Which continent is the Sahara Desert in?", ["Asia", "Africa", "Australia", "South America"], 1),
            ("What do bees collect from flowers?", ["Nectar", "Sand", "Bark", "Dew only"], 0),
        ]

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
            card = self.make_card(parent, "QUICK TRIVIA", "Answer five questions. Earn points for each correct answer.")
            self.trivia_question = self.label(card, "Start a quiz when you're ready.", size=9, color="#f0e3bd", bg="#203c34", wraplength=350, justify="left")
            self.trivia_question.pack(anchor="w", pady=4)
            self.trivia_options = tk.Frame(card, bg="#203c34")
            self.trivia_options.pack(anchor="w", fill="x")
            self.trivia_start_btn = self.button(card, "Start quiz", self.start_quiz, True)
            self.trivia_start_btn.pack(anchor="w", pady=(7, 0))
            return card

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
            self.quiz_questions = random.sample(self.TRIVIA, 5)
            self.quiz_index = 0
            self.quiz_score = 0
            self.quiz_active = True
            self.data["trivia_games"] += 1
            self.trivia_start_btn.config(state="disabled")
            self.show_quiz_question()

    def show_quiz_question(self):
            for child in self.trivia_options.winfo_children():
                child.destroy()
            if self.quiz_index >= len(self.quiz_questions):
                bonus = 10 if self.quiz_score == 5 else 0
                self.balance += bonus
                msg = f"Quiz complete: {self.quiz_score}/5 correct. Bonus: +{bonus}."
                self.trivia_question.config(text=msg)
                self.quiz_active = False
                self.trivia_start_btn.config(state="normal")
                self.set_status(msg)
                self.log_event(f"Trivia finished {self.quiz_score}/5")
                return
            question, options, answer = self.quiz_questions[self.quiz_index]
            self.trivia_question.config(text=f"Question {self.quiz_index + 1}/5: {question}")
            for index, option in enumerate(options):
                self.button(self.trivia_options, option,
                            lambda i=index: self.answer_quiz(i), False).pack(anchor="w", fill="x", pady=2)

    def answer_quiz(self, choice):
            if not self.quiz_active:
                return
            question, options, correct = self.quiz_questions[self.quiz_index]
            if choice == correct:
                reward = self.data["trivia_reward"]
                self.quiz_score += 1
                self.data["trivia_correct"] += 1
                self.balance += reward
                message = f"Correct! +{reward} points."
            else:
                message = f"Not quite — the answer was {options[correct]}."
            self.trivia_question.config(text=message)
            self.quiz_index += 1
            self.root.after(850, self.show_quiz_question)
            self.set_status(message)
