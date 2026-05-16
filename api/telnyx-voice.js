/**
 * Telnyx TeXML handlers for ICFP inbound call routing.
 *
 * Flow:
 *   1. Customer calls 617-767-9127 (Telnyx)
 *   2. Telnyx POST /api/telnyx-voice → TeXML rings FORWARD_TO_NUMBER for 20 s
 *   3a. Human picks up → connected, done.
 *   3b. No answer → Telnyx POST /api/telnyx-no-answer → TeXML dials VAPI
 *
 * Env:
 *   FORWARD_TO_NUMBER  — E.164 number to ring first, e.g. +16175079146
 *   VAPI_PHONE_NUMBER  — VAPI inbound number, e.g. +16173150930
 *   BASE_URL           — Public Railway URL, e.g. https://innercityfireprotection.com
 */

const BUSINESS_NUMBER = "+16177679127";

function forwardTo() {
  const n = process.env.FORWARD_TO_NUMBER || "";
  if (!n) throw new Error("FORWARD_TO_NUMBER env var not set");
  return n;
}

function vapiNumber() {
  const n = process.env.VAPI_PHONE_NUMBER || "+16173150930";
  return n;
}

function baseUrl() {
  const u = process.env.BASE_URL || "https://innercityfireprotection.com";
  return u.replace(/\/$/, "");
}

/**
 * POST /api/telnyx-voice
 * Initial inbound call handler — ring the human first.
 */
function handleInbound(req, res) {
  const forwardNumber = forwardTo();
  const fallbackUrl = `${baseUrl()}/api/telnyx-no-answer`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="20" action="${fallbackUrl}" method="POST" callerId="${BUSINESS_NUMBER}">
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
  const vapi = vapiNumber();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${BUSINESS_NUMBER}">
    ${vapi}
  </Dial>
</Response>`;

  res.set("Content-Type", "text/xml").send(xml);
}

module.exports = { handleInbound, handleNoAnswer };
