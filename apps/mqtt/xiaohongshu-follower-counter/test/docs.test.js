// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const APP = new URL("../", import.meta.url);
const MQTT_APPS = new URL("../", APP);

test("user documentation covers installation, privacy, configuration, and troubleshooting", async () => {
  const readme = await readFile(new URL("docs/README.md", APP), "utf8");
  for (const phrase of [
    "Node.js 20",
    "XHS_BRIDGE_TOKEN",
    "MQTT_HOST",
    "TC002_MQTT_TOPIC",
    "TC002 设备 IP",
    "/getBase",
    "/getMqttConfig",
    "5 分钟",
    "custom/display",
    "deviceIp",
    "chrome://extensions",
    "加载已解压的扩展程序",
    "不读取 Cookie",
    "故障排查",
    "127.0.0.1",
    "npm test",
    ".env.example",
    "PowerShell",
    "macOS",
    "Linux",
    "npm run check",
    "11.6万",
    "116000",
    "当前电脑",
    "刷新间隔（秒",
    "5 秒",
    "60 秒",
  ]) {
    assert.ok(readme.includes(phrase), `README should mention ${phrase}`);
  }
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
    "真机",
  ]) {
    assert.match(pr, new RegExp(phrase), `PR text should mention ${phrase}`);
  }
});

test("application is indexed and declares GPL licensing", async () => {
  const index = await readFile(new URL("README.md", MQTT_APPS), "utf8");
  const appReadme = await readFile(new URL("README.md", APP), "utf8");
  const license = await readFile(new URL("docs/LICENSE", APP), "utf8");
  assert.match(index, /xiaohongshu-follower-counter/);
  assert.match(appReadme, /GPL-3\.0-or-later/);
  assert.match(license, /GPL-3\.0-or-later/);
});
