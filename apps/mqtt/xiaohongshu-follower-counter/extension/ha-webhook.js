// SPDX-License-Identifier: GPL-3.0-or-later
import { webhookEndpoint } from "./ha-config.js";

const MAX_PAYLOAD_BYTES = 256 * 1024;

export async function postFollowerPayload(config, update, {
  fetchImpl = fetch,
  timeoutMs = 10_000,
} = {}) {
  const body = followerWebhookBody(update);
  let endpoint;
  try {
    endpoint = webhookEndpoint(config?.homeAssistantUrl, config?.webhookId);
  } catch {
    throw webhookError("invalid_webhook_payload");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw webhookError("webhook_rejected");
  } catch (error) {
    if (error?.code === "webhook_rejected") throw error;
    throw webhookError("ha_unreachable");
  } finally {
    clearTimeout(timer);
  }
}

function followerWebhookBody(update) {
  try {
    if (!update || typeof update !== "object" || Array.isArray(update)) throw new TypeError();
    const devicePrefix = String(update.devicePrefix ?? "").trim();
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(devicePrefix)) throw new TypeError();

    const snapshot = update.snapshot;
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new TypeError();
    const profileUrl = canonicalProfileUrl(snapshot.profileUrl);
    const displayName = String(snapshot.displayName ?? "").trim();
    if (!displayName || displayName.length > 100) throw new TypeError();
    const followerCount = Number(snapshot.followerCount);
    if (!Number.isSafeInteger(followerCount) || followerCount < 0) throw new TypeError();
    const observedAt = String(snapshot.observedAt ?? "");
    if (!observedAt || !Number.isFinite(Date.parse(observedAt))) throw new TypeError();
    if (!update.customAppPayload || typeof update.customAppPayload !== "object" || Array.isArray(update.customAppPayload)) {
      throw new TypeError();
    }
    const payload = JSON.stringify(update.customAppPayload);
    if (!payload || new TextEncoder().encode(payload).length > MAX_PAYLOAD_BYTES) throw new TypeError();

    return { devicePrefix, profileUrl, displayName, followerCount, observedAt, payload };
  } catch {
    throw webhookError("invalid_webhook_payload");
  }
}

function canonicalProfileUrl(value) {
  const url = new URL(String(value ?? "").trim());
  if (url.protocol !== "https:"
    || !["www.xiaohongshu.com", "xiaohongshu.com"].includes(url.hostname)
    || !url.pathname.startsWith("/user/profile/")) {
    throw new TypeError();
  }
  url.search = "";
  url.hash = "";
  return url.toString();
}

function webhookError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}
