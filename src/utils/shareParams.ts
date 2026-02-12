import { NETWORKS } from "../constants/networks";
import { validateFen } from "./fen";

export interface ShareParams {
  networkId: string;
  color?: "w" | "b";
  fen?: string;
  temperature: number;
}

/**
 * Parse share params from the current URL.
 * Returns null if no `network` param is present.
 */
export function parseShareParams(): ShareParams | null {
  const url = new URL(window.location.href);
  const networkId = url.searchParams.get("network");
  if (!networkId) return null;

  const exists = NETWORKS.some((n) => n.id === networkId);
  if (!exists) return null;

  const rawColor = url.searchParams.get("color");
  const color: "w" | "b" | undefined =
    rawColor === "w" ? "w" : rawColor === "b" ? "b" : undefined;

  const rawFen = url.searchParams.get("fen");
  let fen: string | undefined;
  if (rawFen) {
    const result = validateFen(rawFen);
    if (result.valid) fen = rawFen;
  }

  const rawTemp = url.searchParams.get("temperature");
  let temperature = 0;
  if (rawTemp !== null) {
    const parsed = parseFloat(rawTemp);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 2) {
      temperature = parsed;
    }
  }

  return { networkId, color, fen, temperature };
}

/**
 * Build a shareable URL from current game settings.
 */
export function buildShareUrl(params: {
  networkId: string;
  color: "w" | "b" | "random";
  temperature: number;
  fen?: string;
}): string {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set("network", params.networkId);

  if (params.color === "w" || params.color === "b") {
    url.searchParams.set("color", params.color);
  }

  if (params.fen) {
    url.searchParams.set("fen", params.fen);
  }

  if (params.temperature !== 0) {
    url.searchParams.set("temperature", params.temperature.toString());
  }

  return url.toString();
}

/**
 * Remove share-related query params from the URL without a page reload.
 */
export function clearShareParams(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("network");
  url.searchParams.delete("color");
  url.searchParams.delete("fen");
  url.searchParams.delete("temperature");
  window.history.replaceState({}, "", url.toString());
}
