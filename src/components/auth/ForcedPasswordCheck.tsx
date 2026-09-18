import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { isLoggedIn, getCurrentUser } from "@/auth/auth";
import { API_BASE_URL } from "@/api/config";
import { ChangePasswordModal } from "./ChangePasswordModal";

export function ForcedPasswordCheck() {
    const location = useLocation();
    const [mustChange, setMustChange] = useState(false);
    const [detectedOldPassword, setDetectedOldPassword] = useState("");

    const isLoginPage = location.pathname === "/login" || location.pathname === "/super-admin";

    const evaluatePasswordStatus = useCallback(async () => {
        if (!isLoggedIn() || isLoginPage) {
            setMustChange(false);
            return;
        }

        // 1. Check flag set during login
        const storedMustChange = localStorage.getItem("mustChangePassword");
        const storedOldPw = localStorage.getItem("defaultPasswordUsed");

        if (storedMustChange === "true") {
            setDetectedOldPassword(storedOldPw || "amabakery@123");
            setMustChange(true);
            return;
        }

        const user = getCurrentUser();
        if (!user?.username) return;

        // Check if we already evaluated this session for this user
        const sessionKey = "checked_default_pw_" + (user.id || user.username);
        const cachedStatus = sessionStorage.getItem(sessionKey);
        if (cachedStatus === "changed") {
            setMustChange(false);
            return;
        }
        if (cachedStatus === "default") {
            setDetectedOldPassword("amabakery@123");
            setMustChange(true);
            return;
        }

        // 2. Probe backend with default passwords to see if credentials still match
        const defaultCandidates = ["amabakery@123", "123"];
        let isDefault = false;
        let matchedCandidate = "";

        for (const candidate of defaultCandidates) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/token/`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        username: user.username,
                        password: candidate,
                    }),
                });

                if (response.ok) {
                    isDefault = true;
                    matchedCandidate = candidate;
                    break;
                }
            } catch (err) {
                console.error("Default password probe failed:", err);
            }
        }

        if (isDefault) {
            localStorage.setItem("mustChangePassword", "true");
            localStorage.setItem("defaultPasswordUsed", matchedCandidate);
            sessionStorage.setItem(sessionKey, "default");
            setDetectedOldPassword(matchedCandidate);
            setMustChange(true);
        } else {
            sessionStorage.setItem(sessionKey, "changed");
            localStorage.removeItem("mustChangePassword");
            localStorage.removeItem("defaultPasswordUsed");
            setMustChange(false);
        }
    }, [isLoginPage]);

    useEffect(() => {
        evaluatePasswordStatus();

        const handlePasswordChanged = () => {
            setMustChange(false);
            setDetectedOldPassword("");
        };

        window.addEventListener("password-changed", handlePasswordChanged);
        return () => {
            window.removeEventListener("password-changed", handlePasswordChanged);
        };
    }, [evaluatePasswordStatus]);

    if (!mustChange || isLoginPage) {
        return null;
    }

    return (
        <ChangePasswordModal
            isOpen={mustChange}
            onClose={() => setMustChange(false)}
            isForced={true}
            defaultOldPassword={detectedOldPassword || "amabakery@123"}
        />
    );
}
