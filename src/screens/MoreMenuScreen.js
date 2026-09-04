import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const menuSections = [
  {
    title: 'Business',
    items: [
      { screen: 'Services', icon: '\u{1F4CB}', label: 'Services' },
      { screen: 'Tickets', icon: '\u{1F3AB}', label: 'Events & Tickets' },
      { screen: 'Customers', icon: '\u{1F465}', label: 'Customers' },
      { screen: 'Sales', icon: '\u{1F4B0}', label: 'Sales Report' },
      { screen: 'Payments', icon: '\u{1F4B3}', label: 'Payments' },
      { screen: 'Promotions', icon: '\u{1F3F7}', label: 'Promotions' },
      { screen: 'Staff', icon: '\u{1F9D1}', label: 'Staff' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { screen: 'Reviews', icon: '\u{2B50}', label: 'Reviews' },
      { screen: 'Analytics', icon: '\u{1F4C8}', label: 'Analytics' },
    ],
  },
  {
    title: 'Account',
    items: [
      { screen: 'Settings', icon: '\u{1F464}', label: 'Profile Settings' },
      { screen: 'AppSettings', icon: '\u{2699}', label: 'App Settings' },
    ],
  },
];

export default function MoreMenuScreen({ navigation }) {
  const { user, logout } = useContext(AuthContext);
  const { colors } = useTheme();

  return (
    <ScrollView style={styles.screen}>
      {menuSections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.items.map((item) => (
            <TouchableOpacity
              key={item.screen}
              style={styles.menuItem}
              onPress={() => navigation.navigate(item.screen)}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.chevron}>{'>'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}

      <TouchableOpacity style={styles.logoutBtn} onPress={() => logout()}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f2ef', paddingTop: 40 },
  section: { backgroundColor: '#fff', marginTop: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  menuIcon: { fontSize: 22, marginRight: 14 },
  menuLabel: { flex: 1, fontSize: 16, color: '#374151' },
  chevron: { fontSize: 22, color: '#d1d5db' },
  logoutBtn: {
    marginTop: 8,
    backgroundColor: '#fff',
    paddingVertical: 18,
    alignItems: 'center',
  },
  logoutText: { color: '#dc2626', fontWeight: '600', fontSize: 16 },
});
