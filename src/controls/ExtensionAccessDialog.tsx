import OBR from "@owlbear-rodeo/sdk";
import { useEffect, useState } from "react";

import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import RemoveIcon from "@mui/icons-material/DeleteRounded";

import {
  AccessList,
  forgetAccessDecision,
  readAccessList,
} from "../plugin/dicePlusAccess";

/** GM view of the extensions allowed or denied to roll dice in this room. */
export function ExtensionAccessDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [list, setList] = useState<AccessList>({ allowed: [], denied: [] });

  useEffect(() => {
    if (!open) return;
    OBR.room
      .getMetadata()
      .then((metadata) => setList(readAccessList(metadata)))
      .catch((e) => console.warn("Reading extension access failed", e));
    return OBR.room.onMetadataChange((metadata) =>
      setList(readAccessList(metadata))
    );
  }, [open]);

  function remove(source: string) {
    forgetAccessDecision(source).catch((e) =>
      console.warn("Removing extension access failed", e)
    );
  }

  const empty = list.allowed.length === 0 && list.denied.length === 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Extension Access</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Extensions you allowed or denied to roll dice in this room. Remove
          one to be asked again on its next roll.
        </DialogContentText>
        {empty ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            No extension has asked yet.
          </Typography>
        ) : (
          <>
            <SourceList title="Allowed" sources={list.allowed} onRemove={remove} />
            <SourceList title="Denied" sources={list.denied} onRemove={remove} />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function SourceList({
  title,
  sources,
  onRemove,
}: {
  title: string;
  sources: string[];
  onRemove: (source: string) => void;
}) {
  if (sources.length === 0) return null;
  return (
    <>
      <Typography variant="subtitle2" sx={{ mt: 2 }}>
        {title}
      </Typography>
      <List dense disablePadding>
        {sources.map((source) => (
          <ListItem
            key={source}
            disableGutters
            secondaryAction={
              <Tooltip title="Remove">
                <IconButton
                  edge="end"
                  aria-label={`Remove ${source}`}
                  onClick={() => onRemove(source)}
                >
                  <RemoveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            }
          >
            <ListItemText
              primary={source}
              primaryTypographyProps={{ sx: { wordBreak: "break-word" } }}
            />
          </ListItem>
        ))}
      </List>
    </>
  );
}
