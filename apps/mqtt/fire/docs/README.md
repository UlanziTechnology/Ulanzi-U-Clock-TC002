# TC002 虚拟壁炉

[![Open your Home Assistant instance and show the blueprint import dialog.](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2FUlanziTechnology%2FUlanzi-U-Clock-TC002%2Fblob%2Fmain%2Fapps%2Fmqtt%2Ffire%2Fblueprint.yaml)

## 简介

监听一个开关/布尔实体：打开时在 TC002 上点一炉循环火焰；关闭时熄灭（黑屏）。可接 `input_boolean`、`switch`，或"温度低于阈值"的模板开关（冷了就生火）。

## 预览

见 `preview/demo.gif`（真机拍摄）。`lab/build/fire.gif` 是本地生成的火焰素材。

## 配置参数

- **开关实体** + **"开"状态值**（默认 `on`）。
- **TC002 Custom App MQTT topic**（默认 `ulanzi_1bf6/custom/fire`）、**显示时长**、**保留消息**。

## MQTT

- **Topic**：`[PREFIX]/custom/fire`
- **Payload（开）**：`{"duration":3600,"text":[],"image":[{"data":"data:image/gif;base64,...","position":[0,0]}],"draw":[]}`
- **Payload（关）**：`{"duration":3600,"text":[],"image":[],"draw":[{"df":[0,0,51,15,"#000000"]}]}`

## 素材与许可证

火焰为原创程序化生成（`lab/render_fire.py`，Pillow），无第三方素材。重新生成：`python3 lab/render_fire.py`。Blueprint 与素材均 GPL-3.0-or-later。

## 已知问题

- TC002 收到更新后不一定自动切到该 App。
