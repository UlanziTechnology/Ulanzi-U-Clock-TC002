// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";

import {
  buildConnectPacket,
  buildPublishPacket,
  encodeRemainingLength,
  publishMqtt,
} from "../bridge/mqtt.js";

test("encodeRemainingLength follows MQTT variable-byte encoding", () => {
  assert.deepEqual(encodeRemainingLength(0), Buffer.from([0]));
  assert.deepEqual(encodeRemainingLength(127), Buffer.from([127]));
  assert.deepEqual(encodeRemainingLength(128), Buffer.from([128, 1]));
  assert.deepEqual(encodeRemainingLength(16384), Buffer.from([128, 128, 1]));
});

test("buildConnectPacket encodes MQTT 3.1.1 clean session and credentials", () => {
  const packet = buildConnectPacket({
    clientId: "tc002-test",
    username: "alice",
    password: "secret",
    keepAlive: 30,
  });
  assert.equal(packet[0], 0x10);
  assert.ok(packet.includes(Buffer.from("MQTT")));
  const mqttOffset = packet.indexOf(Buffer.from("MQTT"));
  assert.equal(packet[mqttOffset + 4], 4, "protocol level");
  assert.equal(packet[mqttOffset + 5], 0xc2, "username + password + clean session flags");
  assert.ok(packet.includes(Buffer.from("tc002-test")));
  assert.ok(packet.includes(Buffer.from("alice")));
  assert.ok(packet.includes(Buffer.from("secret")));
});

test("buildPublishPacket creates a retained QoS 0 publication", () => {
  const packet = buildPublishPacket("ulanzi_1bf6/custom/xhs_followers", '{"ok":true}', true);
  assert.equal(packet[0], 0x31);
  assert.ok(packet.includes(Buffer.from("ulanzi_1bf6/custom/xhs_followers")));
  assert.ok(packet.subarray(-11).equals(Buffer.from('{"ok":true}')));
});

test("publishMqtt completes CONNECT, retained PUBLISH, and DISCONNECT against a broker", async () => {
  const received = [];
  const broker = net.createServer((socket) => {
    socket.on("data", (chunk) => {
      received.push(chunk);
      if (chunk[0] === 0x10) socket.write(Buffer.from([0x20, 0x02, 0x00, 0x00]));
    });
  });
  await listen(broker);
  const { port } = broker.address();

  try {
    await publishMqtt(
      { host: "127.0.0.1", port, clientId: "integration-test", timeoutMs: 1000 },
      "tc002/custom/test",
      '{"followers":123}',
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
  } finally {
    await new Promise((resolve) => broker.close(resolve));
  }

  const bytes = Buffer.concat(received);
  assert.ok(bytes.includes(Buffer.from("MQTT")));
  assert.ok(bytes.includes(Buffer.from("tc002/custom/test")));
  assert.ok(bytes.includes(Buffer.from('{"followers":123}')));
  assert.ok(bytes.includes(Buffer.from([0xe0, 0x00])));
});

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
}
