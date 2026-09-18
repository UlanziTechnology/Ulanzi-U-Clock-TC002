# Ulanzi U-Clock TC002

Official open-source resources for the **Ulanzi TC002** pixel clock — a 52×16 RGB desktop clock with a local HTTP API and an MQTT client. Whether you want to **control the clock without writing code** (HTTP / MQTT, Home Assistant) or **build your own firmware** with the FlyThings IDE, everything is here.

> 🌐 Other languages: [中文文档 / Chinese](README_CN.md)

> 📘 **The protocol is documented.** The full HTTP API + MQTT topic reference (payload schemas, examples, limitations) lives in [`protocol/`](protocol/), in **English** and **中文**.

---

## TL;DR — New here? Start here

- **I just want to show text on the clock, no coding** → jump to [Quick Start (No Code)](#quick-start-no-code-http--mqtt). You only need the device IP and a `curl` / MQTT client.
- **I'm building a Home Assistant / Node-RED integration** → read the [Protocol Reference](#protocol-reference) and copy the examples.
- **I want to write my own firmware (C++)** → see [Getting Started (Development)](#getting-started-development).

⚠️ **Two things that trip up almost everyone (read first!):**

1. **Text is ASCII-only.** The clock renders only characters `0x20`–`0x7E` (English letters, digits, basic punctuation). **Chinese, emoji and `°` will NOT show.** For non-Latin text, pre-render a PNG/GIF and push it via the `image` element.
2. **Pushing content does NOT switch the app.** You must first make the clock show that custom app (via the `switchDiyApp` API or the on-device menu) before your push is visible.

---

## Three Ways to Use This Repository

| Your goal | Go here |
| --- | --- |
| Control TC002 **without writing code** — push text & images, integrate with Home Assistant | [protocol/](protocol/) — HTTP & MQTT protocol docs |
| Import **ready-made MQTT apps** (Home Assistant blueprints, scripts) | [apps/mqtt/](apps/mqtt/) |
| **Develop your own firmware** (C++) with the FlyThings IDE | [IDE 使用说明 / 说明文档.md](IDE使用说明/说明文档.md) + [Z21_TC002_Demo/](Z21_TC002_Demo/README.md) |

> Community showcases built on this repo: [apps/mqtt/](apps/mqtt/) includes follower counters, AI-status indicators, CI boards and more.

---

## Hardware at a Glance

| Item | Spec |
| --- | --- |
| SoC platform | Z21 series (Linux based) |
| Display | 52 × 16 full-color RGB LED matrix, SPI driven |
| Input | 1 knob (CW / CCW / press) + 3 buttons |
| Audio | Built-in speaker, MP3 playback, volume 0–6 |
| MIC | Volume reported by MCU |
| Wireless | Wi-Fi + BLE (BLE requires Wi-Fi to be on) |
| User GPIO | `GPIO_06`, `GPIO_85` LED pins reserved |
| Upgrade | USB-C, with forced-recovery button beside it |

---

## Quick Start (No Code): HTTP & MQTT

The device runs a **local web server** and an **optional MQTT client**. Push **text, images and drawings** onto the display, switch apps, simulate key presses, read device state, and integrate with **Home Assistant, Node-RED or your own scripts**.

> Applies to the official factory firmware.

### Step 0 — What you need

- The clock and your computer on the **same Wi-Fi/LAN**.
- [Ulanzi Studio](https://www.ulanzi.com) (free) to find the device IP & MAC, or check your router's DHCP list.
- `curl` (for HTTP) and/or a MQTT client such as `mosquitto_pub` (for MQTT).

### Step 1 — Find your device IP

Open Ulanzi Studio → device page, or look up your router's DHCP client list. The device's local web server runs on `http://<device-ip>`.

### Step 2 — Find your MQTT topic prefix (MQTT only)

MQTT topics are prefixed with `PREFIX` = **`mqtt_prefix` + `_` + the last two characters of the device MAC** (default `mqtt_prefix` is `ulanzi`).

**How to get the MAC:**
- Ulanzi Studio device page shows the MAC, e.g. `A1:B2:C3:D4:E5:F6` → last two chars are `E5F6` → prefix `ulanzi_e5f6`.
- Or call the HTTP API: `GET http://<device-ip>/getBase` → the `mac` field (e.g. `a1b2c3d4e5f6`) → use the last 4 hex chars `e5f6`.

> MQTT must be **enabled on the device first** (Settings → MQTT, or `POST /setMqttConfig` with `isMqtt:true`). See the [Protocol Reference](#protocol-reference).

### Step 3 — Push "HELLO" over HTTP

```bash
curl -X POST "http://<device-ip>/api/custom?name=hello" \
  -H "Content-Type: application/json" \
  -d '{"text":[{"content":"HELLO","fontHeight":10,"align":"center","valign":"middle","color":"#FFFFFF"}]}'
```

> The device must already be showing the custom app `hello`. To switch to it first:

```bash
curl -X POST "http://<device-ip>/api/switchDiyApp?name=hello"
```

### Step 4 — Push the same over MQTT

```bash
mosquitto_pub -h <broker-ip> -t ulanzi_e5f6/custom/hello \
  -m '{"text":[{"content":"HELLO","fontHeight":10,"align":"center","valign":"middle","color":"#FFFFFF"}]}'
```

Replace `ulanzi_e5f6` with your real prefix from Step 2.

### Step 5 — Send an image or animated GIF

The `image` element accepts PNG or GIF as a base64 Data URL. Static images up to 512×512; **GIF up to 256×256 and ≤ 50 frames**, base64 ≤ 60 KB. Images larger than 52×16 are clipped from the top-left (not scaled).

```bash
curl -X POST "http://<device-ip>/api/custom?name=hello" \
  -H "Content-Type: application/json" \
  -d '{"image":[{"data":"data:image/gif;base64,<BASE64>","position":[0,0]}]}'
```

### Beginner pitfalls

- **ASCII only** — see the TL;DR above. Use English letters; for Chinese text use a pre-rendered image/GIF.
- **Push ≠ switch** — a push only updates the app that is *currently displayed*. Use `switchDiyApp` to bring it on screen.
- **`fontHeight` is 5 or 10 only** — any other value is ignored.
- **Enable MQTT first** — the clock ships with MQTT off; turn it on in Settings or via `/setMqttConfig`.
- **One app at a time** — a custom app holds up to 6 image elements and 32 draw commands.

---

## Protocol Reference

The full, authoritative reference is maintained as standalone documents (bilingual). **Read these for every field, every endpoint, and every edge case.**

| Language | File |
| --- | --- |
| **English** | [protocol/Ulanzi_TC002_protocol-http-mqtt_en.md](protocol/Ulanzi_TC002_protocol-http-mqtt_en.md) |
| **中文版** | [protocol/Ulanzi_TC002_protocol-http-mqtt_CN.md](protocol/Ulanzi_TC002_protocol-http-mqtt_CN.md) |

**What's inside:**
- **24 HTTP endpoints** — device info, global/Wi-Fi/social/calendar/tools/MQTT config, custom-app CRUD & list, app switching, key simulation, firmware OTA, Bluetooth, factory reset.
- **MQTT topics** — device→client status/base/customList, client→device custom & switch, plus optional Home Assistant auto-discovery.
- **Payload schema** — `text` / `image` / `draw` element fields with types, defaults and limits.
- **Worked examples** — push text, switch app, simulate keys, jump to a built-in app, set volume.
- **Limitations** — what the protocol does **not** expose.

### At a Glance

| Feature | HTTP | MQTT |
| --- | --- | --- |
| Push custom-app content | `POST /api/custom?name=<app>` | `[PREFIX]/custom/<APP_NAME>` |
| List custom apps | `GET /api/customList` | `[PREFIX]/customList` (pushed) |
| Switch custom app | `POST /api/switchDiyApp?name=<app>` | `[PREFIX]/switchDiyApp` |
| System configuration | `POST /setConfig`, `/setMqttConfig`, … | — |
| Simulate keys / knob | `POST /keyEvent` | — |
| Jump to a built-in app | `POST /switchApp` | — |
| Device info | `GET /getBase` | `[PREFIX]/getBase` (pushed) |
| Status | — | `[PREFIX]/status` (`online` / `offline`) |
| Home Assistant discovery | — | `homeassistant/device/[PREFIX]/config` (opt-in) |

### What the protocol can and cannot do

| Supported | Not supported |
| --- | --- |
| Push text / image / drawing to custom apps | Audio playback / TTS |
| List & switch custom apps | Physical key / knob events reported **back** to the host (protocol is one-way) |
| Simulate keys & knob | Chinese / Unicode text rendering — ASCII only (0x20–0x7E) |
| Device config, firmware OTA, factory reset | Web UI language switch (CN → EN) |

---

## Repository Layout

```
.
├── protocol/            # HTTP & MQTT protocol docs (EN + 中文)
│   ├── Ulanzi_TC002_protocol-http-mqtt_en.md
│   └── Ulanzi_TC002_protocol-http-mqtt_CN.md
├── IDE使用说明/          # FlyThings IDE development guide (HTML + Markdown)
│   ├── 说明文档.md
│   ├── 说明文档.html
│   └── resources/
├── Z21_TC002_Demo/      # Official sample project; import into the IDE and compile
│   ├── Manifest.xml
│   ├── ui/              # *.ftu UI files (visually editable in the IDE)
│   ├── src/
│   │   ├── Main.cpp     # Entry: init MCU, start UI
│   │   ├── activity/    # Auto-generated by the IDE — do not edit
│   │   ├── logic/       # One *Logic.cc per ftu — write your UI logic here
│   │   ├── pages/       # Demo pages (Btn/Rgb/Audio/Wifi)
│   │   ├── managers/    # KeyManager / AudioManager / McuManager ...
│   │   ├── mcuProtocol/ # MCU serial protocol
│   │   ├── ble/         # BLE GATT service
│   │   ├── utils/       # GpioHelper, etc.
│   │   └── dependencies/# Private static libs (gatt-server) & binaries
│   ├── resources/       # Resources bundled with the firmware
│   └── README.md        # Demo API quick reference
├── apps/                # Community-contributed apps
│   ├── flythings/       # Third-party FlyThings apps (device-side C++)
│   └── mqtt/            # Home Assistant blueprints & MQTT integrations
├── CONTRIBUTING.md      # Contribution guide: submission specs & PR flow
├── LICENSE              # GPL-3.0-or-later license text
└── THIRD_PARTY_NOTICES.md  # Third-party components (BlueZ, Adafruit GFX, ...)
```

---

## Getting Started (Development)

### 1. Install FlyThings IDE

Download and install [FlyThings IDE](https://download.s21i.co99.net/14731609/0/0/ABUIABBPGAAglMLczgYo0Mjk3AU.zip?f=flythings-ide-win32-win32-x86-zkswe-setup.zip&v=1775706403) (Windows). Full installation and UI guide: [IDE 使用说明 / 说明文档.md](IDE使用说明/说明文档.md).

### 2. Import the sample project

`File` → `Import` → `General` → `Existing Projects into Workspace`, browse to `Z21_TC002_Demo/` and finish.

### 3. Build

Select the project and press `Ctrl + Alt + Z`, or click the green triangle in the toolbar. Output goes to `Release/`.

### 4. Flash & debug over Wi-Fi

TC002 connects over Wi-Fi, so **ADB debugging is Wi-Fi only** (the USB data port is USB-storage mode):

1. Connect the device to the same LAN as your PC and note its IP;
2. IDE → `Debug Configurations` → `ADB Configuration` → select **WIFI** and enter the IP;
3. Right-click the project → `Download & Debug`, or press `Ctrl + Alt + R`.

`Download & Debug` does **not** persist — the device reverts after a reboot. To persist, use `Image Build` to generate `update.img`, copy it to the root of a FAT32 TF card, insert and power on.

### 5. Restore the factory firmware

Hold the reset button beside the USB-C port while powering on — the device will auto-restore the official firmware.

---

## Key API Quick Reference

Only the high-level APIs wrapped by the sample project are listed here. Low-level platform APIs (`EASYUICONTEXT`, `UARTCONTEXT`, `StoragePreferences`, `TimeHelper`, etc.) are covered in the IDE guide.

### LED display

```cpp
// 52*16 pixels, 3 bytes per pixel RGB, row-major
uint8_t rgbData[52 * 16 * 3];
PageBase::sendLedData(rgbData);   // internally throttled, frame interval ≥ 15ms
```

### Key events

```cpp
#include "managers/KeyManager.h"
KeyManager::getInstance().addKeyEventCallback([](int code){
  // E_KEYCODE_CLOCKWISE / ANTI_CLOCKWISE / KNOB_BUTTON
  // E_KEYCODE_LEFT_BUTTON / MIDDLE_BUTTON / RIGHT_BUTTON
});
```

### Audio playback

```cpp
#include "managers/AudioManager.h"
auto& audio = awtrix::AudioManager::getInstance();
audio.setVolume(3);                  // 0~6
audio.playAudio("/path/to/file.mp3");
audio.pauseAudio(); audio.resumeAudio(); audio.stopAudio();
```

### MIC volume

```cpp
#include "managers/McuManager.h"
McuManager::getInstance().setAutoMicReport(true);
int mic = McuManager::getInstance().queryMicValue();
```

### Wi-Fi & BLE

```cpp
#include <base/wifi.h>
#include "ble/bluetooth_service.h"
base::wifiOnAndWait(10);             // Wi-Fi must be on first
BluetoothParams p;
p.name = "Ulanzi TC002 AB12";
p.on_message = [](const std::string& msg) { /* ... */ };
BluetoothService::instance().start(p);
```

Optional: pre-set Wi-Fi/BLE parameters via a U-disk file `/mnt/usb1/test.cfg`:

```json
{ "ssid": "...", "pwd": "...", "isConnect": true, "ble": "MyName" }
```

If `ble` is empty, the device name uses the last four characters of the MAC (`Ulanzi TC002 XXXX`).

### User GPIO

```cpp
#include "utils/GpioHelper.h"
GpioHelper::output("GPIO_06", 1);    // only GPIO_06 / GPIO_85 are reserved
```

---

## Development Notes

- **Anti-brick flag**: must be set at the entry point on every boot, otherwise the system rolls back to the official firmware:

```cpp
#include <os/SystemProperties.h>
SystemProperties::setString("sys.zkapp.state", "running");
```

- **Initialize the MCU before refreshing the LED**:

```cpp
McuManager::getInstance().initialize(
  new PixelMcuProto::McuParse("/dev/ttyS1", 1500000));
std::string ver;
McuManager::getInstance().queryMcuVersion(ver);
```

- **SPI frame rate**: `sendLedData` frame interval must not be < 15 ms — throttling is built in, just call it.
- **BLE depends on Wi-Fi**: make sure Wi-Fi is up before starting BLE.
- **Do not block the UI main thread**: `onUI_init` / `onUI_Timer` callbacks must not do heavy work, otherwise the TF-card upgrade UI cannot pop up.
- **Do not edit** `src/activity/` — it is auto-generated from `*.ftu`.

---

## Demo Pages

| Activity | Demo | Key files |
| --- | --- | --- |
| `mainActivity` | Main menu, entry to each demo | `pages/PageBase.*`, `logic/mainLogic.cc` |
| `btnTestActivity` | Knob + 3-button events | `pages/BtnTestPage.*` |
| `rgbTestActivity` | LED matrix frame rendering | `pages/RgbTestPage.*` |
| `audioTestActivity` | Audio playback + live MIC level | `pages/AudioTestPage.*` |
| `wifiTestActivity` | Wi-Fi connection + BLE service | `pages/WifiTestPage.*`, `ble/` |

---

## Community Apps

Developers have already built useful integrations on top of this repository:

- **Home Assistant blueprints** — import into your HA instance and control TC002 over MQTT (see [apps/mqtt/](apps/mqtt/))
- **AI status indicators** — show your AI assistant's thinking/finished state on the clock via MQTT, no firmware flashing
- **Follower counters** — e.g. Xiaohongshu follower counting via MQTT extension
- **CI / build-status boards, now-playing, year-progress, pet widgets** and more

Want to share yours? See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## FAQ

**Q: My text isn't showing up. Why?**
A: Three usual causes — (1) the clock isn't on that custom app yet (push ≠ switch, use `switchDiyApp`); (2) the text contains non-ASCII chars (Chinese, emoji, `°`) which the clock can't render; (3) `fontHeight` is not `5` or `10`.

**Q: How do I get my MQTT topic prefix?**
A: `mqtt_prefix` (default `ulanzi`) + `_` + the last two hex chars of the MAC. Get the MAC from Ulanzi Studio or `GET /getBase`. Example MAC `…E5F6` → `ulanzi_e5f6`.

**Q: Can I show Chinese text?**
A: Not directly — the text renderer is ASCII-only. Render Chinese to a PNG/GIF first and push it via the `image` element.

**Q: Is there a scrolling/marquee mode for long text?**
A: Not built in. Fit the text within 52×16 or pre-render a wider image/GIF.

**Q: Custom app vs DIY app — what's the difference?**
A: Custom apps are created/pushed **live over HTTP/MQTT** (no file on disk) and can be switched remotely with `switchDiyApp`. DIY apps are files uploaded to the device. The protocol controls custom apps.

**Q: Why doesn't `carouselSpeed` cycle my custom apps?**
A: Carousel cycles built-in tools only; custom apps are shown on demand via push/switch.

---

## Security Notes

The local HTTP API and MQTT client have **no authentication** and accept cross-origin requests. Treat the clock as a **LAN-only trusted device**:

- Keep the clock on a **private, trusted Wi-Fi** network; do not expose its HTTP port to the public internet.
- Use a **dedicated MQTT broker** (or a private HA broker) with credentials; avoid open/public brokers.
- Anyone on the same network can control the display and read device info. Segment it from guest networks if needed.
- The built-in web UI is currently **Chinese only** (English UI is under evaluation).

---

## Further Reading

- [protocol/](protocol/) — HTTP & MQTT protocol docs (EN + 中文)
- [IDE 使用说明 / 说明文档.md](IDE使用说明/说明文档.md) — Complete FlyThings IDE guide
- [Z21_TC002_Demo/README.md](Z21_TC002_Demo/README.md) — API reference for every hardware demo
- [FlyThings package repository](https://package.flythings.cn/)
- [apps/mqtt/README.md](apps/mqtt/README.md) — index of community MQTT apps

---

## Contributing

We welcome two kinds of community apps:

- **FlyThings apps** — C++ projects that run on the TC002 device itself; submit to [apps/flythings/](apps/flythings/)
- **MQTT apps** — mainly Home Assistant blueprints; users import them into their HA instance and control TC002 over MQTT; submit to [apps/mqtt/](apps/mqtt/) (see [apps/mqtt/README.md](apps/mqtt/README.md))

Full submission specs, directory conventions and the PR flow are in [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

The core code of this project is released under the [GNU General Public License v3.0 or later (GPL-3.0-or-later)](LICENSE).

Any derivative work (including but not limited to modified firmware and modified demos) must, when distributed:

- Be licensed under the same GPL-3.0-or-later
- Retain the original copyright notice
- Clearly state the modifications in the documentation

The repository also contains third-party components (BlueZ, Adafruit GFX fonts, FlyThings SDK, etc.), each under its own license. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
