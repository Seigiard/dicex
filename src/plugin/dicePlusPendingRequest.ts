import { RollRequest } from "./dicePlusProtocol";

/** Subset of the Dice+ roll request we need to route the response. */
export type PendingRollRequest = Pick<
  RollRequest,
  "rollId" | "source" | "playerId" | "playerName" | "rollTarget"
>;

let pending: PendingRollRequest | null = null;
const listeners = new Set<(request: PendingRollRequest) => void>();

export function setPendingRollRequest(req: PendingRollRequest): void {
  pending = req;
  for (const listener of listeners) listener(req);
}

export function getPendingRollRequest(): PendingRollRequest | null {
  return pending;
}

export function clearPendingRollRequest(): void {
  pending = null;
}

export function subscribePendingRollRequest(
  listener: (request: PendingRollRequest) => void
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
