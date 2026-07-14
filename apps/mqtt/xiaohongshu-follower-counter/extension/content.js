// SPDX-License-Identifier: GPL-3.0-or-later

(async () => {
  const { extractFollowerSnapshot } = await import(chrome.runtime.getURL("extractor.js"));
  let lastError = "extract_failed";

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const result = extractFollowerSnapshot(document, location.href);
      const snapshot = {
        profileUrl: result.profileUrl,
        displayName: result.displayName,
        followerCount: result.followerCount,
        observedAt: result.observedAt,
      };
      await chrome.runtime.sendMessage({ type: "snapshot", snapshot });
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message.slice(0, 160) : "extract_failed";
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  await chrome.runtime.sendMessage({ type: "extract-error", error: lastError });
})().catch(() => {
  chrome.runtime.sendMessage({ type: "extract-error", error: "content_script_failed" });
});
