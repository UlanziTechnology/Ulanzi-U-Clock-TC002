# 小红书粉丝数多设备绑定与动态发现设计

## 目标

让一个 Chrome 扩展实例支持配置多台 TC002，并让每台设备绑定一个小红书用户主页。用户只在扩展配置页填写 TC002 设备 IP 和主页 URL；本地 Bridge 根据设备接口动态发现 MQTT 配置并发布到 TC002 原厂固件要求的 `custom/display` Topic。Bridge 启动时不再要求设备 IP、MQTT Broker 或完整 Topic 环境变量。

## 配置模型

扩展将现有的 `profileUrls` 列表替换为 `bindings`：

```json
[
  {
    "deviceIp": "10.10.21.195",
    "profileUrl": "https://www.xiaohongshu.com/user/profile/example-a"
  },
  {
    "deviceIp": "10.10.21.210",
    "profileUrl": "https://www.xiaohongshu.com/user/profile/example-b"
  }
]
```

每台设备只能出现一次，每条绑定必须同时包含设备 IP 和主页 URL。不同设备可以绑定不同主页；抓取结果只发布到该主页绑定的设备。

旧版 `profileUrls` 自动迁移为设备 IP 为空的绑定。迁移保留主页但不猜测设备，不写入开发机专属值。用户必须在设置页补充设备 IP 后才能保存和刷新。

## 扩展配置页

配置页使用可增删的绑定行，每行包含：

- TC002 设备 IP；
- 小红书用户主页 URL；
- 删除按钮。

页面提供“添加设备”按钮，并至少保留一行空白输入供首次配置。保存时执行以下校验：

- IP 必须是 RFC1918 局域网 IPv4；
- 禁止主机名、IPv6、回环、链路本地、组播、广播、公网地址、路径和端口；
- 同一设备 IP 不得重复；
- 主页必须是 `https://www.xiaohongshu.com/user/profile/...` 或等价裸域名形式；
- 每行两个字段必须同时填写。

最近结果按设备 IP 保存并展示昵称、粉丝数、观察时间和成功或错误状态。单台设备失败不阻断其他绑定。

## 数据流

1. 扩展定时遍历有效绑定并打开相应小红书主页。
2. 内容脚本提取规范化主页 URL、昵称、粉丝数和观察时间。
3. Service Worker 通过规范化主页 URL 查找对应绑定，将 `deviceIp` 加入发送给本机 Bridge 的请求。
4. Bridge 校验共享令牌、快照和设备 IP。
5. Bridge 请求固定设备接口：
   - `http://<deviceIp>/getBase`
   - `http://<deviceIp>/getMqttConfig`
6. Bridge 验证设备响应，计算 MQTT 参数和目标 Topic。
7. Bridge 生成 52×16 小红书粉丝数 PNG，发布 retained QoS 0 MQTT 消息。

TC002 原厂固件的目标 Topic 固定按以下公式生成：

```text
[mqtt_prefix]_[MAC 后四位]/custom/display
```

例如设备 MAC 为 `ccc4b2441bd9` 且前缀为 `ulanzi` 时，Topic 为：

```text
ulanzi_1bd9/custom/display
```

## 设备发现

Bridge 从 `/getBase` 获取设备 IP、MAC、型号和版本，从 `/getMqttConfig` 获取 MQTT 开关、Broker 地址、端口、用户名、密码和前缀。发现结果按设备 IP 缓存 5 分钟。

发布失败时，Bridge 清除该设备缓存，重新发现并重试一次。这样设备 MQTT 配置改变后不会长期使用旧配置，同时避免每次粉丝刷新都访问设备接口。

Bridge 启动只强制要求：

```text
XHS_BRIDGE_TOKEN
```

可选配置保留：

```text
XHS_BRIDGE_PORT
MQTT_TLS
MQTT_ALLOW_SELF_SIGNED
```

`MQTT_HOST`、`MQTT_PORT` 和 `TC002_MQTT_TOPIC` 不再是必填项。MQTT 用户名和密码来自设备配置，只存在于 Bridge 进程内存中，不返回扩展、不写入日志。

## 安全边界

Bridge 只接受以下 RFC1918 地址段：

```text
10.0.0.0/8
172.16.0.0/12
192.168.0.0/16
```

设备请求路径由 Bridge 固定拼接，扩展不能控制协议、端口、路径或查询参数。设备 HTTP 请求使用短超时和响应大小上限。

Bridge 必须验证：

- `/getBase` 返回合法 MAC，返回 IP 与请求 IP 一致，型号为 TC002；
- `/getMqttConfig` 表示 MQTT 已开启；
- Broker 地址、端口和 MQTT 前缀合法；
- Topic 只由已验证的前缀与 MAC 后四位生成。

Bridge 日志和 HTTP 响应不得包含共享令牌或 MQTT 密码。

## 错误处理

Bridge 对设备发现和发布返回稳定错误代码：

- `device_unreachable`
- `invalid_device_response`
- `mqtt_disabled`
- `invalid_mqtt_config`
- `mqtt_publish_failed`

Service Worker 将错误保存到对应设备的最近结果，不覆盖其他设备状态。配置页按设备展示错误。

## 测试策略

自动测试覆盖：

- RFC1918 IP 校验及拒绝公网、回环、链路本地、IPv6、主机名和注入字符串；
- 绑定列表保存、重复设备拒绝与旧 `profileUrls` 迁移；
- 主页快照到设备绑定的准确路由；
- 多设备一对一发布与单设备失败隔离；
- `/getBase`、`/getMqttConfig` 响应验证；
- 设备发现缓存、缓存过期和发布失败后的单次重新发现；
- 根据前缀和 MAC 生成 `.../custom/display`；
- HTTP 快照到真实 MQTT socket 的端到端链路；
- 扩展 JavaScript 语法、Manifest 权限和发布文件安全检查。

## 文档与兼容性

用户文档将以 TC002 官方 MQTT 教程为准，明确原厂固件使用 `custom/display`，不再展示任意 Custom App 后缀。启动示例只要求 Bridge 令牌；设备 IP 在扩展配置页填写。

旧环境变量可以在一个版本周期内作为显式兼容回退，但动态设备绑定为默认路径，文档不再引导用户填写旧 Topic。兼容回退不得覆盖请求中有效的设备绑定。
