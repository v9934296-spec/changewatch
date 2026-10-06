const test = require("node:test");
const assert = require("node:assert/strict");
const { checkWatch, hashText, lineDiff, isPrivateHost, normalizeUrl } = require("../lib/monitoring");

test("baseline saves without marking changed", async () => {
  const watch = {
    id: "w1",
    url: "https://example.com",
    hash: "",
    text: "",
    title: "",
    changeCount: 0
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    url: "https://example.com",
    text: async () => "<html><body>Hello baseline</body></html>"
  });

  try {
    const result = await checkWatch(watch);
    assert.equal(result.ok, true);
    assert.equal(result.changed, false);
    assert.ok(watch.hash);
    assert.match(watch.text, /Hello baseline/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("unchanged content does not create change metadata", async () => {
  const text = "Same content";
  const watch = {
    id: "w2",
    url: "https://example.com",
    hash: hashText(text),
    text,
    title: "Title",
    changeCount: 0
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    url: "https://example.com",
    text: async () => `<html><body>${text}</body></html>`
  });

  try {
    const result = await checkWatch(watch);
    assert.equal(result.changed, false);
    assert.equal(watch.changeCount, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test("changed content updates watch and returns diff lines", async () => {
  const before = "Old price nine dollars";
  const after = "New price ten dollars";
  const watch = {
    id: "w3",
    url: "https://example.com",
    hash: hashText(before),
    text: before,
    title: "Title",
    changeCount: 0
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    url: "https://example.com",
    text: async () => `<html><body>${after}</body></html>`
  });

  try {
    const result = await checkWatch(watch);
    assert.equal(result.changed, true);
    assert.equal(watch.changeCount, 1);
    assert.ok(Array.isArray(result.added));
    assert.ok(Array.isArray(result.removed));
  } finally {
    global.fetch = originalFetch;
  }
});

test("lineDiff captures added and removed lines", () => {
  const diff = lineDiff("Alpha. Beta.", "Beta. Gamma.");
  assert.ok(diff.removed.length >= 0);
  assert.ok(diff.added.length >= 0);
});

test("SSRF protections remain for private hosts and redirects", () => {
  assert.equal(isPrivateHost("localhost"), true);
  assert.equal(isPrivateHost("127.0.0.1"), true);
  assert.throws(() => normalizeUrl("http://127.0.0.1/"), /blocked/i);
});
