# Room — ideas & roadmap

The original Java CLI game (`Create a Room-20220730T174306Z-001/`) is preserved untouched.
Everything new lives in `web3d/`.

## What the original is (and what made it fun)

- A wizard banished to an empty, dark room. Your power: conjure things, and they **drop from the sky**.
- Commands like `create bed north`, `go se`, `open shelf`, `turn pc`, and an ASCII map of a 3×3 room with
  four "outside" slots and four wall slots.
- A hidden puzzle chain: lamp → PC (which shatters unless a cushion is under it) → rock-paper-scissors →
  "search the floor" → invisible key → showcase (Kraken skeleton, giant-nail fossil, H key) → door beside
  Hell → enter Hell → "KRAKEN 2.0 ... TO BE CONTINUED".
- Lots of personality: you can get crushed by your own bed, the TV and kitchen are "out of bounds, finish the
  game for a legit explanation", you can't leave the bathroom with the tap on, you "still look fabulous".

## Done in this branch (`web3d/`)

- [x] **Everything 3D**: a first-person three.js game in the browser, no install needed
- [x] Conjuring with a live placement ghost (floor cell / wall / beyond the wall); things fall from a
      ceiling rift, kick up dust, shake the camera, and can crush you
- [x] Fear mechanic: no lamp or lamp off = can't move, heartbeat, dark vignette
- [x] Original puzzle chain rebuilt, plus a cleaner logic for doors, keys, the lock beside Hell
- [x] **Part 2 written**: the Hell boss fight against Kraken 2.0. The "falls from the sky" mechanic becomes
      the weapon: pin tentacles with furniture, then drop the Giant Nail learned from the fossil
- [x] The promised "legit explanation" for the TV and kitchen is finally delivered in the ending
- [x] Side content: 6 lore books, dream sequence, the witch's TV channel, bathroom, kitchen + ember stew,
      shoes vs slippers vs barefoot in Hell, mirrors
- [x] Procedural audio (music + sfx), touch controls, autosave + Hell checkpoint, 18 achievements, settings
- [x] Bugs from the original (the `notes` file and more) are gone in the 3D version; the Java code itself is
      unchanged: "north east" parsing and `ne` mapping to `nw`, kitchen
      over other outdoor rooms, biased rock-paper-scissors RNG, chair `directionNames[3]` out-of-bounds,
      shoe rack fall-through (`wear` also ran `take`), sit-on-floor fall-through, `put` reading one token,
      "close" opening doors, Door1 unlocking Door4, sleeping on the sofa saying "bed"

## Next ideas (not built yet)

### Quick wins
- **GitHub Pages deploy**: a workflow that builds `web3d/` and publishes a playable link
- **Text-command console** (press `/`): type the original commands (`create bed north`, `go se`, `open shelf`)
  and the 3D world obeys. A love letter to the CLI version
- **Photo mode** + "share your room" screenshot
- **Room sharing**: encode the placed furniture in a URL so friends can visit your layout
- Subtitles/captions for the witch's lines, colour-blind-friendly telegraph colours, a reduced-motion toggle

### Gameplay depth
- **Free conjuring**: unlock off-grid placement and stacking (books on tables, lamps on desks) after the game
- **Physics** (Rapier/cannon-es): conjured things topple, bounce and stack; knock the showcase over to break
  the glass as an alternate solution
- More puzzles per object: the bookshelf hides a lever, the closet has a false back, the chair/TV angle
  reveals a code, the shoe rack holds the only fire-proof boots
- **Mana and spell upgrades**: bigger conjures cost more; levitate, shrink, swap
- **Hard mode**: one heart, Kraken phase 3, timed escape
- **Speedrun timer + splits**, daily seeded "room challenges" (random starting furniture, random key spots)

### Story — Part 3 and beyond
- **The rematch**: a duel against the witch using everything learned (counter-conjuring, reflected drops)
- More rooms beyond hell: a library-world, a flooded room, a gravity-flipped room where things fall *up*
- Branching endings: spare/stay/redecorate ending ("most people just stay in the room and redecorate")
- Voice acting via TTS for the witch; a proper cutscene system

### Tech & platform
- **VR mode** (WebXR): point your wand and drop furniture in room scale. A natural fit for this game
- PWA install + offline play; gamepad support
- Ship as a desktop app (Tauri/Electron) or wrap for Android/iOS (Capacitor)
- Port to Godot/Unity for a Steam release with real art, physics and voice
- Multiplayer co-op: two wizards, one room, conjure each other's solutions
- Replace procedural models with stylised low-poly GLTF art; baked lighting for mobile
- A level editor: let players design their own escape rooms and share them

### For the original Java version
- Refactor the 1,500-line `Base.java` into data-driven objects, add save/load, and add unit tests for the
  parser. A "Java edition" kept alive alongside the 3D one
- Package it as a runnable JAR with a proper command parser (`create bed north east` and so on)
