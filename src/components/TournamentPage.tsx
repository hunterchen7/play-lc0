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
    engineStats,
    savedTournaments,
    selectedMatch,
    startTournament,
    openSavedTournament,
    resumeTournament,
    pauseTournament,
    setMoveDelayMs,
    setMaxSimultaneousGames,
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
    state.status === "running" ||
    state.status === "paused" ||
    state.status === "error";

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
    if (typeof document === "undefined" || typeof navigator === "undefined")
      return;

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

  useEffect(() => {
    if (typeof document === "undefined" || !selectedMatch) return;

    const { body, documentElement } = document;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    const prevHtmlOverflow = documentElement.style.overflow;
    const prevHtmlOverscroll = documentElement.style.overscrollBehavior;

    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    documentElement.style.overflow = "hidden";
    documentElement.style.overscrollBehavior = "none";

    return () => {
      body.style.overflow = prevBodyOverflow;
      body.style.overscrollBehavior = prevBodyOverscroll;
      documentElement.style.overflow = prevHtmlOverflow;
      documentElement.style.overscrollBehavior = prevHtmlOverscroll;
    };
  }, [selectedMatch]);

  useEffect(() => {
    if (!selectedMatch) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setSelectedMatch(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedMatch, setSelectedMatch]);

  const seriesMatches = useMemo(() => {
    if (!selectedMatch) return [];
    return state.matches
      .filter((m) => m.seriesId === selectedMatch.seriesId)
      .sort((a, b) => a.seriesGameIndex - b.seriesGameIndex);
  }, [selectedMatch, state.matches]);

  const currentGameIdx = useMemo(() => {
    if (!selectedMatch) return -1;
    return seriesMatches.findIndex((m) => m.id === selectedMatch.id);
  }, [selectedMatch, seriesMatches]);

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

  const handlePrevGame =
    currentGameIdx > 0
      ? () => setSelectedMatch(seriesMatches[currentGameIdx - 1].id)
      : null;

  const handleNextGame =
    currentGameIdx >= 0 && currentGameIdx < seriesMatches.length - 1
      ? () => setSelectedMatch(seriesMatches[currentGameIdx + 1].id)
      : null;

  const gameNavLabel =
    seriesMatches.length > 1
      ? `(${currentGameIdx + 1}/${seriesMatches.length})`
      : undefined;

  return (
    <>
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
        onSetMaxSimultaneousGames={setMaxSimultaneousGames}
        loadedEngineCount={engineStats.loadedCount}
        maxLoadedEngineCount={engineStats.maxLoadedCount}
        estimatedEngineMemoryMb={engineStats.estimatedMemoryMb}
        onReset={() => {
          resetTournament();
        }}
      />

      {selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/75 px-3 py-4 backdrop-blur-sm md:px-6 md:py-6">
          <div
            className="absolute inset-0"
            onClick={() => setSelectedMatch(null)}
          />
          <div className="relative w-[min(96vw,1560px)] max-h-[95vh] overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900 to-slate-950 shadow-[0_35px_90px_rgba(0,0,0,0.55)]">
            <TournamentGameDetailScreen
              match={selectedMatch}
              entrantsById={entrantsById}
              onRestartMatch={restartMatch}
              onRestartGame={restartGameFromScratch}
              onMarkDraw={markMatchDraw}
              onCheckEngineHealth={checkMatchEngineHealth}
              onBack={() => setSelectedMatch(null)}
              onPrevGame={handlePrevGame}
              onNextGame={handleNextGame}
              gameNavLabel={gameNavLabel}
            />
          </div>
        </div>
      )}
    </>
  );
}
