import { useState, useEffect, useRef, useCallback } from 'react'
import { Chess } from 'chess.js'
import type { PieceDropHandlerArgs } from 'react-chessboard'
import { Board } from './components/Board'
import { Controls } from './components/Controls'
import { StatusBar } from './components/StatusBar'
import { LoadingOverlay } from './components/LoadingOverlay'
import { NetworkPicker } from './components/NetworkPicker'
import { Lc0Engine } from './engine/workerInterface'
import { getLegalMovesUCI, uciToChessJsMove } from './utils/chess'
import type { EngineState } from './types'

export interface NetworkInfo {
  id: string
  label: string
  name: string
  arch: string
  file: string
  size: string
  elo: string
  description: string
}

export const NETWORKS: NetworkInfo[] = [
  {
    id: 'tiny-gyal',
    label: 'Beginner',
    name: 'Tiny Gyal',
    arch: '16x2 SE',
    file: 'tiny-gyal.onnx',
    size: '1.2 MB',
    elo: '~800–1000',
    description: 'Trained on Lichess human games. Very weak — blunders pieces freely and misses basic tactics. Great for absolute beginners or casual fun.',
  },
  {
    id: 'mean-girl-8',
    label: 'Wild Style',
    name: 'Mean Girl 8',
    arch: '32x4 SE',
    file: 'mean-girl-8.onnx',
    size: '1.6 MB',
    elo: '~1200–1400',
    description: 'The "most fun" Leela net. Plays unorthodox, aggressive chess with tricky attacks and unusual piece sacrifices. Trained to maximize entertainment.',
  },
  {
    id: 'bad-gyal-8',
    label: 'Brawler',
    name: 'Bad Gyal 8',
    arch: '128x10 SE',
    file: 'bad-gyal-8.onnx',
    size: '14 MB',
    elo: '~2300–2450',
    description: 'Trained on human Lichess games — plays swashbuckling, aggressive chess with a human-like style. Very strong tactically.',
  },
  {
    id: '11258-32x4-se',
    label: 'Casual',
    name: '11258-32x4-SE',
    arch: '32x4 SE',
    file: '11258-32x4-se.onnx',
    size: '16 MB',
    elo: '~1500–1700',
    description: 'Distilled from the T10 network via pure reinforcement learning. Plays reasonably solid chess but beatable by intermediate club players.',
  },
  {
    id: '11258-64x6-se',
    label: 'Club Player',
    name: '11258-64x6-SE',
    arch: '64x6 SE',
    file: '11258-64x6-se.onnx',
    size: '18 MB',
    elo: '~2000–2100',
    description: 'Distilled T10 network. Solid amateur-level play with good positional understanding. A worthy opponent for most online players.',
  },
  {
    id: '11258-112x9-se',
    label: 'Expert',
    name: '11258-112x9-SE',
    arch: '112x9 SE',
    file: '11258-112x9-se.onnx',
    size: '24 MB',
    elo: '~2250–2350',
    description: 'Strongest small distilled net from the 11258 series. Clean, precise play with strong endgame technique. Near-master strength at depth 0.',
  },
  {
    id: 'ender-112x9-se',
    label: 'Endgame Drill',
    name: 'Ender v2',
    arch: '112x9 SE',
    file: 'ender-112x9-se.onnx',
    size: '24 MB',
    elo: '~2200–2300',
    description: 'Specialist endgame network distilled from the Ender project. Excels at converting advantages in simplified positions. Use for endgame practice.',
  },
]

const INITIAL_ENGINE_STATE: EngineState = {
  isReady: false,
  isThinking: false,
  isLoading: false,
  loadingProgress: 0,
  loadingMessage: '',
  lastMove: null,
  lastConfidence: null,
  wdl: null,
  error: null,
}

function getGameStatus(game: Chess): string {
  if (game.isCheckmate()) return 'Checkmate'
  if (game.isStalemate()) return 'Stalemate'
  if (game.isDraw()) return 'Draw'
  if (game.isCheck()) return 'Check'
  return game.turn() === 'w' ? "White's turn" : "Black's turn"
}

interface GameConfig {
  network: NetworkInfo
  playerColor: 'w' | 'b'
  temperature: number
}

export default function App() {
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null)

  if (!gameConfig) {
    return (
      <NetworkPicker
        onStart={(network, color, temperature) => setGameConfig({ network, playerColor: color, temperature })}
      />
    )
  }

  return (
    <GameScreen
      key={gameConfig.network.id + gameConfig.playerColor}
      config={gameConfig}
      onBackToMenu={() => setGameConfig(null)}
    />
  )
}

function GameScreen({ config, onBackToMenu }: { config: GameConfig; onBackToMenu: () => void }) {
  const [game, setGame] = useState(new Chess())
  const [engineState, setEngineState] = useState<EngineState>(INITIAL_ENGINE_STATE)
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>(
    config.playerColor === 'w' ? 'white' : 'black'
  )
  const [fenHistory, setFenHistory] = useState<string[]>([new Chess().fen()])
  const [lastMoveAlgebraic, setLastMoveAlgebraic] = useState<string | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null)
  const [temperature, setTemperature] = useState(config.temperature)

  const playerColor = config.playerColor
  const engineRef = useRef<Lc0Engine | null>(null)

  // Initialize engine with selected model
  useEffect(() => {
    const engine = new Lc0Engine()
    engineRef.current = engine

    const unsub = engine.subscribe((partial) => {
      setEngineState((prev) => ({ ...prev, ...partial }))
    })

    engine.init(`/models/${config.network.file}`)

    return () => {
      unsub()
      engine.terminate()
    }
  }, [config.network.file])

  // Request engine move
  const requestEngineMove = useCallback(
    async (currentGame: Chess, history: string[]) => {
      const engine = engineRef.current
      if (!engine || currentGame.isGameOver()) return

      const fen = currentGame.fen()
      const legalMoves = getLegalMovesUCI(fen)
      if (legalMoves.length === 0) return

      try {
        const result = await engine.getBestMove(fen, history, legalMoves, temperature)

        const moveData = uciToChessJsMove(result.move)
        const newGame = new Chess(currentGame.fen())
        const move = newGame.move(moveData)

        if (move) {
          setLastMoveAlgebraic(move.san)
          setGame(newGame)
          setFenHistory((prev) => [...prev, newGame.fen()])
        }
      } catch (e) {
        console.error('Engine move failed:', e)
      }
    },
    [temperature]
  )

  // Trigger engine move when it's the engine's turn
  useEffect(() => {
    if (
      engineState.isReady &&
      !engineState.isThinking &&
      !game.isGameOver() &&
      game.turn() !== playerColor
    ) {
      requestEngineMove(game, fenHistory)
    }
  }, [game, engineState.isReady, engineState.isThinking, playerColor, fenHistory, requestEngineMove])

  // Check if a move is a pawn promotion
  const isPromotion = useCallback(
    (from: string, to: string): boolean => {
      const piece = game.get(from as any)
      if (!piece || piece.type !== 'p') return false
      const toRank = to[1]
      return (piece.color === 'w' && toRank === '8') || (piece.color === 'b' && toRank === '1')
    },
    [game]
  )

  // Complete a promotion move with the chosen piece
  const completePromotion = useCallback(
    (promotion: 'q' | 'r' | 'b' | 'n') => {
      if (!pendingPromotion) return
      const newGame = new Chess(game.fen())
      const move = newGame.move({
        from: pendingPromotion.from,
        to: pendingPromotion.to,
        promotion,
      })
      setPendingPromotion(null)
      if (!move) return
      setGame(newGame)
      setFenHistory((prev) => [...prev, newGame.fen()])
    },
    [game, pendingPromotion]
  )

  // Handle player piece drop
  const onPieceDrop = useCallback(
    ({ piece, sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
      if (!targetSquare) return false

      const isWhitePiece = piece.pieceType[0] === 'W' || piece.pieceType[0] === 'w'
      if (
        (playerColor === 'w' && !isWhitePiece) ||
        (playerColor === 'b' && isWhitePiece)
      ) {
        return false
      }

      if (engineState.isThinking || game.isGameOver()) return false
      if (game.turn() !== playerColor) return false

      // Check if this is a valid move at all (try with queen promotion)
      const testGame = new Chess(game.fen())
      const testMove = testGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      })
      if (!testMove) return false

      // If it's a promotion, show the picker instead of auto-queening
      if (isPromotion(sourceSquare, targetSquare)) {
        setPendingPromotion({ from: sourceSquare, to: targetSquare })
        return false // don't move the piece yet
      }

      const newGame = new Chess(game.fen())
      const move = newGame.move({
        from: sourceSquare,
        to: targetSquare,
      })

      if (!move) return false

      setGame(newGame)
      setFenHistory((prev) => [...prev, newGame.fen()])

      return true
    },
    [game, playerColor, engineState.isThinking, isPromotion]
  )

  const handleNewGame = useCallback(() => {
    const newGame = new Chess()
    setGame(newGame)
    setFenHistory([newGame.fen()])
    setLastMoveAlgebraic(null)
    setEngineState((prev) => ({
      ...prev,
      lastMove: null,
      lastConfidence: null,
      wdl: null,
      error: null,
      isThinking: false,
    }))
  }, [])

  const handleFlipBoard = useCallback(() => {
    setBoardOrientation((prev) => (prev === 'white' ? 'black' : 'white'))
  }, [])

  const isEnginesTurn = game.turn() !== playerColor
  const disabled = isEnginesTurn || engineState.isThinking || game.isGameOver() || !engineState.isReady

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-100">Play Lc0</h1>
        <p className="text-gray-400 text-sm mt-1">
          vs <span className="text-emerald-400 font-medium">{config.network.name}</span>
          {' '}({config.network.elo})
        </p>
      </div>

      <div className="flex gap-8 items-start">
        {/* Board with loading overlay */}
        <div className="relative">
          <Board
            position={game.fen()}
            onPieceDrop={onPieceDrop}
            boardOrientation={boardOrientation}
            disabled={disabled}
          />
          {engineState.isLoading && (
            <LoadingOverlay
              progress={engineState.loadingProgress}
              message={engineState.loadingMessage}
            />
          )}
          {pendingPromotion && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
              <div className="bg-slate-800 rounded-xl p-4 flex gap-2">
                {(['q', 'r', 'b', 'n'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => completePromotion(p)}
                    className="w-16 h-16 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center justify-center text-3xl transition-colors"
                  >
                    {playerColor === 'w'
                      ? { q: '\u2655', r: '\u2656', b: '\u2657', n: '\u2658' }[p]
                      : { q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E' }[p]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <StatusBar
            engineState={engineState}
            gameStatus={getGameStatus(game)}
            lastMoveAlgebraic={lastMoveAlgebraic}
          />
          <Controls
            onNewGame={handleNewGame}
            onFlipBoard={handleFlipBoard}
            playerColor={playerColor}
            isGameOver={game.isGameOver()}
            temperature={temperature}
            onTemperatureChange={setTemperature}
          />
          <button
            onClick={onBackToMenu}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg font-medium transition-colors text-sm"
          >
            Change Opponent
          </button>
        </div>
      </div>
    </div>
  )
}
