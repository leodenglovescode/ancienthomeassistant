/* ES5 deliberately: this file is served directly to iOS 9 Safari. */
(function () {
  'use strict';
  var paths = {
    home: '<path d="M3 11L12 3l9 8v10h-6v-7H9v7H3z"/><path d="M8 7v-3"/>',
    overview: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    bulb: '<path d="M8 16c0-3-3-4-3-8a7 7 0 0114 0c0 4-3 5-3 8zM9 19h6M10 22h4"/><path d="M10 8l2 3 2-3M12 11v5"/>',
    camera: '<rect x="3" y="5" width="14" height="14" rx="3"/><path d="M17 9l5-3v12l-5-3"/><circle cx="10" cy="12" r="3"/>',
    thermometer: '<path d="M9 14V5a3 3 0 016 0v9a5 5 0 11-6 0zM12 8v10"/><circle cx="12" cy="18" r="1"/>',
    history: '<path d="M3 10a9 9 0 119 11M3 4v6h6M12 7v5l4 2"/>',
    settings: '<path d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/><circle cx="12" cy="12" r="3"/>',
    moon: '<path d="M20 14A9 9 0 0110 3a9 9 0 1010 11z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1"/>',
    refresh: '<path d="M20 7a9 9 0 10.5 9M21 2v6h-6"/>',
    close: '<path d="M6 6l12 12M6 18L18 6"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    chevron: '<path d="M9 5l7 7-7 7"/>',
    power: '<path d="M12 2v10M6 5a9 9 0 1012 0"/>',
    shield: '<path d="M12 2l8 4v6c0 5-8 10-8 10S4 17 4 12V6zM8 12l3 3 5-6"/>',
    drop: '<path d="M12 2s-7 8-7 13a7 7 0 0014 0c0-5-7-13-7-13z"/>',
    wind: '<path d="M3 8h12a3 3 0 10-3-3M3 12h16a3 3 0 11-3 3M3 16h6a3 3 0 11-3 3"/>',
    movie: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4l4 5M15 4l4 5M10 12l5 3-5 3z"/>',
    sofa: '<path d="M6 12V7a3 3 0 013-3h6a3 3 0 013 3v5M5 11a3 3 0 013 3v1h8v-1a3 3 0 016 0v5H2v-5a3 3 0 013-3zM5 19v2M19 19v2"/>',
    expand: '<path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6"/>',
    door: '<path d="M5 21V3h14v18M3 21h18M14 12h1"/>',
    window: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 3v18M4 12h16"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 10-13h-8z"/>',
    leaf: '<path d="M20 3S2 1 3 14c1 10 19 10 17-11zM4 20L16 8"/>',
    cloud: '<path d="M6 18a5 5 0 01-1-10 7 7 0 0113 1 4.5 4.5 0 010 9z"/>',
    plug: '<path d="M8 2v6M16 2v6M5 8h14v4a7 7 0 01-14 0zM12 19v3"/>'
  };
  function icon(name) { return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || paths.home) + '</svg>'; }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function byId(id) { return document.getElementById(id); }
  function each(nodes, callback) { for (var i = 0; i < nodes.length; i++) { callback(nodes[i], i); } }
  function fillIcons(root) { each((root || document).querySelectorAll('[data-icon]'), function (el) { el.innerHTML = icon(el.getAttribute('data-icon')); }); }
  function store(key, value) { try { localStorage.setItem('ancient.' + key, JSON.stringify(value)); } catch (ignore) {} }
  function recall(key, fallback) { try { var v = localStorage.getItem('ancient.' + key); return v ? JSON.parse(v) : fallback; } catch (ignore) { return fallback; } }
  var slots = [
    ['living', 'Living room', 'light,switch'], ['bedroom', 'Bedroom', 'light,switch'], ['kitchen', 'Kitchen', 'light,switch'], ['porch', 'Porch light', 'light,switch'],
    ['front_camera', 'Front door camera', 'camera'], ['room_camera', 'Living room camera', 'camera'],
    ['temperature', 'Room temperature', 'sensor'], ['humidity', 'Room humidity', 'sensor'], ['power', 'Current power', 'sensor'],
    ['door', 'Front door sensor', 'binary_sensor'], ['window', 'Window sensor', 'binary_sensor'],
    ['thermostat', 'Thermostat', 'climate'], ['weather', 'Weather', 'weather'],
    ['evening', 'Cozy evening scene', 'scene'], ['movie', 'Movie time scene', 'scene'], ['night', 'Good night scene', 'scene']
  ];
  var config = recall('config', { mapping: {}, hls: {} });
  if (!config || typeof config !== 'object') { config = { mapping: {}, hls: {} }; }
  config.mapping = config.mapping || {}; config.hls = config.hls || {};
  var demo = { living: { on: true, brightness: 75 }, bedroom: { on: true, brightness: 40 }, kitchen: { on: false, brightness: 65 }, porch: { on: true, brightness: 90 } };
  var states = {}, connected = false, reachable = true, view = 'overview', activities = [], fetching = false, cameraTimer = null, cameraPending = false, cameraGeneration = 0, cameraKey = null, cameraMode = 'snapshot', toastTimer, focusBefore;
  var demoTarget = 23, demoHvac = 'cool', lastSync = null, busy = {}, modalKind = '';
  function request(method, url, data, done) {
    var xhr = new XMLHttpRequest(); xhr.open(method, url, true); xhr.timeout = 18000;
    xhr.setRequestHeader('X-Ancient-Request', '1');
    if (data !== null) { xhr.setRequestHeader('Content-Type', 'application/json'); }
    xhr.onload = function () { var result; try { result = JSON.parse(xhr.responseText); } catch (ignore) { return done(new Error('The bridge returned an invalid response.')); } if (xhr.status < 200 || xhr.status >= 300) { return done(new Error(result.error || 'Request failed (' + xhr.status + ').')); } done(null, result); };
    xhr.onerror = function () { done(new Error('The dashboard server is unreachable.')); };
    xhr.ontimeout = function () { done(new Error('The request timed out. Please try again.')); };
    xhr.send(data === null ? null : JSON.stringify(data));
  }
  function notify(text) { byId('toast').textContent = text; byId('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { byId('toast').hidden = true; }, 4500); }
  function entity(key) { return states[config.mapping[key]] || null; }
  function attr(key, property, fallback) { var s = entity(key); return s && s.attributes[property] !== undefined ? s.attributes[property] : fallback; }
  function available(s) { return s && s.state !== 'unavailable' && s.state !== 'unknown'; }
  function name(key) { for (var i = 0; i < slots.length; i++) { if (slots[i][0] === key) { return slots[i][1]; } } return key; }
  function light(key) {
    if (!connected) { return { on: demo[key].on, brightness: demo[key].brightness, ready: true, dimmable: true }; }
    var s = entity(key), ready = available(s) && reachable;
    return { on: !!(s && s.state === 'on'), brightness: Math.round(attr(key, 'brightness', 255) / 255 * 100), ready: ready, dimmable: !!(s && s.entity_id.indexOf('light.') === 0 && s.attributes.brightness !== undefined) };
  }
  function measurement(key, fallback, unit) {
    if (!connected) { return { value: fallback, unit: unit }; }
    var s = entity(key); return { value: available(s) && isFinite(parseFloat(s.state)) ? parseFloat(s.state) : null, unit: attr(key, 'unit_of_measurement', unit) };
  }
  function lightsOn() { var count = 0; each(['living', 'bedroom', 'kitchen', 'porch'], function (key) { if (light(key).on) { count++; } }); return count; }
  function record(message, type) { activities.unshift({ text: message, type: type || 'history', time: new Date() }); if (activities.length > 50) { activities.pop(); } }
  function doService(key, service, extra, done) {
    if (!config.mapping[key] || !reachable) { notify('Map this device in Settings and check the connection.'); if (done) { done(new Error('Device unavailable')); } return; }
    var id = config.mapping[key], data = { domain: id.split('.')[0], service: service, entity_id: id };
    for (var prop in extra) { if (Object.prototype.hasOwnProperty.call(extra, prop)) { data[prop] = extra[prop]; } }
    busy[key] = true;
    request('POST', '/api/service', data, function (error) { delete busy[key]; if (error) { notify(error.message); } if (done) { done(error); } });
  }
  function setLight(key, on, brightness, done) {
    if (busy[key]) { return; }
    var state = light(key);
    if (!state.ready) { notify('This device is unavailable. Check its entity in Settings.'); if (done) { done(new Error('Device unavailable')); } return; }
    function complete(error) {
      if (!error) { record(name(key) + (on ? ' turned on' : ' turned off'), 'bulb'); }
      else { render(); }
      if (done) { done(error); } else if (!error) { if (connected) { poll(); } else { render(); } }
    }
    if (!connected) { demo[key].on = on; if (brightness !== null) { demo[key].brightness = brightness; } complete(null); return; }
    var extra = {};
    if (brightness !== null && on) { extra.brightness_pct = brightness; }
    doService(key, on ? 'turn_on' : 'turn_off', extra, complete);
  }
  function title(text, type, right) { return '<div class="section-title"><span>' + icon(type) + esc(text) + '</span><span><small>' + esc(right || '') + '</small></span></div>'; }
  function lightCard(key) {
    var s = light(key), mapped = !connected || !!config.mapping[key];
    var text = s.ready ? (s.on ? (s.dimmable ? s.brightness + '% brightness' : 'On') : 'Off') : (mapped ? 'Unavailable' : 'Set up in Settings');
    var html = '<div class="card light-card ' + (s.on ? 'on' : 'off') + '"><div class="light-header"><span class="device-icon"><span class="icon-disc">' + icon('bulb') + '</span></span><span class="device-name">' + esc(name(key)) + '<small id="state-' + key + '">' + esc(text) + '</small></span><span class="toggle-cell"><button class="toggle" role="switch" aria-label="' + esc(name(key)) + '" aria-checked="' + s.on + '" data-light="' + key + '"' + (!s.ready || busy[key] ? ' disabled' : '') + '></button></span></div>';
    if (s.on && s.dimmable && s.ready) { html += '<div class="brightness"><span>' + icon('sun') + '</span><div class="range-wrap"><input type="range" min="1" max="100" value="' + s.brightness + '" data-brightness="' + key + '" aria-label="' + esc(name(key)) + ' brightness"></div><span id="brightness-' + key + '">' + s.brightness + '%</span></div>'; }
    return html + '</div>';
  }
  function weatherCard() {
    var s = entity('weather');
    if (connected) {
      if (!available(s)) { return '<div class="card empty-state">' + icon('cloud') + '<p>Connect a weather entity in Settings.</p></div>'; }
      return '<div class="card weather-card"><div class="weather-top"><div class="weather-icon">' + (s.state === 'sunny' ? '☀' : '☁') + '</div><div class="temperature">' + esc(s.attributes.temperature === undefined ? '—' : s.attributes.temperature) + '°</div><div class="weather-condition">' + esc(s.state.replace(/-/g, ' ')) + '<small>Home</small></div></div><div class="muted form-note">Live from Home Assistant</div></div>';
    }
    var days = ['Now', '15:00', '16:00', '17:00', '18:00'], temps = [24, 25, 24, 23, 21], html = '<div class="card weather-card"><div class="weather-top"><div class="weather-icon">☀</div><div class="temperature">24°</div><div class="weather-condition">Mostly sunny<small>Feels like 25°</small></div></div><div class="weather-details"><span>' + icon('drop') + '42% humidity</span><span>' + icon('wind') + '6 km/h</span></div><div class="forecast">';
    each(days, function (day, i) { html += '<div>' + day + '<em>' + (i === 2 || i === 3 ? '☁' : '☀') + '</em><strong>' + temps[i] + '°</strong></div>'; }); return html + '</div></div>';
  }
  function gauge(key, fallback, unit, max, color, label) {
    var m = measurement(key, fallback, unit), fraction = m.value === null ? 0 : Math.min(1, Math.max(0, m.value / max));
    return '<div class="gauge-unit"><svg class="gauge-svg" viewBox="0 0 140 100" aria-hidden="true"><path d="M20 75A50 50 0 01120 75" fill="none" stroke="#edf1f4" stroke-width="7" stroke-linecap="round"/><path d="M20 75A50 50 0 01120 75" fill="none" stroke="' + color + '" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + (fraction * 157).toFixed(1) + ' 157"/></svg><span class="gauge-number">' + (m.value === null ? '—' : esc(m.value)) + '<small>' + esc(m.unit) + '</small></span><div class="gauge-label">' + esc(label) + '</div></div>';
  }
  function gaugeCard() { var temp = measurement('temperature', 23.5, '°C'); return '<div class="card gauge-card"><div class="gauge-heading">' + icon('thermometer') + 'Room comfort</div><div class="gauge-pair">' + gauge('temperature', 23.5, '°C', temp.unit === '°F' ? 110 : 40, '#e3b65e', 'Temperature') + gauge('humidity', 46, '%', 100, '#71b4db', 'Humidity') + '</div></div>'; }
  function scenes() {
    var data = [['evening', 'Cozy evening', 'Warm lights. Slow down.', 'sofa'], ['movie', 'Movie time', 'Settle in, press play.', 'movie'], ['night', 'Good night', 'A quieter kind of home.', 'moon']], html = '<div class="card scenes-card">';
    each(data, function (item) { html += '<button class="scene scene-' + item[0] + '" data-scene="' + item[0] + '"' + (connected && (!entity(item[0]) || !reachable) ? ' disabled' : '') + '><span><span class="icon-disc">' + icon(item[3]) + '</span></span><span class="scene-name">' + item[1] + '<small>' + item[2] + '</small></span><span class="scene-arrow">' + icon('chevron') + '</span></button>'; });
    return html + '</div><button class="all-off" id="allOff">' + icon('power') + 'Turn off all dashboard lights</button><div class="card note-card"><strong>' + icon('leaf') + 'A second life, well lived.</strong>Your old iPad has a new place to call home.</div>';
  }
  function cameraCard(key, label, image) {
    var mapped = !connected || !!entity(key), status = connected ? (mapped && reachable ? 'SNAPSHOT' : 'UNAVAILABLE') : 'DEMO IMAGE';
    var source = connected ? (mapped ? '/api/camera/' + encodeURIComponent(config.mapping[key]) + '?t=' + new Date().getTime() : 'assets/camera-offline.svg') : 'assets/' + image;
    return '<button class="card camera-card" data-camera="' + key + '"><div class="camera-image"><img src="' + esc(source) + '" alt="' + esc(label) + (connected ? ' camera snapshot' : ' illustrated demo preview') + '" data-camera-image="' + key + '"' + (connected && !mapped ? ' class="live-unavailable"' : '') + '><span class="camera-badge" id="badge-' + key + '"><i></i>' + status + '</span><span class="camera-expand">' + icon('expand') + '</span></div><div class="camera-info">' + esc(label) + '<small id="camera-caption-' + key + '">' + (connected ? (mapped ? 'Waiting for snapshot…' : 'Choose a camera in Settings') : 'Sample preview · tap to explore') + '</small>' + icon('camera') + '</div></button>';
  }
  function cameras() { return '<div class="camera-row"><div class="camera-column">' + cameraCard('front_camera', 'Front door', 'front-door.svg') + '</div><div class="camera-column">' + cameraCard('room_camera', 'Living room', 'living-room.svg') + '</div></div>'; }
  function sensorRow(key, label, type) {
    var s = entity(key), value = connected ? (!available(s) ? 'Not connected' : s.state === 'off' ? 'Closed' : s.state === 'on' ? 'Open' : s.state) : 'Closed';
    return '<div class="sensor-row"><span>' + icon(type) + esc(label) + '</span><span>' + esc(value) + '</span></div>';
  }
  function sensors() { return '<div class="card sensor-card">' + sensorRow('door', 'Front door', 'door') + sensorRow('window', 'Living room window', 'window') + '</div>'; }
  function overview() {
    var m = measurement('power', 326, 'W');
    return '<div class="dashboard-row"><section class="column">' + title('Your lights', 'bulb', lightsOn() + ' on') + lightCard('living') + lightCard('bedroom') + lightCard('kitchen') + '<button class="small-link" data-go="lights">All lights ' + icon('chevron') + '</button></section><section class="column">' + title('A little outside', 'sun', connected ? 'Live weather' : 'Sample weather') + weatherCard() + gaugeCard() + '</section><section class="column">' + title('Set the mood', 'sofa', 'Scenes') + scenes() + '</section></div><div class="dashboard-row"><section class="column wide">' + title('An eye on home', 'camera', connected ? 'Tap for viewing options' : '2 demo cameras') + cameras() + '</section><section class="column">' + title('Around the house', 'shield') + sensors() + '<div class="mini-stats"><div><strong>' + esc(m.value === null ? '—' : m.value) + '<small> ' + esc(m.unit) + '</small></strong><small>POWER RIGHT NOW</small></div><div><strong>' + lightsOn() + '<small> / 4</small></strong><small>LIGHTS ON</small></div></div></section></div>';
  }
  function lightsView() { return '<div class="dashboard-row"><section class="column">' + title('Inside', 'bulb') + lightCard('living') + lightCard('bedroom') + '</section><section class="column">' + title('A little more light', 'sun') + lightCard('kitchen') + lightCard('porch') + '</section><section class="column">' + title('Scenes', 'sofa') + scenes() + '</section></div>'; }
  function thermostat() {
    var s = entity('thermostat'), ready = !connected || (available(s) && reachable), target = connected ? attr('thermostat', 'temperature', '—') : demoTarget, current = connected ? attr('thermostat', 'current_temperature', '—') : 23.5;
    var mode = connected ? (s ? s.state : '') : demoHvac, modes = connected ? attr('thermostat', 'hvac_modes', []) : ['off', 'cool', 'heat', 'auto'];
    var html = '<div class="card thermostat"><div class="gauge-heading">Room thermostat</div><div class="thermostat-value">' + esc(target) + '°</div><button class="step-button" data-temp="-1" aria-label="Decrease target temperature"' + (!ready || target === '—' ? ' disabled' : '') + '>−</button><button class="step-button" data-temp="1" aria-label="Increase target temperature"' + (!ready || target === '—' ? ' disabled' : '') + '>+</button><small>Current temperature: ' + esc(current) + '°</small><label for="hvacMode" class="form-note">Mode</label><select id="hvacMode"' + (!ready ? ' disabled' : '') + '>';
    if (!modes.length) { html += '<option>Connect a thermostat in Settings</option>'; }
    each(modes, function (m) { html += '<option value="' + esc(m) + '"' + (m === mode ? ' selected' : '') + '>' + esc(m.replace(/_/g, ' ')) + '</option>'; });
    return html + '</select></div>';
  }
  function climateView() { return '<div class="dashboard-row"><section class="column">' + title('Room climate', 'thermometer') + thermostat() + '</section><section class="column">' + title('How home feels', 'drop') + gaugeCard() + '<div class="card note-card">Temperature and humidity use your mapped Home Assistant sensors.</div></section><section class="column">' + title('Outside', 'sun') + weatherCard() + '</section></div>'; }
  function activityView() {
    var html = title('Dashboard activity', 'history', 'This session') + '<div class="card activity-card">';
    if (!activities.length) { html += '<div class="empty-state">' + icon('history') + '<p>Your home is taking a breather.<br>Successful actions from this dashboard appear here.</p></div>'; }
    each(activities, function (a) { html += '<div class="activity-row">' + icon(a.type) + esc(a.text) + '<small>' + esc(timeText(a.time)) + '</small></div>'; }); return html + '</div><p class="form-note muted">This is a local session log, not Home Assistant’s full history.</p>';
  }
  function timeText(date) { return ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2); }
  function summary() {
    var temp = measurement('temperature', 23.5, '°C');
    byId('summary').innerHTML = '<span class="summary-pill"><i></i>' + (!connected ? 'Demo home' : reachable ? 'Home connected' : 'Connection lost') + '</span><span class="summary-pill gold">' + icon('bulb') + lightsOn() + (lightsOn() === 1 ? ' light on' : ' lights on') + '</span><span class="summary-pill">' + icon('thermometer') + (temp.value === null ? '—' : esc(temp.value)) + ' ' + esc(temp.unit) + ' indoors</span><span class="summary-pill blue">' + icon('camera') + (connected ? 'Camera overview' : 'Try your new dashboard') + '</span>';
    byId('navLightCount').textContent = lightsOn();
    byId('connectionBadge').className = 'connection-pill' + (connected && reachable ? ' live' : '');
    byId('connectionBadge').innerHTML = '<i></i>' + (connected ? (reachable ? 'Connected' : 'Offline') : 'Demo mode');
    byId('sidebarStatus').innerHTML = (connected ? (reachable ? 'Home connected' : 'Connection lost') : 'Demo home') + '<small>' + (connected ? 'Your personal home dashboard' : 'Make yourself at home.') + '</small>';
    byId('updatedLabel').textContent = connected ? (reachable ? 'Updated ' + (lastSync ? timeText(lastSync) : 'just now') : 'Connection lost · showing last states') : 'Sample data · controls are interactive';
    byId('footerMode').textContent = connected ? 'Home Assistant · local bridge' : 'Built for a second life.';
  }
  function render() {
    // Do not replace a range control under a finger during a state refresh.
    if (document.activeElement && document.activeElement.type === 'range') { return; }
    summary();
    byId('dashboard').innerHTML = view === 'overview' ? overview() : view === 'lights' ? lightsView() : view === 'cameras' ? title('An eye on home', 'camera', connected ? 'Tap a camera for viewing options' : 'Illustrated demo previews') + cameras() + '<p class="form-note muted">Snapshots are the default. Open a camera to choose MJPEG or a configured native video stream.</p>' : view === 'climate' ? climateView() : activityView();
    bindDashboard();
    each(document.querySelectorAll('[data-view]'), function (button) { button.className = 'nav-item' + (button.getAttribute('data-view') === view ? ' selected' : ''); });
    each(document.querySelectorAll('[data-tab]'), function (button) { var active = button.getAttribute('data-tab') === view; button.className = active ? 'active' : ''; button.setAttribute('aria-selected', String(active)); });
    byId('viewTitle').textContent = view.charAt(0).toUpperCase() + view.slice(1);
  }
  function go(next) { view = ['overview', 'lights', 'cameras', 'climate', 'activity'].indexOf(next) >= 0 ? next : 'overview'; location.hash = view; byId('sidebar').className = 'sidebar'; render(); }
  function runScene(key) {
    if (connected) { doService(key, 'turn_on', {}, function (error) { if (!error) { record(name(key) + ' activated', 'sofa'); notify('Scene activated'); setTimeout(poll, 600); } }); return; }
    if (key === 'evening') { demo.living.on = true; demo.living.brightness = 55; demo.bedroom.on = true; demo.bedroom.brightness = 30; demo.kitchen.on = false; }
    if (key === 'movie') { demo.living.on = true; demo.living.brightness = 15; demo.bedroom.on = false; demo.kitchen.on = false; }
    if (key === 'night') { each(['living', 'bedroom', 'kitchen'], function (k) { demo[k].on = false; }); demo.porch.on = true; demo.porch.brightness = 30; }
    record(name(key) + ' activated (demo)', 'sofa'); notify('Demo scene activated'); render();
  }
  function allOff(button) {
    var keys = [], seen = {};
    each(['living', 'bedroom', 'kitchen', 'porch'], function (key) { var id = connected ? config.mapping[key] : key; if (id && !seen[id] && light(key).ready && light(key).on) { keys.push(key); seen[id] = true; } });
    if (!keys.length) { notify('All available dashboard lights are already off.'); return; }
    button.disabled = true; var left = keys.length, errors = 0;
    each(keys, function (key) { setLight(key, false, null, function (error) { if (error) { errors++; } left--; if (!left) { button.disabled = false; notify(errors ? 'Some lights could not be switched off.' : 'All dashboard lights switched off.'); if (connected) { poll(); } else { render(); } } }); });
  }
  function bindDashboard() {
    each(byId('dashboard').querySelectorAll('[data-light]'), function (button) { button.onclick = function () { var key = this.getAttribute('data-light'); this.disabled = true; setLight(key, !light(key).on, null); }; });
    each(byId('dashboard').querySelectorAll('[data-brightness]'), function (input) {
      input.oninput = function () { byId('brightness-' + this.getAttribute('data-brightness')).textContent = this.value + '%'; };
      input.onchange = function () { var key = this.getAttribute('data-brightness'); setLight(key, true, Number(this.value), function (error) { if (error) { render(); } else if (connected) { poll(); } else { render(); } }); this.blur(); };
    });
    each(byId('dashboard').querySelectorAll('[data-go]'), function (button) { button.onclick = function () { go(this.getAttribute('data-go')); }; });
    each(byId('dashboard').querySelectorAll('[data-scene]'), function (button) { button.onclick = function () { runScene(this.getAttribute('data-scene')); }; });
    each(byId('dashboard').querySelectorAll('[data-camera]'), function (button) { button.onclick = function () { openCamera(this.getAttribute('data-camera')); }; });
    each(byId('dashboard').querySelectorAll('[data-camera-image]'), function (image) {
      var key = image.getAttribute('data-camera-image');
      image.onload = function () { if (connected && config.mapping[key]) { byId('camera-caption-' + key).textContent = 'Snapshot · ' + timeText(new Date()); } };
      image.onerror = function () { this.onerror = null; this.src = 'assets/camera-offline.svg'; byId('badge-' + key).textContent = 'UNAVAILABLE'; byId('camera-caption-' + key).textContent = 'No snapshot · check camera settings'; };
    });
    if (byId('allOff')) { byId('allOff').onclick = function () { allOff(this); }; }
    each(byId('dashboard').querySelectorAll('[data-temp]'), function (button) { button.onclick = function () { var amount = Number(this.getAttribute('data-temp')), target = Number(connected ? attr('thermostat', 'temperature', 23) : demoTarget) + amount; if (connected) { doService('thermostat', 'set_temperature', { temperature: target }, function (error) { if (!error) { record('Thermostat target changed to ' + target + '°', 'thermometer'); poll(); } }); } else { demoTarget = Math.max(10, Math.min(32, target)); record('Demo thermostat set to ' + demoTarget + '°', 'thermometer'); render(); } }; });
    if (byId('hvacMode')) { byId('hvacMode').onchange = function () { if (connected) { doService('thermostat', 'set_hvac_mode', { hvac_mode: this.value }, function (error) { if (!error) { poll(); } }); } else { demoHvac = this.value; record('Demo climate mode changed to ' + demoHvac, 'thermometer'); } }; }
  }
  function poll(done) {
    if (!connected || fetching) { if (done) { done(); } return; }
    fetching = true;
    request('GET', '/api/states', null, function (error, data) {
      fetching = false;
      if (error) { reachable = false; render(); if (done) { done(error); } return; }
      reachable = true; states = {};
      each(data, function (s) { states[s.entity_id] = s; }); lastSync = new Date(); render(); if (done) { done(null); }
    });
  }
  function openModal(heading, body, kind) {
    focusBefore = document.activeElement; modalKind = kind;
    byId('modalTitle').textContent = heading; byId('modalBody').innerHTML = body; byId('modalBackdrop').hidden = false;
    document.body.style.overflow = 'hidden'; byId('modal').focus();
  }
  function closeModal() {
    cameraGeneration++; clearTimeout(cameraTimer); cameraPending = false; cameraKey = null;
    var video = byId('cameraVideo'); if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    byId('modalBackdrop').hidden = true; byId('modalBody').innerHTML = ''; document.body.style.overflow = ''; modalKind = '';
    if (focusBefore && document.body.contains(focusBefore)) { focusBefore.focus(); }
  }
  function mappingsHtml() {
    var html = '<h3 class="mapping-heading">Make it your home</h3><p>Choose the Home Assistant entity for each card. These choices are saved on this browser.</p>';
    each(slots, function (slot) {
      html += '<div class="mapping-row"><label for="map-' + slot[0] + '">' + esc(slot[1]) + '</label><span><select id="map-' + slot[0] + '" data-map="' + slot[0] + '"><option value="">Not configured</option>';
      var keys = Object.keys(states).sort(), found = false;
      each(keys, function (id) { if (slot[2].split(',').indexOf(id.split('.')[0]) < 0) { return; } var selected = config.mapping[slot[0]] === id; if (selected) { found = true; } html += '<option value="' + esc(id) + '"' + (selected ? ' selected' : '') + '>' + esc(states[id].attributes.friendly_name || id) + ' · ' + esc(id) + '</option>'; });
      if (!found && config.mapping[slot[0]]) { html += '<option selected value="' + esc(config.mapping[slot[0]]) + '">' + esc(config.mapping[slot[0]]) + ' (missing)</option>'; }
      html += '</select></span></div>';
    });
    html += '<h3 class="mapping-heading">Optional native camera video</h3><p class="form-note">Enter an iPad-accessible H.264 HLS (.m3u8) or MP4 URL. Safari uses its native player. Do not put your Home Assistant token in a URL. Leave blank for snapshots and MJPEG.</p>';
    each(['front_camera', 'room_camera'], function (key) { html += '<label for="hls-' + key + '">' + esc(name(key)) + ' video URL</label><input id="hls-' + key + '" type="url" placeholder="http://your-stream-server/camera.m3u8" value="' + esc(config.hls[key] || '') + '">'; });
    return html + '<button class="primary-button" id="saveMappings">Save dashboard</button><p class="form-note" id="mappingStatus" role="status"></p>';
  }
  function showSettings() {
    var html = '<p>Your home, on hardware you already love. Connect your server whenever you’re ready.</p>';
    if (connected) { html += '<p class="form-success">Connected to ' + esc(connectionUrl) + '</p><button class="secondary-button" id="disconnectButton">Disconnect &amp; return to demo</button>' + mappingsHtml(); }
    else { html += '<form id="connectForm"><label for="haUrl">Home Assistant address</label><input id="haUrl" type="url" autocomplete="off" placeholder="http://homeassistant.local:8123" required value="' + esc(recall('url', '')) + '"><label for="haToken">Long-lived access token</label><input id="haToken" type="password" autocomplete="off" placeholder="Paste your access token" required><p class="form-note">Create a token in your Home Assistant profile → Security. The token stays in server memory after connection; it is never saved in browser storage. Sessions expire after 12 hours or a server restart. Use a trusted LAN or HTTPS.</p><button class="primary-button" id="connectButton" type="submit">Connect Home Assistant</button><p id="connectStatus" class="form-note" role="status"></p></form><h3 class="mapping-heading">A proper home for an old friend</h3><p class="form-note">Designed for iPad 2 · iOS 9 Safari · 1024 × 768.<br>Add to Home Screen from Safari’s Share menu for a cleaner dashboard.</p>'; }
    openModal('Your dashboard', html, 'settings');
    if (byId('connectForm')) { byId('connectForm').onsubmit = function (event) {
      event.preventDefault(); var button = byId('connectButton'); button.disabled = true; button.textContent = 'Connecting…';
      var url = byId('haUrl').value, token = byId('haToken').value; byId('haToken').value = '';
      request('POST', '/api/connect', { url: url, token: token }, function (error, result) {
        if (modalKind !== 'settings') { if (!error) { connected = true; connectionUrl = result.url; poll(); } return; }
        if (error) { byId('connectStatus').className = 'form-note form-error'; byId('connectStatus').textContent = error.message; button.disabled = false; button.textContent = 'Connect Home Assistant'; return; }
        connected = true; connectionUrl = result.url; store('url', result.url); states = {}; record('Connected to Home Assistant', 'plug');
        poll(function (pollError) { if (modalKind === 'settings') { showSettings(); } notify(pollError ? pollError.message : 'Connected. Choose your entities to bring the cards to life.'); });
      });
    }; }
    if (byId('disconnectButton')) { byId('disconnectButton').onclick = function () { this.disabled = true; request('POST', '/api/disconnect', {}, function (error) { if (error) { notify(error.message); if (byId('disconnectButton')) { byId('disconnectButton').disabled = false; } return; } connected = false; reachable = true; states = {}; render(); showSettings(); notify('Disconnected. Demo mode is on.'); }); }; }
    if (byId('saveMappings')) { byId('saveMappings').onclick = function () {
      var next = { mapping: {}, hls: {} }, valid = true;
      each(byId('modalBody').querySelectorAll('[data-map]'), function (select) { if (select.value) { next.mapping[select.getAttribute('data-map')] = select.value; } });
      each(['front_camera', 'room_camera'], function (key) { var value = byId('hls-' + key).value.replace(/^\s+|\s+$/g, ''); if (value && (!/^https?:\/\/[^\s]+$/i.test(value) || /[?&](token|access_token|auth)=|\/\/[^/]*@/i.test(value))) { valid = false; } next.hls[key] = value; });
      if (!valid) { byId('mappingStatus').textContent = 'Use http(s) video URLs without embedded credentials or access tokens.'; byId('mappingStatus').className = 'form-note form-error'; return; }
      config = next; store('config', config); render(); closeModal(); notify('Your dashboard is saved.');
    }; }
  }
  function cameraFrame() {
    var image = byId('expandedCamera'); if (!image || cameraPending || document.hidden || !cameraKey) { return; }
    var generation = cameraGeneration, key = cameraKey; cameraPending = true;
    image.onload = function () { if (generation !== cameraGeneration) { return; } cameraPending = false; if (byId('cameraStatus')) { byId('cameraStatus').textContent = 'Snapshot updated at ' + timeText(new Date()) + ' · refreshes every 5 seconds'; } if (cameraMode === 'snapshot') { cameraTimer = setTimeout(cameraFrame, 5000); } };
    image.onerror = function () { if (generation !== cameraGeneration) { return; } cameraPending = false; if (byId('cameraStatus')) { byId('cameraStatus').textContent = 'Camera unavailable. Retrying in 10 seconds.'; } cameraTimer = setTimeout(cameraFrame, 10000); };
    image.src = '/api/camera/' + encodeURIComponent(config.mapping[key]) + (cameraMode === 'mjpeg' ? '/stream' : '') + '?t=' + new Date().getTime();
  }
  function cameraContent() {
    cameraGeneration++; cameraPending = false; clearTimeout(cameraTimer);
    var video = byId('cameraVideo'); if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    var content = byId('cameraContent'); if (!content) { return; }
    if (cameraMode === 'video') {
      content.innerHTML = '<video class="modal-camera" id="cameraVideo" controls preload="none" webkit-playsinline playsinline src="' + esc(config.hls[cameraKey]) + '"></video>';
      byId('cameraStatus').textContent = 'Tap Play. iOS 9 may open video fullscreen; H.264/AAC HLS is recommended.';
      byId('cameraVideo').onerror = function () { byId('cameraStatus').textContent = 'This stream could not be played. Check its URL and codec, or use snapshots.'; };
    } else { content.innerHTML = '<img class="modal-camera" id="expandedCamera" alt="' + esc(name(cameraKey)) + ' camera">'; byId('cameraStatus').textContent = cameraMode === 'mjpeg' ? 'Opening MJPEG stream…' : 'Loading snapshot…'; cameraFrame(); }
  }
  function openCamera(key) {
    if (connected && !config.mapping[key]) { notify('Choose this camera’s entity in Settings first.'); return; }
    var heading = key === 'front_camera' ? 'Front door' : 'Living room';
    var body = !connected ? '<img class="modal-camera" src="assets/' + (key === 'front_camera' ? 'front-door.svg' : 'living-room.svg') + '" alt="Illustrated demo camera preview"><p>This is an illustrated demo image. Connect Home Assistant in Settings for your actual camera snapshots and streams.</p><button class="primary-button" id="cameraSetup">Connect your cameras</button>' : '<div id="cameraContent"></div><div class="camera-controls"><label for="cameraMode">Viewing mode</label><span><select id="cameraMode"><option value="snapshot">Snapshots · low load</option><option value="mjpeg">MJPEG · live (if supported)</option>' + (config.hls[key] ? '<option value="video">Native video · HLS / MP4</option>' : '') + '</select></span></div><p class="form-note" id="cameraStatus" role="status"></p><p class="form-note">MJPEG support depends on the camera integration. Snapshots offer the lightest load on your iPad. Native video URLs are configured in Settings.</p>';
    openModal(heading, body, 'camera'); cameraKey = key; cameraMode = 'snapshot';
    if (byId('cameraSetup')) { byId('cameraSetup').onclick = function () { closeModal(); showSettings(); }; }
    if (connected) { cameraContent(); byId('cameraMode').onchange = function () { cameraMode = this.value; cameraContent(); }; }
  }
  function tick() {
    var d = new Date(), days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    byId('dateLabel').textContent = (days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate()).toUpperCase(); byId('clock').textContent = timeText(d);
    byId('greeting').innerHTML = (d.getHours() < 12 ? 'Good morning' : d.getHours() < 18 ? 'Good afternoon' : 'Good evening') + ' <span class="greeting-sun">' + (d.getHours() < 18 ? '☀' : '☾') + '</span>';
  }
  var dark = recall('dark', false), connectionUrl = '';
  function applyTheme() { document.documentElement.className = dark ? 'dark' : ''; byId('themeButton').innerHTML = icon(dark ? 'sun' : 'moon'); byId('themeButton').setAttribute('aria-label', 'Switch to ' + (dark ? 'light' : 'dark') + ' theme'); }
  fillIcons(); applyTheme(); tick();
  byId('themeButton').onclick = function () { dark = !dark; store('dark', dark); applyTheme(); };
  byId('settingsButton').onclick = showSettings;
  byId('closeModal').onclick = closeModal;
  byId('modalBackdrop').onclick = function (e) { if (e.target === this) { closeModal(); } };
  byId('menuButton').onclick = function () { byId('sidebar').className = byId('sidebar').className === 'sidebar open' ? 'sidebar' : 'sidebar open'; };
  each(document.querySelectorAll('[data-view]'), function (button) { button.onclick = function () { go(this.getAttribute('data-view')); }; });
  each(document.querySelectorAll('[data-tab]'), function (button) { button.onclick = function () { go(this.getAttribute('data-tab')); }; });
  byId('refreshButton').onclick = function () { if (!connected) { tick(); render(); notify('Demo dashboard refreshed.'); } else { poll(function (error) { notify(error ? error.message : 'Dashboard refreshed.'); }); } };
  window.onhashchange = function () { go(location.hash.slice(1)); };
  document.addEventListener('keydown', function (e) {
    if (byId('modalBackdrop').hidden) { return; }
    if (e.keyCode === 27) { closeModal(); }
    if (e.keyCode === 9) { var nodes = byId('modal').querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href]'), first = nodes[0], last = nodes[nodes.length - 1]; if (e.shiftKey && (document.activeElement === first || document.activeElement === byId('modal'))) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { clearTimeout(cameraTimer); if (cameraMode === 'mjpeg' && byId('expandedCamera')) { byId('expandedCamera').removeAttribute('src'); cameraPending = false; } var v = byId('cameraVideo'); if (v) { v.pause(); } } else { tick(); if (connected) { poll(); } if (cameraKey && cameraMode !== 'video') { cameraPending = false; cameraFrame(); } } });
  go(location.hash.slice(1) || 'overview');
  request('GET', '/api/status', null, function (error, result) { if (error) { notify('Preview only: start server.py to enable Home Assistant connections.'); return; } if (result.connected) { connected = true; connectionUrl = result.url; poll(); } });
  setInterval(tick, 30000);
  setInterval(function () { if (!document.hidden && connected) { poll(); } }, 5000);
}());
