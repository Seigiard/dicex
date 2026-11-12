import { Environment } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Paper from "@mui/material/Paper";
import Slide from "@mui/material/Slide";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";

import environment from "../environment.hdr";
import { buildDiceResults } from "../helpers/buildDiceResults";
import { AudioListenerProvider } from "../audio/AudioListenerProvider";
import { DiceRoll } from "../dice/DiceRoll";
import { DiceTransform } from "../types/DiceTransform";
import { useExplosionWaves } from "../dice/useExplosionWaves";
import { useDiceControlsStore } from "../controls/store";
import { useDiceRollStore } from "../dice/store";
import {
  PendingRollRequest,
  subscribePendingRollRequest,
} from "./dicePlusPendingRequest";
import { Tray } from "../tray/Tray";
import { TraySuspense } from "../tray/TraySuspense";
import { AnimatedPlayerCamera } from "./AnimatedPlayerCamera";

export const LOCAL_ROLL_TRAY_KEY = "dice-plus-local-roll";

export function DicePlusPopoverRollTray({
  onToggle,
}: {
  onToggle: (key: string, show: boolean) => void;
}) {
  const roll = useDiceRollStore((state) => state.roll);
  const rollThrows = useDiceRollStore((state) => state.rollThrows);
  const rollValues = useDiceRollStore((state) => state.rollValues);
  const rollTransforms = useDiceRollStore((state) => state.rollTransforms);
  const finishDieRoll = useDiceRollStore((state) => state.finishDieRoll);
  const activeNotationComponents = useDiceControlsStore(
    (state) => state.activeNotationComponents
  );
  useExplosionWaves();
  const explosionWavesActive = useDiceRollStore(
    (state) => state.explosionWavesActive
  );
  const transformsRef = useRef<Record<string, DiceTransform | null> | null>(null);
  const [request, setRequest] = useState<PendingRollRequest | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    return subscribePendingRollRequest((nextRequest) => {
      setRequest(nextRequest);
    });
  }, []);

  useEffect(() => {
    if (!roll) {
      setRequest(null);
      setTimedOut(false);
    }
  }, [roll]);

  useEffect(() => {
    transformsRef.current = rollTransforms;
  }, [rollTransforms]);

  const finishedTransforms = useMemo(() => {
    if (Object.values(rollTransforms).some((value) => value === null)) {
      return undefined;
    }
    return rollTransforms as Record<string, DiceTransform>;
  }, [rollTransforms]);

  const finishedRolling = Boolean(
    roll &&
      Object.keys(rollValues).length > 0 &&
      Object.values(rollValues).every((value) => value !== null) &&
      !explosionWavesActive
  );

  const result = useMemo(() => {
    if (!roll || !finishedRolling) return null;
    return buildDiceResults({
      roll,
      rollValues: rollValues as Record<string, number>,
      activeNotationComponents,
    });
  }, [activeNotationComponents, finishedRolling, roll, rollValues]);

  useEffect(() => {
    if (!finishedRolling) {
      setTimedOut(false);
      return;
    }

    const timeout = setTimeout(() => setTimedOut(true), 5000);
    return () => clearTimeout(timeout);
  }, [finishedRolling]);

  const shown = Boolean(roll) && !timedOut;
  useEffect(() => {
    if (shown) onToggle(LOCAL_ROLL_TRAY_KEY, true);
  }, [onToggle, shown]);

  function handleClick() {
    if (shown && finishedRolling) setTimedOut(true);
  }

  return (
    <Box component="div" position="absolute" right={16} bottom={16}>
      <Slide
        in={shown}
        onExited={() => onToggle(LOCAL_ROLL_TRAY_KEY, false)}
        direction="up"
      >
        <ButtonBase onClick={handleClick} aria-label="Hide dice roll">
          <Paper
            elevation={8}
            sx={{
              width: "250px",
              height: "282px",
              borderRadius: 2,
              overflow: "hidden",
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "rgba(34, 38, 57, 0.8)"
                  : "rgba(255, 255, 255, 0.4)",
            }}
          >
            <Box component="div" height="250px" width="250px">
              <TraySuspense>
                <Canvas frameloop="demand">
                  <AudioListenerProvider volume={0.25}>
                    <Environment files={environment} />
                    <Tray />
                    {roll && (
                      <DiceRoll
                        roll={roll}
                        rollThrows={rollThrows}
                        finishedTransforms={
                          finishedRolling ? finishedTransforms : undefined
                        }
                        onRollFinished={finishDieRoll}
                        transformsRef={transformsRef}
                      />
                    )}
                    <AnimatedPlayerCamera
                      rollTransforms={
                        finishedRolling ? finishedTransforms : undefined
                      }
                    />
                  </AudioListenerProvider>
                </Canvas>
              </TraySuspense>
            </Box>
            <Typography
              variant="subtitle1"
              color="text.secondary"
              textAlign="center"
              lineHeight="32px"
              sx={{ bgcolor: "background.default" }}
              noWrap
            >
              {roll?.hidden && "\uD83D\uDD12 "}
              {request?.playerName}
              {finishedRolling && result && <span> | {result.total}</span>}
            </Typography>
          </Paper>
        </ButtonBase>
      </Slide>
    </Box>
  );
}
