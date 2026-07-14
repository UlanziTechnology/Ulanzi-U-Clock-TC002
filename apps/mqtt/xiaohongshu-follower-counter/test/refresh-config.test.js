// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";

const refreshConfig = await import("../extension/refresh-config.js").catch(() => null);

test("refresh configuration module is available", () => {
  assert.ok(refreshConfig, "extension/refresh-config.js should exist");
});

test("normalizes second intervals to integers with a five-second floor", () => {
  assert.ok(refreshConfig);
  const { normalizeRefreshSeconds } = refreshConfig;
  assert.equal(normalizeRefreshSeconds(undefined), 30);
  assert.equal(normalizeRefreshSeconds("5"), 5);
  assert.equal(normalizeRefreshSeconds(4), 5);
  assert.equal(normalizeRefreshSeconds(12.9), 12);
  assert.equal(normalizeRefreshSeconds("invalid"), 30);
  assert.equal(normalizeRefreshSeconds(Infinity), 30);
});

test("migrates legacy minutes and removes the old key", async () => {
  assert.ok(refreshConfig);
  const storage = fakeStorage({ refreshMinutes: 2 });
  assert.equal(await refreshConfig.migrateRefreshSeconds(storage), 120);
  assert.deepEqual(storage.data, { refreshSeconds: 120 });
});

test("seconds win when both storage keys exist", async () => {
  assert.ok(refreshConfig);
  const storage = fakeStorage({ refreshSeconds: 5, refreshMinutes: 15 });
  assert.equal(await refreshConfig.migrateRefreshSeconds(storage), 5);
  assert.deepEqual(storage.data, { refreshSeconds: 5 });
});

test("migration normalizes an invalid stored seconds value", async () => {
  assert.ok(refreshConfig);
  const storage = fakeStorage({ refreshSeconds: 1 });
  assert.equal(await refreshConfig.migrateRefreshSeconds(storage), 5);
  assert.deepEqual(storage.data, { refreshSeconds: 5 });
});

test("migration does not rewrite an already normalized seconds value", async () => {
  const storage = fakeStorage({ refreshSeconds: 30 });
  assert.equal(await refreshConfig.migrateRefreshSeconds(storage), 30);
  assert.equal(storage.setCalls, 0);
  assert.equal(storage.removeCalls, 0);
});

function fakeStorage(initial) {
  return {
    data: { ...initial },
    setCalls: 0,
    removeCalls: 0,
    async get(keys) {
      return Object.fromEntries(keys.filter((key) => key in this.data).map((key) => [key, this.data[key]]));
    },
    async set(values) {
      this.setCalls += 1;
      Object.assign(this.data, values);
    },
    async remove(key) {
      this.removeCalls += 1;
      delete this.data[key];
    },
  };
}
