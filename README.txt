MINI ARCADE HUB v5 — PUBLIC WINDOWS PACKAGE

Python 3.10+ / Windows / standard library only.
All game currency is fictional.

INSTALL AND RUN
1. Extract this folder.
2. Install Python 3.10+ from python.org if needed. During setup, enable
   "Add Python to PATH".
3. Double-click run_game.bat, or run: python mini_arcade.py

GAMES
- Blackjack (Hit / Stand)
- Coin Flip (maximum play is 100 fictional points)
- Number Hunt (guess a number from 1 to 20)
- Rock, Paper, Scissors
- Five-question Quick Trivia

HUB FEATURES
- Starts with 500 fictional points and grants a daily reward once per local
  calendar day (default +100 points; owner can change it).
- Player nickname, achievements, lifetime statistics, recent activity.
- Automatic local saves and JSON export/import backups.
- Runs fully offline. No account, server, internet connection, or multiplayer.

OWNER CONSOLE
To open the console, select your encrypted admin.key file and enter the
additional owner code: tea

New v5 owner tools:
- Blackjack Lab: enable/disable the rigging mechanic and tune its settings.
- The default player opening-hand target chance is 95% for totals 10, 19, 20,
  or 21. The actual opening cards are still unique cards from a normal deck.
- The default dealer protection reduces the selection weight of cards that
  would bring the dealer to 20 or 21 by 95%, whenever other cards are available.
- Disabling rig mode restores ordinary random draws for the next round. To
  avoid changing the rules mid-hand, rig settings can only be applied between
  blackjack rounds.
- A visible rig-mode notice appears on the Blackjack screen while active.
- Weird Stuff: random mystery point cache, bizarre home-screen broadcasts,
  and random arcade fortunes.
- Overview now tracks rigged openings and dealer high-card draws avoided.

COMPATIBILITY
- Existing v4 saves are upgraded automatically when loaded; balance and
  existing game statistics are retained. To keep your current progress, either
  replace the old game files in the same folder, or copy blackjack_save.json
  from the old game folder into the new v5 folder before launching it.
- The existing v4 private owner setup kit and admin.key authorization remain
  compatible. No new owner key needs to be created.

SECURITY LIMITATIONS
The owner key file is protected by Windows DPAPI and the authorization is
checked against a digital signature. The extra code is an additional prompt.
This is local offline access control, not tamper-proof protection against
someone who can edit the Python source or manually change local save data.
Keep your private owner setup folder and admin.key private.

All points are fictional. There are no real-money purchases, bets, deposits,
or cash-outs.
