# TC002 小红书粉丝数（纯本地）

## 实现方式

这个应用使用当前电脑上的 Chrome 会话读取用户已经能够访问的小红书主页，并把页面显示的粉丝数发送到 TC002：

```text
Chrome MV3 扩展
  → 页面内嵌 JSON / 可见“粉丝”DOM
  → http://127.0.0.1:<可配置端口>
  → Node.js Bridge 生成 52×16 PNG
  → 用户配置的 MQTT broker/topic
  → TC002 Custom App
```

扩展不读取 Cookie，不申请 `cookies`、`webRequest` 或 `<all_urls>` 权限，不导出登录态，也不绕过验证码或访问限制。发送给 Bridge 的字段只有主页 URL、昵称、粉丝数和采集时间。

![52×16 渲染预览](../preview/demo.png)

> `demo.png` 是软件渲染预览，不是真机照片。向上游正式提交前需要按 [preview/README.md](../preview/README.md) 补充真实 TC002 照片或 GIF。

## 动态配置与支持环境

应用不包含开发电脑专属参数。每台电脑分别配置：

- 小红书主页列表、刷新周期、Bridge URL 和令牌保存在当前电脑的 `chrome.storage.local`；
- MQTT 地址、端口、凭证、TLS、client ID 和 TC002 topic 从当前 Bridge 进程环境变量读取；
- 代码不依赖绝对路径或固定 Chrome 扩展 ID。

支持 Node.js 20+ 以及能够运行 Manifest V3 扩展的 Chrome/Chromium，目标系统为 Windows、macOS 和 Linux。Bridge 没有 npm 第三方运行时依赖。

## 1. 获取代码和检查环境

从仓库根目录进入应用：

```text
apps/mqtt/xiaohongshu-follower-counter
```

检查 Node.js：

```bash
node --version
npm run check
```

`npm run check` 会运行测试、JavaScript 语法检查、扩展版本检查和待提交文件安全扫描。
只运行自动测试时可使用 `npm test`。

## 2. 配置并启动 Bridge

[`.env.example`](../.env.example) 列出了全部配置项，但程序不会自动读取 `.env`，因此不会引入额外依赖。请在每台电脑的终端或进程管理器中设置环境变量，不要修改源代码，也不要提交真实令牌。

用 Node.js 生成本机共享令牌：

```bash
node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"
```

### macOS / Linux（POSIX shell）

```bash
export XHS_BRIDGE_TOKEN="粘贴刚生成的令牌"
export XHS_BRIDGE_PORT="17321"
export MQTT_HOST="192.168.1.10"
export MQTT_PORT="1883"
export MQTT_USERNAME=""
export MQTT_PASSWORD=""
export MQTT_TLS="false"
export MQTT_ALLOW_SELF_SIGNED="false"
export MQTT_CLIENT_ID=""
export TC002_MQTT_TOPIC="替换为当前设备的-custom-app-topic"
npm start
```

### Windows PowerShell

```powershell
$env:XHS_BRIDGE_TOKEN = "粘贴刚生成的令牌"
$env:XHS_BRIDGE_PORT = "17321"
$env:MQTT_HOST = "192.168.1.10"
$env:MQTT_PORT = "1883"
$env:MQTT_USERNAME = ""
$env:MQTT_PASSWORD = ""
$env:MQTT_TLS = "false"
$env:MQTT_ALLOW_SELF_SIGNED = "false"
$env:MQTT_CLIENT_ID = ""
$env:TC002_MQTT_TOPIC = "替换为当前设备的-custom-app-topic"
npm start
```

配置说明：

| 环境变量 | 必填 | 默认值 | 说明 |
|---|:---:|---:|---|
| `XHS_BRIDGE_TOKEN` | 是 | 无 | 当前电脑扩展与 Bridge 共用的随机令牌 |
| `XHS_BRIDGE_PORT` | 否 | `17321` | loopback HTTP 端口 |
| `MQTT_HOST` | 是 | 无 | 当前电脑可访问的 MQTT broker |
| `MQTT_PORT` | 否 | `1883`/`8883` | TCP/TLS 端口 |
| `MQTT_USERNAME` | 否 | 空 | broker 用户名 |
| `MQTT_PASSWORD` | 否 | 空 | broker 密码；使用时同时配置用户名 |
| `MQTT_TLS` | 否 | `false` | `true` 时使用 TLS |
| `MQTT_ALLOW_SELF_SIGNED` | 否 | `false` | 仅用于可信局域网自签名证书 |
| `MQTT_CLIENT_ID` | 否 | 动态生成 | 需要固定 client ID 时设置 |
| `TC002_MQTT_TOPIC` | 是 | 无 | 当前 TC002 Custom App topic，不使用示例固定值 |

Bridge 始终只监听 IPv4 loopback `127.0.0.1`，即使更换电脑也是相同的本机安全边界。端口可以通过 `XHS_BRIDGE_PORT` 修改。

健康检查：

```bash
curl http://127.0.0.1:17321/health
```

应返回：

```json
{"ok":true}
```

## 3. 安装和配置 Chrome 扩展

1. 打开 `chrome://extensions`。
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本应用的 `extension/` 目录。
5. 在自动打开的设置页填写一个或多个完整小红书用户主页 URL。
6. 填写刷新间隔（秒）、当前电脑 Bridge URL，以及与 `XHS_BRIDGE_TOKEN` 一致的令牌。
7. 保存后观察“最近结果”。

主页 URL 保存时会移除 query 和 hash，避免持久化临时 `xsec_token`。刷新间隔最低为 5 秒，默认 30 秒；5 秒仅建议短期联调，长期运行建议使用 60 秒以上，减少触发登录验证或限流的概率。旧版分钟配置会在扩展升级后自动换算为秒。

秒级调度使用 Chrome `alarms` 的 fractional minutes。仓库要求的“加载已解压的扩展程序”模式允许 5 秒周期；如果未来把扩展正式打包分发，Chrome 可能将周期限制为至少 30 秒。系统休眠、页面加载和浏览器调度也可能造成实际触发延迟。

## 4. 数据与 MQTT 格式

扩展调用：

```http
POST /v1/follower-count
Authorization: Bearer <当前电脑共享令牌>
Content-Type: application/json
```

```json
{
  "profileUrl": "https://www.xiaohongshu.com/user/profile/<profile-id>",
  "displayName": "示例用户",
  "followerCount": 116000,
  "observedAt": "2026-07-14T12:00:00.000Z"
}
```

页面显示 `11.6万` 时会标准化为 `116000`，这是页面公开的约数，不代表平台内部精确到个位的粉丝数。

Bridge 发布 retained QoS 0 MQTT 消息：

```json
{
  "duration": 31536000,
  "text": [],
  "image": [{"data": "data:image/png;base64,...", "position": [0, 0]}],
  "draw": []
}
```

topic 完全来自当前电脑的 `TC002_MQTT_TOPIC`，源码中没有绑定某台设备。

## 5. 手工分段验证

先验证 Bridge 到 MQTT：

```bash
curl -X POST http://127.0.0.1:17321/v1/follower-count \
  -H "Authorization: Bearer $XHS_BRIDGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"profileUrl":"https://www.xiaohongshu.com/user/profile/demo","displayName":"Demo","followerCount":12800,"observedAt":"2026-07-14T12:00:00.000Z"}'
```

Windows PowerShell 可使用 `Invoke-RestMethod` 发送相同 JSON。成功响应包含 `published: true`、当前 topic 和 `followerCount`。

再加载扩展并配置一个当前 Chrome 能正常打开的主页。扩展状态成功但 TC002 不显示时，使用 broker 自带的订阅工具观察 `TC002_MQTT_TOPIC`，并确认设备当前启用了对应 Custom App。

## 故障排查

### `Follower count was not found`

- 手动打开目标主页，确认页面确实显示“粉丝”数字。
- 在同一 Chrome 配置中完成登录、验证码或安全验证。
- 页面结构可能变化；项目不会通过签名破解、代理池或验证码绕过处理。

### `unauthorized`

扩展设置中的令牌与当前 Bridge 进程的 `XHS_BRIDGE_TOKEN` 不一致。重新生成并在两处填写同一个值。

### Bridge 启动提示 `TC002_MQTT_TOPIC is required`

必须填写当前设备实际使用的 Custom App topic。项目故意不提供一个可能误投到其他设备的固定 topic。

### `mqtt_publish_failed`

- 检查 `MQTT_HOST`、`MQTT_PORT`、用户名、密码和 TLS；
- 确认当前电脑能够访问 broker；
- 自签名证书只在可信局域网中按需启用；
- 检查 TC002 固件所需的 topic 前缀和 Custom App payload 版本。

## 已知问题

- 这是页面适配器，不是小红书官方 API；页面变化时可能需要更新解析器。
- 页面给出缩写时只能获得约数。
- Chrome 和 Bridge 必须在刷新期间运行。
- TC002 MQTT 规范仍可能随固件演进。
- 正式上游 PR 仍需要真实 TC002 运行照片或 GIF。

## 许可证

GPL-3.0-or-later。分发修改版时保留许可证、版权和修改说明。
