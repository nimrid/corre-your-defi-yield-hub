import { usePrivy, useSigners } from "@privy-io/react-auth";
import { useEffect, useRef } from "react";

/**
 * Dedicated OAuth Login page for ChatGPT / Claude MCP connector.
 *
 * Flow:
 * 1. ChatGPT redirects user here with ?redirect_uri=...&state=...
 * 2. We store the OAuth params in sessionStorage (they survive Privy's login flow)
 * 3. We auto-trigger Privy login if user isn't authenticated
 * 4. Once authenticated, we delegate the agent signer (so in-chat signing works
 *    without a separate "Authorize Agent" step), then redirect back to ChatGPT
 */
const Login = () => {
  const { ready, authenticated, login, getAccessToken, user } = usePrivy();
  const { addSigners } = useSigners();
  const loginTriggered = useRef(false);
  const redirectTriggered = useRef(false);

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

  // Step 3: Once authenticated, delegate the agent signer, then redirect back to ChatGPT
  useEffect(() => {
    if (!ready || !authenticated) return;
    if (redirectTriggered.current) return;
    redirectTriggered.current = true;

    const redirectUri =
      new URLSearchParams(window.location.search).get("redirect_uri") ||
      sessionStorage.getItem("oauth_redirect_uri");
    const state =
      new URLSearchParams(window.location.search).get("state") ||
      sessionStorage.getItem("oauth_state");

    // Delegate the server-side agent signer to the user's embedded Solana wallet so
    // in-chat transactions can be signed without the separate "Authorize Agent" button.
    // Best-effort: never block the OAuth redirect if delegation fails (e.g. user
    // dismisses the prompt) — they can still authorize later from the web app.
    const ensureAgentDelegated = async () => {
      try {
        const signerId = import.meta.env.VITE_PRIVY_SIGNER_ID as string | undefined;
        if (!signerId || typeof addSigners !== "function") return;

        const solWallet = user?.linkedAccounts?.find(
          (a: any) =>
            (a.type === "wallet" || a.type === "solana") &&
            (a.chainType === "solana" ||
              a.chain_type === "solana" ||
              (a.address && !a.address.startsWith("0x"))) &&
            a.walletClientType === "privy"
        );

        if (!solWallet || (solWallet as any).delegated === true) return;

        await addSigners({
          address: (solWallet as any).address,
          signers: [{ signerId }],
        });
      } catch (err) {
        console.warn("[Login] Agent delegation skipped:", err);
      }
    };

    const finishRedirect = async () => {
      await ensureAgentDelegated();

      if (redirectUri && state) {
        try {
          const token = await getAccessToken();
          sessionStorage.removeItem("oauth_redirect_uri");
          sessionStorage.removeItem("oauth_state");

          if (token) {
            const separator = redirectUri.includes("?") ? "&" : "?";
            window.location.href = `${redirectUri}${separator}code=${encodeURIComponent(token)}&state=${encodeURIComponent(state)}`;
          } else {
            window.location.href = "/home";
          }
        } catch {
          sessionStorage.removeItem("oauth_redirect_uri");
          sessionStorage.removeItem("oauth_state");
          window.location.href = "/home";
        }
      } else {
        // No OAuth params — normal login, go to dashboard
        window.location.href = "/home";
      }
    };

    void finishRedirect();
  }, [ready, authenticated, getAccessToken, addSigners, user]);

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
            Securely signing you in and authorizing your AI agent with Privy. You'll be redirected back automatically.
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
