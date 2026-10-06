require("dotenv").config();

const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const { getAdminClient } = require("./lib/supabase");
const watchesService = require("./lib/watches-service");
const authRoutes = require("./routes/auth");
const watchRoutes = require("./routes/watches");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const POLL_SECONDS = Math.max(30, Number(process.env.POLL_SECONDS || 120));

function assertConfig() {
  const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length && process.env.NODE_ENV !== "test") {
    console.error("Missing environment variables:", missing.join(", "));
    console.error("Copy .env.example to .env and configure your Supabase project.");
    process.exit(1);
  }
}

assertConfig();

const app = express();
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(ROOT, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, pollSeconds: POLL_SECONDS });
});

app.use("/api/auth", authRoutes);
app.use("/api/watches", watchRoutes);

let polling = false;
async function pollDue() {
  if (polling) return;
  polling = true;
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
    const admin = getAdminClient();
    await watchesService.pollDueWatches(admin);
  } catch (err) {
    console.error("[poll]", err.message);
  } finally {
    polling = false;
  }
}

if (process.env.NODE_ENV !== "test") {
  setInterval(pollDue, POLL_SECONDS * 1000);
  app.listen(PORT, () => {
    console.log("ChangeWatch running at http://localhost:" + PORT);
  });
}

module.exports = { app, pollDue };
