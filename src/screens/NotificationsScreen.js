import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import businessService from '../api/businessService';

export default function NotificationsScreen() {
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const renderNotification = ({ item }) => {
    const isUnread = !item.read;
    return (
      <View style={[styles.card, isUnread && styles.unreadCard]}>
        <View style={styles.cardContent}>
          <Text style={styles.subject}>{item.subject || item.title || 'Notification'}</Text>
          <Text style={styles.body}>{item.body || item.message || ''}</Text>
          <Text style={styles.date}>
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
          </Text>
        </View>
        {isUnread && (
          <TouchableOpacity style={[styles.readBtn, { backgroundColor: colors.primary }]} onPress={() => markAsRead(item.id)}>
            <Text style={styles.readBtnText}>Mark Read</Text>
          </TouchableOpacity>
        )}
      </View>
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
  readBtn: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 10 },
  readBtnText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  loadingText: { color: '#6b7280', textAlign: 'center', marginTop: 40 },
  emptyText: { color: '#9ca3af', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
