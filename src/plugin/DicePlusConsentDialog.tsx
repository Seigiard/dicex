import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";

import { useDicePlusConsentStore } from "./dicePlusConsent";

/**
 * Asks the local player, once per extension, whether that extension may make
 * the rolls it requests visible to everyone. Shown in the action sidebar,
 * which the Dice+ relay opens before every roll.
 */
export function DicePlusConsentDialog() {
  const source = useDicePlusConsentStore((state) => state.pending[0]);
  const answer = useDicePlusConsentStore((state) => state.answer);

  return (
    <Dialog open={Boolean(source)} maxWidth="xs" fullWidth>
      <DialogTitle>Show rolls to everyone?</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ wordBreak: "break-word" }}>
          The extension <b>{source}</b> wants to show the rolls it makes for
          you to everyone in the room.
        </DialogContentText>
        <DialogContentText sx={{ mt: 1 }}>
          Until you allow it, these rolls stay hidden. Dicex remembers your
          answer in this browser.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => source && answer(source, false)}>
          Keep hidden
        </Button>
        <Button
          variant="contained"
          onClick={() => source && answer(source, true)}
        >
          Allow
        </Button>
      </DialogActions>
    </Dialog>
  );
}
