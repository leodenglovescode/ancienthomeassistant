import copy
import http.client
import json
import sqlite3
import stat
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
import server
from storage import Store, SESSION_AGE, password_matches

PASSWORD = 'test-dashboard-password'
TOKEN = 'fake-test-token'


def fixture_states():
    items = [
        ('light.test', 'on', {'friendly_name': 'Desk light', 'brightness': 128}),
        ('light.other', 'off', {'friendly_name': 'Other light'}),
        ('switch.test', 'off', {'friendly_name': 'Outlet'}),
        ('input_boolean.test', 'off', {}),
        ('camera.test', 'idle', {'friendly_name': 'Hall camera', 'access_token': 'must-not-leak', 'entity_picture': '/secret-url'}),
        ('sensor.temp', '23.5', {'friendly_name': 'Room temperature', 'unit_of_measurement': '°C'}),
        ('sensor.humidity', '46', {'unit_of_measurement': '%'}),
        ('sensor.text', 'comfortable', {'friendly_name': 'Room description'}),
        ('binary_sensor.door', 'off', {'device_class': 'door'}),
        ('climate.test', 'cool', {'temperature': 23, 'current_temperature': 24, 'min_temp': 16, 'max_temp': 30, 'target_temp_step': 0.5, 'hvac_modes': ['off', 'heat', 'cool']}),
        ('weather.test', 'sunny', {'temperature': 24, 'humidity': 48, 'temperature_unit': '°C'}),
        ('scene.test', '2026-01-01T00:00:00Z', {}),
        ('button.test', '2026-01-01T00:00:00Z', {}),
        ('script.test', 'off', {}),
        ('fan.test', 'on', {'percentage': 40}),
        ('cover.test', 'closed', {'current_position': 0}),
    ]
    return [{'entity_id': entity, 'state': value, 'attributes': attrs} for entity, value, attrs in items]


class FakeHA(BaseHTTPRequestHandler):
    calls = []
    failure = False
    redirect = False
    sink_calls = 0
    states = fixture_states()

    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == '/credential-sink':
            type(self).sink_calls += 1
        if self.redirect and self.path == '/api/states':
            self.send_response(302)
            self.send_header('Location', 'http://127.0.0.1:%d/credential-sink' % self.server.server_port)
            self.end_headers()
            return
        if self.headers.get('Authorization') != 'Bearer ' + TOKEN:
            self.send_response(401)
            self.end_headers()
            return
        if self.failure:
            self.send_response(503)
            self.end_headers()
            return
        if self.path == '/api/states':
            raw, kind = json.dumps(self.states).encode(), 'application/json'
        elif self.path == '/api/camera_proxy/camera.test':
            raw, kind = (server.STATIC / 'assets/touch-icon.png').read_bytes(), 'image/png'
        elif self.path == '/api/camera_proxy_stream/camera.test':
            raw, kind = b'--frame\r\nContent-Type: image/jpeg\r\n\r\nfake-jpeg\r\n--frame--\r\n', 'multipart/x-mixed-replace; boundary=frame'
        else:
            self.send_response(404)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_POST(self):
        if self.headers.get('Authorization') != 'Bearer ' + TOKEN:
            self.send_response(401)
            self.end_headers()
            return
        data = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        self.calls.append((self.path, data))
        service = self.path.split('/')[-1]
        for item in self.states:
            if item['entity_id'] == data['entity_id']:
                if service in ('turn_on', 'turn_off'):
                    item['state'] = 'on' if service == 'turn_on' else 'off'
                if 'brightness_pct' in data:
                    item['attributes']['brightness'] = round(data['brightness_pct'] * 255 / 100)
                if 'temperature' in data:
                    item['attributes']['temperature'] = data['temperature']
                if 'percentage' in data:
                    item['attributes']['percentage'] = data['percentage']
                if 'hvac_mode' in data:
                    item['state'] = data['hvac_mode']
        raw = b'[]'
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


class BridgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ha = ThreadingHTTPServer(('127.0.0.1', 0), FakeHA)
        cls.ha_url = 'http://127.0.0.1:%d' % cls.ha.server_port
        cls.ha_thread = threading.Thread(target=cls.ha.serve_forever, daemon=True)
        cls.ha_thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.ha.shutdown()
        cls.ha.server_close()
        cls.ha_thread.join()

    def setUp(self):
        self.cookie = ''
        FakeHA.calls, FakeHA.states = [], fixture_states()
        FakeHA.failure = FakeHA.redirect = False
        FakeHA.sink_calls = 0
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(self.temp.name)
        self.start_bridge()

    def start_bridge(self):
        self.bridge = server.DashboardServer(('127.0.0.1', 0), self.store)
        self.thread = threading.Thread(target=self.bridge.serve_forever, daemon=True)
        self.thread.start()

    def stop_bridge(self):
        self.bridge.shutdown()
        self.bridge.server_close()
        self.thread.join()

    def tearDown(self):
        self.stop_bridge()
        self.temp.cleanup()

    def call(self, method, path, data=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.bridge.server_port, timeout=8)
        all_headers = {'X-Ancient-Request': '1', 'Content-Type': 'application/json'}
        if self.cookie:
            all_headers['Cookie'] = self.cookie
        if headers:
            all_headers.update(headers)
        connection.request(method, path, body=json.dumps(data) if data is not None else None, headers=all_headers)
        response = connection.getresponse()
        status, response_headers, raw = response.status, dict(response.getheaders()), response.read()
        connection.close()
        return status, response_headers, raw

    def setup_dashboard(self):
        status, headers, raw = self.call('POST', '/api/setup', {'url': self.ha_url, 'token': TOKEN, 'password': PASSWORD})
        self.assertEqual(status, 200, raw)
        self.cookie = headers['Set-Cookie'].split(';')[0]
        return headers, raw

    def config(self):
        status, _, raw = self.call('GET', '/api/config')
        self.assertEqual(status, 200, raw)
        return json.loads(raw)

    def save_widgets(self):
        config = self.config()
        config.update(title='Test home', columns=3, onboarding_complete=True)
        kinds = {'sensor.temp': 'gauge', 'camera.test': 'camera', 'climate.test': 'climate', 'weather.test': 'weather', 'scene.test': 'scene', 'button.test': 'button', 'script.test': 'button', 'fan.test': 'fan', 'cover.test': 'cover', 'input_boolean.test': 'switch'}
        config['sections'] = [{'id': 'home', 'title': 'Home', 'cards': [dict(id='card-%d' % i, entity=s['entity_id'], type=kinds.get(s['entity_id'], 'light' if s['entity_id'].startswith('light.') else 'switch' if s['entity_id'].startswith('switch.') else 'sensor'), title=s['attributes'].get('friendly_name', s['entity_id']), span=1, min=0, max=100) for i, s in enumerate(FakeHA.states) if s['entity_id'] != 'light.other']}]
        status, _, raw = self.call('POST', '/api/config', config)
        self.assertEqual(status, 200, raw)
        return json.loads(raw)

    def test_fresh_install_requires_onboarding_not_demo(self):
        self.assertEqual(json.loads(self.call('GET', '/api/status')[2]), {'configured': False, 'authenticated': False})
        html = self.call('GET', '/')[2]
        self.assertNotIn(b'Demo', html)
        self.assertNotIn(b'Sample data', html)
        for path in ('/api/states', '/api/config', '/api/entities', '/api/connection', '/api/camera/camera.test'):
            self.assertEqual(self.call('GET', path)[0], 401, path)
        for path in ('/', '/app.js', '/style.css', '/assets/camera-placeholder.svg', '/assets/touch-icon.png'):
            self.assertEqual(self.call('GET', path)[0], 200, path)
        self.assertEqual(self.call('GET', '/assets/front-door.svg')[0], 404)
        for path in ('/../server.py', '/%2e%2e/storage.py', '/../data/dashboard.sqlite3'):
            self.assertEqual(self.call('GET', path)[0], 404)

    def test_setup_private_storage_and_no_credential_exposure(self):
        headers, raw = self.setup_dashboard()
        self.assertIn('HttpOnly', headers['Set-Cookie'])
        self.assertIn('SameSite=Strict', headers['Set-Cookie'])
        settings = self.store.settings()
        self.assertNotEqual(settings['password_hash'], PASSWORD)
        self.assertTrue(password_matches(PASSWORD, settings['password_hash']))
        self.assertEqual(settings['token'], TOKEN)
        self.assertEqual(stat.S_IMODE(self.store.path.stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(self.store.directory.stat().st_mode), 0o700)
        for path in ('/api/status', '/api/config', '/api/connection', '/api/entities', '/api/states'):
            raw = self.call('GET', path)[2]
            self.assertNotIn(TOKEN.encode(), raw)
            self.assertNotIn(PASSWORD.encode(), raw)
            self.assertNotIn(b'must-not-leak', raw)
            self.assertNotIn(b'entity_picture', raw)
        self.assertEqual(json.loads(self.call('GET', '/api/states')[2]), [])
        with self.store.db() as db:
            digest = db.execute('SELECT digest FROM sessions').fetchone()[0]
        self.assertNotEqual(digest, self.cookie.split('=')[1])

    def test_setup_is_one_time_and_failure_does_not_save_credentials(self):
        status, _, _ = self.call('POST', '/api/setup', {'url': self.ha_url, 'token': 'wrong-token', 'password': PASSWORD})
        self.assertEqual(status, 502)
        self.assertIsNone(self.store.settings())
        self.setup_dashboard()
        self.assertEqual(self.call('POST', '/api/setup', {'url': self.ha_url, 'token': TOKEN, 'password': PASSWORD})[0], 409)

    def test_settings_layout_and_session_survive_restart(self):
        self.setup_dashboard()
        expected = self.save_widgets()
        self.stop_bridge()
        self.store = Store(self.temp.name)
        self.start_bridge()
        self.assertTrue(json.loads(self.call('GET', '/api/status')[2])['authenticated'])
        self.assertEqual(self.config(), expected)
        self.assertEqual(self.call('GET', '/api/states')[0], 200)

    def test_login_logout_and_expired_session(self):
        self.setup_dashboard()
        self.assertEqual(self.call('POST', '/api/logout', {})[0], 200)
        self.assertEqual(self.call('GET', '/api/config')[0], 401)
        self.assertEqual(self.call('POST', '/api/login', {'password': 'wrong'})[0], 401)
        status, headers, _ = self.call('POST', '/api/login', {'password': PASSWORD})
        self.assertEqual(status, 200)
        self.cookie = headers['Set-Cookie'].split(';')[0]
        with patch('storage.time.time', return_value=time.time() + SESSION_AGE + 1):
            self.assertEqual(self.call('GET', '/api/config')[0], 401)
        self.cookie = ''
        status = json.loads(self.call('GET', '/api/status')[2])
        self.assertTrue(status['configured'])
        self.assertFalse(status['authenticated'])

    def test_password_change_revokes_other_sessions_without_losing_config(self):
        self.setup_dashboard()
        expected = self.save_widgets()
        old_cookie = self.cookie
        self.assertEqual(self.call('POST', '/api/password', {'current_password': 'wrong', 'password': 'another-test-password'})[0], 401)
        status, headers, _ = self.call('POST', '/api/password', {'current_password': PASSWORD, 'password': 'another-test-password'})
        self.assertEqual(status, 200)
        self.assertEqual(self.call('GET', '/api/config')[0], 401)
        self.cookie = headers['Set-Cookie'].split(';')[0]
        self.assertEqual(self.config(), expected)
        self.assertFalse(self.store.authenticated(old_cookie.split('=')[1]))

    def test_login_rate_limit(self):
        self.setup_dashboard()
        self.bridge.attempts.clear()
        for _ in range(8):
            self.assertEqual(self.call('POST', '/api/login', {'password': 'wrong'})[0], 401)
        self.assertEqual(self.call('POST', '/api/login', {'password': PASSWORD})[0], 429)
        with patch('server.time.monotonic', return_value=time.monotonic() + 61):
            self.assertEqual(self.call('POST', '/api/login', {'password': PASSWORD})[0], 200)

    def test_entity_search_pagination_and_type_filtering(self):
        self.setup_dashboard()
        result = json.loads(self.call('GET', '/api/entities?q=desk&type=light&limit=1')[2])
        self.assertEqual(result['total'], 1)
        self.assertEqual(result['items'][0]['entity_id'], 'light.test')
        self.assertEqual(json.loads(self.call('GET', '/api/entities?type=camera')[2])['items'][0]['widget_types'], ['camera'])
        self.assertEqual(json.loads(self.call('GET', '/api/entities?q=camera&type=light')[2])['total'], 0)
        gauge_ids = [s['entity_id'] for s in json.loads(self.call('GET', '/api/entities?type=gauge')[2])['items']]
        self.assertIn('sensor.temp', gauge_ids)
        self.assertNotIn('sensor.text', gauge_ids)
        self.assertEqual(len(json.loads(self.call('GET', '/api/entities?limit=2&offset=2')[2])['items']), 2)

    def test_widget_types_rejected_server_side(self):
        self.setup_dashboard()
        config = self.config()
        for entity, kind in [('camera.test', 'light'), ('light.test', 'camera'), ('switch.test', 'light'), ('sensor.text', 'gauge'), ('camera.test', 'sensor'), ('climate.test', 'switch')]:
            config['sections'] = [{'id': 's', 'title': 'Home', 'cards': [{'id': 'c', 'title': 'Invalid', 'entity': entity, 'type': kind, 'span': 1}]}]
            self.assertEqual(self.call('POST', '/api/config', config)[0], 400, (entity, kind))
        self.assertEqual(self.config()['sections'], [])

    def test_customize_add_remove_reorder_and_revision_conflicts(self):
        self.setup_dashboard()
        config = self.save_widgets()
        stale = copy.deepcopy(config)
        config['title'], config['columns'] = 'Customized home', 2
        cards = config['sections'][0]['cards']
        cards.reverse()
        cards[0]['title'], cards[0]['span'] = 'Wide widget', 2
        removed = cards.pop()['id']
        config['sections'].append({'id': 'second', 'title': 'Upstairs', 'cards': [cards.pop(0)]})
        status, _, raw = self.call('POST', '/api/config', config)
        self.assertEqual(status, 200, raw)
        saved = json.loads(raw)
        self.assertEqual(saved['title'], 'Customized home')
        self.assertEqual(saved['sections'][1]['cards'][0]['title'], 'Wide widget')
        self.assertNotIn(removed, [c['id'] for s in saved['sections'] for c in s['cards']])
        self.assertEqual(self.call('POST', '/api/config', stale)[0], 409)
        self.assertEqual(self.config(), saved)

    def test_invalid_gauges_spans_and_duplicate_ids(self):
        self.setup_dashboard()
        config = self.config()
        card = {'id': 'g', 'entity': 'sensor.temp', 'type': 'gauge', 'title': 'Temp', 'span': 1, 'min': 0, 'max': 40}
        config['sections'] = [{'id': 's', 'title': 'Room', 'cards': [card]}]
        for field, value in [('max', -1), ('min', float('nan')), ('span', 9), ('title', '')]:
            candidate = copy.deepcopy(config)
            candidate['sections'][0]['cards'][0][field] = value
            self.assertEqual(self.call('POST', '/api/config', candidate)[0], 400)
        config['sections'][0]['cards'].append(copy.deepcopy(card))
        self.assertEqual(self.call('POST', '/api/config', config)[0], 400)

    def test_live_services_and_filtered_states(self):
        self.setup_dashboard()
        self.save_widgets()
        actions = [
            {'domain': 'light', 'service': 'turn_on', 'entity_id': 'light.test', 'brightness_pct': 42},
            {'domain': 'switch', 'service': 'turn_on', 'entity_id': 'switch.test'},
            {'domain': 'input_boolean', 'service': 'turn_on', 'entity_id': 'input_boolean.test'},
            {'domain': 'scene', 'service': 'turn_on', 'entity_id': 'scene.test'},
            {'domain': 'button', 'service': 'press', 'entity_id': 'button.test'},
            {'domain': 'script', 'service': 'turn_on', 'entity_id': 'script.test'},
            {'domain': 'fan', 'service': 'set_percentage', 'entity_id': 'fan.test', 'percentage': 60},
            {'domain': 'cover', 'service': 'open_cover', 'entity_id': 'cover.test'},
            {'domain': 'climate', 'service': 'set_temperature', 'entity_id': 'climate.test', 'temperature': 23.5},
            {'domain': 'climate', 'service': 'set_hvac_mode', 'entity_id': 'climate.test', 'hvac_mode': 'heat'},
        ]
        for action in actions:
            status, _, raw = self.call('POST', '/api/service', action)
            self.assertEqual(status, 200, raw)
        self.assertEqual(FakeHA.calls[0][1]['brightness_pct'], 42)
        states = json.loads(self.call('GET', '/api/states')[2])
        self.assertNotIn('light.other', [s['entity_id'] for s in states])
        self.assertEqual(next(s for s in states if s['entity_id'] == 'climate.test')['state'], 'heat')

    def test_unsupported_unselected_and_invalid_services(self):
        self.setup_dashboard()
        self.save_widgets()
        self.assertEqual(self.call('POST', '/api/service', {'domain': 'light', 'service': 'turn_on', 'entity_id': 'light.other'})[0], 403)
        for action in [
            {'domain': 'homeassistant', 'service': 'restart', 'entity_id': 'light.test'},
            {'domain': 'light', 'service': 'turn_off', 'entity_id': 'switch.test'},
            {'domain': 'light', 'service': 'turn_on', 'entity_id': 'light.test', 'brightness_pct': 101},
            {'domain': 'climate', 'service': 'set_temperature', 'entity_id': 'climate.test', 'temperature': 99},
            {'domain': 'climate', 'service': 'set_hvac_mode', 'entity_id': 'climate.test', 'hvac_mode': 'auto'},
        ]:
            self.assertEqual(self.call('POST', '/api/service', action)[0], 400, action)
        self.assertEqual(FakeHA.calls, [])

    def test_camera_snapshot_mjpeg_and_configuration_access(self):
        self.setup_dashboard()
        self.assertEqual(self.call('GET', '/api/camera/camera.test')[0], 403)
        self.save_widgets()
        status, headers, raw = self.call('GET', '/api/camera/camera.test')
        self.assertEqual(status, 200)
        self.assertEqual(headers['Content-Type'], 'image/png')
        self.assertTrue(raw.startswith(b'\x89PNG'))
        status, headers, raw = self.call('GET', '/api/camera/camera.test/stream')
        self.assertEqual(status, 200)
        self.assertIn('multipart/', headers['Content-Type'])
        self.assertIn(b'fake-jpeg', raw)
        self.assertEqual(self.call('GET', '/api/camera/light.test')[0], 400)

    def test_connection_update_retains_token_but_never_returns_it(self):
        self.setup_dashboard()
        self.assertEqual(self.call('POST', '/api/connection', {'url': self.ha_url, 'token': ''})[0], 200)
        self.assertEqual(json.loads(self.call('GET', '/api/connection')[2]), {'url': self.ha_url})
        self.assertEqual(self.call('POST', '/api/connection', {'url': self.ha_url, 'token': 'wrong'})[0], 502)
        self.assertEqual(self.store.settings()['token'], TOKEN)

    def test_csrf_url_and_token_validation(self):
        body = {'url': self.ha_url, 'token': TOKEN, 'password': PASSWORD}
        self.assertEqual(self.call('POST', '/api/setup', body, {'Origin': 'https://other.test'})[0], 403)
        self.assertEqual(self.call('POST', '/api/setup', body, {'X-Ancient-Request': ''})[0], 403)
        for value in ('file:///etc/passwd', 'http://user:password@localhost:8123', self.ha_url + '/api/', self.ha_url + '?token=bad'):
            self.assertEqual(self.call('POST', '/api/setup', dict(body, url=value))[0], 400)
        for value in ('short', '', 'x' * 257):
            self.assertEqual(self.call('POST', '/api/setup', dict(body, password=value))[0], 400)
        status, _, raw = self.call('POST', '/api/setup', dict(body, token='secret\nvalue'))
        self.assertEqual(status, 400)
        self.assertNotIn(b'secret', raw)

    def test_redirect_does_not_forward_bearer_credentials(self):
        FakeHA.redirect = True
        status, _, _ = self.call('POST', '/api/setup', {'url': self.ha_url, 'token': TOKEN, 'password': PASSWORD})
        self.assertEqual(status, 502)
        self.assertEqual(FakeHA.sink_calls, 0)
        self.assertIsNone(self.store.settings())

    def test_upstream_outage_does_not_create_sample_states(self):
        self.setup_dashboard()
        self.save_widgets()
        FakeHA.failure = True
        self.bridge.clear_cache()
        status, _, raw = self.call('GET', '/api/states')
        self.assertEqual(status, 502)
        self.assertIn(b'503', raw)
        self.assertNotIn(b'Demo', raw)


if __name__ == '__main__':
    unittest.main()
