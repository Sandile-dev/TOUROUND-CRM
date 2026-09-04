import apiClient, { handleApiError } from './client';

const staffService = {
  getStaffMembers: async (businessUserId) => {
    try { const r = await apiClient.get(`/staff/business/${businessUserId}`); return r.data; } catch (e) { throw handleApiError(e); }
  },
  addStaffMember: async (staffData) => {
    try { const r = await apiClient.post('/staff', staffData); return r.data; } catch (e) { throw handleApiError(e); }
  },
  updateStaffMember: async (staffId, staffData) => {
    try { const r = await apiClient.put(`/staff/${staffId}`, staffData); return r.data; } catch (e) { throw handleApiError(e); }
  },
  removeStaffMember: async (staffId) => {
    try { const r = await apiClient.delete(`/staff/${staffId}`); return r.data; } catch (e) { throw handleApiError(e); }
  },
};

export default staffService;
