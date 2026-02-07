import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Lc0Engine } from "../engine/workerInterface";
import { moveToUCI, uciToChessJsMove } from "../utils/chess";
import {
  calculateStandings,
  buildColorBalance,
  buildOpponentsMap,
} from "../lib/tournament/standings";
import {
  generateRoundRobinPairings,
  generateSwissRoundPairings,
} from "../lib/tournament/pairings";
import { buildTournamentPgn } from "../lib/tournament/pgn";
import {
  getTournamentHistoryById,
  listTournamentHistory,
  saveTournamentHistory,
  type TournamentHistorySummary,
} from "../utils/tournamentHistory";
import type {
  EngineHealthCheck,
  MatchEvalSnapshot,
  StandingRow,
  TournamentEntrant,
  TournamentMatch,
  TournamentMatchHealthReport,
  TournamentPairing,
  TournamentRuntimeState,
  TournamentSeries,
  TournamentSetupConfig,
  TournamentTiebreakMode,
} from "../types/tournament";

const MAX_PLIES_PER_GAME = 300;
const DEFAULT_MAX_TIEBREAK_GAMES = 4;
const MIN_MAX_TIEBREAK_GAMES = 0;
const MAX_MAX_TIEBREAK_GAMES = 30;
const DEFAULT_TIEBREAK_WIN_BY = 1;
const MIN_TIEBREAK_WIN_BY = 1;
const MAX_TIEBREAK_WIN_BY = 5;
const MIN_SIMULTANEOUS_GAMES = 1;
const MAX_SIMULTANEOUS_GAMES = 8;
const ENGINE_CACHE_BUFFER = 2;
const MOVE_DELAY_DEFAULT_MS = 100;
const MOVE_DELAY_MIN_MS = 0;
const MOVE_DELAY_MAX_MS = 1000;
const MAX_GAME_DURATION_MS = 3 * 60 * 1000;
const ENGINE_HEALTH_CHECK_TIMEOUT_MS = 2000;
const MAX_MATCH_ERROR_RETRIES = 6;
const MATCH_RETRY_BASE_DELAY_MS = 1000;
const MATCH_RETRY_MAX_DELAY_MS = 30000;
const START_FEN = new Chess().fen();
const TOURNAMENT_STORAGE_KEY = "lc0-tournament-session-v1";

interface PersistedTournamentSession {
  state: TournamentRuntimeState;
  byeMatchPoints: Array<[string, number]>;
  byeGamePoints: Array<[string, number]>;
  byeRecipients: string[];
  historyRecordId: string | null;
  savedAt: string;
}

interface RunConfig {
  format: TournamentSetupConfig["format"];
  entrants: TournamentEntrant[];
  bestOf: number;
  maxSimultaneousGames: number;
  swissRounds: number;
  tiebreakMode: TournamentTiebreakMode;
  maxTiebreakGames: number;
  tiebreakWinBy: number;
  totalRounds: number;
}

interface LoadedPersistedTournament {
  state: TournamentRuntimeState;
  byeMatchPoints: Map<string, number>;
  byeGamePoints: Map<string, number>;
  byeRecipients: Set<string>;
  historyRecordId: string | null;
  autoResumePending: boolean;
}

interface MatchAbortToken {
  aborted: boolean;
  promise: Promise<"aborted">;
  abort: () => void;
}

function clampMoveDelayMs(value: number): number {
  if (!Number.isFinite(value)) return MOVE_DELAY_DEFAULT_MS;
  return Math.max(
    MOVE_DELAY_MIN_MS,
    Math.min(MOVE_DELAY_MAX_MS, Math.round(value)),
  );
}

function clampMaxTiebreakGames(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MAX_TIEBREAK_GAMES;
  return Math.max(
    MIN_MAX_TIEBREAK_GAMES,
    Math.min(MAX_MAX_TIEBREAK_GAMES, Math.round(value)),
  );
}

function clampTiebreakWinBy(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TIEBREAK_WIN_BY;
  return Math.max(
    MIN_TIEBREAK_WIN_BY,
    Math.min(MAX_TIEBREAK_WIN_BY, Math.round(value)),
  );
}

function clampMaxSimultaneousGames(value: number): number {
  if (!Number.isFinite(value)) return 2;
  return Math.max(
    MIN_SIMULTANEOUS_GAMES,
    Math.min(MAX_SIMULTANEOUS_GAMES, Math.round(value)),
  );
}

function parseModelSizeMb(size: string): number {
  const match = size.trim().match(/^([\d.]+)\s*(kb|mb|gb)?$/i);
  if (!match) return 0;
  const parsed = parseFloat(match[1]);
  if (!Number.isFinite(parsed)) return 0;

  const unit = (match[2] ?? "mb").toLowerCase();
  if (unit === "gb") return parsed * 1024;
  if (unit === "kb") return parsed / 1024;
  return parsed;
}

function getEntrantEstimatedRuntimeMb(entrant: TournamentEntrant): number {
  const explicit = entrant.network.estimatedRuntimeMb;
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  return parseModelSizeMb(entrant.network.size);
}

function computeMaxLoadedEnginesFromConcurrency(concurrency: number): number {
  return clampMaxSimultaneousGames(concurrency) * 2 + ENGINE_CACHE_BUFFER;
}

function normalizeTiebreakMode(value: unknown): TournamentTiebreakMode {
  return value === "win_by" ? "win_by" : "capped";
}

function createHistoryRecordId(): string {
  return `hist-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function makeInitialState(): TournamentRuntimeState {
  return {
    status: "idle",
    format: "round_robin",
    bestOf: 1,
    swissRounds: 5,
    maxSimultaneousGames: 2,
    tiebreakMode: "capped",
    maxTiebreakGames: DEFAULT_MAX_TIEBREAK_GAMES,
    tiebreakWinBy: DEFAULT_TIEBREAK_WIN_BY,
    moveDelayMs: MOVE_DELAY_DEFAULT_MS,
    currentRound: 0,
    totalRounds: 0,
    entrants: [],
    matches: [],
    series: [],
    standings: [],
    selectedMatchId: null,
    error: null,
  };
}

function recomputeStandingsForState(
  state: TournamentRuntimeState,
  byeMatchPoints?: Map<string, number>,
  byeGamePoints?: Map<string, number>,
): StandingRow[] {
  const matchesById = new Map(state.matches.map((match) => [match.id, match]));
  return calculateStandings({
    entrants: state.entrants,
    series: state.series,
    matchesById,
    byeMatchPoints,
    byeGamePoints,
  });
}

function sanitizeRestoredMatch(match: TournamentMatch): TournamentMatch {
  return {
    ...match,
    status: match.status === "running" ? "waiting" : match.status,
    fenHistory:
      Array.isArray(match.fenHistory) && match.fenHistory.length > 0
        ? match.fenHistory
        : [START_FEN],
    evalHistory: [],
    pgn: match.pgn ?? "",
  };
}

function sanitizeRestoredSeries(
  series: TournamentSeries,
  fallbackBestOf: number,
): TournamentSeries {
  return {
    ...series,
    plannedGames: Math.max(1, Math.floor(series.plannedGames ?? fallbackBestOf ?? 1)),
    status: series.status === "running" ? "waiting" : series.status,
    whiteScore: Number.isFinite(series.whiteScore) ? series.whiteScore : 0,
    blackScore: Number.isFinite(series.blackScore) ? series.blackScore : 0,
    winnerEntrantId: series.winnerEntrantId ?? null,
    gameIds: Array.isArray(series.gameIds) ? series.gameIds : [],
  };
}

function snapshotStateForStorage(
  state: TournamentRuntimeState,
): TournamentRuntimeState {
  return {
    ...state,
    matches: state.matches.map((match) => ({
      ...match,
      fenHistory: [match.fenHistory[match.fenHistory.length - 1] ?? START_FEN],
      evalHistory: [],
      pgn: "",
    })),
  };
}

function loadPersistedTournament(): LoadedPersistedTournament | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(TOURNAMENT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PersistedTournamentSession;
    if (!parsed || !parsed.state || !Array.isArray(parsed.state.entrants)) {
      return null;
    }

    const restoredState: TournamentRuntimeState = {
      ...parsed.state,
      status: parsed.state.status === "running" ? "paused" : parsed.state.status,
      moveDelayMs: clampMoveDelayMs(parsed.state.moveDelayMs),
      tiebreakMode: normalizeTiebreakMode(parsed.state.tiebreakMode),
      maxTiebreakGames: clampMaxTiebreakGames(parsed.state.maxTiebreakGames),
      tiebreakWinBy: clampTiebreakWinBy(parsed.state.tiebreakWinBy),
      matches: (parsed.state.matches ?? []).map(sanitizeRestoredMatch),
      series: (parsed.state.series ?? []).map((series) =>
        sanitizeRestoredSeries(series, parsed.state.bestOf),
      ),
      selectedMatchId: null,
      error:
        parsed.state.status === "running"
          ? "Reload detected. Click Resume Tournament to continue."
          : parsed.state.error,
    };
    const restoredByeMatchPoints = new Map(parsed.byeMatchPoints ?? []);
    const restoredByeGamePoints = new Map(parsed.byeGamePoints ?? []);
    restoredState.standings = recomputeStandingsForState(
      restoredState,
      restoredByeMatchPoints,
      restoredByeGamePoints,
    );

    if (restoredState.entrants.length === 0) return null;

    return {
      state: restoredState,
      byeMatchPoints: restoredByeMatchPoints,
      byeGamePoints: restoredByeGamePoints,
      byeRecipients: new Set(parsed.byeRecipients ?? []),
      historyRecordId:
        typeof parsed.historyRecordId === "string"
          ? parsed.historyRecordId
          : null,
      autoResumePending:
        parsed.state.status === "running" ||
        restoredState.error ===
          "Reload detected. Click Resume Tournament to continue.",
    };
  } catch {
    return null;
  }
}

function areStandingsEqual(a: StandingRow[], b: StandingRow[]): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (!left || !right) return false;
    if (
      left.entrantId !== right.entrantId ||
      left.label !== right.label ||
      left.matchPoints !== right.matchPoints ||
      left.gamePoints !== right.gamePoints ||
      left.wins !== right.wins ||
      left.draws !== right.draws ||
      left.losses !== right.losses ||
      left.playedSeries !== right.playedSeries ||
      left.buchholz !== right.buchholz
    ) {
      return false;
    }
  }

  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resolveWithin<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  if (timeoutMs <= 0) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      resolve(null);
    }, timeoutMs);

    promise
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
  });
}

function computeRetryDelayMs(retryCount: number): number {
  const exp = Math.max(0, retryCount - 1);
  const raw = MATCH_RETRY_BASE_DELAY_MS * 2 ** exp;
  return Math.min(raw, MATCH_RETRY_MAX_DELAY_MS);
}

function withMatchAbort<T>(
  promise: Promise<T>,
  abortToken: MatchAbortToken,
): Promise<T | "aborted"> {
  return Promise.race([promise, abortToken.promise]);
}

function createMatchAbortToken(): MatchAbortToken {
  let resolveAbort!: () => void;
  const promise = new Promise<"aborted">((resolve) => {
    resolveAbort = () => resolve("aborted");
  });

  const token: MatchAbortToken = {
    aborted: false,
    promise,
    abort: () => {
      if (token.aborted) return;
      token.aborted = true;
      resolveAbort();
    },
  };

  return token;
}

function getGameResult(
  game: Chess,
  forcedDraw: boolean,
): "1-0" | "0-1" | "1/2-1/2" {
  if (forcedDraw) return "1/2-1/2";
  if (!game.isGameOver()) return "1/2-1/2";
  if (game.isCheckmate()) {
    return game.turn() === "w" ? "0-1" : "1-0";
  }
  return "1/2-1/2";
}

function normalizeWdlToWhite(
  wdl: [number, number, number],
  fen: string,
): [number, number, number] {
  const sideToMove = fen.split(" ")[1];
  if (sideToMove === "w") return wdl;
  return [wdl[2], wdl[1], wdl[0]];
}

function getSeriesGameColors(
  series: Pick<TournamentSeries, "whiteEntrantId" | "blackEntrantId">,
  seriesGameIndex: number,
): { whiteEntrantId: string; blackEntrantId: string } {
  const swapColors = seriesGameIndex % 2 === 0;
  return {
    whiteEntrantId: swapColors ? series.blackEntrantId : series.whiteEntrantId,
    blackEntrantId: swapColors ? series.whiteEntrantId : series.blackEntrantId,
  };
}

function scoreMatchForSeries(
  series: TournamentSeries,
  match: TournamentMatch,
): { whiteDelta: number; blackDelta: number } {
  if (match.result === "1/2-1/2") {
    return { whiteDelta: 0.5, blackDelta: 0.5 };
  }

  const winnerEntrantId =
    match.result === "1-0" ? match.whiteEntrantId : match.blackEntrantId;

  if (winnerEntrantId === series.whiteEntrantId) {
    return { whiteDelta: 1, blackDelta: 0 };
  }

  return { whiteDelta: 0, blackDelta: 1 };
}

interface RoundBuildResult {
  series: TournamentSeries[];
  matches: TournamentMatch[];
  nextSeriesCounter: number;
}

function buildRoundEntities(
  round: number,
  pairings: TournamentPairing[],
  plannedGames: number,
  startingSeriesCounter: number,
): RoundBuildResult {
  const series: TournamentSeries[] = [];
  const matches: TournamentMatch[] = [];
  let counter = startingSeriesCounter;

  for (let boardIndex = 0; boardIndex < pairings.length; boardIndex++) {
    const pairing = pairings[boardIndex];
    counter += 1;
    const seriesId = `series-${round}-${counter}`;
    const gameIds: string[] = [];

    for (let gameIndex = 0; gameIndex < plannedGames; gameIndex++) {
      const seriesGameIndex = gameIndex + 1;
      const colors = getSeriesGameColors(pairing, seriesGameIndex);
      const matchId = `${seriesId}-g${seriesGameIndex}`;
      gameIds.push(matchId);

      matches.push({
        id: matchId,
        seriesId,
        seriesGameIndex,
        round,
        board: boardIndex + 1,
        whiteEntrantId: colors.whiteEntrantId,
        blackEntrantId: colors.blackEntrantId,
        status: "waiting",
        result: "*",
        moves: [],
        fenHistory: [START_FEN],
        evalHistory: [],
        pgn: "",
      });
    }

    series.push({
      id: seriesId,
      round,
      board: boardIndex + 1,
      whiteEntrantId: pairing.whiteEntrantId,
      blackEntrantId: pairing.blackEntrantId,
      plannedGames,
      status: "waiting",
      whiteScore: 0,
      blackScore: 0,
      winnerEntrantId: null,
      gameIds,
    });
  }

  return { series, matches, nextSeriesCounter: counter };
}

function deriveRunConfigFromSetup(config: TournamentSetupConfig): RunConfig {
  const totalRounds =
    config.format === "round_robin"
      ? generateRoundRobinPairings(config.entrants.map((entrant) => entrant.id))
          .length
      : config.swissRounds;

  return {
    format: config.format,
    entrants: config.entrants,
    bestOf: Math.max(1, Math.floor(config.bestOf)),
    maxSimultaneousGames: clampMaxSimultaneousGames(config.maxSimultaneousGames),
    swissRounds: config.swissRounds,
    tiebreakMode: normalizeTiebreakMode(config.tiebreakMode),
    maxTiebreakGames: clampMaxTiebreakGames(config.maxTiebreakGames),
    tiebreakWinBy: clampTiebreakWinBy(config.tiebreakWinBy),
    totalRounds,
  };
}

function deriveRunConfigFromState(state: TournamentRuntimeState): RunConfig | null {
  if (!state.entrants.length) return null;

  const totalRounds =
    state.totalRounds > 0
      ? state.totalRounds
      : state.format === "round_robin"
        ? generateRoundRobinPairings(state.entrants.map((entrant) => entrant.id)).length
        : state.swissRounds;

  return {
    format: state.format,
    entrants: state.entrants,
    bestOf: Math.max(1, Math.floor(state.bestOf)),
    maxSimultaneousGames: clampMaxSimultaneousGames(state.maxSimultaneousGames),
    swissRounds: Math.max(1, state.swissRounds),
    tiebreakMode: normalizeTiebreakMode(state.tiebreakMode),
    maxTiebreakGames: clampMaxTiebreakGames(state.maxTiebreakGames),
    tiebreakWinBy: clampTiebreakWinBy(state.tiebreakWinBy),
    totalRounds,
  };
}

function getNextSeriesCounter(series: TournamentSeries[]): number {
  let maxCounter = 0;
  for (const item of series) {
    const parts = item.id.split("-");
    const maybe = Number(parts[parts.length - 1]);
    if (Number.isFinite(maybe)) {
      maxCounter = Math.max(maxCounter, maybe);
    }
  }
  return maxCounter;
}

function hasRoundUnfinished(state: TournamentRuntimeState, round: number): boolean {
  return state.series.some((series) => series.round === round && series.status !== "finished");
}

function hasPlayableOrRetryableMatches(state: TournamentRuntimeState): boolean {
  return state.matches.some((match) => {
    if (match.status === "waiting" || match.status === "running") return true;
    if (match.status === "error") {
      return (match.retryCount ?? 0) < MAX_MATCH_ERROR_RETRIES;
    }
    return false;
  });
}

export function useTournamentRunner() {
  const persistedRef = useRef<LoadedPersistedTournament | null>(
    loadPersistedTournament(),
  );

  const [state, setState] = useState<TournamentRuntimeState>(() => {
    return persistedRef.current?.state ?? makeInitialState();
  });
  const [savedTournaments, setSavedTournaments] = useState<
    TournamentHistorySummary[]
  >([]);
  const [engineStats, setEngineStats] = useState<{
    loadedCount: number;
    estimatedMemoryMb: number;
    maxLoadedCount: number;
  }>(() => ({
    loadedCount: 0,
    estimatedMemoryMb: 0,
    maxLoadedCount: computeMaxLoadedEnginesFromConcurrency(
      persistedRef.current?.state.maxSimultaneousGames ?? 2,
    ),
  }));

  const byeMatchPointsRef = useRef<Map<string, number>>(
    persistedRef.current?.byeMatchPoints ?? new Map(),
  );
  const byeGamePointsRef = useRef<Map<string, number>>(
    persistedRef.current?.byeGamePoints ?? new Map(),
  );
  const byeRecipientsRef = useRef<Set<string>>(
    persistedRef.current?.byeRecipients ?? new Set(),
  );

  const stateRef = useRef(state);
  stateRef.current = state;
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);
  const persistTimerRef = useRef<number | null>(null);
  const engineMapRef = useRef(new Map<string, Lc0Engine>());
  const engineLastUsedAtRef = useRef(new Map<string, number>());
  const engineInitPromiseRef = useRef(new Map<string, Promise<Lc0Engine>>());
  const matchAbortMapRef = useRef(new Map<string, MatchAbortToken>());
  const historyRecordIdRef = useRef<string | null>(
    persistedRef.current?.historyRecordId ?? null,
  );
  const historyArchiveInFlightRef = useRef(false);

  const persistNow = useCallback((nextState: TournamentRuntimeState) => {
    if (typeof window === "undefined") return;

    if (nextState.status === "idle") {
      window.localStorage.removeItem(TOURNAMENT_STORAGE_KEY);
      return;
    }

    const payload: PersistedTournamentSession = {
      state: snapshotStateForStorage(nextState),
      byeMatchPoints: [...byeMatchPointsRef.current.entries()],
      byeGamePoints: [...byeGamePointsRef.current.entries()],
      byeRecipients: [...byeRecipientsRef.current.values()],
      historyRecordId: historyRecordIdRef.current,
      savedAt: new Date().toISOString(),
    };

    try {
      window.localStorage.setItem(TOURNAMENT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota failures; runtime remains functional.
    }
  }, []);

  const schedulePersist = useCallback(
    (nextState: TournamentRuntimeState) => {
      if (typeof window === "undefined") return;
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
      }
      persistTimerRef.current = window.setTimeout(() => {
        persistNow(nextState);
        persistTimerRef.current = null;
      }, 200);
    },
    [persistNow],
  );

  const setRuntime = useCallback(
    (updater: (prev: TournamentRuntimeState) => TournamentRuntimeState) => {
      if (!mountedRef.current) return;
      const current = stateRef.current;
      const next = updater(current);
      if (Object.is(next, current)) return;
      stateRef.current = next;
      setState(next);
      schedulePersist(next);
    },
    [schedulePersist],
  );

  const isRunActive = useCallback(
    (runId: number) => runIdRef.current === runId,
    [],
  );

  const refreshTournamentHistory = useCallback(async () => {
    try {
      const summaries = await listTournamentHistory(40);
      if (!mountedRef.current) return;
      setSavedTournaments(summaries);
    } catch {
      // Keep empty list on failure.
    }
  }, []);

  const updateEngineStats = useCallback(() => {
    if (!mountedRef.current) return;

    const current = stateRef.current;
    const entrantsById = new Map(
      current.entrants.map((entrant) => [entrant.id, entrant]),
    );
    const loadedIds = [...engineMapRef.current.keys()];
    const estimatedMemoryMb = loadedIds.reduce((sum, entrantId) => {
      const entrant = entrantsById.get(entrantId);
      if (!entrant) return sum;
      return sum + getEntrantEstimatedRuntimeMb(entrant);
    }, 0);

    setEngineStats({
      loadedCount: loadedIds.length,
      estimatedMemoryMb: Math.round(estimatedMemoryMb * 10) / 10,
      maxLoadedCount: computeMaxLoadedEnginesFromConcurrency(
        current.maxSimultaneousGames,
      ),
    });
  }, []);

  const selectEvictionCandidate = useCallback(
    (protectedEntrants: Set<string>): string | null => {
      const current = stateRef.current;
      const now = Date.now();
      const activeEntrants = new Set<string>();
      for (const match of current.matches) {
        if (match.status !== "running") continue;
        activeEntrants.add(match.whiteEntrantId);
        activeEntrants.add(match.blackEntrantId);
      }

      const candidates = [...engineMapRef.current.keys()].filter(
        (entrantId) =>
          !protectedEntrants.has(entrantId) &&
          !activeEntrants.has(entrantId) &&
          !engineInitPromiseRef.current.has(entrantId),
      );
      if (candidates.length === 0) return null;

      const upcomingMatches = current.matches
        .filter((match) => {
          if (match.status === "waiting") return true;
          if (match.status !== "error") return false;
          if ((match.retryCount ?? 0) >= MAX_MATCH_ERROR_RETRIES) return false;
          if (!match.nextRetryAt) return true;
          const retryAtMs = Date.parse(match.nextRetryAt);
          if (Number.isNaN(retryAtMs)) return true;
          return retryAtMs <= now;
        })
        .sort((a, b) => {
          if (a.round !== b.round) return a.round - b.round;
          if (a.board !== b.board) return a.board - b.board;
          if (a.seriesId !== b.seriesId) return a.seriesId.localeCompare(b.seriesId);
          return a.seriesGameIndex - b.seriesGameIndex;
        });

      let bestId: string | null = null;
      let bestDistance = -1;
      let bestLastUsed = Number.POSITIVE_INFINITY;

      for (const entrantId of candidates) {
        const nextUseIndex = upcomingMatches.findIndex(
          (match) =>
            match.whiteEntrantId === entrantId || match.blackEntrantId === entrantId,
        );
        const distance = nextUseIndex === -1 ? Number.POSITIVE_INFINITY : nextUseIndex;
        const lastUsedAt = engineLastUsedAtRef.current.get(entrantId) ?? 0;
        if (
          bestId === null ||
          distance > bestDistance ||
          (distance === bestDistance && lastUsedAt < bestLastUsed)
        ) {
          bestId = entrantId;
          bestDistance = distance;
          bestLastUsed = lastUsedAt;
        }
      }

      return bestId;
    },
    [],
  );

  const ensureEngineCapacity = useCallback(
    (protectedEntrants: Set<string>) => {
      const maxLoadedCount = computeMaxLoadedEnginesFromConcurrency(
        stateRef.current.maxSimultaneousGames,
      );
      let changed = false;

      while (engineMapRef.current.size >= maxLoadedCount) {
        const candidate = selectEvictionCandidate(protectedEntrants);
        if (!candidate) break;

        const engine = engineMapRef.current.get(candidate);
        if (!engine) break;

        engine.terminate();
        engineMapRef.current.delete(candidate);
        engineInitPromiseRef.current.delete(candidate);
        engineLastUsedAtRef.current.delete(candidate);
        changed = true;
      }

      if (changed) {
        updateEngineStats();
      }
    },
    [selectEvictionCandidate, updateEngineStats],
  );

  const terminateAllEngines = useCallback(() => {
    for (const token of matchAbortMapRef.current.values()) {
      token.abort();
    }
    matchAbortMapRef.current.clear();
    for (const engine of engineMapRef.current.values()) {
      engine.terminate();
    }
    engineMapRef.current.clear();
    engineLastUsedAtRef.current.clear();
    engineInitPromiseRef.current.clear();
    updateEngineStats();
  }, [updateEngineStats]);

  const invalidateEngineForEntrant = useCallback((entrantId: string) => {
    const engine = engineMapRef.current.get(entrantId);
    if (engine) {
      engine.terminate();
      engineMapRef.current.delete(entrantId);
    }
    engineLastUsedAtRef.current.delete(entrantId);
    engineInitPromiseRef.current.delete(entrantId);
    updateEngineStats();
  }, [updateEngineStats]);

  useEffect(() => {
    mountedRef.current = true;
    void refreshTournamentHistory();

    return () => {
      mountedRef.current = false;
      runIdRef.current += 1;
      if (persistTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      persistNow(stateRef.current);
      terminateAllEngines();
    };
  }, [persistNow, refreshTournamentHistory, terminateAllEngines]);

  const archiveTournamentSnapshot = useCallback(async () => {
    if (historyArchiveInFlightRef.current) return;

    const current = stateRef.current;
    if (current.status === "idle") return;
    if (current.entrants.length === 0) return;

    historyArchiveInFlightRef.current = true;
    try {
      const savedId = await saveTournamentHistory(current, {
        id: historyRecordIdRef.current ?? undefined,
      });
      historyRecordIdRef.current = savedId;
      await refreshTournamentHistory();
    } catch {
      // Ignore archival failures.
    } finally {
      historyArchiveInFlightRef.current = false;
    }
  }, [refreshTournamentHistory]);

  useEffect(() => {
    if (
      state.status !== "running" &&
      state.status !== "paused" &&
      state.status !== "error"
    ) {
      return;
    }
    if (typeof window === "undefined") return;

    void archiveTournamentSnapshot();
    const interval = window.setInterval(() => {
      void archiveTournamentSnapshot();
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [archiveTournamentSnapshot, state.status]);

  useEffect(() => {
    if (state.status !== "completed") return;
    void archiveTournamentSnapshot();
  }, [archiveTournamentSnapshot, state.status]);

  useEffect(() => {
    updateEngineStats();
  }, [state.entrants, state.maxSimultaneousGames, updateEngineStats]);

  const setStandingsFromCurrent = useCallback(
    (entrants: TournamentEntrant[]) => {
      const current = stateRef.current;
      const matchesById = new Map(current.matches.map((match) => [match.id, match]));
      const standings = calculateStandings({
        entrants,
        series: current.series,
        matchesById,
        byeMatchPoints: byeMatchPointsRef.current,
        byeGamePoints: byeGamePointsRef.current,
      });

      setRuntime((prev) =>
        areStandingsEqual(prev.standings, standings) ? prev : { ...prev, standings },
      );
      return standings;
    },
    [setRuntime],
  );

  const getOrInitEngine = useCallback(
    async (entrant: TournamentEntrant, protectedEntrantIds?: Set<string>) => {
      const existing = engineMapRef.current.get(entrant.id);
      if (existing) {
        engineLastUsedAtRef.current.set(entrant.id, Date.now());
        return existing;
      }

      const pending = engineInitPromiseRef.current.get(entrant.id);
      if (pending) return pending;

      const protectedEntrants = new Set(protectedEntrantIds ?? []);
      protectedEntrants.add(entrant.id);
      ensureEngineCapacity(protectedEntrants);

      const promise = new Promise<Lc0Engine>((resolve, reject) => {
        const engine = new Lc0Engine();
        const unsub = engine.subscribe((partial) => {
          if (partial.error) {
            unsub();
            engine.terminate();
            reject(new Error(partial.error));
            return;
          }

          if (partial.isReady) {
            unsub();
            resolve(engine);
          }
        });

        engine.init(`/models/${entrant.network.file}`);
      })
        .then((engine) => {
          engineMapRef.current.set(entrant.id, engine);
          engineLastUsedAtRef.current.set(entrant.id, Date.now());
          engineInitPromiseRef.current.delete(entrant.id);
          updateEngineStats();
          return engine;
        })
        .catch((error) => {
          engineInitPromiseRef.current.delete(entrant.id);
          updateEngineStats();
          throw error;
        });

      engineInitPromiseRef.current.set(entrant.id, promise);
      return promise;
    },
    [ensureEngineCapacity, updateEngineStats],
  );

  const evaluateSnapshot = useCallback(
    async (
      whiteEngine: Lc0Engine,
      blackEngine: Lc0Engine,
      fenHistory: string[],
    ): Promise<MatchEvalSnapshot> => {
      const fen = fenHistory[fenHistory.length - 1];
      const history = [...fenHistory];
      const [whiteRawWdl, blackRawWdl] = await Promise.all([
        whiteEngine.evaluatePosition(fen, history),
        blackEngine.evaluatePosition(fen, history),
      ]);

      return {
        ply: fenHistory.length - 2,
        fen,
        whiteEngineWdl: normalizeWdlToWhite(whiteRawWdl, fen),
        blackEngineWdl: normalizeWdlToWhite(blackRawWdl, fen),
        status: "ready",
      };
    },
    [],
  );

  const checkMatchEngineHealth = useCallback(
    async (matchId: string): Promise<TournamentMatchHealthReport> => {
      const current = stateRef.current;
      const match = current.matches.find((item) => item.id === matchId);
      if (!match) {
        throw new Error("Match not found.");
      }

      const whiteEntrant = current.entrants.find(
        (entrant) => entrant.id === match.whiteEntrantId,
      );
      const blackEntrant = current.entrants.find(
        (entrant) => entrant.id === match.blackEntrantId,
      );

      if (!whiteEntrant || !blackEntrant) {
        throw new Error("Entrants for this match are unavailable.");
      }

      if (match.status !== "running") {
        const reason = `Game status is ${match.status}.`;
        return {
          matchId,
          checkedAt: new Date().toISOString(),
          overall: "idle",
          white: {
            status: "idle",
            message: reason,
            latencyMs: null,
          },
          black: {
            status: "idle",
            message: reason,
            latencyMs: null,
          },
        };
      }

      const fen =
        match.fenHistory[match.fenHistory.length - 1] ??
        match.fenHistory[0] ??
        START_FEN;
      const history =
        Array.isArray(match.fenHistory) && match.fenHistory.length > 0
          ? [...match.fenHistory]
          : [START_FEN];

      const probeEntrant = async (entrant: TournamentEntrant): Promise<EngineHealthCheck> => {
        const startedAt = Date.now();

        try {
          const engine = await getOrInitEngine(entrant);
          const probe = await resolveWithin(
            engine.evaluatePosition(fen, history),
            ENGINE_HEALTH_CHECK_TIMEOUT_MS,
          );
          if (probe === null) {
            return {
              status: "busy",
              message: "No response within 2s (engine may be busy or stalled).",
              latencyMs: null,
            };
          }

          return {
            status: "ok",
            message: "Responsive.",
            latencyMs: Date.now() - startedAt,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (
            message.includes("pending evaluation request") ||
            message.includes("pending move request")
          ) {
            return {
              status: "busy",
              message: "Engine is processing another request.",
              latencyMs: null,
            };
          }

          return {
            status: "error",
            message,
            latencyMs: null,
          };
        }
      };

      const [white, black] = await Promise.all([
        probeEntrant(whiteEntrant),
        probeEntrant(blackEntrant),
      ]);

      const overall =
        white.status === "ok" && black.status === "ok" ? "healthy" : "degraded";

      return {
        matchId,
        checkedAt: new Date().toISOString(),
        overall,
        white,
        black,
      };
    },
    [getOrInitEngine],
  );

  const reconcileSeriesInState = useCallback(
    (prev: TournamentRuntimeState, seriesId: string): TournamentRuntimeState => {
      const series = prev.series.find((item) => item.id === seriesId);
      if (!series) return prev;

      const seriesMatches = prev.matches
        .filter((item) => item.seriesId === series.id)
        .sort((a, b) => a.seriesGameIndex - b.seriesGameIndex);

      let whiteScore = 0;
      let blackScore = 0;

      for (const match of seriesMatches) {
        if (match.status !== "finished" || match.result === "*") continue;
        const delta = scoreMatchForSeries(series, match);
        whiteScore += delta.whiteDelta;
        blackScore += delta.blackDelta;
      }

      const plannedFinished = seriesMatches.filter(
        (match) =>
          match.seriesGameIndex <= series.plannedGames &&
          match.status === "finished" &&
          match.result !== "*",
      ).length;

      const pendingAny = seriesMatches.some(
        (match) => match.status === "waiting" || match.status === "running",
      );

      const pendingTieBreak = seriesMatches.some(
        (match) =>
          match.seriesGameIndex > series.plannedGames &&
          (match.status === "waiting" || match.status === "running"),
      );

      const tieBreakFinished = seriesMatches.filter(
        (match) =>
          match.seriesGameIndex > series.plannedGames &&
          match.status === "finished" &&
          match.result !== "*",
      ).length;
      const maxTiebreakGames = clampMaxTiebreakGames(prev.maxTiebreakGames);
      const tiebreakWinBy = clampTiebreakWinBy(prev.tiebreakWinBy);
      const tiebreakMode = normalizeTiebreakMode(prev.tiebreakMode);

      let nextMatches = prev.matches;
      let nextSeries: TournamentSeries = {
        ...series,
        whiteScore,
        blackScore,
      };
      let resolvedWinner: string | null | undefined;
      const enqueueNextTiebreakGame = () => {
        const nextSeriesGameIndex =
          Math.max(...seriesMatches.map((item) => item.seriesGameIndex), 0) + 1;
        const colors = getSeriesGameColors(series, nextSeriesGameIndex);
        const newMatchId = `${series.id}-g${nextSeriesGameIndex}`;

        const newMatch: TournamentMatch = {
          id: newMatchId,
          seriesId: series.id,
          seriesGameIndex: nextSeriesGameIndex,
          round: series.round,
          board: series.board,
          whiteEntrantId: colors.whiteEntrantId,
          blackEntrantId: colors.blackEntrantId,
          status: "waiting",
          result: "*",
          moves: [],
          fenHistory: [START_FEN],
          evalHistory: [],
          pgn: "",
        };

        nextMatches = [...prev.matches, newMatch];
        nextSeries = {
          ...nextSeries,
          gameIds: [...nextSeries.gameIds, newMatchId],
        };
      };

      if (plannedFinished < series.plannedGames) {
        const remainingPlanned = series.plannedGames - plannedFinished;

        if (whiteScore > blackScore + remainingPlanned) {
          resolvedWinner = series.whiteEntrantId;
        } else if (blackScore > whiteScore + remainingPlanned) {
          resolvedWinner = series.blackEntrantId;
        }

        if (resolvedWinner !== undefined) {
          const endedAt = new Date().toISOString();
          nextMatches = prev.matches.map((item) => {
            if (
              item.seriesId === series.id &&
              item.seriesGameIndex <= series.plannedGames &&
              item.status === "waiting"
            ) {
              return {
                ...item,
                status: "cancelled",
                endedAt,
              };
            }
            return item;
          });
        }
      } else {
        const scoreDiff = Math.abs(whiteScore - blackScore);
        const hasLeader = scoreDiff > 0;
        const leadingEntrantId =
          whiteScore > blackScore
            ? series.whiteEntrantId
            : whiteScore < blackScore
              ? series.blackEntrantId
              : null;

        if (!hasLeader) {
          if (!pendingTieBreak) {
            if (maxTiebreakGames <= 0 || tieBreakFinished >= maxTiebreakGames) {
              resolvedWinner = null;
            } else {
              enqueueNextTiebreakGame();
            }
          }
        } else {
          const requiresLeadMargin =
            tiebreakMode === "win_by" && tieBreakFinished > 0;
          const leadSatisfied = !requiresLeadMargin || scoreDiff >= tiebreakWinBy;

          if (leadSatisfied) {
            if (!pendingAny && leadingEntrantId) {
              resolvedWinner = leadingEntrantId;
            }
          } else if (!pendingTieBreak) {
            if (maxTiebreakGames <= 0 || tieBreakFinished >= maxTiebreakGames) {
              resolvedWinner = null;
            } else {
              enqueueNextTiebreakGame();
            }
          }
        }
      }

      if (resolvedWinner !== undefined) {
        const endedAt = new Date().toISOString();
        nextMatches = nextMatches.map((item) => {
          if (item.seriesId === series.id && item.status === "waiting") {
            return {
              ...item,
              status: "cancelled",
              endedAt,
            };
          }
          return item;
        });

        nextSeries = {
          ...nextSeries,
          status: "finished",
          winnerEntrantId: resolvedWinner,
        };
      } else {
        const hasRunning = nextMatches.some(
          (item) => item.seriesId === series.id && item.status === "running",
        );

        nextSeries = {
          ...nextSeries,
          status: hasRunning ? "running" : "waiting",
          winnerEntrantId: null,
        };
      }

      return {
        ...prev,
        matches: nextMatches,
        series: prev.series.map((item) =>
          item.id === series.id ? nextSeries : item,
        ),
      };
    },
    [],
  );

  const reconcileSeriesFromMatch = useCallback(
    (matchId: string) => {
      setRuntime((prev) => {
        const match = prev.matches.find((item) => item.id === matchId);
        if (!match) return prev;
        return reconcileSeriesInState(prev, match.seriesId);
      });
    },
    [reconcileSeriesInState, setRuntime],
  );

  const reconcileRoundSeries = useCallback(
    (round: number) => {
      setRuntime((prev) => {
        const roundSeriesIds = prev.series
          .filter((series) => series.round === round)
          .map((series) => series.id);

        let next = prev;
        for (const seriesId of roundSeriesIds) {
          next = reconcileSeriesInState(next, seriesId);
        }
        return next;
      });
    },
    [reconcileSeriesInState, setRuntime],
  );

  const runMatch = useCallback(
    async (
      runId: number,
      matchId: string,
      entrantsById: Map<string, TournamentEntrant>,
    ) => {
      const match = stateRef.current.matches.find((item) => item.id === matchId);
      if (!match) return;
      if (match.status !== "waiting" && match.status !== "error") return;

      const abortToken = createMatchAbortToken();
      matchAbortMapRef.current.set(matchId, abortToken);

      try {
        const whiteEntrant = entrantsById.get(match.whiteEntrantId);
        const blackEntrant = entrantsById.get(match.blackEntrantId);
        if (!whiteEntrant || !blackEntrant) return;

        const enginesResult = await withMatchAbort(
          (async () => {
            const protectedEntrants = new Set([
              whiteEntrant.id,
              blackEntrant.id,
            ]);
            const whiteEngine = await getOrInitEngine(
              whiteEntrant,
              protectedEntrants,
            );
            const blackEngine = await getOrInitEngine(
              blackEntrant,
              protectedEntrants,
            );
            return [whiteEngine, blackEngine] as const;
          })(),
          abortToken,
        );
        if (enginesResult === "aborted") return;
        if (!isRunActive(runId)) return;
        const [whiteEngine, blackEngine] = enginesResult;

        const startedAt = new Date().toISOString();
        setRuntime((prev) => ({
          ...prev,
          matches: prev.matches.map((item) =>
            item.id === matchId
              ? {
                  ...item,
                  status: "running",
                  startedAt: item.startedAt ?? startedAt,
                  endedAt: undefined,
                  error: undefined,
                  nextRetryAt: undefined,
                }
              : item,
          ),
        }));

        const baseFenHistory =
          Array.isArray(match.fenHistory) && match.fenHistory.length > 0
            ? [...match.fenHistory]
            : [START_FEN];
        const resumeFen = baseFenHistory[baseFenHistory.length - 1] ?? START_FEN;
        const game = new Chess();
        try {
          game.load(resumeFen);
        } catch {
          game.reset();
        }
        const moves: string[] = Array.isArray(match.moves) ? [...match.moves] : [];
        const fenHistory =
          baseFenHistory[baseFenHistory.length - 1] === game.fen()
            ? baseFenHistory
            : [game.fen()];
        const evalHistory: MatchEvalSnapshot[] = Array.isArray(match.evalHistory)
          ? [...match.evalHistory]
          : [];
        const gameDeadlineMs = Date.now() + MAX_GAME_DURATION_MS;
        let forcedDraw = false;
        let timedOut = false;

        const remainingMs = () => gameDeadlineMs - Date.now();
        const hasTimedOut = () => remainingMs() <= 0;
        const adjudicateTimeoutDraw = () => {
          forcedDraw = true;
          timedOut = true;
          invalidateEngineForEntrant(whiteEntrant.id);
          invalidateEngineForEntrant(blackEntrant.id);
        };

        try {
          if (!isRunActive(runId) || abortToken.aborted) return;

          const needsOpeningEval =
            evalHistory.length === 0 ||
            evalHistory[evalHistory.length - 1]?.fen !==
              (fenHistory[fenHistory.length - 1] ?? START_FEN);

          if (hasTimedOut()) {
            adjudicateTimeoutDraw();
          } else if (needsOpeningEval) {
            const openingEval = await withMatchAbort(
              resolveWithin(
                evaluateSnapshot(whiteEngine, blackEngine, fenHistory),
                remainingMs(),
              ),
              abortToken,
            );
            if (openingEval === "aborted") return;
            if (openingEval === null) {
              adjudicateTimeoutDraw();
            } else {
              evalHistory.push(openingEval);
            }
          }

          setRuntime((prev) => ({
            ...prev,
            matches: prev.matches.map((item) =>
              item.id === matchId
                ? {
                    ...item,
                    fenHistory: [...fenHistory],
                    evalHistory: [...evalHistory],
                  }
                : item,
            ),
          }));

          let plies = 0;

          while (!game.isGameOver() && !forcedDraw) {
            if (!isRunActive(runId) || abortToken.aborted) return;
            if (hasTimedOut()) {
              adjudicateTimeoutDraw();
              break;
            }
            if (plies >= MAX_PLIES_PER_GAME) {
              forcedDraw = true;
              break;
            }

            const toMoveEntrant = game.turn() === "w" ? whiteEntrant : blackEntrant;
            const engine = game.turn() === "w" ? whiteEngine : blackEngine;
            const legalMoves = game.moves({ verbose: true }).map(moveToUCI);

            if (legalMoves.length === 0) break;

            const best = await withMatchAbort(
              resolveWithin(
                engine.getBestMove(
                  game.fen(),
                  fenHistory,
                  legalMoves,
                  toMoveEntrant.temperature,
                ),
                remainingMs(),
              ),
              abortToken,
            );
            if (best === "aborted") return;
            if (best === null) {
              adjudicateTimeoutDraw();
              break;
            }

            const move = game.move(uciToChessJsMove(best.move));
            if (!move) {
              throw new Error(`Illegal engine move: ${best.move}`);
            }

            moves.push(move.san);
            fenHistory.push(game.fen());
            const snapshot = await withMatchAbort(
              resolveWithin(
                evaluateSnapshot(whiteEngine, blackEngine, fenHistory),
                remainingMs(),
              ),
              abortToken,
            );
            if (snapshot === "aborted") return;
            if (snapshot === null) {
              adjudicateTimeoutDraw();
              break;
            }
            evalHistory.push(snapshot);
            plies += 1;

            setRuntime((prev) => ({
              ...prev,
              matches: prev.matches.map((item) =>
                item.id === matchId
                  ? {
                      ...item,
                      moves: [...moves],
                      fenHistory: [...fenHistory],
                      evalHistory: [...evalHistory],
                      pgn: buildTournamentPgn({
                        eventName: "Play Lc0 Tournament",
                        white: whiteEntrant.label,
                        black: blackEntrant.label,
                        round: match.round,
                        board: match.board,
                        result: "*",
                        moves,
                      }),
                    }
                  : item,
              ),
            }));

            const moveDelayMs = clampMoveDelayMs(stateRef.current.moveDelayMs);
            if (!game.isGameOver() && moveDelayMs > 0) {
              const delayMs = Math.min(moveDelayMs, Math.max(0, remainingMs()));
              if (delayMs <= 0) {
                adjudicateTimeoutDraw();
                break;
              }
              const delayResult = await withMatchAbort(sleep(delayMs), abortToken);
              if (delayResult === "aborted") return;
              if (!isRunActive(runId)) return;
              if (hasTimedOut()) {
                adjudicateTimeoutDraw();
                break;
              }
            }
          }

          if (!isRunActive(runId) || abortToken.aborted) return;

          const result = getGameResult(game, forcedDraw);
          const endedAt = new Date().toISOString();

          setRuntime((prev) => ({
            ...prev,
            matches: prev.matches.map((item) =>
              item.id === matchId
                ? {
                    ...item,
                    status: "finished",
                    result,
                    moves: [...moves],
                    fenHistory: [...fenHistory],
                    evalHistory: [...evalHistory],
                    pgn: buildTournamentPgn({
                      eventName: "Play Lc0 Tournament",
                      white: whiteEntrant.label,
                      black: blackEntrant.label,
                      round: item.round,
                      board: item.board,
                      result,
                      moves,
                    }),
                    endedAt,
                    error: timedOut
                      ? "Exceeded 3:00 game limit. Adjudicated as draw."
                      : undefined,
                    retryCount: item.retryCount,
                    nextRetryAt: undefined,
                  }
                : item,
            ),
          }));
        } catch (error) {
          if (!isRunActive(runId)) return;
          if (abortToken.aborted) return;

          invalidateEngineForEntrant(whiteEntrant.id);
          invalidateEngineForEntrant(blackEntrant.id);

          const endedAt = new Date().toISOString();
          setRuntime((prev) => ({
            ...prev,
            matches: prev.matches.map((item) =>
              item.id !== matchId
                ? item
                : (() => {
                    const nextRetryCount = (item.retryCount ?? 0) + 1;
                    const baseError =
                      error instanceof Error ? error.message : String(error);

                    if (nextRetryCount > MAX_MATCH_ERROR_RETRIES) {
                      const result = "1/2-1/2";
                      return {
                        ...item,
                        status: "finished",
                        result,
                        error: `Engine failed after ${MAX_MATCH_ERROR_RETRIES} retries. Adjudicated draw. Last error: ${baseError}`,
                        pgn: buildTournamentPgn({
                          eventName: "Play Lc0 Tournament",
                          white: whiteEntrant.label,
                          black: blackEntrant.label,
                          round: item.round,
                          board: item.board,
                          result,
                          moves,
                        }),
                        endedAt,
                        retryCount: nextRetryCount,
                        nextRetryAt: undefined,
                      };
                    }

                    const retryDelayMs = computeRetryDelayMs(nextRetryCount);
                    const nextRetryAt = new Date(
                      Date.now() + retryDelayMs,
                    ).toISOString();

                    return {
                      ...item,
                      status: "error",
                      error: `Engine error: ${baseError}. Retrying in ${Math.ceil(
                        retryDelayMs / 1000,
                      )}s.`,
                      endedAt: undefined,
                      retryCount: nextRetryCount,
                      nextRetryAt,
                    };
                  })(),
            ),
          }));
        }
      } finally {
        const currentToken = matchAbortMapRef.current.get(matchId);
        if (currentToken === abortToken) {
          matchAbortMapRef.current.delete(matchId);
        }
      }
    },
    [
      evaluateSnapshot,
      getOrInitEngine,
      invalidateEngineForEntrant,
      isRunActive,
      setRuntime,
    ],
  );

  const runRound = useCallback(
    async (
      runId: number,
      round: number,
      entrantsById: Map<string, TournamentEntrant>,
      onMatchFinished: (matchId: string) => void,
    ) => {
      const running = new Map<string, Promise<void>>();
      const activeEntrants = new Set<string>();
      const isEntrantBusy = (entrantId: string) =>
        activeEntrants.has(entrantId) ||
        stateRef.current.matches.some(
          (item) =>
            item.round === round &&
            item.status === "running" &&
            (item.whiteEntrantId === entrantId || item.blackEntrantId === entrantId),
        );
      const isRetryReady = (match: TournamentMatch) => {
        if (match.status !== "error") return false;
        const retryCount = match.retryCount ?? 0;
        if (retryCount >= MAX_MATCH_ERROR_RETRIES) return false;
        if (!match.nextRetryAt) return true;
        const at = Date.parse(match.nextRetryAt);
        if (Number.isNaN(at)) return true;
        return at <= Date.now();
      };

      const availableMatches = () =>
        stateRef.current.matches
          .filter(
            (match) =>
              match.round === round &&
              (match.status === "waiting" || isRetryReady(match)),
          )
          .sort((a, b) => {
            if (a.status !== b.status) {
              return a.status === "waiting" ? -1 : 1;
            }
            if (a.board !== b.board) return a.board - b.board;
            if (a.seriesId !== b.seriesId) return a.seriesId.localeCompare(b.seriesId);
            return a.seriesGameIndex - b.seriesGameIndex;
          });
      const nextRetryDelayMs = () => {
        const retryAtTimes = stateRef.current.matches
          .filter(
            (match) =>
              match.round === round &&
              match.status === "error" &&
              (match.retryCount ?? 0) < MAX_MATCH_ERROR_RETRIES &&
              !!match.nextRetryAt,
          )
          .map((match) => Date.parse(match.nextRetryAt as string))
          .filter((time) => Number.isFinite(time) && time > Date.now());

        if (retryAtTimes.length === 0) return null;
        return Math.min(...retryAtTimes) - Date.now();
      };

      while (isRunActive(runId)) {
        const maxSimultaneousGames = clampMaxSimultaneousGames(
          stateRef.current.maxSimultaneousGames,
        );
        while (running.size < maxSimultaneousGames && isRunActive(runId)) {
          const waiting = availableMatches();
          if (waiting.length === 0) break;

          const next =
            waiting.find(
              (match) =>
                !isEntrantBusy(match.whiteEntrantId) &&
                !isEntrantBusy(match.blackEntrantId),
            ) ?? waiting[0];

          if (isEntrantBusy(next.whiteEntrantId) || isEntrantBusy(next.blackEntrantId)) {
            break;
          }

          activeEntrants.add(next.whiteEntrantId);
          activeEntrants.add(next.blackEntrantId);

          const promise = runMatch(runId, next.id, entrantsById)
            .then(() => {
              onMatchFinished(next.id);
            })
            .catch((error) => {
              onMatchFinished(next.id);
              throw error;
            })
            .finally(() => {
              activeEntrants.delete(next.whiteEntrantId);
              activeEntrants.delete(next.blackEntrantId);
              running.delete(next.id);
            });

          running.set(next.id, promise);
        }

        if (running.size === 0) {
          if (availableMatches().length === 0) {
            const retryDelay = nextRetryDelayMs();
            if (retryDelay !== null) {
              await sleep(Math.min(1000, Math.max(50, retryDelay)));
              continue;
            }
            break;
          }

          const forced = availableMatches()[0];
          activeEntrants.add(forced.whiteEntrantId);
          activeEntrants.add(forced.blackEntrantId);

          const promise = runMatch(runId, forced.id, entrantsById)
            .then(() => {
              onMatchFinished(forced.id);
            })
            .catch((error) => {
              onMatchFinished(forced.id);
              throw error;
            })
            .finally(() => {
              activeEntrants.delete(forced.whiteEntrantId);
              activeEntrants.delete(forced.blackEntrantId);
              running.delete(forced.id);
            });

          running.set(forced.id, promise);
        }

        await Promise.race(running.values());
      }

      const settled = await Promise.allSettled(running.values());
      const rejected = settled.find((item) => item.status === "rejected");
      if (rejected && rejected.status === "rejected") {
        throw rejected.reason;
      }
    },
    [isRunActive, runMatch],
  );

  const executeTournament = useCallback(
    async (runId: number, config: RunConfig) => {
      const entrantsById = new Map(
        config.entrants.map((entrant) => [entrant.id, entrant]),
      );

      if (!isRunActive(runId)) return;

      const roundRobinPairings =
        config.format === "round_robin"
          ? generateRoundRobinPairings(config.entrants.map((entrant) => entrant.id))
          : [];

      let seriesCounter = getNextSeriesCounter(stateRef.current.series);
      let standings = setStandingsFromCurrent(config.entrants);

      for (let round = 1; round <= config.totalRounds; round++) {
        if (!isRunActive(runId)) return;

        setRuntime((prev) => ({
          ...prev,
          currentRound: round,
          totalRounds: config.totalRounds,
        }));

        const hasRoundSeries = stateRef.current.series.some(
          (series) => series.round === round,
        );

        if (!hasRoundSeries) {
          let pairings: TournamentPairing[] = [];
          let byeEntrantId: string | undefined;

          if (config.format === "round_robin") {
            pairings = roundRobinPairings[round - 1] ?? [];
          } else {
            const currentMatchesById = new Map(
              stateRef.current.matches.map((match) => [match.id, match]),
            );
            const previousOpponents = buildOpponentsMap(
              stateRef.current.series,
              currentMatchesById,
            );
            const colorBalance = buildColorBalance(stateRef.current.matches);

            const swissPairings = generateSwissRoundPairings({
              entrantIds: config.entrants.map((entrant) => entrant.id),
              standings,
              previousOpponents,
              byeRecipients: byeRecipientsRef.current,
              colorBalance,
            });

            pairings = swissPairings.pairings;
            byeEntrantId = swissPairings.byeEntrantId;
          }

          if (byeEntrantId) {
            byeRecipientsRef.current.add(byeEntrantId);
            byeMatchPointsRef.current.set(
              byeEntrantId,
              (byeMatchPointsRef.current.get(byeEntrantId) ?? 0) + 1,
            );
            byeGamePointsRef.current.set(
              byeEntrantId,
              (byeGamePointsRef.current.get(byeEntrantId) ?? 0) + 1,
            );
          }

          const built = buildRoundEntities(
            round,
            pairings,
            config.bestOf,
            seriesCounter,
          );
          seriesCounter = built.nextSeriesCounter;

          setRuntime((prev) => ({
            ...prev,
            matches: [...prev.matches, ...built.matches],
            series: [...prev.series, ...built.series],
          }));
        }

        reconcileRoundSeries(round);
        standings = setStandingsFromCurrent(config.entrants);

        while (hasRoundUnfinished(stateRef.current, round)) {
          if (!isRunActive(runId)) return;

          await runRound(
            runId,
            round,
            entrantsById,
            (finishedMatchId) => {
              reconcileSeriesFromMatch(finishedMatchId);
              setStandingsFromCurrent(config.entrants);
            },
          );

          if (!isRunActive(runId)) return;

          reconcileRoundSeries(round);
          standings = setStandingsFromCurrent(config.entrants);

          const hasPlayable = stateRef.current.matches.some(
            (match) =>
              match.round === round &&
              (match.status === "waiting" || match.status === "running"),
          );

          if (!hasPlayable && hasRoundUnfinished(stateRef.current, round)) {
            throw new Error(
              `Round ${round} cannot continue due unresolved series state.`,
            );
          }
        }
      }

      if (!isRunActive(runId)) return;
      setStandingsFromCurrent(config.entrants);

      setRuntime((prev) => ({
        ...prev,
        status: "completed",
        currentRound: config.totalRounds,
        error: null,
      }));
    },
    [
      isRunActive,
      reconcileRoundSeries,
      reconcileSeriesFromMatch,
      runRound,
      setRuntime,
      setStandingsFromCurrent,
    ],
  );

  const startTournament = useCallback(
    async (config: TournamentSetupConfig) => {
      runIdRef.current += 1;
      const runId = runIdRef.current;
      terminateAllEngines();
      historyRecordIdRef.current = createHistoryRecordId();

      byeMatchPointsRef.current = new Map();
      byeGamePointsRef.current = new Map();
      byeRecipientsRef.current = new Set();

      const runConfig = deriveRunConfigFromSetup(config);

      setRuntime(() => ({
        status: "running",
        format: runConfig.format,
        bestOf: runConfig.bestOf,
        swissRounds: runConfig.swissRounds,
        maxSimultaneousGames: runConfig.maxSimultaneousGames,
        tiebreakMode: runConfig.tiebreakMode,
        maxTiebreakGames: runConfig.maxTiebreakGames,
        tiebreakWinBy: runConfig.tiebreakWinBy,
        moveDelayMs: MOVE_DELAY_DEFAULT_MS,
        currentRound: 0,
        totalRounds: runConfig.totalRounds,
        entrants: runConfig.entrants,
        matches: [],
        series: [],
        standings: [],
        selectedMatchId: null,
        error: null,
      }));

      try {
        await executeTournament(runId, runConfig);
      } catch (error) {
        if (!isRunActive(runId)) return;
        setRuntime((prev) => ({
          ...prev,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    },
    [executeTournament, isRunActive, setRuntime, terminateAllEngines],
  );

  const resumeTournament = useCallback(async () => {
    const current = stateRef.current;
    if (
      current.status !== "paused" &&
      current.status !== "error" &&
      current.status !== "running"
    ) {
      return;
    }
    if (current.status === "running" && hasPlayableOrRetryableMatches(current)) return;

    const runConfig = deriveRunConfigFromState(current);
    if (!runConfig) return;

    runIdRef.current += 1;
    const runId = runIdRef.current;

    setRuntime((prev) => ({
      ...prev,
      status: "running",
      error: null,
    }));

    try {
      await executeTournament(runId, runConfig);
    } catch (error) {
      if (!isRunActive(runId)) return;
      setRuntime((prev) => ({
        ...prev,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }, [executeTournament, isRunActive, setRuntime]);

  const pauseTournament = useCallback(() => {
    if (stateRef.current.status !== "running") return;
    runIdRef.current += 1;
    setRuntime((prev) => ({
      ...prev,
      status: "paused",
      error: "Tournament paused.",
      matches: prev.matches.map((match) =>
        match.status === "running" ? { ...match, status: "waiting" } : match,
      ),
      series: prev.series.map((series) =>
        series.status === "running" ? { ...series, status: "waiting" } : series,
      ),
    }));
  }, [setRuntime]);

  const restartMatch = useCallback(
    async (matchId: string): Promise<boolean> => {
      const current = stateRef.current;
      if (current.status !== "running") return false;

      const match = current.matches.find((item) => item.id === matchId);
      if (!match) return false;
      if (match.status !== "waiting" && match.status !== "error") return false;

      const entrantsById = new Map(
        current.entrants.map((entrant) => [entrant.id, entrant]),
      );

      const hasWhite = entrantsById.has(match.whiteEntrantId);
      const hasBlack = entrantsById.has(match.blackEntrantId);
      if (!hasWhite || !hasBlack) return false;
      const entrantBusyElsewhere = current.matches.some(
        (item) =>
          item.id !== matchId &&
          item.status === "running" &&
          (item.whiteEntrantId === match.whiteEntrantId ||
            item.blackEntrantId === match.whiteEntrantId ||
            item.whiteEntrantId === match.blackEntrantId ||
            item.blackEntrantId === match.blackEntrantId),
      );
      if (entrantBusyElsewhere) return false;

      if (match.status === "error") {
        setRuntime((prev) => ({
          ...prev,
          matches: prev.matches.map((item) =>
            item.id === matchId
              ? {
                  ...item,
                  status: "waiting",
                  error: undefined,
                  endedAt: undefined,
                }
              : item,
          ),
        }));
      }

      const runId = runIdRef.current;
      if (!isRunActive(runId)) return false;

      void runMatch(runId, matchId, entrantsById)
        .then(() => {
          if (!isRunActive(runId)) return;
          reconcileSeriesFromMatch(matchId);
          setStandingsFromCurrent(stateRef.current.entrants);
        })
        .catch((error) => {
          if (!isRunActive(runId)) return;
          setRuntime((prev) => ({
            ...prev,
            error: error instanceof Error ? error.message : String(error),
          }));
        });

      return true;
    },
    [
      isRunActive,
      reconcileSeriesFromMatch,
      runMatch,
      setRuntime,
      setStandingsFromCurrent,
    ],
  );

  const markMatchDraw = useCallback(
    async (matchId: string): Promise<boolean> => {
      const current = stateRef.current;
      const match = current.matches.find((item) => item.id === matchId);
      if (!match) return false;
      if (match.status === "finished" && match.result === "1/2-1/2") return false;

      const whiteEntrant = current.entrants.find(
        (entrant) => entrant.id === match.whiteEntrantId,
      );
      const blackEntrant = current.entrants.find(
        (entrant) => entrant.id === match.blackEntrantId,
      );
      if (!whiteEntrant || !blackEntrant) return false;

      matchAbortMapRef.current.get(matchId)?.abort();
      invalidateEngineForEntrant(match.whiteEntrantId);
      invalidateEngineForEntrant(match.blackEntrantId);

      const endedAt = new Date().toISOString();
      setRuntime((prev) => ({
        ...prev,
        matches: prev.matches.map((item) =>
          item.id === matchId
            ? {
                ...item,
                status: "finished",
                result: "1/2-1/2",
                endedAt,
                error: "Marked as draw manually.",
                pgn: buildTournamentPgn({
                  eventName: "Play Lc0 Tournament",
                  white: whiteEntrant.label,
                  black: blackEntrant.label,
                  round: item.round,
                  board: item.board,
                  result: "1/2-1/2",
                  moves: item.moves,
                }),
                nextRetryAt: undefined,
              }
            : item,
        ),
      }));

      reconcileSeriesFromMatch(matchId);
      setStandingsFromCurrent(stateRef.current.entrants);
      return true;
    },
    [
      invalidateEngineForEntrant,
      reconcileSeriesFromMatch,
      setRuntime,
      setStandingsFromCurrent,
    ],
  );

  const restartGameFromScratch = useCallback(
    async (matchId: string): Promise<boolean> => {
      const current = stateRef.current;
      if (current.status !== "running") return false;

      const match = current.matches.find((item) => item.id === matchId);
      if (!match) return false;

      matchAbortMapRef.current.get(matchId)?.abort();
      invalidateEngineForEntrant(match.whiteEntrantId);
      invalidateEngineForEntrant(match.blackEntrantId);

      setRuntime((prev) => ({
        ...prev,
        matches: prev.matches.map((item) =>
          item.id === matchId
            ? {
                ...item,
                status: "waiting",
                result: "*",
                moves: [],
                fenHistory: [START_FEN],
                evalHistory: [],
                pgn: "",
                startedAt: undefined,
                endedAt: undefined,
                error: undefined,
                retryCount: 0,
                nextRetryAt: undefined,
              }
            : item,
        ),
      }));

      reconcileSeriesFromMatch(matchId);
      setStandingsFromCurrent(stateRef.current.entrants);
      return restartMatch(matchId);
    },
    [
      invalidateEngineForEntrant,
      reconcileSeriesFromMatch,
      restartMatch,
      setRuntime,
      setStandingsFromCurrent,
    ],
  );

  useEffect(() => {
    if (!persistedRef.current?.autoResumePending) return;
    persistedRef.current.autoResumePending = false;
    void resumeTournament();
  }, [resumeTournament]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (state.status !== "running") return;
    if (state.currentRound <= 0 || state.currentRound >= state.totalRounds) return;
    if (hasPlayableOrRetryableMatches(state)) return;

    const currentRoundHasUnfinishedSeries = state.series.some(
      (series) => series.round === state.currentRound && series.status !== "finished",
    );
    if (currentRoundHasUnfinishedSeries) return;

    const nextRoundAlreadyCreated = state.series.some(
      (series) => series.round === state.currentRound + 1,
    );
    if (nextRoundAlreadyCreated) return;

    const timer = window.setTimeout(() => {
      void resumeTournament();
    }, 600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    resumeTournament,
    state.currentRound,
    state.matches,
    state.series,
    state.status,
    state.totalRounds,
  ]);

  useEffect(() => {
    if (state.status !== "running") return;
    if (state.totalRounds <= 0 || state.currentRound < state.totalRounds) return;
    if (state.series.length === 0) return;

    const hasPlayable = state.matches.some(
      (match) => match.status === "waiting" || match.status === "running",
    );
    if (hasPlayable) return;

    const hasRetryableErrors = state.matches.some(
      (match) =>
        match.status === "error" && (match.retryCount ?? 0) < MAX_MATCH_ERROR_RETRIES,
    );
    if (hasRetryableErrors) return;

    const hasUnfinishedSeries = state.series.some(
      (series) => series.status !== "finished",
    );
    if (hasUnfinishedSeries) return;

    setRuntime((prev) =>
      prev.status === "running"
        ? { ...prev, status: "completed", error: null }
        : prev,
    );
  }, [
    setRuntime,
    state.currentRound,
    state.matches,
    state.series,
    state.status,
    state.totalRounds,
  ]);

  const resetTournament = useCallback(() => {
    runIdRef.current += 1;
    terminateAllEngines();
    historyRecordIdRef.current = null;
    byeMatchPointsRef.current = new Map();
    byeGamePointsRef.current = new Map();
    byeRecipientsRef.current = new Set();
    setRuntime(makeInitialState);
  }, [setRuntime, terminateAllEngines]);

  const setMoveDelayMs = useCallback(
    (moveDelayMs: number) => {
      const nextDelay = clampMoveDelayMs(moveDelayMs);
      setRuntime((prev) =>
        prev.moveDelayMs === nextDelay
          ? prev
          : { ...prev, moveDelayMs: nextDelay },
      );
    },
    [setRuntime],
  );

  const setMaxSimultaneousGames = useCallback(
    (maxSimultaneousGames: number) => {
      const nextConcurrency = clampMaxSimultaneousGames(maxSimultaneousGames);
      setRuntime((prev) =>
        prev.maxSimultaneousGames === nextConcurrency
          ? prev
          : { ...prev, maxSimultaneousGames: nextConcurrency },
      );
    },
    [setRuntime],
  );

  const openSavedTournament = useCallback(
    async (id: string): Promise<boolean> => {
      const restored = await getTournamentHistoryById(id);
      if (!restored) return false;

      runIdRef.current += 1;
      terminateAllEngines();
      historyRecordIdRef.current = id;
      byeMatchPointsRef.current = new Map();
      byeGamePointsRef.current = new Map();
      byeRecipientsRef.current = new Set();
      const normalizedRestored = {
        ...restored,
        standings:
          restored.format === "round_robin"
            ? recomputeStandingsForState(restored)
            : restored.standings,
      };

      setRuntime(() => ({
        ...normalizedRestored,
        moveDelayMs: clampMoveDelayMs(normalizedRestored.moveDelayMs),
        tiebreakMode: normalizeTiebreakMode(normalizedRestored.tiebreakMode),
        maxTiebreakGames: clampMaxTiebreakGames(
          normalizedRestored.maxTiebreakGames,
        ),
        tiebreakWinBy: clampTiebreakWinBy(normalizedRestored.tiebreakWinBy),
        status:
          normalizedRestored.status === "running"
            ? "paused"
            : normalizedRestored.status,
        selectedMatchId: null,
      }));

      return true;
    },
    [setRuntime, terminateAllEngines],
  );

  const downloadTournamentPgn = useCallback((): boolean => {
    if (typeof window === "undefined") return false;

    const current = stateRef.current;
    const entrantsById = new Map(
      current.entrants.map((entrant) => [entrant.id, entrant]),
    );

    const exportable = current.matches
      .filter(
        (match) =>
          match.status !== "waiting" &&
          match.status !== "cancelled" &&
          match.moves.length > 0,
      )
      .sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round;
        if (a.board !== b.board) return a.board - b.board;
        return a.seriesGameIndex - b.seriesGameIndex;
      });

    if (exportable.length === 0) return false;

    const eventLabel =
      current.format === "round_robin"
        ? "Play Lc0 Tournament - Round Robin"
        : "Play Lc0 Tournament - Swiss";

    const pgnText = exportable
      .map((match) => {
        const white =
          entrantsById.get(match.whiteEntrantId)?.label ?? match.whiteEntrantId;
        const black =
          entrantsById.get(match.blackEntrantId)?.label ?? match.blackEntrantId;

        return buildTournamentPgn({
          eventName: eventLabel,
          white,
          black,
          round: match.round,
          board: match.board,
          result: match.status === "finished" ? match.result : "*",
          moves: match.moves,
        });
      })
      .join("\n\n");

    const blob = new Blob([pgnText], {
      type: "application/x-chess-pgn;charset=utf-8",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = url;
    link.download = `play-lc0-tournament-${stamp}.pgn`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return true;
  }, []);

  const setSelectedMatch = useCallback(
    (matchId: string | null) => {
      setRuntime((prev) => ({ ...prev, selectedMatchId: matchId }));
    },
    [setRuntime],
  );

  const selectedMatch = useMemo(
    () => state.matches.find((match) => match.id === state.selectedMatchId) ?? null,
    [state.matches, state.selectedMatchId],
  );

  return {
    state,
    engineStats,
    savedTournaments,
    selectedMatch,
    startTournament,
    openSavedTournament,
    resumeTournament,
    pauseTournament,
    setMoveDelayMs,
    setMaxSimultaneousGames,
    restartMatch,
    restartGameFromScratch,
    markMatchDraw,
    resetTournament,
    downloadTournamentPgn,
    checkMatchEngineHealth,
    setSelectedMatch,
  };
}
