import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import * as ExpoInAppUpdates from 'expo-in-app-updates';

/**
 * Checks the store for a newer published version on startup and prompts/applies
 * the update in-app — so users don't have to update manually from the store.
 *
 * - Android: uses Google Play's native in-app updates. `checkAndStartUpdate()`
 *   detects a newer Play Store version and launches the native update flow
 *   (flexible or immediate, based on the Play Console release priority).
 * - iOS: there's no native in-app update API, so we check the App Store version
 *   and, if newer, prompt the user and open the store product sheet.
 * - Web / dev builds: no-op.
 */
export default function useInAppUpdates() {
  useEffect(() => {
    if (__DEV__ || Platform.OS === 'web') return;

    const checkForUpdates = async () => {
      try {
        if (Platform.OS === 'android') {
          // Play Store decides flexible vs immediate from the release priority.
          await ExpoInAppUpdates.checkAndStartUpdate();
          return;
        }

        // iOS: prompt then open the App Store product sheet.
        const result = await ExpoInAppUpdates.checkForUpdate();
        if (!result?.updateAvailable) return;
        Alert.alert(
          'Update Available',
          'A new version of Touround CRM is available. Would you like to update now?',
          [
            {
              text: 'Update',
              isPreferred: true,
              onPress: async () => {
                try { await ExpoInAppUpdates.startUpdate(); } catch {}
              },
            },
            { text: 'Later', style: 'cancel' },
          ]
        );
      } catch {
        // Never block app launch on an update-check failure.
      }
    };

    checkForUpdates();
  }, []);
}
