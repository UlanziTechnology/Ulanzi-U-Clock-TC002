// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";

import {
  buildCustomAppPayload,
  formatCount,
  getFollowerGlyph,
  renderFollowerPng,
} from "../bridge/render.js";

const SNAPSHOT = {
  profileUrl: "https://www.xiaohongshu.com/user/profile/abc",
  displayName: "Momo",
  followerCount: 12345,
  observedAt: "2026-07-14T12:00:00.000Z",
};
const LOGO_MATRIX = [
  ".RRRRRRRR.",
  "RRRRRRRRRR",
  "RRRWRWWWRR",
  "RRWRRRWRRR",
  "RRRWRRWRRR",
  "RRWRRRWRRR",
  "RRRRRRWRRR",
  "RRWWRWWWRR",
  "RRRRRRRRRR",
  ".RRRRRRRR.",
];
const LARGE_DIGITS = {
  "0": ["11111", "11111", "11011", "11011", "11011", "11011", "11011", "11011", "11111", "11111"],
  "1": ["00100", "01100", "11100", "00100", "00100", "00100", "00100", "00100", "11111", "11111"],
  "2": ["11111", "11111", "00011", "00011", "11111", "11111", "11000", "11000", "11111", "11111"],
  "3": ["11111", "11111", "00011", "00011", "11111", "11111", "00011", "00011", "11111", "11111"],
  "4": ["11011", "11011", "11011", "11011", "11111", "11111", "00011", "00011", "00011", "00011"],
  "5": ["11111", "11111", "11000", "11000", "11111", "11111", "00011", "00011", "11111", "11111"],
  "6": ["11111", "11111", "11000", "11000", "11111", "11111", "11011", "11011", "11111", "11111"],
  "7": ["11111", "11111", "00011", "00011", "00011", "00011", "00011", "00011", "00011", "00011"],
  "8": ["11111", "11111", "11011", "11011", "11111", "11111", "11011", "11011", "11111", "11111"],
  "9": ["11111", "11111", "11011", "11011", "11111", "11111", "00011", "00011", "11111", "11111"],
};
const LARGE_K = ["110011", "110111", "110110", "111100", "111100", "111100", "111100", "110110", "110111", "110011"];
const LARGE_M = ["11000011", "11100111", "11100111", "11111111", "11011011", "11000011", "11000011", "11000011", "11000011", "11000011"];
const SMALL_K = ["10001", "10110", "10110", "11000", "10110", "10110", "10001"];
const SMALL_M = ["1000001", "1110111", "1110111", "1001001", "1000001", "1000001", "1000001"];

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

test("renders the persisted Xiaohongshu color matrix and fixed digit matrices", () => {
  const image = decodeRgbPng(renderFollowerPng({ ...SNAPSHOT, followerCount: 18 }));
  assert.deepEqual(pixelAt(image, 0, 3), [0, 0, 0]);
  assert.deepEqual(pixelAt(image, 1, 3), [0, 0, 0]);
  assertColorMatrix(image, LOGO_MATRIX, 2, 3);
  for (let y = 0; y < image.height; y += 1) {
    assert.deepEqual(pixelAt(image, 12, y), [0, 0, 0]);
    assert.deepEqual(pixelAt(image, 13, y), [0, 0, 0]);
  }
  assertScaledGlyph(image, LARGE_DIGITS["1"], 14, 3, 1);
  assertScaledGlyph(image, LARGE_DIGITS["8"], 20, 3, 1);

  const countBounds = litBounds(image, 14, 51, [255, 255, 255]);
  assert.equal(countBounds.width, 11);
  assert.equal(countBounds.height, 10);
});

test("uses persisted K and M character matrices for compact counts", () => {
  assert.equal(formatCount(12800), "12.8K");
  assert.equal(formatCount(123456), "123K");
  assert.equal(formatCount(1234567), "1.2M");
  assertScaledGlyph(decodeRgbPng(renderFollowerPng({ ...SNAPSHOT, followerCount: 12800 })), LARGE_K, 35, 3, 1);
  assertScaledGlyph(decodeRgbPng(renderFollowerPng({ ...SNAPSHOT, followerCount: 1234567 })), LARGE_M, 29, 3, 1);
});

test("renders every persisted large digit as a 5 by 10 matrix", () => {
  for (const [digit, matrix] of Object.entries(LARGE_DIGITS)) {
    const image = decodeRgbPng(renderFollowerPng({ ...SNAPSHOT, followerCount: Number(digit) }));
    assertScaledGlyph(image, matrix, 14, 3, 1);
  }
});

test("persists the supplied small K and M matrices", () => {
  assert.deepEqual(getFollowerGlyph("small", "K"), SMALL_K);
  assert.deepEqual(getFollowerGlyph("small", "M"), SMALL_M);
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

function assertColorMatrix(image, matrix, startX, startY) {
  const colors = {
    ".": [0, 0, 0],
    R: [255, 46, 77],
    W: [255, 255, 255],
  };
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      assert.deepEqual(pixelAt(image, startX + x, startY + y), colors[matrix[y][x]], `matrix pixel ${x},${y}`);
    }
  }
}

function assertScaledGlyph(image, matrix, startX, startY, scale) {
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      const expected = matrix[y][x] === "1" ? [255, 255, 255] : [0, 0, 0];
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          assert.deepEqual(pixelAt(image, startX + x * scale + dx, startY + y * scale + dy), expected, `glyph pixel ${x},${y}`);
        }
      }
    }
  }
}
