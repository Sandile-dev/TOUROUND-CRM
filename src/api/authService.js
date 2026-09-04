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

const authService = {
  login: async (email, password) => {
    try {
      await storage.deleteItem('crm_token');
      const response = await apiClient.post('/auth/login', {
        emailOrCellphone: email,
        password: password,
        loginType: 'BUSINESS',
      });
      const data = response.data;
      const token =
        typeof data === 'string'
          ? data.trim()
          : (data.accessToken || data.token || '').trim();
      if (token) await storage.setItem('crm_token', token);

      const payload = decodeJwtPayload(token);
      const userEmail = payload?.sub || email;
      const user = await findBusinessByEmail(userEmail);

      // Client-side guard: reject if user has no business association
      if (!user) {
        await storage.deleteItem('crm_token');
        throw new Error('This account is not associated with a business. Please use the customer app instead.');
      }

      return user;
    } catch (error) {
      throw handleApiError(error);
    }
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
        throw new Error(errText || `Registration failed with status ${response.status}`);
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
    await storage.deleteItem('crm_user');
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
