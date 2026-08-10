/**
 * MCP Apps UI Module — Transaction Approval Iframe
 *
 * Generates self-contained HTML that renders inside a sandboxed iframe
 * within Claude/ChatGPT via the MCP Apps (io.modelcontextprotocol/ui) extension.
 *
 * Two modes:
 * 1. In-Chat Confirm — canExecuteInChat: true → "Confirm Transaction" button
 *    triggers execute_transaction tool via postMessage to host
 * 2. Deep-Link Fallback — canExecuteInChat: false → "Approve in Corre" button
 *    opens the Corre web app at the checkoutUrl
 *
 * Also handles transaction_executed / transaction_failed results from execute_transaction.
 */

export function getTransactionUIHTML(appBaseUrl?: string): string {
  const baseUrl = (appBaseUrl || "http://localhost:8080").replace(/\/+$/, "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Corre Transaction</title>
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

  .tx-card {
    width: 100%;
    max-width: 380px;
    background: linear-gradient(180deg, #111827 0%, #0d131f 100%);
    border: 1px solid rgba(56, 211, 193, 0.25);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6), 0 0 40px rgba(56, 211, 193, 0.1);
  }

  .tx-header {
    background: rgba(17, 24, 39, 0.8);
    padding: 16px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .tx-brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .tx-logo-svg {
    width: 30px;
    height: 30px;
    flex-shrink: 0;
  }

  .tx-brand-text h2 {
    font-size: 15px;
    font-weight: 700;
    color: #f8fafc;
    letter-spacing: -0.01em;
    line-height: 1.2;
  }

  .tx-brand-text .tx-subtitle {
    font-size: 11px;
    color: #94a3b8;
  }

  .tx-badge-type {
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    background: rgba(56, 211, 193, 0.12);
    color: #38d3c1;
    border: 1px solid rgba(56, 211, 193, 0.25);
  }

  .tx-body {
    padding: 20px;
  }

  .tx-amount-hero {
    text-align: center;
    padding: 8px 0 18px;
  }

  .tx-amount-hero .amount {
    font-size: 34px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  .tx-amount-hero .subamount {
    font-size: 13px;
    color: #38d3c1;
    font-weight: 600;
    margin-top: 4px;
  }

  .tx-details-box {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 14px;
    padding: 4px 14px;
  }

  .tx-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .tx-row:last-child {
    border-bottom: none;
  }

  .tx-label {
    font-size: 12px;
    color: #94a3b8;
    font-weight: 500;
  }

  .tx-val {
    font-size: 13px;
    color: #e2e8f0;
    font-weight: 600;
    text-align: right;
  }

  .tx-val.highlight {
    color: #38d3c1;
  }

  .tx-val.mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
    font-size: 11px;
    color: #cbd5e1;
  }

  .tx-footer {
    padding: 0 20px 20px;
  }

  .tx-btn {
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
    cursor: pointer;
    border: none;
    outline: none;
  }

  .tx-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(56, 211, 193, 0.4);
    filter: brightness(1.05);
  }

  .tx-btn:active {
    transform: translateY(0);
  }

  .tx-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none !important;
  }

  .tx-btn-secondary {
    background: rgba(56, 211, 193, 0.12);
    color: #38d3c1;
    border: 1px solid rgba(56, 211, 193, 0.25);
    box-shadow: none;
    margin-top: 8px;
  }

  .tx-sec {
    text-align: center;
    font-size: 11px;
    color: #64748b;
    margin-top: 12px;
  }

  .tx-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 44px 20px;
    gap: 14px;
  }

  .tx-spinner {
    width: 28px;
    height: 28px;
    border: 3px solid rgba(56, 211, 193, 0.15);
    border-top-color: #38d3c1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  /* Success / Error states */
  .tx-result {
    text-align: center;
    padding: 30px 20px;
  }

  .tx-result-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .tx-result-title {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 6px;
  }

  .tx-result-msg {
    font-size: 13px;
    color: #94a3b8;
    line-height: 1.5;
    word-break: break-all;
  }

  .tx-result-link {
    display: inline-block;
    margin-top: 12px;
    padding: 10px 20px;
    border-radius: 10px;
    background: rgba(56, 211, 193, 0.12);
    color: #38d3c1;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    border: 1px solid rgba(56, 211, 193, 0.25);
    transition: all 0.2s;
  }

  .tx-result-link:hover {
    background: rgba(56, 211, 193, 0.2);
  }

  .tx-signing-status {
    text-align: center;
    padding: 30px 20px;
  }

  .tx-signing-status .tx-spinner {
    margin: 0 auto 14px;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
</style>
</head>
<body>

<div class="tx-card" id="txCard">
  <div class="tx-loading" id="txLoading">
    <div class="tx-spinner"></div>
    <div style="font-size: 13px; color: #94a3b8;" id="statusText">Preparing Corre Transaction...</div>
  </div>
</div>

<script>
(function() {
  'use strict';

  var APP_BASE_URL = '${baseUrl}';
  var LOGO_SVG = '<svg class="tx-logo-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="32,24 64,24 80,44 64,64 32,64 16,44" fill="#38D3C1"/><polygon points="42,43 78,43 60,76" fill="#ffffff" stroke="#38D3C1" stroke-width="4.5" stroke-linejoin="round"/></svg>';
  var isRendered = false;
  var currentTxData = null;
  var authShown = false;

  var TX_TITLES = {
    onramp_order_prepared: { title: 'Buy USDC', badge: 'Onramp' },
    offramp_order_prepared: { title: 'Withdraw Funds', badge: 'Offramp' },
    transfer_prepared: { title: 'Send USDC', badge: 'Transfer' },
    buy_order_prepared: { title: 'Buy Stock', badge: 'Invest' },
    sell_order_prepared: { title: 'Sell Stock', badge: 'Invest' },
    savings_deposit_prepared: { title: 'Deposit USDC', badge: 'Savings' },
    savings_withdrawal_prepared: { title: 'Withdraw USDC', badge: 'Savings' },
    transaction_executed: { title: 'Transaction Confirmed', badge: 'Success' },
    transaction_failed: { title: 'Transaction Failed', badge: 'Error' }
  };

  // Ultra-smart deep extractor & synthesizer
  function findTransactionData(root, depth) {
    if (!root) return null;
    if (depth === undefined) depth = 0;
    if (depth > 6) return null;

    if (typeof root === 'string') {
      var trimmed = root.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try { return findTransactionData(JSON.parse(trimmed), depth + 1); } catch(e) {}
      }
      return null;
    }

    if (typeof root !== 'object') return null;

    // TOP PRIORITY: if the backend says auth is required, do NOT synthesize a
    // transaction card. Surface the auth signal so the sign-in card is shown.
    if (root.status === 'authentication_required' || root.status === 'authorization_required') {
      return { status: 'authentication_required', authorizeUrl: root.authorizeUrl || root.checkoutUrl };
    }

    // FIRST: Check if valid transaction object directly (tool output with status)
    if (root.status === 'transaction_executed' || root.status === 'transaction_failed') {
      return root;
    }
    if (root.status && TX_TITLES[root.status]) {
      return root;
    }

    // SECOND: Check for toolOutput / structuredContent (the actual tool result with transactionId)
    if (root.toolOutput || root.structuredContent) {
      var output = root.toolOutput || root.structuredContent;
      if (output && typeof output === 'object') {
        var found = findTransactionData(output, depth + 1);
        if (found) return found;
      }
    }

    // THIRD: Synthesize from tool input args (what ChatGPT passes into the iframe).
    // Only require transactionId when canExecuteInChat is explicitly true — otherwise
    // synthesize a view-only card so the user sees the pending transaction details.
    if (root.recipientAddress || root.recipient || root.destinationAddress) {
      var addr = root.recipientAddress || root.recipient || root.destinationAddress;
      var amt = root.usdcAmount || root.amount || 0;
      var txId = root.transactionId;
      var canExec = root.canExecuteInChat === true;
      // If no transactionId but trying to execute in chat, skip synthesis (auth fail).
      if (canExec && !txId) return null;
      var appUrl = window.location.origin.includes('localhost') ? 'http://localhost:8080' : APP_BASE_URL;
      return {
        status: 'transfer_prepared',
        recipientAddress: addr,
        usdcAmount: Number(amt),
        chain: 'Solana',
        asset: 'USDC',
        canExecuteInChat: canExec,
        transactionId: txId,
        checkoutUrl: root.checkoutUrl || (appUrl + '/send/wallet?address=' + encodeURIComponent(addr) + '&amount=' + amt + '&token=USDC')
      };
    }

    if (root.nairaAmount) {
      var nAmt = Number(root.nairaAmount);
      return {
        status: 'onramp_order_prepared',
        nairaAmount: nAmt,
        estimatedUsdcReceived: (nAmt / 1500).toFixed(2),
        checkoutUrl: APP_BASE_URL + '/buy-usdc/naira?amount=' + nAmt
      };
    }

    if (root.symbol && root.usdcAmount) {
      var txIdStock = root.transactionId;
      var canExecStock = root.canExecuteInChat === true;
      if (canExecStock && !txIdStock) return null;
      return {
        status: 'buy_order_prepared',
        stockSymbol: root.symbol,
        usdcAmount: Number(root.usdcAmount),
        canExecuteInChat: canExecStock,
        transactionId: txIdStock,
        checkoutUrl: root.checkoutUrl || (APP_BASE_URL + '/invest/us-stocks?symbol=' + root.symbol + '&amount=' + root.usdcAmount)
      };
    }

    // Recursively check child keys
    var keys = Object.keys(root);
    for (var i = 0; i < keys.length; i++) {
      var val = root[keys[i]];
      if (val && typeof val === 'object') {
        var found = findTransactionData(val, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  function truncateAddress(addr) {
    if (!addr || addr.length < 12) return addr || '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  // ── Render Transaction Result (success/error from execute_transaction) ──────
  function renderTransactionResult(data) {
    isRendered = true;

    var card = document.getElementById('txCard');
    var isSuccess = data.status === 'transaction_executed' && data.success !== false;

    var html = '';
    html += '<div class="tx-header">';
    html += '  <div class="tx-brand">';
    html += '    ' + LOGO_SVG;
    html += '    <div class="tx-brand-text">';
    html += '      <h2>' + (isSuccess ? 'Transaction Confirmed' : 'Transaction Failed') + '</h2>';
    html += '      <div class="tx-subtitle">Corre DeFi and Tokenization</div>';
    html += '    </div>';
    html += '  </div>';
    html += '  <span class="tx-badge-type" style="' + (isSuccess ? '' : 'color:#ef4444;background:rgba(239,68,68,0.12);border-color:rgba(239,68,68,0.25)') + '">' + (isSuccess ? 'Success' : 'Failed') + '</span>';
    html += '</div>';

    html += '<div class="tx-result">';
    html += '  <div class="tx-result-icon">' + (isSuccess ? '\\u2705' : '\\u274c') + '</div>';
    html += '  <div class="tx-result-title" style="color:' + (isSuccess ? '#38d3c1' : '#ef4444') + '">' + (isSuccess ? 'Transaction Successful!' : 'Transaction Failed') + '</div>';

    if (isSuccess && data.txSignature) {
      html += '  <div class="tx-result-msg">Signature: ' + truncateAddress(data.txSignature) + '</div>';
      var solscanUrl = data.solscanUrl || ('https://solscan.io/tx/' + data.txSignature);
      html += '  <a class="tx-result-link" href="' + escapeAttr(solscanUrl) + '" target="_blank" rel="noopener noreferrer">View on Solscan \\u2197</a>';
    } else if (!isSuccess) {
      var rawErr = data.error || data.message || 'An unknown error occurred.';
      var cleanErr = formatUiErrorMsg(rawErr);
      html += '  <div class="tx-result-msg">' + escapeHtml(cleanErr) + '</div>';
    }

    html += '</div>';
    card.innerHTML = html;
  }

  function formatUiErrorMsg(msg) {
    if (!msg) return 'Transaction failed. Please try again.';
    var str = String(msg);
    if (str.indexOf('Custom":1') !== -1 || str.indexOf('Custom": 1') !== -1 || str.indexOf('Custom:1') !== -1 || str.indexOf('Insufficient') !== -1 || str.indexOf('insufficient') !== -1) {
      return 'Insufficient Balance: Your Solana wallet does not have enough USDC (or SOL for gas fees) to complete this transaction. Please fund your wallet and try again.';
    }
    if (str.indexOf('Privy signing failed') !== -1 || str.indexOf('Transaction simulation failed') !== -1) {
      try {
        var match = str.match(/\{"error":.*\}/);
        if (match) {
          var parsed = JSON.parse(match[0]);
          if (parsed.error) str = parsed.error;
        }
      } catch(e) {}
      str = str.replace(/^Privy signing failed \(\d+\):\s*/, '').replace(/^Error broadcasting transaction with message:\s*/, '').replace(/^Error:\s*/, '').replace(/\\"/g, '"');
    }
    return str;
  }

  // ── Render Signing In Progress State ───────────────────────────────────────
  function renderSigningState() {
    var card = document.getElementById('txCard');
    var html = '';
    html += '<div class="tx-header">';
    html += '  <div class="tx-brand">';
    html += '    ' + LOGO_SVG;
    html += '    <div class="tx-brand-text">';
    html += '      <h2>Signing Transaction</h2>';
    html += '      <div class="tx-subtitle">Corre DeFi and Tokenization</div>';
    html += '    </div>';
    html += '  </div>';
    html += '  <span class="tx-badge-type">Signing</span>';
    html += '</div>';
    html += '<div class="tx-signing-status">';
    html += '  <div class="tx-spinner"></div>';
    html += '  <div style="font-size: 14px; color: #f1f5f9; font-weight: 600; margin-bottom: 4px;">Signing & Broadcasting...</div>';
    html += '  <div style="font-size: 12px; color: #94a3b8; animation: pulse 1.5s infinite">Building transaction and sending to Solana network</div>';
    html += '</div>';
    card.innerHTML = html;
  }

  // ── Render "Reconnect / Sign in" card (unauthenticated) ────────────────────
  function renderAuthRequired(data) {
    authShown = true;
    isRendered = true;
    var loginUrl = (data && data.authorizeUrl) ? data.authorizeUrl : (APP_BASE_URL + '/login');
    var card = document.getElementById('txCard');
    if (!card) return;
    var html = '';
    html += '<div class="tx-header">';
    html += '  <div class="tx-brand">';
    html += '    ' + LOGO_SVG;
    html += '    <div class="tx-brand-text">';
    html += '      <h2>Reconnect to Corre</h2>';
    html += '      <div class="tx-subtitle">Authentication Required</div>';
    html += '    </div>';
    html += '  </div>';
    html += '  <span class="tx-badge-type" style="color:#f59e0b;background:rgba(245,158,11,0.12);border-color:rgba(245,158,11,0.25)">Sign In</span>';
    html += '</div>';
    html += '<div class="tx-body">';
    html += '  <div class="tx-amount-hero">';
    html += '    <div style="font-size:42px;margin-bottom:8px">\\ud83d\\udd10</div>';
    html += '    <div style="font-size:18px;font-weight:700;color:#f8fafc;margin-bottom:6px">Your session has expired</div>';
    html += '    <div style="font-size:13px;color:#94a3b8;line-height:1.5">Reconnect your Corre account before we can prepare or sign this transaction.</div>';
    html += '  </div>';
    html += '</div>';
    html += '<div class="tx-footer">';
    html += '  <a class="tx-btn" id="btnReconnect" href="' + escapeAttr(loginUrl) + '" target="_blank" rel="noopener noreferrer">';
    html += '    <span>Reconnect to Corre</span>';
    html += '  </a>';
    html += '  <div class="tx-sec">\\ud83d\\udd12 Non-custodial \\u00b7 Secured by Privy</div>';
    html += '</div>';
    card.innerHTML = html;
  }

  // ── Main Render Function ────────────────────────────────────────────────────
  function renderTransaction(data) {
    if (!data) return;

    // Auth gate: never show a transaction/confirm card to an unauthenticated user.
    if (data.status === 'authentication_required' || data.status === 'authorization_required') {
      renderAuthRequired(data);
      return;
    }

    // Handle execution results
    if (data.status === 'transaction_executed' || data.status === 'transaction_failed') {
      renderTransactionResult(data);
      return;
    }

    // Don't re-render if we already rendered the exact same transaction ID
    if (isRendered && currentTxData && currentTxData.transactionId && data.transactionId === currentTxData.transactionId) {
      return;
    }

    isRendered = true;
    currentTxData = data;

    var card = document.getElementById('txCard');
    var meta = TX_TITLES[data.status] || { title: 'Transaction', badge: 'Corre' };
    var checkoutUrl = data.checkoutUrl || APP_BASE_URL;
    var canExecuteInChat = data.canExecuteInChat !== false; // default true unless explicitly false
    var transactionId = data.transactionId || ('tx_' + Math.random().toString(36).substring(2, 10));

    var heroAmount = '';
    var heroSub = '';
    var rows = [];

    switch (data.status) {
      case 'onramp_order_prepared':
        heroAmount = data.formattedNaira || ('\\u20a6' + (data.nairaAmount || 0).toLocaleString());
        heroSub = '\\u2192 ~$' + (data.estimatedUsdcReceived || 0) + ' USDC';
        rows.push({ label: 'Payment Method', val: 'Bank Transfer' });
        if (data.rateNgnPerUsdc) rows.push({ label: 'Rate', val: '\\u20a6' + data.rateNgnPerUsdc + ' / USDC' });
        break;

      case 'offramp_order_prepared':
        heroAmount = '$' + (data.usdcAmount || 0) + ' USDC';
        heroSub = '\\u2192 ' + (data.estimatedNairaReceived || 'Naira Bank Transfer');
        rows.push({ label: 'Payout Method', val: 'African Bank Transfer' });
        if (data.rateNgnPerUsdc) rows.push({ label: 'Rate', val: '\\u20a6' + (data.rateNgnPerUsdc || 0).toLocaleString() + ' / USDC' });
        break;

      case 'transfer_prepared':
        heroAmount = '$' + (data.usdcAmount || 0) + ' USDC';
        heroSub = 'Solana Transfer';
        rows.push({ label: 'Recipient', val: truncateAddress(data.recipientAddress), mono: true });
        rows.push({ label: 'Network', val: 'Solana' });
        if (canExecuteInChat) rows.push({ label: 'Signing', val: 'In-Chat (Privy)', highlight: true });
        break;

      case 'buy_order_prepared':
        heroAmount = '$' + (data.usdcAmount || 0) + ' USDC';
        heroSub = 'Buy ' + (data.stockSymbol || 'Stock');
        rows.push({ label: 'Asset', val: data.stockName || data.stockSymbol || 'US Equity' });
        rows.push({ label: 'Ticker', val: data.stockSymbol || 'STOCK' });
        break;

      case 'sell_order_prepared':
        heroAmount = (data.sharesAmount || 0) + ' shares';
        heroSub = 'Sell ' + (data.stockSymbol || 'Stock');
        rows.push({ label: 'Asset', val: data.stockName || data.stockSymbol || 'US Equity' });
        rows.push({ label: 'Ticker', val: data.stockSymbol || 'STOCK' });
        break;

      case 'savings_deposit_prepared':
        heroAmount = '$' + (data.usdcAmount || 0) + ' USDC';
        heroSub = data.estimatedAPY ? data.estimatedAPY + ' Yield' : 'Savings Deposit';
        rows.push({ label: 'Vault', val: data.vaultType || 'Protected Vault' });
        if (data.estimatedAPY) rows.push({ label: 'Estimated APY', val: data.estimatedAPY, highlight: true });
        if (canExecuteInChat) rows.push({ label: 'Signing', val: 'In-Chat (Privy)', highlight: true });
        break;

      case 'savings_withdrawal_prepared':
        heroAmount = '$' + (data.usdcAmount || 0) + ' USDC';
        heroSub = 'Savings Withdrawal';
        rows.push({ label: 'Vault', val: data.vaultType || 'Savings Vault' });
        if (data.cooldownPeriod) {
          rows.push({ label: 'Unlock Time', val: data.cooldownPeriod, highlight: data.cooldownPeriod.indexOf('24') !== -1 });
        }
        break;

      default:
        heroAmount = '$' + (data.usdcAmount || data.nairaAmount || 0);
        if (data.recipientAddress) rows.push({ label: 'Recipient', val: truncateAddress(data.recipientAddress), mono: true });
    }

    var html = '';
    html += '<div class="tx-header">';
    html += '  <div class="tx-brand">';
    html += '    ' + LOGO_SVG;
    html += '    <div class="tx-brand-text">';
    html += '      <h2>' + meta.title + '</h2>';
    html += '      <div class="tx-subtitle">Corre DeFi and Tokenization</div>';
    html += '    </div>';
    html += '  </div>';
    html += '  <span class="tx-badge-type">' + meta.badge + '</span>';
    html += '</div>';

    html += '<div class="tx-body">';
    html += '  <div class="tx-amount-hero">';
    html += '    <div class="amount">' + heroAmount + '</div>';
    if (heroSub) html += '    <div class="subamount">' + heroSub + '</div>';
    html += '  </div>';

    if (rows.length > 0) {
      html += '  <div class="tx-details-box">';
      rows.forEach(function(r) {
        html += '    <div class="tx-row">';
        html += '      <span class="tx-label">' + r.label + '</span>';
        html += '      <span class="tx-val' + (r.highlight ? ' highlight' : '') + (r.mono ? ' mono' : '') + '">' + r.val + '</span>';
        html += '    </div>';
      });
      html += '  </div>';
    }
    html += '</div>';

    html += '<div class="tx-footer">';

    if (canExecuteInChat) {
      // In-Chat Confirm Button — HTML <button> tag that triggers JS postMessage execution (NEVER an <a> tag)
      html += '  <button class="tx-btn" id="btnConfirm" type="button" data-txid="' + escapeAttr(transactionId) + '">';
      html += '    <span>Confirm Transaction</span>';
      html += '  </button>';
      // Secondary fallback deep-link
      html += '  <a class="tx-btn tx-btn-secondary" id="btnFallback" href="' + escapeAttr(checkoutUrl) + '" target="_blank" rel="noopener noreferrer">';
      html += '    <span>Or open in Corre App</span>';
      html += '  </a>';
    } else {
      // Deep-Link Only
      html += '  <a class="tx-btn" id="btnApprove" href="' + escapeAttr(checkoutUrl) + '" target="_blank" rel="noopener noreferrer">';
      html += '    <span>Approve in Corre</span>';
      html += '  </a>';
    }

    html += '  <div class="tx-sec">\\ud83d\\udd12 Non-custodial \\u00b7 Secured by Privy</div>';
    html += '</div>';

    card.innerHTML = html;

    // Attach event handlers
    if (canExecuteInChat) {
      var btnConfirm = document.getElementById('btnConfirm');
      if (btnConfirm) {
        btnConfirm.addEventListener('click', function(e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          var activeId = this.getAttribute('data-txid') || transactionId;
          handleConfirmTransaction(activeId);
        });
      }
    } else {
      var btnApprove = document.getElementById('btnApprove');
      if (btnApprove) {
        btnApprove.addEventListener('click', function() {
          this.style.opacity = '0.85';
          var span = this.querySelector('span');
          if (span) span.innerText = 'Opening Corre...';
        });
      }
    }
  }

  // ── Handle Confirm Transaction (In-Chat Signing) ───────────────────────────
  function handleConfirmTransaction(transactionId) {
    // Update UI to signing state
    renderSigningState();

    // Send execute_transaction request to the host via postMessage
    try {
      // Method 1: Standard MCP Apps tool invocation via postMessage
      window.parent.postMessage({
        jsonrpc: '2.0',
        id: 'exec_' + Date.now(),
        method: 'tools/call',
        params: {
          name: 'execute_transaction',
          arguments: { transactionId: transactionId }
        }
      }, '*');

      // Method 2: OpenAI-specific action format
      window.parent.postMessage({
        type: 'action',
        action: 'execute_transaction',
        data: { transactionId: transactionId }
      }, '*');
    } catch(e) {
      console.error('Failed to send execute message:', e);
    }

    // Set a timeout — if we don't get a response in 60s, show timeout message
    setTimeout(function() {
      var card = document.getElementById('txCard');
      if (card && card.querySelector('.tx-signing-status')) {
        card.innerHTML = '<div class="tx-result">' +
          '<div class="tx-result-icon">\\u23f3</div>' +
          '<div class="tx-result-title" style="color:#f59e0b">Transaction Processing</div>' +
          '<div class="tx-result-msg">The transaction request was sent for signing. Please check your wallet/dashboard for confirmation.</div>' +
          '<a class="tx-result-link" href="' + escapeAttr(APP_BASE_URL) + '" target="_blank">Open Corre Dashboard</a>' +
          '</div>';
      }
    }, 60000);
  }

  function escapeAttr(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function tryExtractAndRender(sourceData) {
    var txData = findTransactionData(sourceData);
    if (txData) {
      renderTransaction(txData);
      return true;
    }
    return false;
  }

  // Listen to postMessage from host (including execute_transaction results)
  window.addEventListener('message', function(event) {
    if (!event || !event.data) return;

    // Check if this is an execution result coming back
    var data = event.data;
    if (data && typeof data === 'object') {
      // Handle result from execute_transaction tool
      if (data.status === 'transaction_executed' || data.status === 'transaction_failed') {
        renderTransactionResult(data);
        return;
      }
      // Check nested result in structuredContent or content
      if (data.structuredContent) {
        var sc = data.structuredContent;
        if (sc.status === 'transaction_executed' || sc.status === 'transaction_failed') {
          renderTransactionResult(sc);
          return;
        }
      }
    }

    tryExtractAndRender(event.data);
  });

  // Check URL Search Params, Hash, and window.openai
  if (window.location.search) tryExtractAndRender(window.location.search);
  if (window.location.hash) tryExtractAndRender(decodeURIComponent(window.location.hash));
  if (window.openai) tryExtractAndRender(window.openai);

  // ── MCP Apps handshake (required by Claude; ChatGPT uses window.openai above) ──
  // Claude's host validates the ui/initialize protocolVersion and will NOT push the
  // tool-result until the iframe replies with ui/notifications/initialized. An empty
  // params object is rejected as "Unsupported protocol version", so we must send a
  // valid protocolVersion and complete the initialized handshake.
  var MCP_PROTOCOL_VERSION = '2026-01-26';
  var initRequestId = 'corre_init_' + Date.now();
  var initialized = false;

  function sendInitialized() {
    if (initialized) return;
    initialized = true;
    try {
      window.parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} }, '*');
    } catch(e) {}
  }

  // Handle the host's response to ui/initialize + tool lifecycle notifications.
  window.addEventListener('message', function(event) {
    if (!event || !event.data || typeof event.data !== 'object') return;
    var msg = event.data;

    // 1. Response to our ui/initialize request -> announce readiness so Claude
    //    proceeds to send the tool input/result.
    if (msg.id === initRequestId && (msg.result || msg.error)) {
      sendInitialized();
      if (msg.result) tryExtractAndRender(msg.result);
      return;
    }

    // 2. Standard MCP Apps tool lifecycle notifications carry the payload in params
    //    (ui/notifications/tool-result, ui/notifications/tool-input).
    if (typeof msg.method === 'string' && msg.method.indexOf('ui/notifications/') === 0) {
      if (msg.params) tryExtractAndRender(msg.params);
      return;
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
          appInfo: { name: 'Corre Transaction UI', version: '1.0.0' },
          appCapabilities: {}
        }
      }, '*');
    } catch(e) {}
    initAttempts++;
    // Keep pinging until the host completes the handshake or we render.
    if (initAttempts < 12 && !initialized && !isRendered) setTimeout(sendHandshake, 350);
  }

  sendHandshake();

})();
</script>
</body>
</html>`;
}
