#!/usr/bin/env python3
"""The guestbook, as a service.

A 2004 home page had one, and it was a CGI script writing to a text file.
This is the same thing with the sharp edges filed off: one process, one JSON
file on a volume, the standard library and nothing else. It sits behind the
nginx in deploy/nginx.conf at /api/guestbook and is never public on its own.

    GET    /api/guestbook          the last hundred entries, newest first
    POST   /api/guestbook          {"name", "message", "website"} -> the entry
    DELETE /api/guestbook/<id>     Authorization: Bearer $GUESTBOOK_ADMIN_TOKEN

What keeps it from filling with junk, in order of how much it does:

  - "website" is a honeypot. The form hides it; a bot fills it. A filled-in
    honeypot gets a 200 and is thrown away, so the bot believes it worked.
  - One entry a minute and twenty a day per address, from memory, so a
    restart forgets. The address comes from X-Forwarded-For, which nginx
    sets; nothing here stores it.
  - Names are forty characters, messages five hundred, whitespace collapsed,
    control characters dropped. The page renders them as text, never HTML.
  - DELETE with the admin token, for the one that gets through anyway.

Not a framework, on purpose: the whole thing is shorter than a framework's
dependency list, and the attack surface is what is in this file.
"""

import json
import os
import re
import secrets
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DATA = os.environ.get("GUESTBOOK_DATA", "/data/guestbook.json")
TOKEN = os.environ.get("GUESTBOOK_ADMIN_TOKEN", "")
PORT = int(os.environ.get("PORT", "8080"))

SHOWN = 100
NAME_MAX = 40
MESSAGE_MAX = 500
BODY_MAX = 8 * 1024
MINUTE = 60
DAY = 24 * 3600
PER_MINUTE = 1
PER_DAY = 20

_lock = threading.Lock()
_recent: dict[str, list[float]] = {}

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_SPACE = re.compile(r"[ \t\r\f\v]+")


def _load() -> list[dict]:
    try:
        with open(DATA, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (FileNotFoundError, ValueError):
        return []


def _save(entries: list[dict]) -> None:
    """Write-then-rename, so a crash mid-write leaves the old file, not half of one."""
    os.makedirs(os.path.dirname(DATA) or ".", exist_ok=True)
    tmp = f"{DATA}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False)
    os.replace(tmp, DATA)


def _clean(value: object, limit: int, multiline: bool) -> str:
    text = value if isinstance(value, str) else ""
    text = _CONTROL.sub("", text)
    text = _SPACE.sub(" ", text)
    if not multiline:
        text = text.replace("\n", " ")
    else:
        text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()[:limit].strip()


def _allowed(ip: str) -> bool:
    now = time.time()
    with _lock:
        stamps = [t for t in _recent.get(ip, []) if now - t < DAY]
        _recent[ip] = stamps
        if sum(1 for t in stamps if now - t < MINUTE) >= PER_MINUTE:
            return False
        if len(stamps) >= PER_DAY:
            return False
        stamps.append(now)
        return True


class Handler(BaseHTTPRequestHandler):
    server_version = "funos-guestbook/1"

    def _json(self, code: int, body: object) -> None:
        raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def _ip(self) -> str:
        forwarded = self.headers.get("X-Forwarded-For", "")
        first = forwarded.split(",")[0].strip()
        return first or self.client_address[0]

    def do_GET(self) -> None:  # noqa: N802 - http.server's naming
        if self.path == "/health":
            self._json(200, {"status": "ok"})
            return
        if self.path.rstrip("/") != "/api/guestbook":
            self._json(404, {"error": "not found"})
            return
        with _lock:
            entries = _load()
        self._json(200, {"entries": list(reversed(entries[-SHOWN:]))})

    def do_POST(self) -> None:  # noqa: N802
        if self.path.rstrip("/") != "/api/guestbook":
            self._json(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > BODY_MAX:
            self._json(413, {"error": "too long"})
            return
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            self._json(400, {"error": "bad json"})
            return
        if not isinstance(body, dict):
            self._json(400, {"error": "bad json"})
            return

        if _clean(body.get("website"), 10, False):
            # The honeypot. Say yes, do nothing.
            self._json(200, {"ok": True})
            return

        name = _clean(body.get("name"), NAME_MAX, False) or "Anonymous"
        message = _clean(body.get("message"), MESSAGE_MAX, True)
        if len(message) < 2:
            self._json(400, {"error": "Say something."})
            return
        if not _allowed(self._ip()):
            self._json(429, {"error": "One entry a minute, please. Try again shortly."})
            return

        entry = {
            "id": secrets.token_urlsafe(8),
            "name": name,
            "message": message,
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        with _lock:
            entries = _load()
            entries.append(entry)
            _save(entries)
        self._json(201, {"entry": entry})

    def do_DELETE(self) -> None:  # noqa: N802
        prefix = "/api/guestbook/"
        if not self.path.startswith(prefix):
            self._json(404, {"error": "not found"})
            return
        auth = self.headers.get("Authorization", "")
        if not TOKEN or not secrets.compare_digest(auth, f"Bearer {TOKEN}"):
            self._json(403, {"error": "no"})
            return
        entry_id = self.path[len(prefix):]
        with _lock:
            entries = _load()
            kept = [e for e in entries if e.get("id") != entry_id]
            if len(kept) == len(entries):
                self._json(404, {"error": "not found"})
                return
            _save(kept)
        self._json(200, {"ok": True})

    def log_message(self, fmt: str, *args: object) -> None:
        # One line per request, no client address: nginx has the access log.
        print(f"{self.command} {self.path} {fmt % args}", flush=True)


if __name__ == "__main__":
    print(f"guestbook: {DATA}, port {PORT}, admin token {'set' if TOKEN else 'NOT set'}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
