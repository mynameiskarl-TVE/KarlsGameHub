"""Arcade tab and the non-Blackjack minigames."""
import random
import tkinter as tk
from config import MAX_FLIP_BET

class MinigamesMixin:
    """Methods for Coin Flip, Number Hunt, RPS, and Trivia."""

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

    def build_arcade(self):
            frame = tk.Frame(self.arcade_tab, bg="#142b26", padx=14, pady=14)
            frame.pack(fill="both", expand=True)
            self.label(frame, "ARCADE GAMES", size=20, color="#f1dfad", bold=True, bg="#142b26").pack(anchor="w")
            self.label(frame, "Small games for a quick break. All rewards are fictional points.",
                       size=9, color="#c2d4c9", bg="#142b26").pack(anchor="w", pady=(2, 10))

            top = tk.Frame(frame, bg="#142b26")
            top.pack(fill="x", expand=True)
            self.build_coinflip_card(top).pack(side="left", fill="both", expand=True, padx=(0, 7), pady=4)
            self.build_number_card(top).pack(side="left", fill="both", expand=True, padx=(7, 0), pady=4)
            bottom = tk.Frame(frame, bg="#142b26")
            bottom.pack(fill="both", expand=True)
            self.build_rps_card(bottom).pack(side="left", fill="both", expand=True, padx=(0, 7), pady=8)
            self.build_trivia_card(bottom).pack(side="left", fill="both", expand=True, padx=(7, 0), pady=8)

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
