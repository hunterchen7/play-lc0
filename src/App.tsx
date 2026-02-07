import { useState } from "react";
import { HomeScreen } from "./components/HomeScreen";
import { GameScreen } from "./components/GameScreen";
import type { GameConfig } from "./types/game";

export default function App() {
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);

  if (!gameConfig) {
    return (
      <HomeScreen
        onStart={(network, color, temperature, savedGame) =>
          setGameConfig({ network, playerColor: color, temperature, savedGame })
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
