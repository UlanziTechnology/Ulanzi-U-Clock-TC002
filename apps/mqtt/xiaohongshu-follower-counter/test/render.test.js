// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";

import {
  buildCustomAppPayload,
  formatCount,
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

test("renders a red Xiaohongshu icon and a large white two-digit count", () => {
  const image = decodeRgbPng(renderFollowerPng({ ...SNAPSHOT, followerCount: 18 }));
  assert.deepEqual(pixelAt(image, 1, 1), [255, 36, 66]);
  assert.deepEqual(pixelAt(image, 4, 4), [255, 255, 255]);
  assert.deepEqual(pixelAt(image, 0, 1), [0, 0, 0]);

  const countBounds = litBounds(image, 16, 51, [255, 255, 255]);
  assert.equal(countBounds.height, 14);
  assert.ok(countBounds.minX >= 16 && countBounds.maxX <= 51);
});

test("keeps up to six follower digits exact", () => {
  assert.equal(formatCount(123456), "123456");
  const image = decodeRgbPng(renderFollowerPng({ ...SNAPSHOT, followerCount: 123456 }));
  const bounds = litBounds(image, 16, 51, [255, 255, 255]);
  assert.equal(bounds.width, 35);
  assert.equal(bounds.height, 7);
});

test("compacts seven digit follower counts", () => {
  assert.equal(formatCount(1234567), "1.2M");
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

function decodeRgbPng(png) {
  const chunks = parsePngChunks(png);
  const ihdr = chunks.find((chunk) => chunk.type === "IHDR").data;
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const raw = inflateSync(Buffer.concat(chunks.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data)));
  const pixels = new Uint8Array(width * height * 3);
  const rowBytes = width * 3;
  for (let y = 0; y < height; y += 1) {
    const sourceOffset = y * (rowBytes + 1);
    assert.equal(raw[sourceOffset], 0, "test decoder requires unfiltered PNG rows");
    pixels.set(raw.subarray(sourceOffset + 1, sourceOffset + 1 + rowBytes), y * rowBytes);
  }
  return { width, height, pixels };
}

function pixelAt(image, x, y) {
  const offset = (y * image.width + x) * 3;
  return Array.from(image.pixels.subarray(offset, offset + 3));
}

function litBounds(image, startX, endX, color) {
  const points = [];
  for (let y = 0; y < image.height; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      if (pixelAt(image, x, y).every((channel, index) => channel === color[index])) points.push([x, y]);
    }
  }
  assert.ok(points.length > 0, "expected matching lit pixels");
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, maxX, minY, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
