import type {
  TournamentEntrant,
  TournamentMatch,
  TournamentSeries,
} from "../../types/tournament";

/**
 * FIDE dp (rating difference) table.
 * Index 0 = 50% score (dp = 0), index 50 = 100% score (dp = 800).
 * For scores below 50%, use symmetry: dp(p) = -dp(1 - p).
 */
const DP_TABLE: number[] = [
  0, 7, 14, 21, 29, 36, 43, 50, 57, 65, 72, 80, 87, 95, 102, 110, 117, 125,
  133, 141, 149, 158, 166, 175, 184, 193, 202, 211, 220, 230, 240, 251, 262,
  273, 284, 296, 309, 322, 336, 351, 366, 383, 401, 422, 444, 470, 501, 538,
  589, 677, 800,
];

/**
 * Get the dp (rating difference) for a given score percentage using the FIDE table.
 * Linearly interpolates between table entries for fractional percentages.
 */
function getDp(score: number): number {
  if (score >= 1.0) return 800;
  if (score <= 0.0) return -800;

  if (score >= 0.5) {
    const idx = (score - 0.5) * 100; // 0..50
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, 50);
    const frac = idx - lo;
    return DP_TABLE[lo] + frac * (DP_TABLE[hi] - DP_TABLE[lo]);
  }

  return -getDp(1.0 - score);
}

/**
 * Parse a numeric elo from the network elo string (e.g. "1100", "~1200–1400").
 * Returns midpoint of range, or null if unparseable.
 */
export function parseNumericElo(eloStr: string): number | null {
  const values = (eloStr.match(/\d+/g) ?? [])
    .map((v) => parseInt(v, 10))
    .filter((v) => Number.isFinite(v));

  if (values.length === 0) return null;
  if (values.length === 1) return values[0];
  return Math.round((Math.min(...values) + Math.max(...values)) / 2);
}

interface GameRecord {
  opponentId: string;
  opponentElo: number;
  score: number; // 1 = win, 0.5 = draw, 0 = loss
}

/**
 * Collect regulation game records for a given entrant.
 * Only includes games where the opponent has a valid numeric elo.
 */
function collectGameRecords(
  matches: TournamentMatch[],
  seriesById: Map<string, TournamentSeries>,
  entrantId: string,
  eloMap: Map<string, number>,
): GameRecord[] {
  const records: GameRecord[] = [];

  for (const match of matches) {
    if (match.status !== "finished" || match.result === "*") continue;

    const series = seriesById.get(match.seriesId);
    if (!series) continue;
    if (match.seriesGameIndex > series.plannedGames) continue;

    let opponentId: string;
    let score: number;

    if (match.whiteEntrantId === entrantId) {
      opponentId = match.blackEntrantId;
      score =
        match.result === "1-0" ? 1 : match.result === "0-1" ? 0 : 0.5;
    } else if (match.blackEntrantId === entrantId) {
      opponentId = match.whiteEntrantId;
      score =
        match.result === "0-1" ? 1 : match.result === "1-0" ? 0 : 0.5;
    } else {
      continue;
    }

    const opponentElo = eloMap.get(opponentId);
    if (opponentElo === undefined) continue;

    records.push({ opponentId, opponentElo, score });
  }

  return records;
}

/**
 * Compute performance rating from a set of game records.
 * Returns null if no rated games.
 */
function perfFromRecords(records: GameRecord[]): number | null {
  if (records.length === 0) return null;

  const totalScore = records.reduce((sum, r) => sum + r.score, 0);
  const avgOpponentElo =
    records.reduce((sum, r) => sum + r.opponentElo, 0) / records.length;
  const scorePercent = totalScore / records.length;

  return Math.round(avgOpponentElo + getDp(scorePercent));
}

/**
 * Compute FIDE performance ratings for all entrants in a tournament.
 * Returns a Map from entrantId to performance rating.
 * Entrants with no rated games are omitted from the map.
 */
export function computePerformanceRatings(
  matches: TournamentMatch[],
  series: TournamentSeries[],
  entrants: TournamentEntrant[],
): Map<string, number> {
  const eloMap = new Map<string, number>();
  for (const entrant of entrants) {
    const elo = parseNumericElo(entrant.network.elo);
    if (elo !== null) eloMap.set(entrant.id, elo);
  }

  const seriesById = new Map(series.map((s) => [s.id, s]));
  const result = new Map<string, number>();

  for (const entrant of entrants) {
    const records = collectGameRecords(matches, seriesById, entrant.id, eloMap);
    const perf = perfFromRecords(records);
    if (perf !== null) result.set(entrant.id, perf);
  }

  return result;
}

/**
 * Compute performance rating for a specific entrant against a specific opponent.
 * Returns null if no rated games between the pair.
 */
export function computePairPerformance(
  matches: TournamentMatch[],
  seriesById: Map<string, TournamentSeries>,
  entrantId: string,
  opponentId: string,
  opponentElo: number,
): number | null {
  const records: GameRecord[] = [];

  for (const match of matches) {
    if (match.status !== "finished" || match.result === "*") continue;

    const series = seriesById.get(match.seriesId);
    if (!series) continue;
    if (match.seriesGameIndex > series.plannedGames) continue;

    let score: number;
    if (
      match.whiteEntrantId === entrantId &&
      match.blackEntrantId === opponentId
    ) {
      score =
        match.result === "1-0" ? 1 : match.result === "0-1" ? 0 : 0.5;
    } else if (
      match.blackEntrantId === entrantId &&
      match.whiteEntrantId === opponentId
    ) {
      score =
        match.result === "0-1" ? 1 : match.result === "1-0" ? 0 : 0.5;
    } else {
      continue;
    }

    records.push({ opponentId, opponentElo, score });
  }

  return perfFromRecords(records);
}
