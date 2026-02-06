# Play Lc0

Play chess against neural networks in your browser. Uses networks from the [Lc0](https://lczero.org/) ecosystem. All inference runs client-side via ONNX Runtime Web — no server required.

**Note:** This is an independent project and is not officially affiliated with Leela Chess Zero.

## Features

- **Multiple networks** — Choose from 53 networks ranging from ~800 to ~2800 Elo
- **Fully client-side** — Neural network inference runs in a Web Worker using WebGPU (with WASM fallback)
- **Model caching** — Models are cached in IndexedDB after the first download
- **Click or drag** — Move pieces by clicking or drag-and-drop, with legal move indicators
- **Move history** — Clickable move list with arrow key navigation and position browsing
- **Temperature control** — Adjust randomness from deterministic (best move) to creative play
- **WDL bar** — Win/Draw/Loss visualization
- **Game persistence** — Completed games auto-save to localStorage with PGN export

## Available Networks

| Network              | Arch               | 0-Node Elo     | ONNX     | Download | Style                           |
| -------------------- | ------------------ | -------------- | -------- | -------- | ------------------------------- |
| Tiny Gyal            | 16x2               | ~800–1000      | 1.1 MB   | 791 KB   | Weak, beginner-friendly         |
| 11258-16x2-SE        | 16x2-SE            | ~800–1000      | 15.6 MB  | 8.9 MB   | Smallest distilled T10          |
| Maia 1100            | 64x6-SE            | 1100           | 3.3 MB   | 2.4 MB   | Human-like at 1100              |
| Mean Girl 8          | 128x10             | ~1200–1400     | 1.5 MB   | 1.2 MB   | Aggressive, entertaining        |
| 11258-24x3-SE        | 24x3-SE            | ~1200–1400     | 15.7 MB  | 8.9 MB   | Distilled T10, basic tactics    |
| Maia 1200            | 64x6-SE            | 1200           | 3.3 MB   | 2.3 MB   | Human-like at 1200              |
| Maia 1300            | 64x6-SE            | 1300           | 3.3 MB   | 2.3 MB   | Human-like at 1300              |
| 11258-32x4-SE        | 32x4-SE            | ~1500–1700     | 15.9 MB  | 9.0 MB   | Solid, beatable                 |
| Maia 1400            | 64x6-SE            | 1400           | 3.3 MB   | 2.4 MB   | Human-like at 1400              |
| Maia 1500            | 64x6-SE            | 1500           | 3.3 MB   | 2.3 MB   | Human-like at 1500              |
| Maia 1600            | 64x6-SE            | 1600           | 3.3 MB   | 2.4 MB   | Human-like at 1600              |
| Evil Gyal 6          | 48x5               | ~1700–1800     | 2.2 MB   | 1.8 MB   | Chaotic, gambits                |
| Maia 1700            | 64x6-SE            | 1700           | 3.3 MB   | 2.4 MB   | Human-like at 1700              |
| Maia 1800            | 64x6-SE            | 1800           | 3.3 MB   | 2.3 MB   | Human-like at 1800              |
| Maia 1900            | 64x6-SE            | 1900           | 3.3 MB   | 2.3 MB   | Human-like at 1900              |
| Good Gyal 5          | 48x5               | ~1800–1900     | 2.2 MB   | 1.8 MB   | Balanced, positional            |
| 11258-48x5-SE        | 48x5-SE            | ~1800–1900     | 16.5 MB  | 9.3 MB   | Distilled T10, mid-range        |
| Bad Gyal 3           | 64x6               | ~1900–2050     | 3.4 MB   | 2.8 MB   | Aggressive, compact             |
| 11258-64x6-SE        | 64x6-SE            | ~2000–2100     | 17.5 MB  | 10.1 MB  | Strong amateur                  |
| 11258-80x7-SE        | 80x7-SE            | ~2100–2200     | 19.0 MB  | 11.4 MB  | Strong tactical play            |
| 11258-96x8-SE        | 96x8-SE            | ~2150–2250     | 21.2 MB  | 13.2 MB  | Expert territory                |
| 11258-104x9-SE       | 104x9-SE           | ~2200–2300     | 22.9 MB  | 14.6 MB  | Near peak small SE              |
| 11258-112x9-SE       | 112x9-SE           | ~2250–2350     | 24.0 MB  | 15.6 MB  | Near-master                     |
| Ender v2             | 112x9-SE           | ~2200–2300     | 24.0 MB  | 16.1 MB  | Endgame specialist              |
| 32930-112x9-SE       | 112x9-SE           | ~2250–2350     | 24.0 MB  | 15.5 MB  | Alt distillation from 32930     |
| 11258-112x10-SE      | 112x10-SE          | ~2250–2350     | 24.9 MB  | 16.6 MB  | Deeper calculation              |
| Maia 2200            | 64x6-SE            | 2200           | 3.3 MB   | 2.2 MB   | Human-like at 2200              |
| Maia 2200 Hunter     | 64x6-SE            | 2200           | 3.3 MB   | 2.3 MB   | Fine-tuned on personal games    |
| T70 703810           | 128x10             | ~2200–2350     | 14.4 MB  | 12.0 MB  | Classic Lc0 self-play           |
| 11258-120x9-SE       | 120x9-SE           | ~2250–2350     | 25.3 MB  | 16.6 MB  | Wider filters than 112x9        |
| 11258-128x9-SE       | 128x9-SE           | ~2250–2350     | 26.6 MB  | 17.6 MB  | Largest 9-block variant         |
| 11258-120x10-SE      | 120x10-SE          | ~2250–2350     | 26.3 MB  | 17.5 MB  | 10 blocks, 120 filters          |
| Bad Gyal 4a          | 128x10             | ~2250–2400     | 14.1 MB  | 12.2 MB  | Aggressive, human-like          |
| Bad Gyal 6           | 128x10             | ~2250–2400     | 14.1 MB  | 12.1 MB  | Tactical, initiative-focused    |
| 11258-128x10-SE      | 128x10-SE          | ~2250–2350     | 27.8 MB  | 18.6 MB  | Largest 11258 series            |
| 11258-128x10-SE-SWA  | 128x10-SE          | ~2250–2350     | 27.8 MB  | 18.6 MB  | SWA variant, smoother play      |
| Little Demon 2       | 128x10-SE          | ~2291 STS      | 14.1 MB  | 11.9 MB  | Well-rounded                    |
| Bad Gyal 7           | 128x10             | ~2300–2450     | 14.1 MB  | 12.1 MB  | Aggressive, human-like          |
| Bad Gyal 8           | 128x10             | ~2300–2450     | 14.1 MB  | 12.2 MB  | Strongest Lichess-trained       |
| 11248-128x10-SE      | 128x10-SE          | ~2300–2400     | 27.8 MB  | 18.9 MB  | Distilled from 11248            |
| Good Gyal 6          | 192x16             | ~2400–2500     | 45.2 MB  | 38.3 MB  | Balanced, positional            |
| Good Gyal 7          | 192x16             | ~2400–2500     | 45.2 MB  | 38.4 MB  | Refined positional play         |
| 11248-256x12-SE      | 256x12-SE          | ~2500–2600     | 71.7 MB  | 53.4 MB  | Large distilled                 |
| T71.4 Fischer Random | 256x19-SE          | ~2500          | 92.6 MB  | 72.8 MB  | Chess960 specialist             |
| T71.5 Armageddon     | 256x19-SE          | ~2500          | 92.6 MB  | 71.0 MB  | Armageddon specialist           |
| T42850               | 256x20             | ~2525–2581 STS | 130.3 MB | 93.6 MB  | Deep positional                 |
| Leelenstein 15.0     | 256x20-SE          | ~2585 STS      | 216 MB   | 142 MB   | Engine-trained, strong endgames |
| T1-256x10 Distilled  | Transformer 256x10 | ~2600–2800     | 77.1 MB  | 57.4 MB  | Strongest browser net           |

### Experimental (Large Transformers)

These models are extremely large and require WebGPU with significant VRAM. Included for benchmarking browser inference capabilities.

| Network     | Arch                    | Notes                     | ONNX   | Download | GPU Memory |
| ----------- | ----------------------- | ------------------------- | ------ | -------- | ---------- |
| T1-512x15   | Transformer 512x15x8h   | Medium transformer        | 315 MB | 223 MB   | 1.8 GB     |
| t3-512x15   | Transformer 512x15x16h  | 16 attention heads        | 326 MB | 225 MB   | 1.8 GB     |
| T82-768x15  | Transformer 768x15x24h  | 24 heads, mish activation | 361 MB | 251 MB   | 2.4 GB     |
| BT3-768x15  | Transformer 768x15x24h  | TCEC S25 Superfinal       | 391 MB | 278 MB   | 2.6 GB     |
| BT4-1024x15 | Transformer 1024x15x32h | TCEC S26, strongest Leela | 707 MB | 473 MB   | 4 GB       |

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

**Known issue:** lc0's ONNX export (observed with Leelenstein 15.0, 256x20-SE) can produce models with value head tensors (`/value/conv/w/kernel`, `/value/conv/w/bias`, `/value/dense1/matmul/w`) stored as float64 but declared as float32 in the metadata. This causes onnxruntime-web to fail with `endian_utils.cc:67 CopyLittleEndian source and destination buffer size mismatch`. Fix with:

```python
import onnx
import numpy as np

model = onnx.load("model.onnx")
elem_sizes = {1: 4, 7: 8, 10: 2, 11: 8}
for init in model.graph.initializer:
    if init.raw_data and init.data_type == 1:  # float32
        expected = 1
        for d in init.dims:
            expected *= d
        if len(init.raw_data) == expected * 8:  # actually float64
            init.raw_data = np.frombuffer(init.raw_data, dtype=np.float64).astype(np.float32).tobytes()
onnx.save(model, "model-fixed.onnx")
```

## Tech Stack

- React + TypeScript + Vite
- [chess.js](https://github.com/jhlywa/chess.js) — Move validation and game logic
- [react-chessboard](https://github.com/Clariity/react-chessboard) — Board UI
- [onnxruntime-web](https://github.com/microsoft/onnxruntime) — Neural network inference (WebGPU + WASM)
- [idb](https://github.com/nicedoc/idb) — IndexedDB model caching
- Tailwind CSS
