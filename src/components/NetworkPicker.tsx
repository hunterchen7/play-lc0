import { useState } from 'react'
import { NETWORKS, type NetworkInfo } from '../App'

interface NetworkPickerProps {
  onStart: (network: NetworkInfo, color: 'w' | 'b', temperature: number) => void
}

export function NetworkPicker({ onStart }: NetworkPickerProps) {
  const [selected, setSelected] = useState<NetworkInfo>(NETWORKS[0])
  const [color, setColor] = useState<'w' | 'b' | 'random'>('w')
  const [temperature, setTemperature] = useState(0.15)

  const handleStart = () => {
    const actualColor = color === 'random'
      ? (Math.random() < 0.5 ? 'w' : 'b')
      : color
    onStart(selected, actualColor, temperature)
  }

  return (
    <div className="flex flex-col items-center gap-8 p-8 max-w-2xl mx-auto">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-100 mb-2">Play Lc0</h1>
        <p className="text-gray-400">
          Leela Chess Zero in the browser — depth 0 (policy head only)
        </p>
      </div>

      {/* Network selection */}
      <div className="w-full">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Choose your opponent</h2>
        <div className="grid gap-2">
          {NETWORKS.map((net) => (
            <button
              key={net.id}
              onClick={() => setSelected(net)}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                selected.id === net.id
                  ? 'border-emerald-500 bg-emerald-900/30'
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-gray-100">{net.name}</span>
                  <span className="text-xs text-gray-400">{net.label}</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-xs text-gray-400">{net.arch}</span>
                  <span className="text-xs text-emerald-400 font-mono">{net.elo}</span>
                  <span className="text-xs text-gray-300 font-mono">{net.size}</span>
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-1">{net.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Color selection */}
      <div className="w-full">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Play as</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setColor('w')}
            className={`flex-1 py-3 rounded-lg font-semibold text-lg transition-colors ${
              color === 'w'
                ? 'bg-white text-gray-900'
                : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
            }`}
          >
            White
          </button>
          <button
            onClick={() => setColor('random')}
            className={`flex-1 py-3 rounded-lg font-semibold text-lg transition-colors ${
              color === 'random'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
            }`}
          >
            Random
          </button>
          <button
            onClick={() => setColor('b')}
            className={`flex-1 py-3 rounded-lg font-semibold text-lg transition-colors ${
              color === 'b'
                ? 'bg-gray-800 text-white border-2 border-gray-400'
                : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
            }`}
          >
            Black
          </button>
        </div>
      </div>

      {/* Temperature */}
      <div className="w-full">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Temperature</h2>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="flex-1 accent-emerald-500"
            />
            <span className="text-gray-300 font-mono text-sm w-20 text-right">
              {temperature === 0 ? 'Off' : temperature.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Best move</span>
            <span>More random</span>
          </div>
        </div>
      </div>

      {/* Start button */}
      <button
        onClick={handleStart}
        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xl font-bold rounded-xl transition-colors"
      >
        Play vs {selected.name}
      </button>
    </div>
  )
}
