import { vi } from "vitest";
import { useDiceRollStore } from "../dice/store";
import { useDiceControlsStore } from "../controls/store";
import { DiceType } from "../types/DiceType";
import { DiceStyle } from "../types/DiceStyle";
import { DiceRoll } from "../types/DiceRoll";
import { Die } from "../types/Die";
import { Dice } from "../types/Dice";

// --- Asset mocks (must be before any store imports that trigger diceSets) ---

vi.mock("../previews/galaxy", () => ({ D20: "galaxy.png" }));
vi.mock("../previews/gemstone", () => ({ D20: "gemstone.png" }));
vi.mock("../previews/glass", () => ({ D20: "glass.png" }));
vi.mock("../previews/iron", () => ({ D20: "iron.png" }));
vi.mock("../previews/nebula", () => ({ D20: "nebula.png" }));
vi.mock("../previews/sunrise", () => ({ D20: "sunrise.png" }));
vi.mock("../previews/sunset", () => ({ D20: "sunset.png" }));
vi.mock("../previews/walnut", () => ({ D20: "walnut.png" }));
vi.mock("../previews/all.png", () => ({ default: "all.png" }));

// --- OBR Mock ---

export const obrCalls = {
  playerSetMetadata: [] as Record<string, unknown>[],
  roomSetMetadata: [] as Record<string, unknown>[],
  sceneSetMetadata: [] as Record<string, unknown>[],
  broadcast: [] as {
    channel: string;
    data: unknown;
    options?: { destination: "REMOTE" | "LOCAL" | "ALL" };
  }[],
  actionOpenCount: 0,
  modal: [] as { action: "open" | "close"; id: string; url?: string }[],
};

export const obrConfig = {
  playerId: "player-1",
  playerName: "Gandalf",
  playerColor: "#ff0000",
  playerRole: "PLAYER" as "GM" | "PLAYER",
  partyPlayers: [
    { id: "gm-1", role: "GM", name: "DM", connectionId: "c1", metadata: {} },
  ] as any[],
  roomMetadata: {} as Record<string, unknown>,
  sceneMetadata: {} as Record<string, unknown>,
  sceneItems: [] as { id: string; name: string; layer: string; type: string }[],
  actionIsOpen: false,
};

type BroadcastListener = (event: { data: unknown; connectionId: string }) => void;
type MetadataListener = (metadata: Record<string, unknown>) => void;
const roomMetadataListeners = new Set<MetadataListener>();
const broadcastListeners: Record<string, Set<BroadcastListener>> = {};

export function simulateBroadcast(
  channel: string,
  data: unknown,
  connectionId: string = "remote-conn"
): void {
  const listeners = broadcastListeners[channel];
  if (!listeners) return;
  for (const listener of listeners) {
    listener({ data, connectionId });
  }
}

export function clearBroadcastListeners(): void {
  for (const key of Object.keys(broadcastListeners)) {
    delete broadcastListeners[key];
  }
}

function applyMetadataUpdate(target: Record<string, unknown>, data: Record<string, unknown>) {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      delete target[key];
    } else {
      target[key] = value;
    }
  }
}

vi.mock("@owlbear-rodeo/sdk", () => ({
  default: {
    player: {
      get id() { return obrConfig.playerId; },
      getName: vi.fn(() => Promise.resolve(obrConfig.playerName)),
      getRole: vi.fn(() => Promise.resolve(obrConfig.playerRole)),
      getColor: vi.fn(() => Promise.resolve(obrConfig.playerColor)),
      setMetadata: vi.fn((data: Record<string, unknown>) => {
        obrCalls.playerSetMetadata.push(data);
        return Promise.resolve();
      }),
    },
    room: {
      getMetadata: vi.fn(() => Promise.resolve({ ...obrConfig.roomMetadata })),
      setMetadata: vi.fn((data: Record<string, unknown>) => {
        applyMetadataUpdate(obrConfig.roomMetadata, data);
        obrCalls.roomSetMetadata.push(data);
        for (const listener of roomMetadataListeners) {
          listener({ ...obrConfig.roomMetadata });
        }
        return Promise.resolve();
      }),
      onMetadataChange: vi.fn((callback: MetadataListener) => {
        roomMetadataListeners.add(callback);
        return () => {
          roomMetadataListeners.delete(callback);
        };
      }),
    },
    modal: {
      open: vi.fn((modal: { id: string; url: string }) => {
        obrCalls.modal.push({ action: "open", id: modal.id, url: modal.url });
        return Promise.resolve();
      }),
      close: vi.fn((id: string) => {
        obrCalls.modal.push({ action: "close", id });
        return Promise.resolve();
      }),
    },
    scene: {
      getMetadata: vi.fn(() => Promise.resolve({ ...obrConfig.sceneMetadata })),
      setMetadata: vi.fn((data: Record<string, unknown>) => {
        applyMetadataUpdate(obrConfig.sceneMetadata, data);
        obrCalls.sceneSetMetadata.push(data);
        return Promise.resolve();
      }),
      items: {
        getItems: vi.fn(() => Promise.resolve([...obrConfig.sceneItems])),
      },
    },
    party: {
      getPlayers: vi.fn(() => Promise.resolve([...obrConfig.partyPlayers])),
    },
    notification: {
      show: vi.fn(() => Promise.resolve("notification-id")),
      close: vi.fn(() => Promise.resolve()),
    },
    broadcast: {
      sendMessage: vi.fn(
        (
          channel: string,
          data: unknown,
          options?: { destination: "REMOTE" | "LOCAL" | "ALL" }
        ) => {
          obrCalls.broadcast.push({ channel, data, options });
          return Promise.resolve();
        }
      ),
      onMessage: vi.fn(
        (channel: string, callback: BroadcastListener) => {
          if (!broadcastListeners[channel]) {
            broadcastListeners[channel] = new Set();
          }
          broadcastListeners[channel].add(callback);
          return () => {
            broadcastListeners[channel]?.delete(callback);
          };
        }
      ),
    },
    action: {
      open: vi.fn(() => {
        obrCalls.actionOpenCount++;
        return Promise.resolve();
      }),
      isOpen: vi.fn(() => Promise.resolve(obrConfig.actionIsOpen)),
    },
    isAvailable: false,
    onReady: vi.fn((cb: () => void) => cb()),
  },
}));

// --- Store Helpers ---

export function resetStores() {
  useDiceRollStore.getState().clearRoll();
  useDiceControlsStore.setState({
    diceBonus: 0,
    diceAdvantage: null,
    diceHidden: false,
    activePresetName: null,
    activeNotation: null,
    activeNotationComponents: null,
  });
}

export function resetObrCalls() {
  obrCalls.playerSetMetadata.length = 0;
  obrCalls.roomSetMetadata.length = 0;
  obrCalls.sceneSetMetadata.length = 0;
  obrCalls.broadcast.length = 0;
  obrCalls.actionOpenCount = 0;
  obrCalls.modal.length = 0;
  roomMetadataListeners.clear();
  obrConfig.roomMetadata = {};
  obrConfig.sceneMetadata = {};
  obrConfig.sceneItems = [];
  obrConfig.playerId = "player-1";
  obrConfig.playerName = "Gandalf";
  obrConfig.playerColor = "#ff0000";
  obrConfig.playerRole = "PLAYER";
  obrConfig.actionIsOpen = false;
  obrConfig.partyPlayers = [
    { id: "gm-1", role: "GM", name: "DM", connectionId: "c1", metadata: {} },
  ];
  clearBroadcastListeners();
}

// --- Roll Simulation ---

let nextId = 1000;
function testDieId() {
  return `test-die-${nextId++}`;
}

export function createDie(type: DiceType, id?: string): Die {
  return { id: id ?? testDieId(), style: "IRON" as DiceStyle, type };
}

export interface SimulateRollConfig {
  dice: { type: DiceType; value: number }[];
  bonus?: number;
  hidden?: boolean;
  hiddenAudience?: DiceRoll["hiddenAudience"];
  advantage?: "ADVANTAGE" | "DISADVANTAGE";
}

/**
 * Simulates a complete roll by calling startRoll and finishDieRoll for each die.
 * Returns the die IDs used.
 */
export function simulateRoll(config: SimulateRollConfig): string[] {
  const dies: Die[] = config.dice.map((d) => createDie(d.type));

  let rollDice: (Die | Dice)[];
  if (config.advantage) {
    const combination = config.advantage === "ADVANTAGE" ? "HIGHEST" : "LOWEST";
    // Group all dice into advantage structure
    rollDice = [];
    for (let i = 0; i < dies.length; i += 2) {
      if (i + 1 < dies.length) {
        rollDice.push({ dice: [dies[i], dies[i + 1]], combination } as Dice);
      } else {
        rollDice.push(dies[i]);
      }
    }
  } else {
    rollDice = dies;
  }

  const roll: DiceRoll = {
    dice: rollDice,
    bonus: config.bonus,
    hidden: config.hidden,
    hiddenAudience: config.hiddenAudience,
  };

  useDiceRollStore.getState().startRoll(roll);

  // startRoll regenerates IDs via getDieFromDice, so read current state
  const state = useDiceRollStore.getState();
  const currentIds = Object.keys(state.rollValues);
  const dummyTransform = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };

  for (let i = 0; i < currentIds.length; i++) {
    useDiceRollStore.getState().finishDieRoll(
      currentIds[i],
      config.dice[i]?.value ?? 1,
      dummyTransform
    );
  }

  return currentIds;
}

export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Record in room metadata that the GM allowed `source` to roll. */
export function allowDicePlusSource(source: string): void {
  const key = "rodeo.owlbear.dice/access";
  const current = (obrConfig.roomMetadata[key] as
    | { allowed: string[]; denied: string[] }
    | undefined) ?? { allowed: [], denied: [] };
  obrConfig.roomMetadata[key] = {
    allowed: [...current.allowed, source],
    denied: current.denied,
  };
}
