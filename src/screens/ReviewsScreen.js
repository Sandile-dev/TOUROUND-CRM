import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import businessService from '../api/businessService';
import KeyboardAwareScroll from '../components/KeyboardAwareScroll';
import AppIcon from '../components/AppIcon';
import useHeaderInsets from '../hooks/useHeaderInsets';

export default function ReviewsScreen() {
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { headerPaddingTop } = useHeaderInsets();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Which review's reply box is open, the draft text, and submit state.
  const [replyingId, setReplyingId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

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

  const openReply = (review) => {
    setReplyingId(review.id);
    // Pre-fill with any existing reply so it can be edited.
    setReplyText(review.reply || review.response || review.businessReply || '');
  };

  const cancelReply = () => {
    setReplyingId(null);
    setReplyText('');
  };

  const submitReply = async (reviewId) => {
    if (!replyText.trim()) { Alert.alert('Error', 'Please enter a reply'); return; }
    setSubmittingReply(true);
    try {
      await businessService.replyToReview(reviewId, replyText.trim());
      // Reflect the reply locally right away.
      setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, reply: replyText.trim() } : r)));
      cancelReply();
      loadReviews();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to send reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  const getReply = (review) => review.reply || review.response || review.businessReply || '';

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : '0.0';

  const renderStars = (rating, size = 14) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <AppIcon key={i} name={i <= rating ? 'star' : 'star-outline'} size={size} color="#f59e0b" />
      );
    }
    return <View style={styles.starsRow}>{stars}</View>;
  };

  return (
    <KeyboardAwareScroll style={styles.screen} contentContainerStyle={styles.screenContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={[styles.headerRow, { paddingTop: headerPaddingTop }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.goBack()}>
          <AppIcon name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Reviews</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={[styles.avgCard, { borderColor: colors.primary + '40' }]}>
        <Text style={[styles.avgRating, { color: colors.primary }]}>{averageRating}</Text>
        {renderStars(Math.round(averageRating), 18)}
        <Text style={styles.avgCount}>{reviews.length} review{reviews.length !== 1 ? 's' : ''}</Text>
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Loading reviews...</Text>
      ) : reviews.length === 0 ? (
        <Text style={styles.emptyText}>No reviews yet.</Text>
      ) : (
        reviews.map((review) => {
          const existingReply = getReply(review);
          const isReplying = replyingId === review.id;
          return (
            <View key={review.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.customerName}>{review.customerName || 'Anonymous'}</Text>
                {renderStars(review.rating || 0)}
              </View>
              <Text style={styles.comment}>{review.comment || review.review || ''}</Text>
              <Text style={styles.date}>
                {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}
              </Text>

              {/* Existing business reply */}
              {existingReply && !isReplying && (
                <View style={[styles.replyBox, { borderLeftColor: colors.primary }]}>
                  <Text style={styles.replyLabel}>Your reply</Text>
                  <Text style={styles.replyText}>{existingReply}</Text>
                </View>
              )}

              {/* Reply editor */}
              {isReplying ? (
                <View style={styles.replyEditor}>
                  <TextInput
                    style={styles.replyInput}
                    placeholder="Write a reply..."
                    placeholderTextColor="#9ca3af"
                    value={replyText}
                    onChangeText={setReplyText}
                    multiline
                    autoFocus
                  />
                  <View style={styles.replyActions}>
                    <TouchableOpacity style={styles.replyCancelBtn} onPress={cancelReply} disabled={submittingReply}>
                      <Text style={styles.replyCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.replySendBtn, { backgroundColor: colors.primary }]}
                      onPress={() => submitReply(review.id)}
                      disabled={submittingReply}
                    >
                      <Text style={styles.replySendText}>{submittingReply ? 'Sending...' : 'Send Reply'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.replyTrigger} onPress={() => openReply(review)}>
                  <AppIcon name={existingReply ? 'create-outline' : 'arrow-undo-outline'} size={15} color={colors.primary} />
                  <Text style={[styles.replyTriggerText, { color: colors.primary }]}>
                    {existingReply ? 'Edit reply' : 'Reply'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}
    </KeyboardAwareScroll>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f2ef' },
  screenContent: { padding: 16, paddingBottom: 140 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
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
  replyBox: { marginTop: 10, paddingLeft: 10, borderLeftWidth: 3, backgroundColor: '#f9fafb', borderRadius: 4, paddingVertical: 8, paddingRight: 8 },
  replyLabel: { fontSize: 11, fontWeight: '700', color: '#6b7280', marginBottom: 2 },
  replyText: { fontSize: 13, color: '#374151', lineHeight: 18 },
  starsRow: { flexDirection: 'row', gap: 1 },
  replyTrigger: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, alignSelf: 'flex-start' },
  replyTriggerText: { fontSize: 13, fontWeight: '600' },
  replyEditor: { marginTop: 10 },
  replyInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10, fontSize: 14, color: '#111827', minHeight: 64, textAlignVertical: 'top' },
  replyActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  replyCancelBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#f3f4f6' },
  replyCancelText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  replySendBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  replySendText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  loadingText: { color: '#6b7280', textAlign: 'center', marginTop: 40 },
  emptyText: { color: '#9ca3af', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
