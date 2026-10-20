import * as THREE from 'three';

// A tapered tube whose spine is rebuilt every frame (tentacles). Rings are
// oriented with parallel-transported frames so the surface doesn't twist.
export class TaperTube {
  [key: string]: any;
  constructor(rings, radial, radiusAt, material) {
    this.rings = rings; this.radial = radial; this.radiusAt = radiusAt;
    const pos = new Float32Array(rings * radial * 3);
    const uv = new Float32Array(rings * radial * 2);
    const idx = [];
    for (let i = 0; i < rings; i++) for (let j = 0; j < radial; j++) {
      uv[(i * radial + j) * 2] = j / (radial - 1); uv[(i * radial + j) * 2 + 1] = i / (rings - 1);
      if (i < rings - 1 && j < radial - 1) {
        const a = i * radial + j, b = a + radial;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.geometry = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this._t = new THREE.Vector3(); this._n = new THREE.Vector3(); this._b = new THREE.Vector3(); this._p = new THREE.Vector3();
  }

  /** points: array of Vector3 (length === rings) */
  update(points) {
    const pos = this.geometry.attributes.position.array;
    const { rings, radial } = this;
    const t = this._t, n = this._n, b = this._b;
    n.set(0, 1, 0);
    for (let i = 0; i < rings; i++) {
      const p = points[i];
      const a = points[Math.max(0, i - 1)], c = points[Math.min(rings - 1, i + 1)];
      t.subVectors(c, a).normalize();
      // parallel transport: remove the tangent component from the previous normal
      n.addScaledVector(t, -n.dot(t));
      if (n.lengthSq() < 1e-6) n.set(1, 0, 0).addScaledVector(t, -t.x);
      n.normalize();
      b.crossVectors(t, n);
      const r = this.radiusAt(i / (rings - 1));
      for (let j = 0; j < radial; j++) {
        const ang = (j / (radial - 1)) * Math.PI * 2;
        const cs = Math.cos(ang) * r, sn = Math.sin(ang) * r;
        const o = (i * radial + j) * 3;
        pos[o] = p.x + n.x * cs + b.x * sn;
        pos[o + 1] = p.y + n.y * cs + b.y * sn;
        pos[o + 2] = p.z + n.z * cs + b.z * sn;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }
}
