import { useState, useMemo, useCallback, useEffect } from "react";
import { OPENINGS } from "../data/openings";
import { ECO_CATEGORIES, type SelectedOpening } from "../types/openings";
import { validateFen } from "../utils/fen";
import { FenPreviewBoard } from "./FenPreviewBoard";
import { Chess } from "chess.js";

interface OpeningPickerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selected: SelectedOpening[]) => void;
  initialSelected?: SelectedOpening[];
}

function moveToUci(move: { from: string; to: string; promotion?: string }) {
  return move.from + move.to + (move.promotion || "");
}

export function OpeningPicker({
  open,
  onClose,
  onConfirm,
  initialSelected,
}: OpeningPickerProps) {
  const [search, setSearch] = useState("");
  const [ecoFilter, setEcoFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (!initialSelected) return new Set();
    return new Set(initialSelected.map((o) => o.id));
  });
  const [customOpenings, setCustomOpenings] = useState<SelectedOpening[]>(
    () => initialSelected?.filter((o) => o.type === "custom") ?? [],
  );

  // Custom opening form
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customMoves, setCustomMoves] = useState("");
  const [customFen, setCustomFen] = useState("");
  const [customMode, setCustomMode] = useState<"moves" | "fen">("moves");
  const [customError, setCustomError] = useState<string | null>(null);
  const [customPreviewFen, setCustomPreviewFen] = useState<string | null>(null);

  // Re-sync when initial selection changes (e.g. modal reopened)
  useEffect(() => {
    if (!open) return;
    if (initialSelected) {
      setSelected(new Set(initialSelected.map((o) => o.id)));
      setCustomOpenings(initialSelected.filter((o) => o.type === "custom"));
    } else {
      setSelected(new Set());
      setCustomOpenings([]);
    }
  }, [open, initialSelected]);

  // Validate custom input
  useEffect(() => {
    if (customMode === "fen") {
      if (!customFen.trim()) {
        setCustomError(null);
        setCustomPreviewFen(null);
        return;
      }
      const result = validateFen(customFen.trim());
      if (result.valid) {
        setCustomError(null);
        setCustomPreviewFen(customFen.trim());
      } else {
        setCustomError(result.error ?? "Invalid FEN");
        setCustomPreviewFen(null);
      }
    } else {
      if (!customMoves.trim()) {
        setCustomError(null);
        setCustomPreviewFen(null);
        return;
      }
      const chess = new Chess();
      const moves = customMoves.trim().replace(/\d+\.\s*/g, "").split(/\s+/).filter(Boolean);
      for (const m of moves) {
        try {
          const result = chess.move(m);
          if (!result) {
            setCustomError(`Invalid move: ${m}`);
            setCustomPreviewFen(null);
            return;
          }
        } catch {
          setCustomError(`Invalid move: ${m}`);
          setCustomPreviewFen(null);
          return;
        }
      }
      setCustomError(null);
      setCustomPreviewFen(chess.fen());
    }
  }, [customMode, customMoves, customFen]);

  const filtered = useMemo(() => {
    return OPENINGS.filter((o) => {
      if (ecoFilter !== "all" && !o.eco.startsWith(ecoFilter)) return false;
      if (search) {
        const term = search.toLowerCase();
        return (
          o.name.toLowerCase().includes(term) ||
          o.eco.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [search, ecoFilter]);

  const toggleOpening = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllFiltered = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const o of filtered) next.add(o.eco + ":" + o.name);
      return next;
    });
  }, [filtered]);

  const deselectAllFiltered = useCallback(() => {
    const filteredIds = new Set(filtered.map((o) => o.eco + ":" + o.name));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of filteredIds) next.delete(id);
      return next;
    });
  }, [filtered]);

  const handleAddCustom = useCallback(() => {
    if (customError || (!customMoves.trim() && !customFen.trim())) return;

    const id = `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const name = customName.trim() || (customMode === "fen" ? "Custom Position" : "Custom Opening");

    let opening: SelectedOpening;
    if (customMode === "fen") {
      opening = {
        type: "custom",
        id,
        name,
        moves: [],
        fen: customFen.trim(),
        uci: [],
      };
    } else {
      const chess = new Chess();
      const sanMoves: string[] = [];
      const uciMoves: string[] = [];
      const rawMoves = customMoves.trim().replace(/\d+\.\s*/g, "").split(/\s+/).filter(Boolean);
      for (const m of rawMoves) {
        const result = chess.move(m);
        if (!result) break;
        sanMoves.push(result.san);
        uciMoves.push(moveToUci(result));
      }
      opening = {
        type: "custom",
        id,
        name,
        moves: sanMoves,
        fen: chess.fen(),
        uci: uciMoves,
      };
    }

    setCustomOpenings((prev) => [...prev, opening]);
    setSelected((prev) => new Set(prev).add(id));
    setCustomName("");
    setCustomMoves("");
    setCustomFen("");
    setCustomPreviewFen(null);
    setShowCustomForm(false);
  }, [customError, customMode, customMoves, customFen, customName]);

  const removeCustom = useCallback((id: string) => {
    setCustomOpenings((prev) => prev.filter((o) => o.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const result: SelectedOpening[] = [];

    // ECO openings
    for (const o of OPENINGS) {
      const id = o.eco + ":" + o.name;
      if (selected.has(id)) {
        result.push({
          type: "eco",
          id,
          name: o.name,
          moves: o.moves,
          fen: o.fen,
          uci: o.uci,
        });
      }
    }

    // Custom openings
    for (const o of customOpenings) {
      if (selected.has(o.id)) {
        result.push(o);
      }
    }

    onConfirm(result);
  }, [selected, customOpenings, onConfirm]);

  const selectedCount = selected.size;
  const allFilteredSelected = filtered.every((o) =>
    selected.has(o.eco + ":" + o.name),
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 md:p-5 max-h-[90vh] flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-100">
              Opening Book
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {OPENINGS.length} ECO openings available
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-gray-200"
          >
            Close
          </button>
        </div>

        {/* Search + Filter */}
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ECO code..."
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* ECO category buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setEcoFilter("all")}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              ecoFilter === "all"
                ? "bg-emerald-800/60 text-emerald-300"
                : "bg-slate-800 text-gray-400 hover:text-gray-200"
            }`}
          >
            All
          </button>
          {ECO_CATEGORIES.map((cat) => (
            <button
              key={cat.prefix}
              onClick={() =>
                setEcoFilter(ecoFilter === cat.prefix ? "all" : cat.prefix)
              }
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                ecoFilter === cat.prefix
                  ? "bg-emerald-800/60 text-emerald-300"
                  : "bg-slate-800 text-gray-400 hover:text-gray-200"
              }`}
            >
              {cat.prefix}: {cat.label}
            </button>
          ))}
        </div>

        {/* Stats + Select all */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">
            {filtered.length} openings shown · {selectedCount} selected
          </span>
          <button
            onClick={allFilteredSelected ? deselectAllFiltered : selectAllFiltered}
            className="text-emerald-400 hover:text-emerald-300 font-medium"
          >
            {allFilteredSelected ? "Deselect all filtered" : "Select all filtered"}
          </button>
        </div>

        {/* Opening list */}
        <div className="min-h-0 flex-1 overflow-y-auto border border-slate-700 rounded-lg bg-slate-950/50">
          <div className="divide-y divide-slate-800">
            {filtered.map((o) => {
              const id = o.eco + ":" + o.name;
              const isSelected = selected.has(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleOpening(id)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
                    isSelected
                      ? "bg-emerald-900/20"
                      : "hover:bg-slate-800/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    readOnly
                    checked={isSelected}
                    className="w-3.5 h-3.5 accent-emerald-500 shrink-0"
                  />
                  <span className="text-xs text-emerald-400 font-mono w-8 shrink-0">
                    {o.eco}
                  </span>
                  <span className="text-sm text-gray-200 flex-1 min-w-0 truncate">
                    {o.name}
                  </span>
                  <span className="text-xs text-gray-500 shrink-0">
                    {o.moves.length} moves
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom openings */}
        {customOpenings.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 font-medium">
              Custom openings ({customOpenings.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {customOpenings.map((o) => (
                <span
                  key={o.id}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border ${
                    selected.has(o.id)
                      ? "border-emerald-600 bg-emerald-900/20 text-emerald-200"
                      : "border-slate-700 bg-slate-800 text-gray-300"
                  }`}
                >
                  <button onClick={() => toggleOpening(o.id)}>
                    {o.name}
                  </button>
                  <button
                    onClick={() => removeCustom(o.id)}
                    className="text-gray-500 hover:text-red-400 ml-1"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Add custom opening */}
        <div>
          <button
            onClick={() => setShowCustomForm((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            {showCustomForm ? "- Hide custom opening form" : "+ Add custom opening"}
          </button>
          {showCustomForm && (
            <div className="mt-2 flex flex-col gap-2 p-3 border border-slate-700 rounded-lg bg-slate-800/50">
              <div className="flex gap-2">
                <button
                  onClick={() => setCustomMode("moves")}
                  className={`px-2 py-1 rounded text-xs ${
                    customMode === "moves"
                      ? "bg-emerald-800/60 text-emerald-300"
                      : "bg-slate-700 text-gray-400"
                  }`}
                >
                  By Moves
                </button>
                <button
                  onClick={() => setCustomMode("fen")}
                  className={`px-2 py-1 rounded text-xs ${
                    customMode === "fen"
                      ? "bg-emerald-800/60 text-emerald-300"
                      : "bg-slate-700 text-gray-400"
                  }`}
                >
                  By FEN
                </button>
              </div>
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Name (optional)"
                className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-gray-200 placeholder-gray-500"
              />
              {customMode === "moves" ? (
                <input
                  value={customMoves}
                  onChange={(e) => setCustomMoves(e.target.value)}
                  placeholder="e.g. 1. e4 e5 2. Nf3 Nc6 3. Bb5"
                  className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm font-mono text-gray-200 placeholder-gray-500"
                />
              ) : (
                <input
                  value={customFen}
                  onChange={(e) => setCustomFen(e.target.value)}
                  placeholder="Paste FEN string..."
                  className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm font-mono text-gray-200 placeholder-gray-500"
                />
              )}
              {customError && (
                <p className="text-xs text-red-400">{customError}</p>
              )}
              {customPreviewFen && (
                <FenPreviewBoard fen={customPreviewFen} />
              )}
              <button
                onClick={handleAddCustom}
                disabled={!!customError || (!customMoves.trim() && !customFen.trim())}
                className="self-start px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-gray-500 text-white rounded text-xs font-medium"
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-700">
          <p className="text-sm text-gray-300">
            {selectedCount} opening{selectedCount !== 1 ? "s" : ""} selected
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSelected(new Set());
                setCustomOpenings([]);
              }}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg text-sm"
            >
              Clear All
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedCount === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium"
            >
              Confirm ({selectedCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
