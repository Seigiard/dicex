import { useState, useEffect } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import BuildIcon from "@mui/icons-material/BuildRounded";
import FairnessIcon from "@mui/icons-material/BalanceRounded";
import TuneIcon from "@mui/icons-material/TuneRounded";
import DownloadIcon from "@mui/icons-material/FileDownloadRounded";
import DownloadClearIcon from "@mui/icons-material/DeleteSweepRounded";
import PaletteIcon from "@mui/icons-material/PaletteRounded";
import Divider from "@mui/material/Divider";
import Switch from "@mui/material/Switch";
import KeyboardIcon from "@mui/icons-material/KeyboardRounded";
import StorageIcon from "@mui/icons-material/SdStorageRounded";
import ExtensionIcon from "@mui/icons-material/ExtensionRounded";
import OBR from "@owlbear-rodeo/sdk";

import { useDiceControlsStore } from "./store";
import { useDiceRollStore } from "../dice/store";
import { PresetEditor } from "./PresetEditor";
import { loadPresets, Preset } from "../plugin/presetStorage";
import { loadPresetIntoControls } from "../helpers/loadPresetIntoControls";
import { saveSetting } from "../plugin/userSettingsStorage";
import { combinePlayerLogs, triggerJsonDownload } from "../plugin/rollLogExport";
import { getPlayerLogs, clearPlayerLogs, getManifest, SceneLogManifest } from "../plugin/rollLogStorage";
import { StorageStatusDialog } from "./StorageStatusDialog";
import { ExtensionAccessDialog } from "./ExtensionAccessDialog";

export function ToolsMenu() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [presetAnchorEl, setPresetAnchorEl] = useState<null | HTMLElement>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [isGM, setIsGM] = useState(false);
  const [isPlugin, setIsPlugin] = useState(false);
  const [storageDialogOpen, setStorageDialogOpen] = useState(false);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [manifest, setManifest] = useState<Record<string, SceneLogManifest>>({});

  const toggleFairnessTester = useDiceControlsStore(
    (state) => state.toggleFairnessTester
  );
  const clearRoll = useDiceRollStore((s) => s.clearRoll);
  const explosionGlowColor = useDiceControlsStore(
    (state) => state.explosionGlowColor
  );
  const setExplosionGlowColor = useDiceControlsStore(
    (state) => state.setExplosionGlowColor
  );
  const notationInputEnabled = useDiceControlsStore(
    (state) => state.notationInputEnabled
  );
  const setNotationInputEnabled = useDiceControlsStore(
    (state) => state.setNotationInputEnabled
  );

  function handleToggleNotationInput() {
    const next = !notationInputEnabled;
    setNotationInputEnabled(next);
    if (isPlugin) {
      saveSetting("notation-input-enabled", OBR.player.id, next).catch(
        () => {}
      );
    }
  }

  useEffect(() => {
    if (OBR.isAvailable) {
      OBR.onReady(() => {
        setIsPlugin(true);
        OBR.player.getRole().then((role) => setIsGM(role === "GM"));
        getManifest().then(setManifest);
      });
    }
  }, []);

  function handleOpen(event: React.MouseEvent<HTMLElement>) {
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
    setPresetAnchorEl(null);
  }

  function handlePresetsOpen(event: React.MouseEvent<HTMLElement>) {
    if (isPlugin) {
      loadPresets(OBR.player.id).then(setPresets);
    }
    setPresetAnchorEl(event.currentTarget);
  }

  function handlePresetsClose() {
    setPresetAnchorEl(null);
  }

  function getStorageStatusColor(): "inherit" | "warning" | "error" {
    const entries = Object.values(manifest);
    if (entries.some((e) => e.sizeBytes / 65536 >= 0.8)) return "error";
    if (entries.some((e) => e.sizeBytes / 65536 >= 0.5)) return "warning";
    return "inherit";
  }

  async function handleStorageStatus() {
    handleClose();
    const m = await getManifest();
    setManifest(m);
    setStorageDialogOpen(true);
  }

  function handleSelectPreset(preset: Preset) {
    handlePresetsClose();
    handleClose();
    try {
      clearRoll();
      loadPresetIntoControls(preset.notation, preset.name);
    } catch {
      // Invalid notation
    }
  }

  async function handleDownload() {
    handleClose();
    const logs = await getPlayerLogs();
    const combined = combinePlayerLogs(logs);
    const date = new Date().toISOString().split("T")[0];
    triggerJsonDownload(combined, `dicex-rolls-${date}.json`);
  }

  async function handleDownloadAndClear() {
    handleClose();
    await handleDownload();
    await clearPlayerLogs();
  }

  return (
    <>
      <Tooltip title="Tools" placement="top" disableInteractive>
        <IconButton onClick={handleOpen}>
          <BuildIcon />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
      >
        {isPlugin && (
          <MenuItem onClick={handlePresetsOpen}>
            <ListItemIcon>
              <TuneIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Presets</ListItemText>
          </MenuItem>
        )}
        {isPlugin && (
          <MenuItem onClick={handleToggleNotationInput}>
            <ListItemIcon>
              <KeyboardIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Notation Input</ListItemText>
            <Switch
              edge="end"
              checked={notationInputEnabled}
              onChange={handleToggleNotationInput}
              onClick={(e) => e.stopPropagation()}
            />
          </MenuItem>
        )}
        <MenuItem sx={{ gap: 1 }}>
          <ListItemIcon>
            <PaletteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Explosion Glow</ListItemText>
          <input
            type="color"
            value={explosionGlowColor}
            onChange={(e) => setExplosionGlowColor(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            style={{ width: 28, height: 28, border: "none", cursor: "pointer", background: "transparent" }}
          />
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleClose();
            toggleFairnessTester();
          }}
        >
          <ListItemIcon>
            <FairnessIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Fairness</ListItemText>
        </MenuItem>
        {isPlugin && isGM && <Divider />}
        {isPlugin && isGM && (
          <MenuItem onClick={handleDownload}>
            <ListItemIcon>
              <DownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Download Rolls</ListItemText>
          </MenuItem>
        )}
        {isPlugin && isGM && (
          <MenuItem onClick={handleDownloadAndClear}>
            <ListItemIcon>
              <DownloadClearIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Download & Clear</ListItemText>
          </MenuItem>
        )}
        {isPlugin && isGM && (
          <MenuItem onClick={handleStorageStatus}>
            <ListItemIcon>
              <StorageIcon fontSize="small" color={getStorageStatusColor()} />
            </ListItemIcon>
            <ListItemText>
              Storage Status
            </ListItemText>
          </MenuItem>
        )}
        {isPlugin && isGM && (
          <MenuItem
            onClick={() => {
              handleClose();
              setAccessDialogOpen(true);
            }}
          >
            <ListItemIcon>
              <ExtensionIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Extension Access</ListItemText>
          </MenuItem>
        )}
      </Menu>
      <Menu
        anchorEl={presetAnchorEl}
        open={Boolean(presetAnchorEl)}
        onClose={handlePresetsClose}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        {presets.length === 0 && (
          <MenuItem disabled>
            <ListItemText>No presets saved</ListItemText>
          </MenuItem>
        )}
        {presets.map((preset) => (
          <MenuItem key={preset.id} onClick={() => handleSelectPreset(preset)}>
            <ListItemText primary={preset.name} secondary={preset.notation} />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem
          onClick={() => {
            handlePresetsClose();
            handleClose();
            setEditorOpen(true);
          }}
        >
          <ListItemText>Edit Presets</ListItemText>
        </MenuItem>
      </Menu>
      {isPlugin && (
        <PresetEditor
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          onSave={() => {}}
        />
      )}
      {isPlugin && isGM && (
        <ExtensionAccessDialog
          open={accessDialogOpen}
          onClose={() => setAccessDialogOpen(false)}
        />
      )}
      <StorageStatusDialog
        open={storageDialogOpen}
        onClose={() => setStorageDialogOpen(false)}
        manifest={manifest}
      />
    </>
  );
}
