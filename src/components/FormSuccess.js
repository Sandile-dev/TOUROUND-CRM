import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Inline form success display component.
 * Usage: <FormSuccess message={success} />
 */
export default function FormSuccess({ message }) {
  if (!message) return null;
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>✓</Text>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  icon: { fontSize: 14, marginRight: 8, color: '#16a34a' },
  text: { flex: 1, fontSize: 13, color: '#166534', lineHeight: 18 },
});
