// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  createDeviceResolver,
  discoverDevice,
  fetchDeviceJson,
} from "../bridge/device-discovery.js";

const VALID_BASE = { ip: "10.10.21.210", mac: "ccc4b2441bd9", appVer: "1.0.4" };
const VALID_MQTT = {
  isMqtt: true,
  ip: "10.10.20.159",
  port: "1883",
  mqtt_name: "",
  mqtt_pwd: "",
  mqtt_prefix: "ulanzi",
};

test("discovers the native TC002 display topic from device APIs", async () => {
  const requestJson = async (_ip, path) => path === "/getBase" ? VALID_BASE : VALID_MQTT;
  const result = await discoverDevice("10.10.21.210", { requestJson });
  assert.equal(result.deviceIp, "10.10.21.210");
  assert.equal(result.mac, "ccc4b2441bd9");
  assert.equal(result.topic, "ulanzi_1bd9/custom/display");
  assert.deepEqual(result.mqtt, {
    host: "10.10.20.159",
    port: 1883,
    username: undefined,
    password: undefined,
    tls: false,
    retain: true,
    timeoutMs: 5000,
  });
});

test("rejects mismatched devices and unsafe MQTT configuration", async () => {
  await assert.rejects(
    discoverDevice("10.10.21.210", {
      requestJson: async (_ip, path) => path === "/getBase"
        ? { ...VALID_BASE, ip: "10.10.21.211" }
        : VALID_MQTT,
    }),
    (error) => error.code === "invalid_device_response",
  );
  await assert.rejects(
    discoverDevice("10.10.21.210", {
      requestJson: async (_ip, path) => path === "/getBase"
        ? VALID_BASE
        : { ...VALID_MQTT, ip: "8.8.8.8" },
    }),
    (error) => error.code === "invalid_mqtt_config",
  );
  await assert.rejects(
    discoverDevice("10.10.21.210", {
      requestJson: async (_ip, path) => path === "/getBase"
        ? VALID_BASE
        : { ...VALID_MQTT, isMqtt: false },
    }),
    (error) => error.code === "mqtt_disabled",
  );
});

test("fetchDeviceJson resolves after bounded JSON without waiting for EOF", async (t) => {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.write(JSON.stringify({ ip: "127.0.0.1", mac: "ccc4b2441bd9" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());

  const result = await fetchDeviceJson("127.0.0.1", "/getBase", {
    port: server.address().port,
    timeoutMs: 250,
  });
  assert.equal(result.mac, "ccc4b2441bd9");
});

test("fetchDeviceJson rejects oversized and unreachable responses with stable codes", async (t) => {
  const server = http.createServer((_request, response) => response.end(`{"data":"${"x".repeat(128)}"}`));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  await assert.rejects(
    fetchDeviceJson("127.0.0.1", "/getBase", { port: server.address().port, maxBytes: 32 }),
    (error) => error.code === "invalid_device_response",
  );
});

test("resolver caches successful discoveries and supports refresh and eviction", async () => {
  let time = 1_000;
  let calls = 0;
  const resolver = createDeviceResolver({
    discover: async (deviceIp) => ({ deviceIp, generation: ++calls }),
    ttlMs: 300_000,
    now: () => time,
  });
  assert.equal((await resolver.resolve("10.10.21.210")).generation, 1);
  assert.equal((await resolver.resolve("10.10.21.210")).generation, 1);
  assert.equal((await resolver.resolve("10.10.21.210", { forceRefresh: true })).generation, 2);
  resolver.clear("10.10.21.210");
  assert.equal((await resolver.resolve("10.10.21.210")).generation, 3);
  time += 300_001;
  assert.equal((await resolver.resolve("10.10.21.210")).generation, 4);
});

test("resolver evicts failed discoveries", async () => {
  let calls = 0;
  const resolver = createDeviceResolver({
    discover: async (deviceIp) => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error("offline"), { code: "device_unreachable" });
      return { deviceIp };
    },
  });
  await assert.rejects(resolver.resolve("10.10.21.210"));
  assert.equal((await resolver.resolve("10.10.21.210")).deviceIp, "10.10.21.210");
  assert.equal(calls, 2);
});
