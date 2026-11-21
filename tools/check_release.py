#!/usr/bin/env python3
"""Check that the version is consistent everywhere. Run before every release:

    python tools/check_release.py                 # check the project folder
    python tools/check_release.py --zip FILE.zip  # also check a release ZIP

The release version lives in the NAME of the project folder:
    mini_arcade_hub_v<MAJOR>_<MINOR>_<tag>      e.g. mini_arcade_hub_v10_11_trivia_daily  = version 10.11

and must agree with:
    <folder>/config.py            APP_VERSION = "10.11"
    web-version/package.json      "version": "10.11.0"   (and the same in package-lock.json)
    <folder>/README.txt           first line mentions v10.11
    <folder>/RELEASE_README.txt   has a "Version 10.11" entry
    the ZIP name                  mini_arcade_hub_v10_11_trivia_daily.zip

It exits with a non-zero code and lists every problem if anything disagrees.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FOLDER_RE = re.compile(r"^mini_arcade_hub_v(\d+)_(\d+)_([a-z0-9_]+)$")
FOLDER_MENTION_RE = re.compile(r"mini_arcade_hub_v\d+_\d+_[a-z0-9_]+")
SKIP_DIRS = {".git", "node_modules", "dist", "release", "__pycache__", ".venv", "local_saves"}
TEXT_SUFFIXES = {".py", ".js", ".jsx", ".json", ".md", ".txt", ".yml", ".yaml", ".bat", ".ps1", ".sql", ".cjs", ".ts", ".html", ".css"}
FORBIDDEN_IN_ZIP = ("node_modules/", ".git/", "supabase_config.json", "local_saves/", "__pycache__/", "/dist/", "blackjack_save.json", "game_settings.json")


def find_folders(root: Path) -> list[Path]:
    return sorted(p for p in root.iterdir() if p.is_dir() and FOLDER_RE.match(p.name))


def short(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


def check_project(root: Path = ROOT) -> tuple[list[str], dict]:
    problems: list[str] = []
    info: dict = {}
    folders = find_folders(root)
    if len(folders) != 1:
        problems.append(
            "Expected exactly one project folder named mini_arcade_hub_v<MAJOR>_<MINOR>_<tag>, found: "
            + (", ".join(p.name for p in folders) or "none")
        )
        return problems, info
    folder = folders[0]
    major, minor, tag = FOLDER_RE.match(folder.name).groups()
    version = f"{int(major)}.{int(minor)}"
    info.update(folder=folder.name, version=version, tag=tag)

    # desktop version
    config = folder / "config.py"
    match = re.search(r'^APP_VERSION\s*=\s*"([^"]+)"', config.read_text(encoding="utf-8"), re.M) if config.exists() else None
    if not match:
        problems.append(f"{short(config, root)} has no APP_VERSION = \"...\" line")
    elif match.group(1) != version:
        problems.append(f'{short(config, root)} APP_VERSION is "{match.group(1)}" but the folder name says {version}')

    # web version (package.json and the lockfile's own entries)
    package = root / "web-version" / "package.json"
    want_web = f"{version}.0"
    if package.exists():
        found = json.loads(package.read_text(encoding="utf-8")).get("version")
        if found != want_web:
            problems.append(f'web-version/package.json version is "{found}" but must be "{want_web}"')
    else:
        problems.append("web-version/package.json is missing")
    lock = root / "web-version" / "package-lock.json"
    if lock.exists():
        data = json.loads(lock.read_text(encoding="utf-8"))
        for label, found in (("package-lock.json version", data.get("version")), ('package-lock.json packages[""].version', data.get("packages", {}).get("", {}).get("version"))):
            if found != want_web:
                problems.append(f'web-version/{label} is "{found}" but must be "{want_web}" (edit it to match package.json)')

    # docs mention this version
    readme = folder / "README.txt"
    if readme.exists():
        first = readme.read_text(encoding="utf-8", errors="replace").splitlines()[0] if readme.stat().st_size else ""
        if not re.search(rf"v{re.escape(version)}(?!\d)", first):
            problems.append(f'{short(readme, root)} first line must mention v{version} (it says: "{first.strip()}")')
    release_notes = folder / "RELEASE_README.txt"
    if release_notes.exists():
        if not re.search(rf"Version {re.escape(version)}(?!\d)", release_notes.read_text(encoding="utf-8", errors="replace")):
            problems.append(f'{short(release_notes, root)} needs a "Version {version}" entry')

    # nothing may still point at an old folder name
    for path in root.rglob("*"):
        if path.is_dir() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        if any(part in SKIP_DIRS for part in path.relative_to(root).parts) or path.name == "package-lock.json":
            continue
        for mention in set(FOLDER_MENTION_RE.findall(path.read_text(encoding="utf-8", errors="ignore"))):
            if mention != folder.name:
                problems.append(f"{short(path, root)} still mentions the old folder name {mention}")
    return problems, info


def check_zip(zip_path: Path, folder: str) -> list[str]:
    problems: list[str] = []
    if zip_path.stem != folder:
        problems.append(f"ZIP is named {zip_path.name} but must be named {folder}.zip")
    if not zip_path.exists():
        return problems + [f"{zip_path} does not exist"]
    with zipfile.ZipFile(zip_path) as archive:
        names = archive.namelist()
    top = {name.split("/")[0] for name in names if name.strip("/")}
    versioned = {t for t in top if FOLDER_RE.match(t)}
    if versioned != {folder}:
        problems.append(f"ZIP must contain exactly the folder {folder}/ (found: {', '.join(sorted(versioned)) or 'none'})")
    if f"{folder}/config.py" not in names:
        problems.append(f"ZIP is missing {folder}/config.py")
    for needed in ("web-version/package.json", "CLAUDE.md", "tools/check_release.py"):
        if needed not in names:
            problems.append(f"ZIP is missing {needed}")
    for name in names:
        if any(bad in f"/{name}" or name.endswith(bad.strip("/")) and bad.endswith(".json") for bad in FORBIDDEN_IN_ZIP):
            problems.append(f"ZIP must not contain {name}")
    return problems


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--zip", type=Path, help="also check this release ZIP")
    parser.add_argument("--root", type=Path, default=ROOT, help="repository root (default: the folder above tools/)")
    args = parser.parse_args(argv)
    problems, info = check_project(args.root)
    if info and args.zip:
        problems += check_zip(args.zip, info["folder"])
    if problems:
        print("RELEASE CHECK FAILED:")
        for item in problems:
            print(f"  - {item}")
        return 1
    print(f"Release check OK: version {info['version']}, folder {info['folder']}" + (f", zip {args.zip.name}" if args.zip else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
