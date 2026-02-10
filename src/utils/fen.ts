import { Chess } from "chess.js";

export interface FenValidationResult {
  valid: boolean;
  error?: string;
  turn?: "w" | "b";
}

export function validateFen(fen: string): FenValidationResult {
  const trimmed = fen.trim();
  if (!trimmed) {
    return { valid: false, error: "FEN string is empty" };
  }
  try {
    const chess = new Chess(trimmed);
    return { valid: true, turn: chess.turn() as "w" | "b" };
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : "Invalid FEN",
    };
  }
}
