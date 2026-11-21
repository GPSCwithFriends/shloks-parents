/**
 * Shlok's Parents — Finance module
 * Screenshots are saved first and read by Gemini in the background (every 5 minutes),
 * or straight away with "Read now". Corrections teach the app for next time.
 */

var FIN_CATS = ['groc', 'veg', 'dairy', 'shlok', 'toys', 'snack', 'food', 'home', 'care', 'cloth',
  'med', 'bills', 'fuel', 'help', 'elec', 'study', 'gift', 'subs', 'fees', 'other'];
var FIN_CAT_EN = {
  groc: 'Groceries & staples (atta, dal, rice, oil, spices, sugar)', veg: 'Vegetables & fruits', dairy: 'Milk & dairy (milk, curd, paneer, butter, ghee)',
  shlok: "Baby essentials (diapers, formula, wipes, baby food, baby care)", toys: 'Baby toys & books', snack: 'Snacks, farsan, chocolates, sweets, ice cream, cold drinks',
  food: 'Food delivery & eating out (Swiggy, Zomato, restaurants)', home: 'Household & cleaning, kitchen items', care: 'Personal care & beauty',
  cloth: 'Clothes & footwear', med: 'Medicine & health', bills: 'Bills (electricity, gas, mobile, internet, DTH)', fuel: 'Fuel & travel',
  help: 'Household help salaries', elec: 'Home appliances, electronics, furniture', study: 'Books & study material', gift: 'Gifts, functions, religious',
  subs: 'Subscriptions & OTT', fees: 'Delivery, handling, platform & packaging fees, tips', other: 'Anything else'
};

/** Adds the finance sheets and actions. Safe to call many times (file load order does not matter). */
function registerFinance_() {
  if (ACTIONS.getFinance) return;
  SCHEMA.Expenses = ['id', 'date', 'amount', 'category', 'item', 'qty', 'app', 'need', 'reason', 'paidBy', 'mode', 'source', 'createdBy', 'ts', 'active', 'reviewed'];
  SCHEMA.Receipts = ['id', 'date', 'by', 'app', 'photoIds', 'status', 'orderId', 'orderDate', 'total', 'itemsTotal', 'note', 'ts', 'reviewed', 'batch', 'tries'];
  SCHEMA.Rules = ['key', 'category', 'need', 'ts'];
  SCHEMA.Recurring = ['id', 'day', 'amount', 'category', 'item', 'paidBy', 'mode', 'active', 'lastMonth'];
  SCHEMA.FinReports = ['period', 'json', 'ts'];

  ['addExpense', 'updateExpense', 'deleteExpense', 'uploadReceipt', 'markReviewed', 'saveBudgets',
   'addRecurring', 'deleteRecurring', 'finAnalysis'].forEach(function (a) { WRITES[a] = 1; });
  ACTIONS.getFinance = getFinance_;
  ACTIONS.addExpense = addExpense_;
  ACTIONS.updateExpense = updateExpense_;
  ACTIONS.deleteExpense = deleteExpense_;
  ACTIONS.uploadReceipt = uploadReceipt_;
  ACTIONS.processNow = function (user) { processReceipts(); return true; };
  ACTIONS.markReviewed = markReviewed_;
  ACTIONS.saveBudgets = saveBudgets_;
  ACTIONS.addRecurring = addRecurring_;
  ACTIONS.deleteRecurring = deleteRecurring_;
  ACTIONS.finAnalysis = finAnalysis_;
  ACTIONS.testGemini = testGemini_;
  ACTIONS.retryReceipt = retryReceipt_;
  WRITES.retryReceipt = 1;
}

// ---------------------------------------------------------------- helpers

function money_(v) { var n = Math.round((+v || 0) * 100) / 100; return isFinite(n) ? n : 0; }
function itemKey_(name) {
  return String(name || '').toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b\d+(\.\d+)?\s*(kg|g|gm|gms|grams?|l|ltr|litre|liter|ml|pcs?|pieces?|pack|x|n|units?)\b/g, ' ')
    .replace(/[^a-z઀-૿ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function rulesMap_() { var m = {}; rows_('Rules').forEach(function (r) { m[str_(r.key)] = { category: r.category, need: r.need }; }); return m; }
function learn_(item, category, need) {
  var k = itemKey_(item); if (!k) return;
  var obj = { key: k, ts: nowIso_() };
  if (category) obj.category = category;
  if (need) obj.need = need;
  upsert_('Rules', function (r) { return str_(r.key) === k; }, obj);
}
function expRow_(r) {
  return { id: r.id, date: str_(r.date), amount: money_(r.amount), category: r.category || 'other', item: str_(r.item), qty: str_(r.qty),
    app: str_(r.app), need: r.need || '', reason: str_(r.reason), paidBy: r.paidBy, mode: str_(r.mode), source: str_(r.source),
    reviewed: String(r.reviewed) === '1' };
}
function budgets_() {
  var b = {};
  FIN_CATS.forEach(function (c) { var v = +setting_('budget_' + c, '0'); if (v > 0) b[c] = v; });
  return b;
}
function receiptFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('RECEIPT_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var f = DriveApp.createFolder("Shlok's Parents — Receipts");
  props.setProperty('RECEIPT_FOLDER_ID', f.getId());
  return f;
}

// ---------------------------------------------------------------- entries

function addExpense_(user, p) {
  var amt = money_(p.amount);
  if (!(amt !== 0)) throw new Error('Amount required');
  var cat = FIN_CATS.indexOf(p.category) >= 0 ? p.category : 'other';
  var id = uid_();
  append_('Expenses', { id: id, date: p.date || today_(), amount: amt, category: cat, item: String(p.item || '').trim(), qty: p.qty || '',
    app: p.app || '', need: p.need || '', reason: p.reason || '', paidBy: p.paidBy || user, mode: p.mode || '',
    source: 'manual', createdBy: user, ts: nowIso_(), active: '1', reviewed: '1' });
  if (p.item && p.learn !== false) learn_(p.item, cat, p.need);
  return { id: id };
}
function updateExpense_(user, p) {
  var r = find_('Expenses', function (x) { return x.id === p.id; });
  if (!r) throw new Error('Not found');
  var obj = {};
  ['date', 'item', 'reason', 'paidBy', 'mode', 'app'].forEach(function (k) { if (p[k] !== undefined) obj[k] = p[k]; });
  if (p.amount !== undefined) obj.amount = money_(p.amount);
  if (p.category !== undefined && FIN_CATS.indexOf(p.category) >= 0) obj.category = p.category;
  if (p.need !== undefined) obj.need = p.need;
  obj.reviewed = '1';
  update_('Expenses', r._row, obj);
  if (obj.category || obj.need) learn_(r.item, obj.category, obj.need);
  return true;
}
function deleteExpense_(user, p) {
  var r = find_('Expenses', function (x) { return x.id === p.id; });
  if (r) update_('Expenses', r._row, { active: '0' });
  return true;
}
function markReviewed_(user, p) {
  var all = rows_('Expenses');
  all.forEach(function (r) { if (r.source === p.receiptId && String(r.reviewed) !== '1') update_('Expenses', r._row, { reviewed: '1' }); });
  var rc = find_('Receipts', function (x) { return x.id === p.receiptId; });
  if (rc) update_('Receipts', rc._row, { reviewed: '1' });
  return true;
}

// ---------------------------------------------------------------- screenshots

function uploadReceipt_(user, p) {
  var imgs = p.images || [];
  if (!imgs.length) throw new Error('No image');
  if (imgs.length > 6) throw new Error('Max 6 screenshots per upload');
  var folder = receiptFolder_(), ids = [], batch = String(p.batch || uid_()).slice(0, 20);
  imgs.forEach(function (d, i) {
    var m = String(d).match(/^data:(image\/[a-z+]+);base64,(.+)$/);
    if (!m) throw new Error('Bad image');
    var f = folder.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], 'receipt_' + today_() + '_' + uid_() + '_' + (i + 1)));
    var id = uid_(); ids.push(id);
    // one row per screenshot; the AI later groups screenshots of the same order together
    append_('Receipts', { id: id, date: p.date || today_(), by: user, app: '', photoIds: f.getId(), status: 'pending',
      orderId: '', orderDate: '', total: '', itemsTotal: '', note: '', ts: nowIso_(), reviewed: '1', batch: batch, tries: '0' });
  });
  return { ids: ids, batch: batch };
}

/** Time-driven (every 5 minutes) and "Read now": reads pending screenshots with Gemini. */
function processReceipts() {
  registerFinance_();
  if (typeof registerLife_ === 'function') registerLife_();
  if (typeof registerDetox_ === 'function') registerDetox_();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return 0;
  var n = 0;
  try {
    var started = Date.now();
    n = processReceiptsLocked_(started);
    if (typeof processDetoxLocked_ === 'function' && Date.now() - started < 3 * 60 * 1000) n += processDetoxLocked_(started);
  } finally { lock.releaseLock(); }
  return n;
}
/** Hours since an ISO timestamp written by nowIso_(). */
function ageHours_(iso) {
  var m = String(iso || '').match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/);
  if (!m) return 0;
  var then = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  var now = new Date(Utilities.formatDate(new Date(), TZ, "yyyy/MM/dd HH:mm"));
  return (now - then) / 3600000;
}
/** Shared handling when an AI job fails: busy AI waits (up to a day), other errors get 3 tries. */
function aiFail_(sheet, row, e, ts, tries) {
  var msg = String(e && e.message || e);
  if (/^AI_BUSY/.test(msg)) {
    if (ageHours_(ts) > 24) update_(sheet, row, { status: 'error', note: 'AI was busy all day. Tap Try again.' });
    else update_(sheet, row, { status: 'pending', note: 'AI_BUSY' });
  } else {
    var n = (+tries || 0) + 1;
    update_(sheet, row, { status: n >= 3 ? 'error' : 'pending', tries: String(n), note: msg.slice(0, 300) });
  }
}
function processReceiptsLocked_(started) {
  started = started || Date.now();
  var all = rows_('Receipts');
  all.forEach(function (r) {                                       // un-stick jobs from a run that was cut off
    if (r.status === 'processing' && ageHours_(str_(r.note).replace('PROC ', '')) > 0.25) update_('Receipts', r._row, { status: 'pending', note: '' });
  });
  var pending = all.filter(function (r) { return r.status === 'pending' || r.status === 'retry'; })
    .sort(function (a, b) { return str_(a.ts) < str_(b.ts) ? -1 : str_(a.ts) > str_(b.ts) ? 1 : 0; });
  if (!pending.length) return 0;
  if (!aiKeys_().length) { pending.forEach(function (r) { update_('Receipts', r._row, { note: 'NO_KEY' }); }); return 0; }
  // groups of up to 5 screenshots from the same upload go to the AI together
  var groups = [], byBatch = {};
  pending.forEach(function (r) {
    var b = str_(r.batch) || r.id, g = byBatch[b];
    if (!g || g.length >= 5) { g = byBatch[b] = []; groups.push(g); }
    g.push(r);
  });
  var n = 0;
  for (var i = 0; i < groups.length; i++) {
    if (Date.now() - started > 4 * 60 * 1000) break;               // stay inside the 6-minute limit
    var g = groups[i];
    g.forEach(function (r) { update_('Receipts', r._row, { status: 'processing', note: 'PROC ' + nowIso_() }); });
    try { readBatch_(g); n += g.length; }
    catch (e) {
      if (/^AI_BUSY/.test(String(e.message || e))) { g.forEach(function (r) { aiFail_('Receipts', r._row, e, r.ts, r.tries); }); break; }
      g.forEach(function (r) { aiFail_('Receipts', r._row, e, r.ts, r.tries); });
    }
  }
  return n;
}

function readBatch_(rows) {
  var parts = [{ text: receiptPrompt_(rows.length) }];
  rows.forEach(function (r, i) {
    String(r.photoIds).split(',').filter(Boolean).forEach(function (id) {
      var b = DriveApp.getFileById(id).getBlob();
      parts.push({ text: 'Screenshot ' + (i + 1) + ':' });
      parts.push({ inline_data: { mime_type: b.getContentType() || 'image/jpeg', data: Utilities.base64Encode(b.getBytes()) } });
    });
  });
  var j = geminiJson_(parts);
  var orders = j.orders || (j.items ? [Object.assign({ shots: rows.map(function (r, i) { return i + 1; }) }, j)] : []);
  var used = {};
  orders.forEach(function (o) {
    var shots = (o.shots || []).map(Number).filter(function (k) { return k >= 1 && k <= rows.length && !used[k]; });
    if (!shots.length) return;
    shots.forEach(function (k) { used[k] = 1; });
    var main = rows[shots[0] - 1];
    saveOrder_(main, o);
    shots.slice(1).forEach(function (k) { update_('Receipts', rows[k - 1]._row, { status: 'merged', note: 'Part of ' + main.id, app: String(o.app || '') }); });
  });
  rows.forEach(function (r, i) { if (!used[i + 1]) update_('Receipts', r._row, { status: 'skipped', note: 'Not a bill or not readable' }); });
}

function saveOrder_(r, j) {
  var app = String(j.app || r.app || '').trim();
  var orderDate = /^\d{4}-\d{2}-\d{2}$/.test(j.orderDate || '') && j.orderDate <= today_() ? j.orderDate : str_(r.date);
  var total = money_(j.total);
  // duplicate check: same app + order id, or same app + date + total
  var dup = rows_('Receipts').filter(function (x) {
    return x.id !== r.id && x.status === 'done' && str_(x.app).toLowerCase() === app.toLowerCase() &&
      ((j.orderId && str_(x.orderId) === String(j.orderId)) || (total && str_(x.orderDate) === orderDate && money_(x.total) === total));
  })[0];
  if (dup) {
    update_('Receipts', r._row, { status: 'duplicate', app: app, orderId: j.orderId || '', orderDate: orderDate, total: total, note: 'Same as order ' + dup.id });
    return;
  }
  var rules = rulesMap_(), sum = 0, lines = [];
  (j.items || []).forEach(function (it) {
    var amt = money_(it.price); if (!amt) return;
    var learned = rules[itemKey_(it.name)];
    var cat = learned && learned.category ? learned.category : (FIN_CATS.indexOf(it.category) >= 0 ? it.category : 'other');
    lines.push({ item: String(it.name || '').trim(), qty: it.qty || '', amount: amt, category: cat,
      need: learned && learned.need ? learned.need : (it.need === 'want' ? 'want' : 'need'),
      check: !learned && (it.sure === false || cat === 'other') });
    sum += amt;
  });
  (j.fees || []).forEach(function (f) {
    var amt = money_(f.amount); if (!amt) return;
    lines.push({ item: String(f.name || 'Fee').trim(), qty: '', amount: amt, category: 'fees', need: 'want' }); sum += amt;
  });
  var disc = money_(j.discount);
  if (disc > 0) { lines.push({ item: 'Discount / savings', qty: '', amount: -disc, category: 'other', need: '' }); sum -= disc; }
  var mismatch = total && Math.abs(sum - total) > 2;
  lines.forEach(function (l) {
    append_('Expenses', { id: uid_(), date: orderDate, amount: l.amount, category: l.category, item: l.item, qty: l.qty, app: app,
      need: l.need, reason: '', paidBy: r.by, mode: 'online', source: r.id, createdBy: 'ai', ts: nowIso_(), active: '1',
      reviewed: l.check ? '0' : '1' });
  });
  update_('Receipts', r._row, { status: 'done', app: app, orderId: j.orderId || '', orderDate: orderDate, total: total || money_(sum),
    itemsTotal: money_(sum), note: mismatch ? 'MISMATCH' : '' });
}

function receiptPrompt_(n) {
  var cats = FIN_CATS.map(function (c) { return c + ' = ' + FIN_CAT_EN[c]; }).join('\n');
  return [
    'Below are ' + (n || 1) + ' numbered screenshots from Indian shopping, grocery, food-delivery or payment apps (for example Blinkit, Zepto, Swiggy Instamart, BigBasket, Amazon, Flipkart, Meesho, Myntra, Nykaa, Swiggy, Zomato, a petrol pump or an electricity bill).',
    'Group them into ORDERS: several screenshots may show parts of the same order (same app, order id, date or overlapping item lists). Do not count an item twice where screenshots overlap. Different orders must be separate.',
    'For each order read every purchased line: the name as written, the quantity text, and the LINE price actually paid in rupees (after per-item discounts).',
    'Put delivery, handling, platform, packaging, small-cart and surge fees and tips in "fees" (not in items). Put order-level coupon or discount savings in "discount" as a positive number.',
    'Choose one category key for each item from this list:', cats,
    'Set "sure" to false when you are not confident about the category.',
    'Set "need" to "want" for things that are clearly optional treats or impulse buys (snacks, sweets, cold drinks, toys, cosmetics extras, food delivery), otherwise "need".',
    'Return ONLY JSON: {"orders": [{"shots": [screenshot numbers], "app": string, "orderId": string, "orderDate": "YYYY-MM-DD" or "", "total": number, "discount": number, "items": [{"name": string, "qty": string, "price": number, "category": string, "need": "need"|"want", "sure": boolean}], "fees": [{"name": string, "amount": number}]}]}',
    'Leave out screenshots that are not a bill or order (they will be skipped). If something is unreadable, skip it rather than guessing.'
  ].join('\n');
}

// ---------------------------------------------------------------- AI: several free models, two keys, waits when busy

var AI_MODELS_ = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
function aiKeys_() {
  return [setting_('geminiKey', ''), setting_('geminiKey2', '')].map(function (k) { return String(k).trim(); })
    .filter(function (k, i, a) { return k && a.indexOf(k) === i; });
}
function aiModels_() {
  var extra = setting_('geminiModels', '').split(',').map(function (m) { return m.trim(); });
  return [setting_('geminiModel', '')].concat(extra, AI_MODELS_).filter(function (m, i, a) { return m && a.indexOf(m) === i; });
}
/**
 * Sends parts to Gemini and returns the JSON reply. Tries every key and model; a model that is
 * busy or over its free limit is rested for a while (remembered in the cache). If all are busy,
 * throws "AI_BUSY" so the job waits and is tried again by the 5-minute trigger.
 */
function geminiJson_(parts, key, temperature) {
  var keys = key ? [key] : aiKeys_();
  if (!keys.length) throw new Error('No Gemini key saved');
  var models = aiModels_(), cache = CacheService.getScriptCache(), lastErr = '', busy = false;
  for (var k = 0; k < keys.length; k++) {
    var tag = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, keys[k])).slice(0, 8);
    for (var i = 0; i < models.length; i++) {
      var ck = 'ai_' + tag + '_' + models[i];
      if (!key && cache.get(ck)) { busy = true; continue; }
      var res;
      try {
        res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(models[i]) + ':generateContent?key=' + encodeURIComponent(keys[k]), {
          method: 'post', contentType: 'application/json', muteHttpExceptions: true,
          payload: JSON.stringify({ contents: [{ role: 'user', parts: parts }], generationConfig: { responseMimeType: 'application/json', temperature: temperature === undefined ? 0.1 : temperature } })
        });
      } catch (netErr) { lastErr = String(netErr.message || netErr); busy = true; continue; }
      var code = res.getResponseCode(), txt = res.getContentText(), msg = txt;
      try { msg = JSON.parse(txt).error.message; } catch (x) {}
      if (code === 404 || (code === 400 && /not found|not supported|model/i.test(msg))) { cache.put(ck, '1', 21600); lastErr = 'Model ' + models[i] + ' not available'; continue; }
      if (code === 429 || code >= 500) { cache.put(ck, '1', /per.?day|daily/i.test(msg) ? 21600 : 600); busy = true; lastErr = 'Gemini ' + code + ': ' + String(msg).slice(0, 160); continue; }
      if (code === 400 && /api key|API_KEY/i.test(msg) || code === 401 || code === 403) { lastErr = 'Gemini key problem: ' + String(msg).slice(0, 160); break; }
      if (code !== 200) { lastErr = 'Gemini ' + code + ': ' + String(msg).slice(0, 160); continue; }
      var body = JSON.parse(txt), cand = body.candidates && body.candidates[0];
      if (!cand || !cand.content) { lastErr = 'Gemini gave no answer (' + (cand && cand.finishReason || 'blocked') + ')'; continue; }
      var text = cand.content.parts.filter(function (x) { return !x.thought; }).map(function (x) { return x.text || ''; }).join('');
      var s = text.indexOf('{'), e2 = text.lastIndexOf('}');
      if (s < 0 || e2 < s) { lastErr = 'Gemini reply was not JSON'; continue; }
      try { var out = JSON.parse(text.slice(s, e2 + 1)); } catch (pe) { lastErr = 'Gemini reply was not JSON'; continue; }
      if (models[i] !== setting_('geminiModel', '')) setSetting_('geminiModel', models[i]);   // start with the model that works
      return out;
    }
  }
  if (busy) throw new Error('AI_BUSY ' + lastErr);
  throw new Error(lastErr || 'No Gemini model available');
}

/** Settings button: checks that the Gemini key works. */
function testGemini_(user, p) {
  var keys = p.key ? [String(p.key).trim()] : aiKeys_();
  if (!keys.length) throw new Error('No key saved');
  var ok = 0;
  keys.forEach(function (k) { try { var j = geminiJson_([{ text: 'Reply with this JSON only: {"ok": true}' }], k); if (j.ok) ok++; } catch (e) { if (keys.length === 1) throw e; } });
  if (!ok) throw new Error('Key did not work');
  return { ok: true, keys: ok };
}
function retryReceipt_(user, p) {
  var r = find_('Receipts', function (x) { return x.id === p.id; });
  if (!r) throw new Error('Not found');
  if (!str_(r.photoIds)) throw new Error('Photo already deleted');
  update_('Receipts', r._row, { status: 'pending', note: '', tries: '0', ts: nowIso_() });
  return processReceipts();
}

// ---------------------------------------------------------------- recurring

function addRecurring_(user, p) {
  var amt = money_(p.amount); if (!amt) throw new Error('Amount required');
  var day = Math.max(1, Math.min(28, +p.day || 1));
  append_('Recurring', { id: uid_(), day: day, amount: amt, category: FIN_CATS.indexOf(p.category) >= 0 ? p.category : 'bills',
    item: String(p.item || '').trim(), paidBy: p.paidBy || user, mode: p.mode || '', active: '1', lastMonth: '' });
  runRecurring_();
  return true;
}
function deleteRecurring_(user, p) {
  var r = find_('Recurring', function (x) { return x.id === p.id; });
  if (r) update_('Recurring', r._row, { active: '0' });
  return true;
}
function runRecurring_() {
  var t = today_(), month = t.slice(0, 7), dom = +t.slice(8, 10);
  rows_('Recurring').forEach(function (r) {
    if (String(r.active) !== '1' || str_(r.lastMonth) === month || dom < +r.day) return;
    append_('Expenses', { id: uid_(), date: month + '-' + ('0' + r.day).slice(-2), amount: money_(r.amount), category: r.category, item: str_(r.item),
      qty: '', app: '', need: 'need', reason: '', paidBy: r.paidBy, mode: str_(r.mode), source: 'recurring', createdBy: 'auto', ts: nowIso_(), active: '1', reviewed: '1' });
    update_('Recurring', r._row, { lastMonth: month });
  });
}

// ---------------------------------------------------------------- budgets

function saveBudgets_(user, p) {
  Object.keys(p.budgets || {}).forEach(function (c) {
    if (FIN_CATS.indexOf(c) >= 0) setSetting_('budget_' + c, String(Math.max(0, Math.round(+p.budgets[c] || 0))));
  });
  return budgets_();
}

// ---------------------------------------------------------------- periods & stats

function finPeriod_(mode, anchor) {
  anchor = anchor || today_();
  if (mode === 'month') {
    var m = anchor.slice(0, 7), start = m + '-01';
    var d = dateObj_(start); d.setMonth(d.getMonth() + 1); d.setDate(0);
    var end = Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
    var pd = dateObj_(start); pd.setMonth(pd.getMonth() - 1);
    var pstart = Utilities.formatDate(pd, TZ, 'yyyy-MM') + '-01', pend = addDays_(start, -1);
    return { mode: 'month', key: 'M:' + m, start: start, end: end, pstart: pstart, pend: pend, days: +end.slice(8, 10) };
  }
  var ws = weekStart_(anchor);
  return { mode: 'week', key: 'W:' + ws, start: ws, end: addDays_(ws, 6), pstart: addDays_(ws, -7), pend: addDays_(ws, -1), days: 7 };
}

function finStats_(list, from, to, days) {
  var inP = list.filter(function (e) { return e.date >= from && e.date <= to; });
  var s = { total: 0, count: inP.length, byCat: {}, byApp: {}, byNeed: { need: 0, want: 0, avoid: 0, none: 0 }, items: {}, fees: 0, discounts: 0, byPerson: {}, avoidReasons: {}, biggest: [] };
  inP.forEach(function (e) {
    s.total += e.amount;
    s.byCat[e.category] = money_((s.byCat[e.category] || 0) + e.amount);
    if (e.app) s.byApp[e.app] = money_((s.byApp[e.app] || 0) + e.amount);
    var nd = e.need === 'need' || e.need === 'want' || e.need === 'avoid' ? e.need : 'none';
    if (e.amount > 0) s.byNeed[nd] = money_(s.byNeed[nd] + e.amount);
    if (e.category === 'fees') s.fees = money_(s.fees + e.amount);
    if (e.amount < 0) s.discounts = money_(s.discounts - e.amount);
    if (e.paidBy) s.byPerson[e.paidBy] = money_((s.byPerson[e.paidBy] || 0) + e.amount);
    if (nd === 'avoid') { var rr = e.reason || '?'; s.avoidReasons[rr] = (s.avoidReasons[rr] || 0) + 1; }
    var k = itemKey_(e.item);
    if (k && e.amount > 0 && e.category !== 'fees') {
      var it = s.items[k] = s.items[k] || { name: e.item, times: 0, amount: 0, category: e.category };
      it.times++; it.amount = money_(it.amount + e.amount);
    }
  });
  s.total = money_(s.total);
  s.perDay = money_(s.total / Math.max(1, days));
  s.topItems = Object.keys(s.items).map(function (k) { return s.items[k]; })
    .sort(function (a, b) { return b.amount - a.amount; }).slice(0, 10);
  s.frequent = Object.keys(s.items).map(function (k) { return s.items[k]; }).filter(function (x) { return x.times >= 2; })
    .sort(function (a, b) { return b.times - a.times; }).slice(0, 6);
  s.biggest = inP.filter(function (e) { return e.amount > 0; }).sort(function (a, b) { return b.amount - a.amount; }).slice(0, 5)
    .map(function (e) { return { item: e.item, amount: e.amount, date: e.date, category: e.category }; });
  delete s.items;
  return s;
}

function priceWatch_(list, from, to) {
  var hist = {};
  list.forEach(function (e) {
    var q = parseFloat(String(e.qty).replace(/[^0-9.]/g, '')) || 1;
    var k = itemKey_(e.item); if (!k || e.amount <= 0 || e.category === 'fees') return;
    (hist[k] = hist[k] || []).push({ date: e.date, unit: e.amount / q, name: e.item });
  });
  var out = [];
  Object.keys(hist).forEach(function (k) {
    var h = hist[k].sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var now = h.filter(function (x) { return x.date >= from && x.date <= to; });
    var before = h.filter(function (x) { return x.date < from && x.date >= addDays_(from, -120); });
    if (!now.length || !before.length) return;
    var a = before[before.length - 1].unit, b = now[now.length - 1].unit;
    if (a > 0 && Math.abs(b - a) / a >= 0.05) out.push({ name: now[now.length - 1].name, before: money_(a), now: money_(b), pct: Math.round((b - a) * 100 / a) });
  });
  return out.sort(function (a, b) { return b.pct - a.pct; }).slice(0, 6);
}

function getFinance_(user, p) {
  runRecurring_();
  var per = finPeriod_(p.mode === 'month' ? 'month' : 'week', p.anchor);
  var all = rows_('Expenses').filter(function (r) { return String(r.active) === '1'; }).map(expRow_);
  var stats = finStats_(all, per.start, per.end, Math.min(per.days, Math.max(1, daysBetween_(per.start, today_()) + 1)));
  var prev = finStats_(all, per.pstart, per.pend, per.mode === 'month' ? +per.pend.slice(8, 10) : 7);
  var list = all.filter(function (e) { return e.date >= per.start && e.date <= per.end; })
    .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  var receipts = rows_('Receipts').sort(function (a, b) { return str_(a.ts) < str_(b.ts) ? 1 : -1; }).slice(0, 40).map(function (r) {
    return { batch: str_(r.batch), ts: str_(r.ts), id: r.id, date: str_(r.date), by: r.by, app: str_(r.app), status: r.status, total: money_(r.total), itemsTotal: money_(r.itemsTotal),
      note: str_(r.note), reviewed: String(r.reviewed) === '1', photos: String(r.photoIds).split(',').filter(Boolean).length };
  });
  var review = all.filter(function (e) { return !e.reviewed && e.source && e.source !== 'manual'; })
    .sort(function (a, b) { return a.source < b.source ? -1 : 1; });
  var rep = find_('FinReports', function (x) { return str_(x.period) === per.key; });
  var monthBudget = budgets_(), factor = per.mode === 'month' ? 1 : 7 / 30;
  var budget = {}; Object.keys(monthBudget).forEach(function (c) { budget[c] = Math.round(monthBudget[c] * factor); });
  return {
    period: per, stats: stats, prev: prev, list: list, receipts: receipts, review: review,
    budgets: monthBudget, budget: budget, prices: priceWatch_(all, per.start, per.end),
    recurring: rows_('Recurring').filter(function (r) { return String(r.active) === '1'; })
      .map(function (r) { return { id: r.id, day: +r.day, amount: money_(r.amount), category: r.category, item: str_(r.item) }; }),
    ai: rep ? JSON.parse(rep.json) : null, hasKey: aiKeys_().length > 0, cats: FIN_CATS,
    recentManual: typeof expenseRecent_ === 'function' ? expenseRecent_(user) : []
  };
}
function daysBetween_(a, b) { return Math.round((dateObj_(b) - dateObj_(a)) / 86400000); }

// ---------------------------------------------------------------- AI analysis

function finAnalysis_(user, p) {
  var f = getFinance_(user, p);
  var per = f.period, key = aiKeys_().length, ai;
  var data = { period: per, thisPeriod: f.stats, previousPeriod: f.prev, monthlyBudgets: f.budgets, budgetsForThisPeriod: f.budget, priceChanges: f.prices };
  if (key) {
    try {
      ai = geminiJson_([{ text: [
        "You are the money coach inside \"Shlok's Parents\", a private app for a Gujarati family (Mehul, a government officer and the only earner; Dr. Arpita, at home with their 15-month-old son Shlok). Amounts are in Indian rupees.",
        'Below is their spending for one ' + per.mode + ' compared with the previous ' + per.mode + ' (by category, by app, need/want/avoid split, frequent items, fees, price changes, budgets).',
        'Write a short, kind, practical review. Point out the 3 most useful observations with real numbers (changes vs last period, budget overruns, frequent small orders, fees paid, avoidable spending and its reasons, price rises).',
        'Suggest exactly 2 small, specific money experiments for next ' + per.mode + '. Never shame. Category keys: ' + FIN_CATS.join(', ') + '.',
        'Return ONLY JSON: {"summary_gu": string, "summary_en": string, "insights": [{"gu": string, "en": string}], "experiments": [{"gu": string, "en": string}]}',
        'Gujarati must be natural Gujarati script.', 'DATA:', JSON.stringify(data)].join('\n') }], undefined, 0.3);
      ai.source = 'gemini';
    } catch (e) { ai = finRules_(f); ai.error = String(e.message || e); }
  } else ai = finRules_(f);
  ai.ts = nowIso_();
  upsert_('FinReports', function (x) { return str_(x.period) === per.key; }, { period: per.key, json: JSON.stringify(ai), ts: nowIso_() });
  return getFinance_(user, p);
}

function finRules_(f) {
  var s = f.stats, pv = f.prev, ins = [];
  var diff = pv.total ? Math.round((s.total - pv.total) * 100 / pv.total) : null;
  if (diff !== null) ins.push({ gu: 'કુલ ખર્ચ ₹' + s.total + ', ગયા સમયગાળા કરતાં ' + (diff >= 0 ? diff + '% વધુ' : (-diff) + '% ઓછો') + '.',
    en: 'Total spend ₹' + s.total + ', ' + (diff >= 0 ? diff + '% more' : (-diff) + '% less') + ' than the previous period.' });
  var over = Object.keys(f.budget).filter(function (c) { return (s.byCat[c] || 0) > f.budget[c]; });
  if (over.length) ins.push({ gu: 'બજેટ કરતાં વધુ: ' + over.join(', '), en: 'Over budget: ' + over.join(', ') });
  if (s.fees) ins.push({ gu: 'ડિલિવરી/હેન્ડલિંગ ફીમાં ₹' + s.fees + ' ગયા.', en: '₹' + s.fees + ' went on delivery/handling fees.' });
  if (s.byNeed.avoid) ins.push({ gu: 'ટાળી શકાય તેવો ખર્ચ: ₹' + s.byNeed.avoid, en: 'Avoidable spending: ₹' + s.byNeed.avoid });
  return {
    source: 'rules',
    summary_gu: 'આ વિશ્લેષણ નિયમો પરથી બન્યું છે. વધુ ઊંડું વિશ્લેષણ માટે સેટિંગ્સમાં Gemini key ઉમેરો.',
    summary_en: 'This analysis was built from simple rules. Add a Gemini key in Settings for deeper analysis.',
    insights: ins.slice(0, 3),
    experiments: [{ gu: 'નાનાં ઓર્ડર ભેગા કરીને અઠવાડિયે 2 વાર જ મંગાવો, જેથી ફી બચે.', en: 'Combine small orders into 2 a week to save on fees.' },
      { gu: '"જોઈએ છે" વસ્તુઓ 48 કલાક પછી જ ખરીદો.', en: 'Buy "want" items only after waiting 48 hours.' }]
  };
}

/** Called by the daily trigger: monthly recurring entries + month-end AI analysis on the 1st. */
function financeDaily_() {
  registerFinance_();
  runRecurring_();
  cleanupReceipts_();
  if (today_().slice(8, 10) === '01') {
    try { finAnalysis_('mehul', { mode: 'month', anchor: addDays_(today_(), -1) }); } catch (e) {}
  }
}

/** Screenshots are only needed until the AI has read them. 7 days after upload they are moved to Drive's trash
 *  (Google empties it after 30 days). The spending entries made from them stay. Pending ones are kept until read. */
function cleanupReceipts_() {
  registerFinance_();
  var cutoff = addDays_(today_(), -7), n = 0;
  rows_('Receipts').forEach(function (r) {
    if (!str_(r.photoIds) || r.status === 'pending' || r.status === 'retry' || r.status === 'processing') return;
    if (str_(r.ts).slice(0, 10) > cutoff) return;
    String(r.photoIds).split(',').filter(Boolean).forEach(function (id) {
      try { DriveApp.getFileById(id).setTrashed(true); n++; } catch (e) {}
    });
    update_('Receipts', r._row, { photoIds: '' });
  });
  if (typeof registerDetox_ === 'function') {
    registerDetox_();
    rows_('DetoxShots').forEach(function (r) {
      if (!str_(r.photoIds) || r.status === 'pending' || r.status === 'processing') return;
      if (str_(r.ts).slice(0, 10) > cutoff) return;
      String(r.photoIds).split(',').filter(Boolean).forEach(function (id) { try { DriveApp.getFileById(id).setTrashed(true); n++; } catch (e) {} });
      update_('DetoxShots', r._row, { photoIds: '' });
    });
  }
  return n;
}
