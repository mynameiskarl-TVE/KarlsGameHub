"""Blackjack cards, rules, interface, and round logic."""
import random
import tkinter as tk
from tkinter import messagebox
from config import SUITS, RANKS

def card_value(card):
    rank = card[0]
    if rank in ("J", "Q", "K"):
        return 10
    if rank == "A":
        return 11
    return int(rank)

def hand_value(hand):
    total = sum(card_value(card) for card in hand)
    aces = sum(1 for card in hand if card[0] == "A")
    while total > 21 and aces:
        total -= 10
        aces -= 1
    return total

RIGGED_OPENING_TOTALS = (10, 19, 20, 21)

def choose_player_opening_hand(deck, target_chance):
    """Deal a normal pair, or bias it toward one of the configured totals.

    The deck remains a standard 52-card deck: selected cards are removed from
    it, so no duplicate cards are introduced by the mechanic.
    Returns (hand, target_total_or_None).
    """
    if deck and random.random() < max(0, min(100, int(target_chance))) / 100.0:
        target = random.choice(RIGGED_OPENING_TOTALS)
        pairs = []
        for i in range(len(deck)):
            for j in range(i + 1, len(deck)):
                if hand_value((deck[i], deck[j])) == target:
                    pairs.append((deck[i], deck[j]))
        if pairs:
            hand = list(random.choice(pairs))
            deck.remove(hand[0])
            deck.remove(hand[1])
            return hand, target
    if len(deck) < 2:
        raise ValueError("Not enough cards remain to deal an opening hand.")
    return [deck.pop(), deck.pop()], None

def choose_dealer_card(deck, dealer_hand, rigging_enabled, reduction_percent):
    """Draw one dealer card, optionally lowering odds of reaching 20 or 21.

    Returns (card, had_target_card_available, selected_target_card).
    If every remaining card would reach 20/21, one is selected normally so
    the game can always finish a hand.
    """
    if not deck:
        raise ValueError("The deck is empty.")
    if not rigging_enabled or not dealer_hand:
        return deck.pop(), False, False

    reduction = max(0, min(100, int(reduction_percent))) / 100.0
    target_flags = [hand_value(dealer_hand + [card]) in (20, 21) for card in deck]
    had_target = any(target_flags)
    if not had_target:
        return deck.pop(), False, False

    target_weight = 1.0 - reduction
    weights = [target_weight if is_target else 1.0 for is_target in target_flags]
    if sum(weights) <= 0:
        # At 100% reduction, use a non-target card whenever one remains.
        safe_indices = [i for i, is_target in enumerate(target_flags) if not is_target]
        if safe_indices:
            selected_index = random.choice(safe_indices)
        else:
            selected_index = random.randrange(len(deck))
    else:
        selected_index = random.choices(range(len(deck)), weights=weights, k=1)[0]
    selected_target = target_flags[selected_index]
    return deck.pop(selected_index), had_target, selected_target

class BlackjackMixin:
    """Methods that build and run the Blackjack tab."""

    def build_blackjack(self):
            outer = tk.Frame(self.blackjack_tab, bg="#142b26", padx=18, pady=16)
            outer.pack(fill="both", expand=True)
            self.label(outer, "BLACKJACK", size=21, color="#f1dfad", bold=True, bg="#142b26").pack(pady=(0, 5))
            self.label(outer, "Beat the dealer without going over 21.", size=10, color="#c2d4c9", bg="#142b26").pack(pady=(0, 4))
            self.button(outer, "ⓘ  Info", self.show_blackjack_info, False, 10).pack(pady=(0, 8))
            self.rigging_badge = self.label(outer, variable=self.rigging_indicator, size=9,
                                            color="#ffcf83", bold=True, bg="#142b26")
            self.rigging_badge.pack(pady=(0, 10))
            table = tk.Frame(outer, bg="#1d5948", padx=22, pady=28,
                             highlightthickness=1, highlightbackground="#5b8875")
            table.pack(fill="both", expand=True)
            self.label(table, variable=self.dealer_var, size=15, bg="#1d5948", color="white", wraplength=760).pack(anchor="w", pady=(12, 40))
            self.label(table, variable=self.player_var, size=15, bg="#1d5948", color="white", wraplength=760).pack(anchor="w", pady=(0, 30))
            self.blackjack_status = self.label(table, "Place a bet and deal when ready.", size=11, bg="#1d5948", color="#ffe6a8", wraplength=760)
            self.blackjack_status.pack(anchor="w", pady=10)
            control = tk.Frame(outer, bg="#142b26")
            control.pack(pady=14)
            self.label(control, "Bet", bg="#142b26").grid(row=0, column=0, padx=5)
            self.bet_entry = tk.Entry(control, width=9, justify="center", font=("Segoe UI", 11))
            self.bet_entry.insert(0, "25")
            self.bet_entry.grid(row=0, column=1, padx=5)
            self.deal_btn = self.button(control, "Deal", self.start_round, True, 10)
            self.deal_btn.grid(row=0, column=2, padx=5)
            self.hit_btn = self.button(control, "Hit", self.hit, False, 8)
            self.hit_btn.grid(row=0, column=3, padx=4)
            self.stand_btn = self.button(control, "Stand", self.stand, False, 8)
            self.stand_btn.grid(row=0, column=4, padx=4)
            self.split_btn = self.button(control, "Split", self.split_hand, False, 8)
            self.split_btn.grid(row=0, column=5, padx=4)
            self.double_btn = self.button(control, "Double", self.double_down, False, 8)
            self.double_btn.grid(row=0, column=6, padx=4)
            self.hit_btn.config(state="disabled")
            self.stand_btn.config(state="disabled")
            self.split_btn.config(state="disabled")
            self.double_btn.config(state="disabled")
            self.button(control, "Clear table", self.reset_table, False, 10).grid(row=0, column=7, padx=4)
            self.label(
                outer,
                "Natural blackjack pays 3:2. Double Down doubles that hand’s bet and deals one final card. "
                "Split matching-value opening cards by matching the bet, then play each hand separately. "
                "Split aces receive one card each. A 21 after splitting pays as a normal win.",
                size=9, color="#9fb7aa", bg="#142b26", wraplength=850, justify="center"
            ).pack(pady=(4, 0))

    def show_blackjack_info(self):
            """Open a short, scrollable guide to the rules used by this game."""
            existing = getattr(self, "_blackjack_info_window", None)
            if existing is not None and existing.winfo_exists():
                existing.lift()
                existing.focus_force()
                return

            win = tk.Toplevel(self.root)
            self._blackjack_info_window = win
            win.title("Blackjack — How to Play")
            win.configure(bg="#142b26")
            win.geometry("540x570")
            win.minsize(480, 480)
            win.transient(self.root)

            tk.Label(
                win, text="BLACKJACK INFO", font=("Segoe UI", 17, "bold"),
                fg="#f1dfad", bg="#142b26"
            ).pack(pady=(16, 4))
            tk.Label(
                win, text="A quick guide to the rules and buttons.",
                font=("Segoe UI", 9), fg="#c2d4c9", bg="#142b26"
            ).pack(pady=(0, 12))

            content_frame = tk.Frame(win, bg="#203c34", padx=2, pady=2)
            content_frame.pack(fill="both", expand=True, padx=16, pady=(0, 12))
            guide = tk.Text(
                content_frame, wrap="word", height=20, width=58,
                bg="#203c34", fg="#f6f0dd", insertbackground="#f6f0dd",
                relief="flat", borderwidth=0, padx=15, pady=13,
                font=("Segoe UI", 10), spacing1=2, spacing3=5,
                cursor="arrow", takefocus=False
            )
            scrollbar = tk.Scrollbar(content_frame, command=guide.yview)
            guide.configure(yscrollcommand=scrollbar.set)
            scrollbar.pack(side="right", fill="y")
            guide.pack(side="left", fill="both", expand=True)
            guide.tag_configure("heading", font=("Segoe UI", 10, "bold"), foreground="#e6d49e", spacing1=6)
            guide.tag_configure("body", font=("Segoe UI", 9), foreground="#f0eee5")

            sections = [
                ("THE GOAL", "Finish with a hand closer to 21 than the dealer without going over 21."),
                ("CARD VALUES", "Number cards are worth their number. Jacks, Queens, and Kings are worth 10. An Ace counts as 1 or 11, whichever helps your hand without going over 21."),
                ("START A ROUND", "Enter your bet and choose Deal. Your bet is taken from your fictional-point balance. The dealer's second card is hidden while you play."),
                ("YOUR TURN", "Hit draws another card. Stand keeps your current total. Going over 21 is a bust and loses that hand. A hand that reaches 21 automatically stands."),
                ("SPLIT", "When your first two cards have the same point value, choose Split and match your original bet. You will play two hands separately. This game allows one split per round. Split Aces get one card each and then stand. A 21 made after splitting is a regular 21, not a natural blackjack."),
                ("DOUBLE DOWN", "On a two-card hand, choose Double to add another bet equal to that hand's current bet. You receive exactly one more card and then stand automatically. You can double a split hand too, as long as you have enough points."),
                ("THE DEALER & PAYOUTS", "After you finish, the dealer draws until reaching 17 or more. A regular win pays 1:1; a tie returns that hand's bet. An original, unsplit two-card natural blackjack pays 3:2. A bust or loss forfeits that hand's bet."),
                ("REMEMBER", "All points in Mini Arcade are fictional. You can close this guide at any time and return to the table."),
            ]
            for heading, body in sections:
                guide.insert("end", heading + "\n", "heading")
                guide.insert("end", body + "\n\n", "body")
            guide.configure(state="disabled")

            close_row = tk.Frame(win, bg="#142b26")
            close_row.pack(fill="x", padx=16, pady=(0, 14))

            def close_info():
                self._blackjack_info_window = None
                if win.winfo_exists():
                    win.destroy()

            self.button(close_row, "Close", close_info, True, 12).pack()
            win.protocol("WM_DELETE_WINDOW", close_info)
            win.bind("<Escape>", lambda _event: close_info())

    def start_round(self):
            if self.round_active:
                return
            try:
                bet = int(self.bet_entry.get())
            except ValueError:
                messagebox.showwarning("Invalid bet", "Enter a whole-number bet.", parent=self.root)
                return
            if bet < 1 or bet > self.balance:
                messagebox.showwarning("Invalid bet", "Bet must be at least 1 and no more than your balance.", parent=self.root)
                return

            self.bet = bet
            self.balance -= bet
            self.deck = [(rank, suit) for suit in SUITS for rank in RANKS]
            random.shuffle(self.deck)
            if self.data.get("rigging_enabled", False):
                self.player, chosen_target = choose_player_opening_hand(
                    self.deck, self.data.get("rig_player_hand_chance", 95)
                )
                if chosen_target is not None:
                    self.data["rigged_openings"] += 1
                    self.log_event(f"Rig mode selected a {chosen_target}-point opening hand")
            else:
                self.player = [self.deck.pop(), self.deck.pop()]

            self.player_hands = [self.player]
            self.hand_bets = [bet]
            self.hand_statuses = ["playing"]
            self.hand_doubled = [False]
            self.active_hand_index = 0
            self.split_used = False
            self.dealer = [self.deck.pop()]
            self.dealer.append(self.draw_dealer_card())
            self.round_active = True
            self.deal_btn.config(state="disabled")
            self.refresh_hands(hide_dealer=True)
            self.update_blackjack_controls()
            self.refresh_header()
            self.log_event(f"Started blackjack round with {bet} points")
            if hand_value(self.player) == 21:
                # An original two-card 21 is a natural blackjack. It is settled
                # immediately, after checking the dealer's already-dealt cards.
                self.finish_round()

    @staticmethod
    def show_hand(hand, hide_second=False):
            if not hand:
                return "—"
            return "   ".join("[Hidden]" if hide_second and i == 1 else f"{rank}{suit}"
                             for i, (rank, suit) in enumerate(hand))

    def refresh_rigging_indicator(self):
            if not hasattr(self, "rigging_indicator"):
                return
            if self.data.get("rigging_enabled", False):
                chance = int(self.data.get("rig_player_hand_chance", 95))
                reduction = int(self.data.get("rig_dealer_reduction", 95))
                self.rigging_indicator.set(
                    f"OWNER RIG MODE ACTIVE • opening hand targets 10 / 19 / 20 / 21 ({chance}%) • dealer 20/21 odds reduced ({reduction}%)"
                )
            else:
                self.rigging_indicator.set("STANDARD MODE • normally shuffled cards")

    def draw_dealer_card(self):
            card, had_target, selected_target = choose_dealer_card(
                self.deck,
                self.dealer,
                bool(self.data.get("rigging_enabled", False)),
                int(self.data.get("rig_dealer_reduction", 95)),
            )
            if had_target and not selected_target and self.data.get("rigging_enabled", False):
                self.data["dealer_high_cards_avoided"] += 1
            return card

    def refresh_hands(self, hide_dealer=False):
            dealer_text = self.show_hand(self.dealer, hide_second=hide_dealer)
            if self.dealer and not hide_dealer:
                dealer_text += f"   (total: {hand_value(self.dealer)})"
            self.dealer_var.set("Dealer: " + dealer_text)

            hands = self.player_hands or ([self.player] if self.player else [])
            lines = []
            for index, hand in enumerate(hands):
                hand_text = self.show_hand(hand)
                total = hand_value(hand)
                bet = self.hand_bets[index] if index < len(self.hand_bets) else self.bet
                status = self.hand_statuses[index].upper() if index < len(self.hand_statuses) else ""
                marker = "▶ " if self.round_active and index == self.active_hand_index else "  "
                lines.append(f"{marker}Hand {index + 1}  •  {hand_text}  (total: {total})  •  Bet: {bet:,}  •  {status}")
            self.player_var.set("Your hand:" + ("\n" + "\n".join(lines) if lines else " —"))

    def update_blackjack_controls(self):
            if not hasattr(self, "hit_btn"):
                return
            index = self.active_hand_index
            hand_exists = 0 <= index < len(self.player_hands)
            is_playing = self.round_active and hand_exists and self.hand_statuses[index] == "playing"
            hand = self.player_hands[index] if hand_exists else []
            hand_bet = self.hand_bets[index] if hand_exists else 0

            self.hit_btn.config(state="normal" if is_playing and hand_value(hand) < 21 else "disabled")
            self.stand_btn.config(state="normal" if is_playing else "disabled")

            can_split = (
                is_playing and not self.split_used and len(self.player_hands) == 1
                and len(hand) == 2 and card_value(hand[0]) == card_value(hand[1])
                and self.balance >= self.bet and len(self.deck) >= 2
            )
            can_double = (
                is_playing and len(hand) == 2 and not self.hand_doubled[index]
                and self.balance >= hand_bet and bool(self.deck)
            )
            self.split_btn.config(state="normal" if can_split else "disabled")
            self.double_btn.config(state="normal" if can_double else "disabled")

    def split_hand(self):
            if not self.round_active or self.split_used or len(self.player_hands) != 1:
                return
            original = self.player_hands[0]
            if (len(original) != 2 or card_value(original[0]) != card_value(original[1])
                    or self.balance < self.bet or len(self.deck) < 2):
                return

            self.balance -= self.bet  # Match the original bet for the second hand.
            first_hand = [original[0], self.deck.pop()]
            second_hand = [original[1], self.deck.pop()]
            self.player_hands = [first_hand, second_hand]
            self.hand_bets = [self.bet, self.bet]
            self.hand_statuses = ["playing", "playing"]
            self.hand_doubled = [False, False]
            self.split_used = True

            # Split aces receive one card each and then stand. Any split hand that
            # reaches 21 also stands, but is not paid as a natural blackjack.
            split_aces = card_value(original[0]) == 11
            for index, hand in enumerate(self.player_hands):
                if split_aces or hand_value(hand) == 21:
                    self.hand_statuses[index] = "stood"

            next_index = next((i for i, state in enumerate(self.hand_statuses) if state == "playing"), None)
            self.active_hand_index = next_index if next_index is not None else 0
            self.player = self.player_hands[self.active_hand_index]
            self.refresh_header()
            self.log_event(f"Split blackjack hand; total committed bet is {self.bet * 2} points")
            self.refresh_hands(hide_dealer=True)
            if next_index is None:
                self.finish_player_hands()
            else:
                self.blackjack_status.config(text=f"Split! Play Hand {next_index + 1} first.")
                self.update_blackjack_controls()

    def double_down(self):
            if not self.round_active:
                return
            index = self.active_hand_index
            if not (0 <= index < len(self.player_hands)):
                return
            hand = self.player_hands[index]
            extra_bet = self.hand_bets[index]
            if (self.hand_statuses[index] != "playing" or len(hand) != 2
                    or self.hand_doubled[index] or self.balance < extra_bet or not self.deck):
                return

            self.balance -= extra_bet
            self.hand_bets[index] *= 2
            self.hand_doubled[index] = True
            hand.append(self.deck.pop())
            self.hand_statuses[index] = "bust" if hand_value(hand) > 21 else "stood"
            self.player = hand
            result = "busted" if self.hand_statuses[index] == "bust" else "stood"
            self.refresh_header()
            self.log_event(f"Doubled Hand {index + 1} to {self.hand_bets[index]} points and {result}")
            self.refresh_hands(hide_dealer=True)
            self.advance_after_hand()

    def hit(self):
            if not self.round_active:
                return
            index = self.active_hand_index
            if not (0 <= index < len(self.player_hands)) or self.hand_statuses[index] != "playing":
                return
            hand = self.player_hands[index]
            if not self.deck:
                self.hand_statuses[index] = "stood"
            else:
                hand.append(self.deck.pop())
                total = hand_value(hand)
                if total > 21:
                    self.hand_statuses[index] = "bust"
                elif total == 21:
                    self.hand_statuses[index] = "stood"
            self.player = hand
            self.refresh_hands(hide_dealer=True)
            if self.hand_statuses[index] != "playing":
                self.advance_after_hand()
            else:
                self.update_blackjack_controls()

    def stand(self):
            if not self.round_active:
                return
            index = self.active_hand_index
            if not (0 <= index < len(self.player_hands)) or self.hand_statuses[index] != "playing":
                return
            self.hand_statuses[index] = "stood"
            self.advance_after_hand()

    def advance_after_hand(self):
            """Move to the next split hand, or resolve the dealer when done."""
            current = self.active_hand_index
            next_index = next(
                (i for i in range(current + 1, len(self.player_hands))
                 if self.hand_statuses[i] == "playing"),
                None,
            )
            if next_index is None:
                self.finish_player_hands()
                return
            self.active_hand_index = next_index
            self.player = self.player_hands[next_index]
            self.refresh_hands(hide_dealer=True)
            self.blackjack_status.config(text=f"Now playing Hand {next_index + 1}.")
            self.update_blackjack_controls()

    def finish_player_hands(self):
            if not self.round_active or any(state == "playing" for state in self.hand_statuses):
                return
            # If every player hand busted, the dealer does not need to draw.
            if any(state != "bust" for state in self.hand_statuses):
                while hand_value(self.dealer) < 17 and self.deck:
                    self.dealer.append(self.draw_dealer_card())
            self.finish_round()

    def finish_round(self, reason=None):
            hands = self.player_hands or [self.player]
            bets = self.hand_bets or [self.bet]
            statuses = self.hand_statuses or ["playing"]
            # A natural blackjack can end the round before the player takes an
            # action, so make sure the final display does not still say PLAYING.
            if self.hand_statuses:
                for index, state in enumerate(self.hand_statuses):
                    if state == "playing":
                        self.hand_statuses[index] = "stood"
            dealer_total = hand_value(self.dealer)
            dealer_bj = len(self.dealer) == 2 and dealer_total == 21
            messages = []

            for index, hand in enumerate(hands):
                hand_bet = bets[index] if index < len(bets) else self.bet
                player_total = hand_value(hand)
                busted = (statuses[index] == "bust" if index < len(statuses) else False) or player_total > 21
                # Only the original, unsplit two-card hand can receive natural BJ odds.
                player_bj = (not self.split_used and index == 0 and len(hand) == 2 and player_total == 21)

                if busted:
                    self.data["blackjack_losses"] += 1
                    outcome = f"Bust — lose {hand_bet:,} points"
                elif player_bj and dealer_bj:
                    self.data["blackjack_pushes"] += 1
                    self.balance += hand_bet
                    outcome = f"Push — {hand_bet:,} points returned"
                elif player_bj:
                    self.data["blackjack_wins"] += 1
                    winnings = int(hand_bet * 2.5)
                    self.balance += winnings
                    outcome = f"Natural blackjack — receive {winnings:,} points"
                elif dealer_bj:
                    self.data["blackjack_losses"] += 1
                    outcome = f"Dealer blackjack — lose {hand_bet:,} points"
                elif dealer_total > 21 or player_total > dealer_total:
                    self.data["blackjack_wins"] += 1
                    winnings = hand_bet * 2
                    self.balance += winnings
                    outcome = f"Win — receive {winnings:,} points"
                elif player_total == dealer_total:
                    self.data["blackjack_pushes"] += 1
                    self.balance += hand_bet
                    outcome = f"Push — {hand_bet:,} points returned"
                else:
                    self.data["blackjack_losses"] += 1
                    outcome = f"Dealer wins — lose {hand_bet:,} points"

                messages.append(f"Hand {index + 1}: {outcome}")

            self.round_active = False
            self.hit_btn.config(state="disabled")
            self.stand_btn.config(state="disabled")
            self.split_btn.config(state="disabled")
            self.double_btn.config(state="disabled")
            self.deal_btn.config(state="normal")
            self.refresh_hands(False)
            result = messages[0] if len(messages) == 1 else "Split round complete:\n" + "\n".join(messages)
            self.blackjack_status.config(text=result)
            self.set_status(result)
            self.log_event("Blackjack: " + result.replace("\n", " | "))

    def reset_table(self):
            if self.round_active:
                messagebox.showinfo("Round in progress", "Finish the current blackjack hand first.", parent=self.root)
                return
            self.player, self.dealer, self.bet = [], [], 0
            self.player_hands = []
            self.hand_bets = []
            self.hand_statuses = []
            self.hand_doubled = []
            self.active_hand_index = 0
            self.split_used = False
            self.refresh_hands(False)
            self.blackjack_status.config(text="Place a bet and deal when ready.")
            self.update_blackjack_controls()
