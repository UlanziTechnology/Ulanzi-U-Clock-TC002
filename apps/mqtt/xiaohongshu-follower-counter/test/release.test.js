// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

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
