# CLAUDE.md - instructions for Claude (and any other AI helper) working on Mini Arcade Hub

Read this file first, every time. Then read `mini_arcade_hub_*/README.txt`, `SECURITY_REVIEW.md` and
`SUPABASE_SETUP.md` before editing. (`ARCHITECTURE.md` and `TEST_CHECKLIST.md` do not exist yet; if the
owner adds them, read them too.)

## How to work with the owner
- Treat the files the owner uploads (or the GitHub repo) as the source of truth. Inspect first; never assume a
  feature that was discussed before actually exists.
- Before editing, summarize the project structure and name the exact files and functions you will change.
- The owner uses **Windows** and the command `python` (not `py`).
- Give setup instructions **one step at a time**, in plain language, saying what success looks like.
- Be honest about what you could not run or test. Never claim a test passed that you did not run.

## Project map
- `mini_arcade_hub_v<MAJOR>_<MINOR>_<tag>/` - the Windows desktop game (Python + Tkinter + Supabase, packaged
  with PyInstaller by `build_release.bat`). Also holds every `supabase_*.sql` script and the docs.
  The folder name carries the version (see below). Entry point `mini_arcade.py`; version in `config.py`.
- `web-version/` - the website/app (React + Vite). Published to GitHub Pages by `.github/workflows/deploy-web.yml`;
  the same code is packaged as Electron (Windows) and Capacitor (Android). Version in `package.json`.
- `tools/` - `check_release.py` (consistency check) and `make_release_zip.py` (builds the release ZIP).
- `.github/workflows/` - deploy, desktop build, Android build, release check.

## Standing rules (never break these)
- Preserve existing gameplay, save compatibility, owner authorization, and offline play.
- Admin permissions are verified **server-side**. The owner account keeps the highest level. Players must never be
  able to give themselves admin. Keep admin-only features protected.
- Row Level Security protects player data. Never put a service-role/secret key, database password, or private admin
  signing material in source, in the public repo, or in a release package. Only the publishable key belongs in the game.
- Prefer server-managed settings over rebuilding where possible.
- Scores come from the player's own device. Do not describe the leaderboard as cheat-proof.

## VERSIONING AND RELEASES (mandatory - do this on EVERY release)

**Every set of changes you hand to the owner is a new release with a new version number.** Never deliver changed
code under an old version number, and never deliver a ZIP or folder whose name does not match the version inside.

Version format: `MAJOR.MINOR` (for example `10.10`). Compare numbers part by part: **10.10 is newer than 10.9**.
Normally raise MINOR by one. Ask the owner before raising MAJOR.

Naming (all three must agree):
- Project folder: `mini_arcade_hub_v<MAJOR>_<MINOR>_<tag>` e.g. `mini_arcade_hub_v10_11_trivia_daily`
- Release ZIP: the same name plus `.zip`, e.g. `mini_arcade_hub_v10_11_trivia_daily.zip`
- `<tag>` is a short lowercase description of the release (letters, digits, underscores), e.g. `security`, `blackjack_split`.

When you bump the version, update ALL of these (the checker verifies them):
1. Rename the project folder with `git mv <old folder> <new folder>` (so history follows the rename).
2. `<folder>/config.py` -> `APP_VERSION = "MAJOR.MINOR"`
3. `web-version/package.json` -> `"version": "MAJOR.MINOR.0"` AND the two root `"version"` entries at the top of
   `web-version/package-lock.json` (so `npm ci` stays happy).
4. `<folder>/README.txt` first line mentions `vMAJOR.MINOR`.
5. `<folder>/RELEASE_README.txt` gets a `Version MAJOR.MINOR` paragraph describing the release.
6. Anything security-related also goes in `<folder>/SECURITY_REVIEW.md`.
7. Search for the old folder name (`grep -rn "<old folder>"`) and fix every reference. `check_release.py` fails on stale ones.

Then build and verify the package. **Never zip by hand.**
```
python tools/check_release.py
python tools/make_release_zip.py --out <output folder>
python tools/check_release.py --zip <output folder>/<folder>.zip
```
The ZIP is laid out like the GitHub repo (so it can be copied over the repo). It contains `.github/`, the versioned
folder, `web-version/`, `tools/` and `CLAUDE.md`, and never contains `node_modules`, build output, saves, or the
owner's real `supabase_config.json`.

Because the folder name changes every release, **tell the owner to delete the old folder on GitHub** when uploading
through the GitHub website (the upload adds the new folder but leaves the old one). Name the old folder in your message.

## Online mode: old versions must not be able to play online
The server refuses online requests from versions older than a minimum the owner sets. How it works:
- Every client sends its version in the header `x-mini-arcade-version` (desktop: `auth.py` via `version_check.client_headers()`;
  web: `web-version/src/lib/supabase.js`). **Every new place that talks to Supabase must use these shared clients**, or send
  that header itself. A client without the header is blocked once a minimum is set.
- `supabase_version_gate_setup.sql` installs a Supabase pre-request check, `mini_arcade_enforce_client_version()`, which
  returns HTTP 426 with code `update_required` for older or missing versions. The minimum lives in the one-row table
  `mini_arcade_app_config`. It is empty (gate off) until the owner sets it.
- New clients show a clear "Update required" message (desktop `version_ui.py`, web `VersionBadge.jsx`). Offline play is
  never blocked.
- The version is shown on screen (window title + badge on desktop, badge on the website). Keep it visible.

On every release, tell the owner whether to raise the minimum, and give the exact SQL
(`update public.mini_arcade_app_config set min_client_version = 'MAJOR.MINOR', updated_at = now() where id = 1;`).
Rules for raising it:
- Raise it **only after** the new website is deployed and friends have the new Windows build; otherwise people who
  have not updated yet are locked out.
- Raise it when an old version has a security hole, a save-format change, or a rule change that old copies would break.
- Rollback is instant: set `min_client_version = null`.
- Do not add server paths that skip the gate (for example an Edge Function that reads player data) without adding the
  same version check there.
- Be honest: the version is reported by the player's computer, so this stops honest old copies, not a determined cheater.

## Deliverables every time
- Run a syntax check and the relevant tests, and say exactly what you ran:
  - Desktop (from the versioned folder): `python -m py_compile *.py` and `python -m unittest test_version_check test_trivia_daily -v`
  - Web (from `web-version`): `npm test` and `npm run build`
  - Release: `python tools/check_release.py`
  - SQL: test on a real Postgres when you can; the owner runs `supabase_security_check.sql` (healthy result: no rows).
- Return the complete changed files **and** the version-named ZIP (built with `tools/make_release_zip.py`).
- Give a changelog, precise Windows test instructions, and a list of gameplay files/functions you changed.
- Say clearly which Supabase SQL scripts must be run, in what order, and which are new.
