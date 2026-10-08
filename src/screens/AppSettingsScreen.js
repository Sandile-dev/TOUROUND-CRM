import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme, themeColors } from '../context/ThemeContext';
import AppIcon from '../components/AppIcon';

const colorOptions = [
  { key: 'blue', label: 'Blue', color: '#2bb5c4' },
  { key: 'purple', label: 'Purple', color: '#9333ea' },
  { key: 'green', label: 'Green', color: '#16a34a' },
  { key: 'red', label: 'Red', color: '#dc2626' },
  { key: 'orange', label: 'Orange', color: '#ea580c' },
  { key: 'teal', label: 'Teal', color: '#0d9488' },
  { key: 'pink', label: 'Pink', color: '#db2777' },
  { key: 'indigo', label: 'Indigo', color: '#4f46e5' },
];

export default function AppSettingsScreen() {
  const { themeColor, setThemeColor, darkMode, setDarkMode, colors } = useTheme();
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.screen}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.goBack()}>
          <AppIcon name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>App Settings</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Theme Color */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Theme Color</Text>
        <Text style={styles.sectionDesc}>Choose your preferred accent color</Text>
        <View style={styles.colorGrid}>
          {colorOptions.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.colorItem, themeColor === opt.key && { borderColor: opt.color }]}
              onPress={() => setThemeColor(opt.key)}
            >
              <View style={[styles.colorCircle, { backgroundColor: opt.color }]}>
                {themeColor === opt.key && <AppIcon name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={[styles.colorLabel, themeColor === opt.key && { color: opt.color, fontWeight: '600' }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Appearance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <Text style={styles.sectionDesc}>Toggle between light and dark mode</Text>

        <TouchableOpacity
          style={[styles.modeCard, !darkMode && { borderColor: colors.primary, borderWidth: 1.5 }]}
          onPress={() => setDarkMode(false)}
        >
          <View style={styles.modeIconWrap}>
            <AppIcon name="sunny" size={20} color="#f59e0b" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.modeTitle}>Light Mode</Text>
            <Text style={styles.modeDesc}>Bright and clean interface</Text>
          </View>
          {!darkMode && <AppIcon name="checkmark" size={18} color={colors.primary} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeCard, darkMode && { borderColor: colors.primary, borderWidth: 1.5 }]}
          onPress={() => setDarkMode(true)}
        >
          <View style={[styles.modeIconWrap, { backgroundColor: '#1f2937' }]}>
            <AppIcon name="moon" size={20} color="#fbbf24" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.modeTitle}>Dark Mode</Text>
            <Text style={styles.modeDesc}>Easy on the eyes at night</Text>
          </View>
          {darkMode && <AppIcon name="checkmark" size={18} color={colors.primary} />}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f2ef', padding: 16 },
  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 40, marginBottom: 16 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: '#fff', marginTop: -1 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  // Sections
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sectionDesc: { fontSize: 12, color: '#6b7280', marginTop: 4, marginBottom: 14 },
  // Color grid
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorItem: { width: '22%', alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: 'transparent' },
  colorCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  checkmark: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  colorLabel: { fontSize: 11, color: '#6b7280' },
  // Appearance mode cards
  modeCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 10 },
  modeIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  modeIcon: { fontSize: 20 },
  modeTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  modeDesc: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  modeCheck: { fontSize: 18, fontWeight: 'bold', marginLeft: 8 },
});
