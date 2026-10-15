import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AppIcon from '../components/AppIcon';
import { hasPermission, FEATURES } from '../constants/permissions';

// `feature` gates visibility for staff. `ownerOnly` items are hidden from all
// staff regardless of permissions (business owner only).
const menuSections = [
  {
    title: 'Business',
    items: [
      { screen: 'Services', icon: 'briefcase-outline', label: 'Services', feature: FEATURES.SERVICES },
      { screen: 'Tickets', icon: 'ticket-outline', label: 'Events & Tickets', feature: FEATURES.TICKETS },
      { screen: 'Customers', icon: 'people-outline', label: 'Customers', feature: FEATURES.CUSTOMERS },
      { screen: 'Sales', icon: 'cash-outline', label: 'Sales Report', feature: FEATURES.SALES },
      { screen: 'Payments', icon: 'card-outline', label: 'Payments', feature: FEATURES.PAYMENTS },
      { screen: 'Promotions', icon: 'pricetag-outline', label: 'Promotions', feature: FEATURES.PROMOTIONS },
      { screen: 'Staff', icon: 'person-outline', label: 'Staff', ownerOnly: true },
    ],
  },
  {
    title: 'Insights',
    items: [
      { screen: 'Reviews', icon: 'star-outline', label: 'Reviews', feature: FEATURES.REVIEWS },
      { screen: 'Analytics', icon: 'bar-chart-outline', label: 'Analytics', feature: FEATURES.ANALYTICS },
    ],
  },
  {
    title: 'Account',
    items: [
      { screen: 'Settings', icon: 'person-circle-outline', label: 'Profile Settings', ownerOnly: true },
      { screen: 'AppSettings', icon: 'settings-outline', label: 'App Settings' },
    ],
  },
];

export default function MoreMenuScreen({ navigation }) {
  const { user, logout } = useContext(AuthContext);
  const { colors } = useTheme();

  // Filter items by role/permissions, then drop any now-empty section.
  const visibleSections = menuSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.ownerOnly) return !user?.isStaff;
        if (item.feature) return hasPermission(user, item.feature);
        return true; // ungated items (e.g. App Settings) are always available
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <ScrollView style={styles.screen}>
      {visibleSections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.items.map((item) => (
            <TouchableOpacity
              key={item.screen}
              style={styles.menuItem}
              onPress={() => navigation.navigate(item.screen)}
            >
              <AppIcon name={item.icon} size={22} color={colors.primary} style={styles.menuIcon} />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <AppIcon name="chevron-forward" size={20} color="#d1d5db" />
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
