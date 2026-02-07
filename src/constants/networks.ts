export interface NetworkInfo {
  id: string;
  name: string;
  arch: string;
  file: string;
  size: string;
  estimatedRuntimeMb?: number;
  downloadSize: string;
  elo: string;
  description: string;
  source: string;
  url?: string; // Optional: external URL for downloading the model
}

export const NETWORKS: NetworkInfo[] = [
  {
    id: "tiny-gyal",
    name: "Tiny Gyal",
    arch: "16x2",
    file: "tiny-gyal.onnx.bin",
    size: "1.1 MB",
    estimatedRuntimeMb: 25,
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
    file: "11258-16x2-se.onnx.bin",
    size: "15.6 MB",
    estimatedRuntimeMb: 123,
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
    file: "maia-1100.onnx.bin",
    size: "3.3 MB",
    estimatedRuntimeMb: 39,
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
    file: "mean-girl-8.onnx.bin",
    size: "1.5 MB",
    estimatedRuntimeMb: 29,
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
    file: "11258-24x3-se.onnx.bin",
    size: "15.7 MB",
    estimatedRuntimeMb: 124,
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
    file: "maia-1200.onnx.bin",
    size: "3.3 MB",
    estimatedRuntimeMb: 39,
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
    file: "maia-1300.onnx.bin",
    size: "3.3 MB",
    estimatedRuntimeMb: 39,
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
    file: "11258-32x4-se.onnx.bin",
    size: "15.9 MB",
    estimatedRuntimeMb: 125,
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
    file: "maia-1400.onnx.bin",
    size: "3.3 MB",
    estimatedRuntimeMb: 39,
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
    file: "maia-1500.onnx.bin",
    size: "3.3 MB",
    estimatedRuntimeMb: 39,
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
    file: "maia-1600.onnx.bin",
    size: "3.3 MB",
    estimatedRuntimeMb: 39,
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
    file: "evilgyal-6.onnx.bin",
    size: "2.2 MB",
    estimatedRuntimeMb: 33,
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
    file: "maia-1700.onnx.bin",
    size: "3.3 MB",
    estimatedRuntimeMb: 39,
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
    file: "maia-1800.onnx.bin",
    size: "3.3 MB",
    estimatedRuntimeMb: 39,
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
    file: "maia-1900.onnx.bin",
    size: "3.3 MB",
    estimatedRuntimeMb: 38,
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
    file: "goodgyal-5.onnx.bin",
    size: "2.2 MB",
    estimatedRuntimeMb: 33,
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
    file: "11258-48x5-se.onnx.bin",
    size: "16.5 MB",
    estimatedRuntimeMb: 129,
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
    file: "badgyal-3.onnx.bin",
    size: "3.4 MB",
    estimatedRuntimeMb: 40,
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
    file: "11258-64x6-se.onnx.bin",
    size: "17.5 MB",
    estimatedRuntimeMb: 134,
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
    file: "11258-80x7-se.onnx.bin",
    size: "19.0 MB",
    estimatedRuntimeMb: 147,
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
    file: "11258-96x8-se.onnx.bin",
    size: "21.2 MB",
    estimatedRuntimeMb: 160,
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
    file: "11258-104x9-se.onnx.bin",
    size: "22.9 MB",
    estimatedRuntimeMb: 169,
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
    file: "11258-112x9-se.onnx.bin",
    size: "24.0 MB",
    estimatedRuntimeMb: 177,
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
    file: "ender-112x9-se.onnx.bin",
    size: "24.0 MB",
    estimatedRuntimeMb: 177,
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
    file: "32930-112x9-se.onnx.bin",
    size: "24.0 MB",
    estimatedRuntimeMb: 177,
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
    file: "11258-112x10-se.onnx.bin",
    size: "24.9 MB",
    estimatedRuntimeMb: 182,
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
    file: "maia-2200.onnx.bin",
    size: "3.3 MB",
    estimatedRuntimeMb: 39,
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
    file: "maia2200-64x6-hunter-20000.onnx.bin",
    size: "3.3 MB",
    estimatedRuntimeMb: 39,
    downloadSize: "2.3 MB",
    elo: "~2000",
    description:
      "Maia 2200 fine-tuned on ~2000 of my online blitz and rapid games (20k steps, batch 128); this seems to have made it a little dumber.",
    source: "Custom fine-tuned model",
  },
  // ── Master ───────────────────────────────────────────────────────
  {
    id: "t70-703810",
    name: "T70 703810",
    arch: "128x10",
    file: "t70-703810.onnx.bin",
    size: "14.4 MB",
    estimatedRuntimeMb: 105,
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
    file: "11258-120x9-se.onnx.bin",
    size: "25.3 MB",
    estimatedRuntimeMb: 183,
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
    file: "11258-128x9-se.onnx.bin",
    size: "26.6 MB",
    estimatedRuntimeMb: 192,
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
    file: "11258-120x10-se.onnx.bin",
    size: "26.3 MB",
    estimatedRuntimeMb: 190,
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
    file: "badgyal-4a.onnx.bin",
    size: "14.1 MB",
    estimatedRuntimeMb: 104,
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
    file: "badgyal-6.onnx.bin",
    size: "14.1 MB",
    estimatedRuntimeMb: 104,
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
    file: "11258-128x10-se.onnx.bin",
    size: "27.8 MB",
    estimatedRuntimeMb: 199,
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
    file: "11258-128x10-se-swa.onnx.bin",
    size: "27.8 MB",
    estimatedRuntimeMb: 199,
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
    file: "LD2.onnx.bin",
    size: "14.1 MB",
    estimatedRuntimeMb: 104,
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
    file: "badgyal-7.onnx.bin",
    size: "14.1 MB",
    estimatedRuntimeMb: 104,
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
    file: "bad-gyal-8.onnx.bin",
    size: "14.1 MB",
    estimatedRuntimeMb: 104,
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
    file: "11248-128x10-se.onnx.bin",
    size: "27.8 MB",
    estimatedRuntimeMb: 199,
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
    file: "goodgyal-6.onnx.bin",
    size: "45.2 MB",
    estimatedRuntimeMb: 291,
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
    file: "goodgyal-7.onnx.bin",
    size: "45.2 MB",
    estimatedRuntimeMb: 291,
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
    file: "11248-256x12-se.onnx.bin",
    size: "71.7 MB",
    estimatedRuntimeMb: 393,
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
    file: "t71-frc.onnx.bin",
    size: "92.6 MB",
    estimatedRuntimeMb: 461,
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
    file: "t71-armageddon.onnx.bin",
    size: "92.6 MB",
    estimatedRuntimeMb: 459,
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
    file: "t42850.onnx.bin",
    size: "130.3 MB",
    estimatedRuntimeMb: 710,
    downloadSize: "93.6 MB",
    elo: "~2525–2581 STS",
    description:
      "Classic large Lc0 net. Deep positional understanding with smooth, strategic play. Requires WebGPU.",
    source:
      "https://storage.lczero.org/files/networks/00af53b081e80147172e6f281c01daf5ca19ada173321438914c730370aa4267",
  },
  {
    id: "leelenstein-15",
    name: "Leelenstein 15.0",
    arch: "256x20-SE",
    file: "leelenstein-15.onnx.bin",
    size: "216 MB",
    estimatedRuntimeMb: 1267,
    downloadSize: "142 MB",
    elo: "~2585 STS",
    description:
      "Trained on engine games (not self-play). Positional style with excellent endgame technique. Requires WebGPU.",
    source: "https://www.patreon.com/posts/leelenstein-15-0-38164065",
  },
  {
    id: "t1-256x10-distilled",
    name: "T1-256x10 Distilled",
    arch: "Transformer 256x10",
    file: "t1-256x10-distilled.onnx.bin",
    size: "77.1 MB",
    estimatedRuntimeMb: 459,
    downloadSize: "57.4 MB",
    elo: "~2400–2600",
    description:
      "Transformer architecture — dramatically stronger policy head than any CNN. Best practical browser net. Requires WebGPU.",
    source:
      "https://storage.lczero.org/files/networks-contrib/t1-256x10-distilled-swa-2432500.pb.gz",
  },
  // ── Experimental (Large Transformers) ────────────────────────────
  {
    id: "t1-512x15",
    name: "T1-512x15 Distilled",
    arch: "Transformer 512x15x8h",
    file: "t1-512x15x8h-distilled-swa-3395000.onnx.bin",
    size: "315 MB",
    estimatedRuntimeMb: 1323,
    downloadSize: "223 MB",
    elo: "~2550–2650",
    description:
      "Medium transformer distilled from T1. EXPERIMENTAL: Requires WebGPU + ~1.8 GB VRAM.",
    source:
      "https://storage.lczero.org/files/networks-contrib/t1-512x15x8h-distilled-swa-3395000.pb.gz",
  },
  {
    id: "t3-512x15",
    name: "t3-512x15 Distilled",
    arch: "Transformer 512x15x16h",
    file: "t3-512x15x16h-distill-swa-2767500.onnx.bin",
    size: "326 MB",
    estimatedRuntimeMb: 1915,
    downloadSize: "225 MB",
    elo: "~2600-2700",
    description:
      "Medium transformer with 16 attention heads. EXPERIMENTAL: Requires WebGPU + ~1.8 GB VRAM.",
    source:
      "https://storage.lczero.org/files/networks-contrib/t3-512x15x16h-distill-swa-2767500.pb.gz",
  },
  {
    id: "t82-768x15",
    name: "T82-768x15",
    arch: "Transformer 768x15x24h",
    file: "t82-768x15x24h-swa-7464000.onnx.bin",
    size: "361 MB",
    estimatedRuntimeMb: 1790,
    downloadSize: "251 MB",
    elo: "~2650-2750",
    description:
      "Large transformer with 768 filters and 24 attention heads. EXPERIMENTAL: Requires WebGPU + ~2.4 GB VRAM.",
    source: "https://storage.lczero.org/files/768x15x24h-t82-swa-7464000.pb.gz",
  },
  {
    id: "bt3-768x15",
    name: "BT3-768x15",
    arch: "Transformer 768x15x24h",
    file: "BT3-768x15x24h-swa-2790000.onnx.bin",
    size: "391 MB",
    estimatedRuntimeMb: 1986,
    downloadSize: "278 MB",
    elo: "~2700-2800",
    description:
      "Big Transformer 3 — ~300 Elo stronger than best CNN. TCEC competitor. EXPERIMENTAL: Requires WebGPU + ~2.6 GB VRAM.",
    source:
      "https://storage.lczero.org/files/networks-contrib/BT3-768x15x24h-swa-2790000.pb.gz",
  },
  {
    id: "bt4-1024x15",
    name: "BT4-1024x15",
    arch: "Transformer 1024x15x32h",
    file: "BT4-1024x15x32h-swa-6147500.onnx.bin",
    size: "707 MB",
    estimatedRuntimeMb: 3229,
    downloadSize: "473 MB",
    elo: "~2800-2900",
    description:
      "Big Transformer 4 — Strongest Leela network as of 2026/02/05. Grandmaster level at 1-node. EXPERIMENTAL: Largest model available; Requires WebGPU + ~4 GB VRAM.",
    source:
      "https://storage.lczero.org/files/networks-contrib/big-transformers/BT4-1024x15x32h-swa-6147500.pb.gz",
  },
];
