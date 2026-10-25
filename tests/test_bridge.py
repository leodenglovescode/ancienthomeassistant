import http.client
import json
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch
import server


class FakeHA(BaseHTTPRequestHandler):
    calls = []
    failure = False
    redirect = False
    sink_calls = 0

    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == '/credential-sink':
            type(self).sink_calls += 1
        if self.redirect and self.path == '/api/':
            self.send_response(302)
            self.send_header('Location', 'http://127.0.0.1:%d/credential-sink' % self.server.server_port)
            self.end_headers()
            return
        if self.headers.get('Authorization') != 'Bearer fake-test-token':
            self.send_response(401)
            self.end_headers()
            return
        if self.failure:
            self.send_response(503)
            self.end_headers()
            return
        if self.path == '/api/':
            raw, kind = b'{"message":"API running."}', 'application/json'
        elif self.path == '/api/states':
            raw = json.dumps([
                {'entity_id': 'light.test', 'state': 'on', 'attributes': {'brightness': 128, 'friendly_name': 'Test light'}},
                {'entity_id': 'camera.test', 'state': 'idle', 'attributes': {'access_token': 'must-not-leak', 'entity_picture': '/secret-url'}},
                {'entity_id': 'sensor.temp', 'state': '23.5', 'attributes': {'unit_of_measurement': '°C'}}
            ]).encode()
            kind = 'application/json'
        elif self.path == '/api/camera_proxy/camera.test':
            raw, kind = b'fake-jpeg-data', 'image/jpeg'
        elif self.path == '/api/camera_proxy_stream/camera.test':
            raw, kind = b'--frame\r\nContent-Type: image/jpeg\r\n\r\nfake-jpeg-data\r\n--frame--\r\n', 'multipart/x-mixed-replace; boundary=frame'
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
        if self.headers.get('Authorization') != 'Bearer fake-test-token':
            self.send_response(401)
            self.end_headers()
            return
        data = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        self.calls.append((self.path, data))
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
        cls.bridge = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.ha_url = 'http://127.0.0.1:%d' % cls.ha.server_port
        cls.threads = []
        for instance in (cls.ha, cls.bridge):
            thread = threading.Thread(target=instance.serve_forever, daemon=True)
            thread.start()
            cls.threads.append(thread)

    @classmethod
    def tearDownClass(cls):
        for instance in (cls.ha, cls.bridge):
            instance.shutdown()
            instance.server_close()
        for thread in cls.threads:
            thread.join()

    def setUp(self):
        self.cookie = ''
        FakeHA.calls = []
        FakeHA.failure = False
        FakeHA.redirect = False
        FakeHA.sink_calls = 0
        with server.LOCK:
            server.SESSIONS.clear()

    def call(self, method, path, data=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.bridge.server_port, timeout=5)
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

    def connect(self):
        status, headers, raw = self.call('POST', '/api/connect', {'url': self.ha_url, 'token': 'fake-test-token'})
        self.assertEqual(status, 200, raw)
        self.cookie = headers['Set-Cookie'].split(';')[0]
        return headers, raw

    def test_demo_and_static_assets(self):
        status, _, raw = self.call('GET', '/api/status')
        self.assertEqual(status, 200)
        self.assertFalse(json.loads(raw)['connected'])
        for path in ('/', '/app.js', '/style.css', '/assets/front-door.svg', '/assets/living-room.svg', '/assets/touch-icon.png'):
            status, _, _ = self.call('GET', path)
            self.assertEqual(status, 200, path)
        self.assertEqual(self.call('GET', '/../server.py')[0], 404)
        self.assertEqual(self.call('GET', '/%2e%2e/server.py')[0], 404)

    def test_authentication_and_state_filtering(self):
        self.assertEqual(self.call('GET', '/api/states')[0], 401)
        headers, raw = self.connect()
        self.assertIn('HttpOnly', headers['Set-Cookie'])
        self.assertIn('SameSite=Strict', headers['Set-Cookie'])
        self.assertNotIn(b'fake-test-token', raw)
        status, _, raw = self.call('GET', '/api/states')
        self.assertEqual(status, 200)
        self.assertNotIn(b'must-not-leak', raw)
        self.assertNotIn(b'entity_picture', raw)
        self.assertEqual(json.loads(raw)[0]['attributes']['brightness'], 128)

    def test_services(self):
        self.connect()
        actions = [
            {'domain': 'light', 'service': 'turn_on', 'entity_id': 'light.test', 'brightness_pct': 42},
            {'domain': 'light', 'service': 'turn_off', 'entity_id': 'light.test'},
            {'domain': 'switch', 'service': 'turn_on', 'entity_id': 'switch.test'},
            {'domain': 'scene', 'service': 'turn_on', 'entity_id': 'scene.test'},
            {'domain': 'climate', 'service': 'set_temperature', 'entity_id': 'climate.test', 'temperature': 23},
            {'domain': 'climate', 'service': 'set_hvac_mode', 'entity_id': 'climate.test', 'hvac_mode': 'cool'}
        ]
        for action in actions:
            self.assertEqual(self.call('POST', '/api/service', action)[0], 200)
        self.assertEqual(FakeHA.calls[0], ('/api/services/light/turn_on', {'entity_id': 'light.test', 'brightness_pct': 42}))
        self.assertEqual(len(FakeHA.calls), len(actions))

    def test_rejects_unsafe_service_calls(self):
        self.connect()
        actions = [
            {'domain': 'homeassistant', 'service': 'restart', 'entity_id': 'light.test'},
            {'domain': 'light', 'service': 'turn_off', 'entity_id': 'switch.test'},
            {'domain': 'light', 'service': 'turn_on', 'entity_id': 'light.test', 'brightness_pct': 101},
            {'domain': 'light', 'service': 'turn_on', 'entity_id': 'light.test/../../config'},
            {'domain': 'climate', 'service': 'set_temperature', 'entity_id': 'climate.test', 'temperature': 'NaN'},
            {'domain': 'climate', 'service': 'set_hvac_mode', 'entity_id': 'climate.test', 'hvac_mode': 'nonsense'}
        ]
        for action in actions:
            self.assertEqual(self.call('POST', '/api/service', action)[0], 400, action)
        self.assertEqual(FakeHA.calls, [])

    def test_camera_snapshot_and_mjpeg(self):
        self.connect()
        status, headers, raw = self.call('GET', '/api/camera/camera.test')
        self.assertEqual(status, 200)
        self.assertEqual(headers['Content-Type'], 'image/jpeg')
        self.assertEqual(raw, b'fake-jpeg-data')
        status, headers, raw = self.call('GET', '/api/camera/camera.test/stream')
        self.assertEqual(status, 200)
        self.assertIn('multipart/', headers['Content-Type'])
        self.assertIn(b'fake-jpeg-data', raw)
        for path in ('/api/camera/light.test', '/api/camera/camera.test/nonsense', '/api/camera/camera.test/stream/other'):
            self.assertEqual(self.call('GET', path)[0], 400)

    def test_wrong_token_and_upstream_failure(self):
        self.assertEqual(self.call('POST', '/api/connect', {'url': self.ha_url, 'token': 'wrong'})[0], 401)
        self.connect()
        FakeHA.failure = True
        status, _, raw = self.call('GET', '/api/states')
        self.assertEqual(status, 502)
        self.assertIn(b'503', raw)

    def test_csrf_and_url_validation(self):
        data = {'url': self.ha_url, 'token': 'fake-test-token'}
        self.assertEqual(self.call('POST', '/api/connect', data, {'Origin': 'https://other.test'})[0], 403)
        self.assertEqual(self.call('POST', '/api/connect', data, {'X-Ancient-Request': ''})[0], 403)
        for value in ('file:///etc/passwd', 'http://user:password@localhost:8123', self.ha_url + '/api/', self.ha_url + '?token=bad'):
            self.assertEqual(self.call('POST', '/api/connect', {'url': value, 'token': 'test'})[0], 400)
        self.assertEqual(self.call('POST', '/api/connect', [1, 2])[0], 400)

    def test_session_expiry_and_disconnect(self):
        self.connect()
        self.assertTrue(json.loads(self.call('GET', '/api/status')[2])['connected'])
        with patch('server.time.time', return_value=time.time() + server.SESSION_AGE + 1):
            self.assertEqual(self.call('GET', '/api/states')[0], 401)
        self.connect()
        self.assertEqual(self.call('POST', '/api/disconnect', {})[0], 200)
        self.assertEqual(self.call('GET', '/api/states')[0], 401)
        self.assertEqual(server.SESSIONS, {})

    def test_redirects_do_not_forward_credentials(self):
        FakeHA.redirect = True
        status, _, _ = self.call('POST', '/api/connect', {'url': self.ha_url, 'token': 'fake-test-token'})
        self.assertEqual(status, 502)
        self.assertEqual(FakeHA.sink_calls, 0)


if __name__ == '__main__':
    unittest.main()
