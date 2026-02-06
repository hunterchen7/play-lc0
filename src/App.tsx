import { useState, useEffect, useRef, useCallback } from "react";
import { Chess } from "chess.js";
import type { PieceDropHandlerArgs } from "react-chessboard";
import { Board } from "./components/Board";
import { Controls } from "./components/Controls";
import { StatusBar } from "./components/StatusBar";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { NetworkPicker } from "./components/NetworkPicker";
import { MoveHistory } from "./components/MoveHistory";
import { Lc0Engine } from "./engine/workerInterface";
import { getLegalMovesUCI, uciToChessJsMove } from "./utils/chess";
import type { EngineState } from "./types";

export interface NetworkInfo {
  id: string;
  name: string;
  arch: string;
  file: string;
  size: string;
  downloadSize: string;
  elo: string;
  description: string;
  source: string;
}

export const NETWORKS: NetworkInfo[] = [
  // ── Tiny / Beginner ──────────────────────────────────────────────
  {
    id: "tiny-gyal",
    name: "Tiny Gyal",
    arch: "16x2",
    file: "tiny-gyal.onnx",
    size: "1.1 MB",
    downloadSize: "791 KB",
    elo: "~800–1000",
    description:
      "Trained on Lichess human games. Very weak — blunders freely. Great for absolute beginners.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/tiny-gyal-8",
  },
  {
    id: "11258-16x2-se",
    name: "11258-16x2-SE",
    arch: "16x2-SE",
    file: "11258-16x2-se.onnx",
    size: "15.6 MB",
    downloadSize: "8.9 MB",
    elo: "~800–1000",
    description:
      "Smallest distilled net from T10. SE blocks give slightly better positional sense than Tiny Gyal at the same Elo.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/11258-16x2-se",
  },
  {
    id: "maia-1100",
    name: "Maia 1100",
    arch: "64x6-SE",
    file: "maia-1100.onnx",
    size: "3.3 MB",
    downloadSize: "2.4 MB",
    elo: "1100",
    description:
      "Human-like play at 1100 Lichess rating. Trained to predict human moves, not play optimally.",
    source: "https://github.com/CSSLab/maia-chess/releases/tag/v1.0",
  },
  // ── Novice ───────────────────────────────────────────────────────
  {
    id: "mean-girl-8",
    name: "Mean Girl 8",
    arch: "128x10",
    file: "mean-girl-8.onnx",
    size: "1.5 MB",
    downloadSize: "1.2 MB",
    elo: "~1200–1400",
    description:
      'The "most fun" Leela net — unorthodox, aggressive chess with tricky attacks and unusual sacrifices.',
    source:
      "https://github.com/dkappe/leela-chess-weights/wiki/Mean-Girl:--the-most-fun-leela-style-net",
  },
  {
    id: "11258-24x3-se",
    name: "11258-24x3-SE",
    arch: "24x3-SE",
    file: "11258-24x3-se.onnx",
    size: "15.7 MB",
    downloadSize: "8.9 MB",
    elo: "~1200–1400",
    description:
      "Distilled T10 net. Slightly larger than 16x2; starts showing basic tactical awareness.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/11258-24x3-se",
  },
  {
    id: "maia-1200",
    name: "Maia 1200",
    arch: "64x6-SE",
    file: "maia-1200.onnx",
    size: "3.3 MB",
    downloadSize: "2.3 MB",
    elo: "1200",
    description:
      "Human-like play at 1200 Lichess rating. Trained to predict human moves, not play optimally.",
    source: "https://github.com/CSSLab/maia-chess/releases/tag/v1.0",
  },
  {
    id: "maia-1300",
    name: "Maia 1300",
    arch: "64x6-SE",
    file: "maia-1300.onnx",
    size: "3.3 MB",
    downloadSize: "2.3 MB",
    elo: "1300",
    description:
      "Human-like play at 1300 Lichess rating. Trained to predict human moves, not play optimally.",
    source: "https://github.com/CSSLab/maia-chess/releases/tag/v1.0",
  },
  // ── Casual ───────────────────────────────────────────────────────
  {
    id: "11258-32x4-se",
    name: "11258-32x4-SE",
    arch: "32x4-SE",
    file: "11258-32x4-se.onnx",
    size: "15.9 MB",
    downloadSize: "9.0 MB",
    elo: "~1500–1700",
    description:
      "Distilled T10 net. Plays reasonably solid chess but beatable by intermediate club players.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/11258-32x4-se",
  },
  {
    id: "maia-1400",
    name: "Maia 1400",
    arch: "64x6-SE",
    file: "maia-1400.onnx",
    size: "3.3 MB",
    downloadSize: "2.4 MB",
    elo: "1400",
    description:
      "Human-like play at 1400 Lichess rating. Trained to predict human moves, not play optimally.",
    source: "https://github.com/CSSLab/maia-chess/releases/tag/v1.0",
  },
  {
    id: "maia-1500",
    name: "Maia 1500",
    arch: "64x6-SE",
    file: "maia-1500.onnx",
    size: "3.3 MB",
    downloadSize: "2.3 MB",
    elo: "1500",
    description:
      "Human-like play at 1500 Lichess rating. Trained to predict human moves, not play optimally.",
    source: "https://github.com/CSSLab/maia-chess/releases/tag/v1.0",
  },
  // ── Intermediate ─────────────────────────────────────────────────
  {
    id: "maia-1600",
    name: "Maia 1600",
    arch: "64x6-SE",
    file: "maia-1600.onnx",
    size: "3.3 MB",
    downloadSize: "2.4 MB",
    elo: "1600",
    description:
      "Human-like play at 1600 Lichess rating. Trained to predict human moves, not play optimally.",
    source: "https://github.com/CSSLab/maia-chess/releases/tag/v1.0",
  },
  {
    id: "evilgyal-6",
    name: "Evil Gyal 6",
    arch: "48x5",
    file: "evilgyal-6.onnx",
    size: "2.2 MB",
    downloadSize: "1.8 MB",
    elo: "~1700–1800",
    description:
      "Lichess-trained net with a chaotic, unpredictable style. Loves gambits and piece activity over material.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/evilgyal-6",
  },
  {
    id: "maia-1700",
    name: "Maia 1700",
    arch: "64x6-SE",
    file: "maia-1700.onnx",
    size: "3.3 MB",
    downloadSize: "2.4 MB",
    elo: "1700",
    description:
      "Human-like play at 1700 Lichess rating. Trained to predict human moves, not play optimally.",
    source: "https://github.com/CSSLab/maia-chess/releases/tag/v1.0",
  },
  {
    id: "maia-1800",
    name: "Maia 1800",
    arch: "64x6-SE",
    file: "maia-1800.onnx",
    size: "3.3 MB",
    downloadSize: "2.3 MB",
    elo: "1800",
    description:
      "Human-like play at 1800 Lichess rating. Trained to predict human moves, not play optimally.",
    source: "https://github.com/CSSLab/maia-chess/releases/tag/v1.0",
  },
  {
    id: "maia-1900",
    name: "Maia 1900",
    arch: "64x6-SE",
    file: "maia-1900.onnx",
    size: "3.3 MB",
    downloadSize: "2.3 MB",
    elo: "1900",
    description:
      "Human-like play at 1900 Lichess rating. Trained to predict human moves, not play optimally.",
    source: "https://github.com/CSSLab/maia-chess/releases/tag/v1.0",
  },
  {
    id: "goodgyal-5",
    name: "Good Gyal 5",
    arch: "48x5",
    file: "goodgyal-5.onnx",
    size: "2.2 MB",
    downloadSize: "1.8 MB",
    elo: "~1800–1900",
    description:
      'Lichess-trained net with balanced, positional play. The "good" sister to the aggressive Gyal family.',
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/good-gyal-5",
  },
  {
    id: "11258-48x5-se",
    name: "11258-48x5-SE",
    arch: "48x5-SE",
    file: "11258-48x5-se.onnx",
    size: "16.5 MB",
    downloadSize: "9.3 MB",
    elo: "~1800–1900",
    description:
      "Distilled T10 net. Mid-range — developing real positional understanding and basic endgame technique.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/11258-48x5-se",
  },
  // ── Club Player ──────────────────────────────────────────────────
  {
    id: "badgyal-3",
    name: "Bad Gyal 3",
    arch: "64x6",
    file: "badgyal-3.onnx",
    size: "3.4 MB",
    downloadSize: "2.8 MB",
    elo: "~1900–2050",
    description:
      "Early Bad Gyal — smaller 64x6 architecture. Aggressive human-like style in a compact package.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/bad-gyal-3",
  },
  {
    id: "11258-64x6-se",
    name: "11258-64x6-SE",
    arch: "64x6-SE",
    file: "11258-64x6-se.onnx",
    size: "17.5 MB",
    downloadSize: "10.1 MB",
    elo: "~2000–2100",
    description:
      "Distilled T10 net. Solid amateur-level play with good positional understanding.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/11258-64x6-se",
  },
  // ── Advanced ─────────────────────────────────────────────────────
  {
    id: "11258-80x7-se",
    name: "11258-80x7-SE",
    arch: "80x7-SE",
    file: "11258-80x7-se.onnx",
    size: "19.0 MB",
    downloadSize: "11.4 MB",
    elo: "~2100–2200",
    description:
      "Distilled T10 net. Strong tactical play with improving endgame technique. CCRL 2977 with search.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/11258-80x7-se",
  },
  {
    id: "11258-96x8-se",
    name: "11258-96x8-SE",
    arch: "96x8-SE",
    file: "11258-96x8-se.onnx",
    size: "21.2 MB",
    downloadSize: "13.2 MB",
    elo: "~2150–2250",
    description:
      "Distilled T10 net. Getting into expert territory — accurate calculation and solid positional judgment.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/11258-96x8-se",
  },
  // ── Expert ───────────────────────────────────────────────────────
  {
    id: "11258-104x9-se",
    name: "11258-104x9-SE",
    arch: "104x9-SE",
    file: "11258-104x9-se.onnx",
    size: "22.9 MB",
    downloadSize: "14.6 MB",
    elo: "~2200–2300",
    description:
      "Distilled T10 net. Very strong policy head — near the peak of what small SE nets can achieve.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/11258-104x9-se",
  },
  {
    id: "11258-112x9-se",
    name: "11258-112x9-SE",
    arch: "112x9-SE",
    file: "11258-112x9-se.onnx",
    size: "24.0 MB",
    downloadSize: "15.6 MB",
    elo: "~2250–2350",
    description:
      "Distilled T10 net. Clean, precise play with strong endgame technique. CCRL 2988 with search.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/11258-112x9-se",
  },
  {
    id: "ender-112x9-se",
    name: "Ender v2",
    arch: "112x9-SE",
    file: "ender-112x9-se.onnx",
    size: "24.0 MB",
    downloadSize: "16.1 MB",
    elo: "~2200–2300",
    description:
      "Endgame specialist network. Excels at converting advantages in simplified positions.",
    source: "https://github.com/dkappe/leela-chess-weights/wiki/Ender-v2",
  },
  {
    id: "32930-112x9-se",
    name: "32930-112x9-SE",
    arch: "112x9-SE",
    file: "32930-112x9-se.onnx",
    size: "24.0 MB",
    downloadSize: "15.5 MB",
    elo: "~2250–2350",
    description:
      "Alternative distillation (from net 32930) at the same 112x9-SE size. Slightly different style than 11258.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/32930-112x9-se",
  },
  {
    id: "11258-112x10-se",
    name: "11258-112x10-SE",
    arch: "112x10-SE",
    file: "11258-112x10-se.onnx",
    size: "24.9 MB",
    downloadSize: "16.6 MB",
    elo: "~2250–2350",
    description:
      "Distilled T10 net. Extra residual block vs 112x9 gives slightly deeper calculation. CCRL 2966 with search.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/11258-112x10-se",
  },
  {
    id: "maia-2200",
    name: "Maia 2200",
    arch: "64x6-SE",
    file: "maia-2200.onnx",
    size: "3.3 MB",
    downloadSize: "2.2 MB",
    elo: "2200",
    description:
      "Human-like play at 2200 Lichess rating. Trained to predict human moves, not play optimally.",
    source: "https://github.com/CallOn84/LeelaNets",
  },
  {
    id: "maia2200-hunter",
    name: "Maia 2200 Hunter",
    arch: "64x6-SE",
    file: "maia2200-64x6-hunter-20000.onnx",
    size: "3.3 MB",
    downloadSize: "2.3 MB",
    elo: "2200",
    description:
      "Maia 2200 fine-tuned on ~2000 of my online blitz and rapid games (20k steps, batch 128).",
    source: "Custom fine-tuned model",
  },
  // ── Master ───────────────────────────────────────────────────────
  {
    id: "t70-703810",
    name: "T70 703810",
    arch: "128x10",
    file: "t70-703810.onnx",
    size: "14.4 MB",
    downloadSize: "12.0 MB",
    elo: "~2200–2350",
    description:
      "Official Lc0 training run T70. Pure RL self-play net — classic Lc0 positional style.",
    source:
      "https://training.lczero.org/get_network?sha=b30e742bcfd905815e0e7dbd4e1bafb41ade748f85d006b8e28758f1a3107ae3",
  },
  {
    id: "11258-120x9-se",
    name: "11258-120x9-SE",
    arch: "120x9-SE",
    file: "11258-120x9-se.onnx",
    size: "25.3 MB",
    downloadSize: "16.6 MB",
    elo: "~2250–2350",
    description:
      "Distilled T10 net. Wider filters than 112x9 for better pattern recognition. CCRL 2981 with search.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/11258-120x9-se",
  },
  {
    id: "11258-128x9-se",
    name: "11258-128x9-SE",
    arch: "128x9-SE",
    file: "11258-128x9-se.onnx",
    size: "26.6 MB",
    downloadSize: "17.6 MB",
    elo: "~2250–2350",
    description:
      "Distilled T10 net. Largest 9-block variant — more filters with diminishing returns. CCRL 2958 with search.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/11258-128x9-se",
  },
  {
    id: "11258-120x10-se",
    name: "11258-120x10-SE",
    arch: "120x10-SE",
    file: "11258-120x10-se.onnx",
    size: "26.3 MB",
    downloadSize: "17.5 MB",
    elo: "~2250–2350",
    description:
      "Distilled T10 net. 10-block depth with 120 filters. CCRL 2946 with search.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/11258-120x10-se",
  },
  {
    id: "badgyal-4a",
    name: "Bad Gyal 4a",
    arch: "128x10",
    file: "badgyal-4a.onnx",
    size: "14.1 MB",
    downloadSize: "12.2 MB",
    elo: "~2250–2400",
    description:
      "Lichess-trained 128x10 net. Earlier Bad Gyal generation — aggressive, human-like style.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/bad-gyal-4a",
  },
  {
    id: "badgyal-6",
    name: "Bad Gyal 6",
    arch: "128x10",
    file: "badgyal-6.onnx",
    size: "14.1 MB",
    downloadSize: "12.1 MB",
    elo: "~2250–2400",
    description:
      "Lichess-trained net. Swashbuckling tactical style — prefers activity and initiative over material.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/bad-gyal-6",
  },
  {
    id: "11258-128x10-se",
    name: "11258-128x10-SE",
    arch: "128x10-SE",
    file: "11258-128x10-se.onnx",
    size: "27.8 MB",
    downloadSize: "18.6 MB",
    elo: "~2250–2350",
    description:
      "Distilled T10 net. Largest in the 11258 series. CCRL 2937 with search.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/11258-128x10-se",
  },
  {
    id: "11258-128x10-se-swa",
    name: "11258-128x10-SE-SWA",
    arch: "128x10-SE",
    file: "11258-128x10-se-swa.onnx",
    size: "27.8 MB",
    downloadSize: "18.6 MB",
    elo: "~2250–2350",
    description:
      "SWA (Stochastic Weight Averaging) variant of 128x10 — smoother, more consistent play. CCRL 2904 with search.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/11258-128x10-se",
  },
  {
    id: "LD2",
    name: "Little Demon 2",
    arch: "128x10-SE",
    file: "LD2.onnx",
    size: "14.1 MB",
    downloadSize: "11.9 MB",
    elo: "~2291 STS",
    description:
      "Community-contributed net. Well-rounded play with strong strategic test suite scores.",
    source: "https://storage.lczero.org/files/networks-contrib/",
  },
  {
    id: "badgyal-7",
    name: "Bad Gyal 7",
    arch: "128x10",
    file: "badgyal-7.onnx",
    size: "14.1 MB",
    downloadSize: "12.1 MB",
    elo: "~2300–2450",
    description:
      "Penultimate Bad Gyal — aggressive, human-like play trained on Lichess games. CCRL ~3300 at 800 nodes.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/bad-gyal-7",
  },
  {
    id: "bad-gyal-8",
    name: "Bad Gyal 8",
    arch: "128x10",
    file: "bad-gyal-8.onnx",
    size: "14.1 MB",
    downloadSize: "12.2 MB",
    elo: "~2300–2450",
    description:
      "Latest Bad Gyal — swashbuckling, aggressive chess. The strongest Lichess-trained human-style net.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/bad-gyal-8",
  },
  {
    id: "11248-128x10-se",
    name: "11248-128x10-SE",
    arch: "128x10-SE",
    file: "11248-128x10-se.onnx",
    size: "27.8 MB",
    downloadSize: "18.9 MB",
    elo: "~2300–2400",
    description:
      "Distilled from net 11248 with CCRL data. Alternative distillation to 11258 — slightly different style.",
    source: "http://hforsten.com/leelaz/128x10-se-distill-ccrl-11248.pb.gz",
  },
  // ── Strong ───────────────────────────────────────────────────────
  {
    id: "goodgyal-6",
    name: "Good Gyal 6",
    arch: "192x16",
    file: "goodgyal-6.onnx",
    size: "45.2 MB",
    downloadSize: "38.3 MB",
    elo: "~2400–2500",
    description:
      "Large Lichess-trained net with balanced, positional play. Needs WebGPU for good performance.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/good-gyal-6",
  },
  {
    id: "goodgyal-7",
    name: "Good Gyal 7",
    arch: "192x16",
    file: "goodgyal-7.onnx",
    size: "45.2 MB",
    downloadSize: "38.4 MB",
    elo: "~2400–2500",
    description:
      "Latest Good Gyal — refined positional play from Lichess training. Needs WebGPU for good performance.",
    source:
      "https://github.com/dkappe/leela-chess-weights/releases/tag/good-gyal-7",
  },
  {
    id: "11248-256x12-se",
    name: "11248-256x12-SE",
    arch: "256x12-SE",
    file: "11248-256x12-se.onnx",
    size: "71.7 MB",
    downloadSize: "53.4 MB",
    elo: "~2500–2600",
    description:
      "Large distilled net from 11248 with CCRL data. Strong positional play. Requires WebGPU.",
    source: "http://hforsten.com/leelaz/256x12-se-distill-ccrl-11248.pb.gz",
  },
  // ── Specialty ────────────────────────────────────────────────────
  {
    id: "t71-frc",
    name: "T71.4 Fischer Random",
    arch: "256x19-SE",
    file: "t71-frc.onnx",
    size: "92.6 MB",
    downloadSize: "72.8 MB",
    elo: "~2500",
    description:
      "Trained specifically for Chess960 (Fischer Random). Standard chess works too but FRC is its strength. Requires WebGPU.",
    source:
      "https://training.lczero.org/get_network?sha=32d49c67db759a8794042a53d675e5c757a319ae696153b95970ab6099d8fc2d",
  },
  {
    id: "t71-armageddon",
    name: "T71.5 Armageddon",
    arch: "256x19-SE",
    file: "t71-armageddon.onnx",
    size: "92.6 MB",
    downloadSize: "71.0 MB",
    elo: "~2500",
    description:
      "Trained for Armageddon chess (Black wins on draw). Plays aggressively as White, solidly as Black. Requires WebGPU.",
    source:
      "https://training.lczero.org/get_network?sha=cb4dcd82a72472daefaca85b7580ef73a7a4eda58e0d1de22e342d4d5874ff07",
  },
  // ── Grandmaster ──────────────────────────────────────────────────
  {
    id: "t42850",
    name: "T42850",
    arch: "256x20",
    file: "t42850.onnx",
    size: "130.3 MB",
    downloadSize: "93.6 MB",
    elo: "~2525–2581 STS",
    description:
      "Classic large Lc0 net. Deep positional understanding with smooth, strategic play. Requires WebGPU.",
    source:
      "https://storage.lczero.org/files/networks/00af53b081e80147172e6f281c01daf5ca19ada173321438914c730370aa4267",
  },
  {
    id: "t1-256x10-distilled",
    name: "T1-256x10 Distilled",
    arch: "Transformer 256x10",
    file: "t1-256x10-distilled.onnx",
    size: "77.1 MB",
    downloadSize: "57.4 MB",
    elo: "~2600–2800",
    description:
      "Transformer architecture — dramatically stronger policy head than any CNN. Best practical browser net. Requires WebGPU.",
    source:
      "https://storage.lczero.org/files/networks-contrib/t1-256x10-distilled-swa-2432500.pb.gz",
  },
];

const INITIAL_ENGINE_STATE: EngineState = {
  isReady: false,
  isThinking: false,
  isLoading: false,
  loadingProgress: 0,
  loadingMessage: "",
  lastMove: null,
  lastConfidence: null,
  wdl: null,
  error: null,
};

function getGameStatus(game: Chess): string {
  if (game.isCheckmate()) return "Checkmate";
  if (game.isStalemate()) return "Stalemate";
  if (game.isDraw()) return "Draw";
  if (game.isCheck()) return "Check";
  return game.turn() === "w" ? "White's turn" : "Black's turn";
}

interface GameConfig {
  network: NetworkInfo;
  playerColor: "w" | "b";
  temperature: number;
}

export default function App() {
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);

  if (!gameConfig) {
    return (
      <NetworkPicker
        onStart={(network, color, temperature) =>
          setGameConfig({ network, playerColor: color, temperature })
        }
      />
    );
  }

  return (
    <GameScreen
      key={gameConfig.network.id + gameConfig.playerColor}
      config={gameConfig}
      onBackToMenu={() => setGameConfig(null)}
    />
  );
}

export interface SavedGame {
  date: string;
  network: string;
  playerColor: "w" | "b";
  result: string;
  pgn: string;
  moves: string[];
}

export function getSavedGames(): SavedGame[] {
  try {
    return JSON.parse(localStorage.getItem("lc0-games") || "[]");
  } catch {
    return [];
  }
}

function saveGame(game: SavedGame) {
  const games = getSavedGames();
  games.unshift(game);
  // Keep last 50 games
  localStorage.setItem("lc0-games", JSON.stringify(games.slice(0, 50)));
}

function buildPgn(
  moves: string[],
  config: GameConfig,
  result: string,
  actualPlayerColor: "w" | "b",
): string {
  const date = new Date();
  const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  const white = actualPlayerColor === "w" ? "You" : config.network.name;
  const black = actualPlayerColor === "b" ? "You" : config.network.name;

  let pgn = `[Event "Play Lc0"]\n`;
  pgn += `[Site "Browser"]\n`;
  pgn += `[Date "${dateStr}"]\n`;
  pgn += `[White "${white}"]\n`;
  pgn += `[Black "${black}"]\n`;
  pgn += `[Result "${result}"]\n\n`;

  for (let i = 0; i < moves.length; i++) {
    if (i % 2 === 0) pgn += `${Math.floor(i / 2) + 1}. `;
    pgn += `${moves[i]} `;
  }
  pgn += result;

  return pgn;
}

function getResult(game: Chess): string {
  if (!game.isGameOver()) return "*";
  if (game.isCheckmate()) return game.turn() === "w" ? "0-1" : "1-0";
  return "1/2-1/2";
}

function GameScreen({
  config,
  onBackToMenu,
}: {
  config: GameConfig;
  onBackToMenu: () => void;
}) {
  const [game, setGame] = useState(new Chess());
  const [engineState, setEngineState] =
    useState<EngineState>(INITIAL_ENGINE_STATE);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(
    config.playerColor === "w" ? "white" : "black",
  );
  const [fenHistory, setFenHistory] = useState<string[]>([new Chess().fen()]);
  const [moveHistory, setMoveHistory] = useState<string[]>([]); // SAN moves
  const [lastMoveAlgebraic, setLastMoveAlgebraic] = useState<string | null>(
    null,
  );
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [temperature, setTemperature] = useState(config.temperature);
  const [viewingMove, setViewingMove] = useState<number | null>(null); // null = live
  const [gameSaved, setGameSaved] = useState(false);
  const [hasResigned, setHasResigned] = useState(false);
  const [playerColor, setPlayerColor] = useState(config.playerColor);
  const engineRef = useRef<Lc0Engine | null>(null);

  // The position to show on the board
  // viewingMove is the move index (0-based), fenHistory[0] is start pos, fenHistory[moveIndex+1] is pos after that move
  // viewingMove = -1 means start position, null means live
  const displayFen =
    viewingMove === null
      ? game.fen()
      : (fenHistory[viewingMove + 1] ?? fenHistory[0]);
  const isViewingHistory = viewingMove !== null;

  // Arrow key navigation for move history
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (moveHistory.length === 0) return;
      const current = viewingMove ?? moveHistory.length - 1;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setViewingMove(Math.max(-1, current - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (current < moveHistory.length - 1) {
          setViewingMove(current + 1);
        } else {
          setViewingMove(null);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setViewingMove(-1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setViewingMove(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moveHistory.length, viewingMove]);

  // Initialize engine with selected model
  useEffect(() => {
    const engine = new Lc0Engine();
    engineRef.current = engine;

    const unsub = engine.subscribe((partial) => {
      setEngineState((prev) => ({ ...prev, ...partial }));
    });

    engine.init(`/models/${config.network.file}`);

    return () => {
      unsub();
      engine.terminate();
    };
  }, [config.network.file]);

  // Request engine move
  const requestEngineMove = useCallback(
    async (currentGame: Chess, history: string[]) => {
      const engine = engineRef.current;
      if (!engine || currentGame.isGameOver()) return;

      const fen = currentGame.fen();
      const legalMoves = getLegalMovesUCI(fen);
      if (legalMoves.length === 0) return;

      try {
        const result = await engine.getBestMove(
          fen,
          history,
          legalMoves,
          temperature,
        );

        const moveData = uciToChessJsMove(result.move);
        const newGame = new Chess(currentGame.fen());
        const move = newGame.move(moveData);

        if (move) {
          setLastMoveAlgebraic(move.san);
          setMoveHistory((prev) => [...prev, move.san]);
          setGame(newGame);
          setFenHistory((prev) => [...prev, newGame.fen()]);
        }
      } catch (e) {
        console.error("Engine move failed:", e);
      }
    },
    [temperature],
  );

  // Trigger engine move when it's the engine's turn
  useEffect(() => {
    if (
      engineState.isReady &&
      !engineState.isThinking &&
      !game.isGameOver() &&
      !hasResigned &&
      game.turn() !== playerColor
    ) {
      requestEngineMove(game, fenHistory);
    }
  }, [
    game,
    engineState.isReady,
    engineState.isThinking,
    hasResigned,
    playerColor,
    fenHistory,
    requestEngineMove,
  ]);

  // Save game to localStorage when game is over
  useEffect(() => {
    if (game.isGameOver() && !gameSaved && moveHistory.length > 0) {
      const result = getResult(game);
      const pgn = buildPgn(moveHistory, config, result, playerColor);
      saveGame({
        date: new Date().toISOString(),
        network: config.network.name,
        playerColor: playerColor,
        result,
        pgn,
        moves: moveHistory,
      });
      setGameSaved(true);
    }
  }, [game, gameSaved, moveHistory, config, playerColor]);

  // Check if a move is a pawn promotion
  const isPromotion = useCallback(
    (from: string, to: string): boolean => {
      const piece = game.get(from as any);
      if (!piece || piece.type !== "p") return false;
      const toRank = to[1];
      return (
        (piece.color === "w" && toRank === "8") ||
        (piece.color === "b" && toRank === "1")
      );
    },
    [game],
  );

  // Complete a promotion move with the chosen piece
  const completePromotion = useCallback(
    (promotion: "q" | "r" | "b" | "n") => {
      if (!pendingPromotion) return;
      const newGame = new Chess(game.fen());
      const move = newGame.move({
        from: pendingPromotion.from,
        to: pendingPromotion.to,
        promotion,
      });
      setPendingPromotion(null);
      if (!move) return;
      setMoveHistory((prev) => [...prev, move.san]);
      setGame(newGame);
      setFenHistory((prev) => [...prev, newGame.fen()]);
    },
    [game, pendingPromotion],
  );

  // Handle player piece drop
  const onPieceDrop = useCallback(
    ({ piece, sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
      if (isViewingHistory) return false; // can't move while viewing history
      if (!targetSquare) return false;

      const isWhitePiece =
        piece.pieceType[0] === "W" || piece.pieceType[0] === "w";
      if (
        (playerColor === "w" && !isWhitePiece) ||
        (playerColor === "b" && isWhitePiece)
      ) {
        return false;
      }

      if (engineState.isThinking || game.isGameOver() || hasResigned)
        return false;
      if (game.turn() !== playerColor) return false;

      // Check if this is a valid move at all (try with queen promotion)
      const testGame = new Chess(game.fen());
      const testMove = testGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });
      if (!testMove) return false;

      // If it's a promotion, show the picker instead of auto-queening
      if (isPromotion(sourceSquare, targetSquare)) {
        setPendingPromotion({ from: sourceSquare, to: targetSquare });
        return false; // don't move the piece yet
      }

      const newGame = new Chess(game.fen());
      const move = newGame.move({
        from: sourceSquare,
        to: targetSquare,
      });

      if (!move) return false;

      setMoveHistory((prev) => [...prev, move.san]);
      setGame(newGame);
      setFenHistory((prev) => [...prev, newGame.fen()]);

      return true;
    },
    [
      game,
      playerColor,
      engineState.isThinking,
      hasResigned,
      isPromotion,
      isViewingHistory,
    ],
  );

  const handleNewGame = useCallback(() => {
    const newColor = playerColor === "w" ? "b" : "w";
    setPlayerColor(newColor);
    setBoardOrientation(newColor === "w" ? "white" : "black");
    const newGame = new Chess();
    setGame(newGame);
    setFenHistory([newGame.fen()]);
    setMoveHistory([]);
    setLastMoveAlgebraic(null);
    setViewingMove(null);
    setGameSaved(false);
    setHasResigned(false);
    setEngineState((prev) => ({
      ...prev,
      lastMove: null,
      lastConfidence: null,
      wdl: null,
      error: null,
      isThinking: false,
    }));
  }, [playerColor]);

  const handleFlipBoard = useCallback(() => {
    setBoardOrientation((prev) => (prev === "white" ? "black" : "white"));
  }, []);

  const handleResign = useCallback(() => {
    if (game.isGameOver() || gameSaved || hasResigned) return;

    // Create a resigned result: if player is white, black wins (0-1), else white wins (1-0)
    const resignResult = playerColor === "w" ? "0-1" : "1-0";
    const pgn = buildPgn(moveHistory, config, resignResult, playerColor);

    saveGame({
      date: new Date().toISOString(),
      network: config.network.name,
      playerColor: playerColor,
      result: resignResult,
      pgn,
      moves: moveHistory,
    });
    setGameSaved(true);
    setHasResigned(true);
  }, [game, gameSaved, hasResigned, playerColor, moveHistory, config]);

  const isEnginesTurn = game.turn() !== playerColor;
  const disabled =
    isViewingHistory ||
    isEnginesTurn ||
    engineState.isThinking ||
    game.isGameOver() ||
    hasResigned ||
    !engineState.isReady;

  const gameOver = game.isGameOver() || hasResigned;
  const pgn = gameOver
    ? buildPgn(
        moveHistory,
        config,
        hasResigned ? (playerColor === "w" ? "0-1" : "1-0") : getResult(game),
        playerColor,
      )
    : null;

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-100">Play Lc0</h1>
        <p className="text-gray-400 text-sm mt-1">
          vs{" "}
          <span className="text-emerald-400 font-medium">
            {config.network.name}
          </span>{" "}
          ({config.network.elo})
        </p>
      </div>

      <div className="flex gap-8 items-start">
        {/* Board with loading overlay */}
        <div className="relative">
          <Board
            position={displayFen}
            onPieceDrop={onPieceDrop}
            boardOrientation={boardOrientation}
            disabled={disabled}
          />
          {isViewingHistory && (
            <div className="absolute top-2 left-2 bg-amber-600/90 text-white text-xs px-2 py-1 rounded z-10">
              Viewing move {(viewingMove ?? 0) + 1} of {moveHistory.length}
            </div>
          )}
          {engineState.isLoading && (
            <LoadingOverlay
              progress={engineState.loadingProgress}
              message={engineState.loadingMessage}
            />
          )}
          {pendingPromotion && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
              <div className="bg-slate-800 rounded-xl p-4 flex gap-2">
                {(["q", "r", "b", "n"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => completePromotion(p)}
                    className="w-16 h-16 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center justify-center text-3xl transition-colors"
                  >
                    {playerColor === "w"
                      ? { q: "\u2655", r: "\u2656", b: "\u2657", n: "\u2658" }[
                          p
                        ]
                      : { q: "\u265B", r: "\u265C", b: "\u265D", n: "\u265E" }[
                          p
                        ]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4 w-64">
          <StatusBar
            engineState={engineState}
            gameStatus={getGameStatus(game)}
            lastMoveAlgebraic={lastMoveAlgebraic}
            playerColor={playerColor}
          />
          <MoveHistory
            moves={moveHistory}
            viewingMove={viewingMove}
            onSelectMove={setViewingMove}
          />
          {pgn && (
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-gray-300">PGN</h3>
              <pre
                className="bg-slate-900 rounded-lg p-2 text-xs text-gray-400 whitespace-pre-wrap break-words max-h-32 overflow-y-auto cursor-pointer hover:text-gray-300 transition-colors"
                onClick={() => navigator.clipboard.writeText(pgn)}
                title="Click to copy"
              >
                {pgn}
              </pre>
            </div>
          )}
          <Controls
            onNewGame={handleNewGame}
            onFlipBoard={handleFlipBoard}
            playerColor={playerColor}
            isGameOver={gameOver}
            temperature={temperature}
            onTemperatureChange={setTemperature}
          />
          <button
            onClick={handleResign}
            disabled={gameOver || isViewingHistory}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors text-sm"
          >
            Resign
          </button>
          <button
            onClick={onBackToMenu}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg font-medium transition-colors text-sm"
          >
            Change Opponent
          </button>
        </div>
      </div>
    </div>
  );
}
