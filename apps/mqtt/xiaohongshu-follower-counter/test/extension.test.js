// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const EXTENSION = new URL("../extension/", import.meta.url);

test("manifest uses MV3 with narrowly scoped permissions", async () => {
  const manifest = JSON.parse(await readFile(new URL("manifest.json", EXTENSION), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions.sort(), ["alarms", "storage"]);
  assert.ok(manifest.host_permissions.includes("https://www.xiaohongshu.com/*"));
  assert.ok(manifest.host_permissions.includes("http://127.0.0.1/*"));
  assert.ok(!manifest.host_permissions.includes("<all_urls>"));
  assert.ok(!manifest.permissions.includes("cookies"));
  assert.ok(!manifest.permissions.includes("webRequest"));
  assert.equal(manifest.background.type, "module");
  assert.match(manifest.description, /本地|local/i);
});

test("content script imports the tested extractor and sends only a snapshot", async () => {
  const source = await readFile(new URL("content.js", EXTENSION), "utf8");
  assert.match(source, /extractor\.js/);
  assert.match(source, /extractFollowerSnapshot/);
  assert.doesNotMatch(source, /chrome\.cookies|document\.cookie|localStorage/);
  assert.match(source, /type:\s*["']snapshot["']/);
});

test("service worker schedules second-based refreshes without overlapping batches", async () => {
  const source = await readFile(new URL("service-worker.js", EXTENSION), "utf8");
  assert.match(source, /refresh-config\.js/);
  assert.match(source, /migrateRefreshSeconds/);
  assert.match(source, /refreshSeconds\s*\/\s*60/);
  assert.match(source, /refreshInProgress/);
  assert.doesNotMatch(source, /MIN_REFRESH_MINUTES/);
  assert.match(source, /127\.0\.0\.1/);
  assert.match(source, /Authorization/);
  assert.match(source, /Bearer/);
  assert.match(source, /profileUrl.*displayName.*followerCount.*observedAt/s);
  assert.match(source, /profileUrls\.some/);
  assert.match(source, /profile_not_configured/);
  assert.doesNotMatch(source, /cookie/i);
  assert.match(source, /chrome\.storage\.local\.get\(DEFAULTS\)/);
  assert.doesNotMatch(source, /\/user\/profile\/[0-9a-f]{20,}/i);
  assert.doesNotMatch(source, /chrome-extension:\/\/[a-p]{32}/);
});

test("options page exposes profile, refresh, bridge, and token settings", async () => {
  const html = await readFile(new URL("options.html", EXTENSION), "utf8");
  for (const id of ["profileUrls", "refreshSeconds", "bridgeUrl", "bridgeToken"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /刷新间隔（秒，最少 5）/);
  assert.match(html, /id="refreshSeconds"[^>]*min="5"[^>]*step="1"[^>]*value="30"/);
  assert.match(html, /5 秒/);
  assert.match(html, /60 秒/);
  assert.match(html, /type="module"/);
  assert.match(html, /当前电脑/);
  assert.match(html, /端口/);
});

test("options save canonical per-machine settings without temporary profile parameters", async () => {
  const source = await readFile(new URL("options.js", EXTENSION), "utf8");
  assert.match(source, /chrome\.storage\.local\.get\(DEFAULTS\)/);
  assert.match(source, /chrome\.storage\.local\.set/);
  assert.match(source, /canonicalProfileUrl/);
  assert.match(source, /normalizeRefreshSeconds/);
  assert.match(source, /migrateRefreshSeconds/);
  assert.match(source, /refreshSeconds/);
  assert.doesNotMatch(source, /refreshMinutes/);
  assert.match(source, /url\.search\s*=\s*["']["']/);
  assert.match(source, /url\.hash\s*=\s*["']["']/);
  assert.doesNotMatch(source, /\/user\/profile\/[0-9a-f]{20,}/i);
});
