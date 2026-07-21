// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";

import { postFollowerPayload } from "../extension/ha-webhook.js";

const CONFIG = {
  homeAssistantUrl: "http://10.10.20.10:8123",
  webhookId: "secret_webhook_id_1234567890",
};
const UPDATE = {
  devicePrefix: "ulanzi_1bd9",
  mqttBroker: { host: "10.10.20.159", port: 1883, username: "never", password: "never" },
  snapshot: {
    profileUrl: "https://www.xiaohongshu.com/user/profile/abc",
    displayName: "甜糯米",
    followerCount: 18,
    observedAt: "2026-07-21T03:12:32.905Z",
  },
  customAppPayload: {
    duration: 3600,
    text: [],
    image: [{ data: "data:image/png;base64,iVBORw0KGgo=", position: [0, 0] }],
    draw: [],
  },
};

test("posts only the allowlisted follower update shape to the HA Webhook", async () => {
  let request;
  await postFollowerPayload(CONFIG, UPDATE, {
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(null, { status: 204 });
    },
  });
  assert.equal(request.url, `http://10.10.20.10:8123/api/webhook/${CONFIG.webhookId}`);
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers["Content-Type"], "application/json");
  const body = JSON.parse(request.options.body);
  assert.deepEqual(body, {
    devicePrefix: "ulanzi_1bd9",
    profileUrl: UPDATE.snapshot.profileUrl,
    displayName: "甜糯米",
    followerCount: 18,
    observedAt: "2026-07-21T03:12:32.905Z",
    payload: JSON.stringify(UPDATE.customAppPayload),
  });
  for (const forbidden of ["topic", "appName", "mqttBroker", "mqtt_name", "mqtt_pwd", "username", "password"]) {
    assert.equal(Object.hasOwn(body, forbidden), false, forbidden);
  }
});

test("returns stable errors without leaking the Webhook secret", async () => {
  await assert.rejects(
    postFollowerPayload(CONFIG, UPDATE, {
      fetchImpl: async () => new Response("denied", { status: 403 }),
    }),
    (error) => error.code === "webhook_rejected" && !error.message.includes(CONFIG.webhookId),
  );
  await assert.rejects(
    postFollowerPayload(CONFIG, UPDATE, {
      fetchImpl: async () => { throw new TypeError(`offline ${CONFIG.webhookId}`); },
    }),
    (error) => error.code === "ha_unreachable" && !error.message.includes(CONFIG.webhookId),
  );
  await assert.rejects(
    postFollowerPayload(CONFIG, { ...UPDATE, devicePrefix: "bad/topic" }),
    (error) => error.code === "invalid_webhook_payload" && !error.message.includes(CONFIG.webhookId),
  );
});
