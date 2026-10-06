#!/usr/bin/env node
/**
 * Migrate legacy data/watches.json into Supabase for one explicit user.
 *
 * Usage:
 *   node scripts/migrate-json-data.js <supabase-user-id>
 *   node scripts/migrate-json-data.js <supabase-user-id> --dry-run
 */
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getAdminClient } = require("../lib/supabase");

const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "data", "watches.json");

function usage() {
  console.error("Usage: node scripts/migrate-json-data.js <supabase-user-id> [--dry-run]");
  process.exit(1);
}

async function main() {
  const userId = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!userId) usage();

  let db;
  try {
    db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    console.error("Could not read data/watches.json");
    process.exit(1);
  }

  const watches = Array.isArray(db.watches) ? db.watches : [];
  const alerts = Array.isArray(db.alerts) ? db.alerts : [];

  const admin = getAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (profileError || !profile) {
    console.error("Target user profile not found:", userId);
    process.exit(1);
  }

  const idMap = new Map();
  for (const legacy of watches) {
    idMap.set(legacy.id, crypto.randomUUID());
  }

  console.log(`User: ${userId}`);
  console.log(`Watches: ${watches.length}, Alerts: ${alerts.length}, dryRun: ${dryRun}`);

  if (dryRun) {
    console.log("Dry run complete. No data written.");
    return;
  }

  for (const legacy of watches) {
    const row = {
      id: idMap.get(legacy.id),
      user_id: userId,
      name: legacy.name || null,
      url: legacy.url,
      webhook: legacy.webhook || null,
      interval_minutes: legacy.intervalMinutes || 15,
      paused: Boolean(legacy.paused),
      hash: legacy.hash || null,
      text: legacy.text || null,
      title: legacy.title || null,
      last_checked_at: legacy.lastCheckedAt || null,
      last_changed_at: legacy.lastChangedAt || null,
      last_status: legacy.lastStatus ?? null,
      last_error: legacy.lastError || null,
      change_count: legacy.changeCount || 0,
      created_at: legacy.createdAt || new Date().toISOString()
    };
    const { error } = await admin.from("watches").insert(row);
    if (error) {
      console.error("Failed watch insert:", legacy.id, error.message);
      process.exit(1);
    }
  }

  for (const legacy of alerts) {
    const watchId = idMap.get(legacy.watchId);
    if (!watchId) continue;
    const row = {
      id: crypto.randomUUID(),
      watch_id: watchId,
      user_id: userId,
      name: legacy.name || null,
      url: legacy.url || null,
      title: legacy.title || null,
      checked_at: legacy.checkedAt || null,
      added: legacy.added || [],
      removed: legacy.removed || [],
      created_at: legacy.checkedAt || new Date().toISOString()
    };
    const { error } = await admin.from("alerts").insert(row);
    if (error) {
      console.error("Failed alert insert:", legacy.id, error.message);
      process.exit(1);
    }
  }

  console.log("Migration complete. data/watches.json was not modified.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
