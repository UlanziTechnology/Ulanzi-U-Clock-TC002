// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";

import { createBridgeServer } from "../bridge/server.js";

test("HTTP follower event reaches a real MQTT socket as a TC002 image payload", async () => {
  const mqttBytes = [];
  const broker = net.createServer((socket) => {
    socket.on("data", (chunk) => {
      mqttBytes.push(chunk);
      if (chunk[0] === 0x10) socket.write(Buffer.from([0x20, 0x02, 0x00, 0x00]));
    });
  });
  await listen(broker);

  const bridge = createBridgeServer({
    token: "e2e-local-token",
    topic: "tc002/custom/xhs-e2e",
    mqtt: { host: "127.0.0.1", port: broker.address().port, timeoutMs: 1000 },
  });
  await listen(bridge);

  try {
    const response = await fetch(`http://127.0.0.1:${bridge.address().port}/v1/follower-count`, {
      method: "POST",
      headers: {
        Authorization: "Bearer e2e-local-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        profileUrl: "https://www.xiaohongshu.com/user/profile/e2e",
        displayName: "E2E",
        followerCount: 12800,
        observedAt: "2026-07-14T12:00:00.000Z",
      }),
    });
    assert.equal(response.status, 200);
    await new Promise((resolve) => setTimeout(resolve, 20));
  } finally {
    await close(bridge);
    await close(broker);
  }

  const wire = Buffer.concat(mqttBytes);
  assert.ok(wire.includes(Buffer.from("tc002/custom/xhs-e2e")));
  assert.ok(wire.includes(Buffer.from('"duration":31536000')));
  assert.ok(wire.includes(Buffer.from("data:image/png;base64,iVBOR")));
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
