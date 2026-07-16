# TC002 正在播放

[![Open your Home Assistant instance and show the blueprint import dialog.](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2FUlanziTechnology%2FUlanzi-U-Clock-TC002%2Fblob%2Fmain%2Fapps%2Fmqtt%2Fnowplaying%2Fblueprint.yaml)

## 简介

监听一个 `media_player` 实体，把「曲名 - 歌手」和播放/暂停图标发布到 TC002。

## 预览

见 `preview/demo.gif`（真机拍摄）。`lab/build/demo.gif` 是本地跑马灯示意（非真机）。

## 配置参数

- **媒体播放器实体**（`media_player.*`）、**MQTT topic**（默认 `ulanzi_1bf6/custom/nowplaying`）、**显示时长**、**文字颜色**。

## MQTT

- **Topic**：`[PREFIX]/custom/nowplaying`
- **Payload**：`{"duration":30,"text":[{"content":"TITLE - ARTIST","fontHeight":10,"x":10,"y":3,"color":"#FFFFFF"}],"image":[{"data":"data:image/png;base64,...","position":[0,0]}],"draw":[]}`

## 已知问题 / 限制

- 设备字体**仅 ASCII**：非 ASCII 字符（中文等）会被过滤；曲名过长时设备端不滚动、会截断（跑马灯只在本地 `lab` 预览里演示）。
- 图标为原创像素（`lab/render_nowplaying.py`），无第三方素材。

## 许可证

Blueprint 与素材均 GPL-3.0-or-later。
