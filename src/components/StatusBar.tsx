import type { EngineState } from '../types'

interface StatusBarProps {
  engineState: EngineState
  gameStatus: string // e.g. "In progress", "Checkmate", "Stalemate", etc.
  lastMoveAlgebraic: string | null // e.g. "Nf3"
}

function WDLBar({ wdl }: { wdl: [number, number, number] }) {
  const [win, draw, loss] = wdl
  const winPct = Math.round(win * 100)
  const drawPct = Math.round(draw * 100)
  const lossPct = Math.round(loss * 100)

  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>W: {winPct}%</span>
        <span>D: {drawPct}%</span>
        <span>L: {lossPct}%</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-700">
        <div
          className="bg-white transition-all duration-300"
          style={{ width: `${win * 100}%` }}
        />
        <div
          className="bg-gray-400 transition-all duration-300"
          style={{ width: `${draw * 100}%` }}
        />
        <div
          className="bg-gray-900 transition-all duration-300"
          style={{ width: `${loss * 100}%` }}
        />
      </div>
    </div>
  )
}

export function StatusBar({ engineState, gameStatus, lastMoveAlgebraic }: StatusBarProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 min-w-[220px]">
      <h3 className="text-lg font-bold text-gray-200 mb-3">Leela Chess Zero</h3>

      {/* Game Status */}
      <div className="mb-3">
        <span className="text-xs text-gray-500 uppercase tracking-wide">Status</span>
        <p className="text-gray-300">{gameStatus}</p>
      </div>

      {/* Engine thinking indicator */}
      {engineState.isThinking && (
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
          <span className="text-blue-300 text-sm">Thinking...</span>
        </div>
      )}

      {/* Last engine move */}
      {lastMoveAlgebraic && (
        <div className="mb-3">
          <span className="text-xs text-gray-500 uppercase tracking-wide">
            Engine move
          </span>
          <p className="text-xl font-mono text-emerald-400">{lastMoveAlgebraic}</p>
          {engineState.lastConfidence !== null && (
            <p className="text-sm text-gray-400">
              Confidence: {(engineState.lastConfidence * 100).toFixed(1)}%
            </p>
          )}
        </div>
      )}

      {/* WDL Bar */}
      {engineState.wdl && <WDLBar wdl={engineState.wdl} />}

      {/* Error */}
      {engineState.error && (
        <div className="mt-3 p-2 bg-red-900/50 rounded text-red-300 text-sm">
          {engineState.error}
        </div>
      )}
    </div>
  )
}
