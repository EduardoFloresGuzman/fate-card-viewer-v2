#!/usr/bin/env node
// PostToolUse hook (matcher: Edit|Write). Reads the hook JSON payload from stdin, and:
//   1. Formats the touched file with Prettier (via its JS API, not the CLI — see note below), if
//      it's a src/**/*.{ts,css} or public/sw.js file. Formatting failures never block anything.
//   2. For src/**/*.ts specifically, runs a project-wide `tsc --noEmit` so type errors surface
//      immediately. This one is allowed to exit non-zero (the hook "fails") so it's actually
//      noticed rather than silently logged.
//
// Everything here calls local node_modules binaries/APIs directly via `node <script>` rather
// than `npx`/shell commands: on Windows, spawning a `.cmd` shim needs `shell: true`, and with
// `shell: true` Node does NOT quote args for you — a path containing a space (e.g. this exact
// repo's "ai projects" parent folder) silently splits into two arguments and prettier reports
// "No files matching the pattern were found" for both halves. Calling prettier's own JS API
// sidesteps this for formatting; invoking tsc's bin script via `node` (not the .cmd shim)
// sidesteps it for the typecheck.

import { execFileSync } from "node:child_process";
import { readSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readStdin() {
  const chunks = [];
  const buf = Buffer.alloc(65536);
  for (;;) {
    let bytesRead;
    try {
      bytesRead = readSync(0, buf, 0, buf.length, null);
    } catch (err) {
      if (err.code === "EAGAIN") continue;
      if (err.code === "EOF") break;
      throw err;
    }
    if (bytesRead === 0) break;
    chunks.push(Buffer.from(buf.subarray(0, bytesRead)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

let payload;
try {
  payload = JSON.parse(readStdin());
} catch {
  process.exit(0);
}

const filePath = payload?.tool_input?.file_path;
if (typeof filePath !== "string" || filePath.length === 0) process.exit(0);

const normalized = filePath.replace(/\\/g, "/");
const isFormattable = /\/src\/.*\.(ts|css)$/.test(normalized) || /\/public\/sw\.js$/.test(normalized);
const isTypeScript = /\/src\/.*\.ts$/.test(normalized);

if (isFormattable) {
  try {
    const source = readFileSync(filePath, "utf8");
    const config = await prettier.resolveConfig(filePath);
    const formatted = await prettier.format(source, { ...config, filepath: filePath });
    if (formatted !== source) writeFileSync(filePath, formatted, "utf8");
  } catch {
    // Formatting failures shouldn't block anything.
  }
}

if (isTypeScript) {
  try {
    execFileSync(process.execPath, [path.join(PROJECT_ROOT, "node_modules/typescript/bin/tsc"), "--noEmit"], {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
    });
  } catch {
    // tsc already printed its diagnostics via stdio: "inherit" above — exit non-zero so the
    // hook itself is reported as failed (surfacing the error), without an extra noisy Node
    // "Command failed" stack trace on top of tsc's own output.
    process.exit(1);
  }
}
