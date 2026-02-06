import type { WorkerRequest, WorkerResponse, EngineState } from '../types'

type StateListener = (state: Partial<EngineState>) => void

export class Lc0Engine {
  private worker: Worker
  private listeners = new Set<StateListener>()
  private pendingMove: {
    resolve: (result: {
      move: string
      confidence: number
      wdl: [number, number, number]
    }) => void
    reject: (error: Error) => void
  } | null = null

  constructor() {
    this.worker = new Worker(
      new URL('./worker.ts', import.meta.url),
      { type: 'module' }
    )
    this.worker.onmessage = this.handleMessage.bind(this)
    this.worker.onerror = (e) => {
      this.notify({ error: e.message, isLoading: false, isThinking: false })
    }
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(state: Partial<EngineState>) {
    for (const listener of this.listeners) {
      listener(state)
    }
  }

  private handleMessage(e: MessageEvent<WorkerResponse>) {
    const msg = e.data

    switch (msg.type) {
      case 'ready':
        this.notify({ isReady: true, isLoading: false, loadingProgress: 1 })
        break

      case 'initProgress':
        this.notify({
          isLoading: true,
          loadingProgress: msg.progress,
          loadingMessage: msg.message,
        })
        break

      case 'initError':
        this.notify({ error: msg.error, isLoading: false })
        break

      case 'bestMove':
        this.notify({
          isThinking: false,
          lastMove: msg.move,
          lastConfidence: msg.confidence,
          wdl: msg.wdl,
        })
        this.pendingMove?.resolve({
          move: msg.move,
          confidence: msg.confidence,
          wdl: msg.wdl,
        })
        this.pendingMove = null
        break

      case 'error':
        this.notify({ error: msg.error, isThinking: false })
        this.pendingMove?.reject(new Error(msg.error))
        this.pendingMove = null
        break
    }
  }

  init(modelUrl: string) {
    this.notify({ isLoading: true, loadingProgress: 0, loadingMessage: 'Starting...' })
    this.post({ type: 'init', modelUrl })
  }

  async getBestMove(
    fen: string,
    history: string[],
    legalMoves: string[],
    temperature: number = 0
  ): Promise<{ move: string; confidence: number; wdl: [number, number, number] }> {
    this.notify({ isThinking: true })
    return new Promise((resolve, reject) => {
      this.pendingMove = { resolve, reject }
      this.post({ type: 'getBestMove', fen, history, legalMoves, temperature })
    })
  }

  private post(msg: WorkerRequest) {
    this.worker.postMessage(msg)
  }

  terminate() {
    this.worker.terminate()
  }
}
