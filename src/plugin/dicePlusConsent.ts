import create from "zustand";
import {
  PublicRollConsent,
  TRUSTED_ROLL_TARGET_SOURCES,
} from "./dicePlusProtocol";
import { getPluginId } from "./getPluginId";

const CONSENT_STORAGE_KEY = getPluginId("dice-plus/public-roll-consent");

/** The subset of the Web Storage API the consent record needs. */
export interface ConsentStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type StoredAnswers = Record<string, "allowed" | "denied">;

/**
 * The local player's answers to "may extension X show my rolls to everyone?".
 *
 * Kept per browser, not per room: the question is about the extension, which
 * behaves the same in every room, and room or player metadata would expose
 * the answer to everyone else in the room.
 */
export interface PublicRollConsentRecord {
  get(source: string): PublicRollConsent;
  remember(source: string, allowed: boolean): void;
}

export function createPublicRollConsentRecord(
  storage: ConsentStorage
): PublicRollConsentRecord {
  // Answers the storage refused to keep (full, or blocked in a partitioned
  // third-party iframe). They last until the page reloads.
  const unsaved = new Map<string, "allowed" | "denied">();

  function readStored(): StoredAnswers {
    try {
      const raw = storage.getItem(CONSENT_STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      return typeof parsed === "object" && parsed !== null
        ? (parsed as StoredAnswers)
        : {};
    } catch {
      return {};
    }
  }

  return {
    get(source) {
      if (TRUSTED_ROLL_TARGET_SOURCES.includes(source)) return "allowed";
      const stored = readStored();
      const answer =
        unsaved.get(source) ??
        (Object.prototype.hasOwnProperty.call(stored, source)
          ? stored[source]
          : undefined);
      return answer === "allowed" || answer === "denied" ? answer : "unasked";
    },
    remember(source, allowed) {
      const answer = allowed ? "allowed" : "denied";
      const answers = { ...readStored(), [source]: answer };
      try {
        storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(answers));
        unsaved.delete(source);
      } catch {
        unsaved.set(source, answer);
      }
    },
  };
}

export const publicRollConsent = createPublicRollConsentRecord(
  getBrowserStorage() ?? createMemoryStorage()
);

interface ConsentPromptState {
  /** Sources waiting for the local player's answer, oldest first. */
  pending: string[];
  ask: (source: string) => void;
  answer: (source: string, allowed: boolean) => void;
}

export const useDicePlusConsentStore = create<ConsentPromptState>((set) => ({
  pending: [],
  ask: (source) =>
    set((state) =>
      state.pending.includes(source)
        ? state
        : { pending: [...state.pending, source] }
    ),
  answer: (source, allowed) => {
    publicRollConsent.remember(source, allowed);
    set((state) => ({ pending: state.pending.filter((s) => s !== source) }));
  },
}));

export function createMemoryStorage(): ConsentStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

function getBrowserStorage(): ConsentStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Accessing localStorage throws when the browser blocks site data.
    return null;
  }
}
