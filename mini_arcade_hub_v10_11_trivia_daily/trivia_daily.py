"""Trivia rules for the desktop game: the question bank, bets and payouts, and the daily limit.

The daily limit is decided by the SERVER (see supabase_trivia_daily_setup.sql), using the server's
own clock. Nothing here looks at this computer's date or time to decide whether a game is allowed;
the countdown only counts the seconds the server reported, using a clock that ignores date changes.

Keep TRIVIA_MAX_BET, TRIVIA_PAYOUT_HALVES and the question bank the same as the website
(web-version/src/games/trivia/engine.js). The web tests check that the two question banks match.
"""
from __future__ import annotations

import random
from typing import Any

QUESTIONS_PER_QUIZ = 5

# One quiz per day. Must equal c_max_bet in supabase_trivia_daily_setup.sql.
TRIVIA_MAX_BET = 2500

# Bet payout: the total you get back for a bet, in HALVES of the bet, by number of correct answers
# (index = correct answers, 0 to 5): 0, 0, 0.5x, 1x, 2x, 3x. 3 correct returns your bet; fewer loses
# some or all. A bet of 0 plays the classic quiz instead (points per correct answer, 10 bonus for 5/5).
TRIVIA_PAYOUT_HALVES = (0, 0, 1, 2, 4, 6)

# (question, options, index of the correct option as written here). pick_questions() shuffles the
# options for every quiz so the right answer is not always in the same place.
TRIVIA_QUESTIONS = [
    ("Which planet has the shortest day in our solar system?", ["Mars", "Jupiter", "Mercury", "Venus"], 1),
    ("What is the smallest country in the world by area?", ["Monaco", "San Marino", "Vatican City", "Liechtenstein"], 2),
    ("Which animal has three hearts?", ["Shark", "Octopus", "Dolphin", "Crocodile"], 1),
    ("What is the chemical symbol for potassium?", ["P", "Po", "K", "Pt"], 2),
    ("Which ocean is the deepest?", ["Atlantic", "Indian", "Arctic", "Pacific"], 3),
    ("What is the only mammal capable of true sustained flight?", ["Flying squirrel", "Sugar glider", "Bat", "Colugo"], 2),
    ("Which country has the most natural lakes?", ["Russia", "Canada", "Finland", "United States"], 1),
    ("What is the name of the boundary around a black hole beyond which nothing can escape?", ["Photon sphere", "Event horizon", "Singularity line", "Schwarzschild ring"], 1),
    ("Which element has the atomic number 74?", ["Tungsten", "Osmium", "Rhenium", "Iridium"], 0),
    ("What is the largest moon of Saturn?", ["Enceladus", "Rhea", "Titan", "Iapetus"], 2),
    ("Which ancient civilization developed the earliest known writing system, cuneiform?", ["Ancient Egyptians", "Sumerians", "Phoenicians", "Minoans"], 1),
    ("What is the SI unit of catalytic activity?", ["Sievert", "Katal", "Tesla", "Weber"], 1),
    ("Which mathematician is associated with the incompleteness theorems?", ["Alan Turing", "Kurt Gödel", "David Hilbert", "Bertrand Russell"], 1),
    ("What is the rarest naturally occurring stable isotope of an element?", ["Tantalum-180m", "Tellurium-128", "Xenon-124", "Indium-113"], 0),
    ("Which country was formerly known as Dahomey?", ["Togo", "Benin", "Gabon", "Burkina Faso"], 1),
    ("What is the deepest known point in Earth's oceans?", ["Java Trench", "Tonga Trench", "Challenger Deep", "Horizon Deep"], 2),
    ("Which composer wrote the orchestral work 'The Planets'?", ["Claude Debussy", "Gustav Holst", "Richard Strauss", "Edward Elgar"], 1),
    ("Which moon in our solar system has lakes and seas of liquid hydrocarbons on its surface?", ["Europa", "Titan", "Triton", "Ganymede"], 1),
    ("What is the name of the mathematical constant equal to the limit of (1 + 1/n)^n as n approaches infinity?", ["Pi", "Euler's number", "Golden ratio", "Apéry's constant"], 1),
    ("Which element was first discovered in the spectrum of the Sun before it was found on Earth?", ["Neon", "Helium", "Argon", "Krypton"], 1),
    ("What is the capital of the ancient Achaemenid Persian Empire most closely associated with Darius I?", ["Babylon", "Susa", "Persepolis", "Ecbatana"], 2),
    ("Which scientist introduced the concept of entropy in thermodynamics?", ["James Clerk Maxwell", "Rudolf Clausius", "Michael Faraday", "Lord Kelvin"], 1),
    ("What is the name of the largest known volcano in the solar system?", ["Mauna Loa", "Olympus Mons", "Elysium Mons", "Ascraeus Mons"], 1),
    ("Which language family does Hungarian belong to?", ["Slavic", "Germanic", "Uralic", "Turkic"], 2),
    ("In biology, what is the name of the organelle responsible for modifying, sorting, and packaging proteins?", ["Lysosome", "Golgi apparatus", "Ribosome", "Peroxisome"], 1),
]


def trivia_payout(bet: int, correct_answers: int) -> int:
    """Total points returned for a bet. Rounds down, never up."""
    if not isinstance(bet, int) or isinstance(bet, bool) or bet < 0:
        return 0
    index = max(0, min(QUESTIONS_PER_QUIZ, correct_answers if isinstance(correct_answers, int) else 0))
    return bet * TRIVIA_PAYOUT_HALVES[index] // 2


def validate_bet(text: Any, balance: int | None = None) -> int:
    """Turn what the player typed into a bet, or raise ValueError with a message to show them.

    An empty box means no bet (0)."""
    raw = str(text if text is not None else "").strip().replace(",", "")
    if raw == "":
        return 0
    if not raw.isdigit() or not raw.isascii():
        raise ValueError("Enter your bet as a whole number of points, or 0 for no bet.")
    value = int(raw)
    if value > TRIVIA_MAX_BET:
        raise ValueError(f"The maximum bet is {TRIVIA_MAX_BET:,} points.")
    if balance is not None and value > balance:
        raise ValueError("You do not have that many points to bet.")
    return value


def pick_questions(rng: random.Random | None = None, bank=None, count: int = QUESTIONS_PER_QUIZ):
    """Pick `count` DIFFERENT questions and shuffle each question's options.

    Returns a list of (question, options, correct_index). A question never appears twice in one quiz,
    even if the bank were to repeat one."""
    rng = rng or random
    bank = TRIVIA_QUESTIONS if bank is None else bank
    seen: set[str] = set()
    unique = []
    for question, options, answer in bank:
        key = str(question).strip().lower()
        if key and key not in seen:
            seen.add(key)
            unique.append((question, options, answer))
    if len(unique) < count:
        raise ValueError("A quiz needs at least five different questions.")
    chosen = []
    for question, options, answer in rng.sample(unique, count):
        order = list(range(len(options)))
        rng.shuffle(order)
        chosen.append((question, [options[i] for i in order], order.index(answer)))
    return chosen


# --- Daily limit (asks the server) ---------------------------------------------------------------

def format_countdown(total_seconds: Any) -> str:
    """3725 -> '1h 02m 05s'."""
    try:
        seconds = max(0, min(int(total_seconds), 24 * 3600))
    except (TypeError, ValueError):
        seconds = 0
    hours, rest = divmod(seconds, 3600)
    minutes, secs = divmod(rest, 60)
    if hours:
        return f"{hours}h {minutes:02d}m {secs:02d}s"
    return f"{minutes}m {secs:02d}s"


def normalize_state(data: Any) -> dict:
    """Turn the server's JSON into a plain, safe dict. Anything unreadable means 'cannot play'."""
    row = data[0] if isinstance(data, list) and data else data
    if not isinstance(row, dict):
        return {"can_play": False, "seconds_until_reset": 0, "max_bet": TRIVIA_MAX_BET, "play_day": ""}
    try:
        seconds = max(0, min(int(row.get("seconds_until_reset", 0)), 24 * 3600))
    except (TypeError, ValueError):
        seconds = 0
    try:
        server_max = int(row.get("max_bet", TRIVIA_MAX_BET))
    except (TypeError, ValueError):
        server_max = TRIVIA_MAX_BET
    # Never offer a higher bet than this game knows about, even if the server says more.
    max_bet = min(server_max, TRIVIA_MAX_BET) if server_max > 0 else TRIVIA_MAX_BET
    return {
        "can_play": row.get("can_play") is True,
        "seconds_until_reset": seconds,
        "max_bet": max_bet,
        "play_day": str(row.get("play_day") or ""),
    }


def _rpc_json(client, name: str, params: dict) -> Any:
    response = client.rpc(name, params).execute()
    return getattr(response, "data", None)


def fetch_status(client) -> dict:
    """Ask the server whether today's trivia game is available. Raises if the request fails."""
    return normalize_state(_rpc_json(client, "mini_arcade_trivia_status", {}))


def start_game(client, bet: int) -> dict:
    """Use up today's game on the server.

    Returns the state plus "ok" (True when the game may start) and "reason" ("already_played" when
    today's game was already used). Raises if the request fails or the bet is not 0 to 2,500."""
    if not isinstance(bet, int) or isinstance(bet, bool) or bet < 0 or bet > TRIVIA_MAX_BET:
        raise ValueError(f"The bet must be a whole number from 0 to {TRIVIA_MAX_BET}.")
    data = _rpc_json(client, "mini_arcade_trivia_start", {"p_bet": bet})
    row = data[0] if isinstance(data, list) and data else data
    state = normalize_state(row)
    state["ok"] = isinstance(row, dict) and row.get("ok") is True
    state["reason"] = str(row.get("reason") or "") if isinstance(row, dict) else ""
    return state
