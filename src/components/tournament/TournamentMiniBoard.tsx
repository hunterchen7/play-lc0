import { memo, useMemo } from "react";
import bB from "../../assets/tournament-pieces/bB.svg";
import bK from "../../assets/tournament-pieces/bK.svg";
import bN from "../../assets/tournament-pieces/bN.svg";
import bP from "../../assets/tournament-pieces/bP.svg";
import bQ from "../../assets/tournament-pieces/bQ.svg";
import bR from "../../assets/tournament-pieces/bR.svg";
import wB from "../../assets/tournament-pieces/wB.svg";
import wK from "../../assets/tournament-pieces/wK.svg";
import wN from "../../assets/tournament-pieces/wN.svg";
import wP from "../../assets/tournament-pieces/wP.svg";
import wQ from "../../assets/tournament-pieces/wQ.svg";
import wR from "../../assets/tournament-pieces/wR.svg";

interface TournamentMiniBoardProps {
  id: string;
  position: string;
}

const PIECE_IMAGES: Record<string, string> = {
  K: wK,
  Q: wQ,
  R: wR,
  B: wB,
  N: wN,
  P: wP,
  k: bK,
  q: bQ,
  r: bR,
  b: bB,
  n: bN,
  p: bP,
};

function parseFenPlacement(fen: string): string[][] {
  const placement = fen.split(" ")[0];
  if (!placement) {
    return Array.from({ length: 8 }, () => Array(8).fill(""));
  }

  const rows = placement.split("/");
  if (rows.length !== 8) {
    return Array.from({ length: 8 }, () => Array(8).fill(""));
  }

  return rows.map((row) => {
    const expanded: string[] = [];
    for (const char of row) {
      const emptyCount = Number(char);
      if (Number.isInteger(emptyCount) && emptyCount > 0) {
        expanded.push(...Array(emptyCount).fill(""));
      } else {
        expanded.push(char);
      }
    }
    if (expanded.length !== 8) {
      return Array(8).fill("");
    }
    return expanded;
  });
}

export const TournamentMiniBoard = memo(function TournamentMiniBoard({
  id,
  position,
}: TournamentMiniBoardProps) {
  const board = useMemo(() => parseFenPlacement(position), [position]);

  return (
    <div
      data-board-id={id}
      className="mx-auto border border-slate-700 rounded-md overflow-hidden"
      style={{ width: 216, height: 216 }}
    >
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {board.map((row, rowIndex) =>
          row.map((piece, colIndex) => {
            const isLightSquare = (rowIndex + colIndex) % 2 === 0;
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="flex items-center justify-center select-none"
                style={{
                  backgroundColor: isLightSquare ? "#edeed1" : "#779952",
                }}
              >
                {piece && PIECE_IMAGES[piece] ? (
                  <img
                    src={PIECE_IMAGES[piece]}
                    alt={piece}
                    draggable={false}
                    className="w-[88%] h-[88%] object-contain pointer-events-none select-none"
                    loading="lazy"
                  />
                ) : null}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
});
