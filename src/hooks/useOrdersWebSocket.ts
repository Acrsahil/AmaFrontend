import { useEffect, useRef, useState, useCallback } from "react";
import { WS_BASE_URL } from "../api/config";
import { getAccessToken } from "../api/index.js";

type MessageHandler = (data: { type: string; invoice_id?: string; status?: string;[key: string]: any }) => void;

// WebSocket connection constants
const MIN_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 30000;
const HEARTBEAT_INTERVAL_MS = 15000; // Send ping every 15 seconds
const HEARTBEAT_TIMEOUT_MS = 30000; // Expect pong within 30 seconds
const MAX_RECONNECT_ATTEMPTS = 50;

// Message deduplication cache
const processedMessages = new Set<string>();
const MESSAGE_CACHE_TTL = 5000; // 5 seconds

export function useOrdersWebSocket(onMessage: MessageHandler, branchId?: string | number | null) {
  const socketRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const lastHeartbeatRef = useRef<number>(Date.now());

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const hasSentHeartbeatRef = useRef(false);

  onMessageRef.current = onMessage;

  // Generate unique message ID for deduplication
  const generateMessageId = useCallback((data: any): string => {
    return `${data.type}_${data.invoice_id}_${Date.now()}_${Math.random()}`;
  }, []);

  // Check if message is a duplicate
  const isDuplicateMessage = useCallback((messageId: string): boolean => {
    const now = Date.now();

    // Clean old messages from cache
    for (const id of processedMessages) {
      if (now - parseInt(id.split('_')[2]) > MESSAGE_CACHE_TTL) {
        processedMessages.delete(id);
      }
    }

    if (processedMessages.has(messageId)) {
      return true;
    }

    processedMessages.add(messageId);
    return false;
  }, []);

  // Send heartbeat to keep connection alive
  const sendHeartbeat = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      try {
        socketRef.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        lastHeartbeatRef.current = Date.now();
        hasSentHeartbeatRef.current = true;
      } catch (err) {
        console.error("[WS] Heartbeat send failed:", err);
      }
    }
  }, []);

  // Check heartbeat timeout
  const checkHeartbeatTimeout = useCallback(() => {
    // Skip check if we haven't sent a heartbeat yet
    if (!hasSentHeartbeatRef.current) {
      return;
    }

    const timeSinceLastHeartbeat = Date.now() - lastHeartbeatRef.current;
    if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT_MS && socketRef.current?.readyState === WebSocket.OPEN) {
      console.warn(`[WS] Heartbeat timeout: ${timeSinceLastHeartbeat}ms since last heartbeat, closing connection`);
      socketRef.current.close();
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const clearHeartbeatTimers = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (intentionalCloseRef.current) return;

    clearReconnectTimer();

    const attempt = reconnectAttemptRef.current;
    if (attempt >= MAX_RECONNECT_ATTEMPTS) {
      console.error("[WS] Max reconnection attempts reached");
      setConnectionStatus('disconnected');
      return;
    }

    const delay = Math.min(MIN_RECONNECT_MS * Math.pow(2, attempt), MAX_RECONNECT_MS);

    reconnectAttemptRef.current = attempt + 1;

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS})`);
    setConnectionStatus('reconnecting');

    reconnectTimerRef.current = setTimeout(connect, delay);
  }, [clearReconnectTimer]);

  const connect = useCallback(() => {
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
    // Build URL with branch_id if available
    let wsUrl = branchId
      ? `${WS_BASE_URL}/ws/orders/${branchId}/`
      : `${WS_BASE_URL}/ws/orders/`;
    if (token) wsUrl += `?token=${token}`;

    console.log("[WS] Creating new socket with branch_id:", branchId || "none", "URL:", wsUrl);
    setConnectionStatus('connecting');

    try {
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("[WS] Connected successfully");
        reconnectAttemptRef.current = 0;
        lastHeartbeatRef.current = Date.now();
        hasSentHeartbeatRef.current = false;
        setIsConnected(true);
        setConnectionStatus('connected');

        // Start heartbeat
        clearHeartbeatTimers();
        // Send first heartbeat immediately
        console.log("[WS] Sending initial heartbeat...");
        sendHeartbeat();
        // Then send periodically
        heartbeatTimerRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
        // Start timeout checker after HEARTBEAT_TIMEOUT_MS to give time for first pong response
        heartbeatTimeoutRef.current = setTimeout(() => {
          console.log("[WS] Starting heartbeat timeout checker...");
          heartbeatTimeoutRef.current = setInterval(checkHeartbeatTimeout, HEARTBEAT_TIMEOUT_MS / 2);
        }, HEARTBEAT_TIMEOUT_MS);
      };

      socket.onmessage = (event) => {
        console.log("[WS] Message received:", event.data);

        try {
          const data = JSON.parse(event.data);

          // Handle pong responses
          if (data.type === 'pong') {
            console.log("[WS] Pong received, updating heartbeat timestamp");
            lastHeartbeatRef.current = Date.now();
            return;
          }

          // Log other message types
          console.log("[WS] Processing message:", data.type, data.invoice_id || 'no invoice');

          // Deduplicate messages
          const messageId = generateMessageId(data);
          if (isDuplicateMessage(messageId)) {
            console.log("[WS] Duplicate message ignored:", data.type, data.invoice_id);
            return;
          }

          onMessageRef.current(data);
        } catch (err) {
          console.error("[WS] Invalid JSON message:", err);
        }
      };

      socket.onerror = (err) => {
        console.error("[WS] Socket error:", err);
      };

      socket.onclose = (event) => {
        console.log("[WS] Connection closed", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });

        setIsConnected(false);
        setConnectionStatus('disconnected');
        socketRef.current = null;
        clearHeartbeatTimers();

        if (!intentionalCloseRef.current) {
          console.log("[WS] Unexpected close, scheduling reconnect");
          scheduleReconnect();
        }
      };

      socketRef.current = socket;
    } catch (err) {
      console.error("[WS] Failed to create socket:", err);
      scheduleReconnect();
    }
  }, [clearHeartbeatTimers, sendHeartbeat, checkHeartbeatTimeout, scheduleReconnect, generateMessageId, isDuplicateMessage, branchId]);

  // Expose manual connect/disconnect for logout
  const disconnect = useCallback(() => {
    console.log("[WS] Manual disconnect requested");
    intentionalCloseRef.current = true;
    clearReconnectTimer();
    clearHeartbeatTimers();

    const socket = socketRef.current;
    if (socket) {
      socket.close(1000, "User logged out");
      socketRef.current = null;
    }

    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, [clearReconnectTimer, clearHeartbeatTimers]);

  useEffect(() => {
    console.log("[WS] Hook mounted, connecting...");
    intentionalCloseRef.current = false;
    connect();

    return () => {
      console.log("[WS] Hook unmounting, cleaning up...");
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      clearHeartbeatTimers();

      const socket = socketRef.current;
      if (socket) {
        socket.close(1000, "Component unmounted");
        socketRef.current = null;
      }

      setIsConnected(false);
      setConnectionStatus('disconnected');
    };
  }, [connect, clearReconnectTimer, clearHeartbeatTimers]);

  return {
    socketRef,
    isConnected,
    connectionStatus,
    disconnect
  };
}