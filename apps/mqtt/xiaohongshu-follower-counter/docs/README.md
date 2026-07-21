# TC002 小红书粉丝数：安装与运维

## 工作方式

```text
Chrome 当前登录会话
  → 小红书页面内嵌 JSON / 可见“粉丝”DOM
  → 浏览器内固定像素矩阵 + 52×16 PNG
  → Home Assistant local-only Webhook
  → Home Assistant MQTT 集成
  → <devicePrefix>/custom/<appName>
  → TC002 MQTT/DIY 页面
```

扩展根据用户填写的 **TC002 设备 IP** 请求 `/getBase` 和 `/getMqttConfig`，校验设备返回的 IP、MAC、MQTT 开关、broker 地址、端口和前缀。`devicePrefix` 为设备 `mqtt_prefix` 加下划线和 MAC 后四位。它不保存 MQTT 凭证，设备响应里的用户名和密码不会发送给 Home Assistant。

一个 Blueprint 实例支持多个设备，但只发布到 `allowed_device_prefixes` 白名单。Blueprint 自己构造 topic，扩展不能指定任意 topic 或 `app_name`。

![52×16 渲染预览](../preview/demo.png)

## 前置条件

1. Home Assistant 已安装并启用 **Home Assistant MQTT 集成**，连接到 TC002 使用的同一个 broker。
2. TC002 已在 Ulanzi Studio 中启用 MQTT/DIY；注意某些版本中 DIY 开关会连带影响 MQTT 功能。
3. Chrome 能登录并正常打开目标小红书主页，电脑能访问 TC002 和 Home Assistant。
4. 此项目没有 Chrome Web Store 安装版本，需要开发者模式加载 ZIP 解压目录。

## 导入 Home Assistant Blueprint

[![导入 Blueprint](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2FUlanziTechnology%2FUlanzi-U-Clock-TC002%2Fblob%2Fmain%2Fapps%2Fmqtt%2Fxiaohongshu-follower-counter%2Fblueprint.yaml)

无法使用 My 按钮时，在 Home Assistant 的“设置 → 自动化与场景 → 蓝图 → 导入蓝图”中粘贴手工 Blueprint 导入 URL：

```text
https://github.com/UlanziTechnology/Ulanzi-U-Clock-TC002/blob/main/apps/mqtt/xiaohongshu-follower-counter/blueprint.yaml
```

创建自动化并配置：

- `webhook_id` / **Webhook ID**：24–128 位 URL 安全随机值。macOS / Linux 可运行 `openssl rand -hex 24`；Windows PowerShell 可运行 `[guid]::NewGuid().ToString("N")`。它相当于共享密钥，不要截图、提交或发给他人。
- `allowed_device_prefixes`：每行一个。以下仅为格式示例，不是固定参数：

  ```text
  ulanzi_1be3
  ulanzi_1bd9
  ```

- `app_name`：`custom/` 后的应用名称，默认 `xiaohongshu_followers`，只允许 ASCII 字母、数字、`_` 和 `-`。

最终 topic 公式固定为 `<devicePrefix>/custom/<appName>`。例如前缀与应用名均使用上述示例时，可以得到 `ulanzi_1be3/custom/xiaohongshu_followers`。

## 下载并校验 Chrome 扩展

下载：

- [xiaohongshu-follower-counter-chrome-0.2.0.zip](../release/xiaohongshu-follower-counter-chrome-0.2.0.zip)
- [SHA256SUMS](../release/SHA256SUMS)

当前 SHA-256：

```text
5f499582bae5a766fb0c06d3add63650a54b98eb4f602919751eca532774c769
```

macOS：

```bash
shasum -a 256 ../release/xiaohongshu-follower-counter-chrome-0.2.0.zip
```

Linux：

```bash
sha256sum ../release/xiaohongshu-follower-counter-chrome-0.2.0.zip
```

Windows PowerShell：

```powershell
(Get-FileHash ..\release\xiaohongshu-follower-counter-chrome-0.2.0.zip -Algorithm SHA256).Hash.ToLower()
```

输出必须与 `SHA256SUMS` 一致，然后解压 ZIP。

## 安装、升级和配置 Chrome

1. 打开 `chrome://extensions`，启用“开发者模式”。
2. 点击“加载已解压的扩展程序”，选择 ZIP 解压目录。
3. 打开扩展“详情 → 扩展程序选项”。
4. 填写 Home Assistant URL 和 Blueprint 使用的同一个 Webhook ID。
5. 为每台设备添加一行 TC002 设备 IP和小红书用户主页 URL。
6. 刷新间隔最低和默认值均为 **5 分钟（300 秒）**。保存时 Chrome 只请求 HA 主机和所填 TC002 主机的动态权限。

升级时保留同一个解压目录，用新 ZIP 内容替换旧文件，再在 `chrome://extensions` 点击扩展卡片上的“重新加载”。设备/主页绑定和刷新值会保留。版本 0.1.0 的本地转发地址与令牌会被删除；更短刷新值会自动提升到 300 秒。

每台设备只能出现一次；多台设备可绑定相同主页。主页 URL 保存时移除 query 和 hash，避免持久化临时 `xsec_token`。

### 首次获取设备前缀

如果 Blueprint 尚未允许该设备，HA 会拒绝发布，但扩展设置页“各设备最近结果”仍显示动态发现的 `devicePrefix`。把它复制到 `allowed_device_prefixes` 的新行，保存 HA 自动化，等待下一次刷新。也可根据 TC002 返回的 `mqtt_prefix` 与 MAC 后四位人工核对。

## Webhook 与 MQTT 数据

扩展只向 HA 发送：

```json
{
  "devicePrefix": "ulanzi_1be3",
  "profileUrl": "https://www.xiaohongshu.com/user/profile/<profile-id>",
  "displayName": "示例用户",
  "followerCount": 12800,
  "observedAt": "2026-07-21T12:00:00.000Z",
  "payload": "{\"duration\":31536000,\"text\":[],\"image\":[...],\"draw\":[]}"
}
```

Blueprint 校验前缀、payload 长度和应用名后调用 `mqtt.publish`，使用 QoS 0 和 `retain: true`。渲染内容是固定颜色矩阵的 Logo、数字、`.`、`K` 和 `M`，不是系统字体转像素。

## 验证证据链

1. 扩展设置页：对应设备结果应为 `ok: true`，并显示 `devicePrefix`、昵称、粉丝数和时间。
2. Home Assistant：打开该自动化的**自动化跟踪**，确认 Webhook 已触发、白名单条件通过、`mqtt.publish` 已执行。
3. MQTT broker：订阅精确 topic（例如 `ulanzi_1be3/custom/xiaohongshu_followers`），查看 retained topic 消息；payload 应包含 `data:image/png;base64,iVBOR`。
4. TC002：保持 MQTT/DIY 功能启用并切换到该 Custom App，核对真实屏幕。

`HTTP 2xx` 只表示 HA 接受了 Webhook，并不证明 MQTT 已发布或 TC002 已显示。必须结合自动化跟踪、broker retained 消息和真机画面判断。

## 隐私与安全边界

- 使用当前 Chrome 会话正常访问页面，但不读取 Cookie、不调用 Cookie API、不导出登录态。
- 不绕过登录、验证码、风控、限流或访问控制。
- 不保存 MQTT 凭证，也不把 `/getMqttConfig` 的用户名/密码放入 Webhook。
- 不需要 Home Assistant 长期访问令牌；只保存 local-only Webhook ID。
- Webhook ID、设备 IP、主页绑定和刷新值仅保存在当前电脑的 `chrome.storage.local`。
- 源码与 ZIP 不包含固定电脑 IP、固定主页、MQTT 密码或扩展 ID。

## 故障排查

### 找不到粉丝数

用同一 Chrome 手动打开主页，完成正常登录或安全验证，并确认页面可见“粉丝”数。页面结构变化时可能需要更新解析器。

### `device_unreachable`

确认 TC002 设备 IP正确、电脑与设备在可互访局域网，且浏览器可访问 `http://设备IP/getBase` 和 `/getMqttConfig`。保存配置时应已授予对应主机权限。

### `invalid_device_response` / `invalid_mqtt_config` / `mqtt_disabled`

确认 TC002 返回自己的 IP 和有效 MAC，MQTT 已启用，broker 是有效局域网 IPv4，端口和前缀正确。修正后下一次请求会重新发现。

### `webhook_rejected`

核对 Webhook ID，查看 HA 自动化是否启用。若自动化已触发但条件未通过，复制扩展结果里的 `devicePrefix` 到 `allowed_device_prefixes`，并确认 `app_name` 合法。

### `ha_unreachable`

核对 HA URL、局域网连通性、HTTPS 证书和 Chrome 主机权限。HA URL 不填写 `/api/webhook/...` 路径。

### HA 已触发但设备不显示

在自动化跟踪中检查 `mqtt.publish`；在 broker 查看 retained topic；确认 TC002 使用相同 broker、MQTT/DIY 开关处于开启状态，并打开相同 Custom App 名称。

## 开发验证

需要 Node.js 20+。在 Windows、macOS 或 Linux 的应用目录运行：

```bash
npm test
npm run check
npm run package:extension
```

自动测试包含页面解析、设备发现、固定像素渲染、HA Webhook、Blueprint 合约、真实 loopback HTTP 端到端链路、确定性 ZIP 和发布安全扫描。

## 已知限制

- 这不是小红书官方 API；页面变化可能导致解析失效。
- 页面显示 `K`、`万` 等缩写时只能得到页面公开的约数。
- Chrome 必须运行且登录态有效。
- 正式上游合并仍应附真实 TC002 运行照片或 GIF。

许可证：GPL-3.0-or-later。
