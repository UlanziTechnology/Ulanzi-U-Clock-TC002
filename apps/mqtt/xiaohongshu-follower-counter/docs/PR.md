# Pull Request 草稿

## 建议标题

```text
feat(mqtt/xiaohongshu-follower-counter): 添加本地小红书粉丝数显示
```

## 描述

新增一个 Chrome Manifest V3 扩展和零第三方运行时依赖的 Node.js Bridge。扩展使用用户当前 Chrome 会话读取配置主页上已显示的粉丝数，只把规范化后的主页 URL、昵称、计数和时间发送到 `127.0.0.1`。Bridge 生成 52×16 PNG，并发布到用户运行时配置的 MQTT broker 和 TC002 Custom App topic。

所有电脑、账号、网络和设备参数均来自 `chrome.storage.local` 或当前进程环境变量；源码中没有开发机路径、固定主页、固定 broker、凭证或设备 topic。

## 权限与隐私

- Chrome 权限仅为 `storage`、`alarms`、小红书主页和 IPv4 loopback。
- 不使用 Cookie API、`webRequest` 或 `<all_urls>`。
- Bridge 只监听 `127.0.0.1`，写接口要求本机共享令牌。
- 不绕过登录、验证码、限流或其他访问控制。

## 验证

- `npm run check`：自动测试、语法检查、版本检查和发布安全扫描。
- 已在真实 Chrome 主页验证 `11.6万` 被标准化为 `116000` 并由本地 Bridge 接收。
- HTTP → MQTT 使用真实 loopback socket 自动测试。
- Chrome、Bridge 和 MQTT 配置均可在 Windows、macOS、Linux 的不同电脑上动态填写。
- 真机 TC002 照片/GIF：**提交 PR 前由设备持有人补充到 `preview/tc002-real.jpg` 或 `preview/tc002-real.gif`。**

## 上游检查清单

- [x] 应用类型：MQTT
- [x] 已在目标环境上验证运行（Chrome、本地 Bridge、loopback MQTT 测试）
- [ ] 已附运行截图或视频（等待真实 TC002 真机素材）
- [x] 许可证 GPL-3.0 兼容
- [x] 已阅读并遵守《贡献指南》
