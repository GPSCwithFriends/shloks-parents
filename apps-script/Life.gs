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
  registerLife2_();
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
  if (typeof detoxUploaded_ === 'function') {
    registerDetox_();
    for (var k = 0; k < 7; k++) {
      var dd = addDays_(t0, k);
      if (k === 0 && (now >= '22:00' || detoxUploaded_(user, dd))) continue;
      out.push({ id: 'detox#' + dd, at: dd + 'T22:00', title: 'ડિજિટલ ડિટોક્સ', body: 'આજનો સ્ક્રીન ટાઈમ SS મૂકો · Upload today\'s screen time' });
    }
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
    doses: dosesFor_(date, ['shlok']), recent: shlokRecent_()
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

// ---------------------------------------------------------------- v4: recent entries, partner nudges, voice entry

function registerLife2_() {
  if (ACTIONS.nudge) return;
  SCHEMA.Nudges = ['id', 'from', 'to', 'text', 'ref', 'ts', 'seen', 'notified'];
  ['nudge', 'seenNudge', 'pollNudges'].forEach(function (a) { WRITES[a] = 1; });
  ACTIONS.nudge = nudge_;
  ACTIONS.seenNudge = seenNudge_;
  ACTIONS.pollNudges = pollNudges_;
  ACTIONS.voiceParse = voiceParse_;
}

/** Last 3 different values, newest first. */
function last3_(rows, keyFn, valFn) {
  var seen = {}, out = [];
  rows.slice().sort(function (a, b) { return str_(a.ts || a.date) < str_(b.ts || b.date) ? 1 : -1; }).some(function (r) {
    var k = keyFn(r); if (!k || seen[k]) return false;
    seen[k] = 1; out.push(valFn(r)); return out.length >= 3;
  });
  return out;
}
function shlokRecent_() {
  var logs = rows_('ShlokLog');
  var fam = rows_('Family').filter(function (f) { return str_(f.story); });
  return {
    milk: last3_(logs.filter(function (l) { return l.type === 'milk'; }), function (l) { return str_(l.value) + '|' + str_(l.extra); }, function (l) { return { value: str_(l.value), extra: str_(l.extra) }; }),
    food: last3_(logs.filter(function (l) { return l.type === 'food'; }), function (l) { return str_(l.value); }, function (l) { return str_(l.value); }),
    story: last3_(fam.map(function (f) { return { date: str_(f.date), story: str_(f.story) }; }), function (f) { return f.story; }, function (f) { return f.story; })
  };
}
function waterRecent_(owner) {
  return last3_(rows_('Water').filter(function (w) { return w.owner === owner; }).map(function (w) { return { ts: str_(w.date) + ' ' + str_(w.time), ml: +w.ml }; }),
    function (w) { return String(w.ml); }, function (w) { return w.ml; });
}
function expenseRecent_(user) {
  return last3_(rows_('Expenses').filter(function (e) { return e.source === 'manual' && String(e.active) === '1'; }),
    function (e) { return str_(e.item).toLowerCase() + '|' + money_(e.amount); },
    function (e) { return { item: str_(e.item), amount: money_(e.amount), category: e.category, need: e.need, mode: e.mode }; });
}

// ---- nudges: "remind my partner" (Android shows a notification, iPhone shows it on opening)
function nudge_(user, p) {
  var text = String(p.text || '').trim().slice(0, 200); if (!text) throw new Error('Empty');
  var to = user === 'mehul' ? 'arpita' : 'mehul';
  var recent = rows_('Nudges').some(function (n) { return n.from === user && n.ref === (p.ref || '') && String(n.seen) !== '1' && ageHours_(str_(n.ts)) < 1; });
  if (recent) return { already: true };
  append_('Nudges', { id: uid_(), from: user, to: to, text: text, ref: p.ref || '', ts: nowIso_(), seen: '0', notified: '0' });
  return true;
}
function myNudges_(user) {
  return rows_('Nudges').filter(function (n) { return n.to === user && String(n.seen) !== '1' && ageHours_(str_(n.ts)) < 72; })
    .map(function (n) { return { id: n.id, from: n.from, text: str_(n.text), ts: str_(n.ts) }; });
}
function seenNudge_(user, p) {
  rows_('Nudges').forEach(function (n) { if (n.to === user && (!p.id || n.id === p.id) && String(n.seen) !== '1') update_('Nudges', n._row, { seen: '1', notified: '1' }); });
  return true;
}
/** Called by the Android app in the background every ~15 minutes. */
function pollNudges_(user) {
  var out = [];
  rows_('Nudges').forEach(function (n) {
    if (n.to !== user || String(n.seen) === '1' || String(n.notified) === '1' || ageHours_(str_(n.ts)) > 24) return;
    out.push({ id: n.id, title: (n.from === 'mehul' ? 'મેહુલ' : 'ડૉ. અર્પિતા') + ' યાદ કરાવે છે', body: str_(n.text) });
    update_('Nudges', n._row, { notified: '1' });
  });
  return out;
}

// ---- voice / text entry: Gemini turns a Gujarati or English sentence into entries to confirm
function voiceParse_(user, p) {
  var date = p.date || today_(), lvl = level_(user);
  var tasks = rows_('Tasks').filter(function (x) { return x.owner === user && String(x.active) === '1'; }).map(function (x) {
    return { id: x.id, name: str_(x.gu || x.name), en: str_(x.en || ''), time: effectiveTime_(x, lvl) };
  }).filter(function (x) { return x.time; });
  var meds = typeof dosesFor_ === 'function' ? dosesFor_(date, [user, 'shlok']).map(function (d) { return { key: d.key, name: d.name, time: d.time, owner: d.owner }; }) : [];
  var people = rows_('Options').filter(function (o) { return o.type === 'people' || o.type === 'homes'; }).map(function (o) { return str_(o.value); });
  var prompt = [
    "You turn what a parent said (Gujarati, Hindi or English) into entries for the family app \"Shlok's Parents\". The speaker is " + (user === 'mehul' ? 'Mehul (father)' : 'Dr. Arpita (mother)') + '. Shlok is their toddler. Now: ' + date + ' ' + nowTime_() + '.',
    'Possible entries (use only what was clearly said; times as "HH:MM" 24-hour, use now if no time was said):',
    '{"type":"milk","ml":number,"kind":"formula"|"cow"|"breast","time":"HH:MM"}  — Shlok drank milk',
    '{"type":"sleep","from":"HH:MM","to":"HH:MM"|""}  — Shlok slept',
    '{"type":"shlokFood","text":string,"time":"HH:MM"}  — what Shlok ate',
    '{"type":"word","text":string}  — new word Shlok said',
    '{"type":"story","text":string,"by":"mehul"|"arpita"}  — bedtime story told',
    '{"type":"water","ml":number}  — the speaker drank water',
    '{"type":"expense","amount":number,"item":string,"category":one of ' + JSON.stringify(FIN_CATS) + ',"need":"need"|"want"}',
    '{"type":"task","taskId":string,"status":"done"|"skip","time":"HH:MM","reason":string}  — one of the speaker\'s tasks: ' + JSON.stringify(tasks),
    '{"type":"med","key":string}  — a medicine dose was taken: ' + JSON.stringify(meds),
    '{"type":"call","who":string}  — talked on phone with someone',
    '{"type":"visit","who":string}  — visited someone',
    '{"type":"todo","text":string,"who":"both"|"mehul"|"arpita"}  — something to remember to do',
    'Known people and homes: ' + JSON.stringify(people.slice(0, 80)),
    'Also give "label": a short Gujarati description of each entry for confirmation.',
    'Return ONLY JSON: {"heard": "what was said, in its own language", "items": [ ... ]}'
  ].join('\n');
  var parts = [{ text: prompt }];
  if (p.audio) {
    var m = String(p.audio).match(/^data:([^;]+);base64,(.+)$/);
    if (!m) throw new Error('Bad audio');
    parts.push({ inline_data: { mime_type: m[1].split(';')[0], data: m[2] } });
  } else {
    var txt = String(p.text || '').trim(); if (!txt) throw new Error('Nothing said');
    parts.push({ text: 'Said: ' + txt });
  }
  var j;
  try { j = geminiJson_(parts, undefined, 0.1); }
  catch (e) { if (/^AI_BUSY/.test(String(e.message || e))) throw new Error('AI_BUSY'); throw e; }
  var okTask = {}; tasks.forEach(function (x) { okTask[x.id] = 1; });
  var okMed = {}; meds.forEach(function (x) { okMed[x.key] = 1; });
  var items = (j.items || []).filter(function (it) {
    if (it.type === 'task') return okTask[it.taskId];
    if (it.type === 'med') return okMed[it.key];
    return ['milk', 'sleep', 'shlokFood', 'word', 'story', 'water', 'expense', 'call', 'visit', 'todo'].indexOf(it.type) >= 0;
  }).slice(0, 8);
  return { heard: String(j.heard || p.text || ''), items: items };
}
