import storage from '../utils/storage';
import env from '../config/env';

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;
const TIMEOUT = 30000;

/**
 * Lightweight API client using fetch (no axios dependency).
 * Handles JWT auth, retries, and error normalization.
 */
class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async request(method, url, data, options = {}) {
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

        // Handle auth errors
        if (response.status === 401 || response.status === 403) {
          if (!url.includes('/auth/')) {
            await storage.deleteItem('crm_token');
            await storage.deleteItem('crm_user');
          }
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

export function handleApiError(error) {
  if (error.name === 'AbortError') {
    return new Error('Request timed out. Please check your connection.');
  }
  // If error already has a useful message, try to parse JSON from it
  if (error.message) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed.message) return new Error(parsed.message);
    } catch {}
    // If it's not JSON and not a generic network error, use it as-is
    if (error.message !== 'Network request failed' && !error.message.includes('TypeError')) {
      return error;
    }
  }
  if (!error.response) {
    return new Error('Unable to connect. Please check your internet connection.');
  }
  const data = error.response?.data;
  if (typeof data === 'object' && data?.message) return new Error(data.message);
  if (typeof data === 'string' && data.length < 200) {
    try {
      const parsed = JSON.parse(data);
      if (parsed.message) return new Error(parsed.message);
    } catch {}
    return new Error(data);
  }
  if (data?.error) return new Error(data.error);
  return new Error(error.message || 'An unexpected error occurred');
}

export default apiClient;
