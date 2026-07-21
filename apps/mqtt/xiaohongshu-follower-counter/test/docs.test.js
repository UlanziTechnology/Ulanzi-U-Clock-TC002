// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const APP = new URL("../", import.meta.url);
const MQTT_APPS = new URL("../", APP);

test("user documentation covers installation, privacy, configuration, and troubleshooting", async () => {
  const readme = await readFile(new URL("docs/README.md", APP), "utf8");
  for (const phrase of [
    "xiaohongshu-follower-counter-chrome-0.2.0.zip",
    "SHA256SUMS",
    "shasum -a 256",
    "Get-FileHash",
    "Home Assistant MQTT 集成",
    "my.home-assistant.io/redirect/blueprint_import",
    "blueprint.yaml",
    "Webhook ID",
    "allowed_device_prefixes",
    "ulanzi_1be3",
    "ulanzi_1bd9",
    "<devicePrefix>/custom/<appName>",
    "自动化跟踪",
    "retained topic",
    "HTTP 2xx",
    "TC002 设备 IP",
    "/getBase",
    "/getMqttConfig",
    "5 分钟",
    "chrome://extensions",
    "加载已解压的扩展程序",
    "不读取 Cookie",
    "不保存 MQTT 凭证",
    "不需要 Home Assistant 长期访问令牌",
    "故障排查",
    "npm test",
    "PowerShell",
    "macOS",
    "Linux",
    "npm run check",
    "当前电脑",
    "300 秒",
    "Chrome Web Store",
  ]) {
    assert.ok(readme.includes(phrase), `README should mention ${phrase}`);
  }
  assert.doesNotMatch(readme, /XHS_BRIDGE_TOKEN|npm start|启动 Bridge|127\.0\.0\.1:17321|\/v1\/follower-count/);
});

test("rendered preview is a valid 52 by 16 PNG", async () => {
  const png = await readFile(new URL("preview/demo.png", APP));
  assert.deepEqual(png.subarray(0, 8), Buffer.from("89504e470d0a1a0a", "hex"));
  assert.equal(png.readUInt32BE(16), 52);
  assert.equal(png.readUInt32BE(20), 16);
});

test("preview documentation distinguishes renderer output from real-device evidence", async () => {
  const previewReadme = await readFile(new URL("preview/README.md", APP), "utf8").catch(() => null);
  assert.ok(previewReadme, "preview/README.md should exist");
  assert.match(previewReadme, /渲染预览/);
  assert.match(previewReadme, /不是真机/);
  assert.match(previewReadme, /tc002-real\.(jpg|gif)/);
});

test("copy-ready PR text follows the upstream contribution checklist", async () => {
  const pr = await readFile(new URL("docs/PR.md", APP), "utf8").catch(() => null);
  assert.ok(pr, "docs/PR.md should exist");
  for (const phrase of [
    "应用类型：MQTT",
    "目标环境上验证运行",
    "运行截图或视频",
    "许可证 GPL-3.0 兼容",
    "已阅读并遵守",
    "npm run check",
    "Chrome",
    "Home Assistant",
    "Blueprint",
    "SHA-256",
    "真机",
  ]) {
    assert.match(pr, new RegExp(phrase), `PR text should mention ${phrase}`);
  }
});

test("quick start links the packaged extension and one-click Blueprint import", async () => {
  const quickstart = await readFile(new URL("docs/QUICKSTART.md", APP), "utf8");
  assert.match(quickstart, /\.\.\/release\/xiaohongshu-follower-counter-chrome-0\.2\.0\.zip/);
  assert.match(quickstart, /my\.home-assistant\.io\/redirect\/blueprint_import/);
  assert.match(quickstart, /allowed_device_prefixes/);
  assert.match(quickstart, /app_name/);
  assert.doesNotMatch(quickstart, /Bridge|XHS_BRIDGE_TOKEN|npm start/);
});

test("application is indexed and declares GPL licensing", async () => {
  const index = await readFile(new URL("README.md", MQTT_APPS), "utf8");
  const appReadme = await readFile(new URL("README.md", APP), "utf8");
  const license = await readFile(new URL("docs/LICENSE", APP), "utf8");
  assert.match(index, /xiaohongshu-follower-counter/);
  assert.match(appReadme, /GPL-3\.0-or-later/);
  assert.match(license, /GPL-3\.0-or-later/);
});
