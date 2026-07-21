// SPDX-License-Identifier: GPL-3.0-or-later

const DEVICE_PATHS = new Set(["/getBase", "/getMqttConfig"]);
const DEFAULT_TTL_MS = 300_000;

export async function fetchDeviceJson(deviceIp, path, {
  timeoutMs = 3000,
  maxBytes = 8192,
  fetchImpl = fetch,
  deviceBaseUrl,
} = {}) {
  if (!DEVICE_PATHS.has(path)) throw discoveryError("invalid_device_response");
  const baseUrl = deviceBaseUrl ?? `http://${privateIpv4(deviceIp)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw discoveryError("invalid_device_response");
    const bytes = await readBoundedBody(response, maxBytes);
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw discoveryError("invalid_device_response");
    }
    return value;
  } catch (error) {
    if (error?.code === "invalid_device_response") throw error;
    if (error instanceof SyntaxError) throw discoveryError("invalid_device_response");
    throw discoveryError("device_unreachable");
  } finally {
    clearTimeout(timer);
  }
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
  const { host, port, prefix } = normalizeMqtt(mqttConfig);
  return {
    deviceIp: normalizedDeviceIp,
    mac,
    devicePrefix: `${prefix}_${mac.slice(-4)}`,
    mqttBroker: { host, port },
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

async function readBoundedBody(response, maxBytes) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1) throw discoveryError("invalid_device_response");
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw discoveryError("invalid_device_response");
  }
  if (!response.body?.getReader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > maxBytes) throw discoveryError("invalid_device_response");
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) throw discoveryError("invalid_device_response");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
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
  return { host, port, prefix };
}

function privateIpv4(value) {
  const input = String(value ?? "").trim();
  const parts = input.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) {
    throw new TypeError("invalid IPv4");
  }
  const octets = parts.map(Number);
  const isPrivate = octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
  if (!isPrivate) throw new TypeError("not private IPv4");
  return octets.join(".");
}

function discoveryError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}
