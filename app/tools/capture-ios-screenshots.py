#!/usr/bin/env python3
"""Capture representative native dashboards, then restore the production app."""
import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
APP_ID = "com.brzee.companion"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--app", type=Path, required=True, help="Built production simulator .app")
parser.add_argument("--device", default="booted", help="Booted simulator UUID")
args = parser.parse_args()
production = args.app.resolve()
if not (production / "main.jsbundle").is_file():
    parser.error("--app must contain a bundled production main.jsbundle")
output = ROOT / "docs/images"
output.mkdir(parents=True, exist_ok=True)


def run(*command):
    subprocess.run(command, cwd=ROOT, check=True)


def sim(*command):
    run("xcrun", "simctl", *command)


with tempfile.TemporaryDirectory(prefix="brzee-screenshots-") as folder:
    capture = Path(folder) / "BRZEEScreenshots.app"
    shutil.copytree(production, capture)
    run("node", "node_modules/expo/bin/cli", "export:embed",
        "--entry-file", "tests/screenshots/entry.tsx", "--platform", "ios",
        "--dev", "false", "--max-workers", "4",
        "--bundle-output", str(capture / "main.jsbundle"))
    try:
        sim("status_bar", args.device, "override", "--time", "9:41",
            "--dataNetwork", "wifi", "--wifiMode", "active", "--wifiBars", "3",
            "--batteryState", "charged", "--batteryLevel", "100")
        sim("install", args.device, str(capture))
        sim("launch", "--terminate-running-process", args.device, APP_ID)
        time.sleep(4)
        for scene in ["idle", "city", "cruise"]:
            sim("openurl", args.device, f"brzee://screenshots/{scene}")
            time.sleep(2)
            sim("io", args.device, "screenshot", str(output / f"brzee-{scene}-ios.png"))
    finally:
        # Fixture JS exists only in a temporary copy. Always restore the real app.
        subprocess.run(["xcrun", "simctl", "terminate", args.device, APP_ID],
                       cwd=ROOT, check=False)
        try:
            sim("install", args.device, str(production))
            sim("launch", args.device, APP_ID)
            time.sleep(6)
            sim("io", args.device, "screenshot", str(output / "brzee-connect-ios.png"))
        finally:
            sim("status_bar", args.device, "clear")
