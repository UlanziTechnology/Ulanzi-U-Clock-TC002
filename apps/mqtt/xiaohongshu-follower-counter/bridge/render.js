// SPDX-License-Identifier: GPL-3.0-or-later
import { encodeRgbPng } from "./png.js";

const WIDTH = 52;
const HEIGHT = 16;
const RED = [255, 36, 66];
const PINK = [255, 142, 160];
const WHITE = [255, 255, 255];
const FONT = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["110", "001", "010", "100", "111"],
  "3": ["110", "001", "010", "001", "110"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "110", "001", "110"],
  "6": ["011", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "110"],
  ".": ["0", "0", "0", "0", "1"],
  "K": ["101", "110", "100", "110", "101"],
  "M": ["10001", "11011", "10101", "10101", "10101"],
  "X": ["101", "101", "010", "101", "101"],
  "H": ["101", "101", "111", "101", "101"],
  "S": ["111", "100", "111", "001", "111"],
};

export function renderFollowerPng(snapshot) {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 3);
  drawRoundedBadge(pixels);
  drawText(pixels, "XHS", 3, 2, WHITE);

  const count = formatCount(snapshot.followerCount);
  const countWidth = textWidth(count);
  drawText(pixels, count, Math.max(20, WIDTH - countWidth - 2), 6, WHITE);
  drawLine(pixels, 20, 13, 50, PINK);
  return encodeRgbPng(WIDTH, HEIGHT, pixels);
}

export function buildCustomAppPayload(snapshot, duration = 31_536_000) {
  const png = renderFollowerPng(snapshot);
  return {
    duration,
    text: [],
    image: [{ data: `data:image/png;base64,${png.toString("base64")}`, position: [0, 0] }],
    draw: [],
  };
}

export function formatCount(value) {
  const count = Math.max(0, Math.round(Number(value) || 0));
  if (count >= 1_000_000) return `${trimDecimal(count / 1_000_000)}M`;
  if (count >= 10_000) return `${trimDecimal(count / 1_000)}K`;
  return String(count);
}

function trimDecimal(value) {
  return value >= 100 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, "");
}

function drawRoundedBadge(pixels) {
  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 18; x += 1) {
      if ((x === 0 || x === 17) && (y === 0 || y === 9)) continue;
      setPixel(pixels, x, y, RED);
    }
  }
}

function drawText(pixels, text, x, y, color) {
  let cursor = x;
  for (const character of text) {
    const glyph = FONT[character] ?? FONT["0"];
    for (let gy = 0; gy < glyph.length; gy += 1) {
      for (let gx = 0; gx < glyph[gy].length; gx += 1) {
        if (glyph[gy][gx] === "1") setPixel(pixels, cursor + gx, y + gy, color);
      }
    }
    cursor += glyph[0].length + 1;
  }
}

function textWidth(text) {
  return [...text].reduce((width, character, index) => {
    const glyphWidth = (FONT[character] ?? FONT["0"])[0].length;
    return width + glyphWidth + (index === text.length - 1 ? 0 : 1);
  }, 0);
}

function drawLine(pixels, startX, y, endX, color) {
  for (let x = startX; x <= endX; x += 1) setPixel(pixels, x, y, color);
}

function setPixel(pixels, x, y, color) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const offset = (y * WIDTH + x) * 3;
  pixels.set(color, offset);
}
