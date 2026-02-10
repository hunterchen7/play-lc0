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
  savedGame?: SavedGame;
  startFen?: string;
  openings?: SelectedOpening[];
}
