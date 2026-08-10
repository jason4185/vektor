import type { WriteResult } from "./types";

const DEFAULT_ATTEMPTS = 10;
const DEFAULT_DELAY_MS = 1_500;

export async function reconcileAcceptedWrite<T>(
  result: WriteResult,
  read: () => Promise<T>,
  isReconciled: (value: T) => boolean,
  attempts = DEFAULT_ATTEMPTS,
  delayMs = DEFAULT_DELAY_MS,
) {
  if (!result.confirmed) return false;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      if (isReconciled(await read())) return true;
    } catch {
      // Accepted state can lag or temporarily fail to read; keep retrying.
    }
    if (attempt + 1 < attempts) await new Promise((resolve) => window.setTimeout(resolve, delayMs));
  }
  return false;
}
