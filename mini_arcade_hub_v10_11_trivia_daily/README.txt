MINI ARCADE HUB v10.11 — ONLINE ACCOUNTS + ADMIN PRANKS + MUSIC + SECURITY + VERSION CHECK + DAILY TRIVIA

Python 3.10+ / Windows / Tkinter. Supabase is optional; offline mode remains available.

RUNNING THE GAME
1. Extract the entire folder.
2. Install the optional Supabase dependency: python -m pip install -r requirements.txt
3. Configure Supabase by following SUPABASE_SETUP.md.
4. Double-click run_game.bat, or run: python mini_arcade.py
5. Choose Create account or Sign in. You can also choose Play offline.
6. Open Settings from the login screen or game footer to toggle music and adjust its volume. Preferences are saved locally on that computer.
7. For online admin pranks, run supabase_pranks_setup.sql after the base and admin SQL scripts; see SUPABASE_SETUP.md.

PROJECT FILE GUIDE
- mini_arcade.py — launcher.
- app.py — assembles the app and starts on the account screen.
- auth.py — username/password account handling through Supabase Auth.
- account_ui.py — login, registration, logout, and offline entry screen.
- cloud_save.py — loads account saves, syncs leaderboard data, and uploads off the UI thread.
- leaderboard.py — shared online leaderboard screen.
- supabase_setup.sql — cloud-save and leaderboard tables, grants, triggers, and Row Level Security policies.
- supabase_config.example.json — template for your local project URL/key.
- supabase_config.json — your local settings file; create it yourself and do not upload it.
- SUPABASE_SETUP.md — full dashboard and installation instructions.
- prank_events.py — online presence polling and temporary prank effects.
- supabase_pranks_setup.sql — server-side online presence and admin-only prank RPCs.
- config.py — shared settings and local save paths.
- player_data.py — default save, validation, and save loading.
- player.py — player profile, balance, statistics, and backups.
- blackjack.py — Blackjack UI, rules, split, double down, and round logic.
- minigames.py — Coin Flip, Number Hunt, Rock Paper Scissors, Trivia, and the Slot Machine.
- slots.py — Slot Machine rules and payouts (no UI).
- trivia_daily.py — Trivia rules: the 25-question bank, bets (max 2,500), payouts, and the server-checked one-game-a-day limit.
- supabase_trivia_daily_setup.sql — server side of the daily Trivia limit and maximum bet (run it; see SUPABASE_SETUP.md).
- icon.ico / icon.png — the Karl Games icon.
- BeepBox-Song.mp3 — looping background music used by the game.
- audio_settings.py — music playback, settings window, and saved volume preferences. create_shortcuts.bat makes icon shortcuts for the .bat files.
- ui.py — shared styling, widgets, navigation, and Home tab.
- admin.py — local owner-console authorization and admin UI.
- requirements.txt — Python dependency for Supabase.
- run_game.bat — Windows launcher.

ACCOUNT BEHAVIOR
- Usernames are 3–20 letters/numbers/underscores; passwords must be 8+ characters.
- Usernames appear on the shared leaderboard; usernames cannot be changed from the game.
- The leaderboard shows fictional points and game wins to signed-in players.
- No real email address is collected. Supabase Confirm email must be disabled.
- Cloud saves are separated by Supabase user ID. A local cache is also kept for each account.
- The player signs in each time the app is launched; session tokens are not saved as plain text.
- Play offline is still available without Supabase.

SECURITY LIMITS
Supabase Auth handles password verification and Row Level Security isolates each account's
cloud-save row. However, a player can still alter their own save/points because this is a
client-run Python game. Do not connect points to real-world value or prizes. See
SUPABASE_SETUP.md for the full limitations and setup steps.

OWNER SECURITY NOTE
The owner-console checks are local offline access controls, not tamper-proof protection
against someone who can edit the Python source or local save files.


ADMIN PERMISSIONS (v10 server update)
- Run supabase_admin_setup.sql after supabase_setup.sql.
- The permanent owner is the mynameiskarl Auth account UUID configured in that SQL file.
- Only the owner can grant/revoke admin roles. Admin roles and audit records are stored on Supabase.
- The admin console requires an online login and server role verification.
- Existing game-control tabs still affect the current account's own save only; they are not global player-management tools.
