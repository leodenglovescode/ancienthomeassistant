#!/usr/bin/env python3
"""Ancient Home Assistant: persistent, authenticated legacy-browser dashboard."""
import argparse
import getpass
import hashlib
import http.client
import json
import math
import os
import re
import sqlite3
import threading
import time
from http.cookies import SimpleCookie, CookieError
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, unquote, parse_qs
from urllib.request import Request, build_opener, HTTPRedirectHandler
from storage import Store, SESSION_AGE, password_hash, password_matches

STATIC = Path(__file__).parent / "static"
ENTITY = re.compile(r"^[a-z_][a-z0-9_]*\.[a-z0-9_]+$")
IDENTIFIER = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")
WIDGETS = {
    "light": {"light"}, "switch": {"switch", "input_boolean"},
    "camera": {"camera"}, "climate": {"climate"}, "weather": {"weather"},
    "scene": {"scene"}, "button": {"button", "input_button", "script"},
    "fan": {"fan"}, "cover": {"cover"}, "gauge": {"sensor", "input_number", "number"},
    "sensor": set(),  # Read-only status for non-camera entities.
}
SERVICES = {
    "light": {"turn_on", "turn_off"}, "switch": {"turn_on", "turn_off"},
    "input_boolean": {"turn_on", "turn_off"}, "fan": {"turn_on", "turn_off", "set_percentage"},
    "scene": {"turn_on"}, "script": {"turn_on"}, "button": {"press"}, "input_button": {"press"},
    "cover": {"open_cover", "close_cover", "stop_cover"},
    "climate": {"set_temperature", "set_hvac_mode"},
}
ATTRIBUTES = {"friendly_name", "brightness", "supported_color_modes", "temperature", "current_temperature",
              "hvac_modes", "unit_of_measurement", "temperature_unit", "humidity", "wind_speed",
              "device_class", "supported_features", "min_temp", "max_temp", "target_temp_step",
              "percentage", "current_position"}


class Problem(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward a bearer credential on a redirect.


OPENER = build_opener(NoRedirect())


def validate_url(value):
    if not isinstance(value, str):
        raise ValueError("Enter a Home Assistant base address.")
    value = value.strip()
    url = urlsplit(value)
    if url.scheme not in ("http", "https") or not url.hostname or url.username or url.password:
        raise ValueError("Use an http:// or https:// base address without embedded credentials.")
    if url.query or url.fragment or url.path not in ("", "/") or any(ord(c) < 33 for c in value):
        raise ValueError("Use the base address, for example http://homeassistant.local:8123.")
    url.port  # Validate the port before storing anything.
    return value.rstrip("/")


def validate_token(value):
    if not isinstance(value, str) or not value or len(value) > 8192 or any(not 33 <= ord(c) <= 126 for c in value):
        raise ValueError("Enter a valid long-lived access token.")
    return value


def upstream(credentials, path, data=None, timeout=12):
    request = Request(credentials["url"] + path,
                      data=None if data is None else json.dumps(data).encode(),
                      headers={"Authorization": "Bearer " + credentials["token"],
                               "Content-Type": "application/json", "User-Agent": "AncientHomeAssistant/2.0"})
    return OPENER.open(request, timeout=timeout)


def read_states(credentials):
    with upstream(credentials, "/api/states") as response:
        raw = response.read(16 * 1024 * 1024 + 1)
    if len(raw) > 16 * 1024 * 1024:
        raise Problem(502, "Home Assistant's entity response is too large.")
    data = json.loads(raw)
    if not isinstance(data, list):
        raise Problem(502, "Home Assistant did not return an entity list.")
    return [{"entity_id": s["entity_id"], "state": str(s.get("state", "unknown")),
             "attributes": {k: v for k, v in s.get("attributes", {}).items() if k in ATTRIBUTES}}
            for s in data if isinstance(s, dict) and ENTITY.fullmatch(str(s.get("entity_id", "")))]


def compatible_types(state):
    domain = state["entity_id"].split(".")[0]
    types = [kind for kind, domains in WIDGETS.items() if domain in domains]
    if domain != "camera":
        types.append("sensor")
    if "gauge" in types and state["state"] not in ("unknown", "unavailable"):
        try:
            if not math.isfinite(float(state["state"])):
                types.remove("gauge")
        except (ValueError, TypeError):
            types.remove("gauge")
    return types


def text(value, label, length=100, empty=False):
    if not isinstance(value, str) or len(value) > length or (not empty and not value.strip()):
        raise ValueError("%s must be %s to %s characters." % (label, 0 if empty else 1, length))
    return value.strip()


def number(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(label + " must be a finite number.")
    return value


def validate_config(data, states):
    if not isinstance(data, dict):
        raise ValueError("Expected a dashboard configuration.")
    columns = data.get("columns", 3)
    if type(columns) is not int or columns not in (1, 2, 3):
        raise ValueError("Choose one, two, or three columns.")
    sections = data.get("sections", [])
    if not isinstance(sections, list) or len(sections) > 20:
        raise ValueError("Use at most 20 sections.")
    clean = {"title": text(data.get("title"), "Dashboard title"), "columns": columns,
             "onboarding_complete": bool(data.get("onboarding_complete")), "sections": []}
    section_ids, card_ids, count = set(), set(), 0
    for section in sections:
        if not isinstance(section, dict):
            raise ValueError("Invalid section.")
        sid = section.get("id", "")
        if not isinstance(sid, str) or not IDENTIFIER.fullmatch(sid) or sid in section_ids:
            raise ValueError("Sections need unique identifiers.")
        section_ids.add(sid)
        result = {"id": sid, "title": text(section.get("title"), "Section title"), "cards": []}
        cards = section.get("cards", [])
        if not isinstance(cards, list):
            raise ValueError("Invalid widget list.")
        for card in cards:
            count += 1
            if count > 120 or not isinstance(card, dict):
                raise ValueError("Use at most 120 widgets.")
            cid, entity, kind = card.get("id", ""), card.get("entity", ""), card.get("type", "")
            if not isinstance(cid, str) or not IDENTIFIER.fullmatch(cid) or cid in card_ids:
                raise ValueError("Widgets need unique identifiers.")
            card_ids.add(cid)
            if not isinstance(entity, str) or not ENTITY.fullmatch(entity) or kind not in WIDGETS:
                raise ValueError("Choose a valid entity and widget type.")
            domain = entity.split(".")[0]
            if (kind == "sensor" and domain == "camera") or (kind != "sensor" and domain not in WIDGETS[kind]):
                raise ValueError("A %s entity cannot be bound to a %s widget." % (domain, kind))
            if entity in states and kind not in compatible_types(states[entity]):
                raise ValueError("This entity does not support the selected widget type.")
            span = card.get("span", 1)
            if type(span) is not int or span not in (1, 2, 3):
                raise ValueError("Widget width must be one, two, or three columns.")
            widget = {"id": cid, "entity": entity, "type": kind, "title": text(card.get("title"), "Widget title"), "span": span}
            if kind == "gauge":
                minimum, maximum = number(card.get("min", 0), "Gauge minimum"), number(card.get("max", 100), "Gauge maximum")
                if maximum <= minimum:
                    raise ValueError("The gauge maximum must be greater than its minimum.")
                widget.update(min=minimum, max=maximum, unit=text(card.get("unit", ""), "Gauge unit", 24, empty=True))
            if kind == "camera":
                url = text(card.get("stream_url", ""), "Video URL", 2048, empty=True)
                if url:
                    parsed = urlsplit(url)
                    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password or re.search(r"[?&](?:token|access_token|auth)=", url, re.I) or any(ord(c) < 33 for c in url):
                        raise ValueError("Use an http(s) video URL without embedded credentials or tokens.")
                widget["stream_url"] = url
            result["cards"].append(widget)
        clean["sections"].append(result)
    return clean


class DashboardServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, store):
        self.store = store
        self.cache_lock = threading.Lock()
        self.cache = None
        self.attempt_lock = threading.Lock()
        self.attempts = {}
        super().__init__(address, Handler)

    def states(self, credentials):
        signature = hashlib.sha256((credentials["url"] + credentials["token"]).encode()).hexdigest()
        with self.cache_lock:
            if self.cache and self.cache[0] == signature and time.monotonic() - self.cache[1] < 4:
                return self.cache[2]
            states = read_states(credentials)
            self.cache = signature, time.monotonic(), states
            return states

    def clear_cache(self):
        with self.cache_lock:
            self.cache = None

    def limit_attempts(self, ip):
        now = time.monotonic()
        with self.attempt_lock:
            self.attempts = {key: value for key, value in self.attempts.items() if now - value[0] < 60}
            start, count = self.attempts.get(ip, (now, 0))
            if count >= 8 or len(self.attempts) > 4096:
                raise Problem(429, "Too many login attempts. Wait one minute and try again.")
            self.attempts[ip] = start, count + 1


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC), **kwargs)

    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' http: https:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
        super().end_headers()

    def reply(self, status, data, cookie=None):
        raw = json.dumps(data, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(raw)

    def cookie(self, value, expire=False):
        secure = "; Secure" if os.environ.get("ANCIENT_COOKIE_SECURE") == "1" or self.headers.get("Origin", "").startswith("https:") else ""
        return "ancient_session=%s; Path=/; HttpOnly; SameSite=Strict; Max-Age=%s%s" % (value, 0 if expire else SESSION_AGE, secure)

    def session_token(self):
        try:
            cookie = SimpleCookie(self.headers.get("Cookie", ""))
            return cookie["ancient_session"].value if "ancient_session" in cookie else ""
        except (CookieError, ValueError):
            return ""

    def authenticated(self):
        return self.server.store.authenticated(self.session_token())

    def require_auth(self):
        if not self.authenticated():
            raise Problem(401, "Sign in to the dashboard first.")
        return self.server.store.settings()

    def read_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        if not 0 < length <= 262144:
            raise Problem(413, "Request body must be between 1 byte and 256 KB.")
        try:
            data = json.loads(self.rfile.read(length))
        except (ValueError, UnicodeDecodeError):
            raise ValueError("Invalid JSON request.")
        if not isinstance(data, dict):
            raise ValueError("Expected a JSON object.")
        return data

    def failure(self, error):
        if isinstance(error, Problem):
            status, message = error.status, error.message
        elif isinstance(error, HTTPError):
            status = 502
            message = "Home Assistant rejected the access token. Update the connection in Settings." if error.code in (401, 403) else "Home Assistant returned HTTP %s." % error.code
            error.close()
        elif isinstance(error, (URLError, TimeoutError, http.client.HTTPException)):
            status, message = 502, "Cannot reach Home Assistant. Check its address, network, and certificate."
        elif isinstance(error, (sqlite3.Error, OSError)):
            status, message = 500, "The dashboard could not access its data. Check the data volume permissions."
        elif isinstance(error, ValueError):
            status, message = 400, str(error)
        else:
            status, message = 500, "The dashboard could not complete this request."
        self.reply(status, {"error": message})

    def configured_entities(self):
        return {card["entity"] for section in self.server.store.config()["sections"] for card in section["cards"]}

    def do_GET(self):
        path = urlsplit(self.path).path
        started = False
        try:
            if not path.startswith("/api/"):
                target = (STATIC / unquote(path).lstrip("/")).resolve()
                if not target.is_relative_to(STATIC.resolve()):
                    raise Problem(404, "Not found.")
                return super().do_GET()
            if path == "/api/status":
                return self.reply(200, {"configured": bool(self.server.store.settings()), "authenticated": self.authenticated()})
            credentials = self.require_auth()
            if path == "/api/config":
                return self.reply(200, self.server.store.config())
            if path == "/api/connection":
                return self.reply(200, {"url": credentials["url"]})
            if path in ("/api/states", "/api/entities"):
                states = self.server.states(credentials)
                if path == "/api/states":
                    selected = self.configured_entities()
                    return self.reply(200, [dict(s, widget_types=compatible_types(s)) for s in states if s["entity_id"] in selected])
                params = parse_qs(urlsplit(self.path).query)
                query, kind = params.get("q", [""])[0][:200].casefold(), params.get("type", [""])[0]
                offset = max(0, min(100000, int(params.get("offset", [0])[0])))
                limit = max(1, min(100, int(params.get("limit", [50])[0])))
                matches = []
                for state in states:
                    types = compatible_types(state)
                    if kind and kind not in types:
                        continue
                    if query and query not in (state["entity_id"] + " " + str(state["attributes"].get("friendly_name", ""))).casefold():
                        continue
                    matches.append(dict(state, widget_types=types))
                matches.sort(key=lambda s: str(s["attributes"].get("friendly_name", s["entity_id"])).casefold())
                return self.reply(200, {"total": len(matches), "offset": offset, "items": matches[offset:offset + limit]})
            if path.startswith("/api/camera/"):
                parts = path.split("/")
                entity = parts[3]
                stream = len(parts) == 5 and parts[4] == "stream"
                if not ENTITY.fullmatch(entity) or not entity.startswith("camera.") or len(parts) > 5 or (len(parts) == 5 and not stream):
                    raise ValueError("Invalid camera route.")
                if entity not in self.configured_entities():
                    raise Problem(403, "This camera has not been added to the dashboard.")
                route = "/api/camera_proxy_stream/" if stream else "/api/camera_proxy/"
                with upstream(credentials, route + entity, timeout=20) as response:
                    content_type = response.headers.get("Content-Type", "image/jpeg")
                    if not (content_type.startswith("image/") or content_type.startswith("multipart/")):
                        raise Problem(502, "Camera did not return an image or MJPEG stream.")
                    raw = None if stream else response.read(12 * 1024 * 1024 + 1)
                    if raw and len(raw) > 12 * 1024 * 1024:
                        raise Problem(502, "Camera image exceeds 12 MB.")
                    self.send_response(200)
                    self.send_header("Content-Type", content_type)
                    if stream:
                        self.send_header("Connection", "close")
                        self.close_connection = True
                    else:
                        self.send_header("Content-Length", str(len(raw)))
                    self.end_headers()
                    started = True
                    if stream:
                        while True:
                            chunk = response.read1(16384)
                            if not chunk:
                                break
                            self.wfile.write(chunk)
                            self.wfile.flush()
                    else:
                        self.wfile.write(raw)
                return
            raise Problem(404, "Not found.")
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as error:
            if not started:
                self.failure(error)

    def do_POST(self):
        try:
            origin = self.headers.get("Origin")
            if self.headers.get("X-Ancient-Request") != "1" or (origin and urlsplit(origin).netloc != self.headers.get("Host")):
                raise Problem(403, "Same-origin request required.")
            data, path = self.read_body(), urlsplit(self.path).path
            if path == "/api/setup":
                if self.server.store.settings():
                    raise Problem(409, "This dashboard is already configured. Sign in instead.")
                self.server.limit_attempts(self.client_address[0])
                url, token = validate_url(data.get("url")), validate_token(data.get("token"))
                password_hash(data.get("password"))  # Validate before contacting Home Assistant.
                credentials = {"url": url, "token": token}
                read_states(credentials)  # Verify the token can discover entities before persisting it.
                if not self.server.store.setup(url, token, data["password"]):
                    raise Problem(409, "Setup was completed by another device. Sign in instead.")
                return self.reply(200, {"ok": True}, self.cookie(self.server.store.create_session()))
            if path == "/api/login":
                self.server.limit_attempts(self.client_address[0])
                credentials = self.server.store.settings()
                if not credentials:
                    raise Problem(409, "Complete first-run setup first.")
                if not password_matches(data.get("password"), credentials["password_hash"]):
                    raise Problem(401, "Incorrect dashboard password.")
                with self.server.attempt_lock:
                    self.server.attempts.pop(self.client_address[0], None)
                return self.reply(200, {"ok": True}, self.cookie(self.server.store.create_session()))
            if path == "/api/logout":
                self.server.store.logout(self.session_token())
                return self.reply(200, {"ok": True}, self.cookie("", expire=True))
            credentials = self.require_auth()
            if path == "/api/password":
                self.server.limit_attempts(self.client_address[0])
                if not password_matches(data.get("current_password"), credentials["password_hash"]):
                    raise Problem(401, "Incorrect current dashboard password.")
                self.server.store.change_password(data.get("password"))
                return self.reply(200, {"ok": True}, self.cookie(self.server.store.create_session()))
            if path == "/api/connection":
                url = validate_url(data.get("url"))
                token = data.get("token") or (credentials["token"] if url == credentials["url"] else "")
                token = validate_token(token)
                read_states({"url": url, "token": token})
                self.server.store.update_connection(url, token)
                self.server.clear_cache()
                return self.reply(200, {"ok": True})
            if path == "/api/config":
                # Type restrictions apply on the server, including forged requests.
                states = {s["entity_id"]: s for s in self.server.states(credentials)}
                config = validate_config(data, states)
                revision = data.get("revision")
                if type(revision) is not int or not self.server.store.save_config(config, revision):
                    raise Problem(409, "The dashboard changed on another device. Reload before editing again.")
                return self.reply(200, self.server.store.config())
            if path == "/api/service":
                domain, service, entity = data.get("domain"), data.get("service"), data.get("entity_id", "")
                if not isinstance(entity, str) or not ENTITY.fullmatch(entity) or domain not in SERVICES or service not in SERVICES[domain] or entity.split(".")[0] != domain:
                    raise ValueError("Unsupported service or entity.")
                if entity not in self.configured_entities():
                    raise Problem(403, "This entity has not been added to the dashboard.")
                payload = {"entity_id": entity}
                states = {s["entity_id"]: s for s in self.server.states(credentials)}
                state = states.get(entity)
                if not state or state["state"] in ("unknown", "unavailable"):
                    raise Problem(409, "This entity is unavailable.")
                attrs = state["attributes"]
                if "brightness_pct" in data:
                    value = number(data["brightness_pct"], "Brightness")
                    if domain != "light" or service != "turn_on" or not 0 <= value <= 100:
                        raise ValueError("Brightness must be 0 to 100 for a light turn-on action.")
                    payload["brightness_pct"] = round(value)
                if "percentage" in data:
                    value = number(data["percentage"], "Fan speed")
                    if domain != "fan" or service != "set_percentage" or not 0 <= value <= 100:
                        raise ValueError("Fan speed must be between 0 and 100.")
                    payload["percentage"] = round(value)
                if service == "set_temperature":
                    value = number(data.get("temperature"), "Temperature")
                    if not attrs.get("min_temp", 5) <= value <= attrs.get("max_temp", 95):
                        raise ValueError("Temperature is outside this thermostat's range.")
                    payload["temperature"] = value
                if service == "set_hvac_mode":
                    if data.get("hvac_mode") not in attrs.get("hvac_modes", []):
                        raise ValueError("This thermostat does not support that mode.")
                    payload["hvac_mode"] = data["hvac_mode"]
                with upstream(credentials, "/api/services/%s/%s" % (domain, service), payload) as response:
                    response.read()
                self.server.clear_cache()
                return self.reply(200, {"ok": True})
            raise Problem(404, "Not found.")
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as error:
            self.failure(error)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8095)
    parser.add_argument("--data-dir", default=os.environ.get("ANCIENT_DATA_DIR", str(Path(__file__).parent / "data")))
    parser.add_argument("--reset-password", action="store_true", help="Reset the dashboard password interactively, keeping connection and layout")
    args = parser.parse_args()
    store = Store(args.data_dir)
    if args.reset_password:
        if not store.settings():
            parser.error("The dashboard has not been configured.")
        password = getpass.getpass("New dashboard password: ")
        if password != getpass.getpass("Confirm password: "):
            parser.error("Passwords do not match.")
        store.change_password(password)
        print("Dashboard password updated; existing sessions revoked.")
    else:
        server = DashboardServer((args.host, args.port), store)
        print("Ancient Home Assistant: http://%s:%s" % (args.host, args.port), flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()
