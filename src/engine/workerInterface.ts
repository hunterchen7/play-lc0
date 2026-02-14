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
  private pendingEvaluation: {
    resolve: (wdl: [number, number, number]) => void
    reject: (error: Error) => void
  } | null = null
  private pendingSearch: {
    resolve: (result: {
      bestMove: string
      bestVisits: number
      totalNodes: number
      topMoves: { move: string; visits: number; q: number; prior: number }[]
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

      case 'evaluation':
        this.pendingEvaluation?.resolve(msg.wdl)
        this.pendingEvaluation = null
        break

      case 'mctsResult':
        this.notify({
          isThinking: false,
          lastMove: msg.bestMove,
          lastConfidence: msg.bestVisits / msg.totalNodes,
          wdl: msg.wdl,
          searchProgress: null,
        })
        this.pendingSearch?.resolve({
          bestMove: msg.bestMove,
          bestVisits: msg.bestVisits,
          totalNodes: msg.totalNodes,
          topMoves: msg.topMoves,
          wdl: msg.wdl,
        })
        this.pendingSearch = null
        break

      case 'mctsProgress':
        this.notify({
          searchProgress: { nodes: msg.nodes, totalNodes: msg.totalNodes },
        })
        break

      case 'error':
        this.notify({ error: msg.error, isThinking: false, searchProgress: null })
        this.pendingMove?.reject(new Error(msg.error))
        this.pendingEvaluation?.reject(new Error(msg.error))
        this.pendingSearch?.reject(new Error(msg.error))
        this.pendingMove = null
        this.pendingEvaluation = null
        this.pendingSearch = null
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
      if (this.pendingMove) {
        reject(new Error('Engine already has a pending move request'))
        return
      }
      this.pendingMove = { resolve, reject }
      this.post({ type: 'getBestMove', fen, history, legalMoves, temperature })
    })
  }

  async evaluatePosition(
    fen: string,
    history: string[]
  ): Promise<[number, number, number]> {
    return new Promise((resolve, reject) => {
      if (this.pendingEvaluation) {
        reject(new Error('Engine already has a pending evaluation request'))
        return
      }
      this.pendingEvaluation = { resolve, reject }
      this.post({ type: 'evaluatePosition', fen, history })
    })
  }

  async mctsSearch(
    fen: string,
    history: string[],
    nodeLimit: number,
    timeLimitMs?: number,
  ): Promise<{
    bestMove: string
    bestVisits: number
    totalNodes: number
    topMoves: { move: string; visits: number; q: number; prior: number }[]
    wdl: [number, number, number]
  }> {
    this.notify({ isThinking: true, searchProgress: { nodes: 0, totalNodes: nodeLimit } })
    return new Promise((resolve, reject) => {
      if (this.pendingSearch) {
        reject(new Error('Engine already has a pending search request'))
        return
      }
      this.pendingSearch = { resolve, reject }
      this.post({ type: 'mctsSearch', fen, history, nodeLimit, timeLimitMs })
    })
  }

  private post(msg: WorkerRequest) {
    this.worker.postMessage(msg)
  }

  terminate() {
    this.worker.terminate()
  }
}
