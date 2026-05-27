/**
 * Telnyx TeXML handlers for ICFP inbound call routing.
 *
 * Flow:
 *   1. Customer calls 617-767-9127 (Telnyx)
 *   2. Telnyx POST /api/telnyx-voice → TeXML rings FORWARD_TO_NUMBER for 20 s
 *   3a. Human picks up → connected, done.
 *   3b. No answer → Telnyx POST /api/telnyx-no-answer → TeXML dials VAPI
 *
 * Call filtering (all env vars are comma-separated E.164 lists):
 *   BLOCKED_NUMBERS    — hang up immediately, e.g. +18005551234,+18005550000
 *   ALLOWED_NUMBERS    — if set, ONLY these numbers get through (allowlist mode)
 *   VIP_NUMBERS        — skip human ring, go straight to Vapi
 *
 * Other env:
 *   FORWARD_TO_NUMBER  — E.164 number to ring first, e.g. +16175079146
 *   VAPI_PHONE_NUMBER  — VAPI inbound number, e.g. +16173150930
 *   BASE_URL           — Public Railway URL, e.g. https://innercityfireprotection.com
 *   CLIENT_NAME        — Display name shown in logs/responses, e.g. "Inner City Fire Protection"
 */

const BUSINESS_NUMBER = "+16177679127";

/* ── env helpers ─────────────────────────────────────────────────── */

function forwardTo() {
  const n = process.env.FORWARD_TO_NUMBER || "";
  if (!n) throw new Error("FORWARD_TO_NUMBER env var not set");
  return n;
}

function vapiNumber() {
  return process.env.VAPI_PHONE_NUMBER || "+16173150930";
}

function baseUrl() {
  return (process.env.BASE_URL || "https://innercityfireprotection.com").replace(/\/$/, "");
}

function clientName() {
  return process.env.CLIENT_NAME || "ICFP";
}

/** Parse a comma-separated env var into a Set of E.164 strings. */
function envSet(key) {
  const raw = process.env[key] || "";
  return new Set(
    raw.split(",").map((s) => s.trim()).filter(Boolean)
  );
}

/* ── caller resolution ───────────────────────────────────────────── */

/** Extract caller number from Telnyx TeXML POST body (tries multiple field names). */
function callerNumber(req) {
  return (
    req.body.From ||
    req.body.from ||
    req.body.CallerNumber ||
    req.body.caller_number ||
    ""
  ).trim();
}

/* ── TeXML builders ─────────────────────────────────────────────── */

function xmlHangup() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response><Hangup/></Response>`;
}

function xmlReject() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>We're sorry, this call cannot be completed. Goodbye.</Say>
  <Hangup/>
</Response>`;
}

function xmlDialVapi() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${BUSINESS_NUMBER}">${vapiNumber()}</Dial>
</Response>`;
}

/* ── route handlers ─────────────────────────────────────────────── */

/**
 * POST /api/telnyx-voice
 * Initial inbound call handler — apply filters, then ring the human first.
 */
function handleInbound(req, res) {
  const from = callerNumber(req);
  const client = clientName();

  const blocked  = envSet("BLOCKED_NUMBERS");
  const allowed  = envSet("ALLOWED_NUMBERS");  // empty = allow all
  const vipSet   = envSet("VIP_NUMBERS");

  console.log(`[${client}] inbound from=${from || "(unknown)"}`);

  // 1. Blocked — silent hangup
  if (from && blocked.has(from)) {
    console.log(`[${client}] blocked: ${from}`);
    return res.set("Content-Type", "text/xml").send(xmlHangup());
  }

  // 2. Allowlist mode — if list is set and caller is not on it, reject politely
  if (allowed.size > 0 && from && !allowed.has(from)) {
    console.log(`[${client}] not on allowlist: ${from}`);
    return res.set("Content-Type", "text/xml").send(xmlReject());
  }

  // 3. VIP — skip human ring, go straight to Vapi
  if (from && vipSet.has(from)) {
    console.log(`[${client}] VIP, routing direct to Vapi: ${from}`);
    return res.set("Content-Type", "text/xml").send(xmlDialVapi());
  }

  // 4. Normal flow — ring human first, fall back to Vapi on no-answer
  const forwardNumber = forwardTo();
  const fallbackUrl   = `${baseUrl()}/api/telnyx-no-answer`;

  console.log(`[${client}] ringing ${forwardNumber} (20s), fallback → Vapi`);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="12" action="${fallbackUrl}" method="POST" callerId="${BUSINESS_NUMBER}">
    ${forwardNumber}
  </Dial>
</Response>`;

  res.set("Content-Type", "text/xml").send(xml);
}

/**
 * POST /api/telnyx-no-answer
 * Fallback — human didn't answer, hand off to VAPI.
 */
function handleNoAnswer(req, res) {
  const from   = callerNumber(req);
  const client = clientName();

  console.log(`[${client}] no-answer from=${from || "(unknown)"}, routing to Vapi`);

  res.set("Content-Type", "text/xml").send(xmlDialVapi());
}

module.exports = { handleInbound, handleNoAnswer };
