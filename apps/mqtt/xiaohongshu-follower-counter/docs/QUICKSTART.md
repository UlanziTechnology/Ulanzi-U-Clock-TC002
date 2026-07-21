# 快速安装

## 1. 准备 Home Assistant

先配置 **Home Assistant MQTT 集成**，使它连接到 TC002 正在使用的同一个 MQTT broker。

[![导入 Home Assistant Blueprint](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2FUlanziTechnology%2FUlanzi-U-Clock-TC002%2Fblob%2Fmain%2Fapps%2Fmqtt%2Fxiaohongshu-follower-counter%2Fblueprint.yaml)

创建自动化时填写：

- 随机且保密的 `Webhook ID`；
- `allowed_device_prefixes`，每行一个 TC002 前缀；
- `app_name`，默认 `xiaohongshu_followers`。

## 2. 安装 Chrome 扩展

下载 [xiaohongshu-follower-counter-chrome-0.2.0.zip](../release/xiaohongshu-follower-counter-chrome-0.2.0.zip) 和 [SHA256SUMS](../release/SHA256SUMS)，校验并解压。

打开 `chrome://extensions`，启用开发者模式，点击“加载已解压的扩展程序”，选择解压后的目录。此版本暂未发布到 Chrome Web Store。

## 3. 配置设备

在扩展设置页填写 Home Assistant 地址、相同的 Webhook ID，以及每台 TC002 的设备 IP和对应的小红书主页。保存并允许 Chrome 访问所填的局域网地址。

首次白名单不匹配时，“最近结果”仍会显示发现的 `devicePrefix`；复制到 `allowed_device_prefixes` 后保存 HA 自动化。刷新间隔最低为 5 分钟（300 秒），以降低小红书风控或屏蔽风险。

确认 TC002 的 MQTT/DIY 功能保持启用。完整证据链和故障排查见 [详细说明](README.md)。
