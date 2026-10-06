function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function authRequest(url, options = {}) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) throw new Error(data.error || data.message || `Request failed (${res.status})`);
  return data;
}

async function fetchCurrentUser() {
  return authRequest("/api/auth/me");
}

function planDisplay(plan) {
  const value = String(plan || "free").toLowerCase();
  if (value === "power") return "Power";
  if (value === "pro") return "Pro";
  return "Free";
}

function queryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function redirectAfterAuth() {
  const plan = queryParam("plan");
  if (plan === "pro" || plan === "power") {
    window.location.href = `/account.html?plan=${encodeURIComponent(plan)}`;
    return;
  }
  window.location.href = "/app.html";
}
