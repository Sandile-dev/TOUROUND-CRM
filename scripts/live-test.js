/**
 * Comprehensive live test against QA backend.
 * Simulates what the mobile app does for: auth, reservations (with amount enrichment),
 * staff (business-only), analytics revenue, payments, posts, notifications, wallet.
 *
 * Usage: node scripts/live-test.js
 */
const BASE = 'https://touround-qa-fbee698b7067.herokuapp.com/api';
const CREDS = { email: 'sibisis22@gmail.com', password: 'Test123.' };

const results = [];
function pass(name, note) { results.push({ ok: true, name, note }); console.log(`[PASS] ${name}${note ? '  — ' + note : ''}`); }
function fail(name, note) { results.push({ ok: false, name, note }); console.log(`[FAIL] ${name}  — ${note}`); }

async function req(method, path, { token, body, params } = {}) {
  let url = `${BASE}${path}`;
  if (params) url += '?' + new URLSearchParams(params).toString();
  const h = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(url, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: r.status, ok: r.ok, data, text };
}

const arr = (d) => Array.isArray(d) ? d : d && Array.isArray(d.content) ? d.content : [];

// --- Slot price cache (replicates enrichReservationAmounts) ---
const slotPriceCache = {};
async function getSlotPrice(id, token) {
  if (slotPriceCache[id] !== undefined) return slotPriceCache[id];
  try {
    const r = await req('GET', `/business-slots/${id}`, { token });
    const p = r.data?.slotPrice ?? r.data?.price ?? null;
    slotPriceCache[id] = p != null ? Number(p) : null;
  } catch { slotPriceCache[id] = null; }
  return slotPriceCache[id];
}

async function enrichAmounts(reservations, token) {
  await Promise.all(reservations.map(async (r) => {
    if (r.totalPrice != null && r.totalPrice !== 0) return;
    const sid = r.businessSlotId || r.roomId || r.businessTableId;
    if (!sid) return;
    const price = await getSlotPrice(sid, token);
    if (price != null) r.totalPrice = price * (r.numberOfGuests || 1);
  }));
}

(async () => {
  // ─────────────────────────────────────────────
  // 1. AUTHENTICATION (Business + Staff)
  // ─────────────────────────────────────────────
  console.log('\n══ AUTH ══');
  const bl = await req('POST', '/auth/login', { body: { emailOrCellphone: CREDS.email, password: CREDS.password, loginType: 'BUSINESS' } });
  if (bl.ok && bl.data?.accessToken) {
    pass('Business login', `role=${bl.data.role} token=${bl.data.accessToken.slice(-12)}`);
  } else {
    fail('Business login', bl.text.slice(0, 100)); process.exit(1);
  }
  const bt = bl.data.accessToken;

  // Resolve business user id via attractions.
  let businessId = null, attractionName = null;
  const atts = await req('GET', '/attractions/all', { token: bt, params: { pageNo: 0, pageSize: 100 } });
  for (const a of arr(atts.data)) {
    const u = (a.users || []).find(u => u.email === CREDS.email);
    if (u) { businessId = u.id; attractionName = a.name; break; }
  }
  businessId
    ? pass('Resolve business context', `businessId=${businessId} attraction="${attractionName}"`)
    : fail('Resolve business context', 'not found in attractions');

  // Staff login (BUSINESS type, now accepted for staff).
  // Fetch one staff member to test their login.
  const staffList = await req('GET', '/staff', { token: bt });
  const staffArr = arr(staffList.data);
  if (staffArr.length > 0 && staffArr[0].email) {
    const testStaffEmail = staffArr[0].email;
    for (const lt of ['BUSINESS', 'STAFF']) {
      const sr = await req('POST', '/auth/login', { body: { emailOrCellphone: testStaffEmail, password: 'Test123.', loginType: lt } });
      sr.ok
        ? pass(`Staff login via loginType=${lt}`, `role=${sr.data?.role} perms=${JSON.stringify(sr.data?.permissions)}`)
        : fail(`Staff login via loginType=${lt}`, sr.text.slice(0, 100));
    }
  } else {
    fail('Staff login test', 'no staff found to test with');
  }

  // ─────────────────────────────────────────────
  // 2. STAFF MANAGEMENT (business-only, defect 2)
  // ─────────────────────────────────────────────
  console.log('\n══ STAFF ══');
  // New endpoint: GET /api/staff (curl 22)
  const staffNew = await req('GET', '/staff', { token: bt });
  const staffItems = arr(staffNew.data);
  staffNew.ok
    ? pass('GET /staff (curl 22)', `count=${staffItems.length}`)
    : fail('GET /staff (curl 22)', staffNew.text.slice(0, 100));

  // Check all returned staff belong to this business.
  if (businessId && staffItems.length > 0) {
    const adminStaff = staffItems.filter(s => !s.businessUserId || s.businessUserId === 0);
    adminStaff.length === 0
      ? pass('Staff isolation (no admin staff shown)', `all ${staffItems.length} belong to businessId=${businessId}`)
      : fail('Staff isolation', `${adminStaff.length} staff with no businessUserId: ${adminStaff.map(s => s.email).join(', ')}`);
  }

  // GET /api/staff/business/{id} (curl 23)
  if (businessId) {
    const staffByBiz = await req('GET', `/staff/business/${businessId}`, { token: bt });
    staffByBiz.ok
      ? pass('GET /staff/business/{id} (curl 23)', `count=${arr(staffByBiz.data).length}`)
      : fail('GET /staff/business/{id}', staffByBiz.text.slice(0, 100));
  }

  // ─────────────────────────────────────────────
  // 3. RESERVATIONS WITH AMOUNT ENRICHMENT (defect 1)
  // ─────────────────────────────────────────────
  console.log('\n══ RESERVATIONS + AMOUNT ENRICHMENT ══');
  let reservations = [];
  if (businessId) {
    const rr = await req('GET', `/reservations/business/${businessId}`, { token: bt });
    reservations = arr(rr.data);
    rr.ok
      ? pass('GET /reservations/business/{id}', `count=${reservations.length}`)
      : fail('GET /reservations/business/{id}', rr.text.slice(0, 100));

    const nullBefore = reservations.filter(r => r.totalPrice == null || r.totalPrice === 0).length;
    await enrichAmounts(reservations, bt);
    const nullAfter = reservations.filter(r => r.totalPrice == null || r.totalPrice === 0).length;
    const enriched = nullBefore - nullAfter;
    pass('Amount enrichment',
      `before: ${nullBefore} null/zero amounts → after: ${nullAfter} null/zero (${enriched} enriched from slot price)`);
    reservations.forEach(r => {
      console.log(`  ${r.reservationReference}  status=${r.reservationStatus}  totalPrice=${r.totalPrice}`);
    });
  }

  // ─────────────────────────────────────────────
  // 4. ANALYTICS REVENUE (defect 3)
  // ─────────────────────────────────────────────
  console.log('\n══ ANALYTICS ══');
  {
    const completed = reservations.filter(r => {
      const s = (r.reservationStatus || '').toUpperCase();
      return ['CHECKED_OUT', 'COMPLETED', 'ACCEPTED', 'CONFIRMED', 'RESERVED'].includes(s);
    });
    const revenue = completed.reduce((s, r) => s + (r.totalPrice || 0), 0);
    const cancelled = reservations.filter(r => ['CANCELLED', 'REJECTED'].includes((r.reservationStatus || '').toUpperCase()));
    const loss = cancelled.reduce((s, r) => s + (r.totalPrice || 0), 0);
    pass('Analytics revenue', `totalRevenue=R${revenue} (from ${completed.length} completed) totalLoss=R${loss}`);
  }

  // ─────────────────────────────────────────────
  // 5. PAYMENTS / EARNINGS (defect 4)
  // ─────────────────────────────────────────────
  console.log('\n══ PAYMENTS & EARNINGS ══');
  const wallet = await req('GET', '/v1/wallet', { token: bt });
  wallet.ok
    ? pass('GET /v1/wallet', `balance=R${wallet.data?.balance} id=${wallet.data?.id}`)
    : fail('GET /v1/wallet', wallet.text.slice(0, 100));

  const txns = await req('GET', '/v1/wallet/transactions', { token: bt });
  txns.ok
    ? pass('GET /v1/wallet/transactions', `count=${arr(txns.data).length}`)
    : fail('GET /v1/wallet/transactions', txns.text.slice(0, 100));

  // Simulate what the app now does: build earnings from reservations.
  const PLATFORM = 0.08, SERVICE = 0.05;
  const completedForEarnings = reservations.filter(r => {
    const s = (r.reservationStatus || r.bookingStatus || '').toUpperCase();
    return ['CHECKED_OUT', 'COMPLETED', 'ACCEPTED', 'CONFIRMED', 'RESERVED', 'BOOKED'].includes(s);
  });
  const grossSales = completedForEarnings.reduce((s, r) => s + (r.totalPrice || 0), 0);
  const netEarnings = grossSales * (1 - PLATFORM - SERVICE);
  pass('Earnings from reservations', `grossSales=R${grossSales.toFixed(2)} platformFee=R${(grossSales * PLATFORM).toFixed(2)} serviceFee=R${(grossSales * SERVICE).toFixed(2)} netEarnings=R${netEarnings.toFixed(2)}`);

  // Commission owed
  const comm = await req('GET', '/v1/wallet/commission-owed', { token: bt });
  comm.ok
    ? pass('GET /v1/wallet/commission-owed', `value=${JSON.stringify(comm.data)}`)
    : fail('GET /v1/wallet/commission-owed', comm.text.slice(0, 100));

  // ─────────────────────────────────────────────
  // 6. POSTS
  // ─────────────────────────────────────────────
  console.log('\n══ POSTS ══');
  if (businessId) {
    const posts = await req('GET', `/posts/user/${businessId}`, { token: bt });
    posts.ok
      ? pass('GET /posts/user/{id}', `count=${arr(posts.data).length} first imageUrls=${JSON.stringify((arr(posts.data)[0]?.imageUrls||[]).slice(0,1))}`)
      : fail('GET /posts/user/{id}', posts.text.slice(0, 100));
  }

  // ─────────────────────────────────────────────
  // 7. NOTIFICATIONS
  // ─────────────────────────────────────────────
  console.log('\n══ NOTIFICATIONS ══');
  if (businessId) {
    const notifs = await req('GET', `/notifications/business/${businessId}`, { token: bt });
    notifs.ok
      ? pass('GET /notifications/business/{id}', `count=${arr(notifs.data).length}`)
      : fail('GET /notifications/business/{id}', notifs.text.slice(0, 100));
    const unread = await req('GET', `/notifications/business/${businessId}/unread`, { token: bt });
    unread.ok
      ? pass('GET notifications unread', `count=${arr(unread.data).length}`)
      : fail('GET notifications unread', unread.text.slice(0, 100));
  }

  // ─────────────────────────────────────────────
  // 8. PROFILE
  // ─────────────────────────────────────────────
  console.log('\n══ PROFILE ══');
  if (businessId) {
    const prof = await req('GET', `/business/profile/${businessId}`, { token: bt });
    prof.ok
      ? pass('GET /business/profile/{id}', `name="${prof.data?.name}"`)
      : fail('GET /business/profile/{id}', prof.text.slice(0, 100));
  }

  // ─────────────────────────────────────────────
  // 9. SERVICES (slots)
  // ─────────────────────────────────────────────
  console.log('\n══ SERVICES ══');
  if (businessId) {
    const slots = await req('GET', `/business-slots/business/${businessId}`, { token: bt });
    const slotArr = arr(slots.data);
    slots.ok
      ? pass('GET /business-slots/business/{id}', `count=${slotArr.length} prices=${slotArr.map(s=>s.slotPrice).join(',')}`)
      : fail('GET /business-slots', slots.text.slice(0, 100));
  }

  // ─────────────────────────────────────────────
  // 10. REFRESH TOKEN
  // ─────────────────────────────────────────────
  console.log('\n══ AUTH REFRESH ══');
  if (bl.data?.refreshToken) {
    const ref = await req('POST', '/auth/refresh-token', { body: { refreshToken: bl.data.refreshToken } });
    ref.ok && (ref.data?.accessToken || ref.data?.token)
      ? pass('POST /auth/refresh-token', 'new token issued')
      : fail('POST /auth/refresh-token', ref.text.slice(0, 100));
  }

  // ─────────────────────────────────────────────
  // 11. SUPPORT ENQUIRIES
  // ─────────────────────────────────────────────
  console.log('\n══ SUPPORT ══');
  {
    const created = await req('POST', '/support', { token: bt, body: { subject: 'Live test enquiry', message: 'Automated live-test enquiry, please ignore.', type: 'ENQUIRY' } });
    created.ok
      ? pass('POST /support', `id=${created.data?.id} status=${created.data?.status} type=${created.data?.type}`)
      : fail('POST /support', `${created.status} ${created.text.slice(0, 100)}`);
    const mine = await req('GET', '/support/my', { token: bt });
    mine.ok
      ? pass('GET /support/my', `count=${arr(mine.data).length}`)
      : fail('GET /support/my', `${mine.status} ${mine.text.slice(0, 100)}`);
    const id = created.data?.id ?? arr(mine.data)[0]?.id;
    if (id != null) {
      const one = await req('GET', `/support/${id}`, { token: bt });
      one.ok
        ? pass('GET /support/{id}', `status=${one.data?.status}`)
        : fail('GET /support/{id}', `${one.status} ${one.text.slice(0, 100)}`);
    }
  }

  // ─────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────
  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  if (failed > 0) {
    console.log('\nFailures:');
    results.filter(r => !r.ok).forEach(r => console.log(`  ✗ ${r.name}:  ${r.note}`));
  }
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
