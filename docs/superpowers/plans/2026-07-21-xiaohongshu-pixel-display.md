# Xiaohongshu Pixel Follower Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a 52×16 TC002 image with a red Xiaohongshu icon on the left and an adaptive white follower count on the right.

**Architecture:** Keep the dependency-free RGB PNG pipeline and MQTT payload schema. Persist the supplied artwork as an exact 10×10 RGB logo matrix and one fixed bitmap matrix per digit/character; select scale and compact formatting from the available number region without system-font rendering.

**Tech Stack:** Node.js 20+, ES modules, `node:test`, existing in-repository RGB PNG encoder.

## Global Constraints

- Output remains a 52×16 RGB PNG on a pure black background.
- The exact 10×10 logo matrix is placed at `(2, 3)`, leaving two black columns on its left, using `#FF2E4D`, white, and black cells.
- The logo ends at `x=11`; `x=12..13` remain black. The number region is `x=14..51`; nickname, underline, and gray/white status dots are omitted.
- Characters have persisted matrices extracted from the supplied artwork: large digits are 5×10, large `K` is 6×10, large `M` is 8×10, small `K` is 5×7, and small `M` is 7×7. The renderer uses the largest set that fits. Values at 10000+ use `K`; values at 1000000+ use `M`.
- MQTT topic discovery, `custom/display`, retained publishing, extension behavior, and payload schema do not change.
- No third-party runtime dependency is added.

---

### Task 1: Specify adaptive pixel output with failing tests

**Files:**
- Modify: `apps/mqtt/xiaohongshu-follower-counter/test/render.test.js`
- Test: `apps/mqtt/xiaohongshu-follower-counter/test/render.test.js`

**Interfaces:**
- Consumes: `renderFollowerPng(snapshot) -> Buffer`, `formatCount(value) -> string`.
- Produces: regression assertions for the icon palette, right-side count bounds, scale selection, and compact formatting.

- [ ] **Step 1: Add real PNG pixel decoding helpers**

Add `decodeRgbPng`, `pixelAt`, and `litBounds` helpers that parse existing PNG chunks, inflate IDAT bytes, require filter byte `0` on every row, and return the 52×16 RGB pixel buffer.

- [ ] **Step 2: Add failing exact-matrix layout test**

```js
test("renders the persisted Xiaohongshu color matrix and fixed digit matrices", () => {
  const image = decodeRgbPng(renderFollowerPng({ ...SNAPSHOT, followerCount: 18 }));
  assertColorMatrix(image, LOGO_MATRIX, 2, 3);
  assertScaledGlyph(image, LARGE_DIGITS["1"], 14, 3, 1);
  assertScaledGlyph(image, LARGE_DIGITS["8"], 20, 3, 1);
});
```

- [ ] **Step 3: Add failing exact and compact count tests**

```js
test("uses persisted K and M character matrices for compact counts", () => {
  assert.equal(formatCount(12800), "12.8K");
  assert.equal(formatCount(123456), "123K");
  assert.equal(formatCount(1234567), "1.2M");
  assertScaledGlyph(decodeRgbPng(renderFollowerPng({ ...SNAPSHOT, followerCount: 12800 })), LARGE_K, 34, 3, 1);
  assertScaledGlyph(decodeRgbPng(renderFollowerPng({ ...SNAPSHOT, followerCount: 1234567 })), LARGE_M, 28, 3, 1);
});
```

- [ ] **Step 4: Run focused tests and verify RED**

Run: `cd apps/mqtt/xiaohongshu-follower-counter && node --test test/render.test.js`

Expected: FAIL because the previous renderer does not reproduce the supplied full-color logo and large character matrices exactly.

### Task 2: Implement exact persisted logo and character matrices

**Files:**
- Modify: `apps/mqtt/xiaohongshu-follower-counter/bridge/render.js`
- Test: `apps/mqtt/xiaohongshu-follower-counter/test/render.test.js`

**Interfaces:**
- Consumes: `snapshot.followerCount` as a number-like value.
- Produces: `formatCount(value) -> string`; `renderFollowerPng(snapshot) -> Buffer`; unchanged `buildCustomAppPayload(snapshot, duration) -> object`.

- [ ] **Step 1: Replace visual constants and font**

Define the exact 10×10 RGB `LOGO_MATRIX`, `COUNT_START_X = 14`, supplied small 5×7 `K` and 7×7 `M`, and supplied large 5×10 digits, 6×10 `K`, plus 8×10 `M` matrices. Keep each asset directly in source so rendering is deterministic on every machine.

- [ ] **Step 2: Implement the exact 10×10 color logo**

Map every logo matrix cell directly to its persisted RGB value at `(2, 3)`. Do not procedurally construct a rounded rectangle or overlay text.

- [ ] **Step 3: Implement font-set-aware text measurement and drawing**

Use these signatures:

```js
function drawText(pixels, text, x, y, color, font, fontHeight)
function textWidth(text, font)
function chooseFont(text)
```

Each lit matrix cell becomes one output pixel and letter spacing remains one physical pixel. `chooseFont` selects `LARGE_FONT` when the complete string fits `COUNT_WIDTH`, otherwise `SMALL_FONT`.

- [ ] **Step 4: Implement count positioning and formatting**

For nonnegative rounded values below `10000`, return the complete decimal string. Use compact `K` at `10000+` and `M` at `1000000+`. Draw from `x=14`; the 10-pixel-high large font begins at `y=3` and occupies `y=3..12`.

- [ ] **Step 5: Remove obsolete decoration**

Delete the old `drawRoundedBadge`, `drawLine`, `XHS` label, and pink underline calls. `renderFollowerPng` draws only the icon and number before PNG encoding.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `cd apps/mqtt/xiaohongshu-follower-counter && node --test test/render.test.js`

Expected: all renderer tests pass with zero failures.

- [ ] **Step 7: Run the full project check**

Run: `cd apps/mqtt/xiaohongshu-follower-counter && npm run check`

Expected: tests, syntax checks, and release checks all exit `0`.

### Task 3: Preview and verify on the two TC002 devices

**Files:**
- Modify if required by existing preview CLI only: `apps/mqtt/xiaohongshu-follower-counter/bridge/render-preview.js`
- Generate: existing preview output path used by `npm run preview`

**Interfaces:**
- Consumes: updated `renderFollowerPng` and existing MQTT `publishMqtt`.
- Produces: visually inspected local preview and retained payloads delivered to both devices.

- [ ] **Step 1: Generate the repository preview**

Run: `cd apps/mqtt/xiaohongshu-follower-counter && npm run preview`

Expected: `preview/demo.png` is a 52×16 PNG containing the red/white icon and a white count, without nickname, underline, or status dots. The focused renderer test and device publish separately exercise the live count `18`.

- [ ] **Step 2: Inspect the preview at original and enlarged scale**

Open the generated PNG and verify the icon/count separation, black margins, and complete digit shapes against the supplied reference.

- [ ] **Step 3: Publish the updated real XHS payload**

Use the running Bridge or the existing `publishMqtt` helper to publish retained payloads to:

```text
ulanzi_1bd9/custom/display
ulanzi_1be3/custom/display
```

using broker `10.10.20.185:1883` and a follower count of `18` unless a newer observed value is available.

- [ ] **Step 4: Report exact verification evidence**

Report the test totals, preview path, two published topics, and that physical appearance still requires user observation of both TC002 units.
