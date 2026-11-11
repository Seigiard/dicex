# Dicex

Beautiful 3D dice extension for d20 based systems, forked from [Owlbear Rodeo Dice](https://github.com/owlbear-rodeo/dice).

![Example](/docs/header.jpg)

## Fork Features

Dicex extends the upstream Owlbear Rodeo dice roller with the following:

### Advanced Roll Mechanics

- **Exploding dice** — Dice that hit their max (or a specified threshold) automatically reroll and add to the total. Supports `!`, `!>N`, and exact-value explosions.
- **Keep/drop** — Roll extra dice and keep the highest or drop the lowest (e.g. `4d6k3` for classic stat rolling).
- **Advantage/disadvantage** — Toggle to automatically double your dice pool and take the highest or lowest result. Handles paired d100+d10 correctly.

### Dice Notation

A full notation parser and serializer supporting expressions like `4d6!k3+2`. Used throughout presets, chat messages, and the audit log.

### Presets

Save, load, and edit named roll configurations. Presets persist per-player in OBR room metadata and can be quickly loaded from a picker menu. The active preset name is shown in chat messages.

### Rumble Chat Integration

Roll results are automatically posted to Owlbear Rodeo's Rumble chat with smart formatting — individual die values grouped by type, emoji markers for crits (⭐), fumbles (💀), explosions (💥), and dropped dice (🚫). Hidden rolls are only visible to the rolling player and the GM.

### Roll Audit Log

Every roll is recorded with timestamp, notation, individual die results, total, and advantage mode. The GM can export the full table's roll history as JSON or clear the log.

### Hidden Rolls

A visibility toggle that defaults to hidden for GMs and visible for players. Hidden rolls are excluded from the public Rumble chat feed and only sent to the roller and GM.

### Dice+ Integration

Other Owlbear Rodeo extensions can ask dicex to roll on their behalf, using the Dice+ broadcast protocol. A request is sent on `dice-plus/roll-request` with `{ destination: "LOCAL" }`; the result comes back on `{source}/roll-result`, or an error on `{source}/roll-error`. The authoritative payload types are exported from `src/plugin/dicePlusProtocol.ts`.

**The GM decides which extensions may roll.** Access is per room and denied by default. The GM's answers are stored in room metadata under `rodeo.owlbear.dice/access` as `{ allowed: string[], denied: string[] }`, keyed by `source`.

- **First roll from an unknown source waits for the GM.** Dicex asks every GM in the room with a modal: *Extension `<source>` wants to roll dice in this room. Allow?* (**Allow** / **Deny**). The first GM to answer decides; the other GMs' modals close. The request waits up to 25 seconds (`ACCESS_DECISION_TIMEOUT_MS`), then rolls on Allow or fails on Deny or no answer.
- **No GM in the room, no access.** A roll request from a source without an answer fails at once.
- **Errors** arrive on `{source}/roll-error` with `error` set to `"not-permitted"` (denied, or no answer within 25 s) or `"no-gm"` (no GM in the room).
- **Ask up front** with `dice-plus/request-access` `{ requestId, source }` (`destination: "LOCAL"`). The reply arrives on `{source}/access` as `{ requestId, status }`, where `status` is `"allowed"`, `"denied"`, `"no-gm"`, or `"pending"`. After `"pending"`, a second reply with the same `requestId` follows: `"allowed"`, `"denied"`, or `"timeout"` after 25 s without an answer.
- **Check without asking**: add `source` to the `dice-plus/isReady` request, and the reply carries `permitted: boolean`. Without `source`, the reply keeps its old shape.
- **Change an answer** in Dicex: Tools → *Extension Access* (GM only) lists allowed and denied extensions. Remove one to be asked again on its next roll.
- **`source` is self-declared.** This stops rolls nobody asked for, not an extension that pretends to be another one; any extension in the room can also write room metadata.

**Roll visibility is source-gated.** A request carries a `rollTarget`, but `"everyone"` produces a visible roll *only* when the requesting extension's `source` id is listed in `TRUSTED_ROLL_TARGET_SOURCES`. Every other combination is hidden:

| `rollTarget` | Trusted source | Any other source |
|---|---|---|
| `everyone` | visible | hidden |
| `self` / `dm` / `gm_only` | hidden | hidden |

This is an allowlist because the failure modes aren't symmetric — a roll wrongly made public can't be taken back, while one wrongly hidden is a minor annoyance. An unrecognized source is therefore always hidden.

Two consequences worth knowing before integrating:

- **`everyone` fails silently if you aren't listed.** The roll succeeds and reports back normally; it's just hidden. There's no error. If your integration's rolls are unexpectedly private, this is why — open an issue to have your extension's id added.
- **Dice+ rolls never alter the user's tray toggle.** Visibility is passed per-roll, so a request cannot leave the user's own hidden setting changed.

## Installing

Add the extension to Owlbear Rodeo using this manifest URL:

```
https://abottchen.github.io/dicex/manifest.json
```

## How it Works

This project uses [React](https://reactjs.org/) for UI, [Three.js](https://threejs.org/) for rendering and [Rapier](https://rapier.rs/) for physics.

The physics simulation is used to both generate the animation for the roll as well as the final roll values.

> Wait is it really random if physics is used to determine the result? How do I know the dice rolls are fair?

Short answer yes, the dice are fair. Long answer [here's a statistical analysis](https://blog.owlbear.rodeo/are-owlbear-rodeos-dice-fair/) of the rolling methodology.

In order to sync rolls over the network efficiently we rely on the fact the Rapier is a deterministic physics engine. This means that across two different computers we'll get the same result given the same initial parameters.

So we only need to make sure that all the initial parameters are synced and then each client can run its own simulation and end up with the correct animation.

To try out the dice roller outside of Owlbear Rodeo you can head to <https://dice.owlbear.rodeo/>.

## Building

This project uses [Yarn](https://yarnpkg.com/) as a package manager.

To install all the dependencies run:

`yarn`

To run in a development mode run:

`yarn dev`

To make a production build run:

`yarn build`

## Project Structure

All source files can be found in the `src` folder.

If you'd like to create a new dice set with the existing dice styles edit the `diceSets.ts` file in the `sets` folder.

If you'd like to add a new dice style the 3D models for the dice are split across four folders: `materials`, `meshes`, `colliders` and `previews`.

The `materials` folder contains the PBR materials for each dice style.

The `meshes` folder contains the 3D geometry used for the dice.

The `colliders` folder contains the simplified collider geometry for the dice.

The `previews` folder contains 2D image previews for each dice.

All the code specific for the Owlbear Rodeo extension is in the `plugin` folder.

## License

GNU GPLv3

## Contributing

This project is provided as an example of how to use the Owlbear Rodeo SDK. As such it is unlikely that we will accept pull requests for new features.

Instead we encourage you to fork this repository and build the dice roller of your dreams.

Copyright (C) 2023 Owlbear Rodeo
