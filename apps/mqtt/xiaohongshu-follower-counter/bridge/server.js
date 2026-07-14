// SPDX-License-Identifier: GPL-3.0-or-later
import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";

import { configSummary, loadConfig } from "./config.js";
import { publishMqtt } from "./mqtt.js";
import { buildCustomAppPayload } from "./render.js";

const MAX_BODY_BYTES = 16 * 1024;

export function validateSnapshot(input) {
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
  return {
    profileUrl: url.toString(),
    displayName,
    followerCount: input.followerCount,
    observedAt: new Date(observedAt).toISOString(),
  };
}

export function createBridgeServer(config, publish = publishMqtt) {
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

      const snapshot = validateSnapshot(JSON.parse(await readBody(request)));
      const payload = JSON.stringify(buildCustomAppPayload(snapshot));
      await publish(config.mqtt, config.topic, payload);
      return sendJson(response, 200, {
        published: true,
        topic: config.topic,
        followerCount: snapshot.followerCount,
      });
    } catch (error) {
      const clientError = error instanceof SyntaxError || error instanceof TypeError || error?.code === "BODY_TOO_LARGE";
      return sendJson(response, clientError ? 400 : 502, {
        error: clientError ? error.message : "mqtt_publish_failed",
      });
    }
  });
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
