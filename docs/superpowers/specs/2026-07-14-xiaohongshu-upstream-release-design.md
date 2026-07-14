# TC002 小红书粉丝数上游发布设计

## 目标

将现有 `apps/mqtt/xiaohongshu-follower-counter/` 整理为适合向
`UlanziTechnology/Ulanzi-U-Clock-TC002` 提交 Pull Request 的 MQTT 社区应用。
交付物包含 Chrome Manifest V3 扩展、本地 Node.js MQTT Bridge、安装与安全文档、
可复现测试及 PR 说明，不包含二进制发布包、第三方依赖目录或用户凭证。

## 上游定位

该应用属于 `apps/mqtt/` 接受的非 Home Assistant MQTT 集成。`package.json` 是核心入口文件，
作用等同于贡献指南中 Node-RED 的 `flow.json` 或 openHAB 的 `rule.yaml`，因此不添加无实际用途的
`blueprint.yaml`。应用保持在单一目录内，不拆分为独立仓库。

## 用户链路

1. 用户在本机启动 Node.js Bridge，并通过环境变量配置 MQTT broker、TC002 topic 和共享令牌。
2. 用户在 Chrome 开发者模式加载 `extension/`，在设置页填写目标小红书主页 URL、刷新周期、
   loopback Bridge 地址和同一共享令牌。
3. 扩展使用用户自己的 Chrome 会话打开主页，只提取页面已经展示的昵称和粉丝数。
4. 扩展把标准化快照发送到 `127.0.0.1`；Bridge 验证数据后生成 52×16 PNG。
5. Bridge 将 TC002 Custom App JSON payload 以 retained MQTT 消息发布到用户配置的 topic。

## 跨电脑动态配置

应用必须能从 GitHub 克隆到另一台受支持电脑后直接配置运行，不依赖开发机状态。代码、清单、
文档和测试中不得把以下部署参数写死为唯一可用值：

- 操作系统用户名、绝对文件路径、Chrome 用户数据目录或扩展 ID；
- 小红书用户 ID、主页 URL、昵称或粉丝数；
- Bridge 端口、共享令牌或其他本机生成的秘密；
- MQTT broker 地址、端口、用户名、密码、TLS 选项、client ID 或 TC002 topic；
- TC002 设备名称、局域网 IP、MAC 地址或其他设备标识。

Chrome 设置页动态保存每台电脑自己的主页列表、刷新周期、Bridge URL 和令牌；Bridge 从当前进程的
环境变量读取 MQTT 与 HTTP 配置。MQTT client ID 未配置时在当前进程动态生成。代码只使用相对项目
路径和标准 Node.js/Chrome API，不依赖 macOS、Windows 或 Linux 的专属目录结构或 shell 行为。

允许提供安全、可覆盖的示例或默认值，例如 `http://127.0.0.1:17321`、刷新 30 秒和示例 MQTT
topic。`127.0.0.1` 是所有受支持电脑共有的 loopback 地址，用于确保浏览器数据不会暴露到局域网；
它不是开发机专属地址。端口和完整 Bridge URL 均可配置，但发布版 Bridge 仍只允许绑定 loopback。

支持范围为运行 Node.js 20+ 和 Chrome/Chromium Manifest V3 的 Windows、macOS 与 Linux。

## 发布目录与职责

```text
apps/mqtt/xiaohongshu-follower-counter/
├── README.md                # 上游应用索引入口与快速开始
├── package.json             # Node 版本、版本号、启动/测试/检查命令
├── .env.example             # 无凭证的 Bridge 配置模板
├── extension/               # 可直接“加载已解压扩展”的 MV3 源码
├── bridge/                  # HTTP、校验、渲染和 MQTT 客户端
├── test/                    # Node 单元、契约和 loopback 端到端测试
├── docs/
│   ├── README.md            # 完整安装、配置、接口、安全与排障文档
│   ├── LICENSE              # GPL-3.0-or-later 全文
│   └── PR.md                # 可复制到 GitHub 的 PR 描述和检查清单
└── preview/
    ├── demo.png             # 明确标注为渲染预览
    └── README.md            # 真机照片/GIF 的采集与替换要求
```

所有源码文件保留 `SPDX-License-Identifier: GPL-3.0-or-later`。不向上游提交扩展 ZIP、
`node_modules/`、日志、真实 `.env`、Cookie、token 或页面转储。

## Chrome 扩展发布要求

- 使用 Manifest V3，版本号与 `package.json` 一致。
- 权限仅限调度、设置、临时标签页、小红书主页及 IPv4 loopback Bridge。
- 不申请 `cookies`、`webRequest`、`<all_urls>` 或浏览历史权限。
- 设置页提供主页 URL、按秒计算的刷新间隔、Bridge URL、共享令牌和最近运行状态。
- 首次安装使用通用默认值；保存后所有采集目标和连接参数均来自 `chrome.storage.local`，不得回退到
  开发期间使用的真实主页或令牌。
- 刷新配置使用 `refreshSeconds`，默认 30 秒，最低 5 秒；旧版 `refreshMinutes` 在首次运行时
  自动换算为秒并删除旧字段，避免升级后静默改变用户周期。
- 调度继续使用 `chrome.alarms`，把秒换算为 fractional minutes。该 5 秒周期面向仓库文档要求的
  “加载已解压扩展”模式；正式打包分发时 Chrome 可能把周期限制为至少 30 秒。
- 设置页明确提示 5 秒只适合短期联调，长期运行建议至少 60 秒，以降低登录验证和访问限流风险。
- 不实现验证码、登录或访问限制绕过。
- 扩展目录本身必须可直接加载；图标使用项目自有简单像素素材，不包含第三方商标素材。

## Bridge 发布要求

- 运行环境为 Node.js 20 或更高版本，运行时零 npm 第三方依赖。
- HTTP 服务固定监听 `127.0.0.1`，写接口必须使用 Bearer 共享令牌。
- 配置全部来自环境变量；`.env.example` 只给出安全示例，程序不隐式读取 `.env`。
- 启动、检查和测试命令必须通过 `npm` 与 Node.js 实现，不要求 Bash、PowerShell 或特定绝对路径。
- 支持 MQTT 3.1.1 TCP、可选用户名/密码和 TLS，发布 retained QoS 0 payload。
- 启动时检查必填配置并输出不含密码和令牌的配置摘要。
- 提供 `npm run check`，统一执行测试、语法检查、清单检查和敏感信息检查。

## 文档要求

文档解释本地实现方式，并让不了解代码的用户能够完成：

- 安装 Node.js、启动 Bridge、加载扩展和配置目标主页；
- 查找和填写 TC002 MQTT topic；
- 用 health API、手工 HTTP 请求和 MQTT 订阅工具逐段排查；
- 理解 `11.6万` 被标准化为 `116000`，但不代表精确到个位；
- 理解页面结构变化、登录验证、刷新限流和 Custom App schema 演进风险；
- 理解扩展不会读取 Cookie，但页面访问仍受小红书规则和用户账号权限约束。

`docs/PR.md` 按上游贡献指南提供 PR 标题、功能摘要、验证证据和勾选清单。

## 测试与验收

自动验收至少覆盖：

- 粉丝数字和 `万/亿/k/m` 单位转换；
- 小红书内嵌 JSON 与真实 DOM 统计顺序；
- 扩展权限、消息字段、5 秒下限、秒到 fractional minutes 换算、旧分钟配置迁移和版本一致性；
- Windows、macOS、Linux 共用的相对路径与运行时配置契约；
- 扫描源码和清单，拒绝开发机绝对路径、真实主页 ID、固定 broker、固定凭证和固定设备标识；
- HTTP loopback 绑定、CORS、Bearer 鉴权与输入限制；
- 52×16 PNG 和 TC002 Custom App payload；
- MQTT CONNECT、CONNACK、retained PUBLISH 及真实 loopback socket；
- README、许可证、`.env.example`、PR 模板和预览声明；
- 禁止提交常见凭证、Cookie、`.env`、日志和依赖目录。

发布前运行 `npm run check` 和 `git diff --check`，并确认工作树中没有无关文件。

## 真机证据边界

上游贡献指南要求 `preview/` 中包含真实 TC002 运行截图或 GIF。当前 `demo.png` 是由渲染器生成的
52×16 像素预览，只能用于开发验证，不能冒充真机证据。本轮会补充拍摄说明和明确标注，
但正式提交 PR 前必须由设备持有人提供真实照片或 GIF；收到素材后替换或新增
`preview/tc002-real.jpg`/`preview/tc002-real.gif`，并在文档中引用。

## 非目标

- 不把项目拆成独立 GitHub 仓库。
- 不发布 Chrome Web Store 包，也不请求商店审核权限。
- 不增加 Home Assistant、Docker、Electron 或常驻系统服务封装。
- 不获取小红书内部精确粉丝数，不破解签名、验证码或风控。
- 不自动 push、创建 PR 或代表用户提交外部内容；这些动作需要另行明确授权。

## 完成标准

除真实 TC002 素材这一项外，代码、文档、配置模板、检查命令和 PR 描述均在当前分支准备完成；
全部自动测试及发布检查通过。加入用户提供的真机素材并复核文档引用后，即满足上游 PR 提交条件。
