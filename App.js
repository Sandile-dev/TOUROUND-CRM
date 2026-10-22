import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { AlertProvider } from './src/context/AlertContext';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import OfflineBanner from './src/components/OfflineBanner';
import useInAppUpdates from './src/hooks/useInAppUpdates';

export default function App() {
  // Auto-detect and apply new store versions on startup (Play Store in-app update).
  useInAppUpdates();

  useEffect(() => {
    // Clear app cache on fresh start (keep auth data)
    clearAppCache();
  }, []);

  const clearAppCache = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      // Keep auth-related keys, clear everything else
      const keysToKeep = ['crm_user', 'crm_token', 'crm_theme_color', 'crm_dark_mode'];
      const keysToRemove = keys.filter(k => !keysToKeep.includes(k));
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
    } catch {}
  };

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <AlertProvider>
              <NavigationContainer>
                <OfflineBanner />
                <AppNavigator />
                <StatusBar style="dark" />
              </NavigationContainer>
            </AlertProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
