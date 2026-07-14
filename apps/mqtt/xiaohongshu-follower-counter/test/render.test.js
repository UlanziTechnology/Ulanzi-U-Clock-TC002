// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";

import {
  buildCustomAppPayload,
  renderFollowerPng,
} from "../bridge/render.js";

const SNAPSHOT = {
  profileUrl: "https://www.xiaohongshu.com/user/profile/abc",
  displayName: "Momo",
  followerCount: 12345,
  observedAt: "2026-07-14T12:00:00.000Z",
};

test("renderFollowerPng returns a valid 52 by 16 RGB PNG", () => {
  const png = renderFollowerPng(SNAPSHOT);
  assert.deepEqual(png.subarray(0, 8), Buffer.from("89504e470d0a1a0a", "hex"));

  const chunks = parsePngChunks(png);
  const ihdr = chunks.find((chunk) => chunk.type === "IHDR").data;
  assert.equal(ihdr.readUInt32BE(0), 52);
  assert.equal(ihdr.readUInt32BE(4), 16);
  assert.equal(ihdr[8], 8);
  assert.equal(ihdr[9], 2);

  const raw = inflateSync(Buffer.concat(chunks.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data)));
  assert.equal(raw.length, 16 * (1 + 52 * 3));
  assert.ok(raw.some((byte) => byte !== 0), "render should contain lit pixels");
});

test("buildCustomAppPayload embeds the PNG in the repository custom app schema", () => {
  const payload = buildCustomAppPayload(SNAPSHOT);
  assert.equal(payload.duration, 31536000);
  assert.deepEqual(payload.text, []);
  assert.deepEqual(payload.draw, []);
  assert.equal(payload.image.length, 1);
  assert.deepEqual(payload.image[0].position, [0, 0]);
  assert.match(payload.image[0].data, /^data:image\/png;base64,iVBOR/);
});

function parsePngChunks(png) {
  const chunks = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length;
  }
  return chunks;
}
