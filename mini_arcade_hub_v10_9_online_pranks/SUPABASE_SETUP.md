# Mini Arcade Hub v10 — Username login, cloud saves, and leaderboard

This project uses Supabase Auth for username/password sign-in, a private per-player
cloud-save table, and an authenticated shared leaderboard. Players do not enter an
email address. Internally, usernames are mapped to reserved `.invalid` email-shaped
Auth identifiers because Supabase's password Auth uses email or phone identifiers.

## 1. Create a Supabase project

1. Open <https://supabase.com/dashboard> and create a project.
2. Wait for provisioning to finish.
3. Open **Project Settings → API Keys** and copy the **Project URL** and **Publishable key**.
   Older projects may show the legacy `anon` key.
4. Never put a `service_role` key or `sb_secret_...` key in the game.

## 2. Configure username-only accounts

1. In the dashboard, open **Authentication → Sign In / Providers → Email** (wording may vary).
2. Make sure the Email provider is enabled.
3. Turn **Confirm email** OFF. These accounts use non-deliverable `.invalid` identifiers,
   so no email verification can be completed. Supabase documents that disabling Confirm
   Email allows sign-up without an email verification step:
   <https://supabase.com/docs/guides/auth/general-configuration>.
4. Keep new user sign-ups enabled.
5. Set an appropriate minimum password length. This game requires at least 8 characters.

**Username and recovery notes:** usernames are 3–20 letters/numbers/underscores and appear
on the shared leaderboard. No email address is collected, so there is no email-based
password reset or account recovery in this build. Players should use a unique password
and keep it somewhere safe. Do not use a password they use on another service.

## 3. Install the database tables and security rules

1. In the Supabase dashboard, open **SQL Editor**.
2. Open `supabase_setup.sql` from this project.
3. Copy the entire file into a new SQL query and run it.
4. The script creates `player_saves` and `leaderboard`, enables Row Level Security, adds
   per-account policies, creates leaderboard rows for new username accounts, and backfills
   users who were already created using v9.

You can run the updated script on an existing v9 project; it includes the leaderboard
table and policies as well as the existing cloud-save setup. Supabase recommends enabling
RLS and separately managing grants and policies for exposed tables:
<https://supabase.com/docs/guides/database/postgres/row-level-security>.

## 4. Add your project URL and publishable key to the game

1. Make a copy of `supabase_config.example.json`.
2. Name the copy exactly `supabase_config.json` and leave it beside `mini_arcade.py`.
3. Replace the placeholders with your Project URL and Publishable key:

```json
{
  "url": "https://YOUR_PROJECT_ID.supabase.co",
  "publishable_key": "YOUR_SUPABASE_PUBLISHABLE_KEY"
}
```

4. Save the file. It is ignored by Git and should not be uploaded to GitHub.

The Project URL and publishable key are intended for client applications. The game does
not need a Supabase secret or service-role key.

## 5. Install and launch

Open Command Prompt in the extracted game folder:

```text
python -m pip install -r requirements.txt
python mini_arcade.py
```

Or double-click `run_game.bat`. Choose **Create account**, enter a username and password,
and then sign in on another computer using the same credentials. Choose **Play offline**
to use a separate local save without an online account.

## 6. What syncs online

- Each account has a private `player_saves` row. Row Level Security restricts access to the
  authenticated owner's row.
- The shared leaderboard shows username, nickname, fictional points, total wins,
  Blackjack wins, and mini-game wins to signed-in players.
- Each account can only update its own leaderboard row. Usernames are created from the
  Auth account identity and are not writable through the normal game API.
- Leaderboard updates happen when a cloud save is uploaded. Use the **Refresh** button to
  reload the shared standings.
- Local backups remain available in addition to the cloud save.

## 7. Security and fairness limits

Supabase Auth handles password verification; this game never stores plaintext passwords.
RLS isolates private saves and limits each player to their own leaderboard row. However,
this is a desktop Python game: a player who modifies their own game or sends their own
authenticated database requests can falsify their own points and win totals. The leaderboard
is therefore intended for friendly comparison only, not prizes, purchases, or anything with
real-world value. A cheat-resistant leaderboard would require a server-authoritative game
backend that validates each completed round rather than trusting the player's computer.

The username-only setup cannot send password resets or account-verification emails. No
online system is perfectly secure. Protect the Supabase dashboard account, use a unique
password, and never share secret keys.

## Troubleshooting

**"Supabase is not configured yet"** — make sure `supabase_config.json` is next to
`mini_arcade.py` and contains the correct Project URL and publishable key.

**Sign-up returns no session** — turn OFF Confirm email in the Email provider settings.

**Login works but cloud saves fail** — make sure you ran the full `supabase_setup.sql` and
that the Data API exposes the `public` schema.

**Leaderboard is empty** — create an account after running the SQL, or rerun the SQL to
backfill existing v9 accounts. Play a game or change your nickname to sync the profile,
then press Refresh.

**Supabase package missing** — run `python -m pip install -r requirements.txt`.

## Server-managed administrator permissions (v10 update)

After the existing `supabase_setup.sql` has been run and the `mynameiskarl` account exists, open Supabase Dashboard -> SQL Editor and run the full `supabase_admin_setup.sql` file. This creates the server-side admin-role table, bootstraps the permanent owner using the configured Auth UUID, and adds RPC functions for checking roles, listing admins, granting/revoking admins, and reading the admin audit log.

Only the permanent owner can grant or revoke admin access. The desktop app contains no service-role key. Do not add a Supabase `service_role` or `sb_secret_` key to the desktop configuration.

The admin console requires an online signed-in account. The Admin management tab is server-backed. Existing game-control tabs still edit the currently signed-in player's own save; they do not edit other players' balances or global server settings. The leaderboard and player-save design in v10 remains player-scoped and is not a server-authoritative anti-cheat system.


## Security scripts (run in this order, after the two main scripts)

See `UPDATE_GUIDE.md` for the full one-step-at-a-time walkthrough.

1. `supabase_security_hardening.sql` - limits each cloud save to 64 KB.
2. `supabase_moderation_setup.sql` - adds server-enforced player suspension for the owner and admins.
3. `supabase_security_check.sql` - read-only. A healthy project returns **zero rows**. Run it again any time you change your database.

All three are safe to run more than once.


## Online admin pranks (v10.7 update)

After running `supabase_setup.sql` and `supabase_admin_setup.sql`, run
`supabase_pranks_setup.sql` in the Supabase SQL Editor. This adds a short-lived online
presence heartbeat and a server-queued prank event system. It uses the existing
server-side admin roles; only owner/admin accounts can list online players or send pranks.
Players can only poll events addressed to their own authenticated account. Direct table
access is revoked, prank types are allow-listed, events expire after two minutes, and the
server enforces per-target and per-admin cooldowns. No service-role key belongs in the game.

To use it, sign in to the game with an admin account, open **Admin console → Weird stuff →
Online player pranks**, press **Refresh players**, select an online username, choose a prank,
and press **Send selected prank**. The target's game checks for events every few seconds.
The seven effects are a dismissible jumpscare popup, reality glitch, temporary silly nickname
illusion, confetti celebration, fake system notice, duck invasion, and fortune message. Each
popup is non-modal, can be dismissed, and closes automatically. These effects do not alter
player saves, points, account nicknames, or game state. A player normally disappears from the
online list shortly after closing the game; if the app crashes, the presence expires after
90 seconds without a heartbeat.

The background music uses Pygame's infinite-loop playback setting plus a small watchdog that
restarts playback if the audio device unexpectedly stops it. Music remains controlled by the
existing Settings toggle and volume slider.

**Setup order for a new or existing project:** `supabase_setup.sql` →
`supabase_admin_setup.sql` → `supabase_moderation_setup.sql` (if using moderation) →
`supabase_pranks_setup.sql`. Do not rerun or replace your existing project URL/publishable key.


## Admin coin generator (web version)

After the web version's existing player-save and administrator SQL setup is installed, run
`supabase_coin_generator_setup.sql` in the Supabase SQL Editor. This adds the
`mini_arcade_admin_spawn_coins` RPC. The function checks the caller's server-side admin
role, validates the target and amount, updates the target's cloud-save balance and
leaderboard points in one transaction, and writes an audit entry. Grants are limited to
1–1,000,000 coins and the resulting balance cannot exceed 1,000,000,000.

In the web Admin Console, the Coin Generator also asks the administrator to type
`gambler` as a local confirmation. That phrase is only an extra UI check; it is not a
secret and does not replace the database-side administrator check. Never put service-role
or Supabase secret keys in the browser app.
