# TC002 Xiaohongshu Five-Second Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Chrome 扩展刷新配置改为秒，支持解压加载模式下最短 5 秒周期，并安全迁移旧分钟配置。

**Architecture:** 新建纯 JavaScript `refresh-config.js`，集中处理秒值归一化与 `chrome.storage.local` 迁移，供 options 页面和 MV3 service worker 共用。service worker 继续使用 `chrome.alarms`，将秒换算为 fractional minutes，并用运行中锁避免刷新批次重叠。

**Tech Stack:** Chrome Manifest V3、JavaScript ES modules、`chrome.alarms`、`chrome.storage.local`、Node.js `node:test`。

## Global Constraints

- 新字段固定为 `refreshSeconds`，默认 30 秒，最低 5 秒。
- 旧 `refreshMinutes` 必须自动迁移并删除；两个字段同时存在时以秒为准。
- 不增加 Chrome 权限，不使用 offscreen document、持久后台页或 native messaging。
- 5 秒面向“加载已解压扩展”模式；正式打包时 Chrome 可能限制为至少 30 秒。
- 同一时间只允许一个主页刷新批次运行。
- 不修改 Bridge、MQTT topic、共享令牌或页面采集字段。

---

### Task 1: Shared Seconds Configuration and Migration

**Files:**
- Create: `apps/mqtt/xiaohongshu-follower-counter/extension/refresh-config.js`
- Create: `apps/mqtt/xiaohongshu-follower-counter/test/refresh-config.test.js`

**Interfaces:**
- Produces: `DEFAULT_REFRESH_SECONDS = 30`、`MIN_REFRESH_SECONDS = 5`。
- Produces: `normalizeRefreshSeconds(value): number`。
- Produces: `migrateRefreshSeconds(storageArea): Promise<number>`。

- [ ] **Step 1: Write failing pure unit tests**

```javascript
test("normalizes second intervals to integers with a five-second floor", () => {
  assert.equal(normalizeRefreshSeconds(undefined), 30);
  assert.equal(normalizeRefreshSeconds("5"), 5);
  assert.equal(normalizeRefreshSeconds(4), 5);
  assert.equal(normalizeRefreshSeconds(12.9), 12);
  assert.equal(normalizeRefreshSeconds("invalid"), 30);
});

test("migrates legacy minutes and removes the old key", async () => {
  const storage = fakeStorage({ refreshMinutes: 2 });
  assert.equal(await migrateRefreshSeconds(storage), 120);
  assert.deepEqual(storage.data, { refreshSeconds: 120 });
});

test("seconds win when both storage keys exist", async () => {
  const storage = fakeStorage({ refreshSeconds: 5, refreshMinutes: 15 });
  assert.equal(await migrateRefreshSeconds(storage), 5);
  assert.deepEqual(storage.data, { refreshSeconds: 5 });
});
```

- [ ] **Step 2: Run the target test and verify RED**

Run: `node --test test/refresh-config.test.js`
Expected: FAIL because `extension/refresh-config.js` does not exist.

- [ ] **Step 3: Implement normalization and storage migration**

```javascript
export const DEFAULT_REFRESH_SECONDS = 30;
export const MIN_REFRESH_SECONDS = 5;

export function normalizeRefreshSeconds(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_REFRESH_SECONDS;
  return Math.max(MIN_REFRESH_SECONDS, Math.floor(numeric));
}

export async function migrateRefreshSeconds(storageArea) {
  const stored = await storageArea.get(["refreshSeconds", "refreshMinutes"]);
  const candidate = stored.refreshSeconds !== undefined
    ? stored.refreshSeconds
    : stored.refreshMinutes !== undefined
      ? Number(stored.refreshMinutes) * 60
      : DEFAULT_REFRESH_SECONDS;
  const refreshSeconds = normalizeRefreshSeconds(candidate);
  await storageArea.set({ refreshSeconds });
  if (stored.refreshMinutes !== undefined) await storageArea.remove("refreshMinutes");
  return refreshSeconds;
}
```

- [ ] **Step 4: Declare the shared module as a web-accessible tested resource only if required by Chrome loading**

Options and service worker import the module from the extension package directly, so no new host permission is required. Keep manifest permissions equal to `storage` and `alarms`.

- [ ] **Step 5: Run unit and manifest tests**

Run: `node --test test/refresh-config.test.js test/extension.test.js`
Expected: unit tests PASS; existing extension tests remain PASS until their seconds assertions are added in Task 2.

- [ ] **Step 6: Commit**

```bash
git add apps/mqtt/xiaohongshu-follower-counter/extension/refresh-config.js \
  apps/mqtt/xiaohongshu-follower-counter/test/refresh-config.test.js
git commit -m "feat: add portable second-based refresh settings"
```

### Task 2: Service Worker, Options UI, and Documentation

**Files:**
- Modify: `apps/mqtt/xiaohongshu-follower-counter/extension/service-worker.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/extension/options.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/extension/options.html`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/test/extension.test.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/test/docs.test.js`
- Modify: `apps/mqtt/xiaohongshu-follower-counter/docs/README.md`

**Interfaces:**
- Consumes: `migrateRefreshSeconds()` and `normalizeRefreshSeconds()` from Task 1.
- Produces: `chrome.alarms` period `refreshSeconds / 60` and options storage key `refreshSeconds`.

- [ ] **Step 1: Write failing extension contract tests**

```javascript
assert.match(worker, /migrateRefreshSeconds/);
assert.match(worker, /refreshSeconds\s*\/\s*60/);
assert.match(worker, /refreshInProgress/);
assert.doesNotMatch(worker, /MIN_REFRESH_MINUTES/);
assert.match(optionsHtml, /刷新间隔（秒，最少 5）/);
assert.match(optionsHtml, /id="refreshSeconds"[^>]*min="5"[^>]*value="30"/);
assert.match(optionsSource, /refreshSeconds/);
assert.doesNotMatch(optionsSource, /refreshMinutes/);
```

- [ ] **Step 2: Run extension tests and verify RED**

Run: `node --test test/extension.test.js`
Expected: FAIL because the extension still stores minutes and has no overlap guard.

- [ ] **Step 3: Convert the service worker to seconds**

Import the shared module, remove `refreshMinutes` from `DEFAULTS`, call migration before every schedule, and create the alarm with:

```javascript
await chrome.alarms.create(ALARM_NAME, {
  delayInMinutes: 1 / 60,
  periodInMinutes: refreshSeconds / 60,
});
```

Wrap `refreshProfiles()` with a module-level `refreshInProgress` guard and reset it in `finally`.

- [ ] **Step 4: Convert options restore/save to seconds**

Change the script tag to `type="module"`, import the shared helpers, restore via `migrateRefreshSeconds(chrome.storage.local)`, and save:

```javascript
const refreshSeconds = normalizeRefreshSeconds(
  document.querySelector("#refreshSeconds").value,
);
await chrome.storage.local.set({ profileUrls, refreshSeconds, bridgeUrl, bridgeToken });
```

- [ ] **Step 5: Update UI and documentation**

Use input `id="refreshSeconds" type="number" min="5" step="1" value="30"`. State that 5 seconds is for short testing and 60 seconds or more is recommended for long-running use. Replace minute-based installation and troubleshooting wording.

- [ ] **Step 6: Run extension and documentation tests**

Run: `node --test test/refresh-config.test.js test/extension.test.js test/docs.test.js`
Expected: PASS.

- [ ] **Step 7: Run the complete release check**

Run: `npm --prefix apps/mqtt/xiaohongshu-follower-counter run check`
Expected: 0 failures, syntax check PASS, `Release check passed`.

- [ ] **Step 8: Commit**

```bash
git add apps/mqtt/xiaohongshu-follower-counter/extension \
  apps/mqtt/xiaohongshu-follower-counter/test/extension.test.js \
  apps/mqtt/xiaohongshu-follower-counter/test/docs.test.js \
  apps/mqtt/xiaohongshu-follower-counter/docs/README.md
git commit -m "feat: support five-second Xiaohongshu refresh"
```
