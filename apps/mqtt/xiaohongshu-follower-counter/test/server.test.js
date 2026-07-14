// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";

import { createBridgeServer, validateSnapshot } from "../bridge/server.js";

const CONFIG = {
  token: "test-token-123456",
  mqttPolicy: { timeoutMs: 5000, retain: true, tls: false },
  legacyTarget: null,
};

test("validateSnapshot accepts only Xiaohongshu profile events", () => {
  assert.deepEqual(
    validateSnapshot({
      profileUrl: "https://www.xiaohongshu.com/user/profile/abc?xsec_token=secret",
      displayName: " Momo ",
      followerCount: 123,
      observedAt: "2026-07-14T12:00:00.000Z",
      deviceIp: "10.10.21.210",
      ignored: "not forwarded",
    }),
    {
      profileUrl: "https://www.xiaohongshu.com/user/profile/abc",
      displayName: "Momo",
      followerCount: 123,
      observedAt: "2026-07-14T12:00:00.000Z",
      deviceIp: "10.10.21.210",
    },
  );
  assert.throws(
    () => validateSnapshot({ profileUrl: "https://evil.example/user/profile/abc", followerCount: 1 }),
    /profileUrl/,
  );
  assert.throws(
    () => validateSnapshot({ profileUrl: "https://www.xiaohongshu.com/user/profile/abc", followerCount: -1 }),
    /followerCount/,
  );
});

test("bridge exposes health and extension-scoped CORS preflight", async () => {
  await withServer(async (baseUrl) => {
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });

    const preflight = await fetch(`${baseUrl}/v1/follower-count`, {
      method: "OPTIONS",
      headers: { Origin: "chrome-extension://abcdefghijklmnop" },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "chrome-extension://abcdefghijklmnop");
    assert.match(preflight.headers.get("access-control-allow-headers"), /authorization/i);
  });
});

test("bridge rejects missing authorization and invalid events", async () => {
  await withServer(async (baseUrl) => {
    const unauthorized = await fetch(`${baseUrl}/v1/follower-count`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validEvent()),
    });
    assert.equal(unauthorized.status, 401);

    const invalid = await post(baseUrl, { ...validEvent(), followerCount: "many" });
    assert.equal(invalid.status, 400);
    assert.match((await invalid.json()).error, /followerCount/);
  });
});

test("bridge renders and publishes a retained custom app payload", async () => {
  const calls = [];
  const resolved = [];
  const resolveDevice = async (deviceIp, options) => {
    resolved.push({ deviceIp, options });
    return {
      deviceIp,
      topic: "ulanzi_1bd9/custom/display",
      mqtt: { host: "10.10.20.159", port: 1883 },
    };
  };
  await withServer(async (baseUrl) => {
    const response = await post(baseUrl, validEvent());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      published: true,
      deviceIp: "10.10.21.210",
      topic: "ulanzi_1bd9/custom/display",
      followerCount: 12345,
    });
  }, async (...args) => calls.push(args), { resolveDevice });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0].host, "10.10.20.159");
  assert.equal(calls[0][0].retain, true);
  assert.equal(calls[0][1], "ulanzi_1bd9/custom/display");
  assert.deepEqual(resolved, [{ deviceIp: "10.10.21.210", options: undefined }]);
  const payload = JSON.parse(calls[0][2]);
  assert.equal(payload.duration, 31536000);
  assert.match(payload.image[0].data, /^data:image\/png;base64,/);
});

test("bridge refreshes discovery once after a publish failure", async () => {
  const resolutions = [];
  let publishes = 0;
  const resolveDevice = async (deviceIp, options) => {
    resolutions.push({ deviceIp, options });
    return { deviceIp, topic: "ulanzi_1bd9/custom/display", mqtt: { host: "10.10.20.159", port: 1883 } };
  };
  await withServer(async (baseUrl) => {
    const response = await post(baseUrl, validEvent());
    assert.equal(response.status, 200);
  }, async () => {
    publishes += 1;
    if (publishes === 1) throw new Error("stale broker");
  }, { resolveDevice });
  assert.equal(publishes, 2);
  assert.deepEqual(resolutions, [
    { deviceIp: "10.10.21.210", options: undefined },
    { deviceIp: "10.10.21.210", options: { forceRefresh: true } },
  ]);
});

test("one device discovery failure does not affect another device", async () => {
  const resolveDevice = async (deviceIp) => {
    if (deviceIp === "10.10.21.211") throw Object.assign(new Error("offline"), { code: "device_unreachable" });
    return { deviceIp, topic: "ulanzi_1bd9/custom/display", mqtt: { host: "10.10.20.159", port: 1883 } };
  };
  await withServer(async (baseUrl) => {
    const [failed, succeeded] = await Promise.all([
      post(baseUrl, { ...validEvent(), deviceIp: "10.10.21.211" }),
      post(baseUrl, validEvent()),
    ]);
    assert.equal(failed.status, 502);
    assert.deepEqual(await failed.json(), { error: "device_unreachable" });
    assert.equal(succeeded.status, 200);
  }, async () => {}, { resolveDevice });
});

function validEvent() {
  return {
    profileUrl: "https://www.xiaohongshu.com/user/profile/abc",
    displayName: "Momo",
    followerCount: 12345,
    observedAt: "2026-07-14T12:00:00.000Z",
    deviceIp: "10.10.21.210",
  };
}

function post(baseUrl, body) {
  return fetch(`${baseUrl}/v1/follower-count`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CONFIG.token}`,
      "Content-Type": "application/json",
      Origin: "chrome-extension://abcdefghijklmnop",
    },
    body: JSON.stringify(body),
  });
}

async function withServer(run, publish = async () => {}, options = {}) {
  const server = createBridgeServer(CONFIG, publish, options);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
