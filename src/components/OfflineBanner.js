import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

/**
 * Shows a banner when the device is offline.
 * Uses a simple fetch check since NetInfo requires a separate package.
 */
export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 15000);
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    try {
      if (Platform.OS === 'web') {
        setIsOffline(!navigator.onLine);
        return;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      await fetch('https://clients3.google.com/generate_204', { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeout);
      setIsOffline(false);
    } catch {
      setIsOffline(true);
    }
  };

  if (!isOffline) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>No internet connection</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#374151', paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center' },
  text: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
