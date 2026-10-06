const { createClient } = require("@supabase/supabase-js");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createAuthClient() {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

function createAdminClient() {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

let authClient;
let adminClient;

function getAuthClient() {
  if (!authClient) authClient = createAuthClient();
  return authClient;
}

function getAdminClient() {
  if (!adminClient) adminClient = createAdminClient();
  return adminClient;
}

function resetClientsForTests() {
  authClient = undefined;
  adminClient = undefined;
}

module.exports = {
  getAuthClient,
  getAdminClient,
  resetClientsForTests
};
