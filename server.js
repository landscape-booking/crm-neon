// ============================================================
//  CRM المعتمرين والرحلات v5.4 - Neon PostgreSQL Backend
//  نفس الـ API بتاع Apps Script بالظبط - الفرونت إند هيشتغل مباشرة
//  التشغيل:
//    1) npm install
//    2) export DATABASE_URL="postgresql://..." (أو عدّل السطر تحت)
//    3) node server.js
//  شغّل schema.sql مرة واحدة في Neon SQL Editor قبل الاستخدام
// ============================================================

const express = require('express');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://USER:PASSWORD@ep-XXXX-XXXX.ap-southeast-1.aws.neon.tech/DBNAME?sslmode=require';
const PORT = process.env.PORT || 3000;

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const app = express();
app.use(express.text({ type: '*/*', limit: '5mb' })); // الفرونت بيبعت text/plain JSON

// CORS - عشان ملف HTML يتفتح من أي مكان
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ------------------------- أدوات مساعدة -------------------------
const isManager = r => ['admin', 'tech_manager', 'followup_manager'].includes(String(r || '').trim().toLowerCase());

function cairoDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function cairoDateTime(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const g = t => (p.find(x => x.type === t) || {}).value || '00';
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}`;
}

function parseParams(req) {
  const p = Object.assign({}, req.query);
  if (req.body && typeof req.body === 'string' && req.body.trim()) {
    try { Object.assign(p, JSON.parse(req.body)); } catch (e) { /* ignore */ }
  } else if (req.body && typeof req.body === 'object') {
    Object.assign(p, req.body);
  }
  return p;
}

const asBool = v => v === true || String(v).trim().toLowerCase() === 'نعم' || String(v).trim() === 'true';

function clientRowToObj(r) {
  return {
    id: String(r.id),
    agentCode: r.agent_code || '',
    agentName: r.agent_name || '',
    name: r.name || '',
    phone: r.phone || '',
    address: r.address || '',
    members: r.members == null ? 1 : r.members,
    programCategory: r.program_category || '',
    programName: r.program_name || '',
    turkeySubName: r.turkey_sub_name || '',
    price: r.price == null ? 0 : r.price,
    status: r.status || '',
    postponeDate: r.postpone_date || '',
    isFollowup: asBool(r.is_followup),
    followupDate: r.followup_date || '',
    followupDay: r.followup_day || '',
    createdDate: r.created_date || '',
    fb1: r.fb1 || '',
    fb2: r.fb2 || '',
    paidAmount: r.paid_amount == null ? 0 : r.paid_amount,
    paymentNotes: r.payment_notes || '',
    reviewedByFollowup: asBool(r.reviewed_by_followup),
    lastModifiedByRole: r.last_modified_by_role || '',
    programId: r.program_id || '',
    tripDetails: r.trip_details || null,
    fb3: r.fb3 || '',
    followupTime: r.followup_time || '',
    reviewedBy: r.reviewed_by || '',
    supervisorNote: r.supervisor_note || ''
  };
}

function noteRowToObj(r) {
  return {
    id: String(r.id), fromUser: r.from_user || '', toUser: r.to_user || '',
    clientId: r.client_id || '', clientName: r.client_name || '',
    noteText: r.note_text || '', status: r.status || 'unread', createdAt: r.created_at || ''
  };
}

function reqRowToObj(r) {
  return {
    id: String(r.id), clientId: r.client_id || '', clientName: r.client_name || '',
    requestedBy: r.requested_by || '', requestedByCode: r.requested_by_code || '',
    proposed: r.proposed || {}, reason: r.reason || '', status: r.status || 'pending',
    decidedBy: r.decided_by || '', decidedAt: r.decided_at || '', createdAt: r.created_at || ''
  };
}

async function appendNote(db, from, to, clientId, clientName, text) {
  await db.query(
    `INSERT INTO admin_notes (id, from_user, to_user, client_id, client_name, note_text, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,'unread',$7)`,
    [Date.now().toString() + Math.floor(Math.random() * 100), from || 'النظام', to || '', clientId || '', clientName || '', text || '', cairoDateTime()]
  );
}

// ------------------------- الـ Actions -------------------------
async function loginUser(db, p) {
  const r = await db.query(
    'SELECT * FROM users WHERE lower(username)=lower($1) AND password=$2',
    [String(p.username || '').trim(), String(p.password || '').trim()]
  );
  if (!r.rows.length) return { status: 'error', message: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
  const u = r.rows[0];
  return { status: 'success', user: { username: u.username, code: u.code || '', role: String(u.role || 'mowazaf').trim().toLowerCase(), name: u.name || u.username } };
}

async function getData(db, p) {
  const role = String(p.role || '').trim().toLowerCase();
  const code = String(p.code || '').trim().toLowerCase();
  const username = String(p.username || '').trim().toLowerCase();
  const dispName = String(p.name || '').trim().toLowerCase();
  const mgr = isManager(role);

  let cRes;
  if (mgr) {
    cRes = await db.query('SELECT * FROM clients');
  } else {
    cRes = await db.query(
      `SELECT * FROM clients
       WHERE (agent_code IS NOT NULL AND agent_code <> '' AND lower(agent_code) = $1)
          OR (agent_name IS NOT NULL AND agent_name <> '' AND lower(agent_name) IN ($2, $3))`,
      [code, username, dispName]
    );
  }
  const clients = cRes.rows.map(clientRowToObj);

  const omraPrograms = (await db.query('SELECT name FROM omra_programs')).rows.map(r => String(r.name));
  const turkeyPrograms = (await db.query('SELECT name FROM turkey_programs')).rows.map(r => String(r.name));

  const programs = (await db.query(`SELECT * FROM programs WHERE COALESCE(active,'نعم') <> 'لا'`)).rows.map(r => ({
    id: String(r.id), category: r.category || '', name: r.name || '',
    details: r.details || {}, createdBy: r.created_by || '', createdAt: r.created_at || ''
  }));

  let nRes;
  if (mgr) {
    nRes = await db.query('SELECT * FROM admin_notes');
  } else {
    nRes = await db.query(
      `SELECT * FROM admin_notes
       WHERE lower(COALESCE(to_user,'')) = 'all'
          OR (to_user IS NOT NULL AND to_user <> '' AND lower(to_user) IN ($1, $2, $3))`,
      [username, code, dispName]
    );
  }
  const adminNotes = nRes.rows.map(noteRowToObj);

  let rRes;
  if (mgr) {
    rRes = await db.query('SELECT * FROM trip_requests');
  } else {
    rRes = await db.query(
      `SELECT * FROM trip_requests
       WHERE (requested_by IS NOT NULL AND requested_by <> '' AND lower(requested_by) IN ($1, $2))
          OR (requested_by_code IS NOT NULL AND requested_by_code <> '' AND lower(requested_by_code) = $3)`,
      [username, dispName, code]
    );
  }
  const tripRequests = rRes.rows.map(reqRowToObj);

  const settings = {};
  (await db.query('SELECT key, value FROM settings')).rows.forEach(r => { settings[r.key] = r.value == null ? '' : String(r.value); });

  return { status: 'success', clients, omraPrograms, turkeyPrograms, programs, adminNotes, tripRequests, settings };
}

async function saveClient(db, p) {
  const id = (p.id && String(p.id) !== '0') ? String(p.id) : null;
  let old = null;
  if (id) {
    const r = await db.query('SELECT * FROM clients WHERE id=$1', [id]);
    old = r.rows[0] || null;
    if (!old) throw new Error('العميل غير موجود');
  }
  const newId = id || Date.now().toString();
  const userRole = String(p.editorRole || p.userRole || '').trim().toLowerCase();
  const isFollowupMgr = userRole === 'followup_manager';

  let agentCode = String(p.agentCode || ''), agentName = String(p.agentName || '');
  if (old) { agentCode = old.agent_code || ''; agentName = old.agent_name || ''; }

  const reviewed = isFollowupMgr ? 'نعم' : (old ? (old.reviewed_by_followup || 'لا') : (p.reviewedByFollowup || 'لا'));
  const reviewedBy = isFollowupMgr ? (p.editorName || 'مسؤول المتابعة') : (old ? (old.reviewed_by || '') : '');
  const createdDate = p.createdDate || (old && old.created_date) || cairoDate();
  const supNote = isManager(userRole) ? String(p.supervisorNote || '') : (old && old.supervisor_note != null ? String(old.supervisor_note) : '');

  let tripDetails = (p.tripDetails == null || p.tripDetails === '') ? '' : (typeof p.tripDetails === 'string' ? p.tripDetails : JSON.stringify(p.tripDetails));
  const programId = String(p.programId || '');
  if (old) {
    const oldTrip = old.trip_details ? JSON.stringify(old.trip_details) : '';
    if (!isManager(userRole) && programId === String(old.program_id || '') && oldTrip) tripDetails = oldTrip;
    else if (!tripDetails) tripDetails = oldTrip;
  }
  let tripJson = null;
  if (tripDetails) { try { tripJson = JSON.parse(tripDetails); } catch (e) { tripJson = null; } }

  await db.query(
    `INSERT INTO clients (id, agent_code, agent_name, name, phone, address, members, program_category, program_name, turkey_sub_name,
       price, status, postpone_date, is_followup, followup_date, followup_day, created_date, fb1, fb2, paid_amount, payment_notes,
       reviewed_by_followup, last_modified_by_role, program_id, trip_details, fb3, followup_time, reviewed_by, supervisor_note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
     ON CONFLICT (id) DO UPDATE SET
       agent_code=EXCLUDED.agent_code, agent_name=EXCLUDED.agent_name, name=EXCLUDED.name, phone=EXCLUDED.phone, address=EXCLUDED.address,
       members=EXCLUDED.members, program_category=EXCLUDED.program_category, program_name=EXCLUDED.program_name, turkey_sub_name=EXCLUDED.turkey_sub_name,
       price=EXCLUDED.price, status=EXCLUDED.status, postpone_date=EXCLUDED.postpone_date, is_followup=EXCLUDED.is_followup,
       followup_date=EXCLUDED.followup_date, followup_day=EXCLUDED.followup_day, created_date=EXCLUDED.created_date,
       fb1=EXCLUDED.fb1, fb2=EXCLUDED.fb2, paid_amount=EXCLUDED.paid_amount, payment_notes=EXCLUDED.payment_notes,
       reviewed_by_followup=EXCLUDED.reviewed_by_followup, last_modified_by_role=EXCLUDED.last_modified_by_role,
       program_id=EXCLUDED.program_id, trip_details=EXCLUDED.trip_details, fb3=EXCLUDED.fb3, followup_time=EXCLUDED.followup_time,
       reviewed_by=EXCLUDED.reviewed_by, supervisor_note=EXCLUDED.supervisor_note`,
    [newId, agentCode, agentName, p.name || '', p.phone || '', p.address || '', p.members || 1, p.programCategory || '',
     p.programName || '', p.turkeySubName || '', p.price || 0, p.status || '', p.postponeDate || '', p.isFollowup || 'لا',
     p.followupDate || '', p.followupDay || '', createdDate, p.fb1 || '', p.fb2 || '', p.paidAmount || 0, p.paymentNotes || '',
     reviewed, userRole, programId, tripJson, p.fb3 || '', p.followupTime || '', reviewedBy, supNote]
  );

  const prevStatus = old ? String(old.status || '') : '';
  if ((p.status === 'هيحجز' || p.status === 'Near Closed') && prevStatus !== p.status) {
    await appendNote(db, agentName || 'موظف', 'المشرف', newId, p.name, `العميل أصبح (${p.status}) - قيد الحجز، يحتاج استكمال من المشرف.`);
  }
  if (old && isFollowupMgr && agentName) {
    await appendNote(db, p.editorName || 'مسؤول المتابعة', agentName, newId, p.name, 'تم تعديل بيانات هذا العميل بواسطة مسؤول المتابعة.');
  }
  return { status: 'success', id: newId };
}

async function toggleFollowup(db, p) {
  await db.query('UPDATE clients SET is_followup=$2 WHERE id=$1', [String(p.id), String(p.status)]);
  return { status: 'success' };
}

async function deleteClient(db, p) {
  await db.query('DELETE FROM clients WHERE id=$1', [String(p.id)]);
  return { status: 'success' };
}

async function addProgram(db, p) {
  if (p.role && !isManager(p.role)) return { status: 'error', message: 'غير مصرح لك بإضافة البرامج' };
  const table = (p.type === 'تركيا') ? 'turkey_programs' : 'omra_programs';
  await db.query(`INSERT INTO ${table} (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [String(p.programName || '').trim()]);
  return { status: 'success' };
}

async function deleteProgram(db, p) {
  if (p.role && !isManager(p.role)) return { status: 'error', message: 'غير مصرح لك بحذف البرامج' };
  const table = (p.type === 'تركيا') ? 'turkey_programs' : 'omra_programs';
  await db.query(`DELETE FROM ${table} WHERE name=$1`, [String(p.programName || '').trim()]);
  return { status: 'success' };
}

async function saveProgram(db, p) {
  if (!isManager(p.role)) return { status: 'error', message: 'إضافة البرامج للمديرين فقط' };
  const name = String(p.name || '').trim(), category = String(p.category || '').trim();
  if (!name || !category) return { status: 'error', message: 'اسم البرنامج ونوع الرحلة مطلوبان' };
  let details = p.details;
  if (typeof details === 'string') { try { details = JSON.parse(details); } catch (e) { details = {}; } }
  if (p.id) {
    const r = await db.query('UPDATE programs SET category=$2, name=$3, details=$4 WHERE id=$1', [String(p.id), category, name, JSON.stringify(details || {})]);
    if (r.rowCount) return { status: 'success', message: 'تم تحديث البرنامج', id: String(p.id) };
  }
  const newId = 'P' + Date.now();
  await db.query('INSERT INTO programs (id, category, name, details, active, created_by, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [newId, category, name, JSON.stringify(details || {}), 'نعم', p.createdBy || '', cairoDateTime()]);
  return { status: 'success', message: 'تم حفظ البرنامج', id: newId };
}

async function deleteProgramById(db, p) {
  if (!isManager(p.role)) return { status: 'error', message: 'حذف البرامج للمديرين فقط' };
  await db.query('DELETE FROM programs WHERE id=$1', [String(p.id)]);
  return { status: 'success', message: 'تم حذف البرنامج' };
}

async function submitTripRequest(db, p) {
  const c = await db.query('SELECT id FROM clients WHERE id=$1', [String(p.clientId)]);
  if (!c.rows.length) return { status: 'error', message: 'العميل غير موجود' };
  const pend = await db.query(`SELECT id FROM trip_requests WHERE client_id=$1 AND status='pending'`, [String(p.clientId)]);
  if (pend.rows.length) return { status: 'error', message: 'يوجد طلب تعديل معلّق لهذا العميل بالفعل، انتظر رد المدير' };
  let proposed = p.proposed;
  if (typeof proposed === 'string') { try { proposed = JSON.parse(proposed); } catch (e) { proposed = {}; } }
  await db.query(
    `INSERT INTO trip_requests (id, client_id, client_name, requested_by, requested_by_code, proposed, reason, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8)`,
    ['R' + Date.now(), String(p.clientId), p.clientName || '', p.requestedBy || '', p.requestedByCode || '',
     JSON.stringify(proposed || {}), p.reason || '', cairoDateTime()]
  );
  return { status: 'success', message: 'تم إرسال الطلب للمدير' };
}

async function decideTripRequest(db, p) {
  if (!isManager(p.role)) return { status: 'error', message: 'الموافقة على الطلبات للمديرين فقط' };
  const decision = String(p.decision || '');
  if (decision !== 'approved' && decision !== 'rejected') return { status: 'error', message: 'قرار غير صالح' };
  const decider = p.deciderName || 'المدير';

  const r = await db.query('SELECT * FROM trip_requests WHERE id=$1', [String(p.requestId)]);
  const req = r.rows[0];
  if (!req) return { status: 'error', message: 'الطلب غير موجود' };
  if (req.status !== 'pending') return { status: 'error', message: 'تم البت في هذا الطلب مسبقاً' };

  if (decision === 'approved') {
    const proposed = Object.assign({}, req.proposed || {}, { _approvedBy: decider, _approvedAt: cairoDateTime() });
    const up = await db.query('UPDATE clients SET trip_details=$2 WHERE id=$1', [String(req.client_id), JSON.stringify(proposed)]);
    if (!up.rowCount) return { status: 'error', message: 'العميل لم يعد موجوداً' };
  }

  await db.query(`UPDATE trip_requests SET status=$2, decided_by=$3, decided_at=$4 WHERE id=$1`,
    [String(p.requestId), decision, decider, cairoDateTime()]);

  const msg = decision === 'approved'
    ? `تمت الموافقة على طلب تعديل بيانات الرحلة وتم حفظ البيانات. المدير: ${decider}`
    : `لم تتم الموافقة على طلب تعديل بيانات الرحلة، وتم الإبقاء على البيانات القديمة. المدير: ${decider}`;
  await appendNote(db, decider, req.requested_by, req.client_id, req.client_name, msg);

  return { status: 'success', message: decision === 'approved' ? 'تمت الموافقة وحفظ البيانات' : 'تم رفض الطلب' };
}

async function saveSetting(db, p) {
  if (!isManager(p.role)) return { status: 'error', message: 'الإعدادات للمديرين فقط' };
  await db.query(`INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`,
    [String(p.key), String(p.value == null ? '' : p.value)]);
  return { status: 'success' };
}

async function transferClients(db, p) {
  if (!isManager(p.role)) return { status: 'error', message: 'نقل العملاء للمديرين فقط' };
  const ids = String(p.ids || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!ids.length) return { status: 'error', message: 'لم يتم تحديد أي عملاء' };
  const r = await db.query('UPDATE clients SET agent_code=$2, agent_name=$3 WHERE id = ANY($1)',
    [ids, String(p.agentCode || ''), String(p.agentName || '')]);
  if (p.agentName) {
    await appendNote(db, 'المدير', p.agentName, '', 'نقل جماعي', `تم نقل ${r.rowCount} عميل إليك من قبل المدير لمتابعتهم واستكمال الحجز معهم.`);
  }
  return { status: 'success', message: `تم نقل ${r.rowCount} عميل إلى ${p.agentName || 'الموظف'}` };
}

async function getUsers(db, p) {
  const role = String(p.role || '').trim().toLowerCase();
  if (role !== 'tech_manager' && role !== 'admin') return { status: 'error', message: 'غير مصرح لك بإدارة الموظفين (للمدير الفني فقط)' };
  const users = (await db.query('SELECT * FROM users ORDER BY username')).rows.map(u => ({
    username: u.username, password: u.password, code: u.code || '', role: u.role || 'mowazaf', name: u.name || u.username
  }));
  return { status: 'success', users };
}

async function saveUser(db, p) {
  if (String(p.requesterRole || '').trim().toLowerCase() !== 'tech_manager') {
    return { status: 'error', message: 'عفواً! المدير الفني للسيستم هو الوحيد المصرح له بإضافة أو حذف الموظفين.' };
  }
  const username = String(p.username || '').trim(), password = String(p.password || '').trim();
  if (!username || !password) return { status: 'error', message: 'اسم المستخدم وكلمة المرور مطلوبان' };
  await db.query(
    `INSERT INTO users (username, password, code, role, name) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (username) DO UPDATE SET password=EXCLUDED.password, code=EXCLUDED.code, role=EXCLUDED.role, name=EXCLUDED.name`,
    [username, password, String(p.code || '').trim(), String(p.role || 'mowazaf').trim(), String(p.name || username).trim()]
  );
  return { status: 'success', message: 'تم حفظ بيانات الموظف بنجاح' };
}

async function deleteUser(db, p) {
  if (String(p.requesterRole || '').trim().toLowerCase() !== 'tech_manager') {
    return { status: 'error', message: 'عفواً! المدير الفني للسيستم هو الوحيد المصرح له بإضافة أو حذف الموظفين.' };
  }
  await db.query('DELETE FROM users WHERE lower(username)=lower($1)', [String(p.username || '').trim()]);
  return { status: 'success', message: 'تم حذف الموظف بنجاح' };
}

async function sendAdminNote(db, p) {
  await appendNote(db, p.fromUser || 'المدير', p.toUser || '', p.clientId || '', p.clientName || '', p.noteText || '');
  return { status: 'success', message: 'تم إرسال التنبيه للموظف بنجاح' };
}

async function markNoteRead(db, p) {
  await db.query(`UPDATE admin_notes SET status='read' WHERE id=$1`, [String(p.noteId)]);
  return { status: 'success' };
}

// ------------------------- الـ Dispatcher -------------------------
const ACTIONS = {
  ping: async () => ({ status: 'success', pong: true, version: 5.4 }),
  login: loginUser,
  getData: getData,
  saveClient: saveClient,
  deleteClient: deleteClient,
  toggleFollowup: toggleFollowup,
  addProgram: addProgram,
  deleteProgram: deleteProgram,
  saveProgram: saveProgram,
  deleteProgramById: deleteProgramById,
  submitTripRequest: submitTripRequest,
  decideTripRequest: decideTripRequest,
  saveSetting: saveSetting,
  transferClients: transferClients,
  getUsers: getUsers,
  saveUser: saveUser,
  deleteUser: deleteUser,
  sendAdminNote: sendAdminNote,
  markNoteRead: markNoteRead
};
const WRITE_ACTIONS = new Set(Object.keys(ACTIONS).filter(a => a !== 'ping' && a !== 'login' && a !== 'getData' && a !== 'getUsers'));

app.get('/', (req, res) => res.json({ ok: true, app: 'CRM Neon Backend', version: 5.4 }));

app.all('/api', async (req, res) => {
  const p = parseParams(req);
  const fn = ACTIONS[p.action];
  if (!fn) return res.json({ status: 'error', message: 'Action not found: ' + p.action });

  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    if (WRITE_ACTIONS.has(p.action)) await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [p.action + ':' + String(p.id || p.username || p.requestId || '')]);
    const data = await fn(db, p);
    await db.query('COMMIT');
    res.json(data);
  } catch (e) {
    try { await db.query('ROLLBACK'); } catch (_) { /* ignore */ }
    res.json({ status: 'error', message: String((e && e.message) || e) });
  } finally {
    db.release();
  }
});

app.listen(PORT, () => {
  console.log(`✅ CRM Neon Backend شغال على المنفذ ${PORT}`);
  console.log(`📡 الـ API: http://localhost:${PORT}/api`);
});
