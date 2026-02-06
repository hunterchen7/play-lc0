import { useState, useEffect } from 'react'
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

export function Board({ position, onPieceDrop, boardOrientation, disabled }: BoardProps) {
  const boardSize = useBoardSize()

  return (
    <div className="relative" style={{ width: boardSize, height: boardSize }}>
      <Chessboard
        options={{
          position,
          onPieceDrop,
          boardOrientation,
          boardWidth: boardSize,
          allowDragging: !disabled,
          animationDurationInMs: 200,
          boardStyle: {
            borderRadius: '4px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
          },
          darkSquareStyle: { backgroundColor: '#779952' },
          lightSquareStyle: { backgroundColor: '#edeed1' },
        }}
      />
      {disabled && (
        <div className="absolute inset-0 cursor-not-allowed" />
      )}
    </div>
  )
}
