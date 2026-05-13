/**
 * Railway (or any Node host): listens on PORT and exposes the Vapi tool route.
 */

const express = require("express");
const vapiHandler = require("./api/vapi-voice-lead.js");

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "icfp-vapi-lead",
    vapiRoute: "/api/vapi-voice-lead",
  });
});

app.all("/api/vapi-voice-lead", (req, res) => {
  void vapiHandler(req, res);
});

const port = Number(process.env.PORT) || 3000;
const host = "0.0.0.0";
app.listen(port, host, () => {
  console.log(`Listening http://${host}:${port}`);
});
