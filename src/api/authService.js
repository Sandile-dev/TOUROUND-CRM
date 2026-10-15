import storage from '../utils/storage';
import apiClient, { handleApiError } from './client';
import env from '../config/env';

function decodeJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

async function findBusinessByEmail(email) {
  try {
    // Page through all attractions to find the business user by email.
    const pageSize = 100;
    let pageNo = 0;
    for (let i = 0; i < 50; i++) {
      const response = await apiClient.get('/attractions/all', {
        params: { pageNo, pageSize },
      });
      const data = response.data;
      const attractions = Array.isArray(data) ? data : data?.content || [];
      for (const attraction of attractions) {
        const users = attraction.users || [];
        const found = users.find(
          (u) => u.email?.toLowerCase() === email?.toLowerCase()
        );
        if (found) {
          return { ...found, attraction: { id: attraction.id, name: attraction.name } };
        }
      }
      const isLast = Array.isArray(data) || data?.last === true || attractions.length === 0;
      if (isLast) break;
      pageNo += 1;
    }
    return null;
  } catch {
    return null;
  }
}

// Find a business user by its id (the owner a staff member belongs to).
async function findBusinessById(userId) {
  try {
    const pageSize = 100;
    let pageNo = 0;
    for (let i = 0; i < 50; i++) {
      const response = await apiClient.get('/attractions/all', { params: { pageNo, pageSize } });
      const data = response.data;
      const attractions = Array.isArray(data) ? data : data?.content || [];
      for (const attraction of attractions) {
        const users = attraction.users || [];
        const found = users.find((u) => String(u.id) === String(userId));
        if (found) {
          return { ...found, attraction: { id: attraction.id, name: attraction.name } };
        }
      }
      const isLast = Array.isArray(data) || data?.last === true || attractions.length === 0;
      if (isLast) break;
      pageNo += 1;
    }
    return null;
  } catch {
    return null;
  }
}

function persistTokens(data) {
  const token = typeof data === 'string' ? data.trim() : (data.accessToken || data.token || '').trim();
  const refresh = typeof data === 'object' ? (data.refreshToken || data.refresh_token || '').trim() : '';
  return { token, refresh };
}

// Staff login flow: authenticates with loginType STAFF, then resolves the staff
// record (for name + owning business) and the business context so staff operate
// on behalf of their business. Permissions come from the login response.
async function staffLogin(email, password) {
  let resp;
  try {
    resp = await apiClient.post('/auth/login', { emailOrCellphone: email, password, loginType: 'STAFF' });
  } catch (error) {
    throw handleApiError(error);
  }
  const data = resp.data;
  const { token, refresh } = persistTokens(data);
  if (token) await storage.setItem('crm_token', token);
  if (refresh) await storage.setItem('crm_refresh_token', refresh);

  const permissions = Array.isArray(data?.permissions) ? data.permissions : [];
  const staffRole = data?.staffRole || data?.role || 'STAFF';

  // Find this staff's record to get their name and owning business (userId).
  let staffRecord = null;
  try {
    const r = await apiClient.get('/business/staff');
    const list = Array.isArray(r.data) ? r.data : r.data?.content || [];
    staffRecord = list.find((s) => (s.email || '').toLowerCase() === email.toLowerCase()) || null;
  } catch {}

  // Resolve the business the staff belongs to (for attraction + business id).
  // Note: the backend may report the staff's owning-business id as 0/absent; in
  // that case we leave business context null rather than fetch the wrong business.
  let business = null;
  const ownerId = staffRecord && (staffRecord.userId || staffRecord.businessUserId);
  if (ownerId != null && Number(ownerId) > 0) business = await findBusinessById(ownerId);

  const displayName = staffRecord
    ? [staffRecord.firstName, staffRecord.lastName].filter(Boolean).join(' ').trim()
    : '';

  return {
    // Business context the app's data screens rely on (null if unresolved).
    id: business ? business.id : null,
    name: (business && business.name) || displayName || 'Staff',
    attraction: business ? business.attraction : null,
    // Staff identity + access control.
    isStaff: true,
    staffId: staffRecord ? staffRecord.id : null,
    staffName: displayName,
    staffEmail: email,
    role: 'STAFF',
    staffRole,
    position: staffRecord ? staffRecord.position : null,
    permissions,
  };
}

const authService = {
  login: async (email, password) => {
    await storage.deleteItem('crm_token');
    await storage.deleteItem('crm_refresh_token');

    // 1) Try a business-owner login.
    let bizResp;
    try {
      bizResp = await apiClient.post('/auth/login', {
        emailOrCellphone: email, password, loginType: 'BUSINESS',
      });
    } catch (error) {
      // If the backend says this isn't a business user, fall through to STAFF.
      const msg = (error?.response?.data?.message || error?.response?.data || error?.message || '').toString().toLowerCase();
      const notBusiness = error?.response?.status === 400 && msg.includes('not registered as a business');
      if (!notBusiness) throw handleApiError(error);
      return await staffLogin(email, password);
    }

    // Business-owner success path.
    const data = bizResp.data;
    const { token, refresh } = persistTokens(data);
    if (token) await storage.setItem('crm_token', token);
    if (refresh) await storage.setItem('crm_refresh_token', refresh);

    const payload = decodeJwtPayload(token);
    const userEmail = payload?.sub || email;
    const business = await findBusinessByEmail(userEmail);
    if (!business) {
      await storage.deleteItem('crm_token');
      await storage.deleteItem('crm_refresh_token');
      throw new Error('This account is not associated with a business. Please use the customer app instead.');
    }
    return {
      ...business,
      role: 'OWNER',
      // Owners have unrestricted access.
      permissions: ['*'],
    };
  },

  register: async (businessData) => {
    try {
      const boundary = '----FormBoundary' + Math.random().toString(36).substr(2);
      let body = '';
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="user"\r\n`;
      body += `Content-Type: application/json\r\n\r\n`;
      body += JSON.stringify(businessData) + '\r\n';
      body += `--${boundary}--\r\n`;

      const headers = { 'Content-Type': `multipart/form-data; boundary=${boundary}` };

      const response = await fetch(`${env.apiBaseUrl}/auth/new/partner`, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        const errText = await response.text();
        const regErr = new Error(errText || `Registration failed with status ${response.status}`);
        // Attach a response so handleApiError maps it to a friendly, status-based message.
        regErr.response = { status: response.status, data: errText };
        throw regErr;
      }

      const ct = response.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await response.json() : await response.text();
      const token = (typeof data === 'string' ? data : data.accessToken || data.token || '').trim();
      if (token) await storage.setItem('crm_token', token);
      return { registered: true, email: businessData.email };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  logout: async () => {
    await storage.deleteItem('crm_token');
    await storage.deleteItem('crm_refresh_token');
    await storage.deleteItem('crm_user');
  },

  /**
   * Exchange the stored refresh token for a new access token.
   * Assumes the backend exposes POST /auth/refresh accepting { refreshToken }
   * and returning { accessToken, refreshToken? }.
   * Returns the new access token, or null if refresh isn't possible.
   */
  refreshToken: async () => {
    const refresh = await storage.getItem('crm_refresh_token');
    if (!refresh) return null;
    try {
      const response = await apiClient.post('/auth/refresh-token', { refreshToken: refresh });
      const data = response.data;
      const newToken = (typeof data === 'string' ? data : (data.accessToken || data.token || '')).trim();
      if (!newToken) return null;
      await storage.setItem('crm_token', newToken);
      // Persist a rotated refresh token if the backend returns one.
      const newRefresh = typeof data === 'object'
        ? (data.refreshToken || data.refresh_token || '').trim()
        : '';
      if (newRefresh) await storage.setItem('crm_refresh_token', newRefresh);
      return newToken;
    } catch {
      return null;
    }
  },

  forgotPassword: async (email) => {
    try {
      const response = await apiClient.post(`/auth/forgot-password?email=${encodeURIComponent(email)}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  verifyEmail: async (email, code) => {
    try {
      const response = await apiClient.post(`/auth/verify-email?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  resetPassword: async (token, newPassword) => {
    try {
      const response = await apiClient.post('/auth/reset-password', { token, newPassword });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },
};

export default authService;
