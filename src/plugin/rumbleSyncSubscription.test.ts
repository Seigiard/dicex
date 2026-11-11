import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  obrCalls, obrConfig, resetStores, resetObrCalls, simulateRoll, flushPromises,
} from "../integration/setup";
import { useDiceControlsStore } from "../controls/store";
import { createRumbleSyncSubscription } from "./rumbleSyncSubscription";

const RUMBLE_CHANNEL = "RUMBLECHAT";

function chatPayload(index = 0): any {
  const call = obrCalls.broadcast[index];
  expect(call.channel).toBe(RUMBLE_CHANNEL);
  return (call.data as any).data;
}

describe("RumbleSync subscription", () => {
  let unsubscribe: () => void;

  beforeEach(() => {
    resetStores();
    resetObrCalls();
    unsubscribe = createRumbleSyncSubscription();
  });

  afterEach(() => {
    unsubscribe();
  });

  it("broadcasts basic roll to everyone on the RUMBLECHAT channel", async () => {
    useDiceControlsStore.setState({ activeNotation: "2d6" });
    simulateRoll({ dice: [{ type: "D6", value: 3 }, { type: "D6", value: 4 }] });
    await flushPromises();

    expect(obrCalls.broadcast.length).toBe(1);
    const call = obrCalls.broadcast[0];
    expect(call.channel).toBe(RUMBLE_CHANNEL);
    expect(call.options).toEqual({ destination: "ALL" });
    const wrapper = call.data as any;
    expect(wrapper.channel).toBe(RUMBLE_CHANNEL);
    const payload = wrapper.data;
    expect(payload.sender).toBe("Dicex");
    expect(payload.senderId).toBe(obrConfig.playerId);
    expect(payload.target).toBe("Everyone");
    expect(payload.targetId).toBe("0000");
    expect(payload.color).toBe(obrConfig.playerColor);
    expect(typeof payload.messageId).toBe("string");
    expect(payload.chatlog).toContain("for **7**!");
  });

  it("includes bonus in message", async () => {
    useDiceControlsStore.setState({ activeNotation: "1d20+5" });
    simulateRoll({ dice: [{ type: "D20", value: 12 }], bonus: 5 });
    await flushPromises();

    const payload = chatPayload();
    expect(payload.chatlog).toContain("+5");
    expect(payload.chatlog).toContain("for **17**!");
  });

  it("includes preset name in message", async () => {
    useDiceControlsStore.setState({
      activeNotation: "6d8",
      activePresetName: "Fireball",
    });
    simulateRoll({
      dice: [
        { type: "D8", value: 3 }, { type: "D8", value: 4 },
        { type: "D8", value: 5 }, { type: "D8", value: 2 },
        { type: "D8", value: 6 }, { type: "D8", value: 1 },
      ],
    });
    await flushPromises();

    expect(chatPayload().chatlog).toContain("used [Fireball] and rolled");
  });

  it("shows adv suffix for advantage roll", async () => {
    useDiceControlsStore.setState({ activeNotation: "2d20" });
    simulateRoll({
      dice: [{ type: "D20", value: 15 }, { type: "D20", value: 4 }],
      advantage: "ADVANTAGE",
    });
    await flushPromises();

    expect(chatPayload().chatlog).toContain("adv");
  });

  it("shows star emoji for nat 20", async () => {
    useDiceControlsStore.setState({ activeNotation: "1d20" });
    simulateRoll({ dice: [{ type: "D20", value: 20 }] });
    await flushPromises();

    expect(chatPayload().chatlog).toContain("\u2B50");
  });

  it("shows skull emoji for nat 1", async () => {
    useDiceControlsStore.setState({ activeNotation: "1d20" });
    simulateRoll({ dice: [{ type: "D20", value: 1 }] });
    await flushPromises();

    expect(chatPayload().chatlog).toContain("\uD83D\uDC80");
  });

  it("formats multiple dice groups correctly", async () => {
    useDiceControlsStore.setState({ activeNotation: "2d6+1d8" });
    simulateRoll({
      dice: [
        { type: "D6", value: 3 }, { type: "D6", value: 4 },
        { type: "D8", value: 5 },
      ],
    });
    await flushPromises();

    const payload = chatPayload();
    expect(payload.chatlog).toContain("2d6");
    expect(payload.chatlog).toContain("1d8");
    expect(payload.chatlog).toContain("for **12**!");
  });

  it("shows lock emoji for hidden rolls", async () => {
    useDiceControlsStore.setState({ activeNotation: "1d20" });
    simulateRoll({ dice: [{ type: "D20", value: 10 }], hidden: true });
    await flushPromises();

    expect(chatPayload().chatlog).toContain("\uD83D\uDD12");
  });

  it("sends hidden roll separately to self and GM", async () => {
    useDiceControlsStore.setState({ activeNotation: "1d20" });
    simulateRoll({ dice: [{ type: "D20", value: 10 }], hidden: true });
    await flushPromises();

    expect(obrCalls.broadcast.length).toBe(2);
    const first = (obrCalls.broadcast[0].data as any).data;
    const second = (obrCalls.broadcast[1].data as any).data;
    const targetIds = [first.targetId, second.targetId].sort();
    expect(targetIds).toEqual(["gm-1", "player-1"].sort());
    obrCalls.broadcast.forEach((call) => {
      expect(call.options).toEqual({ destination: "ALL" });
    });
  });

  it("sends hidden roll from GM only to GM", async () => {
    obrConfig.playerRole = "GM";
    obrConfig.playerId = "gm-1";
    obrConfig.partyPlayers = [];
    useDiceControlsStore.setState({ activeNotation: "1d20" });
    simulateRoll({ dice: [{ type: "D20", value: 10 }], hidden: true });
    await flushPromises();

    expect(obrCalls.broadcast.length).toBe(1);
    const payload = chatPayload();
    expect(payload.targetId).toBe("gm-1");
  });

  it("sends a self-only hidden roll to the roller alone", async () => {
    // #given
    useDiceControlsStore.setState({ activeNotation: "1d20" });
    // #when
    simulateRoll({
      dice: [{ type: "D20", value: 11 }],
      hidden: true,
      hiddenAudience: "self",
    });
    await flushPromises();
    // #then
    expect(
      obrCalls.broadcast.map((b) => (b.data as any).data.targetId)
    ).toEqual([obrConfig.playerId]);
  });
});
