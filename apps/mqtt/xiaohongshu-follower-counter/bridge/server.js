// SPDX-License-Identifier: GPL-3.0-or-later
import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";

import { configSummary, loadConfig } from "./config.js";
import { createDeviceResolver } from "./device-discovery.js";
import { publishMqtt } from "./mqtt.js";
import { buildCustomAppPayload } from "./render.js";

const MAX_BODY_BYTES = 16 * 1024;

export function validateSnapshot(input, { allowMissingDeviceIp = false } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Event must be a JSON object");
  }

  let url;
  try {
    url = new URL(input.profileUrl);
  } catch {
    throw new TypeError("profileUrl must be a valid URL");
  }
  if (
    url.protocol !== "https:" ||
    !["www.xiaohongshu.com", "xiaohongshu.com"].includes(url.hostname) ||
    !url.pathname.startsWith("/user/profile/")
  ) {
    throw new TypeError("profileUrl must be a Xiaohongshu user profile");
  }

  if (!Number.isInteger(input.followerCount) || input.followerCount < 0 || input.followerCount > 1_000_000_000) {
    throw new TypeError("followerCount must be an integer from 0 to 1000000000");
  }
  const observedAt = input.observedAt || new Date().toISOString();
  if (!Number.isFinite(Date.parse(observedAt))) throw new TypeError("observedAt must be an ISO timestamp");

  url.search = "";
  url.hash = "";
  const displayName = typeof input.displayName === "string" && input.displayName.trim()
    ? input.displayName.trim().slice(0, 80)
    : "小红书用户";
  const deviceIp = input.deviceIp === undefined && allowMissingDeviceIp
    ? undefined
    : normalizePrivateIpv4(input.deviceIp);
  return {
    profileUrl: url.toString(),
    displayName,
    followerCount: input.followerCount,
    observedAt: new Date(observedAt).toISOString(),
    ...(deviceIp ? { deviceIp } : {}),
  };
}

export function createBridgeServer(config, publish = publishMqtt, options = {}) {
  const resolver = options.resolveDevice ? null : createDeviceResolver(options.deviceResolverOptions);
  const resolveDevice = options.resolveDevice || resolver.resolve;
  return http.createServer(async (request, response) => {
    applyCors(request, response);
    try {
      if (request.method === "GET" && request.url === "/health") {
        return sendJson(response, 200, { ok: true });
      }
      if (request.method === "OPTIONS" && request.url === "/v1/follower-count") {
        response.writeHead(204);
        return response.end();
      }
      if (request.method !== "POST" || request.url !== "/v1/follower-count") {
        return sendJson(response, 404, { error: "not_found" });
      }
      if (!authorized(request.headers.authorization, config.token)) {
        return sendJson(response, 401, { error: "unauthorized" });
      }

      const snapshot = validateSnapshot(JSON.parse(await readBody(request)), {
        allowMissingDeviceIp: Boolean(config.legacyTarget),
      });
      const payload = JSON.stringify(buildCustomAppPayload(snapshot));
      let target;
      if (snapshot.deviceIp) {
        target = await resolveDevice(snapshot.deviceIp);
        try {
          await publish({ ...config.mqttPolicy, ...target.mqtt }, target.topic, payload);
        } catch {
          target = await resolveDevice(snapshot.deviceIp, { forceRefresh: true });
          await publish({ ...config.mqttPolicy, ...target.mqtt }, target.topic, payload);
        }
      } else {
        target = config.legacyTarget;
        await publish({ ...config.mqttPolicy, ...target.mqtt }, target.topic, payload);
      }
      return sendJson(response, 200, {
        published: true,
        deviceIp: target.deviceIp || snapshot.deviceIp || null,
        topic: target.topic,
        followerCount: snapshot.followerCount,
      });
    } catch (error) {
      const clientError = error instanceof SyntaxError || error instanceof TypeError || error?.code === "BODY_TOO_LARGE";
      if (clientError) return sendJson(response, 400, { error: error.message });
      if (["invalid_device_response", "invalid_mqtt_config", "mqtt_disabled"].includes(error?.code)) {
        return sendJson(response, 400, { error: error.code });
      }
      if (error?.code === "device_unreachable") return sendJson(response, 502, { error: error.code });
      return sendJson(response, 502, { error: "mqtt_publish_failed" });
    }
  });
}

function normalizePrivateIpv4(value) {
  const input = String(value ?? "").trim();
  const parts = input.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) {
    throw new TypeError("deviceIp must be an RFC1918 IPv4 address");
  }
  const octets = parts.map(Number);
  const isPrivate = octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168);
  if (!isPrivate) throw new TypeError("deviceIp must be an RFC1918 IPv4 address");
  return octets.join(".");
}

function authorized(header, token) {
  if (!header?.startsWith("Bearer ")) return false;
  const actual = Buffer.from(header.slice(7));
  const expected = Buffer.from(token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function applyCors(request, response) {
  const origin = request.headers.origin;
  if (typeof origin === "string" && origin.startsWith("chrome-extension://")) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        const error = new Error("Request body is too large");
        error.code = "BODY_TOO_LARGE";
        reject(error);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.once("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.once("error", reject);
  });
}

function sendJson(response, status, body) {
  if (response.headersSent || response.destroyed) return;
  const data = Buffer.from(JSON.stringify(body));
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": data.length,
    "Cache-Control": "no-store",
  });
  response.end(data);
}

async function main() {
  const config = loadConfig();
  const server = createBridgeServer(config);
  server.listen(config.bridgePort, "127.0.0.1", () => {
    console.log(`TC002 Xiaohongshu bridge ready ${JSON.stringify(configSummary(config))}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
