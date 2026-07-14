# MQTT 应用

本目录收录社区贡献的 **MQTT 应用** —— 主要为 [Home Assistant 蓝图（Blueprint）](https://www.home-assistant.io/docs/blueprint/)，用户在自己的 Home Assistant 实例中一键导入后，即可通过 MQTT 与 Ulanzi TC002 像素时钟交互（推送通知、显示传感器数据、播放图标动画等）。

> 也欢迎提交其他基于 MQTT 的集成方案，例如 Node-RED flow、openHAB rule、ESPHome automation 等。

---

## 已收录的应用

### [xiaohongshu-follower-counter](xiaohongshu-follower-counter/)

<img src="xiaohongshu-follower-counter/preview/demo.png" width="416" alt="小红书粉丝数 52×16 预览">

> **纯本地小红书粉丝数显示** —— Chrome 使用用户自己的登录态读取主页可见粉丝数，经 `127.0.0.1` 本地桥接直接发布 MQTT，不依赖第三方云服务。

| | |
|---|---|
| **类型** | Chrome MV3 扩展 + 本地 Node MQTT 桥接 |
| **隐私** | 不读取 Cookie；页面数据仅发送到 loopback |
| **文档** | [xiaohongshu-follower-counter/docs/README.md](xiaohongshu-follower-counter/docs/README.md) |

---

### [vibe-coding-signal-light](vibe-coding-signal-light/)

<img src="vibe-coding-signal-light/preview/demo.gif" width="416" alt="vibe-coding-signal-light 预览（原始 52×16 像素，按 8× 放大）">

> **TC002 桌面状态红绿灯** —— 显示 Claude Code / Codex / CI 等 AI 编程助手的运行状态（`idle` / `working` / `attention` / `blocked` / `off`）

| | |
|---|---|
| **类型** | Home Assistant 蓝图 |
| **作者** | 王行知（[@castlewong](https://github.com/castlewong)） |
| **导入** | [![Open in HA](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fraw.githubusercontent.com%2FUlanziTechnology%2FUlanzi-U-Clock-TC002%2Fmain%2Fapps%2Fmqtt%2Fvibe-coding-signal-light%2Fblueprint.yaml) |
| **文档** | [vibe-coding-signal-light/docs/README.md](vibe-coding-signal-light/docs/README.md) |

---

> 👀 期待更多社区作品 —— 提交方法见下方。

---

## 这些应用能做什么

一个典型的 MQTT 应用包含：

1. **触发条件** —— 例如某个 HA 实体状态变化、定时、传感器越阈
2. **MQTT 动作** —— 调用 `mqtt.publish`，把要在 TC002 上显示的内容（文字、图标、颜色、持续时间）发到设备订阅的 topic
3. **可选的图标资源** —— 8×8 像素 PNG/GIF，预先烧到设备 `/icons/` 目录，被 payload 引用

常见用法举例：

- 📨 邮件 / IM 新消息提醒
- 🔋 手机 / 智能门锁 / 烟雾报警器低电量通知
- 🌡️ 室内外温湿度、空气质量值滚动展示
- 🎵 媒体播放器封面 + 标题切换
- 🚌 实时公交到站倒计时
- 📈 股价 / 加密币行情
- ⏰ 番茄钟 / 倒计时

---

## 提交你的应用

### 1. 阅读完整规范

提交前请通读项目根目录的 [`CONTRIBUTING.md`](../../CONTRIBUTING.md)。核心要点：

- **目录结构**：`apps/mqtt/<your-app-name>/`，下含 `blueprint.yaml` + `preview/` + `docs/`，可选 `icons/`
- **应用名**：小写字母 + 数字 + 短横线，例如 `battery-monitor`、`weather-card`
- **许可证**：必须与仓库主体（GPL-3.0-or-later）兼容
- **元信息**：写在 `blueprint.yaml` 顶部 SPDX 注释与 `blueprint:` 段，不需要单独的 `manifest.json`
- **真机验证**：`preview/` 内的截图或 GIF 必须是真实 TC002 上的运行画面

### 2. 最小目录骨架

```
apps/mqtt/<your-app-name>/
├── blueprint.yaml      # HA 蓝图主文件
├── preview/
│   └── demo.gif        # 真机运行效果
└── docs/
    └── README.md       # 含 "Open in HA" 一键导入按钮 + 参数说明 + MQTT topic 列表
```

### 3. blueprint.yaml 起手式

```yaml
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Your Name <your@email.com>

blueprint:
  name: 一句话标题
  description: |
    详细描述应用做什么。
    Author: Your Name
    License: GPL-3.0-or-later
  domain: automation
  source_url: https://github.com/UlanziTechnology/Ulanzi-U-Clock-TC002/blob/main/apps/mqtt/<your-app-name>/blueprint.yaml
  input:
    # 暴露给用户的可调参数（broker、topic、阈值、显示文字等）

trigger:
  # 何时触发

action:
  - service: mqtt.publish
    data:
      topic: tc002/notify
      payload: '{"text":"Hello","icon":1,"duration":5}'
```

### 4. docs/README.md 必备元素

- 顶部嵌入 **"Open in HA" 一键导入按钮**（HA 用户点了直接跳到自己实例打开导入对话框）
- 至少一张 GIF / 截图（可引用 `../preview/`）
- 蓝图发布 / 订阅的所有 **MQTT topic 列表**与 **payload 示例**
- 配置参数说明（与 `blueprint.input` 对应）
- 故障排查 / 已知问题

"Open in HA" 按钮 markdown 模板：

```markdown
[![Open in HA](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2FUlanziTechnology%2FUlanzi-U-Clock-TC002%2Fblob%2Fmain%2Fapps%2Fmqtt%2F<your-app-name>%2Fblueprint.yaml)
```

把 URL 里所有 `/` 替换成 `%2F`，把 `<your-app-name>` 替换成你的目录名。

### 5. 发起 Pull Request

```bash
git checkout -b mqtt/<your-app-name>
# ... 完成开发 ...
git push origin mqtt/<your-app-name>
```

然后在 GitHub 上从你的分支向 `UlanziTechnology/Ulanzi-U-Clock-TC002:main` 发起 PR，描述里请勾选 [`CONTRIBUTING.md`](../../CONTRIBUTING.md) 末尾的 PR 清单。

---

## 与 TC002 的 MQTT 通信约定

> ⚠️ **该章节待官方补充：** TC002 标准 MQTT broker 地址、topic 命名约定、payload schema、鉴权方式将在固件 vX.Y.Z 发布后给出标准定义。
>
> 在标准发布前，请：
>
> - broker 地址 / 用户名 / 密码全部走 `blueprint.input` 参数化，**不要硬编码**
> - 在 `docs/README.md` 中列出你的蓝图发布 / 订阅的所有 topic 及 payload 示例
> - payload 一律使用 UTF-8 JSON 编码

---

## 反馈与讨论

- **提交应用**：见上方 "提交你的应用"
- **报告问题 / 提建议**：[GitHub Issues](https://github.com/UlanziTechnology/Ulanzi-U-Clock-TC002/issues)
- **完整贡献规范**：[`../../CONTRIBUTING.md`](../../CONTRIBUTING.md)
- **官方网站**：<https://www.ulanzi.com>
