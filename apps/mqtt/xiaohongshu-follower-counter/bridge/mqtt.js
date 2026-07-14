// SPDX-License-Identifier: GPL-3.0-or-later
import net from "node:net";
import tls from "node:tls";
import { randomBytes } from "node:crypto";

const MAX_REMAINING_LENGTH = 268_435_455;

export function encodeRemainingLength(value) {
  if (!Number.isInteger(value) || value < 0 || value > MAX_REMAINING_LENGTH) {
    throw new RangeError("Invalid MQTT remaining length");
  }
  const bytes = [];
  do {
    let encoded = value % 128;
    value = Math.floor(value / 128);
    if (value > 0) encoded |= 0x80;
    bytes.push(encoded);
  } while (value > 0);
  return Buffer.from(bytes);
}

export function buildConnectPacket(options = {}) {
  const clientId = options.clientId || `tc002-xhs-${randomBytes(4).toString("hex")}`;
  const keepAlive = options.keepAlive ?? 60;
  if (!Number.isInteger(keepAlive) || keepAlive < 0 || keepAlive > 65535) {
    throw new RangeError("Invalid MQTT keep alive");
  }

  let flags = 0x02;
  const payload = [mqttString(clientId)];
  if (options.username !== undefined && options.username !== "") {
    flags |= 0x80;
    payload.push(mqttString(options.username));
  }
  if (options.password !== undefined && options.password !== "") {
    if (!(flags & 0x80)) throw new TypeError("MQTT password requires a username");
    flags |= 0x40;
    payload.push(mqttString(options.password));
  }

  const variableHeader = Buffer.concat([
    mqttString("MQTT"),
    Buffer.from([0x04, flags, keepAlive >> 8, keepAlive & 0xff]),
  ]);
  const body = Buffer.concat([variableHeader, ...payload]);
  return Buffer.concat([Buffer.from([0x10]), encodeRemainingLength(body.length), body]);
}

export function buildPublishPacket(topic, payload, retain = true) {
  if (typeof topic !== "string" || !topic || topic.includes("\0") || /[+#]/.test(topic)) {
    throw new TypeError("Invalid MQTT publish topic");
  }
  const body = Buffer.concat([
    mqttString(topic),
    Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), "utf8"),
  ]);
  return Buffer.concat([
    Buffer.from([retain ? 0x31 : 0x30]),
    encodeRemainingLength(body.length),
    body,
  ]);
}

export function publishMqtt(options, topic, payload) {
  const timeoutMs = options.timeoutMs ?? 5000;
  return new Promise((resolve, reject) => {
    let settled = false;
    let response = Buffer.alloc(0);
    let publishSent = false;
    const socket = options.tls
      ? tls.connect({
          host: options.host,
          port: options.port ?? 8883,
          servername: options.servername || options.host,
          rejectUnauthorized: options.rejectUnauthorized !== false,
        })
      : net.createConnection({ host: options.host, port: options.port ?? 1883 });

    const finish = (error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };

    socket.setTimeout(timeoutMs, () => finish(new Error("MQTT connection timed out")));
    socket.once("error", finish);
    socket.once("close", () => {
      if (!settled) finish(publishSent ? null : new Error("MQTT connection closed before publish"));
    });
    socket.once(options.tls ? "secureConnect" : "connect", () => {
      socket.write(buildConnectPacket(options));
    });
    socket.on("data", (chunk) => {
      if (publishSent) return;
      response = Buffer.concat([response, chunk]);
      if (response.length < 4) return;
      if (response[0] !== 0x20 || response[1] !== 0x02 || response[2] !== 0x00) {
        finish(new Error("Invalid MQTT CONNACK"));
        return;
      }
      if (response[3] !== 0x00) {
        finish(new Error(`MQTT broker rejected connection (${response[3]})`));
        return;
      }

      publishSent = true;
      socket.write(buildPublishPacket(topic, payload, options.retain !== false));
      socket.end(Buffer.from([0xe0, 0x00]));
    });
  });
}

function mqttString(value) {
  const bytes = Buffer.from(String(value), "utf8");
  if (bytes.length > 65535 || bytes.includes(0)) throw new RangeError("Invalid MQTT UTF-8 string");
  const prefix = Buffer.alloc(2);
  prefix.writeUInt16BE(bytes.length);
  return Buffer.concat([prefix, bytes]);
}
