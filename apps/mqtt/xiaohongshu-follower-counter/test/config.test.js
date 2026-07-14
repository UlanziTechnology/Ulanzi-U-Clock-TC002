// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";

import * as bridgeConfig from "../bridge/config.js";

const { loadConfig } = bridgeConfig;

test("loadConfig derives deployment values from the current environment", () => {
  const config = loadConfig({
    XHS_BRIDGE_TOKEN: "machine-generated-token",
    XHS_BRIDGE_PORT: "18432",
    MQTT_HOST: "broker.lan",
    MQTT_PORT: "2883",
    MQTT_USERNAME: "clock-user",
    MQTT_PASSWORD: "clock-password",
    MQTT_TLS: "true",
    MQTT_ALLOW_SELF_SIGNED: "true",
    MQTT_CLIENT_ID: "desktop-a",
    TC002_MQTT_TOPIC: "device/current/custom/xhs",
  });

  assert.equal(config.token, "machine-generated-token");
  assert.equal(config.bridgePort, 18432);
  assert.equal(config.topic, "device/current/custom/xhs");
  assert.deepEqual(config.mqtt, {
    host: "broker.lan",
    port: 2883,
    tls: true,
    username: "clock-user",
    password: "clock-password",
    rejectUnauthorized: false,
    clientId: "desktop-a",
    timeoutMs: 5000,
    retain: true,
  });
});

test("loadConfig requires a per-device MQTT topic", () => {
  assert.throws(
    () => loadConfig({
      XHS_BRIDGE_TOKEN: "machine-generated-token",
      MQTT_HOST: "broker.lan",
    }),
    /TC002_MQTT_TOPIC is required/,
  );
});

test("loadConfig still provides portable protocol defaults", () => {
  const config = loadConfig({
    XHS_BRIDGE_TOKEN: "machine-generated-token",
    MQTT_HOST: "broker.lan",
    TC002_MQTT_TOPIC: "device/current/custom/xhs",
  });

  assert.equal(config.bridgePort, 17321);
  assert.equal(config.mqtt.port, 1883);
  assert.equal(config.mqtt.tls, false);
  assert.equal(config.mqtt.clientId, undefined);
});

test("configSummary reports connection targets without secrets", () => {
  assert.equal(typeof bridgeConfig.configSummary, "function");
  const config = loadConfig({
    XHS_BRIDGE_TOKEN: "never-log-this-token",
    MQTT_HOST: "broker.lan",
    MQTT_USERNAME: "private-user",
    MQTT_PASSWORD: "never-log-this-password",
    MQTT_TLS: "true",
    TC002_MQTT_TOPIC: "device/current/custom/xhs",
  });

  const summary = bridgeConfig.configSummary(config);
  assert.deepEqual(summary, {
    bridge: "http://127.0.0.1:17321",
    mqttHost: "broker.lan",
    mqttPort: 8883,
    mqttTls: true,
    topic: "device/current/custom/xhs",
  });
  const serialized = JSON.stringify(summary);
  assert.doesNotMatch(serialized, /never-log|private-user/);
});
