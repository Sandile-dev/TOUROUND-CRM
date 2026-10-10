import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, RefreshControl, Modal, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import businessService from '../api/businessService';
import AppIcon from '../components/AppIcon';

export default function NotificationsScreen() {
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const { showConfirm, showError } = useAlert();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (user?.id) loadNotifications();
  }, [user]);

  const loadNotifications = async () => {
    try {
      const res = await businessService.getNotifications(user.id);
      const list = Array.isArray(res) ? res : res?.content || [];
      setNotifications(list);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadNotifications(); };

  const markAsRead = async (id) => {
    try {
      await businessService.markNotificationRead(id);
      loadNotifications();
    } catch {}
  };

  const deleteNotification = (item) => {
    showConfirm(
      'Delete notification',
      'Are you sure you want to delete this notification?',
      async () => {
        // Optimistically remove, then confirm with the server.
        const id = item.id;
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        if (detail && detail.id === id) setDetail(null);
        try {
          await businessService.deleteNotification(id);
        } catch (err) {
          showError('Error', err.message || 'Could not delete the notification.');
          loadNotifications();
        }
      },
      'Delete',
      'Cancel'
    );
  };

  // Detect a message-related notification from its type/category/text.
  const isMessageNotification = (item) => {
    const hay = `${item.type || ''} ${item.category || ''} ${item.referenceType || ''} ${item.subject || item.title || ''}`.toLowerCase();
    return hay.includes('message') || hay.includes('chat');
  };

  const handleNotificationPress = (item) => {
    // Mark it read on open (best-effort).
    if (!item.read && item.id != null) {
      businessService.markNotificationRead(item.id).then(loadNotifications).catch(() => {});
    }
    if (isMessageNotification(item)) {
      // Redirect to the Messages chat tab.
      navigation.navigate('Messages');
      return;
    }
    // Otherwise show the notification detail.
    setDetail(item);
  };

  const renderNotification = ({ item }) => {
    const isUnread = !item.read;
    return (
      <TouchableOpacity style={[styles.card, isUnread && styles.unreadCard]} activeOpacity={0.7} onPress={() => handleNotificationPress(item)}>
        <View style={styles.cardContent}>
          <Text style={styles.subject}>{item.subject || item.title || 'Notification'}</Text>
          <Text style={styles.body} numberOfLines={2}>{item.body || item.message || ''}</Text>
          <Text style={styles.date}>
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.cardDeleteBtn}
          onPress={() => deleteNotification(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <AppIcon name="trash-outline" size={18} color="#dc2626" />
        </TouchableOpacity>
        <AppIcon name="chevron-forward" size={18} color="#9ca3af" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Notifications</Text>
      {loading ? (
        <Text style={styles.loadingText}>Loading notifications...</Text>
      ) : notifications.length === 0 ? (
        <Text style={styles.emptyText}>No notifications.</Text>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderNotification}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}

      {/* Notification detail modal */}
      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.detailOverlay}>
          <View style={[styles.detailSheet, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
            <View style={styles.detailHandle} />
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle} numberOfLines={3}>{detail?.subject || detail?.title || 'Notification'}</Text>
              <TouchableOpacity onPress={() => setDetail(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <AppIcon name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
            {detail?.createdAt ? (
              <Text style={styles.detailDate}>{new Date(detail.createdAt).toLocaleString()}</Text>
            ) : null}
            <ScrollView style={styles.detailScroll} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.detailBody}>{detail?.body || detail?.message || 'No further details.'}</Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.detailDeleteBtn}
              onPress={() => detail && deleteNotification(detail)}
              activeOpacity={0.8}
            >
              <AppIcon name="trash-outline" size={16} color="#dc2626" />
              <Text style={styles.detailDeleteText}>Delete notification</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb', padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginTop: 40, marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb', flexDirection: 'row', alignItems: 'center' },
  unreadCard: { borderLeftWidth: 4, borderLeftColor: '#0d9488' },
  cardContent: { flex: 1 },
  subject: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 4 },
  body: { fontSize: 13, color: '#6b7280', lineHeight: 18, marginBottom: 4 },
  date: { fontSize: 11, color: '#9ca3af' },
  cardDeleteBtn: { paddingHorizontal: 6, paddingVertical: 4, marginRight: 2 },
  loadingText: { color: '#6b7280', textAlign: 'center', marginTop: 40 },
  emptyText: { color: '#9ca3af', textAlign: 'center', marginTop: 40, fontSize: 14 },
  // Detail modal
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  detailSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 10, minHeight: 240, maxHeight: '80%' },
  detailHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', marginBottom: 14 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 12 },
  detailTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#111827', lineHeight: 24 },
  detailDate: { fontSize: 12, color: '#9ca3af', marginBottom: 12 },
  detailScroll: { flexGrow: 0 },
  detailBody: { fontSize: 14, color: '#374151', lineHeight: 21 },
  detailDeleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  detailDeleteText: { fontSize: 14, fontWeight: '600', color: '#dc2626' },
});
