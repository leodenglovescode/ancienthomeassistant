"""Prepare Supervisor storage and run Ancient as its unprivileged user."""
import os
from pathlib import Path
import sys

DATA_DIR = Path("/data/dashboard")
DASHBOARD_UID = 10001
DASHBOARD_GID = 10001


def main():
    # Only change the owner of our own directory, never Supervisor options.json.
    # Database files remain owned by this same user across updates/restores.
    if DATA_DIR.is_symlink():
        raise RuntimeError("Dashboard data directory must not be a symbolic link")
    DATA_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chown(DATA_DIR, DASHBOARD_UID, DASHBOARD_GID)
    os.chmod(DATA_DIR, 0o700)
    os.setgroups([])
    os.setgid(DASHBOARD_GID)
    os.setuid(DASHBOARD_UID)
    os.environ["ANCIENT_DATA_DIR"] = str(DATA_DIR)
    os.chdir("/app")
    os.execv(sys.executable, [sys.executable, "server.py", "--host", "0.0.0.0",
                              "--port", "8095", "--data-dir", str(DATA_DIR)])


if __name__ == "__main__":
    main()
