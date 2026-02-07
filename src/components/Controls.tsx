interface ControlsProps {
  onNewGame: () => void;
  onFlipBoard: () => void;
  onResign: () => void;
  playerColor: "w" | "b";
  isGameOver: boolean;
  isViewingHistory: boolean;
  temperature: number;
  onTemperatureChange: (temp: number) => void;
}

export function Controls({
  onNewGame,
  onFlipBoard,
  onResign,
  playerColor,
  isGameOver,
  isViewingHistory,
  temperature,
  onTemperatureChange,
}: ControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={onNewGame}
          className="px-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors text-sm"
        >
          New Game
        </button>

        <button
          onClick={onResign}
          disabled={isGameOver || isViewingHistory}
          className="px-2 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors text-sm"
        >
          Resign
        </button>

        <button
          onClick={onFlipBoard}
          className="px-2 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors text-sm"
        >
          Flip Board
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-400">
            Temperature: {temperature === 0 ? "Off" : temperature.toFixed(2)}
          </label>
          <span className="text-xs text-gray-500">
            as {playerColor === "w" ? "White" : "Black"}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="2"
          step="0.05"
          value={temperature}
          onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
          className="w-full accent-emerald-500"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>Best</span>
          <span>Random</span>
        </div>
      </div>

      {isGameOver && (
        <p className="text-amber-400 text-center font-medium text-sm">
          Game Over
        </p>
      )}
    </div>
  );
}
