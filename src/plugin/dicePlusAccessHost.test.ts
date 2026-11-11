import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  flushPromises,
  obrCalls,
  obrConfig,
  resetObrCalls,
  simulateBroadcast,
} from "../integration/setup";
import { ACCESS_ASK_CHANNEL, recordAccessDecision } from "./dicePlusAccess";
import {
  ACCESS_PROMPT_MODAL_ID,
  mountAccessPromptHost,
  parseAccessPromptRequests,
} from "./dicePlusAccessHost";

const PROMPT_URL = "/dicex/access-prompt.html";

function lastModal() {
  return obrCalls.modal[obrCalls.modal.length - 1];
}

function promptedSources(): string[] {
  const modal = lastModal();
  if (modal?.action !== "open" || !modal.url) return [];
  const search = modal.url.slice(modal.url.indexOf("?"));
  return parseAccessPromptRequests(search).map((ask) => ask.source);
}

describe("access prompt host", () => {
  let unsubscribe: () => void;

  beforeEach(() => {
    resetObrCalls();
    obrConfig.playerRole = "GM";
    unsubscribe = mountAccessPromptHost(PROMPT_URL);
  });

  afterEach(() => {
    unsubscribe();
  });

  it("opens the prompt on a GM's client for an unknown source", async () => {
    // #when
    simulateBroadcast(ACCESS_ASK_CHANNEL, { source: "com.example.a", playerName: "Alice" });
    await flushPromises();
    // #then
    expect([lastModal()?.id, promptedSources()]).toEqual([
      ACCESS_PROMPT_MODAL_ID,
      ["com.example.a"],
    ]);
  });

  it("shows nothing on a player's client", async () => {
    // #given
    obrConfig.playerRole = "PLAYER";
    // #when
    simulateBroadcast(ACCESS_ASK_CHANNEL, { source: "com.example.a", playerName: "Alice" });
    await flushPromises();
    // #then
    expect(obrCalls.modal).toEqual([]);
  });

  it("shows nothing for a source that already has an answer", async () => {
    // #given
    await recordAccessDecision("com.example.a", true);
    // #when
    simulateBroadcast(ACCESS_ASK_CHANNEL, { source: "com.example.a", playerName: "Alice" });
    await flushPromises();
    // #then
    expect(obrCalls.modal).toEqual([]);
  });

  it("lists every waiting source in one prompt", async () => {
    // #when
    simulateBroadcast(ACCESS_ASK_CHANNEL, { source: "com.example.a", playerName: "Alice" });
    await flushPromises();
    simulateBroadcast(ACCESS_ASK_CHANNEL, { source: "com.example.b", playerName: "Bob" });
    await flushPromises();
    // #then
    expect(promptedSources()).toEqual(["com.example.a", "com.example.b"]);
  });

  it("closes the prompt once any GM answers the only waiting source", async () => {
    // #given
    simulateBroadcast(ACCESS_ASK_CHANNEL, { source: "com.example.a", playerName: "Alice" });
    await flushPromises();
    // #when
    await recordAccessDecision("com.example.a", true);
    await flushPromises();
    // #then
    expect(lastModal()).toEqual({ action: "close", id: ACCESS_PROMPT_MODAL_ID });
  });

  it("keeps asking about the sources still waiting after one answer", async () => {
    // #given
    simulateBroadcast(ACCESS_ASK_CHANNEL, { source: "com.example.a", playerName: "Alice" });
    await flushPromises();
    simulateBroadcast(ACCESS_ASK_CHANNEL, { source: "com.example.b", playerName: "Bob" });
    await flushPromises();
    // #when
    await recordAccessDecision("com.example.a", false);
    await flushPromises();
    // #then
    expect(promptedSources()).toEqual(["com.example.b"]);
  });
});
