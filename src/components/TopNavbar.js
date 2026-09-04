import React, { useContext, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ProfileModal from './ProfileModal';

export default function TopNavbar() {
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [profileVisible, setProfileVisible] = useState(false);

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
});
