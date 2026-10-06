const crypto = require("crypto");
const cheerio = require("cheerio");

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host === "::1" || host === "0.0.0.0") return true;
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function normalizeUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("URL is required.");
  const withProto = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
  let url;
  try {
    url = new URL(withProto);
  } catch {
    throw new Error("That does not look like a URL.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http and https URLs are allowed.");
  if (isPrivateHost(url.hostname)) throw new Error("Private and local addresses are blocked.");
  return url.toString();
}

function extractText(html) {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, canvas").remove();
  const title = $("title").first().text().replace(/\s+/g, " ").trim();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  return {
    title: title.slice(0, 180),
    text: text.slice(0, 120000)
  };
}

function hashText(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function lineDiff(before, after) {
  const a = before.split(/\n|(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean).slice(0, 400);
  const b = after.split(/\n|(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean).slice(0, 400);
  const setA = new Set(a);
  const setB = new Set(b);
  const removed = a.filter((line) => !setB.has(line)).slice(0, 12);
  const added = b.filter((line) => !setA.has(line)).slice(0, 12);
  return { added, removed };
}

async function fetchPage(target) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(target, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "ChangeWatch/1.0 (+https://localhost)",
        accept: "text/html,application/xhtml+xml"
      }
    });
    const finalUrl = res.url || target;
    let finalHost = "";
    try {
      finalHost = new URL(finalUrl).hostname;
    } catch {
      finalHost = "";
    }
    if (finalHost && isPrivateHost(finalHost)) {
      throw new Error("Redirected to a private address. Blocked.");
    }
    const html = await res.text();
    return { status: res.status, html, finalUrl };
  } finally {
    clearTimeout(timer);
  }
}

async function checkWatch(watch) {
  const started = new Date().toISOString();
  const result = {
    checkedAt: started,
    ok: false,
    changed: false,
    status: 0,
    error: "",
    title: watch.title || "",
    added: [],
    removed: []
  };
  try {
    const page = await fetchPage(watch.url);
    result.status = page.status;
    if (page.status >= 400) throw new Error("Page returned HTTP " + page.status);
    const extracted = extractText(page.html);
    const nextHash = hashText(extracted.text);
    result.title = extracted.title || watch.title || watch.url;
    result.ok = true;
    if (!watch.hash) {
      watch.hash = nextHash;
      watch.text = extracted.text;
      watch.title = result.title;
      watch.lastCheckedAt = started;
      watch.lastChangedAt = started;
      watch.lastStatus = page.status;
      watch.lastError = "";
      result.note = "Baseline saved. The next change will alert.";
      return result;
    }
    if (nextHash !== watch.hash) {
      const diff = lineDiff(watch.text || "", extracted.text);
      result.changed = true;
      result.added = diff.added;
      result.removed = diff.removed;
      watch.previousHash = watch.hash;
      watch.hash = nextHash;
      watch.text = extracted.text;
      watch.title = result.title;
      watch.lastChangedAt = started;
      watch.changeCount = (watch.changeCount || 0) + 1;
    }
    watch.lastCheckedAt = started;
    watch.lastStatus = page.status;
    watch.lastError = "";
    return result;
  } catch (err) {
    result.error = err.name === "AbortError" ? "Timed out after 15 seconds." : err.message;
    watch.lastCheckedAt = started;
    watch.lastError = result.error;
    return result;
  }
}

async function sendWebhook(watch, alert) {
  const hook = watch.webhook || process.env.WEBHOOK_DEFAULT || "";
  if (!hook) return { sent: false, reason: "no webhook" };
  try {
    const res = await fetch(hook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "changewatch",
        watchId: watch.id,
        name: watch.name,
        url: watch.url,
        title: alert.title,
        checkedAt: alert.checkedAt,
        added: alert.added,
        removed: alert.removed
      })
    });
    return { sent: res.ok, status: res.status };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

module.exports = {
  isPrivateHost,
  normalizeUrl,
  extractText,
  hashText,
  lineDiff,
  fetchPage,
  checkWatch,
  sendWebhook
};
