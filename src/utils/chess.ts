import { Chess, type Move } from 'chess.js'

// Convert chess.js verbose moves to UCI strings
export function moveToUCI(m: Move): string {
  let uci = m.from + m.to
  if (m.promotion) uci += m.promotion
  return uci
}

// Get all legal moves as UCI strings
export function getLegalMovesUCI(fen: string): string[] {
  const chess = new Chess(fen)
  return chess.moves({ verbose: true }).map(moveToUCI)
}

// Convert UCI move string to chess.js move object
export function uciToChessJsMove(uci: string): {
  from: string
  to: string
  promotion?: string
} {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  }
}
