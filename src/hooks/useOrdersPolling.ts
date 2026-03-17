import { useEffect, useRef } from "react";

type PollingCallback = () => void;

/**
 * Reliable polling hook — runs callback immediately on mount,
 * then repeats every `interval` ms.
 *
 * @param onUpdate Callback to run (e.g. loadInvoices / loadData)
 * @param interval Polling interval in ms (default: 10 000 ms = 10s)
 */
export function useOrdersPolling(onUpdate: PollingCallback, interval: number = 10000) {
    const savedCallback = useRef<PollingCallback>(onUpdate);

    // Keep callback ref up to date without restarting the interval
    useEffect(() => {
        savedCallback.current = onUpdate;
    });

    useEffect(() => {
        // Run immediately on mount
        savedCallback.current();

        // Then run every `interval` ms
        const id = setInterval(() => savedCallback.current(), interval);

        return () => clearInterval(id);
    }, [interval]);

    return {
        refresh: () => savedCallback.current()
    };
}
