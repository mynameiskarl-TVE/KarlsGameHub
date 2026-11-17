# Mini Arcade Hub - security review (v10.3)

## Verified on a real local Postgres (stand-in Supabase roles; 73 checks, all as expected)
- Players cannot read, insert, update, or delete the admin-role and audit tables, and cannot grant themselves admin or owner.
- Only the permanent owner (pinned to its Auth UUID) can grant or revoke admin. The owner cannot be demoted and a second owner cannot exist.
- A delegated admin cannot grant admin, revoke the owner, or touch the tables. A revoked admin loses access immediately.
- Signed-out (anon) users cannot call admin functions or read saves or the leaderboard.
- Players cannot read or write another player's save or leaderboard row, change their username/user_id, write the suspension columns, or upload a save over 64 KB.
- Moderation: players and signed-out users cannot suspend anyone. Admins cannot suspend the owner, themselves, or another admin. A suspended player is hidden from the leaderboard and the server ignores their score updates. Unsuspending restores them. Every action is audited. A suspended player can read only their own status (through a function), never anyone else's, and signed-out users cannot call it.
- The security check query returns zero rows on the final setup, and it detects deliberately introduced mistakes.

## Verified with stand-ins for Tkinter (not tested in the real window or on Windows)
- Rapid saves are collapsed into one upload, the newest save always wins, and the worker recovers after a network error.
- The Moderation tab sends the right requests, validates usernames, honours the confirmation, and shows server errors without crashing.
- The suspension notice: red badge and one-time popup appear when suspended, do not repeat on later checks, clear when unsuspended, ignore results that arrive after sign-out, and stay silent offline or when the network fails.
- The admin console no longer keeps a stale role from an earlier check or a previous account.

## Fixed so far
- Cloud saves are capped at 64 KB. Server-enforced suspension was added. `supabase_security_check.sql` was added.
- Upload queue no longer grows or floods Supabase on slow connections.
- Crash fixes: Blackjack Deal, missing imports in `minigames.py` and `admin.py`.

## Known limitations (these need a server-authoritative redesign to remove)
- Points, wins, and the leaderboard are reported by the player's own computer. A player can edit their own save or send their own database requests to change their own points. Suspension lets you respond to a cheater but cannot prevent cheating.
- The admin console's game tabs (grant points, rigging, and so on) only change the signed-in player's own save. Server admin permission protects admin roles and moderation, not points. Do not tie points to prizes or anything of real value.
- A suspended player can register a new account unless sign-ups are closed in the Supabase dashboard.
- The Windows EXE is not code-signed, so Windows SmartScreen may warn friends.
- Nicknames are free text, so a player could use another player's name as a nickname (usernames cannot be copied).
