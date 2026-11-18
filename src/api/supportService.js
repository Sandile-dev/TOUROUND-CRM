import apiClient, { handleApiError } from './client';

// Enquiry types offered in the app. ASSUMPTION: the backend enum
// SupportEnquiryType is undocumented beyond COMPLAINT; ENQUIRY is assumed.
export const SUPPORT_TYPES = [
  { value: 'ENQUIRY', label: 'Enquiry' },
  { value: 'COMPLAINT', label: 'Complaint' },
];

const STATUS_LABELS = {
  PENDING: 'Pending',
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REJECTED: 'Rejected',
};

const titleCase = (v) =>
  String(v || '')
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

// Friendly label for any status/type value, including ones we don't know about.
export const statusLabel = (status) => STATUS_LABELS[String(status || '').toUpperCase()] || titleCase(status) || 'Pending';
export const typeLabel = (type) => SUPPORT_TYPES.find((t) => t.value === String(type || '').toUpperCase())?.label || titleCase(type) || 'Enquiry';

// Accepts a bare array or common wrappers ({content}, {data}, {enquiries}).
export const toList = (res) => {
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object') {
    for (const key of ['content', 'data', 'enquiries', 'items']) {
      if (Array.isArray(res[key])) return res[key];
    }
  }
  return [];
};

const supportService = {
  createEnquiry: async ({ subject, message, type }) => {
    try { const r = await apiClient.post('/support', { subject, message, type }); return r.data; } catch (e) { throw handleApiError(e); }
  },
  getMyEnquiries: async () => {
    try { const r = await apiClient.get('/support/my'); return toList(r.data); } catch (e) { throw handleApiError(e); }
  },
  getEnquiry: async (id) => {
    try { const r = await apiClient.get(`/support/${id}`); return r.data; } catch (e) { throw handleApiError(e); }
  },
};

export default supportService;
