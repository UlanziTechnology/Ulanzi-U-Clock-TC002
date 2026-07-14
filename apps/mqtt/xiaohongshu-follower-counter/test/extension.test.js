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
});

test("content script imports the tested extractor and sends only a snapshot", async () => {
  const source = await readFile(new URL("content.js", EXTENSION), "utf8");
  assert.match(source, /extractor\.js/);
  assert.match(source, /extractFollowerSnapshot/);
  assert.doesNotMatch(source, /chrome\.cookies|document\.cookie|localStorage/);
  assert.match(source, /type:\s*["']snapshot["']/);
});

test("service worker enforces a five-minute minimum and posts to loopback bridge", async () => {
  const source = await readFile(new URL("service-worker.js", EXTENSION), "utf8");
  assert.match(source, /MIN_REFRESH_MINUTES\s*=\s*5/);
  assert.match(source, /127\.0\.0\.1/);
  assert.match(source, /Authorization/);
  assert.match(source, /Bearer/);
  assert.match(source, /profileUrl.*displayName.*followerCount.*observedAt/s);
  assert.doesNotMatch(source, /cookie/i);
});

test("options page exposes profile, refresh, bridge, and token settings", async () => {
  const html = await readFile(new URL("options.html", EXTENSION), "utf8");
  for (const id of ["profileUrls", "refreshMinutes", "bridgeUrl", "bridgeToken"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});
