#!/usr/bin/env python3
"""Build the release ZIP, named after the version folder, after checking everything agrees.

    python tools/make_release_zip.py            # writes mini_arcade_hub_v10_11_trivia_daily.zip in the current folder
    python tools/make_release_zip.py --out DIR

The ZIP holds the whole project laid out exactly like the GitHub repository (so it can be copied
over the repo as is): .github/, the versioned game folder, web-version/, tools/, CLAUDE.md, ...
It never contains node_modules, build output, saves, or your real supabase_config.json.
"""
from __future__ import annotations

import argparse
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_release  # noqa: E402

EXCLUDED_DIRS = {".git", "node_modules", "dist", "release", "__pycache__", ".venv", "local_saves", ".gradle"}
EXCLUDED_FILES = {"supabase_config.json", "blackjack_save.json", "game_settings.json"}
EXCLUDED_SUFFIXES = {".pyc", ".zip"}


def build(root: Path, out_dir: Path) -> Path:
    problems, info = check_release.check_project(root)
    if problems:
        print("Cannot build: the version is not consistent.")
        for item in problems:
            print(f"  - {item}")
        raise SystemExit(1)
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / f"{info['folder']}.zip"
    if target.exists():
        target.unlink()
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(root.rglob("*")):
            relative = path.relative_to(root)
            if path.is_dir() or any(part in EXCLUDED_DIRS for part in relative.parts):
                continue
            if path.name in EXCLUDED_FILES or path.suffix.lower() in EXCLUDED_SUFFIXES:
                continue
            archive.write(path, relative.as_posix())
    problems = check_release.check_zip(target, info["folder"])
    if problems:
        target.unlink()
        print("Built ZIP failed its own check:")
        for item in problems:
            print(f"  - {item}")
        raise SystemExit(1)
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=Path.cwd(), help="folder to write the ZIP into")
    parser.add_argument("--root", type=Path, default=check_release.ROOT)
    args = parser.parse_args()
    target = build(args.root, args.out)
    print(f"Built {target} ({target.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
