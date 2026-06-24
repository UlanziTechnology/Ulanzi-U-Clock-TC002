# Ulanzi U-Clock TC002

Ulanzi TC002 像素时钟的官方开源开发资料。本仓库面向希望在 TC002 上做二次开发的开发者，提供完整的 IDE 使用说明、平台 SDK 示例工程，以及覆盖各硬件外设的可运行 Demo。

> 想了解使用方法、社区固件请前往产品官方页面；本仓库**只关心如何写代码、编译、烧录到 TC002**。

## 硬件简介

| 项目 | 规格 |
|---|---|
| SoC 平台 | Z21 系列（基于 Linux） |
| 显示 | 52 × 16 全彩 RGB LED 点阵，SPI 驱动 |
| 输入 | 1 个旋钮（顺/逆/按下）+ 3 个独立按键 |
| 音频 | 内置喇叭，支持 MP3 播放，0~6 级音量 |
| MIC | 由 MCU 上报音量数据 |
| 无线 | Wi-Fi + BLE（BLE 依赖 Wi-Fi 已开启） |
| 用户 GPIO | `GPIO_06`、`GPIO_85` 两个 LED 引脚预留 |
| 升级口 | USB-C，旁边带强制恢复按钮 |

## 仓库结构

```
.
├── IDE使用说明/           # FlyThings IDE 开发文档（HTML + Markdown）
│   ├── 说明文档.md
│   ├── 说明文档.html
│   └── resources/
└── Z21_TC002_Demo/        # Z21 平台示例工程，可直接导入 IDE 编译
    ├── Manifest.xml       # 项目清单：平台、依赖包
    ├── ui/                # *.ftu 界面文件（用 IDE 可视化编辑）
    ├── src/
    │   ├── Main.cpp       # 入口：初始化 MCU、启动界面
    │   ├── activity/      # IDE 自动生成，请勿手动修改
    │   ├── logic/         # 每个 ftu 对应一个 *Logic.cc，写界面逻辑
    │   ├── pages/         # 各功能演示页 (Btn/Rgb/Audio/Wifi)
    │   ├── managers/      # KeyManager / AudioManager / McuManager 等
    │   ├── mcuProtocol/   # MCU 串口协议
    │   ├── ble/           # BLE GATT 服务
    │   ├── utils/         # GpioHelper 等工具
    │   └── dependencies/  # 私有静态库 (gatt-server) 与可执行文件
    ├── resources/         # 随固件打包的资源文件
    └── README.md          # Demo 各功能 API 速查
```

## 快速开始

### 1. 安装 FlyThings IDE

下载并安装 [FlyThings IDE](https://download.s21i.co99.net/14731609/0/0/ABUIABBPGAAglMLczgYo0Mjk3AU.zip?f=flythings-ide-win32-win32-x86-zkswe-setup.zip&v=1775706403)（Windows）。
完整安装与界面说明见 [`IDE使用说明/说明文档.md`](IDE使用说明/说明文档.md)。

### 2. 导入示例工程

`文件` → `导入` → `常规` → `现有项目到工作空间中`，浏览到 `Z21_TC002_Demo/`，确认后完成导入。

### 3. 编译

选中项目，使用快捷键 `Ctrl + Alt + Z`，或工具栏绿色三角按钮编译。
编译产物输出到 `Release/`。

### 4. 烧录调试

TC002 自带 Wi-Fi，**只能用 Wi-Fi 进行 ADB 调试**（USB 数据口为 U 盘模式）：

1. 设备连接到与电脑同一局域网，记下 IP；
2. IDE → `调试配置` → `ADB配置` → 选择 **WIFI** 并填入 IP；
3. 项目右键 → `下载调试`，或 `Ctrl + Alt + R`。

下载调试**不会固化**，断电后恢复。需要持久化时使用 `镜像编译` 生成 `update.img`，拷到 FAT32 格式 TF 卡根目录后插卡上电即可触发升级。

### 5. 恢复出厂固件

按住 USB-C 旁的复位按钮上电，会自动刷回官方固件。

## 关键 API 速查

下表只列示例工程已经封装好的高层 API。底层平台 API（`EASYUICONTEXT`、`UARTCONTEXT`、`StoragePreferences`、`TimeHelper` 等）参见 IDE 说明文档。

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

### MIC 音量

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

## 开发注意事项

- **防砖标志**：每次启动必须在入口处置位，否则系统将触发回滚到官方固件。

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
- **UI 主线程不得阻塞**：`onUI_init` / `onUI_Timer` 等回调不要做耗时操作，否则插卡升级界面无法弹出。
- **不要手动修改** `src/activity/` 下的文件，那是 IDE 根据 `*.ftu` 自动生成的。

## 示例工程包含的页面

| Activity | 演示内容 | 关键文件 |
|---|---|---|
| `mainActivity` | 主菜单，进入各 Demo | `pages/PageBase.*`、`logic/mainLogic.cc` |
| `btnTestActivity` | 旋钮 + 三按键事件 | `pages/BtnTestPage.*` |
| `rgbTestActivity` | LED 灯板刷帧 | `pages/RgbTestPage.*` |
| `audioTestActivity` | 音频播放 + MIC 实时音量 | `pages/AudioTestPage.*` |
| `wifiTestActivity` | Wi-Fi 连接 + BLE 服务 | `pages/WifiTestPage.*`、`ble/` |

## 进一步阅读

- [`IDE使用说明/说明文档.md`](IDE使用说明/说明文档.md) — FlyThings IDE 完整开发指南：项目结构、Manifest、定时器、串口框架、网络、存储、ADB、镜像、远程升级等
- [`Z21_TC002_Demo/README.md`](Z21_TC002_Demo/README.md) — 各硬件外设 Demo 的 API 说明（含旋钮/按键码、SPI、Audio、MIC、Wi-Fi/BLE、GPIO）
- [FlyThings 依赖包仓库](https://package.flythings.cn/)

## 🛠️ 社区开发者工具 (Community Tools)

### 🌐 [TC002 Web 模拟器与像素工作室 (Live Demo)](https://puritysb.github.io/tc002-emulator/)
一个基于网页的高保真 Ulanzi TC002（52x16 LED 点阵）交互式模拟器和视觉布局设计工作室，可在浏览器中实时预览画面和动画。

* **5 级触觉字体缩放**: 瞬间调整 5 档物理字体大小，支持从紧凑的 `Mini (2x3)` 到占满全屏的 `Giant (10x15)` 像素点阵实时间距膨胀。
* **像素混合与特效渲染 (Pixel Blending & Shaders)**: 支持将动态背景可视化效果（熔岩波浪、网络扫掠格点）与先进的文本特效（对流火焰粒子、掩膜矩阵代码雨）进行加色/透明度混合合成。
* **物理麦克风波形 scope**: 利用浏览器 Web Audio API 捕获真实声音输入，并将实时波形能量投影为动感的 CRT 绿磷光示波器波纹。
* **物理旋钮与面板控制**: 支持在浏览器中直接模拟双向 WebSocket 数据帧、旋钮旋转、物理按键点击音效和状态 LED 点亮状态。

*开源代码仓库: [puritysb/tc002-emulator](https://github.com/puritysb/tc002-emulator)*

## 许可

本项目主体代码采用 **[GNU General Public License v3.0 or later (GPL-3.0-or-later)](LICENSE)** 发布。

任何衍生作品（包括但不限于二次开发的固件、修改版的 Demo）在分发时必须：

- 以同样的 GPL-3.0-or-later 协议开放源代码
- 保留原作者版权声明
- 在文档中明确标注修改

仓库内还包含若干第三方组件（BlueZ、Adafruit GFX 字体、FlyThings SDK 等），分别遵循其原始许可证。详见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。
