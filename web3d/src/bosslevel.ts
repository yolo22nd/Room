import * as THREE from 'three';
import { ring } from './textures';
import { CATALOG } from './models';
import * as ui from './ui';
import { sfx } from './audio';

// Shared pieces of the boss fights: telegraph markers, furniture ammo and
// the Witch's Cloak shield.
export class BossLevel {
  [key: string]: any;

  /** A ground ring at p (used for aim, attack and landing telegraphs). */
  marker(p, size, color, opacity = 0.85) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size * 2, size * 2), new THREE.MeshBasicMaterial({ map: ring(), color, transparent: true, depthWrite: false, opacity }));
    m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.05, p.z); this.scene.add(m);
    return m;
  }

  /** Furniture the player conjured in the room becomes their ammunition. */
  ammoTypes(): string[] {
    const types = Object.values<any>(this.state.placed).map(p => p.type).filter(t => CATALOG[t] && CATALOG[t].kind === 'floor');
    return types.length ? [...new Set(types)] : ['cushion'];
  }

  /** Returns true if the cloak absorbed the hit. */
  absorbWithCloak() {
    if (!(this.shield > 0)) return false;
    this.shield--; sfx.close(); ui.flash('#b58cff', 0.4, 400);
    ui.log('Your cloak flares and absorbs the blow!', 'good');
    this.refreshHUD();
    return true;
  }
}
