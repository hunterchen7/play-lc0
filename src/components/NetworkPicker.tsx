import { useState, useEffect, useMemo, useCallback } from "react";
import { Download, Check, Trash2, Loader2, ExternalLink, Plus, Share2 } from "lucide-react";
import { NETWORKS, type NetworkInfo } from "../constants/networks";
import type { SavedGame } from "../types/game";
import {
  hasModelCached,
  cacheModel,
  deleteCachedModel,
  decompressGzip,
} from "../engine/modelCache";
import { getModelUrl } from "../config";
import { useNetworks } from "../hooks/useNetworks";
import { AddCustomModelModal } from "./AddCustomModelModal";
import { validateFen } from "../utils/fen";
import { FenPreviewBoard } from "./FenPreviewBoard";
import { OpeningPicker } from "./OpeningPicker";
import type { SelectedOpening } from "../types/openings";
import { buildShareUrl } from "../utils/shareParams";

type SortColumn = "elo" | "size";
type SortDirection = "asc" | "desc";
const LAST_SELECTED_NETWORK_KEY = "lc0-selected-network-id";
const LAST_TEMPERATURE_KEY = "lc0-temperature";
const LAST_FEN_KEY = "lc0-start-fen";
const OPENINGS_KEY_PREFIX = "lc0-openings-";
const DEFAULT_TEMPERATURE = 0.15;

function loadOpeningsForNetwork(networkId: string): SelectedOpening[] {
  try {
    const raw = localStorage.getItem(OPENINGS_KEY_PREFIX + networkId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (o: Record<string, unknown>) =>
        typeof o?.id === "string" && typeof o?.name === "string",
    );
  } catch {
    return [];
  }
}

function saveOpeningsForNetwork(networkId: string, openings: SelectedOpening[]) {
  try {
    if (openings.length === 0) {
      localStorage.removeItem(OPENINGS_KEY_PREFIX + networkId);
    } else {
      localStorage.setItem(OPENINGS_KEY_PREFIX + networkId, JSON.stringify(openings));
    }
  } catch { /* ignore */ }
}

interface NetworkPickerProps {
  onStart: (
    network: NetworkInfo,
    color: "w" | "b",
    temperature: number,
    savedGame?: SavedGame,
    startFen?: string,
    openings?: SelectedOpening[],
  ) => void;
}

function parseEloBounds(elo: string): { low: number; high: number } {
  const values = (elo.match(/\d+/g) ?? [])
    .map((value) => parseInt(value, 10))
    .filter((value) => Number.isFinite(value));

  if (values.length === 0) return { low: 0, high: 0 };
  if (values.length === 1) return { low: values[0], high: values[0] };

  const first = values[0];
  const second = values[1];
  return {
    low: Math.min(first, second),
    high: Math.max(first, second),
  };
}

function compareElo(a: string, b: string): number {
  const left = parseEloBounds(a);
  const right = parseEloBounds(b);
  if (left.low !== right.low) return left.low - right.low;
  if (left.high !== right.high) return left.high - right.high;
  return 0;
}

function parseSizeMB(size: string): number {
  const match = size.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

function modelUrl(file: string) {
  return getModelUrl(file);
}

export function NetworkPicker({ onStart }: NetworkPickerProps) {
  const { networks, addCustomModel, removeCustomModel } = useNetworks();
  const [showCustomModal, setShowCustomModal] = useState(false);

  const [selected, setSelected] = useState<NetworkInfo>(() => {
    const savedId = localStorage.getItem(LAST_SELECTED_NETWORK_KEY);
    if (!savedId) return NETWORKS[0];
    return NETWORKS.find((net) => net.id === savedId) ?? NETWORKS[0];
  });
  const [color, setColor] = useState<"w" | "b" | "random">("w");
  const [temperature, setTemperature] = useState(() => {
    const savedTemperature = localStorage.getItem(LAST_TEMPERATURE_KEY);
    if (!savedTemperature) return DEFAULT_TEMPERATURE;
    const parsed = Number(savedTemperature);
    if (!Number.isFinite(parsed)) return DEFAULT_TEMPERATURE;
    return Math.min(2, Math.max(0, parsed));
  });
  const [sortColumn, setSortColumn] = useState<SortColumn>(() => {
    return (localStorage.getItem("lc0-sort-column") as SortColumn) || "elo";
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    return (
      (localStorage.getItem("lc0-sort-direction") as SortDirection) || "asc"
    );
  });
  const [searchTerm, setSearchTerm] = useState(() => {
    return localStorage.getItem("lc0-search-term") || "";
  });

  const [showDownloadedOnly, setShowDownloadedOnly] = useState(false);
  const [cachedModels, setCachedModels] = useState<Set<string>>(new Set());
  const [cacheLoading, setCacheLoading] = useState(true);
  const [downloading, setDownloading] = useState<Map<string, number>>(
    new Map(),
  );
  const [deleteConfirm, setDeleteConfirm] = useState<
    NetworkInfo | "all" | null
  >(null);
  const [downloadConfirm, setDownloadConfirm] = useState<NetworkInfo | null>(
    null,
  );
  const [fenInput, setFenInput] = useState(() => {
    return localStorage.getItem(LAST_FEN_KEY) || "";
  });
  const [showFenInput, setShowFenInput] = useState(() => {
    return !!localStorage.getItem(LAST_FEN_KEY);
  });
  const [selectedOpenings, setSelectedOpenings] = useState<SelectedOpening[]>(
    () => loadOpeningsForNetwork(selected.id),
  );
  const [showOpeningPicker, setShowOpeningPicker] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Derived FEN validation — no effect needed
  const fenValidation = useMemo(() => {
    const trimmed = fenInput.trim();
    if (!trimmed) return { valid: false, error: null };
    const result = validateFen(trimmed);
    return {
      valid: result.valid,
      error: result.valid ? null : (result.error ?? "Invalid FEN"),
    };
  }, [fenInput]);
  const fenValid = fenValidation.valid;
  const fenError = fenValidation.error;

  const selectNetwork = useCallback((net: NetworkInfo) => {
    setSelected(net);
    setSelectedOpenings(loadOpeningsForNetwork(net.id));
  }, []);

  // Re-resolve selected network when custom models finish loading.
  useEffect(() => {
    const savedId = localStorage.getItem(LAST_SELECTED_NETWORK_KEY);
    if (!savedId) return;
    setSelected((prev) => {
      if (prev.id === savedId) return prev;
      const found = networks.find((net) => net.id === savedId);
      if (!found) return prev;
      setSelectedOpenings(loadOpeningsForNetwork(found.id));
      return found;
    });
  }, [networks]);

  useEffect(() => {
    localStorage.setItem("lc0-sort-column", sortColumn);
    localStorage.setItem("lc0-sort-direction", sortDirection);
    localStorage.setItem("lc0-search-term", searchTerm);
    localStorage.setItem(LAST_SELECTED_NETWORK_KEY, selected.id);
    localStorage.setItem(LAST_TEMPERATURE_KEY, temperature.toString());
    const trimmedFen = fenInput.trim();
    if (trimmedFen && fenValid) {
      localStorage.setItem(LAST_FEN_KEY, trimmedFen);
    } else {
      localStorage.removeItem(LAST_FEN_KEY);
    }
  }, [sortColumn, sortDirection, searchTerm, selected.id, temperature, fenInput, fenValid]);

  // Check cache status for built-in networks once on mount
  useEffect(() => {
    let cancelled = false;
    async function checkCache() {
      const cached = new Set<string>();
      for (const net of NETWORKS) {
        if (await hasModelCached(modelUrl(net.file))) {
          cached.add(net.id);
        }
      }
      if (!cancelled) {
        setCachedModels((prev) => {
          const next = new Set(prev);
          for (const id of cached) next.add(id);
          return next;
        });
        setCacheLoading(false);
      }
    }
    checkCache();
    return () => { cancelled = true; };
  }, []);

  // Custom models are always cached (uploaded locally) — merge their IDs
  // synchronously whenever the network list changes so there's no async gap.
  useEffect(() => {
    const customIds = networks.filter((n) => n.isCustom).map((n) => n.id);
    if (customIds.length === 0) return;
    setCachedModels((prev) => {
      const next = new Set(prev);
      for (const id of customIds) next.add(id);
      return next;
    });
  }, [networks]);

  const sortedNetworks = useMemo(() => {
    const filtered = networks.filter((net) => {
      if (showDownloadedOnly && !cachedModels.has(net.id)) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        net.name.toLowerCase().includes(term) ||
        net.arch.toLowerCase().includes(term) ||
        net.description.toLowerCase().includes(term) ||
        net.elo.toLowerCase().includes(term)
      );
    });

    const sorted = [...filtered].sort((a, b) => {
      const val =
        sortColumn === "elo"
          ? compareElo(a.elo, b.elo)
          : parseSizeMB(a.size) - parseSizeMB(b.size);
      return sortDirection === "asc" ? val : -val;
    });
    return sorted;
  }, [networks, sortColumn, sortDirection, searchTerm, showDownloadedOnly, cachedModels]);

  const totalCachedSize = useMemo(() => {
    let total = 0;
    for (const net of networks) {
      if (cachedModels.has(net.id)) total += parseSizeMB(net.size);
    }
    return total;
  }, [networks, cachedModels]);

  const selectedIsCached = cachedModels.has(selected.id);

  const toggleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  const sortIndicator = (col: SortColumn) => {
    if (sortColumn !== col) return " ↕";
    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  const isLargeModel = (net: NetworkInfo) => parseSizeMB(net.size) > 25;

  const handleDownload = useCallback(async (net: NetworkInfo) => {
    const cacheKey = modelUrl(net.file);
    const downloadUrl = net.url || cacheKey;
    setDownloading((prev) => new Map(prev).set(net.id, 0));

    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentLength = response.headers.get("Content-Length");
      const total = contentLength ? parseInt(contentLength) : 0;

      let compressed: ArrayBuffer;
      if (total > 0 && response.body) {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          setDownloading((prev) => new Map(prev).set(net.id, received / total));
        }

        const buffer = new Uint8Array(received);
        let pos = 0;
        for (const chunk of chunks) {
          buffer.set(chunk, pos);
          pos += chunk.length;
        }
        compressed = buffer.buffer;
      } else {
        compressed = await response.arrayBuffer();
      }

      const modelData = await decompressGzip(compressed);
      await cacheModel(cacheKey, modelData);
      setCachedModels((prev) => new Set(prev).add(net.id));
      selectNetwork(net);
    } catch (e) {
      console.error("Download failed:", e);
    } finally {
      setDownloading((prev) => {
        const next = new Map(prev);
        next.delete(net.id);
        return next;
      });
    }
  }, []);


  const handleDelete = useCallback(async (net: NetworkInfo) => {
    if (net.isCustom) {
      await removeCustomModel(net.id);
    } else {
      await deleteCachedModel(modelUrl(net.file));
    }
    setCachedModels((prev) => {
      const next = new Set(prev);
      next.delete(net.id);
      return next;
    });
    setDeleteConfirm(null);
  }, [removeCustomModel]);

  const handleDeleteAll = useCallback(async () => {
    for (const net of networks) {
      if (cachedModels.has(net.id)) {
        if (net.isCustom) {
          await removeCustomModel(net.id);
        } else {
          await deleteCachedModel(modelUrl(net.file));
        }
      }
    }
    setCachedModels(new Set());
    setDeleteConfirm(null);
  }, [networks, cachedModels, removeCustomModel]);

  const handleStart = () => {
    if (!selectedIsCached) return;
    const actualColor =
      color === "random" ? (Math.random() < 0.5 ? "w" : "b") : color;
    const startFen = fenValid ? fenInput.trim() : undefined;
    const openings = selectedOpenings.length > 0 ? selectedOpenings : undefined;
    onStart(selected, actualColor, temperature, undefined, startFen, openings);
  };

  return (
    <>
      <div className="flex flex-col lg:max-w-2xl">
        <div className="w-full">
          <h2 className="text-lg font-semibold text-gray-200 mb-3">
            Choose your opponent
          </h2>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="Search networks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
            />
            <button
              onClick={() => setShowCustomModal(true)}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0"
              title="Add custom ONNX model"
            >
              <Plus size={16} />
              Custom
            </button>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">
                {sortedNetworks.length}{" "}
                {sortedNetworks.length === 1 ? "network" : "networks"}
              </span>
              <button
                onClick={() => setShowDownloadedOnly((v) => !v)}
                className={`px-2 py-1 rounded transition-colors font-medium ${
                  showDownloadedOnly
                    ? "bg-emerald-800/60 text-emerald-300"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {showDownloadedOnly ? "Downloaded" : "All"}
              </button>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-gray-500 mr-1">Sort:</span>
              <button
                onClick={() => toggleSort("elo")}
                className={`px-2 py-1 rounded transition-colors font-medium ${
                  sortColumn === "elo"
                    ? "bg-emerald-800/60 text-emerald-300"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Elo{sortIndicator("elo")}
              </button>
              <button
                onClick={() => toggleSort("size")}
                className={`px-2 py-1 rounded transition-colors font-medium ${
                  sortColumn === "size"
                    ? "bg-emerald-800/60 text-emerald-300"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Size{sortIndicator("size")}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2 min-h-[50vh] max-h-[50vh] overflow-y-auto overflow-x-hidden rounded-lg pr-3">
            {sortedNetworks.map((net) => {
              const isCached = cachedModels.has(net.id);
              const dlProgress = downloading.get(net.id);
              const isDownloading = dlProgress !== undefined;

              return (
                <div
                  key={net.id}
                  className={`relative w-full text-left rounded-lg border transition-colors min-h-24 ${
                    selected.id === net.id
                      ? "border-emerald-500 bg-emerald-900/30"
                      : "border-slate-700 bg-slate-800/50 hover:border-slate-500"
                  }`}
                >
                  {isDownloading && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-700 rounded-b-lg overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-150"
                        style={{ width: `${dlProgress * 100}%` }}
                      />
                    </div>
                  )}
                  <div className="flex items-stretch">
                    <button
                      onClick={() => selectNetwork(net)}
                      className="flex-1 text-left px-4 py-3 min-w-0"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-100">
                            {net.name}
                          </span>
                          {net.isCustom && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-purple-600/40 text-purple-300 rounded">
                              Custom
                            </span>
                          )}
                          {net.source && (
                          <a
                            href={net.source}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-gray-500 hover:text-gray-300 transition-colors"
                            title="View original weights source"
                          >
                            <ExternalLink size={13} />
                          </a>
                          )}
                        </div>
                        <div className="flex items-baseline gap-3">
                          <span className="text-xs text-gray-400">
                            {net.arch}
                          </span>
                          <span className="text-xs text-emerald-400 font-mono">
                            {net.elo}
                          </span>
                          <span className="relative group/size">
                            <span className="text-xs text-gray-300 font-mono cursor-help">
                              {net.downloadSize}
                            </span>
                            <span className="absolute top-0 right-full mr-2 px-2.5 py-1.5 bg-slate-700 border border-slate-600 text-xs text-gray-200 rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover/size:opacity-100 transition-opacity duration-150 shadow-lg z-50">
                              Download: {net.downloadSize} (compressed)
                              <br />
                              On disk: {net.size} (uncompressed)
                            </span>
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        {net.description}
                      </p>
                    </button>
                    <div className="flex items-center px-2 shrink-0 group/icons">
                      {isDownloading ? (
                        <div
                          className="p-1.5 text-emerald-400"
                          title="Downloading..."
                        >
                          <Loader2 size={18} className="animate-spin" />
                        </div>
                      ) : isCached ? (
                        <>
                          <div
                            className="p-1.5 text-emerald-400 group-hover/icons:hidden"
                            title="Downloaded"
                          >
                            <Check size={18} />
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(net);
                            }}
                            className="p-1.5 text-gray-500 hover:text-red-400 transition-colors hidden group-hover/icons:block"
                            title="Delete from cache"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      ) : cacheLoading ? (
                        <div className="p-1.5 text-gray-600" title="Checking cache...">
                          <Loader2 size={18} className="animate-spin" />
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isLargeModel(net)) {
                              setDownloadConfirm(net);
                            } else {
                              handleDownload(net);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-emerald-400 transition-colors"
                          title={`Download ${net.size}`}
                        >
                          <Download size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {cachedModels.size >= 2 && (
            <button
              onClick={() => setDeleteConfirm("all")}
              className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors ml-auto"
            >
              <Trash2 size={14} />
              Delete all models ({totalCachedSize.toFixed(1)} MB)
            </button>
          )}
        </div>

        <div className="w-full">
          <h2 className="text-lg font-semibold text-gray-200 mb-3 mt-3">
            Play as
          </h2>
          <div className="flex gap-3">
            <button
              onClick={() => setColor("w")}
              className={`flex-1 py-3 rounded-lg font-semibold text-lg transition-colors ${
                color === "w"
                  ? "bg-white text-gray-900"
                  : "bg-slate-700 text-gray-400 hover:bg-slate-600"
              }`}
            >
              White
            </button>
            <button
              onClick={() => setColor("random")}
              className={`flex-1 py-3 rounded-lg font-semibold text-lg transition-colors ${
                color === "random"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-700 text-gray-400 hover:bg-slate-600"
              }`}
            >
              Random
            </button>
            <button
              onClick={() => setColor("b")}
              className={`flex-1 py-3 rounded-lg font-semibold text-lg transition-colors ${
                color === "b"
                  ? "bg-gray-800 text-white border-2 border-gray-400"
                  : "bg-slate-700 text-gray-400 hover:bg-slate-600"
              }`}
            >
              Black
            </button>
          </div>
        </div>

        <div className="w-full">
          <h2 className="text-lg font-semibold text-gray-200 mb-3">
            Temperature
          </h2>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="flex-1 accent-emerald-500"
              />
              <span className="text-gray-300 font-mono text-sm w-20 text-right">
                {temperature === 0 ? "Off" : temperature.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span>Best move</span>
              <span>More random</span>
            </div>
          </div>
        </div>

        <div className="w-full">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-200">
              Opening Book
            </h2>
            <button
              onClick={() => setShowOpeningPicker(true)}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
            >
              {selectedOpenings.length > 0
                ? `${selectedOpenings.length} selected`
                : "Select Openings"}
            </button>
          </div>
          {selectedOpenings.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                {selectedOpenings.slice(0, 10).map((o) => (
                  <span
                    key={o.id}
                    className="inline-block px-2 py-0.5 rounded text-xs bg-emerald-900/30 text-emerald-300 border border-emerald-700/40"
                  >
                    {o.type === "eco" ? o.id.split(":")[0] + " " : ""}
                    {o.name.length > 40 ? o.name.slice(0, 37) + "..." : o.name}
                  </span>
                ))}
                {selectedOpenings.length > 10 && (
                  <span className="text-xs text-gray-500">
                    +{selectedOpenings.length - 10} more
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedOpenings([]);
                  saveOpeningsForNetwork(selected.id, []);
                }}
                className="self-start text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Clear openings
              </button>
            </div>
          )}
          {selectedOpenings.length === 0 && (
            <p className="text-xs text-gray-500 mt-1">
              No openings selected. Bot will use neural network from move 1.
            </p>
          )}
        </div>

        <div className="w-full mt-1">
          <button
            onClick={() => setShowFenInput((v) => !v)}
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            {showFenInput ? "− Hide custom position" : "+ Start from custom position"}
          </button>
          {showFenInput && (
            <div className="mt-2 flex flex-col gap-2">
              <input
                type="text"
                placeholder="Paste FEN string..."
                value={fenInput}
                onChange={(e) => setFenInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors text-sm font-mono"
              />
              {fenError && (
                <p className="text-xs text-red-400">{fenError}</p>
              )}
              {fenValid && (
                <>
                  <FenPreviewBoard fen={fenInput.trim()} />
                  <button
                    onClick={() => {
                      setFenInput("");
                      localStorage.removeItem(LAST_FEN_KEY);
                    }}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Clear custom position
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 w-full">
          <button
            onClick={handleStart}
            disabled={!selectedIsCached || cacheLoading}
            className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-gray-500 text-white text-xl font-semibold rounded-xl transition-colors"
          >
            {cacheLoading
              ? "Checking cached models..."
              : selectedIsCached
                ? `Play vs ${selected.name}`
                : `${selected.name} not downloaded`}
          </button>
          {!selected.isCustom && (
            <div className="relative">
              <button
                onClick={() => {
                  if (shareCopied) return;
                  const url = buildShareUrl({
                    networkId: selected.id,
                    color,
                    temperature,
                    fen: fenValid ? fenInput.trim() : undefined,
                  });
                  navigator.clipboard.writeText(url);
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 2000);
                }}
                disabled={shareCopied}
                className="px-4 py-4 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-gray-500 text-gray-300 rounded-xl transition-colors flex items-center gap-2 shrink-0"
                title="Copy shareable link"
              >
                <Share2 size={20} />
                <span className="text-sm font-medium">Share</span>
              </button>
              {shareCopied && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-900 text-white text-xs rounded-lg whitespace-nowrap shadow-lg animate-fade-in">
                  Copied URL
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200 ${
          deleteConfirm
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className="absolute inset-0 bg-black/60"
          onClick={() => setDeleteConfirm(null)}
        />
        <div
          className={`relative bg-slate-800 border border-slate-600 rounded-xl p-6 max-w-sm mx-4 shadow-2xl transition-transform duration-200 ${
            deleteConfirm ? "scale-100" : "scale-95"
          }`}
        >
          <h3 className="text-lg font-semibold text-gray-100 mb-2">
            {deleteConfirm === "all" ? "Delete all models?" : "Delete model?"}
          </h3>
          <p className="text-sm text-gray-400 mb-5">
            {deleteConfirm === "all" ? (
              <>
                Remove{" "}
                <span className="text-gray-200 font-medium">
                  all {cachedModels.size} models
                </span>{" "}
                ({totalCachedSize.toFixed(1)} MB) from cache? You can
                re-download them later.
              </>
            ) : deleteConfirm?.isCustom ? (
              <>
                Remove{" "}
                <span className="text-gray-200 font-medium">
                  {deleteConfirm.name}
                </span>{" "}
                ({deleteConfirm.size})? This model was manually uploaded and{" "}
                <span className="text-red-300 font-medium">cannot be re-downloaded</span>.
                You will need to add it again manually.
              </>
            ) : deleteConfirm ? (
              <>
                Remove{" "}
                <span className="text-gray-200 font-medium">
                  {deleteConfirm.name}
                </span>{" "}
                ({deleteConfirm.size}) from cache? You can re-download it later.
              </>
            ) : null}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (deleteConfirm === "all") handleDeleteAll();
                else if (deleteConfirm) handleDelete(deleteConfirm);
              }}
              className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200 ${
          downloadConfirm
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className="absolute inset-0 bg-black/60"
          onClick={() => setDownloadConfirm(null)}
        />
        <div
          className={`relative bg-slate-800 border border-slate-600 rounded-xl p-6 max-w-sm mx-4 shadow-2xl transition-transform duration-200 ${
            downloadConfirm ? "scale-100" : "scale-95"
          }`}
        >
          <h3 className="text-lg font-semibold text-gray-100 mb-2">
            Download large model?
          </h3>
          <p className="text-sm text-gray-400 mb-5">
            {downloadConfirm && (
              <>
                <span className="text-gray-200 font-medium">
                  {downloadConfirm.name}
                </span>{" "}
                is {downloadConfirm.size} uncompressed (
                {downloadConfirm.downloadSize} download). This may take a while
                and use significant storage space.
              </>
            )}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDownloadConfirm(null)}
              className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (downloadConfirm) {
                  handleDownload(downloadConfirm);
                  setDownloadConfirm(null);
                }
              }}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
            >
              Download
            </button>
          </div>
        </div>
      </div>

      <AddCustomModelModal
        open={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onAdd={async (meta, data) => {
          await addCustomModel(meta, data);
          setCachedModels((prev) => new Set(prev).add(meta.id));
        }}
      />

      {showOpeningPicker && (
        <OpeningPicker
          onClose={() => setShowOpeningPicker(false)}
          onConfirm={(openings) => {
            setSelectedOpenings(openings);
            saveOpeningsForNetwork(selected.id, openings);
            setShowOpeningPicker(false);
          }}
          initialSelected={selectedOpenings}
        />
      )}
    </>
  );
}
