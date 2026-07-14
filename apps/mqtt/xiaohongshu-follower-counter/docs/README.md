# TC002 小红书粉丝数（纯本地）

## 简介

这个应用把任意已配置的小红书用户主页粉丝数显示到 TC002：

```text
Chrome 登录后访问用户主页
  → MV3 扩展读取页面中已经展示的粉丝数
  → http://127.0.0.1:17321 本地桥接
  → MQTT broker
  → TC002 Custom App 52×16 图片
```

扩展不读取 Cookie、不申请 `cookies`/`webRequest` 权限、不导出登录态，也不绕过验证码或访问限制。页面 URL、昵称、粉丝数和采集时间只发送到本机回环地址。

![52×16 显示预览](../preview/demo.png)

## 依赖

- Node.js 20 或更高版本
- Chrome 或兼容 Manifest V3 的 Chromium 浏览器
- TC002 可访问的 MQTT broker
- 已能订阅 Custom App topic 的 TC002 固件

运行时没有 npm 第三方依赖；桥接内置了所需的 PNG 编码和 MQTT 3.1.1 客户端。

## 1. 启动本地桥接

进入应用目录：

```bash
cd apps/mqtt/xiaohongshu-follower-counter
```

生成一个本地共享令牌：

```bash
openssl rand -hex 24
```

设置环境变量并启动：

```bash
export XHS_BRIDGE_TOKEN="粘贴刚生成的令牌"
export MQTT_HOST="192.168.1.10"
export MQTT_PORT="1883"
export TC002_MQTT_TOPIC="ulanzi_1bf6/custom/xhs_followers"
npm start
```

可选参数：

| 环境变量 | 默认值 | 说明 |
|---|---:|---|
| `XHS_BRIDGE_PORT` | `17321` | 本地 HTTP 端口；始终只监听 `127.0.0.1` |
| `MQTT_USERNAME` | 空 | broker 用户名 |
| `MQTT_PASSWORD` | 空 | broker 密码；必须同时设置用户名 |
| `MQTT_TLS` | `false` | `true` 时使用 TLS，默认端口变为 8883 |
| `MQTT_ALLOW_SELF_SIGNED` | `false` | 仅在自签名局域网 broker 上按需启用 |
| `MQTT_CLIENT_ID` | 自动生成 | 固定 MQTT client id |
| `TC002_MQTT_TOPIC` | `ulanzi_1bf6/custom/xhs_followers` | TC002 Custom App topic |

健康检查：

```bash
curl http://127.0.0.1:17321/health
```

应返回 `{"ok":true}`。

## 2. 安装 Chrome 扩展

1. 在 Chrome 地址栏打开 `chrome://extensions`。
2. 打开右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本应用的 `extension/` 目录。
5. 扩展会自动打开设置页。

在设置页填写：

- 一个或多个完整小红书用户主页 URL，每行一个；
- 刷新间隔，最低 5 分钟；
- `http://127.0.0.1:17321`；
- 与 `XHS_BRIDGE_TOKEN` 完全一致的共享令牌。

保存后扩展会在非活动标签页依次打开这些主页。若小红书要求登录或验证，请在同一个 Chrome 用户配置中手动完成，然后等待下一次刷新。

## 3. 手工测试桥接到 TC002

在不加载扩展的情况下也可以验证 HTTP→MQTT→TC002：

```bash
curl -X POST http://127.0.0.1:17321/v1/follower-count \
  -H "Authorization: Bearer $XHS_BRIDGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "profileUrl":"https://www.xiaohongshu.com/user/profile/demo",
    "displayName":"Demo",
    "followerCount":12800,
    "observedAt":"2026-07-14T12:00:00.000Z"
  }'
```

成功时返回：

```json
{"published":true,"topic":"ulanzi_1bf6/custom/xhs_followers","followerCount":12800}
```

桥接发布的 MQTT payload 与仓库其他 Custom App 保持一致：

```json
{
  "duration": 31536000,
  "text": [],
  "image": [{"data": "data:image/png;base64,...", "position": [0, 0]}],
  "draw": []
}
```

## 测试

```bash
npm test
npm run preview
```

测试覆盖数字单位换算、JSON/DOM 采集、PNG 52×16、MQTT packet、真实 loopback socket、HTTP 鉴权和扩展权限契约。

## 故障排查

### 扩展显示 `Follower count was not found`

- 先手动打开目标主页，确认页面确实能看到“粉丝”数字。
- 完成小红书登录、验证码或安全验证；本项目不会绕过这些控制。
- 小红书页面结构可能已改变。保存页面中粉丝区域的脱敏 HTML fixture，再更新 `extension/extractor.js` 和测试。

### `unauthorized`

扩展设置中的令牌与启动桥接时的 `XHS_BRIDGE_TOKEN` 不一致。两边重新粘贴同一个值后重试。

### `mqtt_publish_failed`

- 检查 `MQTT_HOST`/`MQTT_PORT`、用户名、密码和 TLS 设置；
- 确认电脑能访问 broker；
- 用 broker 自带的订阅工具观察 `TC002_MQTT_TOPIC`；
- TC002 收到消息但不切换画面时，在设备上手动进入对应 Custom App。

### 页面被频繁验证

把刷新间隔增大到 15–60 分钟并减少目标数量。不要使用代理池、签名破解或验证码绕过。

## 限制

- 这是页面适配器，不是小红书官方粉丝 API；页面变化时需要维护。
- 页面显示 `1.2万` 时只能得到约数 `12000`。
- 真机 MQTT topic 前缀与固件配置相关，需要用你设备的实际前缀替换示例。
- TC002 官方仓库的通用 MQTT 规范仍在演进，本实现采用仓库现有 Custom App payload 结构。

## 许可证

GPL-3.0-or-later。
