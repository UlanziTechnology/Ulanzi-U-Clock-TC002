# TC002 小红书粉丝数：Chrome 扩展与 Home Assistant MQTT 设计

## 目标

将现有 `apps/mqtt/xiaohongshu-follower-counter` 从“Chrome 扩展 + 本地 Node Bridge”迁移为“Chrome 扩展 + Home Assistant MQTT Blueprint”。用户不再安装、配置或启动本地 Bridge；Chrome 扩展负责读取小红书粉丝数、发现 TC002 配置、生成 52×16 PNG payload，并通过局域网 Webhook 交给 Home Assistant。Home Assistant 使用已经配置的 MQTT 集成向 TC002 发布 retained 消息。

最终产物提交到 `UlanziTechnology/Ulanzi-U-Clock-TC002` 的 `apps/mqtt/xiaohongshu-follower-counter`，遵循该仓库现有 MQTT 应用的 `blueprint.yaml`、文档、预览与 GPL-3.0-or-later 约定，不使用 `.ulanziPlugin` 规范。

## 非目标

- 不发布到 Chrome Web Store。
- 不在 Chrome 扩展中直接连接 MQTT TCP 或 MQTT-over-WebSocket。
- 不在扩展中保存 Home Assistant 长期访问令牌。
- 不把 MQTT 用户名、密码或小红书登录态发送给 Home Assistant。
- 不调用小红书云端非公开 API，不绕过登录、验证码、风控或访问限制。
- 不要求每台 TC002 分别创建一个 Blueprint 实例。

## 总体架构

```text
Chrome 中已登录的小红书主页
  → Content Script 提取公开昵称与粉丝数
  → Extension Service Worker 查找主页绑定的 TC002 IP
  → GET http://<device-ip>/getBase
  → GET http://<device-ip>/getMqttConfig
  → 校验 TC002、MAC、MQTT 开关和 mqtt_prefix
  → 计算 devicePrefix，例如 ulanzi_1be3
  → 使用固定像素矩阵生成 52×16 PNG 与 Custom App payload
  → POST http(s)://<home-assistant>/api/webhook/<secret-id>
  → Home Assistant Blueprint 校验 devicePrefix 白名单
  → mqtt.publish 到 <devicePrefix>/custom/<appName>
  → TC002 DIY Custom App
```

一个 Blueprint 自动化实例服务多台 TC002。所有设备共享一个随机 Webhook ID 和一个应用名称；Blueprint 输入中配置允许的设备前缀白名单。

## Chrome 扩展职责

### 用户配置

扩展配置页保存以下本机数据到 `chrome.storage.local`：

- Home Assistant 基础 URL，例如 `http://192.168.1.10:8123`；
- 随机 Webhook ID；
- 刷新间隔，最低 5 分钟（300 秒），升级时自动抬升已有的更短设置，以降低触发小红书风控或屏蔽的风险；
- 多条设备绑定，每条包含 TC002 私网 IPv4 与一个规范化小红书主页 URL；
- 每台设备最近一次发现的 `devicePrefix` 和最近发布结果。

删除现有 Bridge URL 与共享令牌配置。升级时保留已有设备 IP、主页绑定和刷新间隔；旧 Bridge 字段不再使用并从存储中清理。

### 权限

扩展继续静态申请小红书主页权限，并声明：

```json
{
  "optional_host_permissions": [
    "http://*/*",
    "https://*/*"
  ]
}
```

用户保存设备或 Home Assistant 地址时，扩展只请求对应 origin 的运行时 host permission。网络请求只由扩展 Service Worker 发起；Content Script 不能指定任意请求 URL。

### 设备发现

对每个绑定设备并行请求：

```text
GET http://<device-ip>/getBase
GET http://<device-ip>/getMqttConfig
```

校验规则保持现有 Bridge 行为：

- 设备 IP 必须属于 `10/8`、`172.16/12` 或 `192.168/16`；
- `/getBase` 返回 IP 必须等于绑定 IP；
- MAC 必须为 12 位十六进制字符；
- 返回型号存在时必须包含 `TC002`；
- `isMqtt` 必须开启；
- `mqtt_prefix` 必须匹配 `[A-Za-z0-9_-]{1,32}`；
- MQTT broker IP 和端口必须有效，但扩展不连接 broker；
- MQTT 用户名和密码只用于响应校验，不持久化、不记录、不发送。

设备前缀按以下规则计算：

```js
const devicePrefix = `${mqttPrefix}_${mac.slice(-4)}`;
```

成功结果缓存 5 分钟。设备发布失败后清除该设备缓存，并在下一次刷新重新发现。

### 像素渲染

现有 Logo、数字、`.`、`K`、`M` 的固定像素矩阵和布局保持不变：

- 画布 52×16 RGB；
- Logo 左侧两像素留白；
- Logo 与文字之间两像素留白；
- 大数字为 5×10；
- 大 `K` 为 6×10，大 `M` 为 8×10；
- 小 `K` 为 5×7，小 `M` 为 7×7；
- 大字模占用 `y=3..12`；
- 不绘制参考图右侧状态点。

渲染器改为浏览器与 Node 测试环境通用的 `Uint8Array` 实现，不允许依赖 `node:buffer`、`node:zlib` 或远程托管代码。PNG 编码使用浏览器可用的 `CompressionStream("deflate")`，CRC32、PNG chunk 拼接和 Base64 转换保留为仓库内本地代码。渲染接口改为异步：

```js
renderFollowerPng(snapshot) -> Promise<Uint8Array>
buildCustomAppPayload(snapshot, duration) -> Promise<object>
```

### Webhook 请求

扩展向 Home Assistant 发送：

```http
POST /api/webhook/<webhook-id>
Content-Type: application/json
```

```json
{
  "devicePrefix": "ulanzi_1be3",
  "profileUrl": "https://www.xiaohongshu.com/user/profile/example",
  "displayName": "示例用户",
  "followerCount": 12800,
  "observedAt": "2026-07-21T12:00:00.000Z",
  "payload": "{\"duration\":31536000,\"text\":[],\"image\":[...],\"draw\":[]}"
}
```

`payload` 是已经序列化的 TC002 Custom App JSON 字符串。Blueprint 不负责图像生成，也不接受扩展传入完整 MQTT topic 或应用名称。

## Home Assistant Blueprint

### 输入

`blueprint.yaml` 提供：

- `webhook_id`：用户生成的高熵随机字符串；
- `allowed_device_prefixes`：每行一个允许的设备前缀，例如 `ulanzi_1be3`；
- `app_name`：所有设备共享的 Custom App 名称，默认 `xiaohongshu_followers`，只允许字母、数字、下划线和连字符。

最终 MQTT topic 固定由 Blueprint 构造：

```text
<devicePrefix>/custom/<appName>
```

扩展不能覆盖 `app_name`，也不能提交 `/notify`、通配符或其他 MQTT topic。

### 触发与校验

Webhook 配置：

- 只允许 `POST`；
- `local_only: true`；
- 一个 Blueprint 实例只有一个 Webhook；
- `mode: queued`，避免多设备同时更新时互相取消。

执行 `mqtt.publish` 前必须验证：

- JSON 包含字符串 `devicePrefix` 和字符串 `payload`；
- `devicePrefix` 完全匹配白名单中的一行；
- `devicePrefix` 格式匹配 `^[A-Za-z0-9_-]+_[0-9a-fA-F]{4}$`；
- `payload` 长度在合理上限内；
- Blueprint 配置的 `app_name` 符合允许字符范围。

发布参数固定为：

```yaml
qos: 0
retain: true
```

Home Assistant MQTT 集成必须连接到与 TC002 `/getMqttConfig` 相同的 broker。一个 Blueprint 实例可以服务白名单中的所有设备，但所有设备共享同一 `app_name`。

## 安装与发布体验

### Chrome 扩展

仓库包含：

- `extension/` 可审查源码；
- 无第三方运行时依赖的确定性 ZIP 打包脚本；
- `release/xiaohongshu-follower-counter-chrome-<version>.zip`；
- `release/SHA256SUMS`；
- Chrome 开发者模式安装、升级和权限授权说明。

用户安装步骤：下载 ZIP、校验 SHA-256、解压、打开 `chrome://extensions`、启用开发者模式、选择“加载已解压的扩展程序”。本阶段不宣称 Chrome 一键安装。

### Home Assistant Blueprint

`blueprint.yaml` 的 `source_url` 指向上游 `main` 分支文件。README 提供 Home Assistant My 按钮，其 URL 指向同一上游 Blueprint，实现合并后一键导入。文档同时提供手动导入 URL 和 YAML 检查步骤。

### 上游目录

保留并更新：

```text
apps/mqtt/xiaohongshu-follower-counter/
  blueprint.yaml
  extension/
  preview/
  release/
  scripts/
  test/
  docs/
  README.md
  package.json
```

删除不再使用的：

```text
bridge/
.env.example
```

文档不得包含开发电脑专属 IP、MAC、Webhook ID、主页账号或 MQTT 密码。

## 错误处理

扩展为每台设备独立记录错误，不允许一台设备失败阻断其他设备：

- `permission_required`：尚未授权设备或 HA origin；
- `device_unreachable`：无法访问设备 HTTP API；
- `invalid_device_response`：IP、MAC 或型号校验失败；
- `mqtt_disabled` / `invalid_mqtt_config`：设备 MQTT 配置不可用；
- `ha_unreachable`：无法访问 Home Assistant；
- `webhook_rejected`：Webhook 返回非成功状态；
- `render_failed`：PNG 或 payload 生成失败；
- `extract_failed`：小红书页面无法提取粉丝数。

`device_not_allowed` 由 Blueprint 条件阻止，并记录在 Home Assistant 自动化跟踪中，不作为扩展可见错误。Webhook 返回通常不携带 Blueprint 动作结果，因此扩展中的“成功”表示 Home Assistant 已接受请求，不代表白名单校验通过、MQTT broker 已收到或 TC002 已显示。README 明确说明应在 HA 自动化跟踪和 MQTT retained topic 中验证后续链路。

## 安全与隐私

- Webhook ID 视为密码，只保存于 `chrome.storage.local`，不写入日志或错误文本；
- Webhook 保持 `local_only: true`；
- Blueprint 只允许设备前缀白名单和固定应用名；
- 扩展不保存或发送 MQTT 凭据；
- 扩展不申请 Cookie 权限，不导出小红书登录态；
- 扩展只发送主页 URL、公开昵称、粉丝数、采集时间、设备前缀和显示 payload；
- 配置页使用 `textContent` 等安全 DOM API，不渲染来自设备或网页的 HTML；
- 所有扩展 JavaScript 随包发布，符合 Manifest V3 禁止远程代码要求。

## 测试与验收

自动化测试覆盖：

1. 小红书粉丝数提取与 URL 规范化；
2. 多设备绑定和旧 Bridge 配置迁移；
3. 动态 origin 权限请求；
4. 浏览器环境设备发现、私网 IP 和响应校验；
5. 52×16 PNG、Logo 和全部固定字模逐像素输出；
6. PNG 编码结果在 Node 与浏览器接口下可解码；
7. Webhook 请求不包含 MQTT 凭据或完整任意 topic；
8. Blueprint 含局域网 POST Webhook、白名单校验、固定 `/custom/<appName>` 和 retained QoS 0 publish；
9. 多设备并发时分别记录成功与失败；
10. ZIP 内容、Manifest V3、版本一致性、SHA-256 和 GPL 文件；
11. 从扩展模拟快照到假设备 HTTP API、假 HA Webhook 的端到端测试；
12. `npm run check` 的测试、语法和发布检查全部通过。

真机验收覆盖：

1. Home Assistant MQTT 集成连接 TC002 使用的同一 broker；
2. Blueprint 一次导入并配置至少两个允许设备前缀；
3. 两台 TC002 分别绑定不同小红书主页；
4. 扩展读取设备配置并向共享 Webhook 提交；
5. HA 自动化跟踪显示两次 `mqtt.publish`；
6. broker retained topic 分别为 `<prefix>/custom/<appName>`；
7. 两台 TC002 显示各自 Logo 和粉丝数；
8. 不在白名单的设备前缀不会产生 MQTT publish。

## 上游提交

完成实现和验证后：

1. 更新应用 README、QUICKSTART、PR 文案与预览说明；
2. 生成扩展 ZIP 和 SHA-256；
3. 在当前功能分支提交所有源码、Blueprint、测试和发布物；
4. 推送到有权限的 GitHub remote；
5. 向 `UlanziTechnology/Ulanzi-U-Clock-TC002` 创建非草稿 PR；
6. PR 明确列出隐私边界、安装流程、测试结果和真机验证证据；
7. Blueprint 一键导入链接以合并后的上游 `main` 文件地址为准。
