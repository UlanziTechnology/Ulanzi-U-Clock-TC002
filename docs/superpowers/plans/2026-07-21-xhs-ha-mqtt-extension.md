# TC002 Xiaohongshu Chrome + Home Assistant MQTT Implementation Plan

> **Execution note:** Execute this plan task-by-task in the current session with `superpowers:executing-plans`. Use `superpowers:subagent-driven-development` only if the user explicitly requests subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the local Node Bridge with a packaged Chrome MV3 extension that discovers TC002 devices and posts rendered follower-count payloads to one allowlisted Home Assistant MQTT Blueprint.

**Architecture:** The extension service worker owns device discovery, deterministic 52×16 PNG rendering, per-device caching, and Home Assistant Webhook delivery. One Home Assistant Blueprint instance accepts a shared local-only Webhook, validates each discovered TC002 prefix against a multiline allowlist, fixes the Custom App name from Blueprint input, and performs retained QoS 0 `mqtt.publish` calls.

**Tech Stack:** Chrome Manifest V3, browser/Node ES modules, `CompressionStream("deflate")`, `Uint8Array`, Home Assistant automation Blueprint YAML, `node:test`, dependency-free Node.js 20+ release tooling, Git/GitHub.

## Global Constraints

- The extension never connects directly to MQTT TCP or WebSocket.
- The extension never stores or forwards MQTT username/password values returned by `/getMqttConfig`.
- Home Assistant access uses a random local-only Webhook ID, never a long-lived HA Bearer token.
- One Blueprint instance supports multiple explicitly allowlisted `devicePrefix` values and one shared `app_name`.
- The Blueprint constructs `<devicePrefix>/custom/<appName>`; the extension cannot submit an arbitrary MQTT topic or app name.
- Existing profile/device bindings and refresh seconds migrate in place; obsolete Bridge URL/token storage is removed.
- Existing exact Logo, numeric, `.`, `K`, and `M` pixel matrices and 52×16 layout remain byte-observable behavior.
- Extension JavaScript contains no `node:` imports, remote-hosted code, fixed machine IPs, concrete profile IDs, MQTT credentials, or fixed extension IDs.
- The deliverable includes extension source, a deterministic ZIP, SHA-256 checksum, Chrome developer-mode instructions, `blueprint.yaml`, and a Home Assistant My import link.
- All source and release artifacts remain GPL-3.0-or-later compatible.

---

## File Structure

### Browser runtime

- `extension/png.js`: browser-compatible RGB PNG encoder and CRC32/chunk helpers.
- `extension/render.js`: fixed matrices, count formatting, PNG rendering, and TC002 payload construction.
- `extension/device-discovery.js`: private-IP validation, `/getBase` and `/getMqttConfig` fetches, response validation, prefix derivation, and TTL cache.
- `extension/ha-config.js`: HA URL/Webhook normalization, legacy Bridge setting migration, and exact origins required for runtime permissions.
- `extension/ha-webhook.js`: bounded POST of one rendered device update to Home Assistant.
- `extension/service-worker.js`: refresh scheduling, profile targeting, discovery/render/webhook orchestration, and per-device results.
- `extension/options.js` / `extension/options.html`: HA/Webhook and device binding configuration plus runtime permission requests.
- `extension/manifest.json`: MV3 permissions and version.

### Home Assistant and release

- `blueprint.yaml`: local-only multi-device Webhook relay to `mqtt.publish`.
- `scripts/package-extension.js`: deterministic ZIP writer and SHA-256 generator.
- `release/xiaohongshu-follower-counter-chrome-0.2.0.zip`: installable source archive for developer mode.
- `release/SHA256SUMS`: checksum for the ZIP.
- `docs/QUICKSTART.md`: concise Chrome + HA installation path.
- `docs/README.md`, `README.md`, `docs/PR.md`, `preview/README.md`: complete user, troubleshooting, evidence, and upstream PR documentation.

### Removed Bridge runtime

- Delete `.env.example` and `bridge/` after their validated discovery/render behavior has moved into `extension/`.
- Delete Bridge-only tests `config.test.js`, `mqtt.test.js`, and `server.test.js`; replace `device-discovery.test.js`, `render.test.js`, and `e2e.test.js` with browser-runtime coverage.

---

### Task 1: Make PNG and pixel rendering browser-compatible

**Files:**
- Create: `apps/mqtt/xiaohongshu-follower-counter/extension/png.js`
- Create: `apps/mqtt/xiaohongshu-follower-counter/extension/render.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/test/render.test.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/bridge/render-preview.js` temporarily, before Task 6 moves it

**Interfaces:**
- Produces: `encodeRgbPng(width: number, height: number, pixels: Uint8Array) -> Promise<Uint8Array>`.
- Produces: `renderFollowerPng(snapshot: object) -> Promise<Uint8Array>`.
- Produces: `buildCustomAppPayload(snapshot: object, duration?: number) -> Promise<object>`.
- Produces: `formatCount(value: unknown) -> string` and `getFollowerGlyph(size: "small" | "large", character: string) -> string[]`.

- [ ] **Step 1: Point renderer tests at the browser module and await output**

Change imports from `../bridge/render.js` to `../extension/render.js`, then update each call:

```js
const png = await renderFollowerPng(SNAPSHOT);
const payload = await buildCustomAppPayload(SNAPSHOT);
const image = decodeRgbPng(await renderFollowerPng({ ...SNAPSHOT, followerCount: 18 }));
```

Keep every existing matrix constant and pixel assertion unchanged. Add a source assertion that both extension files contain no `node:` imports and no `Buffer` reference.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd apps/mqtt/xiaohongshu-follower-counter
node --test test/render.test.js
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `extension/render.js`.

- [ ] **Step 3: Implement a browser-compatible PNG encoder**

Implement `extension/png.js` around these exact interfaces:

```js
export async function encodeRgbPng(width, height, pixels) {
  validateRgbInput(width, height, pixels);
  const scanlines = addFilterBytes(width, height, pixels);
  const compressed = new Uint8Array(
    await new Response(
      new Blob([scanlines]).stream().pipeThrough(new CompressionStream("deflate")),
    ).arrayBuffer(),
  );
  return concatBytes(
    Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
    pngChunk("IHDR", ihdr(width, height)),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", new Uint8Array()),
  );
}
```

Implement local `crc32`, big-endian integer encoding, chunk concatenation, and scanline filter byte `0`. Reject non-positive dimensions, non-`Uint8Array` pixels, or an RGB byte length other than `width * height * 3`.

- [ ] **Step 4: Port the exact renderer without visual changes**

Copy the validated constants and drawing behavior from `bridge/render.js` into `extension/render.js`. Replace Buffer Base64 conversion with a dependency-free byte encoder:

```js
function bytesToBase64(bytes) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  // Encode three-byte groups and RFC 4648 padding without btoa size limits.
}

export async function buildCustomAppPayload(snapshot, duration = 31_536_000) {
  const png = await renderFollowerPng(snapshot);
  return {
    duration,
    text: [],
    image: [{ data: `data:image/png;base64,${bytesToBase64(png)}`, position: [0, 0] }],
    draw: [],
  };
}
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run `node --test test/render.test.js`.

Expected: all renderer tests pass, including 52×16 PNG decoding and all fixed matrices.

- [ ] **Step 6: Commit the browser renderer**

```bash
git add apps/mqtt/xiaohongshu-follower-counter/extension/png.js \
  apps/mqtt/xiaohongshu-follower-counter/extension/render.js \
  apps/mqtt/xiaohongshu-follower-counter/test/render.test.js
git commit -m "feat: render TC002 payloads in Chrome"
```

---

### Task 2: Move TC002 discovery into the extension

**Files:**
- Create: `apps/mqtt/xiaohongshu-follower-counter/extension/device-discovery.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/test/device-discovery.test.js`

**Interfaces:**
- Consumes: bound RFC1918 `deviceIp`.
- Produces: `discoverDevice(deviceIp, { fetchImpl?, timeoutMs? }) -> Promise<{ deviceIp, mac, devicePrefix, mqttBroker }>`.
- Produces: `createDeviceResolver({ discover?, ttlMs?, now? }) -> { resolve, clear }`.
- `mqttBroker` contains only `{ host, port }`; no credential fields are returned.

- [ ] **Step 1: Replace Node HTTP tests with fetch-based failing tests**

Use a deterministic fake fetch keyed by pathname:

```js
const fetchImpl = async (url) => {
  const { pathname } = new URL(url);
  if (pathname === "/getBase") {
    return Response.json({ ip: "10.10.21.210", mac: "ccc4b2441bd9", model: "TC002" });
  }
  if (pathname === "/getMqttConfig") {
    return Response.json({
      isMqtt: true,
      ip: "10.10.20.185",
      port: 1883,
      mqtt_prefix: "ulanzi",
      mqtt_name: "must-not-leave-discovery",
      mqtt_pwd: "must-not-leave-discovery",
    });
  }
  return new Response(null, { status: 404 });
};
```

Assert the result equals:

```js
{
  deviceIp: "10.10.21.210",
  mac: "ccc4b2441bd9",
  devicePrefix: "ulanzi_1bd9",
  mqttBroker: { host: "10.10.20.185", port: 1883 },
}
```

Also retain tests for RFC1918 validation, returned-IP mismatch, non-TC002 model, bad MAC, disabled MQTT, invalid broker, cache TTL, forced refresh, and independent cache eviction.

- [ ] **Step 2: Run the focused test and verify RED**

Run `node --test test/device-discovery.test.js`.

Expected: FAIL because `extension/device-discovery.js` does not exist.

- [ ] **Step 3: Implement bounded browser fetch discovery**

Implement:

```js
export async function discoverDevice(deviceIp, {
  fetchImpl = fetch,
  timeoutMs = 3000,
} = {}) {
  const normalizedIp = normalizePrivateIpv4(deviceIp);
  const [base, mqtt] = await Promise.all([
    fetchDeviceJson(normalizedIp, "/getBase", fetchImpl, timeoutMs),
    fetchDeviceJson(normalizedIp, "/getMqttConfig", fetchImpl, timeoutMs),
  ]);
  const mac = normalizeBase(base, normalizedIp);
  const normalizedMqtt = normalizeMqtt(mqtt);
  return {
    deviceIp: normalizedIp,
    mac,
    devicePrefix: `${normalizedMqtt.prefix}_${mac.slice(-4)}`,
    mqttBroker: { host: normalizedMqtt.host, port: normalizedMqtt.port },
  };
}
```

Use `AbortController`, a timeout handle, `response.ok`, `response.json()`, and an 8 KiB `Content-Length` precheck when present. Validate credential types if returned, then discard the values before returning.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run `node --test test/device-discovery.test.js`.

Expected: all device discovery and cache tests pass.

- [ ] **Step 5: Commit browser discovery**

```bash
git add apps/mqtt/xiaohongshu-follower-counter/extension/device-discovery.js \
  apps/mqtt/xiaohongshu-follower-counter/test/device-discovery.test.js
git commit -m "feat: discover TC002 devices in Chrome"
```

---

### Task 3: Add Home Assistant configuration and Webhook delivery

**Files:**
- Create: `apps/mqtt/xiaohongshu-follower-counter/extension/ha-config.js`
- Create: `apps/mqtt/xiaohongshu-follower-counter/extension/ha-webhook.js`
- Create: `apps/mqtt/xiaohongshu-follower-counter/test/ha-config.test.js`
- Create: `apps/mqtt/xiaohongshu-follower-counter/test/ha-webhook.test.js`

**Interfaces:**
- Produces: `normalizeHomeAssistantUrl(value) -> string` without trailing slash.
- Produces: `normalizeWebhookId(value) -> string` accepting 24–128 URL-safe characters.
- Produces: `webhookEndpoint(baseUrl, webhookId) -> string`.
- Produces: `requiredOrigins(baseUrl, bindings) -> string[]` containing exact HA and device origins.
- Produces: `migrateHomeAssistantConfig(storage) -> Promise<{ homeAssistantUrl, webhookId }>` and removes `bridgeUrl`/`bridgeToken`.
- Produces: `postFollowerPayload(config, update, { fetchImpl?, timeoutMs? }) -> Promise<void>`.

- [ ] **Step 1: Write failing normalization and migration tests**

Cover:

```js
assert.equal(normalizeHomeAssistantUrl("http://10.10.20.10:8123/"), "http://10.10.20.10:8123");
assert.equal(normalizeWebhookId("a".repeat(32)), "a".repeat(32));
assert.deepEqual(requiredOrigins("http://10.10.20.10:8123", [
  { deviceIp: "10.10.20.181", profileUrl: PROFILE },
]), ["http://10.10.20.10/*", "http://10.10.20.181/*"]);
```

Reject non-HTTP(S) HA URLs, embedded credentials, query/hash, non-RFC1918 plain-HTTP HA hosts other than localhost, and short/unsafe Webhook IDs. Assert migration removes `bridgeUrl` and `bridgeToken` without changing bindings or refresh seconds.

- [ ] **Step 2: Run config tests and verify RED**

Run `node --test test/ha-config.test.js`.

Expected: FAIL with missing module.

- [ ] **Step 3: Implement HA configuration helpers**

Use URL parsing and return only normalized values. Convert URL origins to Chrome match patterns by dropping ports because extension host match patterns are origin-scheme/host based:

```js
function permissionPattern(url) {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.hostname}/*`;
}
```

Migration must execute:

```js
await storage.remove(["bridgeUrl", "bridgeToken"]);
```

only after reading any existing HA fields, and must be idempotent.

- [ ] **Step 4: Write a failing Webhook body and secret-safety test**

Call `postFollowerPayload` with a fake fetch and assert:

- URL is `/api/webhook/<encoded-id>`;
- method is `POST` and content type is JSON;
- body contains `devicePrefix`, canonical snapshot fields, and serialized `payload`;
- body contains no `topic`, `appName`, `mqttBroker`, `mqtt_name`, `mqtt_pwd`, `username`, or `password` key;
- non-2xx, abort, and invalid update values produce stable `webhook_rejected`, `ha_unreachable`, or `invalid_webhook_payload` errors.

- [ ] **Step 5: Run Webhook tests and verify RED**

Run `node --test test/ha-webhook.test.js`.

Expected: FAIL with missing module.

- [ ] **Step 6: Implement bounded Webhook delivery**

Implement the exact update shape:

```js
const body = {
  devicePrefix: update.devicePrefix,
  profileUrl: update.snapshot.profileUrl,
  displayName: update.snapshot.displayName,
  followerCount: update.snapshot.followerCount,
  observedAt: update.snapshot.observedAt,
  payload: JSON.stringify(update.customAppPayload),
};
```

Use a 10-second AbortController timeout. Accept any 2xx response, never parse response HTML, and never include the Webhook ID in thrown errors.

- [ ] **Step 7: Run both test files and verify GREEN**

Run `node --test test/ha-config.test.js test/ha-webhook.test.js`.

Expected: all tests pass.

- [ ] **Step 8: Commit HA client modules**

```bash
git add apps/mqtt/xiaohongshu-follower-counter/extension/ha-config.js \
  apps/mqtt/xiaohongshu-follower-counter/extension/ha-webhook.js \
  apps/mqtt/xiaohongshu-follower-counter/test/ha-config.test.js \
  apps/mqtt/xiaohongshu-follower-counter/test/ha-webhook.test.js
git commit -m "feat: relay follower payloads through Home Assistant"
```

---

### Task 4: Replace Bridge settings and orchestration in the MV3 extension

**Files:**
- Modify: `apps/mqtt/xiaohongshu-follower-counter/extension/manifest.json`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/extension/options.html`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/extension/options.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/extension/service-worker.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/test/extension.test.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/test/bindings-config.test.js`

**Interfaces:**
- Consumes: Task 1 renderer, Task 2 resolver, Task 3 HA config/Webhook client.
- Produces: end-user MV3 runtime without localhost Bridge dependencies.

- [ ] **Step 1: Rewrite extension static tests for the new UI and permissions**

Require Manifest version `0.2.0`, existing static Xiaohongshu host permissions, and:

```js
assert.deepEqual(manifest.optional_host_permissions.sort(), ["http://*/*", "https://*/*"]);
assert.ok(!manifest.host_permissions.some((host) => host.includes("127.0.0.1")));
```

Require option IDs `homeAssistantUrl`, `webhookId`, `bindings`, `refreshSeconds`, `lastResult`; prohibit `bridgeUrl`, `bridgeToken`, `XHS_BRIDGE_TOKEN`, and `Authorization: Bearer`. Require calls to `chrome.permissions.contains` and `chrome.permissions.request`.

Require service-worker imports for `device-discovery.js`, `render.js`, and `ha-webhook.js`, plus `Promise.allSettled`, `lastResults`, and no `127.0.0.1` or `/v1/follower-count`.

- [ ] **Step 2: Run extension tests and verify RED**

Run `node --test test/extension.test.js test/bindings-config.test.js`.

Expected: FAIL on old Bridge UI, permissions, and service-worker source.

- [ ] **Step 3: Update Manifest V3 permissions and version**

Set:

```json
{
  "version": "0.2.0",
  "permissions": ["storage", "alarms"],
  "host_permissions": [
    "https://www.xiaohongshu.com/*",
    "https://xiaohongshu.com/*"
  ],
  "optional_host_permissions": ["http://*/*", "https://*/*"]
}
```

Keep the module service worker, content script matches, and tested extractor resource.

- [ ] **Step 4: Replace Bridge controls with HA controls**

In `options.html`, add URL input `homeAssistantUrl`, password input `webhookId`, an explanation of local-only HA Webhooks, and a permission status area. Preserve binding rows and refresh controls.

In `options.js`, normalize values with Task 3 helpers, request only `requiredOrigins(...)`, save only after permission succeeds, remove legacy Bridge fields, and display per-device discovered prefix/result without using `innerHTML`.

- [ ] **Step 5: Replace Bridge POST orchestration in the service worker**

Create one resolver at module scope:

```js
const deviceResolver = createDeviceResolver();
```

For each target binding execute:

```js
const device = await deviceResolver.resolve(deviceIp);
const customAppPayload = await buildCustomAppPayload(snapshot);
await postFollowerPayload(
  { homeAssistantUrl: config.homeAssistantUrl, webhookId: config.webhookId },
  { devicePrefix: device.devicePrefix, snapshot, customAppPayload },
);
```

Record `devicePrefix`, `displayName`, `followerCount`, `observedAt`, and `ok` per device. On discovery or HA failure, clear only that device resolver entry. Continue closing managed tabs exactly as before.

- [ ] **Step 6: Run extension tests and verify GREEN**

Run `node --test test/extension.test.js test/bindings-config.test.js`.

Expected: all extension configuration/source-contract tests pass.

- [ ] **Step 7: Commit the MV3 migration**

```bash
git add apps/mqtt/xiaohongshu-follower-counter/extension \
  apps/mqtt/xiaohongshu-follower-counter/test/extension.test.js \
  apps/mqtt/xiaohongshu-follower-counter/test/bindings-config.test.js
git commit -m "feat: remove the local Bridge from the extension"
```

---

### Task 5: Add the multi-device Home Assistant MQTT Blueprint

**Files:**
- Create: `apps/mqtt/xiaohongshu-follower-counter/blueprint.yaml`
- Create: `apps/mqtt/xiaohongshu-follower-counter/test/blueprint.test.js`

**Interfaces:**
- Consumes: Webhook JSON `{ devicePrefix, profileUrl, displayName, followerCount, observedAt, payload }`.
- Produces: retained QoS 0 MQTT message on `<devicePrefix>/custom/<app_name>`.

- [ ] **Step 1: Write a failing static Blueprint contract test**

Assert the YAML source contains:

- `domain: automation` and the exact upstream `source_url`;
- inputs `webhook_id`, `allowed_device_prefixes`, and `app_name`;
- `platform: webhook`, `allowed_methods` containing `POST`, and `local_only: true`;
- `mode: queued` and a finite `max`;
- exact allowlist membership using `trigger.json.devicePrefix`;
- topic template `{{ trigger.json.devicePrefix }}/custom/{{ app_name }}`;
- `service: mqtt.publish`, `qos: 0`, and `retain: true`;
- no topic taken from `trigger.json`, no MQTT credentials, and no fixed device suffix.

- [ ] **Step 2: Run the Blueprint test and verify RED**

Run `node --test test/blueprint.test.js`.

Expected: FAIL because `blueprint.yaml` does not exist.

- [ ] **Step 3: Implement the Blueprint**

Use this structure:

```yaml
blueprint:
  name: TC002 小红书粉丝数（Chrome + Home Assistant）
  domain: automation
  source_url: https://github.com/UlanziTechnology/Ulanzi-U-Clock-TC002/blob/main/apps/mqtt/xiaohongshu-follower-counter/blueprint.yaml
  input:
    webhook_id:
      name: Webhook ID
      selector:
        text: {}
    allowed_device_prefixes:
      name: 允许的 TC002 设备前缀
      description: 每行一个，例如 ulanzi_1be3
      selector:
        text:
          multiline: true
    app_name:
      name: Custom App 名称
      default: xiaohongshu_followers
      selector:
        text: {}

variables:
  allowed_prefixes_text: !input allowed_device_prefixes
  app_name: !input app_name

trigger:
  - platform: webhook
    webhook_id: !input webhook_id
    allowed_methods: [POST]
    local_only: true

condition:
  - condition: template
    value_template: >-
      {% set allowed = allowed_prefixes_text.splitlines()
        | map('trim') | reject('equalto', '') | list %}
      {{ trigger.json is mapping
        and trigger.json.devicePrefix is string
        and trigger.json.devicePrefix in allowed
        and trigger.json.payload is string
        and trigger.json.payload | length <= 200000
        and app_name | length >= 1
        and app_name | length <= 64 }}

action:
  - service: mqtt.publish
    data:
      topic: "{{ trigger.json.devicePrefix }}/custom/{{ app_name }}"
      payload: "{{ trigger.json.payload }}"
      qos: 0
      retain: true

mode: queued
max: 20
```

Add a second condition that rejects an app name containing characters outside ASCII letters, digits, `_`, and `-`, using a bounded Jinja namespace loop rather than relying on an unavailable regex filter.

- [ ] **Step 4: Validate with Home Assistant-compatible YAML parsing and tests**

Run `node --test test/blueprint.test.js` and, if `ha core check` is available in the configured HA environment, import the Blueprint and run configuration validation. The repository test must pass even when HA CLI is unavailable.

- [ ] **Step 5: Commit the Blueprint**

```bash
git add apps/mqtt/xiaohongshu-follower-counter/blueprint.yaml \
  apps/mqtt/xiaohongshu-follower-counter/test/blueprint.test.js
git commit -m "feat: add multi-device Home Assistant MQTT blueprint"
```

---

### Task 6: Replace Bridge E2E coverage and remove Bridge files

**Files:**
- Modify: `apps/mqtt/xiaohongshu-follower-counter/test/e2e.test.js`
- Delete: `apps/mqtt/xiaohongshu-follower-counter/bridge/`
- Delete: `apps/mqtt/xiaohongshu-follower-counter/.env.example`
- Delete: `apps/mqtt/xiaohongshu-follower-counter/test/config.test.js`
- Delete: `apps/mqtt/xiaohongshu-follower-counter/test/mqtt.test.js`
- Delete: `apps/mqtt/xiaohongshu-follower-counter/test/server.test.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/package.json`

**Interfaces:**
- Consumes: Tasks 1–4 browser modules.
- Produces: real HTTP E2E proof from fake TC002 APIs to fake HA Webhook, with no MQTT socket or Bridge process.

- [ ] **Step 1: Write the replacement failing E2E test**

Start two loopback HTTP servers:

- fake TC002 responds to `/getBase` and `/getMqttConfig`;
- fake HA records `/api/webhook/<id>` JSON.

Call exported discovery, render, and Webhook functions directly with URL/fetch injection. Assert the HA request contains `devicePrefix: "ulanzi_1bd9"`, follower count `12800`, and a serialized payload containing `data:image/png;base64,iVBOR`. Assert the recorded body contains neither MQTT credentials nor a `topic` field.

- [ ] **Step 2: Run E2E and verify RED**

Run `node --test test/e2e.test.js`.

Expected: FAIL because the existing test still expects a Bridge and raw MQTT socket.

- [ ] **Step 3: Implement URL injection needed by E2E without weakening production validation**

Allow `discoverDevice` to accept a test-only `deviceBaseUrl` option whose default remains `http://${normalizedIp}`; expose no storage/config path for overriding it in production. Allow Webhook tests to pass a normalized loopback HA URL.

- [ ] **Step 4: Run E2E and verify GREEN**

Run `node --test test/e2e.test.js`.

Expected: the fake HA server receives exactly one valid body and the test passes.

- [ ] **Step 5: Remove Bridge runtime and update package scripts**

Delete Bridge-only files/tests. Set package and manifest version to `0.2.0`. Replace scripts with:

```json
{
  "preview": "node scripts/render-preview.js",
  "package:extension": "node scripts/package-extension.js",
  "test": "node --test",
  "check:syntax": "node scripts/check-syntax.js",
  "check:release": "node scripts/check-release.js",
  "check": "npm test && npm run check:syntax && npm run check:release"
}
```

Move preview generation into `scripts/render-preview.js` and make it await the Task 1 renderer.

- [ ] **Step 6: Run all tests and verify obsolete references are absent**

Run:

```bash
npm test
rg -n "XHS_BRIDGE|bridgeUrl|bridgeToken|127\.0\.0\.1:17321|/v1/follower-count|node:net|node:http" .
```

Expected: tests pass; `rg` finds no runtime or user-documentation Bridge references outside migration tests and historical design documents.

- [ ] **Step 7: Commit Bridge removal**

```bash
git add -A apps/mqtt/xiaohongshu-follower-counter
git commit -m "refactor: remove the local XHS Bridge"
```

---

### Task 7: Add deterministic extension ZIP packaging

**Files:**
- Create: `apps/mqtt/xiaohongshu-follower-counter/scripts/package-extension.js`
- Create: `apps/mqtt/xiaohongshu-follower-counter/scripts/check-syntax.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/scripts/check-release.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/test/release.test.js`
- Generate: `apps/mqtt/xiaohongshu-follower-counter/release/xiaohongshu-follower-counter-chrome-0.2.0.zip`
- Generate: `apps/mqtt/xiaohongshu-follower-counter/release/SHA256SUMS`

**Interfaces:**
- Produces: deterministic ZIP containing `manifest.json`, HTML, and all extension JS modules at archive root.
- Produces: lowercase SHA-256 line `<hex>  xiaohongshu-follower-counter-chrome-0.2.0.zip`.

- [ ] **Step 1: Add failing release-package assertions**

Assert:

- ZIP begins with local header signature `PK\x03\x04`;
- central directory contains every file returned by a recursive sorted walk of `extension/` and no `.DS_Store`;
- all entry timestamps equal `1980-01-01 00:00:00`;
- rebuilding twice produces identical SHA-256;
- `SHA256SUMS` matches the generated bytes;
- ZIP contains no Bridge modules, `.env`, tests, concrete device/profile values, or Webhook ID.

- [ ] **Step 2: Run release tests and verify RED**

Run `node --test test/release.test.js`.

Expected: FAIL because the package script and release artifacts do not exist.

- [ ] **Step 3: Implement a dependency-free ZIP store writer**

In `package-extension.js`, recursively enumerate extension regular files in POSIX lexical order. Implement ZIP method 0 with local headers, central directory records, EOCD, CRC32, fixed DOS date/time, and UTF-8 names. Never invoke platform `zip`, Python, or npm dependencies.

Write to a temporary file in `release/`, atomically rename to the versioned ZIP, compute SHA-256 with `node:crypto`, and write `SHA256SUMS`.

- [ ] **Step 4: Implement syntax discovery instead of a hard-coded file list**

`check-syntax.js` must recursively locate `.js` files under `extension/` and `scripts/`, sort them, and call `node --check` using `execFileSync(process.execPath, ["--check", path])`. This prevents new runtime modules from escaping syntax checks.

- [ ] **Step 5: Update release scanning**

Teach `check-release.js` to validate:

- package/manifest/ZIP version equality;
- `blueprint.yaml` and required docs exist;
- forbidden secret/profile/IP patterns in text files;
- generated ZIP and checksum are current by running the packager and comparing bytes;
- binary ZIP is exempt from UTF-8 text scanning but inspected through its entry list.

- [ ] **Step 6: Generate twice and verify GREEN**

Run:

```bash
npm run package:extension
shasum -a 256 release/xiaohongshu-follower-counter-chrome-0.2.0.zip
npm run package:extension
npm run check:release
node --test test/release.test.js
```

Expected: both SHA-256 values are identical and all release tests pass.

- [ ] **Step 7: Commit packaging and release artifacts**

```bash
git add apps/mqtt/xiaohongshu-follower-counter/scripts \
  apps/mqtt/xiaohongshu-follower-counter/release \
  apps/mqtt/xiaohongshu-follower-counter/test/release.test.js \
  apps/mqtt/xiaohongshu-follower-counter/package.json
git commit -m "build: package the Chrome extension deterministically"
```

---

### Task 8: Rewrite installation, privacy, and troubleshooting documentation

**Files:**
- Modify: `apps/mqtt/xiaohongshu-follower-counter/README.md`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/docs/README.md`
- Create: `apps/mqtt/xiaohongshu-follower-counter/docs/QUICKSTART.md`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/docs/PR.md`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/preview/README.md`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/test/docs.test.js`

**Interfaces:**
- Produces: complete install path for extension ZIP and one-click/manual Blueprint import.

- [ ] **Step 1: Rewrite docs tests first**

Require documentation to contain:

- extension ZIP relative link and SHA-256 verification commands for macOS/Linux and PowerShell;
- Chrome developer-mode installation and upgrade steps;
- Home Assistant MQTT integration prerequisite;
- My Blueprint import URL encoding the upstream `blueprint.yaml` URL;
- manual Blueprint import URL;
- Webhook ID generation and secret handling;
- multiline allowed prefix examples `ulanzi_1be3` and `ulanzi_1bd9` marked as examples;
- fixed topic formula `<devicePrefix>/custom/<appName>`;
- HA automation trace and broker retained-topic evidence steps;
- statement that HTTP 2xx means HA accepted the Webhook, not that TC002 displayed;
- privacy statement excluding cookies, MQTT credentials, and HA tokens;
- no Bridge startup or `XHS_BRIDGE_TOKEN` instructions.

- [ ] **Step 2: Run docs tests and verify RED**

Run `node --test test/docs.test.js`.

Expected: FAIL on existing Bridge instructions and missing Blueprint/ZIP instructions.

- [ ] **Step 3: Write QUICKSTART and root README**

The shortest successful flow must be:

1. configure HA MQTT against the same broker as TC002;
2. click the HA My Blueprint import button;
3. configure Webhook ID, allowed device prefixes, and `app_name`;
4. download, verify, unzip, and load the Chrome extension;
5. enter HA URL/Webhook ID and device/profile bindings;
6. grant exact LAN origins;
7. keep TC002 MQTT/DIY enabled and verify results.

- [ ] **Step 4: Rewrite detailed docs and PR text**

Document architecture, migration from version 0.1.0, configuration fields, payload schema, device discovery endpoints, security boundaries, per-error troubleshooting, multi-device behavior, Blueprint tracing, retained-topic inspection, test commands, and the lack of Chrome Web Store installation.

Update `docs/PR.md` to describe the HA architecture, files removed, automated test total, ZIP checksum, and exact manual evidence still required before merge.

- [ ] **Step 5: Run docs and release checks and verify GREEN**

Run:

```bash
node --test test/docs.test.js
npm run check:release
```

Expected: both pass with no Bridge installation language.

- [ ] **Step 6: Commit documentation**

```bash
git add apps/mqtt/xiaohongshu-follower-counter/README.md \
  apps/mqtt/xiaohongshu-follower-counter/docs \
  apps/mqtt/xiaohongshu-follower-counter/preview/README.md \
  apps/mqtt/xiaohongshu-follower-counter/test/docs.test.js
git commit -m "docs: add Chrome and Home Assistant installation"
```

---

### Task 9: Final automated and real-system verification

**Files:**
- Modify only if evidence requires: `apps/mqtt/xiaohongshu-follower-counter/docs/PR.md`
- Generate/update only through scripts: `apps/mqtt/xiaohongshu-follower-counter/preview/demo.png`, `release/*.zip`, `release/SHA256SUMS`

**Interfaces:**
- Produces: complete verification evidence and a clean Git branch ready for upstream publication.

- [ ] **Step 1: Run the complete project check from a clean artifact state**

Run:

```bash
cd apps/mqtt/xiaohongshu-follower-counter
npm run package:extension
npm run preview
npm run check
git diff --check
```

Expected: all tests, syntax checks, release checks, and whitespace checks exit `0`.

- [ ] **Step 2: Inspect extension ZIP contents and preview**

List the ZIP central directory and confirm archive-root `manifest.json`. Load the generated preview at original resolution and verify the exact Logo, two-pixel margins, 5×10 digits, and K/M matrices.

- [ ] **Step 3: Load the generated ZIP in Chrome**

Extract the release ZIP to a fresh temporary directory, load that directory in `chrome://extensions`, open options, and verify:

- no Bridge fields;
- HA URL and Webhook ID fields;
- multiple device/profile rows;
- exact runtime permission prompts for HA and TC002 origins;
- refresh alarm and page extraction still operate.

- [ ] **Step 4: Import and validate the Blueprint in Home Assistant**

Use the repository file URL before merge and the My link after merge. Configure one automation with the shared app name and both real device prefixes. Confirm the automation trace rejects a non-allowlisted prefix and accepts both configured prefixes.

- [ ] **Step 5: Verify MQTT and two TC002 devices**

Confirm HA MQTT uses the broker returned by both devices. Trigger different bound profiles for both devices and verify retained messages on:

```text
<firstDevicePrefix>/custom/<appName>
<secondDevicePrefix>/custom/<appName>
```

Confirm each TC002 displays its bound profile's follower count. Capture MQTT topic/payload evidence and real-device photo or GIF without exposing the Webhook ID or MQTT credentials.

- [ ] **Step 6: Record evidence and commit final generated changes**

Update `docs/PR.md` with exact test counts, ZIP SHA-256, tested Chrome/HA versions, topics with non-sensitive example suffixes, and the paths of real-device evidence.

```bash
git add apps/mqtt/xiaohongshu-follower-counter
git commit -m "test: verify Chrome HA MQTT delivery"
```

If generated files are already committed and evidence causes no tracked changes, do not create an empty commit.

---

### Task 10: Publish the upstream GitHub pull request

**Files:**
- No implementation files unless upstream rebasing requires conflict resolution.

**Interfaces:**
- Produces: pushed `codex/xhs-follower-local` branch and a ready-for-review upstream PR.

- [ ] **Step 1: Verify branch and remote state**

Run:

```bash
git status --short
git branch --show-current
git remote -v
git fetch origin main
git log --oneline origin/main..HEAD
```

Expected: clean worktree, branch `codex/xhs-follower-local`, and only intentional app/spec commits ahead of upstream.

- [ ] **Step 2: Integrate current upstream safely**

Rebase or merge `origin/main` according to repository policy, never discarding unrelated upstream changes. Re-run `npm run check` after conflict resolution.

- [ ] **Step 3: Push the feature branch**

```bash
git push -u origin codex/xhs-follower-local
```

If direct upstream branch creation is denied, add the authenticated user's fork as a remote, push the same branch there, and target the upstream repository from the fork.

- [ ] **Step 4: Create a non-draft PR**

Use the verified text in `docs/PR.md`. The PR must summarize the architecture, Blueprint security boundary, extension permissions, ZIP/checksum, automated verification, and real TC002 evidence. Target `UlanziTechnology/Ulanzi-U-Clock-TC002:main`.

- [ ] **Step 5: Verify checks and hand off**

Report PR URL, branch, commit, check state, exact ZIP path/checksum, Blueprint import link, and any reviewer-only manual steps. Do not claim merge or Chrome Web Store availability.
