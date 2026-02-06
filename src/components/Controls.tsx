interface ControlsProps {
  onNewGame: () => void
  onFlipBoard: () => void
  playerColor: 'w' | 'b'
  isGameOver: boolean
  temperature: number
  onTemperatureChange: (temp: number) => void
}

export function Controls({
  onNewGame,
  onFlipBoard,
  playerColor,
  isGameOver,
  temperature,
  onTemperatureChange,
}: ControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={onNewGame}
        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
      >
        New Game
      </button>

      <button
        onClick={onFlipBoard}
        className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
      >
        Flip Board
      </button>

      <div className="flex flex-col gap-1">
        <label className="text-sm text-gray-400">
          Temperature: {temperature === 0 ? 'Off (best move)' : temperature.toFixed(2)}
        </label>
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

      <p className="text-sm text-gray-500 text-center">
        Playing as {playerColor === 'w' ? 'White' : 'Black'}
      </p>

      {isGameOver && (
        <p className="text-amber-400 text-center font-medium">Game Over</p>
      )}
    </div>
  )
}
