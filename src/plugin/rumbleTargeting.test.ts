import { describe, it, expect } from "vitest";
import { getRumbleRecipients } from "./getRumbleRecipients";

describe("getRumbleRecipients", () => {
  it("returns 'Everyone' recipient for normal roll", () => {
    const recipients = getRumbleRecipients({
      hidden: false,
      playerName: "Gandalf",
      playerObrId: "player-1",
      playerRole: "PLAYER",
      gmName: "DM",
      gmObrId: "gm-1",
    });
    expect(recipients).toEqual([{ target: "Everyone", targetId: "0000" }]);
  });

  it("returns player and GM recipients for hidden roll by player", () => {
    const recipients = getRumbleRecipients({
      hidden: true,
      playerName: "Gandalf",
      playerObrId: "player-1",
      playerRole: "PLAYER",
      gmName: "DM",
      gmObrId: "gm-1",
    });
    expect(recipients).toEqual([
      { target: "Gandalf", targetId: "player-1" },
      { target: "DM", targetId: "gm-1" },
    ]);
  });

  it("returns only GM recipient for hidden roll by GM (no duplicate)", () => {
    const recipients = getRumbleRecipients({
      hidden: true,
      playerName: "DM",
      playerObrId: "gm-1",
      playerRole: "GM",
      gmName: "DM",
      gmObrId: "gm-1",
    });
    expect(recipients).toEqual([{ target: "DM", targetId: "gm-1" }]);
  });

  it("returns only the player for a self-only hidden roll by a player", () => {
    const recipients = getRumbleRecipients({
      hidden: true,
      hiddenAudience: "self",
      playerName: "Gandalf",
      playerObrId: "player-1",
      playerRole: "PLAYER",
      gmName: "DM",
      gmObrId: "gm-1",
    });
    expect(recipients).toEqual([{ target: "Gandalf", targetId: "player-1" }]);
  });

  it("returns only the rolling GM for a self-only hidden roll in a room with another GM", () => {
    const recipients = getRumbleRecipients({
      hidden: true,
      hiddenAudience: "self",
      playerName: "Co-DM",
      playerObrId: "gm-2",
      playerRole: "GM",
      gmName: "DM",
      gmObrId: "gm-1",
    });
    expect(recipients).toEqual([{ target: "Co-DM", targetId: "gm-2" }]);
  });

  it("returns player and GM recipients for a GM-audience hidden roll", () => {
    const recipients = getRumbleRecipients({
      hidden: true,
      hiddenAudience: "gm",
      playerName: "Gandalf",
      playerObrId: "player-1",
      playerRole: "PLAYER",
      gmName: "DM",
      gmObrId: "gm-1",
    });
    expect(recipients).toEqual([
      { target: "Gandalf", targetId: "player-1" },
      { target: "DM", targetId: "gm-1" },
    ]);
  });

  it("ignores the audience of a visible roll", () => {
    const recipients = getRumbleRecipients({
      hidden: false,
      hiddenAudience: "self",
      playerName: "Gandalf",
      playerObrId: "player-1",
      playerRole: "PLAYER",
      gmName: "DM",
      gmObrId: "gm-1",
    });
    expect(recipients).toEqual([{ target: "Everyone", targetId: "0000" }]);
  });
});
