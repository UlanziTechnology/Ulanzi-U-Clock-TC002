# Pull Request 草稿

## 建议标题

```text
feat(mqtt/xiaohongshu-follower-counter): add local Chrome and HA follower display
```

## 描述

新增 Chrome Manifest V3 扩展和 Home Assistant MQTT Blueprint。扩展使用用户当前 Chrome 会话读取已配置小红书主页上显示的粉丝数，在浏览器内用持久化像素矩阵生成 52×16 PNG，并把受限字段发送到 local-only HA Webhook。Blueprint 校验多设备前缀白名单，自行构造 `<devicePrefix>/custom/<appName>`，再通过 Home Assistant MQTT 集成发布 retained QoS 0 消息。

一个 Blueprint 实例可服务多台 TC002，每台设备绑定一个主页。设备的 `/getBase`、`/getMqttConfig`、MAC 后四位和 MQTT 前缀均动态发现；源码没有固定开发电脑、主页、broker、topic 或凭证。旧 Node 本地转发服务及其环境变量、MQTT 客户端和测试已删除。

刷新间隔最低和默认值为 5 分钟（300 秒），减少触发小红书风控或屏蔽的风险。

## 权限与隐私

- Chrome 静态权限只有 `storage`、`alarms` 和小红书页面；HA 与 TC002 主机权限由用户保存配置时动态授予。
- 不读取 Cookie，不使用 `cookies`、`webRequest` 或固定扩展 ID。
- 不保存或转发 MQTT 用户名/密码，不需要 Home Assistant 长期访问令牌。
- Webhook ID、设备 IP 和主页绑定只保存在当前电脑。

## 验证

- `npm run check`：53+ 自动测试、递归 JavaScript 语法检查和发布安全扫描。
- loopback HTTP E2E：模拟 TC002 两个配置接口，真实 POST 到模拟 HA Webhook，验证动态前缀、PNG payload 与凭证隔离。
- Blueprint 静态合约：local-only POST、白名单、固定 Custom App 名称、QoS 0、retain。
- 确定性 Chrome ZIP：两次生成 SHA-256 一致。
- ZIP SHA-256：`5f499582bae5a766fb0c06d3add63650a54b98eb4f602919751eca532774c769`。
- 已在目标环境上验证运行：Chrome 页面读取和 TC002 MQTT 协议曾完成联调；本 PR 的最终 Chrome + Home Assistant Blueprint 链路仍需在两台真实设备上复验并记录证据。
- 真机 TC002 照片/GIF：提交合并前补充 `preview/tc002-real.jpg` 或 `preview/tc002-real.gif`。

## 上游检查清单

- [x] 应用类型：MQTT
- [x] 许可证 GPL-3.0 兼容
- [x] 已阅读并遵守贡献要求
- [x] 自动化测试和构建通过
- [ ] 已在最终目标环境上验证运行（Chrome + Home Assistant + 两台 TC002）
- [ ] 已附运行截图或视频
