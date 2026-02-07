interface BuildTournamentPgnArgs {
  eventName: string;
  white: string;
  black: string;
  round: number;
  board: number;
  result: "1-0" | "0-1" | "1/2-1/2" | "*";
  moves: string[];
}

export function buildTournamentPgn({
  eventName,
  white,
  black,
  round,
  board,
  result,
  moves,
}: BuildTournamentPgnArgs): string {
  const date = new Date();
  const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;

  let pgn = `[Event "${eventName}"]\n`;
  pgn += `[Site "play-lc0"]\n`;
  pgn += `[Date "${dateStr}"]\n`;
  pgn += `[Round "${round}.${board}"]\n`;
  pgn += `[White "${white}"]\n`;
  pgn += `[Black "${black}"]\n`;
  pgn += `[Result "${result}"]\n\n`;

  for (let i = 0; i < moves.length; i++) {
    if (i % 2 === 0) pgn += `${Math.floor(i / 2) + 1}. `;
    pgn += `${moves[i]} `;
  }

  pgn += result;
  return pgn;
}
