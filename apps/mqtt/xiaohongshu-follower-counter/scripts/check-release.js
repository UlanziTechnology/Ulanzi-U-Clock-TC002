// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { basename, dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY = execFileSync("git", ["-C", ROOT, "rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const APP_PATH = relative(REPOSITORY, ROOT).replaceAll("\\", "/");
const TEXT_EXTENSIONS = new Set([".example", ".html", ".js", ".json", ".md"]);
const FORBIDDEN_NAMES = new Set([".DS_Store", ".env", "node_modules"]);
const FORBIDDEN_TEXT = [
  { pattern: /\/Users\/[^/\s]+\//, reason: "macOS user path" },
  { pattern: /\/home\/[^/\s]+\//, reason: "Linux user path" },
  { pattern: /[A-Za-z]:\\Users\\[^\\\s]+\\/, reason: "Windows user path" },
  { pattern: /chrome-extension:\/\/[a-p]{32}/, reason: "fixed Chrome extension ID" },
  { pattern: /xiaohongshu\.com\/user\/profile\/[0-9a-f]{20,}/i, reason: "concrete Xiaohongshu profile ID" },
];

const failures = [];
await checkTrackedSources();
await checkVersions();

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Release check passed");
}

async function checkTrackedSources() {
  const output = execFileSync("git", [
    "-C", REPOSITORY, "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", APP_PATH,
  ]);
  const paths = output.toString("utf8").split("\0").filter(Boolean);
  for (const repositoryPath of paths) {
    const path = repositoryPath.slice(APP_PATH.length + 1);
    const absolute = resolve(REPOSITORY, repositoryPath);
    if (repositoryPath.split("/").some((part) => FORBIDDEN_NAMES.has(part))) {
      failures.push(`${path}: local-only file or directory`);
      continue;
    }
    if (basename(path).endsWith(".log")) failures.push(`${path}: log file`);
    if (!isTextFile(path)) continue;
    const source = await readFile(absolute, "utf8").catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (source === null) continue;
    for (const { pattern, reason } of FORBIDDEN_TEXT) {
      if (pattern.test(source)) failures.push(`${path}: contains ${reason}`);
    }
  }
}

async function checkVersions() {
  const packageJson = JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8"));
  const manifest = JSON.parse(await readFile(resolve(ROOT, "extension/manifest.json"), "utf8"));
  if (packageJson.version !== manifest.version) {
    failures.push(`version mismatch: package ${packageJson.version}, extension ${manifest.version}`);
  }
}

function isTextFile(name) {
  return basename(name) === ".env.example" || TEXT_EXTENSIONS.has(extname(name));
}
