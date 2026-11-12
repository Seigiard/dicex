# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Shell tools

- **Never use Python for JSON parsing** — use `jq` instead. `jq` is available on PATH.
- Prefer dedicated tools (Read, Grep, Glob) over shell commands when possible.

## Commands

```bash
yarn          # Install dependencies
yarn dev      # Start development server (Vite)
yarn build    # TypeScript check + production build
yarn preview  # Preview production build locally
yarn test     # Run all vitest tests once
yarn test:watch  # Run vitest in watch mode
```

Note: The `src/tests/` folder contains a fairness tester UI tool, not part of the automated test suite. Actual tests are colocated with source files (`*.test.ts`) and in `src/integration/`.

## Architecture

This is a 3D dice roller [Owlbear Rodeo VTT extension](https://extensions.owlbear.rodeo/dice). It uses React + Three.js for rendering and Rapier (WASM deterministic physics engine) for both animation and result generation.

**The key insight**: Because Rapier is deterministic, only the initial throw parameters need to be synced over the network — each client runs its own identical simulation and produces the same result.

### Separate entry points (separate Vite builds):

- `src/main.tsx` → standalone dice tray at `dice.owlbear.rodeo`
- `src/popover.tsx` → embedded popover within Owlbear Rodeo showing synced player rolls
- `src/background.ts` → background service managing plugin communication
- `src/accessPrompt.tsx` → GM modal asking whether an extension may roll dice in the room

### State management (Zustand):

- `src/controls/store.ts` (`useDiceControlsStore`) — UI state: which dice are selected, counts, bonus, advantage/disadvantage mode
- `src/dice/store.ts` (`useDiceRollStore`) — physics state: active roll throws, transform positions, final values

### Adding a new dice style

Four folders must be updated together: `src/materials/` (PBR textures), `src/meshes/` (3D geometry), `src/colliders/` (simplified physics geometry), `src/previews/` (2D UI preview images). Then register the set in `src/sets/diceSets.ts`.

### Test structure

- **Unit tests** — colocated next to source files (e.g. `src/helpers/advancedRolls.test.ts`)
- **Integration tests** — in `src/integration/`, test full roll workflows using a shared setup (`src/integration/setup.ts`) that creates real Zustand stores
- Vitest config is in `vite.config.ts` under `test:`; environment is `node` (no DOM)

### Key files

| File | Purpose |
|------|---------|
| `src/tray/InteractiveTray.tsx` | Root Three.js Canvas + Rapier physics world setup |
| `src/dice/PhysicsDice.tsx` | Single die: physics body, collision detection, value determination |
| `src/dice/InteractiveDiceRoll.tsx` | Orchestrates multiple dice rolling simultaneously |
| `src/helpers/DiceThrower.ts` | Generates random initial positions/velocities for fair rolls |
| `src/helpers/getCombinedDiceValue.ts` | Aggregates results (sum, highest/lowest for advantage) |
| `src/helpers/advancedRolls.ts` | Advanced roll mechanics (reroll, keep highest/lowest, exploding dice) |
| `src/helpers/notationParser.ts` | Parses dice notation strings (e.g. `2d6+3`) into structured data |
| `src/helpers/buildDiceResults.ts` | Builds final dice result objects from raw roll data |
| `src/plugin/` | All Owlbear SDK integration code |
| `src/plugin/dicePlusProtocol.ts` | Dice+ integration contract: payload types, channels, and `resolveHidden` / `resolveHiddenAudience`, which map a request's `rollTarget` onto roll visibility |
| `src/plugin/gmRollReveal.ts` | Sends a `hiddenAudience: "gm"` roll's throws and values to GM clients, which replay it in their trays |
| `src/plugin/dicePlusAccess.ts` | Per-room record of the extensions a GM allowed or denied to roll, and the roller-side wait for a GM's answer |
| `src/plugin/dicePlusAccessHost.ts` | GM-side background host that opens the `access-prompt.html` modal for extensions waiting for an answer |
| `src/plugin/rollLoggerSubscription.ts` | Subscribes to roll events and logs them |
| `src/plugin/rumbleSyncSubscription.ts` | Subscribes to rumble (screen shake) sync events |
| `src/audio/` | Procedural Web Audio API dice impact sounds |
