// SPDX-License-Identifier: GPL-3.0-or-later

const WEBHOOK_ID_PATTERN = /^[A-Za-z0-9_-]{24,128}$/;

export function normalizeHomeAssistantUrl(value) {
  let url;
  try {
    url = new URL(String(value ?? "").trim());
  } catch {
    throw new TypeError("Home Assistant 地址无效");
  }
  if (!["http:", "https:"].includes(url.protocol)
    || url.username
    || url.password
    || url.pathname !== "/"
    || url.search
    || url.hash) {
    throw new TypeError("Home Assistant 地址无效");
  }
  if (url.protocol === "http:" && !isLocalHttpHost(url.hostname)) {
    throw new TypeError("HTTP Home Assistant 必须位于局域网");
  }
  return url.origin;
}

export function normalizeWebhookId(value) {
  const webhookId = String(value ?? "").trim();
  if (!WEBHOOK_ID_PATTERN.test(webhookId)) throw new TypeError("Webhook ID 必须是 24–128 位 URL 安全字符");
  return webhookId;
}

export function webhookEndpoint(baseUrl, webhookId) {
  return `${normalizeHomeAssistantUrl(baseUrl)}/api/webhook/${encodeURIComponent(normalizeWebhookId(webhookId))}`;
}

export function requiredOrigins(baseUrl, bindings) {
  const origins = new Set([permissionPattern(normalizeHomeAssistantUrl(baseUrl))]);
  for (const binding of Array.isArray(bindings) ? bindings : []) {
    const ip = normalizePrivateIpv4(binding?.deviceIp);
    origins.add(`http://${ip}/*`);
  }
  return [...origins];
}

export async function migrateHomeAssistantConfig(storage) {
  const stored = await storage.get([
    "homeAssistantUrl",
    "webhookId",
    "bridgeUrl",
    "bridgeToken",
  ]);
  const homeAssistantUrl = stored.homeAssistantUrl
    ? normalizeHomeAssistantUrl(stored.homeAssistantUrl)
    : "";
  const webhookId = stored.webhookId ? normalizeWebhookId(stored.webhookId) : "";
  const normalized = { homeAssistantUrl, webhookId };
  const needsNormalization = (stored.homeAssistantUrl !== undefined && stored.homeAssistantUrl !== homeAssistantUrl)
    || (stored.webhookId !== undefined && stored.webhookId !== webhookId);
  if (needsNormalization) {
    await storage.set(normalized);
  }
  const obsolete = ["bridgeUrl", "bridgeToken"].filter((key) => stored[key] !== undefined);
  if (obsolete.length) await storage.remove(obsolete);
  return normalized;
}

function permissionPattern(value) {
  const url = new URL(value);
  return `${url.protocol}//${url.hostname}/*`;
}

function isLocalHttpHost(hostname) {
  if (["localhost", "127.0.0.1", "[::1]"].includes(hostname)) return true;
  try {
    normalizePrivateIpv4(hostname);
    return true;
  } catch {
    return false;
  }
}

function normalizePrivateIpv4(value) {
  const input = String(value ?? "").trim();
  const parts = input.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) {
    throw new TypeError("设备 IP 必须是局域网 IPv4 地址");
  }
  const octets = parts.map(Number);
  const isPrivate = octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
  if (!isPrivate) throw new TypeError("设备 IP 必须是局域网 IPv4 地址");
  return octets.join(".");
}
