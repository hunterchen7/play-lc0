import { useState, useEffect, useCallback, useMemo } from 'react'
import { Chess } from 'chess.js'
import { Chessboard, type PieceDropHandlerArgs } from 'react-chessboard'

interface BoardProps {
  position: string // FEN
  onPieceDrop: (args: PieceDropHandlerArgs) => boolean
  boardOrientation: 'white' | 'black'
  disabled: boolean
}

function useBoardSize() {
  const [size, setSize] = useState(() =>
    Math.floor(Math.min(window.innerHeight * 0.85, window.innerWidth * 0.85))
  )

  useEffect(() => {
    const update = () => {
      setSize(Math.floor(Math.min(window.innerHeight * 0.85, window.innerWidth * 0.85)))
    }
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return size
}

const HIGHLIGHT_SOURCE: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 0, 0.5)',
  boxShadow: 'inset 0 0 0 3px rgba(255, 255, 0, 0.7)',
}
const HIGHLIGHT_DOT: React.CSSProperties = {
  background: 'radial-gradient(circle, rgba(0,0,0,0.25) 25%, transparent 25%)',
}
const HIGHLIGHT_CAPTURE: React.CSSProperties = {
  background: 'radial-gradient(circle, transparent 55%, rgba(0,0,0,0.25) 55%)',
}

export function Board({ position, onPieceDrop, boardOrientation, disabled }: BoardProps) {
  const boardSize = useBoardSize()
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [selectedPiece, setSelectedPiece] = useState<any>(null)

  // Clear selection when position changes (move was made)
  useEffect(() => {
    setSelectedSquare(null)
    setSelectedPiece(null)
  }, [position])

  // Compute legal moves for the selected piece
  const legalTargets = useMemo(() => {
    if (!selectedSquare) return new Map<string, boolean>()
    try {
      const chess = new Chess(position)
      const moves = chess.moves({ square: selectedSquare as any, verbose: true })
      const targets = new Map<string, boolean>()
      for (const move of moves) {
        targets.set(move.to, move.captured !== undefined)
      }
      return targets
    } catch {
      return new Map<string, boolean>()
    }
  }, [selectedSquare, position])

  // Check if a square has a piece of the same color as the side to move
  const isFriendlyPiece = useCallback(
    (square: string): boolean => {
      try {
        const chess = new Chess(position)
        const p = chess.get(square as any)
        return p !== null && p.color === chess.turn()
      } catch {
        return false
      }
    },
    [position]
  )

  const handleSquareClick = useCallback(
    ({ piece, square }: { piece: any; square: string }) => {
      if (disabled) return

      // If we have a selected piece and click a different square
      if (selectedSquare && square !== selectedSquare) {
        // If clicking another friendly piece, switch selection
        if (isFriendlyPiece(square)) {
          setSelectedSquare(square)
          setSelectedPiece(piece)
          return
        }

        // Otherwise try to move
        const success = onPieceDrop({
          piece: selectedPiece,
          sourceSquare: selectedSquare,
          targetSquare: square,
        } as PieceDropHandlerArgs)

        setSelectedSquare(null)
        setSelectedPiece(null)
        if (success) return

        return
      }

      // If clicking the already selected square, deselect
      if (selectedSquare === square) {
        setSelectedSquare(null)
        setSelectedPiece(null)
        return
      }

      // If clicking a piece, select it
      if (piece) {
        setSelectedSquare(square)
        setSelectedPiece(piece)
      }
    },
    [disabled, selectedSquare, selectedPiece, onPieceDrop, isFriendlyPiece]
  )

  // Build highlight styles
  const squareStyles: Record<string, React.CSSProperties> = {}
  if (selectedSquare) {
    squareStyles[selectedSquare] = HIGHLIGHT_SOURCE
    for (const [sq, isCapture] of legalTargets) {
      squareStyles[sq] = isCapture ? HIGHLIGHT_CAPTURE : HIGHLIGHT_DOT
    }
  }

  return (
    <div className="relative" style={{ width: boardSize, height: boardSize }}>
      <Chessboard
        options={{
          position,
          onPieceDrop,
          onSquareClick: handleSquareClick,
          boardOrientation,
          boardWidth: boardSize,
          allowDragging: !disabled,
          animationDurationInMs: 200,
          squareStyles,
          boardStyle: {
            borderRadius: '4px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
          },
          darkSquareStyle: { backgroundColor: '#779952' },
          lightSquareStyle: { backgroundColor: '#edeed1' },
        }}
      />
      {disabled && !selectedSquare && (
        <div className="absolute inset-0 cursor-not-allowed" />
      )}
    </div>
  )
}
