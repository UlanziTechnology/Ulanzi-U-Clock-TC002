// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";

import {
  migrateHomeAssistantConfig,
  normalizeHomeAssistantUrl,
  normalizeWebhookId,
  requiredOrigins,
  webhookEndpoint,
} from "../extension/ha-config.js";

const PROFILE = "https://www.xiaohongshu.com/user/profile/abc";

test("normalizes HA connection values and derives dynamic host permissions", () => {
  assert.equal(normalizeHomeAssistantUrl("http://10.10.20.10:8123/"), "http://10.10.20.10:8123");
  assert.equal(normalizeWebhookId("a".repeat(32)), "a".repeat(32));
  assert.equal(
    webhookEndpoint("http://10.10.20.10:8123/", "a".repeat(32)),
    `http://10.10.20.10:8123/api/webhook/${"a".repeat(32)}`,
  );
  assert.deepEqual(requiredOrigins("http://10.10.20.10:8123", [
    { deviceIp: "10.10.20.181", profileUrl: PROFILE },
  ]), ["http://10.10.20.10/*", "http://10.10.20.181/*"]);
});

test("rejects unsafe HA URLs and Webhook IDs", () => {
  for (const value of [
    "ftp://10.10.20.10",
    "http://user:pass@10.10.20.10:8123",
    "http://10.10.20.10:8123/path",
    "http://10.10.20.10:8123?x=1",
    "http://8.8.8.8:8123",
  ]) {
    assert.throws(() => normalizeHomeAssistantUrl(value), TypeError, value);
  }
  assert.equal(normalizeHomeAssistantUrl("http://localhost:8123"), "http://localhost:8123");
  assert.equal(normalizeHomeAssistantUrl("https://ha.example.com"), "https://ha.example.com");
  for (const value of ["short", "a".repeat(129), "a/unsafe".repeat(8)]) {
    assert.throws(() => normalizeWebhookId(value), TypeError, value);
  }
});

test("migrates HA fields and removes obsolete Bridge secrets idempotently", async () => {
  const values = {
    homeAssistantUrl: "http://10.10.20.10:8123/",
    webhookId: "z".repeat(32),
    bridgeUrl: "http://127.0.0.1:17321",
    bridgeToken: "legacy-secret",
    refreshSeconds: 10,
    bindings: [{ deviceIp: "10.10.20.181", profileUrl: PROFILE }],
  };
  const removed = [];
  const storage = {
    async get(keys) {
      return Object.fromEntries(keys.filter((key) => key in values).map((key) => [key, values[key]]));
    },
    async set(entries) { Object.assign(values, entries); },
    async remove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        removed.push(key);
        delete values[key];
      }
    },
  };
  assert.deepEqual(await migrateHomeAssistantConfig(storage), {
    homeAssistantUrl: "http://10.10.20.10:8123",
    webhookId: "z".repeat(32),
  });
  assert.deepEqual(removed, ["bridgeUrl", "bridgeToken"]);
  assert.equal(values.refreshSeconds, 10);
  assert.deepEqual(values.bindings, [{ deviceIp: "10.10.20.181", profileUrl: PROFILE }]);

  removed.length = 0;
  await migrateHomeAssistantConfig(storage);
  assert.deepEqual(removed, []);
});
