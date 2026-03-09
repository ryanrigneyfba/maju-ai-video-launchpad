// ==UserScript==
// @name         MAJU JWT Auto-Relay
// @namespace    https://ryanrigneyfba.github.io/maju-ai-video-launchpad/
// @version      1.0
// @description  Automatically relays Higgsfield JWT tokens to the MAJU backend. Install once — runs forever in the background on higgsfield.ai.
// @author       MAJU AI
// @match        https://higgsfield.ai/*
// @match        https://*.higgsfield.ai/*
// @grant        GM_xmlhttpRequest
// @connect      vekraapzv3.us-east-1.awsapprunner.com
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';

  const BACKEND = 'https://vekraapzv3.us-east-1.awsapprunner.com';
  const RELAY_INTERVAL_MS = 40000; // 40 seconds (well within 55s server TTL)
  const STARTUP_DELAY_MS = 3000;   // Wait for Clerk to initialize

  let relayCount = 0;
  let lastStatus = '';

  // ── Status badge (small floating indicator on higgsfield.ai) ──
  function createBadge() {
    const badge = document.createElement('div');
    badge.id = 'maju-relay-badge';
    badge.style.cssText = [
      'position:fixed', 'bottom:12px', 'right:12px', 'z-index:99999',
      'background:#1a1a2e', 'color:#fff', 'font-family:Inter,system-ui,sans-serif',
      'font-size:11px', 'padding:6px 12px', 'border-radius:20px',
      'box-shadow:0 2px 8px rgba(0,0,0,0.3)', 'cursor:pointer',
      'display:flex', 'align-items:center', 'gap:6px',
      'transition:opacity 0.3s', 'opacity:0.85',
    ].join(';');
    badge.innerHTML = '<span id="maju-relay-dot" style="width:8px;height:8px;border-radius:50%;background:#666;display:inline-block;"></span><span id="maju-relay-text">MAJU Relay: Starting…</span>';
    badge.title = 'MAJU JWT Auto-Relay — keeps your Higgsfield session connected to the MAJU Video Launchpad';
    badge.addEventListener('mouseenter', () => badge.style.opacity = '1');
    badge.addEventListener('mouseleave', () => badge.style.opacity = '0.85');
    document.body.appendChild(badge);
    return badge;
  }

  function updateBadge(status, color) {
    const dot = document.getElementById('maju-relay-dot');
    const text = document.getElementById('maju-relay-text');
    if (dot) dot.style.background = color;
    if (text) text.textContent = status;
    lastStatus = status;
  }

  // ── Token extraction ──
  function getSessionCookie() {
    const match = document.cookie.match(/(^| )__session=([^;]+)/);
    return match ? match[2] : null;
  }

  async function getClerkToken() {
    // Method 1: Try Clerk SDK's getToken() — most reliable
    try {
      if (window.Clerk && window.Clerk.session) {
        const token = await window.Clerk.session.getToken();
        if (token && token.length > 50) return token;
      }
    } catch (e) {
      console.log('[MAJU-Relay] Clerk.session.getToken() failed:', e.message);
    }

    // Method 2: Read __session cookie directly
    const cookie = getSessionCookie();
    if (cookie && cookie.length > 50) return cookie;

    return null;
  }

  // ── Relay to backend ──
  function relayToken(token) {
    return new Promise((resolve, reject) => {
      // Use GM_xmlhttpRequest to bypass CORS restrictions
      if (typeof GM_xmlhttpRequest !== 'undefined') {
        GM_xmlhttpRequest({
          method: 'POST',
          url: BACKEND + '/api/jwt-store',
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify({ jwt: token }),
          onload: function(response) {
            try {
              const data = JSON.parse(response.responseText);
              resolve(data);
            } catch (e) {
              reject(new Error('Parse error: ' + response.responseText.substring(0, 100)));
            }
          },
          onerror: function(err) {
            reject(new Error('Network error'));
          }
        });
      } else {
        // Fallback to fetch (may hit CORS)
        fetch(BACKEND + '/api/jwt-store', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jwt: token })
        })
        .then(r => r.json())
        .then(resolve)
        .catch(reject);
      }
    });
  }

  // ── Main relay loop ──
  async function doRelay() {
    try {
      const token = await getClerkToken();
      if (!token) {
        updateBadge('MAJU: Not logged in', '#ff6b6b');
        console.log('[MAJU-Relay] No token available — are you logged in?');
        return;
      }

      const result = await relayToken(token);
      relayCount++;

      if (result.ok) {
        updateBadge('MAJU: Connected ✓ (#' + relayCount + ')', '#51cf66');
        console.log('[MAJU-Relay] Token relayed successfully (#' + relayCount + ')');
      } else {
        updateBadge('MAJU: Store failed', '#ffd43b');
        console.warn('[MAJU-Relay] Backend rejected token:', result.error);
      }
    } catch (err) {
      updateBadge('MAJU: Relay error', '#ff6b6b');
      console.error('[MAJU-Relay] Error:', err.message);
    }
  }

  // ── Initialize ──
  function init() {
    console.log('[MAJU-Relay] Auto-relay userscript loaded on', location.hostname);
    createBadge();
    updateBadge('MAJU: Connecting…', '#ffd43b');

    // Initial relay after Clerk loads
    setTimeout(() => {
      doRelay();
      // Start recurring relay
      setInterval(doRelay, RELAY_INTERVAL_MS);
    }, STARTUP_DELAY_MS);
  }

  // Wait for page to be ready
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
