#!/usr/bin/env node
/**
 * MAJU JWT Relay — Playwright Edition
 *
 * Runs a headless Chromium, logs into higgsfield.ai via Clerk,
 * then relays the JWT to the MAJU backend every 40 seconds.
 *
 * Environment variables (set as GitHub Secrets):
 *   HF_EMAIL       — Higgsfield account email
 *   HF_PASSWORD    — Higgsfield account password
 *   BACKEND_URL    — MAJU backend (default: https://vekraapzv3.us-east-1.awsapprunner.com)
 *   RELAY_DURATION — How long to run in minutes (default: 330 = 5.5 hours)
 */

import { chromium } from 'playwright';

const BACKEND    = process.env.BACKEND_URL || 'https://vekraapzv3.us-east-1.awsapprunner.com';
const EMAIL      = process.env.HF_EMAIL;
const PASSWORD   = process.env.HF_PASSWORD;
const DURATION   = parseInt(process.env.RELAY_DURATION || '330', 10); // minutes
const RELAY_MS   = 40_000;  // relay every 40s
const LOGIN_URL  = 'https://higgsfield.ai/';

if (!EMAIL || !PASSWORD) {
  console.error('❌ HF_EMAIL and HF_PASSWORD must be set');
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────
function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function extractJWT(page) {
  // Try 1: Clerk SDK
  try {
    const token = await page.evaluate(async () => {
      if (window.Clerk && window.Clerk.session) {
        return await window.Clerk.session.getToken();
      }
      return null;
    });
    if (token && token.length > 50) return token;
  } catch (e) { /* fallback */ }

  // Try 2: __session cookie
  const cookies = await page.context().cookies();
  const session = cookies.find(c => c.name === '__session');
  if (session && session.value.length > 50) return session.value;

  return null;
}

async function relayJWT(token) {
  const res = await fetch(BACKEND + '/api/jwt-store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jwt: token }),
  });
  const data = await res.json();
  return data;
}

// ── Login Flow ───────────────────────────────────────────────────────
async function login(page) {
  log('Navigating to higgsfield.ai...');
  await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 60_000 });

  // Wait for Clerk to load
  await page.waitForTimeout(3000);

  // Check if already logged in
  const loggedIn = await page.evaluate(() => {
    return !!(window.Clerk && window.Clerk.user);
  });

  if (loggedIn) {
    log('✓ Already logged in');
    return true;
  }

  // Look for sign-in button/link
  log('Looking for sign-in entry point...');

  // Try common Clerk sign-in patterns
  const signInSelectors = [
    'button:has-text("Sign in")',
    'a:has-text("Sign in")',
    'button:has-text("Log in")',
    'a:has-text("Log in")',
    '[data-clerk-sign-in]',
    '.cl-signIn-start',
  ];

  for (const sel of signInSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        log(`Found sign-in button: ${sel}`);
        await el.click();
        await page.waitForTimeout(2000);
        break;
      }
    } catch (e) { /* try next */ }
  }

  // Fill email
  log('Entering email...');
  const emailSelectors = [
    'input[name="identifier"]',
    'input[name="emailAddress"]',
    'input[type="email"]',
    '.cl-formFieldInput__identifier',
    'input[placeholder*="email" i]',
  ];

  let emailFilled = false;
  for (const sel of emailSelectors) {
    try {
      const input = await page.$(sel);
      if (input) {
        await input.fill(EMAIL);
        emailFilled = true;
        log(`Filled email in: ${sel}`);
        break;
      }
    } catch (e) { /* try next */ }
  }

  if (!emailFilled) {
    log('❌ Could not find email input');
    await page.screenshot({ path: 'debug-login-email.png' });
    return false;
  }

  // Click continue/next
  const continueSelectors = [
    'button:has-text("Continue")',
    'button:has-text("Next")',
    'button[type="submit"]',
    '.cl-formButtonPrimary',
  ];

  for (const sel of continueSelectors) {
    try {
      const btn = await page.$(sel);
      if (btn && await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(2000);
        break;
      }
    } catch (e) { /* try next */ }
  }

  // Fill password
  log('Entering password...');
  const pwSelectors = [
    'input[name="password"]',
    'input[type="password"]',
    '.cl-formFieldInput__password',
  ];

  let pwFilled = false;
  for (const sel of pwSelectors) {
    try {
      const input = await page.$(sel);
      if (input) {
        await input.fill(PASSWORD);
        pwFilled = true;
        log(`Filled password in: ${sel}`);
        break;
      }
    } catch (e) { /* try next */ }
  }

  if (!pwFilled) {
    log('❌ Could not find password input');
    await page.screenshot({ path: 'debug-login-password.png' });
    return false;
  }

  // Click sign in
  const signInBtnSelectors = [
    'button:has-text("Continue")',
    'button:has-text("Sign in")',
    'button:has-text("Log in")',
    'button[type="submit"]',
    '.cl-formButtonPrimary',
  ];

  for (const sel of signInBtnSelectors) {
    try {
      const btn = await page.$(sel);
      if (btn && await btn.isVisible()) {
        await btn.click();
        break;
      }
    } catch (e) { /* try next */ }
  }

  // Wait for auth to complete
  log('Waiting for authentication...');
  await page.waitForTimeout(5000);

  // Verify login
  const verified = await page.evaluate(() => {
    return !!(window.Clerk && window.Clerk.user);
  });

  if (verified) {
    log('✓ Login successful');
    return true;
  }

  log('❌ Login may have failed — checking JWT anyway...');
  await page.screenshot({ path: 'debug-login-verify.png' });
  return true; // try anyway, JWT check will catch actual failure
}

// ── Main Loop ────────────────────────────────────────────────────────
async function main() {
  log(`Starting MAJU JWT Relay (${DURATION} min)`);
  log(`Backend: ${BACKEND}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  // Login
  const ok = await login(page);
  if (!ok) {
    log('❌ Login failed — exiting');
    await browser.close();
    process.exit(1);
  }

  // Initial JWT check
  await page.waitForTimeout(2000);
  const initialToken = await extractJWT(page);
  if (!initialToken) {
    log('❌ Could not extract initial JWT — exiting');
    await page.screenshot({ path: 'debug-no-jwt.png' });
    await browser.close();
    process.exit(1);
  }
  log(`✓ Initial JWT extracted (${initialToken.length} chars)`);

  // Relay loop
  const deadline = Date.now() + DURATION * 60_000;
  let relayCount = 0;

  while (Date.now() < deadline) {
    try {
      const token = await extractJWT(page);
      if (token) {
        const result = await relayJWT(token);
        relayCount++;
        log(`✓ Relay #${relayCount} — ${result.stored ? 'stored' : 'sent'} (${token.length} chars)`);
      } else {
        log('⚠ No JWT found — session may have expired, attempting page reload...');
        await page.reload({ waitUntil: 'networkidle', timeout: 30_000 });
        await page.waitForTimeout(3000);
      }
    } catch (err) {
      log(`⚠ Relay error: ${err.message}`);
    }

    // Sleep until next relay
    await new Promise(resolve => setTimeout(resolve, RELAY_MS));
  }

  log(`Done — ${relayCount} relays over ${DURATION} minutes`);
  await browser.close();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
