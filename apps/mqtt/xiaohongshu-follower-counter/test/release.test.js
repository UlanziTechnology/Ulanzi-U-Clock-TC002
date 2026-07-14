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

test("environment template exposes every machine-specific bridge value", async () => {
  const example = await readFile(new URL(".env.example", APP), "utf8");
  for (const name of [
    "XHS_BRIDGE_TOKEN",
    "XHS_BRIDGE_PORT",
    "MQTT_HOST",
    "MQTT_PORT",
    "MQTT_USERNAME",
    "MQTT_PASSWORD",
    "MQTT_TLS",
    "MQTT_ALLOW_SELF_SIGNED",
    "MQTT_CLIENT_ID",
    "TC002_MQTT_TOPIC",
  ]) {
    assert.match(example, new RegExp(`^${name}=`, "m"), `.env.example should expose ${name}`);
  }
  assert.match(example, /replace-with-your-tc002-custom-app-topic/);
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
  const checker = await readFile(new URL("scripts/check-release.js", APP), "utf8");
  assert.match(checker, /Release check passed/);
});

test("release checker validates tracked sources without rejecting ignored local files", async () => {
  const script = new URL("scripts/check-release.js", APP);
  const { stdout, stderr } = await execFileAsync(process.execPath, [script.pathname], { cwd: APP });
  assert.equal(stderr, "");
  assert.match(stdout, /Release check passed/);
});
