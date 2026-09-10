import React, { useContext, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import businessService from '../api/businessService';
import ProfileModal from './ProfileModal';

export default function TopNavbar() {
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [profileVisible, setProfileVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnread = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await businessService.getNotifications(user.id);
      const list = Array.isArray(res) ? res : res?.content || [];
      const count = list.filter((n) => n.read === false || n.isRead === false).length;
      setUnreadCount(count);
    } catch {}
  }, [user]);

  // Refresh the unread count whenever a screen using the navbar gains focus.
  useFocusEffect(useCallback(() => { loadUnread(); }, [loadUnread]));

  const initial = user?.name?.charAt(0)?.toUpperCase() || 'B';

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity
          style={[styles.avatar, { backgroundColor: colors.light, borderColor: colors.primary }]}
          onPress={() => setProfileVisible(true)}
        >
          <Text style={[styles.avatarText, { color: colors.primary }]}>{initial}</Text>
        </TouchableOpacity>

        <View style={styles.searchBox}>
          <Text style={{ fontSize: 14, marginRight: 6 }}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor="#9ca3af"
          />
        </View>

        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => navigation.navigate('MoreTab', { screen: 'Notifications' })}
        >
          <Text style={styles.notifIcon}>🔔</Text>
          {unreadCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ProfileModal visible={profileVisible} onClose={() => setProfileVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  avatarText: { fontSize: 16, fontWeight: 'bold' },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 16, color: '#111827', padding: 0 },
  notifBtn: { padding: 8 },
  notifIcon: { fontSize: 24 },
  notifBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  notifBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
});
