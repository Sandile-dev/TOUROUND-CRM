import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, FlatList, StyleSheet, Alert, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import businessService from '../api/businessService';
import AppIcon from '../components/AppIcon';
import { enrichReservationAmounts } from '../utils/enrichReservations';
import { resolveCategory, usesRoomBookings, usesTableReservations } from '../constants/attractions';

const PERIODS = ['all', 'week', 'month', 'quarter', 'year'];

export default function SalesScreen() {
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const attractionId = resolveCategory(user?.attraction);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('all');

  useEffect(() => {
    if (user?.id) loadSales();
  }, [user, period]);

  const loadSales = async () => {
    try {
      let reservations = [];
      if (usesRoomBookings(attractionId)) {
        const res = await businessService.getBookings(user.id);
        reservations = Array.isArray(res) ? res : res?.content || [];
      } else if (usesTableReservations(attractionId)) {
        const res = await businessService.getTableReservations(user.id);
        reservations = Array.isArray(res) ? res : res?.content || [];
      } else {
        const res = await businessService.getReservations(user.id);
        reservations = Array.isArray(res) ? res : res?.content || [];
      }

      // Add ticket sales
      try {
        const ticketsRes = await businessService.getTickets(user.id);
        const events = Array.isArray(ticketsRes) ? ticketsRes : ticketsRes?.content || [];
        events.forEach(event => {
          if (event.soldTickets > 0) {
            reservations.push({
              id: `ticket-${event.id}`,
              reference: `EVT-${event.id}`,
              customerName: 'Event Tickets',
              type: 'EVENT_TICKET',
              totalPrice: (event.ticketPrice || 0) * (event.soldTickets || 0),
              createdAt: event.createdAt,
              bookingStatus: 'CONFIRMED',
              reservationStatus: 'CONFIRMED',
            });
          }
        });
      } catch {}

      // Filter by period
      const now = new Date();
      const filtered = reservations.filter(item => {
        if (period === 'all') return true;
        const date = new Date(item.createdAt || item.checkInDate || item.reservationDate);
        const diff = now - date;
        const day = 1000 * 60 * 60 * 24;
        if (period === 'week') return diff <= day * 7;
        if (period === 'month') return diff <= day * 30;
        if (period === 'quarter') return diff <= day * 90;
        if (period === 'year') return diff <= day * 365;
        return true;
      });

      // Enrich reservation rows with customer details and slot prices.
      const type = usesRoomBookings(attractionId) ? 'rooms' : usesTableReservations(attractionId) ? 'tables' : 'slots';
      await enrichReservationAmounts(filtered, type);
      const profileCache = {};
      await Promise.all(filtered.map(async (item) => {
        if (item.type === 'EVENT_TICKET') return;
        const cid = item.customerId ?? item.customerUserId;
        if (cid == null) return;
        // Already has a usable name/email? skip.
        if (item.customerName || item.customerEmail) return;
        try {
          if (!profileCache[cid]) profileCache[cid] = await businessService.getCustomerProfile(cid);
          const p = profileCache[cid];
          if (p) {
            item.customerName = [p.name, p.surname].filter(Boolean).join(' ').trim() || p.fullName || '';
            item.customerEmail = p.email || '';
          }
        } catch {}
      }));

      setSales(filtered);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadSales(); };

  const getStatus = (item) => item.bookingStatus || item.reservationStatus || 'PENDING';

  const totalRevenue = sales
    .filter(s => { const st = getStatus(s); return st !== 'CANCELLED' && st !== 'REJECTED'; })
    .reduce((sum, s) => sum + (s.totalPrice || 0), 0);
  const confirmedCount = sales.filter(s => ['ACCEPTED', 'CONFIRMED', 'RESERVED', 'CHECKED_IN', 'CHECKED_OUT'].includes(getStatus(s))).length;
  const pendingCount = sales.filter(s => getStatus(s) === 'PENDING' || getStatus(s) === 'AWAITING_CONFIRMATION' || getStatus(s) === 'AWAITING_PAYMENT').length;

  const getStatusColor = (status) => {
    const map = { ACCEPTED: '#16a34a', CONFIRMED: '#16a34a', RESERVED: '#16a34a', PENDING: '#f59e0b', AWAITING_CONFIRMATION: '#f59e0b', AWAITING_PAYMENT: '#f59e0b', CANCELLED: '#dc2626', REJECTED: '#dc2626', CHECKED_IN: '#2563eb', CHECKED_OUT: '#6b7280' };
    return map[status] || '#6b7280';
  };

  const exportPDF = async () => {
    try {
      const rows = sales.map(s => `
        <tr>
          <td>${s.reference || s.id}</td>
          <td>${s.customerName || 'N/A'}</td>
          <td>R${s.totalPrice || 0}</td>
          <td>${getStatus(s)}</td>
        </tr>`).join('');

      const html = `
        <html><body>
          <h1>Sales Report - ${user?.name || 'Business'}</h1>
          <p>Period: ${period} | Total: R${totalRevenue.toLocaleString()}</p>
          <table border="1" cellpadding="8" cellspacing="0" style="width:100%;border-collapse:collapse;">
            <tr><th>Reference</th><th>Customer</th><th>Amount</th><th>Status</th></tr>
            ${rows}
          </table>
        </body></html>
      `;
      await Print.printAsync({ html });
    } catch (err) {
      Alert.alert('Error', 'Failed to generate PDF');
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.goBack()}>
          <AppIcon name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Sales</Text>
        </View>
        <TouchableOpacity style={[styles.exportBtn, { backgroundColor: colors.primary }]} onPress={exportPDF}>
          <AppIcon name="document-text-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.filterBtn, period === p && { backgroundColor: colors.primary }]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.filterText, period === p && { color: '#fff' }]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Revenue</Text>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>R{totalRevenue.toLocaleString()}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Confirmed</Text>
          <Text style={[styles.summaryValue, { color: '#16a34a' }]}>{confirmedCount}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Pending</Text>
          <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>{pendingCount}</Text>
        </View>
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Loading sales...</Text>
      ) : sales.length === 0 ? (
        <Text style={styles.emptyText}>No sales data for this period.</Text>
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => {
            const status = getStatus(item);
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.reference}>#{item.reference || item.id}</Text>
                  <View style={[styles.badge, { backgroundColor: getStatusColor(status) + '20' }]}>
                    <Text style={[styles.badgeText, { color: getStatusColor(status) }]}>{status}</Text>
                  </View>
                </View>
                <Text style={styles.cardDetail}>{item.customerName || 'Customer'}</Text>
                {item.customerEmail ? <Text style={styles.cardSubDetail}>{item.customerEmail}</Text> : null}
                <View style={styles.cardFooter}>
                  <Text style={styles.dateText}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                  </Text>
                  <Text style={styles.amount}>R{item.totalPrice || 0}</Text>
                </View>
              </View>
            );
          }}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f2ef', paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: '#fff', marginTop: -1 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  exportBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  exportBtnText: { fontSize: 16 },
  filterRow: { marginBottom: 16 },
  filterRowContent: { alignItems: 'center', paddingRight: 8 },
  filterBtn: { paddingHorizontal: 14, height: 34, justifyContent: 'center', borderRadius: 17, backgroundColor: '#fff', marginRight: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  filterText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' },
  summaryLabel: { fontSize: 11, color: '#6b7280' },
  summaryValue: { fontSize: 16, fontWeight: 'bold', marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reference: { fontSize: 13, fontWeight: '600', color: '#111827' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  cardDetail: { fontSize: 13, color: '#111827', fontWeight: '600', marginBottom: 2 },
  cardSubDetail: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontSize: 11, color: '#9ca3af' },
  amount: { fontSize: 15, fontWeight: 'bold', color: '#111827' },
  loadingText: { color: '#6b7280', textAlign: 'center', marginTop: 40 },
  emptyText: { color: '#9ca3af', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
