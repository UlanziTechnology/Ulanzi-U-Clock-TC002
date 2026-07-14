// SPDX-License-Identifier: GPL-3.0-or-later
import http from "node:http";

const DEVICE_PATHS = new Set(["/getBase", "/getMqttConfig"]);
const DEFAULT_TTL_MS = 300_000;

export function fetchDeviceJson(deviceIp, path, {
  timeoutMs = 3000,
  maxBytes = 8192,
  port = 80,
} = {}) {
  if (!DEVICE_PATHS.has(path)) throw discoveryError("invalid_device_response");
  return new Promise((resolve, reject) => {
    let settled = false;
    let body = Buffer.alloc(0);
    let request;

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      request?.destroy();
      if (error) reject(error);
      else resolve(value);
    };
    const fail = (code) => finish(discoveryError(code));

    request = http.get({ host: deviceIp, port, path }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        fail("invalid_device_response");
        return;
      }
      response.on("data", (chunk) => {
        if (settled) return;
        body = Buffer.concat([body, chunk]);
        if (body.length > maxBytes) {
          fail("invalid_device_response");
          return;
        }
        try {
          const value = JSON.parse(body.toString("utf8"));
          if (!value || typeof value !== "object" || Array.isArray(value)) {
            fail("invalid_device_response");
            return;
          }
          finish(null, value);
        } catch {
          // A later chunk may complete the JSON document.
        }
      });
      response.once("end", () => {
        if (!settled) fail("invalid_device_response");
      });
      response.once("error", () => fail("device_unreachable"));
    });
    request.setTimeout(timeoutMs, () => fail("device_unreachable"));
    request.once("error", () => fail("device_unreachable"));
  });
}

export async function discoverDevice(deviceIp, { requestJson = fetchDeviceJson } = {}) {
  let normalizedDeviceIp;
  try {
    normalizedDeviceIp = privateIpv4(deviceIp);
  } catch {
    throw discoveryError("invalid_device_response");
  }

  let base;
  let mqttConfig;
  try {
    [base, mqttConfig] = await Promise.all([
      requestJson(normalizedDeviceIp, "/getBase"),
      requestJson(normalizedDeviceIp, "/getMqttConfig"),
    ]);
  } catch (error) {
    if (error?.code && ["device_unreachable", "invalid_device_response"].includes(error.code)) throw error;
    throw discoveryError("device_unreachable");
  }

  const mac = normalizeBase(base, normalizedDeviceIp);
  const mqtt = normalizeMqtt(mqttConfig);
  const prefix = String(mqttConfig.mqtt_prefix ?? "").trim();
  return {
    deviceIp: normalizedDeviceIp,
    mac,
    mqtt,
    topic: `${prefix}_${mac.slice(-4)}/custom/display`,
  };
}

export function createDeviceResolver({
  discover = discoverDevice,
  ttlMs = DEFAULT_TTL_MS,
  now = Date.now,
} = {}) {
  const cache = new Map();

  async function resolve(deviceIp, { forceRefresh = false } = {}) {
    if (forceRefresh) cache.delete(deviceIp);
    const cached = cache.get(deviceIp);
    if (cached && now() - cached.createdAt < ttlMs) return cached.promise;

    const promise = Promise.resolve().then(() => discover(deviceIp));
    const entry = { createdAt: now(), promise };
    cache.set(deviceIp, entry);
    promise.catch(() => {
      if (cache.get(deviceIp) === entry) cache.delete(deviceIp);
    });
    return promise;
  }

  return {
    resolve,
    clear(deviceIp) {
      cache.delete(deviceIp);
    },
  };
}

function normalizeBase(base, expectedIp) {
  if (!base || typeof base !== "object" || Array.isArray(base)) {
    throw discoveryError("invalid_device_response");
  }
  let returnedIp;
  try {
    returnedIp = privateIpv4(base.ip);
  } catch {
    throw discoveryError("invalid_device_response");
  }
  if (returnedIp !== expectedIp) throw discoveryError("invalid_device_response");

  const mac = String(base.mac ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{12}$/.test(mac)) throw discoveryError("invalid_device_response");
  const model = base.model ?? base.deviceModel;
  if (model !== undefined && !String(model).toUpperCase().includes("TC002")) {
    throw discoveryError("invalid_device_response");
  }
  return mac;
}

function normalizeMqtt(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw discoveryError("invalid_mqtt_config");
  }
  if (![true, 1, "1", "true"].includes(config.isMqtt)) throw discoveryError("mqtt_disabled");

  let host;
  try {
    host = privateIpv4(config.ip);
  } catch {
    throw discoveryError("invalid_mqtt_config");
  }
  const port = Number(config.port);
  const prefix = String(config.mqtt_prefix ?? "").trim();
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !/^[A-Za-z0-9_-]{1,32}$/.test(prefix)) {
    throw discoveryError("invalid_mqtt_config");
  }
  const username = optionalCredential(config.mqtt_name);
  const password = optionalCredential(config.mqtt_pwd);
  if (password !== undefined && username === undefined) throw discoveryError("invalid_mqtt_config");
  return {
    host,
    port,
    username,
    password,
    tls: false,
    retain: true,
    timeoutMs: 5000,
  };
}

function optionalCredential(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.length > 256 || value.includes("\0")) {
    throw discoveryError("invalid_mqtt_config");
  }
  return value;
}

function privateIpv4(value) {
  const input = String(value ?? "").trim();
  const parts = input.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) {
    throw new TypeError("invalid IPv4");
  }
  const octets = parts.map(Number);
  const isPrivate = octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168);
  if (!isPrivate) throw new TypeError("not private IPv4");
  return octets.join(".");
}

function discoveryError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}
