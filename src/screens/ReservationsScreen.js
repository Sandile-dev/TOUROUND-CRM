import React, { useContext, useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, RefreshControl, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TopNavbar from '../components/TopNavbar';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import businessService from '../api/businessService';
import useRefreshOnFocus from '../hooks/useRefreshOnFocus';
import { resolveCategory, usesRoomBookings, usesTableReservations } from '../constants/attractions';

export default function ReservationsScreen() {
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const attractionId = resolveCategory(user?.attraction);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchRef, setSearchRef] = useState('');
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detailModal, setDetailModal] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { if (user?.id) loadData(); }, [user]);

  const loadData = async () => {
    try {
      let res;
      if (usesRoomBookings(attractionId)) res = await businessService.getBookings(user.id);
      else if (usesTableReservations(attractionId)) res = await businessService.getTableReservations(user.id);
      else res = await businessService.getReservations(user.id);
      setItems(Array.isArray(res) ? res : res?.content || []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };

  const onRefresh = () => { setRefreshing(true); loadData(); };

  useRefreshOnFocus(useCallback(() => { loadData(); }, [user]));

  const openDetail = async (item) => {
    // Show what we already have immediately, then enrich with a full fetch.
    setDetailData(item);
    setDetailModal(true);
    setDetailLoading(true);
    try {
      // Fetch the full reservation and the customer profile in parallel.
      const reservationCall = usesRoomBookings(attractionId)
        ? businessService.getBookingById(item.id)
        : usesTableReservations(attractionId)
          ? businessService.getTableReservationById(item.id)
          : businessService.getReservationById(item.id);

      const customerId = item.customerId ?? item.customerUserId;
      const customerCall = customerId != null
        ? businessService.getCustomerProfile(customerId)
        : Promise.resolve(null);

      const [reservationRes, customerRes] = await Promise.allSettled([reservationCall, customerCall]);

      let merged = { ...item };
      if (reservationRes.status === 'fulfilled' && reservationRes.value) {
        merged = { ...merged, ...reservationRes.value };
      }
      if (customerRes.status === 'fulfilled' && customerRes.value) {
        const c = customerRes.value;
        // Map the customer profile onto the field names the detail modal reads.
        merged.customerName = merged.customerName
          || c.name
          || [c.firstName, c.lastName].filter(Boolean).join(' ').trim()
          || c.fullName
          || merged.customerName;
        merged.customerEmail = merged.customerEmail || c.email;
        merged.customerPhone = merged.customerPhone || c.phoneNumber || c.contactNumber || c.phone;
      }
      setDetailData(merged);
    } catch {
      // Keep the list item's data if enrichment fails.
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchRef.trim()) { loadData(); return; }
    try {
      let res;
      if (usesRoomBookings(attractionId)) res = await businessService.getBookingByReference(searchRef.trim());
      else if (usesTableReservations(attractionId)) res = await businessService.getTableReservationByReference(searchRef.trim());
      else res = await businessService.getReservationByReference(searchRef.trim());
      setItems(res ? [res] : []);
    } catch { Alert.alert('Not Found', 'No reservation with that reference.'); }
  };

  const handleAccept = async (id) => {
    try {
      if (usesRoomBookings(attractionId)) await businessService.updateBooking(id, { bookingStatus: 'BOOKED' });
      else if (usesTableReservations(attractionId)) await businessService.acceptTableReservation(id);
      else await businessService.acceptReservation(id);
      loadData();
    } catch (err) { Alert.alert('Error', err.message); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    try {
      if (usesRoomBookings(attractionId)) await businessService.updateBooking(selectedId, { bookingStatus: 'CANCELLED', reason: rejectReason });
      else if (usesTableReservations(attractionId)) await businessService.rejectTableReservation(selectedId, rejectReason);
      else await businessService.rejectReservation(selectedId, rejectReason);
      setRejectModal(false); loadData();
    } catch (err) { Alert.alert('Error', err.message); }
  };

  const handleCheckin = async (id) => {
    try {
      if (usesRoomBookings(attractionId)) await businessService.updateBooking(id, { bookingStatus: 'CHECKED_IN' });
      else if (usesTableReservations(attractionId)) await businessService.checkinTableReservation(id);
      else await businessService.checkinReservation(id);
      loadData();
    } catch (err) { Alert.alert('Error', err.message); }
  };

  const handleCheckout = async (item) => {
    const id = typeof item === 'object' ? item.id : item;
    // For services without upfront payment, the amount is collected on-site.
    // If payment is still PENDING at check-out, mark it PAID.
    const currentPayment = (typeof item === 'object' ? item.paymentStatus : null) || '';
    const shouldMarkPaid = currentPayment.toUpperCase() !== 'PAID';
    try {
      if (usesRoomBookings(attractionId)) {
        await businessService.updateBooking(id, {
          bookingStatus: 'CHECKED_OUT',
          ...(shouldMarkPaid ? { paymentStatus: 'PAID' } : {}),
        });
      } else if (usesTableReservations(attractionId)) {
        await businessService.checkoutTableReservation(id, shouldMarkPaid);
      } else {
        await businessService.checkoutReservation(id, shouldMarkPaid);
      }
      loadData();
    } catch (err) { Alert.alert('Error', err.message); }
  };

  const getStatus = (item) => item.bookingStatus || item.reservationStatus || 'PENDING';
  const getStatusStyle = (status) => {
    if (status === 'ACCEPTED' || status === 'CONFIRMED' || status === 'RESERVED' || status === 'BOOKED') return { bg: '#dcfce7', text: '#166534' };
    if (status === 'CHECKED_IN') return { bg: '#dbeafe', text: '#1e40af' };
    if (status === 'CHECKED_OUT') return { bg: '#f3f4f6', text: '#374151' };
    if (status === 'CANCELLED' || status === 'REJECTED') return { bg: '#fef2f2', text: '#991b1b' };
    return { bg: '#fef9c3', text: '#854d0e' };
  };

  const renderItem = ({ item }) => {
    const status = getStatus(item);
    const statusStyle = getStatusStyle(status);
    const ref = item.bookingReference || item.reservationReference || `#${item.id}`;
    const date = item.checkInDate || item.date || item.createdAt;

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => openDetail(item)}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.refText}>{ref}</Text>
            <Text style={styles.dateText}>{date ? new Date(date).toLocaleDateString() : '—'}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.badgeText, { color: statusStyle.text }]}>{status}</Text>
          </View>
        </View>

        <View style={styles.cardMid}>
          <Text style={styles.detailText}>Amount: <Text style={styles.amountText}>R{item.totalPrice || 0}</Text></Text>
          {item.numberOfGuests && <Text style={styles.detailText}>Guests: {item.numberOfGuests}</Text>}
        </View>

        {/* Actions */}
        {(status === 'PENDING' || status === 'AWAITING_CONFIRMATION' || status === 'AWAITING_PAYMENT') && (
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#16a34a' }]} onPress={() => handleAccept(item.id)}>
              <Text style={styles.actionText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#dc2626' }]} onPress={() => { setSelectedId(item.id); setRejectReason(''); setRejectModal(true); }}>
              <Text style={styles.actionText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
        {(status === 'ACCEPTED' || status === 'CONFIRMED' || status === 'RESERVED' || status === 'BOOKED') && (
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => handleCheckin(item.id)}>
              <Text style={styles.actionText}>Check In</Text>
            </TouchableOpacity>
          </View>
        )}
        {status === 'CHECKED_IN' && (
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#374151' }]} onPress={() => handleCheckout(item)}>
              <Text style={styles.actionText}>Check Out</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <TopNavbar />

      {/* Search bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by reference..."
          placeholderTextColor="#9ca3af"
          value={searchRef}
          onChangeText={setSearchRef}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={[styles.searchBtn, { backgroundColor: colors.primary }]} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Loading reservations...</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No reservations found.</Text>}
        />
      )}

      {/* Detail Modal */}
      <Modal visible={detailModal} transparent animationType="slide" onRequestClose={() => setDetailModal(false)}>
        <View style={styles.detailOverlay}>
          <View style={[styles.detailSheet, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Reservation Details</Text>
              <TouchableOpacity onPress={() => setDetailModal(false)}>
                <Text style={styles.detailClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {detailLoading && !detailData ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ paddingVertical: 30 }} />
            ) : detailData ? (
              <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                {(() => {
                  const d = detailData;
                  const ref = d.bookingReference || d.reservationReference || `#${d.id}`;
                  const st = getStatus(d);
                  const stStyle = getStatusStyle(st);
                  // Build rows from fields the reservation actually returns.
                  // Only include a row when the value is present.
                  const customerName = d.customerName || d.guestName || d.customerFullName;
                  const customerEmail = d.customerEmail || d.email;
                  const customerPhone = d.customerPhone || d.contactNumber;
                  const rows = [
                    ['Reference', ref],
                    ['Status', st],
                    d.paymentStatus ? ['Payment', d.paymentStatus] : null,
                    customerName ? ['Customer', customerName] : null,
                    customerEmail ? ['Email', customerEmail] : null,
                    customerPhone ? ['Phone', customerPhone] : null,
                    (customerName || customerEmail || customerPhone) ? null
                      : (d.customerId != null ? ['Customer ID', String(d.customerId)] : null),
                    d.numberOfGuests != null ? ['Guests', String(d.numberOfGuests)] : null,
                    d.date ? ['Date', new Date(d.date).toLocaleDateString()] : null,
                    d.time ? ['Time', d.time] : null,
                    d.checkInDate ? ['Check-in', new Date(d.checkInDate).toLocaleDateString()] : null,
                    d.checkOutDate ? ['Check-out', new Date(d.checkOutDate).toLocaleDateString()] : null,
                    ['Amount', `R${d.totalPrice || 0}`],
                    d.createdAt ? ['Requested', new Date(d.createdAt).toLocaleString()] : null,
                  ].filter(Boolean);
                  return (
                    <>
                      <View style={[styles.detailBadge, { backgroundColor: stStyle.bg, alignSelf: 'flex-start' }]}>
                        <Text style={[styles.badgeText, { color: stStyle.text }]}>{st}</Text>
                      </View>
                      {rows.map(([label, value]) => (
                        <View key={label} style={styles.detailRow}>
                          <Text style={styles.detailLabel}>{label}</Text>
                          <Text style={styles.detailValue}>{value}</Text>
                        </View>
                      ))}
                      {detailLoading && <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 10 }} />}
                    </>
                  );
                })()}
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>No details available.</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Reject Modal */}
      <Modal visible={rejectModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Reservation</Text>
            <Text style={styles.modalDesc}>Please provide a reason</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Reason..."
              placeholderTextColor="#9ca3af"
              multiline
              value={rejectReason}
              onChangeText={setRejectReason}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setRejectModal(false)}>
                <Text style={{ color: '#374151', fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirm, { backgroundColor: '#dc2626' }]} onPress={handleReject}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f2ef' },
  searchRow: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', gap: 8 },
  searchInput: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#111827' },
  searchBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  card: { backgroundColor: '#fff', marginBottom: 1, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  refText: { fontSize: 14, fontWeight: '600', color: '#111827' },
  dateText: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  cardMid: { flexDirection: 'row', gap: 16, marginBottom: 6 },
  detailText: { fontSize: 13, color: '#6b7280' },
  amountText: { fontWeight: '700', color: '#111827' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  loadingText: { color: '#6b7280', textAlign: 'center', marginTop: 40 },
  emptyText: { color: '#9ca3af', textAlign: 'center', marginTop: 40, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  modalDesc: { fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 12 },
  modalInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top', fontSize: 14, color: '#111827' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f3f4f6' },
  modalConfirm: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  // Detail modal
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  detailSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, maxHeight: '85%' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  detailTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  detailClose: { fontSize: 22, color: '#6b7280', padding: 4 },
  detailBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 12 },
  detailLabel: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  detailValue: { fontSize: 14, color: '#111827', fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});
