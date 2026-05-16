/**
 * Railway: static site + Vapi tool route on the same process.
 */

const path = require("path");
const express = require("express");
const vapiHandler = require("./api/vapi-voice-lead.js");
const { handleInbound, handleNoAnswer } = require("./api/telnyx-voice.js");

const app = express();
const rootDir = path.join(__dirname);

app.use(express.json({ limit: "1mb" }));

/** Tiny JSON health check (marketing site owns `/`). */
app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true, service: "icfp-vapi-lead" });
});

app.all("/api/vapi-voice-lead", (req, res) => {
  void vapiHandler(req, res);
});

/** Telnyx TeXML: ring human first, fall back to VAPI after 20 s. */
app.post("/api/telnyx-voice", (req, res) => {
  try {
    handleInbound(req, res);
  } catch (e) {
    res.status(500).set("Content-Type", "text/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${e.message}</Say></Response>`
    );
  }
});

app.post("/api/telnyx-no-answer", (req, res) => {
  handleNoAnswer(req, res);
});

app.use(
  express.static(rootDir, {
    extensions: ["html"],
    etag: true,
    maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
    setHeaders(res, filepath) {
      if (filepath.endsWith(".css") || filepath.endsWith(".js")) {
        res.setHeader("cache-control", "public, max-age=3600");
      }
    },
  }),
);

/** Match existing repo 404 page for unknown paths except /api/*. */
app.use((_req, res) => {
  res.status(404).sendFile(path.join(rootDir, "404.html"));
});

const port = Number(process.env.PORT) || 3000;
const host = "0.0.0.0";
app.listen(port, host, () => {
  console.log(`Listening http://${host}:${port}`);
});
