import * as THREE from 'three';

// The visual look per area: image-based lighting from small CC0 HDRIs
// (Poly Haven, via @pmndrs/assets), loaded lazily and prefiltered once.
const HDRI: Record<string, () => Promise<any>> = {
  apartment: () => import('@pmndrs/assets/hdri/apartment.exr.js'),
  sunset: () => import('@pmndrs/assets/hdri/sunset.exr.js'),
  night: () => import('@pmndrs/assets/hdri/night.exr.js'),
  lobby: () => import('@pmndrs/assets/hdri/lobby.exr.js'),
  studio: () => import('@pmndrs/assets/hdri/studio.exr.js'),
  workshop: () => import('@pmndrs/assets/hdri/workshop.exr.js'),
  warehouse: () => import('@pmndrs/assets/hdri/warehouse.exr.js'),
};

/** Which environment and how strongly it lights each area. */
export const LOOKS: Record<string, { env: string; intensity: number }> = {
  room: { env: 'apartment', intensity: 0.22 },
  hell: { env: 'sunset', intensity: 0.35 },
  witch: { env: 'night', intensity: 0.55 },
  upside: { env: 'studio', intensity: 0.25 },
  library: { env: 'lobby', intensity: 0.3 },
  clockwork: { env: 'workshop', intensity: 0.35 },
  rogue: { env: 'apartment', intensity: 0.2 },
  coop: { env: 'apartment', intensity: 0.2 },
  landlord: { env: 'warehouse', intensity: 0.2 },
};

const cache = new Map<string, Promise<THREE.Texture>>();
let pmrem: THREE.PMREMGenerator | null = null;

export function envMap(renderer: THREE.WebGLRenderer, name: string): Promise<THREE.Texture> {
  if (!HDRI[name]) return Promise.reject(new Error('no hdri ' + name));
  if (!cache.has(name)) {
    cache.set(name, HDRI[name]().then(async (m) => {
      const { EXRLoader } = await import('three/examples/jsm/loaders/EXRLoader.js');
      const tex = await new EXRLoader().loadAsync(m.default);
      if (!pmrem) { pmrem = new THREE.PMREMGenerator(renderer); pmrem.compileEquirectangularShader(); }
      const rt = pmrem.fromEquirectangular(tex);
      tex.dispose();
      rt.texture.userData.shared = true;   // never disposed by level cleanup
      return rt.texture;
    }));
  }
  return cache.get(name);
}

/** Light a level's scene with its area's environment (async; harmless if it fails). */
export function applyLook(renderer, scene: THREE.Scene, area: string) {
  const look = LOOKS[area];
  if (!look) return;
  (scene as any).environmentIntensity = look.intensity;
  envMap(renderer, look.env).then(t => { scene.environment = t; }).catch(() => { /* offline or blocked: plain lights still work */ });
}
