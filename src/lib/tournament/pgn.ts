const STANDARD_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

interface BuildTournamentPgnArgs {
  eventName: string;
  white: string;
  black: string;
  round: number;
  board: number;
  result: "1-0" | "0-1" | "1/2-1/2" | "*";
  moves: string[];
  startFen?: string;
}

export function buildTournamentPgn({
  eventName,
  white,
  black,
  round,
  board,
  result,
  moves,
  startFen,
}: BuildTournamentPgnArgs): string {
  const date = new Date();
  const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;

  const isCustom = !!startFen && startFen !== STANDARD_FEN;

  let pgn = `[Event "${eventName}"]\n`;
  pgn += `[Site "play-lc0"]\n`;
  pgn += `[Date "${dateStr}"]\n`;
  pgn += `[Round "${round}.${board}"]\n`;
  pgn += `[White "${white}"]\n`;
  pgn += `[Black "${black}"]\n`;
  pgn += `[Result "${result}"]\n`;

  if (isCustom) {
    pgn += `[SetUp "1"]\n`;
    pgn += `[FEN "${startFen}"]\n`;
  }

  pgn += "\n";

  let startMoveNum = 1;
  let blackToMove = false;

  if (isCustom && startFen) {
    const parts = startFen.split(" ");
    blackToMove = parts[1] === "b";
    const fullMove = parseInt(parts[5], 10);
    if (Number.isFinite(fullMove) && fullMove > 0) {
      startMoveNum = fullMove;
    }
  }

  for (let i = 0; i < moves.length; i++) {
    if (blackToMove) {
      if (i === 0) {
        pgn += `${startMoveNum}... ${moves[i]} `;
      } else if (i % 2 === 1) {
        pgn += `${startMoveNum + Math.ceil(i / 2)}. ${moves[i]} `;
      } else {
        pgn += `${moves[i]} `;
      }
    } else {
      if (i % 2 === 0) {
        pgn += `${startMoveNum + Math.floor(i / 2)}. `;
      }
      pgn += `${moves[i]} `;
    }
  }

  pgn += result;
  return pgn;
}
