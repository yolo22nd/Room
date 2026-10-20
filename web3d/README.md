# ROOM — a 3D reimagining

A first-person 3D browser remake of **Room**, the original Java command-line game in
[`../Create a Room-20220730T174306Z-001`](../Create%20a%20Room-20220730T174306Z-001) (left untouched).

> You, a newbie wizard, lost a duel to the best witch in your world. She banished you to a room
> beyond hell. To get back to the world of the living you will literally need to go through hell.
> The good news: you kept your powers. Anything you conjure **falls from the sky**.

## Run it

```bash
cd web3d
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (works from any sub-path, e.g. GitHub Pages)
```

Built with [three.js](https://threejs.org) and Vite. There are no asset files: every texture, model and
sound is generated in code (canvas textures, primitive geometry, WebAudio synthesis).

## How it plays

**Act 1 — The Room.** You start in total darkness, too scared to move. Open the spellbook and conjure
furniture onto a 3×3 grid, doors and TVs onto walls, and whole rooms (bathroom, kitchen, Hell) beyond the
walls. The original puzzle chain is still here, expanded:

1. Conjure a lamp and turn it on so you can move.
2. A PC shatters on the bare floor. Conjure a cushion first, then drop the PC onto it.
3. Beat the PC at rock-paper-scissors. Its secret tip: search the floor where it stands.
4. The invisible key opens the glass showcase: a Kraken skeleton, a fossil of a giant nail (which teaches
   you the **Giant Nail** spell) and a key with an **H** on it.
5. Conjure Hell beyond a wall and a door on that wall. The door beside Hell locks itself until you have the H key.
6. Wear shoes. ("Please wear shoes before going out of the house.")

Optional side content: six readable books full of lore and hints, a dream when you sleep, the witch's TV
channel (sit on a chair facing the TV), a working bathroom (you can't leave with the tap running), a kitchen
with one ember stew (+1 max heart, eaten at the dining table), a closet mirror, and more.

**Act 2 — Hell.** The "to be continued" from the original is now a boss fight against **KRAKEN 2.0**. Its
arms slam where you stand and then rest on the stone. Drop your conjured furniture on them to pin them.
Pin four and its head slumps forward. Then drop the Giant Nail on it.

## Controls

| Desktop | Touch | Action |
|---|---|---|
| WASD / arrows, Shift to run | left stick | move |
| mouse (click to capture) | drag | look |
| E | Use | interact / confirm |
| Q | Spells | spellbook (in Hell: switch spell) |
| click | Cast | conjure / attack |
| R | Use (while placing) | rotate before conjuring |
| F | Lamp | lamp on/off |
| G | Search | search the floor |
| X | — | put the lamp down |
| Space | move | stand up |
| Esc | II | pause |
| / or T | Pause → Command line | classic CLI: `create bed north east`, `go sw`, `locate`, `turn lamp`… |

## Features

- Autosave (and a checkpoint at the gate of Hell), Continue from the title screen
- 18 achievements, stored in the browser
- Procedural music and sound: ambient drones, a heartbeat in the dark, a music box, Hell war drums,
  and synthesised sound effects
- Settings: music/sfx volume, look sensitivity, invert Y, graphics quality (shadows + bloom)
- Touch controls are switched on automatically on phones and tablets

## Code map

| File | What |
|---|---|
| `src/main.js` | renderer, game loop, title/pause/settings/death/ending screens |
| `src/game.js` | Act 1: conjuring and placement, collisions, every interaction and puzzle |
| `src/hell.js` | Act 2: arena, Kraken 2.0, tentacle AI, pins, fireballs, nail, victory |
| `src/room.js` | room geometry, the 3×3 grid, walls with door gaps, annex rooms |
| `src/models.js` | procedural furniture, keys, lantern, giant nail; the conjure catalog |
| `src/story.js` | all narrative text |
| `src/audio.js` | WebAudio synthesis |
| `src/input.js`, `src/player.js` | keyboard/mouse/touch input, first-person controller |
| `src/ui.js`, `src/style.css` | HUD, dialogs, toasts, screens |
| `src/save.js` | save game, settings, achievements |

`window.__room` exposes the engine for automated playtests.
