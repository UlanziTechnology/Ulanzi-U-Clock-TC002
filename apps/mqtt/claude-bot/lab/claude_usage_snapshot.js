#!/usr/bin/env node
/**
 * ⚠️ 已弃用：此脚本已被 claude_statusline_bridge.js 取代。
 *
 * TC002 Claude Bot — Codex 用量读取器（旧版）。
 *
 * 通过 `ccusage codex daily --json` 读取 Codex 每日用量，
 * 计算今日花费（USD）和本周花费（USD）。
 * 缓存读取的 token 已排除，因为 prompt caching 不计费。
 *
 * 无需配置预算 — 费用直接来自 ccusage，它对非缓存 token 应用每模型定价。
 *
 * 用法：
 *   node lab/claude_usage_snapshot.js
 *
 * 输出：
 *   包含今日和本周 Codex 花费（USD）及实际 token 数的 JSON。
 */

const { execFileSync } = require("node:child_process");

const TIMEZONE = process.env.TC002_TIMEZONE || "Asia/Shanghai";

function usage() {
  console.log(`Usage:
  node lab/claude_usage_snapshot.js

Environment:
  TC002_TIMEZONE    timezone for date grouping (default: Asia/Shanghai)
`);
}

function runCcusage() {
  const output = execFileSync(
    "npx",
    ["--yes", "ccusage", "codex", "daily", "--json", "--timezone", TIMEZONE, "--offline"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return JSON.parse(output);
}

function todayDateStr() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

function weekStartDateStr() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    weekday: "short",
  }).formatToParts(now);
  const shortWeekday = parts.find((p) => p.type === "weekday")?.value || "";
  const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = dowMap[shortWeekday] ?? 1;
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;

  const monday = new Date(now);
  monday.setDate(monday.getDate() - daysSinceMonday);
  const mondayFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return mondayFormatter.format(monday);
}

function actualTokens(day) {
  return (
    (day.inputTokens || 0) +
    (day.outputTokens || 0) +
    (day.reasoningOutputTokens || 0)
  );
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  usage();
  process.exit(0);
}

const report = runCcusage();
const todayStr = todayDateStr();
const weekStart = weekStartDateStr();

let todayActualTokens = 0;
let todayCost = 0;
let weekActualTokens = 0;
let weekCost = 0;

for (const day of report.daily || []) {
  const date = day.date || "";

  if (date === todayStr) {
    todayActualTokens += actualTokens(day);
    todayCost += day.costUSD || 0;
  }
  if (date >= weekStart) {
    weekActualTokens += actualTokens(day);
    weekCost += day.costUSD || 0;
  }
}

const result = {
  source: "ccusage codex daily",
  timezone: TIMEZONE,
  note: "Costs are calculated from non-cache tokens using per-model pricing. Cache-read tokens are excluded.",
  today: {
    date: todayStr,
    actualTokens: todayActualTokens,
    costUSD: Number(todayCost.toFixed(2)),
  },
  week: {
    start: weekStart,
    end: todayStr,
    actualTokens: weekActualTokens,
    costUSD: Number(weekCost.toFixed(2)),
  },
};

console.log(JSON.stringify(result, null, 2));
