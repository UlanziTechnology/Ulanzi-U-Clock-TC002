# Ulanzi U-Clock TC002 · 像素时钟开源资料

Ulanzi TC002（Pixbar 二代）是 **52×16 全彩 RGB 像素桌面时钟**：开箱可用官方 App 显示天气、番茄钟、社媒粉丝数等，同时开放 **MQTT / HTTP 协议**，可接入 Home Assistant、Node-RED，甚至把 Claude Code / Codex 的运行状态变成桌面红绿灯。本仓库是官方开源资料：示例工程、MQTT 应用、协议说明与二次开发文档。

> **按你的目标选入口**
> - 不写代码，先玩起来 → [快速上手](#2-快速上手)
> - 接入 Home Assistant / 智能家居 → [MQTT 应用](#4-mqtt-应用)
> - Claude Code / Codex 状态红绿灯 → [Agent 配置](#6-agent-配置)
> - 开发自己的固件应用 → [二次开发](#7-二次开发)

## 1. 产品简介

| 项目       | 规格                                     |
| ---------- | ---------------------------------------- |
| 显示       | 52×16 全彩 RGB LED 点阵（832 LED），SPI 驱动 |
| 输入       | 1 旋钮（顺 / 逆 / 按下）+ 3 按键            |
| 音频 / MIC | 内置喇叭（MP3，0~6 级音量）；MIC 由 MCU 上报音量 |
| 无线       | Wi-Fi + BLE（BLE 依赖 Wi-Fi 已开启）        |
| 扩展       | GPIO_06 / GPIO_85 预留；USB-C（U 盘模式）+ 复位按钮 |

官方 App（Ulanzi Studio V3.1.0+）开箱可用：时间 / 天气 / 世界时钟、番茄钟 / 计分板 / 秒表 / BUSY、社媒粉丝数、日程、DIY 像素图。使用说明见 [官方 Ulanzi Studio 指南](https://docs.ulanzistudio.com/tc002/en/software/ulanzi-studio.html) 与 [TC002 FAQ](https://docs.ulanzistudio.com/tc002/en/faq/)。

## 2. 快速上手

前置：TC002 已完成 Wi-Fi 配网，与电脑同一局域网。配网问题见 [Web Setup Guide](https://docs.ulanzistudio.com/tc002/en/software/web-setup.html)。

**路线 A・网页端体验（5 分钟，免刷固件）** — 用 [PixDeck](https://github.com/cailurus/PixDeck) 在浏览器里把行情 / 天气 / 游戏 / 像素画推到时钟：

```
git clone https://github.com/cailurus/PixDeck.git && cd PixDeck
python3 pixbar_panel.py        # Windows: python pixbar_panel.py
# 浏览器打开 http://127.0.0.1:8000，右上角齿轮里填时钟 IP
```

**路线 B・MQTT + Home Assistant** — Ulanzi Studio 里配置 MQTT（电脑 IP:1883）→ HA 添加 MQTT 集成指向同一 broker → 导入社区蓝图或直接发布 payload。见 [MQTT 应用](#4-mqtt-应用)。

**路线 C・Agent 状态灯** — Claude Code / Codex 运行时 TC002 亮红绿灯（黄 = 运行中、红 = 阻塞、绿 = 完成）。见 [Agent 配置](#6-agent-配置)。

**路线 D・二次开发** — FlyThings IDE 导入 `Z21_TC002_Demo/` 编译运行。见 [二次开发](#7-二次开发)。

## 3. 开源的项目

```
├── IDE使用说明/     FlyThings IDE 开发文档
├── Z21_TC002_Demo/  官方示例工程（LED/按键/音频/MIC/Wi-Fi/BLE/GPIO 全覆盖），直接导入 IDE 编译
├── apps/
│   ├── flythings/   设备端 C++ 应用（pixel-pet-display 像素宠物等）
│   └── mqtt/        社区 MQTT 应用（11 个 Home Assistant 蓝图等）
├── CONTRIBUTING.md  贡献规范与 PR 流程
├── LICENSE          GPL-3.0-or-later
└── THIRD_PARTY_NOTICES.md  第三方组件声明
```

> `apps/flythings/` 已收录首个社区应用 [pixel-pet-display](apps/flythings/pixel-pet-display/)（像素宠物展示窗），欢迎继续提交跑在设备上的 C++ 应用，见 [社区与贡献](#9-社区与贡献)。

## 4. MQTT 应用

TC002 官方固件内置 MQTT，通过消息推送文字 / 图标 / 绘制指令到时钟。

**Topic**：`[PREFIX]/custom/[APP_NAME]`（前缀默认 `ulanzi_<MAC后四位>`，如 `ulanzi_1bf6`，以设备 MQTT 配置为准；`APP_NAME` 为时钟上的 Custom App 名）

**Payload（UTF-8 JSON）**：

```json
{"duration": 3600,
 "text": [{"content": "Hello World", "fontHeight": 10, "x": 0, "y": 0,
           "color": "#FFFFFF", "align": "left", "valign": "top",
           "rect": [0, 0, 52, 16], "charSpacing": 1}],
 "image": [{"data": "data:image/png;base64,...", "position": [0, 0]}],
 "draw": []}
```

* `text` 文字及排版；`image` 内嵌 base64 的 PNG/GIF（无需图床）；`draw` 矢量绘制（`{"df":[0,0,52,16,"#000000"]}` 填矩形、`{"dfc":[26,8,5,"#FFCB52"]}` 填圆形）；`duration` 显示秒数。

**快速验证**（任一 MQTT 客户端）：

```
mosquitto_pub -h <BROKER_HOST> -t ulanzi_1bf6/custom/vibe_signal \
 -m '{"duration":3600,"text":[{"content":"Hello","fontHeight":10,"x":0,"y":0,"color":"#FFFFFF"}],"image":[],"draw":[]}'
```

**社区应用**（完整收录与导入方式见 [apps/mqtt/README.md](apps/mqtt/README.md)）：

| 应用 | 用途 |
| --- | --- |
| [vibe-coding-signal-light](apps/mqtt/vibe-coding-signal-light/) | AI 编程助手状态红绿灯（[一键导入](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fraw.githubusercontent.com%2FUlanziTechnology%2FUlanzi-U-Clock-TC002%2Fmain%2Fapps%2Fmqtt%2Fvibe-coding-signal-light%2Fblueprint.yaml)） |
| [claude-bot](apps/mqtt/claude-bot/) | Claude 状态与用量展示 |
| [pet](apps/mqtt/pet/) | 桌面像素宠物（灰猫） |
| [fire](apps/mqtt/fire/) | 虚拟壁炉 |
| [ci-status-board](apps/mqtt/ci-status-board/) | CI 构建状态看板 |
| [git-contribution-heatmap](apps/mqtt/git-contribution-heatmap/) | Git 贡献热力图 |
| [year-progress-bar](apps/mqtt/year-progress-bar/) | 年进度条 |
| [nowplaying](apps/mqtt/nowplaying/) | 媒体正在播放（走马灯） |
| [vocabulary-widget](apps/mqtt/vocabulary-widget/) | 单词轮播 |
| [love-confession](apps/mqtt/love-confession/) | 应援灯牌 |
| [xiaohongshu-follower-counter](apps/mqtt/xiaohongshu-follower-counter/) | 小红书粉丝数（Chrome 扩展 + 蓝图） |

完整教程（部署 broker → 配置 TC002 → MQTTX 发命令 → HA 蓝图）：[Beginner's Guide to MQTT on TC002](https://docs.ulanzistudio.com/tc002/en/software/mqtt.html)。

## 5. HTTP 协议

* **查询接口**：`curl http://<IP>/getBase`、`curl http://<IP>/getMqttConfig`；浏览器打开 `http://<IP>` 可进设备管理页（查看 / 重置）。接口由官方固件提供，字段随固件版本可能变化。
* **Custom App HTTP 协议（推帧）**：官方固件内置，网页端工具（如 PixDeck）通过它把画面 POST 到时钟；与 MQTT 推帧格式一致，PixDeck 可在设置里切换传输方式。
* **选型**：一次性即时推送用 HTTP；持续状态 / 自动化联动用 MQTT（更稳定、支持 retain）。

## 6. Agent 配置

让 TC002 显示 AI 编程助手运行状态，链路：`Claude Code / Codex hook → Home Assistant 实体 → 蓝图 → MQTT → TC002`。

| 状态          | 灯效   | 场景             |
| ----------- | ---- | -------------- |
| `idle`      | 绿灯   | 一轮任务结束         |
| `attention` | 黄灯闪烁 | 运行中 / 调用工具     |
| `blocked`   | 红灯闪烁 | 权限请求 / 失败 / 阻塞 |
| `off`       | 熄灭   | 无任务            |

**最小方案**：HA 导入 [vibe-coding-signal-light 蓝图](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fraw.githubusercontent.com%2FUlanziTechnology%2FUlanzi-U-Clock-TC002%2Fmain%2Fapps%2Fmqtt%2Fvibe-coding-signal-light%2Fblueprint.yaml) → 建 `input_select` 实体并创建自动化 → 本地脚本（示例见 [AGENT_HOOKS.md](apps/mqtt/vibe-coding-signal-light/docs/AGENT_HOOKS.md)）通过 HA REST/webhook 更新实体 → Claude Code / Codex hook 按生命周期调用脚本（提交任务→`attention`，失败 / 权限→`blocked`，结束→`idle`）。多 session 同时运行时按 "任一 blocked→红；任一 attention→黄；否则熄灭" 聚合。

## 7. 二次开发

1. 安装 [FlyThings IDE](https://download.s21i.co99.net/14731609/0/0/ABUIABBPGAAglMLczgYo0Mjk3AU.zip?f=flythings-ide-win32-win32-x86-zkswe-setup.zip&v=1775706403)，完整说明见 [IDE使用说明/说明文档.md](IDE使用说明/说明文档.md)
2. 导入 `Z21_TC002_Demo/`（`文件 → 导入 → 现有项目到工作空间`）
3. 编译：`Ctrl+Alt+Z`（产物在 `Release/`）
4. 烧录：仅 Wi-Fi ADB——IDE `调试配置 → ADB配置 → WIFI` 填 IP → `下载调试`（`Ctrl+Alt+R`，不固化；持久化用 `镜像编译` 生成 `update.img` 放 FAT32 TF 卡根目录插卡升级）
5. 恢复官方固件：按住 USB-C 旁复位键上电

**注意事项**：入口必须 `SystemProperties::setString("sys.zkapp.state","running")` 防砖；MCU 初始化先于 LED 刷新；`sendLedData` 帧间隔 ≥15ms；BLE 依赖 Wi-Fi；UI 主线程勿阻塞；勿改 `src/activity/`（IDE 自动生成）。

**API 速查**（LED / 按键 / 音频 / MIC/Wi-Fi/BLE/GPIO 示例代码）：见 [Z21_TC002_Demo/README.md](Z21_TC002_Demo/README.md)。

## 8. 常见问题

* **配网卡 100%？** 见 [连接排查指南](https://docs.ulanzistudio.com/tc002/en/faq/)。
* **MQTT 发了不显示？** 检查 topic（前缀以设备配置为准）、时钟是否正在显示该 Custom App（更新内容不自动切换 App）、payload 是否为 UTF-8 JSON。
* **PixDeck 没反应？** 确认与时钟同局域网、IP 正确、时钟停留在可被更新的界面。

## 9. 社区与贡献

提交 **FlyThings 应用**（`apps/flythings/`）或 **MQTT 应用**（`apps/mqtt/`，规范见 [apps/mqtt/README.md](apps/mqtt/README.md)）。完整规范见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 10. 许可证

[GPL-3.0-or-later](LICENSE)：衍生作品分发需同协议开源、保留版权声明、标注修改。第三方组件（BlueZ、Adafruit GFX 等）见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
