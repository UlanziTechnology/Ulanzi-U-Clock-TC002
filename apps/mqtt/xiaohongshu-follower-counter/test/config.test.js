// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";

import * as bridgeConfig from "../bridge/config.js";

const { loadConfig } = bridgeConfig;

test("loadConfig starts portably with only the local shared token", () => {
  const config = loadConfig({ XHS_BRIDGE_TOKEN: "machine-generated-token" });
  assert.equal(config.token, "machine-generated-token");
  assert.equal(config.bridgePort, 17321);
  assert.equal(config.legacyTarget, null);
  assert.deepEqual(config.mqttPolicy, {
    tls: false,
    rejectUnauthorized: true,
    clientId: undefined,
    timeoutMs: 5000,
    retain: true,
  });
});

test("loadConfig keeps a complete explicit legacy target for one release", () => {
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
    TC002_MQTT_TOPIC: "ulanzi_1bd9/custom/display",
  });

  assert.equal(config.bridgePort, 18432);
  assert.equal(config.legacyTarget.topic, "ulanzi_1bd9/custom/display");
  assert.deepEqual(config.legacyTarget.mqtt, {
    host: "broker.lan",
    port: 2883,
    username: "clock-user",
    password: "clock-password",
  });
  assert.equal(config.mqttPolicy.tls, true);
  assert.equal(config.mqttPolicy.rejectUnauthorized, false);
  assert.equal(config.mqttPolicy.clientId, "desktop-a");
});

test("loadConfig rejects partial legacy targets", () => {
  assert.throws(
    () => loadConfig({ XHS_BRIDGE_TOKEN: "token", MQTT_HOST: "broker.lan" }),
    /MQTT_HOST and TC002_MQTT_TOPIC/,
  );
  assert.throws(
    () => loadConfig({ XHS_BRIDGE_TOKEN: "token", TC002_MQTT_TOPIC: "ulanzi_1bd9\/custom\/display" }),
    /MQTT_HOST and TC002_MQTT_TOPIC/,
  );
});

test("configSummary reports policy without targets or secrets", () => {
  const config = loadConfig({
    XHS_BRIDGE_TOKEN: "never-log-this-token",
    MQTT_HOST: "broker.lan",
    MQTT_USERNAME: "private-user",
    MQTT_PASSWORD: "never-log-this-password",
    MQTT_TLS: "true",
    TC002_MQTT_TOPIC: "ulanzi_1bd9/custom/display",
  });
  const summary = bridgeConfig.configSummary(config);
  assert.deepEqual(summary, {
    bridge: "http://127.0.0.1:17321",
    mqttTls: true,
    legacyFallback: true,
  });
  assert.doesNotMatch(JSON.stringify(summary), /never-log|private-user|broker\.lan|1bd9/);
});
