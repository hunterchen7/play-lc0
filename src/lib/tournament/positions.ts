import type { TournamentPosition } from "../../types/tournament";

const DEFAULT_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * Assign a starting FEN to a specific game within a series.
 * Positions are distributed so each series rotates through the list,
 * ensuring even coverage across the tournament.
 *
 * @param positions - available tournament positions (empty = standard)
 * @param seriesIndex - global series index (0-based, cumulative across rounds)
 * @param plannedGames - best-of count for the series
 * @param gameIndex - 0-based game index within the series
 */
export function assignPositionFen(
  positions: TournamentPosition[],
  seriesIndex: number,
  plannedGames: number,
  gameIndex: number,
): string {
  if (positions.length === 0) return DEFAULT_FEN;
  const idx =
    (seriesIndex * Math.max(1, plannedGames) + gameIndex) % positions.length;
  return positions[idx].fen;
}
