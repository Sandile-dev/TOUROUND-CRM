import React, { useContext, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import businessService from '../api/businessService';
import AppIcon from '../components/AppIcon';
import { resolveCategory, usesRoomBookings, usesTableReservations } from '../constants/attractions';

export default function AnalyticsScreen() {
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const navigation = useNavigation();
  const attractionId = resolveCategory(user?.attraction);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState({
    totalRevenue: 0, totalCustomers: 0, conversionRate: 0, averageRating: 0,
    postsCount: 0, followersCount: 0, eventsCount: 0, totalLoss: 0,
    confirmed: 0, pending: 0, cancelled: 0,
  });

  useEffect(() => {
    if (user?.id) loadAnalytics();
  }, [user]);

  const loadAnalytics = async () => {
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

      const customerIds = new Set();
      reservations.forEach(r => {
        const id = r.customerId || r.customerUserId;
        if (id) customerIds.add(id);
      });

      const confirmed = reservations.filter(r => {
        const s = r.bookingStatus || r.reservationStatus || '';
        return s === 'ACCEPTED' || s === 'CONFIRMED' || s === 'RESERVED' || s === 'CHECKED_IN' || s === 'CHECKED_OUT';
      }).length;
      const pending = reservations.filter(r => {
        const s = r.bookingStatus || r.reservationStatus || '';
        return s === 'PENDING' || s === 'AWAITING_CONFIRMATION' || s === 'AWAITING_PAYMENT';
      }).length;
      const cancelled = reservations.filter(r => {
        const s = r.bookingStatus || r.reservationStatus || '';
        return s === 'CANCELLED' || s === 'REJECTED' || s === 'REFUNDED';
      }).length;

      const revenue = reservations
        .filter(r => { const s = r.bookingStatus || r.reservationStatus || ''; return s !== 'CANCELLED' && s !== 'REJECTED' && s !== 'REFUNDED'; })
        .reduce((sum, r) => sum + (r.totalPrice || 0), 0);

      const loss = reservations
        .filter(r => { const s = r.bookingStatus || r.reservationStatus || ''; return s === 'CANCELLED' || s === 'REJECTED' || s === 'REFUNDED'; })
        .reduce((sum, r) => sum + (r.totalPrice || 0), 0);

      const conversionRate = reservations.length > 0 ? ((confirmed / reservations.length) * 100).toFixed(1) : 0;

      let postsCount = 0, followersCount = 0, eventsCount = 0, averageRating = 0;
      try {
        const posts = await businessService.getPosts(user.id);
        postsCount = (Array.isArray(posts) ? posts : posts?.content || []).length;
      } catch {}
      try {
        const followers = await businessService.getFollowers(user.id);
        followersCount = (Array.isArray(followers) ? followers : followers?.content || []).length;
      } catch {}
      try {
        const events = await businessService.getTickets(user.id);
        eventsCount = (Array.isArray(events) ? events : events?.content || []).length;
      } catch {}
      try {
        const reviews = await businessService.getReviews(user.id);
        const reviewList = Array.isArray(reviews) ? reviews : reviews?.content || [];
        if (reviewList.length > 0) {
          averageRating = (reviewList.reduce((s, r) => s + (r.rating || 0), 0) / reviewList.length).toFixed(1);
        }
      } catch {}

      setMetrics({
        totalRevenue: revenue, totalCustomers: customerIds.size, conversionRate,
        averageRating, postsCount, followersCount, eventsCount, totalLoss: loss,
        confirmed, pending, cancelled,
      });
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadAnalytics(); };

  return (
    <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.goBack()}>
          <AppIcon name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Analytics</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Loading analytics...</Text>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <View style={styles.grid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Revenue</Text>
              <Text style={[styles.metricValue, { color: colors.primary }]}>R{metrics.totalRevenue.toLocaleString()}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Customers</Text>
              <Text style={[styles.metricValue, { color: colors.primary }]}>{metrics.totalCustomers}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Conversion Rate</Text>
              <Text style={[styles.metricValue, { color: colors.primary }]}>{metrics.conversionRate}%</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Average Rating</Text>
              <View style={styles.metricRatingRow}>
                <AppIcon name="star" size={16} color="#f59e0b" />
                <Text style={[styles.metricValue, { color: '#f59e0b' }]}>{metrics.averageRating}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Stats</Text>
          <View style={styles.grid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Posts</Text>
              <Text style={styles.metricValue}>{metrics.postsCount}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Followers</Text>
              <Text style={styles.metricValue}>{metrics.followersCount}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Events</Text>
              <Text style={styles.metricValue}>{metrics.eventsCount}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Loss</Text>
              <Text style={[styles.metricValue, { color: '#dc2626' }]}>R{metrics.totalLoss.toLocaleString()}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Reservation Status</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: '#16a34a' }]} />
              <Text style={styles.statusLabel}>Confirmed</Text>
              <Text style={styles.statusValue}>{metrics.confirmed}</Text>
            </View>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.statusLabel}>Pending</Text>
              <Text style={styles.statusValue}>{metrics.pending}</Text>
            </View>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: '#dc2626' }]} />
              <Text style={styles.statusLabel}>Cancelled</Text>
              <Text style={styles.statusValue}>{metrics.cancelled}</Text>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f2ef', padding: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 40, marginBottom: 16, paddingHorizontal: 16 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: '#fff', marginTop: -1 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#6b7280', marginBottom: 10, marginTop: 8, paddingHorizontal: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  grid: { paddingHorizontal: 16, gap: 0, marginBottom: 8, backgroundColor: '#fff' },
  metricCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  metricLabel: { fontSize: 14, color: '#374151' },
  metricValue: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  metricRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  statusRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  statusLabel: { flex: 1, fontSize: 14, color: '#374151' },
  statusValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
  loadingText: { color: '#6b7280', textAlign: 'center', marginTop: 40 },
});
