// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { renderFollowerPng } from "./render.js";

const output = fileURLToPath(new URL("../preview/demo.png", import.meta.url));
await mkdir(dirname(output), { recursive: true });
await writeFile(output, renderFollowerPng({ followerCount: 12800 }));
console.log(output);
