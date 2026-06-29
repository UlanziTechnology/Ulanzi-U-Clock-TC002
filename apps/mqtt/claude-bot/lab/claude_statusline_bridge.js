#!/usr/bin/env node
/**
 * TC002 Claude Bot — StatusLine 桥接脚本
 *
 * 从 Claude Code statusLine hook 接收 JSON，提取 5 小时/7 天限额使用率，
 * 通过 MQTT 发布到 TC002，并将状态写入临时文件供其他工具使用。
 *
 * 用法：
 *   # 作为 Claude Code statusLine hook（在 ~/.claude/settings.json 中配置）：
 *   #   "statusLine": { "type": "command", "command": "node path/to/claude_statusline_bridge.js" }
 *   #
 *   # 或手动测试：
 *   echo '{"rate_limits":{"five_hour":{"used_percentage":75},"seven_day":{"used_percentage":42}}}' | node lab/claude_statusline_bridge.js
 *
 * 环境变量：
 *   TC002_MQTT_HOST    MQTT broker 地址（默认：127.0.0.1）
 *   TC002_MQTT_PORT    MQTT broker 端口（默认：1883）
 *   TC002_MQTT_TOPIC   Custom App topic（默认：ulanzi_1bf6/custom/claude_bot）
 *   TC002_DURATION     payload 显示时长，单位秒（默认：31536000，即一年，保持常亮）
 *   TC002_STATE_FILE   状态文件路径（默认：/tmp/claude-statusline-state.json）
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

// 配置项，从环境变量读取，提供默认值
const MQTT_HOST = process.env.TC002_MQTT_HOST || "127.0.0.1";
const MQTT_PORT = process.env.TC002_MQTT_PORT || "1883";
const MQTT_TOPIC = process.env.TC002_MQTT_TOPIC || "ulanzi_1bf6/custom/claude_bot";
const DURATION = parseInt(process.env.TC002_DURATION || "31536000", 10); // 默认一年，保持常亮
const STATE_FILE = process.env.TC002_STATE_FILE || "/tmp/claude-statusline-state.json";
const RENDER_SCRIPT = path.join(__dirname, "render_usage.py");

// 从 stdin 读取 Claude Code 发送的 JSON 数据
function parseInput() {
  const buf = fs.readFileSync(0, "utf8"); // fd 0 = stdin
  return JSON.parse(buf.trim());
}

// 提取 5 小时和 7 天限额使用率百分比
function extractRateLimits(data) {
  const rl = data.rate_limits || {};
  const fiveHour = rl.five_hour || {};
  const sevenDay = rl.seven_day || {};
  return {
    five_hour_pct: Math.max(0, Math.min(100, parseInt(fiveHour.used_percentage) || 0)),
    seven_day_pct: Math.max(0, Math.min(100, parseInt(sevenDay.used_percentage) || 0)),
  };
}

// 提取会话信息（模型、花费、耗时等）
function extractSessionInfo(data) {
  return {
    model: (data.model && data.model.display_name) || "unknown",
    cost_usd: (data.cost && data.cost.total_cost_usd) || 0,
    duration_ms: (data.cost && data.cost.total_duration_ms) || 0,
    ctx_pct: (data.context_window && data.context_window.used_percentage) || 0,
    lines_added: (data.cost && data.cost.total_lines_added) || 0,
    lines_removed: (data.cost && data.cost.total_lines_removed) || 0,
  };
}

// 将状态写入文件（供 publish_usage.sh 等脚本读取）
function writeState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    // 状态文件写入失败不影响主流程
  }
}

// 调用 Python 脚本渲染 52x16 GIF
function renderGif(fiveHourPct, sevenDayPct) {
  try {
    const b64 = execFileSync("python3", [
      RENDER_SCRIPT,
      String(fiveHourPct),
      String(sevenDayPct),
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    return b64;
  } catch (e) {
    console.error(`[bridge] 渲染失败: ${e.message}`);
    return null;
  }
}

// 通过 MQTT 发布到 TC002
function publishMqtt(b64) {
  const payload = JSON.stringify({
    duration: DURATION,
    text: [],
    image: [{ data: `data:image/gif;base64,${b64}`, position: [0, 0] }],
    draw: [],
  });
  try {
    execFileSync("mosquitto_pub", [
      "-h", MQTT_HOST,
      "-p", MQTT_PORT,
      "-t", MQTT_TOPIC,
      "-m", payload,
    ], { stdio: ["ignore", "ignore", "pipe"] });
    return true;
  } catch (e) {
    console.error(`[bridge] MQTT 发布失败: ${e.message}`);
    return false;
  }
}

// 主流程
function main() {
  const data = parseInput();
  const limits = extractRateLimits(data);
  const session = extractSessionInfo(data);

  // 写入状态文件
  const state = {
    timestamp: new Date().toISOString(),
    rate_limits: limits,
    session,
  };
  writeState(state);

  // 渲染 GIF
  const b64 = renderGif(limits.five_hour_pct, limits.seven_day_pct);
  if (!b64) {
    process.exit(1);
  }

  // 发布到 MQTT
  const published = publishMqtt(b64);

  // 输出状态行给 Claude Code 显示（终端状态栏）
  const pct = limits.five_hour_pct;
  const color = pct >= 90 ? "\x1b[31m" : pct >= 70 ? "\x1b[33m" : "\x1b[32m";
  const reset = "\x1b[0m";
  process.stdout.write(
    `◆ ${session.model} │ 5H:${color}${limits.five_hour_pct}%${reset} 7d:${color}${limits.seven_day_pct}%${reset} │ $${session.cost_usd.toFixed(2)}\n`
  );
}

main();
