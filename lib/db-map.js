function rowToWatch(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name || "",
    url: row.url,
    webhook: row.webhook || "",
    intervalMinutes: row.interval_minutes,
    paused: row.paused,
    hash: row.hash || "",
    text: row.text || "",
    title: row.title || "",
    lastCheckedAt: row.last_checked_at || "",
    lastChangedAt: row.last_changed_at || "",
    lastStatus: row.last_status ?? 0,
    lastError: row.last_error || "",
    changeCount: row.change_count ?? 0,
    createdAt: row.created_at || ""
  };
}

function watchToPublic(watch) {
  const { text, userId, ...rest } = watch;
  return rest;
}

function watchToRowUpdate(watch) {
  return {
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
  };
}

function rowToAlert(row) {
  if (!row) return null;
  return {
    id: row.id,
    watchId: row.watch_id,
    userId: row.user_id,
    name: row.name || "",
    url: row.url || "",
    title: row.title || "",
    checkedAt: row.checked_at || "",
    added: row.added || [],
    removed: row.removed || [],
    createdAt: row.created_at || ""
  };
}

function rowToProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email || "",
    displayName: row.display_name || "",
    plan: row.plan || "free",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

module.exports = {
  rowToWatch,
  watchToPublic,
  watchToRowUpdate,
  rowToAlert,
  rowToProfile
};
