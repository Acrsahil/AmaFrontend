import { useEffect, useRef, useCallback, useState } from "react";
import { WS_BASE_URL } from "../api/config";
import { getAccessToken } from "../api/index.js";

export function useDashboardWebSocket(branchId: number | string | null | undefined, onUpdate: () => void) {
    const socketRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const connect = useCallback(() => {
        const token = getAccessToken();
        let wsUrl = branchId
            ? `${WS_BASE_URL}/ws/dashboard/${branchId}/`
            : `${WS_BASE_URL}/ws/dashboard/`;

        // Append token if available for authentication in cross-origin production environments
        if (token) {
            wsUrl += `?token=${token}`;
        }

        console.log(`[Dashboard WS] Connecting to ${wsUrl.split('?')[0]}`);

        try {
            const socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.log(`[Dashboard WS] Connected successfully`);
                setIsConnected(true);
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === "dashboard_update") {
                        console.log("[Dashboard WS] Update received");
                        onUpdate();
                    }
                } catch (err) {
                    console.error("[Dashboard WS] Parse error:", err);
                }
            };

            socket.onclose = (event) => {
                setIsConnected(false);
                if (event.wasClean) {
                    console.log(`[Dashboard WS] Connection closed cleanly`);
                } else {
                    console.warn(`[Dashboard WS] Connection died. Reconnecting in 5s...`);
                    setTimeout(connect, 5000);
                }
            };

            socket.onerror = (err) => {
                console.error("[Dashboard WS] Error:", err);
                // socket.close() will trigger onclose and then reconnect
                socket.close();
            };

            socketRef.current = socket;
        } catch (err) {
            console.error("[Dashboard WS] Connection failure:", err);
            setTimeout(connect, 5000); // Retry on initial failure
        }
    }, [branchId, onUpdate]);

    useEffect(() => {
        connect();
        return () => {
            if (socketRef.current) {
                console.log("[Dashboard WS] Cleaning up connection");
                socketRef.current.close();
            }
        };
    }, [connect]);

    return { socketRef, isConnected };
}
