/**
 * Centralized API configuration.
 * These values are pulled from the .env file in the frontend root.
 */

// const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "https://amabakerypos-production.up.railway.app";
const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "https://api.amabakeryhouse.com";

// const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";





// Ensure no trailing slash
export const API_BASE_URL = RAW_BASE.replace(/\/+$/, "");

// Derive WebSocket URL: http -> ws, https -> wss
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");

// Dashboard Polling configuration (30 seconds)
export const DASHBOARD_POLL_INTERVAL = 30000;
