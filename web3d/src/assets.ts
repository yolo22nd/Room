import * as THREE from 'three';

// Optional real models. public/models/manifest.json maps a model id to a glTF
// file; anything missing (or failing to load) falls back to the procedural
// builders, so the game always works with zero asset files.
//
// manifest.json:
//   { "furniture/bed": { "url": "models/bed.glb", "rotY": 0, "fit": "footprint" },
//     "character/cat": { "url": "models/cat.glb", "height": 0.35 } }
//
// fit "footprint": scaled uniformly to fill the object's floor footprint
// (CATALOG fp half-extents), centred, feet on the floor. "height": scaled
// to the given height. Animated models keep their clips (see animated()).

export type ModelEntry = { url: string; rotY?: number; fit?: 'footprint' | 'none'; height?: number; scale?: number; y?: number; credit?: string };

const BASE = (import.meta as any).env?.BASE_URL || './';
let manifest: Record<string, ModelEntry> = {};
const ready = new Map<string, { scene: THREE.Object3D; clips: THREE.AnimationClip[] }>();
let loadedAll: Promise<void> | null = null;

/** Fetch the manifest and load every model in it (call once at startup; never throws). */
export function loadAssets(): Promise<void> {
  if (loadedAll) return loadedAll;
  loadedAll = (async () => {
    try {
      const r = await fetch(BASE + 'models/manifest.json', { cache: 'no-cache' });
      if (!r.ok) return;
      manifest = await r.json();
    } catch (e) { return; }
    const ids = Object.keys(manifest);
    if (!ids.length) return;
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    await Promise.all(ids.map(async (id) => {
      try {
        const g = await loader.loadAsync(BASE + manifest[id].url);
        g.scene.traverse((o: any) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; if (o.material) o.material.userData.shared = true; if (o.geometry) o.geometry.userData.shared = true; } });
        ready.set(id, { scene: g.scene, clips: g.animations || [] });
      } catch (e) { console.warn('[assets] could not load', id, e); }
    }));
  })();
  return loadedAll;
}

export const hasModel = (id: string) => ready.has(id);
export const modelIds = () => [...ready.keys()];

/** A fitted copy of a model, or null if there is none. fp = [halfX, halfZ]. */
export function modelFor(id: string, fp?: [number, number]): THREE.Object3D | null {
  const m = ready.get(id);
  if (!m) return null;
  const e = manifest[id];
  const inner = m.clips.length ? cloneSkinned(m.scene) : m.scene.clone(true);
  inner.rotation.y = e.rotY || 0;
  const wrap = new THREE.Group(); wrap.add(inner);
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner), size = box.getSize(new THREE.Vector3());
  let s = e.scale || 1;
  if (e.height) s = e.height / (size.y || 1);
  else if ((e.fit || 'footprint') === 'footprint' && fp) s = Math.min((fp[0] * 2) / (size.x || 1), (fp[1] * 2) / (size.z || 1));
  inner.scale.multiplyScalar(s);
  inner.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(inner), c = b2.getCenter(new THREE.Vector3());
  inner.position.x -= c.x; inner.position.z -= c.z; inner.position.y -= b2.min.y - (e.y || 0);
  return wrap;
}

/** An animated model: { object, mixer, play(name) }, or null. */
export function animated(id: string, fp?: [number, number]) {
  const obj = modelFor(id, fp);
  if (!obj) return null;
  const clips = ready.get(id).clips;
  const mixer = new THREE.AnimationMixer(obj);
  let current: THREE.AnimationAction | null = null;
  const play = (name: string, fade = 0.25) => {
    const clip = clips.find(c => c.name.toLowerCase().includes(name.toLowerCase()));
    if (!clip) return false;
    const a = mixer.clipAction(clip);
    if (a === current) return true;
    a.reset().fadeIn(fade).play();
    if (current) current.fadeOut(fade);
    current = a;
    return true;
  };
  return { object: obj, mixer, play, clips: clips.map(c => c.name) };
}

// SkeletonUtils.clone, inlined to keep the main bundle small
function cloneSkinned(source: THREE.Object3D) {
  const map = new Map();
  const clone = source.clone(true);
  const walk = (a: any, b: any) => { map.set(a, b); for (let i = 0; i < a.children.length; i++) walk(a.children[i], b.children[i]); };
  walk(source, clone);
  clone.traverse((n: any) => {
    if (!n.isSkinnedMesh) return;
    const src = [...map.entries()].find(([, v]) => v === n)[0];
    n.skeleton = src.skeleton.clone();
    n.skeleton.bones = src.skeleton.bones.map((b) => map.get(b));
    n.bind(n.skeleton, src.bindMatrix);
  });
  return clone;
}
