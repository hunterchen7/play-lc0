import type { Opening } from "../types/openings";

let cached: Opening[] | null = null;
let pending: Promise<Opening[]> | null = null;

export function fetchOpenings(): Promise<Opening[]> {
  if (cached) return Promise.resolve(cached);
  if (pending) return pending;
  pending = fetch(`${import.meta.env.BASE_URL}openings.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch openings: ${res.status}`);
      return res.json() as Promise<Opening[]>;
    })
    .then((data) => {
      cached = data;
      return data;
    });
  return pending;
}
