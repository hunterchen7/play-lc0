import { useEffect, useMemo, useRef, useState } from "react";
import { StandingsTable } from "./StandingsTable";
import { TournamentCrossTable } from "./TournamentCrossTable";
import { TournamentMiniBoard } from "./TournamentMiniBoard";
import type {
  StandingRow,
  TournamentEntrant,
  TournamentMatch,
  TournamentRuntimeState,
} from "../../types/tournament";

interface TournamentLiveScreenProps {
  state: TournamentRuntimeState;
  onSelectMatch: (matchId: string) => void;
  onResume: () => void;
  onPause: () => void;
  onSetMoveDelayMs: (moveDelayMs: number) => void;
  onSetMaxSimultaneousGames: (maxSimultaneousGames: number) => void;
  loadedEngineCount: number;
  maxLoadedEngineCount: number;
  estimatedEngineMemoryMb: number;
  onDownloadPgn: () => boolean;
  canDownloadPgn: boolean;
  onReset: () => void;
}

type RoundViewMode = "game" | "board";
const ROUND_VIEW_MODE_STORAGE_KEY = "lc0-tournament-round-view-mode";

function getInitialRoundViewMode(): RoundViewMode {
  if (typeof window === "undefined") return "game";
  const saved = window.localStorage.getItem(ROUND_VIEW_MODE_STORAGE_KEY);
  return saved === "board" ? "board" : "game";
}

function statusBadgeClass(status: string): string {
  if (status === "running")
    return "bg-blue-900/60 text-blue-200 border-blue-600/50";
  if (status === "finished")
    return "bg-emerald-900/60 text-emerald-200 border-emerald-600/50";
  if (status === "cancelled")
    return "bg-amber-900/60 text-amber-200 border-amber-600/50";
  if (status === "error") return "bg-red-900/60 text-red-200 border-red-600/50";
  return "bg-slate-800 text-slate-300 border-slate-600/50";
}

function tournamentStatusClass(status: string): string {
  if (status === "completed") {
    return "bg-emerald-900/50 border-emerald-700/50 text-emerald-200";
  }
  if (status === "error") return "bg-red-900/40 border-red-700/50 text-red-200";
  if (status === "running")
    return "bg-blue-900/40 border-blue-700/50 text-blue-200";
  if (status === "paused")
    return "bg-amber-900/40 border-amber-700/50 text-amber-200";
  return "bg-slate-800 border-slate-700 text-gray-200";
}

function toFullMoveCount(plies: number): number {
  return Math.ceil(plies / 2);
}

function matchStatusPriority(status: string): number {
  if (status === "running") return 0;
  if (status === "error") return 1;
  if (status === "finished") return 2;
  if (status === "cancelled") return 3;
  if (status === "waiting") return 4;
  return 5;
}

function standingTieKey(row: StandingRow): string {
  return [
    row.matchPoints.toFixed(4),
    row.gamePoints.toFixed(4),
    row.buchholz.toFixed(4),
    row.wins,
  ].join("|");
}

function getFirstPlaceRows(standings: StandingRow[]): StandingRow[] {
  if (standings.length === 0) return [];
  const topKey = standingTieKey(standings[0]);
  return standings.filter((row) => standingTieKey(row) === topKey);
}

function getDefaultBoardGameIndex(matches: TournamentMatch[]): number {
  const runningIndex = matches.findIndex((match) => match.status === "running");
  if (runningIndex >= 0) return runningIndex;

  const errorIndex = matches.findIndex((match) => match.status === "error");
  if (errorIndex >= 0) return errorIndex;

  const waitingIndex = matches.findIndex((match) => match.status === "waiting");
  if (waitingIndex >= 0) return waitingIndex;

  return 0;
}

export function TournamentLiveScreen({
  state,
  onSelectMatch,
  onResume,
  onPause,
  onSetMoveDelayMs,
  onSetMaxSimultaneousGames,
  loadedEngineCount,
  maxLoadedEngineCount,
  estimatedEngineMemoryMb,
  onDownloadPgn,
  canDownloadPgn,
  onReset,
}: TournamentLiveScreenProps) {
  const entrantsById = useMemo(
    () => new Map(state.entrants.map((entrant) => [entrant.id, entrant])),
    [state.entrants],
  );

  const currentRound = state.currentRound || 1;
  const maxRound = Math.max(1, state.totalRounds || 1);
  const tiebreakLabel =
    state.maxTiebreakGames <= 0
      ? "No tiebreaks"
      : state.tiebreakMode === "win_by"
        ? `TB max ${state.maxTiebreakGames}, win by ${state.tiebreakWinBy}`
        : `TB max ${state.maxTiebreakGames}`;
  const [visibleRound, setVisibleRound] = useState(currentRound);
  const [followCurrentRound, setFollowCurrentRound] = useState(true);
  const [playerFilter, setPlayerFilter] = useState("");
  const [roundViewMode, setRoundViewMode] = useState<RoundViewMode>(
    getInitialRoundViewMode,
  );
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [boardViewIndices, setBoardViewIndices] = useState<
    Record<number, number>
  >({});
  const boardManualSelectionRef = useRef<Record<number, boolean>>({});

  useEffect(() => {
    setVisibleRound((prev) => {
      if (prev < 1) return 1;
      if (prev > maxRound) return maxRound;
      return prev;
    });
  }, [maxRound]);

  useEffect(() => {
    if (!followCurrentRound) return;
    setVisibleRound(currentRound);
  }, [currentRound, followCurrentRound]);

  useEffect(() => {
    if (!showResetConfirm) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowResetConfirm(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showResetConfirm]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ROUND_VIEW_MODE_STORAGE_KEY, roundViewMode);
  }, [roundViewMode]);

  const roundMatches = useMemo(
    () => state.matches.filter((match) => match.round === visibleRound),
    [state.matches, visibleRound],
  );
  const normalizedPlayerFilter = playerFilter.trim().toLowerCase();
  const filteredRoundMatches = useMemo(() => {
    if (!normalizedPlayerFilter) return roundMatches;

    return roundMatches.filter((match) => {
      const whiteLabel =
        entrantsById.get(match.whiteEntrantId)?.label ?? match.whiteEntrantId;
      const blackLabel =
        entrantsById.get(match.blackEntrantId)?.label ?? match.blackEntrantId;
      return (
        whiteLabel.toLowerCase().includes(normalizedPlayerFilter) ||
        blackLabel.toLowerCase().includes(normalizedPlayerFilter)
      );
    });
  }, [entrantsById, normalizedPlayerFilter, roundMatches]);
  const pendingMatches = filteredRoundMatches.filter(
    (match) => match.status === "waiting",
  );
  const boardVisibleMatches = filteredRoundMatches
    .filter((match) => match.status !== "waiting")
    .sort((a, b) => {
      const aPriority = matchStatusPriority(a.status);
      const bPriority = matchStatusPriority(b.status);
      if (aPriority !== bPriority) return aPriority - bPriority;
      if (a.board !== b.board) return a.board - b.board;
      return a.seriesGameIndex - b.seriesGameIndex;
    });
  const matchesByBoard = useMemo(() => {
    const byBoard = new Map<number, TournamentMatch[]>();
    const sorted = [...filteredRoundMatches].sort((a, b) => {
      if (a.board !== b.board) return a.board - b.board;
      if (a.seriesGameIndex !== b.seriesGameIndex) {
        return a.seriesGameIndex - b.seriesGameIndex;
      }
      const aPriority = matchStatusPriority(a.status);
      const bPriority = matchStatusPriority(b.status);
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.seriesGameIndex - b.seriesGameIndex;
    });

    for (const match of sorted) {
      const existing = byBoard.get(match.board);
      if (existing) {
        existing.push(match);
      } else {
        byBoard.set(match.board, [match]);
      }
    }

    return byBoard;
  }, [filteredRoundMatches]);
  const visibleBoards = useMemo(
    () => [...matchesByBoard.keys()].sort((a, b) => a - b),
    [matchesByBoard],
  );
  const seriesById = useMemo(
    () => new Map(state.series.map((item) => [item.id, item])),
    [state.series],
  );
  const seriesBreakdownById = useMemo(() => {
    const byId = new Map<
      string,
      { seriesWhiteWins: number; seriesBlackWins: number; draws: number }
    >();

    for (const match of state.matches) {
      if (match.status !== "finished" || match.result === "*") continue;
      const series = seriesById.get(match.seriesId);
      if (!series) continue;

      const current = byId.get(match.seriesId) ?? {
        seriesWhiteWins: 0,
        seriesBlackWins: 0,
        draws: 0,
      };

      if (match.result === "1-0") {
        if (match.whiteEntrantId === series.whiteEntrantId) {
          current.seriesWhiteWins += 1;
        } else {
          current.seriesBlackWins += 1;
        }
      } else if (match.result === "0-1") {
        if (match.blackEntrantId === series.blackEntrantId) {
          current.seriesBlackWins += 1;
        } else {
          current.seriesWhiteWins += 1;
        }
      } else {
        current.draws += 1;
      }

      byId.set(match.seriesId, current);
    }

    return byId;
  }, [seriesById, state.matches]);

  useEffect(() => {
    setBoardViewIndices((prev) => {
      let changed = false;
      const next: Record<number, number> = { ...prev };
      const manualSelections = boardManualSelectionRef.current;

      for (const board of visibleBoards) {
        const boardMatches = matchesByBoard.get(board);
        if (!boardMatches || boardMatches.length === 0) continue;

        const desiredIndex = getDefaultBoardGameIndex(boardMatches);
        const currentIndex = next[board];
        if (!Number.isFinite(currentIndex)) {
          next[board] = desiredIndex;
          changed = true;
          continue;
        }

        if (!manualSelections[board] && currentIndex !== desiredIndex) {
          next[board] = desiredIndex;
          changed = true;
          continue;
        }

        const clamped = Math.max(
          0,
          Math.min(boardMatches.length - 1, currentIndex),
        );
        if (clamped !== currentIndex) {
          next[board] = clamped;
          changed = true;
        }
      }

      for (const boardKey of Object.keys(next)) {
        const board = Number(boardKey);
        if (!matchesByBoard.has(board)) {
          delete next[board];
          delete manualSelections[board];
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [matchesByBoard, visibleBoards]);

  const boardCards = useMemo(() => {
    return visibleBoards
      .map((board) => {
        const boardMatches = matchesByBoard.get(board);
        if (!boardMatches || boardMatches.length === 0) return null;

        const desiredIndex = boardViewIndices[board];
        const fallbackIndex = getDefaultBoardGameIndex(boardMatches);
        const safeIndex = Number.isFinite(desiredIndex)
          ? Math.max(0, Math.min(boardMatches.length - 1, desiredIndex))
          : fallbackIndex;

        return {
          board,
          matches: boardMatches,
          selectedIndex: safeIndex,
          selectedMatch: boardMatches[safeIndex],
          standing: (() => {
            const series = seriesById.get(boardMatches[safeIndex].seriesId);
            if (!series) {
              return {
                white: 0,
                black: 0,
                whiteWins: 0,
                blackWins: 0,
                draws: 0,
              };
            }

            const selected = boardMatches[safeIndex];
            const whiteIsSeriesWhite =
              selected.whiteEntrantId === series.whiteEntrantId;

            const breakdown = seriesBreakdownById.get(selected.seriesId) ?? {
              seriesWhiteWins: 0,
              seriesBlackWins: 0,
              draws: 0,
            };

            return whiteIsSeriesWhite
              ? {
                  white: series.whiteScore,
                  black: series.blackScore,
                  whiteWins: breakdown.seriesWhiteWins,
                  blackWins: breakdown.seriesBlackWins,
                  draws: breakdown.draws,
                }
              : {
                  white: series.blackScore,
                  black: series.whiteScore,
                  whiteWins: breakdown.seriesBlackWins,
                  blackWins: breakdown.seriesWhiteWins,
                  draws: breakdown.draws,
                };
          })(),
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null);
  }, [
    boardViewIndices,
    matchesByBoard,
    seriesBreakdownById,
    seriesById,
    visibleBoards,
  ]);

  const updateBoardGameIndex = (board: number, direction: -1 | 1) => {
    const boardMatches = matchesByBoard.get(board);
    if (!boardMatches || boardMatches.length === 0) return;
    boardManualSelectionRef.current[board] = true;

    setBoardViewIndices((prev) => {
      const fallbackIndex = getDefaultBoardGameIndex(boardMatches);
      const currentIndex = Number.isFinite(prev[board])
        ? prev[board]
        : fallbackIndex;
      const nextIndex = Math.max(
        0,
        Math.min(boardMatches.length - 1, currentIndex + direction),
      );

      if (nextIndex === currentIndex) return prev;
      return {
        ...prev,
        [board]: nextIndex,
      };
    });
  };
  const completedRoundGames = roundMatches.filter(
    (match) => match.status === "finished" || match.status === "cancelled",
  ).length;
  const roundProgress = `${completedRoundGames}/${roundMatches.length}`;

  const overallFinished = state.matches.filter(
    (match) => match.status === "finished" || match.status === "cancelled",
  ).length;
  const isConcluded = state.status === "completed";
  const leader = state.standings[0];
  const firstPlaceRows = getFirstPlaceRows(state.standings);
  const hasPlayableOrRetryable = state.matches.some((match) => {
    if (match.status === "waiting" || match.status === "running") return true;
    if (match.status === "error") return (match.retryCount ?? 0) < 6;
    return false;
  });
  const canAdvanceManually =
    state.status === "running" &&
    currentRound > 0 &&
    currentRound < state.totalRounds &&
    !hasPlayableOrRetryable &&
    state.series.some(
      (series) => series.round === currentRound && series.status !== "waiting",
    );

  const gameModeStandings = useMemo<StandingRow[]>(() => {
    const seriesPointsByEntrantId = new Map(
      state.standings.map((row) => [row.entrantId, row.matchPoints]),
    );
    const rows = new Map<string, StandingRow>();
    const opponents = new Map<string, Set<string>>();

    for (const entrant of state.entrants) {
      rows.set(entrant.id, {
        entrantId: entrant.id,
        label: entrant.label,
        matchPoints: seriesPointsByEntrantId.get(entrant.id) ?? 0,
        gamePoints: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        playedSeries: 0,
        buchholz: 0,
      });
      opponents.set(entrant.id, new Set<string>());
    }

    for (const match of state.matches) {
      if (match.status !== "finished" || match.result === "*") continue;
      const series = seriesById.get(match.seriesId);
      if (!series) continue;
      if (match.seriesGameIndex > series.plannedGames) continue;

      const whiteRow = rows.get(match.whiteEntrantId);
      const blackRow = rows.get(match.blackEntrantId);
      if (!whiteRow || !blackRow) continue;

      whiteRow.playedSeries += 1;
      blackRow.playedSeries += 1;
      opponents.get(match.whiteEntrantId)?.add(match.blackEntrantId);
      opponents.get(match.blackEntrantId)?.add(match.whiteEntrantId);

      if (match.result === "1-0") {
        whiteRow.gamePoints += 1;
        whiteRow.wins += 1;
        blackRow.losses += 1;
      } else if (match.result === "0-1") {
        blackRow.gamePoints += 1;
        blackRow.wins += 1;
        whiteRow.losses += 1;
      } else {
        whiteRow.gamePoints += 0.5;
        blackRow.gamePoints += 0.5;
        whiteRow.draws += 1;
        blackRow.draws += 1;
      }
    }

    for (const row of rows.values()) {
      const oppIds = opponents.get(row.entrantId) ?? new Set<string>();
      row.buchholz = [...oppIds].reduce(
        (sum, oppId) => sum + (rows.get(oppId)?.gamePoints ?? 0),
        0,
      );
    }

    return [...rows.values()].sort((a, b) => {
      if (b.gamePoints !== a.gamePoints) return b.gamePoints - a.gamePoints;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
      if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
      return a.label.localeCompare(b.label);
    });
  }, [seriesById, state.entrants, state.matches, state.standings]);

  return (
    <div className="w-full mx-auto p-4 md:p-6 flex flex-col gap-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-100">
            Tournament Live
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {state.format === "round_robin" ? "Round Robin" : "Swiss"} · Round{" "}
            {currentRound}/{state.totalRounds || 1} · Best-of {state.bestOf} ·
            Concurrency {state.maxSimultaneousGames} · {tiebreakLabel}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2 text-sm">
          <label className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 min-w-[220px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-gray-300">Move delay</span>
              <span className="text-xs text-gray-400">
                {state.moveDelayMs} ms
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1000"
              step="1"
              value={state.moveDelayMs}
              onChange={(event) =>
                onSetMoveDelayMs(parseInt(event.target.value, 10))
              }
              className="mt-1 w-full accent-emerald-500"
              aria-label="Move delay in milliseconds"
            />
          </label>
          <label className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 min-w-[220px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-gray-300">Concurrency</span>
              <span className="text-xs text-gray-400">
                {state.maxSimultaneousGames}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={state.maxSimultaneousGames}
              onChange={(event) =>
                onSetMaxSimultaneousGames(parseInt(event.target.value, 10))
              }
              className="mt-1 w-full accent-emerald-500"
              aria-label="Tournament concurrency"
            />
          </label>
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 min-w-[220px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-gray-300">memory used (est.)</span>
              <span className="text-xs text-gray-400">
                {estimatedEngineMemoryMb.toFixed(1)} MB
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              Loaded engines: {loadedEngineCount}/{maxLoadedEngineCount}
            </p>
          </div>
          <div
            className={`px-3 py-2 rounded-lg border ${tournamentStatusClass(state.status)}`}
          >
            Status: <span className="font-medium">{state.status}</span>
          </div>
          {state.status === "running" && (
            <button
              onClick={onPause}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg"
            >
              Pause
            </button>
          )}
          {canAdvanceManually && (
            <button
              onClick={onResume}
              className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-white"
            >
              Start Round {currentRound + 1}
            </button>
          )}
          {(state.status === "paused" || state.status === "error") && (
            <button
              onClick={onResume}
              className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-white"
            >
              Resume Tournament
            </button>
          )}
          <button
            onClick={onDownloadPgn}
            disabled={!canDownloadPgn}
            className="px-3 py-2 bg-sky-800 hover:bg-sky-700 rounded-lg disabled:bg-slate-800 disabled:text-slate-500 text-white"
          >
            Download PGN
          </button>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg"
          >
            New Tournament
          </button>
        </div>
      </div>

      {isConcluded && (
        <div className="rounded-lg border border-emerald-700/60 bg-emerald-900/20 p-3">
          <p className="text-sm font-semibold text-emerald-200">
            Tournament Concluded
          </p>
          <p className="text-xs text-emerald-100/90 mt-1">
            {firstPlaceRows.length === 1
              ? `Winner: ${leader?.label ?? firstPlaceRows[0].label} (${firstPlaceRows[0].matchPoints.toFixed(1)} MP, ${firstPlaceRows[0].gamePoints.toFixed(1)} GP).`
              : firstPlaceRows.length > 1
                ? `Tie for 1st (${firstPlaceRows.length}-way): ${firstPlaceRows.map((row) => row.label).join(", ")}.`
                : "Final standings are available."}{" "}
            Finished games: {overallFinished}/{state.matches.length}.
          </p>
        </div>
      )}

      {state.error && (
        <div className="rounded-lg border border-red-700/50 bg-red-900/30 text-red-200 p-3 text-sm">
          {state.error}
        </div>
      )}

      <div className="grid lg:grid-cols-[2fr,1fr] gap-4">
        <section className="bg-slate-900/80 border border-slate-700 rounded-xl p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setFollowCurrentRound(false);
                  setVisibleRound((prev) => Math.max(1, prev - 1));
                }}
                disabled={visibleRound <= 1}
                className="w-7 h-7 rounded border border-slate-600 bg-slate-800 text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Previous round"
                title="Previous round"
              >
                ←
              </button>
              <h2 className="text-sm font-semibold text-gray-100">
                Round {visibleRound}/{state.totalRounds || 1} Games
              </h2>
              <button
                onClick={() => {
                  setFollowCurrentRound(false);
                  setVisibleRound((prev) => Math.min(maxRound, prev + 1));
                }}
                disabled={visibleRound >= maxRound}
                className="w-7 h-7 rounded border border-slate-600 bg-slate-800 text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next round"
                title="Next round"
              >
                →
              </button>
              {visibleRound !== currentRound && (
                <button
                  onClick={() => {
                    setFollowCurrentRound(true);
                    setVisibleRound(currentRound);
                  }}
                  className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs text-gray-100"
                >
                  Current Round
                </button>
              )}
              <div className="ml-1 inline-flex rounded-lg border border-slate-600 overflow-hidden text-xs">
                <button
                  onClick={() => setRoundViewMode("game")}
                  className={`px-2 py-1 ${
                    roundViewMode === "game"
                      ? "bg-emerald-700 text-white"
                      : "bg-slate-800 text-gray-300 hover:bg-slate-700"
                  }`}
                >
                  Game
                </button>
                <button
                  onClick={() => setRoundViewMode("board")}
                  className={`px-2 py-1 border-l border-slate-600 ${
                    roundViewMode === "board"
                      ? "bg-emerald-700 text-white"
                      : "bg-slate-800 text-gray-300 hover:bg-slate-700"
                  }`}
                >
                  Board
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={playerFilter}
                onChange={(event) => setPlayerFilter(event.target.value)}
                placeholder="Filter by player"
                className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-xs text-gray-200 placeholder:text-gray-500 w-44"
              />
              {playerFilter.trim() && (
                <button
                  type="button"
                  onClick={() => setPlayerFilter("")}
                  className="px-2 py-1.5 rounded border border-slate-700 bg-slate-800 text-xs text-gray-300 hover:bg-slate-700"
                >
                  Clear
                </button>
              )}
              <p className="text-xs text-gray-400">
                Round progress {roundProgress} · Total finished{" "}
                {overallFinished}/{state.matches.length}
                {normalizedPlayerFilter
                  ? ` · Showing ${filteredRoundMatches.length}/${roundMatches.length}`
                  : ""}
              </p>
            </div>
          </div>

          {roundMatches.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              Waiting for pairings...
            </p>
          ) : filteredRoundMatches.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              No games match this player filter.
            </p>
          ) : roundViewMode === "board" ? (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Boards ({boardCards.length})
              </h3>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {boardCards.map(
                  ({
                    board,
                    matches,
                    selectedIndex,
                    selectedMatch,
                    standing,
                  }) => {
                    const white = entrantsById.get(
                      selectedMatch.whiteEntrantId,
                    ) as TournamentEntrant | undefined;
                    const black = entrantsById.get(
                      selectedMatch.blackEntrantId,
                    ) as TournamentEntrant | undefined;

                    return (
                      <div
                        key={`board-${board}`}
                        className="rounded-lg border border-slate-700 bg-slate-800/60 p-3"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-xs text-gray-300">Board {board}</p>
                          <div className="relative group/scorett">
                            <p className="text-xs text-gray-300 cursor-help px-1.5 py-0.5 rounded border border-slate-600/70 bg-slate-800/70 hover:bg-slate-700/70 transition-colors">
                              {standing.white.toFixed(1)} -{" "}
                              {standing.black.toFixed(1)}
                            </p>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2.5 py-1.5 bg-slate-700 border border-slate-600 text-xs text-gray-200 rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover/scorett:opacity-100 transition-opacity duration-150 shadow-lg z-50">
                              <div>White wins: {standing.whiteWins}</div>
                              <div>Black wins: {standing.blackWins}</div>
                              <div>Draws: {standing.draws}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateBoardGameIndex(board, -1)}
                              disabled={selectedIndex <= 0}
                              className="w-6 h-6 rounded border border-slate-600 bg-slate-800 text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Previous game on this board"
                              aria-label="Previous game on this board"
                            >
                              ←
                            </button>
                            <span className="text-[10px] text-gray-400 min-w-12 text-center">
                              {selectedMatch.seriesGameIndex}/{matches.length}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateBoardGameIndex(board, 1)}
                              disabled={selectedIndex >= matches.length - 1}
                              className="w-6 h-6 rounded border border-slate-600 bg-slate-800 text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Next game on this board"
                              aria-label="Next game on this board"
                            >
                              →
                            </button>
                          </div>
                        </div>

                        <div className="mb-3">
                          <TournamentMiniBoard
                            id={`board-${board}-${selectedMatch.id}`}
                            position={
                              selectedMatch.fenHistory[
                                selectedMatch.fenHistory.length - 1
                              ] ?? selectedMatch.fenHistory[0]
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-xs text-gray-400">
                            Game {selectedMatch.seriesGameIndex}
                          </p>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${statusBadgeClass(selectedMatch.status)}`}
                          >
                            {selectedMatch.status}
                          </span>
                        </div>

                        <p className="text-sm text-gray-100 truncate">
                          {white?.label ?? selectedMatch.whiteEntrantId}
                        </p>
                        <p className="text-xs text-gray-500 my-1">vs</p>
                        <p className="text-sm text-gray-100 truncate">
                          {black?.label ?? selectedMatch.blackEntrantId}
                        </p>

                        <div className="mt-3 text-xs text-gray-400 flex items-center justify-between">
                          <span>
                            Moves: {toFullMoveCount(selectedMatch.moves.length)}
                          </span>
                          <span>
                            Result:{" "}
                            {selectedMatch.status === "cancelled"
                              ? "cancelled"
                              : selectedMatch.result}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => onSelectMatch(selectedMatch.id)}
                          className="mt-3 w-full px-2.5 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs text-gray-100"
                        >
                          Open Game
                        </button>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {boardVisibleMatches.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
                    Live / Completed
                  </h3>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {boardVisibleMatches.map((match) => {
                      const white = entrantsById.get(match.whiteEntrantId) as
                        | TournamentEntrant
                        | undefined;
                      const black = entrantsById.get(match.blackEntrantId) as
                        | TournamentEntrant
                        | undefined;

                      return (
                        <button
                          key={match.id}
                          onClick={() => onSelectMatch(match.id)}
                          className="text-left p-3 rounded-lg border border-slate-700 bg-slate-800/60 hover:border-emerald-500/60 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-xs text-gray-400">
                              Board {match.board} · Game {match.seriesGameIndex}
                            </p>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border ${statusBadgeClass(match.status)}`}
                            >
                              {match.status}
                            </span>
                          </div>

                          <div className="mb-3">
                            <TournamentMiniBoard
                              id={`live-${match.id}`}
                              position={
                                match.fenHistory[match.fenHistory.length - 1] ??
                                match.fenHistory[0]
                              }
                            />
                          </div>

                          <p className="text-sm text-gray-100 truncate">
                            {white?.label ?? match.whiteEntrantId}
                          </p>
                          <p className="text-xs text-gray-500 my-1">vs</p>
                          <p className="text-sm text-gray-100 truncate">
                            {black?.label ?? match.blackEntrantId}
                          </p>

                          <div className="mt-3 text-xs text-gray-400 flex items-center justify-between">
                            <span>
                              Moves: {toFullMoveCount(match.moves.length)}
                            </span>
                            <span>
                              Result:{" "}
                              {match.status === "cancelled"
                                ? "cancelled"
                                : match.result}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {pendingMatches.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
                    Pending
                  </h3>
                  <div className="space-y-2">
                    {pendingMatches.map((match) => {
                      const white = entrantsById.get(match.whiteEntrantId) as
                        | TournamentEntrant
                        | undefined;
                      const black = entrantsById.get(match.blackEntrantId) as
                        | TournamentEntrant
                        | undefined;

                      return (
                        <button
                          key={match.id}
                          onClick={() => onSelectMatch(match.id)}
                          className="w-full text-left px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/40 hover:border-slate-500 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-gray-400">
                              Board {match.board} · Game {match.seriesGameIndex}
                            </p>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border ${statusBadgeClass(match.status)}`}
                            >
                              {match.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-200 mt-1 truncate">
                            {white?.label ?? match.whiteEntrantId} vs{" "}
                            {black?.label ?? match.blackEntrantId}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-4 min-w-0">
          <StandingsTable
            seriesStandings={state.standings}
            gameStandings={gameModeStandings}
            entrants={state.entrants}
          />
        </div>
      </div>

      <TournamentCrossTable
        seriesStandings={state.standings}
        gameStandings={gameModeStandings}
        matches={state.matches}
        series={state.series}
        entrants={state.entrants}
      />

      <div
        className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200 ${
          showResetConfirm
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className="absolute inset-0 bg-black/60"
          onClick={() => setShowResetConfirm(false)}
        />
        <div
          className={`relative bg-slate-800 border border-slate-600 rounded-xl p-6 max-w-sm mx-4 shadow-2xl transition-transform duration-200 ${
            showResetConfirm ? "scale-100" : "scale-95"
          }`}
        >
          <h3 className="text-lg font-semibold text-gray-100 mb-2">
            Start a new tournament?
          </h3>
          <p className="text-sm text-gray-400 mb-5">
            This will reset the current tournament view and return to setup. Are
            you sure?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowResetConfirm(false)}
              className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowResetConfirm(false);
                onReset();
              }}
              className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              New Tournament
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
