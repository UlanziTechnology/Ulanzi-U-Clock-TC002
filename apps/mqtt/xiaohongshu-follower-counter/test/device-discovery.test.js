// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import {
  createDeviceResolver,
  discoverDevice,
  fetchDeviceJson,
} from "../extension/device-discovery.js";

const VALID_BASE = { ip: "10.10.21.210", mac: "ccc4b2441bd9", appVer: "1.0.4" };
const VALID_MQTT = {
  isMqtt: true,
  ip: "10.10.20.159",
  port: "1883",
  mqtt_name: "",
  mqtt_pwd: "",
  mqtt_prefix: "ulanzi",
};

test("discovers a TC002 prefix and broker without exposing MQTT credentials", async () => {
  const requestJson = async (_ip, path) => path === "/getBase" ? VALID_BASE : VALID_MQTT;
  const result = await discoverDevice("10.10.21.210", { requestJson });
  assert.equal(result.deviceIp, "10.10.21.210");
  assert.equal(result.mac, "ccc4b2441bd9");
  assert.equal(result.devicePrefix, "ulanzi_1bd9");
  assert.deepEqual(result.mqttBroker, {
    host: "10.10.20.159",
    port: 1883,
  });
  assert.equal("topic" in result, false);
  assert.equal(JSON.stringify(result).includes("mqtt_name"), false);
  assert.equal(JSON.stringify(result).includes("mqtt_pwd"), false);
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

test("fetchDeviceJson performs a credential-free bounded browser request", async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ ip: "10.10.21.210", mac: "ccc4b2441bd9" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const result = await fetchDeviceJson("10.10.21.210", "/getBase", { fetchImpl });
  assert.equal(result.mac, "ccc4b2441bd9");
  assert.equal(request.url, "http://10.10.21.210/getBase");
  assert.equal(request.options.credentials, "omit");
  assert.equal(request.options.cache, "no-store");
});

test("fetchDeviceJson rejects oversized and unreachable responses with stable codes", async () => {
  await assert.rejects(
    fetchDeviceJson("10.10.21.210", "/getBase", {
      maxBytes: 32,
      fetchImpl: async () => new Response(`{"data":"${"x".repeat(128)}"}`),
    }),
    (error) => error.code === "invalid_device_response",
  );
  await assert.rejects(
    fetchDeviceJson("10.10.21.210", "/getBase", {
      fetchImpl: async () => { throw new TypeError("offline"); },
    }),
    (error) => error.code === "device_unreachable",
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
