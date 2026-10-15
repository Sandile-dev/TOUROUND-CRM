import apiClient, { handleApiError } from './client';

// Staff is managed under the BusinessController at /business/staff.
// The backend keys the current business off the auth token, so no businessUserId
// is needed in the path.
const staffService = {
  getStaffMembers: async () => {
    try { const r = await apiClient.get('/business/staff'); return r.data; } catch (e) { throw handleApiError(e); }
  },
  addStaffMember: async (staffData) => {
    try { const r = await apiClient.post('/business/staff', staffData); return r.data; } catch (e) { throw handleApiError(e); }
  },
  updateStaffMember: async (staffId, staffData) => {
    try { const r = await apiClient.put(`/business/staff/${staffId}`, staffData); return r.data; } catch (e) { throw handleApiError(e); }
  },
  removeStaffMember: async (staffId) => {
    try { const r = await apiClient.delete(`/business/staff/${staffId}`); return r.data; } catch (e) { throw handleApiError(e); }
  },
};

export default staffService;
