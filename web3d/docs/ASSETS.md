# Real models (optional)

The game builds every model in code, so it runs with zero asset files. To swap in real
models, put glTF/GLB files in `public/models/` and list them in `public/models/manifest.json`:

```json
{
  "furniture/bed":   { "url": "models/bed.glb", "rotY": 0 },
  "furniture/sofa":  { "url": "models/sofa.glb", "rotY": 3.1416 },
  "character/cat":   { "url": "models/cat.glb", "height": 0.35 }
}
```

- `fit` (default `"footprint"`): scaled uniformly to fill the object's floor footprint, centred,
  standing on the floor. `height`: scaled to that height instead. `scale`, `y`: manual tweaks.
- `rotY`: radians, so the model's front faces +Z (towards the room's centre when placed north).
- Missing or broken files fall back to the procedural model; nothing else changes.
- Meshopt-compressed GLB is supported (`gltfpack -cc`), which keeps downloads small for phones.

## Slots

| Id | What | Notes |
|---|---|---|
| `furniture/cushion`, `bed`, `sofa`, `chair`, `table`, `dine`, `shelf`, `closet`, `shoerack` | conjurable furniture | footprints in `src/models.ts` (`CATALOG.fp`, half-extents) |
| `character/cat` | the familiar | clips named `idle`, `walk`, `sit`, `sleep` are used if present |
| `character/witch`, `character/kraken` | bosses | planned; same clip-name convention |

The PC, showcase, doors, TV and annex rooms stay procedural: the game drives their screens,
hinges and glass.

## Planned sources (all CC0)

- Kenney: Furniture Kit, Mini Characters, Nature Kit
- Quaternius: Ultimate Animated Animals (cat), Ultimate Monsters, Medieval Village
- Poly Haven: textures and HDRIs (a few HDRIs already ship via `@pmndrs/assets`)

These sites are blocked by the current cloud environment's network policy; once allowed
(see the environment's Network access settings), a fetch script will download, convert and
list them here.
