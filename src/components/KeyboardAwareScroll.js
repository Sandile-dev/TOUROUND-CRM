import React from 'react';
import { KeyboardAvoidingView, ScrollView, Platform, StyleSheet } from 'react-native';

/**
 * A scroll container that keeps the focused input visible above the keyboard.
 *
 * - On iOS, KeyboardAvoidingView with `padding` lifts content above the keyboard.
 * - On Android, `adjustResize` (Expo default) resizes the window; the ScrollView
 *   then lets the focused field scroll into view.
 * - `keyboardShouldPersistTaps="handled"` lets taps on buttons work while the
 *   keyboard is open without an extra dismiss tap.
 *
 * Use this in place of a plain ScrollView for any form screen.
 */
export default function KeyboardAwareScroll({
  children,
  style,
  contentContainerStyle,
  keyboardVerticalOffset = 0,
  ...scrollProps
}) {
  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        {...scrollProps}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Extra bottom padding so the last fields/buttons clear the keyboard.
  content: { paddingBottom: 120 },
});
