// SPDX-License-Identifier: GPL-3.0-or-later

const ALARM_NAME = "refresh-xiaohongshu-followers";
const MIN_REFRESH_MINUTES = 5;
const DEFAULTS = {
  profileUrls: [],
  refreshMinutes: 15,
  bridgeUrl: "http://127.0.0.1:17321",
  bridgeToken: "",
};

chrome.runtime.onInstalled.addListener(async () => {
  await scheduleRefresh();
  const config = await chrome.storage.local.get(DEFAULTS);
  if (!config.profileUrls.length || !config.bridgeToken) chrome.runtime.openOptionsPage();
});

chrome.runtime.onStartup.addListener(scheduleRefresh);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) refreshProfiles();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.refreshMinutes || changes.profileUrls)) scheduleRefresh();
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
  const { refreshMinutes } = await chrome.storage.local.get(DEFAULTS);
  const periodInMinutes = Math.max(MIN_REFRESH_MINUTES, Number(refreshMinutes) || DEFAULTS.refreshMinutes);
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.create(ALARM_NAME, { delayInMinutes: 0.1, periodInMinutes });
}

async function refreshProfiles() {
  const { profileUrls } = await chrome.storage.local.get(DEFAULTS);
  for (const profileUrl of profileUrls) {
    if (!isProfileUrl(profileUrl)) continue;
    const tab = await chrome.tabs.create({ url: profileUrl, active: false });
    await markManaged(tab.id);
    setTimeout(() => closeManaged(tab.id), 45_000);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

async function handleSnapshot(input, sender) {
  const snapshot = sanitizeSnapshot(input);
  const config = await chrome.storage.local.get(DEFAULTS);

  try {
    if (!config.profileUrls.some((profileUrl) => canonicalProfileUrl(profileUrl) === snapshot.profileUrl)) {
      throw new Error("profile_not_configured");
    }
    const endpoint = bridgeEndpoint(config.bridgeUrl);
    if (!config.bridgeToken) throw new Error("请先在扩展设置中配置桥接令牌");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.bridgeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(snapshot),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `bridge_http_${response.status}`);
    await chrome.storage.local.set({
      lastResult: {
        ok: true,
        displayName: snapshot.displayName,
        followerCount: snapshot.followerCount,
        observedAt: snapshot.observedAt,
      },
    });
  } catch (error) {
    await chrome.storage.local.set({
      lastResult: { ok: false, error: error.message.slice(0, 160), observedAt: new Date().toISOString() },
    });
    throw error;
  } finally {
    if (sender.tab?.id !== undefined) await closeManaged(sender.tab.id);
  }
}

async function handleExtractError(error, sender) {
  await chrome.storage.local.set({
    lastResult: {
      ok: false,
      error: String(error || "extract_failed").slice(0, 160),
      observedAt: new Date().toISOString(),
    },
  });
  if (sender.tab?.id !== undefined) await closeManaged(sender.tab.id);
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

function isProfileUrl(value) {
  return canonicalProfileUrl(value) !== null;
}

function canonicalProfileUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" ||
      !["www.xiaohongshu.com", "xiaohongshu.com"].includes(url.hostname) ||
      !url.pathname.startsWith("/user/profile/")) return null;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
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
