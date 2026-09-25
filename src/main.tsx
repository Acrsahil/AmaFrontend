import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeAuth } from "./api/index.js";

// Add global error handler for debugging iPad issues
window.addEventListener('error', (e) => {
    console.error('[Global Error]', e.error || e.message);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('[Unhandled Promise Rejection]', e.reason);
});

// iPad compatibility check and fixes
const isIPad = /iPad|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;
if (isIPad) {
    console.log('[iPad Detected] Applying compatibility fixes');
    
    // Prevent viewport issues
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    
    // Fix 100vh on iOS Safari
    const setViewportHeight = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);
}

const rootElement = document.getElementById("root");

if (!rootElement) {
    console.error('[Critical] Root element not found!');
    document.body.innerHTML = '<div style="padding:20px;font-family:sans-serif;"><h1>Error</h1><p>Root element missing. Please refresh.</p></div>';
} else {
    const root = createRoot(rootElement);

    // Initialize auth session from refresh token before rendering
    initializeAuth()
        .then(() => {
            console.log('[Init] Auth initialized, rendering app...');
            root.render(<App />);
        })
        .catch((err) => {
            console.error('[Init Error]', err);
            // Render anyway to show login screen
            root.render(<App />);
        });
}
