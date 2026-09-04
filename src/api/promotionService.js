import apiClient, { handleApiError } from './client';

const promotionService = {
  getPromotions: async (businessUserId) => {
    try { const r = await apiClient.get(`/promotions/business/${businessUserId}`); return r.data; } catch (e) { throw handleApiError(e); }
  },
  createPromotion: async (promotionData) => {
    try { const r = await apiClient.post('/promotions/new', promotionData); return r.data; } catch (e) { throw handleApiError(e); }
  },
  updatePromotion: async (promotionId, promotionData) => {
    try { const r = await apiClient.put(`/promotions/update/${promotionId}`, promotionData); return r.data; } catch (e) { throw handleApiError(e); }
  },
  deletePromotion: async (promotionId) => {
    try { await apiClient.delete(`/promotions/remove/${promotionId}`); } catch (e) { throw handleApiError(e); }
  },
  togglePromotion: async (promotionId) => {
    try { const r = await apiClient.patch(`/promotions/${promotionId}/toggle`); return r.data; } catch (e) { throw handleApiError(e); }
  },
};

export default promotionService;
