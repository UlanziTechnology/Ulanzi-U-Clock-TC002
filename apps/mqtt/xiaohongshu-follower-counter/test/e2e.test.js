// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { discoverDevice } from "../extension/device-discovery.js";
import { buildCustomAppPayload } from "../extension/render.js";
import { postFollowerPayload } from "../extension/ha-webhook.js";

test("fake TC002 discovery reaches a real HA Webhook as a rendered follower update", async () => {
  const tc002 = http.createServer((request, response) => {
    const value = request.url === "/getBase"
      ? { ip: "10.10.21.210", mac: "ccc4b2441bd9", model: "TC002", appVer: "1.0.4" }
      : {
        isMqtt: true,
        ip: "10.10.20.159",
        port: "1883",
        mqtt_prefix: "ulanzi",
        mqtt_name: "must-not-leave-device",
        mqtt_pwd: "must-not-leave-device",
      };
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(value));
  });
  await listen(tc002);

  const received = [];
  const webhookId = "e2e_webhook_secret_1234567890";
  const homeAssistant = http.createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      received.push({
        method: request.method,
        url: request.url,
        body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
      });
      response.writeHead(204);
      response.end();
    });
  });
  await listen(homeAssistant);

  try {
    const snapshot = {
      profileUrl: "https://www.xiaohongshu.com/user/profile/e2e",
      displayName: "E2E",
      followerCount: 12800,
      observedAt: "2026-07-21T12:00:00.000Z",
    };
    const device = await discoverDevice("10.10.21.210", {
      deviceBaseUrl: `http://127.0.0.1:${tc002.address().port}`,
    });
    const customAppPayload = await buildCustomAppPayload(snapshot);
    await postFollowerPayload({
      homeAssistantUrl: `http://127.0.0.1:${homeAssistant.address().port}`,
      webhookId,
    }, {
      devicePrefix: device.devicePrefix,
      snapshot,
      customAppPayload,
    });
  } finally {
    await close(tc002);
    await close(homeAssistant);
  }

  assert.equal(received.length, 1);
  assert.equal(received[0].method, "POST");
  assert.equal(received[0].url, `/api/webhook/${webhookId}`);
  assert.equal(received[0].body.devicePrefix, "ulanzi_1bd9");
  assert.equal(received[0].body.followerCount, 12800);
  assert.match(received[0].body.payload, /data:image\/png;base64,iVBOR/);
  const wire = JSON.stringify(received[0].body);
  assert.doesNotMatch(wire, /must-not-leave-device|mqtt_(?:name|pwd)|username|password|"topic"/);
});

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}
