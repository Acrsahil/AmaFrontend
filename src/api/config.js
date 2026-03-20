/**
 * Centralized API configuration.
 * These values are pulled from the .env file in the frontend root.
 */

const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "https://api.amabakeryhouse.com";

// Ensure no trailing slash
export const API_BASE_URL = RAW_BASE.replace(/\/+$/, "");

// Derive WebSocket URL: http -> ws, https -> wss
// Using a more explicit replacement to avoid any ambiguity
export const WS_BASE_URL = API_BASE_URL.startsWith('https')
    ? API_BASE_URL.replace(/^https/, 'wss')
    : API_BASE_URL.replace(/^http/, 'ws');
