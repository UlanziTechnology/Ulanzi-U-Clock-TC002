# TC002 小红书粉丝数本地显示设计

## 目标

让用户在 Chrome 中保持自己的小红书登录态，通过本地浏览器扩展读取任意已配置用户主页上可见的粉丝数，并经本机局域网桥接发送给 TC002 的 Custom App MQTT topic。整个链路不使用第三方云服务，不读取、导出或持久化小红书 Cookie。

## 边界与默认假设

- Chrome 和本地桥接程序在刷新期间保持运行。
- 用户以完整小红书个人主页 URL 配置目标；支持配置任意公开或当前登录态可访问的用户主页。
- 页面访问、登录验证和风控均由用户自己的 Chrome 完成。扩展不绕过验证码、登录或访问限制。
- 粉丝数是页面展示值；若页面只显示 `1.2万`，结果为换算后的近似整数 `12000`。
- TC002 已配置可访问的 MQTT broker 与 Custom App topic。
- 项目代码按 GPL-3.0-or-later 发布；分发修改版时保留版权、许可证和修改说明。

## 架构

1. Chrome Manifest V3 扩展保存目标主页、刷新间隔、本地桥接 URL 与共享令牌。
2. 定时任务在非活动标签页打开目标主页，内容脚本从内嵌 JSON 和可见的“粉丝”语义区域提取计数。
3. 扩展 service worker 将标准化事件 POST 到只监听 `127.0.0.1` 的桥接服务。
4. 桥接服务验证令牌、URL、计数和时间戳，生成 52×16 PNG 与 TC002 Custom App JSON payload。
5. 内置最小 MQTT 3.1.1 客户端通过 TCP 或 TLS 发布 retained payload；无需 Home Assistant 或外部 MQTT CLI。

## 数据接口

`POST /v1/follower-count`

```json
{
  "profileUrl": "https://www.xiaohongshu.com/user/profile/<id>",
  "displayName": "示例用户",
  "followerCount": 12345,
  "observedAt": "2026-07-14T12:00:00.000Z"
}
```

请求头为 `Authorization: Bearer <shared-token>`。成功响应包含 `published: true`、topic 和标准化计数。失败统一返回 JSON 错误，且不记录令牌、Cookie 或完整页面内容。

MQTT payload：

```json
{
  "duration": 31536000,
  "text": [],
  "image": [{"data": "data:image/png;base64,...", "position": [0, 0]}],
  "draw": []
}
```

## 采集策略

采集器按可信度排序：

1. 解析页面中的 JSON script，匹配 `fans`、`fansCount`、`followerCount` 等明确字段。
2. 在可见 DOM 中查找文字为“粉丝”的节点，并读取紧邻的数值节点。
3. 对候选值解析中文单位 `万`、`亿` 和英文 `k`、`m`；拒绝负数、非有限值和超过安全上限的值。

当无候选值、候选冲突或页面要求验证时，本轮不上报旧值；扩展保留错误状态供 options 页面查看，下个周期重试。

## 安全与隐私

- 扩展仅声明小红书主页与 `127.0.0.1` 权限，不声明 `cookies`、`webRequest` 或 `<all_urls>`。
- 桥接仅绑定 IPv4 loopback，必须使用共享令牌。
- 内容脚本只向 service worker 发送 URL、昵称、计数、采集时间和诊断代码。
- service worker 对内容脚本输入再次校验；桥接端进行第三次校验。
- MQTT 可选用户名、密码和 TLS；敏感参数只从本地环境变量读取。

## 错误处理

- 未登录、验证码或页面结构变化：扩展记录 `extract_failed`，不发布。
- 桥接不可达或鉴权失败：指数退避到下一周期，options 页面显示最近错误。
- MQTT 连接、CONNACK 或发布失败：HTTP 返回 502，扩展保留错误。
- 单个目标失败不阻止其他目标刷新；后台标签页无论成功失败均关闭。

## 测试与验收

- Node 内置测试运行器覆盖数字单位解析、JSON/DOM 候选选择、请求验证、PNG 52×16 结构、MQTT packet 编解码和 HTTP 鉴权。
- 用本地假 MQTT broker 验证 CONNECT、retained PUBLISH 与 payload 内容。
- 用 HTML fixtures 验证扩展采集器，不依赖真实小红书网络。
- 手工验收需要用户 Chrome 登录小红书、加载解压扩展、启动桥接并配置真实 broker；真实 TC002 真机显示属于环境相关验收。

## 已知风险

- 小红书没有面向普通开发者、可读取任意用户粉丝数的公开通用 API；页面结构可能变化，采集器需要维护。
- 自动周期访问可能触发平台限流或验证。默认最低刷新间隔为 5 分钟，不实现绕过措施。
- 当前 TC002 仓库的通用 MQTT 规范仍在演进；本实现遵循仓库现有 Custom App payload 约定。
