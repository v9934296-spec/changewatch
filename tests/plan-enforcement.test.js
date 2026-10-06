const test = require("node:test");
const assert = require("node:assert/strict");
const { validateWatchCreation } = require("../lib/plan-enforcement");

test("free allows watches 1-5 and rejects watch 6", () => {
  for (let count = 0; count < 5; count += 1) {
    const ok = validateWatchCreation({ plan: "free", watchCount: count, intervalMinutes: 360 });
    assert.equal(ok.ok, true);
  }
  const blocked = validateWatchCreation({ plan: "free", watchCount: 5, intervalMinutes: 360 });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "PLAN_LIMIT");
});

test("free rejects interval below 360 minutes", () => {
  const result = validateWatchCreation({ plan: "free", watchCount: 0, intervalMinutes: 15 });
  assert.equal(result.ok, false);
  assert.equal(result.code, "PLAN_INTERVAL");
});

test("pro enforces 25 max and 15-minute minimum", () => {
  assert.equal(validateWatchCreation({ plan: "pro", watchCount: 24, intervalMinutes: 15 }).ok, true);
  assert.equal(validateWatchCreation({ plan: "pro", watchCount: 25, intervalMinutes: 15 }).ok, false);
  assert.equal(validateWatchCreation({ plan: "pro", watchCount: 0, intervalMinutes: 5 }).ok, false);
});

test("power enforces 100 max and 5-minute minimum", () => {
  assert.equal(validateWatchCreation({ plan: "power", watchCount: 99, intervalMinutes: 5 }).ok, true);
  assert.equal(validateWatchCreation({ plan: "power", watchCount: 100, intervalMinutes: 5 }).ok, false);
  assert.equal(validateWatchCreation({ plan: "power", watchCount: 0, intervalMinutes: 1 }).ok, false);
});
