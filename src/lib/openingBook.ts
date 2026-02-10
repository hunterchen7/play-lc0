import { Chess } from "chess.js";
import type { SelectedOpening } from "../types/openings";

export interface BookNode {
  children: Map<string, BookNode>;
  isTerminal: boolean;
}

/**
 * Build a move tree from multiple selected openings.
 * Openings sharing a prefix naturally merge (e.g. multiple Sicilian lines
 * all share "1.e4 c5").
 */
export function buildOpeningTree(openings: SelectedOpening[]): BookNode {
  const root: BookNode = {
    children: new Map(),
    isTerminal: false,
  };

  for (const opening of openings) {
    if (opening.moves.length === 0) continue;

    let current = root;
    const chess = new Chess();

    for (const moveSan of opening.moves) {
      try {
        chess.move(moveSan);
      } catch {
        break;
      }

      if (!current.children.has(moveSan)) {
        current.children.set(moveSan, {
          children: new Map(),
          isTerminal: false,
        });
      }
      current = current.children.get(moveSan)!;
    }
    current.isTerminal = true;
  }

  return root;
}

/**
 * Given the current move history (SAN), find available book continuations.
 * Returns array of SAN moves if in book, or null if out of book.
 */
export function getBookMoves(
  tree: BookNode,
  moveHistory: string[],
): string[] | null {
  let current = tree;
  for (const move of moveHistory) {
    const child = current.children.get(move);
    if (!child) return null;
    current = child;
  }
  const bookMoves = [...current.children.keys()];
  return bookMoves.length > 0 ? bookMoves : null;
}
