import { useMemo } from "react";
import { useTournamentRunner } from "../hooks/useTournamentRunner";
import { TournamentSetupScreen } from "./tournament/TournamentSetupScreen";
import { TournamentLiveScreen } from "./tournament/TournamentLiveScreen";
import { TournamentGameDetailScreen } from "./tournament/TournamentGameDetailScreen";

interface TournamentPageProps {
  onBackToHome: () => void;
}

export function TournamentPage({ onBackToHome }: TournamentPageProps) {
  const {
    state,
    savedTournaments,
    selectedMatch,
    startTournament,
    openSavedTournament,
    resumeTournament,
    pauseTournament,
    restartMatch,
    restartGameFromScratch,
    markMatchDraw,
    resetTournament,
    downloadTournamentPgn,
    checkMatchEngineHealth,
    setSelectedMatch,
  } = useTournamentRunner();

  const entrantsById = useMemo(
    () => new Map(state.entrants.map((entrant) => [entrant.id, entrant])),
    [state.entrants],
  );
  const canDownloadPgn = useMemo(
    () =>
      state.matches.some(
        (match) =>
          match.status !== "waiting" &&
          match.status !== "cancelled" &&
          match.moves.length > 0,
      ),
    [state.matches],
  );

  if (state.status === "idle") {
    return (
      <TournamentSetupScreen
        onStart={(config) => {
          void startTournament(config);
        }}
        savedTournaments={savedTournaments}
        onOpenSavedTournament={(id) => {
          void openSavedTournament(id);
        }}
        onBack={onBackToHome}
      />
    );
  }

  if (selectedMatch) {
    return (
      <TournamentGameDetailScreen
        match={selectedMatch}
        entrantsById={entrantsById}
        onRestartMatch={restartMatch}
        onRestartGame={restartGameFromScratch}
        onMarkDraw={markMatchDraw}
        onCheckEngineHealth={checkMatchEngineHealth}
        onBack={() => setSelectedMatch(null)}
      />
    );
  }

  return (
    <TournamentLiveScreen
      state={state}
      onSelectMatch={setSelectedMatch}
      onResume={() => {
        void resumeTournament();
      }}
      onPause={pauseTournament}
      onDownloadPgn={downloadTournamentPgn}
      canDownloadPgn={canDownloadPgn}
      onReset={() => {
        resetTournament();
      }}
    />
  );
}
