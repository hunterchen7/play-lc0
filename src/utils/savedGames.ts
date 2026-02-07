import type { SavedGame } from "../types/game";

const SAVED_GAMES_KEY = "lc0-games";

export function getSavedGames(): SavedGame[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_GAMES_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveGame(game: SavedGame) {
  const games = getSavedGames();
  const existingIndex = games.findIndex((g) => g.id === game.id);

  if (existingIndex >= 0) {
    games[existingIndex] = game;
  } else {
    games.unshift(game);
  }

  localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify(games.slice(0, 50)));
}
