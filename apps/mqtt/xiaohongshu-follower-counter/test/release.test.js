// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { relative } from "node:path";

const execFileAsync = promisify(execFile);

const APP = new URL("../", import.meta.url);
const REPOSITORY = new URL("../../../", APP);

test("package and Chrome extension publish the same version", async () => {
  const packageJson = JSON.parse(await readFile(new URL("package.json", APP), "utf8"));
  const manifest = JSON.parse(await readFile(new URL("extension/manifest.json", APP), "utf8"));
  assert.equal(packageJson.version, manifest.version);
});

test("repository ignores local operating-system and runtime files", async () => {
  const ignore = await readFile(new URL(".gitignore", REPOSITORY), "utf8");
  assert.match(ignore, /^\.DS_Store$/m);
  assert.match(ignore, /^node_modules\/$/m);
  assert.match(ignore, /^\*\.log$/m);
  assert.match(ignore, /^\.env$/m);
  assert.match(ignore, /^!\.env\.example$/m);
});

test("package exposes one cross-platform release check", async () => {
  const packageJson = JSON.parse(await readFile(new URL("package.json", APP), "utf8"));
  assert.equal(packageJson.scripts.test, "node --test");
  assert.equal(packageJson.scripts["check:release"], "node scripts/check-release.js");
  assert.match(packageJson.scripts.check, /npm test/);
  assert.match(packageJson.scripts.check, /check:syntax/);
  assert.match(packageJson.scripts.check, /check:release/);
  assert.equal(packageJson.scripts["check:syntax"], "node scripts/check-syntax.js");
  const syntaxChecker = await readFile(new URL("scripts/check-syntax.js", APP), "utf8");
  assert.match(syntaxChecker, /extension/);
  const checker = await readFile(new URL("scripts/check-release.js", APP), "utf8");
  assert.match(checker, /Release check passed/);
});

test("release checker validates tracked sources without rejecting ignored local files", async () => {
  const script = new URL("scripts/check-release.js", APP);
  const { stdout, stderr } = await execFileAsync(process.execPath, [script.pathname], { cwd: APP });
  assert.equal(stderr, "");
  assert.match(stdout, /Release check passed/);
});

test("extension ZIP is deterministic, complete, and free of local configuration", async () => {
  const packageScript = new URL("scripts/package-extension.js", APP);
  await execFileAsync(process.execPath, [packageScript.pathname], { cwd: APP });
  const zipUrl = new URL("release/xiaohongshu-follower-counter-chrome-0.2.0.zip", APP);
  const first = await readFile(zipUrl);
  assert.deepEqual(first.subarray(0, 4), Buffer.from("504b0304", "hex"));
  const entries = parseCentralDirectory(first);
  const expected = await walkFiles(new URL("extension/", APP));
  assert.deepEqual(entries.map((entry) => entry.name), expected);
  assert.ok(entries.every((entry) => entry.method === 0));
  assert.ok(entries.every((entry) => entry.dosTime === 0 && entry.dosDate === 33));
  assert.ok(entries.every((entry) => !entry.name.includes(".DS_Store") && !entry.name.startsWith("bridge/")));

  const firstHash = sha256(first);
  await execFileAsync(process.execPath, [packageScript.pathname], { cwd: APP });
  const second = await readFile(zipUrl);
  assert.equal(sha256(second), firstHash);
  const sums = await readFile(new URL("release/SHA256SUMS", APP), "utf8");
  assert.equal(sums, `${firstHash}  xiaohongshu-follower-counter-chrome-0.2.0.zip\n`);
  assert.doesNotMatch(second.toString("latin1"), /XHS_BRIDGE_TOKEN|127\.0\.0\.1:17321|10\.10\.|\/user\/profile\/[0-9a-f]{20,}/i);
});

async function walkFiles(root, current = root) {
  const names = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, current);
    if (entry.isDirectory()) names.push(...await walkFiles(root, url));
    else if (entry.isFile()) names.push(relative(root.pathname, url.pathname).replaceAll("\\", "/"));
  }
  return names.sort();
}

function parseCentralDirectory(zip) {
  const eocd = zip.lastIndexOf(Buffer.from("504b0506", "hex"));
  assert.notEqual(eocd, -1, "ZIP must contain EOCD");
  const count = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    assert.equal(zip.readUInt32LE(offset), 0x02014b50);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    entries.push({
      name: zip.toString("utf8", offset + 46, offset + 46 + nameLength),
      method: zip.readUInt16LE(offset + 10),
      dosTime: zip.readUInt16LE(offset + 12),
      dosDate: zip.readUInt16LE(offset + 14),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
