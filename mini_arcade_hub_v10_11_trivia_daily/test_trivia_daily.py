"""Tests for the Trivia rules. Run from this folder with:  python -m unittest test_trivia_daily -v"""
import random
import unittest

from trivia_daily import (
    QUESTIONS_PER_QUIZ,
    TRIVIA_MAX_BET,
    TRIVIA_PAYOUT_HALVES,
    TRIVIA_QUESTIONS,
    fetch_status,
    format_countdown,
    normalize_state,
    pick_questions,
    start_game,
    trivia_payout,
    validate_bet,
)

# The correct answer for every supplied question, in words, so a typo in the bank is caught.
EXPECTED_ANSWERS = {
    "Which planet has the shortest day in our solar system?": "Jupiter",
    "What is the smallest country in the world by area?": "Vatican City",
    "Which animal has three hearts?": "Octopus",
    "What is the chemical symbol for potassium?": "K",
    "Which ocean is the deepest?": "Pacific",
    "What is the only mammal capable of true sustained flight?": "Bat",
    "Which country has the most natural lakes?": "Canada",
    "What is the name of the boundary around a black hole beyond which nothing can escape?": "Event horizon",
    "Which element has the atomic number 74?": "Tungsten",
    "What is the largest moon of Saturn?": "Titan",
    "Which ancient civilization developed the earliest known writing system, cuneiform?": "Sumerians",
    "What is the SI unit of catalytic activity?": "Katal",
    "Which mathematician is associated with the incompleteness theorems?": "Kurt Gödel",
    "What is the rarest naturally occurring stable isotope of an element?": "Tantalum-180m",
    "Which country was formerly known as Dahomey?": "Benin",
    "What is the deepest known point in Earth's oceans?": "Challenger Deep",
    "Which composer wrote the orchestral work 'The Planets'?": "Gustav Holst",
    "Which moon in our solar system has lakes and seas of liquid hydrocarbons on its surface?": "Titan",
    "What is the name of the mathematical constant equal to the limit of (1 + 1/n)^n as n approaches infinity?": "Euler's number",
    "Which element was first discovered in the spectrum of the Sun before it was found on Earth?": "Helium",
    "What is the capital of the ancient Achaemenid Persian Empire most closely associated with Darius I?": "Persepolis",
    "Which scientist introduced the concept of entropy in thermodynamics?": "Rudolf Clausius",
    "What is the name of the largest known volcano in the solar system?": "Olympus Mons",
    "Which language family does Hungarian belong to?": "Uralic",
    "In biology, what is the name of the organelle responsible for modifying, sorting, and packaging proteins?": "Golgi apparatus",
}


class FakeResponse:
    def __init__(self, data):
        self.data = data


class FakeClient:
    """Stands in for the Supabase client; records the calls it receives."""

    def __init__(self, data=None, error=None):
        self._data, self._error = data, error
        self.calls = []

    def rpc(self, name, params):
        self.calls.append((name, params))
        return self

    def execute(self):
        if self._error:
            raise self._error
        return FakeResponse(self._data)


class QuestionBankTests(unittest.TestCase):
    def test_bank_has_the_25_supplied_questions_with_the_supplied_answers(self):
        self.assertEqual(len(TRIVIA_QUESTIONS), 25)
        texts = [q for q, _o, _a in TRIVIA_QUESTIONS]
        self.assertEqual(len(set(texts)), 25, "the bank repeats a question")
        self.assertEqual(sorted(texts), sorted(EXPECTED_ANSWERS))
        for question, options, answer in TRIVIA_QUESTIONS:
            self.assertEqual(len(options), 4, question)
            self.assertEqual(len(set(options)), 4, question)
            self.assertEqual(options[answer], EXPECTED_ANSWERS[question], question)

    def test_old_questions_are_gone(self):
        texts = {q for q, _o, _a in TRIVIA_QUESTIONS}
        self.assertNotIn("Which planet is known as the Red Planet?", texts)
        self.assertNotIn("What is 9 × 7?", texts)

    def test_a_quiz_never_repeats_a_question(self):
        for _ in range(2000):
            quiz = pick_questions()
            texts = [q for q, _o, _a in quiz]
            self.assertEqual(len(texts), QUESTIONS_PER_QUIZ)
            self.assertEqual(len(set(texts)), QUESTIONS_PER_QUIZ)

    def test_a_quiz_drops_repeated_questions_if_a_bank_has_duplicates(self):
        bank = [("A?", ["1", "2", "3", "4"], 0), ("a?", ["1", "2", "3", "4"], 0), ("B?", ["1", "2", "3", "4"], 1),
                ("C?", ["1", "2", "3", "4"], 2), ("D?", ["1", "2", "3", "4"], 3)]
        with self.assertRaises(ValueError):
            pick_questions(bank=bank)

    def test_options_are_shuffled_but_the_answer_still_points_at_the_right_text(self):
        positions = set()
        for _ in range(500):
            for question, options, answer in pick_questions():
                self.assertEqual(options[answer], EXPECTED_ANSWERS[question], question)
                positions.add(answer)
        self.assertEqual(positions, {0, 1, 2, 3})

    def test_the_answer_is_not_mostly_option_b_after_shuffling(self):
        total = b = 0
        for _ in range(400):
            for _q, _o, answer in pick_questions(random.Random()):
                total += 1
                b += answer == 1
        self.assertLess(b / total, 0.4)  # 15 of the 25 supplied answers are option B before shuffling


class BetTests(unittest.TestCase):
    def test_maximum_bet_is_2500(self):
        self.assertEqual(TRIVIA_MAX_BET, 2500)
        self.assertEqual(validate_bet("2500"), 2500)
        self.assertEqual(validate_bet("2,500"), 2500)
        with self.assertRaisesRegex(ValueError, "maximum bet is 2,500"):
            validate_bet("2501")

    def test_empty_means_no_bet(self):
        self.assertEqual(validate_bet(""), 0)
        self.assertEqual(validate_bet("   "), 0)
        self.assertEqual(validate_bet(None), 0)
        self.assertEqual(validate_bet("0"), 0)

    def test_invalid_bets_are_rejected(self):
        for bad in ("-1", "1.5", "abc", "1e3", "٣٠٠", "12 34", "+5"):
            with self.assertRaises(ValueError, msg=bad):
                validate_bet(bad)

    def test_cannot_bet_more_than_the_balance(self):
        with self.assertRaisesRegex(ValueError, "do not have that many"):
            validate_bet("600", 500)
        self.assertEqual(validate_bet("500", 500), 500)

    def test_payouts_follow_the_table(self):
        self.assertEqual(TRIVIA_PAYOUT_HALVES, (0, 0, 1, 2, 4, 6))
        self.assertEqual([trivia_payout(1000, n) for n in range(6)], [0, 0, 500, 1000, 2000, 3000])
        self.assertEqual(trivia_payout(2500, 5), 7500)
        self.assertEqual(trivia_payout(1, 2), 0)  # rounds down
        self.assertEqual(trivia_payout(0, 5), 0)
        self.assertEqual(trivia_payout(-5, 5), 0)
        self.assertEqual(trivia_payout(True, 5), 0)


class ServerTests(unittest.TestCase):
    def test_status_reads_the_servers_answer(self):
        client = FakeClient({"can_play": True, "seconds_until_reset": 5000, "max_bet": 2500, "play_day": "2026-11-19"})
        state = fetch_status(client)
        self.assertEqual(client.calls, [("mini_arcade_trivia_status", {})])
        self.assertTrue(state["can_play"])
        self.assertEqual(state["seconds_until_reset"], 5000)

    def test_unreadable_answers_mean_cannot_play(self):
        for junk in (None, [], "oops", 5, {"can_play": "yes"}, {"can_play": 1}):
            self.assertFalse(normalize_state(junk)["can_play"], junk)

    def test_a_server_cannot_raise_the_bet_limit_above_what_the_game_knows(self):
        self.assertEqual(normalize_state({"can_play": True, "max_bet": 999999})["max_bet"], 2500)
        self.assertEqual(normalize_state({"can_play": True, "max_bet": 100})["max_bet"], 100)
        self.assertEqual(normalize_state({"can_play": True, "max_bet": "x"})["max_bet"], 2500)

    def test_seconds_are_clamped(self):
        self.assertEqual(normalize_state({"seconds_until_reset": -5})["seconds_until_reset"], 0)
        self.assertEqual(normalize_state({"seconds_until_reset": 10**9})["seconds_until_reset"], 86400)
        self.assertEqual(normalize_state({"seconds_until_reset": "x"})["seconds_until_reset"], 0)

    def test_start_sends_the_bet_and_reports_ok(self):
        client = FakeClient({"ok": True, "reason": None, "can_play": False, "seconds_until_reset": 100, "bet": 300})
        result = start_game(client, 300)
        self.assertEqual(client.calls, [("mini_arcade_trivia_start", {"p_bet": 300})])
        self.assertTrue(result["ok"])
        self.assertFalse(result["can_play"])

    def test_start_reports_already_played(self):
        client = FakeClient({"ok": False, "reason": "already_played", "can_play": False, "seconds_until_reset": 100})
        result = start_game(client, 0)
        self.assertFalse(result["ok"])
        self.assertEqual(result["reason"], "already_played")

    def test_start_never_asks_the_server_for_a_bad_bet(self):
        client = FakeClient({"ok": True})
        for bad in (-1, 2501, 1.5, "100", None, True):
            with self.assertRaises(ValueError, msg=repr(bad)):
                start_game(client, bad)
        self.assertEqual(client.calls, [])

    def test_server_errors_are_raised_not_swallowed(self):
        with self.assertRaises(RuntimeError):
            start_game(FakeClient(error=RuntimeError("This account is suspended")), 10)
        with self.assertRaises(RuntimeError):
            fetch_status(FakeClient(error=RuntimeError("offline")))

    def test_only_an_explicit_true_counts_as_ok(self):
        for junk in ({"ok": "true"}, {"ok": 1}, {}, None):
            self.assertFalse(start_game(FakeClient(junk), 5)["ok"], junk)


class CountdownTests(unittest.TestCase):
    def test_format(self):
        self.assertEqual(format_countdown(3725), "1h 02m 05s")
        self.assertEqual(format_countdown(59), "0m 59s")
        self.assertEqual(format_countdown(0), "0m 00s")
        self.assertEqual(format_countdown(-3), "0m 00s")
        self.assertEqual(format_countdown("x"), "0m 00s")
        self.assertEqual(format_countdown(86400), "24h 00m 00s")


if __name__ == "__main__":
    unittest.main()
