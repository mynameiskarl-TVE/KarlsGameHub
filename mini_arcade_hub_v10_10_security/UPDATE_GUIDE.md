# Mini Arcade Hub - update guide (v10.5)

## What is new in v10.5 (no Supabase changes needed this time)

- **Slot Machine** in the Arcade games tab. Three reels, bets of 1-100 points. Three of a kind pays 7 x100, BAR x40, diamond x20, heart x12, club or spade x9. Any two matching symbols return your bet. Over many spins it returns about 95.8% of the points played, so the house keeps a small edge, like a real machine. Slot stats show on the Profile screen, and slot jackpots count toward your leaderboard "Mini-games" number.
- **Karl Games icon** on the game window and taskbar, and on the EXE when you build it with `build_release.bat`. If Windows still shows the old icon after you build, copy the folder somewhere new, or restart Windows Explorer. Windows caches icons.
- **Icons for the .bat files:** Windows does not let a `.bat` file have its own icon, but a shortcut to it can. Double-click `create_shortcuts.bat` once and it creates `Play Mini Arcade Hub` and `Build Mini Arcade Hub` shortcuts with the icon. Keep these in your project folder. They are for you, not for your friends.
- The Arcade tab now scrolls instead of cutting games off when the window is small, and the admin console is wider so all eight tabs are readable.
- `build_release.bat` now also bundles the newer Supabase package names (`supabase_auth`, `supabase_functions`) so the EXE keeps working with current Supabase versions.

If you are updating from v10.4, skip Part A below and go straight to Part B.

Do the steps in order. Part A changes your Supabase project. Part B updates the game. Nothing here deletes player data.

## Part A - Supabase (about 5 minutes)

1. Open https://supabase.com/dashboard and open your Mini Arcade project.
2. In the left menu click **SQL Editor**, then **New query**.
3. Open `supabase_security_hardening.sql` from this folder in Notepad. Select all, copy, paste into the SQL Editor, click **Run**.
   You should see "Success. No rows returned."
4. Click **New query** again. Do the same with `supabase_moderation_setup.sql`.
   You should see "Success. No rows returned." If you ran an older version of this file before, run it again now. It is safe to repeat, and this version adds the function that tells a player they are suspended.
5. Click **New query** again. Do the same with `supabase_security_check.sql`.
   **Healthy result: no rows.** If any row appears, do not share the game yet. Copy the rows and send them to me.

## Part B - the game (about 5 minutes)

6. Close the game if it is open.
7. Extract this ZIP into a **new** folder. `supabase_config.json` is already inside.
8. Open Command Prompt in that folder (click the folder address bar, type `cmd`, press Enter).
9. Install the requirements: `python -m pip install -r requirements.txt`
10. Start the game: `python mini_arcade.py`
11. Sign in with your owner account. Open **Admin console**, then the **Moderation** tab. It should say "0 suspended player(s)."

## Try the moderation tab safely

12. Create a throwaway second account (run a second copy of the game, or sign out and register `testplayer1`).
13. Sign back in as owner. Moderation tab: type `testplayer1`, reason `testing`, click **Suspend player**, confirm.
14. Sign in as `testplayer1`. A popup explains the suspension and shows your reason, and a red **SUSPENDED** badge appears in the top bar. Their row is gone from the Leaderboard tab, and that tab says they are suspended. Clicking the badge shows the details again.
15. Sign back in as owner, type `testplayer1`, click **Unsuspend player**. The badge disappears for them within 2 minutes (or when they restart the game, or press Refresh on the Leaderboard tab), and they reappear on the leaderboard.

## Part C - give friends the new version

16. In the game folder run `build_release.bat`. It makes the Windows folder in `dist`.
17. Zip the folder in `dist` and send it to your friends.
18. Tell them to extract it to a **new** folder. Online players keep their progress because saves are in Supabase.
    Players who played **offline** should first copy their old `local_saves` folder into the new folder.

## Supabase dashboard settings to check (once)

- **Dashboard login:** turn on two-factor sign-in for your own Supabase account (Account preferences).
- **Authentication > Sign In / Providers:** if no new friends need to join, turn **Allow new users to sign up** off. Turn it back on when you want to add people. This is the strongest protection against spam accounts and against suspended players making new accounts.
- **Authentication > Rate Limits:** leave the defaults on.
- **Never put** your service-role key, secret key, database password, or JWT secret in the game, in `supabase_config.json`, or in a message to anyone. Only the publishable key belongs in the game.
- **Backups:** on the free plan, export your tables occasionally (Table Editor > the table > Export as CSV).

## How moderation works

- **Suspend** hides the player from the leaderboard and makes the server ignore their score updates. The player sees a red SUSPENDED badge and a popup, including your reason, so write something you are happy for them to read. With "reset" ticked their leaderboard score and nickname are also reset.
- It does not delete the account, and the player can still play. Suspended players can still use their own private cloud save.
- Only the owner can suspend an administrator. The owner can never be suspended. Nobody can suspend themselves.
- Every suspension and unsuspension is recorded in the server audit log.
- A suspended player could register a brand new account, which is why closing sign-ups (above) helps.

## Notes on the icon files

`icon.png` is your original 32x32 sprite. `icon.ico` is the same picture in 7 sizes (16 to 256 pixels) for Windows. Both must stay in the game folder next to `mini_arcade.py`; `build_release.bat` bundles them into the EXE for you. To change the icon later, replace both files with new ones of the same names.
