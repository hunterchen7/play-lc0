# Play Lc0

Play chess against [Leela Chess Zero](https://lczero.org/) neural networks directly in your browser. All inference runs client-side via ONNX Runtime Web — no server required.

## Features

- **Multiple networks** — Choose from 7 networks ranging from ~800 to ~2400 Elo
- **Fully client-side** — Neural network inference runs in a Web Worker using WebGPU (with WASM fallback)
- **Model caching** — Models are cached in IndexedDB after the first download
- **Click or drag** — Move pieces by clicking or drag-and-drop, with legal move indicators
- **Move history** — Clickable move list with arrow key navigation and position browsing
- **Temperature control** — Adjust randomness from deterministic (best move) to creative play
- **WDL bar** — Win/Draw/Loss visualization from White's perspective
- **Game persistence** — Completed games auto-save to localStorage with PGN export

## Available Networks

| Network        | Arch      | Elo        | Style                    |
| -------------- | --------- | ---------- | ------------------------ |
| Tiny Gyal      | 16x2 SE   | ~800-1000  | Weak, beginner-friendly  |
| Mean Girl 8    | 32x4 SE   | ~1200-1400 | Aggressive, entertaining |
| 11258-32x4-SE  | 32x4 SE   | ~1500-1700 | Solid, beatable          |
| 11258-64x6-SE  | 64x6 SE   | ~2000-2100 | Strong amateur           |
| Ender v2       | 112x9 SE  | ~2200-2300 | Endgame specialist       |
| 11258-112x9-SE | 112x9 SE  | ~2250-2350 | Near-master              |
| Bad Gyal 8     | 128x10 SE | ~2300-2450 | Aggressive, human-like   |

All Elo ratings are approximate at depth 0 (policy head only, no search).

## Setup

```bash
npm install
npm run dev
```

### ONNX Models

Place pre-converted ONNX model files in `public/models/`. Models are not included in the repo due to size.

To convert Lc0 networks to ONNX format:

```bash
lc0 leela2onnx --input=<weights-file> --output=<output.onnx>
```

## Tech Stack

- React + TypeScript + Vite
- [chess.js](https://github.com/jhlywa/chess.js) — Move validation and game logic
- [react-chessboard](https://github.com/Clariity/react-chessboard) — Board UI
- [onnxruntime-web](https://github.com/microsoft/onnxruntime) — Neural network inference (WebGPU + WASM)
- [idb](https://github.com/nicedoc/idb) — IndexedDB model caching
- Tailwind CSS
