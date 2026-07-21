// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const BLUEPRINT = new URL("../blueprint.yaml", import.meta.url);

test("Blueprint relays only allowlisted device prefixes to the fixed Custom App", async () => {
  const source = await readFile(BLUEPRINT, "utf8");
  assert.match(source, /domain:\s*automation/);
  assert.match(source, /source_url:\s*https:\/\/github\.com\/UlanziTechnology\/Ulanzi-U-Clock-TC002\/blob\/main\/apps\/mqtt\/xiaohongshu-follower-counter\/blueprint\.yaml/);
  for (const input of ["webhook_id", "allowed_device_prefixes", "app_name"]) {
    assert.match(source, new RegExp(`^    ${input}:`, "m"));
  }
  assert.match(source, /platform:\s*webhook/);
  assert.match(source, /allowed_methods:\s*\[POST\]/);
  assert.match(source, /local_only:\s*true/);
  assert.match(source, /trigger\.json\.devicePrefix\s+in\s+allowed/);
  assert.match(source, /topic:\s*["']\{\{ trigger\.json\.devicePrefix \}\}\/custom\/\{\{ app_name \}\}["']/);
  assert.match(source, /service:\s*mqtt\.publish/);
  assert.match(source, /qos:\s*0/);
  assert.match(source, /retain:\s*true/);
  assert.match(source, /mode:\s*queued/);
  assert.match(source, /^max:\s*\d+/m);
  assert.doesNotMatch(source, /trigger\.json\.topic/);
  assert.doesNotMatch(source, /mqtt_(?:name|pwd)|username:|password:/i);
});

test("Blueprint bounds payload and validates the configured app name", async () => {
  const source = await readFile(BLUEPRINT, "utf8");
  assert.match(source, /trigger\.json\.payload\s+is\s+string/);
  assert.match(source, /trigger\.json\.payload\s*\|\s*length\s*<=\s*200000/);
  assert.match(source, /namespace\(valid=true\)/);
  assert.match(source, /ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-/);
  assert.match(source, /app_name\s*\|\s*length\s*<=\s*64/);
});
