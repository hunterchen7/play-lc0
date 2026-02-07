import { useCallback, useEffect, useMemo, useState } from "react";
import { NETWORKS, type NetworkInfo } from "../constants/networks";
import {
  getCustomModels,
  saveCustomModel,
  deleteCustomModel as deleteCustomModelMeta,
  customMetaToNetworkInfo,
  type CustomModelMeta,
} from "../utils/customModels";
import { cacheModel, deleteCachedModel } from "../engine/modelCache";
import { getModelUrl } from "../config";

export interface UseNetworksResult {
  /** Built-in NETWORKS merged with user-uploaded custom models. */
  networks: NetworkInfo[];
  /** Only the custom models (already included in `networks`). */
  customModels: NetworkInfo[];
  /** Persist a new custom model (binary + metadata). */
  addCustomModel: (meta: CustomModelMeta, data: ArrayBuffer) => Promise<void>;
  /** Remove a custom model from metadata store and model cache. */
  removeCustomModel: (id: string) => Promise<void>;
  /** True while the initial load from IndexedDB is pending. */
  loading: boolean;
}

export function useNetworks(): UseNetworksResult {
  const [customMetas, setCustomMetas] = useState<CustomModelMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCustomModels()
      .then(setCustomMetas)
      .finally(() => setLoading(false));
  }, []);

  const customModels = useMemo(
    () => customMetas.map(customMetaToNetworkInfo),
    [customMetas],
  );

  const networks = useMemo(
    () => [...NETWORKS, ...customModels],
    [customModels],
  );

  const addCustomModel = useCallback(
    async (meta: CustomModelMeta, data: ArrayBuffer) => {
      const cacheKey = getModelUrl(`${meta.id}.onnx`);
      await cacheModel(cacheKey, data);
      await saveCustomModel(meta);
      setCustomMetas((prev) => [...prev, meta]);
    },
    [],
  );

  const removeCustomModel = useCallback(async (id: string) => {
    const cacheKey = getModelUrl(`${id}.onnx`);
    await deleteCachedModel(cacheKey);
    await deleteCustomModelMeta(id);
    setCustomMetas((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return { networks, customModels, addCustomModel, removeCustomModel, loading };
}
