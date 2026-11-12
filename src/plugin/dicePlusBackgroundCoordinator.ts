import OBR from "@owlbear-rodeo/sdk";
import {
  INTERNAL_PING_CHANNEL,
  INTERNAL_READY_CHANNEL,
  INTERNAL_ROLL_CHANNEL,
  POPOVER_PING_CHANNEL,
  POPOVER_READY_CHANNEL,
  POPOVER_ROLL_CHANNEL,
  DicePlusRollChannels,
  RollRequest,
  resolveRollIn,
} from "./dicePlusProtocol";

const HANDSHAKE_TIMEOUT_MS = 2000;

function makeNonce(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Resolve once a ready reply arrives, or after the handshake timeout. */
function awaitReady(
  readyChannel: string,
  nonce: string,
  timeoutMs: number
): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ready: boolean) => {
      if (done) return;
      done = true;
      unsub();
      clearTimeout(timer);
      resolve(ready);
    };

    const unsub = OBR.broadcast.onMessage(readyChannel, (event) => {
      const data = event.data as { nonce?: string };
      if (data?.nonce === nonce) finish(true);
    });

    const timer = setTimeout(() => finish(false), timeoutMs);
  });
}

async function relayThroughAction(payload: RollRequest): Promise<void> {
  await OBR.action.open();
  await relayThroughChannels(payload, {
    ping: INTERNAL_PING_CHANNEL,
    ready: INTERNAL_READY_CHANNEL,
    roll: INTERNAL_ROLL_CHANNEL,
  }, true);
}

async function relayThroughChannels(
  payload: RollRequest,
  channels: DicePlusRollChannels,
  sendRollOnTimeout = false
): Promise<boolean> {
  const nonce = makeNonce();
  const ready = awaitReady(channels.ready, nonce, HANDSHAKE_TIMEOUT_MS);

  await OBR.broadcast.sendMessage(
    channels.ping,
    { nonce },
    { destination: "LOCAL" }
  );

  if (!(await ready) && !sendRollOnTimeout) return false;

  await OBR.broadcast.sendMessage(
    channels.roll,
    payload,
    { destination: "LOCAL" }
  );
  return true;
}

async function relayThroughPopover(payload: RollRequest): Promise<void> {
  const relayedToPopover = await relayThroughChannels(payload, {
    ping: POPOVER_PING_CHANNEL,
    ready: POPOVER_READY_CHANNEL,
    roll: POPOVER_ROLL_CHANNEL,
  });

  if (!relayedToPopover) {
    await relayThroughAction(payload);
  }
}

export async function relayRollRequest(payload: RollRequest): Promise<void> {
  const rollIn = resolveRollIn(payload.rollIn);

  if (rollIn === "window") {
    await relayThroughAction(payload);
    return;
  }

  if (rollIn === "tray") {
    await relayThroughPopover(payload);
    return;
  }

  if (await OBR.action.isOpen()) {
    await relayThroughAction(payload);
    return;
  }

  await relayThroughPopover(payload);
}
