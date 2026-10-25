"""Private SQLite settings and hashed dashboard sessions; no browser credentials."""
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

SESSION_AGE = 30 * 24 * 60 * 60
PASSWORD_ROUNDS = 600_000


def default_config():
    return {"title": "My home", "columns": 3, "sections": [], "onboarding_complete": False}


def password_hash(password, salt=None):
    if not isinstance(password, str) or not 10 <= len(password) <= 256:
        raise ValueError("Use a dashboard password between 10 and 256 characters.")
    salt = salt or secrets.token_hex(16)
    result = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), PASSWORD_ROUNDS)
    return salt + ":" + result.hex()


def password_matches(password, encoded):
    if not isinstance(password, str) or len(password) > 256:
        return False
    salt, expected = encoded.split(":", 1)
    result = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), PASSWORD_ROUNDS)
    return hmac.compare_digest(result.hex(), expected)


class Store:
    def __init__(self, directory):
        self.directory = Path(directory).resolve()
        self.directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.directory.chmod(0o700)
        self.path = self.directory / "dashboard.sqlite3"
        if self.path.is_symlink():
            raise ValueError("The dashboard database must not be a symbolic link.")
        fd = os.open(str(self.path), os.O_CREAT | os.O_WRONLY, 0o600)
        os.close(fd)
        self.path.chmod(0o600)
        with self.db() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS settings (
                    id INTEGER PRIMARY KEY CHECK(id = 1),
                    url TEXT NOT NULL, token TEXT NOT NULL, password_hash TEXT NOT NULL,
                    config TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS sessions (
                    digest TEXT PRIMARY KEY, expires REAL NOT NULL
                );
            """)

    @contextmanager
    def db(self):
        db = sqlite3.connect(str(self.path), timeout=10)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def settings(self):
        with self.db() as db:
            row = db.execute("SELECT * FROM settings WHERE id = 1").fetchone()
            return dict(row) if row else None

    def setup(self, url, token, password):
        hashed = password_hash(password)
        with self.db() as db:
            db.execute("BEGIN IMMEDIATE")
            if db.execute("SELECT id FROM settings").fetchone():
                return False
            db.execute("INSERT INTO settings(id,url,token,password_hash,config) VALUES (1,?,?,?,?)",
                       (url, token, hashed, json.dumps(default_config())))
            return True

    def config(self):
        settings = self.settings()
        config = json.loads(settings["config"])
        config["revision"] = settings["revision"]
        return config

    def save_config(self, config, revision):
        with self.db() as db:
            result = db.execute("UPDATE settings SET config=?, revision=revision+1 WHERE id=1 AND revision=?",
                                (json.dumps(config), revision))
            return bool(result.rowcount)

    def update_connection(self, url, token):
        with self.db() as db:
            db.execute("UPDATE settings SET url=?, token=? WHERE id=1", (url, token))

    def create_session(self):
        raw = secrets.token_urlsafe(32)
        digest = hashlib.sha256(raw.encode()).hexdigest()
        now = time.time()
        with self.db() as db:
            db.execute("DELETE FROM sessions WHERE expires <= ?", (now,))
            # Bound retained sessions without evicting the current household on normal use.
            db.execute("DELETE FROM sessions WHERE digest IN (SELECT digest FROM sessions ORDER BY expires DESC LIMIT -1 OFFSET 99)")
            db.execute("INSERT INTO sessions VALUES (?,?)", (digest, now + SESSION_AGE))
        return raw

    def authenticated(self, raw):
        if not raw or len(raw) > 128:
            return False
        digest = hashlib.sha256(raw.encode()).hexdigest()
        with self.db() as db:
            return bool(db.execute("SELECT digest FROM sessions WHERE digest=? AND expires>?", (digest, time.time())).fetchone())

    def logout(self, raw):
        with self.db() as db:
            db.execute("DELETE FROM sessions WHERE digest=?", (hashlib.sha256(raw.encode()).hexdigest(),))

    def change_password(self, password):
        hashed = password_hash(password)
        with self.db() as db:
            db.execute("UPDATE settings SET password_hash=? WHERE id=1", (hashed,))
            db.execute("DELETE FROM sessions")
