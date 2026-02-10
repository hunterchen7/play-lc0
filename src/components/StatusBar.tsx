import type { EngineState } from '../types'

interface StatusBarProps {
  engineState: EngineState
  gameStatus: string // e.g. "In progress", "Checkmate", "Stalemate", etc.
  lastMoveAlgebraic: string | null // e.g. "Nf3"
  playerColor: 'w' | 'b'
  isInBook?: boolean
}

function WDLBar({ wdl, playerColor }: { wdl: [number, number, number]; playerColor: 'w' | 'b' }) {
  const [engineWin, draw, engineLoss] = wdl
  // Always show from White's perspective: white bar = white winning, dark bar = black winning
  const engineIsBlack = playerColor === 'w'
  const whiteWin = engineIsBlack ? engineLoss : engineWin
  const blackWin = engineIsBlack ? engineWin : engineLoss
  const whitePct = Math.round(whiteWin * 100)
  const drawPct = Math.round(draw * 100)
  const blackPct = Math.round(blackWin * 100)

  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>White: {whitePct}%</span>
        <span>Draw: {drawPct}%</span>
        <span>Black: {blackPct}%</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-700">
        <div
          className="bg-white transition-all duration-300"
          style={{ width: `${whiteWin * 100}%` }}
        />
        <div
          className="bg-gray-400 transition-all duration-300"
          style={{ width: `${draw * 100}%` }}
        />
        <div
          className="bg-gray-900 transition-all duration-300"
          style={{ width: `${blackWin * 100}%` }}
        />
      </div>
    </div>
  )
}

export function StatusBar({ engineState, gameStatus, lastMoveAlgebraic, playerColor, isInBook }: StatusBarProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 min-w-[220px]">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-lg font-bold text-gray-200">Engine</h3>
        {isInBook && (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-800/50 text-amber-300 border border-amber-700/50">
            Book
          </span>
        )}
      </div>

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
      {engineState.wdl && <WDLBar wdl={engineState.wdl} playerColor={playerColor} />}

      {/* Error */}
      {engineState.error && (
        <div className="mt-3 p-2 bg-red-900/50 rounded text-red-300 text-sm">
          {engineState.error}
        </div>
      )}
    </div>
  )
}
