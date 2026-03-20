import { useEffect, useRef, useCallback, useState } from "react";
import { WS_BASE_URL } from "../api/config";
import { getAccessToken } from "../api/index.js";

type MessageHandler = (data: { type: string; invoice_id?: string; status?: string }) => void;

export function useOrdersWebSocket(onMessage: MessageHandler) {
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    const token = getAccessToken();
    let wsUrl = WS_BASE_URL + "/ws/orders/";

    // Append token if available
    if (token) {
      wsUrl += `?token=${token}`;
    }

    console.log(`[Orders WS] Connecting to ${wsUrl.split('?')[0]}`);

    try {
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("[Orders WS] Connected successfully");
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch {
          // Ignore malformed messages
        }
      };

      socket.onclose = (event) => {
        setIsConnected(false);
        if (!event.wasClean) {
          console.warn("[Orders WS] Connection closed, reconnecting in 3s...");
          setTimeout(connect, 3000);
        }
      };

      socket.onerror = () => {
        socket.close();
      };

      socketRef.current = socket;
    } catch (err) {
      console.error("[Orders WS] Setup error:", err);
      setTimeout(connect, 3000);
    }
  }, [onMessage]);

  useEffect(() => {
    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  return { socketRef, isConnected };
}
