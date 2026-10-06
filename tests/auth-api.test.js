const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const express = require("express");
const cookieParser = require("cookie-parser");
const watchRoutes = require("../routes/watches");
const { requireAuth } = require("../middleware/auth");

process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "anon-key-test";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "service-key-test";

test("protected watch route returns 401 when signed out", async () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/watches", watchRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/watches`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.match(body.error, /Authentication required/i);
  } finally {
    server.close();
  }
});

test("requireAuth rejects invalid session cookies", async () => {
  const app = express();
  app.use(cookieParser());
  app.get("/protected", requireAuth, (req, res) => res.json({ ok: true }));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/protected`, {
      headers: { cookie: "changewatch_session_access=invalid-token" }
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});
