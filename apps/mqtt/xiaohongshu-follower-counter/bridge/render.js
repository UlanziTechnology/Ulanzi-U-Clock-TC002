// SPDX-License-Identifier: GPL-3.0-or-later
import { encodeRgbPng } from "./png.js";

const WIDTH = 52;
const HEIGHT = 16;
const ICON_SIZE = 14;
const COUNT_START_X = 16;
const COUNT_WIDTH = WIDTH - COUNT_START_X;
const RED = [255, 36, 66];
const WHITE = [255, 255, 255];
const FONT = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "11111"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  ".": ["0", "0", "0", "0", "0", "1", "1"],
  "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
};
const ICON_MARK = [
  "#..#..####..",
  ".##...#..#..",
  ".##...####..",
  "#..#..#..#..",
  "......####..",
  "###...#..#..",
  ".#....####..",
  "###...#..#..",
];

export function renderFollowerPng(snapshot) {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 3);
  drawXiaohongshuIcon(pixels);

  const count = formatCount(snapshot.followerCount);
  const scale = chooseScale(count);
  const countWidth = textWidth(count, scale);
  const x = COUNT_START_X + Math.floor((COUNT_WIDTH - countWidth) / 2);
  const y = Math.floor((HEIGHT - FONT["0"].length * scale) / 2);
  drawText(pixels, count, x, y, WHITE, scale);
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
  return String(count);
}

function trimDecimal(value) {
  return value >= 100 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, "");
}

function drawXiaohongshuIcon(pixels) {
  for (let y = 1; y <= ICON_SIZE; y += 1) {
    for (let x = 0; x < ICON_SIZE; x += 1) {
      if ((x === 0 || x === ICON_SIZE - 1) && (y === 1 || y === ICON_SIZE)) continue;
      setPixel(pixels, x, y, RED);
    }
  }
  for (let y = 0; y < ICON_MARK.length; y += 1) {
    for (let x = 0; x < ICON_MARK[y].length; x += 1) {
      if (ICON_MARK[y][x] === "#") setPixel(pixels, x + 1, y + 4, WHITE);
    }
  }
}

function drawText(pixels, text, x, y, color, scale = 1) {
  let cursor = x;
  for (const character of text) {
    const glyph = FONT[character] ?? FONT["0"];
    for (let gy = 0; gy < glyph.length; gy += 1) {
      for (let gx = 0; gx < glyph[gy].length; gx += 1) {
        if (glyph[gy][gx] !== "1") continue;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            setPixel(pixels, cursor + gx * scale + dx, y + gy * scale + dy, color);
          }
        }
      }
    }
    cursor += glyph[0].length * scale + 1;
  }
}

function textWidth(text, scale = 1) {
  return [...text].reduce((width, character, index) => {
    const glyphWidth = (FONT[character] ?? FONT["0"])[0].length * scale;
    return width + glyphWidth + (index === text.length - 1 ? 0 : 1);
  }, 0);
}

function chooseScale(text) {
  return textWidth(text, 2) <= COUNT_WIDTH ? 2 : 1;
}

function setPixel(pixels, x, y, color) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const offset = (y * WIDTH + x) * 3;
  pixels.set(color, offset);
}
