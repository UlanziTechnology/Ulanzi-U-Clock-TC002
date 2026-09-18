# Ulanzi TC002 HTTP & MQTT Protocol / TC002 HTTP 与 MQTT 协议

> Applies to official Ulanzi TC002 firmware. / 适用于 Ulanzi TC002 官方原厂固件。
>
> TC002 is a **52×16 RGB pixel desktop clock** with a local HTTP API and MQTT topics, for integration with Home Assistant, Node-RED and custom scripts. / TC002 是一块 **52×16 RGB 像素桌面时钟**，本地开放 HTTP API 与 MQTT topic，可接入 Home Assistant、Node-RED 或自研脚本。

---

## 1. Overview / 总览

| | HTTP | MQTT |
|---|---|---|
| Connection / 连接 | LAN, `http://<device-ip>` / 局域网 | A broker reachable by both device and clients |
| Custom app push / 推送画面 | `POST /api/custom?name=<app>` | Publish to `[PREFIX]/custom/[APP_NAME]` |
| Payload format / 数据格式 | Identical to MQTT / 与 MQTT 完全一致 | Identical to HTTP / 与 HTTP 完全一致 |
| Use case / 适用场景 | One-shot push, device config / 一次性推送、设备配置 | Continuous state, automation, retain |

**Topic prefix (`PREFIX`)** = `mqtt_prefix` + `"_"` + **last two characters of the MAC address**. Example: prefix `ulanzi`, MAC ending `e5f6` → `ulanzi_e5f6`. / 前缀规则：`mqtt_prefix` + `"_"` + MAC 地址后两位。例如前缀 `ulanzi`、MAC 尾号 `e5f6` → `ulanzi_e5f6`。

---

## 2. Protocol Feature Summary / 协议功能清单汇总

### 2.1 HTTP API Summary / HTTP 接口总表

| # | Feature / 功能 | Method / 方法 | Path / 路径 | Notes / 说明 |
|---|---|---|---|---|
| 1 | Device info / 设备信息 | GET | `/getBase` | `devSn / ssid / ip / mac / mcuVer / appVer` |
| 2 | Global config / 全局配置 | POST | `/setConfig` | Merge semantics; unset fields keep their value / 字段合并，未传保持原值 |
| 3 | WiFi config / WiFi 配置 | POST | `/setWifiConfig` | `ssid` required (1–32 chars); async acceptance / 异步受理 |
| 4 | Social config (get) / 社媒配置获取 | GET | `/getSocial` | `socialInfos` + `socialOrder` |
| 5 | Social config (set) / 社媒配置设置 | POST | `/setSocial` | Weibo/YouTube/Instagram need OAuth token |
| 6 | Calendar config (get) / 日程配置获取 | GET | `/getCalendar` | CalDAV / ICS subscription |
| 7 | Calendar config (set) / 日程配置设置 | POST | `/setCalendar` | Same as above |
| 8 | Tools config (get) / 工具配置获取 | GET | `/getToolsConfig` | Clock/Weather/BUSY/Tomato/Scoreboard/... |
| 9 | Tools config (set) / 工具配置设置 | POST | `/setToolsConfig` | Same as above |
| 10 | MQTT config (get) / MQTT 配置获取 | GET | `/getMqttConfig` | Broker, prefix, HA discovery switch |
| 11 | MQTT config (set) / MQTT 配置设置 | POST | `/setMqttConfig` | Same as above |
| 12 | Custom app create/update/delete / Custom App 创建/更新/删除 | POST | `/api/custom?name=<app>` | Empty body or `{}` = delete |
| 13 | Custom app list / Custom App 列表 | GET | `/api/customList` | Returns `apps` + `count` |
| 14 | Switch custom app / 切换 Custom App | POST | `/api/switchDiyApp?name=<app>` | Firmware V1.1.0+; dynamic apps only, case-sensitive |
| 15 | Simulate key / knob / 模拟按键/旋钮 | POST | `/keyEvent` | `event: shortPress/longPress/cw/ccw` |
| 16 | Jump to built-in app / 应用跳转 | POST | `/switchApp` | `type` + `index` |
| 17 | DIY images batch / DIY 图片批量操作 | POST | `/setDiyImages` | Upload (base64, one by one) / delete / enable |
| 18 | DIY image list / DIY 图片列表 | GET | `/getDiyImages` | Scans `/data/diy/` |
| 19 | DIY image download / DIY 图片下载 | GET | `/diyFile?index=N` | Raw binary (PNG/GIF) |
| 20 | Set serial number / 设置序列号 | POST | `/setSn` | Plain-text body, 1–17 chars |
| 21 | Firmware check / 固件检查 | GET | `/checkUpdate` | Requires valid login token |
| 22 | Firmware update / 固件升级 | POST | `/update` | `downloadUrl / md5 / size`; 200 = task started only |
| 23 | Bluetooth switch / 蓝牙开关 | POST | `/setBluetooth` | `{"enable":true/false}` |
| 24 | Factory reset / 重置设备 | POST | `/resetConfig` | Deletes config + DIY files, auto reboot |

### 2.2 MQTT Topic Summary / MQTT Topic 总表

**Device → client (pushed by device) / 设备 → 客户端（设备主动推送）**

| Topic | Trigger / 触发时机 | Payload / 内容 |
|---|---|---|
| `[PREFIX]/status` | Connect / disconnect / 连接或断开 | `online` / `offline` |
| `[PREFIX]/getBase` | Once after connecting to broker (also on reboot) / 连接成功后推送一次（重启也推） | Device base info JSON |
| `[PREFIX]/customList` | After each custom app add/delete / Custom App 增删后 | `{"apps":[{"appName":"weather"},...],"count":2}` |

**Client → device (subscribed by device, no response) / 客户端 → 设备（设备订阅处理，无响应）**

| Topic | Purpose / 作用 |
|---|---|
| `[PREFIX]/custom/[APP_NAME]` | Create / update / delete custom app（empty message or `{}` = delete）/ 创建、更新、删除 Custom App |
| `[PREFIX]/switchDiyApp` | Switch custom app, payload `{"name":"<app>"}` (V1.1.0+) / 切换 Custom App |

**Home Assistant auto discovery / HA 自动发现**

| Topic | Notes / 说明 |
|---|---|
| `homeassistant/device/[PREFIX]/config` | Discovery message; controlled by `isHADiscoveryEnabled`, **default false** / 由该开关控制，默认关闭 |

### 2.3 App Categories & Index Rules / 应用类别与索引规则

| Category / 类别 | Valid indices / 合法 index | Notes / 说明 |
|---|---|---|
| `social` | 1–9 | 小红书1, 抖音2, bilibili3, 微博4, youtube5, instagram6, facebook7, tiktok8, x9 |
| `calendar` | 1–6 | 飞书1, 钉钉2, 企业微信3, Google4, iCloud5, Outlook6 |
| `diy` | 0–20 (host) / 100–120 (HA) | Dynamic — must include every uploaded index / 动态 index |
| `tools` | 1–9 | 时钟1, 天气2, BUSY3, 计分板4, 番茄钟5, 秒表6, 电量7, 拾音灯8, IP 显示9 |

- App enable/disable is controlled by the `enable` field in each config object; display order by the category's `xxxOrder` array. / 应用启停由各配置对象的 `enable` 字段控制，显示顺序由 `xxxOrder` 数组决定。
- **`xxxOrder` must contain all valid indices of the category**; otherwise the API returns 400. / `xxxOrder` 必须包含该类别全部合法 index，否则返回 400。

---

## 3. Custom App Push (HTTP & MQTT) / Custom App 推送

### 3.1 Create / Update / Delete / 创建 / 更新 / 删除

| | HTTP | MQTT |
|---|---|---|
| Create / update / 创建更新 | `POST /api/custom?name=<appName>` | Publish to `[PREFIX]/custom/<APP_NAME>` |
| Delete / 删除 | Same endpoint, empty body or `{}` / 空 body 或 `{}` | Empty message or `{}` |
| Success / 成功响应 | `{"code":200,"message":"ok"}` | No response (fire and forget) |

Payload is identical for both transports / 两种传输的 payload 一致：

```json
{
  "text":  [...],
  "image": [...],
  "draw":  [...]
}
```

> Pushing content does **not** switch the app — the device must already be showing that custom app. Remote switching: see 3.3. / 推送画面不会自动切换 App，设备需已停留在该页面；远程切换见 3.3。

### 3.2 List Custom Apps / 查看 Custom App 列表

| | HTTP | MQTT |
|---|---|---|
| Path / Topic | `GET /api/customList` | Device pushes to `[PREFIX]/customList` on add/delete |

```json
// HTTP response
{ "apps": ["weather", "clock", "myApp"], "count": 3 }
// MQTT push
{ "apps": [{"appName":"weather"},{"appName":"clock"}], "count": 2 }
```

### 3.3 Switch to a Custom App / 切换到指定 Custom App（固件 V1.1.0+）

Only for custom apps created dynamically via HTTP/MQTT (not file-based DIY apps); `appName` is exact and case-sensitive. / 仅支持动态创建的 Custom App（不支持文件型 DIY App）；名称精确匹配、区分大小写。

```bash
curl -X POST "http://<device-ip>/api/switchDiyApp?name=weather"
```

| Result / 结果 | Notes / 说明 |
|---|---|
| HTTP 200 | Request accepted, enters DIY level-2 display / 已接受 |
| HTTP 400 | Missing `name` |
| HTTP 404 | App not found or unavailable |

MQTT equivalent: publish `{"name":"weather"}` to `[PREFIX]/switchDiyApp` (invalid JSON, empty name or missing app = no switch, only logged). / MQTT 等价发布。

---

## 4. Payload Reference / Payload 字段参考

### 4.1 `text` array / 文本元素

```json
"text": [
  {
    "content": "Hello World",
    "fontHeight": 10,
    "x": 0,
    "y": 0,
    "color": "#FFFFFF",
    "align": "left",
    "valign": "top",
    "rect": [0, 0, 52, 16],
    "charSpacing": 1
  }
]
```

| Field / 字段 | Type / 类型 | Default / 默认 | Notes / 说明 |
|---|---|---|---|
| `content` | string | required | **ASCII visible chars only (0x20–0x7E)**; no Chinese / Unicode |
| `fontHeight` | int | `10` | Only `5` or `10` / 仅 5 或 10 |
| `x` / `y` | int | `-1000` | Relative to `rect`; `<= -999` falls back to align/valign / 相对 rect 坐标，≤-999 时由对齐决定 |
| `color` | string | `#FFFFFF` | `#RRGGBB`, no alpha |
| `align` | string | `left` | `left` / `center` / `right` (used when `x <= -999`) |
| `valign` | string | `top` | `top` / `middle` / `bottom` (used when `y <= -999`) |
| `rect` | array | `[0,0,52,16]` | Render area `[x, y, w, h]`; out-of-range is clipped / 渲染区域，超出裁剪 |
| `charSpacing` | int | `1` | 0–10 px |

**Centered text / 居中文字：**
```json
{ "text": [
  { "content": "HELLO", "fontHeight": 10, "align": "center", "valign": "middle", "color": "#FFFFFF" }
]}
```

**Two lines / 两行文字：**
```json
{ "text": [
  { "content": "FRONT", "fontHeight": 10, "x": 0, "y": 0,  "color": "#FFFFFF" },
  { "content": "DOOR",  "fontHeight": 5,  "x": 0, "y": 10, "color": "#FFCB52" }
]}
```

### 4.2 `image` array / 图像元素

```json
"image": [
  { "data": "data:image/png;base64,...", "position": [0, 0] }
]
```

- Formats: PNG, GIF (base64 Data URL). `position` is `[x, y]`, default `[0, 0]`. / 支持 PNG、GIF；position 默认 [0,0]。
- Still image max 512×512; GIF max 256×256, ≤50 frames; base64 ≤ 60 KB. / 静态图最大 512×512；GIF 最大 256×256、≤50 帧；base64 后 ≤60KB。
- Images larger than 52×16 are clipped from the top-left, **not scaled**; PNG alpha is ignored (blended with black). / 超出 52×16 左上角裁剪不缩放；PNG alpha 忽略。
- Max 6 image elements per app (≤3 GIF + ≤3 PNG). / 单个 App 最多 6 个图像元素。

### 4.3 `draw` array / 绘图指令

```json
"draw": [
  { "dp":  [x, y, color] },
  { "dl":  [x0, y0, x1, y1, color] },
  { "dr":  [x, y, w, h, color] },
  { "df":  [x, y, w, h, color] },
  { "dc":  [x, y, r, color] },
  { "dfc": [x, y, r, color] },
  { "dt":  [x, y, text, color] },
  { "db":  [x, y, w, h, [bmp]] }
]
```

| Command / 指令 | Params / 参数 | Notes / 说明 |
|---|---|---|
| `dp` | `[x, y, color]` | Single pixel / 画点 |
| `dl` | `[x0,y0,x1,y1,color]` | Line (Bresenham) / 画直线 |
| `dr` | `[x,y,w,h,color]` | Rectangle outline / 空心矩形 |
| `df` | `[x,y,w,h,color]` | Filled rectangle / 填充矩形 |
| `dc` | `[x,y,r,color]` | Circle outline / 空心圆 |
| `dfc` | `[x,y,r,color]` | Filled circle / 填充圆 |
| `dt` | `[x,y,text,color]` | Text, fixed 10px, ASCII only / 画文字（固定 10px，仅 ASCII） |
| `db` | `[x,y,w,h,[bmp]]` | RGB888 bitmap, values `0x00RRGGBB` (high byte ignored); length must equal `w*h` / 位图 |

- Colors are `#RRGGBB`, no alpha; max 32 draw commands per app. / 颜色无 alpha；单个 App 最多 32 条指令。
- All coordinates are absolute, origin at top-left; out-of-screen content is clipped silently. / 绝对坐标，原点左上角，超界自动裁剪。

---

## 5. System Control API (HTTP) / 系统控制接口

Runs on the device's local web server (`http://<device-ip>`). / 运行在设备本地 web 服务器。

### 5.1 Global Config / 全局配置 `POST /setConfig`

Passed fields are merged into the existing config; unset fields keep their value. / 传入字段合并，未传保持原值。

```json
{
  "brightness": { "level": "mid", "low": 20, "mid": 60, "high": 100 },
  "volume": 3,
  "timezone": "UTC+8",
  "scrollSpeed": 7,
  "carouselSpeed": 60,
  "dateFormat": "MM/DD",
  "showWeek": true,
  "weekStart": 1,
  "lowBatteryAutoSleep": false
}
```

| Field / 字段 | Range / 范围 | Notes / 说明 |
|---|---|---|
| `brightness.level` | `low`/`mid`/`high` | Active level; low/mid/high are percents 5–100, must be ascending / 生效档位，须递增 |
| `volume` | `0–6` | 0=mute, 6=max / 0=静音 |
| `timezone` | `"UTC-12"`–`"UTC+12"` | Hour steps / 整小时步进 |
| `scrollSpeed` | `0–10` | 0=scroll off, 10=fastest |
| `carouselSpeed` | `0` or seconds | 0=carousel off; suggested 10/15/20/30/60 |
| `dateFormat` | `"MM/DD"` / `"DD/MM"` | Date display format |
| `showWeek` | `true`/`false` | Show weekday on clock |
| `weekStart` | `0`/`1` | 0=Sunday first; other=Monday first |
| `lowBatteryAutoSleep` | `true`/`false` | Auto sleep on low battery |

Success: `{"code":200,"message":"Settings saved successfully"}`

### 5.2 WiFi Config / WiFi 配置 `POST /setWifiConfig`

```json
{ "ssid": "MyWifi", "password": "12345678" }
```

- `ssid` required, 1–32 chars after trimming; `password` optional, 0–64 chars. / ssid 必填，password 可选。
- **Async**: `{"code":200,"message":"WiFi config accepted","data":{"ssid":"...","accepted":true}}` only means accepted, not connected. / 异步受理，不代表联网成功。

### 5.3 Social Config / 社媒配置 `GET /getSocial` · `POST /setSocial`

```json
{
  "socialInfos": {
    "xhs":    { "uid": "xxxxx", "token": "", "enable": true },
    "douyin": { "uid": "xxxxx", "token": "", "enable": true },
    "bilibili":{ "uid": "xxxxx", "token": "", "enable": true },
    "weibo":  { "uid": "xxxxx", "token": "<oauth_token>", "enable": true },
    "youtube":{ "uid": "xxxxx", "token": "", "enable": false },
    "instagram": { "uid": "xxxxx", "token": "", "enable": false },
    "facebook":{ "uid": "xxxxx", "token": "", "enable": false },
    "tiktok": { "uid": "xxxxx", "token": "", "enable": false },
    "x":      { "uid": "xxxxx", "token": "", "enable": false }
  },
  "socialOrder": [1, 2, 3, 4, 5, 6, 7, 8, 9]
}
```

- Platforms needing an OAuth token: **Weibo, YouTube, Instagram**; others may leave it empty. / 需鉴权的平台：微博、YouTube、Instagram。
- Only platforms present in the request are updated; to toggle one, sending `{"socialInfos":{"xhs":{"enable":true}}}` is enough. / 只更新传入平台；仅开关可只传 enable。
- `socialOrder` must contain all 9 indices (else 400). / 须含全部 9 个 index。

### 5.4 Calendar Config / 日程配置 `GET /getCalendar` · `POST /setCalendar`

```json
{
  "calnedarInfos": {
    "feishu":  { "username": "x", "password": "x", "server": "", "enable": true },
    "dingding":{ "username": "x", "password": "x", "server": "", "enable": true },
    "wecom":   { "username": "x", "password": "x", "server": "", "enable": false },
    "google":  { "url": "https://...", "enable": false },
    "icloud":  { "username": "x", "password": "x", "server": "", "enable": false },
    "outlook": { "url": "https://...", "enable": false }
  },
  "calnedarOrder": [1, 2, 3, 4, 5, 6]
}
```

- CalDAV type (Feishu/DingTalk/WeCom/iCloud): `username` + `password` + `server`; URL-subscription type (Google/Outlook): `url` (ICS address). / CalDAV 与 URL 订阅两类字段。
- Note: the JSON keys are `calnedarInfos` / `calnedarOrder` as documented by the device. / 键名以设备端实际接受的为准。

### 5.5 DIY Images / DIY 图片 `POST /setDiyImages` · `GET /getDiyImages` · `GET /diyFile?index=N`

**Upload one (with base64) / 上传单张：**
```json
{ "images": [ { "index": 1, "base64": "data:image/gif;base64,...", "enable": true } ] }
```

**Batch delete / toggle / 批量删除或启停：**
```json
{ "images": [ { "index": 3 }, { "index": 4, "enable": false }, { "index": 5, "enable": true } ],
  "imageOrder": [1, 2, 3, 4, 5], "enable": true }
```

- Every object must contain `index`; no `base64` and no `enable` = delete the file. / 无 base64 且无 enable = 删除。
- Top-level `enable`: `false` hides all DIY; `true` follows each image's own `enable`. / 顶层 enable 控制整体显示。
- `imageOrder` (optional) must include all uploaded indices. / 可选，须含全部已上传 index。
- **Images with base64 must be sent one at a time** (at most one base64 object per request); delete/toggle can be batched. / 含 base64 必须逐个下发；删除/启停可批量。
- `GET /getDiyImages` scans `/data/diy/`, returns `images[]` (`index/format/enable`) + `imageOrder` + `enable`.
- `GET /diyFile?index=N` returns the raw binary (`Content-Type: image/png|gif`), no base64 needed. / 返回原始二进制。

### 5.6 Tools Config / 工具配置 `GET /getToolsConfig` · `POST /setToolsConfig`

```json
{
  "toolsInfos": {
    "weather": {
      "city": "北京", "lat": "39.9042", "lon": "116.4074", "token": "your_api_key",
      "displayInfo": { "displayTemperature": true, "displayHumidity": true,
                       "displayPressure": false, "displayAqi": true },
      "enable": true
    },
    "clock":     { "timeFormat": "HH:MM AP", "enable": true },
    "busy":      { "focusTime": "30", "relaxTime": "5", "enable": true },
    "tomato":    { "focusTime": "10", "relaxTime": "10", "enable": false },
    "scoreboard":{ "enable": false },
    "stopwatch": { "enable": false },
    "battery":   { "enable": false },
    "soundlight":{ "enable": false },
    "ipshow":    { "enable": false }
  },
  "toolsOrder": [1, 2, 3, 4, 5, 6, 7, 8, 9]
}
```

- `clock.timeFormat`: `HH:MM` / `HH:MM:SS` / `HH:MM AP`.
- `weather`: `city` OR `lat`+`lon` (coordinates win if both set); `token` = OpenWeather API key (empty = server default); at least one `displayInfo` item must be `true`. / city 与经纬度二选一；displayInfo 至少一项为 true。
- `busy`: `focusTime` ∈ {"45","30","60"} (default "30"), `relaxTime` ∈ {"10","5","15"} (default "5").
- `tomato`: `focusTime` ∈ {"15","10","25"} (default "10"), `relaxTime` ∈ {"5","10","15"} (default "10"); focus/rest auto-rotate; short-press middle = pause/resume, long-press = reset to focus. / 专注休息自动轮换，中键暂停/恢复、长按重置。
- scoreboard/stopwatch/battery/soundlight/ipshow: only `enable`. / 仅需 enable。
- `toolsOrder` must contain all 9 indices (else 400). / 须含全部 9 个 index。

### 5.7 MQTT Config / MQTT 配置 `GET /getMqttConfig` · `POST /setMqttConfig`

```json
{ "isMqtt": true, "ip": "192.168.1.1", "port": "1883",
  "mqtt_name": "xxx", "mqtt_pwd": "xxx",
  "mqtt_prefix": "ulanzi", "isHADiscoveryEnabled": true }
```

| Field / 字段 | Required / 必填 | Notes / 说明 |
|---|---|---|
| `isMqtt` | yes | Master switch; if false the rest may be omitted / 总开关 |
| `ip` | when enabled | Broker address (IP or domain) / 地址 |
| `port` | when enabled | Broker port / 端口 |
| `mqtt_name` / `mqtt_pwd` | no | Username / password / 账号密码 |
| `mqtt_prefix` | no | Default `ulanzi`; actual prefix = prefix + `_` + MAC last-2 / 前缀 |
| `isHADiscoveryEnabled` | no | HA discovery, **default false** / 默认关闭 |

### 5.8 Device Info & Serial Number / 设备信息与序列号

`GET /getBase`:
```json
{ "devSn": "xxxxx", "ssid": "TP_LINK", "ip": "192.168.1.1",
  "mac": "a1b2c3d4e5f6", "mcuVer": "V0.0.1", "appVer": "V1.4.0" }
```

`POST /setSn`: `Content-Type: text/plain`, body is the raw SN string (not JSON), 1–17 chars; persisted, effective after reboot, verify via `getBase.devSn`. / 纯文本 body，1–17 字符。

### 5.9 Simulate Key / Knob / 模拟按键与旋钮 `POST /keyEvent`

High-level event model: the host decides whether an action is a short press, long press or rotation; the device executes the matching logic. / 高层事件模型，由上位机判断事件类型。

```json
{ "event": "shortPress", "key": "middle", "source": "pc" }
```

| Field / 字段 | Values / 取值 |
|---|---|
| `event` | `shortPress` / `longPress` / `cw` / `ccw` |
| `key` | `left` / `middle` / `right` / `knob` |
| `source` | optional (`pc`/`web`), logging only / 仅日志用 |

- Previous/next page = `shortPress` on `right`/`left`, or `cw`/`ccw` on `knob`. / 上一页下一页的模拟方式。
- Long press needs **no down/up pairing**: while held, resend `longPress` every ~150–200 ms; each message executes the long-press logic once. / 长按按 150–200ms 周期重复发送。
- Success: `{"code":200,"message":"event accepted"}`; bad params: 400.

### 5.10 Jump to a Built-in App / 应用跳转 `POST /switchApp`

```json
{ "type": "tools", "index": 3 }
```

- `type`: `social` / `calendar` / `diy` / `tools`; `index` must be valid for the category (see 2.3). / type 与 index 须合法。
- Validation order: type → index → app enabled; disabled app returns 404 `app not found or disabled`. / 未启用返回 404。
- Success: `{"code":200,"message":"app switched","data":{"type":"tools","index":3}}`

### 5.11 Firmware OTA / 固件升级 `GET /checkUpdate` · `POST /update`

- `GET /checkUpdate`: queries the cloud for new firmware, **requires a valid login token**; response is passed through from the cloud (`hasUpdate / ver / downloadUrl1 / md5 / size`). / 需登录鉴权。
- `POST /update`:
  ```json
  { "downloadUrl": "https://.../v1.5.0.img", "md5": "abc123def456", "size": 2097152 }
  ```
  HTTP 200 only means the task started, not success; during update the screen shows a progress icon and HTTP returns "updating"; device reboots automatically when done. / 200 仅表示任务已启动。

### 5.12 Bluetooth & Reset / 蓝牙与重置

- `POST /setBluetooth`: `{"enable":true|false}`; takes effect immediately; **BLE provisioning is unavailable while off**. / 关闭后 BLE 配网不可用。
- `POST /resetConfig`: no body. Deletes `/data/setting.ini`, clears `/data/diy`, then reboots; all config returns to defaults. / 恢复出厂设置。

---

## 6. MQTT Topics Detail / MQTT 主题详情

### 6.1 Device → Client / 设备 → 客户端（主动推送）

| Topic | Trigger / 触发 | Content / 内容 |
|---|---|---|
| `[PREFIX]/status` | Connect / disconnect | `online` / `offline` |
| `[PREFIX]/getBase` | Once after connecting (incl. reboot) / 连接成功一次 | `devSn / ssid / ip / mac / mcuVer / appVer` |
| `[PREFIX]/customList` | After each custom app add/delete | `{"apps":[{"appName":"weather"},...],"count":2}` |

### 6.2 Client → Device / 客户端 → 设备（订阅处理，无响应）

| Topic | Purpose / 作用 | Payload |
|---|---|---|
| `[PREFIX]/custom/<APP_NAME>` | Create/update/delete custom app | text/image/draw JSON; empty or `{}` = delete |
| `[PREFIX]/switchDiyApp` | Switch custom app (V1.1.0+) | `{"name":"<app>"}` |

### 6.3 Home Assistant Discovery / HA 自动发现

Device publishes discovery to `homeassistant/device/[PREFIX]/config`, controlled by `isHADiscoveryEnabled` (**default false**). Enable via:

```bash
curl -X POST http://<device-ip>/setMqttConfig \
  -H "Content-Type: application/json" \
  -d '{"isMqtt":true,"ip":"<broker>","port":1883,"mqtt_prefix":"ulanzi","isHADiscoveryEnabled":true}'
```

Reboot the device afterwards; HA will auto-discover the entities. / 重启设备后 HA 自动发现。

---

## 7. Limitations / 暂不支持

| Feature / 功能 | Status / 状态 |
|---|---|
| TTS / MP3 / audio playback / 音频播放 | Not exposed by the protocol / 协议未开放 |
| AWTRIX-style notify | Not supported / 不支持 |
| Audio MQTT topics / 音频 MQTT topic | Not supported / 不支持 |
| Physical key/knob events **upstream** to HA / 物理按键事件上行 | Not supported — protocol is one-way (host → device); `/keyEvent` only simulates / 协议单向 |
| Web UI language switch (CN → EN) / 网页中英切换 | Under evaluation / 评估中 |

---

## 8. Examples / 示例

**1. Push centered "HELLO" over MQTT（先切到该 App）:**
```bash
mosquitto_pub -h <broker> -t ulanzi_e5f6/custom/vibe_signal -m '{
  "text": [
    {"content":"HELLO","fontHeight":10,"align":"center","valign":"middle","color":"#FFFFFF"}
  ]
}'
```

**2. Switch to that app over HTTP:**
```bash
curl -X POST "http://<device-ip>/api/switchDiyApp?name=vibe_signal"
```

**3. Simulate "next page" (right short-press):**
```bash
curl -X POST http://<device-ip>/keyEvent \
  -H "Content-Type: application/json" \
  -d '{"event":"shortPress","key":"right","source":"homeassistant"}'
```

**4. Jump directly to the BUSY app:**
```bash
curl -X POST http://<device-ip>/switchApp \
  -H "Content-Type: application/json" \
  -d '{"type":"tools","index":3}'
```

**5. Set volume to 4:**
```bash
curl -X POST http://<device-ip>/setConfig \
  -H "Content-Type: application/json" \
  -d '{"volume":4}'
```

