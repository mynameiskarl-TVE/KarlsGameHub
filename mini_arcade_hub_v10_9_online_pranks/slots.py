"""Slot machine rules: pure logic with no UI, so the odds can be tested.

Three reels share one set of weighted symbols. Payouts are the TOTAL returned for the
bet (the stake included): three of a kind pays the multiplier below, any two matching
symbols return the bet, and anything else returns nothing. With these numbers the
long-run return is about 95.8% of the points played.
"""
import random

SYMBOLS = ("7", "BAR", "\u2666", "\u2665", "\u2663", "\u2660")  # 7, BAR, diamond, heart, club, spade
WEIGHTS = (2, 3, 5, 6, 8, 8)  # how often each symbol lands, out of 32 stops per reel
THREE_OF_A_KIND = {"7": 100, "BAR": 40, "\u2666": 20, "\u2665": 12, "\u2663": 9, "\u2660": 9}
PAIR_MULTIPLIER = 1  # any two matching symbols: the bet is returned


def spin(rng=random):
    """Return the three symbols the reels land on."""
    return tuple(rng.choices(SYMBOLS, weights=WEIGHTS, k=3))


def multiplier(reels):
    """Total returned per point bet: 0 for no match, 1 for a pair, more for three of a kind."""
    a, b, c = reels
    if a == b == c:
        return THREE_OF_A_KIND[a]
    if a == b or b == c or a == c:
        return PAIR_MULTIPLIER
    return 0


def paytable_text():
    return (
        "Three of a kind: 7 \u00d7100  \u2022  BAR \u00d740  \u2022  \u2666 \u00d720  \u2022  \u2665 \u00d712  \u2022  "
        "\u2663 \u2660 \u00d79   |   Any pair returns your bet"
    )
