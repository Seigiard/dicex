import OBR from "@owlbear-rodeo/sdk";
import { getPluginId } from "./getPluginId";

/**
 * Per-room record of which extensions the GM lets roll through Dice+.
 *
 * Kept in room metadata so every client reads the same answer and it lasts
 * as long as the room. Deny by default: a source in neither list must be
 * allowed by a GM before it can roll.
 */
export const ACCESS_METADATA_KEY = getPluginId("access");

/** Roller → GM clients: "this source wants to roll; please decide". */
export const ACCESS_ASK_CHANNEL = getPluginId("access-ask");

export interface AccessList {
  allowed: string[];
  denied: string[];
}

export interface AccessAsk {
  source: string;
  playerName: string;
}

export type AccessDecision = "allowed" | "denied" | "unknown";

export function readAccessList(metadata: Record<string, unknown>): AccessList {
  const value = metadata[ACCESS_METADATA_KEY];
  if (typeof value !== "object" || value === null) {
    return { allowed: [], denied: [] };
  }
  const v = value as Record<string, unknown>;
  return { allowed: stringList(v.allowed), denied: stringList(v.denied) };
}

export function accessDecision(list: AccessList, source: string): AccessDecision {
  // Deny wins if a race ever put the source in both lists.
  if (list.denied.includes(source)) return "denied";
  if (list.allowed.includes(source)) return "allowed";
  return "unknown";
}

/** The list with `source` moved into allowed or denied. */
export function withDecision(
  list: AccessList,
  source: string,
  allowed: boolean
): AccessList {
  const rest = withoutSource(list, source);
  return allowed
    ? { ...rest, allowed: [...rest.allowed, source] }
    : { ...rest, denied: [...rest.denied, source] };
}

/** The list with `source` in neither list, so the GM is asked again. */
export function withoutSource(list: AccessList, source: string): AccessList {
  return {
    allowed: list.allowed.filter((s) => s !== source),
    denied: list.denied.filter((s) => s !== source),
  };
}

export async function getAccessDecision(source: string): Promise<AccessDecision> {
  return accessDecision(readAccessList(await OBR.room.getMetadata()), source);
}

/** True if the local player or anyone else in the room is a GM. */
export async function isGmInRoom(): Promise<boolean> {
  const [role, players] = await Promise.all([
    OBR.player.getRole(),
    OBR.party.getPlayers(),
  ]);
  return role === "GM" || players.some((p) => p.role === "GM");
}

/**
 * Record a GM's answer. The first answer wins: if another GM already
 * decided, that answer stays and is returned.
 */
export async function recordAccessDecision(
  source: string,
  allowed: boolean
): Promise<AccessDecision> {
  const list = readAccessList(await OBR.room.getMetadata());
  const existing = accessDecision(list, source);
  if (existing !== "unknown") return existing;
  await OBR.room.setMetadata({
    [ACCESS_METADATA_KEY]: withDecision(list, source, allowed),
  });
  return allowed ? "allowed" : "denied";
}

export async function forgetAccessDecision(source: string): Promise<void> {
  const list = readAccessList(await OBR.room.getMetadata());
  await OBR.room.setMetadata({
    [ACCESS_METADATA_KEY]: withoutSource(list, source),
  });
}

export type AskGmForAccess = (
  source: string,
  playerName: string
) => Promise<AccessDecision>;

/**
 * Returns a function that asks the GMs in the room about a source and waits
 * for the answer to land in room metadata. It resolves "unknown" if no GM
 * answers within `timeoutMs`. Concurrent calls for one source share a single
 * question.
 */
export function createGmAccessAsker(timeoutMs: number): AskGmForAccess {
  const inflight = new Map<string, Promise<AccessDecision>>();

  return (source, playerName) => {
    const existing = inflight.get(source);
    if (existing) return existing;

    const answer = (async () => {
      const decision = waitForAccessDecision(source, timeoutMs);
      const ask: AccessAsk = { source, playerName };
      await OBR.broadcast.sendMessage(ACCESS_ASK_CHANNEL, ask, {
        destination: "ALL",
      });
      return decision;
    })().finally(() => inflight.delete(source));

    inflight.set(source, answer);
    return answer;
  };
}

function waitForAccessDecision(
  source: string,
  timeoutMs: number
): Promise<AccessDecision> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (decision: AccessDecision) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(decision);
    };
    const check = (metadata: Record<string, unknown>) => {
      const decision = accessDecision(readAccessList(metadata), source);
      if (decision !== "unknown") finish(decision);
    };

    const unsubscribe = OBR.room.onMetadataChange(check);
    const timer = setTimeout(() => finish("unknown"), timeoutMs);
    // A GM may have answered between the caller's read and the subscription.
    OBR.room.getMetadata().then(check, () => {});
  });
}

export function isAccessAsk(data: unknown): data is AccessAsk {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return typeof d.source === "string" && typeof d.playerName === "string";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((s): s is string => typeof s === "string")
    : [];
}
