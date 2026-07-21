# Xiaohongshu Pixel Follower Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a 52×16 TC002 image with a red Xiaohongshu icon on the left and an adaptive white follower count on the right.

**Architecture:** Keep the current dependency-free RGB PNG pipeline and MQTT payload schema. Replace the current `XHS` badge, 3×5 font, and underline with a fixed 14×14 icon plus a scalable 5×7 numeric font; select scale and compact formatting from the available 36-pixel number region.

**Tech Stack:** Node.js 20+, ES modules, `node:test`, existing in-repository RGB PNG encoder.

## Global Constraints

- Output remains a 52×16 RGB PNG on a pure black background.
- Icon occupies the left 14×14 region at `(0, 1)` using `#FF2442` and white.
- Number region is `x=16..51`; nickname, underline, and gray/white status dots are omitted.
- Values with 1–3 digits use scale 2; 4–6 digits remain exact at scale 1; 7+ digits use a compact `M` representation.
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

- [ ] **Step 2: Add failing icon and two-digit layout test**

```js
test("renders a red Xiaohongshu icon and a large white two-digit count", () => {
  const image = decodeRgbPng(renderFollowerPng({ ...SNAPSHOT, followerCount: 18 }));
  assert.deepEqual(pixelAt(image, 1, 1), [255, 36, 66]);
  assert.deepEqual(pixelAt(image, 4, 4), [255, 255, 255]);
  assert.deepEqual(pixelAt(image, 0, 1), [0, 0, 0]);
  const countBounds = litBounds(image, 16, 51, [255, 255, 255]);
  assert.equal(countBounds.height, 14);
  assert.ok(countBounds.minX >= 16 && countBounds.maxX <= 51);
});
```

- [ ] **Step 3: Add failing exact and compact count tests**

```js
test("keeps up to six follower digits exact", () => {
  assert.equal(formatCount(123456), "123456");
  const bounds = litBounds(decodeRgbPng(renderFollowerPng({ ...SNAPSHOT, followerCount: 123456 })), 16, 51, [255, 255, 255]);
  assert.equal(bounds.width, 35);
  assert.equal(bounds.height, 7);
});

test("compacts seven digit follower counts", () => {
  assert.equal(formatCount(1234567), "1.2M");
});
```

- [ ] **Step 4: Run focused tests and verify RED**

Run: `cd apps/mqtt/xiaohongshu-follower-counter && node --test test/render.test.js`

Expected: FAIL because the current renderer draws a rectangular `XHS` badge, a 3×5 count, and abbreviates `123456` as `123K`.

### Task 2: Implement the icon and adaptive 5×7 count renderer

**Files:**
- Modify: `apps/mqtt/xiaohongshu-follower-counter/bridge/render.js`
- Test: `apps/mqtt/xiaohongshu-follower-counter/test/render.test.js`

**Interfaces:**
- Consumes: `snapshot.followerCount` as a number-like value.
- Produces: `formatCount(value) -> string`; `renderFollowerPng(snapshot) -> Buffer`; unchanged `buildCustomAppPayload(snapshot, duration) -> object`.

- [ ] **Step 1: Replace visual constants and font**

Define `ICON_SIZE = 14`, `COUNT_START_X = 16`, `COUNT_WIDTH = 36`, and a complete 5×7 bitmap font for `0`–`9`, `.`, `K`, and `M`. Keep `RED = [255, 36, 66]` and `WHITE = [255, 255, 255]`; remove `PINK`.

- [ ] **Step 2: Implement the 14×14 icon**

Draw a rounded red square from `(0, 1)` to `(13, 14)`, leaving its four corner pixels black. Overlay a fixed white pixel mask whose anchor includes `(4, 4)` and whose strokes form the compact Xiaohongshu mark. Do not draw outside `x=0..13` or `y=1..14`.

Use this exact 12×8 mask at `(1, 4)`:

```js
const ICON_MARK = [
  "#..#..####..",
  ".##...#..#..",
  ".##...####..",
  "#..#..#..#..",
  "......####..",
  "###...#..#..",
  ".#....####..",
  "###...#..#..",
];
```

- [ ] **Step 3: Implement scale-aware text measurement and drawing**

Use these signatures:

```js
function drawText(pixels, text, x, y, color, scale = 1)
function textWidth(text, scale = 1)
function chooseScale(text)
```

Each lit font cell becomes a `scale × scale` block. Letter spacing remains one physical pixel. `chooseScale` returns `2` only when the scaled text fits `COUNT_WIDTH`, otherwise `1`.

- [ ] **Step 4: Implement count positioning and formatting**

For nonnegative rounded values up to `999999`, return the complete decimal string. For values at or above `1000000`, return `trimDecimal(count / 1000000) + "M"`. Center the measured text within `x=16..51` and center its `7 × scale` height within 16 rows.

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
