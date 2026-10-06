const test = require("node:test");
const assert = require("node:assert/strict");
const { createMockAdmin } = require("./helpers/mock-admin");
const watchesService = require("../lib/watches-service");

const USER = "11111111-1111-1111-1111-111111111111";

test("free sixth watch is rejected at creation time", async () => {
  const watches = Array.from({ length: 5 }).map((_, i) => ({
    id: `00000000-0000-0000-0000-00000000000${i}`,
    user_id: USER,
    name: `W${i}`,
    url: `https://example.com/${i}`,
    webhook: null,
    interval_minutes: 360,
    paused: false,
    hash: "x",
    text: "t",
    title: "t",
    last_checked_at: null,
    last_changed_at: null,
    last_status: 200,
    last_error: null,
    change_count: 0,
    created_at: "2026-01-01T00:00:00.000Z"
  }));

  const admin = createMockAdmin({
    profiles: [{ id: USER, email: "u@test.com", display_name: "U", plan: "free", created_at: "", updated_at: "" }],
    watches
  });

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    url: "https://example.com/new",
    text: async () => "<html><body>new</body></html>"
  });

  try {
    await assert.rejects(
      () =>
        watchesService.createWatch(admin, USER, {
          url: "https://example.com/new",
          intervalMinutes: 360
        }),
      (err) => err.code === "PLAN_LIMIT"
    );
  } finally {
    global.fetch = originalFetch;
  }
});
