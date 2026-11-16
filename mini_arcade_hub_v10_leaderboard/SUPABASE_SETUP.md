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
py -m pip install -r requirements.txt
py mini_arcade.py
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

**Supabase package missing** — run `py -m pip install -r requirements.txt`.
