import { openDB, type IDBPDatabase } from "idb";
import type { NetworkInfo } from "../constants/networks";

const DB_NAME = "lc0-custom-models";
const STORE_NAME = "metadata";
const DB_VERSION = 1;

export interface CustomModelMeta {
  id: string;
  name: string;
  arch: string;
  elo: string;
  description: string;
  source: string;
  sizeBytes: number;
  addedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function getCustomModels(): Promise<CustomModelMeta[]> {
  try {
    const db = await getDB();
    return (await db.getAll(STORE_NAME)) as CustomModelMeta[];
  } catch {
    return [];
  }
}

export async function saveCustomModel(meta: CustomModelMeta): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, meta);
}

export async function deleteCustomModel(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function customMetaToNetworkInfo(meta: CustomModelMeta): NetworkInfo {
  const size = formatSize(meta.sizeBytes);
  return {
    id: meta.id,
    name: meta.name,
    arch: meta.arch,
    file: `${meta.id}.onnx`,
    size,
    downloadSize: size,
    elo: meta.elo,
    description: meta.description,
    source: meta.source,
    isCustom: true,
  };
}
