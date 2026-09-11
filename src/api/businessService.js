import apiClient, { handleApiError } from './client';
import storage from '../utils/storage';
import env from '../config/env';
import authService from './authService';
import { appendFileList, sendFormData } from '../utils/fileUpload';

// True if an error looks like an auth failure (401/403).
function isAuthError(error) {
  const msg = String(error?.message || '');
  return msg.includes('session has expired') || msg.includes('401') || msg.includes('403');
}

// Helper: Build multipart request with JSON part (works with Spring Boot @RequestPart)
async function sendMultipart(method, url, jsonFieldName, jsonData, files = {}) {
  const token = await storage.getItem('crm_token');

  const hasFiles = Object.values(files).some(arr => Array.isArray(arr) && arr.length > 0);

  if (hasFiles) {
    const buildFormData = async () => {
      const formData = new FormData();
      formData.append(jsonFieldName, JSON.stringify(jsonData));
      for (const [fieldName, fileList] of Object.entries(files)) {
        const isVideo = fieldName === 'videos' || fieldName === 'video';
        await appendFileList(formData, fieldName, fileList, { isVideo });
      }
      return formData;
    };

    // Uses XHR on native (RN FormData supports { uri, type, name }) and fetch on
    // web (Blob parts). The Expo winter fetch does NOT support RN file parts.
    try {
      return await sendFormData(method, `${env.apiBaseUrl}${url}`, await buildFormData(), { token });
    } catch (error) {
      // On auth failure, refresh the token once and retry.
      if (isAuthError(error)) {
        const newToken = await authService.refreshToken();
        if (newToken) {
          return await sendFormData(method, `${env.apiBaseUrl}${url}`, await buildFormData(), { token: newToken });
        }
      }
      throw error;
    }
  }

  // No files — use manual boundary approach (text-only multipart)
  const boundary = '----FormBoundary' + Math.random().toString(36).substr(2);
  let body = '';

  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="${jsonFieldName}"\r\n`;
  body += `Content-Type: application/json\r\n\r\n`;
  body += JSON.stringify(jsonData) + '\r\n';
  body += `--${boundary}--\r\n`;

  const headers = { 'Content-Type': `multipart/form-data; boundary=${boundary}` };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${env.apiBaseUrl}${url}`, { method, headers, body });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || `Request failed with status ${response.status}`);
  }

  const ct = response.headers.get('content-type') || '';
  return ct.includes('application/json') ? await response.json() : await response.text();
}

const businessService = {
  // Profile
  getProfile: async (businessUserId) => {
    try {
      const response = await apiClient.get(`/business/profile/${businessUserId}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  deleteAccount: async () => {
    try {
      await apiClient.patch('/business/profile/toggle-status');
    } catch (error) {
      throw handleApiError(error);
    }
  },

  updateProfile: async (profileData) => {
    try { return await sendMultipart('PUT', '/business/profile', 'profile', profileData); }
    catch (error) { throw handleApiError(error); }
  },

  uploadLogo: async (formData) => {
    try {
      const token = await storage.getItem('crm_token');
      return await sendFormData('POST', `${env.apiBaseUrl}/business/profile/logo`, formData, { token });
    } catch (error) { throw handleApiError(error); }
  },

  uploadCover: async (formData) => {
    try {
      const token = await storage.getItem('crm_token');
      return await sendFormData('POST', `${env.apiBaseUrl}/business/profile/cover`, formData, { token });
    } catch (error) { throw handleApiError(error); }
  },

  // Posts
  getPosts: async (businessUserId) => {
    try {
      const response = await apiClient.get(`/posts/user/${businessUserId}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  createPost: async (postData, images = [], videos = []) => {
    try { return await sendMultipart('POST', '/posts/new', 'post', postData, { images, videos }); }
    catch (error) { throw handleApiError(error); }
  },

  deletePost: async (postId) => {
    try {
      await apiClient.delete(`/posts/remove/${postId}`);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Services
  getRooms: async (businessUserId) => {
    try {
      const response = await apiClient.get(`/accommodation/rooms/business/${businessUserId}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  getRoomById: async (roomId) => {
    try {
      const response = await apiClient.get(`/accommodation/rooms/${roomId}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  createRoom: async (roomData, images = [], videos = []) => {
    try { return await sendMultipart('POST', '/accommodation/rooms/add', 'room', roomData, { images, video: videos }); }
    catch (error) { throw handleApiError(error); }
  },

  updateRoom: async (roomData, images = []) => {
    try { return await sendMultipart('PUT', '/accommodation/rooms/update', 'room', roomData, { images }); }
    catch (error) { throw handleApiError(error); }
  },

  deleteRoom: async (roomId) => {
    try { await apiClient.delete(`/accommodation/rooms/remove/${roomId}`); } catch (error) { throw handleApiError(error); }
  },

  getTables: async (businessUserId) => {
    try { const r = await apiClient.get(`/business-tables/business/${businessUserId}`); return r.data; } catch (error) { throw handleApiError(error); }
  },

  createTable: async (tableData, images = [], videos = []) => {
    try { return await sendMultipart('POST', '/business-tables/new', 'table', tableData, { images, videos }); }
    catch (error) { throw handleApiError(error); }
  },

  updateTable: async (tableId, tableData) => {
    try { return await sendMultipart('PUT', `/business-tables/update/${tableId}`, 'table', tableData); }
    catch (error) { throw handleApiError(error); }
  },

  deleteTable: async (tableId) => {
    try { await apiClient.delete(`/business-tables/remove/${tableId}`); } catch (error) { throw handleApiError(error); }
  },

  getSlots: async (businessUserId) => {
    try { const r = await apiClient.get(`/business-slots/business/${businessUserId}`); return r.data; } catch (error) { throw handleApiError(error); }
  },

  createSlot: async (slotData, images = [], videos = []) => {
    try { return await sendMultipart('POST', '/business-slots/new', 'slot', slotData, { images, videos }); }
    catch (error) { throw handleApiError(error); }
  },

  updateSlot: async (slotId, slotData) => {
    try { return await sendMultipart('PUT', `/business-slots/update/${slotId}`, 'slot', slotData); }
    catch (error) { throw handleApiError(error); }
  },

  deleteSlot: async (slotId) => {
    try { await apiClient.delete(`/business-slots/remove/${slotId}`); } catch (error) { throw handleApiError(error); }
  },

  // Reservations & Bookings
  getReservations: async (businessUserId) => {
    try { const r = await apiClient.get(`/reservations/business/${businessUserId}`); return r.data; } catch (error) { throw handleApiError(error); }
  },

  getTableReservations: async (businessUserId) => {
    try { const r = await apiClient.get(`/table-reservations/business/${businessUserId}`); return r.data; } catch (error) { throw handleApiError(error); }
  },

  acceptReservation: async (reservationId) => {
    try { const r = await apiClient.put(`/reservations/update/${reservationId}`, { reservationStatus: 'ACCEPTED' }); return r.data; } catch (error) { throw handleApiError(error); }
  },

  rejectReservation: async (reservationId, reason) => {
    try { const r = await apiClient.put(`/reservations/update/${reservationId}`, { reservationStatus: 'REJECTED', reason }); return r.data; } catch (error) { throw handleApiError(error); }
  },

  getReservationByReference: async (reference) => {
    try { const r = await apiClient.get(`/reservations/reference/${reference}`); return r.data; } catch (error) { throw handleApiError(error); }
  },

  getReservationById: async (reservationId) => {
    try { const r = await apiClient.get(`/reservations/${reservationId}`); return r.data; } catch (error) { throw handleApiError(error); }
  },

  checkinReservation: async (reservationId) => {
    try { const r = await apiClient.put(`/reservations/update/${reservationId}`, { reservationStatus: 'CHECKED_IN' }); return r.data; } catch (error) { throw handleApiError(error); }
  },

  checkoutReservation: async (reservationId) => {
    try { const r = await apiClient.put(`/reservations/update/${reservationId}`, { reservationStatus: 'CHECKED_OUT' }); return r.data; } catch (error) { throw handleApiError(error); }
  },

  markReservationPaid: async (reservationId) => {
    try { const r = await apiClient.put(`/reservations/update/${reservationId}`, { paymentStatus: 'COMPLETED' }); return r.data; } catch (error) { throw handleApiError(error); }
  },

  acceptTableReservation: async (reservationId) => {
    try { const r = await apiClient.put(`/table-reservations/update/${reservationId}`, { reservationStatus: 'ACCEPTED' }); return r.data; } catch (error) { throw handleApiError(error); }
  },

  rejectTableReservation: async (reservationId, reason) => {
    try { const r = await apiClient.put(`/table-reservations/update/${reservationId}`, { reservationStatus: 'REJECTED', reason }); return r.data; } catch (error) { throw handleApiError(error); }
  },

  getTableReservationByReference: async (reference) => {
    try { const r = await apiClient.get(`/table-reservations/reference/${reference}`); return r.data; } catch (error) { throw handleApiError(error); }
  },

  getTableReservationById: async (reservationId) => {
    try { const r = await apiClient.get(`/table-reservations/${reservationId}`); return r.data; } catch (error) { throw handleApiError(error); }
  },

  checkinTableReservation: async (reservationId) => {
    try { const r = await apiClient.put(`/table-reservations/update/${reservationId}`, { reservationStatus: 'CHECKED_IN' }); return r.data; } catch (error) { throw handleApiError(error); }
  },

  checkoutTableReservation: async (reservationId) => {
    try { const r = await apiClient.put(`/table-reservations/update/${reservationId}`, { reservationStatus: 'CHECKED_OUT' }); return r.data; } catch (error) { throw handleApiError(error); }
  },

  markTableReservationPaid: async (reservationId) => {
    try { const r = await apiClient.put(`/table-reservations/update/${reservationId}`, { paymentStatus: 'COMPLETED' }); return r.data; } catch (error) { throw handleApiError(error); }
  },

  getBookings: async (businessUserId) => {
    try { const r = await apiClient.get(`/accommodation/bookings/business/${businessUserId}`); return r.data; } catch (error) { throw handleApiError(error); }
  },

  getBookingByReference: async (reference) => {
    try { const r = await apiClient.get(`/accommodation/bookings/reference/${reference}`); return r.data; } catch (error) { throw handleApiError(error); }
  },

  getBookingById: async (bookingId) => {
    try { const r = await apiClient.get(`/accommodation/bookings/${bookingId}`); return r.data; } catch (error) { throw handleApiError(error); }
  },

  updateBooking: async (bookingId, data) => {
    try { const r = await apiClient.put(`/accommodation/bookings/update/${bookingId}`, data); return r.data; } catch (error) { throw handleApiError(error); }
  },

  // Reviews
  getReviews: async (businessUserId) => {
    try { const r = await apiClient.get(`/reviews/business/${businessUserId}`); return r.data; } catch (error) { throw handleApiError(error); }
  },

  // Reply to a customer review.
  // NOTE: endpoint/field names assumed by convention — confirm against the API.
  replyToReview: async (reviewId, reply) => {
    try { const r = await apiClient.post(`/reviews/${reviewId}/reply`, { reply }); return r.data; } catch (error) { throw handleApiError(error); }
  },

  // Messages
  getMessages: async (businessUserId) => {
    try { const r = await apiClient.get(`/messages/business/${businessUserId}`); return r.data; } catch (error) { throw handleApiError(error); }
  },

  getConversation: async (customerUserId, businessUserId) => {
    try { const r = await apiClient.get('/messages/conversation', { params: { customerUserId, businessUserId } }); return r.data; } catch (error) { throw handleApiError(error); }
  },

  sendMessage: async (data) => {
    try { const r = await apiClient.post('/messages/new', data); return r.data; } catch (error) { throw handleApiError(error); }
  },

  markMessageRead: async (messageId) => {
    try { const r = await apiClient.put(`/messages/${messageId}/read`); return r.data; } catch (error) { throw handleApiError(error); }
  },

  // Notifications
  getNotifications: async (businessUserId) => {
    try { const r = await apiClient.get(`/notifications/business/${businessUserId}`); return r.data; } catch (error) { throw handleApiError(error); }
  },

  markNotificationRead: async (notificationId) => {
    try { const r = await apiClient.put(`/notifications/${notificationId}/read`); return r.data; } catch (error) { throw handleApiError(error); }
  },

  // Events & Tickets
  getTickets: async (businessUserId) => {
    try { const r = await apiClient.get(`/events/business/${businessUserId}`); return r.data; } catch (error) { throw handleApiError(error); }
  },

  getEvent: async (eventId) => {
    try { const r = await apiClient.get(`/events/${eventId}`); return r.data; } catch (error) { throw handleApiError(error); }
  },

  createEvent: async (eventData, images = [], videos = []) => {
    try { return await sendMultipart('POST', '/events/new', 'event', eventData, { images, video: videos }); }
    catch (error) { throw handleApiError(error); }
  },

  updateEvent: async (eventId, eventData, images = [], videos = []) => {
    try { return await sendMultipart('PUT', `/events/update/${eventId}`, 'event', eventData, { images, video: videos }); }
    catch (error) { throw handleApiError(error); }
  },

  deleteEvent: async (eventId) => {
    try { await apiClient.delete(`/events/remove/${eventId}`); } catch (error) { throw handleApiError(error); }
  },

  addTicketCategory: async (categoryData) => {
    try { const r = await apiClient.post('/tickets/category', categoryData); return r.data; } catch (error) { throw handleApiError(error); }
  },

  verifyTicket: async (ticketCode) => {
    try { const r = await apiClient.post(`/tickets/verify/${ticketCode}`); return r.data; } catch (error) { throw handleApiError(error); }
  },

  // Customer
  getCustomerProfile: async (customerId) => {
    try { const r = await apiClient.get(`/customer/profile/${customerId}`); return r.data; } catch (error) { throw handleApiError(error); }
  },

  // Global search. Returns { businessUsers, customers, rooms, businessTables, businessSlots }.
  search: async (query) => {
    try { const r = await apiClient.get('/search', { params: { query } }); return r.data; } catch (error) { throw handleApiError(error); }
  },

  // Attractions
  // Returns ALL attractions as a flat array, paging through the API's paginated
  // response ({ content, pageNo, totalPages, last }) so nothing is cut off by
  // the default page size.
  getAttractions: async () => {
    try {
      const pageSize = 100;
      let pageNo = 0;
      const all = [];
      // Loop until the API reports the last page (or a page comes back empty).
      // Capped at 50 iterations as a safety net against a misbehaving `last`.
      for (let i = 0; i < 50; i++) {
        const r = await apiClient.get('/attractions/all', { params: { pageNo, pageSize } });
        const data = r.data;
        const content = Array.isArray(data) ? data : (data?.content || []);
        all.push(...content);

        // Non-paginated response, empty page, or last page -> stop.
        const isLast = Array.isArray(data) || data?.last === true || content.length === 0;
        if (isLast) break;
        pageNo += 1;
      }
      return all;
    } catch (error) { throw handleApiError(error); }
  },

  // Followers
  getFollowers: async (businessUserId) => {
    try { const r = await apiClient.get(`/follow/following/${businessUserId}`); return r.data; } catch (error) { throw handleApiError(error); }
  },
};

export default businessService;
