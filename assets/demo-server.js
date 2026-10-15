// نسخة تجريبية فقط: كود الخادم نفسه (Code.gs) يعمل داخل المتصفح على بيانات تجريبية محفوظة في هذا الجهاز.
// Generated from server/Code.gs; do not edit by hand.
window.BasiraDemoServer=function(SpreadsheetApp,PropertiesService,Utilities,Session,ContentService,LockService,CacheService,MailApp,DriveApp,ScriptApp,Logger){
/**
 * بصيرة للمعاملات: خادم نظام العملاء والطلبات (Google Apps Script + Google Sheets)
 *
 * ما يفعله:
 *  - يستقبل طلبات الموقع ويحفظها في ورقة «الطلبات»، وينشئ العميل أو يربطه برقم جواله.
 *  - يرسل للعميل رداً تلقائياً بالبريد برقم الطلب، ويرسل إشعاراً لبريد المكتب.
 *  - يخدم صفحة «نظام العملاء» (crm.html): العملاء، المعاملات، الطلبات، السجل، إرسال البريد.
 *  - يرسل كل صباح تذكيراً للمكتب بالتجديدات القريبة والمعاملات المتأخرة.
 *  - يخدم صفحة «حسابي» (portal.html): حساب لكل عميل باسم مستخدم وكلمة مرور، يطلب منه الخدمات
 *    ويتابع طلباته ومعاملاته وينزّل ملفاته وتراخيصه. الملفات تُحفظ خاصة في Google Drive للمكتب
 *    ولا يصل إليها العميل إلا عبر حسابه.
 *
 * التشغيل لأول مرة: راجع ملف «اقرأني - تشغيل نظام العملاء.txt».
 */

var SHEETS = {
  Clients: ['id','created','name','type','phone','email','qid','cr','estCard','taxNo','plan','planEnd','address','source','requirements','notes','updated'],
  Transactions: ['id','created','clientId','code','service','status','fee','govFee','paid','govRef','startDate','dueDate','expiryDate','assignee','docs','notes','closed','updated'],
  Requests: ['id','created','name','phone','email','type','plan','services','codes','lang','status','clientId','mailed','notes','updated'],
  Log: ['id','created','clientId','txnId','kind','subject','body','by'],
  Accounts: ['id','created','clientId','username','salt','hash','status','lastLogin','updated'],
  Files: ['id','created','clientId','txnId','title','url','fileId','by'],
  Consents: ['id','created','clientId','name','phone','docs','version','lang','source'],
  Credentials: ['id','created','clientId','portal','username','secret','note','by','updated'],
  Messages: ['id','created','clientId','from','by','body','read'],
  Staff: ['id','created','username','name','role','salt','hash','status','mustChange','lastLogin','updated',
          'jobTitle','phone','email','qid','hireDate','shiftStart','shiftEnd','workDays','perms','notes'],
  Sessions: ['id','created','staffId','username','login','lastSeen','logout','minutes','closedBy'],
  Activity: ['id','created','staffId','username','action','sheet','recordId','clientId','summary']
};
var PREFIX = {Clients:'C', Transactions:'T', Requests:'R', Log:'L', Accounts:'A', Files:'F', Consents:'K', Credentials:'P', Messages:'M', Staff:'S', Sessions:'W', Activity:'X'};
// permissions an admin grants to each employee; an admin has all of them plus staff management and reports
var PERMS = ['requests','clients_view','clients_edit','transactions','finance','messages','files','accounts','credentials','email','delete','log'];
var SESSION = null;   // the attendance session id of the current staff request
// first admin login; the system forces a change of both on first sign-in
var FIRST_ADMIN_USER = '123', FIRST_ADMIN_PASSWORD = '123';
var STAFF = null;   // the signed-in staff member for the current request
// legal documents the client accepts (legal.html). Bump LEGAL_VERSION when the text changes.
var LEGAL_VERSION = '1.0';
var LEGAL_DOCS = 'اتفاقية الخدمة، حدود المسؤولية، التفويض، البيانات والسرية';
var TOKEN_HOURS = 12;          // staff session
var CLIENT_TOKEN_HOURS = 24;   // client session
var PW_ROUNDS = 500;
var MAX_UPLOAD_MB = 10;
var ACC_ACTIVE = 'مفعّل', ACC_PENDING = 'بانتظار التفعيل', ACC_OFF = 'موقوف';
// what a client may see of their own records (internal notes and staff fields stay hidden)
var CLIENT_FIELDS = ['id','name','type','phone','email','qid','cr','estCard','taxNo','plan','planEnd','address'];
var CLIENT_EDITABLE = ['name','type','email','qid','cr','estCard','taxNo','address'];
var TXN_FIELDS = ['id','created','code','service','status','fee','govFee','paid','govRef','startDate','dueDate','expiryDate','docs','closed','updated'];
var REQ_FIELDS = ['id','created','services','plan','status','updated'];

// ---------- setup (run once from the editor) ----------
function setup() {
  var ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('SECRET')) p.setProperty('SECRET', Utilities.getUuid() + Utilities.getUuid());
  if (!p.getProperty('OFFICE_EMAIL')) p.setProperty('OFFICE_EMAIL', 'baseeratactions@gmail.com');
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'dailyReminders') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('dailyReminders').timeBased().everyDays(1).atHour(7).create();
  ensureAdmin();
  Logger.log('تم الإعداد. الدخول الأول للإدارة: اسم المستخدم 123 وكلمة المرور 123، وسيطلب النظام تغييرهما فوراً. بريد المكتب: ' + p.getProperty('OFFICE_EMAIL'));
}

// ---------- HTTP ----------
function doGet() { return json({ok: true, service: 'basira-crm'}); }

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json({ok: false, error: 'bad_json'}); }
  try {
    if (req.action === 'request') return json(publicRequest(req));
    if (req.action === 'register') return json(publicRegister(req));
    if (req.action === 'login') return json(login(req.username, req.password));
    if (req.action === 'signup') return json(clientSignup(req));
    if (req.action === 'clogin') return json(clientLogin(req));
    if (req.action === 'cforgot') return json(clientForgot(req));
    if (req.action === 'creset') return json(withLock(function () { return clientReset(req); }));
    if (['cme', 'cprofile', 'crequest', 'cpass', 'cfile', 'ccred', 'ccreddel', 'cmsg'].indexOf(req.action) >= 0) {
      var acc = checkClientToken(req.token);
      if (!acc) return json({ok: false, error: 'auth'});
      switch (req.action) {
        case 'cme': return json(clientMe(acc));
        case 'cprofile': return json(withLock(function () { return clientProfile(acc, req.profile || {}); }));
        case 'crequest': return json(clientRequest(acc, req));
        case 'cpass': return json(withLock(function () { return clientPassword(acc, req.old, req.password); }));
        case 'cfile': return json(clientFile(acc, req.id));
        case 'cmsg': return json(withLock(function () { return clientMessage(acc, req.body); }));
        case 'ccred': return json(withLock(function () { return clientCredential(acc, req); }));
        case 'ccreddel': return json(withLock(function () { return clientCredentialDelete(acc, req.id); }));
        default: return json({ok: false, error: 'unknown_action'});
      }
    }
    STAFF = checkToken(req.token);
    if (!STAFF) return json({ok: false, error: 'auth'});
    if (req.action === 'staffMe') return json({ok: true, me: publicStaff(STAFF)});
    if (req.action === 'staffPass') return json(withLock(function () { return staffChangeOwn(req); }));
    if (req.action === 'staffLogout') return json(withLock(function () { return staffLogout(); }));
    if (STAFF.mustChange) return json({ok: false, error: 'must_change'});
    var need = permFor(req);
    if (need && !can(need)) return json({ok: false, error: need === 'admin' ? 'admin_only' : 'no_permission'});
    touchSession();
    switch (req.action) {
      case 'list': return json({ok: true, data: listAll(), me: publicStaff(STAFF)});
      case 'staffUsers': return json({ok: true, rows: rows('Staff').map(publicStaff), perms: PERMS});
      case 'staffSave': return json(withLock(function () { return staffSave(req); }));
      case 'report': return json(staffReport(req.from, req.to));
      case 'reportEmail': return json(emailReport(req.from, req.to));
      case 'reply': return json(withLock(function () { return staffReply(req); }));
      case 'save':
        if (req.sheet === 'Accounts') return json({ok: false, error: 'use_clientAccount'});
        if (['Credentials', 'Consents', 'Staff', 'Messages', 'Sessions', 'Activity'].indexOf(req.sheet) >= 0) return json({ok: false, error: 'read_only'});
        if (req.sheet === 'Log' && req.row) req.row.by = STAFF.username;
        return json(withLock(function () { return {ok: true, row: staffSaveRow(req.sheet, req.row || {})}; }));
      case 'delete': return json(withLock(function () {
        if (['Staff', 'Consents', 'Sessions', 'Activity'].indexOf(req.sheet) >= 0) return {ok: false, error: 'read_only'};
        if (req.sheet === 'Files') trashDriveFile(req.id);
        var gone = rows(req.sheet).filter(function (x) { return x.id === req.id; })[0] || {};
        var done = deleteRow(req.sheet, req.id);
        if (done) audit('delete', req.sheet, req.id, gone.clientId || (req.sheet === 'Clients' ? req.id : ''), 'حذف ' + (gone.service || gone.name || gone.title || req.id));
        return {ok: done};
      }));
      case 'sendEmail': return json(withLock(function () { var r = sendClientEmail(req); if (r.ok) audit('email', 'Log', '', req.clientId, 'بريد للعميل: ' + clean(req.subject, 120)); return r; }));
      case 'clientAccount': return json(withLock(function () { var r = staffAccount(req); if (r.ok) audit('account', 'Accounts', r.row.id, req.clientId, 'حساب العميل: ' + r.row.status + (req.password ? ' · كلمة مرور جديدة' : '')); return r; }));
      case 'upload': return json(withLock(function () { var r = staffUpload(req); if (r.ok) audit('file', 'Files', r.row.id, req.clientId, 'رفع ملف: ' + r.row.title); return r; }));
      case 'reveal': return json(withLock(function () { return staffReveal(req.id); }));
      default: return json({ok: false, error: 'unknown_action'});
    }
  } catch (err) { return json({ok: false, error: String(err && err.message || err)}); }
}

function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function withLock(fn) { var l = LockService.getScriptLock(); l.waitLock(20000); try { return fn(); } finally { l.releaseLock(); } }
function prop(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }

// ---------- auth ----------
function sign(s) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, prop('SECRET'))); }
// staff (admin and employees) sign in with a username and password stored as salted hashes in the Staff sheet
function ensureAdmin() {
  if (rows('Staff').length) return;
  var salt = Utilities.getUuid();
  saveRow('Staff', {username: FIRST_ADMIN_USER, name: 'المدير', role: 'admin', salt: salt, hash: hashPw(salt, FIRST_ADMIN_PASSWORD), status: ACC_ACTIVE, mustChange: 'نعم', lastLogin: ''});
}
function permsOf(x) { return x.role === 'admin' ? PERMS.slice() : String(x.perms || '').split(',').filter(function (p) { return PERMS.indexOf(p) >= 0; }); }
function can(p) { return STAFF.role === 'admin' || (p !== 'admin' && permsOf(STAFF).indexOf(p) >= 0); }
// which permission each staff action needs (the browser hides what an employee cannot do; this is the real check)
function permFor(r) {
  var a = r.action, sh = r.sheet;
  if (['staffUsers', 'staffSave', 'report', 'reportEmail'].indexOf(a) >= 0) return 'admin';
  if (a === 'reply') return 'messages';
  if (a === 'sendEmail') return 'email';
  if (a === 'clientAccount') return 'accounts';
  if (a === 'upload') return 'files';
  if (a === 'reveal') return 'credentials';
  if (a === 'delete') return sh === 'Clients' || sh === 'Accounts' || sh === 'Log' ? 'admin' : 'delete';
  if (a === 'save') return {Clients: 'clients_edit', Transactions: 'transactions', Requests: 'requests', Files: 'files'}[sh] || '';
  return '';
}
function publicStaff(x) {
  return {id: x.id, created: x.created, username: x.username, name: x.name, role: x.role, status: x.status, mustChange: x.mustChange ? 'نعم' : '', lastLogin: x.lastLogin,
    jobTitle: x.jobTitle, phone: x.phone, email: x.email, qid: x.qid, hireDate: x.hireDate, shiftStart: x.shiftStart, shiftEnd: x.shiftEnd, workDays: x.workDays, notes: x.notes, perms: permsOf(x)};
}
function login(user, pw) {
  user = clean(user, 40).toLowerCase(); pw = String(pw || '');
  if (!user || !pw) return {ok: false, error: 'wrong_password'};
  if (!bump('sl_' + user, 10)) return {ok: false, error: 'rate_limited'};
  Utilities.sleep(300);
  withLock(ensureAdmin);
  var st = rows('Staff').filter(function (x) { return String(x.username).toLowerCase() === user; })[0];
  if (!st || st.status !== ACC_ACTIVE || hashPw(st.salt, pw) !== st.hash) return {ok: false, error: 'wrong_password'};
  var sess = withLock(function () {
    st.lastLogin = now(); saveRow('Staff', st);
    // attendance: close any session left open (token expired or browser closed), then open a new one
    rows('Sessions').filter(function (x) { return x.staffId === st.id && !x.logout; }).forEach(function (x) { closeSession(x, 'انتهت دون خروج'); });
    return saveRow('Sessions', {staffId: st.id, username: st.username, login: now(), lastSeen: now(), logout: '', minutes: '', closedBy: ''});
  });
  var exp = String(Date.now() + TOKEN_HOURS * 3600 * 1000), body = st.id + '.' + sess.id + '.' + exp;
  return {ok: true, token: 's.' + body + '.' + sign('s|' + body), me: publicStaff(st)};
}
function checkToken(t) {
  var p = String(t || '').split('.');
  if (p.length !== 5 || p[0] !== 's' || p[4] !== sign('s|' + p[1] + '.' + p[2] + '.' + p[3]) || Number(p[3]) < Date.now()) return null;
  var st = rows('Staff').filter(function (x) { return x.id === p[1]; })[0];
  if (!st || st.status !== ACC_ACTIVE) return null;
  SESSION = p[2];
  return st;
}
function mins(a, b) { var x = parseDate(a), y = parseDate(b); return x && y ? Math.max(0, Math.round((y - x) / 60000)) : 0; }
function parseDate(s) { if (!s) return null; var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/); return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null; }
function closeSession(x, why) { x.logout = x.lastSeen || x.login; x.minutes = mins(x.login, x.logout); x.closedBy = why; saveRow('Sessions', x); }
// last activity is written at most every 5 minutes so an idle-closed session still shows its real working time
function touchSession() {
  if (!SESSION) return;
  var c = CacheService.getScriptCache(), k = 'ss_' + SESSION;
  if (c.get(k)) return;
  c.put(k, '1', 300);
  withLock(function () { var x = rows('Sessions').filter(function (y) { return y.id === SESSION; })[0]; if (x && !x.logout) { x.lastSeen = now(); saveRow('Sessions', x); } });
}
function staffLogout() {
  var x = rows('Sessions').filter(function (y) { return y.id === SESSION; })[0];
  if (x && !x.logout) { x.lastSeen = now(); x.logout = now(); x.minutes = mins(x.login, x.logout); x.closedBy = 'خروج'; saveRow('Sessions', x); }
  return {ok: true};
}
// every change a staff member makes is recorded for the admin's reports
function audit(action, sheetName, recordId, clientId, summary) {
  saveRow('Activity', {staffId: STAFF ? STAFF.id : '', username: STAFF ? STAFF.username : 'system', action: action, sheet: sheetName, recordId: recordId || '', clientId: clientId || '', summary: String(summary || '').slice(0, 300)});
}
function staffSaveRow(name, row) {
  var before = row.id ? rows(name).filter(function (x) { return x.id === row.id; })[0] : null;
  if (name === 'Transactions' && !can('finance')) {   // employees without the finance permission cannot see or change fees
    ['fee', 'govFee', 'paid'].forEach(function (k) { row[k] = before ? before[k] : ''; });
  }
  var r = saveRow(name, row);
  if (name === 'Log') return r;
  var what = {Clients: 'عميل', Transactions: 'معاملة', Requests: 'طلب', Files: 'ملف'}[name] || name;
  var label = r.service || r.name || r.title || r.id, summary;
  if (!before) summary = 'إضافة ' + what + ': ' + label + (r.status ? ' · ' + r.status : '');
  else if (before.status !== r.status && r.status) summary = what + ' ' + r.id + ' (' + label + '): ' + (before.status || '') + ' ← ' + r.status;
  else summary = 'تعديل ' + what + ' ' + r.id + ' (' + label + ')';
  audit(!before ? 'create' : (before.status !== r.status ? 'status' : 'edit'), name, r.id, name === 'Clients' ? r.id : r.clientId, summary);
  return r;
}

function staffChangeOwn(r) {
  var st = STAFF;
  if (hashPw(st.salt, String(r.old || '')) !== st.hash) return {ok: false, error: 'wrong_password'};
  if (r.username != null) {
    var u = clean(r.username, 40).toLowerCase();
    if (!/^[^\s]{3,40}$/.test(u)) return {ok: false, error: 'bad_username'};
    if (rows('Staff').some(function (x) { return String(x.username).toLowerCase() === u && x.id !== st.id; })) return {ok: false, error: 'username_taken'};
    st.username = u;
  }
  if (r.password) {
    if (!validPw(r.password)) return {ok: false, error: 'weak_password'};
    st.salt = Utilities.getUuid(); st.hash = hashPw(st.salt, r.password);
  }
  if (st.mustChange && (!r.password || st.username === FIRST_ADMIN_USER)) return {ok: false, error: 'must_change_both'};
  st.mustChange = '';
  saveRow('Staff', st);
  saveRow('Log', {kind: 'account', subject: 'الموظف ' + st.username + ' حدّث بيانات دخوله', body: '', by: st.username});
  return {ok: true, me: publicStaff(st)};
}
function staffSave(r) {
  var all = rows('Staff'), st = r.id ? all.filter(function (x) { return x.id === r.id; })[0] : null;
  if (r.id && !st) return {ok: false, error: 'not_found'};
  var isNew = !st;
  st = st || {status: ACC_ACTIVE, lastLogin: ''};
  var u = clean(r.username != null ? r.username : st.username, 40).toLowerCase();
  if (!/^[^\s]{3,40}$/.test(u)) return {ok: false, error: 'bad_username'};
  if (all.some(function (x) { return String(x.username).toLowerCase() === u && x.id !== st.id; })) return {ok: false, error: 'username_taken'};
  st.username = u;
  ['name', 'jobTitle', 'phone', 'email', 'qid', 'hireDate', 'shiftStart', 'shiftEnd', 'workDays', 'notes'].forEach(function (k) { if (r[k] != null) st[k] = clean(r[k], k === 'notes' ? 500 : 80); });
  if (r.role === 'admin' || r.role === 'staff') st.role = r.role;
  if (!st.role) st.role = 'staff';
  if (r.perms) st.perms = (Array.isArray(r.perms) ? r.perms : String(r.perms).split(',')).filter(function (p) { return PERMS.indexOf(p) >= 0; }).join(',');
  if ([ACC_ACTIVE, ACC_OFF].indexOf(r.status) >= 0) st.status = r.status;
  if (r.password) { if (!validPw(r.password)) return {ok: false, error: 'weak_password'}; st.salt = Utilities.getUuid(); st.hash = hashPw(st.salt, r.password); st.mustChange = 'نعم'; }
  if (!st.hash) return {ok: false, error: 'weak_password'};
  var admins = all.filter(function (x) { return x.role === 'admin' && x.status === ACC_ACTIVE && x.id !== st.id; });
  if (!admins.length && (st.role !== 'admin' || st.status !== ACC_ACTIVE)) return {ok: false, error: 'last_admin'};
  st = saveRow('Staff', st);
  if (st.status !== ACC_ACTIVE) rows('Sessions').filter(function (x) { return x.staffId === st.id && !x.logout; }).forEach(function (x) { closeSession(x, 'أوقفه المدير'); });
  audit(isNew ? 'staff_create' : 'staff_edit', 'Staff', st.id, '', (isNew ? 'إضافة موظف: ' : 'تعديل موظف: ') + st.username + ' · ' + (st.role === 'admin' ? 'مدير' : 'موظف') + ' · ' + st.status + (r.password ? ' · كلمة مرور مؤقتة' : ''));
  return {ok: true, row: publicStaff(st)};
}

// ---------- staff reports: attendance and work done in a period ----------
function staffReport(from, to) {
  from = /^\d{4}-\d{2}-\d{2}$/.test(from || '') ? from : now().slice(0, 10);
  to = /^\d{4}-\d{2}-\d{2}$/.test(to || '') ? to : from;
  var inRange = function (d) { d = String(d || '').slice(0, 10); return d >= from && d <= to; };
  var sessions = rows('Sessions').filter(function (x) { return inRange(x.login); });
  var acts = rows('Activity').filter(function (x) { return inRange(x.created); });
  var msgs = rows('Messages').filter(function (m) { return m.from === 'office' && inRange(m.created); });
  var staff = rows('Staff').map(function (st) {
    var ss = sessions.filter(function (x) { return x.staffId === st.id; }), aa = acts.filter(function (x) { return x.staffId === st.id; });
    var days = {};
    ss.forEach(function (x) {
      var d = String(x.login).slice(0, 10), m = x.logout ? Number(x.minutes) || 0 : mins(x.login, x.lastSeen || x.login);
      var o = days[d] = days[d] || {date: d, first: x.login.slice(11), last: '', minutes: 0, sessions: 0, open: false};
      if (x.login.slice(11) < o.first) o.first = x.login.slice(11);
      var end = String(x.logout || x.lastSeen || '').slice(11); if (end > o.last) o.last = end;
      o.minutes += m; o.sessions++; if (!x.logout) o.open = true;
    });
    var dayList = Object.keys(days).sort().map(function (d) { var o = days[d]; o.late = !!(st.shiftStart && o.first > addMin(st.shiftStart, 15)); o.early = !!(st.shiftEnd && o.last && !o.open && o.last < st.shiftEnd); return o; });
    var count = function (f) { return aa.filter(f).length; };
    return {id: st.id, username: st.username, name: st.name, jobTitle: st.jobTitle, role: st.role, shiftStart: st.shiftStart, shiftEnd: st.shiftEnd,
      days: dayList, minutes: dayList.reduce(function (a, o) { return a + o.minutes; }, 0), late: dayList.filter(function (o) { return o.late; }).length,
      actions: aa.length, txCreated: count(function (x) { return x.sheet === 'Transactions' && x.action === 'create'; }),
      txDone: count(function (x) { return x.sheet === 'Transactions' && x.action === 'status' && /← منجزة$/.test(x.summary); }),
      statusChanges: count(function (x) { return x.action === 'status'; }), replies: msgs.filter(function (m) { return m.by === st.username; }).length,
      files: count(function (x) { return x.action === 'file'; }), emails: count(function (x) { return x.action === 'email'; }),
      clientsAdded: count(function (x) { return x.sheet === 'Clients' && x.action === 'create'; }),
      log: aa.slice(-200).reverse().map(function (x) { return {created: x.created, action: x.action, summary: x.summary, clientId: x.clientId}; })};
  });
  return {ok: true, from: from, to: to, staff: staff};
}
function addMin(hhmm, n) { var m = String(hhmm).match(/^(\d{1,2}):(\d{2})/); if (!m) return '99:99'; var t = +m[1] * 60 + +m[2] + n; return ('0' + Math.floor(t / 60)).slice(-2) + ':' + ('0' + t % 60).slice(-2); }
function hm(m) { m = Number(m) || 0; return Math.floor(m / 60) + ':' + ('0' + m % 60).slice(-2); }
function reportHtml(rep) {
  var rowsHtml = rep.staff.map(function (s) {
    return '<tr><td>' + escHtml(s.name || s.username) + '</td><td>' + s.days.length + '</td><td>' + hm(s.minutes) + '</td><td>' + s.late + '</td><td>' + s.actions + '</td><td>' + s.txCreated + '</td><td>' + s.txDone + '</td><td>' + s.replies + '</td><td>' + s.files + '</td></tr>';
  }).join('');
  return '<p>تقرير الموظفين من ' + rep.from + ' إلى ' + rep.to + '</p><table border="1" cellpadding="6" style="border-collapse:collapse;font-size:14px"><tr><th>الموظف</th><th>أيام الحضور</th><th>ساعات العمل</th><th>تأخير</th><th>الإجراءات</th><th>معاملات أُضيفت</th><th>معاملات أُنجزت</th><th>ردود على العملاء</th><th>ملفات رُفعت</th></tr>' + rowsHtml + '</table>';
}
function emailReport(from, to) {
  var rep = staffReport(from, to), dest = prop('OFFICE_EMAIL');
  if (!dest) return {ok: false, error: 'invalid'};
  MailApp.sendEmail({to: dest, name: 'نظام بصيرة', subject: 'تقرير الموظفين ' + rep.from + (rep.to !== rep.from ? ' إلى ' + rep.to : ''), htmlBody: shell(reportHtml(rep))});
  return {ok: true, to: dest};
}

// ---------- sheet helpers ----------
function sheet(name) {
  if (!SHEETS[name]) throw new Error('bad_sheet');
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(name);
  if (!sh) {   // sheets added in a later version are created on first use
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function rows(name) {
  var sh = sheet(name), cols = SHEETS[name], n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, cols.length).getValues().map(function (r) {
    var o = {}; cols.forEach(function (c, i) { var v = r[i]; o[c] = v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd') : v; }); return o;
  }).filter(function (o) { return o.id; });
}
function listAll() {
  var o = {}; Object.keys(SHEETS).forEach(function (k) { o[k] = rows(k); });
  o.Accounts = o.Accounts.map(publicAccount);   // never send password hashes to the browser
  o.Credentials = o.Credentials.map(publicCredential);
  delete o.Staff; delete o.Sessions; delete o.Activity;
  // employees get only what their permissions allow
  if (!can('credentials')) o.Credentials = [];
  if (!can('messages')) o.Messages = [];
  if (!can('accounts')) o.Accounts = o.Accounts.map(function (a) { return {id: a.id, clientId: a.clientId, status: a.status}; });
  if (!can('requests')) o.Requests = [];
  if (!can('log')) o.Log = o.Log.filter(function (l) { return l.by === STAFF.username; });
  if (!can('finance')) o.Transactions = o.Transactions.map(function (t) { var c = {}; Object.keys(t).forEach(function (k) { if (['fee', 'govFee', 'paid'].indexOf(k) < 0) c[k] = t[k]; }); return c; });   // portal passwords only through 'reveal', which is logged
  return o;
}
function nextId(name) {
  var p = PREFIX[name], max = 0;
  rows(name).forEach(function (r) { var m = String(r.id).match(/(\d+)$/); if (m) max = Math.max(max, Number(m[1])); });
  return p + '-' + ('0000' + (max + 1)).slice(-4);
}
function now() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'); }
function saveRow(name, row) {
  var sh = sheet(name), cols = SHEETS[name];
  row = row || {};
  if (!row.id) { row.id = nextId(name); row.created = now(); }
  if (cols.indexOf('updated') >= 0) row.updated = now();
  var values = cols.map(function (c) { var v = row[c]; return v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : v); });
  var ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  var i = ids.indexOf(String(row.id));
  // keep text columns as text so phone numbers and IDs keep leading digits
  if (i >= 0) sh.getRange(i + 2, 1, 1, cols.length).setNumberFormat('@').setValues([values]);
  else sh.getRange(sh.getLastRow() + 1, 1, 1, cols.length).setNumberFormat('@').setValues([values]);
  return row;
}
function deleteRow(name, id) {
  var sh = sheet(name), n = sh.getLastRow() - 1; if (n < 1) return false;
  var ids = sh.getRange(2, 1, n, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) { sh.deleteRow(i + 2); return true; }
  return false;
}
function log(clientId, txnId, kind, subject, body) {
  saveRow('Log', {clientId: clientId || '', txnId: txnId || '', kind: kind, subject: subject || '', body: body || '', by: 'system'});
}

// ---------- visitor sign-up from the website (name, mobile, optional email and company) ----------
function publicRegister(r) {
  if (r.hp) return {ok: true};
  var name = clean(r.name, 120), phone = clean(r.phone, 20).replace(/\s/g, ''), email = clean(r.email, 120), company = clean(r.company, 120);
  if (!name || !/^(\+?974)?[3567]\d{7}$/.test(phone) || !r.accept) return {ok: false, error: 'invalid'};
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) email = '';
  var cache = CacheService.getScriptCache(), key = 'rg_' + phone;
  if (Number(cache.get(key) || 0) >= 5) return {ok: false, error: 'rate_limited'};
  cache.put(key, String(Number(cache.get(key) || 0) + 1), 3600);
  var phone8 = phone.slice(-8);
  return withLock(function () {
    var c = rows('Clients').filter(function (x) { return String(x.phone).slice(-8) === phone8; })[0];
    var note = (company ? 'الشركة: ' + company + ' · ' : '') + 'المسؤول: ' + name;
    if (!c) {
      c = saveRow('Clients', {name: company || name, type: company ? 'منشأة' : 'فرد', phone: phone8, email: email, source: 'تسجيل الموقع', notes: note});
      log(c.id, '', 'register', 'تسجيل زائر من الموقع', note);
    } else if (email && !c.email) { c.email = email; saveRow('Clients', c); }
    consent(c.id, name, phone8, LEGAL_DOCS, r.lang, 'التسجيل الأولي');
    return {ok: true, id: c.id};
  });
}

// ---------- client accounts («حسابي») ----------
function hex(bytes) { return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join(''); }
function hashPw(salt, pw) {
  var h = salt + '|' + pw;
  for (var i = 0; i < PW_ROUNDS; i++) h = hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt, Utilities.Charset.UTF_8));
  return h;
}
function publicAccount(a) { return {id: a.id, created: a.created, clientId: a.clientId, username: a.username, status: a.status, lastLogin: a.lastLogin, updated: a.updated}; }
function pick(o, keys) { var r = {}; keys.forEach(function (k) { r[k] = o[k] == null ? '' : o[k]; }); return r; }
function validUser(u) { return /^[a-z0-9_.]{4,30}$/.test(u); }
function validPw(p) { return typeof p === 'string' && p.length >= 8 && p.length <= 100; }
function findAccount(f) { return rows('Accounts').filter(f)[0]; }
function clientToken(acc) {
  var exp = String(Date.now() + CLIENT_TOKEN_HOURS * 3600 * 1000), body = acc.id + '.' + exp;
  return 'c.' + body + '.' + sign('c|' + body);
}
function checkClientToken(t) {
  var p = String(t || '').split('.');
  if (p.length !== 4 || p[0] !== 'c' || p[3] !== sign('c|' + p[1] + '.' + p[2]) || Number(p[2]) < Date.now()) return null;
  var acc = findAccount(function (a) { return a.id === p[1]; });
  return acc && acc.status === ACC_ACTIVE ? acc : null;
}
function bump(key, max) {   // simple per-key counter for an hour; returns false once over the limit
  var c = CacheService.getScriptCache(), n = Number(c.get(key) || 0);
  if (n >= max) return false;
  c.put(key, String(n + 1), 3600); return true;
}

function clientSignup(r) {
  if (r.hp) return {ok: false, error: 'invalid'};
  var name = clean(r.name, 120), phone = clean(r.phone, 20).replace(/\s/g, ''), email = clean(r.email, 120);
  var username = clean(r.username, 30).toLowerCase(), pw = String(r.password || '');
  if (!name || !/^(\+?974)?[3567]\d{7}$/.test(phone)) return {ok: false, error: 'invalid'};
  if (!validUser(username)) return {ok: false, error: 'bad_username'};
  if (!validPw(pw)) return {ok: false, error: 'weak_password'};
  if (!r.accept) return {ok: false, error: 'must_accept'};
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) email = '';
  if (!bump('su_' + phone.slice(-8), 5)) return {ok: false, error: 'rate_limited'};
  var phone8 = phone.slice(-8), company = clean(r.company, 120);
  var res = withLock(function () {
    if (findAccount(function (a) { return a.username === username; })) return {ok: false, error: 'username_taken'};
    var c = rows('Clients').filter(function (x) { return String(x.phone).slice(-8) === phone8; })[0];
    if (c && findAccount(function (a) { return a.clientId === c.id; })) return {ok: false, error: 'phone_has_account'};
    // An existing client with transactions or files gets a pending account: the office confirms the number by phone
    // before the account can see that history (nobody can claim someone else's file by typing their number).
    var history = c && (rows('Transactions').some(function (t) { return t.clientId === c.id; }) ||
      rows('Files').some(function (f) { return f.clientId === c.id; }));
    var data = {type: company ? 'منشأة' : 'فرد', cr: clean(r.cr, 40), estCard: clean(r.estCard, 40), taxNo: clean(r.taxNo, 40), qid: clean(r.qid, 20), address: clean(r.address, 200)};
    if (!c) {
      c = {name: company || name, phone: phone8, email: email, source: 'حساب الموقع', notes: (company ? 'الشركة: ' + company + ' · ' : '') + 'المسؤول: ' + name};
      Object.keys(data).forEach(function (k) { c[k] = data[k]; });
      c = saveRow('Clients', c);
    } else if (!history) {
      if (company) c.name = company;
      Object.keys(data).forEach(function (k) { if (data[k]) c[k] = data[k]; });
      if (email) c.email = email;
      c.notes = (c.notes ? c.notes + ' · ' : '') + 'المسؤول: ' + name;
      saveRow('Clients', c);
    }
    var salt = Utilities.getUuid();
    var acc = saveRow('Accounts', {clientId: c.id, username: username, salt: salt, hash: hashPw(salt, pw), status: history ? ACC_PENDING : ACC_ACTIVE, lastLogin: ''});
    consent(c.id, clean(r.signName, 120) || name, phone8, LEGAL_DOCS, r.lang, 'إنشاء الحساب' + (company ? ' عن ' + company : ''));
    log(c.id, '', 'account', 'إنشاء حساب على الموقع: ' + username + (history ? ' (بانتظار التفعيل)' : ''), company ? 'الشركة: ' + company : '');
    return {ok: true, acc: acc, client: c, pending: !!history};
  });
  if (!res.ok) return res;
  try {
    var to = prop('OFFICE_EMAIL');
    if (to) MailApp.sendEmail({to: to, name: 'موقع بصيرة', subject: (res.pending ? 'حساب بانتظار التفعيل: ' : 'حساب جديد: ') + res.client.name,
      htmlBody: shell('<p>أنشأ عميل حساباً على الموقع.</p><p>الاسم: ' + escHtml(name) + '<br>الشركة: ' + escHtml(company || '—') + '<br>الجوال: ' + phone8 + '<br>اسم المستخدم: ' + escHtml(username) + '<br>رقم العميل: ' + res.client.id + '</p>' +
        (res.pending ? '<p><b>هذا الرقم مسجل لعميل لديه معاملات أو ملفات سابقة.</b> اتصل بالرقم للتأكد، ثم فعّل الحساب من نظام العملاء (ملف العميل ← الحساب).</p>' : ''))});
    if (email) MailApp.sendEmail({to: email, name: r.lang === 'en' ? 'Basira for Transactions' : 'بصيرة للمعاملات', replyTo: to || undefined,
      subject: r.lang === 'en' ? 'Your Basira account' : 'تم إنشاء حسابك في بصيرة للمعاملات',
      htmlBody: shell(r.lang === 'en'
        ? '<p>Hello ' + escHtml(name) + ',</p><p>Your account has been created. Username: <b>' + escHtml(username) + '</b>.</p>' + (res.pending ? '<p>Because this mobile number already has a file with us, we will call you to confirm it and then activate your account.</p>' : '<p>Sign in from the “My account” page to request services and follow your work.</p>')
        : '<p>السلام عليكم ' + escHtml(name) + '،</p><p>تم إنشاء حسابك. اسم المستخدم: <b>' + escHtml(username) + '</b>.</p>' + (res.pending ? '<p>لأن رقم جوالك مسجل لدينا مسبقاً، سنتصل بك للتأكد منه ثم نفعّل حسابك.</p>' : '<p>ادخل من صفحة «حسابي» لطلب الخدمات ومتابعة طلباتك ومعاملاتك وتنزيل ملفاتك.</p>'), r.lang === 'en')});
  } catch (err) { log(res.client.id, '', 'error', 'signup mail failed', String(err)); }
  if (res.pending) return {ok: true, pending: true};
  return {ok: true, token: clientToken(res.acc)};
}

function clientLogin(r) {
  var id = clean(r.username, 30).toLowerCase().replace(/\s/g, ''), pw = String(r.password || '');
  if (!id || !pw) return {ok: false, error: 'wrong_login'};
  if (!bump('cl_' + id, 10)) return {ok: false, error: 'rate_limited'};
  Utilities.sleep(300);
  var acc = findAccount(function (a) { return a.username === id; });
  if (!acc && /^\+?\d{8,12}$/.test(id)) {   // allow signing in with the mobile number too
    var c = rows('Clients').filter(function (x) { return String(x.phone).slice(-8) === id.slice(-8); })[0];
    if (c) acc = findAccount(function (a) { return a.clientId === c.id; });
  }
  if (!acc || hashPw(acc.salt, pw) !== acc.hash) return {ok: false, error: 'wrong_login'};
  if (acc.status === ACC_PENDING) return {ok: false, error: 'pending'};
  if (acc.status !== ACC_ACTIVE) return {ok: false, error: 'disabled'};
  withLock(function () { acc.lastLogin = now(); saveRow('Accounts', acc); });
  return {ok: true, token: clientToken(acc)};
}

// ---------- forgotten password: a 6-digit code to the client's email, valid 15 minutes, 5 tries ----------
function accountById(id) {   // username, or the mobile number on the client file
  id = clean(id, 30).toLowerCase().replace(/\s/g, '');
  var acc = id && findAccount(function (a) { return a.username === id; });
  if (!acc && /^\+?\d{8,12}$/.test(id)) {
    var c = rows('Clients').filter(function (x) { return String(x.phone).slice(-8) === id.slice(-8); })[0];
    if (c) acc = findAccount(function (a) { return a.clientId === c.id; });
  }
  return acc || null;
}
function clientLang(clientId) {
  var k = rows('Consents').filter(function (x) { return x.clientId === clientId; }).pop();
  return k && k.lang === 'en' ? 'en' : 'ar';
}
function clientForgot(r) {
  var id = clean(r.username, 30).toLowerCase();
  if (!id) return {ok: false, error: 'invalid'};
  if (!bump('fg_' + id, 5)) return {ok: false, error: 'rate_limited'};
  Utilities.sleep(300);
  var acc = accountById(id), c = acc && rows('Clients').filter(function (x) { return x.id === acc.clientId; })[0];
  // Same answer whether or not the account exists, so nobody can probe for usernames or numbers.
  if (!acc || acc.status !== ACC_ACTIVE || !c || !c.email) return {ok: true};
  var code = String(100000 + parseInt(Utilities.getUuid().replace(/\D/g, '').slice(0, 9) || '0', 10) % 900000);
  CacheService.getScriptCache().put('rs_' + acc.id, JSON.stringify({h: hashPw(acc.salt, 'reset:' + code), n: 0, exp: Date.now() + 15 * 60000}), 900);
  var en = (r.lang || clientLang(c.id)) === 'en';
  try {
    MailApp.sendEmail({to: c.email, name: en ? 'Basira for Transactions' : 'بصيرة للمعاملات', replyTo: prop('OFFICE_EMAIL') || undefined,
      subject: en ? 'Your password reset code: ' + code : 'رمز استعادة كلمة المرور: ' + code,
      htmlBody: shell(en
        ? '<p>Hello ' + escHtml(c.name) + ',</p><p>Your code to set a new password is:</p><p style="font-size:28px;letter-spacing:6px"><b>' + code + '</b></p><p>It works for 15 minutes. Username: <b>' + escHtml(acc.username) + '</b>.</p><p style="color:#5b6580">If you did not ask for this, ignore this email; your password has not changed.</p>'
        : '<p>السلام عليكم ' + escHtml(c.name) + '،</p><p>رمز تعيين كلمة مرور جديدة لحسابك:</p><p style="font-size:28px;letter-spacing:6px"><b>' + code + '</b></p><p>صالح لمدة 15 دقيقة. اسم المستخدم: <b>' + escHtml(acc.username) + '</b>.</p><p style="color:#5b6580">إذا لم تطلب ذلك فتجاهل هذه الرسالة، ولم تتغير كلمة مرورك.</p>', en)});
  } catch (err) { log(c.id, '', 'error', 'reset mail failed', String(err)); }
  log(c.id, '', 'account', 'طلب العميل رمز استعادة كلمة المرور', '');
  return {ok: true};
}
function clientReset(r) {
  var acc = accountById(r.username), code = String(r.code || '').replace(/\D/g, ''), pw = String(r.password || '');
  if (!validPw(pw)) return {ok: false, error: 'weak_password'};
  var cache = CacheService.getScriptCache(), key = acc ? 'rs_' + acc.id : '', st = null;
  try { st = acc && JSON.parse(cache.get(key) || 'null'); } catch (err) {}
  if (!st || !st.h || st.exp < Date.now() || st.n >= 5) return {ok: false, error: 'bad_code'};
  if (hashPw(acc.salt, 'reset:' + code) !== st.h) { st.n++; cache.put(key, JSON.stringify(st), 900); return {ok: false, error: 'bad_code'}; }
  cache.put(key, 'null', 1);
  acc.salt = Utilities.getUuid(); acc.hash = hashPw(acc.salt, pw); acc.lastLogin = now(); saveRow('Accounts', acc);
  log(acc.clientId, '', 'account', 'العميل عيّن كلمة مرور جديدة برمز البريد', '');
  return {ok: true, token: clientToken(acc)};
}

function clientMe(acc) {
  var c = rows('Clients').filter(function (x) { return x.id === acc.clientId; })[0];
  if (!c) return {ok: false, error: 'auth'};
  var mine = function (name, fields) { return rows(name).filter(function (x) { return x.clientId === c.id; }).map(function (x) { return pick(x, fields); }).reverse(); };
  var files = rows('Files').filter(function (f) { return f.clientId === c.id; }).map(function (f) {
    return {id: f.id, created: f.created, txnId: f.txnId, title: f.title, link: f.fileId ? '' : f.url};   // Drive files are fetched through cfile
  }).reverse();
  var creds = rows('Credentials').filter(function (x) { return x.clientId === c.id; }).map(function (x) { return {id: x.id, created: x.created, portal: x.portal, username: x.username}; });
  var msgs = rows('Messages').filter(function (m) { return m.clientId === c.id; });
  var unread = msgs.filter(function (m) { return m.from === 'office' && !m.read; });
  if (unread.length) withLock(function () { unread.forEach(function (m) { m.read = 'نعم'; saveRow('Messages', m); }); });
  var signed = rows('Consents').filter(function (x) { return x.clientId === c.id; }).pop();
  return {ok: true, username: acc.username, client: pick(c, CLIENT_FIELDS), requests: mine('Requests', REQ_FIELDS), transactions: mine('Transactions', TXN_FIELDS), files: files,
    credentials: creds, messages: msgs.map(function (m) { return {id: m.id, created: m.created, from: m.from, body: m.body}; }), consent: signed ? {created: signed.created, version: signed.version, name: signed.name} : null, legalVersion: LEGAL_VERSION};
}

function clientProfile(acc, p) {
  var c = rows('Clients').filter(function (x) { return x.id === acc.clientId; })[0];
  if (!c) return {ok: false, error: 'auth'};
  var changed = [];
  CLIENT_EDITABLE.forEach(function (k) {
    if (p[k] == null) return;
    var v = clean(p[k], k === 'address' ? 200 : 120);
    if (k === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return;
    if (k === 'name' && !v) return;
    if (String(c[k]) !== v) { changed.push(k + ': ' + v); c[k] = v; }
  });
  if (changed.length) { saveRow('Clients', c); log(c.id, '', 'profile', 'العميل حدّث بياناته من حسابه', changed.join('\n')); }
  return {ok: true, client: pick(c, CLIENT_FIELDS)};
}

function clientRequest(acc, r) {
  var svc = clean(r.services, 3000), note = clean(r.notes, 1000);
  if (!svc) return {ok: false, error: 'invalid'};
  if (!bump('cr_' + acc.id, 10)) return {ok: false, error: 'rate_limited'};
  return withLock(function () {
    var c = rows('Clients').filter(function (x) { return x.id === acc.clientId; })[0];
    var rq = saveRow('Requests', {name: c.name, phone: c.phone, email: c.email, type: c.type, plan: clean(r.plan, 30), services: svc,
      codes: (r.codes || []).slice(0, 60).join(' '), lang: r.lang === 'en' ? 'en' : 'ar', status: 'جديد', clientId: c.id, mailed: '',
      notes: 'من حساب العميل (' + acc.username + ')' + (note ? '\n' + note : '')});
    var mailed = false;
    if (c.email) { try { sendAutoReply(rq); mailed = true; } catch (err) {} }
    rq.mailed = mailed ? 'نعم' : 'لا'; saveRow('Requests', rq);
    try { notifyOffice(rq); } catch (err) {}
    log(c.id, '', 'request', 'طلب جديد من حساب العميل ' + rq.id, svc + (note ? '\n' + note : ''));
    return {ok: true, id: rq.id, mailed: mailed};
  });
}

function clientPassword(acc, old, pw) {
  if (hashPw(acc.salt, String(old || '')) !== acc.hash) return {ok: false, error: 'wrong_login'};
  if (!validPw(pw)) return {ok: false, error: 'weak_password'};
  acc.salt = Utilities.getUuid(); acc.hash = hashPw(acc.salt, pw); saveRow('Accounts', acc);
  log(acc.clientId, '', 'account', 'العميل غيّر كلمة المرور', '');
  return {ok: true};
}

function clientFile(acc, id) {
  var f = rows('Files').filter(function (x) { return x.id === id && x.clientId === acc.clientId; })[0];
  if (!f) return {ok: false, error: 'not_found'};
  if (!f.fileId) return {ok: true, link: f.url};
  var blob = DriveApp.getFileById(f.fileId).getBlob();
  return {ok: true, name: blob.getName(), mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes())};
}

// ---------- staff side: accounts and files ----------
function staffAccount(r) {
  var c = rows('Clients').filter(function (x) { return x.id === r.clientId; })[0];
  if (!c) return {ok: false, error: 'not_found'};
  var acc = findAccount(function (a) { return a.clientId === c.id; }) || {clientId: c.id, status: ACC_ACTIVE, lastLogin: ''};
  if (r.username != null) {
    var u = clean(r.username, 30).toLowerCase();
    if (!validUser(u)) return {ok: false, error: 'bad_username'};
    if (findAccount(function (a) { return a.username === u && a.id !== acc.id; })) return {ok: false, error: 'username_taken'};
    acc.username = u;
  }
  if (!acc.username) return {ok: false, error: 'bad_username'};
  if (r.password) {
    if (!validPw(r.password)) return {ok: false, error: 'weak_password'};
    acc.salt = Utilities.getUuid(); acc.hash = hashPw(acc.salt, r.password);
  }
  if (!acc.hash) return {ok: false, error: 'weak_password'};
  if ([ACC_ACTIVE, ACC_PENDING, ACC_OFF].indexOf(r.status) >= 0) acc.status = r.status;
  acc = saveRow('Accounts', acc);
  saveRow('Log', {clientId: c.id, kind: 'account', subject: 'تحديث حساب العميل: ' + acc.username + ' · ' + acc.status + (r.password ? ' · كلمة مرور جديدة' : ''), body: '', by: STAFF.username});
  return {ok: true, row: publicAccount(acc)};
}

function clientFolder(clientId) {
  var p = PropertiesService.getScriptProperties(), rootId = p.getProperty('FILES_FOLDER'), root;
  try { root = rootId && DriveApp.getFolderById(rootId); } catch (err) { root = null; }
  if (!root) { root = DriveApp.createFolder('بصيرة - ملفات العملاء'); p.setProperty('FILES_FOLDER', root.getId()); }
  var it = root.getFoldersByName(clientId);
  return it.hasNext() ? it.next() : root.createFolder(clientId);
}
function staffUpload(r) {
  var c = rows('Clients').filter(function (x) { return x.id === r.clientId; })[0];
  if (!c) return {ok: false, error: 'not_found'};
  var data = String(r.data || '');
  if (!data || data.length > MAX_UPLOAD_MB * 1024 * 1024 * 4 / 3) return {ok: false, error: 'too_large'};
  var name = clean(r.name, 150) || 'file';
  var blob = Utilities.newBlob(Utilities.base64Decode(data), clean(r.mime, 100) || 'application/octet-stream', name);
  var file = clientFolder(c.id).createFile(blob);   // stays private to the office's Google account
  var row = saveRow('Files', {clientId: c.id, txnId: clean(r.txnId, 20), title: clean(r.title, 150) || name, url: file.getUrl(), fileId: file.getId(), by: STAFF.username});
  saveRow('Log', {clientId: c.id, txnId: row.txnId, kind: 'file', subject: 'رفع ملف للعميل: ' + row.title, body: '', by: STAFF.username});
  var mailed = false;   // clients with an account hear about new documents by email
  if (r.notify !== false && c.email && findAccount(function (a) { return a.clientId === c.id && a.status === ACC_ACTIVE; })) {
    var en = clientLang(c.id) === 'en';
    try { MailApp.sendEmail({to: c.email, name: en ? 'Basira for Transactions' : 'بصيرة للمعاملات', replyTo: prop('OFFICE_EMAIL') || undefined,
      subject: en ? 'A new document in your account: ' + row.title : 'مستند جديد في حسابك: ' + row.title,
      htmlBody: shell(en ? '<p>Hello ' + escHtml(c.name) + ',</p><p>We added <b>' + escHtml(row.title) + '</b> to your account. Download it from the “My account” page, under Files.</p>'
        : '<p>السلام عليكم ' + escHtml(c.name) + '،</p><p>أضفنا إلى حسابك: <b>' + escHtml(row.title) + '</b>. يمكنك تنزيله من صفحة «حسابي» على الموقع ← الملفات.</p>', en)}); mailed = true; } catch (err) {}
  }
  return {ok: true, row: row, mailed: mailed};
}
// ---------- consents and government-portal logins ----------
function consent(clientId, name, phone, docs, lang, source) {
  saveRow('Consents', {clientId: clientId, name: name, phone: phone, docs: docs, version: LEGAL_VERSION, lang: lang === 'en' ? 'en' : 'ar', source: source});
}
// Apps Script has no built-in AES, so portal passwords are encrypted with an HMAC-SHA256 keystream
// (random nonce per value) and authenticated with a separate HMAC. The key lives only in Script Properties,
// so the sheet alone (or a copy of it) does not reveal any password.
function credKey() {
  var p = PropertiesService.getScriptProperties(), k = p.getProperty('CRED_KEY');
  if (!k) { k = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('CRED_KEY', k); }
  return k;
}
function bytesOf(s) { return Utilities.newBlob(String(s)).getBytes(); }
function keystream(nonce, n) {
  var out = [], k = credKey();
  for (var i = 0; out.length < n; i++) out = out.concat(Utilities.computeHmacSha256Signature(nonce + '|' + i, k));
  return out.slice(0, n);
}
function encrypt(plain) {
  var nonce = Utilities.getUuid(), b = bytesOf(plain), ks = keystream(nonce, b.length);
  var ct = Utilities.base64Encode(b.map(function (x, i) { return ((x ^ ks[i]) << 24) >> 24; }));
  return nonce + ':' + ct + ':' + Utilities.base64Encode(Utilities.computeHmacSha256Signature('m|' + nonce + ':' + ct, credKey()));
}
function decrypt(enc) {
  var p = String(enc).split(':');
  if (p.length !== 3 || Utilities.base64Encode(Utilities.computeHmacSha256Signature('m|' + p[0] + ':' + p[1], credKey())) !== p[2]) throw new Error('bad_cipher');
  var b = Utilities.base64Decode(p[1]), ks = keystream(p[0], b.length);
  return Utilities.newBlob(b.map(function (x, i) { return ((x ^ ks[i]) << 24) >> 24; })).getDataAsString('UTF-8');
}
function publicCredential(x) { return {id: x.id, created: x.created, clientId: x.clientId, portal: x.portal, username: x.username, note: x.note, by: x.by, updated: x.updated}; }
function clientCredential(acc, r) {
  var portal = clean(r.portal, 80), user = clean(r.username, 120), pw = String(r.password || '').slice(0, 200), note = clean(r.note, 300);
  if (!portal || !user || !pw) return {ok: false, error: 'invalid'};
  if (!r.consent) return {ok: false, error: 'must_accept'};
  if (rows('Credentials').filter(function (x) { return x.clientId === acc.clientId; }).length >= 20) return {ok: false, error: 'too_many'};
  var c = rows('Clients').filter(function (x) { return x.id === acc.clientId; })[0];
  var row = saveRow('Credentials', {clientId: acc.clientId, portal: portal, username: user, secret: encrypt(pw), note: note, by: 'العميل (' + acc.username + ')'});
  consent(acc.clientId, clean(r.signName, 120) || c.name, c.phone, 'بيانات الدخول إلى البوابات الحكومية: ' + portal, r.lang, 'حسابي');
  log(acc.clientId, '', 'credential', 'العميل أضاف بيانات دخول بوابة: ' + portal, 'اسم المستخدم: ' + user);
  try { var to = prop('OFFICE_EMAIL'); if (to) MailApp.sendEmail({to: to, name: 'موقع بصيرة', subject: 'بيانات دخول بوابة من العميل ' + c.name, htmlBody: shell('<p>أضاف العميل ' + escHtml(c.name) + ' (' + c.id + ') بيانات الدخول إلى: <b>' + escHtml(portal) + '</b>.</p><p>كلمة المرور محفوظة مشفرة، وتظهر من نظام العملاء ← ملف العميل ← بيانات البوابات.</p>')}); } catch (err) {}
  return {ok: true, row: {id: row.id, created: row.created, portal: portal, username: user}};
}
function clientCredentialDelete(acc, id) {
  var x = rows('Credentials').filter(function (y) { return y.id === id && y.clientId === acc.clientId; })[0];
  if (!x) return {ok: false, error: 'not_found'};
  deleteRow('Credentials', id);
  log(acc.clientId, '', 'credential', 'العميل حذف بيانات دخول بوابة: ' + x.portal, '');
  return {ok: true};
}
function staffReveal(id) {
  var x = rows('Credentials').filter(function (y) { return y.id === id; })[0];
  if (!x) return {ok: false, error: 'not_found'};
  audit('reveal', 'Credentials', x.id, x.clientId, 'إظهار كلمة مرور بوابة: ' + x.portal);
  saveRow('Log', {clientId: x.clientId, kind: 'credential', subject: 'اطلاع على كلمة مرور بوابة: ' + x.portal, body: '', by: STAFF.username});
  return {ok: true, password: decrypt(x.secret)};
}

// ---------- messages between the client and the office ----------
function clientMessage(acc, body) {
  body = clean(body, 3000); if (!body) return {ok: false, error: 'invalid'};
  if (!bump('cm_' + acc.id, 30)) return {ok: false, error: 'rate_limited'};
  var c = rows('Clients').filter(function (x) { return x.id === acc.clientId; })[0];
  var m = saveRow('Messages', {clientId: c.id, from: 'client', by: acc.username, body: body, read: ''});
  try { var to = prop('OFFICE_EMAIL'); if (to) MailApp.sendEmail({to: to, name: 'موقع بصيرة', subject: 'رسالة من العميل ' + c.name + ' (' + c.id + ')', htmlBody: shell('<p><b>' + escHtml(c.name) + '</b> كتب من حسابه:</p><p>' + escHtml(body).replace(/\n/g, '<br>') + '</p><p>رد عليه من نظام العملاء ← ملف العميل ← المراسلات.</p>')}); } catch (err) {}
  return {ok: true, row: {id: m.id, created: m.created, from: 'client', body: body}};
}
function staffReply(r) {
  var c = rows('Clients').filter(function (x) { return x.id === r.clientId; })[0];
  var body = String(r.body || '').replace(/[<>]/g, '').trim().slice(0, 5000);
  if (!c || !body) return {ok: false, error: 'invalid'};
  rows('Messages').filter(function (m) { return m.clientId === c.id && m.from === 'client' && !m.read; }).forEach(function (m) { m.read = 'نعم'; saveRow('Messages', m); });
  var m = saveRow('Messages', {clientId: c.id, from: 'office', by: STAFF.username, body: body, read: ''});
  var mailed = false;
  if (r.email !== false && c.email) {
    try { MailApp.sendEmail({to: c.email, name: 'بصيرة للمعاملات', replyTo: prop('OFFICE_EMAIL') || undefined, subject: 'رسالة جديدة في حسابك | بصيرة للمعاملات',
      htmlBody: shell('<p>السلام عليكم ' + escHtml(c.name) + '،</p><p>' + escHtml(body).replace(/\n/g, '<br>') + '</p><p style="color:#5b6580">يمكنك الرد من صفحة «حسابي» على الموقع ← المراسلات.</p>')}); mailed = true; } catch (err) {}
  }
  audit('reply', 'Messages', m.id, c.id, 'رد على العميل: ' + body.slice(0, 120));
  saveRow('Log', {clientId: c.id, kind: 'message', subject: 'رد على العميل من المراسلات' + (mailed ? ' (أُرسل بالبريد أيضاً)' : ''), body: body, by: STAFF.username});
  return {ok: true, row: m, mailed: mailed};
}

function trashDriveFile(id) {
  var f = rows('Files').filter(function (x) { return x.id === id; })[0];
  if (f && f.fileId) { try { DriveApp.getFileById(f.fileId).setTrashed(true); } catch (err) {} }
}

// ---------- public request from the website ----------
function publicRequest(r) {
  if (r.hp) return {ok: true, id: 'R-0000', mailed: false};           // honeypot: silently drop bots
  var name = clean(r.name, 120), phone = clean(r.phone, 20).replace(/\s/g, ''), email = clean(r.email, 120), svc = clean(r.services, 3000);
  if (!name || !/^(\+?974)?[3567]\d{7}$/.test(phone) || !svc) return {ok: false, error: 'invalid'};
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) email = '';
  var cache = CacheService.getScriptCache(), key = 'rl_' + phone;
  if (Number(cache.get(key) || 0) >= 5) return {ok: false, error: 'rate_limited'};
  cache.put(key, String(Number(cache.get(key) || 0) + 1), 3600);
  var phone8 = phone.slice(-8);
  return withLock(function () {
    var client = rows('Clients').filter(function (c) { return String(c.phone).slice(-8) === phone8; })[0];
    if (!client) client = saveRow('Clients', {name: name, type: clean(r.type, 20), phone: phone8, email: email, plan: clean(r.plan, 30), source: 'الموقع', requirements: svc});
    else if (email && !client.email) { client.email = email; saveRow('Clients', client); }
    var rq = saveRow('Requests', {name: name, phone: phone8, email: email, type: clean(r.type, 20), plan: clean(r.plan, 30), services: svc,
      codes: (r.codes || []).join(' '), lang: r.lang === 'en' ? 'en' : 'ar', status: 'جديد', clientId: client.id, mailed: '', notes: r.contact ? 'وسيلة التواصل المفضلة: ' + clean(r.contact, 30) : ''});
    var mailed = false;
    if (email) { try { sendAutoReply(rq); mailed = true; } catch (err) { log(client.id, '', 'error', 'auto-reply failed', String(err)); } }
    rq.mailed = mailed ? 'نعم' : 'لا'; saveRow('Requests', rq);
    try { notifyOffice(rq); } catch (err) {}
    log(client.id, '', 'request', 'طلب جديد من الموقع ' + rq.id, svc);
    return {ok: true, id: rq.id, mailed: mailed};
  });
}
function clean(s, n) { return String(s == null ? '' : s).replace(/[<>]/g, '').trim().slice(0, n); }
function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function shell(html, en) {
  return '<div dir="' + (en ? 'ltr' : 'rtl') + '" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.8;color:#14213a;max-width:600px">' +
    '<div style="background:#14284b;color:#fff;padding:14px 18px;border-radius:10px 10px 0 0;font-size:18px"><b>' + (en ? 'Basira for Transactions' : 'بصيرة للمعاملات') + '</b></div>' +
    '<div style="border:1px solid #dde2ec;border-top:0;padding:18px;border-radius:0 0 10px 10px">' + html +
    '<p style="color:#5b6580;font-size:13px;margin-top:22px">' + (en ? 'Basira for Transactions LLC · Doha, Qatar · WhatsApp +974 72232609 · baseeratactions@gmail.com' : 'بصيرة للمعاملات ذ.م.م · الدوحة، قطر · واتساب ‎+974 72232609 · baseeratactions@gmail.com') + '</p></div></div>';
}
function sendAutoReply(rq) {
  var en = rq.lang === 'en';
  var subject = en ? 'We received your request ' + rq.id + ' | Basira' : 'استلمنا طلبك رقم ' + rq.id + ' | بصيرة للمعاملات';
  var body = en
    ? '<p>Hello ' + escHtml(rq.name) + ',</p><p>Thank you. Your request <b>' + rq.id + '</b> has reached us. We will review it and contact you within two working hours with the document list, our fixed fee and the estimated government fees.</p><p><b>Requested services:</b><br>' + escHtml(rq.services).replace(/\n/g, '<br>') + '</p><p>Please do not send any documents until we ask for them; we will tell you exactly what is needed.</p>'
    : '<p>السلام عليكم ' + escHtml(rq.name) + '،</p><p>شكراً لتواصلك مع بصيرة للمعاملات. وصلنا طلبك برقم <b>' + rq.id + '</b>، وسنراجعه ونتواصل معك خلال ساعتين عمل بقائمة المستندات المطلوبة وأتعابنا الثابتة وتقدير الرسوم الحكومية.</p><p><b>الخدمات المطلوبة:</b><br>' + escHtml(rq.services).replace(/\n/g, '<br>') + '</p><p>لا ترسل أي مستندات قبل أن نطلبها، وسنخبرك بالمطلوب تحديداً.</p>';
  MailApp.sendEmail({to: rq.email, subject: subject, htmlBody: shell(body, en), name: en ? 'Basira for Transactions' : 'بصيرة للمعاملات', replyTo: prop('OFFICE_EMAIL') || undefined});
}
function notifyOffice(rq) {
  var to = prop('OFFICE_EMAIL'); if (!to) return;
  MailApp.sendEmail({to: to, subject: 'طلب جديد ' + rq.id + ' من ' + rq.name, name: 'موقع بصيرة',
    htmlBody: shell('<p><b>طلب جديد من الموقع</b></p><p>الاسم: ' + escHtml(rq.name) + '<br>الجوال: ' + rq.phone + '<br>البريد: ' + escHtml(rq.email || 'غير مذكور') + '<br>النوع: ' + escHtml(rq.type) + '<br>الباقة: ' + escHtml(rq.plan || 'بدون') + (rq.notes ? '<br>' + escHtml(rq.notes) : '') + '<br>رقم العميل: ' + rq.clientId + '</p><p>' + escHtml(rq.services).replace(/\n/g, '<br>') + '</p><p>افتح نظام العملاء لمتابعته.</p>')});
}

// ---------- email from the CRM ----------
function sendClientEmail(r) {
  var to = clean(r.to, 200), subject = clean(r.subject, 200), body = String(r.body || '').slice(0, 10000);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !subject || !body) return {ok: false, error: 'invalid'};
  MailApp.sendEmail({to: to, subject: subject, htmlBody: shell(escHtml(body).replace(/\n/g, '<br>'), r.lang === 'en'), name: 'بصيرة للمعاملات', replyTo: prop('OFFICE_EMAIL') || undefined});
  saveRow('Log', {clientId: r.clientId || '', txnId: r.txnId || '', kind: 'email', subject: subject, body: body, by: STAFF ? STAFF.username : 'CRM'});
  return {ok: true, quota: MailApp.getRemainingDailyQuota()};
}

// ---------- daily reminder to the office ----------
function dailyReminders() {
  var to = prop('OFFICE_EMAIL'); if (!to) return;
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var days = function (d) { if (!d) return null; var x = new Date(d); return isNaN(x) ? null : Math.round((x - today) / 86400000); };
  var clients = {}; rows('Clients').forEach(function (c) { clients[c.id] = c; });
  var open = rows('Transactions').filter(function (t) { return ['منجزة', 'ملغاة'].indexOf(t.status) < 0; });
  var late = open.filter(function (t) { var d = days(t.dueDate); return d !== null && d < 0; });
  var renew = rows('Transactions').filter(function (t) { var d = days(t.expiryDate); return d !== null && d >= 0 && d <= 30; });
  var plans = rows('Clients').filter(function (c) { var d = days(c.planEnd); return d !== null && d >= 0 && d <= 30; });
  var newReq = rows('Requests').filter(function (r) { return r.status === 'جديد'; });
  var y = new Date(today.getTime() - 86400000), yd = Utilities.formatDate(y, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var staffRep = staffReport(yd, yd), worked = staffRep.staff.filter(function (s) { return s.days.length || s.actions; });
  if (!late.length && !renew.length && !plans.length && !newReq.length && !worked.length) return;
  var li = function (arr, f) { return arr.length ? '<ul>' + arr.map(function (x) { return '<li>' + f(x) + '</li>'; }).join('') + '</ul>' : '<p>لا يوجد.</p>'; };
  var cn = function (id) { return escHtml((clients[id] || {}).name || id); };
  MailApp.sendEmail({to: to, subject: 'متابعة اليوم: ' + newReq.length + ' طلب جديد، ' + late.length + ' متأخرة، ' + renew.length + ' تجديد قريب', name: 'نظام بصيرة',
    htmlBody: shell('<h3>طلبات جديدة لم تُعالج</h3>' + li(newReq, function (r) { return r.id + ' · ' + escHtml(r.name) + ' · ' + r.phone; }) +
      '<h3>معاملات تجاوزت الموعد المتوقع</h3>' + li(late, function (t) { return t.id + ' · ' + cn(t.clientId) + ' · ' + escHtml(t.service) + ' · ' + t.dueDate; }) +
      '<h3>مستندات تنتهي خلال 30 يوماً</h3>' + li(renew, function (t) { return t.id + ' · ' + cn(t.clientId) + ' · ' + escHtml(t.service) + ' · ينتهي ' + t.expiryDate; }) +
      '<h3>اشتراكات باقات تنتهي خلال 30 يوماً</h3>' + li(plans, function (c) { return c.id + ' · ' + escHtml(c.name) + ' · ' + escHtml(c.plan) + ' · ' + c.planEnd; }) +
      '<h3>عمل الموظفين أمس</h3>' + (worked.length ? reportHtml(staffRep) : '<p>لم يسجّل أي موظف دخولاً أمس.</p>'))});
}

return {doPost:doPost,setup:setup,saveRow:saveRow,nextId:nextId,rows:rows,hashPw:hashPw,encrypt:encrypt,now:now,LEGAL_VERSION:LEGAL_VERSION,LEGAL_DOCS:LEGAL_DOCS};
};
