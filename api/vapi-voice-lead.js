/**
 * Vapi Server URL handler for submitICFPVoiceLead → Resend notification email.
 *
 * Deploy: Vercel (route: /api/vapi-voice-lead). In Vapi tool settings, set Server URL to:
 *   https://<your-deployment>.vercel.app/api/vapi-voice-lead
 *
 * Resend send endpoint (for reference — your server calls this; Vapi does not):
 *   POST https://api.resend.com/emails
 *
 * Env (Vercel → Project → Settings → Environment Variables):
 *   RESEND_API_KEY   — Resend API key (re_...)
 *   RESEND_FROM      — Verified sender, e.g. "ICFP Leads <leads@yourdomain.com>"
 *   NOTIFY_TO        — Business inbox (comma-separated for multiple)
 *   VAPI_TOOL_SECRET — Optional; if set, require Authorization: Bearer <same>
 */

const RESEND_URL = "https://api.resend.com/emails";

function parseArgs(raw) {
  if (raw == null || raw === "") return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

function collectToolCalls(message) {
  if (!message || message.type !== "tool-calls") return [];
  const fromList = message.toolCallList || [];
  const fromWrapped = (message.toolWithToolCallList || [])
    .map((x) => x.toolCall)
    .filter(Boolean);
  const byId = new Map();
  for (const tc of [...fromList, ...fromWrapped]) {
    if (tc && tc.id) byId.set(tc.id, tc);
  }
  return [...byId.values()];
}

function authOk(req) {
  const secret = process.env.VAPI_TOOL_SECRET;
  if (!secret) return true;
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  return token === secret;
}

async function sendLeadEmail(args) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const toRaw = process.env.NOTIFY_TO;
  if (!key || !from || !toRaw) {
    throw new Error("Missing RESEND_API_KEY, RESEND_FROM, or NOTIFY_TO");
  }
  const to = toRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const name = String(args.name || "").trim() || "(no name)";
  const phone = String(args.phone || "").trim() || "(no phone)";
  const email = String(args.email || "").trim();
  const msg = String(args.message || "").trim() || "(no message)";

  const text = [
    "New ICFP voice lead (Vapi)",
    "",
    `Name: ${name}`,
    `Phone: ${phone}`,
    `Email: ${email || "(none)"}`,
    "",
    "Message / summary:",
    msg,
  ].join("\n");

  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: `ICFP voice lead: ${name}`,
      text,
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${body.slice(0, 500)}`);
  }
  return body;
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    res.status(200).json({ ok: true, route: "vapi-voice-lead" });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).setHeader("Allow", "POST").json({ error: "Method not allowed" });
    return;
  }
  if (!authOk(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let payload;
  try {
    payload =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  const message = payload.message || payload;
  const toolCalls = collectToolCalls(message);

  const results = [];
  for (const tc of toolCalls) {
    const fn = tc.function || {};
    const toolCallId = tc.id;
    const name = fn.name || "";
    const args = parseArgs(fn.arguments);

    if (name !== "submitICFPVoiceLead") {
      results.push({
        name,
        toolCallId,
        error: "Unknown tool",
      });
      continue;
    }

    try {
      await sendLeadEmail(args);
      results.push({
        name,
        toolCallId,
        result: JSON.stringify({ ok: true, sent: true }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({
        name,
        toolCallId,
        error: msg.replace(/\s+/g, " ").slice(0, 500),
      });
    }
  }

  res.status(200).json({ results });
}
