import React, { createContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Force proceed after 2 seconds no matter what
    const timer = setTimeout(() => {
      if (mounted && loading) setLoading(false);
    }, 2000);

    AsyncStorage.getItem('crm_user')
      .then((stored) => {
        if (mounted && stored) {
          try { setUser(JSON.parse(stored)); } catch {}
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
        clearTimeout(timer);
      });

    return () => { mounted = false; clearTimeout(timer); };
  }, []);

  const login = async (userData) => {
    setUser(userData);
    try { await AsyncStorage.setItem('crm_user', JSON.stringify(userData)); } catch {}
  };

  const updateUser = async (data) => {
    const updated = { ...user, ...data };
    setUser(updated);
    try { await AsyncStorage.setItem('crm_user', JSON.stringify(updated)); } catch {}
  };

  const logout = async () => {
    setUser(null);
    try {
      await AsyncStorage.removeItem('crm_user');
      await AsyncStorage.removeItem('crm_token');
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
