import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTournamentRunner } from "../hooks/useTournamentRunner";
import { TournamentSetupScreen } from "./tournament/TournamentSetupScreen";
import { TournamentLiveScreen } from "./tournament/TournamentLiveScreen";
import { TournamentGameDetailScreen } from "./tournament/TournamentGameDetailScreen";

interface TournamentPageProps {
  onBackToHome: () => void;
}

type WakeLockApi = {
  request: (type: "screen") => Promise<WakeLockSentinelLike>;
};

type WakeLockSentinelLike = {
  released?: boolean;
  release: () => Promise<void>;
};

export function TournamentPage({ onBackToHome }: TournamentPageProps) {
  const {
    state,
    savedTournaments,
    selectedMatch,
    startTournament,
    openSavedTournament,
    resumeTournament,
    pauseTournament,
    setMoveDelayMs,
    restartMatch,
    restartGameFromScratch,
    markMatchDraw,
    resetTournament,
    downloadTournamentPgn,
    checkMatchEngineHealth,
    setSelectedMatch,
  } = useTournamentRunner();
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

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
  const shouldWarnBeforeUnload =
    state.status === "running" || state.status === "paused" || state.status === "error";

  const releaseWakeLock = useCallback(async () => {
    const current = wakeLockRef.current;
    if (!current) return;

    wakeLockRef.current = null;
    try {
      await current.release();
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shouldWarnBeforeUnload) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldWarnBeforeUnload]);

  useEffect(() => {
    if (typeof document === "undefined" || typeof navigator === "undefined") return;

    let cancelled = false;
    const wakeLockApi = (navigator as Navigator & { wakeLock?: WakeLockApi })
      .wakeLock;

    const acquireWakeLock = async () => {
      if (cancelled || state.status !== "running") return;
      if (!wakeLockApi) return;
      if (document.visibilityState !== "visible") return;

      const current = wakeLockRef.current;
      if (current && !current.released) return;

      try {
        wakeLockRef.current = await wakeLockApi.request("screen");
      } catch {
        // ignore
      }
    };

    if (state.status !== "running") {
      void releaseWakeLock();
      return;
    }

    void acquireWakeLock();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void acquireWakeLock();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void releaseWakeLock();
    };
  }, [releaseWakeLock, state.status]);

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
      onSetMoveDelayMs={setMoveDelayMs}
      onReset={() => {
        resetTournament();
      }}
    />
  );
}
