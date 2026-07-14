# TC002 小红书粉丝数本地显示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Chrome 本地采集、小型 Node 桥接、MQTT 推送到 TC002 Custom App 的可运行闭环。

**Architecture:** MV3 内容脚本只负责从当前小红书主页提取标准化粉丝事件；service worker 负责调度与向 loopback POST；Node 桥接负责验证、52×16 PNG 渲染和 MQTT 3.1.1 发布。所有核心逻辑均为无第三方运行时依赖的可测试模块。

**Tech Stack:** JavaScript ES modules、Chrome Manifest V3、Node.js 20+ 内置 `node:test`/`http`/`net`/`tls`/`zlib`、MQTT 3.1.1、PNG。

## Global Constraints

- 不读取、导出或保存小红书 Cookie。
- 不绕过登录、验证码、限流或其他访问控制。
- 扩展权限限于 `https://www.xiaohongshu.com/*` 和 `http://127.0.0.1/*`。
- 桥接只监听 `127.0.0.1` 并要求共享令牌。
- 刷新间隔不得低于 5 分钟。
- MQTT payload 使用仓库现有 TC002 Custom App JSON schema。
- 新增代码使用 GPL-3.0-or-later。

---

### Task 1: 共享采集器

**Files:**
- Create: `apps/mqtt/xiaohongshu-follower-counter/extension/extractor.js`
- Create: `apps/mqtt/xiaohongshu-follower-counter/test/extractor.test.js`
- Create: `apps/mqtt/xiaohongshu-follower-counter/package.json`

**Interfaces:**
- Produces: `parseCompactCount(value): number | null`、`extractFollowerSnapshot(document, url): Snapshot`。

- [ ] 写失败测试，覆盖普通数字、逗号、`万/亿/k/m`、JSON script 与邻接 DOM 两种来源。
- [ ] 运行 `node --test test/extractor.test.js`，确认因模块缺失失败。
- [ ] 实现最小解析与候选排序逻辑。
- [ ] 重跑测试并确认通过。

### Task 2: PNG 与 TC002 payload

**Files:**
- Create: `apps/mqtt/xiaohongshu-follower-counter/bridge/render.js`
- Create: `apps/mqtt/xiaohongshu-follower-counter/bridge/png.js`
- Create: `apps/mqtt/xiaohongshu-follower-counter/test/render.test.js`

**Interfaces:**
- Produces: `renderFollowerPng(snapshot): Buffer`、`buildCustomAppPayload(snapshot): object`。

- [ ] 写失败测试，断言 PNG signature、IHDR 52×16、data URL 和 Custom App schema。
- [ ] 运行目标测试，确认因实现缺失失败。
- [ ] 实现 CRC32、PNG chunk、像素字体和 payload 构造。
- [ ] 重跑测试并确认通过。

### Task 3: 最小 MQTT 客户端

**Files:**
- Create: `apps/mqtt/xiaohongshu-follower-counter/bridge/mqtt.js`
- Create: `apps/mqtt/xiaohongshu-follower-counter/test/mqtt.test.js`

**Interfaces:**
- Produces: `encodeRemainingLength`、`buildConnectPacket`、`buildPublishPacket`、`publishMqtt(options, topic, payload)`。

- [ ] 写失败测试，覆盖 MQTT CONNECT、可选鉴权和 retained QoS 0 PUBLISH 编码。
- [ ] 运行目标测试，确认因实现缺失失败。
- [ ] 实现 MQTT 3.1.1 packet 与 TCP/TLS CONNACK 流程。
- [ ] 使用本地假 broker 验证真实 socket 发布。

### Task 4: loopback HTTP 桥接

**Files:**
- Create: `apps/mqtt/xiaohongshu-follower-counter/bridge/config.js`
- Create: `apps/mqtt/xiaohongshu-follower-counter/bridge/server.js`
- Create: `apps/mqtt/xiaohongshu-follower-counter/test/server.test.js`

**Interfaces:**
- Consumes: `buildCustomAppPayload`、`publishMqtt`。
- Produces: `validateSnapshot`、`createBridgeServer(config, publish)`。

- [ ] 写失败测试，覆盖 health、CORS preflight、Bearer 鉴权、非法 URL/计数和成功发布。
- [ ] 运行目标测试，确认因实现缺失失败。
- [ ] 实现环境配置、请求大小限制、校验与 JSON 响应。
- [ ] 重跑测试并确认通过。

### Task 5: Chrome MV3 扩展

**Files:**
- Create: `apps/mqtt/xiaohongshu-follower-counter/extension/manifest.json`
- Create: `apps/mqtt/xiaohongshu-follower-counter/extension/content.js`
- Create: `apps/mqtt/xiaohongshu-follower-counter/extension/service-worker.js`
- Create: `apps/mqtt/xiaohongshu-follower-counter/extension/options.html`
- Create: `apps/mqtt/xiaohongshu-follower-counter/extension/options.js`
- Create: `apps/mqtt/xiaohongshu-follower-counter/test/extension.test.js`

**Interfaces:**
- Consumes: `extractFollowerSnapshot` 与桥接 HTTP API。

- [ ] 写静态契约测试，确认权限最小化、无 cookie/webRequest、间隔下限和消息字段白名单。
- [ ] 运行目标测试，确认因扩展文件缺失失败。
- [ ] 实现 options 保存、alarm 调度、后台标签页生命周期、提取消息与桥接 POST。
- [ ] 重跑测试并确认通过。

### Task 6: 文档、预览与端到端验证

**Files:**
- Create: `apps/mqtt/xiaohongshu-follower-counter/README.md`
- Create: `apps/mqtt/xiaohongshu-follower-counter/docs/README.md`
- Create: `apps/mqtt/xiaohongshu-follower-counter/docs/LICENSE`
- Create: `apps/mqtt/xiaohongshu-follower-counter/preview/demo.png`
- Modify: `apps/mqtt/README.md`

**Interfaces:**
- Documents: 安装扩展、启动桥接、配置 MQTT、真实浏览器与真机验收步骤。

- [ ] 增加文档契约测试，要求所有配置项、安全边界和排障步骤存在。
- [ ] 运行测试确认文档缺失导致失败。
- [ ] 编写文档并用渲染器生成 52×16 预览。
- [ ] 运行 `npm test`，再启动本地假 broker 与桥接执行一次 HTTP→MQTT 端到端发布。
- [ ] 检查 `git diff --check`、许可证和未跟踪文件。
