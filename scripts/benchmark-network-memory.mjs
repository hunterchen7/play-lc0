#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SINGLE_MODEL_SCRIPT = path.resolve(
  process.cwd(),
  "scripts/benchmark-single-model.mjs",
);
const DEFAULT_NETWORKS_FILE = path.resolve(
  process.cwd(),
  "src/constants/networks.ts",
);
const DEFAULT_MODELS_DIR = path.resolve(process.cwd(), "public/models");
const DEFAULT_TIMEOUT_MS = 120000;

function parseArgs(argv) {
  const options = {
    networksFile: DEFAULT_NETWORKS_FILE,
    modelsDir: DEFAULT_MODELS_DIR,
    write: false,
    limit: null,
    ids: null,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    safetyMultiplier: 1.2,
    outputJson: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") {
      options.write = true;
      continue;
    }
    if (arg === "--networks-file") {
      options.networksFile = path.resolve(process.cwd(), argv[i + 1] ?? "");
      i += 1;
      continue;
    }
    if (arg === "--models-dir") {
      options.modelsDir = path.resolve(process.cwd(), argv[i + 1] ?? "");
      i += 1;
      continue;
    }
    if (arg === "--limit") {
      options.limit = Number(argv[i + 1] ?? "");
      i += 1;
      continue;
    }
    if (arg === "--ids") {
      const value = argv[i + 1] ?? "";
      options.ids = new Set(
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      );
      i += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      options.timeoutMs = Number(argv[i + 1] ?? "");
      i += 1;
      continue;
    }
    if (arg === "--safety-multiplier") {
      options.safetyMultiplier = Number(argv[i + 1] ?? "");
      i += 1;
      continue;
    }
    if (arg === "--output-json") {
      options.outputJson = path.resolve(process.cwd(), argv[i + 1] ?? "");
      i += 1;
      continue;
    }
  }

  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    options.timeoutMs = DEFAULT_TIMEOUT_MS;
  }
  if (!Number.isFinite(options.safetyMultiplier) || options.safetyMultiplier <= 0) {
    options.safetyMultiplier = 1.2;
  }
  if (options.limit !== null && (!Number.isFinite(options.limit) || options.limit <= 0)) {
    options.limit = null;
  }

  return options;
}

function parseNetworks(source) {
  const entryRegex = /{\s*id:\s*"([^"]+)",[\s\S]*?file:\s*"([^"]+)",[\s\S]*?size:\s*"([^"]+)",[\s\S]*?}/g;
  const entries = [];
  let match;
  while ((match = entryRegex.exec(source)) !== null) {
    entries.push({
      id: match[1],
      file: match[2],
      size: match[3],
    });
  }
  return entries;
}

function patchNetworkEstimates(source, estimatesByFile) {
  const lines = source.split(/\r?\n/);
  let currentFile = null;

  for (let i = 0; i < lines.length; i += 1) {
    const fileMatch = lines[i].match(/^\s*file:\s*"([^"]+)",\s*$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
    }

    const sizeMatch = lines[i].match(/^(\s*)size:\s*"[^"]+",\s*$/);
    if (sizeMatch && currentFile && estimatesByFile.has(currentFile)) {
      const indent = sizeMatch[1];
      const nextLine = lines[i + 1] ?? "";
      const estimate = estimatesByFile.get(currentFile);
      const estimateLine = `${indent}estimatedRuntimeMb: ${estimate},`;
      if (/^\s*estimatedRuntimeMb:\s*[\d.]+,\s*$/.test(nextLine)) {
        lines[i + 1] = estimateLine;
      } else {
        lines.splice(i + 1, 0, estimateLine);
        i += 1;
      }
    }

    if (/^\s*},\s*$/.test(lines[i])) {
      currentFile = null;
    }
  }

  return lines.join("\n");
}

function buildDisplayRow(result) {
  return {
    id: result.id,
    file: result.file,
    rssAfterSessionDeltaMb: result.rssAfterSessionDeltaMb,
    peakDeltaMb: result.peakDeltaMb,
    estimatedRuntimeMb: result.estimatedRuntimeMb,
    warmup: result.warmupStatus ?? (result.warmupSucceeded ? "ok" : "failed"),
  };
}

async function runSingleBenchmark(modelPath, timeoutMs) {
  const args = [
    "--expose-gc",
    SINGLE_MODEL_SCRIPT,
    "--model",
    modelPath,
  ];

  const { stdout } = await execFileAsync(process.execPath, args, {
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024 * 20,
  });

  return JSON.parse(stdout.trim());
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const source = await fs.readFile(options.networksFile, "utf8");
  const parsed = parseNetworks(source);
  if (parsed.length === 0) {
    throw new Error("No network entries found in networks.ts.");
  }

  let entries = parsed;
  if (options.ids) {
    entries = entries.filter((entry) => options.ids.has(entry.id));
  }
  if (options.limit !== null) {
    entries = entries.slice(0, options.limit);
  }

  const results = [];
  const estimatesByFile = new Map();

  for (const entry of entries) {
    const modelPath = path.resolve(options.modelsDir, entry.file);
    process.stdout.write(`Benchmarking ${entry.id} (${entry.file})... `);

    try {
      await fs.access(modelPath);
    } catch {
      process.stdout.write("missing file\n");
      continue;
    }

    try {
      const bench = await runSingleBenchmark(modelPath, options.timeoutMs);
      const estimatedRuntimeMb = Math.max(
        1,
        Math.round(bench.peakDeltaMb * options.safetyMultiplier),
      );
      const result = {
        id: entry.id,
        file: entry.file,
        ...bench,
        estimatedRuntimeMb,
      };
      results.push(result);
      estimatesByFile.set(entry.file, estimatedRuntimeMb);
      process.stdout.write(
        `peak ${bench.peakDeltaMb} MB -> estimate ${estimatedRuntimeMb} MB\n`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stdout.write(`failed (${message})\n`);
    }
  }

  console.log("");
  console.table(results.map(buildDisplayRow));

  if (options.outputJson) {
    await fs.writeFile(options.outputJson, JSON.stringify(results, null, 2));
    console.log(`Saved benchmark JSON: ${options.outputJson}`);
  }

  if (options.write) {
    const nextSource = patchNetworkEstimates(source, estimatesByFile);
    await fs.writeFile(options.networksFile, nextSource, "utf8");
    console.log(`Updated estimates in: ${options.networksFile}`);
  } else {
    console.log("Dry run. Re-run with --write to update networks.ts.");
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
