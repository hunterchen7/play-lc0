import { useState, useEffect, useRef, useCallback } from "react";
import { Chess } from "chess.js";
import type { PieceDropHandlerArgs } from "react-chessboard";
import { Board } from "./Board";
import { Controls } from "./Controls";
import { StatusBar } from "./StatusBar";
import { LoadingOverlay } from "./LoadingOverlay";
import { MoveHistory } from "./MoveHistory";
import { Lc0Engine } from "../engine/workerInterface";
import { moveToUCI, uciToChessJsMove } from "../utils/chess";
import { saveGame } from "../utils/savedGames";
import { getModelUrl } from "../config";
import type { EngineState } from "../types";
import type { GameConfig } from "../types/game";

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
  if (game.isThreefoldRepetition()) return "Draw by repetition";
  if (game.isDraw()) return "Draw";
  if (game.isCheck()) return "Check";
  return game.turn() === "w" ? "White's turn" : "Black's turn";
}

function saveOrUpdateCurrentGame(
  gameId: string,
  moves: string[],
  config: GameConfig,
  playerColor: "w" | "b",
  currentGame: Chess,
) {
  if (moves.length === 0) return; // Don't save empty games

  const result = currentGame.isGameOver() ? getResult(currentGame) : "*";
  const pgn = buildPgn(moves, config, result, playerColor);

  saveGame({
    id: gameId,
    date: new Date().toISOString(),
    network: config.network.name,
    playerColor,
    result,
    pgn,
    moves,
  });
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
  pgn += `[Site "play-lc0.pages.dev"]\n`;
  pgn += `[Date "${dateStr}"]\n`;
  pgn += `[White "${white}"]\n`;
  pgn += `[Black "${black}"]\n`;
  pgn += `[Result "${result}"]\n`;
  if (config.startFen) {
    pgn += `[SetUp "1"]\n`;
    pgn += `[FEN "${config.startFen}"]\n`;
  }
  pgn += `\n`;

  const startMoveNum = config.startFen
    ? parseInt(config.startFen.split(" ")[5] ?? "1", 10) || 1
    : 1;
  const startFromBlack = config.startFen
    ? config.startFen.split(" ")[1] === "b"
    : false;

  for (let i = 0; i < moves.length; i++) {
    const plyOffset = startFromBlack ? i + 1 : i;
    const moveNum = Math.floor(plyOffset / 2) + startMoveNum;
    if (i === 0 && startFromBlack) {
      pgn += `${moveNum}... `;
    } else if (plyOffset % 2 === 0) {
      pgn += `${moveNum}. `;
    }
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

export function GameScreen({
  config,
  onBackToMenu,
}: {
  config: GameConfig;
  onBackToMenu: () => void;
}) {
  const [gameId] = useState(
    () => config.savedGame?.id || `game-${Date.now()}-${Math.random()}`,
  );
  const [game, setGame] = useState(() => {
    if (config.savedGame) {
      const chess = new Chess();
      config.savedGame.moves.forEach((move) => chess.move(move));
      return chess;
    }
    return config.startFen ? new Chess(config.startFen) : new Chess();
  });
  const [engineState, setEngineState] =
    useState<EngineState>(INITIAL_ENGINE_STATE);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(
    config.playerColor === "w" ? "white" : "black",
  );
  const startingFen = config.startFen ?? new Chess().fen();
  const [fenHistory, setFenHistory] = useState<string[]>(() => {
    if (config.savedGame) {
      const fens = [new Chess().fen()];
      const chess = new Chess();
      config.savedGame.moves.forEach((move) => {
        chess.move(move);
        fens.push(chess.fen());
      });
      return fens;
    }
    return [startingFen];
  });
  const [moveHistory, setMoveHistory] = useState<string[]>(
    () => config.savedGame?.moves || [],
  );
  const [lastMoveAlgebraic, setLastMoveAlgebraic] = useState<string | null>(
    null,
  );
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [temperature, setTemperature] = useState(config.temperature);
  const temperatureRef = useRef(temperature);
  temperatureRef.current = temperature;
  const [viewingMove, setViewingMove] = useState<number | null>(null); // null = live
  const [gameSaved, setGameSaved] = useState(false);
  const [hasResigned, setHasResigned] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
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

    engine.init(getModelUrl(config.network.file));

    return () => {
      unsub();
      engine.terminate();
    };
  }, [config.network.file]);

  // Request engine move — uses temperatureRef so the callback reference is stable
  // and doesn't re-trigger the engine move effect when temperature changes.
  const requestEngineMove = useCallback(
    async (currentGame: Chess, history: string[]) => {
      const engine = engineRef.current;
      if (!engine || currentGame.isGameOver()) return;

      const fen = currentGame.fen();
      const legalMoves = currentGame.moves({ verbose: true }).map(moveToUCI);
      if (legalMoves.length === 0) return;

      try {
        const result = await engine.getBestMove(
          fen,
          history,
          legalMoves,
          temperatureRef.current,
        );

        const moveData = uciToChessJsMove(result.move);
        const move = currentGame.move(moveData);

        if (move) {
          setLastMoveAlgebraic(move.san);
          setMoveHistory((prev) => {
            const newMoves = [...prev, move.san];
            // Auto-save after every move
            saveOrUpdateCurrentGame(
              gameId,
              newMoves,
              config,
              playerColor,
              currentGame,
            );
            return newMoves;
          });
          setFenHistory((prev) => [...prev, currentGame.fen()]);
        }
      } catch (e) {
        console.error("Engine move failed:", e);
      }
    },
    [],
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

  // Auto-save game on completion (final update with actual result)
  useEffect(() => {
    if (game.isGameOver() && !gameSaved && moveHistory.length > 0) {
      const result = getResult(game);
      const pgn = buildPgn(moveHistory, config, result, playerColor);
      saveGame({
        id: gameId,
        date: new Date().toISOString(),
        network: config.network.name,
        playerColor: playerColor,
        result,
        pgn,
        moves: moveHistory,
      });
      setGameSaved(true);
    }
  }, [game, gameSaved, moveHistory, config, playerColor, gameId]);

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
      const move = game.move({
        from: pendingPromotion.from,
        to: pendingPromotion.to,
        promotion,
      });
      setPendingPromotion(null);
      if (!move) return;
      setMoveHistory((prev) => {
        const newMoves = [...prev, move.san];
        // Auto-save after promotion
        saveOrUpdateCurrentGame(gameId, newMoves, config, playerColor, game);
        return newMoves;
      });
      setFenHistory((prev) => [...prev, game.fen()]);
    },
    [game, pendingPromotion, gameId, config, playerColor],
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
      const testMove = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });
      if (!testMove) return false;
      game.undo();

      // If it's a promotion, show the picker instead of auto-queening
      if (isPromotion(sourceSquare, targetSquare)) {
        setPendingPromotion({ from: sourceSquare, to: targetSquare });
        return false; // don't move the piece yet
      }

      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
      });

      if (!move) return false;

      setMoveHistory((prev) => {
        const newMoves = [...prev, move.san];
        // Auto-save after every move
        saveOrUpdateCurrentGame(gameId, newMoves, config, playerColor, game);
        return newMoves;
      });
      setFenHistory((prev) => [...prev, game.fen()]);

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
    // Save current game as resignation before starting new game
    if (moveHistory.length > 0 && !game.isGameOver()) {
      const resignResult = playerColor === "w" ? "0-1" : "1-0";
      const pgn = buildPgn(moveHistory, config, resignResult, playerColor);
      saveGame({
        id: gameId,
        date: new Date().toISOString(),
        network: config.network.name,
        playerColor,
        result: resignResult,
        pgn,
        moves: moveHistory,
      });
    }

    const newColor = playerColor === "w" ? "b" : "w";
    setPlayerColor(newColor);
    setBoardOrientation(newColor === "w" ? "white" : "black");
    const newGame = config.startFen ? new Chess(config.startFen) : new Chess();
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

  const handleBackToMenu = useCallback(() => {
    // Save incomplete game before going back to menu
    if (moveHistory.length > 0 && !gameSaved) {
      saveOrUpdateCurrentGame(gameId, moveHistory, config, playerColor, game);
    }
    onBackToMenu();
  }, [moveHistory, gameSaved, gameId, config, playerColor, game, onBackToMenu]);

  const handleResign = useCallback(() => {
    if (game.isGameOver() || gameSaved || hasResigned) return;

    // Create a resigned result: if player is white, black wins (0-1), else white wins (1-0)
    const resignResult = playerColor === "w" ? "0-1" : "1-0";
    const pgn = buildPgn(moveHistory, config, resignResult, playerColor);

    saveGame({
      id: gameId,
      date: new Date().toISOString(),
      network: config.network.name,
      playerColor: playerColor,
      result: resignResult,
      pgn,
      moves: moveHistory,
    });
    setGameSaved(true);
    setHasResigned(true);
    setShowResignConfirm(false);
  }, [game, gameSaved, hasResigned, playerColor, moveHistory, config, gameId]);

  const isEnginesTurn = game.turn() !== playerColor;
  const disabled =
    isViewingHistory ||
    isEnginesTurn ||
    engineState.isThinking ||
    game.isGameOver() ||
    hasResigned ||
    !engineState.isReady;

  const gameOver = game.isGameOver() || hasResigned;
  const pgn = buildPgn(
    moveHistory,
    config,
    hasResigned ? (playerColor === "w" ? "0-1" : "1-0") : getResult(game),
    playerColor,
  );

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
            pgn={pgn}
          />
          <Controls
            onNewGame={handleNewGame}
            onFlipBoard={handleFlipBoard}
            onResign={() => setShowResignConfirm(true)}
            playerColor={playerColor}
            isGameOver={gameOver}
            isViewingHistory={isViewingHistory}
            temperature={temperature}
            onTemperatureChange={setTemperature}
          />
          <button
            onClick={handleBackToMenu}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg font-medium transition-colors text-sm w-full"
          >
            Change Opponent
          </button>
        </div>
      </div>

      {/* Resign confirmation modal */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200 ${
          showResignConfirm
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className="absolute inset-0 bg-black/60"
          onClick={() => setShowResignConfirm(false)}
        />
        <div
          className={`relative bg-slate-800 border border-slate-600 rounded-xl p-6 max-w-sm mx-4 shadow-2xl transition-transform duration-200 ${
            showResignConfirm ? "scale-100" : "scale-95"
          }`}
        >
          <h3 className="text-lg font-semibold text-gray-100 mb-2">
            Resign game?
          </h3>
          <p className="text-sm text-gray-400 mb-5">
            This will end the game and count as a loss. Are you sure?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowResignConfirm(false)}
              className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleResign}
              className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              Resign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
