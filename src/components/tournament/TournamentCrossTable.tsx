import { useMemo, useState } from "react";
import type {
  StandingRow,
  TournamentMatch,
  TournamentSeries,
} from "../../types/tournament";

interface CrossCell {
  points: number;
  finishedGames: number;
  pendingGames: number;
}

interface TournamentCrossTableProps {
  standings: StandingRow[];
  matches: TournamentMatch[];
  series: TournamentSeries[];
  mode: "series" | "games";
}

type SortColumn = "default" | "name" | "points";
type SortDirection = "asc" | "desc";

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

export function TournamentCrossTable({
  standings,
  matches,
  series,
  mode,
}: TournamentCrossTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("default");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const isSeriesMode = mode === "series";

  const ordered = useMemo(() => {
    if (sortColumn === "default") return standings;

    return [...standings].sort((a, b) => {
      let cmp = 0;
      if (sortColumn === "name") {
        cmp = a.label.localeCompare(b.label);
      } else {
        const aPoints = isSeriesMode ? a.matchPoints : a.gamePoints;
        const bPoints = isSeriesMode ? b.matchPoints : b.gamePoints;
        cmp = aPoints - bPoints;
      }

      if (cmp === 0) {
        cmp = a.label.localeCompare(b.label);
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [isSeriesMode, sortColumn, sortDirection, standings]);

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

  const leaderEntrantId = standings[0]?.entrantId;

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
        cell = { points: 0, finishedGames: 0, pendingGames: 0 };
        rowMap.set(colId, cell);
      }
      return cell;
    };

    if (isSeriesMode) {
      for (const item of series) {
        if (item.status !== "finished") {
          getCell(item.whiteEntrantId, item.blackEntrantId).pendingGames += 1;
          getCell(item.blackEntrantId, item.whiteEntrantId).pendingGames += 1;
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
        whiteCell.points += whitePoints;
        whiteCell.finishedGames += 1;

        const blackCell = getCell(item.blackEntrantId, item.whiteEntrantId);
        blackCell.points += blackPoints;
        blackCell.finishedGames += 1;
      }
    } else {
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
        whiteCell.points += whitePoints;
        whiteCell.finishedGames += 1;

        const blackCell = getCell(match.blackEntrantId, match.whiteEntrantId);
        blackCell.points += blackPoints;
        blackCell.finishedGames += 1;
      }
    }

    return byRow;
  }, [isSeriesMode, matches, series]);

  if (ordered.length === 0) {
    return (
      <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3">
        <h3 className="text-sm font-semibold text-gray-100 mb-2">
          Crosstable ({isSeriesMode ? "Series" : "Games"})
        </h3>
        <p className="text-xs text-gray-500">No entrants yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3">
      <h3 className="text-sm font-semibold text-gray-100 mb-2">
        Crosstable ({isSeriesMode ? "Series" : "Games"})
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="text-gray-400 border-b border-slate-700">
            <tr>
              <th className="py-2 pr-2">
                <button
                  type="button"
                  onClick={() => toggleSort("default")}
                  className="hover:text-gray-200 transition-colors"
                  title="Sort by current rank"
                >
                  #{sortIndicator(sortColumn, sortDirection, "default")}
                </button>
              </th>
              <th className="py-2 pr-2">
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
                  onClick={() => toggleSort("points")}
                  className="hover:text-gray-200 transition-colors"
                  title={`Sort by ${isSeriesMode ? "match points" : "game points"}`}
                >
                  {isSeriesMode ? "MP" : "GP"}
                  {sortIndicator(sortColumn, sortDirection, "points")}
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
                <td className="py-2 pr-2">{rowIndex + 1}</td>
                <td className="py-2 pr-2 truncate max-w-44">{row.label}</td>
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
                    return (
                      <td
                        key={`${row.entrantId}-${col.entrantId}`}
                        className="py-2 px-1 text-center text-amber-300"
                        title={`${cell.pendingGames} game(s) pending`}
                      >
                        …
                      </td>
                    );
                  }

                  return (
                    <td
                      key={`${row.entrantId}-${col.entrantId}`}
                      className="py-2 px-1 text-center"
                      title={`Finished: ${cell.finishedGames} · Pending: ${cell.pendingGames}`}
                    >
                      {formatPoints(cell.points)}
                    </td>
                  );
                })}
                <td className="py-2 pl-2 text-right font-medium">
                  {(isSeriesMode ? row.matchPoints : row.gamePoints).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-500 mt-2">
        Legend: x self, · unplayed, … pending
      </p>
    </div>
  );
}
