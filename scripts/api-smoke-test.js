/**
 * API smoke test against the QA backend using real app endpoints.
 *
 * Logs in a business user and a customer user, resolves the business user id,
 * then exercises the read endpoints the mobile app relies on and reports a
 * pass/fail table. Read-only (no writes/deletes).
 *
 * Usage: node scripts/api-smoke-test.js
 */
const BASE = 'https://touround-qa-fbee698b7067.herokuapp.com/api';

const CREDS = {
  business: { email: 'sibisis22@gmail.com', password: 'Test123.', loginType: 'BUSINESS' },
  customer: { email: 'sandile.sibisi@touround.co.za', password: 'Test123.', loginType: 'CUSTOMER' },
};

const results = [];
function record(name, ok, status, note) {
  results.push({ name, ok, status, note: note || '' });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${String(status ?? '---').padEnd(3)}  ${name}${note ? '  — ' + note : ''}`);
}

async function req(method, path, { token, body, params } = {}) {
  let url = `${BASE}${path}`;
  if (params) {
    const q = new URLSearchParams(params).toString();
    url += (url.includes('?') ? '&' : '?') + q;
  }
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, ok: res.ok, data, text };
}

const arr = (d) => (Array.isArray(d) ? d : d && Array.isArray(d.content) ? d.content : []);
const count = (d) => `items=${arr(d).length}`;

function decodeSub(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
    return payload.sub;
  } catch { return null; }
}

async function login(kind) {
  const c = CREDS[kind];
  const r = await req('POST', '/auth/login', { body: { emailOrCellphone: c.email, password: c.password, loginType: c.loginType } });
  const token = r.data && (r.data.accessToken || r.data.token);
  record(`POST /auth/login (${kind})`, r.ok && !!token, r.status, r.ok ? `role=${r.data.role}` : r.text.slice(0, 100));
  return { token, data: r.data };
}

(async () => {
  console.log('=== AUTH ===');
  const biz = await login('business');
  const cust = await login('customer');
  const bt = biz.token;
  const ct = cust.token;

  console.log('\n=== RESOLVE BUSINESS CONTEXT ===');
  let businessUserId = null, attractionId = null, attractionName = null;
  {
    // The app pages /attractions/all and matches the logged-in email.
    let pageNo = 0; const pageSize = 100; let found = false;
    for (let i = 0; i < 10 && !found; i++) {
      const r = await req('GET', '/attractions/all', { token: bt, params: { pageNo, pageSize } });
      const list = arr(r.data);
      for (const a of list) {
        const u = (a.users || []).find((x) => (x.email || '').toLowerCase() === CREDS.business.email.toLowerCase());
        if (u) { businessUserId = u.id; attractionId = a.id; attractionName = a.name; found = true; break; }
      }
      if (!r.data || (r.data.last === true) || list.length === 0) break;
      pageNo++;
    }
    record('GET /attractions/all (resolve business)', !!businessUserId, 200,
      businessUserId ? `businessUserId=${businessUserId}, attraction="${attractionName}" (id ${attractionId})` : 'business user not found');
  }

  console.log('\n=== PROFILE ===');
  if (businessUserId) {
    const r = await req('GET', `/business/profile/${businessUserId}`, { token: bt });
    record('GET /business/profile/{id}', r.ok, r.status, r.ok ? `name="${r.data?.name}"` : r.text.slice(0, 80));
  }

  console.log('\n=== POSTS ===');
  {
    const r = await req('GET', '/posts/all', { token: bt, params: { pageNo: 0, pageSize: 5 } });
    record('GET /posts/all', r.ok, r.status, count(r.data));
    const p = arr(r.data)[0];
    if (p && p.id != null) {
      const r2 = await req('GET', `/posts/${p.id}`, { token: bt });
      record('GET /posts/{id}', r2.ok, r2.status, `id=${p.id}`);
      const r3 = await req('GET', `/posts/${p.id}/comments`, { token: bt, params: { pageNo: 0, pageSize: 5 } });
      record('GET /posts/{id}/comments', r3.ok, r3.status, count(r3.data));
      const r4 = await req('GET', `/posts/${p.id}/reactions`, { token: bt, params: { pageNo: 0, pageSize: 5 } });
      record('GET /posts/{id}/reactions', r4.ok, r4.status, count(r4.data));
    }
  }
  if (businessUserId) {
    const r = await req('GET', `/posts/user/${businessUserId}`, { token: bt });
    record('GET /posts/user/{id}', r.ok, r.status, count(r.data));
  }
  if (attractionId) {
    const r = await req('GET', `/posts/attraction/${attractionId}`, { token: bt });
    record('GET /posts/attraction/{id}', r.ok, r.status, count(r.data));
  }

  console.log('\n=== SERVICES (rooms / tables / slots) ===');
  if (businessUserId) {
    const rooms = await req('GET', `/accommodation/rooms/business/${businessUserId}`, { token: bt });
    record('GET /accommodation/rooms/business/{id}', rooms.ok, rooms.status, rooms.ok ? count(rooms.data) : 'n/a');
    const tables = await req('GET', `/business-tables/business/${businessUserId}`, { token: bt });
    record('GET /business-tables/business/{id}', tables.ok, tables.status, tables.ok ? count(tables.data) : 'n/a');
    const slots = await req('GET', `/business-slots/business/${businessUserId}`, { token: bt });
    record('GET /business-slots/business/{id}', slots.ok, slots.status, slots.ok ? count(slots.data) : 'n/a');
  }

  console.log('\n=== RESERVATIONS / BOOKINGS ===');
  if (businessUserId) {
    const res = await req('GET', `/reservations/business/${businessUserId}`, { token: bt });
    record('GET /reservations/business/{id}', res.ok, res.status, res.ok ? count(res.data) : 'n/a');
    const tr = await req('GET', `/table-reservations/business/${businessUserId}`, { token: bt });
    record('GET /table-reservations/business/{id}', tr.ok, tr.status, tr.ok ? count(tr.data) : 'n/a');
    const bk = await req('GET', `/accommodation/bookings/business/${businessUserId}`, { token: bt });
    record('GET /accommodation/bookings/business/{id}', bk.ok, bk.status, bk.ok ? count(bk.data) : 'n/a');
  }

  console.log('\n=== EVENTS & TICKETS ===');
  let eventId = null;
  if (businessUserId) {
    const r = await req('GET', `/events/business/${businessUserId}`, { token: bt });
    record('GET /events/business/{id}', r.ok, r.status, r.ok ? count(r.data) : 'n/a');
    const ev = arr(r.data)[0]; eventId = ev && ev.id;
  }
  {
    const r = await req('GET', '/events/all', { token: bt, params: { pageNo: 0, pageSize: 5 } });
    record('GET /events/all', r.ok, r.status, r.ok ? count(r.data) : 'n/a');
    if (eventId == null) { const ev = arr(r.data)[0]; eventId = ev && ev.id; }
  }
  if (eventId != null) {
    const r = await req('GET', `/events/${eventId}`, { token: bt });
    record('GET /events/{id}', r.ok, r.status, `id=${eventId}`);
  }

  console.log('\n=== MESSAGES ===');
  if (businessUserId) {
    const r = await req('GET', `/messages/business/${businessUserId}`, { token: bt });
    record('GET /messages/business/{id}', r.ok, r.status, r.ok ? count(r.data) : r.text.slice(0, 80));
  }

  console.log('\n=== SEARCH (customer lookup) ===');
  {
    const r = await req('GET', '/search', { token: bt, params: { query: 'sandile' } });
    const c = r.data && (r.data.customers || []);
    record('GET /search?query=', r.ok, r.status, r.ok ? `customers=${(c || []).length}` : r.text.slice(0, 80));
  }

  console.log('\n=== REVIEWS ===');
  if (businessUserId) {
    const r = await req('GET', `/reviews/business/${businessUserId}`, { token: bt });
    record('GET /reviews/business/{id}', r.ok, r.status, r.ok ? count(r.data) : 'n/a');
  }

  console.log('\n=== PROMOTIONS ===');
  if (businessUserId) {
    const r = await req('GET', `/promotions/business/${businessUserId}`, { token: bt });
    record('GET /promotions/business/{id}', r.ok, r.status, r.ok ? count(r.data) : 'n/a');
  }

  console.log('\n=== STAFF ===');
  if (businessUserId) {
    const r = await req('GET', `/staff/business/${businessUserId}`, { token: bt });
    record('GET /staff/business/{id}', r.ok, r.status, r.ok ? count(r.data) : r.text.slice(0, 80));
  }

  console.log('\n=== WALLET / PAYMENTS ===');
  {
    const w = await req('GET', '/v1/wallet', { token: bt });
    record('GET /v1/wallet', w.ok, w.status, w.ok ? 'ok' : w.text.slice(0, 80));
    const tx = await req('GET', '/v1/wallet/transactions', { token: bt });
    record('GET /v1/wallet/transactions', tx.ok, tx.status, tx.ok ? count(tx.data) : tx.text.slice(0, 80));
    const co = await req('GET', '/v1/wallet/commission-owed', { token: bt });
    record('GET /v1/wallet/commission-owed', co.ok, co.status, co.ok ? 'ok' : co.text.slice(0, 80));
  }

  console.log('\n=== FOLLOWERS ===');
  if (businessUserId) {
    const r = await req('GET', `/follow/followers/${businessUserId}`, { token: bt });
    record('GET /follow/followers/{id}', r.ok, r.status, r.ok ? count(r.data) : r.text.slice(0, 80));
  }

  console.log('\n=== NOTIFICATIONS ===');
  if (businessUserId) {
    const r = await req('GET', `/notifications/business/${businessUserId}`, { token: bt });
    record('GET /notifications/business/{id}', r.ok, r.status, r.ok ? count(r.data) : r.text.slice(0, 80));
    const ru = await req('GET', `/notifications/business/${businessUserId}/unread`, { token: bt });
    record('GET /notifications/business/{id}/unread', ru.ok, ru.status, ru.ok ? count(ru.data) : ru.text.slice(0, 80));
  }

  console.log('\n=== CUSTOMER-SIDE (customer token) ===');
  // Find the customer id from search results (business token) to call customer endpoints.
  let customerUserId = null;
  {
    const r = await req('GET', '/search', { token: bt, params: { query: CREDS.customer.email } });
    const c = (r.data && r.data.customers) || [];
    const match = c.find((x) => (x.email || '').toLowerCase() === CREDS.customer.email.toLowerCase()) || c[0];
    customerUserId = match && match.id;
    record('resolve customerUserId via /search', !!customerUserId, r.status, customerUserId ? `customerUserId=${customerUserId}` : 'not found');
  }
  if (customerUserId != null) {
    const prof = await req('GET', `/customer/profile/${customerUserId}`, { token: bt });
    record('GET /customer/profile/{id}', prof.ok, prof.status, prof.ok ? `name="${prof.data?.name || ''}"` : prof.text.slice(0, 80));
    const cn = await req('GET', `/notifications/customer/${customerUserId}`, { token: ct });
    record('GET /notifications/customer/{id} (customer token)', cn.ok, cn.status, cn.ok ? count(cn.data) : cn.text.slice(0, 80));
  }

  console.log('\n=== REFRESH TOKEN ===');
  if (biz.data && biz.data.refreshToken) {
    const r = await req('POST', '/auth/refresh-token', { body: { refreshToken: biz.data.refreshToken } });
    const newTok = r.data && (r.data.accessToken || r.data.token);
    record('POST /auth/refresh-token', r.ok && !!newTok, r.status, r.ok ? 'new access token issued' : r.text.slice(0, 80));
  }

  const pass = results.filter((r) => r.ok).length;
  const fail = results.length - pass;
  console.log(`\n==================================================`);
  console.log(`SUMMARY: ${pass} passed, ${fail} failed, ${results.length} total`);
  if (fail) {
    console.log('\nFailures:');
    results.filter((r) => !r.ok).forEach((r) => console.log(`  - [${r.status}] ${r.name}  ${r.note}`));
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
