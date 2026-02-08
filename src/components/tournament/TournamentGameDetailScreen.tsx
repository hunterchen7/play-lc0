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
}

function healthColorClass(status: EngineHealthCheck["status"]): string {
  if (status === "ok") return "text-emerald-300";
  if (status === "busy") return "text-amber-300";
  if (status === "error") return "text-red-300";
  return "text-slate-400";
}

function toFullMoveCount(plies: number): number {
  return Math.ceil(plies / 2);
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
      <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-500 mt-1">No evaluation</p>
      </div>
    );
  }

  const [white, draw, black] = wdl;
  const whitePct = Math.round(white * 100);
  const drawPct = Math.round(draw * 100);
  const blackPct = Math.round(black * 100);

  return (
    <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
      <p className="text-xs text-gray-400 mb-2">{label}</p>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>W {whitePct}%</span>
        <span>D {drawPct}%</span>
        <span>B {blackPct}%</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-slate-700">
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
}: TournamentGameDetailScreenProps) {
  const [viewingMove, setViewingMove] = useState<number | null>(null);
  const viewingMoveRef = useRef(viewingMove);
  viewingMoveRef.current = viewingMove;
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [actionLoading, setActionLoading] = useState<"restart" | "draw" | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [healthReport, setHealthReport] = useState<TournamentMatchHealthReport | null>(
    null,
  );
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  const white = entrantsById.get(match.whiteEntrantId)?.label ?? match.whiteEntrantId;
  const black = entrantsById.get(match.blackEntrantId)?.label ?? match.blackEntrantId;

  const displayFen =
    viewingMove === null
      ? match.fenHistory[match.fenHistory.length - 1] ?? match.fenHistory[0]
      : (match.fenHistory[viewingMove + 1] ?? match.fenHistory[0]);

  const evalSnapshot = useMemo(() => {
    const idx = viewingMove === null ? match.fenHistory.length - 1 : viewingMove + 1;
    return match.evalHistory[idx] ?? null;
  }, [match.evalHistory, match.fenHistory.length, viewingMove]);

  const onPieceDrop = () => false;

  const canRestartGame =
    match.status === "running" || match.status === "waiting" || match.status === "error";
  const canMarkDraw = match.status !== "cancelled" && match.status !== "finished";

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

  const runHealthCheck = useCallback(async (attemptRecovery: boolean) => {
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
  }, [match.id, match.status, onCheckEngineHealth, onRestartMatch]);

  useEffect(() => {
    setActionError(null);
    setActionLoading(null);
    setHealthReport(null);
    setHealthError(null);
    if (match.status === "running") {
      void runHealthCheck(false);
    }
  }, [match.id, match.status, runHealthCheck]);

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

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Game Detail</h2>
          <p className="text-sm text-gray-400 mt-1">
            Round {match.round} Board {match.board} · Game {match.seriesGameIndex} · {white} vs {black}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              void handleRestartGame();
            }}
            disabled={!canRestartGame || actionLoading !== null}
            className="px-3 py-2 bg-amber-700 hover:bg-amber-600 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg text-sm text-white"
          >
            {actionLoading === "restart" ? "Restarting..." : "Restart Game"}
          </button>
          <button
            onClick={() => {
              void handleMarkDraw();
            }}
            disabled={!canMarkDraw || actionLoading !== null}
            className="px-3 py-2 bg-rose-700 hover:bg-rose-600 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg text-sm text-white"
          >
            {actionLoading === "draw" ? "Marking..." : "Mark Draw"}
          </button>
          <button
            onClick={() =>
              setOrientation((prev) => (prev === "white" ? "black" : "white"))
            }
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
          >
            Flip Board
          </button>
          <button
            onClick={onBack}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
          >
            Back to Tournament
          </button>
        </div>
      </div>
      {actionError && (
        <div className="rounded-lg border border-red-700/50 bg-red-900/30 text-red-200 p-2 text-sm">
          {actionError}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px] gap-4 items-start">
        <div className="flex justify-center">
          <Board
            position={displayFen}
            onPieceDrop={onPieceDrop}
            boardOrientation={orientation}
            disabled={true}
          />
        </div>

        <div className="flex flex-col gap-3 lg:h-[85vh] min-h-0">
          <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3 text-sm text-gray-300">
            <p>
              <span className="text-gray-400">Status:</span> {match.status}
            </p>
            <p>
              <span className="text-gray-400">Result:</span> {match.result}
            </p>
            <p>
              <span className="text-gray-400">Moves:</span>{" "}
              {toFullMoveCount(match.moves.length)}
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3 text-sm text-gray-300">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-gray-200">Engine Health Check</p>
              <button
                onClick={() => {
                  void runHealthCheck(true);
                }}
                disabled={healthLoading}
                className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-xs"
              >
                {healthLoading ? "Checking..." : "Re-check"}
              </button>
            </div>

            {healthError ? (
              <p className="text-xs text-red-300 mt-2">{healthError}</p>
            ) : healthReport ? (
              <div className="mt-2 space-y-1 text-xs">
                <p>
                  <span className="text-gray-400">Overall:</span>{" "}
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
                <p className="text-gray-500">
                  Checked {new Date(healthReport.checkedAt).toLocaleTimeString()}
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-500 mt-2">
                {match.status === "running"
                  ? "Opening live check..."
                  : "Game not running."}
              </p>
            )}
          </div>

          <EvalBar
            label={`${white} eval`}
            wdl={evalSnapshot?.whiteEngineWdl ?? null}
          />
          <EvalBar
            label={`${black} eval`}
            wdl={evalSnapshot?.blackEngineWdl ?? null}
          />

          <div className="flex-1 min-h-0">
            <MoveHistory
              moves={match.moves}
              viewingMove={viewingMove}
              onSelectMove={setViewingMove}
              pgn={match.pgn}
              fillHeight
            />
          </div>
        </div>
      </div>
    </div>
  );
}
