# TC002 Xiaohongshu Upstream Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有小红书 Chrome 采集扩展和 Node.js MQTT Bridge 整理为跨电脑配置、可自动验收、适合提交 TC002 上游仓库的社区 MQTT 应用。

**Architecture:** Chrome MV3 扩展只保存并使用当前电脑的运行时设置，Bridge 只从当前进程环境变量读取部署配置；两者通过 IPv4 loopback HTTP 通信。发布检查使用 Node.js 实现，以便 Windows、macOS、Linux 共用同一套 `npm` 命令。

**Tech Stack:** JavaScript ES modules、Chrome Manifest V3、Node.js 20+、`node:test`、HTTP、MQTT 3.1.1、PNG、GitHub Markdown。

## Global Constraints

- 不读取、导出或保存小红书 Cookie。
- 不绕过登录、验证码、限流或其他访问控制。
- 不写死开发机路径、主页、broker、凭证、TC002 topic 或设备标识。
- 所有部署参数从 `chrome.storage.local` 或环境变量动态读取。
- Bridge 只监听 IPv4 loopback，写接口必须使用共享令牌。
- 支持 Node.js 20+ 与 Chrome/Chromium MV3 的 Windows、macOS、Linux。
- 运行时零 npm 第三方依赖；检查命令不得依赖 Bash 或 PowerShell。
- 新增代码使用 GPL-3.0-or-later。

---

### Task 1: Portable Bridge Configuration

**Files:**
- Create: `apps/mqtt/xiaohongshu-follower-counter/test/config.test.js`
- Create: `apps/mqtt/xiaohongshu-follower-counter/.env.example`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/bridge/config.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/bridge/server.js`

**Interfaces:**
- Produces: `loadConfig(env): BridgeConfig`，所有 MQTT 与设备参数由传入环境动态决定。
- Produces: `configSummary(config): object`，仅包含非敏感启动信息。

- [ ] **Step 1: Write failing configuration tests**

```javascript
test("loadConfig derives every deployment value from the current environment", () => {
  const config = loadConfig({
    XHS_BRIDGE_TOKEN: "machine-generated-token",
    XHS_BRIDGE_PORT: "18432",
    MQTT_HOST: "broker.lan",
    MQTT_PORT: "2883",
    MQTT_USERNAME: "clock-user",
    MQTT_PASSWORD: "clock-password",
    MQTT_TLS: "true",
    MQTT_ALLOW_SELF_SIGNED: "true",
    MQTT_CLIENT_ID: "desktop-a",
    TC002_MQTT_TOPIC: "device/current/custom/xhs",
  });
  assert.equal(config.bridgePort, 18432);
  assert.equal(config.topic, "device/current/custom/xhs");
  assert.deepEqual(config.mqtt, {
    host: "broker.lan", port: 2883, tls: true,
    username: "clock-user", password: "clock-password",
    rejectUnauthorized: false, clientId: "desktop-a",
    timeoutMs: 5000, retain: true,
  });
});

test("loadConfig requires a per-device MQTT topic", () => {
  assert.throws(() => loadConfig({
    XHS_BRIDGE_TOKEN: "token", MQTT_HOST: "broker.lan",
  }), /TC002_MQTT_TOPIC is required/);
});
```

- [ ] **Step 2: Run the tests and confirm the required-topic test fails**

Run: `node --test test/config.test.js`
Expected: FAIL because `TC002_MQTT_TOPIC` currently falls back to a fixed example topic.

- [ ] **Step 3: Require dynamic topic configuration and add a safe startup summary**

```javascript
const topic = required(env.TC002_MQTT_TOPIC, "TC002_MQTT_TOPIC");

export function configSummary(config) {
  return {
    bridge: `http://127.0.0.1:${config.bridgePort}`,
    mqttHost: config.mqtt.host,
    mqttPort: config.mqtt.port,
    mqttTls: config.mqtt.tls,
    topic: config.topic,
  };
}
```

The server startup log serializes this summary and never includes `token`, `password`, or `username`.

- [ ] **Step 4: Add a credential-free environment template**

```dotenv
XHS_BRIDGE_TOKEN=replace-with-a-random-local-token
XHS_BRIDGE_PORT=17321
MQTT_HOST=replace-with-your-mqtt-host
MQTT_PORT=1883
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_TLS=false
MQTT_ALLOW_SELF_SIGNED=false
MQTT_CLIENT_ID=
TC002_MQTT_TOPIC=replace-with-your-tc002-custom-app-topic
```

- [ ] **Step 5: Run targeted tests**

Run: `node --test test/config.test.js test/server.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mqtt/xiaohongshu-follower-counter/.env.example \
  apps/mqtt/xiaohongshu-follower-counter/bridge/config.js \
  apps/mqtt/xiaohongshu-follower-counter/bridge/server.js \
  apps/mqtt/xiaohongshu-follower-counter/test/config.test.js
git commit -m "feat: make Xiaohongshu bridge configuration portable"
```

### Task 2: Cross-platform Release Checks

**Files:**
- Create: `apps/mqtt/xiaohongshu-follower-counter/scripts/check-release.js`
- Create: `apps/mqtt/xiaohongshu-follower-counter/test/release.test.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/package.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `npm run check`，在任意受支持系统执行全部测试、JavaScript 语法检查和发布清单检查。

- [ ] **Step 1: Write failing release-contract tests**

Tests assert package/manifest versions match, `.env.example` contains every supported variable, root ignore rules cover `.DS_Store`, `.env`, logs and `node_modules`, and no tracked application text contains `/Users/<name>/`, a Windows user profile path, a real profile ID, broker password, or extension ID.

```javascript
assert.equal(packageJson.version, manifest.version);
assert.match(rootGitignore, /\.DS_Store/);
assert.match(rootGitignore, /node_modules\//);
assert.match(rootGitignore, /\.env/);
```

- [ ] **Step 2: Run the release test and confirm missing artifacts fail**

Run: `node --test test/release.test.js`
Expected: FAIL because `.env.example`, ignore rules, and the release checker do not yet exist.

- [ ] **Step 3: Implement the Node-only release checker**

`scripts/check-release.js` recursively checks the application directory using `node:fs/promises`; it skips binary preview files and rejects forbidden file names and machine-specific text. It exits non-zero with relative paths and actionable messages.

- [ ] **Step 4: Add portable npm commands**

```json
{
  "scripts": {
    "preview": "node bridge/render-preview.js",
    "start": "node bridge/server.js",
    "test": "node --test",
    "check:syntax": "node --check bridge/config.js && node --check bridge/mqtt.js && node --check bridge/png.js && node --check bridge/render.js && node --check bridge/server.js && node --check extension/content.js && node --check extension/extractor.js && node --check extension/options.js && node --check extension/service-worker.js",
    "check:release": "node scripts/check-release.js",
    "check": "npm test && npm run check:syntax && npm run check:release"
  }
}
```

- [ ] **Step 5: Add repository ignore rules without deleting user files**

Append `.DS_Store`, `node_modules/`, `*.log`, and `.env` while preserving `.env.example` with `!.env.example`.

- [ ] **Step 6: Run the unified check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add .gitignore apps/mqtt/xiaohongshu-follower-counter/package.json \
  apps/mqtt/xiaohongshu-follower-counter/scripts/check-release.js \
  apps/mqtt/xiaohongshu-follower-counter/test/release.test.js
git commit -m "test: add portable upstream release checks"
```

### Task 3: Extension Runtime Configuration Contract

**Files:**
- Modify: `apps/mqtt/xiaohongshu-follower-counter/extension/manifest.json`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/extension/options.html`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/extension/options.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/extension/service-worker.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/test/extension.test.js`

**Interfaces:**
- Consumes: per-machine settings from `chrome.storage.local`.
- Produces: current-machine profile refreshes and a non-secret last result/status.

- [ ] **Step 1: Extend failing extension contract tests**

Assert the extension contains no concrete `/user/profile/<id>`, token, MQTT host, TC002 topic, absolute path, or fixed extension ID; assert both options and service worker load runtime values via `chrome.storage.local`; assert the UI explains that the Bridge URL and token belong to the current computer.

- [ ] **Step 2: Run the extension test**

Run: `node --test test/extension.test.js`
Expected: FAIL on the new portability/status copy assertions.

- [ ] **Step 3: Harden settings validation and status copy**

Keep `http://127.0.0.1:17321` and 15 minutes as overrideable defaults. Validate the entered URL is IPv4 loopback with any valid port; canonicalize all profile URLs before saving; show success/error timestamp without displaying the shared token.

- [ ] **Step 4: Align manifest metadata with the upstream release**

Set the release description to explain local Chrome-to-MQTT behavior, keep only `storage` and `alarms`, and retain narrowly scoped host permissions. The manifest version remains equal to `package.json`.

- [ ] **Step 5: Run extension and full tests**

Run: `node --test test/extension.test.js test/extractor.test.js && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mqtt/xiaohongshu-follower-counter/extension \
  apps/mqtt/xiaohongshu-follower-counter/test/extension.test.js
git commit -m "feat: harden portable Chrome extension settings"
```

### Task 4: Upstream Documentation and PR Materials

**Files:**
- Create: `apps/mqtt/xiaohongshu-follower-counter/docs/PR.md`
- Create: `apps/mqtt/xiaohongshu-follower-counter/preview/README.md`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/README.md`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/docs/README.md`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/test/docs.test.js`

**Interfaces:**
- Documents: clone-to-run setup on Windows, macOS and Linux; Chrome configuration; MQTT schema; privacy; validation; upstream PR checklist.

- [ ] **Step 1: Extend failing documentation tests**

Require `.env.example`, Windows PowerShell and POSIX examples, `npm run check`, runtime configuration wording, MQTT topic/payload, the `11.6万 → 116000` approximation, a rendered-preview disclaimer, real-device evidence instructions, and every checkbox from `CONTRIBUTING.md`.

- [ ] **Step 2: Run documentation tests**

Run: `node --test test/docs.test.js`
Expected: FAIL because PR and preview documentation are missing.

- [ ] **Step 3: Rewrite the quick start and detailed guide**

The root README leads with the result and links to complete docs. The detailed guide includes separate PowerShell and POSIX environment examples, explains that users replace every machine/device value, and never instructs users to edit source files.

- [ ] **Step 4: Add preview evidence guidance**

`preview/README.md` explicitly says `demo.png` is renderer output, lists the required real-device file names and capture criteria, and forbids presenting the renderer image as a hardware photograph.

- [ ] **Step 5: Add a copy-ready PR description**

`docs/PR.md` includes a conventional PR title, architecture summary, permission/privacy justification, test results, manual Chrome evidence, the outstanding real-device media item, and the five upstream checklist items.

- [ ] **Step 6: Run documentation and unified checks**

Run: `node --test test/docs.test.js && npm run check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mqtt/xiaohongshu-follower-counter/README.md \
  apps/mqtt/xiaohongshu-follower-counter/docs \
  apps/mqtt/xiaohongshu-follower-counter/preview/README.md \
  apps/mqtt/xiaohongshu-follower-counter/test/docs.test.js
git commit -m "docs: prepare Xiaohongshu MQTT app for upstream review"
```

### Task 5: Final Upstream Verification

**Files:**
- Modify only files required by failures found during verification.

**Interfaces:**
- Produces: a clean, evidence-backed upstream PR candidate except for user-supplied real TC002 media.

- [ ] **Step 1: Run the clean release check**

Run: `npm --prefix apps/mqtt/xiaohongshu-follower-counter run check`
Expected: every test and checker passes with exit code 0.

- [ ] **Step 2: Regenerate and inspect the preview**

Run: `npm --prefix apps/mqtt/xiaohongshu-follower-counter run preview`
Expected: `preview/demo.png` is a valid 52×16 PNG and documentation still labels it rendered.

- [ ] **Step 3: Run repository hygiene checks**

Run: `git diff --check && git status --short && git log --oneline -12`
Expected: no whitespace errors; only known user-owned ignored `.DS_Store` files remain invisible; commits are scoped.

- [ ] **Step 4: Verify no credentials or machine paths are tracked**

Run: `node apps/mqtt/xiaohongshu-follower-counter/scripts/check-release.js`
Expected: `Release check passed`.

- [ ] **Step 5: Record the remaining external requirement**

Confirm `docs/PR.md` leaves real TC002 photo/GIF unchecked until the device owner supplies it. Do not claim the upstream contribution is fully submit-ready before that artifact exists.
