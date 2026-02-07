import { useMemo, useState } from "react";
import type {
  StandingRow,
  TournamentEntrant,
  TournamentMatch,
  TournamentSeries,
} from "../../types/tournament";

interface CrossCell {
  seriesPoints: number;
  gamePoints: number;
  finishedSeries: number;
  pendingSeries: number;
  finishedGames: number;
  pendingGames: number;
  rowAsWhiteWins: number;
  rowAsWhiteDraws: number;
  rowAsWhiteLosses: number;
  rowAsBlackWins: number;
  rowAsBlackDraws: number;
  rowAsBlackLosses: number;
}

interface TournamentCrossTableProps {
  seriesStandings: StandingRow[];
  gameStandings: StandingRow[];
  matches: TournamentMatch[];
  series: TournamentSeries[];
  entrants: TournamentEntrant[];
}

type SortColumn = "default" | "name" | "elo" | "matchPoints" | "gamePoints";
type SortDirection = "asc" | "desc";

const RANK_COL_CLASS = "py-2 pr-2 w-12 whitespace-nowrap";
const RATING_COL_CLASS = "py-2 pr-2 w-36 whitespace-nowrap";
const ENTRANT_COL_CLASS = "py-2 pr-2 w-72";

function formatPoints(points: number): string {
  return Number.isInteger(points) ? String(points) : points.toFixed(1);
}

function sortIndicator(
  activeColumn: SortColumn,
  activeDirection: SortDirection,
  column: SortColumn,
): string {
  if (activeColumn !== column) return "";
  return activeDirection === "asc" ? " ↑" : " ↓";
}

function parseEloBounds(elo: string): { low: number; high: number } {
  const values = (elo.match(/\d+/g) ?? [])
    .map((value) => parseInt(value, 10))
    .filter((value) => Number.isFinite(value));

  if (values.length === 0) return { low: 0, high: 0 };
  if (values.length === 1) return { low: values[0], high: values[0] };
  const first = values[0];
  const second = values[1];
  return {
    low: Math.min(first, second),
    high: Math.max(first, second),
  };
}

export function TournamentCrossTable({
  seriesStandings,
  gameStandings,
  matches,
  series,
  entrants,
}: TournamentCrossTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("default");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const gamePointsByEntrant = useMemo(
    () => new Map(gameStandings.map((row) => [row.entrantId, row.gamePoints])),
    [gameStandings],
  );
  const eloByEntrant = useMemo(
    () => new Map(entrants.map((entrant) => [entrant.id, entrant.network.elo])),
    [entrants],
  );

  const ordered = useMemo<StandingRow[]>(() => {
    if (sortColumn === "default") return seriesStandings;

    return [...seriesStandings].sort((a, b) => {
      let cmp = 0;
      if (sortColumn === "name") {
        cmp = a.label.localeCompare(b.label);
      } else if (sortColumn === "elo") {
        const aElo = parseEloBounds(eloByEntrant.get(a.entrantId) ?? "");
        const bElo = parseEloBounds(eloByEntrant.get(b.entrantId) ?? "");
        if (aElo.low !== bElo.low) {
          cmp = aElo.low - bElo.low;
        } else {
          cmp = aElo.high - bElo.high;
        }
      } else if (sortColumn === "matchPoints") {
        cmp = a.matchPoints - b.matchPoints;
        if (cmp === 0) {
          const aGames = gamePointsByEntrant.get(a.entrantId) ?? a.gamePoints;
          const bGames = gamePointsByEntrant.get(b.entrantId) ?? b.gamePoints;
          cmp = aGames - bGames;
        }
      } else if (sortColumn === "gamePoints") {
        const aGames = gamePointsByEntrant.get(a.entrantId) ?? a.gamePoints;
        const bGames = gamePointsByEntrant.get(b.entrantId) ?? b.gamePoints;
        if (aGames !== bGames) {
          cmp = aGames - bGames;
        } else {
          cmp = a.matchPoints - b.matchPoints;
        }
      }

      if (cmp === 0) {
        cmp = a.label.localeCompare(b.label);
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [eloByEntrant, gamePointsByEntrant, seriesStandings, sortColumn, sortDirection]);

  const toggleSort = (column: SortColumn) => {
    if (column === "default") {
      setSortColumn("default");
      setSortDirection("desc");
      return;
    }

    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(column);
    setSortDirection(column === "name" ? "asc" : "desc");
  };

  const leaderEntrantId = seriesStandings[0]?.entrantId;

  const matrix = useMemo(() => {
    const byRow = new Map<string, Map<string, CrossCell>>();

    const getCell = (rowId: string, colId: string): CrossCell => {
      let rowMap = byRow.get(rowId);
      if (!rowMap) {
        rowMap = new Map();
        byRow.set(rowId, rowMap);
      }
      let cell = rowMap.get(colId);
      if (!cell) {
        cell = {
          seriesPoints: 0,
          gamePoints: 0,
          finishedSeries: 0,
          pendingSeries: 0,
          finishedGames: 0,
          pendingGames: 0,
          rowAsWhiteWins: 0,
          rowAsWhiteDraws: 0,
          rowAsWhiteLosses: 0,
          rowAsBlackWins: 0,
          rowAsBlackDraws: 0,
          rowAsBlackLosses: 0,
        };
        rowMap.set(colId, cell);
      }
      return cell;
    };

    for (const item of series) {
      if (item.status !== "finished") {
        getCell(item.whiteEntrantId, item.blackEntrantId).pendingSeries += 1;
        getCell(item.blackEntrantId, item.whiteEntrantId).pendingSeries += 1;
        continue;
      }

      let whitePoints = 0;
      let blackPoints = 0;
      if (item.winnerEntrantId === item.whiteEntrantId) {
        whitePoints = 1;
      } else if (item.winnerEntrantId === item.blackEntrantId) {
        blackPoints = 1;
      } else {
        whitePoints = 0.5;
        blackPoints = 0.5;
      }

      const whiteCell = getCell(item.whiteEntrantId, item.blackEntrantId);
      whiteCell.seriesPoints += whitePoints;
      whiteCell.finishedSeries += 1;

      const blackCell = getCell(item.blackEntrantId, item.whiteEntrantId);
      blackCell.seriesPoints += blackPoints;
      blackCell.finishedSeries += 1;
    }

    for (const match of matches) {
      if (match.status === "cancelled") continue;
      if (match.result === "*" || match.status !== "finished") {
        getCell(match.whiteEntrantId, match.blackEntrantId).pendingGames += 1;
        getCell(match.blackEntrantId, match.whiteEntrantId).pendingGames += 1;
        continue;
      }

      let whitePoints = 0;
      let blackPoints = 0;
      if (match.result === "1-0") {
        whitePoints = 1;
      } else if (match.result === "0-1") {
        blackPoints = 1;
      } else {
        whitePoints = 0.5;
        blackPoints = 0.5;
      }

      const whiteCell = getCell(match.whiteEntrantId, match.blackEntrantId);
      whiteCell.gamePoints += whitePoints;
      whiteCell.finishedGames += 1;
      if (match.result === "1-0") {
        whiteCell.rowAsWhiteWins += 1;
      } else if (match.result === "0-1") {
        whiteCell.rowAsWhiteLosses += 1;
      } else {
        whiteCell.rowAsWhiteDraws += 1;
      }

      const blackCell = getCell(match.blackEntrantId, match.whiteEntrantId);
      blackCell.gamePoints += blackPoints;
      blackCell.finishedGames += 1;
      if (match.result === "0-1") {
        blackCell.rowAsBlackWins += 1;
      } else if (match.result === "1-0") {
        blackCell.rowAsBlackLosses += 1;
      } else {
        blackCell.rowAsBlackDraws += 1;
      }
    }

    return byRow;
  }, [matches, series]);

  if (ordered.length === 0) {
    return (
      <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3">
        <h3 className="text-sm font-semibold text-gray-100 mb-2">Crosstable</h3>
        <p className="text-xs text-gray-500">No entrants yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3">
      <h3 className="text-sm font-semibold text-gray-100 mb-2">Crosstable</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="text-gray-400 border-b border-slate-700">
            <tr>
              <th className={RANK_COL_CLASS}>
                <button
                  type="button"
                  onClick={() => toggleSort("default")}
                  className="hover:text-gray-200 transition-colors"
                  title="Sort by current rank"
                >
                  #{sortIndicator(sortColumn, sortDirection, "default")}
                </button>
              </th>
              <th className={RATING_COL_CLASS}>
                <button
                  type="button"
                  onClick={() => toggleSort("elo")}
                  className="hover:text-gray-200 transition-colors"
                  title="Sort by rating"
                >
                  Rating{sortIndicator(sortColumn, sortDirection, "elo")}
                </button>
              </th>
              <th className={ENTRANT_COL_CLASS}>
                <button
                  type="button"
                  onClick={() => toggleSort("name")}
                  className="hover:text-gray-200 transition-colors"
                  title="Sort by entrant name"
                >
                  Entrant{sortIndicator(sortColumn, sortDirection, "name")}
                </button>
              </th>
              {ordered.map((_, idx) => (
                <th key={`col-${idx + 1}`} className="py-2 px-1 text-center min-w-8">
                  {idx + 1}
                </th>
              ))}
              <th className="py-2 pl-2 text-right">
                <button
                  type="button"
                  onClick={() => toggleSort("matchPoints")}
                  className="hover:text-gray-200 transition-colors"
                  title="Sort by match points"
                >
                  MP
                  {sortIndicator(sortColumn, sortDirection, "matchPoints")}
                </button>
              </th>
              <th className="py-2 pl-2 text-right">
                <button
                  type="button"
                  onClick={() => toggleSort("gamePoints")}
                  className="hover:text-gray-200 transition-colors"
                  title="Sort by game points"
                >
                  GP
                  {sortIndicator(sortColumn, sortDirection, "gamePoints")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((row, rowIndex) => (
              <tr
                key={row.entrantId}
                className={`border-b border-slate-800 ${
                  row.entrantId === leaderEntrantId ? "text-emerald-300" : "text-gray-200"
                }`}
              >
                <td className={RANK_COL_CLASS}>{rowIndex + 1}</td>
                <td
                  className={`${RATING_COL_CLASS} text-gray-300 text-[11px]`}
                >
                  {eloByEntrant.get(row.entrantId) ?? "N/A"}
                </td>
                <td className={`${ENTRANT_COL_CLASS} truncate max-w-72`}>
                  {row.label}
                </td>
                {ordered.map((col) => {
                  if (col.entrantId === row.entrantId) {
                    return (
                      <td
                        key={`${row.entrantId}-${col.entrantId}`}
                        className="py-2 px-1 text-center text-gray-500"
                      >
                        x
                      </td>
                    );
                  }

                  const cell = matrix.get(row.entrantId)?.get(col.entrantId);
                  if (!cell) {
                    return (
                      <td
                        key={`${row.entrantId}-${col.entrantId}`}
                        className="py-2 px-1 text-center text-gray-500"
                      >
                        ·
                      </td>
                    );
                  }

                  if (cell.finishedGames === 0) {
                    if (cell.pendingSeries > 0 || cell.pendingGames > 0) {
                      return (
                        <td
                          key={`${row.entrantId}-${col.entrantId}`}
                          className="py-2 px-1 text-center text-amber-300"
                          title={`Series pending: ${cell.pendingSeries} · Games pending: ${cell.pendingGames}`}
                        >
                          …
                        </td>
                      );
                    }
                    return (
                      <td
                        key={`${row.entrantId}-${col.entrantId}`}
                        className="py-2 px-1 text-center text-gray-500"
                      >
                        ·
                      </td>
                    );
                  }

                  return (
                    <td
                      key={`${row.entrantId}-${col.entrantId}`}
                      className="py-1 px-1 text-center leading-tight"
                      title={`${row.label} as White W-D-L: ${cell.rowAsWhiteWins}-${cell.rowAsWhiteDraws}-${cell.rowAsWhiteLosses}
${row.label} as Black W-D-L: ${cell.rowAsBlackWins}-${cell.rowAsBlackDraws}-${cell.rowAsBlackLosses}
${col.label} as White W-D-L: ${cell.rowAsBlackLosses}-${cell.rowAsBlackDraws}-${cell.rowAsBlackWins}
${col.label} as Black W-D-L: ${cell.rowAsWhiteLosses}-${cell.rowAsWhiteDraws}-${cell.rowAsWhiteWins}`}
                    >
                      <div className="text-xs font-medium text-gray-100">
                        {formatPoints(cell.seriesPoints)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {formatPoints(cell.gamePoints)}
                      </div>
                    </td>
                  );
                })}
                <td className="py-2 pl-2 text-right font-medium">
                  {row.matchPoints.toFixed(1)}
                </td>
                <td className="py-2 pl-2 text-right font-medium">
                  {(gamePointsByEntrant.get(row.entrantId) ?? row.gamePoints).toFixed(
                    1,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-500 mt-2">
        Legend: cell top = series, bottom = games, x self, · unplayed, … pending
      </p>
    </div>
  );
}
