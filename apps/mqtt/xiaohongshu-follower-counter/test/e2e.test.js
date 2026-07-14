// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import http from "node:http";

import { createBridgeServer } from "../bridge/server.js";
import { discoverDevice, fetchDeviceJson } from "../bridge/device-discovery.js";

test("HTTP follower event reaches a real MQTT socket as a TC002 image payload", async () => {
  const mqttBytes = [];
  const broker = net.createServer((socket) => {
    socket.on("data", (chunk) => {
      mqttBytes.push(chunk);
      if (chunk[0] === 0x10) socket.write(Buffer.from([0x20, 0x02, 0x00, 0x00]));
    });
  });
  await listen(broker);

  const deviceApi = http.createServer((request, response) => {
    const value = request.url === "/getBase"
      ? { ip: "10.10.21.210", mac: "ccc4b2441bd9", appVer: "1.0.4" }
      : { isMqtt: true, ip: "10.10.20.159", port: "1883", mqtt_prefix: "ulanzi" };
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(value));
  });
  await listen(deviceApi);

  const bridge = createBridgeServer({
    token: "e2e-local-token",
    mqttPolicy: { timeoutMs: 1000, retain: true, tls: false },
    legacyTarget: null,
  }, undefined, {
    deviceResolverOptions: {
      discover: async (deviceIp) => {
        const target = await discoverDevice(deviceIp, {
          requestJson: (_ip, path) => fetchDeviceJson("127.0.0.1", path, { port: deviceApi.address().port }),
        });
        return {
          ...target,
          mqtt: { ...target.mqtt, host: "127.0.0.1", port: broker.address().port },
        };
      },
    },
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
        deviceIp: "10.10.21.210",
      }),
    });
    assert.equal(response.status, 200);
    await new Promise((resolve) => setTimeout(resolve, 20));
  } finally {
    await close(bridge);
    await close(deviceApi);
    await close(broker);
  }

  const wire = Buffer.concat(mqttBytes);
  assert.ok(wire.includes(Buffer.from("ulanzi_1bd9/custom/display")));
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
