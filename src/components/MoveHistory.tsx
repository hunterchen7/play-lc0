import { useRef, useEffect, useState } from "react";

interface MoveHistoryProps {
  moves: string[]; // SAN strings
  viewingMove: number | null; // null = live (latest position)
  onSelectMove: (moveIndex: number | null) => void;
  pgn: string;
}

export function MoveHistory({
  moves,
  viewingMove,
  onSelectMove,
  pgn,
}: MoveHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentMove = viewingMove ?? moves.length - 1;
  const [activeTab, setActiveTab] = useState<"moves" | "pgn">("moves");

  // Auto-scroll to latest move when live
  useEffect(() => {
    if (viewingMove === null && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moves.length, viewingMove]);

  // Group moves into pairs (white, black)
  const movePairs: { number: number; white: string; black?: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-slate-900 p-1">
          <button
            onClick={() => setActiveTab("moves")}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === "moves"
                ? "bg-slate-700 text-gray-100"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Moves
          </button>
          <button
            onClick={() => setActiveTab("pgn")}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === "pgn"
                ? "bg-slate-700 text-gray-100"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            PGN
          </button>
        </div>
        {activeTab === "moves" && viewingMove !== null && (
          <button
            onClick={() => onSelectMove(null)}
            className="text-xs text-emerald-400 hover:text-emerald-300"
          >
            Live
          </button>
        )}
      </div>

      {activeTab === "moves" ? (
        <>
          {/* Move list */}
          <div
            ref={scrollRef}
            className="bg-slate-900 rounded-lg p-2 max-h-64 overflow-y-auto font-mono text-sm"
          >
            {movePairs.length === 0 ? (
              <p className="text-gray-600 text-center text-xs py-2">No moves yet</p>
            ) : (
              movePairs.map((pair) => (
                <div key={pair.number} className="flex items-baseline gap-1">
                  <span className="text-gray-600 w-7 text-right shrink-0">
                    {pair.number}.
                  </span>
                  <button
                    onClick={() => onSelectMove((pair.number - 1) * 2)}
                    className={`px-1.5 py-0.5 rounded text-left hover:bg-slate-700 transition-colors ${
                      currentMove === (pair.number - 1) * 2
                        ? "bg-slate-700 text-emerald-400"
                        : "text-gray-200"
                    }`}
                  >
                    {pair.white}
                  </button>
                  {pair.black && (
                    <button
                      onClick={() => onSelectMove((pair.number - 1) * 2 + 1)}
                      className={`px-1.5 py-0.5 rounded text-left hover:bg-slate-700 transition-colors ${
                        currentMove === (pair.number - 1) * 2 + 1
                          ? "bg-slate-700 text-emerald-400"
                          : "text-gray-200"
                      }`}
                    >
                      {pair.black}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Navigation buttons */}
          {moves.length > 0 && (
            <div className="flex gap-1">
              <NavButton
                onClick={() => onSelectMove(-1)}
                disabled={currentMove <= -1}
                label="<<"
              />
              <NavButton
                onClick={() => onSelectMove(Math.max(-1, currentMove - 1))}
                disabled={currentMove <= -1}
                label="<"
              />
              <NavButton
                onClick={() =>
                  onSelectMove(
                    currentMove < moves.length - 1 ? currentMove + 1 : null,
                  )
                }
                disabled={viewingMove === null}
                label=">"
              />
              <NavButton
                onClick={() => onSelectMove(null)}
                disabled={viewingMove === null}
                label=">>"
              />
            </div>
          )}
        </>
      ) : (
        <pre
          className="bg-slate-900 rounded-lg p-2 text-xs text-gray-400 whitespace-pre-wrap break-words max-h-64 overflow-y-auto cursor-pointer hover:text-gray-300 transition-colors"
          onClick={() => navigator.clipboard.writeText(pgn)}
          title="Click to copy PGN"
        >
          {pgn}
        </pre>
      )}
    </div>
  );
}

function NavButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 py-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-gray-600 text-gray-300 rounded text-sm font-bold transition-colors"
    >
      {label}
    </button>
  );
}
