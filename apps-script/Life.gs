/**
 * Shlok's Parents — Medicine, Shlok's log, Reading & learning.
 */

function registerLife_() {
  if (ACTIONS.getMeds) return;
  SCHEMA.Medicines = ['id', 'owner', 'name', 'dose', 'note', 'times', 'freq', 'start', 'end', 'active', 'createdBy', 'ts'];
  SCHEMA.MedLog = ['date', 'medId', 'time', 'takenAt', 'by', 'ts'];
  SCHEMA.ShlokLog = ['id', 'date', 'time', 'type', 'value', 'extra', 'by', 'ts'];
  SCHEMA.Media = ['id', 'type', 'title', 'owner', 'total', 'progress', 'status', 'createdBy', 'ts'];
  SCHEMA.Learnings = ['id', 'date', 'mediaId', 'owner', 'text', 'progress', 'ts'];
  ['saveMed', 'deleteMed', 'takeMed', 'shlokAdd', 'shlokDel', 'saveMedia', 'addLearning', 'finishMedia'].forEach(function (a) { WRITES[a] = 1; });
  ACTIONS.getMeds = getMeds_;
  ACTIONS.saveMed = saveMed_;
  ACTIONS.deleteMed = deleteMed_;
  ACTIONS.takeMed = takeMed_;
  ACTIONS.myReminders = myReminders_;
  ACTIONS.getShlok = getShlok_;
  ACTIONS.shlokAdd = shlokAdd_;
  ACTIONS.shlokDel = shlokDel_;
  ACTIONS.getReading = getReading_;
  ACTIONS.saveMedia = saveMedia_;
  ACTIONS.addLearning = addLearning_;
  ACTIONS.finishMedia = finishMedia_;
}

// ---------------------------------------------------------------- medicines

var MED_OWNERS = ['arpita', 'mehul', 'shlok'];

function medRow_(m) {
  return { id: m.id, owner: m.owner, name: str_(m.name), dose: str_(m.dose), note: str_(m.note),
    times: String(str_(m.times)).split(',').filter(Boolean).sort(), freq: str_(m.freq) || 'daily', start: str_(m.start), end: str_(m.end) };
}
function medOn_(m, date) {
  if (m.start && date < m.start) return false;
  if (m.end && date > m.end) return false;
  var f = m.freq || 'daily';
  if (f === 'daily') return true;
  if (f.indexOf('days:') === 0) return f.slice(5).split(',').indexOf(String(weekday_(date))) >= 0;
  if (f.indexOf('every:') === 0) {
    var n = Math.max(1, +f.slice(6) || 1);
    return daysBetween2_(m.start || date, date) % n === 0;
  }
  return true;
}
function daysBetween2_(a, b) { return Math.round((dateObj_(b) - dateObj_(a)) / 86400000); }
function activeMeds_() { return rows_('Medicines').filter(function (m) { return String(m.active) === '1'; }).map(medRow_); }
function dosesFor_(date, owners) {
  var taken = {};
  rows_('MedLog').forEach(function (l) { if (str_(l.date) === date) taken[l.medId + '@' + str_(l.time)] = { at: str_(l.takenAt), by: l.by }; });
  var out = [];
  activeMeds_().forEach(function (m) {
    if (owners && owners.indexOf(m.owner) < 0) return;
    if (!medOn_(m, date)) return;
    m.times.forEach(function (t) {
      var tk = taken[m.id + '@' + t];
      out.push({ key: m.id + '@' + t, medId: m.id, time: t, name: m.name, dose: m.dose, note: m.note, owner: m.owner,
        takenAt: tk ? tk.at : '', by: tk ? tk.by : '' });
    });
  });
  return out.sort(function (a, b) { return a.time < b.time ? -1 : a.time > b.time ? 1 : 0; });
}
function getMeds_(user, p) {
  var date = p.date || today_();
  return { meds: activeMeds_(), today: dosesFor_(date, null), date: date };
}
function saveMed_(user, p) {
  var name = String(p.name || '').trim(); if (!name) throw new Error('Name required');
  if (MED_OWNERS.indexOf(p.owner) < 0) throw new Error('For whom?');
  var times = (p.times || []).filter(function (t) { return /^\d\d:\d\d$/.test(t); });
  if (!times.length) throw new Error('Add at least one time');
  var freq = p.freq || 'daily';
  if (!/^(daily|days:[0-6](,[0-6])*|every:\d+)$/.test(freq)) throw new Error('Bad frequency');
  var obj = { owner: p.owner, name: name, dose: p.dose || '', note: p.note || '', times: times.sort().join(','), freq: freq,
    start: p.start || today_(), end: p.end || '', active: '1', ts: nowIso_() };
  if (p.id) {
    var r = find_('Medicines', function (x) { return x.id === p.id; });
    if (!r) throw new Error('Not found');
    update_('Medicines', r._row, obj); return { id: p.id };
  }
  obj.id = 'MD' + uid_(); obj.createdBy = user;
  append_('Medicines', obj);
  return { id: obj.id };
}
function deleteMed_(user, p) {
  var r = find_('Medicines', function (x) { return x.id === p.id; });
  if (r) update_('Medicines', r._row, { active: '0', end: today_() });
  return true;
}
function takeMed_(user, p) {
  var date = p.date || today_();
  var r = find_('MedLog', function (l) { return str_(l.date) === date && l.medId === p.medId && str_(l.time) === p.time; });
  if (p.taken) {
    var obj = { date: date, medId: p.medId, time: p.time, takenAt: p.at || nowTime_(), by: user, ts: nowIso_() };
    if (r) update_('MedLog', r._row, obj); else append_('MedLog', obj);
  } else if (r) deleteRow_('MedLog', r._row);
  return true;
}
/** Doses for the next 7 days that this phone should ring for (own + Shlok's), not yet taken. */
function myReminders_(user) {
  var out = [], t0 = today_(), now = nowTime_();
  var names = { arpita: 'ડૉ. અર્પિતા', mehul: 'મેહુલ', shlok: 'શ્લોક' };
  for (var i = 0; i < 7; i++) {
    var d = addDays_(t0, i);
    dosesFor_(d, [user, 'shlok']).forEach(function (x) {
      if (x.takenAt) return;
      if (i === 0 && x.time < now) return;
      out.push({ id: x.key + '#' + d, at: d + 'T' + x.time, title: 'દવાનો સમય: ' + x.name,
        body: names[x.owner] + (x.dose ? ' · ' + x.dose : '') + (x.note ? ' · ' + x.note : '') });
    });
  }
  return out.slice(0, 60);
}

// ---------------------------------------------------------------- Shlok's log

var SHLOK_TYPES = ['milk', 'sleep', 'food', 'word', 'milestone', 'note'];

function shlokAdd_(user, p) {
  if (SHLOK_TYPES.indexOf(p.type) < 0) throw new Error('Bad type');
  var id = uid_();
  append_('ShlokLog', { id: id, date: p.date || today_(), time: p.time || nowTime_(), type: p.type, value: p.value === undefined ? '' : p.value,
    extra: p.extra || '', by: user, ts: nowIso_() });
  return { id: id };
}
function shlokDel_(user, p) {
  var r = find_('ShlokLog', function (x) { return x.id === p.id; });
  if (r) deleteRow_('ShlokLog', r._row);
  return true;
}
function getShlok_(user, p) {
  var date = p.date || today_();
  var all = rows_('ShlokLog');
  var logs = all.filter(function (l) { return str_(l.date) === date; }).map(function (l) {
    return { id: l.id, time: str_(l.time), type: l.type, value: str_(l.value), extra: str_(l.extra), by: l.by };
  }).sort(function (a, b) { return a.time < b.time ? -1 : 1; });
  var milk = 0, milkN = 0, napMin = 0;
  logs.forEach(function (l) {
    if (l.type === 'milk') { milk += +l.value || 0; milkN++; }
    if (l.type === 'sleep' && /^\d\d:\d\d$/.test(l.extra)) { var d = mins_(l.extra) - mins_(l.time); if (d < 0) d += 1440; napMin += d; }
  });
  var fam = find_('Family', function (f) { return str_(f.date) === date; }) || {};
  var words = all.filter(function (l) { return l.type === 'word'; }).sort(function (a, b) { return str_(a.date) < str_(b.date) ? 1 : -1; })
    .slice(0, 5).map(function (l) { return { date: str_(l.date), value: str_(l.value) }; });
  var yesterday = find_('Family', function (f) { return str_(f.date) === addDays_(date, -1); }) || {};
  return {
    date: date, logs: logs, milk: milk, milkN: milkN, napMin: napMin,
    wakings: fam.nightWakings === undefined || fam.nightWakings === '' ? null : +fam.nightWakings,
    bedtime: str_(fam.shlokBedtime || ''), storyBy: str_(fam.storyBy || ''), story: str_(fam.story || ''),
    yStory: str_(yesterday.story || ''), yStoryBy: str_(yesterday.storyBy || ''),
    words: words, value: { gu: setting_('value_gu', ''), en: setting_('value_en', '') },
    doses: dosesFor_(date, ['shlok'])
  };
}

// ---------------------------------------------------------------- reading & learning

var MEDIA_TYPES = ['book', 'movie', 'doc', 'series', 'podcast', 'video'];

function getReading_(user) {
  var media = rows_('Media').map(function (m) {
    return { id: m.id, type: m.type, title: str_(m.title), owner: m.owner, total: +m.total || 0, progress: +m.progress || 0, status: m.status };
  });
  var learn = rows_('Learnings').map(function (l) {
    return { id: l.id, date: str_(l.date), mediaId: l.mediaId, owner: l.owner, text: str_(l.text), progress: str_(l.progress) };
  }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }).slice(0, 40);
  return { media: media, learnings: learn, today: today_() };
}
function saveMedia_(user, p) {
  var title = String(p.title || '').trim(); if (!title) throw new Error('Title required');
  var type = MEDIA_TYPES.indexOf(p.type) >= 0 ? p.type : 'book';
  if (p.id) {
    var r = find_('Media', function (x) { return x.id === p.id; });
    if (r) update_('Media', r._row, { title: title, type: type, total: p.total || '', owner: p.owner || r.owner });
    return { id: p.id };
  }
  var id = 'MB' + uid_();
  append_('Media', { id: id, type: type, title: title, owner: p.owner || user, total: p.total || '', progress: '', status: 'active', createdBy: user, ts: nowIso_() });
  return { id: id };
}
function addLearning_(user, p) {
  var text = String(p.text || '').trim();
  if (!text && !p.progress) throw new Error('Write what you learnt');
  var m = find_('Media', function (x) { return x.id === p.mediaId; });
  if (!m) throw new Error('Choose a book or show');
  append_('Learnings', { id: uid_(), date: p.date || today_(), mediaId: p.mediaId, owner: user, text: text, progress: p.progress || '', ts: nowIso_() });
  if (p.progress && +p.progress) update_('Media', m._row, { progress: String(+p.progress) });
  return true;
}
function finishMedia_(user, p) {
  var m = find_('Media', function (x) { return x.id === p.id; });
  if (m) update_('Media', m._row, { status: p.undo ? 'active' : 'done', progress: p.undo ? m.progress : (m.total || m.progress) });
  return true;
}
