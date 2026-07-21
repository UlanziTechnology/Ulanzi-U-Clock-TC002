// SPDX-License-Identifier: GPL-3.0-or-later

const PNG_SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const ASCII = new TextEncoder();

export async function encodeRgbPng(width, height, pixels) {
  validateRgbInput(width, height, pixels);

  const ihdr = new Uint8Array(13);
  writeUint32(ihdr, 0, width);
  writeUint32(ihdr, 4, height);
  ihdr[8] = 8;
  ihdr[9] = 2;

  const scanlines = addFilterBytes(width, height, pixels);
  const compressed = new Uint8Array(
    await new Response(
      new Blob([scanlines]).stream().pipeThrough(new CompressionStream("deflate")),
    ).arrayBuffer(),
  );

  return concatBytes(
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", new Uint8Array()),
  );
}

function validateRgbInput(width, height, pixels) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new TypeError("PNG dimensions must be positive integers");
  }
  if (!(pixels instanceof Uint8Array) || pixels.length !== width * height * 3) {
    throw new TypeError("RGB pixel buffer has an invalid length");
  }
}

function addFilterBytes(width, height, pixels) {
  const rowBytes = width * 3;
  const scanlines = new Uint8Array(height * (rowBytes + 1));
  for (let y = 0; y < height; y += 1) {
    const target = y * (rowBytes + 1);
    scanlines[target] = 0;
    scanlines.set(pixels.subarray(y * rowBytes, (y + 1) * rowBytes), target + 1);
  }
  return scanlines;
}

function pngChunk(type, data) {
  const typeBytes = ASCII.encode(type);
  const body = concatBytes(typeBytes, data);
  const result = new Uint8Array(12 + data.length);
  writeUint32(result, 0, data.length);
  result.set(body, 4);
  writeUint32(result, result.length - 4, crc32(body));
  return result;
}

function writeUint32(bytes, offset, value) {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(offset, value >>> 0);
}

function concatBytes(...parts) {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
