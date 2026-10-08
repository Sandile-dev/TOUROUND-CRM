import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import businessService from '../api/businessService';
import AppIcon from './AppIcon';

export default function ProfileModal({ visible, onClose }) {
  const { user, logout } = useContext(AuthContext);
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [stats, setStats] = useState({ followers: 0, reactions: 0, reviews: 0 });
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (visible && user?.id) loadStats();
  }, [visible]);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      let followers = 0, reactions = 0, reviews = 0;

      try {
        const res = await businessService.getFollowers(user.id);
        const list = Array.isArray(res) ? res : res?.content || [];
        followers = list.length;
      } catch {}

      try {
        const res = await businessService.getPosts(user.id);
        const list = Array.isArray(res) ? res : res?.content || [];
        reactions = list.reduce((sum, p) => sum + (p.reactionsCount || 0), 0);
      } catch {}

      try {
        const res = await businessService.getReviews(user.id);
        const list = Array.isArray(res) ? res : res?.content || [];
        reviews = list.length;
      } catch {}

      setStats({ followers, reactions, reviews });
    } catch {} finally {
      setLoadingStats(false);
    }
  };

  const handleNav = (screen, params) => {
    onClose();
    if (params) navigation.navigate(screen, params);
    else navigation.navigate(screen);
  };

  const handleLogout = async () => {
    onClose();
    await logout();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.drawer} onPress={() => {}}>
          {/* Profile header */}
          <View style={styles.header}>
            <View style={[styles.avatar, { backgroundColor: colors.light, borderColor: colors.primary }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {user?.name?.charAt(0)?.toUpperCase() || 'B'}
              </Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.name}>{user?.name || 'Business'}</Text>
              <Text style={styles.category}>{user?.attraction?.name || ''}</Text>
              {user?.email && <Text style={styles.email}>{user.email}</Text>}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Menu items */}
          <TouchableOpacity style={styles.menuItem} onPress={() => handleNav('MoreTab', { screen: 'Settings' })}>
            <Text style={styles.menuIcon}>👤</Text>
            <Text style={styles.menuLabel}>Profile</Text>
          </TouchableOpacity>

          {/* Stats list */}
          <View style={styles.statsList}>
            {loadingStats ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 12 }} />
            ) : (
              <>
                <View style={styles.statRow}>
                  <Text style={[styles.statValue, { color: colors.primary }]}>{stats.followers}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={[styles.statValue, { color: colors.primary }]}>{stats.reactions}</Text>
                  <Text style={styles.statLabel}>Post Reactions</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={[styles.statValue, { color: colors.primary }]}>{stats.reviews}</Text>
                  <Text style={styles.statLabel}>Reviews</Text>
                </View>
              </>
            )}
          </View>

          <TouchableOpacity style={styles.menuItem} onPress={() => handleNav('MoreTab', { screen: 'AppSettings' })}>
            <AppIcon name="settings-outline" size={20} color={colors.primary} style={styles.menuIcon} />
            <Text style={styles.menuLabel}>Settings</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Logout */}
          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <AppIcon name="log-out-outline" size={20} color="#dc2626" style={styles.menuIcon} />
            <Text style={[styles.menuLabel, { color: '#dc2626' }]}>Logout</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
  },
  drawer: {
    backgroundColor: '#fff',
    marginTop: 44,
    marginLeft: 0,
    marginRight: 60,
    borderBottomRightRadius: 16,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 24,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginRight: 14,
  },
  avatarText: { fontSize: 20, fontWeight: 'bold' },
  headerInfo: { flex: 1 },
  name: { fontSize: 17, fontWeight: '700', color: '#111827' },
  category: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  email: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  statsList: {
    paddingLeft: 20,
    marginBottom: 4,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  statValue: { fontSize: 15, fontWeight: '700', marginRight: 8, minWidth: 24 },
  statLabel: { fontSize: 14, color: '#374151' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginHorizontal: 16, marginVertical: 4 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  menuIcon: { marginRight: 14 },
  menuLabel: { fontSize: 15, color: '#374151' },
});
