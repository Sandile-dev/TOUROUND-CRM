import React, { useContext, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import businessService from '../api/businessService';

export default function ReviewsScreen() {
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user?.id) loadReviews();
  }, [user]);

  const loadReviews = async () => {
    try {
      const res = await businessService.getReviews(user.id);
      const list = Array.isArray(res) ? res : res?.content || [];
      setReviews(list);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadReviews(); };

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : '0.0';

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(i <= rating ? '★' : '☆');
    }
    return stars.join('');
  };

  return (
    <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>{'‹'}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Reviews</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={[styles.avgCard, { borderColor: colors.primary + '40' }]}>
        <Text style={[styles.avgRating, { color: colors.primary }]}>{averageRating}</Text>
        <Text style={styles.avgStars}>{renderStars(Math.round(averageRating))}</Text>
        <Text style={styles.avgCount}>{reviews.length} review{reviews.length !== 1 ? 's' : ''}</Text>
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Loading reviews...</Text>
      ) : reviews.length === 0 ? (
        <Text style={styles.emptyText}>No reviews yet.</Text>
      ) : (
        reviews.map((review) => (
          <View key={review.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.customerName}>{review.customerName || 'Anonymous'}</Text>
              <Text style={styles.stars}>{renderStars(review.rating || 0)}</Text>
            </View>
            <Text style={styles.comment}>{review.comment || review.review || ''}</Text>
            <Text style={styles.date}>
              {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f2ef', padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 40, marginBottom: 16 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: '#fff', marginTop: -1 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  avgCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 2 },
  avgRating: { fontSize: 36, fontWeight: 'bold' },
  avgStars: { fontSize: 22, color: '#f59e0b', marginVertical: 4 },
  avgCount: { fontSize: 13, color: '#6b7280' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  customerName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  stars: { fontSize: 16, color: '#f59e0b' },
  comment: { fontSize: 13, color: '#374151', lineHeight: 18, marginBottom: 6 },
  date: { fontSize: 11, color: '#9ca3af' },
  loadingText: { color: '#6b7280', textAlign: 'center', marginTop: 40 },
  emptyText: { color: '#9ca3af', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
