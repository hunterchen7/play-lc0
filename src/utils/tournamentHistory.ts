import type { TournamentRuntimeState } from "../types/tournament";
import { buildTournamentPgn } from "../lib/tournament/pgn";

const DB_NAME = "play-lc0-tournaments";
const DB_VERSION = 1;
const STORE_NAME = "history";
const COMPLETED_AT_INDEX = "completedAt";

export interface TournamentHistorySummary {
  id: string;
  status: TournamentRuntimeState["status"];
  isOngoing: boolean;
  updatedAt: string;
  completedAt: string;
  format: TournamentRuntimeState["format"];
  entrantsCount: number;
  totalRounds: number;
  bestOf: number;
  maxSimultaneousGames: number;
  totalGames: number;
  finishedGames: number;
  winnerLabel: string | null;
  topPlacings: string[];
}

interface TournamentHistoryRecord {
  id: string;
  completedAt: string;
  summary: TournamentHistorySummary;
  state: TournamentRuntimeState;
}

interface SaveTournamentHistoryOptions {
  id?: string;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDoneToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function openTournamentHistoryDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB is not available in this environment."));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains(STORE_NAME)
        ? request.transaction?.objectStore(STORE_NAME)
        : db.createObjectStore(STORE_NAME, { keyPath: "id" });

      if (!store) return;

      if (!store.indexNames.contains(COMPLETED_AT_INDEX)) {
        store.createIndex(COMPLETED_AT_INDEX, "completedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function simpleHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function tournamentFingerprint(state: TournamentRuntimeState): string {
  const entrants = state.entrants
    .map((entrant) => `${entrant.id}|${entrant.network.id}|${entrant.temperature}`)
    .join("~");
  const matches = state.matches
    .map(
      (match) =>
        `${match.id}|${match.whiteEntrantId}|${match.blackEntrantId}|${match.result}|${match.moves.length}|${match.endedAt ?? ""}`,
    )
    .join("~");

  const key = [
    state.format,
    state.bestOf,
    state.maxSimultaneousGames,
    state.totalRounds,
    entrants,
    matches,
  ].join("||");

  return `t-${simpleHash(key)}`;
}

function buildSummary(
  state: TournamentRuntimeState,
  forcedId?: string,
): TournamentHistorySummary {
  const finishedGames = state.matches.filter(
    (match) => match.status === "finished" || match.status === "cancelled",
  ).length;
  const status = state.status;
  const isOngoing =
    status === "running" || status === "paused" || status === "error";
  const updatedAt = new Date().toISOString();
  const completedAt =
    status === "completed"
      ? (state.matches
          .map((match) => match.endedAt)
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1) ?? updatedAt)
      : updatedAt;

  return {
    id: forcedId ?? tournamentFingerprint(state),
    status,
    isOngoing,
    updatedAt,
    completedAt,
    format: state.format,
    entrantsCount: state.entrants.length,
    totalRounds: state.totalRounds,
    bestOf: state.bestOf,
    maxSimultaneousGames: state.maxSimultaneousGames,
    totalGames: state.matches.length,
    finishedGames,
    winnerLabel: state.standings[0]?.label ?? null,
    topPlacings: state.standings
      .slice(0, 3)
      .map(
        (row, idx) =>
          `${idx + 1}. ${row.label} (${row.matchPoints.toFixed(1)} MP, ${row.gamePoints.toFixed(1)} GP)`,
      ),
  };
}

function normalizeSummary(
  summary: TournamentHistorySummary,
  state: TournamentRuntimeState,
): TournamentHistorySummary {
  const status = summary.status ?? state.status ?? "completed";
  const isOngoing =
    typeof summary.isOngoing === "boolean"
      ? summary.isOngoing
      : status === "running" || status === "paused" || status === "error";
  const updatedAt = summary.updatedAt ?? summary.completedAt;

  return {
    ...summary,
    id: summary.id,
    status,
    isOngoing,
    updatedAt,
    completedAt: summary.completedAt ?? updatedAt,
    format: summary.format ?? state.format,
    entrantsCount: summary.entrantsCount ?? state.entrants.length,
    totalRounds: summary.totalRounds ?? state.totalRounds,
    bestOf: summary.bestOf ?? state.bestOf,
    maxSimultaneousGames:
      summary.maxSimultaneousGames ?? state.maxSimultaneousGames,
    totalGames: summary.totalGames ?? state.matches.length,
    finishedGames:
      summary.finishedGames ??
      state.matches.filter(
        (match) => match.status === "finished" || match.status === "cancelled",
      ).length,
    winnerLabel: summary.winnerLabel ?? state.standings[0]?.label ?? null,
    topPlacings:
      summary.topPlacings ??
      state.standings
        .slice(0, 3)
        .map(
          (row, idx) =>
            `${idx + 1}. ${row.label} (${row.matchPoints.toFixed(1)} MP, ${row.gamePoints.toFixed(1)} GP)`,
        ),
  };
}

function enrichStateWithPgn(state: TournamentRuntimeState): TournamentRuntimeState {
  const entrantsById = new Map(
    state.entrants.map((entrant) => [entrant.id, entrant.label]),
  );
  const eventName =
    state.format === "round_robin"
      ? "Play Lc0 Tournament - Round Robin"
      : "Play Lc0 Tournament - Swiss";

  const matches = state.matches.map((match) => {
    const hasPgn = Boolean(match.pgn && match.pgn.trim().length > 0);
    const hasMoves = Array.isArray(match.moves) && match.moves.length > 0;
    if (hasPgn || !hasMoves) return match;

    const white = entrantsById.get(match.whiteEntrantId) ?? match.whiteEntrantId;
    const black = entrantsById.get(match.blackEntrantId) ?? match.blackEntrantId;
    const result = match.status === "finished" ? match.result : "*";

    return {
      ...match,
      pgn: buildTournamentPgn({
        eventName,
        white,
        black,
        round: match.round,
        board: match.board,
        result,
        moves: match.moves,
      }),
    };
  });

  return {
    ...state,
    matches,
  };
}

export async function saveTournamentHistory(
  state: TournamentRuntimeState,
  options?: SaveTournamentHistoryOptions,
): Promise<string> {
  const db = await openTournamentHistoryDb();
  try {
    const archivedState = enrichStateWithPgn(state);
    const summary = buildSummary(archivedState, options?.id);
    const record: TournamentHistoryRecord = {
      id: summary.id,
      completedAt: summary.completedAt,
      summary,
      state: {
        ...archivedState,
        selectedMatchId: null,
      },
    };

    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.put(record);
    await transactionDoneToPromise(transaction);
    return summary.id;
  } finally {
    db.close();
  }
}

export async function listTournamentHistory(
  limit = 30,
): Promise<TournamentHistorySummary[]> {
  const db = await openTournamentHistoryDb();
  try {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index(COMPLETED_AT_INDEX);

    const summaries: TournamentHistorySummary[] = [];
    await new Promise<void>((resolve, reject) => {
      const cursorRequest = index.openCursor(null, "prev");
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor || summaries.length >= limit) {
          resolve();
          return;
        }
        const value = cursor.value as TournamentHistoryRecord;
        summaries.push(normalizeSummary(value.summary, value.state));
        cursor.continue();
      };
      cursorRequest.onerror = () => reject(cursorRequest.error);
    });

    return summaries;
  } finally {
    db.close();
  }
}

export async function getTournamentHistoryById(
  id: string,
): Promise<TournamentRuntimeState | null> {
  const db = await openTournamentHistoryDb();
  try {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const record = await requestToPromise<TournamentHistoryRecord | undefined>(
      store.get(id),
    );
    return record?.state ?? null;
  } finally {
    db.close();
  }
}
