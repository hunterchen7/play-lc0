import type { NetworkInfo } from "../constants/networks";
import type { SelectedOpening } from "./openings";

export interface SavedGame {
  id: string;
  date: string;
  network: string;
  playerColor: "w" | "b";
  result: string;
  pgn: string;
  moves: string[];
}

export interface GameConfig {
  network: NetworkInfo;
  playerColor: "w" | "b";
  temperature: number;
  searchNodes: number; // 0 = raw policy (no search), >0 = MCTS with this many nodes
  searchTimeMs: number; // 0 = no time limit, >0 = MCTS time limit in ms
  savedGame?: SavedGame;
  startFen?: string;
  openings?: SelectedOpening[];
}
