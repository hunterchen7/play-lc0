import { useCallback, useEffect, useMemo, useState } from "react";
import { NETWORKS, type NetworkInfo } from "../../constants/networks";
import {
  cacheModel,
  decompressGzip,
  hasModelCached,
} from "../../engine/modelCache";
import { getModelUrl } from "../../config";
import type { TournamentHistorySummary } from "../../utils/tournamentHistory";
import type {
  TournamentEntrant,
  TournamentFormat,
  TournamentSetupConfig,
} from "../../types/tournament";

type SortColumn = "elo" | "size" | "name";
type SortDirection = "asc" | "desc";

interface EntrantDraft {
  id: string;
  networkId: string;
  temperature: number;
  customLabel: string;
}

interface PersistedTournamentSetupDraft {
  format: TournamentFormat;
  entrants: EntrantDraft[];
  bestOf: number;
  maxSimultaneousGames: number;
  swissRounds: number;
}

interface TournamentSetupScreenProps {
  onStart: (config: TournamentSetupConfig) => void;
  savedTournaments: TournamentHistorySummary[];
  onOpenSavedTournament: (id: string) => void;
  onBack: () => void;
}

const TOURNAMENT_SETUP_STORAGE_KEY = "lc0-tournament-setup-v1";

function createEntrantDraft(networkId: string, temperature: number): EntrantDraft {
  return {
    id: `entrant-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    networkId,
    temperature,
    customLabel: "",
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseElo(elo: string): number {
  const match = elo.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function parseSizeMB(size: string): number {
  const match = size.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

function modelUrl(file: string): string {
  return getModelUrl(file);
}

function loadPersistedSetupDraft(): PersistedTournamentSetupDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(TOURNAMENT_SETUP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedTournamentSetupDraft>;

    const format =
      parsed.format === "swiss" || parsed.format === "round_robin"
        ? parsed.format
        : "round_robin";

    const entrants = Array.isArray(parsed.entrants)
      ? parsed.entrants
          .filter((item) => typeof item?.networkId === "string")
          .map((item) => ({
            id:
              typeof item.id === "string" && item.id.trim().length > 0
                ? item.id
                : `entrant-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            networkId: item.networkId,
            temperature: clamp(
              Number.isFinite(item.temperature) ? Number(item.temperature) : 0.15,
              0,
              2,
            ),
            customLabel:
              typeof item.customLabel === "string" ? item.customLabel : "",
          }))
      : [];

    const bestOf = clamp(
      typeof parsed.bestOf === "number" ? Math.floor(parsed.bestOf) : 3,
      1,
      20,
    );
    const maxSimultaneousGames = clamp(
      typeof parsed.maxSimultaneousGames === "number"
        ? Math.floor(parsed.maxSimultaneousGames)
        : 2,
      1,
      8,
    );
    const swissRounds = clamp(
      typeof parsed.swissRounds === "number"
        ? Math.floor(parsed.swissRounds)
        : 5,
      1,
      15,
    );

    return {
      format,
      entrants,
      bestOf,
      maxSimultaneousGames,
      swissRounds,
    };
  } catch {
    return null;
  }
}

export function TournamentSetupScreen({
  onStart,
  savedTournaments,
  onOpenSavedTournament,
  onBack,
}: TournamentSetupScreenProps) {
  const persistedSetup = useMemo(() => loadPersistedSetupDraft(), []);
  const [format, setFormat] = useState<TournamentFormat>(
    persistedSetup?.format ?? "round_robin",
  );
  const [entrants, setEntrants] = useState<EntrantDraft[]>(
    persistedSetup?.entrants ?? [],
  );
  const [bestOf, setBestOf] = useState(persistedSetup?.bestOf ?? 3);
  const [maxSimultaneousGames, setMaxSimultaneousGames] = useState(
    persistedSetup?.maxSimultaneousGames ?? 2,
  );
  const [swissRounds, setSwissRounds] = useState(persistedSetup?.swissRounds ?? 5);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addTemperature, setAddTemperature] = useState(0.15);
  const [modalSearch, setModalSearch] = useState("");
  const [modalArchFilter, setModalArchFilter] = useState("all");
  const [modalSortColumn, setModalSortColumn] = useState<SortColumn>("elo");
  const [modalSortDirection, setModalSortDirection] = useState<SortDirection>("asc");
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<Set<string>>(new Set());
  const [attemptedStart, setAttemptedStart] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [cachedModels, setCachedModels] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<Map<string, number>>(new Map());

  const networkById = useMemo(
    () => new Map(NETWORKS.map((network) => [network.id, network])),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function checkCache() {
      const cached = new Set<string>();
      for (const network of NETWORKS) {
        if (await hasModelCached(modelUrl(network.file))) {
          cached.add(network.id);
        }
      }
      if (!cancelled) {
        setCachedModels(cached);
      }
    }

    void checkCache();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const payload: PersistedTournamentSetupDraft = {
      format,
      entrants,
      bestOf,
      maxSimultaneousGames,
      swissRounds,
    };

    try {
      window.localStorage.setItem(
        TOURNAMENT_SETUP_STORAGE_KEY,
        JSON.stringify(payload),
      );
    } catch {
      // Ignore persistence errors; setup remains usable.
    }
  }, [bestOf, entrants, format, maxSimultaneousGames, swissRounds]);

  const handleDownload = useCallback(async (network: NetworkInfo) => {
    if (downloading.has(network.id)) return;

    const cacheKey = modelUrl(network.file);
    const downloadUrl = network.url || cacheKey;
    setDownloading((prev) => new Map(prev).set(network.id, 0));

    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentLength = response.headers.get("Content-Length");
      const total = contentLength ? parseInt(contentLength, 10) : 0;

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
          setDownloading((prev) =>
            new Map(prev).set(network.id, received / total),
          );
        }

        const buffer = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
          buffer.set(chunk, offset);
          offset += chunk.length;
        }
        compressed = buffer.buffer;
      } else {
        compressed = await response.arrayBuffer();
      }

      let modelData: ArrayBuffer;
      try {
        modelData = await decompressGzip(compressed);
      } catch {
        modelData = compressed;
      }

      await cacheModel(cacheKey, modelData);
      setCachedModels((prev) => new Set(prev).add(network.id));
    } catch (error) {
      console.error("Tournament model download failed:", error);
    } finally {
      setDownloading((prev) => {
        const next = new Map(prev);
        next.delete(network.id);
        return next;
      });
    }
  }, [downloading]);

  const archOptions = useMemo(() => {
    const unique = Array.from(new Set(NETWORKS.map((network) => network.arch)));
    return ["all", ...unique.sort((a, b) => a.localeCompare(b))];
  }, []);

  const entrantKeySet = useMemo(() => {
    return new Set(
      entrants.map((entrant) => `${entrant.networkId}:${entrant.temperature.toFixed(2)}`),
    );
  }, [entrants]);

  const duplicateKeys = useMemo(() => {
    const keyCounts = new Map<string, number>();
    for (const entrant of entrants) {
      const key = `${entrant.networkId}:${entrant.temperature.toFixed(2)}`;
      keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
    }

    return new Set(
      [...keyCounts.entries()]
        .filter(([, count]) => count > 1)
        .map(([key]) => key),
    );
  }, [entrants]);

  const modalNetworks = useMemo(() => {
    const term = modalSearch.trim().toLowerCase();

    const filtered = NETWORKS.filter((network) => {
      if (modalArchFilter !== "all" && network.arch !== modalArchFilter) {
        return false;
      }

      if (!term) return true;

      return (
        network.name.toLowerCase().includes(term) ||
        network.arch.toLowerCase().includes(term) ||
        network.elo.toLowerCase().includes(term) ||
        network.description.toLowerCase().includes(term)
      );
    });

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;

      if (modalSortColumn === "elo") {
        cmp = parseElo(a.elo) - parseElo(b.elo);
      } else if (modalSortColumn === "size") {
        cmp = parseSizeMB(a.size) - parseSizeMB(b.size);
      } else {
        cmp = a.name.localeCompare(b.name);
      }

      return modalSortDirection === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [modalArchFilter, modalSearch, modalSortColumn, modalSortDirection]);

  const duplicateBlockedNetworkIds = useMemo(() => {
    const keyTemp = addTemperature.toFixed(2);
    return new Set(
      NETWORKS.filter((network) => entrantKeySet.has(`${network.id}:${keyTemp}`)).map(
        (network) => network.id,
      ),
    );
  }, [addTemperature, entrantKeySet]);

  const uncachedNetworkIds = useMemo(
    () =>
      new Set(
        NETWORKS.filter((network) => !cachedModels.has(network.id)).map(
          (network) => network.id,
        ),
      ),
    [cachedModels],
  );

  const blockedNetworkIds = useMemo(
    () => new Set([...duplicateBlockedNetworkIds, ...uncachedNetworkIds]),
    [duplicateBlockedNetworkIds, uncachedNetworkIds],
  );

  const selectedAddableCount = useMemo(() => {
    let count = 0;
    for (const id of selectedNetworkIds) {
      if (!blockedNetworkIds.has(id)) count += 1;
    }
    return count;
  }, [blockedNetworkIds, selectedNetworkIds]);

  const validationError = useMemo(() => {
    if (entrants.length < 2) {
      return "Add at least 2 entrants to start a tournament.";
    }

    const missingNetwork = entrants.some(
      (entrant) => !networkById.has(entrant.networkId),
    );
    if (missingNetwork) {
      return "Every entrant must have a valid network selected.";
    }

    const hasUncachedEntrant = entrants.some(
      (entrant) => !cachedModels.has(entrant.networkId),
    );
    if (hasUncachedEntrant) {
      return "Download all entrant engines before starting the tournament.";
    }

    if (duplicateKeys.size > 0) {
      return "Duplicate entrants are only allowed when temperature differs.";
    }

    if (format === "swiss" && swissRounds < 1) {
      return "Swiss rounds must be at least 1.";
    }

    return null;
  }, [cachedModels, duplicateKeys, entrants, format, networkById, swissRounds]);

  const estimatedSeries = useMemo(() => {
    const n = entrants.length;
    if (n < 2) return 0;

    if (format === "round_robin") {
      return (n * (n - 1)) / 2;
    }

    return Math.floor(n / 2) * swissRounds;
  }, [entrants.length, format, swissRounds]);

  const estimatedGames = estimatedSeries * bestOf;

  const updateEntrant = (id: string, patch: Partial<EntrantDraft>) => {
    setEntrants((prev) =>
      prev.map((entrant) =>
        entrant.id === id ? { ...entrant, ...patch } : entrant,
      ),
    );
  };

  const removeEntrant = (id: string) => {
    setEntrants((prev) => prev.filter((entrant) => entrant.id !== id));
  };

  const openAddModal = () => {
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setSelectedNetworkIds(new Set());
  };

  const toggleModalSort = (column: SortColumn) => {
    if (modalSortColumn === column) {
      setModalSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setModalSortColumn(column);
      setModalSortDirection("asc");
    }
  };

  const toggleNetworkSelected = (networkId: string) => {
    if (blockedNetworkIds.has(networkId)) return;

    setSelectedNetworkIds((prev) => {
      const next = new Set(prev);
      if (next.has(networkId)) {
        next.delete(networkId);
      } else {
        next.add(networkId);
      }
      return next;
    });
  };

  const addSelectedEntrants = () => {
    if (selectedAddableCount === 0) return;

    const toAdd: EntrantDraft[] = [];
    const temp = Number(addTemperature.toFixed(2));

    for (const networkId of selectedNetworkIds) {
      if (blockedNetworkIds.has(networkId)) continue;
      toAdd.push(createEntrantDraft(networkId, temp));
    }

    if (toAdd.length === 0) return;

    setEntrants((prev) => [...prev, ...toAdd]);
    closeAddModal();
  };

  const handleStart = () => {
    setAttemptedStart(true);
    setStartError(null);
    if (validationError) {
      setIsStarting(false);
      setStartError(validationError);
      return;
    }

    const mappedEntrants: TournamentEntrant[] = [];
    for (const entrant of entrants) {
      const network = networkById.get(entrant.networkId);
      if (!network) {
        setIsStarting(false);
        setStartError("At least one entrant has an invalid network selection.");
        return;
      }

      const temp = Number(entrant.temperature.toFixed(2));
      mappedEntrants.push({
        id: entrant.id,
        network,
        temperature: temp,
        label:
          entrant.customLabel.trim() || `${network.name} @ ${temp.toFixed(2)}`,
      });
    }

    if (mappedEntrants.length < 2) {
      setIsStarting(false);
      setStartError("Add at least 2 valid entrants to start.");
      return;
    }

    setIsStarting(true);
    try {
      onStart({
        format,
        entrants: mappedEntrants,
        bestOf,
        maxSimultaneousGames,
        swissRounds,
      });
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(TOURNAMENT_SETUP_STORAGE_KEY);
      }
    } catch (error) {
      setIsStarting(false);
      setStartError(
        error instanceof Error ? error.message : "Failed to start tournament.",
      );
    }
  };

  const sortLabel = (column: SortColumn) => {
    if (modalSortColumn !== column) return "";
    return modalSortDirection === "asc" ? " ↑" : " ↓";
  };

  return (
    <>
      <div className="w-full max-w-6xl mx-auto p-4 md:p-8 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">Tournament</h1>
            <p className="text-sm text-gray-400 mt-1">
              Configure entrants, format, best-of, and concurrency.
            </p>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-200 rounded-lg text-sm"
          >
            Back to Home
          </button>
        </div>

        <div className="grid xl:grid-cols-[2fr,1fr] gap-5">
          <section className="bg-slate-900/80 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-100">Entrants</h2>
              <button
                onClick={openAddModal}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-sm"
              >
                Add Entrant
              </button>
            </div>

            {entrants.length === 0 ? (
              <div className="border border-dashed border-slate-700 rounded-lg p-6 text-center text-sm text-gray-500">
                No entrants yet. Click <span className="text-gray-300">Add Entrant</span> to choose one or more networks.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {entrants.map((entrant, index) => {
                  const key = `${entrant.networkId}:${entrant.temperature.toFixed(2)}`;
                  const duplicate = duplicateKeys.has(key);
                  const network = networkById.get(entrant.networkId) ?? null;
                  const isCached = network ? cachedModels.has(network.id) : false;
                  const downloadProgress = network
                    ? downloading.get(network.id)
                    : undefined;
                  const isDownloading = downloadProgress !== undefined;
                  return (
                    <div
                      key={entrant.id}
                      className={`p-3 rounded-lg border ${
                        duplicate
                          ? "border-red-500/60 bg-red-900/10"
                          : "border-slate-700 bg-slate-800/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-gray-300">Entrant {index + 1}</p>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] px-2 py-1 rounded ${
                              isCached
                                ? "bg-emerald-900/40 text-emerald-300"
                                : "bg-amber-900/40 text-amber-300"
                            }`}
                          >
                            {isCached ? "downloaded" : "not downloaded"}
                          </span>
                          {!isCached && network && (
                            <button
                              onClick={() => void handleDownload(network)}
                              disabled={isDownloading}
                              className="text-xs px-2 py-1 rounded bg-sky-700 hover:bg-sky-600 disabled:bg-slate-700 disabled:text-gray-500"
                            >
                              {isDownloading
                                ? `Downloading ${Math.round(downloadProgress * 100)}%`
                                : "Download"}
                            </button>
                          )}
                          <button
                            onClick={() => removeEntrant(entrant.id)}
                            className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-3 gap-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-gray-400">Network</span>
                          <select
                            value={entrant.networkId}
                            onChange={(e) =>
                              updateEntrant(entrant.id, {
                                networkId: e.target.value,
                              })
                            }
                            className="px-2 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm"
                          >
                            {NETWORKS.map((network) => (
                              <option key={network.id} value={network.id}>
                                {network.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-gray-400">
                            Temperature ({entrant.temperature.toFixed(2)})
                          </span>
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.05"
                            value={entrant.temperature}
                            onChange={(e) =>
                              updateEntrant(entrant.id, {
                                temperature: clamp(
                                  parseFloat(e.target.value),
                                  0,
                                  2,
                                ),
                              })
                            }
                            className="w-full accent-emerald-500"
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-gray-400">
                            Custom Label (optional)
                          </span>
                          <input
                            value={entrant.customLabel}
                            onChange={(e) =>
                              updateEntrant(entrant.id, {
                                customLabel: e.target.value,
                              })
                            }
                            placeholder="e.g. Maia 1500 sharp"
                            className="px-2 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm"
                          />
                        </label>
                      </div>

                      {duplicate && (
                        <p className="mt-2 text-xs text-red-300">
                          Duplicate network+temperature combination. Change temperature or network.
                        </p>
                      )}
                      {!isCached && (
                        <p className="mt-2 text-xs text-amber-300">
                          Download this engine before starting.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-gray-100">Settings</h2>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">Format</span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as TournamentFormat)}
                className="px-2 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm"
              >
                <option value="round_robin">Round Robin</option>
                <option value="swiss">Swiss</option>
              </select>
            </label>

            {format === "swiss" && (
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">
                  Swiss Rounds ({swissRounds})
                </span>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="1"
                  value={swissRounds}
                  onChange={(e) => setSwissRounds(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500"
                />
              </label>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">
                Best-of per pairing ({bestOf})
              </span>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={bestOf}
                onChange={(e) => setBestOf(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500"
              />
              <span className="text-[11px] text-gray-500">
                Any integer. If tied after planned games, sudden-death tiebreak games are added.
              </span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">
                Simultaneous Games ({maxSimultaneousGames})
              </span>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={maxSimultaneousGames}
                onChange={(e) =>
                  setMaxSimultaneousGames(
                    clamp(parseInt(e.target.value, 10), 1, 8),
                  )
                }
                className="w-full accent-emerald-500"
              />
            </label>

            <div className="rounded-lg bg-slate-800/80 p-3 text-sm text-gray-300">
              <p>
                Entrants: <span className="font-semibold">{entrants.length}</span>
              </p>
              <p>
                Estimated series: <span className="font-semibold">{estimatedSeries}</span>
              </p>
              <p>
                Estimated games: <span className="font-semibold">{estimatedGames}</span>
              </p>
            </div>

            {validationError && (
              <div className="rounded-lg bg-red-900/30 border border-red-700/50 p-3 text-sm text-red-200">
                {validationError}
              </div>
            )}

            <button
              onClick={handleStart}
              className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium"
            >
              {isStarting ? "Starting..." : "Start Tournament"}
            </button>
            {(attemptedStart && validationError) || startError ? (
              <p className="text-xs text-amber-300">
                Cannot start yet: {startError ?? validationError}
              </p>
            ) : null}
            {attemptedStart && !validationError && !startError && (
              <p className="text-xs text-emerald-300">
                Configuration valid. Starting should switch to live view.
              </p>
            )}
          </aside>
        </div>

        <section className="bg-slate-900/80 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-100">Saved Tournaments</h2>
            <p className="text-xs text-gray-500">
              Saved in IndexedDB
            </p>
          </div>

          {savedTournaments.length === 0 ? (
            <div className="h-40 md:h-44 rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-sm text-gray-500">
              Completed tournaments will appear here.
            </div>
          ) : (
            <div className="h-44 md:h-48 overflow-y-auto space-y-2 pr-1">
              {savedTournaments.map((item) => {
                const completedAt = new Date(item.completedAt).toLocaleString();
                const formatLabel =
                  item.format === "round_robin" ? "Round Robin" : "Swiss";
                return (
                  <button
                    key={item.id}
                    onClick={() => onOpenSavedTournament(item.id)}
                    className="w-full text-left p-3 rounded-lg border border-slate-700 bg-slate-800/60 hover:border-emerald-500/60 hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-100 truncate">
                        {item.winnerLabel ? `Winner: ${item.winnerLabel}` : "Tournament"}
                      </p>
                      <p className="text-[11px] text-gray-500 shrink-0">{completedAt}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatLabel} · {item.entrantsCount} entrants · {item.totalRounds} rounds · BO{item.bestOf} · Concurrency {item.maxSimultaneousGames}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Games: {item.finishedGames}/{item.totalGames}
                    </p>
                    {item.topPlacings.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1 truncate">
                        {item.topPlacings.join("  |  ")}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={closeAddModal} />
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 md:p-5 max-h-[90vh] flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-100">Add Entrants</h3>
              <p className="text-xs text-gray-400 mt-1">
                Select multiple networks and add them all at the same temperature.
              </p>
            </div>
            <button
              onClick={closeAddModal}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
            >
              Close
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-2">
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-xs text-gray-400">Search</span>
              <input
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                placeholder="Search by name, arch, elo, description"
                className="px-2 py-2 bg-slate-950 border border-slate-700 rounded-md text-sm"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">Architecture Filter</span>
              <select
                value={modalArchFilter}
                onChange={(e) => setModalArchFilter(e.target.value)}
                className="px-2 py-2 bg-slate-950 border border-slate-700 rounded-md text-sm"
              >
                {archOptions.map((arch) => (
                  <option key={arch} value={arch}>
                    {arch === "all" ? "All architectures" : arch}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid md:grid-cols-2 gap-2 items-end">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">
                Temperature for selected entrants ({addTemperature.toFixed(2)})
              </span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={addTemperature}
                onChange={(e) =>
                  setAddTemperature(clamp(parseFloat(e.target.value), 0, 2))
                }
                className="w-full accent-emerald-500"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                onClick={() => toggleModalSort("elo")}
                className={`px-2 py-1 rounded ${
                  modalSortColumn === "elo"
                    ? "bg-emerald-800/70 text-emerald-200"
                    : "bg-slate-800 text-gray-300"
                }`}
              >
                Elo{sortLabel("elo")}
              </button>
              <button
                onClick={() => toggleModalSort("size")}
                className={`px-2 py-1 rounded ${
                  modalSortColumn === "size"
                    ? "bg-emerald-800/70 text-emerald-200"
                    : "bg-slate-800 text-gray-300"
                }`}
              >
                Size{sortLabel("size")}
              </button>
              <button
                onClick={() => toggleModalSort("name")}
                className={`px-2 py-1 rounded ${
                  modalSortColumn === "name"
                    ? "bg-emerald-800/70 text-emerald-200"
                    : "bg-slate-800 text-gray-300"
                }`}
              >
                Name{sortLabel("name")}
              </button>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto border border-slate-700 rounded-lg p-2 bg-slate-950/50">
            <div className="grid gap-2">
              {modalNetworks.map((network) => {
                const duplicateBlocked = duplicateBlockedNetworkIds.has(network.id);
                const isCached = cachedModels.has(network.id);
                const selected = selectedNetworkIds.has(network.id);
                const downloadProgress = downloading.get(network.id);
                const isDownloading = downloadProgress !== undefined;
                return (
                  <div
                    key={network.id}
                    role="button"
                    tabIndex={duplicateBlocked ? -1 : 0}
                    onClick={() => {
                      if (duplicateBlocked) return;
                      toggleNetworkSelected(network.id);
                    }}
                    onKeyDown={(e) => {
                      if (duplicateBlocked) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleNetworkSelected(network.id);
                      }
                    }}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      duplicateBlocked
                        ? "border-slate-800 bg-slate-900/60 text-gray-600 cursor-not-allowed"
                        : !isCached
                          ? "border-amber-700/60 bg-amber-900/10"
                        : selected
                          ? "border-emerald-500 bg-emerald-900/20"
                          : "border-slate-700 bg-slate-900 hover:border-slate-500"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-100 truncate">{network.name}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {network.arch} · {network.elo} · {network.size}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {network.description}
                        </p>
                      </div>
                      <div>
                        {duplicateBlocked ? (
                          <span className="text-[10px] px-2 py-1 rounded bg-slate-800 text-gray-500">
                            already added @ {addTemperature.toFixed(2)}
                          </span>
                        ) : !isCached ? (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void handleDownload(network);
                            }}
                            disabled={isDownloading}
                            className="text-[10px] px-2 py-1 rounded bg-sky-700 hover:bg-sky-600 disabled:bg-slate-700 disabled:text-gray-500 text-white"
                          >
                            {isDownloading
                              ? `${Math.round(downloadProgress * 100)}%`
                              : "Download"}
                          </button>
                        ) : (
                          <input
                            type="checkbox"
                            readOnly
                            checked={selected}
                            className="w-4 h-4 accent-emerald-500"
                          />
                        )}
                      </div>
                    </div>
                    {!isCached && (
                      <p className="text-[11px] text-amber-300 mt-2">
                        Must be downloaded before it can be added.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-400">
              Selected: {selectedAddableCount} addable
              {selectedNetworkIds.size !== selectedAddableCount
                ? ` (${selectedNetworkIds.size - selectedAddableCount} blocked)`
                : ""}
            </p>
            <button
              onClick={addSelectedEntrants}
              disabled={selectedAddableCount === 0}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium"
            >
              Add Selected ({selectedAddableCount})
            </button>
          </div>
          </div>
        </div>
      )}
    </>
  );
}
