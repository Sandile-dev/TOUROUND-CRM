import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Local notification helper. The app polls the backend for notifications;
 * when new ones arrive we fire a LOCAL notification so the phone plays its
 * notification sound (and shows a banner) even while the app is foregrounded.
 */

// Show alert + play sound even when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    // Back-compat fields for older expo-notifications signatures.
    shouldShowAlert: true,
  }),
});

let initialized = false;

/**
 * Request permission and set up the Android channel (with sound).
 * Safe to call multiple times; only runs setup once.
 * Returns true if notifications are permitted.
 */
export async function initNotifications() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2bb5c4',
      });
    }

    if (!initialized) {
      const settings = await Notifications.getPermissionsAsync();
      let granted = settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
      if (!granted) {
        const req = await Notifications.requestPermissionsAsync();
        granted = req.granted;
      }
      initialized = true;
      return granted;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Fire an immediate local notification (plays the phone's notification sound).
 * @param {string} title
 * @param {string} body
 */
export async function presentLocalNotification(title, body) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title || 'New notification',
        body: body || '',
        sound: 'default',
        // On Android the sound/vibration comes from the channel, so deliver to
        // the sound-enabled `default` channel we set up in initNotifications.
        ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
      },
      trigger:
        Platform.OS === 'android'
          ? { channelId: 'default' } // immediate, routed to the sound channel
          : null, // iOS: deliver immediately
    });
  } catch {
    // Ignore — notification is best-effort.
  }
}
