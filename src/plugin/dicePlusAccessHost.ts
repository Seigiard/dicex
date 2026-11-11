import OBR from "@owlbear-rodeo/sdk";
import {
  ACCESS_ASK_CHANNEL,
  AccessAsk,
  AccessList,
  accessDecision,
  isAccessAsk,
  readAccessList,
} from "./dicePlusAccess";
import { getPluginId } from "./getPluginId";

export const ACCESS_PROMPT_MODAL_ID = getPluginId("access-prompt");

const PROMPT_WIDTH = 400;
const PROMPT_BASE_HEIGHT = 120;
const PROMPT_ROW_HEIGHT = 96;
const PROMPT_MAX_HEIGHT = 520;

/**
 * Background side of a GM's client: shows every extension waiting for an
 * answer in one modal, and closes it once each has an answer, whichever GM
 * gave it. Clients of players who are not GMs ignore the questions.
 */
export function mountAccessPromptHost(promptUrl: string): () => void {
  let pending: AccessAsk[] = [];
  let open = false;

  async function show(list: AccessList): Promise<void> {
    pending = pending.filter(
      (ask) => accessDecision(list, ask.source) === "unknown"
    );
    if (pending.length === 0) {
      if (open) {
        open = false;
        await OBR.modal.close(ACCESS_PROMPT_MODAL_ID);
      }
      return;
    }
    open = true;
    await OBR.modal.open({
      id: ACCESS_PROMPT_MODAL_ID,
      url: buildAccessPromptUrl(promptUrl, pending),
      width: PROMPT_WIDTH,
      height: Math.min(
        PROMPT_BASE_HEIGHT + PROMPT_ROW_HEIGHT * pending.length,
        PROMPT_MAX_HEIGHT
      ),
    });
  }

  const unsubAsk = OBR.broadcast.onMessage(ACCESS_ASK_CHANNEL, (event) => {
    if (!isAccessAsk(event.data)) return;
    const ask = event.data;
    const handle = async () => {
      if ((await OBR.player.getRole()) !== "GM") return;
      const list = readAccessList(await OBR.room.getMetadata());
      if (accessDecision(list, ask.source) !== "unknown") return;
      if (!pending.some((p) => p.source === ask.source)) pending.push(ask);
      // Open again even for a known source: the GM may have dismissed the
      // modal, and each new roll attempt brings it back.
      await show(list);
    };
    handle().catch((e) => console.warn("Dice+ access prompt failed", e));
  });

  const unsubMetadata = OBR.room.onMetadataChange((metadata) => {
    if (pending.length === 0) return;
    const list = readAccessList(metadata);
    const answered = pending.some(
      (ask) => accessDecision(list, ask.source) !== "unknown"
    );
    if (!answered) return;
    show(list).catch((e) => console.warn("Dice+ access prompt failed", e));
  });

  return () => {
    unsubAsk();
    unsubMetadata();
  };
}

export function buildAccessPromptUrl(base: string, asks: AccessAsk[]): string {
  return `${base}?requests=${encodeURIComponent(JSON.stringify(asks))}`;
}

export function parseAccessPromptRequests(search: string): AccessAsk[] {
  try {
    const raw = new URLSearchParams(search).get("requests");
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isAccessAsk) : [];
  } catch {
    return [];
  }
}
