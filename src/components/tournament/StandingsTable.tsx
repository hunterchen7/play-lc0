import { useMemo, useState } from "react";
import type { StandingRow, TournamentEntrant } from "../../types/tournament";

interface StandingsTableProps {
  seriesStandings: StandingRow[];
  gameStandings: StandingRow[];
  entrants: TournamentEntrant[];
}

type SortColumn =
  | "default"
  | "name"
  | "elo"
  | "seriesPoints"
  | "gamePoints"
  | "seriesRecord"
  | "gameRecord"
  | "seriesTiebreak"
  | "gameTiebreak";
type SortDirection = "asc" | "desc";

interface HeaderWithTooltipProps {
  label: string;
  tooltip: string;
}

interface CombinedStandingRow {
  entrantId: string;
  label: string;
  elo: string;
  eloLow: number;
  eloHigh: number;
  seriesPoints: number;
  gamePoints: number;
  seriesWins: number;
  seriesDraws: number;
  seriesLosses: number;
  gameWins: number;
  gameDraws: number;
  gameLosses: number;
  seriesTiebreak: number;
  gameTiebreak: number;
}

const RANK_COL_CLASS = "py-2 pr-2 w-12 whitespace-nowrap";
const RATING_COL_CLASS = "py-2 pr-2 w-36 whitespace-nowrap";
const ENTRANT_COL_CLASS = "py-2 pr-2 w-72";

function HeaderWithTooltip({ label, tooltip }: HeaderWithTooltipProps) {
  return (
    <span className="relative inline-flex items-center group/tt">
      <span className="underline decoration-dotted underline-offset-2 cursor-help">
        {label}
      </span>
      <span className="absolute top-0 right-full mr-2 px-2.5 py-1.5 bg-slate-700 border border-slate-600 text-xs text-gray-200 rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover/tt:opacity-100 transition-opacity duration-150 shadow-lg z-50">
        {tooltip}
      </span>
    </span>
  );
}

function sortIndicator(
  activeColumn: SortColumn,
  activeDirection: SortDirection,
  column: SortColumn,
): string {
  if (activeColumn !== column) return "";
  return activeDirection === "asc" ? " ↑" : " ↓";
}

function compareRecord(
  aWins: number,
  aDraws: number,
  aLosses: number,
  bWins: number,
  bDraws: number,
  bLosses: number,
): number {
  if (aWins !== bWins) return aWins - bWins;
  if (aDraws !== bDraws) return aDraws - bDraws;
  return bLosses - aLosses;
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

export function StandingsTable({
  seriesStandings,
  gameStandings,
  entrants,
}: StandingsTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("default");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const rows = useMemo<CombinedStandingRow[]>(() => {
    const gamesByEntrantId = new Map(
      gameStandings.map((row) => [row.entrantId, row]),
    );
    const entrantsById = new Map(entrants.map((entrant) => [entrant.id, entrant]));

    return seriesStandings.map((seriesRow) => {
      const gameRow = gamesByEntrantId.get(seriesRow.entrantId);
      const entrant = entrantsById.get(seriesRow.entrantId);
      const elo = entrant?.network.elo ?? "N/A";
      const eloBounds = parseEloBounds(elo);
      return {
        entrantId: seriesRow.entrantId,
        label: seriesRow.label,
        elo,
        eloLow: eloBounds.low,
        eloHigh: eloBounds.high,
        seriesPoints: seriesRow.matchPoints,
        gamePoints: gameRow?.gamePoints ?? 0,
        seriesWins: seriesRow.wins,
        seriesDraws: seriesRow.draws,
        seriesLosses: seriesRow.losses,
        gameWins: gameRow?.wins ?? 0,
        gameDraws: gameRow?.draws ?? 0,
        gameLosses: gameRow?.losses ?? 0,
        seriesTiebreak: seriesRow.buchholz,
        gameTiebreak: gameRow?.buchholz ?? 0,
      };
    });
  }, [entrants, gameStandings, seriesStandings]);

  const sortedRows = useMemo(() => {
    if (sortColumn === "default") return rows;

    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortColumn === "name") {
        cmp = a.label.localeCompare(b.label);
      } else if (sortColumn === "elo") {
        if (a.eloLow !== b.eloLow) {
          cmp = a.eloLow - b.eloLow;
        } else {
          cmp = a.eloHigh - b.eloHigh;
        }
      } else if (sortColumn === "seriesPoints") {
        cmp = a.seriesPoints - b.seriesPoints;
      } else if (sortColumn === "gamePoints") {
        cmp = a.gamePoints - b.gamePoints;
      } else if (sortColumn === "seriesRecord") {
        cmp = compareRecord(
          a.seriesWins,
          a.seriesDraws,
          a.seriesLosses,
          b.seriesWins,
          b.seriesDraws,
          b.seriesLosses,
        );
      } else if (sortColumn === "gameRecord") {
        cmp = compareRecord(
          a.gameWins,
          a.gameDraws,
          a.gameLosses,
          b.gameWins,
          b.gameDraws,
          b.gameLosses,
        );
      } else if (sortColumn === "seriesTiebreak") {
        cmp = a.seriesTiebreak - b.seriesTiebreak;
      } else if (sortColumn === "gameTiebreak") {
        cmp = a.gameTiebreak - b.gameTiebreak;
      }

      if (cmp === 0) {
        cmp = a.label.localeCompare(b.label);
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [rows, sortColumn, sortDirection]);

  const leaderEntrantId = seriesStandings[0]?.entrantId;

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

  return (
    <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3">
      <h3 className="text-sm font-semibold text-gray-100 mb-2">Standings</h3>
      <div className="overflow-x-auto overflow-y-visible">
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
              <th className="py-2 pr-2">
                <button
                  type="button"
                  onClick={() => toggleSort("seriesPoints")}
                  className="hover:text-gray-200 transition-colors"
                  title="Sort by series match points"
                >
                  <HeaderWithTooltip
                    label={`MP${sortIndicator(sortColumn, sortDirection, "seriesPoints")}`}
                    tooltip="Match Points: 1 for a series win, 0.5 for a series draw, 0 for a series loss."
                  />
                </button>
              </th>
              <th className="py-2 pr-2">
                <button
                  type="button"
                  onClick={() => toggleSort("gamePoints")}
                  className="hover:text-gray-200 transition-colors"
                  title="Sort by game points"
                >
                  <HeaderWithTooltip
                    label={`GP${sortIndicator(sortColumn, sortDirection, "gamePoints")}`}
                    tooltip="Game Points: sum of game results (win = 1, draw = 0.5, loss = 0)."
                  />
                </button>
              </th>
              <th className="py-2 pr-2">
                <button
                  type="button"
                  onClick={() => toggleSort("seriesRecord")}
                  className="hover:text-gray-200 transition-colors"
                  title="Sort by series record"
                >
                  <HeaderWithTooltip
                    label={`S W-D-L${sortIndicator(sortColumn, sortDirection, "seriesRecord")}`}
                    tooltip="Series record as Wins-Draws-Losses."
                  />
                </button>
              </th>
              <th className="py-2 pr-2">
                <button
                  type="button"
                  onClick={() => toggleSort("gameRecord")}
                  className="hover:text-gray-200 transition-colors"
                  title="Sort by game record"
                >
                  <HeaderWithTooltip
                    label={`G W-D-L${sortIndicator(sortColumn, sortDirection, "gameRecord")}`}
                    tooltip="Game record as Wins-Draws-Losses."
                  />
                </button>
              </th>
              <th className="py-2 pr-2">
                <button
                  type="button"
                  onClick={() => toggleSort("seriesTiebreak")}
                  className="hover:text-gray-200 transition-colors"
                  title="Sort by Buchholz"
                >
                  <HeaderWithTooltip
                    label={`Buchholz${sortIndicator(sortColumn, sortDirection, "seriesTiebreak")}`}
                    tooltip="Buchholz tiebreak: sum of your opponents' Match Points (strength of schedule)."
                  />
                </button>
              </th>
              <th className="py-2">
                <button
                  type="button"
                  onClick={() => toggleSort("gameTiebreak")}
                  className="hover:text-gray-200 transition-colors"
                  title="Sort by opponents game points"
                >
                  <HeaderWithTooltip
                    label={`Opp GP${sortIndicator(sortColumn, sortDirection, "gameTiebreak")}`}
                    tooltip="Opponents' Game Points: sum of your opponents' GP as a game-level tiebreak."
                  />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, idx) => (
              <tr
                key={row.entrantId}
                className={`border-b border-slate-800 ${
                  row.entrantId === leaderEntrantId ? "text-emerald-300" : "text-gray-200"
                }`}
              >
                <td className={RANK_COL_CLASS}>{idx + 1}</td>
                <td
                  className={`${RATING_COL_CLASS} text-gray-300 text-[11px]`}
                >
                  {row.elo}
                </td>
                <td className={ENTRANT_COL_CLASS}>{row.label}</td>
                <td className="py-2 pr-2">{row.seriesPoints.toFixed(1)}</td>
                <td className="py-2 pr-2 font-medium">{row.gamePoints.toFixed(1)}</td>
                <td className="py-2 pr-2">
                  {row.seriesWins}-{row.seriesDraws}-{row.seriesLosses}
                </td>
                <td className="py-2 pr-2">
                  {row.gameWins}-{row.gameDraws}-{row.gameLosses}
                </td>
                <td className="py-2 pr-2">{row.seriesTiebreak.toFixed(1)}</td>
                <td className="py-2">{row.gameTiebreak.toFixed(1)}</td>
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={9} className="py-3 text-center text-gray-500">
                  No games yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
