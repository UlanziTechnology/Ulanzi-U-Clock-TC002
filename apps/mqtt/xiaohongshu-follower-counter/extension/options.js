// SPDX-License-Identifier: GPL-3.0-or-later
import { migrateRefreshSeconds, normalizeRefreshSeconds } from "./refresh-config.js";
import { canonicalProfileUrl, migrateBindings, normalizeBindings } from "./bindings-config.js";
import {
  migrateHomeAssistantConfig,
  normalizeHomeAssistantUrl,
  normalizeWebhookId,
  requiredOrigins,
} from "./ha-config.js";

const DEFAULTS = {
  lastResults: {},
};

document.addEventListener("DOMContentLoaded", restore);
document.querySelector("#save").addEventListener("click", save);
document.querySelector("#addBinding").addEventListener("click", () => addBindingRow());

async function restore() {
  const [stored, haConfig, refreshSeconds, bindings] = await Promise.all([
    chrome.storage.local.get(DEFAULTS),
    migrateHomeAssistantConfig(chrome.storage.local),
    migrateRefreshSeconds(chrome.storage.local),
    migrateBindings(chrome.storage.local),
  ]);
  renderBindings(bindings.length ? bindings : [{ deviceIp: "", profileUrl: "" }]);
  document.querySelector("#refreshSeconds").value = refreshSeconds;
  document.querySelector("#homeAssistantUrl").value = haConfig.homeAssistantUrl;
  document.querySelector("#webhookId").value = haConfig.webhookId;
  document.querySelector("#lastResult").textContent = Object.keys(stored.lastResults).length
    ? `各设备最近结果（含动态发现的 devicePrefix）：${JSON.stringify(stored.lastResults, null, 2)}`
    : "尚无采集结果";
  await showPermissionStatus(haConfig.homeAssistantUrl, bindings);
}

async function save() {
  const status = document.querySelector("#status");
  try {
    const bindings = normalizeBindings([...document.querySelectorAll(".binding")].map((row) => ({
      deviceIp: row.querySelector("[data-field=deviceIp]").value,
      profileUrl: canonicalProfileUrl(row.querySelector("[data-field=profileUrl]").value),
    })));
    if (!bindings.length) throw new Error("请至少添加一台设备");

    const refreshSeconds = normalizeRefreshSeconds(document.querySelector("#refreshSeconds").value);
    const homeAssistantUrl = normalizeHomeAssistantUrl(document.querySelector("#homeAssistantUrl").value);
    const webhookId = normalizeWebhookId(document.querySelector("#webhookId").value);
    const origins = requiredOrigins(homeAssistantUrl, bindings);
    const permission = { origins };
    const granted = await chrome.permissions.contains(permission)
      || await chrome.permissions.request(permission);
    if (!granted) throw new Error("需要授权访问 Home Assistant 和 TC002 设备地址");

    await chrome.storage.local.set({ bindings, refreshSeconds, homeAssistantUrl, webhookId });
    await chrome.storage.local.remove(["profileUrls", "bridgeUrl", "bridgeToken"]);
    renderBindings(bindings);
    await showPermissionStatus(homeAssistantUrl, bindings);
    status.textContent = "已保存，将在数秒内刷新";
  } catch (error) {
    status.textContent = error.message;
  }
}

function renderBindings(bindings) {
  const container = document.querySelector("#bindings");
  container.replaceChildren();
  for (const binding of bindings) addBindingRow(binding);
  const incomplete = bindings.some((binding) => !binding.deviceIp || !binding.profileUrl);
  document.querySelector("#bindingWarning").textContent = incomplete
    ? "旧主页配置已迁移，请为每个主页补充 TC002 设备 IP 后保存。"
    : "";
}

function addBindingRow(binding = { deviceIp: "", profileUrl: "" }) {
  const row = document.createElement("div");
  row.className = "binding";
  row.append(
    field("TC002 设备 IP", "deviceIp", binding.deviceIp, "10.10.21.210"),
    field("小红书用户主页 URL", "profileUrl", binding.profileUrl, "https://www.xiaohongshu.com/user/profile/..."),
  );
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "删除";
  remove.addEventListener("click", () => row.remove());
  row.append(remove);
  document.querySelector("#bindings").append(row);
}

function field(labelText, name, value, placeholder) {
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.dataset.field = name;
  input.value = value;
  input.placeholder = placeholder;
  input.autocomplete = "off";
  label.append(input);
  return label;
}

async function showPermissionStatus(homeAssistantUrl, bindings) {
  const target = document.querySelector("#permissionStatus");
  if (!homeAssistantUrl || !bindings.some((binding) => binding.deviceIp)) {
    target.textContent = "保存时将请求访问 Home Assistant 和所填 TC002 地址的权限。";
    return;
  }
  try {
    const origins = requiredOrigins(homeAssistantUrl, bindings.filter((binding) => binding.deviceIp));
    const granted = await chrome.permissions.contains({ origins });
    target.textContent = granted ? "局域网访问权限已授予。" : "尚未授予全部局域网访问权限，请重新保存。";
  } catch {
    target.textContent = "请填写有效配置后保存。";
  }
}
