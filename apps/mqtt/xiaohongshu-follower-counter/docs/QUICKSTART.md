# 快速安装

1. 在 Home Assistant 中导入本目录的 `blueprint.yaml`，创建自动化并填写随机 Webhook ID、允许的 TC002 `devicePrefix` 列表和 Custom App 名称。
2. 校验 `release/SHA256SUMS`，解压 `xiaohongshu-follower-counter-chrome-0.2.0.zip`。
3. 打开 `chrome://extensions`，启用开发者模式，选择“加载已解压的扩展程序”，选中解压目录。
4. 在扩展设置页填写 Home Assistant 地址、同一个 Webhook ID，以及每台 TC002 的设备 IP 和对应小红书主页。
5. 刷新间隔最低为 5 分钟（300 秒）。保存并授权扩展访问所填局域网地址。

完整说明和故障排查见 [README](README.md)。
