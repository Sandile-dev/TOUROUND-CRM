import React, { useContext, useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Dimensions, TouchableOpacity } from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import TopNavbar from '../components/TopNavbar';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import businessService from '../api/businessService';
import useRefreshOnFocus from '../hooks/useRefreshOnFocus';
import { resolveCategory, usesRoomBookings, usesTableReservations } from '../constants/attractions';

const screenWidth = Dimensions.get('window').width;

const PERIOD_OPTIONS = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' },
];

function groupByDate(items, dateField, period) {
  const now = new Date();
  const start = new Date();
  if (period === 'week') start.setDate(now.getDate() - 7);
  else if (period === 'month') start.setDate(now.getDate() - 30);
  else start.setFullYear(now.getFullYear() - 1);

  const filtered = items.filter((item) => {
    const d = new Date(item[dateField]);
    return d >= start;
  });

  const groups = {};
  filtered.forEach((item) => {
    const d = new Date(item[dateField]);
    let key;
    if (period === 'week') key = d.toLocaleDateString('en-US', { weekday: 'short' });
    else if (period === 'month') key = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    else key = d.toLocaleDateString('en-US', { month: 'short' });
    groups[key] = (groups[key] || 0) + 1;
  });
  return groups;
}

function groupRevenueByDate(items, dateField, amountField, period) {
  const now = new Date();
  const start = new Date();
  if (period === 'week') start.setDate(now.getDate() - 7);
  else if (period === 'month') start.setDate(now.getDate() - 30);
  else start.setFullYear(now.getFullYear() - 1);

  const filtered = items.filter((item) => {
    const d = new Date(item[dateField]);
    return d >= start;
  });

  const groups = {};
  filtered.forEach((item) => {
    const d = new Date(item[dateField]);
    let key;
    if (period === 'week') key = d.toLocaleDateString('en-US', { weekday: 'short' });
    else if (period === 'month') key = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    else key = d.toLocaleDateString('en-US', { month: 'short' });
    groups[key] = (groups[key] || 0) + (item[amountField] || 0);
  });
  return groups;
}

export default function DashboardScreen() {
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const attractionId = resolveCategory(user?.attraction);
  const [stats, setStats] = useState({ totalSales: 0, totalCustomers: 0, totalReservations: 0, totalLoss: 0 });
  const [rawReservations, setRawReservations] = useState([]);
  const [statusCounts, setStatusCounts] = useState({ confirmed: 0, pending: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('month');

  useEffect(() => { if (user?.id) loadData(); }, [user]);

  const loadData = async () => {
    try {
      let reservations = [];
      let salesItems = [];

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

      // Revenue = reservations that represent earned income: paid, or an active/
      // completed status. (The reservation DTO has no `upfrontPaymentRequired`.)
      const isRevenue = (r) => {
        const pay = (r.paymentStatus || '').toUpperCase();
        const st = (r.bookingStatus || r.reservationStatus || '').toUpperCase();
        return pay === 'COMPLETED' || pay === 'PAID'
          || st === 'CHECKED_OUT' || st === 'CHECKED_IN'
          || st === 'ACCEPTED' || st === 'BOOKED' || st === 'RESERVED' || st === 'CONFIRMED';
      };
      salesItems = reservations.filter(isRevenue);

      try {
        const ticketsRes = await businessService.getTickets(user.id);
        const ticketList = Array.isArray(ticketsRes) ? ticketsRes : ticketsRes?.content || [];
        ticketList.forEach(event => {
          const soldCount = event.soldTickets || 0;
          if (soldCount > 0) salesItems.push({ totalPrice: (event.ticketPrice || 0) * soldCount, createdAt: event.eventDate || event.createdAt });
        });
      } catch {}

      const customerIds = new Set();
      reservations.forEach(r => { const id = r.customerId || r.customerUserId; if (id) customerIds.add(id); });

      const lossItems = reservations.filter(r => {
        const s = r.bookingStatus || r.reservationStatus || '';
        return s === 'CANCELLED' || s === 'REFUNDED' || s === 'REJECTED';
      });

      // Status counts
      let confirmed = 0, pending = 0, cancelled = 0;
      reservations.forEach(r => {
        const s = r.bookingStatus || r.reservationStatus || '';
        if (s === 'ACCEPTED' || s === 'CONFIRMED' || s === 'RESERVED' || s === 'BOOKED' || s === 'CHECKED_IN' || s === 'CHECKED_OUT') confirmed++;
        else if (s === 'CANCELLED' || s === 'REJECTED') cancelled++;
        else pending++;
      });

      setRawReservations(reservations);
      setStatusCounts({ confirmed, pending, cancelled });
      setStats({
        totalSales: salesItems.reduce((sum, s) => sum + (s.totalPrice || 0), 0),
        totalCustomers: customerIds.size,
        totalReservations: reservations.length,
        totalLoss: lossItems.reduce((sum, r) => sum + (r.totalPrice || 0), 0),
      });
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadData(); };

  // Refresh when screen comes back into focus
  useRefreshOnFocus(useCallback(() => { loadData(); }, [user]));

  // Chart data
  const isRoomBooking = usesRoomBookings(attractionId);
  const dateField = isRoomBooking ? 'checkInDate' : 'date';
  const reservationsByDate = groupByDate(rawReservations, dateField, period);
  const revenueByDate = groupRevenueByDate(rawReservations, dateField, 'totalPrice', period);

  const revenueLabels = Object.keys(revenueByDate).slice(-6);
  const revenueData = revenueLabels.map(k => revenueByDate[k] || 0);

  const trendLabels = Object.keys(reservationsByDate).slice(-6);
  const trendData = trendLabels.map(k => reservationsByDate[k] || 0);

  const chartConfig = {
    backgroundColor: '#fff',
    backgroundGradientFrom: '#fff',
    backgroundGradientTo: '#fff',
    decimalCount: 0,
    color: (opacity = 1) => colors.primary + Math.round(opacity * 255).toString(16).padStart(2, '0'),
    labelColor: () => '#6b7280',
    style: { borderRadius: 12 },
    propsForDots: { r: '4', strokeWidth: '1.5', stroke: colors.primary },
    barPercentage: 0.6,
  };

  const total = statusCounts.confirmed + statusCounts.pending + statusCounts.cancelled;

  return (
    <View style={styles.screen}>
      <TopNavbar />
      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Welcome card */}
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.name || 'Business'}</Text>
          <Text style={styles.categoryText}>{user?.attraction?.name || ''} · Here's your overview</Text>
        </View>

        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : (
          <>
            {/* Period filter */}
            <View style={styles.periodRow}>
              {PERIOD_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.periodBtn, period === opt.value && { backgroundColor: colors.primary }]}
                  onPress={() => setPeriod(opt.value)}
                >
                  <Text style={[styles.periodText, period === opt.value && { color: '#fff' }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Stats cards */}
            <View style={styles.section}>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>💰</Text>
                  <Text style={[styles.statCardValue, { color: colors.primary }]}>R{stats.totalSales.toLocaleString()}</Text>
                  <Text style={styles.statCardLabel}>Revenue</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>👥</Text>
                  <Text style={styles.statCardValue}>{stats.totalCustomers}</Text>
                  <Text style={styles.statCardLabel}>Customers</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>📅</Text>
                  <Text style={styles.statCardValue}>{stats.totalReservations}</Text>
                  <Text style={styles.statCardLabel}>{isRoomBooking ? 'Bookings' : 'Reservations'}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>📉</Text>
                  <Text style={[styles.statCardValue, { color: '#dc2626' }]}>R{stats.totalLoss.toLocaleString()}</Text>
                  <Text style={styles.statCardLabel}>Loss</Text>
                </View>
              </View>
            </View>

            {/* Revenue Bar Chart */}
            <View style={styles.chartSection}>
              <Text style={styles.chartTitle}>Revenue</Text>
              {revenueLabels.length > 0 ? (
                <BarChart
                  data={{ labels: revenueLabels, datasets: [{ data: revenueData.length > 0 ? revenueData : [0] }] }}
                  width={screenWidth - 32}
                  height={180}
                  chartConfig={chartConfig}
                  style={styles.chart}
                  fromZero
                  showValuesOnTopOfBars
                />
              ) : (
                <Text style={styles.noDataText}>No revenue data for this period</Text>
              )}
            </View>

            {/* Reservations Trend Line Chart */}
            <View style={styles.chartSection}>
              <Text style={styles.chartTitle}>{isRoomBooking ? 'Bookings' : 'Reservations'} Trend</Text>
              {trendLabels.length > 0 ? (
                <LineChart
                  data={{ labels: trendLabels, datasets: [{ data: trendData.length > 0 ? trendData : [0] }] }}
                  width={screenWidth - 32}
                  height={180}
                  chartConfig={chartConfig}
                  style={styles.chart}
                  bezier
                  fromZero
                />
              ) : (
                <Text style={styles.noDataText}>No data for this period</Text>
              )}
            </View>

            {/* Status Breakdown */}
            <View style={styles.chartSection}>
              <Text style={styles.chartTitle}>Status Breakdown</Text>
              <View style={styles.statusList}>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: '#16a34a' }]} />
                  <Text style={styles.statusLabel}>Confirmed</Text>
                  <Text style={styles.statusValue}>{statusCounts.confirmed}</Text>
                  <View style={styles.statusBarBg}>
                    <View style={[styles.statusBar, { backgroundColor: '#16a34a', width: total > 0 ? `${(statusCounts.confirmed / total) * 100}%` : '0%' }]} />
                  </View>
                </View>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: '#f59e0b' }]} />
                  <Text style={styles.statusLabel}>Pending</Text>
                  <Text style={styles.statusValue}>{statusCounts.pending}</Text>
                  <View style={styles.statusBarBg}>
                    <View style={[styles.statusBar, { backgroundColor: '#f59e0b', width: total > 0 ? `${(statusCounts.pending / total) * 100}%` : '0%' }]} />
                  </View>
                </View>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: '#dc2626' }]} />
                  <Text style={styles.statusLabel}>Cancelled</Text>
                  <Text style={styles.statusValue}>{statusCounts.cancelled}</Text>
                  <View style={styles.statusBarBg}>
                    <View style={[styles.statusBar, { backgroundColor: '#dc2626', width: total > 0 ? `${(statusCounts.cancelled / total) * 100}%` : '0%' }]} />
                  </View>
                </View>
              </View>
            </View>
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f2ef' },
  content: { flex: 1 },
  welcomeCard: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 16, marginBottom: 8 },
  welcomeText: { fontSize: 14, color: '#6b7280' },
  userName: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginTop: 2 },
  categoryText: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  loadingText: { color: '#6b7280', textAlign: 'center', marginTop: 40 },
  periodRow: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, gap: 8, marginBottom: 8 },
  periodBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f3f4f6' },
  periodText: { fontSize: 13, fontWeight: '500', color: '#374151' },
  section: { backgroundColor: '#fff', marginBottom: 8, padding: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '48%', backgroundColor: '#f9fafb', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#f3f4f6' },
  statIcon: { fontSize: 20, marginBottom: 6 },
  statCardValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  statCardLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  chartSection: { backgroundColor: '#fff', marginBottom: 8, padding: 16 },
  chartTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 12 },
  chart: { borderRadius: 10, marginLeft: -8 },
  noDataText: { color: '#9ca3af', fontSize: 13, textAlign: 'center', paddingVertical: 30 },
  statusList: { gap: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  statusLabel: { fontSize: 13, color: '#374151', width: 80 },
  statusValue: { fontSize: 14, fontWeight: '600', color: '#111827', width: 30, textAlign: 'right', marginRight: 10 },
  statusBarBg: { flex: 1, height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  statusBar: { height: '100%', borderRadius: 4 },
});
