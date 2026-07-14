// SPDX-License-Identifier: GPL-3.0-or-later

export function loadConfig(env = process.env) {
  const token = required(env.XHS_BRIDGE_TOKEN, "XHS_BRIDGE_TOKEN");
  const tls = parseBoolean(env.MQTT_TLS, false);
  const bridgePort = parsePort(env.XHS_BRIDGE_PORT, 17321, "XHS_BRIDGE_PORT");
  const host = env.MQTT_HOST?.trim();
  const topic = env.TC002_MQTT_TOPIC?.trim();
  if (Boolean(host) !== Boolean(topic)) {
    throw new Error("MQTT_HOST and TC002_MQTT_TOPIC must be configured together");
  }

  const mqttPolicy = {
    tls,
    rejectUnauthorized: !parseBoolean(env.MQTT_ALLOW_SELF_SIGNED, false),
    clientId: env.MQTT_CLIENT_ID || undefined,
    timeoutMs: 5000,
    retain: true,
  };
  const legacyTarget = host && topic ? {
    topic,
    mqtt: {
      host,
      port: parsePort(env.MQTT_PORT, tls ? 8883 : 1883, "MQTT_PORT"),
      username: env.MQTT_USERNAME || undefined,
      password: env.MQTT_PASSWORD || undefined,
    },
  } : null;

  return {
    token,
    bridgePort,
    mqttPolicy,
    legacyTarget,
  };
}

export function configSummary(config) {
  return {
    bridge: `http://127.0.0.1:${config.bridgePort}`,
    mqttTls: config.mqttPolicy.tls,
    legacyFallback: Boolean(config.legacyTarget),
  };
}

function required(value, name) {
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === "") return fallback;
  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  throw new Error(`Invalid boolean value: ${value}`);
}

function parsePort(value, fallback, name) {
  const port = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${name} must be 1-65535`);
  return port;
}
