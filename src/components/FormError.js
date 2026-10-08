import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

/**
 * Inline form error display component.
 * Usage: <FormError message={error} />
 */
export default function FormError({ message }) {
  if (!message) return null;
  return (
    <View style={styles.container}>
      <Ionicons name="warning" size={16} color="#dc2626" style={styles.icon} />
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
  icon: { marginRight: 8 },
  text: { flex: 1, fontSize: 13, color: '#991b1b', lineHeight: 18 },
});
