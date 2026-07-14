// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";

import {
  canonicalProfileUrl,
  migrateBindings,
  normalizeBindings,
  normalizePrivateIpv4,
} from "../extension/bindings-config.js";

test("accepts only RFC1918 IPv4 device addresses", () => {
  assert.equal(normalizePrivateIpv4("10.10.21.210"), "10.10.21.210");
  assert.equal(normalizePrivateIpv4("172.16.0.1"), "172.16.0.1");
  assert.equal(normalizePrivateIpv4("172.31.255.254"), "172.31.255.254");
  assert.equal(normalizePrivateIpv4("192.168.1.8"), "192.168.1.8");

  for (const value of [
    "127.0.0.1",
    "169.254.1.2",
    "172.32.0.1",
    "224.0.0.1",
    "8.8.8.8",
    "::1",
    "device.local",
    "10.0.0.1:1883",
    "10.0.0.999",
  ]) {
    assert.throws(() => normalizePrivateIpv4(value), /局域网 IPv4/);
  }
});

test("canonicalizes Xiaohongshu profile URLs", () => {
  assert.equal(
    canonicalProfileUrl("https://www.xiaohongshu.com/user/profile/abc?xsec_token=temp#top"),
    "https://www.xiaohongshu.com/user/profile/abc",
  );
  assert.throws(() => canonicalProfileUrl("https://example.com/user/profile/abc"), /小红书用户主页/);
});

test("normalizes complete bindings and rejects duplicate device IPs", () => {
  assert.deepEqual(normalizeBindings([{
    deviceIp: "10.10.21.210",
    profileUrl: "https://www.xiaohongshu.com/user/profile/abc?xsec_token=temp#top",
  }]), [{
    deviceIp: "10.10.21.210",
    profileUrl: "https://www.xiaohongshu.com/user/profile/abc",
  }]);

  assert.throws(() => normalizeBindings([
    { deviceIp: "10.10.21.210", profileUrl: "https://www.xiaohongshu.com/user/profile/a" },
    { deviceIp: "10.10.21.210", profileUrl: "https://www.xiaohongshu.com/user/profile/b" },
  ]), /设备 IP 不能重复/);
});

test("rejects half-filled bindings except during migration", () => {
  assert.throws(() => normalizeBindings([
    { deviceIp: "", profileUrl: "https://www.xiaohongshu.com/user/profile/a" },
  ]), /设备 IP 和小红书主页必须同时填写/);

  assert.deepEqual(normalizeBindings([
    { deviceIp: "", profileUrl: "https://www.xiaohongshu.com/user/profile/a" },
  ], { allowIncomplete: true }), [
    { deviceIp: "", profileUrl: "https://www.xiaohongshu.com/user/profile/a" },
  ]);
});

test("migrates legacy profiles to incomplete bindings without guessing devices", async () => {
  const state = { profileUrls: ["https://www.xiaohongshu.com/user/profile/a"] };
  const writes = [];
  const storage = {
    async get(defaults) { return { ...defaults, ...state }; },
    async set(values) { writes.push(values); Object.assign(state, values); },
    async remove(key) { delete state[key]; },
  };

  assert.deepEqual(await migrateBindings(storage), [{
    deviceIp: "",
    profileUrl: "https://www.xiaohongshu.com/user/profile/a",
  }]);
  assert.equal("profileUrls" in state, false);
  assert.deepEqual(writes, [{ bindings: [{
    deviceIp: "",
    profileUrl: "https://www.xiaohongshu.com/user/profile/a",
  }] }]);
});

test("migration keeps canonical bindings without rewriting storage", async () => {
  const bindings = [{
    deviceIp: "10.10.21.210",
    profileUrl: "https://www.xiaohongshu.com/user/profile/a",
  }];
  let writes = 0;
  const storage = {
    async get(defaults) { return { ...defaults, bindings }; },
    async set() { writes += 1; },
    async remove() {},
  };

  assert.deepEqual(await migrateBindings(storage), bindings);
  assert.equal(writes, 0);
});
