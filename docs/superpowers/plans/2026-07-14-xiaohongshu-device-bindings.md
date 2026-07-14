# Xiaohongshu Dynamic TC002 Device Bindings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one Chrome extension bind multiple TC002 devices one-to-one with Xiaohongshu profiles, while the local Bridge discovers each device's MQTT configuration and publishes to its native `custom/display` topic without device-specific startup parameters.

**Architecture:** The extension stores canonical `{deviceIp, profileUrl}` bindings and adds the matching device IP to each local Bridge request. A focused Bridge discovery module validates RFC1918 addresses, reads `/getBase` and `/getMqttConfig`, derives `[prefix]_[mac4]/custom/display`, and caches the result for five minutes. The Bridge publishes independently per device and refreshes discovery once after a publish failure.

**Tech Stack:** Chrome Manifest V3 JavaScript, Node.js 20+ ESM, built-in `node:http`, built-in `node:test`, raw MQTT 3.1.1 client already in the repository.

## Global Constraints

- One TC002 device IP binds to exactly one Xiaohongshu profile; one extension may contain multiple bindings.
- Accept only RFC1918 IPv4 device addresses: `10.0.0.0/8`, `172.16.0.0/12`, and `192.168.0.0/16`.
- The native TC002 topic is always `[mqtt_prefix]_[MAC last four]/custom/display`.
- Device IP, broker, prefix, MAC suffix, and topic must not be hard-coded for a developer machine.
- The extension continues to send data only to `http://127.0.0.1`; it never receives MQTT credentials.
- The Bridge has no third-party runtime dependencies and must keep MQTT credentials out of logs and HTTP responses.
- A failure for one device must not prevent other bindings from refreshing or publishing.
- Keep a one-release legacy Bridge fallback when all old MQTT environment variables are explicitly supplied; a valid request `deviceIp` always wins.

---

### Task 1: Canonical Extension Binding Configuration

**Files:**
- Create: `apps/mqtt/xiaohongshu-follower-counter/extension/bindings-config.js`
- Create: `apps/mqtt/xiaohongshu-follower-counter/test/bindings-config.test.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/package.json`

**Interfaces:**
- Produces: `normalizePrivateIpv4(value: unknown): string`.
- Produces: `canonicalProfileUrl(value: unknown): string`.
- Produces: `normalizeBindings(value: unknown, {allowIncomplete?: boolean}): Array<{deviceIp: string, profileUrl: string}>`.
- Produces: `migrateBindings(storageArea): Promise<Array<{deviceIp: string, profileUrl: string}>>`.
- Migration consumes Chrome-compatible storage methods `get(defaults)`, `set(values)`, and `remove(key)`.

- [ ] **Step 1: Write failing validation and migration tests**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalProfileUrl,
  migrateBindings,
  normalizeBindings,
  normalizePrivateIpv4,
} from "../extension/bindings-config.js";

test("accepts only RFC1918 IPv4 device addresses", () => {
  assert.equal(normalizePrivateIpv4("10.10.21.210"), "10.10.21.210");
  assert.equal(normalizePrivateIpv4("172.16.0.1"), "172.16.0.1");
  assert.equal(normalizePrivateIpv4("192.168.1.8"), "192.168.1.8");
  for (const value of ["127.0.0.1", "169.254.1.2", "224.0.0.1", "8.8.8.8", "::1", "device.local", "10.0.0.1:1883"]) {
    assert.throws(() => normalizePrivateIpv4(value), /局域网 IPv4/);
  }
});

test("canonicalizes bindings and rejects duplicate device IPs", () => {
  assert.deepEqual(normalizeBindings([{
    deviceIp: "10.10.21.210",
    profileUrl: "https://www.xiaohongshu.com/user/profile/abc?xsec_token=temp#top",
  }]), [{
    deviceIp: "10.10.21.210",
    profileUrl: "https://www.xiaohongshu.com/user/profile/abc",
  }]);
  assert.throws(() => normalizeBindings([
    { deviceIp: "10.10.21.210", profileUrl: "https://www.xiaohongshu.com/user/profile/a" },
    { deviceIp: "10.10.21.210", profileUrl: "https://www.xiaohongshu.com/user/profile/b" },
  ]), /设备 IP 不能重复/);
});

test("migrates legacy profiles to incomplete bindings without guessing devices", async () => {
  const state = { profileUrls: ["https://www.xiaohongshu.com/user/profile/a"] };
  const storage = {
    async get(defaults) { return { ...defaults, ...state }; },
    async set(values) { Object.assign(state, values); },
    async remove(key) { delete state[key]; },
  };
  assert.deepEqual(await migrateBindings(storage), [{
    deviceIp: "",
    profileUrl: "https://www.xiaohongshu.com/user/profile/a",
  }]);
  assert.equal("profileUrls" in state, false);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test apps/mqtt/xiaohongshu-follower-counter/test/bindings-config.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `extension/bindings-config.js`.

- [ ] **Step 3: Implement the minimal binding module**

```javascript
export function normalizePrivateIpv4(value) {
  const input = String(value ?? "").trim();
  const parts = input.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) {
    throw new TypeError("设备 IP 必须是局域网 IPv4 地址");
  }
  const octets = parts.map(Number);
  const isPrivate = octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168);
  if (!isPrivate) throw new TypeError("设备 IP 必须是局域网 IPv4 地址");
  return octets.join(".");
}

export function canonicalProfileUrl(value) {
  const url = new URL(String(value ?? "").trim());
  if (url.protocol !== "https:" ||
      !["www.xiaohongshu.com", "xiaohongshu.com"].includes(url.hostname) ||
      !url.pathname.startsWith("/user/profile/")) {
    throw new TypeError("必须填写有效的小红书用户主页");
  }
  url.search = "";
  url.hash = "";
  return url.toString();
}
```

Add `normalizeBindings` with complete-row enforcement by default, `allowIncomplete` only for migration and rendering, duplicate-IP rejection, and canonical output. Add `migrateBindings` so existing `bindings` wins, legacy `profileUrls` becomes incomplete rows, the old key is removed, and already canonical storage is not rewritten.

- [ ] **Step 4: Run focused tests and the package check**

Run: `node --test apps/mqtt/xiaohongshu-follower-counter/test/bindings-config.test.js && npm --prefix apps/mqtt/xiaohongshu-follower-counter run check`

Expected: binding tests PASS; the full package check PASS with zero failures.

- [ ] **Step 5: Commit the binding configuration unit**

```bash
git add apps/mqtt/xiaohongshu-follower-counter/extension/bindings-config.js \
  apps/mqtt/xiaohongshu-follower-counter/test/bindings-config.test.js \
  apps/mqtt/xiaohongshu-follower-counter/package.json
git commit -m "feat: add TC002 profile bindings"
```

### Task 2: Multi-Device Extension UI and Routing

**Files:**
- Modify: `apps/mqtt/xiaohongshu-follower-counter/extension/options.html`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/extension/options.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/extension/service-worker.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/test/extension.test.js`

**Interfaces:**
- Consumes: `normalizeBindings` and `migrateBindings` from Task 1.
- Stores: `bindings: Array<{deviceIp: string, profileUrl: string}>`.
- Stores: `lastResults: Record<string, {ok: boolean, displayName?: string, followerCount?: number, error?: string, observedAt: string}>`.
- Sends: `POST /v1/follower-count` with snapshot fields plus `deviceIp`.

- [ ] **Step 1: Add failing extension structure tests**

```javascript
test("options page edits one profile binding per TC002 device", async () => {
  const html = await readFile(new URL("options.html", EXTENSION), "utf8");
  const script = await readFile(new URL("options.js", EXTENSION), "utf8");
  assert.match(html, /id="bindings"/);
  assert.match(html, /id="addBinding"/);
  assert.match(html, /TC002 设备 IP/);
  assert.match(script, /migrateBindings/);
  assert.match(script, /normalizeBindings/);
  assert.doesNotMatch(html, /id="profileUrls"/);
});

test("service worker routes snapshots to every matching device independently", async () => {
  const worker = await readFile(new URL("service-worker.js", EXTENSION), "utf8");
  assert.match(worker, /bindings/);
  assert.match(worker, /deviceIp/);
  assert.match(worker, /lastResults/);
  assert.match(worker, /Promise\.allSettled/);
  assert.doesNotMatch(worker, /profileUrls/);
});
```

- [ ] **Step 2: Run the extension tests and verify they fail**

Run: `node --test apps/mqtt/xiaohongshu-follower-counter/test/extension.test.js`

Expected: FAIL because `options.html` still contains `profileUrls` and no binding editor.

- [ ] **Step 3: Implement the binding editor**

Replace the textarea with a row container and template containing `deviceIp`, `profileUrl`, and remove controls. Add `addBinding` and keep the existing refresh, Bridge URL, and token settings.

```javascript
import { migrateBindings, normalizeBindings } from "./bindings-config.js";

function renderBindings(bindings) {
  const container = document.querySelector("#bindings");
  container.replaceChildren();
  for (const binding of bindings.length ? bindings : [{ deviceIp: "", profileUrl: "" }]) {
    container.append(createBindingRow(binding));
  }
}

async function save() {
  const bindings = normalizeBindings(readBindingRows());
  await chrome.storage.local.set({ bindings, refreshSeconds, bridgeUrl, bridgeToken });
}
```

Render `lastResults` sorted by device IP and show the migration prompt when any row has an empty `deviceIp`.

- [ ] **Step 4: Implement per-device Service Worker routing**

Use `migrateBindings` in installation, scheduling, and refresh flows. Deduplicate profile URLs when opening managed tabs. When a snapshot arrives, find every binding with the canonical profile URL and send one Bridge request per device.

```javascript
const matching = bindings.filter((binding) => binding.profileUrl === snapshot.profileUrl);
const outcomes = await Promise.allSettled(matching.map(async ({ deviceIp }) => {
  const response = await postSnapshot(config, { ...snapshot, deviceIp });
  await recordDeviceResult(deviceIp, { ok: true, ...snapshot });
  return response;
}));
```

For rejected outcomes, save the sanitized error under only that device IP. Close the managed tab after all matching device requests settle. Treat a profile with no complete binding as `profile_not_configured`.

- [ ] **Step 5: Run extension and full checks**

Run: `node --test apps/mqtt/xiaohongshu-follower-counter/test/extension.test.js apps/mqtt/xiaohongshu-follower-counter/test/bindings-config.test.js && npm --prefix apps/mqtt/xiaohongshu-follower-counter run check`

Expected: all focused and package tests PASS with zero failures.

- [ ] **Step 6: Commit the multi-device extension**

```bash
git add apps/mqtt/xiaohongshu-follower-counter/extension/options.html \
  apps/mqtt/xiaohongshu-follower-counter/extension/options.js \
  apps/mqtt/xiaohongshu-follower-counter/extension/service-worker.js \
  apps/mqtt/xiaohongshu-follower-counter/test/extension.test.js
git commit -m "feat: route profiles to bound TC002 devices"
```

### Task 3: Secure TC002 Device Discovery and Cache

**Files:**
- Create: `apps/mqtt/xiaohongshu-follower-counter/bridge/device-discovery.js`
- Create: `apps/mqtt/xiaohongshu-follower-counter/test/device-discovery.test.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/package.json`

**Interfaces:**
- Consumes: a canonical RFC1918 device IP.
- Produces: `fetchDeviceJson(deviceIp, path, options): Promise<object>`.
- Produces: `discoverDevice(deviceIp, options): Promise<{deviceIp: string, mac: string, mqtt: object, topic: string}>`.
- Produces: `createDeviceResolver({discover, ttlMs, now}): {resolve(deviceIp, options?), clear(deviceIp)}`.
- Errors carry stable `code` values: `device_unreachable`, `invalid_device_response`, `mqtt_disabled`, and `invalid_mqtt_config`.

- [ ] **Step 1: Write failing discovery and cache tests**

```javascript
test("discovers native TC002 display topic from device APIs", async () => {
  const requestJson = async (_ip, path) => path === "/getBase"
    ? { ip: "10.10.21.210", mac: "ccc4b2441bd9", appVer: "1.0.4" }
    : { isMqtt: true, ip: "10.10.20.159", port: "1883", mqtt_name: "", mqtt_pwd: "", mqtt_prefix: "ulanzi" };
  const result = await discoverDevice("10.10.21.210", { requestJson });
  assert.equal(result.topic, "ulanzi_1bd9/custom/display");
  assert.equal(result.mqtt.host, "10.10.20.159");
  assert.equal(result.mqtt.port, 1883);
});

test("rejects mismatched devices and unsafe broker configuration", async () => {
  await assert.rejects(
    discoverDevice("10.10.21.210", { requestJson: async (_ip, path) => path === "/getBase"
      ? { ip: "10.10.21.211", mac: "ccc4b2441bd9" }
      : {} }),
    (error) => error.code === "invalid_device_response",
  );
});

test("resolver caches discoveries for five minutes and supports forced refresh", async () => {
  let calls = 0;
  const resolver = createDeviceResolver({ discover: async (ip) => ({ deviceIp: ip, generation: ++calls }), now: () => 1000 });
  assert.equal((await resolver.resolve("10.10.21.210")).generation, 1);
  assert.equal((await resolver.resolve("10.10.21.210")).generation, 1);
  assert.equal((await resolver.resolve("10.10.21.210", { forceRefresh: true })).generation, 2);
});
```

Add an HTTP fixture whose response writes a complete JSON object but intentionally does not end; assert `fetchDeviceJson` resolves as soon as valid bounded JSON is received. This matches TC002 firmware `1.0.4`, whose HTTP responses may keep the socket open.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test apps/mqtt/xiaohongshu-follower-counter/test/device-discovery.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `bridge/device-discovery.js`.

- [ ] **Step 3: Implement bounded HTTP device reads**

Use `node:http` and resolve once the accumulated body parses as one JSON object, even if the TC002 does not close its response. Enforce a 3-second timeout and 8 KiB maximum body.

```javascript
export function fetchDeviceJson(deviceIp, path, { timeoutMs = 3000, maxBytes = 8192 } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: deviceIp, port: 80, path }, (response) => {
      let body = Buffer.alloc(0);
      response.on("data", (chunk) => {
        body = Buffer.concat([body, chunk]);
        if (body.length > maxBytes) return fail("invalid_device_response");
        try {
          const value = JSON.parse(body.toString("utf8"));
          request.destroy();
          resolve(value);
        } catch {}
      });
    });
    request.setTimeout(timeoutMs, () => fail("device_unreachable"));
    request.once("error", () => fail("device_unreachable"));
  });
}
```

Implement settlement guards so destroy-after-success cannot reject. Do not include response bodies or credentials in errors.

- [ ] **Step 4: Implement discovery validation and cache**

Validate the requested device IP and returned `getBase.ip`, normalize a 12-hex-character MAC, require MQTT enabled, validate the Broker as RFC1918 IPv4, parse port 1-65535, and restrict the prefix to `[A-Za-z0-9_-]{1,32}`. Return username/password only inside the in-memory MQTT object. Build the exact `/custom/display` topic. Cache successful promises for 300,000 ms and evict failed promises.

- [ ] **Step 5: Run discovery and package checks**

Run: `node --test apps/mqtt/xiaohongshu-follower-counter/test/device-discovery.test.js && npm --prefix apps/mqtt/xiaohongshu-follower-counter run check`

Expected: discovery tests and the full package check PASS with zero failures.

- [ ] **Step 6: Commit device discovery**

```bash
git add apps/mqtt/xiaohongshu-follower-counter/bridge/device-discovery.js \
  apps/mqtt/xiaohongshu-follower-counter/test/device-discovery.test.js \
  apps/mqtt/xiaohongshu-follower-counter/package.json
git commit -m "feat: discover TC002 MQTT targets"
```

### Task 4: Dynamic Bridge Publishing, Compatibility, and Documentation

**Files:**
- Modify: `apps/mqtt/xiaohongshu-follower-counter/bridge/config.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/bridge/server.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/.env.example`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/test/config.test.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/test/server.test.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/test/e2e.test.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/test/docs.test.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/test/release.test.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/docs/README.md`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/README.md`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/docs/PR.md`

**Interfaces:**
- Consumes: `deviceIp` in validated snapshot requests.
- Consumes: `createDeviceResolver` from Task 3.
- Dynamic publish call: `publish({...config.mqttPolicy, ...target.mqtt}, target.topic, payload)`.
- Legacy fallback exists only when `MQTT_HOST` and `TC002_MQTT_TOPIC` are both explicitly configured and the request has no device IP.
- HTTP success includes non-secret `{published, deviceIp, topic, followerCount}`.

- [ ] **Step 1: Write failing configuration and server tests**

```javascript
test("loadConfig starts with only the local shared token", () => {
  const config = loadConfig({ XHS_BRIDGE_TOKEN: "secret" });
  assert.equal(config.bridgePort, 17321);
  assert.equal(config.legacyTarget, null);
  assert.equal(config.mqttPolicy.retain, true);
});

test("bridge resolves the request device and publishes to native display topic", async () => {
  const resolved = [];
  const resolveDevice = async (deviceIp, options) => {
    resolved.push({ deviceIp, options });
    return {
      deviceIp,
      topic: "ulanzi_1bd9/custom/display",
      mqtt: { host: "10.10.20.159", port: 1883 },
    };
  };
  const published = [];
  const publish = async (mqtt, topic, payload) => published.push({ mqtt, topic, payload });
  const server = createBridgeServer(CONFIG, publish, { resolveDevice });
  // POST a valid snapshot containing deviceIp: "10.10.21.210".
  assert.equal(published[0].topic, "ulanzi_1bd9/custom/display");
  assert.equal(resolved[0].deviceIp, "10.10.21.210");
});
```

Add a test where the first publish rejects, the resolver is called again with `{forceRefresh: true}`, and the second publish succeeds. Add another where two different device requests are made and one discovery failure does not change the successful response for the other.

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `node --test apps/mqtt/xiaohongshu-follower-counter/test/config.test.js apps/mqtt/xiaohongshu-follower-counter/test/server.test.js`

Expected: FAIL because `loadConfig` still requires `MQTT_HOST` and `TC002_MQTT_TOPIC`, and the server ignores `deviceIp`.

- [ ] **Step 3: Make startup configuration portable**

Return this shape from `loadConfig`:

```javascript
{
  token,
  bridgePort,
  mqttPolicy: {
    tls,
    rejectUnauthorized,
    clientId,
    timeoutMs: 5000,
    retain: true,
  },
  legacyTarget,
}
```

Create `legacyTarget` only when old host and topic are both present; reject partial legacy configuration. `configSummary` reports the loopback Bridge URL, TLS policy, and whether legacy fallback is enabled, but never credentials.

- [ ] **Step 4: Route each Bridge request dynamically**

Extend `validateSnapshot` to require and normalize `deviceIp` unless the server has a complete legacy fallback. Instantiate one resolver when creating the production server. Resolve the target, build the existing PNG payload, publish, and return the resolved non-secret target fields.

```javascript
async function publishForDevice(snapshot) {
  let target = await resolveDevice(snapshot.deviceIp);
  try {
    await publish({ ...config.mqttPolicy, ...target.mqtt }, target.topic, payload);
  } catch {
    target = await resolveDevice(snapshot.deviceIp, { forceRefresh: true });
    await publish({ ...config.mqttPolicy, ...target.mqtt }, target.topic, payload);
  }
  return target;
}
```

Map stable discovery errors to HTTP 400 for invalid input/config and 502 for unreachable device or MQTT delivery. Return the stable code to the extension without internal exception text.

- [ ] **Step 5: Update the real MQTT end-to-end test**

Start fixture HTTP servers for `/getBase` and `/getMqttConfig`, POST a snapshot with the fixture's RFC1918 device IP through the Bridge, and assert the captured MQTT wire bytes contain `custom/display` and `data:image/png;base64,iVBOR`. Use dependency injection for device HTTP requests so the fixture can run on loopback while the production validator remains RFC1918-only.

- [ ] **Step 6: Update environment templates and user documentation**

Document the new setup sequence:

```text
1. Start Bridge with XHS_BRIDGE_TOKEN (and optional XHS_BRIDGE_PORT).
2. Add one row per TC002 in the extension: device IP + Xiaohongshu profile URL.
3. Bridge reads /getBase and /getMqttConfig.
4. Bridge publishes to [prefix]_[mac4]/custom/display.
5. Switch TC002 to the DIY module.
```

Remove instructions that require users to set `MQTT_HOST`, `MQTT_PORT`, or `TC002_MQTT_TOPIC` for the normal path. Mark them as one-release legacy fallback only. Correct all examples from arbitrary `custom/xhs_followers` to native `custom/display`. Explain that device discovery is local, cached for five minutes, and never exposes MQTT credentials to Chrome.

- [ ] **Step 7: Run complete verification**

Run: `npm --prefix apps/mqtt/xiaohongshu-follower-counter run check`

Expected: all tests PASS, syntax checks PASS, and `Release check passed`.

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only the intended implementation and documentation files are modified before the final commit.

- [ ] **Step 8: Commit the dynamic Bridge integration**

```bash
git add apps/mqtt/xiaohongshu-follower-counter
git commit -m "feat: discover TC002 targets from extension bindings"
```

### Task 5: Live Chrome and Two-Device Acceptance

**Files:**
- Modify only if a verified defect is found: files from Tasks 1-4.
- Evidence source: Chrome extension settings, local Bridge logs, EMQX subscriptions/retained messages, TC002 devices `1be3` and `1bd9`.

**Interfaces:**
- Binding A: `10.10.21.195` (`1be3`) plus one accessible Xiaohongshu profile.
- Binding B: `10.10.21.210` (`1bd9`) plus one accessible Xiaohongshu profile.
- Expected topics: `ulanzi_1be3/custom/display` and `ulanzi_1bd9/custom/display`.

- [ ] **Step 1: Reload the unpacked Chrome extension**

Open `chrome://extensions`, reload the existing unpacked extension, and open its settings page. Confirm the previous profile is migrated with an empty device IP and no developer-specific value is inserted.

- [ ] **Step 2: Configure two device bindings**

Enter the two device IP/profile pairs, retain the loopback Bridge URL and shared token, save, reload the settings page, and confirm both rows persist.

- [ ] **Step 3: Start the portable Bridge**

Run with only the shared token and optional port:

Export the existing shared token without printing it, then run:

```bash
XHS_BRIDGE_PORT=17321 \
npm --prefix apps/mqtt/xiaohongshu-follower-counter start
```

Expected startup summary: loopback Bridge URL and no hard-coded Broker or Topic.

- [ ] **Step 4: Verify independent device publications**

Wait for one refresh. Confirm each device has its own successful `lastResults` entry. In EMQX retained messages, confirm both native display topics exist and their payloads contain a PNG data URL. Confirm both connected clients subscribe to their matching `custom/+` wildcard.

- [ ] **Step 5: Verify failure isolation**

Temporarily change only one binding to an unused RFC1918 address, save, and refresh. Confirm that row reports `device_unreachable` while the other device continues to publish. Restore the valid IP and confirm recovery after the next refresh.

- [ ] **Step 6: Run final verification after any acceptance fixes**

Run: `npm --prefix apps/mqtt/xiaohongshu-follower-counter run check && git diff --check && git status --short`

Expected: all automated checks PASS, and both physical TC002 devices display their bound profile on the DIY module.

---

## Final Review Checklist

- [ ] Every spec requirement maps to a task above.
- [ ] No device IP, MAC suffix, Broker address, extension ID, token, or absolute developer path is present in shipped source defaults.
- [ ] Native TC002 publishing uses only `[prefix]_[mac4]/custom/display`.
- [ ] MQTT credentials never enter Chrome storage, Bridge responses, or logs.
- [ ] One device failure does not prevent other bindings from updating.
- [ ] Migration retains old profile URLs but requires users to supply device IPs.
- [ ] Full package check and two-device live acceptance both pass.
