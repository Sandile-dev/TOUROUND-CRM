import apiClient, { handleApiError } from './client';

const paymentService = {
  createPayment: async (paymentData) => {
    try { const r = await apiClient.post('/payments', paymentData); return r.data; } catch (e) { throw handleApiError(e); }
  },
  getPaymentById: async (paymentId) => {
    try { const r = await apiClient.get(`/payments/${paymentId}`); return r.data; } catch (e) { throw handleApiError(e); }
  },
  getPaymentsByReference: async (bookingReference) => {
    try { const r = await apiClient.get(`/payments/reference/${bookingReference}`); return r.data; } catch (e) { throw handleApiError(e); }
  },
  updatePaymentStatus: async (transactionId, status) => {
    try { const r = await apiClient.put(`/payments/status?transactionId=${encodeURIComponent(transactionId)}&status=${encodeURIComponent(status)}`); return r.data; } catch (e) { throw handleApiError(e); }
  },
  getWalletBalance: async () => {
    try { const r = await apiClient.get('/v1/wallet'); return r.data; } catch (e) { throw handleApiError(e); }
  },
  getWalletTransactions: async () => {
    try { const r = await apiClient.get('/v1/wallet/transactions'); return r.data; } catch (e) { throw handleApiError(e); }
  },
  requestPayout: async (amount) => {
    try { const r = await apiClient.post(`/v1/wallet/payout?amount=${amount}`); return r.data; } catch (e) { throw handleApiError(e); }
  },
  recordCashPayment: async (data) => {
    try { const r = await apiClient.post('/payments/cash', data); return r.data; } catch (e) { throw handleApiError(e); }
  },
  getCommissionOwed: async () => {
    try { const r = await apiClient.get('/v1/wallet/commission-owed'); return r.data; } catch (e) { throw handleApiError(e); }
  },
  settleCommission: async (amount) => {
    try { const r = await apiClient.post(`/v1/wallet/settle-commission?amount=${amount}`); return r.data; } catch (e) { throw handleApiError(e); }
  },
};

export default paymentService;
