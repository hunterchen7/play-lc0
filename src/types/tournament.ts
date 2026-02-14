import type { NetworkInfo } from "../constants/networks";

export type TournamentFormat = "round_robin" | "swiss";
export type TournamentTiebreakMode = "capped" | "win_by";

export type MatchStatus =
  | "waiting"
  | "running"
  | "finished"
  | "cancelled"
  | "error";
export type TournamentStatus =
  | "idle"
  | "paused"
  | "running"
  | "completed"
  | "error";

export interface TournamentEntrant {
  id: string;
  network: NetworkInfo;
  temperature: number;
  searchNodes: number;
  searchTimeMs: number;
  label: string;
}

export interface TournamentPosition {
  id: string;
  name: string;
  fen: string;
}

export interface TournamentSetupConfig {
  format: TournamentFormat;
  entrants: TournamentEntrant[];
  bestOf: number;
  maxSimultaneousGames: number;
  swissRounds: number;
  tiebreakMode: TournamentTiebreakMode;
  maxTiebreakGames: number;
  tiebreakWinBy: number;
  positions?: TournamentPosition[];
}

export interface TournamentPairing {
  whiteEntrantId: string;
  blackEntrantId: string;
}

export interface TournamentSeries {
  id: string;
  round: number;
  board: number;
  whiteEntrantId: string;
  blackEntrantId: string;
  plannedGames: number;
  status: "waiting" | "running" | "finished";
  whiteScore: number;
  blackScore: number;
  winnerEntrantId: string | null;
  gameIds: string[];
}

export interface MatchEvalSnapshot {
  ply: number;
  fen: string;
  whiteEngineWdl: [number, number, number];
  blackEngineWdl: [number, number, number];
  status: "ready" | "pending" | "error";
}

export type EngineHealthStatus = "ok" | "busy" | "error" | "idle";

export interface EngineHealthCheck {
  status: EngineHealthStatus;
  message: string;
  latencyMs: number | null;
}

export interface TournamentMatchHealthReport {
  matchId: string;
  checkedAt: string;
  overall: "healthy" | "degraded" | "idle";
  white: EngineHealthCheck;
  black: EngineHealthCheck;
}

export interface TournamentMatch {
  id: string;
  seriesId: string;
  seriesGameIndex: number;
  round: number;
  board: number;
  whiteEntrantId: string;
  blackEntrantId: string;
  status: MatchStatus;
  result: "1-0" | "0-1" | "1/2-1/2" | "*";
  moves: string[];
  startFen?: string;
  fenHistory: string[];
  evalHistory: MatchEvalSnapshot[];
  pgn: string;
  startedAt?: string;
  endedAt?: string;
  error?: string;
  retryCount?: number;
  nextRetryAt?: string;
}

export interface StandingRow {
  entrantId: string;
  label: string;
  matchPoints: number;
  gamePoints: number;
  wins: number;
  draws: number;
  losses: number;
  playedSeries: number;
  buchholz: number;
  performanceRating: number;
}

export interface TournamentRuntimeState {
  status: TournamentStatus;
  format: TournamentFormat;
  bestOf: number;
  swissRounds: number;
  maxSimultaneousGames: number;
  tiebreakMode: TournamentTiebreakMode;
  maxTiebreakGames: number;
  tiebreakWinBy: number;
  moveDelayMs: number;
  currentRound: number;
  totalRounds: number;
  entrants: TournamentEntrant[];
  positions: TournamentPosition[];
  matches: TournamentMatch[];
  series: TournamentSeries[];
  standings: StandingRow[];
  selectedMatchId: string | null;
  error: string | null;
}
