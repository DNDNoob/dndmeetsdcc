import { useRef, useCallback, useEffect } from 'react';

/**
 * Returns a debounced version of the callback that delays invoking until
 * after `delay` milliseconds have elapsed since the last invocation.
 *
 * @param callback The function to debounce
 * @param delay The debounce delay in milliseconds
 * @returns A debounced version of the callback
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
      timeoutRef.current = null;
    }, delay);
  }, [delay]);
}

/**
 * Returns a debounced version of the callback that invokes immediately on the first call,
 * then debounces subsequent calls. Useful for real-time sync where you want immediate
 * feedback but want to batch rapid updates.
 *
 * @param callback The function to debounce
 * @param delay The debounce delay in milliseconds for subsequent calls
 * @returns A leading-edge debounced version of the callback
 */
export function useLeadingDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCallRef = useRef<number>(0);
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();

    // If enough time has passed, invoke immediately
    if (now - lastCallRef.current >= delay) {
      lastCallRef.current = now;
      callbackRef.current(...args);
      return;
    }

    // Otherwise, debounce
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      lastCallRef.current = Date.now();
      callbackRef.current(...args);
      timeoutRef.current = null;
    }, delay - (now - lastCallRef.current));
  }, [delay]);
}

/**
 * A throttled callback that invokes at most once per `delay` milliseconds.
 * Unlike debounce, this ensures the callback is called at regular intervals
 * during continuous invocations.
 *
 * @param callback The function to throttle
 * @param delay The minimum time between invocations in milliseconds
 * @returns A throttled version of the callback
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const lastCallRef = useRef<number>(0);
  const pendingArgsRef = useRef<Parameters<T> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallRef.current;

    if (timeSinceLastCall >= delay) {
      // Enough time has passed, invoke immediately
      lastCallRef.current = now;
      callbackRef.current(...args);
      pendingArgsRef.current = null;
    } else {
      // Store args and schedule for later
      pendingArgsRef.current = args;

      if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          if (pendingArgsRef.current) {
            lastCallRef.current = Date.now();
            callbackRef.current(...pendingArgsRef.current);
            pendingArgsRef.current = null;
          }
          timeoutRef.current = null;
        }, delay - timeSinceLastCall);
      }
    }
  }, [delay]);
}
