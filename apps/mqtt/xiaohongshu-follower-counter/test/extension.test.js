// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const EXTENSION = new URL("../extension/", import.meta.url);

test("manifest uses MV3 with narrowly scoped permissions", async () => {
  const manifest = JSON.parse(await readFile(new URL("manifest.json", EXTENSION), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, "0.2.0");
  assert.deepEqual(manifest.permissions.sort(), ["alarms", "storage"]);
  assert.ok(manifest.host_permissions.includes("https://www.xiaohongshu.com/*"));
  assert.ok(manifest.host_permissions.includes("https://xiaohongshu.com/*"));
  assert.deepEqual(manifest.optional_host_permissions.sort(), ["http://*/*", "https://*/*"]);
  assert.ok(!manifest.host_permissions.some((host) => host.includes("127.0.0.1")));
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
  assert.match(source, /device-discovery\.js/);
  assert.match(source, /render\.js/);
  assert.match(source, /ha-webhook\.js/);
  assert.match(source, /createDeviceResolver/);
  assert.match(source, /buildCustomAppPayload/);
  assert.match(source, /postFollowerPayload/);
  assert.doesNotMatch(source, /127\.0\.0\.1/);
  assert.doesNotMatch(source, /\/v1\/follower-count/);
  assert.doesNotMatch(source, /Authorization|Bearer/);
  assert.match(source, /profileUrl.*displayName.*followerCount.*observedAt/s);
  assert.match(source, /bindings/);
  assert.match(source, /deviceIp/);
  assert.match(source, /lastResults/);
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /resultWriteQueue/);
  assert.match(source, /profile_not_configured/);
  assert.doesNotMatch(source, /cookie/i);
  assert.match(source, /chrome\.storage\.local\.get\(DEFAULTS\)/);
  assert.doesNotMatch(source, /\/user\/profile\/[0-9a-f]{20,}/i);
  assert.doesNotMatch(source, /chrome-extension:\/\/[a-p]{32}/);
});

test("options page exposes profile, refresh, Home Assistant, and Webhook settings", async () => {
  const html = await readFile(new URL("options.html", EXTENSION), "utf8");
  for (const id of ["bindings", "addBinding", "refreshSeconds", "homeAssistantUrl", "webhookId", "permissionStatus", "lastResult"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.doesNotMatch(html, /bridgeUrl|bridgeToken|XHS_BRIDGE_TOKEN/);
  assert.match(html, /TC002 设备 IP/);
  assert.doesNotMatch(html, /id=["']profileUrls["']/);
  assert.match(html, /刷新间隔（秒，最少 300）/);
  assert.match(html, /id="refreshSeconds"[^>]*min="300"[^>]*step="1"[^>]*value="300"/);
  assert.match(html, /5 分钟/);
  assert.match(html, /屏蔽|风控/);
  assert.match(html, /type="module"/);
  assert.match(html, /当前电脑/);
  assert.match(html, /Home Assistant/);
  assert.match(html, /Webhook/);
  assert.match(html, /local-only|仅限本地/i);
});

test("options save canonical per-machine settings without temporary profile parameters", async () => {
  const source = await readFile(new URL("options.js", EXTENSION), "utf8");
  const bindingsSource = await readFile(new URL("bindings-config.js", EXTENSION), "utf8");
  assert.match(source, /chrome\.storage\.local\.get\(DEFAULTS\)/);
  assert.match(source, /chrome\.storage\.local\.set/);
  assert.match(source, /canonicalProfileUrl/);
  assert.match(source, /migrateBindings/);
  assert.match(source, /normalizeBindings/);
  assert.match(source, /normalizeRefreshSeconds/);
  assert.match(source, /migrateRefreshSeconds/);
  assert.match(source, /migrateHomeAssistantConfig/);
  assert.match(source, /requiredOrigins/);
  assert.match(source, /chrome\.permissions\.contains/);
  assert.match(source, /chrome\.permissions\.request/);
  assert.match(source, /devicePrefix/);
  assert.match(source, /textContent/);
  assert.match(source, /refreshSeconds/);
  assert.doesNotMatch(source, /refreshMinutes/);
  assert.doesNotMatch(source, /bridgeUrl\s*:|bridgeToken\s*:|XHS_BRIDGE_TOKEN|Authorization:\s*`?Bearer/);
  assert.match(source, /remove\(\["profileUrls", "bridgeUrl", "bridgeToken"\]\)/);
  assert.match(bindingsSource, /url\.search\s*=\s*["']["']/);
  assert.match(bindingsSource, /url\.hash\s*=\s*["']["']/);
  assert.doesNotMatch(source, /\/user\/profile\/[0-9a-f]{20,}/i);
});
