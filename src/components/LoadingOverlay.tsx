interface LoadingOverlayProps {
  progress: number // 0-1
  message: string
}

export function LoadingOverlay({ progress, message }: LoadingOverlayProps) {
  return (
    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center rounded z-10">
      <div className="text-white text-lg font-medium mb-4">Loading Model</div>

      {/* Progress bar */}
      <div className="w-64 h-3 bg-gray-700 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <div className="text-gray-400 text-sm">{message}</div>
      <div className="text-gray-500 text-xs mt-1">
        {Math.round(progress * 100)}%
      </div>
    </div>
  )
}
