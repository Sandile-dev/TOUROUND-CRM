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
  // Admin: mark a pending payout as completed (curl 18.4).
  completePayout: async (reference) => {
    try { const r = await apiClient.post(`/v1/wallet/admin/payout/complete?reference=${encodeURIComponent(reference)}`); return r.data; } catch (e) { throw handleApiError(e); }
  },
  // Admin: list all pending payouts across the platform (curl 18.5).
  getPendingPayouts: async () => {
    try { const r = await apiClient.get('/v1/wallet/admin/payout/pending'); return r.data; } catch (e) { throw handleApiError(e); }
  },
  // Records a cash payment. Per the contract, cash is a payment with method
  // CASH and no explicit status — the backend marks it COMPLETED immediately.
  recordCashPayment: async ({ amount, bookingReference }) => {
    try {
      const r = await apiClient.post('/payments', {
        amount,
        bookingReference,
        paymentMethod: 'CASH',
      });
      return r.data;
    } catch (e) { throw handleApiError(e); }
  },

  // Initiates an Ozow payment. The response includes an `approvalLink` that
  // should be shared with the customer to complete payment. `isMobile: true`
  // tells Ozow to redirect to the customer app deep link (tourite://payment/success)
  // on success, since the payer opens the shared link on their mobile device.
  createOzowPayment: async ({ amount, bookingReference }) => {
    try {
      const r = await apiClient.post('/payments', {
        amount,
        bookingReference,
        paymentMethod: 'OZOW',
        paymentStatus: 'PENDING',
        isMobile: true,
      });
      return r.data;
    } catch (e) { throw handleApiError(e); }
  },
  getCommissionOwed: async () => {
    try { const r = await apiClient.get('/v1/wallet/commission-owed'); return r.data; } catch (e) { throw handleApiError(e); }
  },
  // Business payout bank details (BusinessController /business/profile/payment-details).
  // GET returns the BusinessUserDTO; PUT takes a partial JSON BusinessUserDTO and only
  // updates the provided bank fields: bankName, accountHolderName, accountNumber, branchCode.
  getPaymentDetails: async () => {
    try { const r = await apiClient.get('/business/profile/payment-details'); return r.data; } catch (e) { throw handleApiError(e); }
  },
  updatePaymentDetails: async ({ bankName, accountHolderName, accountNumber, branchCode }) => {
    try {
      const r = await apiClient.put('/business/profile/payment-details', { bankName, accountHolderName, accountNumber, branchCode });
      return r.data;
    } catch (e) { throw handleApiError(e); }
  },
  settleCommission: async (amount) => {
    try { const r = await apiClient.post(`/v1/wallet/settle-commission?amount=${amount}`); return r.data; } catch (e) { throw handleApiError(e); }
  },
};

export default paymentService;
