// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";

import {
  extractFollowerSnapshot,
  parseCompactCount,
} from "../extension/extractor.js";

test("parseCompactCount normalizes localized follower counts", () => {
  assert.equal(parseCompactCount("12,345"), 12345);
  assert.equal(parseCompactCount("1.2万"), 12000);
  assert.equal(parseCompactCount("2.5亿"), 250000000);
  assert.equal(parseCompactCount("8.7k"), 8700);
  assert.equal(parseCompactCount("1.1M"), 1100000);
  assert.equal(parseCompactCount("粉丝 956"), 956);
});

test("parseCompactCount rejects unsafe or ambiguous values", () => {
  assert.equal(parseCompactCount(""), null);
  assert.equal(parseCompactCount("-1"), null);
  assert.equal(parseCompactCount("abc"), null);
  assert.equal(parseCompactCount("999999999999"), null);
});

test("extractFollowerSnapshot prefers explicit JSON follower fields", () => {
  const document = fakeDocument({
    scripts: [
      '{"user":{"nickname":"Momo","fansCount":"1.2万"},"notes":88}',
    ],
    elements: [
      fakeElement("粉丝", fakeElement("粉丝 999")),
    ],
  });

  assert.deepEqual(
    extractFollowerSnapshot(
      document,
      "https://www.xiaohongshu.com/user/profile/abc123",
      "2026-07-14T12:00:00.000Z",
    ),
    {
      profileUrl: "https://www.xiaohongshu.com/user/profile/abc123",
      displayName: "Momo",
      followerCount: 12000,
      observedAt: "2026-07-14T12:00:00.000Z",
      source: "json",
    },
  );
});

test("extractFollowerSnapshot falls back to visible DOM near 粉丝 label", () => {
  const parent = fakeElement("8.7万 粉丝");
  const document = fakeDocument({
    title: "小鹿 - 小红书",
    elements: [fakeElement("粉丝", parent)],
  });

  assert.equal(
    extractFollowerSnapshot(
      document,
      "https://www.xiaohongshu.com/user/profile/deer",
      "2026-07-14T12:01:00.000Z",
    ).followerCount,
    87000,
  );
});

test("extractFollowerSnapshot rejects non-profile URLs and missing counts", () => {
  assert.throws(
    () => extractFollowerSnapshot(fakeDocument({}), "https://example.com/user/1"),
    /profile URL/i,
  );
  assert.throws(
    () =>
      extractFollowerSnapshot(
        fakeDocument({}),
        "https://www.xiaohongshu.com/user/profile/no-count",
      ),
    /follower count/i,
  );
});

function fakeDocument({ scripts = [], elements = [], title = "" }) {
  return {
    title,
    querySelectorAll(selector) {
      if (selector === "script") {
        return scripts.map((textContent) => ({ textContent }));
      }
      if (selector === "body *") return elements;
      return [];
    },
  };
}

function fakeElement(textContent, parentElement = null) {
  return {
    textContent,
    parentElement,
    previousElementSibling: null,
    nextElementSibling: null,
    getClientRects: () => [1],
  };
}
