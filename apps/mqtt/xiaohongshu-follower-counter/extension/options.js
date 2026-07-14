// SPDX-License-Identifier: GPL-3.0-or-later
import { migrateRefreshSeconds, normalizeRefreshSeconds } from "./refresh-config.js";
import { canonicalProfileUrl, migrateBindings, normalizeBindings } from "./bindings-config.js";

const DEFAULTS = {
  bridgeUrl: "http://127.0.0.1:17321",
  bridgeToken: "",
  lastResults: {},
};

document.addEventListener("DOMContentLoaded", restore);
document.querySelector("#save").addEventListener("click", save);
document.querySelector("#addBinding").addEventListener("click", () => addBindingRow());

async function restore() {
  const [config, refreshSeconds, bindings] = await Promise.all([
    chrome.storage.local.get(DEFAULTS),
    migrateRefreshSeconds(chrome.storage.local),
    migrateBindings(chrome.storage.local),
  ]);
  renderBindings(bindings.length ? bindings : [{ deviceIp: "", profileUrl: "" }]);
  document.querySelector("#refreshSeconds").value = refreshSeconds;
  document.querySelector("#bridgeUrl").value = config.bridgeUrl;
  document.querySelector("#bridgeToken").value = config.bridgeToken;
  document.querySelector("#lastResult").textContent = Object.keys(config.lastResults).length
    ? `各设备最近结果：${JSON.stringify(config.lastResults, null, 2)}`
    : "尚无采集结果";
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
    const bridgeUrl = document.querySelector("#bridgeUrl").value.trim();
    assertBridgeUrl(bridgeUrl);
    const bridgeToken = document.querySelector("#bridgeToken").value.trim();
    if (!bridgeToken) throw new Error("共享令牌不能为空");

    await chrome.storage.local.set({ bindings, refreshSeconds, bridgeUrl, bridgeToken });
    await chrome.storage.local.remove("profileUrls");
    renderBindings(bindings);
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

function assertBridgeUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") {
    throw new Error("桥接地址必须使用 http://127.0.0.1");
  }
}
