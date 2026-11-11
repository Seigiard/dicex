import OBR from "@owlbear-rodeo/sdk";
import { useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { recordAccessDecision } from "./dicePlusAccess";
import {
  ACCESS_PROMPT_MODAL_ID,
  parseAccessPromptRequests,
} from "./dicePlusAccessHost";

/** The GM's modal: one row per extension that wants to roll dice in this room. */
export function AccessPrompt() {
  const [asks, setAsks] = useState(() =>
    parseAccessPromptRequests(window.location.search)
  );

  async function answer(source: string, allowed: boolean) {
    // Rejects on a client that is not a GM's; the host opens this modal for GMs only.
    await recordAccessDecision(source, allowed);
    const rest = asks.filter((ask) => ask.source !== source);
    setAsks(rest);
    if (rest.length === 0) await OBR.modal.close(ACCESS_PROMPT_MODAL_ID);
  }

  return (
    <Paper sx={{ p: 2, height: "100vh", overflowY: "auto" }} square>
      <Typography variant="h6" gutterBottom>
        Extension access
      </Typography>
      <Stack gap={2}>
        {asks.map((ask) => (
          <Box key={ask.source} component="div">
            <Typography variant="body1" sx={{ wordBreak: "break-word" }}>
              Extension <b>{ask.source}</b> wants to roll dice in this room.
              Allow?
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Asked for {ask.playerName}. Dicex remembers the answer for this
              room.
            </Typography>
            <Stack direction="row" gap={1} justifyContent="flex-end" mt={1}>
              <Button
                onClick={() =>
                  answer(ask.source, false).catch((e) =>
                    console.warn("Dice+ access answer failed", e)
                  )
                }
              >
                Deny
              </Button>
              <Button
                variant="contained"
                onClick={() =>
                  answer(ask.source, true).catch((e) =>
                    console.warn("Dice+ access answer failed", e)
                  )
                }
              >
                Allow
              </Button>
            </Stack>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}
