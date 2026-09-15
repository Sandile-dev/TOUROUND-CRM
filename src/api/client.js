import storage from '../utils/storage';
import env from '../config/env';

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;
const TIMEOUT = 30000;

// Shared in-flight refresh promise so concurrent 401s trigger only one refresh.
let refreshPromise = null;

/**
 * Attempt to exchange the stored refresh token for a new access token.
 * Implemented here (not via authService) to avoid a circular import.
 * Returns the new access token, or null if refresh isn't possible.
 */
async function refreshAccessToken(baseURL) {
  const refresh = await storage.getItem('crm_refresh_token');
  if (!refresh) return null;
  try {
    const response = await fetch(`${baseURL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!response.ok) return null;
    const ct = response.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await response.json() : await response.text();
    const newToken = (typeof data === 'string' ? data : (data.accessToken || data.token || '')).trim();
    if (!newToken) return null;
    await storage.setItem('crm_token', newToken);
    const newRefresh = typeof data === 'object' ? (data.refreshToken || data.refresh_token || '').trim() : '';
    if (newRefresh) await storage.setItem('crm_refresh_token', newRefresh);
    return newToken;
  } catch {
    return null;
  }
}

/**
 * Lightweight API client using fetch (no axios dependency).
 * Handles JWT auth, retries, and error normalization.
 */
class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async request(method, url, data, options = {}) {
    const { _isRetry, ...restOptions } = options;
    options = restOptions;
    const token = await storage.getItem('crm_token');
    const fullUrl = `${this.baseURL}${url}`;

    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let body = undefined;
    if (data instanceof FormData) {
      body = data;
      // Don't set Content-Type for FormData (browser/RN sets boundary automatically)
    } else if (data) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(data);
    }

    const config = {
      method,
      headers,
      body,
      ...options,
    };

    let lastError;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
        config.signal = controller.signal;

        const response = await fetch(fullUrl, config);
        clearTimeout(timeoutId);

        // Handle auth errors: try a token refresh once, then retry the request.
        if ((response.status === 401 || response.status === 403) && !url.includes('/auth/')) {
          if (!_isRetry) {
            // Coalesce concurrent refreshes into a single request.
            if (!refreshPromise) {
              refreshPromise = refreshAccessToken(this.baseURL).finally(() => { refreshPromise = null; });
            }
            const newToken = await refreshPromise;
            if (newToken) {
              // Retry the original request once with the fresh token.
              return this.request(method, url, data, { ...options, _isRetry: true });
            }
          }
          // Refresh failed (or this was already a retry) — clear the session.
          await storage.deleteItem('crm_token');
          await storage.deleteItem('crm_refresh_token');
          await storage.deleteItem('crm_user');
        }

        // Parse response
        const contentType = response.headers.get('content-type') || '';
        let responseData;
        if (contentType.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }

        if (!response.ok) {
          const error = new Error(
            typeof responseData === 'string' ? responseData :
            responseData?.message || responseData?.error || `Request failed with status ${response.status}`
          );
          error.response = { status: response.status, data: responseData };
          throw error;
        }

        return { data: responseData, status: response.status };
      } catch (error) {
        lastError = error;
        const isNetworkError = error.name === 'AbortError' || error.name === 'TypeError' || !error.response;
        const isServerError = error.response?.status >= 500;

        if ((isNetworkError || isServerError) && attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (attempt + 1)));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  get(url, options) {
    // Handle params option (convert to query string)
    if (options?.params) {
      const queryString = Object.entries(options.params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      if (queryString) url = `${url}${url.includes('?') ? '&' : '?'}${queryString}`;
      const { params, ...rest } = options;
      return this.request('GET', url, undefined, rest);
    }
    return this.request('GET', url, undefined, options);
  }
  post(url, data, options) { return this.request('POST', url, data, options); }
  put(url, data, options) {
    // Handle params option for PUT requests
    if (options?.params) {
      const queryString = Object.entries(options.params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      if (queryString) url = `${url}${url.includes('?') ? '&' : '?'}${queryString}`;
      const { params, ...rest } = options;
      return this.request('PUT', url, data, rest);
    }
    return this.request('PUT', url, data, options);
  }
  patch(url, data, options) { return this.request('PATCH', url, data, options); }
  delete(url, options) { return this.request('DELETE', url, undefined, options); }
}

const apiClient = new ApiClient(env.apiBaseUrl);

// Friendly, generic messages per HTTP status. Never expose backend internals.
function friendlyStatusMessage(status) {
  switch (status) {
    case 400: return 'Something went wrong with your request. Please check your details and try again.';
    case 401: return 'Incorrect email or password.';
    case 403: return 'You do not have permission to do that.';
    case 404: return 'We couldn’t find what you were looking for.';
    case 409: return 'That action conflicts with existing data. Please try again.';
    case 422: return 'Some of the information provided is invalid. Please check and try again.';
    case 429: return 'Too many requests. Please wait a moment and try again.';
    default:
      if (status >= 500) return 'Something went wrong on our side. Please try again shortly.';
      return 'Something went wrong. Please try again.';
  }
}

// Detects backend-internal / technical error text that must never reach users
// (SQL, stack traces, ORM/JDBC errors, connection strings, etc.).
function looksTechnical(msg) {
  if (!msg || typeof msg !== 'string') return true;
  const technicalMarkers = [
    'sql', 'jdbc', 'select ', 'insert into', 'update ', 'delete from',
    'relation', 'column', 'constraint', 'exception', 'nullpointer',
    'stacktrace', 'at org.', 'at com.', 'at java.', 'hibernate', 'psql',
    'syntax error', 'does not exist', 'org.springframework', 'servlet',
    'null]', 'position:', '{', '}', 'errno', 'econnrefused',
  ];
  const lower = msg.toLowerCase();
  if (technicalMarkers.some((m) => lower.includes(m))) return true;
  // Overly long messages are almost always dumps, not user copy.
  if (msg.length > 140) return true;
  return false;
}

// Returns a user-safe message: the backend's message only if it's clearly
// human-friendly, otherwise a generic status-based message.
function safeMessage(rawMessage, status) {
  if (rawMessage && !looksTechnical(rawMessage)) {
    return rawMessage.trim();
  }
  return friendlyStatusMessage(status);
}

export function handleApiError(error) {
  if (error.name === 'AbortError') {
    return new Error('Request timed out. Please check your connection.');
  }

  const status = error.response?.status;

  // No HTTP response object — could be a network error OR a raw Error thrown by
  // a non-apiClient path (e.g. multipart uploads) whose message may be a status
  // string or a backend dump. Sanitize it.
  if (!error.response) {
    const msg = error.message || '';
    if (msg.includes('timed out')) {
      return new Error('Request timed out. Please check your connection.');
    }
    if (msg === 'Network request failed' || msg.includes('TypeError') || !msg) {
      return new Error('Unable to connect. Please check your internet connection.');
    }
    // Extract an HTTP status if the message embeds one (e.g. "... status 400").
    const statusMatch = msg.match(/status (\d{3})/);
    const inferredStatus = statusMatch ? Number(statusMatch[1]) : undefined;
    // The message may be JSON — pull message/error out first.
    let candidate = msg;
    try {
      const parsed = JSON.parse(msg);
      candidate = parsed.message || parsed.error || msg;
    } catch {}
    return new Error(safeMessage(candidate, inferredStatus));
  }

  // Try to extract a candidate message from the response body, then sanitize it.
  const data = error.response.data;
  let candidate = '';
  if (typeof data === 'object' && data) {
    candidate = data.message || data.error || '';
  } else if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      candidate = parsed.message || parsed.error || '';
    } catch {
      candidate = data;
    }
  }

  return new Error(safeMessage(candidate, status));
}

export default apiClient;
