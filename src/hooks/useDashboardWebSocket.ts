import { useEffect, useRef, useCallback } from "react";
import { WS_BASE_URL } from "../api/config";

type MessageHandler = (data: { type: string; branch_id?: string; message?: string }) => void;

export function useDashboardWebSocket(branchId: number | string | null | undefined, onUpdate: () => void) {
    const socketRef = useRef<WebSocket | null>(null);

    const connect = useCallback(() => {
        // If branchId is null/undefined, it's global
        const wsUrl = branchId
            ? `${WS_BASE_URL}/ws/dashboard/${branchId}/`
            : `${WS_BASE_URL}/ws/dashboard/`;

        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log(`[WS] Dashboard socket connected (${branchId ? 'branch:' + branchId : 'global'})`);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === "dashboard_update") {
                    console.log("[WS] Dashboard update received, triggering refresh...");
                    onUpdate();
                }
            } catch (err) {
                console.error("[WS] Failed to parse dashboard message:", err);
            }
        };

        socket.onclose = () => {
            console.log("[WS] Dashboard socket closed, reconnecting in 3s...");
            setTimeout(connect, 3000);
        };

        socket.onerror = () => {
            socket.close();
        };

        socketRef.current = socket;
    }, [branchId, onUpdate]);

    useEffect(() => {
        connect();

        return () => {
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, [connect]);

    return socketRef;
}
