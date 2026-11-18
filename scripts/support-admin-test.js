// Admin-side support flow check: admin lists/resolves an enquiry, business sees the response.
const BASE = 'https://touround-qa-fbee698b7067.herokuapp.com/api';
async function req(method, path, { token, body } = {}) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(BASE + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await r.text();
      let data; try { data = JSON.parse(text); } catch { data = text; }
      return { status: r.status, data };
    } catch (e) { if (i === 2) return { status: 0, data: String(e.cause?.code || e.message) }; await new Promise(r => setTimeout(r, 4000)); }
  }
}
const show = (l, r) => console.log(`${r.status >= 200 && r.status < 300 ? '[PASS]' : '[FAIL]'} ${l} -> ${r.status} ${JSON.stringify(r.data).slice(0, 400)}`);
(async () => {
  let adm;
  for (const lt of ['ADMIN', 'BUSINESS', 'CUSTOMER']) {
    adm = await req('POST', '/auth/login', { body: { emailOrCellphone: 'admin@touround.co.za', password: 'Touround123.', loginType: lt } });
    console.log(`admin login (${lt}) -> ${adm.status} role=${adm.data?.role}`);
    if (adm.data?.accessToken) break;
  }
  const at = adm.data?.accessToken;
  if (!at) { console.log(JSON.stringify(adm.data).slice(0, 300)); process.exit(1); }
  show('GET /support/admin/all', await req('GET', '/support/admin/all', { token: at }));
  show('GET /support/admin/status/PENDING', await req('GET', '/support/admin/status/PENDING', { token: at }));
  show('PUT resolve #1', await req('PUT', '/support/admin/1/status?status=RESOLVED&adminResponse=' + encodeURIComponent('Thanks for reaching out. Resolved during QA test.'), { token: at }));
  const bl = await req('POST', '/auth/login', { body: { emailOrCellphone: 'sibisis22@gmail.com', password: 'Test123.', loginType: 'BUSINESS' } });
  const bt = bl.data.accessToken;
  show('Business GET /support/1', await req('GET', '/support/1', { token: bt }));
  show('Business GET /support/my', await req('GET', '/support/my', { token: bt }));
  const n = await req('GET', `/notifications/business/${bl.data.userId || bl.data.id}`, { token: bt });
  const list = Array.isArray(n.data) ? n.data : n.data?.content || [];
  console.log('Business notifications:', list.length, JSON.stringify(list.slice(0, 2)).slice(0, 400));
})();
