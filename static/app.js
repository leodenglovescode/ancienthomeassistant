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
  var kinds = { light: 'Light', switch: 'Switch', gauge: 'Gauge', sensor: 'Status / sensor', camera: 'Camera', climate: 'Thermostat', weather: 'Weather', scene: 'Scene', button: 'Action button', fan: 'Fan', cover: 'Cover' };
  var kindIcons = { light: 'bulb', switch: 'plug', gauge: 'thermometer', sensor: 'history', camera: 'camera', climate: 'thermometer', weather: 'sun', scene: 'sofa', button: 'power', fan: 'wind', cover: 'window' };
  var config = null, draft = null, states = {}, catalog = {}, configured = false, authenticated = false, reachable = false;
  var view = 'overview', editing = false, setupStage = '', activities = [], busy = {}, fetching = false, lastSync = null, lastSignature = '', toastTimer;
  var pickerContext = null, pickerGeneration = 0, pickerOffset = 0, pickerTotal = 0, pickerTimer;
  var cameraCard = null, cameraMode = 'snapshot', cameraTimer, cameraGeneration = 0, cameraBusy = false, focusBefore;
  var modalKind = '', resizeTimer, lastColumns = 0;
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function uid(prefix) { return prefix + new Date().getTime().toString(36) + Math.random().toString(36).slice(2, 9); }
  function request(method, url, data, done) {
    var xhr = new XMLHttpRequest(); xhr.open(method, url, true); xhr.timeout = 25000;
    xhr.setRequestHeader('X-Ancient-Request', '1');
    if (data !== null) { xhr.setRequestHeader('Content-Type', 'application/json'); }
    xhr.onload = function () {
      var result, error;
      try { result = JSON.parse(xhr.responseText); } catch (ignore) { return done(new Error('The server returned an invalid response.')); }
      if (xhr.status < 200 || xhr.status >= 300) { error = new Error(result.error || 'Request failed.'); error.status = xhr.status; return done(error); }
      done(null, result);
    };
    xhr.onerror = function () { done(new Error('The dashboard server is unreachable.')); };
    xhr.ontimeout = function () { done(new Error('The request timed out. Please try again.')); };
    xhr.send(data === null ? null : JSON.stringify(data));
  }
  function notify(message) { byId('toast').textContent = message; byId('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { byId('toast').hidden = true; }, 5500); }
  function formError(id, error) { var el = byId(id); if (el) { el.textContent = error.message || error; el.className = 'form-note form-error'; } }
  function ready(state) { return reachable && state && state.state !== 'unknown' && state.state !== 'unavailable'; }
  function numeric(value) { return value !== null && value !== '' && isFinite(Number(value)); }
  function displayNumber(value) { return numeric(value) ? String(Math.round(Number(value) * 100) / 100) : '—'; }
  function cardsOf(board) { var list = []; each(board ? board.sections : [], function (section) { each(section.cards, function (card) { list.push(card); }); }); return list; }
  function findCard(board, id) { var result = null; each(board.sections, function (section) { each(section.cards, function (card) { if (card.id === id) { result = card; } }); }); return result; }
  function findSection(board, id) { var result = null; each(board.sections, function (section) { if (section.id === id) { result = section; } }); return result; }
  function fieldOptions(items, selected) { var html = ''; each(items, function (item) { var value = typeof item === 'string' ? item : item[0], label = typeof item === 'string' ? item : item[1]; html += '<option value="' + esc(value) + '"' + (String(selected) === String(value) ? ' selected' : '') + '>' + esc(label) + '</option>'; }); return html; }
  function allKinds() { var result = []; for (var key in kinds) { if (Object.prototype.hasOwnProperty.call(kinds, key)) { result.push([key, kinds[key]]); } } return result; }
  function kindOptions(types, selected) { var options = []; each(types, function (type) { if (kinds[type]) { options.push([type, kinds[type]]); } }); return fieldOptions(options, selected); }
  function logo() { return '<img class="access-logo" src="assets/icon.svg" width="58" height="58" alt="Ancient Home Assistant">'; }
  function showAccess(stage, error) {
    stopCamera(); authenticated = stage === 'entities' || stage === 'layout';
    byId('app').hidden = true; byId('access').hidden = false; setupStage = stage; editing = false;
    var html = logo(), form;
    if (stage === 'connect') {
      html += '<div class="eyebrow">WELCOME HOME</div><h1>Give your home a dashboard.</h1><p>Connect Home Assistant, choose your widgets, and make this screen your own.</p><div class="setup-steps"><strong>1. Connect</strong><span>2. Choose widgets</span><span>3. Arrange</span></div><form id="setupForm"><label for="setupUrl">Home Assistant URL</label><input id="setupUrl" type="url" placeholder="http://homeassistant.local:8123" required autocapitalize="off" autocomplete="off" spellcheck="false"><label for="setupToken">Home Assistant long-lived access token</label><input id="setupToken" type="password" required autocomplete="off" placeholder="Paste the token from your Home Assistant profile"><p class="form-note">The address must be reachable from this server. The token is saved privately on the server, never in browser storage.</p><div class="field-pair"><div><label for="setupPassword">Create a dashboard password</label><input id="setupPassword" type="password" minlength="10" maxlength="256" required autocomplete="new-password"></div><div><label for="setupConfirm">Confirm dashboard password</label><input id="setupConfirm" type="password" required autocomplete="new-password"></div></div><p class="form-note">Use at least 10 characters. This password protects your saved connection and controls. Use a trusted LAN or HTTPS.</p><p id="setupError" class="form-note form-error" role="alert"></p><button class="primary-button" id="setupSubmit" type="submit">Connect &amp; continue ' + icon('chevron') + '</button></form>';
    } else if (stage === 'login') {
      html += '<div class="eyebrow">ANCIENT HOME ASSISTANT</div><h1>Welcome back.</h1><p>Sign in to your dashboard. Your Home Assistant connection and widgets are already saved.</p><form id="loginForm"><label for="loginPassword">Dashboard password</label><input id="loginPassword" type="password" required autocomplete="current-password"><p id="loginError" class="form-note form-error" role="alert"></p><button class="primary-button" id="loginSubmit" type="submit">Open dashboard</button></form><p class="form-note">Sessions last up to 30 days on this browser. A server administrator can reset a forgotten password without deleting the dashboard.</p>';
    } else if (stage === 'entities') {
      html += '<div class="eyebrow">CONNECTED TO HOME ASSISTANT</div><h1>Choose what matters.</h1><p>Search your actual entities, then choose a compatible widget for each one. Add as many as you need.</p><div class="setup-steps"><span>1. Connected</span><strong>2. Choose widgets</strong><span>3. Arrange</span></div>' + pickerHtml(false) + '<div id="selectionSummary"></div><div class="wizard-actions"><button id="arrangeSetup" class="primary-button">Arrange dashboard ' + icon('chevron') + '</button><button id="setupLogout" class="secondary-button">Sign out</button></div>';
    } else if (stage === 'layout') {
      html += '<div class="eyebrow">MAKE IT YOUR OWN</div><h1>A place for everything.</h1><p>Rename widgets, choose their types and widths, and organize them into sections.</p><div class="setup-steps"><span>1. Connected</span><span>2. Widgets chosen</span><strong>3. Arrange</strong></div><div id="builder"></div>';
    } else {
      html += '<h1>Opening your dashboard…</h1><p id="accessMessage">Loading the saved connection.</p><button id="retryBoot" class="secondary-button" hidden>Try again</button>';
    }
    byId('accessBody').innerHTML = html; byId('accessBody').className = 'access-card' + (stage === 'entities' || stage === 'layout' ? ' access-wide' : '');
    if (error) { formError(stage === 'connect' ? 'setupError' : 'loginError', error); }
    if (stage === 'connect') {
      form = byId('setupForm'); form.onsubmit = function (event) {
        event.preventDefault();
        if (byId('setupPassword').value !== byId('setupConfirm').value) { return formError('setupError', 'Passwords do not match.'); }
        var payload = { url: byId('setupUrl').value, token: byId('setupToken').value, password: byId('setupPassword').value };
        byId('setupSubmit').disabled = true; byId('setupSubmit').textContent = 'Checking your connection…'; byId('setupToken').value = ''; byId('setupPassword').value = ''; byId('setupConfirm').value = '';
        request('POST', '/api/setup', payload, function (err) { if (err) { formError('setupError', err); byId('setupSubmit').disabled = false; byId('setupSubmit').textContent = 'Connect & continue'; if (err.status === 409) { boot(); } return; } configured = true; authenticated = true; loadConfig(); });
      };
    }
    if (stage === 'login') { byId('loginForm').onsubmit = function (event) { event.preventDefault(); var password = byId('loginPassword').value; byId('loginPassword').value = ''; byId('loginSubmit').disabled = true; request('POST', '/api/login', { password: password }, function (err) { if (err) { formError('loginError', err); byId('loginSubmit').disabled = false; return; } authenticated = true; loadConfig(); }); }; }
    if (stage === 'entities') {
      if (!draft.sections.length) { draft.sections.push({ id: uid('section-'), title: 'Home', cards: [] }); } pickerContext = { section: draft.sections[0].id, card: null, modal: false }; preparePicker(''); updateSelectionSummary();
      byId('arrangeSetup').onclick = function () { showAccess('layout'); renderBuilder(); };
      byId('setupLogout').onclick = logout;
    }
    if (stage === 'layout') { renderBuilder(); }
  }
  function boot() {
    showAccess('loading'); request('GET', '/api/status', null, function (error, result) {
      if (error) { byId('accessMessage').textContent = error.message; byId('retryBoot').hidden = false; byId('retryBoot').onclick = boot; return; }
      configured = result.configured; authenticated = result.authenticated;
      if (!configured) { showAccess('connect'); } else if (!authenticated) { showAccess('login'); } else { loadConfig(); }
    });
  }
  function loadConfig() {
    request('GET', '/api/config', null, function (error, result) {
      if (error) { if (error.status === 401) { showAccess('login', error); } else { showAccess('loading'); byId('accessMessage').textContent = error.message; byId('retryBoot').hidden = false; byId('retryBoot').onclick = loadConfig; } return; }
      config = result; authenticated = true;
      if (!config.onboarding_complete) { draft = clone(config); if (!draft.sections.length) { draft.sections.push({ id: uid('section-'), title: 'Home', cards: [] }); } showAccess('entities'); }
      else { setupStage = ''; byId('access').hidden = true; byId('app').hidden = false; editing = false; render(); window.scrollTo(0, 0); poll(); }
    });
  }
  function pickerHtml(modal) {
    return '<div class="entity-toolbar"><div><label for="entitySearch">Search Home Assistant entities</label><input id="entitySearch" type="search" placeholder="Search name or entity ID" autocapitalize="off" autocomplete="off" spellcheck="false"></div><div><label for="entityKind">Widget type</label><select id="entityKind">' + fieldOptions([['', 'All compatible types']].concat(allKinds()), '') + '</select></div></div><p class="form-note" id="entityCount" role="status">Loading entities…</p><div id="entityResults" class="entity-results"></div><div class="pager"><button class="secondary-button" id="entityPrevious">Previous</button><button class="secondary-button" id="entityNext">Next</button></div>' + (modal ? '<button class="secondary-button" id="pickerDone">Done</button>' : '');
  }
  function preparePicker(kind) {
    byId('entityKind').value = kind; pickerOffset = 0;
    if (pickerContext.card) { byId('entityKind').disabled = true; }
    byId('entitySearch').oninput = function () { clearTimeout(pickerTimer); pickerTimer = setTimeout(function () { pickerOffset = 0; searchEntities(); }, 300); };
    byId('entityKind').onchange = function () { pickerOffset = 0; searchEntities(); };
    byId('entityPrevious').onclick = function () { pickerOffset = Math.max(0, pickerOffset - 30); searchEntities(); };
    byId('entityNext').onclick = function () { pickerOffset += 30; searchEntities(); };
    if (byId('pickerDone')) { byId('pickerDone').onclick = closeModal; }
    searchEntities();
  }
  function searchEntities() {
    if (!byId('entitySearch')) { return; }
    var generation = ++pickerGeneration, query = byId('entitySearch').value, kind = byId('entityKind').value;
    byId('entityCount').textContent = 'Searching Home Assistant…';
    request('GET', '/api/entities?limit=30&offset=' + pickerOffset + '&q=' + encodeURIComponent(query) + '&type=' + encodeURIComponent(kind), null, function (error, result) {
      if (generation !== pickerGeneration || !byId('entityResults')) { return; }
      if (error) { byId('entityCount').textContent = error.message; byId('entityResults').innerHTML = ''; return; }
      pickerTotal = result.total; var html = '';
      each(result.items, function (item) {
        catalog[item.entity_id] = item;
        html += '<div class="entity-result"><span class="icon-disc">' + icon(kindIcons[item.widget_types[0]] || 'history') + '</span><div><strong>' + esc(item.attributes.friendly_name || item.entity_id) + '</strong><small>' + esc(item.entity_id) + '</small><span class="entity-state">' + esc(item.state) + ' ' + esc(item.attributes.unit_of_measurement || '') + '</span></div><button class="secondary-button" data-choose-entity="' + esc(item.entity_id) + '">' + (pickerContext.card ? 'Select' : 'Add widget') + '</button></div>';
      });
      byId('entityResults').innerHTML = html || '<p class="empty-state">No matching entities. Try another search or widget type.</p>';
      byId('entityCount').textContent = result.total ? (result.offset + 1) + '–' + Math.min(result.offset + 30, result.total) + ' of ' + result.total + ' entities' : 'No matching entities';
      byId('entityPrevious').disabled = pickerOffset === 0; byId('entityNext').disabled = pickerOffset + 30 >= pickerTotal;
      each(byId('entityResults').querySelectorAll('[data-choose-entity]'), function (button) { button.onclick = function () { openWidgetForm(catalog[this.getAttribute('data-choose-entity')], kind); }; });
    });
  }
  function updateSelectionSummary() {
    if (!byId('selectionSummary')) { return; }
    var list = cardsOf(draft), html = '<h2 class="selection-title">' + list.length + ' widget' + (list.length === 1 ? '' : 's') + ' selected</h2>';
    each(list, function (card) { html += '<div class="selected-widget"><span>' + icon(kindIcons[card.type]) + esc(card.title) + '<small>' + esc(kinds[card.type]) + ' · ' + esc(card.entity) + '</small></span><button class="icon-button" data-remove-selected="' + esc(card.id) + '" aria-label="Remove ' + esc(card.title) + '">' + icon('close') + '</button></div>'; });
    byId('selectionSummary').innerHTML = html;
    each(byId('selectionSummary').querySelectorAll('[data-remove-selected]'), function (button) { button.onclick = function () { removeCard(this.getAttribute('data-remove-selected')); updateSelectionSummary(); }; });
    byId('arrangeSetup').textContent = list.length ? 'Arrange dashboard →' : 'Continue with an empty dashboard →';
  }
  function openPicker(section, card) {
    pickerContext = { section: section, card: card || null, modal: true };
    openModal(card ? 'Rebind widget' : 'Add a widget', pickerHtml(true), 'picker'); preparePicker(card ? findCard(draft, card).type : '');
  }
  function openWidgetForm(item, selectedKind) {
    var context = clone(pickerContext), current = context.card ? findCard(draft, context.card) : null;
    var type = current ? current.type : selectedKind || item.widget_types[0], types = current ? [type] : item.widget_types;
    var html = '<p class="entity-id">' + esc(item.entity_id) + '</p><form id="widgetForm"><label for="widgetTitle">Widget title</label><input id="widgetTitle" type="text" maxlength="100" required value="' + esc(current ? current.title : item.attributes.friendly_name || item.entity_id) + '"><div class="field-pair"><div><label for="widgetType">Widget type</label><select id="widgetType">' + kindOptions(types, type) + '</select></div><div><label for="widgetSpan">Width</label><select id="widgetSpan">' + fieldOptions([['1', '1 column'], ['2', '2 columns'], ['3', '3 columns']], current ? current.span : 1) + '</select></div></div><div id="widgetGauge"><div class="field-pair"><div><label for="widgetMin">Minimum</label><input id="widgetMin" type="number" step="any" value="' + esc(current && current.min !== undefined ? current.min : 0) + '"></div><div><label for="widgetMax">Maximum</label><input id="widgetMax" type="number" step="any" value="' + esc(current && current.max !== undefined ? current.max : 100) + '"></div></div><label for="widgetUnit">Unit override (optional)</label><input id="widgetUnit" type="text" maxlength="24" value="' + esc(current ? current.unit || '' : '') + '"></div><div id="widgetVideo"><label for="widgetStream">Native HLS / MP4 URL (optional)</label><input id="widgetStream" type="url" value="' + esc(current ? current.stream_url || '' : '') + '" placeholder="http://stream-server/camera.m3u8"><p class="form-note">Snapshots are the default. Video URLs must be reachable from the iPad and must not contain credentials.</p></div><p class="form-note">Only widget types compatible with this entity are available.</p><p id="widgetError" class="form-note form-error" role="alert"></p><button class="primary-button" type="submit">' + (current ? 'Apply binding' : 'Add widget') + '</button><button class="secondary-button" id="cancelWidget" type="button">Cancel</button></form>';
    openModal(current ? 'Choose a new binding' : 'Configure widget', html, 'widget');
    function optionsVisibility() { byId('widgetGauge').hidden = byId('widgetType').value !== 'gauge'; byId('widgetVideo').hidden = byId('widgetType').value !== 'camera'; }
    optionsVisibility(); byId('widgetType').onchange = optionsVisibility; byId('cancelWidget').onclick = closeModal;
    byId('widgetForm').onsubmit = function (event) {
      event.preventDefault(); var kind = byId('widgetType').value;
      var card = { id: current ? current.id : uid('widget-'), entity: item.entity_id, type: kind, title: byId('widgetTitle').value, span: Number(byId('widgetSpan').value) };
      if (kind === 'gauge') { card.min = Number(byId('widgetMin').value); card.max = Number(byId('widgetMax').value); card.unit = byId('widgetUnit').value; if (!isFinite(card.min) || !isFinite(card.max) || card.max <= card.min) { return formError('widgetError', 'The maximum must be greater than the minimum.'); } }
      if (kind === 'camera') { card.stream_url = byId('widgetStream').value; }
      var section = findSection(draft, context.section);
      if (current) { each(section.cards, function (entry, i) { if (entry.id === current.id) { section.cards[i] = card; } }); } else { section.cards.push(card); }
      closeModal(); if (setupStage === 'entities') { updateSelectionSummary(); } else { renderBuilder(); }
    };
  }
  function removeCard(id) { each(draft.sections, function (section) { section.cards = section.cards.filter(function (card) { return card.id !== id; }); }); }
  function move(list, index, amount) { var target = index + amount; if (target < 0 || target >= list.length) { return; } var item = list.splice(index, 1)[0]; list.splice(target, 0, item); }
  function openEditor() { editing = true; draft = clone(config); byId('viewTitle').textContent = 'Edit dashboard'; byId('dashboard').innerHTML = '<div id="builder"></div>'; renderBuilder(); window.scrollTo(0, 0); }
  function renderBuilder() {
    if (!byId('builder')) { return; }
    var html = '<div class="editor-heading"><div><label for="boardTitle">Dashboard title</label><input id="boardTitle" type="text" maxlength="100" value="' + esc(draft.title) + '"></div><div><label for="boardColumns">Maximum columns</label><select id="boardColumns">' + fieldOptions([['1', 'One'], ['2', 'Two'], ['3', 'Three']], draft.columns) + '</select></div></div>';
    each(draft.sections, function (section, si) {
      html += '<section class="section-editor"><div class="section-editor-head"><div><label for="section-' + esc(section.id) + '">Section title</label><input id="section-' + esc(section.id) + '" type="text" maxlength="100" value="' + esc(section.title) + '" data-section-title="' + esc(section.id) + '"></div><div class="editor-actions"><button class="secondary-button" data-section-up="' + si + '" aria-label="Move section up"' + (!si ? ' disabled' : '') + '>↑</button><button class="secondary-button" data-section-down="' + si + '" aria-label="Move section down"' + (si === draft.sections.length - 1 ? ' disabled' : '') + '>↓</button><button class="danger-button" data-remove-section="' + esc(section.id) + '">Remove section</button></div></div>';
      each(section.cards, function (card, ci) {
        var state = catalog[card.entity] || states[card.entity], types = state && state.widget_types ? state.widget_types : [card.type];
        html += '<div class="widget-editor"><div class="widget-editor-top"><span>' + icon(kindIcons[card.type]) + '<strong>' + esc(card.title) + '</strong><small>' + esc(card.entity) + '</small></span><div class="editor-actions"><button class="secondary-button" data-card-up="' + esc(card.id) + '" aria-label="Move ' + esc(card.title) + ' up"' + (!ci ? ' disabled' : '') + '>↑</button><button class="secondary-button" data-card-down="' + esc(card.id) + '" aria-label="Move ' + esc(card.title) + ' down"' + (ci === section.cards.length - 1 ? ' disabled' : '') + '>↓</button><button class="danger-button" data-remove-card="' + esc(card.id) + '">Remove</button></div></div><div class="editor-fields"><div><label for="title-' + esc(card.id) + '">Title</label><input id="title-' + esc(card.id) + '" type="text" maxlength="100" data-card-field="title" data-card-id="' + esc(card.id) + '" value="' + esc(card.title) + '"></div><div><label for="type-' + esc(card.id) + '">Widget type</label><select id="type-' + esc(card.id) + '" data-card-field="type" data-card-id="' + esc(card.id) + '">' + kindOptions(types, card.type) + '</select></div><div><label for="span-' + esc(card.id) + '">Width</label><select id="span-' + esc(card.id) + '" data-card-field="span" data-card-id="' + esc(card.id) + '">' + fieldOptions([['1', '1 column'], ['2', '2 columns'], ['3', '3 columns']], card.span) + '</select></div><div><label for="move-' + esc(card.id) + '">Section</label><select id="move-' + esc(card.id) + '" data-card-section="' + esc(card.id) + '">' + fieldOptions(draft.sections.map(function (s) { return [s.id, s.title]; }), section.id) + '</select></div></div>';
        if (card.type === 'gauge') { html += '<div class="editor-fields"><div><label for="min-' + esc(card.id) + '">Minimum</label><input id="min-' + esc(card.id) + '" type="number" step="any" data-card-field="min" data-card-id="' + esc(card.id) + '" value="' + esc(card.min === undefined ? 0 : card.min) + '"></div><div><label for="max-' + esc(card.id) + '">Maximum</label><input id="max-' + esc(card.id) + '" type="number" step="any" data-card-field="max" data-card-id="' + esc(card.id) + '" value="' + esc(card.max === undefined ? 100 : card.max) + '"></div><div><label for="unit-' + esc(card.id) + '">Unit override</label><input id="unit-' + esc(card.id) + '" type="text" maxlength="24" data-card-field="unit" data-card-id="' + esc(card.id) + '" value="' + esc(card.unit || '') + '"></div></div>'; }
        if (card.type === 'camera') { html += '<label for="video-' + esc(card.id) + '">Native HLS / MP4 URL (optional)</label><input id="video-' + esc(card.id) + '" type="url" data-card-field="stream_url" data-card-id="' + esc(card.id) + '" value="' + esc(card.stream_url || '') + '">'; }
        html += '<button class="secondary-button" data-rebind="' + esc(card.id) + '" data-section="' + esc(section.id) + '">Rebind entity</button></div>';
      });
      html += '<button class="secondary-button" data-add-widget="' + esc(section.id) + '">' + icon('overview') + ' Add widget</button></section>';
    });
    html += '<button id="addSection" class="secondary-button">+ Add section</button><div class="save-bar"><p id="saveError" class="form-note form-error" role="alert"></p><button id="saveBoard" class="primary-button">' + (setupStage ? 'Finish setup' : 'Save dashboard') + '</button><button id="cancelEditor" class="secondary-button">' + (setupStage ? 'Back to entities' : 'Cancel') + '</button>' + (!setupStage ? '<button id="reloadBoard" class="secondary-button">Reload saved layout</button>' : '') + '</div>';
    byId('builder').innerHTML = html;
    byId('boardTitle').oninput = function () { draft.title = this.value; };
    byId('boardColumns').onchange = function () { draft.columns = Number(this.value); };
    each(byId('builder').querySelectorAll('[data-section-title]'), function (input) { input.oninput = function () { findSection(draft, this.getAttribute('data-section-title')).title = this.value; }; });
    each(byId('builder').querySelectorAll('[data-card-field]'), function (input) { var handler = function () { var card = findCard(draft, this.getAttribute('data-card-id')), field = this.getAttribute('data-card-field'); card[field] = field === 'span' || field === 'min' || field === 'max' ? Number(this.value) : this.value; if (field === 'type') { renderBuilder(); } }; if (input.tagName === 'SELECT') { input.onchange = handler; } else { input.oninput = handler; } });
    each(byId('builder').querySelectorAll('[data-card-section]'), function (input) { input.onchange = function () { var card = findCard(draft, this.getAttribute('data-card-section')); removeCard(card.id); findSection(draft, this.value).cards.push(card); renderBuilder(); }; });
    each(byId('builder').querySelectorAll('[data-add-widget]'), function (button) { button.onclick = function () { openPicker(this.getAttribute('data-add-widget')); }; });
    each(byId('builder').querySelectorAll('[data-rebind]'), function (button) { button.onclick = function () { openPicker(this.getAttribute('data-section'), this.getAttribute('data-rebind')); }; });
    each(byId('builder').querySelectorAll('[data-remove-card]'), function (button) { button.onclick = function () { removeCard(this.getAttribute('data-remove-card')); renderBuilder(); }; });
    each(byId('builder').querySelectorAll('[data-remove-section]'), function (button) { button.onclick = function () { var id = this.getAttribute('data-remove-section'); draft.sections = draft.sections.filter(function (s) { return s.id !== id; }); renderBuilder(); }; });
    each(byId('builder').querySelectorAll('[data-section-up],[data-section-down]'), function (button) { button.onclick = function () { var up = this.hasAttribute('data-section-up'); move(draft.sections, Number(this.getAttribute(up ? 'data-section-up' : 'data-section-down')), up ? -1 : 1); renderBuilder(); }; });
    each(byId('builder').querySelectorAll('[data-card-up],[data-card-down]'), function (button) { button.onclick = function () { var up = this.hasAttribute('data-card-up'), id = this.getAttribute(up ? 'data-card-up' : 'data-card-down'); each(draft.sections, function (section) { for (var i = 0; i < section.cards.length; i++) { if (section.cards[i].id === id) { move(section.cards, i, up ? -1 : 1); break; } } }); renderBuilder(); }; });
    byId('addSection').onclick = function () { draft.sections.push({ id: uid('section-'), title: 'New section', cards: [] }); renderBuilder(); };
    byId('saveBoard').onclick = saveBoard;
    byId('cancelEditor').onclick = function () { if (setupStage) { showAccess('entities'); } else { editing = false; draft = null; render(); } };
    if (byId('reloadBoard')) { byId('reloadBoard').onclick = function () { loadConfig(); }; }
  }
  function saveBoard() {
    draft.onboarding_complete = true; byId('saveBoard').disabled = true;
    request('POST', '/api/config', draft, function (error, result) {
      if (error) { formError('saveError', error); byId('saveBoard').disabled = false; return; }
      config = result; draft = null; editing = false; setupStage = ''; byId('access').hidden = true; byId('app').hidden = false; lastSignature = ''; render(); window.scrollTo(0, 0); poll(); notify('Dashboard saved.');
    });
  }
  function timeText(date) { return ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2); }
  function header(card, state) { return '<div class="widget-heading"><span class="icon-disc">' + icon(kindIcons[card.type]) + '</span><span><strong>' + esc(card.title) + '</strong><small>' + esc(state ? state.attributes.friendly_name || card.entity : card.entity) + '</small></span></div>'; }
  function unavailable(state) { return !state || state.state === 'unknown' || state.state === 'unavailable'; }
  function widget(card) {
    var s = states[card.entity], attrs = s ? s.attributes : {}, enabled = ready(s) && !busy[card.id], value = s ? s.state : 'unavailable', html;
    if (card.type === 'light' || card.type === 'switch' || card.type === 'fan') {
      var on = value === 'on';
      html = '<div class="card control-widget ' + (on ? 'on' : '') + '"><div class="control-heading">' + header(card, s) + '<button class="toggle" role="switch" aria-label="' + esc(card.title) + '" aria-checked="' + on + '" data-toggle="' + esc(card.id) + '"' + (!enabled ? ' disabled' : '') + '></button></div><div class="widget-state">' + (!reachable ? 'Connection lost' : unavailable(s) ? 'Unavailable' : on ? 'On' : 'Off') + '</div>';
      if (card.type === 'light' && on && typeof attrs.brightness === 'number') { html += '<div class="brightness"><span>' + icon('sun') + '</span><input type="range" min="1" max="100" value="' + Math.round(attrs.brightness / 255 * 100) + '" data-range="' + esc(card.id) + '" aria-label="' + esc(card.title) + ' brightness"' + (!enabled ? ' disabled' : '') + '><span class="range-value">' + Math.round(attrs.brightness / 255 * 100) + '%</span></div>'; }
      if (card.type === 'fan' && typeof attrs.percentage === 'number') { html += '<div class="brightness"><span>' + icon('wind') + '</span><input type="range" min="0" max="100" value="' + attrs.percentage + '" data-range="' + esc(card.id) + '" aria-label="' + esc(card.title) + ' speed"' + (!enabled ? ' disabled' : '') + '><span class="range-value">' + esc(attrs.percentage) + '%</span></div>'; }
      return html + '</div>';
    }
    if (card.type === 'gauge') {
      var fraction = unavailable(s) || !numeric(value) ? 0 : Math.max(0, Math.min(1, (Number(value) - card.min) / (card.max - card.min))), unit = card.unit || attrs.unit_of_measurement || '';
      return '<div class="card gauge-card">' + header(card, s) + '<div class="gauge-dial"><svg viewBox="0 0 160 105" aria-hidden="true"><path d="M20 80A60 60 0 01140 80" fill="none" stroke="#e7edf1" stroke-width="9" stroke-linecap="round"/><path d="M20 80A60 60 0 01140 80" fill="none" stroke="#51afd3" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + (fraction * 188.5).toFixed(1) + ' 189"/></svg><div>' + (unavailable(s) ? '—' : esc(displayNumber(value))) + '<small>' + esc(unit) + '</small></div></div><div class="gauge-limits"><span>' + esc(card.min) + '</span><span>' + esc(card.max) + '</span></div>' + (unavailable(s) ? '<p class="form-note">Entity unavailable</p>' : '') + '</div>';
    }
    if (card.type === 'camera') {
      return '<button class="card camera-card" data-camera="' + esc(card.id) + '"><div class="camera-image"><img src="assets/camera-placeholder.svg" alt="' + esc(card.title) + ' snapshot" data-camera-image="' + esc(card.id) + '"><span class="camera-badge" id="camera-badge-' + esc(card.id) + '">' + (enabled ? 'SNAPSHOT' : 'UNAVAILABLE') + '</span><span class="camera-expand">' + icon('expand') + '</span></div><div class="camera-info"><strong>' + esc(card.title) + '</strong><small id="camera-caption-' + esc(card.id) + '">' + (enabled ? 'Loading snapshot…' : 'Camera unavailable') + '</small>' + icon('camera') + '</div></button>';
    }
    if (card.type === 'climate') {
      html = '<div class="card thermostat">' + header(card, s) + '<div class="thermostat-value">' + (numeric(attrs.temperature) ? esc(displayNumber(attrs.temperature)) + '°' : '—') + '</div><div class="temperature-controls"><button class="step-button" data-temperature="' + esc(card.id) + '" data-delta="-1" aria-label="Decrease ' + esc(card.title) + ' temperature"' + (!enabled || !numeric(attrs.temperature) ? ' disabled' : '') + '>−</button><button class="step-button" data-temperature="' + esc(card.id) + '" data-delta="1" aria-label="Increase ' + esc(card.title) + ' temperature"' + (!enabled || !numeric(attrs.temperature) ? ' disabled' : '') + '>+</button></div><p class="form-note">Current: ' + (numeric(attrs.current_temperature) ? esc(displayNumber(attrs.current_temperature)) + '°' : 'unavailable') + '</p>';
      if (attrs.hvac_modes && attrs.hvac_modes.length) { html += '<label class="sr-only" for="hvac-' + esc(card.id) + '">' + esc(card.title) + ' mode</label><select id="hvac-' + esc(card.id) + '" data-hvac="' + esc(card.id) + '"' + (!enabled ? ' disabled' : '') + '>' + fieldOptions(attrs.hvac_modes, value) + '</select>'; }
      return html + '</div>';
    }
    if (card.type === 'weather') { return '<div class="card weather-card">' + header(card, s) + '<div class="weather-main">' + icon(value === 'sunny' || value === 'clear-night' ? 'sun' : 'cloud') + '<span>' + (unavailable(s) ? '—' : esc(displayNumber(attrs.temperature)) + '°') + '</span></div><div class="weather-condition">' + (unavailable(s) ? 'Unavailable' : esc(value.replace(/-/g, ' '))) + '</div><p class="form-note">' + (numeric(attrs.humidity) ? 'Humidity ' + esc(attrs.humidity) + '%' : '') + '</p></div>'; }
    if (card.type === 'scene' || card.type === 'button') { return '<div class="card action-widget">' + header(card, s) + '<button class="primary-button" data-activate="' + esc(card.id) + '"' + (!enabled ? ' disabled' : '') + '>' + (card.type === 'scene' ? 'Activate scene' : 'Run action') + '</button><p class="form-note">' + (unavailable(s) ? 'Unavailable' : 'Ready') + '</p></div>'; }
    if (card.type === 'cover') { return '<div class="card action-widget">' + header(card, s) + '<p class="widget-state">' + esc(value) + (typeof attrs.current_position === 'number' ? ' · ' + esc(attrs.current_position) + '%' : '') + '</p><div class="cover-buttons"><button class="secondary-button" data-cover="' + esc(card.id) + '" data-service="open_cover"' + (!enabled ? ' disabled' : '') + '>Open</button><button class="secondary-button" data-cover="' + esc(card.id) + '" data-service="stop_cover"' + (!enabled ? ' disabled' : '') + '>Stop</button><button class="secondary-button" data-cover="' + esc(card.id) + '" data-service="close_cover"' + (!enabled ? ' disabled' : '') + '>Close</button></div></div>'; }
    var label = value;
    if (card.entity.indexOf('binary_sensor.') === 0 && (value === 'on' || value === 'off')) { label = ['door', 'window', 'opening', 'garage_door'].indexOf(attrs.device_class) >= 0 ? value === 'on' ? 'Open' : 'Closed' : value === 'on' ? 'On' : 'Off'; }
    return '<div class="card sensor-card">' + header(card, s) + '<div class="sensor-value">' + esc(unavailable(s) ? 'Unavailable' : label) + '<small>' + esc(attrs.unit_of_measurement || '') + '</small></div></div>';
  }
  function matchesView(card) { return view === 'overview' || (view === 'lights' && ['light', 'switch'].indexOf(card.type) >= 0) || (view === 'cameras' && card.type === 'camera') || (view === 'climate' && ['climate', 'gauge', 'weather', 'fan'].indexOf(card.type) >= 0); }
  function effectiveColumns() { return window.innerWidth < 621 ? 1 : Math.min(config.columns, window.innerWidth < 851 ? 2 : 3); }
  function boardHtml() {
    var columns = effectiveColumns(), html = '', count = 0; lastColumns = columns;
    each(config.sections, function (section) {
      var cards = section.cards.filter(matchesView); if (!cards.length) { return; }
      html += '<section class="board-section"><h2 class="section-title">' + esc(section.title) + '</h2>'; var used = 0;
      each(cards, function (card) { count++; var span = Math.min(columns, card.span); if (used && used + span > columns) { html += '<div class="board-cell columns-' + columns + ' span-' + (columns - used) + '"></div></div>'; used = 0; } if (!used) { html += '<div class="board-row">'; } html += '<div class="board-cell columns-' + columns + ' span-' + span + '">' + widget(card) + '</div>'; used += span; if (used === columns) { html += '</div>'; used = 0; } });
      if (used) { html += '<div class="board-cell columns-' + columns + ' span-' + (columns - used) + '"></div></div>'; }
      html += '</section>';
    });
    return html || '<div class="card empty-state">' + icon('overview') + '<h2>No widgets here yet.</h2><p>Add the Home Assistant entities you want to see, then choose how to display them.</p><button id="emptyAdd" class="primary-button">Customize dashboard</button></div>';
  }
  function activityHtml() { var html = '<h2 class="section-title">Dashboard activity</h2><div class="card activity-card">'; if (!activities.length) { html += '<p class="empty-state">Successful actions from this dashboard will appear here.</p>'; } each(activities, function (entry) { html += '<div class="activity-row"><span>' + esc(entry.text) + '</span><small>' + timeText(entry.time) + '</small></div>'; }); return html + '</div><p class="form-note">This page session only, not Home Assistant’s full history.</p>'; }
  function updateHeader() {
    if (!config) { return; } var on = 0; each(cardsOf(config), function (card) { var s = states[card.entity]; if ((card.type === 'light' || card.type === 'switch') && s && s.state === 'on') { on++; } });
    byId('navLightCount').textContent = on; byId('greeting').textContent = config.title; document.title = config.title + ' · Ancient Home Assistant';
    byId('connectionBadge').textContent = reachable ? 'Connected' : lastSync ? 'Connection lost' : 'Connecting…'; byId('connectionBadge').className = 'connection-pill' + (reachable ? ' live' : '');
    byId('sidebarStatus').innerHTML = (reachable ? 'Home connected' : 'Connection unavailable') + '<small>' + cardsOf(config).length + ' configured widgets</small>';
    byId('updatedLabel').textContent = lastSync ? (reachable ? 'Updated ' : 'Last update ') + timeText(lastSync) : 'Loading Home Assistant states…';
    byId('viewTitle').textContent = editing ? 'Edit dashboard' : view.charAt(0).toUpperCase() + view.slice(1);
    each(document.querySelectorAll('[data-view]'), function (b) { b.className = 'nav-item' + (b.getAttribute('data-view') === view ? ' selected' : ''); });
    each(document.querySelectorAll('[data-tab]'), function (b) { var selected = b.getAttribute('data-tab') === view; b.className = selected ? 'active' : ''; b.setAttribute('aria-selected', String(selected)); });
  }
  function render() {
    if (!config || editing || !byId('access').hidden) { return; }
    updateHeader(); byId('dashboard').innerHTML = view === 'activity' ? activityHtml() : boardHtml(); bindWidgets(); refreshCameras();
  }
  function go(next) { if (editing) { notify('Save or cancel your layout changes first.'); return; } view = ['overview', 'lights', 'cameras', 'climate', 'activity'].indexOf(next) >= 0 ? next : 'overview'; byId('sidebar').className = 'sidebar'; render(); window.scrollTo(0, 0); }
  function service(card, action, extra, done) {
    if (!ready(states[card.entity]) || busy[card.id]) { return; }
    busy[card.id] = true; var payload = { entity_id: card.entity, domain: card.entity.split('.')[0], service: action };
    for (var key in extra) { if (Object.prototype.hasOwnProperty.call(extra, key)) { payload[key] = extra[key]; } }
    request('POST', '/api/service', payload, function (error) { delete busy[card.id]; if (error) { notify(error.message); render(); } else { render(); activities.unshift({ text: card.title + ' · ' + action.replace(/_/g, ' '), time: new Date() }); if (activities.length > 50) { activities.pop(); } poll(); } if (done) { done(error); } });
  }
  function bindWidgets() {
    each(byId('dashboard').querySelectorAll('[data-toggle]'), function (button) { button.onclick = function () { var card = findCard(config, this.getAttribute('data-toggle')); this.disabled = true; service(card, states[card.entity].state === 'on' ? 'turn_off' : 'turn_on', {}); }; });
    each(byId('dashboard').querySelectorAll('[data-range]'), function (input) { input.oninput = function () { this.parentNode.querySelector('.range-value').textContent = this.value + '%'; }; input.onchange = function () { var card = findCard(config, this.getAttribute('data-range')), extra = {}; extra[card.type === 'fan' ? 'percentage' : 'brightness_pct'] = Number(this.value); service(card, card.type === 'fan' ? 'set_percentage' : 'turn_on', extra); this.blur(); }; });
    each(byId('dashboard').querySelectorAll('[data-activate]'), function (button) { button.onclick = function () { var card = findCard(config, this.getAttribute('data-activate')), domain = card.entity.split('.')[0]; this.disabled = true; service(card, domain === 'button' || domain === 'input_button' ? 'press' : 'turn_on', {}, function (error) { if (!error) { notify('Action sent to Home Assistant.'); } }); }; });
    each(byId('dashboard').querySelectorAll('[data-cover]'), function (button) { button.onclick = function () { service(findCard(config, this.getAttribute('data-cover')), this.getAttribute('data-service'), {}); }; });
    each(byId('dashboard').querySelectorAll('[data-hvac]'), function (select) { select.onchange = function () { service(findCard(config, this.getAttribute('data-hvac')), 'set_hvac_mode', { hvac_mode: this.value }); }; });
    each(byId('dashboard').querySelectorAll('[data-temperature]'), function (button) { button.onclick = function () { var card = findCard(config, this.getAttribute('data-temperature')), attrs = states[card.entity].attributes, target = Number(attrs.temperature) + Number(this.getAttribute('data-delta')) * (Number(attrs.target_temp_step) || 1); service(card, 'set_temperature', { temperature: Math.round(target * 100) / 100 }); }; });
    each(byId('dashboard').querySelectorAll('[data-camera]'), function (button) { button.onclick = function () { openCamera(findCard(config, this.getAttribute('data-camera'))); }; });
    if (byId('emptyAdd')) { byId('emptyAdd').onclick = openEditor; }
  }
  function poll(done) {
    if (!authenticated || !config || editing || !byId('access').hidden || fetching) { if (done) { done(); } return; }
    fetching = true; request('GET', '/api/states', null, function (error, result) {
      fetching = false;
      if (error) { if (error.status === 401) { authenticated = false; closeModal(); showAccess('login'); } else { reachable = false; render(); } if (done) { done(error); } return; }
      var signature = JSON.stringify(result), changed = signature !== lastSignature || !reachable; states = {}; each(result, function (state) { states[state.entity_id] = state; catalog[state.entity_id] = state; }); lastSync = new Date(); reachable = true; lastSignature = signature;
      if (changed && !(document.activeElement && document.activeElement.type === 'range')) { render(); } else { updateHeader(); refreshCameras(); }
      if (done) { done(null); }
    });
  }
  function refreshCameras() {
    if (!reachable || document.hidden) { return; }
    each(byId('dashboard').querySelectorAll('[data-camera-image]'), function (image) {
      var card = findCard(config, image.getAttribute('data-camera-image')), rect = image.getBoundingClientRect(), now = new Date().getTime();
      if (!card || !ready(states[card.entity]) || image.getAttribute('data-loading') === '1' || now - Number(image.getAttribute('data-updated') || 0) < 10000 || rect.top > window.innerHeight || rect.bottom < 0) { return; }
      image.setAttribute('data-loading', '1'); image.setAttribute('data-updated', String(now));
      image.onload = function () { image.setAttribute('data-loading', '0'); var caption = byId('camera-caption-' + card.id); if (caption) { caption.textContent = 'Snapshot · ' + timeText(new Date()); } var badge = byId('camera-badge-' + card.id); if (badge) { badge.textContent = 'SNAPSHOT'; } };
      image.onerror = function () { image.onload = null; image.onerror = null; image.setAttribute('data-loading', '0'); image.src = 'assets/camera-offline.svg'; var caption = byId('camera-caption-' + card.id), badge = byId('camera-badge-' + card.id); if (caption) { caption.textContent = 'No snapshot available'; } if (badge) { badge.textContent = 'UNAVAILABLE'; } };
      image.src = '/api/camera/' + encodeURIComponent(card.entity) + '?t=' + now;
    });
  }
  function openModal(title, html, kind) {
    if (byId('modalBackdrop').hidden) { focusBefore = document.activeElement; }
    modalKind = kind; byId('modalTitle').textContent = title; byId('modalBody').innerHTML = html; byId('modalBackdrop').hidden = false; document.body.style.overflow = 'hidden'; byId('modal').focus();
  }
  function stopCamera() { cameraGeneration++; clearTimeout(cameraTimer); cameraBusy = false; cameraCard = null; var video = byId('cameraVideo'); if (video) { video.pause(); video.removeAttribute('src'); video.load(); } var image = byId('expandedCamera'); if (image) { image.onload = null; image.onerror = null; image.removeAttribute('src'); } }
  function closeModal() { stopCamera(); pickerGeneration++; clearTimeout(pickerTimer); byId('modalBackdrop').hidden = true; byId('modalBody').innerHTML = ''; document.body.style.overflow = ''; modalKind = ''; if (focusBefore && document.body.contains(focusBefore)) { focusBefore.focus(); } }
  function cameraFrame() {
    var image = byId('expandedCamera'); if (!image || !cameraCard || cameraBusy || document.hidden) { return; }
    var generation = cameraGeneration; cameraBusy = true;
    image.onload = function () { if (generation !== cameraGeneration) { return; } cameraBusy = false; if (byId('cameraStatus')) { byId('cameraStatus').textContent = cameraMode === 'snapshot' ? 'Snapshot updated · ' + timeText(new Date()) : 'MJPEG stream'; } if (cameraMode === 'snapshot') { cameraTimer = setTimeout(cameraFrame, 5000); } };
    image.onerror = function () { if (generation !== cameraGeneration) { return; } cameraBusy = false; if (byId('cameraStatus')) { byId('cameraStatus').textContent = 'Camera unavailable. Retrying in 10 seconds.'; } cameraTimer = setTimeout(cameraFrame, 10000); };
    image.src = '/api/camera/' + encodeURIComponent(cameraCard.entity) + (cameraMode === 'mjpeg' ? '/stream' : '') + '?t=' + new Date().getTime();
  }
  function cameraContent() {
    cameraGeneration++; clearTimeout(cameraTimer); cameraBusy = false;
    var video = byId('cameraVideo'); if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    if (cameraMode === 'video') { byId('cameraContent').innerHTML = '<video id="cameraVideo" class="modal-camera" controls preload="none" webkit-playsinline playsinline src="' + esc(cameraCard.stream_url) + '"></video>'; byId('cameraStatus').textContent = 'Tap Play. H.264/AAC HLS or MP4 is required for older Safari.'; byId('cameraVideo').onerror = function () { byId('cameraStatus').textContent = 'Video could not be played. Check the URL and codec, or choose snapshots.'; }; }
    else { byId('cameraContent').innerHTML = '<img id="expandedCamera" class="modal-camera" alt="' + esc(cameraCard.title) + ' camera">'; byId('cameraStatus').textContent = 'Opening camera…'; cameraFrame(); }
  }
  function openCamera(card) { var html = '<div id="cameraContent"></div><label for="cameraMode">Viewing mode</label><select id="cameraMode">' + fieldOptions([['snapshot', 'Snapshots · low load'], ['mjpeg', 'MJPEG · if supported']].concat(card.stream_url ? [['video', 'Native HLS / MP4 video']] : []), 'snapshot') + '</select><p id="cameraStatus" class="form-note" role="status"></p>'; openModal(card.title, html, 'camera'); cameraCard = card; cameraMode = 'snapshot'; cameraContent(); byId('cameraMode').onchange = function () { cameraMode = this.value; cameraContent(); }; }
  function showSettings() {
    if (!authenticated || editing) { if (editing) { notify('Save or cancel your layout changes first.'); } return; }
    var html = '<button id="settingsEdit" class="primary-button">Customize dashboard &amp; widgets</button><h3 class="mapping-heading">Home Assistant connection</h3><p class="form-note">Saved on the server. Leave the token blank to retain it when the address is unchanged.</p><form id="connectionForm"><label for="connectionUrl">Home Assistant URL</label><input id="connectionUrl" type="url" required autocomplete="off"><label for="connectionToken">Replacement long-lived access token</label><input id="connectionToken" type="password" autocomplete="off"><p id="connectionError" class="form-note" role="status"></p><button id="connectionSave" class="secondary-button" type="submit">Update connection</button></form><h3 class="mapping-heading">Dashboard password</h3><form id="passwordForm"><label for="currentPassword">Current password</label><input id="currentPassword" type="password" required autocomplete="current-password"><label for="newPassword">New password</label><input id="newPassword" type="password" required minlength="10" maxlength="256" autocomplete="new-password"><p class="form-note">Changing the password signs out other browsers.</p><p id="passwordError" class="form-note" role="status"></p><button id="passwordSave" class="secondary-button" type="submit">Change password</button></form><h3 class="mapping-heading">This browser</h3><button id="logoutButton" class="secondary-button">Sign out</button>';
    openModal('Settings', html, 'settings'); request('GET', '/api/connection', null, function (error, result) { if (!byId('connectionUrl')) { return; } if (error) { formError('connectionError', error); } else { byId('connectionUrl').value = result.url; } });
    byId('settingsEdit').onclick = function () { closeModal(); openEditor(); }; byId('logoutButton').onclick = logout;
    byId('connectionForm').onsubmit = function (event) { event.preventDefault(); var payload = { url: byId('connectionUrl').value, token: byId('connectionToken').value }; byId('connectionToken').value = ''; byId('connectionSave').disabled = true; request('POST', '/api/connection', payload, function (error) { if (!byId('connectionSave')) { return; } byId('connectionSave').disabled = false; if (error) { formError('connectionError', error); } else { closeModal(); lastSignature = ''; poll(); notify('Home Assistant connection updated.'); } }); };
    byId('passwordForm').onsubmit = function (event) { event.preventDefault(); var payload = { current_password: byId('currentPassword').value, password: byId('newPassword').value }; byId('currentPassword').value = ''; byId('newPassword').value = ''; byId('passwordSave').disabled = true; request('POST', '/api/password', payload, function (error) { if (!byId('passwordSave')) { return; } byId('passwordSave').disabled = false; if (error) { formError('passwordError', error); } else { closeModal(); notify('Dashboard password updated. Other browsers are signed out.'); } }); };
  }
  function logout() { request('POST', '/api/logout', {}, function (error) { if (error) { notify(error.message); return; } closeModal(); config = null; draft = null; states = {}; catalog = {}; authenticated = false; reachable = false; lastSync = null; lastSignature = ''; document.title = 'Ancient Home Assistant'; showAccess('login'); }); }
  function tick() { var date = new Date(), days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']; byId('dateLabel').textContent = (days[date.getDay()] + ', ' + months[date.getMonth()] + ' ' + date.getDate()).toUpperCase(); byId('clock').textContent = timeText(date); }
  var dark = recall('dark', false);
  function applyTheme() { document.documentElement.className = dark ? 'dark' : ''; byId('themeButton').innerHTML = icon(dark ? 'sun' : 'moon'); byId('themeButton').setAttribute('aria-label', 'Switch to ' + (dark ? 'light' : 'dark') + ' theme'); }
  fillIcons(); applyTheme(); tick();
  byId('themeButton').onclick = function () { dark = !dark; store('dark', dark); applyTheme(); };
  byId('menuButton').onclick = function () { byId('sidebar').className = byId('sidebar').className === 'sidebar open' ? 'sidebar' : 'sidebar open'; };
  byId('editButton').onclick = function () { if (!editing) { openEditor(); } };
  byId('settingsButton').onclick = showSettings; byId('closeModal').onclick = closeModal;
  byId('modalBackdrop').onclick = function (event) { if (event.target === this) { closeModal(); } };
  byId('refreshButton').onclick = function () { poll(function (error) { notify(error ? error.message : 'Dashboard refreshed.'); }); };
  each(document.querySelectorAll('[data-view],[data-tab]'), function (button) { button.onclick = function () { go(this.getAttribute('data-view') || this.getAttribute('data-tab')); }; });
  document.addEventListener('keydown', function (event) { if (byId('modalBackdrop').hidden) { return; } if (event.keyCode === 27) { closeModal(); } if (event.keyCode === 9) { var nodes = byId('modal').querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled])'), first = nodes[0], last = nodes[nodes.length - 1]; if (event.shiftKey && (document.activeElement === first || document.activeElement === byId('modal'))) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { clearTimeout(cameraTimer); var image = byId('expandedCamera'); if (image) { image.onload = null; image.onerror = null; image.removeAttribute('src'); cameraBusy = false; } var video = byId('cameraVideo'); if (video) { video.pause(); } } else { tick(); poll(); if (cameraCard && cameraMode !== 'video') { cameraFrame(); } } });
  window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(function () { if (config && !editing && effectiveColumns() !== lastColumns) { render(); } }, 150); });
  window.addEventListener('scroll', refreshCameras);
  setInterval(tick, 30000); setInterval(function () { if (!document.hidden) { poll(); } }, 5000); boot();
}());
