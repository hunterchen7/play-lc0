import { TournamentMiniBoard } from "./tournament/TournamentMiniBoard";

interface FenPreviewBoardProps {
  fen: string;
}

export function FenPreviewBoard({ fen }: FenPreviewBoardProps) {
  const turn = fen.split(" ")[1];
  const turnLabel = turn === "b" ? "Black to move" : "White to move";

  return (
    <div className="flex flex-col items-center gap-2">
      <TournamentMiniBoard id="fen-preview" position={fen} />
      <p className="text-xs text-gray-400">{turnLabel}</p>
    </div>
  );
}
