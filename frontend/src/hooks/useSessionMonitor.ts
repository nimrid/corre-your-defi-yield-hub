import { useEffect, useState, useCallback, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 Hour
const STORAGE_KEY = "corre_last_active_timestamp";
const THROTTLE_MS = 10_000; // Only write to localStorage every 10s

export function useSessionMonitor() {
  const [sessionExpired, setSessionExpired] = useState(false);
  const { getAccessToken, authenticated, logout } = usePrivy();
  const lastWriteRef = useRef<number>(Date.now());

  // Record user activity (throttled)
  const updateActivity = useCallback(() => {
    if (!authenticated) return;
    const now = Date.now();
    if (now - lastWriteRef.current > THROTTLE_MS) {
      lastWriteRef.current = now;
      try {
        localStorage.setItem(STORAGE_KEY, now.toString());
      } catch {}
    }
  }, [authenticated]);

  // Check if user has exceeded inactivity threshold
  const checkInactivity = useCallback(async () => {
    if (!authenticated) return;

    const storedLastActive = Number(localStorage.getItem(STORAGE_KEY) || Date.now());
    const elapsed = Date.now() - storedLastActive;

    if (elapsed >= INACTIVITY_TIMEOUT_MS) {
      console.warn("[SessionMonitor] 1 hour of inactivity reached. Logging out...");
      try {
        localStorage.removeItem(STORAGE_KEY);
        await logout();
      } catch (error) {
        console.error("[SessionMonitor] Logout failed:", error);
      }
      setSessionExpired(true);
    }
  }, [authenticated, logout]);

  // 1. Listen for 401 responses from API calls
  useEffect(() => {
    const handleUnauthorized = (event: Event) => {
      const customEvent = event as CustomEvent<{ status: number }>;
      if (customEvent.detail?.status === 401) {
        setSessionExpired(true);
      }
    };

    window.addEventListener("api:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("api:unauthorized", handleUnauthorized);
    };
  }, []);

  // 2. Periodically check token validity with Privy (every 5 minutes)
  useEffect(() => {
    if (!authenticated) return;

    const checkTokenValidity = async () => {
      try {
        await getAccessToken();
      } catch (error) {
        console.error("[useSessionMonitor] Token check failed:", error);
        setSessionExpired(true);
      }
    };

    const interval = setInterval(checkTokenValidity, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [authenticated, getAccessToken]);

  // 3. User inactivity tracking & Wake-from-sleep listener
  useEffect(() => {
    if (!authenticated) return;

    // Initialize timestamp on login/mount
    const now = Date.now();
    lastWriteRef.current = now;
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, now.toString());
      }
    } catch {}

    // Track user input events
    const events = ["mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((evt) => window.addEventListener(evt, updateActivity, { passive: true }));

    // Check inactivity when tab becomes visible or gains focus (handles device sleep / tab wake)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkInactivity();
      }
    };
    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", checkInactivity);

    // Cross-tab synchronization: if another tab updates the timestamp, refresh local ref
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        lastWriteRef.current = Number(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // Periodic check every 30 seconds
    const interval = setInterval(checkInactivity, 30_000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, updateActivity));
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", checkInactivity);
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [authenticated, updateActivity, checkInactivity]);

  return { sessionExpired, setSessionExpired };
}

