import * as THREE from 'three';

export const HUG = new Set(['bed', 'sofa', 'shelf', 'closet', 'shoerack', 'showcase', 'table']);
export const SEATS = { bed: 0.95, sofa: 1.0, chair: 1.1, cushion: 0.75, dine: 1.05, table: 1.1 };
export const ROT_FRONT = (r) => new THREE.Vector3(Math.sin(r * Math.PI / 2), 0, Math.cos(r * Math.PI / 2));
export const SIDE_FRONT_ROT = { s: 0, e: 1, n: 2, w: 3 }; // rotation index whose front faces that wall
