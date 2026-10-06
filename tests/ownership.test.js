const test = require("node:test");
const assert = require("node:assert/strict");
const { createMockAdmin } = require("./helpers/mock-admin");
const watchesService = require("../lib/watches-service");

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";
const WATCH_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const WATCH_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function seedStore() {
  return createMockAdmin({
    profiles: [
      { id: USER_A, email: "a@test.com", display_name: "A", plan: "free", created_at: "", updated_at: "" },
      { id: USER_B, email: "b@test.com", display_name: "B", plan: "free", created_at: "", updated_at: "" }
    ],
    watches: [
      {
        id: WATCH_A,
        user_id: USER_A,
        name: "Watch A",
        url: "https://example.com/a",
        webhook: null,
        interval_minutes: 360,
        paused: false,
        hash: "abc",
        text: "hello",
        title: "A",
        last_checked_at: null,
        last_changed_at: null,
        last_status: 200,
        last_error: null,
        change_count: 0,
        created_at: "2026-01-01T00:00:00.000Z"
      },
      {
        id: WATCH_B,
        user_id: USER_B,
        name: "Watch B",
        url: "https://example.com/b",
        webhook: null,
        interval_minutes: 360,
        paused: false,
        hash: "def",
        text: "world",
        title: "B",
        last_checked_at: null,
        last_changed_at: null,
        last_status: 200,
        last_error: null,
        change_count: 0,
        created_at: "2026-01-02T00:00:00.000Z"
      }
    ],
    alerts: [
      {
        id: "alert-a",
        watch_id: WATCH_A,
        user_id: USER_A,
        name: "Watch A",
        url: "https://example.com/a",
        title: "A",
        checked_at: "2026-01-03T00:00:00.000Z",
        added: [],
        removed: [],
        created_at: "2026-01-03T00:00:00.000Z"
      }
    ]
  });
}

test("User A cannot load User B watch by id", async () => {
  const admin = seedStore();
  const watch = await watchesService.getWatchForUser(admin, USER_A, WATCH_B);
  assert.equal(watch, null);
});

test("User B cannot check, pause, delete, or diff User A watch", async () => {
  const admin = seedStore();

  for (const fn of [
    () => watchesService.runCheckForUser(admin, USER_B, WATCH_A),
    () => watchesService.togglePause(admin, USER_B, WATCH_A),
    () => watchesService.deleteWatch(admin, USER_B, WATCH_A),
    () => watchesService.listAlertsForWatch(admin, USER_B, WATCH_A)
  ]) {
    await assert.rejects(fn, (err) => err.status === 404);
  }
});

test("listWatchesAndAlerts returns only the authenticated user's data", async () => {
  const admin = seedStore();
  const dataA = await watchesService.listWatchesAndAlerts(admin, USER_A);
  const dataB = await watchesService.listWatchesAndAlerts(admin, USER_B);

  assert.equal(dataA.watches.length, 1);
  assert.equal(dataA.watches[0].id, WATCH_A);
  assert.equal(dataA.alerts.length, 1);

  assert.equal(dataB.watches.length, 1);
  assert.equal(dataB.watches[0].id, WATCH_B);
  assert.equal(dataB.alerts.length, 0);
});
