import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

export function useSessionMonitor() {
  const [sessionExpired, setSessionExpired] = useState(false);
  const { getAccessToken, authenticated } = usePrivy();

  // Listen for 401 responses from API calls
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

  // Periodically check token validity (every 5 minutes)
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

  return { sessionExpired, setSessionExpired };
}
