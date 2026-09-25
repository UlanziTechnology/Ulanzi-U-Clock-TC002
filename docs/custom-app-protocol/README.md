# 自定义 APP 协议（Custom App Protocol）

本目录收录 TC002「自定义 APP」相关开发资料，供二次开发者对接 **MQTT / HTTP DIY App** 控制协议使用。

## 资料清单

| 文件 | 说明 |
|---|---|
| `自定义APP协议_0813.pdf` | 自定义 APP 协议说明文档（字段定义、payload 结构） |
| `custom_app_request_samples.md` | 各协议的请求测试样例（`text` / `image` / `draw` 等共 13 组） |
| `../firmware/update_1_1_0.img` | 固件 **v1.1.0**（变更见下） |

## 固件 v1.1.0 变更

1. **修复字体显示问题**
2. **MQTT / HTTP 增加「切换指定 DIY App」接口**

## 使用方式

- **固件烧录**：将 `../firmware/update_1_1_0.img` 拷到 FAT32 格式 TF 卡根目录，插卡上电即触发升级（详见仓库根目录 README「快速开始」一节）。
- **协议对接**：参考 `自定义APP协议_0813.pdf` 的字段定义，配合 `custom_app_request_samples.md` 中的样例构造 MQTT / HTTP 请求。

> 本目录为官方资料，跟随仓库主体 **GPL-3.0-or-later** 许可证。
