// SPDX-License-Identifier: GPL-3.0-or-later
import { encodeRgbPng } from "./png.js";

const WIDTH = 52;
const HEIGHT = 16;
const COUNT_START_X = 13;
const COUNT_WIDTH = WIDTH - COUNT_START_X;
const BLACK = [0, 0, 0];
const RED = [255, 46, 77];
const WHITE = [255, 255, 255];
const SMALL_FONT = {
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
  "K": ["11011", "11011", "11110", "11100", "11110", "11011", "11011"],
  "M": ["10001", "10001", "10001", "10101", "11111", "11011", "10001"],
};
const LARGE_FONT = {
  "0": ["11111", "11111", "11011", "11011", "11011", "11011", "11011", "11111", "11111"],
  "1": ["00100", "01100", "11100", "00100", "00100", "00100", "00100", "11111", "11111"],
  "2": ["11111", "11111", "00011", "00011", "11111", "11000", "11000", "11111", "11111"],
  "3": ["11111", "11111", "00011", "00011", "11111", "00011", "00011", "11111", "11111"],
  "4": ["11011", "11011", "11011", "11011", "11111", "00011", "00011", "00011", "00011"],
  "5": ["11111", "11111", "11000", "11000", "11111", "00011", "00011", "11111", "11111"],
  "6": ["11111", "11111", "11000", "11000", "11111", "11011", "11011", "11111", "11111"],
  "7": ["11111", "11111", "00011", "00011", "00011", "00011", "00011", "00011", "00011"],
  "8": ["11111", "11111", "11011", "11011", "11111", "11011", "11011", "11111", "11111"],
  "9": ["11111", "11111", "11011", "11011", "11111", "00011", "00011", "11111", "11111"],
  ".": ["00", "00", "00", "00", "00", "00", "00", "11", "11"],
  "K": ["11011", "11111", "11110", "11100", "11100", "11100", "11110", "11111", "11011"],
  "M": ["1100011", "1100011", "1100011", "1100011", "1101011", "1111111", "1111111", "1100111", "1100011"],
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

export function renderFollowerPng(snapshot) {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 3);
  drawXiaohongshuIcon(pixels);

  const count = formatCount(snapshot.followerCount);
  const font = chooseFont(count);
  const fontHeight = Math.max(...Object.values(font).map((glyph) => glyph.length));
  const y = Math.floor((HEIGHT - fontHeight) / 2);
  drawText(pixels, count, COUNT_START_X, y, WHITE, font, fontHeight);
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

function drawXiaohongshuIcon(pixels) {
  const colors = { ".": BLACK, R: RED, W: WHITE };
  for (let y = 0; y < LOGO_MATRIX.length; y += 1) {
    for (let x = 0; x < LOGO_MATRIX[y].length; x += 1) {
      setPixel(pixels, x + 2, y + 3, colors[LOGO_MATRIX[y][x]]);
    }
  }
}

function drawText(pixels, text, x, y, color, font, fontHeight) {
  let cursor = x;
  for (const character of text) {
    const glyph = font[character] ?? font["0"];
    const glyphY = y + Math.floor((fontHeight - glyph.length) / 2);
    for (let gy = 0; gy < glyph.length; gy += 1) {
      for (let gx = 0; gx < glyph[gy].length; gx += 1) {
        if (glyph[gy][gx] !== "1") continue;
        setPixel(pixels, cursor + gx, glyphY + gy, color);
      }
    }
    cursor += glyph[0].length + 1;
  }
}

function textWidth(text, font) {
  return [...text].reduce((width, character, index) => {
    const glyphWidth = (font[character] ?? font["0"])[0].length;
    return width + glyphWidth + (index === text.length - 1 ? 0 : 1);
  }, 0);
}

function chooseFont(text) {
  return textWidth(text, LARGE_FONT) <= COUNT_WIDTH ? LARGE_FONT : SMALL_FONT;
}

function setPixel(pixels, x, y, color) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const offset = (y * WIDTH + x) * 3;
  pixels.set(color, offset);
}
