/**
 * Shlok's Parents — Google Apps Script web app
 * Designed & Developed by Shlok's Parents. Approved by Shlok: da, da, da, da!!
 *
 * First time: run setup() once from the editor, then Deploy > New deployment > Web app.
 * See SETUP.md for the full steps.
 */

var TZ = 'Asia/Kolkata';
var USERS = ['arpita', 'mehul'];
var MAX_LEVEL = 6;            // 7 steps: level 0..6
var TOKEN_DAYS = 30;          // stay logged in for 30 days on a phone
var MAX_TRIES = 5;            // wrong PIN tries before lock
var LOCK_MIN = 5;             // lock minutes

var SCHEMA = {
  Users:    ['id', 'name_gu', 'name_en', 'pinHash', 'salt', 'mustChange', 'lang', 'email'],
  Tasks:    ['id', 'owner', 'time', 'ladder', 'gu', 'en', 'kind', 'qty', 'days', 'active', 'createdBy', 'createdAt'],
  Logs:     ['date', 'owner', 'taskId', 'planned', 'status', 'actual', 'reason', 'qty', 'ts'],
  Options:  ['type', 'value', 'createdBy', 'ts'],
  Water:    ['id', 'date', 'owner', 'time', 'ml'],
  Meals:    ['date', 'owner', 'meal', 'time', 'dish', 'sabzi'],
  Medicine: ['date', 'owner', 'time'],
  Calls:    ['id', 'date', 'owner', 'time', 'who'],
  Lists:    ['list', 'owner', 'value', 'active', 'ts'],
  Visits:   ['id', 'date', 'who', 'by'],
  Night:    ['date', 'owner', 'moods', 'energy', 'improve', 'tomorrow', 'note', 'ts'],
  Manifest: ['owner', 'text', 'photoId', 'ts'],
  Todos:    ['id', 'text', 'who', 'due', 'done', 'createdBy', 'createdAt', 'active', 'reminded', 'star', 'doneBy', 'doneAt'],
  DelReq:   ['id', 'etype', 'eid', 'label', 'by', 'at', 'status', 'decidedBy', 'decidedAt'],
  Family:   ['date', 'nightWakings', 'shlokBedtime', 'phonesMehul', 'phonesArpita', 'storyBy', 'story'],
  Reports:  ['weekStart', 'json', 'ts'],
  Settings: ['key', 'value']
};

// ---------------------------------------------------------------- web app

function doGet(e) {
  // background check from the Android app: only the nudge poll is allowed over GET
  if (e && e.parameter && e.parameter.api === 'pollNudges') {
    return ContentService.createTextOutput(api(e.parameter.token, 'pollNudges', {})).setMimeType(ContentService.MimeType.JSON);
  }
  var t = HtmlService.createTemplateFromFile('Index');
  return t.evaluate()
    .setTitle("Shlok's Parents")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .addMetaTag('mobile-web-app-capable', 'yes')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** JSON API used by the phone apps (GitHub Pages / Android / iPhone). */
function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (x) {}
  return ContentService.createTextOutput(api(body.token, body.action, body.payload)).setMimeType(ContentService.MimeType.JSON);
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** Single entry point from the browser. Always returns a JSON string. */
function api(token, action, payload) {
  var lock = null;
  try {
    if (typeof registerFinance_ === 'function') registerFinance_();
    if (typeof registerLife_ === 'function') registerLife_();
    if (typeof registerDetox_ === 'function') registerDetox_();
    var fn = ACTIONS[action];
    if (!fn) throw new Error('Unknown action: ' + action);
    var user = (action === 'login' || action === 'ping') ? null : auth_(token);
    if (WRITES[action]) { lock = LockService.getScriptLock(); lock.waitLock(15000); }
    var data = fn(user, payload || {});
    return JSON.stringify({ ok: true, data: data });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e && e.message || e) });
  } finally {
    if (lock) try { lock.releaseLock(); } catch (x) {}
  }
}

var WRITES = {
  login: 1, logout: 1, changePin: 1, setLang: 1, logTask: 1, addTask: 1, addOption: 1, addWater: 1, delWater: 1,
  setMeal: 1, setMed: 1, addCall: 1, setWant: 1, addVisit: 1, saveNight: 1, saveManifest: 1, addTodo: 1, toggleTodo: 1, starTodo: 1, delCall: 1, delVisit: 1, delTodo: 1,
  requestDelete: 1, decideDelete: 1, withdrawDelete: 1, setFamily: 1, generateReport: 1, setLevel: 1, acceptExp: 1, saveSettings: 1
};

var ACTIONS = {
  ping: function () { return 'ok'; }, login: login_, logout: logout_, changePin: changePin_, setLang: setLang_,
  getDay: getDay_, logTask: logTask_, addTask: addTask_, addOption: addOption_,
  addWater: addWater_, delWater: delWater_, setMeal: setMeal_, setMed: setMed_,
  addCall: addCall_, setWant: setWant_, addVisit: addVisit_, saveNight: saveNight_, saveManifest: saveManifest_,
  getShared: getShared_, addTodo: addTodo_, toggleTodo: toggleTodo_, starTodo: starTodo_, delTodo: delTodo_, delCall: delCall_, delVisit: delVisit_,
  requestDelete: requestDelete_, decideDelete: decideDelete_, withdrawDelete: withdrawDelete_,
  setFamily: setFamily_, getReport: getReport_, generateReport: generateReport_, setLevel: setLevel_, acceptExp: acceptExp_,
  getSettings: getSettings_, saveSettings: saveSettings_
};

// ---------------------------------------------------------------- sheet helpers

function ss_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Run setup() once from the Apps Script editor first.');
  return SpreadsheetApp.openById(id);
}
var SHEET_CACHE_ = {};
function sh_(name) {
  if (!SHEET_CACHE_[name]) SHEET_CACHE_[name] = ss_().getSheetByName(name);
  if (!SHEET_CACHE_[name]) throw new Error('Sheet "' + name + '" is missing. Run setup() once more from the editor.');
  return SHEET_CACHE_[name];
}
function rows_(name) {
  var s = sh_(name);
  var last = s.getLastRow();
  if (last < 2) return [];
  var h = SCHEMA[name];
  var v = s.getRange(2, 1, last - 1, h.length).getValues();
  var out = [];
  for (var i = 0; i < v.length; i++) {
    var o = { _row: i + 2 };
    for (var j = 0; j < h.length; j++) { var c = v[i][j]; o[h[j]] = c === null || c === undefined ? '' : (c instanceof Date ? str_(c) : c); }
    out.push(o);
  }
  return out;
}
function cell_(v) {
  if (v === undefined || v === null) return '';
  var s = String(v);
  return /^[0-9=+\-@]/.test(s) ? "'" + s : s;   // keep times, dates and numbers as plain text
}
function append_(name, obj) {
  var h = SCHEMA[name];
  sh_(name).appendRow(h.map(function (k) { return cell_(obj[k]); }));
}
function update_(name, row, obj) {
  var s = sh_(name), h = SCHEMA[name];
  var cur = s.getRange(row, 1, 1, h.length).getValues()[0].map(function (c) { return cell_(c instanceof Date ? str_(c) : c); });
  for (var j = 0; j < h.length; j++) if (obj[h[j]] !== undefined) cur[j] = cell_(obj[h[j]]);
  s.getRange(row, 1, 1, h.length).setValues([cur]);
}
function deleteRow_(name, row) { sh_(name).deleteRow(row); }
function find_(name, pred) { var r = rows_(name); for (var i = 0; i < r.length; i++) if (pred(r[i])) return r[i]; return null; }
function upsert_(name, pred, obj) {
  var r = find_(name, pred);
  if (r) update_(name, r._row, obj); else append_(name, obj);
}
function setting_(key, def) {
  var r = find_('Settings', function (x) { return x.key === key; });
  return r && r.value !== '' ? String(r.value) : def;
}
function setSetting_(key, value) { upsert_('Settings', function (x) { return x.key === key; }, { key: key, value: value }); }
function uid_() { return Utilities.getUuid().slice(0, 8); }
function nowTime_() { return Utilities.formatDate(new Date(), TZ, 'HH:mm'); }
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function nowIso_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss"); }
var SHEET_TZ_ = null;
function sheetTz_() { if (!SHEET_TZ_) { try { SHEET_TZ_ = ss_().getSpreadsheetTimeZone() || TZ; } catch (e) { SHEET_TZ_ = TZ; } } return SHEET_TZ_; }
function str_(v) {
  if (v instanceof Date) {
    if (v.getFullYear() < 1901) return Utilities.formatDate(v, sheetTz_(), 'HH:mm');  // a time-only cell
    return Utilities.formatDate(v, sheetTz_(), 'yyyy-MM-dd');
  }
  return String(v === null || v === undefined ? '' : v);
}
function mins_(t) { var p = String(t).split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
function addMin_(t, m) { var x = mins_(t) + m; return ('0' + Math.floor(x / 60)).slice(-2) + ':' + ('0' + (x % 60)).slice(-2); }
function dateObj_(d) { var p = d.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0); }
function addDays_(d, n) { var x = dateObj_(d); x.setDate(x.getDate() + n); return Utilities.formatDate(x, TZ, 'yyyy-MM-dd'); }
function weekday_(d) { return dateObj_(d).getDay(); }
function other_(u) { return u === 'arpita' ? 'mehul' : 'arpita'; }
function checkOwner_(user, owner) { if (owner && owner !== user) throw new Error('You can only change your own entries.'); }

// ---------------------------------------------------------------- setup & seed

function setup() {
  if (typeof registerFinance_ === 'function') registerFinance_();
  if (typeof registerLife_ === 'function') registerLife_();
  if (typeof registerDetox_ === 'function') registerDetox_();
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create("Shlok's Parents — Data");
  props.setProperty('SHEET_ID', ss.getId());
  ss.setSpreadsheetTimeZone(TZ);
  Object.keys(SCHEMA).forEach(function (name) {
    var s = ss.getSheetByName(name) || ss.insertSheet(name);
    s.getRange(1, 1, s.getMaxRows(), SCHEMA[name].length).setNumberFormat('@');
    s.getRange(1, 1, 1, SCHEMA[name].length).setValues([SCHEMA[name]]).setFontWeight('bold');
    s.setFrozenRows(1);
  });
  var def = ss.getSheetByName('Sheet1'); if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  SHEET_CACHE_ = {};

  if (rows_('Users').length === 0) {
    seedUser_('arpita', 'ડૉ. અર્પિતા', 'Dr. Arpita', '1111');
    seedUser_('mehul', 'મેહુલ', 'Mehul', '2222');
  }
  if (rows_('Tasks').length === 0) seedTasks_();
  if (rows_('Settings').length === 0) {
    [['level_arpita', '0'], ['level_mehul', '0'], ['water_arpita', '0'], ['water_mehul', '0'],
     ['waterStart', '2500'], ['waterStep', '250'], ['waterMax', '3500'], ['medFor', 'arpita'],
     ['geminiKey', ''], ['geminiModel', 'gemini-2.5-flash'], ['value_gu', 'મદદનો ભાવ'], ['value_en', 'Helpfulness'],
     ['emails', Session.getEffectiveUser().getEmail()]].forEach(function (kv) { append_('Settings', { key: kv[0], value: kv[1] }); });
  }
  installTriggers();
  Logger.log('Setup done. Data sheet: ' + ss.getUrl());
  Logger.log('Starting PINs — Dr. Arpita: 1111, Mehul: 2222 (each must change it at first login).');
}

function seedUser_(id, gu, en, pin) {
  var salt = Utilities.getUuid();
  append_('Users', { id: id, name_gu: gu, name_en: en, pinHash: hash_(pin, salt), salt: salt, mustChange: '1', lang: 'gu', email: '' });
}

function seedTasks_() {
  var L = function (a) { return a.join(','); };
  var mw = ['06:30', '06:15', '06:00', '05:45', '05:30', '05:15', '05:00'];
  var rel = function (m) { return L(mw.map(function (t) { return addMin_(t, m); })); };
  var A = [
    ['A01', '', L(['07:30', '07:15', '07:00', '06:45', '06:30', '06:15', '06:00']), 'ઊઠવું', 'Wake up', 'n', '', 'daily'],
    ['A02', '', L(['07:35', '07:20', '07:10', '06:55', '06:40', '06:25', '06:10']), 'યોગ અને કસરત', 'Yoga & exercise', 'n', '', 'daily'],
    ['A03', '', L(['-', '-', '-', '07:15', '07:00', '06:45', '06:40']), 'મેડિટેશન, 20 મિ.', 'Meditation, 20 min', 'n', '', 'daily'],
    ['A04', '', L(['10:30', '07:40', '07:30', '07:35', '07:25', '07:15', '07:00']), 'નાહવું, તૈયાર થવું', 'Bath & get ready', 'r', '', 'daily'],
    ['A05', '07:50', '', 'મેહુલ પાસેથી શ્લોકની સોંપણી', 'Take over Shlok from Mehul', 'r', '', 'daily'],
    ['A06', '08:00', '', 'શ્લોક જાગે: નાસ્તો કરાવવો', 'Shlok wakes: feed breakfast', 'r', '', 'daily'],
    ['A07', '08:45', '', 'શ્લોક સાથે બગીચો, 1 કલાક', 'Garden with Shlok, 1 hr', 'w', '', 'daily'],
    ['A08', '09:45', '', 'ફોર્મ્યુલા, શ્લોકને નવડાવવો', 'Formula, bathe Shlok', 'r', '', 'daily'],
    ['A09', '10:30', '', 'શ્લોક ઊંઘે: આરામ / ઘરનું કામ', 'Shlok naps: rest / housework', 'r', '', 'daily'],
    ['A10', '11:00', '', 'ઇંગ્લિશ સ્પીકિંગ એપ, 30 મિ.', 'English speaking app, 30 min', 'w', '', 'daily'],
    ['A11', '11:30', '', 'કપડાં + પરિવાર સાથે ફોન-વાત', 'Laundry + call family', 'w', '', 'daily'],
    ['A12', '11:45', '', 'શ્લોક માટે જમવાનું બનાવવું', "Cook Shlok's lunch", 'r', '', 'daily'],
    ['A13', '12:00', '', 'શ્લોકને જમાડવો, સફાઈ', 'Feed Shlok lunch, clean up', 'r', '', 'daily'],
    ['A14', '12:45', '', 'પોતાની રોટલી (ઘઉં સિવાયનું અનાજ)', 'Own roti (non-wheat flour)', 'h', '', 'daily'],
    ['A15', '13:00', '', 'જમવું, કપડાં સૂકવવાં', 'Lunch, dry clothes', 'r', '', 'daily'],
    ['A16', '13:45', '', 'બોટલ ધોવી, ફોર્મ્યુલા ડબીઓ ભરવી', 'Wash bottles, fill formula boxes', 'r', '', 'daily'],
    ['A17', '15:00', '', 'ગાયનું દૂધ, કરિયાણું ઓર્ડર', "Cow's milk, order groceries", 'r', '', 'daily'],
    ['A18', '16:30', '', 'શ્લોક ઊંઘે: ટીવી / OTT, 1 કલાક', 'Shlok naps: TV / OTT, 1 hr', 'w', '', 'daily'],
    ['A19', '18:30', '', 'રાતની રસોઈ + પોતાની રોટલી (શ્લોક મેહુલ સાથે)', 'Cook dinner + own roti (Shlok with Mehul)', 'r', '', 'daily'],
    ['A20', '', L(['21:15', '21:00', '20:45', '20:45', '20:30', '20:30', '20:30']), 'શ્લોકને સુવડાવવો', 'Put Shlok to sleep', 'n', '', 'daily'],
    ['A21', '', L(['21:30', '21:15', '21:00', '21:00', '20:45', '20:45', '20:45']), 'પુસ્તક વાંચન, 30 મિ.', 'Read a book, 30 min', 'w', '', 'daily'],
    ['A22', '', L(['22:10', '22:00', '21:50', '21:40', '21:30', '21:25', '21:20']), 'રાત્રે દૂધ', 'Night milk', 'h', '', 'daily'],
    ['A23', '', L(['22:45', '22:30', '22:15', '22:00', '22:00', '21:45', '21:45']), 'ફોન બહાર, ઊંઘ', 'Phone outside, sleep', 'n', '', 'daily']
  ];
  var M = [
    ['M01', '', L(mw), 'ઊઠવું', 'Wake up', 'n', '', 'daily'],
    ['M02', '', rel(5), 'હૂંફાળું પાણી પીવું', 'Drink warm water', 'h', '', 'daily'],
    ['M03', '', rel(10), 'સૂર્ય નમસ્કાર, 12 આવર્તન', 'Surya Namaskar, 12 rounds', 'h', '', 'daily'],
    ['M04', '', rel(20), 'મેડિટેશન, 10 મિ.', 'Meditation, 10 min', 'h', '', 'daily'],
    ['M05', '', '-,' + rel(30).split(',').slice(1).join(','), 'ઘરે અભ્યાસ: Answer Writing', 'Study at home: answer writing', 's', '', 'daily'],
    ['M06', '07:00', '', 'દોડ, 25 મિ.', 'Run, 25 min', 'h', 'km', '2,4,6'],
    ['M07', '07:25', '', 'કાર ધોવી', 'Wash the car', 'r', '', '0'],
    ['M08', '07:40', '', 'પલાળેલી બદામ-અખરોટ + ફળ (ફરસાણ નહીં)', 'Soaked almonds & walnuts + fruit (no farsan)', 'h', '', 'daily'],
    ['M09', '07:50', '', 'ડૉ. અર્પિતાને શ્લોકની સોંપણી', 'Hand Shlok over to Dr. Arpita', 'r', '', 'daily'],
    ['M10', '08:00', '', 'મમતા IAS અકાદમી: વાંચન, 2.5 કલાક', 'Mamta IAS Academy: reading, 2.5 hrs', 's', '', '1,2,3,4,5,6'],
    ['M11', '10:30', '', 'ઓફિસ', 'Office', 'r', '', '1,2,3,4,5,6'],
    ['M12', '13:30', '', 'ઘરે જમવું + શ્લોક સાથે 15 મિ.', 'Lunch at home + 15 min with Shlok', 'r', '', 'daily'],
    ['M13', '14:00', '', 'Current Affairs, 30 મિ.', 'Current affairs, 30 min', 's', '', 'daily'],
    ['M14', '18:30', '', 'ફક્ત કુટુંબ: શ્લોક સાથે રમત', 'Family only: play with Shlok', 'r', '', 'daily'],
    ['M15', '20:00', '', 'જમવું; ગળ્યાને બદલે વરિયાળી/ખજૂર', 'Dinner; fennel/dates instead of sweets', 'h', '', 'daily'],
    ['M16', '20:15', '', 'જમ્યા પછી 10 મિ. ચાલવું', '10-min walk after dinner', 'h', '', 'daily'],
    ['M17', '20:30', '', 'Notes making, કાગળ પર, 1 કલાક', 'Notes making on paper, 1 hr', 's', '', 'daily'],
    ['M18', '21:20', '', 'રાત્રે દૂધ', 'Night milk', 'h', '', 'daily'],
    ['M19', '21:30', '', 'રાતની ફોર્મ્યુલા તૈયાર, શ્લોક પાસે ઊંઘ', 'Prepare night formula, sleep beside Shlok', 'r', '', 'daily'],
    ['M20', '21:35', '', 'ફોન બહાર', 'Phone outside', 'n', '', 'daily']
  ];
  var add = function (owner) {
    return function (r) {
      append_('Tasks', { id: r[0], owner: owner, time: r[1], ladder: r[2], gu: r[3], en: r[4], kind: r[5], qty: r[6], days: r[7],
        active: '1', createdBy: 'setup', createdAt: nowIso_() });
    };
  };
  A.forEach(add('arpita'));
  M.forEach(add('mehul'));
}

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('dailyReminders').timeBased().everyDays(1).atHour(19).inTimezone(TZ).create();
  ScriptApp.newTrigger('processReceipts').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('weeklyAutoReport').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(20).inTimezone(TZ).create();
}

// ---------------------------------------------------------------- auth

function hash_(pin, salt) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pin + ':shlok', Utilities.Charset.UTF_8);
  return Utilities.base64Encode(b);
}
function auth_(token) {
  if (!token) throw new Error('AUTH');
  var v = PropertiesService.getScriptProperties().getProperty('tok_' + token);
  if (!v) throw new Error('AUTH');
  var p = v.split('|');
  if (+p[1] < Date.now()) { PropertiesService.getScriptProperties().deleteProperty('tok_' + token); throw new Error('AUTH'); }
  return p[0];
}
function checkPin_(user, pin) {
  var cache = CacheService.getScriptCache();
  var lockKey = 'lock_' + user, failKey = 'fail_' + user;
  if (cache.get(lockKey)) throw new Error('LOCKED');
  var u = find_('Users', function (x) { return x.id === user; });
  if (!u) throw new Error('Unknown user');
  if (!/^[0-9]{4}$/.test(String(pin || '')) || hash_(String(pin), u.salt) !== u.pinHash) {
    var f = (+cache.get(failKey) || 0) + 1;
    if (f >= MAX_TRIES) { cache.put(lockKey, '1', LOCK_MIN * 60); cache.remove(failKey); throw new Error('LOCKED'); }
    cache.put(failKey, String(f), LOCK_MIN * 60);
    throw new Error('BADPIN:' + (MAX_TRIES - f));
  }
  cache.remove(failKey);
  return u;
}
function login_(_, p) {
  if (USERS.indexOf(p.user) < 0) throw new Error('Unknown user');
  var u = checkPin_(p.user, p.pin);
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('tok_') === 0 && +String(all[k]).split('|')[1] < Date.now()) props.deleteProperty(k);
  });
  var token = Utilities.getUuid() + Utilities.getUuid().slice(0, 8);
  props.setProperty('tok_' + token, p.user + '|' + (Date.now() + TOKEN_DAYS * 86400000));
  return { token: token, user: p.user, mustChange: String(u.mustChange) === '1', lang: u.lang || 'gu' };
}
function logout_(user, p) { PropertiesService.getScriptProperties().deleteProperty('tok_' + p.token); return true; }
function changePin_(user, p) {
  var u = checkPin_(user, p.oldPin);
  if (!/^[0-9]{4}$/.test(String(p.newPin || ''))) throw new Error('PIN must be 4 digits');
  var salt = Utilities.getUuid();
  update_('Users', u._row, { pinHash: hash_(String(p.newPin), salt), salt: salt, mustChange: '0' });
  return true;
}
function setLang_(user, p) {
  var u = find_('Users', function (x) { return x.id === user; });
  update_('Users', u._row, { lang: p.lang === 'en' ? 'en' : 'gu' });
  return true;
}

// ---------------------------------------------------------------- tasks & day

function level_(owner) { return Math.max(0, Math.min(MAX_LEVEL, +setting_('level_' + owner, '0'))); }
function waterGoal_(owner) {
  var start = +setting_('waterStart', '2500'), step = +setting_('waterStep', '250'), max = +setting_('waterMax', '3500');
  return Math.min(max, start + step * (+setting_('water_' + owner, '0')));
}
function effectiveTime_(t, level) {
  if (t.ladder) {
    var arr = String(t.ladder).split(',');
    var v = arr[Math.min(level, arr.length - 1)];
    return v === '-' ? null : v;
  }
  return str_(t.time) || null;
}
function appliesOn_(t, date) {
  var d = String(t.days || 'daily');
  if (d === 'daily' || d === '') return true;
  if (d.indexOf('once:') === 0) return d.slice(5) === date;
  return d.split(',').indexOf(String(weekday_(date))) >= 0;
}
function tasksFor_(owner, date, level) {
  return rows_('Tasks').filter(function (t) {
    return t.owner === owner && String(t.active) === '1' && appliesOn_(t, date);
  }).map(function (t) {
    var tm = effectiveTime_(t, level);
    if (!tm) return null;
    var goal = null;
    if (t.ladder) { var a = String(t.ladder).split(','); goal = a[a.length - 1]; }
    return { id: t.id, t: tm, gu: t.gu, en: t.en, k: t.kind, q: t.qty || '', goal: goal !== tm ? goal : null };
  }).filter(Boolean).sort(function (a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : 0; });
}

function getDay_(user, p) {
  var owner = p.owner || user, date = p.date || today_();
  var lv = level_(owner);
  var tasks = tasksFor_(owner, date, lv);
  var logs = {};
  rows_('Logs').forEach(function (l) {
    if (str_(l.date) === date && l.owner === owner) logs[l.taskId] = { s: l.status, a: str_(l.actual), r: str_(l.reason), qv: str_(l.qty) };
  });
  tasks.forEach(function (t) {
    var l = logs[t.id];
    t.s = l ? l.s : 'todo'; t.a = l ? l.a : ''; t.r = l ? l.r : ''; t.qv = l ? l.qv : '';
  });
  var pendingDel = {};
  rows_('DelReq').forEach(function (d) { if (d.status === 'pending' && d.etype === 'task') pendingDel[d.eid] = { id: d.id, by: d.by }; });
  tasks.forEach(function (t) { t.del = pendingDel[t.id] || null; });

  var water = rows_('Water').filter(function (w) { return str_(w.date) === date && w.owner === owner; })
    .map(function (w) { return { id: w.id, t: str_(w.time), ml: +w.ml }; });
  var meals = {};
  rows_('Meals').forEach(function (m) {
    if (str_(m.date) === date && m.owner === owner) meals[m.meal] = { t: str_(m.time), dish: str_(m.dish), sabzi: str_(m.sabzi) };
  });
  var med = find_('Medicine', function (m) { return str_(m.date) === date && m.owner === owner; });
  var calls = rows_('Calls').filter(function (c) { return str_(c.date) === date && c.owner === owner; })
    .map(function (c) { return { id: c.id, t: str_(c.time), who: str_(c.who) }; });
  var wants = rows_('Lists').filter(function (l) { return l.list === 'callWant' && l.owner === owner && String(l.active) === '1'; })
    .map(function (l) { return str_(l.value); });
  var night = find_('Night', function (n) { return str_(n.date) === date && n.owner === owner; });
  var man = find_('Manifest', function (m) { return m.owner === owner; });
  var photo = '';
  if (man && man.photoId) {
    try { var f = DriveApp.getFileById(man.photoId); photo = 'data:' + f.getMimeType() + ';base64,' + Utilities.base64Encode(f.getBlob().getBytes()); } catch (e) {}
  }
  var runs = { n: 0, km: 0 };
  var ws = weekStart_(date);
  rows_('Logs').forEach(function (l) {
    var d = str_(l.date);
    if (l.owner === owner && d >= ws && d <= addDays_(ws, 6) && l.status === 'done' && str_(l.qty)) { runs.n++; runs.km += +l.qty || 0; }
  });
  var exp = latestExperiments_(owner);
  var doses = [], due = [];
  if (typeof dosesFor_ === 'function') {
    registerLife_();
    doses = dosesFor_(date, [owner]);
    if (owner === user && date === today_()) {
      var nowT = nowTime_();
      due = dosesFor_(date, [owner, 'shlok']).filter(function (x) { return !x.takenAt && x.time <= nowT; });
    }
  }
  var detoxDue = owner === user && date === today_() && typeof detoxDue_ === 'function' ? (registerDetox_(), detoxDue_(user)) : false;
  var extra2 = owner === user && typeof myNudges_ === 'function' ? { nudges: (registerLife_(), myNudges_(user)), recentWater: waterRecent_(owner) } : { nudges: [], recentWater: [] };
  return {
    nudges: extra2.nudges, recentWater: extra2.recentWater, detoxDue: detoxDue, doses: doses, due: due,
    owner: owner, date: date, level: lv, maxLevel: MAX_LEVEL, tasks: tasks,
    water: water, waterGoal: waterGoal_(owner), meals: meals,
    med: med ? { t: str_(med.time) } : null, medFor: setting_('medFor', 'arpita').split(',').indexOf(owner) >= 0,
    calls: calls, wants: wants,
    night: night ? { moods: JSON.parse(night.moods || '[]'), energy: +night.energy || 0, improve: JSON.parse(night.improve || '[]'), tomorrow: str_(night.tomorrow), note: str_(night.note), ts: str_(night.ts) } : null,
    manifest: { text: man ? str_(man.text) : '', photo: photo },
    options: optionsAll_(), runs: runs, experiments: exp,
    yesterdayTomorrow: (function () {
      var y = find_('Night', function (n) { return str_(n.date) === addDays_(date, -1) && n.owner === owner; });
      return y ? str_(y.tomorrow) : '';
    })()
  };
}
function optionsAll_() {
  var o = {};
  rows_('Options').forEach(function (r) { (o[r.type] = o[r.type] || []).push(str_(r.value)); });
  return o;
}
function latestExperiments_(owner) {
  var r = rows_('Reports');
  if (!r.length) return [];
  r.sort(function (a, b) { return str_(a.weekStart) < str_(b.weekStart) ? 1 : -1; });
  try {
    var j = JSON.parse(r[0].json);
    return (j.ai && j.ai.experiments || []).filter(function (e, i) { return e.owner === owner && (j.accepted || []).indexOf(i) >= 0; });
  } catch (e) { return []; }
}

function logTask_(user, p) {
  var date = p.date || today_();
  var t = find_('Tasks', function (x) { return x.id === p.taskId; });
  if (!t) throw new Error('Task not found');
  checkOwner_(user, t.owner);
  var planned = effectiveTime_(t, level_(t.owner)) || '';
  var obj = { date: date, owner: t.owner, taskId: p.taskId, planned: planned, status: p.status || 'todo',
    actual: p.actual || '', reason: p.reason || '', qty: p.qty === undefined ? undefined : p.qty, ts: nowIso_() };
  var ex = find_('Logs', function (l) { return str_(l.date) === date && l.taskId === p.taskId; });
  if (ex) { if (obj.qty === undefined) delete obj.qty; update_('Logs', ex._row, obj); }
  else { if (obj.qty === undefined) obj.qty = ''; append_('Logs', obj); }
  return true;
}
function addTask_(user, p) {
  var name = String(p.name || '').trim();
  if (!name) throw new Error('Name required');
  if (!/^\d\d:\d\d$/.test(p.time || '')) throw new Error('Time required');
  var id = 'U' + uid_();
  append_('Tasks', { id: id, owner: user, time: p.time, ladder: '', gu: name, en: name, kind: p.kind || 'r', qty: p.qty || '',
    days: p.daily ? 'daily' : 'once:' + (p.date || today_()), active: '1', createdBy: user, createdAt: nowIso_() });
  return { id: id };
}
function addOption_(user, p) {
  var v = String(p.value || '').trim();
  if (!v) throw new Error('Empty');
  if (!find_('Options', function (o) { return o.type === p.type && str_(o.value) === v; }))
    append_('Options', { type: p.type, value: v, createdBy: user, ts: nowIso_() });
  return true;
}

// ---------------------------------------------------------------- water, meals, medicine, calls, night, manifest

function addWater_(user, p) {
  var ml = Math.round(+p.ml);
  if (!(ml > 0 && ml < 5000)) throw new Error('Invalid ml');
  var id = uid_();
  append_('Water', { id: id, date: p.date || today_(), owner: user, time: p.time || nowTime_(), ml: ml });
  return { id: id };
}
function delWater_(user, p) {
  var r = find_('Water', function (w) { return w.id === p.id; });
  if (r) { checkOwner_(user, r.owner); deleteRow_('Water', r._row); }
  return true;
}
function setMeal_(user, p) {
  var date = p.date || today_();
  upsert_('Meals', function (m) { return str_(m.date) === date && m.owner === user && m.meal === p.meal; },
    { date: date, owner: user, meal: p.meal, time: p.time || nowTime_(), dish: p.dish || '', sabzi: p.sabzi || '' });
  return true;
}
function setMed_(user, p) {
  var date = p.date || today_();
  var r = find_('Medicine', function (m) { return str_(m.date) === date && m.owner === user; });
  if (p.taken) { if (r) update_('Medicine', r._row, { time: p.time || nowTime_() }); else append_('Medicine', { date: date, owner: user, time: p.time || nowTime_() }); }
  else if (r) deleteRow_('Medicine', r._row);
  return true;
}
function addCall_(user, p) {
  var who = String(p.who || '').trim(); if (!who) throw new Error('Who?');
  append_('Calls', { id: uid_(), date: p.date || today_(), owner: user, time: p.time || nowTime_(), who: who });
  var w = find_('Lists', function (l) { return l.list === 'callWant' && l.owner === user && str_(l.value) === who && String(l.active) === '1'; });
  if (w) update_('Lists', w._row, { active: '0' });
  return true;
}
/** Adds or removes names on the "want to call" (mine) or "want to visit" (both) list. value can hold several names. */
function setWant_(user, p) {
  var list = p.list === 'visitWant' ? 'visitWant' : 'callWant';
  var owner = list === 'visitWant' ? 'both' : user;
  var vals = (Array.isArray(p.values) ? p.values : String(p.value || '').split(/[,\n]/)).map(function (v) { return String(v).trim(); })
    .filter(function (v, i, a) { return v && a.indexOf(v) === i; });
  if (!vals.length) throw new Error('Empty');
  var all = rows_('Lists');
  vals.forEach(function (v) {
    var w = all.filter(function (l) { return l.list === list && l.owner === owner && str_(l.value) === v; })[0];
    if (w) update_('Lists', w._row, { active: p.on ? '1' : '0', ts: nowIso_() });
    else if (p.on) append_('Lists', { list: list, owner: owner, value: v, active: '1', ts: nowIso_() });
    if (p.on) addOptionIfNew_(list === 'visitWant' ? 'homes' : 'people', v);
  });
  return true;
}
function addOptionIfNew_(type, v) {
  try { if (!find_('Options', function (o) { return o.type === type && str_(o.value) === v; })) addOption_(null, { type: type, value: v }); } catch (e) {}
}
function delCall_(user, p) {
  var r = find_('Calls', function (x) { return x.id === p.id && x.owner === user; });
  if (r) deleteRow_('Calls', r._row);
  return true;
}
function delVisit_(user, p) {
  var r = find_('Visits', function (x) { return x.id === p.id; });
  if (r) deleteRow_('Visits', r._row);
  return true;
}
function addVisit_(user, p) {
  var who = String(p.who || '').trim(); if (!who) throw new Error('Who?');
  append_('Visits', { id: uid_(), date: p.date || today_(), who: who, by: user });
  setWant_(user, { list: 'visitWant', value: who, on: false });
  return true;
}
function saveNight_(user, p) {
  var date = p.date || today_();
  upsert_('Night', function (n) { return str_(n.date) === date && n.owner === user; },
    { date: date, owner: user, moods: JSON.stringify(p.moods || []), energy: p.energy || '', improve: JSON.stringify(p.improve || []),
      tomorrow: p.tomorrow || '', note: p.note || '', ts: nowTime_() });
  return { ts: nowTime_() };
}
function saveManifest_(user, p) {
  var r = find_('Manifest', function (m) { return m.owner === user; });
  var photoId = r ? str_(r.photoId) : '';
  if (p.removePhoto && photoId) { try { DriveApp.getFileById(photoId).setTrashed(true); } catch (e) {} photoId = ''; }
  if (p.photo) {
    var m = String(p.photo).match(/^data:(image\/[a-z+]+);base64,(.+)$/);
    if (!m) throw new Error('Bad image');
    var folder = appFolder_();
    if (photoId) { try { DriveApp.getFileById(photoId).setTrashed(true); } catch (e) {} }
    var f = folder.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], 'manifest_' + user + '_' + Date.now()));
    photoId = f.getId();
  }
  var obj = { owner: user, text: p.text === undefined ? (r ? r.text : '') : p.text, photoId: photoId, ts: nowIso_() };
  if (r) update_('Manifest', r._row, obj); else append_('Manifest', obj);
  return true;
}
function appFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var f = DriveApp.createFolder("Shlok's Parents — Photos");
  props.setProperty('FOLDER_ID', f.getId());
  return f;
}

// ---------------------------------------------------------------- shared view

function getShared_(user, p) {
  var date = p.date || today_();
  var todos = rows_('Todos').filter(function (t) { return String(t.active) === '1'; }).map(function (t) {
    return { id: t.id, text: str_(t.text), who: t.who, due: str_(t.due), done: String(t.done) === '1', by: t.createdBy,
      star: String(t.star) === '1', doneBy: t.doneBy || '', doneAt: str_(t.doneAt) };
  });
  var reqs = rows_('DelReq');
  var pendingTodo = {};
  reqs.forEach(function (r) { if (r.status === 'pending' && r.etype === 'todo') pendingTodo[r.eid] = { id: r.id, by: r.by }; });
  todos.forEach(function (t) { t.del = pendingTodo[t.id] || null; });
  todos.sort(function (a, b) { return (a.done - b.done) || (b.star - a.star) || ((a.due || '9') < (b.due || '9') ? -1 : 1); });
  todos = todos.filter(function (t) { return !t.done || t.doneAt.slice(0, 10) >= addDays_(date, -7) || !t.doneAt; }).slice(0, 60);
  var forMe = reqs.filter(function (r) { return r.status === 'pending' && r.by !== user; })
    .map(function (r) { return { id: r.id, etype: r.etype, label: str_(r.label), by: r.by, at: str_(r.at) }; });
  var recent = reqs.filter(function (r) { return r.status !== 'pending' && str_(r.decidedAt) >= addDays_(date, -3); })
    .map(function (r) { return { id: r.id, label: str_(r.label), status: r.status, by: r.by, decidedBy: r.decidedBy }; });
  var fam = {};
  rows_('Family').forEach(function (f) { fam[str_(f.date)] = f; });
  var nights = [];
  for (var i = 6; i >= 0; i--) {
    var d = addDays_(date, -i), f = fam[d];
    nights.push({ date: d, wd: weekday_(d), wakings: f && f.nightWakings !== '' ? +f.nightWakings : null,
      bedtime: f ? str_(f.shlokBedtime) : '', phonesM: f ? String(f.phonesMehul) === '1' : false, phonesA: f ? String(f.phonesArpita) === '1' : false });
  }
  var today = fam[date] || {};
  var visits = rows_('Visits').map(function (v) { return { id: v.id, date: str_(v.date), who: str_(v.who), by: v.by }; })
    .sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 12);
  var cw = rows_('Lists').filter(function (l) { return l.list === 'callWant' && l.owner === user && String(l.active) === '1'; }).map(function (l) { return str_(l.value); });
  var vw = rows_('Lists').filter(function (l) { return l.list === 'visitWant' && String(l.active) === '1'; }).map(function (l) { return str_(l.value); });
  return {
    date: date, todos: todos, forMe: forMe, recent: recent, nights: nights,
    today: { wakings: today.nightWakings === undefined || today.nightWakings === '' ? null : +today.nightWakings, bedtime: str_(today.shlokBedtime || ''),
      phonesM: String(today.phonesMehul) === '1', phonesA: String(today.phonesArpita) === '1', storyBy: str_(today.storyBy || ''), story: str_(today.story || '') },
    visits: visits, visitWants: vw, callWants: cw, options: optionsAll_(),
    value: { gu: setting_('value_gu', ''), en: setting_('value_en', '') },
    levels: { arpita: level_('arpita'), mehul: level_('mehul') }
  };
}
function addTodo_(user, p) {
  var tx = String(p.text || '').trim(); if (!tx) throw new Error('Empty');
  append_('Todos', { id: uid_(), text: tx, who: p.who || 'both', due: p.due || '', done: '0', createdBy: user, createdAt: nowIso_(), active: '1',
    reminded: '', star: p.star ? '1' : '0', doneBy: '', doneAt: '' });
  return true;
}
function toggleTodo_(user, p) {
  var r = find_('Todos', function (t) { return t.id === p.id; });
  if (r) { var d = String(r.done) === '1'; update_('Todos', r._row, { done: d ? '0' : '1', doneBy: d ? '' : user, doneAt: d ? '' : nowIso_() }); }
  return true;
}
function starTodo_(user, p) {
  var r = find_('Todos', function (t) { return t.id === p.id; });
  if (r) update_('Todos', r._row, { star: String(r.star) === '1' ? '0' : '1' });
  return true;
}
/** A to-do added by mistake can be removed by the person who added it within 10 minutes, without approval. */
function delTodo_(user, p) {
  var r = find_('Todos', function (t) { return t.id === p.id; });
  if (!r) return true;
  if (r.createdBy !== user || ageHours_(str_(r.createdAt)) > 1 / 6) throw new Error('Needs both approvals');
  update_('Todos', r._row, { active: '0' });
  return true;
}
function setFamily_(user, p) {
  var date = p.date || today_();
  var allowed = { nightWakings: 1, shlokBedtime: 1, phonesMehul: 1, phonesArpita: 1, storyBy: 1, story: 1 };
  if (!allowed[p.field]) throw new Error('Bad field');
  if (p.field === 'phonesMehul') checkOwner_(user, 'mehul');
  if (p.field === 'phonesArpita') checkOwner_(user, 'arpita');
  var obj = { date: date }; obj[p.field] = p.value;
  upsert_('Family', function (f) { return str_(f.date) === date; }, obj);
  return true;
}

// ---------------------------------------------------------------- two-person delete

function requestDelete_(user, p) {
  checkPin_(user, p.pin);
  if (p.etype !== 'task' && p.etype !== 'todo') throw new Error('Bad type');
  var label = '';
  if (p.etype === 'task') { var t = find_('Tasks', function (x) { return x.id === p.eid; }); if (!t) throw new Error('Not found'); label = t.gu + ' / ' + t.en; }
  else { var d = find_('Todos', function (x) { return x.id === p.eid; }); if (!d) throw new Error('Not found'); label = d.text; }
  if (find_('DelReq', function (r) { return r.status === 'pending' && r.eid === p.eid; })) return true;
  append_('DelReq', { id: uid_(), etype: p.etype, eid: p.eid, label: label, by: user, at: nowIso_(), status: 'pending', decidedBy: '', decidedAt: '' });
  return true;
}
function decideDelete_(user, p) {
  var r = find_('DelReq', function (x) { return x.id === p.id; });
  if (!r || r.status !== 'pending') throw new Error('Request not found');
  if (r.by === user) throw new Error('The other person must approve.');
  if (p.approve) {
    checkPin_(user, p.pin);
    if (r.etype === 'task') { var t = find_('Tasks', function (x) { return x.id === r.eid; }); if (t) update_('Tasks', t._row, { active: '0' }); }
    else { var d = find_('Todos', function (x) { return x.id === r.eid; }); if (d) update_('Todos', d._row, { active: '0' }); }
  }
  update_('DelReq', r._row, { status: p.approve ? 'approved' : 'declined', decidedBy: user, decidedAt: nowIso_() });
  return true;
}
function withdrawDelete_(user, p) {
  var r = find_('DelReq', function (x) { return x.id === p.id; });
  if (r && r.by === user && r.status === 'pending') update_('DelReq', r._row, { status: 'withdrawn', decidedBy: user, decidedAt: nowIso_() });
  return true;
}

// ---------------------------------------------------------------- weekly report

function weekStart_(date) { var wd = weekday_(date); return addDays_(date, -((wd + 6) % 7)); } // Monday

function weekStats_(ws) {
  var we = addDays_(ws, 6);
  var inWeek = function (d) { d = str_(d); return d >= ws && d <= we; };
  var tasksAll = rows_('Tasks');
  var logs = rows_('Logs').filter(function (l) { return inWeek(l.date); });
  var water = rows_('Water').filter(function (w) { return inWeek(w.date); });
  var med = rows_('Medicine').filter(function (m) { return inWeek(m.date); });
  var night = rows_('Night').filter(function (n) { return inWeek(n.date); });
  var meals = rows_('Meals').filter(function (m) { return inWeek(m.date); });
  var fam = rows_('Family').filter(function (f) { return inWeek(f.date); });
  var lastDay = we < today_() ? we : today_();
  var out = { weekStart: ws, weekEnd: we, people: {} };
  USERS.forEach(function (u) {
    var lv = level_(u);
    var per = {};
    tasksAll.filter(function (t) { return t.owner === u && String(t.active) === '1'; }).forEach(function (t) {
      var sched = 0;
      for (var i = 0; i < 7; i++) { var dd = addDays_(ws, i); if (dd <= lastDay && appliesOn_(t, dd) && effectiveTime_(t, lv)) sched++; }
      if (sched) per[t.id] = { id: t.id, gu: t.gu, en: t.en, kind: t.kind, scheduled: sched, done: 0, late: 0, skipped: 0, reasons: {} };
    });
    var reasons = {}, days = {};
    logs.filter(function (l) { return l.owner === u; }).forEach(function (l) {
      var x = per[l.taskId]; if (!x) return;
      var d = str_(l.date); days[d] = days[d] || { done: 0, skipped: 0 };
      if (l.status === 'done') {
        x.done++; days[d].done++;
        if (str_(l.actual) && str_(l.planned) && mins_(str_(l.actual)) - mins_(str_(l.planned)) > 10) x.late++;
      } else if (l.status === 'skip') {
        x.skipped++; days[d].skipped++;
        var r = str_(l.reason) || '?'; x.reasons[r] = (x.reasons[r] || 0) + 1; reasons[r] = (reasons[r] || 0) + 1;
      }
    });
    var wTot = {}; water.filter(function (w) { return w.owner === u; }).forEach(function (w) { var d = str_(w.date); wTot[d] = (wTot[d] || 0) + (+w.ml || 0); });
    var goal = waterGoal_(u);
    var nightU = night.filter(function (n) { return n.owner === u; });
    var moodCount = {}, impCount = {}, energies = [], tomorrow = [];
    nightU.forEach(function (n) {
      JSON.parse(n.moods || '[]').forEach(function (m) { moodCount[m] = (moodCount[m] || 0) + 1; });
      JSON.parse(n.improve || '[]').forEach(function (m) { impCount[m] = (impCount[m] || 0) + 1; });
      if (+n.energy) energies.push({ date: str_(n.date), e: +n.energy });
      if (str_(n.tomorrow)) tomorrow.push(str_(n.tomorrow));
    });
    var treat = 0;
    meals.filter(function (m) { return m.owner === u; }).forEach(function (m) {
      if (/ફરસાણ|મીઠાઈ|આઇસક્રીમ|બહાર|Farsan|Sweets|ice cream|Outside/i.test(str_(m.dish))) treat++;
    });
    // wake task consistency for level decision
    var wakeT = tasksAll.filter(function (t) { return t.owner === u && t.kind === 'n' && t.ladder && String(t.active) === '1'; })
      .sort(function (a, b) { return a.id < b.id ? -1 : 1; })[0];
    var wakeOk = 0;
    if (wakeT) logs.forEach(function (l) {
      if (l.owner === u && l.taskId === wakeT.id && l.status === 'done' && str_(l.actual) && str_(l.planned) && mins_(str_(l.actual)) - mins_(str_(l.planned)) <= 15) wakeOk++;
    });
    var waterOk = Object.keys(wTot).filter(function (d) { return wTot[d] >= goal; }).length;
    var list = Object.keys(per).map(function (k) { return per[k]; });
    var sched = list.reduce(function (s, x) { return s + x.scheduled; }, 0);
    var done = list.reduce(function (s, x) { return s + x.done; }, 0);
    var onTime = list.reduce(function (s, x) { return s + x.done - x.late; }, 0);
    out.people[u] = {
      level: lv, tasks: list, scheduled: sched, done: done, onTime: onTime, reasons: reasons, days: days,
      water: { goal: goal, perDay: wTot, daysOk: waterOk }, medDays: med.filter(function (m) { return m.owner === u; }).length,
      moods: moodCount, improve: impCount, energy: energies, tomorrow: tomorrow, treats: treat,
      wakeOk: wakeOk, suggestAdvance: wakeOk >= 5 && lv < MAX_LEVEL, suggestWater: waterOk >= 5
    };
  });
  if (typeof registerLife_ === 'function') {
    registerLife_();
    var mt = {}; rows_('Media').forEach(function (m) { mt[m.id] = str_(m.title); });
    rows_('Learnings').forEach(function (l) {
      var d = str_(l.date); if (d < ws || d > we || !out.people[l.owner]) return;
      (out.people[l.owner].learnings = out.people[l.owner].learnings || []).push({ date: d, title: mt[l.mediaId] || '', text: str_(l.text) });
    });
  }
  out.family = fam.map(function (f) { return { date: str_(f.date), wakings: str_(f.nightWakings), bedtime: str_(f.shlokBedtime) }; });
  return out;
}

function getReport_(user, p) {
  var ws = p.weekStart || weekStart_(today_());
  var r = find_('Reports', function (x) { return str_(x.weekStart) === ws; });
  var stats = weekStats_(ws);
  var saved = r ? JSON.parse(r.json) : null;
  return { weekStart: ws, stats: stats, ai: saved ? saved.ai : null, accepted: saved ? (saved.accepted || []) : [], ts: r ? str_(r.ts) : '',
    hasKey: !!setting_('geminiKey', '') };
}

function generateReport_(user, p) {
  var ws = p.weekStart || weekStart_(today_());
  var stats = weekStats_(ws);
  var ai = null;
  var key = setting_('geminiKey', '');
  if (key) { try { ai = gemini_(stats, key); } catch (e) { ai = ruleReport_(stats); ai.error = String(e.message || e); } }
  else ai = ruleReport_(stats);
  var r = find_('Reports', function (x) { return str_(x.weekStart) === ws; });
  var json = JSON.stringify({ ai: ai, accepted: [] });
  if (r) update_('Reports', r._row, { json: json, ts: nowIso_() }); else append_('Reports', { weekStart: ws, json: json, ts: nowIso_() });
  return getReport_(user, { weekStart: ws });
}

function gemini_(stats, key) {
  var compact = JSON.stringify(stats);
  var prompt = [
    "You are the family coach inside the private app \"Shlok's Parents\" used by a Gujarati couple: Mehul (government officer preparing for GPSC/UPSC, sleeps with their 15-month-old son Shlok at night) and Dr. Arpita (dentist, at home with Shlok during the day).",
    'Below is one week of their logged data as JSON (tasks scheduled/done/late/skipped with reasons, water, medicine days, night check-ins with moods, energy and what they want to improve, family night-wakings).',
    'Write a short, warm, practical weekly review. Find ROOT CAUSES that connect entries across days (for example: late sleep -> missed morning yoga), not just counts.',
    'Never shame. Be specific with times and tasks. Suggest only small, realistic changes.',
    'Return ONLY JSON with this shape:',
    '{"summary_gu": string, "summary_en": string,',
    ' "causes": [{"owner": "arpita"|"mehul"|"both", "chain_gu": [string, string, string], "chain_en": [string, string, string], "advice_gu": string, "advice_en": string}],',
    ' "experiments": [{"owner": "arpita"|"mehul"|"both", "text_gu": string, "text_en": string}],',
    ' "levelAdvice": {"arpita": "advance"|"hold", "mehul": "advance"|"hold"}}',
    'Give 1-2 causes and exactly 2 experiments for next week. Gujarati text must be natural Gujarati in Gujarati script.',
    'DATA:', compact
  ].join('\n');
  var j = geminiJson_([{ text: prompt }], undefined, 0.4);
  j.source = 'gemini';
  return j;
}

function ruleReport_(stats) {
  var causes = [], exps = [];
  USERS.forEach(function (u) {
    var s = stats.people[u];
    var top = Object.keys(s.reasons).sort(function (a, b) { return s.reasons[b] - s.reasons[a]; })[0];
    var worst = s.tasks.filter(function (t) { return t.scheduled >= 3; })
      .sort(function (a, b) { return (a.done / a.scheduled) - (b.done / b.scheduled); })[0];
    if (worst && top) {
      causes.push({ owner: u,
        chain_gu: ['સૌથી વધુ કારણ: ' + top + ' (' + s.reasons[top] + ' વાર)', '"' + worst.gu + '" ' + worst.scheduled + ' માંથી ' + worst.done + ' વાર થયું', 'આ કારણ પર પહેલાં કામ કરો'],
        chain_en: ['Most common reason: ' + top + ' (' + s.reasons[top] + 'x)', '"' + worst.en + '" done ' + worst.done + ' of ' + worst.scheduled, 'Work on this reason first'],
        advice_gu: 'આવતા અઠવાડિયે ફક્ત "' + worst.gu + '" ને સમયસર કરવાનું લક્ષ્ય રાખો.',
        advice_en: 'Next week, aim only to do "' + worst.en + '" on time.' });
      exps.push({ owner: u, text_gu: '"' + worst.gu + '" માટે 10 મિનિટ પહેલાં રિમાઇન્ડર રાખો.', text_en: 'Set a reminder 10 minutes before "' + worst.en + '".' });
    }
  });
  if (exps.length < 2) exps.push({ owner: 'both', text_gu: '21:30 પછી બંનેના ફોન બેડરૂમની બહાર.', text_en: 'Both phones outside the bedroom after 21:30.' });
  return {
    source: 'rules',
    summary_gu: 'આ અહેવાલ નિયમો પરથી બન્યો છે. વધુ ઊંડું વિશ્લેષણ માટે સેટિંગ્સમાં Gemini key ઉમેરો.',
    summary_en: 'This report was built from simple rules. Add a Gemini key in Settings for deeper analysis.',
    causes: causes.slice(0, 2), experiments: exps.slice(0, 2),
    levelAdvice: { arpita: stats.people.arpita.suggestAdvance ? 'advance' : 'hold', mehul: stats.people.mehul.suggestAdvance ? 'advance' : 'hold' }
  };
}

function setLevel_(user, p) {
  var owner = p.owner;
  if (USERS.indexOf(owner) < 0) throw new Error('Bad owner');
  if (p.kind === 'water') {
    var w = Math.max(0, +setting_('water_' + owner, '0') + (p.delta || 0));
    setSetting_('water_' + owner, String(w));
  } else {
    var l = Math.max(0, Math.min(MAX_LEVEL, level_(owner) + (p.delta || 0)));
    setSetting_('level_' + owner, String(l));
  }
  return { level: level_(owner), waterGoal: waterGoal_(owner) };
}
function acceptExp_(user, p) {
  var r = find_('Reports', function (x) { return str_(x.weekStart) === p.weekStart; });
  if (!r) throw new Error('No report');
  var j = JSON.parse(r.json);
  j.accepted = j.accepted || [];
  var i = j.accepted.indexOf(p.index);
  if (i >= 0) j.accepted.splice(i, 1); else j.accepted.push(p.index);
  update_('Reports', r._row, { json: JSON.stringify(j) });
  return j.accepted;
}

// ---------------------------------------------------------------- settings

function getSettings_(user) {
  return { hasKey: !!setting_('geminiKey', ''), hasKey2: !!setting_('geminiKey2', ''), model: setting_('geminiModel', 'gemini-2.5-flash'), emails: setting_('emails', ''),
    value_gu: setting_('value_gu', ''), value_en: setting_('value_en', ''), medFor: setting_('medFor', 'arpita'),
    levels: { arpita: level_('arpita'), mehul: level_('mehul') }, water: { arpita: waterGoal_('arpita'), mehul: waterGoal_('mehul') },
    sheetUrl: ss_().getUrl() };
}
function saveSettings_(user, p) {
  if (p.geminiKey !== undefined && p.geminiKey !== '') setSetting_('geminiKey', String(p.geminiKey).trim());
  if (p.clearKey) setSetting_('geminiKey', '');
  if (p.geminiKey2 !== undefined && p.geminiKey2 !== '') setSetting_('geminiKey2', String(p.geminiKey2).trim());
  if (p.clearKey2) setSetting_('geminiKey2', '');
  ['geminiModel', 'emails', 'value_gu', 'value_en'].forEach(function (k) { if (p[k] !== undefined) setSetting_(k, String(p[k]).trim()); });
  return getSettings_(user);
}

// ---------------------------------------------------------------- triggers

function dailyReminders() {
  try { if (typeof financeDaily_ === 'function') financeDaily_(); } catch (e) {}
}
function weeklyAutoReport() {
  generateReport_('mehul', { weekStart: weekStart_(today_()) });
  try { if (typeof registerFinance_ === 'function') { registerFinance_(); finAnalysis_('mehul', { mode: 'week' }); } } catch (e) {}
}

// ---------------------------------------------------------------- PIN reset (run from the editor if a PIN is forgotten)

function resetPinArpita() { resetPin__('arpita', '1111'); }
function resetPinMehul() { resetPin__('mehul', '2222'); }
function resetPin__(id, pin) {
  var u = find_('Users', function (x) { return x.id === id; });
  var salt = Utilities.getUuid();
  update_('Users', u._row, { pinHash: hash_(pin, salt), salt: salt, mustChange: '1' });
  CacheService.getScriptCache().remove('lock_' + id);
  Logger.log('PIN reset for ' + id + ' to ' + pin + '. Choose a new one at next login.');
}

// ---------------------------------------------------------------- one-time repair
/** Run once from the editor if times show as 1899-12-30: turns every date/time cell back into plain text. */
function repairData() {
  var ss = ss_();
  Object.keys(SCHEMA).forEach(function (name) {
    var s = ss.getSheetByName(name); if (!s) return;
    var last = s.getLastRow(); if (last < 2) return;
    var n = SCHEMA[name].length;
    var r = s.getRange(2, 1, last - 1, n);
    var v = r.getValues(), changed = false;
    for (var i = 0; i < v.length; i++) for (var j = 0; j < n; j++) {
      if (v[i][j] instanceof Date) { v[i][j] = "'" + str_(v[i][j]); changed = true; }
    }
    s.getRange(1, 1, s.getMaxRows(), n).setNumberFormat('@');
    if (changed) r.setValues(v);
  });
  Logger.log('Repair done.');
}
