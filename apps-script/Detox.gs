/**
 * Shlok's Parents — Digital Detox.
 * Each night (around 22:00) both upload the screen-time screenshot from Digital Wellbeing (Android)
 * or Screen Time (iPhone). The AI reads it in the background; the dashboard compares the two.
 */

var DETOX_CATS = ['message', 'social', 'video', 'news', 'games', 'shopping', 'work', 'other'];
var DETOX_GOAL_DEFAULT = 180;   // minutes a day

function registerDetox_() {
  if (ACTIONS.getDetox) return;
  if (typeof registerFinance_ === 'function') registerFinance_();
  SCHEMA.DetoxShots = ['id', 'date', 'owner', 'photoIds', 'status', 'tries', 'note', 'ts'];
  SCHEMA.DetoxDays = ['date', 'owner', 'total', 'unlocks', 'first', 'night', 'apps', 'source', 'ts'];
  ['uploadDetox', 'saveDetoxPlan', 'toggleDetoxAct', 'setDetoxDay', 'retryDetox'].forEach(function (a) { WRITES[a] = 1; });
  ACTIONS.getDetox = getDetox_;
  ACTIONS.uploadDetox = uploadDetox_;
  ACTIONS.saveDetoxPlan = saveDetoxPlan_;
  ACTIONS.toggleDetoxAct = toggleDetoxAct_;
  ACTIONS.setDetoxDay = setDetoxDay_;
  ACTIONS.retryDetox = retryDetox_;
}

// ---------------------------------------------------------------- upload + AI reading

/** The "day" a screenshot belongs to: before 05:00 it still counts as yesterday. */
function detoxToday_() { return nowTime_() < '05:00' ? addDays_(today_(), -1) : today_(); }

function uploadDetox_(user, p) {
  var imgs = p.images || [];
  if (!imgs.length) throw new Error('No image');
  if (imgs.length > 4) throw new Error('Max 4 screenshots');
  var date = p.date || detoxToday_();
  if (date > today_()) throw new Error('Future date');
  var folder = receiptFolder_(), ids = [];
  imgs.forEach(function (d, i) {
    var m = String(d).match(/^data:(image\/[a-z+]+);base64,(.+)$/);
    if (!m) throw new Error('Bad image');
    ids.push(folder.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], 'detox_' + user + '_' + date + '_' + (i + 1))).getId());
  });
  // a newer upload for the same day replaces the older one
  rows_('DetoxShots').forEach(function (r) {
    if (r.owner === user && str_(r.date) === date && (r.status === 'pending' || r.status === 'error')) update_('DetoxShots', r._row, { status: 'replaced' });
  });
  var id = uid_();
  append_('DetoxShots', { id: id, date: date, owner: user, photoIds: ids.join(','), status: 'pending', tries: '0', note: '', ts: nowIso_() });
  return { id: id, date: date };
}
function retryDetox_(user, p) {
  var r = find_('DetoxShots', function (x) { return x.id === p.id; });
  if (r) update_('DetoxShots', r._row, { status: 'pending', tries: '0', note: '', ts: nowIso_() });
  return processReceipts();
}

function processDetoxLocked_(started) {
  started = started || Date.now();
  var n = 0;
  var all = rows_('DetoxShots');
  all.forEach(function (r) {
    if (r.status === 'processing' && ageHours_(str_(r.note).replace('PROC ', '')) > 0.25) update_('DetoxShots', r._row, { status: 'pending', note: '' });
  });
  var pending = all.filter(function (r) { return r.status === 'pending'; });
  if (pending.length && aiKeys_().length) {
    for (var i = 0; i < pending.length; i++) {
      if (Date.now() - started > 4 * 60 * 1000) break;
      var r = pending[i];
      update_('DetoxShots', r._row, { status: 'processing', note: 'PROC ' + nowIso_() });
      try { readDetox_(r); n++; }
      catch (e) { aiFail_('DetoxShots', r._row, e, r.ts, r.tries); if (/^AI_BUSY/.test(String(e.message || e))) break; }
    }
  }
  if (Date.now() - started < 4 * 60 * 1000) { try { detoxWeeklyAi_(); } catch (e) {} }
  if (Date.now() - started < 4 * 60 * 1000) { try { retryBusyReport_(); } catch (e) {} }
  return n;
}

function readDetox_(r) {
  var parts = [{ text: [
    'These are screenshots of ONE day of phone usage from Android Digital Wellbeing or iPhone Screen Time (may be several screenshots of the same day, e.g. scrolled app list).',
    'Read: total screen time in minutes; number of unlocks / pickups (or null if not shown); time of first pickup "HH:MM" 24-hour (or "" if not shown);',
    'minutes used after 22:00 (estimate from the hourly bar chart if it is shown, else null); and every app with its minutes.',
    'For each app choose a category from: ' + DETOX_CATS.join(', ') + ' (message = WhatsApp, Telegram, SMS; social = Instagram, Facebook, X, Snapchat; video = YouTube, Netflix, Hotstar, Prime; news = Chrome, browsers, news, Kindle, reading apps; work = Mail, Docs, office apps; games; shopping; other = Phone, Camera, Settings, launcher).',
    'If the screenshot shows a WEEK view, convert to the average for one day and set "week": true.',
    'Return ONLY JSON: {"total": number, "unlocks": number|null, "first": string, "night": number|null, "week": boolean, "apps": [{"name": string, "min": number, "cat": string}]}',
    'Do not invent numbers that are not visible.'].join('\n') }];
  String(r.photoIds).split(',').filter(Boolean).forEach(function (id) {
    var b = DriveApp.getFileById(id).getBlob();
    parts.push({ inline_data: { mime_type: b.getContentType() || 'image/jpeg', data: Utilities.base64Encode(b.getBytes()) } });
  });
  var j = geminiJson_(parts);
  var total = Math.round(+j.total || 0);
  var apps = (j.apps || []).map(function (a) {
    return { n: String(a.name || '').trim().slice(0, 40), m: Math.round(+a.min || 0), c: DETOX_CATS.indexOf(a.cat) >= 0 ? a.cat : 'other' };
  }).filter(function (a) { return a.n && a.m > 0; }).sort(function (a, b) { return b.m - a.m; }).slice(0, 25);
  if (!total) total = apps.reduce(function (s, a) { return s + a.m; }, 0);
  if (!total) throw new Error('Could not read the screen time. Please upload the Digital Wellbeing / Screen Time page.');
  var first = /^\d{1,2}:\d\d$/.test(String(j.first || '')) ? ('0' + j.first).slice(-5) : '';
  saveDetoxDay_(r.owner, str_(r.date), { total: total, unlocks: j.unlocks === null || j.unlocks === undefined ? '' : Math.round(+j.unlocks),
    first: first, night: j.night === null || j.night === undefined ? '' : Math.round(+j.night), apps: apps, source: 'ai' });
  update_('DetoxShots', r._row, { status: 'done', note: j.week ? 'WEEK' : '' });
}
function saveDetoxDay_(owner, date, d) {
  upsert_('DetoxDays', function (x) { return x.owner === owner && str_(x.date) === date; }, {
    date: date, owner: owner, total: String(d.total), unlocks: String(d.unlocks), first: d.first || '', night: String(d.night),
    apps: JSON.stringify(d.apps || []), source: d.source || 'ai', ts: nowIso_() });
}
/** Manual correction of a day's numbers ("correct it afterwards"). */
function setDetoxDay_(user, p) {
  var date = p.date || detoxToday_();
  var cur = find_('DetoxDays', function (x) { return x.owner === user && str_(x.date) === date; });
  var d = cur ? detoxDayRow_(cur) : { apps: [] };
  ['total', 'unlocks', 'night'].forEach(function (k) { if (p[k] !== undefined && p[k] !== '') d[k] = Math.max(0, Math.round(+p[k] || 0)); });
  if (p.first !== undefined) d.first = /^\d\d:\d\d$/.test(p.first) ? p.first : '';
  if (!d.total) throw new Error('Enter the screen time');
  d.source = 'manual';
  saveDetoxDay_(user, date, d);
  return true;
}
function detoxDayRow_(r) {
  var apps = []; try { apps = JSON.parse(r.apps || '[]'); } catch (e) {}
  var num = function (v) { return v === '' || v === null || v === undefined ? null : +v; };
  return { date: str_(r.date), owner: r.owner, total: +r.total || 0, unlocks: num(r.unlocks), first: str_(r.first), night: num(r.night), apps: apps, source: r.source };
}

// ---------------------------------------------------------------- plan: goal, app limits, AI actions

function detoxPlan_(owner) {
  var limits = {}; try { limits = JSON.parse(setting_('detox_limits_' + owner, '{}')); } catch (e) {}
  return { goal: +setting_('detox_goal_' + owner, DETOX_GOAL_DEFAULT) || DETOX_GOAL_DEFAULT, limits: limits };
}
function saveDetoxPlan_(user, p) {
  if (p.goal !== undefined) setSetting_('detox_goal_' + user, String(Math.max(30, Math.min(720, Math.round(+p.goal || DETOX_GOAL_DEFAULT)))));
  if (p.limits) {
    var clean = {};
    Object.keys(p.limits).forEach(function (k) { var v = Math.round(+p.limits[k] || 0); if (k && v > 0) clean[String(k).slice(0, 40)] = v; });
    setSetting_('detox_limits_' + user, JSON.stringify(clean));
  }
  return true;
}
function detoxAi_(week) { try { return JSON.parse(setting_('detox_ai_' + week, '')); } catch (e) { return null; } }
function toggleDetoxAct_(user, p) {
  var ai = detoxAi_(p.week); if (!ai || !ai[user]) throw new Error('Not found');
  var a = ai[user][+p.i]; if (!a) throw new Error('Not found');
  a.done = !a.done;
  setSetting_('detox_ai_' + p.week, JSON.stringify(ai));
  return true;
}
/** Makes this week's 3 actions per person from last week's data (once a week, AI or rules). */
function detoxWeeklyAi_() {
  var ws = weekStart_(today_()), have = detoxAi_(ws);
  if (have && have.source === 'gemini') return;
  if (have && ageHours_(have.ts) < 1) return;                       // AI was busy: try again in an hour
  var last = { arpita: detoxPerson_('arpita', addDays_(ws, -7), addDays_(ws, -1), addDays_(ws, -14), addDays_(ws, -8)),
    mehul: detoxPerson_('mehul', addDays_(ws, -7), addDays_(ws, -1), addDays_(ws, -14), addDays_(ws, -8)) };
  var cur = { arpita: detoxPerson_('arpita', ws, addDays_(ws, 6), addDays_(ws, -7), addDays_(ws, -1)),
    mehul: detoxPerson_('mehul', ws, addDays_(ws, 6), addDays_(ws, -7), addDays_(ws, -1)) };
  var src = last.arpita.n + last.mehul.n >= 2 ? last : cur;
  if (src.arpita.n + src.mehul.n < 2) return;
  var out = null;
  if (aiKeys_().length) {
    try {
      var slim = function (x) { return { daysWithData: x.n, avgMinPerDay: x.avg, prevAvg: x.prev, unlocks: x.unl, firstPickup: x.first, after22min: x.night, goal: x.goal, topApps: x.apps.slice(0, 6), categories: x.cats }; };
      var j = geminiJson_([{ text: [
        "You are the digital-wellbeing coach in \"Shlok's Parents\", a private app for a Gujarati couple: Mehul (government officer, sleeps with their toddler Shlok at night) and Dr. Arpita (dentist, at home with Shlok in the day). They want less phone time and more time with Shlok, reading and each other.",
        'Below is one week of their phone use (minutes per day, unlocks, first pickup, use after 22:00, top apps with minutes, categories).',
        'Give each person exactly 3 small, specific actions for this week, using real app names and times (for example app timers in Digital Wellbeing/Screen Time, a fixed time for WhatsApp groups, phone charging outside the bedroom). Also one joint idea for both. Never shame.',
        'Return ONLY JSON: {"arpita": [{"gu": string, "en": string}], "mehul": [{"gu": string, "en": string}], "joint": {"gu": string, "en": string}}',
        'Gujarati must be natural Gujarati script.', 'DATA:', JSON.stringify({ arpita: slim(src.arpita), mehul: slim(src.mehul) })].join('\n') }], undefined, 0.4);
      out = { arpita: (j.arpita || []).slice(0, 3), mehul: (j.mehul || []).slice(0, 3), joint: j.joint || null, source: 'gemini' };
    } catch (e) { out = null; }
  }
  if (!out) out = detoxRuleActs_(src);
  ['arpita', 'mehul'].forEach(function (u) { (out[u] || []).forEach(function (a, i) { a.done = have && have[u] && have[u][i] ? !!have[u][i].done : false; }); });
  out.ts = nowIso_();
  setSetting_('detox_ai_' + ws, JSON.stringify(out));
}
function detoxRuleActs_(src) {
  var out = { source: 'rules' };
  ['arpita', 'mehul'].forEach(function (u) {
    var x = src[u], acts = [], top = x.apps[0];
    if (top) acts.push({ gu: top[0] + ': રોજ ' + Math.max(15, Math.round(top[1] * 0.75)) + ' મિનિટનું ટાઈમર મૂકો (Digital Wellbeing / Screen Time).',
      en: top[0] + ': set a daily timer of ' + Math.max(15, Math.round(top[1] * 0.75)) + ' min (Digital Wellbeing / Screen Time).' });
    if (x.night !== null && x.night > 15) acts.push({ gu: 'રાત 10 પછી ફોન બીજા રૂમમાં ચાર્જ કરો.', en: 'After 22:00, charge the phone in another room.' });
    if (x.first && x.first < '07:30') acts.push({ gu: 'ઊઠીને પહેલી 30 મિનિટ ફોન નહીં — પહેલાં પાણી અને સૂર્યનમસ્કાર.', en: 'No phone for the first 30 minutes after waking — water and Surya Namaskar first.' });
    if (x.unl !== null && x.unl > 60) acts.push({ gu: 'નોટિફિકેશન બંધ કરો: ફક્ત ફોન કૉલ અને કુટુંબના મેસેજ ચાલુ રાખો.', en: 'Turn off notifications except calls and family messages.' });
    acts.push({ gu: 'શ્લોક સાથે હોવ ત્યારે ફોન ઊંધો મૂકો.', en: 'Keep the phone face down while with Shlok.' });
    out[u] = acts.slice(0, 3);
  });
  out.joint = { gu: 'રાત 8–10 "ફોન-ફ્રી શ્લોક ટાઈમ": બંનેના ફોન એક જ જગ્યાએ.', en: '20:00–22:00 "phone-free Shlok time": both phones in one place.' };
  return out;
}
/** If this week's family report fell back because the AI was busy, try again (once an hour). */
function retryBusyReport_() {
  var ws = weekStart_(addDays_(today_(), -1));
  [ws, addDays_(ws, -7)].forEach(function (w) {
    var r = find_('Reports', function (x) { return str_(x.weekStart) === w; });
    if (!r) return;
    var j = JSON.parse(r.json || '{}');
    if (!j.ai || !/AI_BUSY/.test(String(j.ai.error || '')) || ageHours_(str_(r.ts)) < 1) return;
    try {
      var ai = gemini_(weekStats_(w));
      j.ai = ai; update_('Reports', r._row, { json: JSON.stringify(j), ts: nowIso_() });
    } catch (e) { update_('Reports', r._row, { ts: nowIso_() }); }
  });
}

// ---------------------------------------------------------------- dashboard data

function detoxDays_(owner, from, to) {
  return rows_('DetoxDays').filter(function (r) { return r.owner === owner && str_(r.date) >= from && str_(r.date) <= to; })
    .map(detoxDayRow_).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
}
function avg_(list, f) {
  var v = list.map(f).filter(function (x) { return x !== null && x !== undefined && x !== '' && !isNaN(x); });
  return v.length ? Math.round(v.reduce(function (s, x) { return s + (+x); }, 0) / v.length) : null;
}
function avgTime_(list) {
  var v = list.map(function (d) { return d.first; }).filter(Boolean).map(mins_);
  if (!v.length) return '';
  var m = Math.round(v.reduce(function (s, x) { return s + x; }, 0) / v.length);
  return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2);
}
function appTotals_(days) {
  var t = {}, c = {};
  days.forEach(function (d) { d.apps.forEach(function (a) { t[a.n] = (t[a.n] || 0) + a.m; c[a.n] = a.c; }); });
  var n = days.length || 1;
  return { list: Object.keys(t).map(function (k) { return [k, Math.round(t[k] / n), c[k]]; }).sort(function (a, b) { return b[1] - a[1]; }) };
}
function detoxPerson_(owner, from, to, pfrom, pto) {
  var days = detoxDays_(owner, from, to), prev = detoxDays_(owner, pfrom, pto), plan = detoxPlan_(owner);
  var cur = appTotals_(days).list, old = appTotals_(prev).list, oldMap = {};
  old.forEach(function (a) { oldMap[a[0]] = a[1]; });
  var cats = {}; DETOX_CATS.forEach(function (c) { cats[c] = 0; });
  cur.forEach(function (a) { cats[a[2]] = (cats[a[2]] || 0) + a[1]; });
  var apps = cur.slice(0, 8).map(function (a) { return [a[0], a[1], oldMap[a[0]] === undefined ? null : oldMap[a[0]], plan.limits[a[0]] || 0, a[2]]; });
  Object.keys(plan.limits).forEach(function (k) { if (!apps.some(function (a) { return a[0] === k; })) apps.push([k, 0, oldMap[k] === undefined ? null : oldMap[k], plan.limits[k], 'other']); });
  // streak of days under goal, counting back from the newest day with data
  var all = detoxDays_(owner, addDays_(to, -60), to), streak = 0;
  for (var i = all.length - 1; i >= 0; i--) { if (all[i].total <= plan.goal) streak++; else break; }
  var best = null, worst = null;
  days.forEach(function (d) { if (!best || d.total < best.total) best = d; if (!worst || d.total > worst.total) worst = d; });
  return {
    n: days.length, days: days.map(function (d) { return { date: d.date, total: d.total, unlocks: d.unlocks, first: d.first, night: d.night, source: d.source }; }),
    avg: avg_(days, function (d) { return d.total; }), prev: avg_(prev, function (d) { return d.total; }),
    unl: avg_(days, function (d) { return d.unlocks; }), unlP: avg_(prev, function (d) { return d.unlocks; }),
    first: avgTime_(days), firstP: avgTime_(prev),
    night: avg_(days, function (d) { return d.night; }), nightP: avg_(prev, function (d) { return d.night; }),
    goal: plan.goal, limits: plan.limits, apps: apps, cats: cats, streak: streak,
    under: days.filter(function (d) { return d.total <= plan.goal; }).length,
    best: best ? { date: best.date, total: best.total } : null, worst: worst ? { date: worst.date, total: worst.total } : null
  };
}
function getDetox_(user, p) {
  var per = finPeriod_(p.mode === 'month' ? 'month' : 'week', p.anchor);
  var people = {};
  ['arpita', 'mehul'].forEach(function (u) { people[u] = detoxPerson_(u, per.start, per.end, per.pstart, per.pend); });
  // week rows inside a month, for the month chart
  if (per.mode === 'month') {
    var weeks = [], w = weekStart_(per.start);
    while (w <= per.end) { weeks.push(w); w = addDays_(w, 7); }
    ['arpita', 'mehul'].forEach(function (u) {
      people[u].weeks = weeks.map(function (ws) {
        var d = people[u].days.filter(function (x) { return x.date >= ws && x.date <= addDays_(ws, 6); });
        return { start: ws, avg: avg_(d, function (x) { return x.total; }) };
      });
    });
  }
  var td = /^\d{4}-\d\d-\d\d$/.test(p.statusDate || '') && p.statusDate <= today_() ? p.statusDate : detoxToday_(), shots = rows_('DetoxShots');
  var status = {};
  ['arpita', 'mehul'].forEach(function (u) {
    var day = find_('DetoxDays', function (x) { return x.owner === u && str_(x.date) === td; });
    var last = shots.filter(function (s) { return s.owner === u && str_(s.date) === td && s.status !== 'replaced'; }).pop();
    status[u] = { done: !!day, state: day ? 'done' : last ? last.status : 'none', id: last ? last.id : '',
      note: last && last.status === 'error' ? str_(last.note).slice(0, 160) : '' };
  });
  var ai = detoxAi_(weekStart_(per.mode === 'week' ? per.start : today_()));
  return { period: per, people: people, today: td, status: status, ai: ai, hasKey: aiKeys_().length > 0, cats: DETOX_CATS };
}

/** For the Today screen and phone reminders. */
function detoxDue_(user) {
  if (nowTime_() < '21:45' && nowTime_() >= '05:00') return false;
  var td = detoxToday_();
  if (find_('DetoxDays', function (x) { return x.owner === user && str_(x.date) === td; })) return false;
  return !rows_('DetoxShots').some(function (s) { return s.owner === user && str_(s.date) === td && (s.status === 'pending' || s.status === 'processing'); });
}
function detoxUploaded_(user, date) {
  return !!find_('DetoxDays', function (x) { return x.owner === user && str_(x.date) === date; }) ||
    rows_('DetoxShots').some(function (s) { return s.owner === user && str_(s.date) === date && (s.status === 'pending' || s.status === 'processing' || s.status === 'done'); });
}
