# ROOM 3D — roadmap for the big push

Decisions (from the planning Q&A):
- 1–2 agents at a time (5-hour usage window), pushed to `room-3d` per milestone with green tests;
  `ccr-d0bf85dd-g7ev37` is kept in sync. No PR. The Java original stays untouched.
- Status check-ins every 2 hours.
- Tone: keep the current playful, self-aware, slightly spooky humour.
- Story voices: browser speech synthesis, optional and off by default.
- VR: skipped (can't be tested on a headset here).
- Co-op: pure peer-to-peer WebRTC with copy-paste codes (no server).
- If planned work runs out: playtest bots, bug fixes, balance, visuals, docs, achievements.

## Order

✅ 0. **Fix the failing test** from the mana change (top up mana in the long Act 1 chain test).
✅ 1. **TypeScript + refactor** (first, so everything after lands on a clean base)
   - `tsc --noEmit` type-check in CI; convert modules to `.ts`
   - split `game.js` (~1,500 lines) into room level / placement / interactions / puzzles / console / physics glue
   - shared boss-level base (spell bar, mana, aim ring, drops, hurt/shield)
✅ 2. **Bigger test suite + CI**
   - unit tests (Vitest) for pure logic: share codec, seeded RNG, placement rules, mana, splits
   - visual screenshot regression for the key scenes (tolerant thresholds)
   - performance budget check (bundle size, draw calls)
✅ 3. **Branching endings**: choices at the witch's rematch and the finale (spare/apprentice, refuse and stay
   to "redecorate", a secret true ending gated by secrets), tracked as endings found
✅ 4. **Part 4: new worlds** beyond the witch's door
   - gravity-flipped room (things fall UP — conjure onto the ceiling)
   - flooded library (rising water, floating books, buoyancy with physics)
   - clockwork tower (timed rotating rooms; conjured furniture as gear-stoppers)
✅ 5. **Story campaign mode**: chapter map / level select, chapter replays, cutscene system, NPC dialogue trees,
   optional TTS voices
✅ 6. **Roguelike / endless mode**: procedurally generated rooms and puzzles, runs, upgrades between rooms,
   seeded daily run, local leaderboard
✅ 7. **Co-op multiplayer**: WebRTC copy-paste pairing, host-authoritative room state, second wizard avatar,
   shared conjuring, co-op puzzles
✅ 8. **Art and audio upgrade**: better procedural models and materials, particles, dynamic danger-reactive music,
   more SFX
✅ 9. **Mobile/perf polish**: profiling, instancing, LOD, adaptive resolution, 60 fps target on mid-range phones
10. Overflow: bug bash, balance, docs, achievements, secrets
