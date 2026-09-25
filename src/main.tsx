import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeAuth } from "./api/index.js";

const root = createRoot(document.getElementById("root")!);

// Initialize auth session from refresh token before rendering
initializeAuth().finally(() => {
    root.render(<App />);
});
