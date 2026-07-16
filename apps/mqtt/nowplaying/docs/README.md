# TC002 正在播放（走马灯）

> **这是一个"脚本型" MQTT 应用，不是一键导入的 HA 蓝图。** 原因见下。

## 简介

在 TC002 上显示「曲名 - 歌手」**横向滚动走马灯** + 左侧播放/暂停图标。歌曲变化时发布一次，设备就一直循环滚动，直到下一首。

**为什么不是蓝图？** TC002 的 Custom-App `text` 元素**没有滚动能力**（超出直接裁剪），所以"文字一直往左滚"只能把滚动**烤进一张多帧 GIF**、让设备循环播放。而 GIF 要用 Python 渲染，HA 蓝图的模板做不到——因此本应用是一个小**发布脚本**（官方仓库明确接受"非蓝图的 MQTT 集成方案"）。

## 预览

见 `preview/demo.gif`（真机拍摄）。`lab/build/demo.gif` 是脚本渲染出的走马灯示意。

## 依赖

- Python 3 + Pillow（`pip install pillow`）
- 一个 TC002 和运行脚本的机器都能连的 MQTT broker（走 `--http` 预览时不需要）

## 用法

```bash
# 经 MQTT 发布（正式用法）
python3 lab/nowplaying_publisher.py --broker 192.168.1.5 --prefix ulanzi_1bf6 \
    --title "Midnight City" --artist "M83" --state playing

# 直接 HTTP 推到设备预览（不需要 broker，用于拍 preview / 调试）
python3 lab/nowplaying_publisher.py --title "Midnight City" --artist "M83" --http 192.168.1.50

# 只渲染成 GIF 文件
python3 lab/nowplaying_publisher.py --title "Midnight City" --artist "M83" --dry demo.gif
```

短标题会静态居中显示、不做无意义的滚动；长标题才滚动。

## 接入 Home Assistant

用 `shell_command` 把脚本包起来，再用自动化在 `media_player` 变化时调用它：

```yaml
# configuration.yaml
shell_command:
  tc002_nowplaying: >-
    python3 /config/tc002/nowplaying_publisher.py
    --broker 192.168.1.5 --prefix ulanzi_1bf6
    --title "{{ title }}" --artist "{{ artist }}" --state "{{ st }}"
```

```yaml
# 自动化
- alias: TC002 now playing
  trigger:
    - platform: state
      entity_id: media_player.spotify
  action:
    - service: shell_command.tc002_nowplaying
      data:
        title: "{{ state_attr('media_player.spotify','media_title') | default('') }}"
        artist: "{{ state_attr('media_player.spotify','media_artist') | default('') }}"
        st: "{{ 'playing' if states('media_player.spotify') == 'playing' else 'paused' }}"
```

## MQTT

- **Topic**：`[PREFIX]/custom/nowplaying`（示例 `ulanzi_1bf6/custom/nowplaying`）
- **Payload**（一张循环 GIF，`retain=true`）：

```json
{"duration": 3600, "text": [], "image": [{"data": "data:image/gif;base64,...", "position": [0, 0]}], "draw": []}
```

## 已知问题 / 限制

- 设备字体仅 ASCII：非 ASCII（中文等）字符会被过滤。
- 图标与文字均为原创像素（脚本内生成），无第三方素材。
- 走马灯是一张 GIF：曲名变化时才需重新发布（脚本发一次，设备一直循环）。

## 许可证

GPL-3.0-or-later（脚本与生成素材）。
