#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import ort from "onnxruntime-node";

const MB = 1024 * 1024;

function parseArgs(argv) {
  const out = {
    model: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--model") {
      out.model = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
  }

  return out;
}

function forceGc() {
  if (typeof global.gc === "function") {
    global.gc();
  }
}

function toMb(value) {
  return Math.round((value / MB) * 10) / 10;
}

function getRssBytes() {
  return process.memoryUsage().rss;
}

function isGzip(buffer) {
  return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

function product(values) {
  let result = 1;
  for (const value of values) {
    result *= value;
  }
  return result;
}

function normalizeDims(dimensions) {
  if (!Array.isArray(dimensions) || dimensions.length === 0) {
    return [1];
  }

  return dimensions.map((dim) => {
    if (typeof dim === "number" && Number.isFinite(dim) && dim > 0) {
      return Math.floor(dim);
    }
    return 1;
  });
}

function buildTensor(type, dimensions) {
  const dims = normalizeDims(dimensions);
  const elementCount = Math.max(1, product(dims));
  switch (type) {
    case "float32":
      return new ort.Tensor(type, new Float32Array(elementCount), dims);
    case "float64":
      return new ort.Tensor(type, new Float64Array(elementCount), dims);
    case "int8":
      return new ort.Tensor(type, new Int8Array(elementCount), dims);
    case "uint8":
      return new ort.Tensor(type, new Uint8Array(elementCount), dims);
    case "int16":
      return new ort.Tensor(type, new Int16Array(elementCount), dims);
    case "uint16":
      return new ort.Tensor(type, new Uint16Array(elementCount), dims);
    case "int32":
      return new ort.Tensor(type, new Int32Array(elementCount), dims);
    case "uint32":
      return new ort.Tensor(type, new Uint32Array(elementCount), dims);
    case "bool":
      return new ort.Tensor(type, new Uint8Array(elementCount), dims);
    case "int64": {
      const values = new BigInt64Array(elementCount);
      return new ort.Tensor(type, values, dims);
    }
    case "uint64": {
      const values = new BigUint64Array(elementCount);
      return new ort.Tensor(type, values, dims);
    }
    default:
      return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.model) {
    throw new Error("Missing --model <path>");
  }

  const modelPath = path.resolve(process.cwd(), args.model);
  forceGc();
  const rssBefore = getRssBytes();
  let peakRss = rssBefore;

  let compressed = await fs.readFile(modelPath);
  let modelBuffer;
  if (isGzip(compressed)) {
    modelBuffer = zlib.gunzipSync(compressed);
  } else {
    modelBuffer = compressed;
  }
  compressed = null;
  forceGc();
  peakRss = Math.max(peakRss, getRssBytes());

  const session = await ort.InferenceSession.create(modelBuffer, {
    executionProviders: ["cpu"],
    graphOptimizationLevel: "all",
  });

  modelBuffer = null;
  forceGc();
  const rssAfterSession = getRssBytes();
  peakRss = Math.max(peakRss, rssAfterSession);

  let warmupSucceeded = false;
  let warmupError = null;
  let warmupAttempted = false;
  try {
    const feeds = {};
    for (const inputName of session.inputNames) {
      const metadata = session.inputMetadata?.[inputName];
      if (!metadata) continue;
      const tensor = buildTensor(metadata.type, metadata.dimensions);
      if (tensor) {
        feeds[inputName] = tensor;
      }
    }

    if (Object.keys(feeds).length > 0) {
      warmupAttempted = true;
      await session.run(feeds);
      warmupSucceeded = true;
      forceGc();
      peakRss = Math.max(peakRss, getRssBytes());
    }
  } catch (error) {
    warmupError = error instanceof Error ? error.message : String(error);
  }

  const modelSizeMb = toMb((await fs.stat(modelPath)).size);
  const rssAfterSessionDeltaMb = toMb(rssAfterSession - rssBefore);
  const peakDeltaMb = toMb(peakRss - rssBefore);

  const result = {
    modelPath: path.relative(process.cwd(), modelPath),
    modelSizeMb,
    rssBaselineMb: toMb(rssBefore),
    rssAfterSessionMb: toMb(rssAfterSession),
    rssPeakMb: toMb(peakRss),
    rssAfterSessionDeltaMb,
    peakDeltaMb,
    warmupStatus: warmupSucceeded
      ? "ok"
      : warmupAttempted
        ? "failed"
        : "skipped",
    warmupSucceeded,
    warmupError,
  };

  console.log(JSON.stringify(result));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
