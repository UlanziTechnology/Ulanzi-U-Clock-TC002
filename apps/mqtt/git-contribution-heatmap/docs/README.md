# TC002 Git 贡献热力图

> **新用户？** 见 [QUICKSTART.md](QUICKSTART.md)

## 简介

在 TC002（U-Clock）上显示 GitHub 贡献热力图，52 列 × 7 行日历点阵。

- 有提交的日期：按提交量显示不同亮度绿色
- 没有提交的日期：纯黑
- 右上角：GitHub 标记 + GITHUB 字样

**作者**：王行知

## 预览

见 `preview/demo.gif`

## 依赖

- Python 3 + Pillow（`pip install pillow`）
- mosquitto_pub（`brew install mosquitto`）
- MQTT broker（TC002 和你的电脑都能访问）

## 安装

1. 在 `~/.zshrc` 中添加环境变量：

   ```bash
   export TC002_MQTT_HOST=<你的MQTT broker地址>
   export TC002_MQTT_TOPIC=ulanzi_1bf6/custom/git_heatmap
   export GITHUB_USER=<你的GitHub用户名>
   ```

2. 可选：设置 GitHub Token 获取更完整的贡献数据（包括私有仓库）：

   ```bash
   export GITHUB_TOKEN=ghp_xxx
   ```

### 如何获取 GitHub Token

1. 打开 https://github.com/settings/tokens
2. 点击 **"Generate new token (classic)"**
3. 勾选权限：
   - `read:user` — 读取用户信息
   - `repo:status` — 读取仓库状态（可选，获取私有仓库贡献）
4. 点击 **"Generate token"**
5. 复制 token，设置到环境变量

> **注意**：不要把 token 写进 Git 或提交到代码仓库。只放在当前 shell 环境变量里。

## 手动测试

```bash
cd apps/mqtt/git-contribution-heatmap

# 生成并发布：
B64=$(python3 lab/render_contribution_heatmap.py --user castlewong) && mosquitto_pub -h $TC002_MQTT_HOST -t $TC002_MQTT_TOPIC -m "{\"duration\":31536000,\"text\":[],\"image\":[{\"data\":\"data:image/gif;base64,$B64\",\"position\":[0,0]}],\"draw\":[]}"

# Demo 模式（不访问 GitHub）：
python3 lab/render_contribution_heatmap.py --demo --output preview/demo.gif
```

## MQTT Payload

```json
{
  "duration": 31536000,
  "text": [],
  "image": [{"data": "data:image/gif;base64,...", "position": [0, 0]}],
  "draw": []
}
```

## 已知问题

- 不设置 GitHub Token 时，只能获取近期公开 PushEvent。
- TC002 收到 Custom App 更新后，不一定会自动切换到该 App。

## 许可证

GPL-3.0-or-later。
