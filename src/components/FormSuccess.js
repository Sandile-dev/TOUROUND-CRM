import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

/**
 * Inline form success display component.
 * Usage: <FormSuccess message={success} />
 */
export default function FormSuccess({ message }) {
  if (!message) return null;
  return (
    <View style={styles.container}>
      <Ionicons name="checkmark-circle" size={16} color="#16a34a" style={styles.icon} />
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
  icon: { marginRight: 8 },
  text: { flex: 1, fontSize: 13, color: '#166534', lineHeight: 18 },
});
