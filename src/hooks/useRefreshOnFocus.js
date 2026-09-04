import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Hook that calls a refresh function every time the screen comes into focus.
 * Skips the first mount (initial load handled by useEffect).
 */
export default function useRefreshOnFocus(refetch) {
  const firstTimeRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (firstTimeRef.current) {
        firstTimeRef.current = false;
        return;
      }
      refetch();
    }, [refetch])
  );
}
