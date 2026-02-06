import type { WorkerRequest, WorkerResponse } from '../types'
import { encodeFenHistory } from './encoding'
import { decodePolicyOutput } from './decoding'
import { initModel, runInference } from './inference'
import { getCachedModel, cacheModel } from './modelCache'

function post(msg: WorkerResponse) {
  self.postMessage(msg)
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data

  switch (msg.type) {
    case 'init': {
      try {
        post({ type: 'initProgress', progress: 0, message: 'Checking cache...' })

        let modelData = await getCachedModel(msg.modelUrl)

        if (!modelData) {
          post({
            type: 'initProgress',
            progress: 0.1,
            message: 'Downloading model...',
          })

          const response = await fetch(msg.modelUrl)
          if (!response.ok) {
            throw new Error(`Failed to fetch model: ${response.status}`)
          }

          // Download with progress tracking
          const contentLength = response.headers.get('Content-Length')
          const total = contentLength ? parseInt(contentLength) : 0

          if (total > 0 && response.body) {
            const reader = response.body.getReader()
            const chunks: Uint8Array[] = []
            let received = 0

            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              chunks.push(value)
              received += value.length
              const dlProgress = 0.1 + (received / total) * 0.6
              post({
                type: 'initProgress',
                progress: dlProgress,
                message: `Downloading... ${Math.round((received / total) * 100)}%`,
              })
            }

            const buffer = new Uint8Array(received)
            let pos = 0
            for (const chunk of chunks) {
              buffer.set(chunk, pos)
              pos += chunk.length
            }
            modelData = buffer.buffer
          } else {
            modelData = await response.arrayBuffer()
          }

          post({
            type: 'initProgress',
            progress: 0.75,
            message: 'Caching model...',
          })
          await cacheModel(msg.modelUrl, modelData)
        } else {
          post({
            type: 'initProgress',
            progress: 0.7,
            message: 'Loaded from cache',
          })
        }

        post({
          type: 'initProgress',
          progress: 0.8,
          message: 'Initializing neural network...',
        })
        await initModel(modelData)

        post({ type: 'ready' })
      } catch (error) {
        post({
          type: 'initError',
          error: error instanceof Error ? error.message : String(error),
        })
      }
      break
    }

    case 'getBestMove': {
      try {
        const { fen, history, legalMoves, temperature } = msg
        const isBlack = fen.split(' ')[1] === 'b'

        // history already contains all game FENs including current position (last)
        const inputTensor = encodeFenHistory(history)

        // Run neural network inference
        const { policy, wdl } = await runInference(inputTensor)

        // Decode policy output to find best move
        const result = decodePolicyOutput(policy, legalMoves, isBlack, temperature)

        post({
          type: 'bestMove',
          move: result.best.move,
          confidence: result.best.confidence,
          wdl: wdl,
        })
      } catch (error) {
        post({
          type: 'error',
          error: error instanceof Error ? error.message : String(error),
        })
      }
      break
    }
  }
}
