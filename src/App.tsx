import { useEffect, useState } from "react";
import { HomeScreen } from "./components/HomeScreen";
import { GameScreen } from "./components/GameScreen";
import { TournamentPage } from "./components/TournamentPage";
import type { GameConfig } from "./types/game";

const SCREEN_STORAGE_KEY = "lc0-app-screen-v1";

type AppScreen =
  | { type: "home" }
  | { type: "game"; config: GameConfig }
  | { type: "tournament" };

function loadInitialScreen(): AppScreen {
  if (typeof window === "undefined") return { type: "home" };

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SCREEN_STORAGE_KEY, JSON.stringify(screen));
  }, [screen]);

  if (screen.type === "home") {
    return (
      <HomeScreen
        onStart={(network, color, temperature, savedGame, startFen) =>
          setScreen({
            type: "game",
            config: { network, playerColor: color, temperature, savedGame, startFen },
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
