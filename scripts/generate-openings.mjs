#!/usr/bin/env node
/**
 * Fetches comprehensive ECO opening data from hayatbiralem/eco.json and generates
 * a TypeScript data file at src/data/openings.ts.
 *
 * Source: https://github.com/hayatbiralem/eco.json (MIT license)
 * ~12,000+ named openings across ECO codes A-E plus interpolated positions.
 *
 * Usage: node scripts/generate-openings.mjs
 */

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Chess } from "chess.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE =
  "https://raw.githubusercontent.com/hayatbiralem/eco.json/master/";

const JSON_URLS = [
  `${BASE}ecoA.json`,
  `${BASE}ecoB.json`,
  `${BASE}ecoC.json`,
  `${BASE}ecoD.json`,
  `${BASE}ecoE.json`,
  `${BASE}eco_interpolated.json`,
];

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

function pgnToSanMoves(pgn) {
  return pgn
    .replace(/\d+\.\s*/g, "")
    .split(/\s+/)
    .filter((m) => m.length > 0);
}

function moveToUci(move) {
  return move.from + move.to + (move.promotion || "");
}

async function main() {
  console.log("Fetching ECO opening data from hayatbiralem/eco.json...");

  // Use a Map keyed by FEN to deduplicate across files
  // (eco_interpolated may overlap with ecoA-E)
  const byFen = new Map();

  for (const url of JSON_URLS) {
    const filename = url.split("/").pop();
    console.log(`  Fetching ${filename}...`);
    const data = await fetchJson(url);
    const entries = Object.entries(data);
    console.log(`    ${entries.length} entries`);

    for (const [fen, entry] of entries) {
      // Prefer non-interpolated over interpolated (ecoA-E loaded first)
      if (!byFen.has(fen)) {
        byFen.set(fen, { ...entry, _fen: fen });
      }
    }
  }

  console.log(`Total unique positions: ${byFen.size}`);
  console.log("Processing with chess.js...");

  let errors = 0;
  const processed = [];

  for (const entry of byFen.values()) {
    if (!entry.eco || !entry.name || !entry.moves) {
      errors++;
      continue;
    }

    const sanMoves = pgnToSanMoves(entry.moves);
    const chess = new Chess();
    const uciMoves = [];
    let valid = true;

    for (const san of sanMoves) {
      try {
        const move = chess.move(san);
        if (!move) {
          valid = false;
          break;
        }
        uciMoves.push(moveToUci(move));
      } catch {
        valid = false;
        break;
      }
    }

    if (!valid) {
      errors++;
      continue;
    }

    processed.push({
      eco: entry.eco,
      name: entry.name,
      moves: sanMoves,
      uci: uciMoves,
      fen: chess.fen(),
    });
  }

  // Sort by ECO code, then by move count (shorter lines first)
  processed.sort((a, b) => {
    const ecoCompare = a.eco.localeCompare(b.eco);
    if (ecoCompare !== 0) return ecoCompare;
    return a.moves.length - b.moves.length;
  });

  if (errors > 0) {
    console.log(`  Skipped ${errors} entries with missing/invalid data`);
  }
  console.log(`  ${processed.length} valid openings`);

  // Generate JSON
  const json = JSON.stringify(processed);

  const outPath = join(__dirname, "..", "public", "openings.json");
  writeFileSync(outPath, json, "utf-8");
  console.log(`\nWritten to ${outPath}`);
  console.log(`File size: ${(json.length / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
