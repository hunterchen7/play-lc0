import { useEffect, useState } from "react";
import { HomeScreen } from "./components/HomeScreen";
import { GameScreen } from "./components/GameScreen";
import { TournamentPage } from "./components/TournamentPage";
import type { GameConfig } from "./types/game";
import { NETWORKS, type NetworkInfo } from "./constants/networks";
import { hasModelCached } from "./engine/modelCache";
import { getModelUrl } from "./config";
import { parseShareParams, clearShareParams } from "./utils/shareParams";

const SCREEN_STORAGE_KEY = "lc0-app-screen-v1";

type AppScreen =
  | { type: "home" }
  | { type: "game"; config: GameConfig }
  | { type: "tournament" }
  | { type: "share-loading" }
  | { type: "share-confirm"; net: NetworkInfo; color: "w" | "b"; temperature: number; fen?: string };

function parseSizeMB(size: string): number {
  const match = size.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

function loadInitialScreen(): AppScreen {
  if (typeof window === "undefined") return { type: "home" };

  // If URL has share params, show loading state while we check cache
  if (new URL(window.location.href).searchParams.has("network")) {
    return { type: "share-loading" };
  }

  try {
    const raw = window.localStorage.getItem(SCREEN_STORAGE_KEY);
    if (!raw) return { type: "home" };
    const parsed = JSON.parse(raw) as AppScreen;
    if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
      return { type: "home" };
    }
    if (parsed.type === "home" || parsed.type === "tournament") {
      return parsed;
    }
    if (parsed.type === "game" && parsed.config) {
      return parsed;
    }
    return { type: "home" };
  } catch {
    return { type: "home" };
  }
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>(loadInitialScreen);

  // Handle share params on mount
  useEffect(() => {
    if (screen.type !== "share-loading") return;

    const params = parseShareParams();
    if (!params) {
      setScreen({ type: "home" });
      return;
    }

    const net = NETWORKS.find((n) => n.id === params.networkId);
    if (!net) {
      clearShareParams();
      setScreen({ type: "home" });
      return;
    }

    const color =
      params.color === "w" || params.color === "b"
        ? params.color
        : (Math.random() < 0.5 ? "w" : "b");
    const fen = params.fen || undefined;

    const isLarge = parseSizeMB(net.size) > 25;

    hasModelCached(getModelUrl(net.file)).then((cached) => {
      if (!cached && isLarge) {
        // Large uncached model — ask for confirmation
        setScreen({ type: "share-confirm", net, color, temperature: params.temperature, fen });
      } else {
        // Cached or small — go straight to game
        clearShareParams();
        setScreen({
          type: "game",
          config: { network: net, playerColor: color, temperature: params.temperature, searchNodes: 0, searchTimeMs: 0, startFen: fen },
        });
      }
    });
  }, [screen.type]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Only persist home/game/tournament screens
    if (screen.type === "home" || screen.type === "game" || screen.type === "tournament") {
      window.localStorage.setItem(SCREEN_STORAGE_KEY, JSON.stringify(screen));
    }
  }, [screen]);

  if (screen.type === "share-loading") {
    return null; // Brief flash while checking cache
  }

  if (screen.type === "share-confirm") {
    const { net, color, temperature, fen } = screen;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a2e]">
        <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
          <h3 className="text-lg font-semibold text-gray-100 mb-2">
            Download large model?
          </h3>
          <p className="text-sm text-gray-400 mb-5">
            <span className="text-gray-200 font-medium">{net.name}</span>{" "}
            is {net.size} uncompressed ({net.downloadSize} download). This may take a while
            and use significant storage space.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                clearShareParams();
                setScreen({ type: "home" });
              }}
              className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                clearShareParams();
                setScreen({
                  type: "game",
                  config: { network: net, playerColor: color, temperature, searchNodes: 0, searchTimeMs: 0, startFen: fen },
                });
              }}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
            >
              Download & Play
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen.type === "home") {
    return (
      <HomeScreen
        onStart={(network, color, temperature, searchNodes, searchTimeMs, savedGame, startFen, openings) =>
          setScreen({
            type: "game",
            config: { network, playerColor: color, temperature, searchNodes, searchTimeMs, savedGame, startFen, openings },
          })
        }
        onOpenTournament={() => setScreen({ type: "tournament" })}
      />
    );
  }

  if (screen.type === "tournament") {
    return <TournamentPage onBackToHome={() => setScreen({ type: "home" })} />;
  }

  return (
    <GameScreen
      key={screen.config.network.id + screen.config.playerColor + (screen.config.startFen ?? "")}
      config={screen.config}
      onBackToMenu={() => setScreen({ type: "home" })}
    />
  );
}
