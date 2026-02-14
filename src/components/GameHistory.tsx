import { useMemo, useState } from "react";
import { NETWORKS, type NetworkInfo } from "../constants/networks";
import type { SavedGame } from "../types/game";
import { getSavedGames } from "../utils/savedGames";

interface GameHistoryProps {
  onContinue: (
    network: NetworkInfo,
    color: "w" | "b",
    temperature: number,
    searchNodes: number,
    searchTimeMs: number,
    savedGame?: SavedGame,
  ) => void;
}

export function GameHistory({ onContinue }: GameHistoryProps) {
  const games = getSavedGames();
  const [expandedGames, setExpandedGames] = useState<Set<number>>(new Set());

  if (games.length === 0) return null;

  const resultLabel = (game: SavedGame) => {
    if (game.result === "1/2-1/2") return "Draw";
    if (game.result === "*") return "Incomplete";
    const playerWon =
      (game.playerColor === "w" && game.result === "1-0") ||
      (game.playerColor === "b" && game.result === "0-1");
    return playerWon ? "Win" : "Loss";
  };

  const resultColor = (game: SavedGame) => {
    if (game.result === "*") return "text-gray-400";
    const playerWon =
      (game.playerColor === "w" && game.result === "1-0") ||
      (game.playerColor === "b" && game.result === "0-1");
    if (playerWon) return "text-emerald-400";
    if (game.result === "1/2-1/2") return "text-gray-300";
    return "text-red-400";
  };

  const stats = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let incomplete = 0;

    for (const game of games) {
      if (game.result === "*") {
        incomplete += 1;
        continue;
      }

      if (game.result === "1/2-1/2") {
        draws += 1;
        continue;
      }

      const playerWon =
        (game.playerColor === "w" && game.result === "1-0") ||
        (game.playerColor === "b" && game.result === "0-1");

      if (playerWon) wins += 1;
      else losses += 1;
    }

    return { total: games.length, wins, losses, draws, incomplete };
  }, [games]);

  return (
    <div className="w-full lg:max-w-2xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-200">Game History</h2>
        <div className="text-xs font-medium flex items-center gap-2">
          <span className="text-gray-400">T {stats.total}</span>
          <span className="text-emerald-400">W {stats.wins}</span>
          <span className="text-red-400">L {stats.losses}</span>
          <span className="text-gray-300">D {stats.draws}</span>
          <span className="text-gray-500">I {stats.incomplete}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 max-h-[80vh] overflow-y-auto">
        {games.map((game, i) => (
          <div
            key={i}
            className="bg-slate-800/50 border border-slate-700 rounded-lg"
          >
            <button
              onClick={() =>
                setExpandedGames((prev) => {
                  const next = new Set(prev);
                  if (next.has(i)) next.delete(i);
                  else next.add(i);
                  return next;
                })
              }
              className="w-full text-left px-4 py-3 hover:bg-slate-700/30 transition-colors rounded-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-gray-200 font-medium">vs {game.network}</span>
                  <span className="text-xs text-gray-500">
                    as {game.playerColor === "w" ? "White" : "Black"}
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  {game.result === "*" ? (
                    <div className="group/continue flex items-baseline gap-3">
                      <span className="text-sm font-medium text-gray-400 group-hover/continue:hidden">
                        Incomplete
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const network = NETWORKS.find(
                            (n) => n.name === game.network,
                          );
                          if (network) {
                            onContinue(network, game.playerColor, 0.15, 0, 0, game);
                          }
                        }}
                        className="hidden group-hover/continue:block text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        Continue →
                      </button>
                    </div>
                  ) : (
                    <span className={`text-sm font-medium ${resultColor(game)}`}>
                      {resultLabel(game)}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {new Date(game.date).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1 font-mono truncate">
                {game.moves
                  .slice(0, 10)
                  .map((m, j) =>
                    j % 2 === 0 ? `${Math.floor(j / 2) + 1}. ${m}` : ` ${m} `,
                  )
                  .join("")}
                {game.moves.length > 10 && "..."}
              </p>
            </button>
            <div
              className="grid transition-[grid-template-rows] duration-200 ease-in-out"
              style={{ gridTemplateRows: expandedGames.has(i) ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <div className="px-4 pb-3 border-t border-slate-700">
                  <pre
                    className="mt-2 bg-slate-900 rounded-lg p-2 text-xs text-gray-400 whitespace-pre-wrap break-words max-h-48 overflow-y-auto cursor-pointer hover:text-gray-300 transition-colors"
                    onClick={() => navigator.clipboard.writeText(game.pgn)}
                    title="Click to copy PGN"
                  >
                    {game.pgn}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
