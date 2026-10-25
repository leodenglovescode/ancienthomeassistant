#!/usr/bin/env python3
"""Ancient Home Assistant: dependency-free local dashboard and authenticated bridge."""
import argparse
import http.client
import json
import re
import secrets
import threading
import time
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, unquote
from urllib.request import Request, build_opener, HTTPRedirectHandler

STATIC = Path(__file__).parent / "static"
SESSIONS = {}
LOCK = threading.Lock()
SESSION_AGE = 12 * 60 * 60
ENTITY = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")
SERVICES = {"light": {"turn_on", "turn_off"}, "switch": {"turn_on", "turn_off"},
            "scene": {"turn_on"}, "climate": {"set_temperature", "set_hvac_mode"}}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward a bearer credential to another origin.


OPENER = build_opener(NoRedirect())


def validate_url(value):
    url = urlsplit(value.strip())
    if url.scheme not in ("http", "https") or not url.hostname or url.username or url.password:
        raise ValueError("Use an http:// or https:// Home Assistant address without credentials.")
    if url.query or url.fragment or url.path not in ("", "/"):
        raise ValueError("Use the base address, for example http://homeassistant.local:8123.")
    return value.strip().rstrip("/")


def upstream(session, path, data=None, timeout=12):
    body = None if data is None else json.dumps(data).encode()
    request = Request(session["url"] + path, data=body, headers={
        "Authorization": "Bearer " + session["token"],
        "Content-Type": "application/json", "User-Agent": "AncientHomeAssistant/1.0"})
    return OPENER.open(request, timeout=timeout)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC), **kwargs)

    def log_message(self, fmt, *args):
        pass  # No tokens, entity names, or camera URLs in access logs.

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' http: https:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
        super().end_headers()

    def reply(self, status, data, cookie=None):
        raw = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(raw)

    def session(self):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
            key = cookie["ancient_session"].value
        except (KeyError, ValueError):
            return None
        with LOCK:
            result = SESSIONS.get(key)
            if result and time.time() - result["created"] > SESSION_AGE:
                del SESSIONS[key]
                return None
            return result

    def same_origin(self):
        # A custom header also prevents cross-site form submission on older Safari.
        if self.headers.get("X-Ancient-Request") != "1":
            return False
        origin = self.headers.get("Origin")
        return not origin or urlsplit(origin).netloc == self.headers.get("Host")

    def failure(self, error):
        if isinstance(error, HTTPError):
            status = 401 if error.code in (401, 403) else 502
            message = "Home Assistant rejected the token. Check its permissions." if status == 401 else "Home Assistant returned HTTP %s." % error.code
            error.close()
        elif isinstance(error, (URLError, TimeoutError, OSError, http.client.HTTPException)):
            status, message = 502, "Cannot reach Home Assistant. Check the address, network, and certificate."
        else:
            status, message = 400, str(error)
        self.reply(status, {"error": message})

    def do_GET(self):
        path = urlsplit(self.path).path
        if not path.startswith("/api/"):
            # Do not expose project files or follow symlinks outside static/.
            target = (STATIC / unquote(path).lstrip("/")).resolve()
            if not target.is_relative_to(STATIC.resolve()):
                return self.reply(404, {"error": "Not found"})
            return super().do_GET()
        session = self.session()
        if path == "/api/status":
            return self.reply(200, {"connected": bool(session), "url": session["url"] if session else ""})
        if not session:
            return self.reply(401, {"error": "Connect Home Assistant in Settings first."})
        response_started = False
        try:
            if path == "/api/states":
                with upstream(session, "/api/states") as response:
                    states = json.load(response)
                # Camera access tokens and unrelated attributes stay on the bridge.
                allowed = ("friendly_name", "brightness", "temperature", "current_temperature", "hvac_modes", "unit_of_measurement", "device_class", "supported_features")
                clean = [{"entity_id": s["entity_id"], "state": s["state"],
                          "attributes": {k: v for k, v in s.get("attributes", {}).items() if k in allowed}} for s in states]
                return self.reply(200, clean)
            if path.startswith("/api/camera/"):
                parts = path.split("/")
                entity = parts[3]
                stream = len(parts) == 5 and parts[4] == "stream"
                if not ENTITY.fullmatch(entity) or not entity.startswith("camera.") or len(parts) > 5 or (len(parts) == 5 and not stream):
                    raise ValueError("Invalid camera entity.")
                route = "/api/camera_proxy_stream/" if stream else "/api/camera_proxy/"
                with upstream(session, route + entity, timeout=20) as response:
                    content_type = response.headers.get("Content-Type", "image/jpeg")
                    if not (content_type.startswith("image/") or content_type.startswith("multipart/")):
                        raise ValueError("Camera did not return a supported image stream.")
                    if stream:
                        response_started = True
                        self.send_response(200)
                        self.send_header("Content-Type", content_type)
                        self.send_header("Connection", "close")
                        self.end_headers()
                        self.close_connection = True
                        while True:
                            chunk = response.read1(16384)
                            if not chunk:
                                break
                            self.wfile.write(chunk)
                            self.wfile.flush()
                    else:
                        raw = response.read(12 * 1024 * 1024 + 1)
                        if len(raw) > 12 * 1024 * 1024:
                            raise ValueError("Camera image exceeds 12 MB.")
                        self.send_response(200)
                        self.send_header("Content-Type", content_type)
                        self.send_header("Content-Length", str(len(raw)))
                        self.end_headers()
                        self.wfile.write(raw)
                return
            self.reply(404, {"error": "Not found"})
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as error:
            if not response_started:
                self.failure(error)

    def do_POST(self):
        if not self.same_origin():
            return self.reply(403, {"error": "Same-origin request required."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 0 or length > 16384:
                return self.reply(413, {"error": "Request too large"})
            data = json.loads(self.rfile.read(length) or b"{}")
            if not isinstance(data, dict):
                raise ValueError("Expected a JSON object.")
            path = urlsplit(self.path).path
            if path == "/api/connect":
                url = validate_url(data.get("url", ""))
                token = data.get("token", "").strip()
                if not token or len(token) > 8192 or "\n" in token or "\r" in token:
                    raise ValueError("Enter a valid long-lived access token.")
                session = {"url": url, "token": token, "created": time.time()}
                with upstream(session, "/api/") as response:
                    json.load(response)
                key = secrets.token_urlsafe(32)
                with LOCK:
                    for old in list(SESSIONS):
                        if time.time() - SESSIONS[old]["created"] > SESSION_AGE:
                            del SESSIONS[old]
                    if len(SESSIONS) >= 100:
                        raise ValueError("Too many sessions. Restart the bridge.")
                    SESSIONS[key] = session
                secure = "; Secure" if self.headers.get("Origin", "").startswith("https:") else ""
                return self.reply(200, {"connected": True, "url": url},
                                  "ancient_session=%s; HttpOnly; SameSite=Strict; Path=/%s" % (key, secure))
            if path == "/api/disconnect":
                session = self.session()
                with LOCK:
                    for key in list(SESSIONS):
                        if SESSIONS[key] is session:
                            del SESSIONS[key]
                return self.reply(200, {"connected": False}, "ancient_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0")
            session = self.session()
            if not session:
                return self.reply(401, {"error": "Connect Home Assistant first."})
            if path == "/api/service":
                domain, service = data.get("domain"), data.get("service")
                entity = data.get("entity_id", "")
                if domain not in SERVICES or service not in SERVICES[domain] or not ENTITY.fullmatch(entity) or entity.split(".")[0] != domain:
                    raise ValueError("Unsupported service or entity.")
                payload = {"entity_id": entity}
                if "brightness_pct" in data:
                    brightness = float(data["brightness_pct"])
                    if domain != "light" or not 0 <= brightness <= 100:
                        raise ValueError("Brightness must be between 0 and 100.")
                    payload["brightness_pct"] = round(brightness)
                if "temperature" in data:
                    value = float(data["temperature"])
                    if domain != "climate" or not 5 <= value <= 95:
                        raise ValueError("Invalid temperature.")
                    payload["temperature"] = value
                if "hvac_mode" in data:
                    if data["hvac_mode"] not in ("off", "heat", "cool", "auto", "heat_cool", "dry", "fan_only"):
                        raise ValueError("Invalid HVAC mode.")
                    payload["hvac_mode"] = data["hvac_mode"]
                with upstream(session, "/api/services/%s/%s" % (domain, service), payload) as response:
                    response.read()
                return self.reply(200, {"ok": True})
            self.reply(404, {"error": "Not found"})
        except Exception as error:
            self.failure(error)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8095)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.daemon_threads = True
    print("Ancient Home Assistant: http://%s:%s" % (args.host, args.port), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
