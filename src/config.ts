// Model storage configuration - models hosted on Cloudflare R2
const MODEL_BASE_URL = "https://pub-0cf3a9ac59314aa1ac3e67a690fc3db5.r2.dev";

export function getModelUrl(filename: string): string {
  // Use local models in development to avoid R2 egress charges
  if (import.meta.env.DEV) {
    return `/models/${filename}`;
  }
  // Use R2 in production (files are at root of bucket)
  return `${MODEL_BASE_URL}/${filename}`;
}
