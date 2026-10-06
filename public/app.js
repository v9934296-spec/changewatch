const watchesEl = document.getElementById("watches");
const alertsEl = document.getElementById("alerts");
const form = document.getElementById("watch-form");
const formError = document.getElementById("form-error");
const refreshButton = document.getElementById("refresh");
const toast = document.getElementById("toast");
const intervalSelect = form?.querySelector('select[name="intervalMinutes"]');

let toastTimer;
let currentUser = null;

const PLAN_INTERVALS = {
  free: [
    { value: 360, label: "6 hours" },
    { value: 1440, label: "24 hours" }
  ],
  pro: [
    { value: 15, label: "15 min" },
    { value: 60, label: "1 hour" },
    { value: 360, label: "6 hours" },
    { value: 1440, label: "24 hours" }
  ],
  power: [
    { value: 5, label: "5 min" },
    { value: 15, label: "15 min" },
    { value: 60, label: "1 hour" },
    { value: 360, label: "6 hours" },
    { value: 1440, label: "24 hours" }
  ]
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function when(iso) {
  if (!iso) return "Not checked yet";
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "Unknown";
  const delta = Math.max(0, Date.now() - parsed);
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function intervalLabel(minutes) {
  const value = Number(minutes);
  if (value < 60) return `${value} min`;
  if (value === 60) return "1 hour";
  if (value < 1440) return `${value / 60} hours`;
  return "24 hours";
}

function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function showToast(message, tone = "success") {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast ${tone}`;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("show"));
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => { toast.hidden = true; }, 180);
  }, 2800);
}

function watchCard(watch) {
  const state = watch.lastError ? "error" : watch.paused ? "paused" : "live";
  const stateText = state === "live" ? "Active" : state === "paused" ? "Paused" : "Needs attention";
  const safeUrl = escapeHtml(watch.url);
  const title = watch.title || "Baseline ready";

  return `
    <article class="watch-row" data-id="${escapeHtml(watch.id)}">
      <div class="watch-primary">
        <span class="watch-indicator ${state}" aria-hidden="true"></span>
        <div class="watch-name-wrap">
          <div class="watch-name-line">
            <strong>${escapeHtml(watch.name)}</strong>
            <span class="status-chip ${state}">${stateText}</span>
          </div>
          <a href="${safeUrl}" target="_blank" rel="noreferrer">${escapeHtml(hostname(watch.url))} <span aria-hidden="true">↗</span></a>
        </div>
      </div>
      <div class="watch-detail desktop-detail">
        <span>Checks</span>
        <strong>${escapeHtml(intervalLabel(watch.intervalMinutes))}</strong>
      </div>
      <div class="watch-detail desktop-detail">
        <span>Last checked</span>
        <strong>${escapeHtml(when(watch.lastCheckedAt))}</strong>
      </div>
      <div class="watch-detail desktop-detail">
        <span>Changes</span>
        <strong>${Number(watch.changeCount || 0)}</strong>
      </div>
      <div class="watch-actions">
        <button class="icon-action" type="button" data-action="check" title="Check now" aria-label="Check ${escapeHtml(watch.name)} now">↻</button>
        <button class="text-action" type="button" data-action="pause">${watch.paused ? "Resume" : "Pause"}</button>
        <button class="icon-action danger-action" type="button" data-action="delete" title="Delete watch" aria-label="Delete ${escapeHtml(watch.name)}">×</button>
      </div>
      <div class="watch-mobile-meta">
        <span>${escapeHtml(intervalLabel(watch.intervalMinutes))}</span>
        <span>${escapeHtml(when(watch.lastCheckedAt))}</span>
        <span>${Number(watch.changeCount || 0)} change${Number(watch.changeCount || 0) === 1 ? "" : "s"}</span>
      </div>
      ${watch.lastError ? `<p class="watch-error">${escapeHtml(watch.lastError)}</p>` : `<p class="watch-title">${escapeHtml(title)}</p>`}
    </article>`;
}

function diffLines(lines, kind) {
  if (!lines || !lines.length) return "";
  const symbol = kind === "added" ? "+" : "−";
  return lines.slice(0, 5).map((line) => `
    <div class="diff-line ${kind}">
      <span>${symbol}</span>
      <p>${escapeHtml(line)}</p>
    </div>`).join("");
}

function alertCard(alert) {
  const removed = diffLines(alert.removed, "removed");
  const added = diffLines(alert.added, "added");
  const hasDiff = removed || added;

  return `
    <article class="change-row">
      <div class="change-rail"><span></span></div>
      <div class="change-content">
        <div class="change-heading">
          <div>
            <span class="change-label">Change detected</span>
            <h3>${escapeHtml(alert.name)}</h3>
          </div>
          <time datetime="${escapeHtml(alert.checkedAt)}">${escapeHtml(when(alert.checkedAt))}</time>
        </div>
        <div class="change-source">
          <span>${escapeHtml(alert.title || hostname(alert.url || ""))}</span>
          ${alert.url ? `<a href="${escapeHtml(alert.url)}" target="_blank" rel="noreferrer">Open page ↗</a>` : ""}
        </div>
        <div class="diff-block">
          ${hasDiff ? `${removed}${added}` : `<p class="diff-empty">The page changed, but no line-level difference was captured.</p>`}
        </div>
      </div>
    </article>`;
}

function renderMetrics(watches, alerts) {
  const active = watches.filter((watch) => !watch.paused && !watch.lastError).length;
  const paused = watches.filter((watch) => watch.paused).length;
  const errors = watches.filter((watch) => watch.lastError).length;
  const totalChanges = watches.reduce((sum, watch) => sum + Number(watch.changeCount || 0), 0);

  document.getElementById("metric-active").textContent = active;
  document.getElementById("metric-changes").textContent = totalChanges;
  document.getElementById("metric-paused").textContent = paused;

  const health = document.getElementById("metric-health");
  const healthNote = document.getElementById("metric-health-note");
  if (errors > 0) {
    health.textContent = `${errors} issue${errors === 1 ? "" : "s"}`;
    health.className = "metric-value metric-health has-errors";
    healthNote.textContent = "review failed checks";
  } else {
    health.textContent = "Good";
    health.className = "metric-value metric-health";
    healthNote.textContent = watches.length ? "all monitors healthy" : "ready for first watch";
  }

  document.getElementById("watch-count").textContent = `${watches.length} watch${watches.length === 1 ? "" : "es"}`;
}

function renderEmptyWatches() {
  return `
    <div class="empty-state">
      <div class="empty-icon">◎</div>
      <h3>No watches yet</h3>
      <p>Add a public page above. Its first successful check becomes the baseline.</p>
      <a href="#overview" class="text-link">Create your first watch ↑</a>
    </div>`;
}

function renderEmptyAlerts() {
  return `
    <div class="empty-state compact-empty">
      <div class="empty-icon">↯</div>
      <h3>No changes detected</h3>
      <p>When a watched page changes, the before-and-after text will appear here.</p>
    </div>`;
}

async function requestJson(url, options) {
  const res = await fetch(url, {
    credentials: "include",
    ...options
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (res.status === 401) {
    window.location.href = "/login.html";
    throw new Error("Authentication required.");
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function configureIntervalOptions(plan) {
  if (!intervalSelect) return;
  const key = ["free", "pro", "power"].includes(plan) ? plan : "free";
  const options = PLAN_INTERVALS[key];
  intervalSelect.innerHTML = options
    .map((item) => `<option value="${item.value}">${item.label}</option>`)
    .join("");
}

async function ensureAuthenticated() {
  try {
    const data = await fetchCurrentUser();
    currentUser = data.user;
    document.getElementById("account-name").textContent = currentUser.displayName || currentUser.email;
    document.getElementById("account-plan").textContent = planDisplay(currentUser.plan);
    configureIntervalOptions(currentUser.plan);
    document.getElementById("logout-link").addEventListener("click", async () => {
      await authRequest("/api/auth/logout", { method: "POST", body: "{}" });
      window.location.href = "/login.html";
    });
    return true;
  } catch {
    window.location.href = "/login.html";
    return false;
  }
}

async function load({ quiet = false } = {}) {
  if (!quiet) refreshButton.classList.add("is-loading");
  try {
    const data = await requestJson("/api/watches");
    const watches = Array.isArray(data.watches) ? data.watches : [];
    const alerts = Array.isArray(data.alerts) ? data.alerts : [];

    renderMetrics(watches, alerts);
    watchesEl.innerHTML = watches.length ? watches.map(watchCard).join("") : renderEmptyWatches();
    alertsEl.innerHTML = alerts.length ? alerts.map(alertCard).join("") : renderEmptyAlerts();
  } catch (err) {
    watchesEl.innerHTML = `<div class="load-error"><strong>Could not load watches.</strong><span>${escapeHtml(err.message)}</span></div>`;
    alertsEl.innerHTML = `<div class="load-error"><strong>Could not load changes.</strong><span>Try refreshing the dashboard.</span></div>`;
    showToast("Dashboard refresh failed", "error");
  } finally {
    refreshButton.classList.remove("is-loading");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.hidden = true;
  const body = Object.fromEntries(new FormData(form).entries());
  const button = form.querySelector('button[type="submit"]');
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = "<span>Saving baseline…</span><span class='button-spinner' aria-hidden='true'></span>";

  try {
    await requestJson("/api/watches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    form.reset();
    showToast("Watch created. Baseline saved.");
    await load({ quiet: true });
    document.getElementById("watches-section").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    formError.hidden = false;
    formError.textContent = err.message;
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
});

refreshButton.addEventListener("click", async () => {
  await load();
  showToast("Dashboard refreshed");
});

watchesEl.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const card = button.closest(".watch-row");
  const id = card?.dataset.id;
  const action = button.dataset.action;
  if (!id) return;

  if (action === "delete" && !window.confirm("Delete this watch? Its saved monitor will be removed.")) return;

  const original = button.textContent;
  button.disabled = true;
  if (action === "check") button.textContent = "…";

  try {
    if (action === "delete") {
      await requestJson(`/api/watches/${encodeURIComponent(id)}`, { method: "DELETE" });
      showToast("Watch deleted");
    } else if (action === "pause") {
      await requestJson(`/api/watches/${encodeURIComponent(id)}/pause`, { method: "POST" });
      showToast(original === "Pause" ? "Watch paused" : "Watch resumed");
    } else {
      const data = await requestJson(`/api/watches/${encodeURIComponent(id)}/check`, { method: "POST" });
      showToast(data.check?.changed ? "Change detected" : "Checked. No change.", data.check?.changed ? "notice" : "success");
    }
    await load({ quiet: true });
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
});

(async function bootstrap() {
  const ok = await ensureAuthenticated();
  if (ok) await load({ quiet: true });
})();
