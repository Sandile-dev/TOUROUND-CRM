import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const themeColors = {
  blue: { primary: '#2bb5c4', hover: '#1a9aa8', light: '#e6f9fb', text: '#0e7a86' },
  purple: { primary: '#9333ea', hover: '#7e22ce', light: '#faf5ff', text: '#6b21a8' },
  green: { primary: '#16a34a', hover: '#15803d', light: '#f0fdf4', text: '#166534' },
  red: { primary: '#dc2626', hover: '#b91c1c', light: '#fef2f2', text: '#991b1b' },
  orange: { primary: '#ea580c', hover: '#c2410c', light: '#fff7ed', text: '#9a3412' },
  teal: { primary: '#0d9488', hover: '#0f766e', light: '#f0fdfa', text: '#115e59' },
  pink: { primary: '#db2777', hover: '#be185d', light: '#fdf2f8', text: '#9d174d' },
  indigo: { primary: '#4f46e5', hover: '#4338ca', light: '#eef2ff', text: '#3730a3' },
};

export function ThemeProvider({ children }) {
  const [themeColor, setThemeColorState] = useState('blue');
  const [darkMode, setDarkModeState] = useState(false);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const color = await AsyncStorage.getItem('crm_theme_color');
      const dark = await AsyncStorage.getItem('crm_dark_mode');
      if (color) setThemeColorState(color);
      if (dark === 'true') setDarkModeState(true);
    } catch {
      // ignore
    }
  };

  const setThemeColor = async (color) => {
    setThemeColorState(color);
    await AsyncStorage.setItem('crm_theme_color', color);
  };

  const setDarkMode = async (value) => {
    setDarkModeState(value);
    await AsyncStorage.setItem('crm_dark_mode', String(value));
  };

  const colors = themeColors[themeColor] || themeColors.blue;

  return (
    <ThemeContext.Provider value={{ themeColor, setThemeColor, darkMode, setDarkMode, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
