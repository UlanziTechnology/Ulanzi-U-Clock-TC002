# TC002 小红书粉丝数（纯本地）

## 实现方式

扩展使用当前电脑已有的 Chrome 登录会话，读取用户能正常访问的小红书主页。每台 TC002 在扩展设置页绑定一个主页：

```text
Chrome MV3 扩展（设备 IP + 主页 URL）
  → 页面内嵌 JSON / 可见“粉丝”DOM
  → http://127.0.0.1:<可配置端口>
  → Bridge 读取 TC002 /getBase 与 /getMqttConfig
  → 生成 52×16 PNG
  → [设备前缀]_[MAC 后四位]/custom/display
  → TC002 DIY 模块
```

扩展不读取 Cookie，不申请 `cookies`、`webRequest` 或 `<all_urls>` 权限，不导出登录态，也不绕过验证码或访问限制。它只向本机 Bridge 发送设备 IP、规范化主页 URL、昵称、粉丝数和采集时间。Bridge 不向 Chrome 返回设备的 MQTT 凭证。

![52×16 渲染预览](../preview/demo.png)

> `demo.png` 是软件渲染预览，不是真机照片。向上游正式提交前需要按 [preview/README.md](../preview/README.md) 补充真实 TC002 照片或 GIF。

## 动态配置与支持环境

源码不包含开发电脑专属 IP、主页、broker、MAC、topic 或扩展 ID。设备绑定、刷新周期、Bridge URL 和令牌保存在当前电脑的 `chrome.storage.local`。Bridge 根据每次请求的 TC002 设备 IP 动态读取局域网配置，发现结果在内存缓存 5 分钟；发布失败时会强制重新发现一次。

支持 Node.js 20+、Windows、macOS、Linux，以及能够运行 Manifest V3 扩展的 Chrome/Chromium。Bridge 没有 npm 第三方运行时依赖。

## 1. 获取代码和检查环境

从仓库根目录进入 `apps/mqtt/xiaohongshu-follower-counter`，然后运行：

```bash
node --version
npm run check
```

`npm run check` 包含 `npm test`、JavaScript 语法检查、扩展版本检查和发布安全扫描。

## 2. 配置并启动 Bridge

用 Node.js 生成当前电脑的共享令牌：

```bash
node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"
```

macOS / Linux：

```bash
export XHS_BRIDGE_TOKEN="粘贴刚生成的令牌"
export XHS_BRIDGE_PORT="17321"
npm start
```

Windows PowerShell：

```powershell
$env:XHS_BRIDGE_TOKEN = "粘贴刚生成的令牌"
$env:XHS_BRIDGE_PORT = "17321"
npm start
```

正常流程只需要 `XHS_BRIDGE_TOKEN`；`XHS_BRIDGE_PORT` 默认是 `17321`。Bridge 始终只监听 `127.0.0.1`。健康检查：

```bash
curl http://127.0.0.1:17321/health
```

应返回 `{"ok":true}`。

[`.env.example`](../.env.example) 还列出一期兼容用的旧参数。只有旧扩展请求不含设备 IP 时，才可成对设置 `MQTT_HOST` 与 `TC002_MQTT_TOPIC`；`MQTT_PORT`、`MQTT_USERNAME`、`MQTT_PASSWORD`、`MQTT_TLS`、`MQTT_ALLOW_SELF_SIGNED` 和 `MQTT_CLIENT_ID` 也仅服务于这个回退。新安装不要配置它们。

## 3. 安装和配置 Chrome 扩展

1. 打开 `chrome://extensions` 并开启“开发者模式”。
2. 点击“加载已解压的扩展程序”，选择本应用的 `extension/` 目录。
3. 在设置页为每台设备添加一行：填写 **TC002 设备 IP** 和该设备绑定的小红书主页 URL。
4. 填写刷新间隔（秒）、本机 Bridge URL 和与 `XHS_BRIDGE_TOKEN` 一致的共享令牌。
5. 保存，把 TC002 切换到 Ulanzi Studio 的 DIY 模块，观察“各设备最近结果”。

每台设备只能出现一次；多个设备可以绑定同一主页。设备 IP 仅允许 `10/8`、`172.16/12`、`192.168/16` 局域网 IPv4。旧版 `profileUrls` 会迁移成待补设备 IP 的绑定行，不会猜测本机网络参数。

主页 URL 保存时会移除 query 和 hash，避免持久化临时 `xsec_token`。刷新间隔最低和默认值均为 5 分钟（300 秒），已有的更短设置会在升级后自动提升到 300 秒，以降低触发小红书风控或账号屏蔽的风险。旧版分钟配置会自动换算为秒并应用同一最低限制。

## 4. 数据与 MQTT 格式

扩展向 Bridge 发送：

```http
POST /v1/follower-count
Authorization: Bearer <当前电脑共享令牌>
Content-Type: application/json
```

```json
{
  "deviceIp": "192.168.1.42",
  "profileUrl": "https://www.xiaohongshu.com/user/profile/<profile-id>",
  "displayName": "示例用户",
  "followerCount": 116000,
  "observedAt": "2026-07-14T12:00:00.000Z"
}
```

页面显示 `11.6万` 时会标准化为 `116000`，这是页面公开约数。Bridge 校验设备返回的 IP、12 位 MAC、MQTT 开关、局域网 broker、端口和前缀，然后发布 retained QoS 0 消息到：

```text
[mqtt_prefix]_[MAC 后四位]/custom/display
```

例如设备前缀为 `ulanzi`、MAC 末四位为 `1bd9`，topic 就是 `ulanzi_1bd9/custom/display`。payload 是 TC002 DIY 图片结构：

```json
{
  "duration": 31536000,
  "text": [],
  "image": [{"data": "data:image/png;base64,...", "position": [0, 0]}],
  "draw": []
}
```

## 5. 手工验证

把设备 IP 替换成当前 TC002 的真实局域网 IP：

```bash
curl -X POST http://127.0.0.1:17321/v1/follower-count \
  -H "Authorization: Bearer $XHS_BRIDGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deviceIp":"192.168.1.42","profileUrl":"https://www.xiaohongshu.com/user/profile/demo","displayName":"Demo","followerCount":12800,"observedAt":"2026-07-14T12:00:00.000Z"}'
```

成功响应包含 `published: true`、`deviceIp`、动态 topic 和 `followerCount`。在 MQTT 后台订阅 `[前缀]_[MAC后四位]/custom/display` 可查看 retained 消息证据。

## 故障排查

### `Follower count was not found`

- 用同一 Chrome 手动打开目标主页，确认页面显示“粉丝”数字。
- 完成登录、验证码或安全验证；项目不会绕过这些限制。

### `unauthorized`

扩展令牌与 Bridge 的 `XHS_BRIDGE_TOKEN` 不一致。

### `device_unreachable`

- 确认扩展填写的是 TC002 当前局域网 IP，电脑能访问 `http://设备IP/getBase`。
- 确认电脑与设备之间没有访客网络隔离或防火墙阻断。

### `invalid_device_response` / `invalid_mqtt_config` / `mqtt_disabled`

- 在 Ulanzi Studio 中保存并启用设备 MQTT 设置。
- broker 必须是设备与当前电脑可访问的局域网 IPv4。
- 修正配置后等待最多 5 分钟，或重启 Bridge 清空发现缓存。

### `mqtt_publish_failed`

Bridge 已自动清除该设备缓存并重新发现一次。仍失败时，检查 broker 是否运行、账号密码是否正确，并确认设备处于 DIY 模块。

## 已知问题

- 这是页面适配器，不是小红书官方 API；页面变化时可能需要更新解析器。
- 页面给出缩写时只能获得约数。
- Chrome 和 Bridge 必须在刷新期间运行。
- TC002 HTTP/MQTT 规范仍可能随固件演进。
- 正式上游 PR 仍需要真实 TC002 运行照片或 GIF。

## 许可证

GPL-3.0-or-later。分发修改版时保留许可证、版权和修改说明。
