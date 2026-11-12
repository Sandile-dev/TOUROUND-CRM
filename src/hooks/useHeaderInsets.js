import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Returns `paddingTop` and `marginTop` values for screen headers that account
 * for the device safe-area (notch, Dynamic Island, status bar on Android).
 *
 * Usage in a StyleSheet:
 *   const { headerPaddingTop } = useHeaderInsets();
 *   <View style={[styles.headerRow, { paddingTop: headerPaddingTop }]}>
 *
 * The minimum is clamped to 12 so the header always has some top breathing room.
 */
export default function useHeaderInsets() {
  const insets = useSafeAreaInsets();
  const headerPaddingTop = Math.max(insets.top, 12);
  return { headerPaddingTop, insets };
}
