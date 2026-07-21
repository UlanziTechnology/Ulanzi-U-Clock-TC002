// SPDX-License-Identifier: GPL-3.0-or-later
import { migrateRefreshSeconds } from "./refresh-config.js";
import { canonicalProfileUrl, migrateBindings, normalizeBindings } from "./bindings-config.js";
import { migrateHomeAssistantConfig } from "./ha-config.js";
import { createDeviceResolver } from "./device-discovery.js";
import { buildCustomAppPayload } from "./render.js";
import { postFollowerPayload } from "./ha-webhook.js";

const ALARM_NAME = "refresh-xiaohongshu-followers";
const DEFAULTS = {
  bindings: [],
  homeAssistantUrl: "",
  webhookId: "",
  lastResults: {},
};
const deviceResolver = createDeviceResolver();
let refreshInProgress = false;
let resultWriteQueue = Promise.resolve();

chrome.runtime.onInstalled.addListener(async () => {
  const [bindings] = await Promise.all([
    migrateBindings(chrome.storage.local),
    migrateHomeAssistantConfig(chrome.storage.local),
  ]);
  await scheduleRefresh();
  const config = await chrome.storage.local.get(DEFAULTS);
  if (!bindings.length
    || bindings.some((binding) => !binding.deviceIp)
    || !config.homeAssistantUrl
    || !config.webhookId) {
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
    if (!config.homeAssistantUrl || !config.webhookId) throw new Error("请先配置 Home Assistant Webhook");
    const settled = await Promise.allSettled(targets.map(({ deviceIp }) => publishToDevice(
      deviceIp,
      snapshot,
      config,
    )));
    const updates = {};
    settled.forEach((result, index) => {
      const { deviceIp } = targets[index];
      if (result.status === "fulfilled") {
        updates[deviceIp] = {
          ok: true,
          devicePrefix: result.value.devicePrefix,
          displayName: snapshot.displayName,
          followerCount: snapshot.followerCount,
          observedAt: snapshot.observedAt,
        };
        return;
      }
      const failure = {
        ok: false,
        error: String(result.reason?.message || result.reason).slice(0, 160),
        observedAt: new Date().toISOString(),
      };
      if (result.reason?.devicePrefix) failure.devicePrefix = result.reason.devicePrefix;
      updates[deviceIp] = failure;
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

async function publishToDevice(deviceIp, snapshot, config) {
  let device;
  try {
    device = await deviceResolver.resolve(deviceIp);
    const customAppPayload = await buildCustomAppPayload(snapshot);
    await postFollowerPayload(
      { homeAssistantUrl: config.homeAssistantUrl, webhookId: config.webhookId },
      { devicePrefix: device.devicePrefix, snapshot, customAppPayload },
    );
    return device;
  } catch (error) {
    deviceResolver.clear(deviceIp);
    const failure = error instanceof Error ? error : new Error(String(error));
    if (device?.devicePrefix) failure.devicePrefix = device.devicePrefix;
    throw failure;
  }
}

function isProfileUrl(value) {
  try {
    canonicalProfileUrl(value);
    return true;
  } catch {
    return false;
  }
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
