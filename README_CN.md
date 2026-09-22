# 优篮子 U-Clock TC002 像素时钟

Ulanzi TC002 像素时钟的官方开源资料。无论你是想**不写代码直接控制设备**（HTTP / MQTT 接入 Home Assistant），还是想用 FlyThings IDE **开发自己的固件**，都可以在本仓库找到入口。

> 🌐 其他语言版本：[English](README_EN.md)

> 📘 **协议文档已发布**：完整 HTTP 接口与 MQTT 主题参考（含字段说明、示例与限制）见 [`protocol/`](protocol/)，**中英双语**。

---

## 新手速览

- **只想不写代码往时钟上显示文字** → 直接看 [不写代码快速上手](#不写代码快速上手httpmqtt)，只需要设备 IP 和一个 `curl` / MQTT 客户端。
- **在做 Home Assistant / Node-RED 集成** → 读 [协议文档](#完整协议文档) 并照抄示例即可。
- **想用 C++ 写自己的固件** → 见 [快速开始（开发）](#快速开始开发)。

> ⚠️ **几乎所有人都会踩的两个坑（先读！）**
>
> 1. **文字仅支持 ASCII 字符**（`0x20`–`0x7E`，即英文字母、数字、基础标点）。**中文、emoji、`°` 温度符号都无法显示。** 要显示中文请先渲染成图片/GIF 再用 `image` 元素推送。
> 2. **推送内容不会自动切换 App**。必须先让时钟停留在对应的自定义 App 上（用 `switchDiyApp` 接口或设备菜单切换），推送才会显示。

---

## 三种玩法

| 你的目标 | 入口 |
| --- | --- |
| 不写代码控制：推送文字图片、接入 Home Assistant | [protocol/](protocol/) — HTTP & MQTT 协议文档（中英） |
| 导入现成的 MQTT 应用（HA 蓝图、脚本） | [apps/mqtt/](apps/mqtt/) |
| 用 FlyThings IDE 开发自己的固件 | [IDE 使用说明 / 说明文档.md](IDE使用说明/说明文档.md) + [Z21_TC002_Demo/](Z21_TC002_Demo/README.md) |

> 社区已基于本仓库做出 AI 运行状态指示、粉丝统计、CI 状态板等玩法，详见 [apps/mqtt/](apps/mqtt/)。

---

## 硬件简介

| 项目 | 规格 |
| --- | --- |
| SoC 平台 | Z21 系列（基于 Linux） |
| 显示 | 52 × 16 全彩 RGB LED 点阵，SPI 驱动 |
| 输入 | 1 个旋钮（顺 / 逆 / 按下）+ 3 个独立按键 |
| 音频 | 内置喇叭，支持 MP3 播放，0~6 级音量 |
| MIC | 由 MCU 上报音量数据 |
| 无线 | Wi-Fi + BLE（BLE 依赖 Wi-Fi 已开启） |
| 用户 GPIO | `GPIO_06`、`GPIO_85` 两个 LED 引脚预留 |
| 升级口 | USB-C，旁边带强制恢复按钮 |

---

## 不写代码快速上手：HTTP 与 MQTT

设备内置**本地 Web 服务器**与 **MQTT 客户端**：你可以向屏幕**推送文字、图片、绘图**，切换应用，模拟按键，读取设备状态，并接入 **Home Assistant、Node-RED 或自己的脚本**。

> 适用于官方原厂固件。

### 准备工作

- 时钟与电脑在**同一局域网**。
- 用 Ulanzi Studio（免费）查设备 IP 与 MAC，或看路由器 DHCP 列表。
- `curl`（HTTP）和/或 MQTT 客户端如 `mosquitto_pub`（MQTT）。

### 找到设备 IP

打开 Ulanzi Studio 设备页，或查看路由器 DHCP 客户端列表。设备本地 Web 服务地址为 `http://<设备IP>`。

### 找到 MQTT 主题前缀（仅 MQTT 时需要）

MQTT 主题前缀 `PREFIX` = `mqtt_prefix` + `_` + 设备 MAC 地址**后 2 字节（即 4 个十六进制字符）**（默认 `mqtt_prefix` 为 `ulanzi`）。

**如何获取 MAC**：

- Ulanzi Studio 设备页会显示 MAC，如 `A1:B2:C3:D4:E5:F6` → 后 2 字节为 `E5F6`（4 个十六进制字符）→ 前缀 `ulanzi_e5f6`。
- 或调用接口：`GET http://<设备IP>/getBase` → 取 `mac` 字段（如 `a1b2c3d4e5f6`）末 4 位 `e5f6`。

> 使用前需先在设备上**开启 MQTT**（设置 → MQTT，或 `POST /setMqttConfig` 传 `isMqtt:true`）。见 [协议文档](#完整协议文档)。

### HTTP 推送文字示例

```bash
curl -X POST "http://<设备-ip>/api/custom?name=hello" \
  -H "Content-Type: application/json" \
  -d '{"text":[{"content":"HELLO","fontHeight":10,"align":"center","valign":"middle","color":"#FFFFFF"}]}'
```

> 设备需已停留在自定义 App `hello` 页面；如需先切换：

```bash
curl -X POST "http://<设备-ip>/api/switchDiyApp?name=hello"
```

### MQTT 推送示例

```bash
mosquitto_pub -h <broker-ip> -t ulanzi_e5f6/custom/hello \
  -m '{"text":[{"content":"HELLO","fontHeight":10,"align":"center","valign":"middle","color":"#FFFFFF"}]}'
```

把 `ulanzi_e5f6` 换成你在第 2 步得到的真实前缀。

### 推送图片或动图（GIF）

`image` 元素支持 PNG 或 GIF 的 base64 Data URL。静态图最大 512×512；**GIF 最大 256×256、≤ 50 帧**，base64 后 ≤ 60 KB。超出 52×16 的部分从左上角裁剪（不缩放）。

```bash
curl -X POST "http://<设备-ip>/api/custom?name=hello" \
  -H "Content-Type: application/json" \
  -d '{"image":[{"data":"data:image/gif;base64,<BASE64>","position":[0,0]}]}'
```

### 新手常见坑

- **仅支持 ASCII** — 见上方速览。中文请改用预渲染的图片/GIF。
- **推送 ≠ 切换** — 推送只更新**当前正在显示**的 App，用 `switchDiyApp` 把它切到前台。
- **`fontHeight` 仅支持 5 或 10** — 其他值被忽略。
- **需先开启 MQTT** — 设备默认关闭 MQTT，需先在设置或 `/setMqttConfig` 开启。
- **单个 App 有上限** — 最多 6 个图像元素、32 条绘图指令。

---

## 完整协议文档

完整、权威的协议参考单独成篇（中英双语）。**所有字段、接口与边界情况请以这两份文档为准。**

| 语言 | 文件 |
| --- | --- |
| 中文版 | [protocol/Ulanzi_TC002_protocol-http-mqtt_CN.md](protocol/Ulanzi_TC002_protocol-http-mqtt_CN.md) |
| English | [protocol/Ulanzi_TC002_protocol-http-mqtt_en.md](protocol/Ulanzi_TC002_protocol-http-mqtt_en.md) |

**文档包含：**

- **24 个 HTTP 接口**：设备信息、全局/Wi-Fi/社媒/日程/工具/MQTT 配置、Custom App 增删查、应用切换、模拟按键、固件升级、蓝牙、恢复出厂。
- **MQTT 主题**：设备→客户端状态/基础信息/列表，客户端→设备推送与切换，以及可选的 HA 自动发现。
- **Payload 字段**：`text` / `image` / `draw` 各字段的类型、默认值与限制。
- **完整示例**：推送文字、切换 App、模拟按键、跳转内置应用、调节音量。
- **能力边界**：协议暂未开放的能力。

### 能力一览

| 功能 | HTTP | MQTT |
| --- | --- | --- |
| 推送画面 | `POST /api/custom?name=<app>` | `[PREFIX]/custom/<APP_NAME>` |
| 查看列表 | `GET /api/customList` | `[PREFIX]/customList`（设备推送） |
| 切换 App | `POST /api/switchDiyApp?name=<app>` | `[PREFIX]/switchDiyApp` |
| 系统配置 | `POST /setConfig`、`/setMqttConfig`、… | — |
| 模拟按键旋钮 | `POST /keyEvent` | — |
| 跳转内置应用 | `POST /switchApp` | — |
| 设备信息 | `GET /getBase` | `[PREFIX]/getBase`（设备推送） |
| 状态 | — | `[PREFIX]/status`（`online` / `offline`） |
| HA 自动发现 | — | `homeassistant/device/[PREFIX]/config`（可开启） |

### 能力边界

| 支持 | 暂不支持 |
| --- | --- |
| 向自定义 App 推送文字、图片、绘图 | 音频播放 / TTS |
| 查看、切换自定义 App | 物理按键事件上行（协议为单向，仅可模拟） |
| 模拟按键与旋钮 | 中文渲染（仅支持 ASCII） |
| 设备配置、固件升级、恢复出厂 | 网页界面语言切换（CN → EN） |

---

## 仓库结构

```
.
├── protocol/            # 协议文档（中英）
│   ├── Ulanzi_TC002_protocol-http-mqtt_en.md   # 英文参考
│   └── Ulanzi_TC002_protocol-http-mqtt_CN.md   # 中文参考
├── IDE使用说明/          # FlyThings IDE 开发文档
│   ├── 说明文档.md
│   ├── 说明文档.html
│   └── resources/
├── Z21_TC002_Demo/      # 官方示例工程
│   ├── Manifest.xml
│   ├── ui/              # *.ftu 界面文件
│   ├── src/
│   │   ├── Main.cpp     # 入口
│   │   ├── activity/    # IDE 自动生成，勿改
│   │   ├── logic/       # 界面逻辑
│   │   ├── pages/       # 演示页
│   │   ├── managers/    # KeyManager / AudioManager / McuManager
│   │   ├── mcuProtocol/ # MCU 串口协议
│   │   ├── ble/         # BLE GATT 服务
│   │   ├── utils/       # GpioHelper 等
│   │   └── dependencies/# 私有静态库
│   ├── resources/
│   └── README.md        # 各功能 API 速查
├── apps/                # 社区贡献的应用
│   ├── flythings/       # 第三方设备端应用
│   └── mqtt/            # MQTT 集成方案
├── CONTRIBUTING.md      # 贡献指南
├── LICENSE              # GPL-3.0-or-later
└── THIRD_PARTY_NOTICES.md  # 第三方组件声明
```

---

## 快速开始（开发）

### 1. 安装 FlyThings IDE

下载并安装 [FlyThings IDE](https://download.s21i.co99.net/14731609/0/0/ABUIABBPGAAglMLczgYo0Mjk3AU.zip?f=flythings-ide-win32-win32-x86-zkswe-setup.zip&v=1775706403)（Windows）。完整安装与界面说明见 [IDE 使用说明 / 说明文档.md](IDE使用说明/说明文档.md)。

### 2. 导入示例工程

`文件` → `导入` → `常规` → `现有项目到工作空间中`，浏览到 `Z21_TC002_Demo/`，确认后完成导入。

### 3. 编译

选中项目，使用快捷键 `Ctrl + Alt + Z`，或工具栏绿色三角按钮编译。编译产物输出到 `Release/`。

### 4. 烧录调试（Wi-Fi ADB）

TC002 自带 Wi-Fi，**只能用 Wi-Fi 进行 ADB 调试**（USB 数据口为 U 盘模式）：

1. 设备连接到与电脑同一局域网，记下 IP；
2. IDE → `调试配置` → `ADB配置` → 选择 **WIFI** 并填入 IP；
3. 项目右键 → `下载调试`，或 `Ctrl + Alt + R`。

下载调试**不会固化**，断电后恢复。需要持久化时使用 `镜像编译` 生成 `update.img`，拷到 FAT32 格式 TF 卡根目录后插卡上电即可触发升级。

### 5. 恢复出厂固件

按住 USB-C 旁的复位按钮上电，会自动刷回官方固件。

---

## 关键 API 速查

以下只列示例工程已经封装好的高层 API。底层平台 API（`EASYUICONTEXT`、`UARTCONTEXT`、`StoragePreferences`、`TimeHelper` 等）参见 IDE 说明文档。

### LED 显示

```cpp
// 52*16 像素，每像素 3 字节 RGB，按行优先
uint8_t rgbData[52 * 16 * 3];
PageBase::sendLedData(rgbData);   // 内部已节流，帧间隔 ≥ 15ms
```

### 按键事件

```cpp
#include "managers/KeyManager.h"
KeyManager::getInstance().addKeyEventCallback([](int code){
  // E_KEYCODE_CLOCKWISE / ANTI_CLOCKWISE / KNOB_BUTTON
  // E_KEYCODE_LEFT_BUTTON / MIDDLE_BUTTON / RIGHT_BUTTON
});
```

### 音频播放

```cpp
#include "managers/AudioManager.h"
auto& audio = awtrix::AudioManager::getInstance();
audio.setVolume(3);                  // 0~6
audio.playAudio("/path/to/file.mp3");
audio.pauseAudio(); audio.resumeAudio(); audio.stopAudio();
```

### MIC 电量

```cpp
#include "managers/McuManager.h"
McuManager::getInstance().setAutoMicReport(true);
int mic = McuManager::getInstance().queryMicValue();
```

### Wi-Fi 与 BLE

```cpp
#include <base/wifi.h>
#include "ble/bluetooth_service.h"
base::wifiOnAndWait(10);             // 必须先开 Wi-Fi
BluetoothParams p;
p.name = "Ulanzi TC002 AB12";
p.on_message = [](const std::string& msg) { /* ... */ };
BluetoothService::instance().start(p);
```

可选：把 Wi-Fi/BLE 参数预置到 U 盘 `/mnt/usb1/test.cfg`：

```json
{ "ssid": "...", "pwd": "...", "isConnect": true, "ble": "MyName" }
```

`ble` 留空时设备名自动取 MAC 后四位（`Ulanzi TC002 XXXX`）。

### 用户 GPIO

```cpp
#include "utils/GpioHelper.h"
GpioHelper::output("GPIO_06", 1);    // 仅 GPIO_06 / GPIO_85 预留
```

---

## 开发注意事项

- **防砖标志**：每次启动必须在入口处置位，否则系统将触发回滚到官方固件：

```cpp
#include <os/SystemProperties.h>
SystemProperties::setString("sys.zkapp.state", "running");
```

- **MCU 初始化必须先于 LED 刷新**：

```cpp
McuManager::getInstance().initialize(
  new PixelMcuProto::McuParse("/dev/ttyS1", 1500000));
std::string ver;
McuManager::getInstance().queryMcuVersion(ver);
```

- **SPI 帧率**：`sendLedData` 帧间隔不得 < 15ms，已内置节流，直接调用即可。
- **BLE 依赖 Wi-Fi**：必须确认 Wi-Fi 起来后再启动 BLE。
- **UI 主线程不得阻塞**：`onUI_init` / `onUI_Timer` 回调不要做耗时操作，否则插卡升级界面无法弹出。
- **不要手动修改** `src/activity/` 下的文件，那是 IDE 根据 `*.ftu` 自动生成的。

---

## 示例工程包含的页面

| Activity | 演示内容 | 关键文件 |
| --- | --- | --- |
| `mainActivity` | 主菜单，进入各 Demo | `pages/PageBase.*`, `logic/mainLogic.cc` |
| `btnTestActivity` | 旋钮 + 三按键事件 | `pages/BtnTestPage.*` |
| `rgbTestActivity` | LED 灯板刷帧 | `pages/RgbTestPage.*` |
| `audioTestActivity` | 音频播放 + MIC 实时电量 | `pages/AudioTestPage.*` |
| `wifiTestActivity` | Wi-Fi 连接 + BLE 服务 | `pages/WifiTestPage.*`, `ble/` |

---

## 社区应用

社区开发者已基于本仓库做出不少实用玩法：

- **Home Assistant 蓝图**：一键导入通过 MQTT 控制 TC002（见 [apps/mqtt/](apps/mqtt/)）。
- **AI 运行状态指示**：通过 MQTT 把 AI 思考 / 完成状态显示在时钟上，无需刷固件。
- **粉丝统计**：如小红书粉丝数。
- **CI 状态板、正在播放、年度进度、桌宠** 等更多玩法。

想分享你的作品？参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## 常见问题

**Q: 我推的文字不显示，为什么？**
A: 常见三个原因：① 时钟还没切到该自定义 App（推送≠切换，用 `switchDiyApp`）；② 文字含非 ASCII 字符（中文、emoji、`°`）无法渲染；③ `fontHeight` 不是 5 或 10。

**Q: 怎么拿到我的 MQTT 主题前缀？**
A: `mqtt_prefix`（默认 `ulanzi`）+ `_` + MAC 后 2 字节（4 个十六进制字符）。MAC 可在 Ulanzi Studio 或 `GET /getBase` 取得。如 MAC 尾号 `E5F6` → `ulanzi_e5f6`。

**Q: 能显示中文吗？**
A: 不能直接显示，文字仅支持 ASCII。请先把中文渲染成 PNG/GIF，再用 `image` 元素推送。

**Q: 长文字有滚动/跑马灯吗？**
A: 没有内置跑马灯。请控制在 52×16 内，或预渲染更宽的图片/GIF。

**Q: Custom App 和 DIY App 有什么区别？**
A: Custom App 通过 HTTP/MQTT **实时创建/推送**（不落盘），可用 `switchDiyApp` 远程切换；DIY App 是上传到设备的文件。协议控制的是 Custom App。

**Q: 为什么 `carouselSpeed` 不轮播我的自定义 App？**
A: 轮播只针对内置工具类应用，自定义 App 需主动推送/切换显示。

---

## 安全提示

本地 HTTP 接口与 MQTT 客户端**无鉴权**，且接受跨域请求。请将时钟视为**仅限局域网内的可信设备**：

- 将时钟放在**私密、可信的 Wi-Fi** 下，不要将其 HTTP 端口暴露到公网。
- 使用**带账号密码的私有 MQTT broker**（或私有 HA broker），不要连开放/公共 broker。
- 同一局域网内的任何人都可控制显示、读取设备信息；必要时与访客网络隔离。
- 设备内置网页目前**仅中文**（英文界面在评估中）。

---

## 进一步阅读

- [protocol/](protocol/) — HTTP 与 MQTT 协议文档（中英）
- [IDE 使用说明 / 说明文档.md](IDE使用说明/说明文档.md) — FlyThings IDE 完整开发指南
- [Z21_TC002_Demo/README.md](Z21_TC002_Demo/README.md) — 各硬件外设 Demo 的 API 说明
- [FlyThings package repository / FlyThings 依赖包仓库](https://package.flythings.cn/)
- [apps/mqtt/README.md](apps/mqtt/README.md) — 社区 MQTT 应用索引

---

## 社区贡献

欢迎社区开发者向本仓库提交两类应用：

- **FlyThings 应用**：跑在 TC002 设备本体上的 C++ 工程，提交到 [apps/flythings/](apps/flythings/)。
- **MQTT 应用**：主要为 Home Assistant 蓝图，提交到 [apps/mqtt/](apps/mqtt/)（见 [apps/mqtt/README.md](apps/mqtt/README.md)）。

完整提交规范、目录约定、PR 流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## 许可

本项目主体代码采用 [GNU General Public License v3.0 or later (GPL-3.0-or-later)](LICENSE) 发布。

任何衍生作品（包括但不限于二次开发的固件、修改版的 Demo）在分发时必须：

- 以同样的 GPL-3.0-or-later 协议开放源代码
- 保留原作者版权声明
- 在文档中明确标注修改

仓库内还包含若干第三方组件（BlueZ、Adafruit GFX 字体、FlyThings SDK 等），分别遵循其原始许可证。详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
