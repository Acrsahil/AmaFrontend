import { useEffect, useRef, useState } from "react";
import { WS_BASE_URL } from "../api/config";
import { getAccessToken } from "../api/index.js";

type MessageHandler = (data: { type: string; invoice_id?: string; status?: string }) => void;

const MIN_RECONNECT_MS = 3000;
const MAX_RECONNECT_MS = 30000;

export function useOrdersWebSocket(onMessage: MessageHandler) {
  const socketRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);

  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);

  const intentionalCloseRef = useRef(false);

  const [isConnected, setIsConnected] = useState(false);

  onMessageRef.current = onMessage;

  useEffect(() => {
    console.log("[WS] Hook mounted");

    intentionalCloseRef.current = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (intentionalCloseRef.current) return;

      clearReconnectTimer();

      const attempt = reconnectAttemptRef.current;
      const delay = Math.min(MIN_RECONNECT_MS * 2 ** attempt, MAX_RECONNECT_MS);

      reconnectAttemptRef.current = attempt + 1;

      console.log("[WS] Reconnecting in", delay, "ms");

      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    function connect() {
      if (intentionalCloseRef.current) return;

      const existing = socketRef.current;

      if (
        existing &&
        (existing.readyState === WebSocket.OPEN ||
          existing.readyState === WebSocket.CONNECTING)
      ) {
        console.log("[WS] Socket already active, skipping create");
        return;
      }

      const token = getAccessToken();
      let wsUrl = WS_BASE_URL + "/ws/orders/";
      if (token) wsUrl += `?token=${token}`;

      console.log("[WS] Creating new socket:", wsUrl);

      try {
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          console.log("[WS] Connected");
          reconnectAttemptRef.current = 0;
          setIsConnected(true);
        };

        socket.onmessage = (event) => {
          console.log("[WS] Message received:", event.data);

          try {
            const data = JSON.parse(event.data);
            onMessageRef.current(data);
          } catch (err) {
            console.error("[WS] Invalid JSON message:", err);
          }
        };

        socket.onerror = (err) => {
          console.error("[WS] Socket error:", err);
          socket.close();
        };

        socket.onclose = (event) => {
          console.log("[WS] Closed", {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });

          setIsConnected(false);
          socketRef.current = null;

          if (!intentionalCloseRef.current && !event.wasClean) {
            scheduleReconnect();
          }
        };

        socketRef.current = socket;
      } catch (err) {
        console.error("[WS] Failed to create socket:", err);
        scheduleReconnect();
      }
    }

    connect();

    return () => {
      console.log("[WS] Hook unmounted");

      intentionalCloseRef.current = true;

      clearReconnectTimer();

      const socket = socketRef.current;
      if (socket) {
        socket.close();
        socketRef.current = null;
      }

      setIsConnected(false);
    };
  }, []);

  return { socketRef, isConnected };
}
