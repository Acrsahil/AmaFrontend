import { useEffect, useRef } from 'react';

/**
 * Reliable polling hook for dashboard data.
 * Runs callback immediately on mount, then every `interval` ms.
 *
 * @param callback Async function to fetch data
 * @param interval Polling interval in ms (default: 10 000 ms = 10s)
 * @param dependencies Restart polling when these change
 */
export const useDashboardPolling = (
  callback: () => Promise<void> | void,
  interval: number = 10000, // Default 10s
  dependencies: any[] = []
) => {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  });

  useEffect(() => {
    // Run immediately on mount
    savedCallback.current();

    const id = setInterval(() => savedCallback.current(), interval);

    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval, ...dependencies]);
};
