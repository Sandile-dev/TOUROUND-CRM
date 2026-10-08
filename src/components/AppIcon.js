import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

/**
 * App-wide icon component built on Ionicons.
 *
 * Defaults the icon color to the active theme's primary color so icons stay in
 * step with the app's palette. Pass an explicit `color` to override (e.g. for
 * destructive actions or icons on colored backgrounds).
 *
 * Usage: <AppIcon name="camera-outline" size={18} />
 */
export default function AppIcon({ name, size = 20, color, style, ...rest }) {
  const { colors } = useTheme();
  return (
    <Ionicons
      name={name}
      size={size}
      color={color || colors.primary}
      style={style}
      {...rest}
    />
  );
}
