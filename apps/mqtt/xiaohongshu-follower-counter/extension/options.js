// SPDX-License-Identifier: GPL-3.0-or-later

const DEFAULTS = {
  profileUrls: [],
  refreshMinutes: 15,
  bridgeUrl: "http://127.0.0.1:17321",
  bridgeToken: "",
  lastResult: null,
};

document.addEventListener("DOMContentLoaded", restore);
document.querySelector("#save").addEventListener("click", save);

async function restore() {
  const config = await chrome.storage.local.get(DEFAULTS);
  document.querySelector("#profileUrls").value = config.profileUrls.join("\n");
  document.querySelector("#refreshMinutes").value = config.refreshMinutes;
  document.querySelector("#bridgeUrl").value = config.bridgeUrl;
  document.querySelector("#bridgeToken").value = config.bridgeToken;
  document.querySelector("#lastResult").textContent = config.lastResult
    ? `最近结果：${JSON.stringify(config.lastResult, null, 2)}`
    : "尚无采集结果";
}

async function save() {
  const status = document.querySelector("#status");
  try {
    const profileUrls = document.querySelector("#profileUrls").value
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean)
      .map(canonicalProfileUrl);

    const refreshMinutes = Math.max(5, Math.floor(Number(document.querySelector("#refreshMinutes").value) || 15));
    const bridgeUrl = document.querySelector("#bridgeUrl").value.trim();
    assertBridgeUrl(bridgeUrl);
    const bridgeToken = document.querySelector("#bridgeToken").value.trim();
    if (!bridgeToken) throw new Error("共享令牌不能为空");

    await chrome.storage.local.set({ profileUrls, refreshMinutes, bridgeUrl, bridgeToken });
    status.textContent = "已保存，将在数秒内刷新";
  } catch (error) {
    status.textContent = error.message;
  }
}

function canonicalProfileUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !["www.xiaohongshu.com", "xiaohongshu.com"].includes(url.hostname) || !url.pathname.startsWith("/user/profile/")) {
    throw new Error(`不是有效的小红书用户主页：${value}`);
  }
  url.search = "";
  url.hash = "";
  return url.toString();
}

function assertBridgeUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") {
    throw new Error("桥接地址必须使用 http://127.0.0.1");
  }
}
