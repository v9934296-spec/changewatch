async function initAccount() {
  let user;
  try {
    const data = await fetchCurrentUser();
    user = data.user;
  } catch {
    window.location.href = "/login.html";
    return;
  }

  document.getElementById("display-name").value = user.displayName || "";
  document.getElementById("email").value = user.email || "";
  document.getElementById("plan-label").textContent = planDisplay(user.plan);
  document.getElementById("member-since").textContent = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "—";

  const planIntent = new URLSearchParams(window.location.search).get("plan");
  if (planIntent === "pro" || planIntent === "power") {
    const el = document.getElementById("plan-intent");
    el.hidden = false;
    el.textContent = `You selected ${planIntent === "power" ? "Power" : "Pro"}. Billing will open here once Stripe is connected.`;
  }

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await authRequest("/api/auth/logout", { method: "POST", body: "{}" });
    window.location.href = "/login.html";
  });

  document.getElementById("profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorEl = document.getElementById("profile-error");
    const successEl = document.getElementById("profile-success");
    errorEl.hidden = true;
    successEl.hidden = true;
    const displayName = document.getElementById("display-name").value.trim();
    try {
      const data = await authRequest("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ displayName })
      });
      document.getElementById("display-name").value = data.user.displayName;
      successEl.hidden = false;
      successEl.textContent = "Display name updated.";
    } catch (err) {
      errorEl.hidden = false;
      errorEl.textContent = err.message;
    }
  });
}

initAccount();
