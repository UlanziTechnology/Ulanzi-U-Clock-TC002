// SPDX-License-Identifier: GPL-3.0-or-later

export function normalizePrivateIpv4(value) {
  const input = String(value ?? "").trim();
  const parts = input.split(".");
  if (
    parts.length !== 4 ||
    parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)
  ) {
    throw new TypeError("设备 IP 必须是局域网 IPv4 地址");
  }

  const octets = parts.map(Number);
  const isPrivate = octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168);
  if (!isPrivate) throw new TypeError("设备 IP 必须是局域网 IPv4 地址");
  return octets.join(".");
}

export function canonicalProfileUrl(value) {
  let url;
  try {
    url = new URL(String(value ?? "").trim());
  } catch {
    throw new TypeError("必须填写有效的小红书用户主页");
  }
  if (
    url.protocol !== "https:" ||
    !["www.xiaohongshu.com", "xiaohongshu.com"].includes(url.hostname) ||
    !url.pathname.startsWith("/user/profile/")
  ) {
    throw new TypeError("必须填写有效的小红书用户主页");
  }
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function normalizeBindings(value, { allowIncomplete = false } = {}) {
  if (!Array.isArray(value)) throw new TypeError("设备绑定必须是列表");
  const normalized = [];
  const deviceIps = new Set();

  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new TypeError("设备绑定格式无效");
    }
    const rawDeviceIp = String(entry.deviceIp ?? "").trim();
    const rawProfileUrl = String(entry.profileUrl ?? "").trim();
    if (!rawDeviceIp && !rawProfileUrl) continue;
    if (!allowIncomplete && (!rawDeviceIp || !rawProfileUrl)) {
      throw new TypeError("设备 IP 和小红书主页必须同时填写");
    }

    const deviceIp = rawDeviceIp ? normalizePrivateIpv4(rawDeviceIp) : "";
    const profileUrl = rawProfileUrl ? canonicalProfileUrl(rawProfileUrl) : "";
    if (deviceIp && deviceIps.has(deviceIp)) throw new TypeError("设备 IP 不能重复");
    if (deviceIp) deviceIps.add(deviceIp);
    normalized.push({ deviceIp, profileUrl });
  }

  return normalized;
}

export async function migrateBindings(storageArea) {
  const stored = await storageArea.get({ bindings: null, profileUrls: null });
  if (Array.isArray(stored.bindings)) {
    const bindings = normalizeBindings(stored.bindings, { allowIncomplete: true });
    if (JSON.stringify(bindings) !== JSON.stringify(stored.bindings)) {
      await storageArea.set({ bindings });
    }
    if (Array.isArray(stored.profileUrls)) await storageArea.remove("profileUrls");
    return bindings;
  }

  if (Array.isArray(stored.profileUrls)) {
    const bindings = stored.profileUrls
      .map((profileUrl) => ({ deviceIp: "", profileUrl }))
      .filter((binding) => String(binding.profileUrl ?? "").trim())
      .map((binding) => ({
        deviceIp: "",
        profileUrl: canonicalProfileUrl(binding.profileUrl),
      }));
    await storageArea.set({ bindings });
    await storageArea.remove("profileUrls");
    return bindings;
  }

  return [];
}
