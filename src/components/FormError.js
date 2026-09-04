import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Inline form error display component.
 * Usage: <FormError message={error} />
 */
export default function FormError({ message }) {
  if (!message) return null;
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  icon: { fontSize: 14, marginRight: 8 },
  text: { flex: 1, fontSize: 13, color: '#991b1b', lineHeight: 18 },
});
