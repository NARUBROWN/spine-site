#!/usr/bin/env python3
"""Compatibility entry point for current documentation checks."""
from pathlib import Path
import subprocess
import sys

if __name__ == "__main__":
    checker = Path(__file__).with_name("check-v075-examples.py")
    raise SystemExit(subprocess.call([sys.executable, str(checker), "--mode", "contracts", *sys.argv[1:]]))
