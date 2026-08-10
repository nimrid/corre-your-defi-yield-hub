/**
 * Generates self-contained HTML for in-chat authentication modal (ui://corre/auth)
 */
export function getAuthUIHTML(appBaseUrl?: string): string {
  const baseUrl = (appBaseUrl || "http://localhost:8080").replace(/\/+$/, "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Corre Authentication Required</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
    background: #090d12;
    color: #f1f5f9;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
  }

  .auth-card {
    width: 100%;
    max-width: 380px;
    background: linear-gradient(180deg, #111827 0%, #0d131f 100%);
    border: 1px solid rgba(56, 211, 193, 0.3);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6), 0 0 40px rgba(56, 211, 193, 0.12);
  }

  .auth-header {
    background: rgba(17, 24, 39, 0.8);
    padding: 16px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .auth-brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .auth-logo-svg {
    width: 30px;
    height: 30px;
  }

  .auth-brand-text h2 {
    font-size: 15px;
    font-weight: 700;
    color: #f8fafc;
  }

  .auth-brand-text .auth-subtitle {
    font-size: 11px;
    color: #94a3b8;
  }

  .auth-badge {
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    background: rgba(245, 158, 11, 0.12);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.25);
  }

  .auth-body {
    padding: 22px 20px;
    text-align: center;
  }

  .auth-icon {
    font-size: 42px;
    margin-bottom: 12px;
  }

  .auth-title {
    font-size: 18px;
    font-weight: 700;
    color: #f8fafc;
    margin-bottom: 6px;
  }

  .auth-msg {
    font-size: 13px;
    color: #94a3b8;
    line-height: 1.5;
    margin-bottom: 20px;
  }

  .auth-btn {
    width: 100%;
    padding: 14px 20px;
    border-radius: 12px;
    background: linear-gradient(135deg, #38d3c1 0%, #22b8a7 100%);
    color: #090d12;
    font-size: 14px;
    font-weight: 700;
    text-align: center;
    text-decoration: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 4px 14px rgba(56, 211, 193, 0.25);
    border: none;
    cursor: pointer;
  }

  .auth-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(56, 211, 193, 0.4);
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 18px 0;
    font-size: 11px;
    color: #64748b;
  }

  .divider::before, .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
  }

  .email-box {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .email-input {
    width: 100%;
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #f8fafc;
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s;
  }

  .email-input:focus {
    border-color: #38d3c1;
  }

  .email-btn {
    width: 100%;
    padding: 12px;
    border-radius: 10px;
    background: rgba(56, 211, 193, 0.12);
    color: #38d3c1;
    font-size: 13px;
    font-weight: 600;
    border: 1px solid rgba(56, 211, 193, 0.25);
    cursor: pointer;
    transition: all 0.2s;
  }

  .email-btn:hover {
    background: rgba(56, 211, 193, 0.22);
  }

  .status-res {
    margin-top: 12px;
    font-size: 12px;
    color: #38d3c1;
    display: none;
  }
</style>
</head>
<body>

<div class="auth-card">
  <div class="auth-header">
    <div class="auth-brand">
      <svg class="auth-logo-svg" viewBox="0 0 100 100" fill="none"><polygon points="32,24 64,24 80,44 64,64 32,64 16,44" fill="#38D3C1"/><polygon points="42,43 78,43 60,76" fill="#ffffff" stroke="#38D3C1" stroke-width="4.5" stroke-linejoin="round"/></svg>
      <div class="auth-brand-text">
        <h2>Corre Authorization</h2>
        <div class="auth-subtitle">Authentication Required</div>
      </div>
    </div>
    <span class="auth-badge">Sign In</span>
  </div>

  <div class="auth-body">
    <div class="auth-icon">🔐</div>
    <div class="auth-title">Authentication Required</div>
    <div class="auth-msg">Please log in to your Corre account or enter your email to authorize in-chat actions.</div>

    <a class="auth-btn" href="${baseUrl}/login" target="_blank" rel="noopener noreferrer">
      <span>Log in to Corre Account ↗</span>
    </a>

    <div class="divider">OR INSTANT EMAIL ONBOARDING</div>

    <div class="email-box">
      <input type="email" class="email-input" id="emailInput" placeholder="Enter your registered email..." />
      <button type="button" class="email-btn" id="btnOnboard">Create Account & Continue</button>
    </div>

    <div class="status-res" id="statusRes">Creating wallet & account...</div>
  </div>
</div>

<script>
(function() {
  var btnOnboard = document.getElementById('btnOnboard');
  var emailInput = document.getElementById('emailInput');
  var statusRes = document.getElementById('statusRes');

  if (btnOnboard) {
    btnOnboard.addEventListener('click', function() {
      var email = (emailInput ? emailInput.value : '').trim();
      if (!email || !email.includes('@')) {
        alert('Please enter a valid email address.');
        return;
      }

      statusRes.style.display = 'block';
      statusRes.innerText = 'Creating account for ' + email + '...';
      btnOnboard.disabled = true;

      try {
        window.parent.postMessage({
          jsonrpc: '2.0',
          id: 'create_' + Date.now(),
          method: 'tools/call',
          params: {
            name: 'create_corre_user',
            arguments: { email: email }
          }
        }, '*');
      } catch(e) {
        console.error('Failed to postMessage:', e);
      }
    });
  }

  // ── MCP Apps handshake (required by Claude; ChatGPT injects window.openai) ──
  // The auth card is static, but Claude keeps the iframe hidden (spinner) until the
  // iframe completes ui/initialize -> ui/notifications/initialized. Without this the
  // sign-in card never appears. This mirrors the transaction widget handshake.
  var MCP_PROTOCOL_VERSION = '2026-01-26';
  var initRequestId = 'corre_auth_init_' + Date.now();
  var initialized = false;

  function sendInitialized() {
    if (initialized) return;
    initialized = true;
    try {
      window.parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} }, '*');
    } catch(e) {}
  }

  window.addEventListener('message', function(event) {
    if (!event || !event.data || typeof event.data !== 'object') return;
    var msg = event.data;
    // Response to our ui/initialize request -> announce readiness so Claude reveals the iframe.
    if (msg.id === initRequestId && (msg.result || msg.error)) {
      sendInitialized();
    }
  });

  var initAttempts = 0;
  function sendHandshake() {
    try {
      window.parent.postMessage({
        jsonrpc: '2.0',
        id: initRequestId,
        method: 'ui/initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          appInfo: { name: 'Corre Auth UI', version: '1.0.0' },
          appCapabilities: {}
        }
      }, '*');
    } catch(e) {}
    initAttempts++;
    if (initAttempts < 12 && !initialized) setTimeout(sendHandshake, 350);
  }

  sendHandshake();
})();
</script>
</body>
</html>`;
}
