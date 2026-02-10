import { useState, useMemo, useCallback, useEffect } from "react";
import { fetchOpenings } from "../data/openings";
import { ECO_CATEGORIES, type SelectedOpening, type Opening } from "../types/openings";
import { validateFen } from "../utils/fen";
import { FenPreviewBoard } from "./FenPreviewBoard";
import { Chess } from "chess.js";

interface OpeningPickerProps {
  onClose: () => void;
  onConfirm: (selected: SelectedOpening[]) => void;
  initialSelected?: SelectedOpening[];
}

function moveToUci(move: { from: string; to: string; promotion?: string }) {
  return move.from + move.to + (move.promotion || "");
}

type IndexedOpening = Opening & { idx: number };

export function OpeningPicker({
  onClose,
  onConfirm,
  initialSelected,
}: OpeningPickerProps) {
  const [openings, setOpenings] = useState<IndexedOpening[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [ecoFilter, setEcoFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelected?.map((o) => o.id) ?? []),
  );
  const [customOpenings, setCustomOpenings] = useState<SelectedOpening[]>(
    () => initialSelected?.filter((o) => o.type === "custom") ?? [],
  );

  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  // Custom opening form
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customMoves, setCustomMoves] = useState("");
  const [customFen, setCustomFen] = useState("");
  const [customMode, setCustomMode] = useState<"moves" | "fen">("moves");

  useEffect(() => {
    let cancelled = false;
    fetchOpenings().then((data) => {
      if (cancelled) return;
      setOpenings(data.map((o, i) => ({ ...o, idx: i })));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // Derived validation — no effect needed
  const { customError, customPreviewFen } = useMemo(() => {
    if (customMode === "fen") {
      if (!customFen.trim())
        return { customError: null, customPreviewFen: null };
      const result = validateFen(customFen.trim());
      if (result.valid)
        return { customError: null, customPreviewFen: customFen.trim() };
      return {
        customError: result.error ?? "Invalid FEN",
        customPreviewFen: null,
      };
    }
    if (!customMoves.trim())
      return { customError: null, customPreviewFen: null };
    const chess = new Chess();
    const moves = customMoves
      .trim()
      .replace(/\d+\.\s*/g, "")
      .split(/\s+/)
      .filter(Boolean);
    for (const m of moves) {
      try {
        const result = chess.move(m);
        if (!result)
          return { customError: `Invalid move: ${m}`, customPreviewFen: null };
      } catch {
        return { customError: `Invalid move: ${m}`, customPreviewFen: null };
      }
    }
    return { customError: null, customPreviewFen: chess.fen() };
  }, [customMode, customMoves, customFen]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    const searchMoves = term
      ? term.replace(/\d+\.+\s*/g, "").split(/\s+/).filter(Boolean)
      : [];

    return openings.filter((o) => {
      if (ecoFilter !== "all" && !o.eco.startsWith(ecoFilter)) return false;
      if (!term) return true;
      if (o.name.toLowerCase().includes(term) || o.eco.toLowerCase().includes(term)) return true;
      if (
        searchMoves.length > 0 &&
        searchMoves.every((m, i) =>
          i === searchMoves.length - 1
            ? o.moves[i]?.toLowerCase().startsWith(m.toLowerCase())
            : o.moves[i]?.toLowerCase() === m.toLowerCase(),
        )
      ) return true;
      return false;
    });
  }, [search, ecoFilter, openings]);

  const visibleOpenings = filtered;

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
      for (const o of filtered) next.add(String(o.idx));
      return next;
    });
  }, [filtered]);

  const deselectAllFiltered = useCallback(() => {
    const filteredIds = new Set(filtered.map((o) => String(o.idx)));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of filteredIds) next.delete(id);
      return next;
    });
  }, [filtered]);

  const handleAddCustom = useCallback(() => {
    if (customError || (!customMoves.trim() && !customFen.trim())) return;

    const id = `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const name =
      customName.trim() ||
      (customMode === "fen" ? "Custom Position" : "Custom Opening");

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
      const rawMoves = customMoves
        .trim()
        .replace(/\d+\.\s*/g, "")
        .split(/\s+/)
        .filter(Boolean);
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

    for (const o of openings) {
      const id = String(o.idx);
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

    for (const o of customOpenings) {
      if (selected.has(o.id)) {
        result.push(o);
      }
    }

    onConfirm(result);
  }, [selected, customOpenings, onConfirm, openings]);

  const resetFilterView = useCallback(() => {
    setLastClickedIndex(null);
  }, []);

  const selectedCount = selected.size;
  const allFilteredSelected =
    filtered.length > 0 &&
    filtered.every((o) => selected.has(String(o.idx)));

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
              {openings.length > 0 ? `${openings.length} openings available` : "Loading..."}
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
            onChange={(e) => {
              setSearch(e.target.value);
              resetFilterView();
            }}
            placeholder="Search by name, ECO code, or moves..."
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* ECO category buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => {
              setEcoFilter("all");
              resetFilterView();
            }}
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
              key={cat.label}
              onClick={() => {
                setEcoFilter(ecoFilter === cat.prefix ? "all" : cat.prefix);
                resetFilterView();
              }}
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
            {filtered.length} shown · {selectedCount} selected
          </span>
          <button
            onClick={
              allFilteredSelected ? deselectAllFiltered : selectAllFiltered
            }
            className="text-emerald-400 hover:text-emerald-300 font-medium"
          >
            {allFilteredSelected
              ? "Deselect all filtered"
              : "Select all filtered"}
          </button>
        </div>

        {/* Opening list */}
        <div className="min-h-0 flex-1 overflow-y-auto border border-slate-700 rounded-lg bg-slate-950/50" style={{ minHeight: "300px" }}>
          {loading ? (
            <div className="flex items-center justify-center h-full min-h-[300px] text-gray-500 text-sm">
              Loading openings...
            </div>
          ) : visibleOpenings.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[300px] text-gray-500 text-sm">
              No openings found for &ldquo;{search}&rdquo;
            </div>
          ) : (
          <div className="divide-y divide-slate-800">
            {visibleOpenings.map((o, idx) => {
              const id = String(o.idx);
              const isSelected = selected.has(id);
              return (
                <button
                  key={id}
                  onClick={(e) => {
                    if (e.shiftKey && lastClickedIndex !== null) {
                      const start = Math.min(lastClickedIndex, idx);
                      const end = Math.max(lastClickedIndex, idx);
                      setSelected((prev) => {
                        const next = new Set(prev);
                        for (let i = start; i <= end; i++) {
                          const item = visibleOpenings[i];
                          if (item) next.add(String(item.idx));
                        }
                        return next;
                      });
                    } else {
                      toggleOpening(id);
                    }
                    setLastClickedIndex(idx);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
                    isSelected ? "bg-emerald-900/20" : "hover:bg-slate-800/50"
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
                  <span
                    className="text-xs text-gray-500 shrink-0"
                    title={o.moves.map((m, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${m}` : m)).join(" ")}
                  >
                    {o.moves.length} moves
                  </span>
                </button>
              );
            })}
          </div>
          )}
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
                  <button onClick={() => toggleOpening(o.id)}>{o.name}</button>
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
            {showCustomForm
              ? "- Hide custom opening form"
              : "+ Add custom opening"}
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
              {customPreviewFen && <FenPreviewBoard fen={customPreviewFen} />}
              <button
                onClick={handleAddCustom}
                disabled={
                  !!customError || (!customMoves.trim() && !customFen.trim())
                }
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
