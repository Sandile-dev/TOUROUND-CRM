import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for API calls with caching, loading states, and refresh.
 * Prevents duplicate requests and stale closures.
 * 
 * Usage:
 *   const { data, loading, error, refresh } = useApi(() => businessService.getPosts(userId), [userId]);
 */
export default function useApi(apiCall, deps = [], options = {}) {
  const { enabled = true, initialData = null } = options;
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const callIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const execute = useCallback(async () => {
    if (!enabled) return;
    
    const callId = ++callIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const result = await apiCall();
      // Only update if this is still the latest call and component is mounted
      if (callId === callIdRef.current && mountedRef.current) {
        const list = Array.isArray(result) ? result : result?.content || result;
        setData(list);
      }
    } catch (err) {
      if (callId === callIdRef.current && mountedRef.current) {
        setError(err.message || 'An error occurred');
      }
    } finally {
      if (callId === callIdRef.current && mountedRef.current) {
        setLoading(false);
      }
    }
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, refresh: execute, setData };
}
