import apiClient, { handleApiError } from './client';

// Staff management — uses the new unified /api/staff endpoints (curls 19-23).
// GET /api/staff          — business users get their own staff; admins get all.
// GET /api/staff/business/{id} — business-specific staff list.
// POST /api/staff         — add staff (linked automatically to the logged-in business).
// PUT /api/staff/update/{id}  — update a staff member.
// DELETE /api/staff/remove/{id} — remove a staff member.
const staffService = {
  // Curl 22: returns only staff linked to the calling business (no admin staff).
  getStaffMembers: async () => {
    try { const r = await apiClient.get('/staff'); return r.data; } catch (e) { throw handleApiError(e); }
  },

  // Curl 23: explicit business-scoped staff list.
  getStaffByBusiness: async (businessUserId) => {
    try { const r = await apiClient.get(`/staff/business/${businessUserId}`); return r.data; } catch (e) { throw handleApiError(e); }
  },

  // Curl 19: create staff — auto-linked to the logged-in business.
  addStaffMember: async (staffData) => {
    try { const r = await apiClient.post('/staff', staffData); return r.data; } catch (e) { throw handleApiError(e); }
  },

  // Curl 20: update a staff member.
  updateStaffMember: async (staffId, staffData) => {
    try { const r = await apiClient.put(`/staff/update/${staffId}`, staffData); return r.data; } catch (e) { throw handleApiError(e); }
  },

  // Curl 21: remove a staff member.
  removeStaffMember: async (staffId) => {
    try { const r = await apiClient.delete(`/staff/remove/${staffId}`); return r.data; } catch (e) { throw handleApiError(e); }
  },
};

export default staffService;
