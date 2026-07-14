// SPDX-License-Identifier: GPL-3.0-or-later
import { migrateRefreshSeconds } from "./refresh-config.js";
import { canonicalProfileUrl, migrateBindings, normalizeBindings } from "./bindings-config.js";

const ALARM_NAME = "refresh-xiaohongshu-followers";
const DEFAULTS = {
  bindings: [],
  bridgeUrl: "http://127.0.0.1:17321",
  bridgeToken: "",
  lastResults: {},
};
let refreshInProgress = false;
let resultWriteQueue = Promise.resolve();

chrome.runtime.onInstalled.addListener(async () => {
  const bindings = await migrateBindings(chrome.storage.local);
  await scheduleRefresh();
  const config = await chrome.storage.local.get(DEFAULTS);
  if (!bindings.length || bindings.some((binding) => !binding.deviceIp) || !config.bridgeToken) {
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onStartup.addListener(scheduleRefresh);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) void refreshProfiles();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.refreshSeconds || changes.refreshMinutes || changes.bindings)) {
    void scheduleRefresh();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "snapshot") {
    handleSnapshot(message.snapshot, sender)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "extract-error") {
    handleExtractError(message.error, sender).then(() => sendResponse({ ok: false }));
    return true;
  }
  return false;
});

async function scheduleRefresh() {
  const refreshSeconds = await migrateRefreshSeconds(chrome.storage.local);
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 1 / 60,
    periodInMinutes: refreshSeconds / 60,
  });
}

async function refreshProfiles() {
  if (refreshInProgress) return;
  refreshInProgress = true;
  try {
    const bindings = normalizeBindings(await migrateBindings(chrome.storage.local));
    const profileUrls = [...new Set(bindings.map(({ profileUrl }) => profileUrl))];
    for (const profileUrl of profileUrls) {
      if (!isProfileUrl(profileUrl)) continue;
      const tab = await chrome.tabs.create({ url: profileUrl, active: false });
      await markManaged(tab.id);
      setTimeout(() => closeManaged(tab.id), 45_000);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  } finally {
    refreshInProgress = false;
  }
}

async function handleSnapshot(input, sender) {
  const snapshot = sanitizeSnapshot(input);
  const config = await chrome.storage.local.get(DEFAULTS);

  try {
    const bindings = normalizeBindings(await migrateBindings(chrome.storage.local));
    const targets = bindings.filter((binding) => binding.profileUrl === snapshot.profileUrl);
    if (!targets.length) {
      throw new Error("profile_not_configured");
    }
    const endpoint = bridgeEndpoint(config.bridgeUrl);
    if (!config.bridgeToken) throw new Error("请先在扩展设置中配置桥接令牌");
    const settled = await Promise.allSettled(targets.map(({ deviceIp }) => publishSnapshot(
      endpoint,
      config.bridgeToken,
      { ...snapshot, deviceIp },
    )));
    const updates = {};
    settled.forEach((result, index) => {
      const { deviceIp } = targets[index];
      updates[deviceIp] = result.status === "fulfilled"
        ? { ok: true, displayName: snapshot.displayName, followerCount: snapshot.followerCount, observedAt: snapshot.observedAt }
        : { ok: false, error: String(result.reason?.message || result.reason).slice(0, 160), observedAt: new Date().toISOString() };
    });
    await mergeLastResults(updates);
    if (settled.every((result) => result.status === "rejected")) throw settled[0].reason;
  } catch (error) {
    throw error;
  } finally {
    if (sender.tab?.id !== undefined) await closeManaged(sender.tab.id);
  }
}

async function handleExtractError(error, sender) {
  let profileUrl = null;
  try {
    profileUrl = canonicalProfileUrl(sender.tab?.url || "");
  } catch {
    // The tab may already have navigated away from the configured profile.
  }
  const bindings = await migrateBindings(chrome.storage.local);
  const updates = {};
  for (const binding of bindings.filter((item) => item.profileUrl === profileUrl && item.deviceIp)) {
    updates[binding.deviceIp] = {
      ok: false,
      error: String(error || "extract_failed").slice(0, 160),
      observedAt: new Date().toISOString(),
    };
  }
  await mergeLastResults(updates);
  if (sender.tab?.id !== undefined) await closeManaged(sender.tab.id);
}

function mergeLastResults(updates) {
  resultWriteQueue = resultWriteQueue.catch(() => {}).then(async () => {
    const { lastResults = {} } = await chrome.storage.local.get("lastResults");
    await chrome.storage.local.set({ lastResults: { ...lastResults, ...updates } });
  });
  return resultWriteQueue;
}

function sanitizeSnapshot(input) {
  const profileUrl = input ? canonicalProfileUrl(input.profileUrl) : null;
  if (!profileUrl) throw new Error("invalid_profile_url");
  if (!Number.isInteger(input.followerCount) || input.followerCount < 0 || input.followerCount > 1_000_000_000) {
    throw new Error("invalid_follower_count");
  }
  return {
    profileUrl,
    displayName: String(input.displayName || "小红书用户").slice(0, 80),
    followerCount: input.followerCount,
    observedAt: Number.isFinite(Date.parse(input.observedAt)) ? input.observedAt : new Date().toISOString(),
  };
}

async function publishSnapshot(endpoint, token, snapshot) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(snapshot),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `bridge_http_${response.status}`);
  return result;
}

function isProfileUrl(value) {
  try {
    canonicalProfileUrl(value);
    return true;
  } catch {
    return false;
  }
}

function bridgeEndpoint(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") throw new Error("bridge_must_use_loopback");
  url.pathname = "/v1/follower-count";
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function markManaged(tabId) {
  const { managedTabIds = [] } = await chrome.storage.session.get("managedTabIds");
  await chrome.storage.session.set({ managedTabIds: [...new Set([...managedTabIds, tabId])] });
}

async function closeManaged(tabId) {
  const { managedTabIds = [] } = await chrome.storage.session.get("managedTabIds");
  if (!managedTabIds.includes(tabId)) return;
  await chrome.storage.session.set({ managedTabIds: managedTabIds.filter((id) => id !== tabId) });
  await chrome.tabs.remove(tabId).catch(() => {});
}
