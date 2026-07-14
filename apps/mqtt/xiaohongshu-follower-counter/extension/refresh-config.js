// SPDX-License-Identifier: GPL-3.0-or-later

export const DEFAULT_REFRESH_SECONDS = 30;
export const MIN_REFRESH_SECONDS = 5;

export function normalizeRefreshSeconds(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_REFRESH_SECONDS;
  return Math.max(MIN_REFRESH_SECONDS, Math.floor(numeric));
}

export async function migrateRefreshSeconds(storageArea) {
  const stored = await storageArea.get(["refreshSeconds", "refreshMinutes"]);
  const candidate = stored.refreshSeconds !== undefined
    ? stored.refreshSeconds
    : stored.refreshMinutes !== undefined
      ? Number(stored.refreshMinutes) * 60
      : DEFAULT_REFRESH_SECONDS;
  const refreshSeconds = normalizeRefreshSeconds(candidate);
  if (stored.refreshSeconds !== refreshSeconds) await storageArea.set({ refreshSeconds });
  if (stored.refreshMinutes !== undefined) await storageArea.remove("refreshMinutes");
  return refreshSeconds;
}
