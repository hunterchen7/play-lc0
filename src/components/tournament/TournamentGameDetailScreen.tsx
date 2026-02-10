import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Board } from "../Board";
import { MoveHistory } from "../MoveHistory";
import type {
  EngineHealthCheck,
  TournamentEntrant,
  TournamentMatchHealthReport,
  TournamentMatch,
} from "../../types/tournament";

interface TournamentGameDetailScreenProps {
  match: TournamentMatch;
  entrantsById: Map<string, TournamentEntrant>;
  onRestartMatch: (matchId: string) => Promise<boolean>;
  onRestartGame: (matchId: string) => Promise<boolean>;
  onMarkDraw: (matchId: string) => Promise<boolean>;
  onCheckEngineHealth: (
    matchId: string,
  ) => Promise<TournamentMatchHealthReport>;
  onBack: () => void;
  onPrevGame?: (() => void) | null;
  onNextGame?: (() => void) | null;
  gameNavLabel?: string;
}

function healthColorClass(status: EngineHealthCheck["status"]): string {
  if (status === "ok") return "text-emerald-300";
  if (status === "busy") return "text-amber-300";
  if (status === "error") return "text-red-300";
  return "text-slate-400";
}

function matchStatusClass(status: TournamentMatch["status"]): string {
  if (status === "running") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (status === "waiting") return "border-amber-500/40 bg-amber-500/10 text-amber-300";
  if (status === "finished") return "border-sky-500/40 bg-sky-500/10 text-sky-300";
  if (status === "error") return "border-rose-500/40 bg-rose-500/10 text-rose-300";
  return "border-slate-600 bg-slate-800/70 text-slate-300";
}

function toFullMoveCount(plies: number): number {
  return Math.ceil(plies / 2);
}

function withRating(label: string, rating?: string): string {
  return rating ? `${label} (${rating})` : label;
}

function EvalBar({
  label,
  wdl,
}: {
  label: string;
  wdl: [number, number, number] | null;
}) {
  if (!wdl) {
    return (
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/75 p-3">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-2 text-sm text-slate-500">No evaluation available</p>
      </div>
    );
  }

  const [white, draw, black] = wdl;
  const whitePct = Math.round(white * 100);
  const drawPct = Math.round(draw * 100);
  const blackPct = Math.round(black * 100);

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/75 p-3">
      <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mb-1 flex justify-between text-xs text-slate-300">
        <span>W {whitePct}%</span>
        <span>D {drawPct}%</span>
        <span>B {blackPct}%</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-700">
        <div className="bg-white" style={{ width: `${white * 100}%` }} />
        <div className="bg-gray-400" style={{ width: `${draw * 100}%` }} />
        <div className="bg-gray-950" style={{ width: `${black * 100}%` }} />
      </div>
    </div>
  );
}

export function TournamentGameDetailScreen({
  match,
  entrantsById,
  onRestartMatch,
  onRestartGame,
  onMarkDraw,
  onCheckEngineHealth,
  onBack,
  onPrevGame,
  onNextGame,
  gameNavLabel,
}: TournamentGameDetailScreenProps) {
  const [viewingMove, setViewingMove] = useState<number | null>(null);
  const viewingMoveRef = useRef(viewingMove);
  viewingMoveRef.current = viewingMove;
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [actionLoading, setActionLoading] = useState<"restart" | "draw" | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [healthReport, setHealthReport] =
    useState<TournamentMatchHealthReport | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  const whiteEntrant = entrantsById.get(match.whiteEntrantId);
  const blackEntrant = entrantsById.get(match.blackEntrantId);
  const white = whiteEntrant?.label ?? match.whiteEntrantId;
  const black = blackEntrant?.label ?? match.blackEntrantId;
  const whiteWithRating = withRating(white, whiteEntrant?.network.elo);
  const blackWithRating = withRating(black, blackEntrant?.network.elo);

  const displayFen =
    viewingMove === null
      ? (match.fenHistory[match.fenHistory.length - 1] ?? match.fenHistory[0])
      : (match.fenHistory[viewingMove + 1] ?? match.fenHistory[0]);

  const evalSnapshot = useMemo(() => {
    const idx =
      viewingMove === null ? match.fenHistory.length - 1 : viewingMove + 1;
    return match.evalHistory[idx] ?? null;
  }, [match.evalHistory, match.fenHistory.length, viewingMove]);

  const canRestartGame =
    match.status === "running" ||
    match.status === "waiting" ||
    match.status === "error";
  const canMarkDraw =
    match.status !== "cancelled" && match.status !== "finished";
  const resultLabel = match.result === "*" ? "In progress" : match.result;

  const handleRestartGame = useCallback(async () => {
    setActionError(null);
    setActionLoading("restart");
    try {
      const restarted = await onRestartGame(match.id);
      if (!restarted) {
        setActionError("Could not restart this game right now.");
      } else {
        setViewingMove(null);
      }
    } finally {
      setActionLoading(null);
    }
  }, [match.id, onRestartGame]);

  const handleMarkDraw = useCallback(async () => {
    setActionError(null);
    setActionLoading("draw");
    try {
      const marked = await onMarkDraw(match.id);
      if (!marked) {
        setActionError("Could not mark this game as draw right now.");
      } else {
        setViewingMove(null);
      }
    } finally {
      setActionLoading(null);
    }
  }, [match.id, onMarkDraw]);

  const runHealthCheck = useCallback(
    async (attemptRecovery: boolean) => {
      setHealthLoading(true);
      setHealthError(null);
      try {
        if (attemptRecovery) {
          const restarted = await onRestartMatch(match.id);
          if (restarted) {
            await new Promise((resolve) => {
              setTimeout(resolve, 150);
            });
          }
        }

        let report = await onCheckEngineHealth(match.id);
        if (match.status === "running" && report.overall === "idle") {
          await new Promise((resolve) => {
            setTimeout(resolve, 150);
          });
          report = await onCheckEngineHealth(match.id);
        }
        setHealthReport(report);
      } catch (error) {
        setHealthError(error instanceof Error ? error.message : String(error));
      } finally {
        setHealthLoading(false);
      }
    },
    [match.id, match.status, onCheckEngineHealth, onRestartMatch],
  );

  useEffect(() => {
    setActionError(null);
    setActionLoading(null);
    setHealthReport(null);
    setHealthError(null);
  }, [match.id]);

  useEffect(() => {
    if (match.moves.length === 0) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const current = viewingMoveRef.current ?? match.moves.length - 1;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setViewingMove(Math.max(-1, current - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (current < match.moves.length - 1) {
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

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [match.moves.length]);

  const neutralButtonClass =
    "rounded-lg border border-slate-600/80 bg-slate-800/90 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-700 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800/60 disabled:text-slate-500";
  const restartButtonClass =
    "rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 py-2 text-sm text-amber-100 transition hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800/60 disabled:text-slate-500";
  const drawButtonClass =
    "rounded-lg border border-rose-500/40 bg-rose-500/20 px-3 py-2 text-sm text-rose-100 transition hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800/60 disabled:text-slate-500";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-slate-700/70 bg-slate-900/80 px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2 md:gap-3">
            {(onPrevGame || onNextGame) && (
              <div className="mt-0.5 flex shrink-0 items-center gap-1">
                <button
                  onClick={onPrevGame ?? undefined}
                  disabled={!onPrevGame}
                  className={neutralButtonClass}
                  title="Previous game"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <button
                  onClick={onNextGame ?? undefined}
                  disabled={!onNextGame}
                  className={neutralButtonClass}
                  title="Next game"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight text-slate-100 md:text-2xl">
                  Game Detail
                </h2>
                {gameNavLabel && (
                  <span className="rounded-full border border-slate-600 bg-slate-800/80 px-2.5 py-0.5 text-xs font-medium text-slate-300">
                    {gameNavLabel}
                  </span>
                )}
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${matchStatusClass(match.status)}`}
                >
                  {match.status}
                </span>
              </div>
              <p className="mt-1 break-words text-sm text-slate-300/90">
                Round {match.round} Board {match.board} · Game{" "}
                {match.seriesGameIndex} · {whiteWithRating} vs {blackWithRating}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              onClick={() => {
                void handleRestartGame();
              }}
              disabled={!canRestartGame || actionLoading !== null}
              className={restartButtonClass}
            >
              {actionLoading === "restart" ? "Restarting..." : "Restart Game"}
            </button>
            <button
              onClick={() => {
                void handleMarkDraw();
              }}
              disabled={!canMarkDraw || actionLoading !== null}
              className={drawButtonClass}
            >
              {actionLoading === "draw" ? "Marking..." : "Mark Draw"}
            </button>
            <button
              onClick={() =>
                setOrientation((prev) => (prev === "white" ? "black" : "white"))
              }
              className={neutralButtonClass}
            >
              Flip Board
            </button>
            <button onClick={onBack} className={neutralButtonClass}>
              Close
            </button>
          </div>
        </div>
        {actionError && (
          <div className="mt-3 rounded-lg border border-red-700/50 bg-red-900/25 p-2 text-sm text-red-200">
            {actionError}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-5 md:py-5">
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="rounded-2xl border border-slate-700/70 bg-slate-900/55 p-3 md:p-4">
            <div className="overflow-hidden rounded-xl border border-slate-700/70 bg-slate-950/70 p-2 md:p-3">
              <div className="flex justify-center">
                <Board
                  position={displayFen}
                  onPieceDrop={() => false}
                  boardOrientation={orientation}
                  disabled={true}
                  sizeScale={0.74}
                  maxSizePx={760}
                />
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  Status
                </p>
                <p className="mt-1 text-sm font-medium capitalize text-slate-200">
                  {match.status}
                </p>
              </div>
              <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  Result
                </p>
                <p className="mt-1 text-sm font-medium text-slate-200">
                  {resultLabel}
                </p>
              </div>
              <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  Full Moves
                </p>
                <p className="mt-1 text-sm font-medium text-slate-200">
                  {toFullMoveCount(match.moves.length)}
                </p>
              </div>
            </div>
          </section>

          <aside className="flex min-h-0 flex-col gap-3">
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/75 p-3 text-sm text-slate-200">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-100">Engine Health</p>
                <button
                  onClick={() => {
                    void runHealthCheck(true);
                  }}
                  disabled={healthLoading}
                  className="rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1 text-xs text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800/60 disabled:text-slate-500"
                >
                  {healthLoading ? "Checking..." : "Check"}
                </button>
              </div>

              {healthError ? (
                <p className="mt-2 text-xs text-red-300">{healthError}</p>
              ) : healthReport ? (
                <div className="mt-2 space-y-2 text-xs">
                  <p className="text-slate-300">
                    <span className="text-slate-400">Overall:</span>{" "}
                    <span
                      className={
                        healthReport.overall === "healthy"
                          ? "text-emerald-300"
                          : healthReport.overall === "idle"
                            ? "text-slate-400"
                            : "text-amber-300"
                      }
                    >
                      {healthReport.overall}
                    </span>
                  </p>
                  <p className={healthColorClass(healthReport.white.status)}>
                    White: {healthReport.white.status}
                    {healthReport.white.latencyMs !== null
                      ? ` (${healthReport.white.latencyMs}ms)`
                      : ""}
                    {" - "}
                    {healthReport.white.message}
                  </p>
                  <p className={healthColorClass(healthReport.black.status)}>
                    Black: {healthReport.black.status}
                    {healthReport.black.latencyMs !== null
                      ? ` (${healthReport.black.latencyMs}ms)`
                      : ""}
                    {" - "}
                    {healthReport.black.message}
                  </p>
                  <p className="text-slate-500">
                    Checked {new Date(healthReport.checkedAt).toLocaleTimeString()}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Click Check to inspect engine status.
                </p>
              )}
            </div>

            <EvalBar
              label={`${whiteWithRating} eval`}
              wdl={evalSnapshot?.whiteEngineWdl ?? null}
            />
            <EvalBar
              label={`${blackWithRating} eval`}
              wdl={evalSnapshot?.blackEngineWdl ?? null}
            />

            <div className="h-[24rem] flex-none overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/75 p-3 md:h-[27rem] xl:h-[31rem]">
              <MoveHistory
                moves={match.moves}
                viewingMove={viewingMove}
                onSelectMove={setViewingMove}
                pgn={match.pgn}
                fillHeight
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
