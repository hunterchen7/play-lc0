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
}

export function HomeScreen({ onStart }: HomeScreenProps) {
  return (
    <div className="flex flex-col">
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
