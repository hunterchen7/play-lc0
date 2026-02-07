import type { NetworkInfo } from "../constants/networks";
import type { SavedGame } from "../types/game";
import { NetworkPicker } from "./NetworkPicker";
import { GameHistory } from "./GameHistory";

interface HomeScreenProps {
  onStart: (
    network: NetworkInfo,
    color: "w" | "b",
    temperature: number,
    savedGame?: SavedGame,
  ) => void;
  onOpenTournament: () => void;
}

export function HomeScreen({ onStart, onOpenTournament }: HomeScreenProps) {
  return (
    <div className="flex flex-col">
      <div className="fixed top-4 right-4 z-30">
        <button
          onClick={onOpenTournament}
          className="px-4 py-2 bg-emerald-900/30 hover:bg-emerald-800/40 border border-emerald-700/60 text-emerald-200 text-sm font-medium rounded-lg transition-colors"
        >
          Tournament Mode
        </button>
      </div>
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-100 mb-2 mt-4">Play Lc0</h1>
        <p className="text-gray-400">
          Chess with neural networks — depth 0 (policy head only, no search)
        </p>
      </div>
      <div className="flex flex-col items-center gap-6 p-8 mx-auto flex-around">
        <NetworkPicker onStart={onStart} />
        <GameHistory onContinue={onStart} />
      </div>
    </div>
  );
}
