MINI ARCADE HUB - WINDOWS RELEASE BUILD

BUILD ON YOUR WINDOWS PC
1. Keep this entire project folder together.
2. Make sure Python 3.11+ is installed on YOUR build computer. Friends do not need Python.
3. Double-click build_release.bat and wait for it to finish.
4. The finished folder will be: dist\Mini Arcade Hub\
5. Zip the ENTIRE "Mini Arcade Hub" folder and share that ZIP.

WHAT FRIENDS DO
1. Download and extract the ZIP.
2. Open the extracted "Mini Arcade Hub" folder.
3. Double-click "Mini Arcade Hub.exe".
No Python, pip, or separate package installation is needed.
An internet connection is required for Supabase accounts, cloud saves, and leaderboard.

IMPORTANT
- Do not send your source project folder if you only want to distribute the game. Send the built folder from dist.
- supabase_config.json contains a Supabase Publishable key. Publishable keys are intended for client use, but database security depends on correctly configured Row Level Security (RLS). Never include a Supabase secret/service_role key.
- This project uses a client-side game. Players can potentially modify their local program or report false scores; this is not cheat-proof.
- Saves are written beside the EXE in local_saves. For a future installer or Program Files install, move writable data to the user's AppData folder.
- Windows SmartScreen may show an unknown-publisher warning because this EXE is not code-signed.
- Build on Windows for Windows. PyInstaller does not cross-compile Windows EXEs from Linux/macOS.


ADMIN SETUP REQUIRED BEFORE DISTRIBUTION
1. In Supabase SQL Editor, run supabase_setup.sql if you have not already done so.
2. Then run supabase_admin_setup.sql. It verifies that the supplied Auth UUID belongs to the mynameiskarl leaderboard account before granting permanent owner status.
3. Run supabase_security_hardening.sql, supabase_moderation_setup.sql, then supabase_security_check.sql (it should return zero rows).
4. Build the Windows folder with build_release.bat.
5. The admin console requires online sign-in. Only server-approved owner/admin accounts can open it.

Scope note: administrator roles, role changes, and their audit records are server-managed. The older game-control tabs still edit only the currently signed-in player's own save; they do not modify other players or global game settings.


Version 10.7 adds online admin pranks and more resilient background music looping. Before using online pranks, run supabase_pranks_setup.sql after the existing Supabase setup and admin role scripts. See SUPABASE_SETUP.md.

Version 10.9 update: The Confetti Celebration online prank now plays the supplied transparent confetti GIF as an overlay across the main game window. It plays once and then disappears. Pillow is included in requirements, and the GIF is bundled by build_release.bat. No Supabase SQL setup files were changed.

Version 10.10 update: The game version is now shown in the window title and as a small "v10.10" badge on the sign-in screen and the main header (and on the website). The server can require a minimum version: copies older than the minimum can no longer load or save online data, and 10.10 and newer show a clear "Update required" message and still allow offline play. Run supabase_security_hardening_v2.sql and then supabase_version_gate_setup.sql (see SUPABASE_SETUP.md, "Minimum game version"). Also in 10.10: players can only edit their own nickname on the leaderboard, leaderboard points and Blackjack wins can only rise at a limited speed, suspended players are blocked on the server, the admin coin generator no longer lets a delegated admin add coins to themselves, and the website has a Content-Security-Policy. See SECURITY_REVIEW.md. Gameplay and saves are unchanged. The project folder and the release ZIP are named after the version (mini_arcade_hub_v10_10_security); see CLAUDE.md.

