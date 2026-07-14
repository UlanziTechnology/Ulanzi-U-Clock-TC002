// SPDX-License-Identifier: GPL-3.0-or-later

const FOLLOWER_KEYS = new Set([
  "fans",
  "fanscount",
  "fans_count",
  "followercount",
  "follower_count",
  "followers",
]);
const NAME_KEYS = new Set(["nickname", "displayname", "display_name", "name"]);
const MAX_FOLLOWERS = 1_000_000_000;

export function parseCompactCount(value) {
  if (typeof value === "number") {
    return normalizeNumber(value);
  }
  if (typeof value !== "string") return null;

  const source = value.trim().replaceAll(",", "");
  if (!source || /-\s*\d/.test(source)) return null;

  const match = source.match(/(?:^|[^\d.])(\d+(?:\.\d+)?)\s*(万|亿|[kKmM])?(?:\s*粉丝)?(?:$|[^\d.])/);
  if (!match) return null;

  const multipliers = { 万: 10_000, 亿: 100_000_000, k: 1_000, m: 1_000_000 };
  const unit = match[2]?.toLowerCase();
  return normalizeNumber(Number(match[1]) * (multipliers[unit] ?? 1));
}

export function extractFollowerSnapshot(document, profileUrl, observedAt = new Date().toISOString()) {
  assertProfileUrl(profileUrl);

  const jsonCandidate = extractFromScripts(document);
  if (jsonCandidate) {
    return snapshot(profileUrl, jsonCandidate.name ?? titleName(document), jsonCandidate.count, observedAt, "json");
  }

  const domCandidate = extractFromDom(document);
  if (domCandidate !== null) {
    return snapshot(profileUrl, titleName(document), domCandidate, observedAt, "dom");
  }

  throw new Error("Follower count was not found on this profile page");
}

function normalizeNumber(value) {
  if (!Number.isFinite(value) || value < 0 || value > MAX_FOLLOWERS) return null;
  return Math.round(value);
}

function assertProfileUrl(profileUrl) {
  let url;
  try {
    url = new URL(profileUrl);
  } catch {
    throw new Error("Invalid Xiaohongshu profile URL");
  }
  if (
    url.protocol !== "https:" ||
    !["www.xiaohongshu.com", "xiaohongshu.com"].includes(url.hostname) ||
    !url.pathname.startsWith("/user/profile/")
  ) {
    throw new Error("Invalid Xiaohongshu profile URL");
  }
}

function extractFromScripts(document) {
  for (const script of document.querySelectorAll("script")) {
    const text = script.textContent?.trim();
    if (!text || text.length > 5_000_000) continue;

    const parsed = parseJsonScript(text);
    if (parsed) {
      const candidate = walkObject(parsed);
      if (candidate) return candidate;
    }

    const pattern = /["'](?:fans|fansCount|fans_count|followerCount|follower_count|followers)["']\s*:\s*["']?([\d,.]+\s*(?:万|亿|[kKmM])?)/g;
    for (const match of text.matchAll(pattern)) {
      const count = parseCompactCount(match[1]);
      if (count !== null) return { count, name: findNameInText(text) };
    }
  }
  return null;
}

function parseJsonScript(text) {
  const candidates = [text];
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1));
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Script assignments are handled by the explicit-key regex fallback.
    }
  }
  return null;
}

function walkObject(root) {
  const queue = [root];
  const seen = new Set();
  let fallbackName = null;

  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);

    let localName = null;
    for (const [key, child] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase();
      if (NAME_KEYS.has(normalizedKey) && typeof child === "string" && child.trim()) {
        localName = child.trim();
        fallbackName ??= localName;
      }
      if (FOLLOWER_KEYS.has(normalizedKey)) {
        const count = parseCompactCount(child);
        if (count !== null) return { count, name: localName ?? fallbackName };
      }
    }
    for (const child of Object.values(value)) {
      if (child && typeof child === "object") queue.push(child);
    }
  }
  return null;
}

function extractFromDom(document) {
  for (const element of document.querySelectorAll("body *")) {
    const text = element.textContent?.trim();
    if (!text || text.length > 80 || !text.includes("粉丝")) continue;
    if (typeof element.getClientRects === "function" && element.getClientRects().length === 0) continue;

    const nearby = [
      element,
      element.previousElementSibling,
      element.nextElementSibling,
      element.parentElement,
    ];
    for (const candidate of nearby) {
      const candidateText = candidate?.textContent ?? "";
      const contextualCount = parseFollowerContext(candidateText);
      if (contextualCount !== null) return contextualCount;
      const isAdjacentValue = candidate === element.previousElementSibling || candidate === element.nextElementSibling;
      const count = isAdjacentValue ? parseCompactCount(candidateText) : null;
      if (count !== null) return count;
    }
  }
  return null;
}

function parseFollowerContext(text) {
  const number = "([\\d,.]+\\s*(?:万|亿|[kKmM])?\\+?)";
  const before = text.match(new RegExp(`${number}\\s*粉丝`));
  if (before) return parseCompactCount(before[1]);
  const after = text.match(new RegExp(`粉丝\\s*[:：]?\\s*${number}`));
  return after ? parseCompactCount(after[1]) : null;
}

function findNameInText(text) {
  const match = text.match(/["'](?:nickname|displayName|display_name)["']\s*:\s*["']([^"']{1,80})["']/i);
  return match?.[1]?.trim() || null;
}

function titleName(document) {
  return document.title?.split(/[-—|]/, 1)[0]?.trim().slice(0, 80) || "小红书用户";
}

function snapshot(profileUrl, displayName, followerCount, observedAt, source) {
  return {
    profileUrl,
    displayName: displayName || "小红书用户",
    followerCount,
    observedAt,
    source,
  };
}
