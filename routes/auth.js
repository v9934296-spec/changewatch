const express = require("express");
const { getAuthClient, getAdminClient } = require("../lib/supabase");
const { setSessionCookies, clearSessionCookies, resolveSessionUser } = require("../lib/session");
const { rowToProfile } = require("../lib/db-map");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function appUrl() {
  return process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
}

function safeAuthError(message) {
  return message || "Could not complete authentication.";
}

router.post("/signup", async (req, res) => {
  try {
    const displayName = String(req.body.displayName || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!displayName) return res.status(400).json({ error: "Display name is required." });
    if (displayName.length > 80) return res.status(400).json({ error: "Display name must be 80 characters or fewer." });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "A valid email is required." });
    }
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });

    const admin = getAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName }
    });
    if (error) {
      const msg = error.message.includes("already registered")
        ? "An account with this email already exists."
        : safeAuthError(error.message);
      return res.status(400).json({ error: msg });
    }

    if (data.user?.id) {
      await admin
        .from("profiles")
        .update({ display_name: displayName, email })
        .eq("id", data.user.id);
    }

    const authClient = getAuthClient();
    const signIn = await authClient.auth.signInWithPassword({ email, password });
    if (signIn.error || !signIn.data.session) {
      return res.status(201).json({
        ok: true,
        needsEmailConfirmation: true,
        message: "Account created. Check your email if confirmation is required, then sign in."
      });
    }

    setSessionCookies(res, signIn.data.session);
    return res.status(201).json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Could not create account." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

    const authClient = getAuthClient();
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    setSessionCookies(res, data.session);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Could not sign in." });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const session = await resolveSessionUser(req, res);
    if (session?.accessToken) {
      const authClient = getAuthClient();
      await authClient.auth.signOut({ scope: "local" });
    }
    clearSessionCookies(res);
    return res.json({ ok: true });
  } catch {
    clearSessionCookies(res);
    return res.json({ ok: true });
  }
});

router.get("/me", async (req, res) => {
  try {
    const session = await resolveSessionUser(req, res);
    if (!session?.user?.id) return res.status(401).json({ error: "Authentication required." });

    const admin = getAdminClient();
    const { data, error } = await admin.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (error || !data) return res.status(401).json({ error: "Authentication required." });

    const profile = rowToProfile(data);
    return res.json({
      user: {
        id: profile.id,
        email: profile.email || session.user.email || "",
        displayName: profile.displayName,
        plan: profile.plan,
        createdAt: profile.createdAt
      }
    });
  } catch {
    return res.status(401).json({ error: "Authentication required." });
  }
});

router.patch("/profile", requireAuth, async (req, res) => {
  try {
    const displayName = String(req.body.displayName || "").trim();
    if (!displayName) return res.status(400).json({ error: "Display name is required." });
    if (displayName.length > 80) return res.status(400).json({ error: "Display name must be 80 characters or fewer." });

    const admin = getAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", req.user.id)
      .select("*")
      .maybeSingle();
    if (error || !data) return res.status(400).json({ error: "Could not update profile." });

    const profile = rowToProfile(data);
    return res.json({
      user: {
        id: profile.id,
        email: profile.email,
        displayName: profile.displayName,
        plan: profile.plan,
        createdAt: profile.createdAt
      }
    });
  } catch {
    return res.status(500).json({ error: "Could not update profile." });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Email is required." });

    const authClient = getAuthClient();
    await authClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl()}/login.html`
    });

    return res.json({
      ok: true,
      message: "If an account exists for that email, a reset link has been sent."
    });
  } catch {
    return res.json({
      ok: true,
      message: "If an account exists for that email, a reset link has been sent."
    });
  }
});

module.exports = router;
