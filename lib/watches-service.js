const crypto = require("crypto");
const { normalizeUrl, checkWatch, sendWebhook } = require("./monitoring");
const { validateWatchCreation, planLabel } = require("./plan-enforcement");
const { rowToWatch, watchToPublic, watchToRowUpdate, rowToAlert, rowToProfile } = require("./db-map");

function newId() {
  return crypto.randomUUID();
}

async function getProfile(admin, userId) {
  const { data, error } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error("Could not load profile.");
  return rowToProfile(data);
}

async function listWatchesAndAlerts(admin, userId) {
  const [watchesRes, alertsRes] = await Promise.all([
    admin
      .from("watches")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    admin
      .from("alerts")
      .select("*")
      .eq("user_id", userId)
      .order("checked_at", { ascending: false })
      .limit(40)
  ]);

  if (watchesRes.error) throw new Error("Could not load watches.");
  if (alertsRes.error) throw new Error("Could not load alerts.");

  return {
    watches: (watchesRes.data || []).map(rowToWatch).map(watchToPublic),
    alerts: (alertsRes.data || []).map(rowToAlert)
  };
}

async function getWatchForUser(admin, userId, watchId) {
  const { data, error } = await admin
    .from("watches")
    .select("*")
    .eq("id", watchId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Could not load watch.");
  return rowToWatch(data);
}

async function createWatch(admin, userId, body) {
  const profile = await getProfile(admin, userId);
  const plan = planLabel(profile?.plan);

  const { count, error: countError } = await admin
    .from("watches")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (countError) throw new Error("Could not verify watch limit.");

  const intervalMinutes = Math.min(1440, Math.max(1, Number(body.intervalMinutes || 15)));
  const limitCheck = validateWatchCreation({
    plan,
    watchCount: count || 0,
    intervalMinutes
  });
  if (!limitCheck.ok) {
    const err = new Error(limitCheck.error);
    err.code = limitCheck.code;
    throw err;
  }

  const url = normalizeUrl(body.url);
  const name = String(body.name || "").trim().slice(0, 80) || new URL(url).hostname;
  const webhook = String(body.webhook || "").trim();
  if (webhook) normalizeUrl(webhook);

  const watch = {
    id: newId(),
    userId,
    name,
    url,
    webhook,
    intervalMinutes,
    paused: false,
    hash: "",
    text: "",
    title: "",
    lastCheckedAt: "",
    lastChangedAt: "",
    lastStatus: 0,
    lastError: "",
    changeCount: 0,
    createdAt: new Date().toISOString()
  };

  const check = await checkWatch(watch);

  const { error: insertError } = await admin.from("watches").insert({
    id: watch.id,
    user_id: userId,
    name: watch.name,
    url: watch.url,
    webhook: watch.webhook || null,
    interval_minutes: watch.intervalMinutes,
    paused: watch.paused,
    hash: watch.hash || null,
    text: watch.text || null,
    title: watch.title || null,
    last_checked_at: watch.lastCheckedAt || null,
    last_changed_at: watch.lastChangedAt || null,
    last_status: watch.lastStatus ?? null,
    last_error: watch.lastError || null,
    change_count: watch.changeCount ?? 0
  });
  if (insertError) throw new Error("Could not save watch.");

  return { watch: watchToPublic(watch), check };
}

async function saveWatchState(admin, watch) {
  const { error } = await admin.from("watches").update(watchToRowUpdate(watch)).eq("id", watch.id);
  if (error) throw new Error("Could not update watch.");
}

async function runCheckForUser(admin, userId, watchId) {
  const watch = await getWatchForUser(admin, userId, watchId);
  if (!watch) {
    const err = new Error("Watch not found.");
    err.status = 404;
    throw err;
  }

  const check = await checkWatch(watch);
  let webhookResult;

  if (check.changed) {
    const alert = {
      id: newId(),
      watchId: watch.id,
      userId: watch.userId,
      name: watch.name,
      url: watch.url,
      title: check.title,
      checkedAt: check.checkedAt,
      added: check.added,
      removed: check.removed
    };
    const { error: alertError } = await admin.from("alerts").insert({
      id: alert.id,
      watch_id: alert.watchId,
      user_id: alert.userId,
      name: alert.name,
      url: alert.url,
      title: alert.title,
      checked_at: alert.checkedAt,
      added: alert.added,
      removed: alert.removed
    });
    if (alertError) throw new Error("Could not save alert.");
    webhookResult = await sendWebhook(watch, alert);
    check.webhook = webhookResult;
  }

  await saveWatchState(admin, watch);
  return { watch: watchToPublic(watch), check };
}

async function togglePause(admin, userId, watchId) {
  const watch = await getWatchForUser(admin, userId, watchId);
  if (!watch) {
    const err = new Error("Watch not found.");
    err.status = 404;
    throw err;
  }
  watch.paused = !watch.paused;
  await saveWatchState(admin, watch);
  return { watch: watchToPublic(watch) };
}

async function deleteWatch(admin, userId, watchId) {
  const watch = await getWatchForUser(admin, userId, watchId);
  if (!watch) {
    const err = new Error("Watch not found.");
    err.status = 404;
    throw err;
  }
  const { error } = await admin.from("watches").delete().eq("id", watchId).eq("user_id", userId);
  if (error) throw new Error("Could not delete watch.");
  return { ok: true };
}

async function listAlertsForWatch(admin, userId, watchId) {
  const watch = await getWatchForUser(admin, userId, watchId);
  if (!watch) {
    const err = new Error("Watch not found.");
    err.status = 404;
    throw err;
  }
  const { data, error } = await admin
    .from("alerts")
    .select("*")
    .eq("watch_id", watchId)
    .eq("user_id", userId)
    .order("checked_at", { ascending: false });
  if (error) throw new Error("Could not load alerts.");
  return { alerts: (data || []).map(rowToAlert) };
}

async function pollDueWatches(admin) {
  const { data, error } = await admin.from("watches").select("*").eq("paused", false);
  if (error) throw new Error("Could not load watches for polling.");
  const now = Date.now();
  const due = (data || [])
    .map(rowToWatch)
    .filter((watch) => {
      const last = watch.lastCheckedAt ? Date.parse(watch.lastCheckedAt) : 0;
      return now - last >= watch.intervalMinutes * 60 * 1000;
    });

  for (const watch of due) {
    const check = await checkWatch(watch);
    if (check.changed) {
      const alert = {
        id: newId(),
        watchId: watch.id,
        userId: watch.userId,
        name: watch.name,
        url: watch.url,
        title: check.title,
        checkedAt: check.checkedAt,
        added: check.added,
        removed: check.removed
      };
      await admin.from("alerts").insert({
        id: alert.id,
        watch_id: alert.watchId,
        user_id: alert.userId,
        name: alert.name,
        url: alert.url,
        title: alert.title,
        checked_at: alert.checkedAt,
        added: alert.added,
        removed: alert.removed
      });
      await sendWebhook(watch, alert);
    }
    await saveWatchState(admin, watch);
  }
}

module.exports = {
  getProfile,
  listWatchesAndAlerts,
  getWatchForUser,
  createWatch,
  runCheckForUser,
  togglePause,
  deleteWatch,
  listAlertsForWatch,
  pollDueWatches
};
