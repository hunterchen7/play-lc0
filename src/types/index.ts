// Messages from main thread to worker
export type WorkerRequest =
  | { type: 'init'; modelUrl: string }
  | { type: 'getBestMove'; fen: string; history: string[]; legalMoves: string[]; temperature: number }
  | { type: 'evaluatePosition'; fen: string; history: string[] }
  | { type: 'mctsSearch'; fen: string; history: string[]; nodeLimit: number; timeLimitMs?: number }

// Messages from worker to main thread
export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'initProgress'; progress: number; message: string }
  | { type: 'initError'; error: string }
  | {
      type: 'bestMove'
      move: string
      confidence: number
      wdl: [number, number, number]
    }
  | {
      type: 'evaluation'
      wdl: [number, number, number]
    }
  | {
      type: 'mctsResult'
      bestMove: string
      bestVisits: number
      totalNodes: number
      topMoves: { move: string; visits: number; q: number; prior: number }[]
      wdl: [number, number, number]
    }
  | { type: 'mctsProgress'; nodes: number; totalNodes: number }
  | { type: 'error'; error: string }

// Engine state visible to the UI
export interface EngineState {
  isReady: boolean
  isThinking: boolean
  isLoading: boolean
  loadingProgress: number
  loadingMessage: string
  lastMove: string | null
  lastConfidence: number | null
  wdl: [number, number, number] | null // [win, draw, loss] from engine's perspective
  error: string | null
  /** MCTS search progress (nodes completed / total) */
  searchProgress: { nodes: number; totalNodes: number } | null
}
