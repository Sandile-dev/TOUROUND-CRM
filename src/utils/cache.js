import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cache utilities for managing app state.
 */
const cache = {
  /**
   * Clear all cached data (except auth token/user).
   * Call on app reload or when data seems stale.
   */
  clearAppCache: async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const keysToRemove = keys.filter(k => !k.startsWith('crm_'));
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
    } catch {}
  },

  /**
   * Clear everything including auth data (full reset).
   */
  clearAll: async () => {
    try {
      await AsyncStorage.clear();
    } catch {}
  },

  /**
   * Store temporary data with expiry.
   */
  setWithExpiry: async (key, value, ttlMinutes = 30) => {
    try {
      const item = {
        value,
        expiry: Date.now() + ttlMinutes * 60 * 1000,
      };
      await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(item));
    } catch {}
  },

  /**
   * Get cached data (returns null if expired).
   */
  getWithExpiry: async (key) => {
    try {
      const raw = await AsyncStorage.getItem(`cache_${key}`);
      if (!raw) return null;
      const item = JSON.parse(raw);
      if (Date.now() > item.expiry) {
        await AsyncStorage.removeItem(`cache_${key}`);
        return null;
      }
      return item.value;
    } catch {
      return null;
    }
  },
};

export default cache;
