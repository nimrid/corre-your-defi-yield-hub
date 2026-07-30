import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef } from "react";

/**
 * Dedicated OAuth Login page for ChatGPT / Claude MCP connector.
 *
 * Flow:
 * 1. ChatGPT redirects user here with ?redirect_uri=...&state=...
 * 2. We store the OAuth params in sessionStorage (they survive Privy's login flow)
 * 3. We auto-trigger Privy login if user isn't authenticated
 * 4. Once authenticated, we grab the Privy access token and redirect back to ChatGPT
 */
const Login = () => {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const loginTriggered = useRef(false);

  // Step 1: On mount, persist OAuth params so they survive Privy redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirectUri = params.get("redirect_uri");
    const state = params.get("state");

    if (redirectUri) {
      sessionStorage.setItem("oauth_redirect_uri", redirectUri);
    }
    if (state) {
      sessionStorage.setItem("oauth_state", state);
    }
  }, []);

  // Step 2: Auto-trigger Privy login if not authenticated
  useEffect(() => {
    if (ready && !authenticated && !loginTriggered.current) {
      loginTriggered.current = true;
      login();
    }
  }, [ready, authenticated, login]);

  // Step 3: Once authenticated, get access token and redirect back to ChatGPT
  useEffect(() => {
    if (!ready || !authenticated) return;

    const redirectUri =
      new URLSearchParams(window.location.search).get("redirect_uri") ||
      sessionStorage.getItem("oauth_redirect_uri");
    const state =
      new URLSearchParams(window.location.search).get("state") ||
      sessionStorage.getItem("oauth_state");

    if (redirectUri && state) {
      void getAccessToken().then((token) => {
        // Clean up
        sessionStorage.removeItem("oauth_redirect_uri");
        sessionStorage.removeItem("oauth_state");

        if (token) {
          const separator = redirectUri.includes("?") ? "&" : "?";
          window.location.href = `${redirectUri}${separator}code=${encodeURIComponent(token)}&state=${encodeURIComponent(state)}`;
        } else {
          // Fallback: redirect to home if token retrieval fails
          window.location.href = "/home";
        }
      }).catch(() => {
        sessionStorage.removeItem("oauth_redirect_uri");
        sessionStorage.removeItem("oauth_state");
        window.location.href = "/home";
      });
    } else {
      // No OAuth params — normal login, go to dashboard
      window.location.href = "/home";
    }
  }, [ready, authenticated, getAccessToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background via-background to-muted text-foreground px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/80 shadow-sm px-6 py-8 space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">
            Connecting to Corre
          </h1>
          <p className="text-sm text-muted-foreground">
            Securely signing you in with Privy. You'll be redirected back automatically.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
          <span className="relative inline-flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
          </span>
          <span>Authenticating...</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
