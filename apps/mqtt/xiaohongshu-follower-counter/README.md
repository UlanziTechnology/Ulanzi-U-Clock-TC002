# TC002 小红书粉丝数（纯本地）

Chrome 使用当前电脑的登录会话读取配置主页上已经显示的粉丝数，本地 Node.js Bridge 从绑定的 TC002 动态发现 MQTT 配置，将计数渲染为 52×16 图片并发布到设备原生 DIY topic。没有第三方采集云服务，也不读取或导出 Cookie。

```text
Chrome（设备 IP + 主页）→ 127.0.0.1 Bridge → TC002 配置的 MQTT broker → custom/display
```

## 快速开始

1. 安装 Node.js 20 或更高版本。
2. 设置随机 `XHS_BRIDGE_TOKEN`；可参考 [`.env.example`](.env.example)。
3. 运行 `npm run check`，然后运行 `npm start`。
4. 在 `chrome://extensions` 加载 [`extension/`](extension/) 目录。
5. 在扩展设置页为每台 TC002 填写设备 IP、绑定主页、Bridge URL 和当前电脑共享令牌。

完整安装、Windows/macOS/Linux 配置、接口、隐私和故障排查见 [docs/README.md](docs/README.md)。

- Chrome 扩展：[extension/](extension/)
- 本地 Bridge：[bridge/](bridge/)
- 渲染预览：[preview/demo.png](preview/demo.png)
- 真机素材要求：[preview/README.md](preview/README.md)
- PR 描述草稿：[docs/PR.md](docs/PR.md)

许可证：GPL-3.0-or-later。
