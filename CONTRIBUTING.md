# 贡献指南

感谢你对 **Ulanzi U-Clock TC002** 开源项目感兴趣！本文档说明如何把自己的代码贡献到本仓库。

本仓库目前接受**两种类型**的应用贡献：

| 类型 | 说明 | 提交目录 |
|---|---|---|
| **FlyThings 应用** | 直接运行在 TC002 设备上的 FlyThings IDE 工程，编译后烧录到设备 | `apps/flythings/<your-app-name>/` |
| **MQTT 应用** | 主要为 **Home Assistant 蓝图（Blueprint）**，用户在自己的 HA 实例中一键导入，通过 MQTT 与 TC002 交互。也接受 Node-RED flow、openHAB rule 等其他基于 MQTT 的集成方案 | `apps/mqtt/<your-app-name>/` |

> 应用名 `<your-app-name>` 用小写字母 + 数字 + 短横线，例如 `weather-clock`、`stock-ticker`、`battery-monitor`。同类型下不可重名。
>
> 应用通过 review 合并后，会被收录到**根目录 [`README.md`](README.md) 的社区应用列表**（FlyThings 应用见"开源的项目"，MQTT 应用见"MQTT 应用"章节），作为 TC002 用户的上手入口之一。
>


---

## 通用要求（无论哪种类型都必须满足）

### 1. 许可证兼容

本仓库主体采用 **[GPL-3.0-or-later](LICENSE)**，因此你提交的应用必须使用以下任一**许可证之一**：

- GPL-3.0-or-later（推荐）
- GPL-2.0-or-later
- LGPL-2.1-or-later、LGPL-3.0-or-later
- Apache-2.0
- MIT、BSD-2-Clause、BSD-3-Clause
- 其他 [GPL-3.0 兼容许可证](https://www.gnu.org/licenses/license-list.html#GPLCompatibleLicenses)

许可证声明方式：

- **FlyThings 应用**：应用目录下放 `LICENSE` 文件，或在 `README.md` 顶部明确标注
- **MQTT 应用**：在 `blueprint.yaml` 顶部加 `# SPDX-License-Identifier: <SPDX-ID>` 注释行；若与仓库主体许可证不同，额外在 `docs/LICENSE` 放许可证全文

### 2. 必备文件

不同类型的必备文件略有差异：

**FlyThings 应用** 顶层至少包含：

```raw
apps/flythings/<your-app-name>/
├── README.md          # 应用介绍、编译/运行说明、截图
├── manifest.json      # 应用元信息（见下）
└── LICENSE            # GPL-3.0 兼容许可证全文
```

**MQTT 应用**（HA 蓝图）顶层至少包含：

```raw
apps/mqtt/<your-app-name>/
├── blueprint.yaml     # HA 蓝图主文件，元信息直接写在 blueprint: 段
├── preview/           # 至少一张运行截图或 GIF
└── docs/              # 含 README + 许可证声明
```

> MQTT 类不强制独立 `manifest.json` / `LICENSE` / 顶层 `README.md`，元信息与许可声明统一通过 `blueprint.yaml` 的注释头与 `blueprint:` 段承载，文档在 `docs/` 里展开。详见后文 "MQTT 应用规范"。

### 3. `manifest.json` 格式（FlyThings 应用专用）

```json
{
  "name": "weather-clock",
  "displayName": "天气时钟",
  "version": "1.0.0",
  "type": "flythings",
  "author": "Your Name <your@email.com>",
  "license": "GPL-3.0-or-later",
  "description": "在主页上展示当前天气与未来三日预报。",
  "tags": ["weather", "clock", "home"],
  "minFirmware": "1.0.0",
  "homepage": "https://github.com/your-user/your-repo"
}
```

字段说明：

| 字段 | 必填 | 说明 |
|---|:-:|---|
| `name` | ✅ | 与目录名一致 |
| `displayName` | ✅ | UI 展示名（支持中文） |
| `version` | ✅ | 语义化版本 |
| `type` | ✅ | 固定为 `flythings` |
| `author` | ✅ | 作者署名 + 联系方式 |
| `license` | ✅ | SPDX 标识符，必须 GPL-3.0 兼容 |
| `description` | ✅ | 一句话功能描述 |
| `tags` | ⬜ | 类别标签，便于检索 |
| `minFirmware` | ⬜ | 所需最低固件版本 |
| `homepage` | ⬜ | 个人项目主页 / 文档链接 |

### 4. README 模板要求

每个应用 `README.md` 至少包含以下章节：

- **简介** — 应用做什么，解决什么需求
- **截图或视频** — 真机运行效果（至少一张静态图，动效推荐 GIF）
- **依赖** — 需要的第三方库、固件版本、外部 API
- **安装与运行** — 编译/部署步骤，能让别人原样跑起来
- **配置** — 如有配置文件或环境变量，逐项说明
- **已知问题** — 不可避免的局限或待办

### 5. 不接受的内容

- 闭源二进制（除非属于明确声明的第三方依赖）
- 包含恶意行为、隐私窃取、未经授权访问的代码
- 侵权资源（未授权的图片、字体、音频）
- 与 TC002 业务无关的"凑数"项目

---

## FlyThings 应用规范

> 参考完整示例：[`Z21_TC002_Demo/`](Z21_TC002_Demo/)

### 目录结构

```raw
apps/flythings/<your-app-name>/
├── README.md
├── manifest.json
├── LICENSE
├── Manifest.xml          # FlyThings 项目清单
├── ui/                   # *.ftu 界面文件
├── src/
│   ├── Main.cpp          # 入口
│   ├── activity/         # IDE 自动生成，禁止手改
│   ├── logic/            # 界面事件逻辑
│   ├── managers/         # 自定义管理器（可选）
│   ├── pages/            # 自定义页面（可选）
│   └── utils/            # 工具类（可选）
└── resources/            # 随固件打包的资源（图片、音频等）
```

### 提交前必须满足

1. **能在 FlyThings IDE 中无错编译**，并在真机或 TF 卡启动模式下运行通过。真机验证用 Wi-Fi ADB `下载调试`（`Ctrl+Alt+R`，不固化），或 `镜像编译` 生成 `update.img` 放 FAT32 TF 卡根目录插卡升级——具体步骤见根目录 [`README.md`](README.md) 的[二次开发](README.md#7-二次开发)章节
2. **不要提交 `Release/` 编译产物**（在子目录 `.gitignore` 里加 `Release/`）
3. **不要修改 `src/activity/` 下 IDE 自动生成的代码**
4. **入口必须设置防砖标志**（参考 [`Z21_TC002_Demo/README.md`](Z21_TC002_Demo/README.md) 的"注意事项"）：

   #include <os/SystemProperties.h>
   SystemProperties::setString("sys.zkapp.state", "running");

5. **`Manifest.xml` 中 `platform` 必须是 `Z21`**（这是 TC002 的平台标识）

### 源文件许可声明（推荐）

在每个 `*.cpp` / `*.h` / `*.cc` 文件顶部加 SPDX 注释：

```cpp
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Your Name
```

---

## MQTT 应用规范

### 目录结构

```raw
apps/mqtt/<your-app-name>/
├── blueprint.yaml         # 必填：HA 蓝图主文件，元信息写在 blueprint: 段
├── icons/                 # 可选：TC002 显示用的 8x8 像素图标 (*.png / *.gif)
├── preview/               # 必填：至少一张运行效果截图或 GIF
│   └── demo.gif
└── docs/                  # 必填：README + 许可证声明 + 详细说明
    ├── README.md          # 应用文档（含 Open-in-HA 按钮、参数说明、MQTT topic 列表）
    └── LICENSE            # 可选：若蓝图采用与仓库主体不同的许可证，在此声明
```

> 与 FlyThings 类不同，MQTT 类**不需要**单独的 `manifest.json` —— 元信息（名称、描述、作者、许可证等）由 `blueprint.yaml` 的 `blueprint:` 段及文件顶部的 SPDX 注释承载。
>
> **非 HA 蓝图类型**（Node-RED flow、openHAB rule 等）把 `blueprint.yaml` 替换为对应的核心文件，例如 `flow.json`、`rule.yaml`；其他要求一致。

### Home Assistant 蓝图特别要求

#### 1. 蓝图文件必须可直接被 HA 解析，元信息写在文件中

```yaml
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Your Name <your@email.com>
#
# TC002 Battery Monitor — 当手机电量低于阈值时在 TC002 上闪烁提醒
# Homepage: https://github.com/your-user/your-repo

blueprint:
  name: TC002 Battery Monitor
  description: |
    当手机电量低于阈值时在 TC002 上闪烁提醒。
    Author: Your Name <your@email.com>
    License: GPL-3.0-or-later
  domain: automation
  source_url: https://github.com/UlanziTechnology/Ulanzi-U-Clock-TC002/blob/main/apps/mqtt/battery-monitor/blueprint.yaml
  input:
    battery_sensor:
      name: 电池传感器
      selector:
        entity:
          domain: sensor
          device_class: battery
    # ...

trigger:
  - platform: numeric_state
    # ...

action:
  - service: mqtt.publish
    data:
      topic: tc002/notify
      payload: '{"text":"低电量!","icon":42,"duration":10}'
```

- 文件顶部 **必须**带 SPDX 注释行声明许可证与版权
- `blueprint.name` / `blueprint.description` 必填；建议在 `description` 段冗余写一遍作者与许可证，便于 HA 用户在导入对话框里直接看到
- `source_url` **必填**，指向蓝图在本仓库的 raw URL（合并后由维护者协助补全）
- `domain` 通常为 `automation`、`script` 或 `template`
- 所有可调参数走 `input` 段，**不要在 trigger/action 里硬编码用户值**

#### 2. `docs/README.md` 必须包含一键导入按钮

在 `docs/README.md` 顶部嵌入 "Open in HA" 徽章。模板：

```markdown
[![Open your Home Assistant instance and show the blueprint import dialog.](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2FUlanziTechnology%2FUlanzi-U-Clock-TC002%2Fblob%2Fmain%2Fapps%2Fmqtt%2F<your-app-name>%2Fblueprint.yaml)
```

其中 `<your-app-name>` 替换为你的目录名，整段 URL 中的 `/` 用 `%2F` 转义。

合并后，用户点击徽章即跳转到自己的 HA 实例打开导入对话框。

#### 3. 与 TC002 的 MQTT 通信约定

> ⚠️ **该章节待官方补充：** TC002 标准 MQTT topic 与 payload schema 将在固件 vX.Y.Z 后正式发布。在标准发布前，请：
>
> - 在 `README.md` 中明确列出蓝图发布 / 订阅的所有 topic 及 payload 示例
> - broker 地址在蓝图 `input` 中暴露为参数，**不要硬编码**
> - payload 一律使用 UTF-8 JSON

### 提交前必须满足

1. **可在 HA 中成功导入**：把 `blueprint.yaml` 上传到自己的 HA 实例，导入并运行通过
2. **真机验证**：截图或 GIF 必须是真实 TC002 设备上的运行画面
3. **参数化**：所有用户可能想改的值（broker、topic、显示文字、阈值、颜色等）走蓝图 `input`
4. **零硬编码凭证**：示例代码、文档、blueprint.yaml 中**禁止**出现真实的 broker 密码、API key
5. **图标命名**：若提交 `icons/`，文件名用小写英文 + 短横线（`battery-low.png`），并在 `docs/README.md` 中登记图标清单（MQTT 类不设 `manifest.json`，元信息由 `blueprint.yaml` 承载）

---

## 提交流程

### 1. Fork & Clone

在 GitHub 上点 **Fork**，然后 clone 你的 fork：

```bash
git clone https://github.com/<your-username>/Ulanzi-U-Clock-TC002.git
cd Ulanzi-U-Clock-TC002
git remote add upstream https://github.com/UlanziTechnology/Ulanzi-U-Clock-TC002.git
```

### 2. 创建分支

分支命名规范：`<type>/<app-name>`，例如：

```bash
git checkout -b flythings/weather-clock
# 或
git checkout -b mqtt/home-assistant-bridge
```

### 3. 开发并提交

在对应目录下完成你的应用。Commit 信息建议格式：

```raw
<type>(<app-name>): <一句话说明>

可选的多行详细描述。

Signed-off-by: Your Name <your@email.com>
```

示例：

```raw
feat(flythings/weather-clock): 初始版本，支持和风天气 API

- 主页显示当前气温与天气图标
- 三日预报副页
```
```raw
feat(mqtt/battery-monitor): 添加手机电量低告警 HA 蓝图

- 监听任意 device_class=battery 的传感器
- 低于阈值时通过 MQTT 推送闪烁图标到 TC002
```

### 4. 同步上游并 push

```bash
git fetch upstream
git rebase upstream/main
git push origin flythings/weather-clock
```

### 5. 发起 Pull Request

在 GitHub 上从你的分支向 `UlanziTechnology/Ulanzi-U-Clock-TC002:main` 发起 PR，标题与首条 commit 一致。

PR 描述里请包含：

- [ ] 应用类型：FlyThings / MQTT
- [ ] 已在真机 / 目标环境上验证运行
- [ ] 已附运行截图或视频
- [ ] 许可证 GPL-3.0 兼容
- [ ] 已阅读并遵守本《贡献指南》

---

## Review 流程

1. **自动检查**：CI（如已配置）将校验目录结构、`manifest.json` 字段、文件大小等
2. **维护者初审**：通常在 5 个工作日内给出首轮反馈
3. **修改迭代**：根据反馈在同一分支补提交即可，不要新开 PR
4. **合并**：通过 review 后由维护者 squash merge 进 `main`

如果 PR 长期没有响应，欢迎在 PR 中 @ulanzi 团队成员或在 Issue 区提醒。

---

## 行为准则

- 在 Issue、PR、评论中保持友善、尊重、专业
- 不接受人身攻击、骚扰、歧视言论
- 维护者保留对违规账号的处置权（警告 / 屏蔽 / 删除内容）

---

## 联系方式

- **GitHub Issues**：技术问题、Bug 报告、功能建议
- **官方网站**：<https://www.ulanzi.com>
- **开发者邮箱**：（待补充）

期待你的精彩作品 🎉
