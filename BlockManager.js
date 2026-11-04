import * as THREE from 'three';
import { CHUNK } from '../core/Constants.js';
import { B } from './BlockTypes.js';
import { meshChunk } from './ChunkMesher.js';
import { FallingBlocks } from '../core/Physics.js';

const key = (a, b) => a + ',' + b;

/**
 * Owns the rendered chunk meshes, streams chunks around the player, and is the single place
 * where blocks get hit / broken / placed (so effects, physics and networking all stay in sync).
 */
export class BlockManager {
  constructor({ scene, world, atlasTexture, physics, effects, renderDist = 5 }) {
    this.scene = scene; this.world = world; this.effects = effects;
    this.renderDist = renderDist;
    this.meshes = new Map(); // key -> { opaque, glass }
    this.onEdit = null;      // (x,y,z,id) => network broadcast
    this.onSound = null;     // (name) => void
    this.opaqueMat = new THREE.MeshLambertMaterial({ map: atlasTexture, vertexColors: true, alphaTest: 0.5 });
    this.glassMat = new THREE.MeshLambertMaterial({ map: atlasTexture, vertexColors: true, transparent: true, depthWrite: false });
    this.falling = new FallingBlocks(scene, world, physics, (x, y, z, id) => this.onEdit?.(x, y, z, id));
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  /* ---------- streaming ---------- */
  initialLoad(px, pz, radius = 2) {
    const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
    for (let dx = -radius - 1; dx <= radius + 1; dx++) for (let dz = -radius - 1; dz <= radius + 1; dz++) this.world.ensureChunk(pcx + dx, pcz + dz);
    for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) this.buildMesh(pcx + dx, pcz + dz);
    this.world.dirty.clear();
  }

  update(px, pz, dt) {
    const R = this.renderDist;
    const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);

    // 1) re-mesh dirty chunks first (edits must feel instant)
    let budget = 3;
    for (const k of this.world.dirty) {
      const [cx, cz] = k.split(',').map(Number);
      this.world.dirty.delete(k);
      if (this.world.hasChunk(cx, cz) && Math.abs(cx - pcx) <= R && Math.abs(cz - pcz) <= R) { this.buildMesh(cx, cz); if (--budget <= 0) break; }
    }

    // 2) stream new chunks, nearest first, a couple per frame
    let made = 0;
    const want = [];
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      const cx = pcx + dx, cz = pcz + dz;
      if (!this.meshes.has(key(cx, cz))) want.push([dx * dx + dz * dz, cx, cz]);
    }
    want.sort((a, b) => a[0] - b[0]);
    for (const [, cx, cz] of want) {
      for (let ax = -1; ax <= 1; ax++) for (let az = -1; az <= 1; az++) this.world.ensureChunk(cx + ax, cz + az);
      this.buildMesh(cx, cz);
      if (++made >= 2) break;
    }

    // 3) drop far meshes + their data (edits are remembered and re-applied on regeneration)
    for (const k of [...this.meshes.keys()]) {
      const [cx, cz] = k.split(',').map(Number);
      if (Math.abs(cx - pcx) > R + 2 || Math.abs(cz - pcz) > R + 2) this.disposeMesh(k);
    }
    for (const k of [...this.world.chunks.keys()]) {
      const [cx, cz] = k.split(',').map(Number);
      if (Math.abs(cx - pcx) > R + 4 || Math.abs(cz - pcz) > R + 4) this.world.chunks.delete(k);
    }

    this.falling.update(dt);
  }

  buildMesh(cx, cz) {
    const k = key(cx, cz);
    this.disposeMesh(k);
    const { opaque, glass } = meshChunk(this.world, cx, cz);
    const entry = {};
    if (opaque) {
      entry.opaque = new THREE.Mesh(opaque, this.opaqueMat);
      entry.opaque.castShadow = entry.opaque.receiveShadow = true;
      this.group.add(entry.opaque);
    }
    if (glass) {
      entry.glass = new THREE.Mesh(glass, this.glassMat);
      entry.glass.renderOrder = 2;
      this.group.add(entry.glass);
    }
    this.meshes.set(k, entry);
  }

  disposeMesh(k) {
    const e = this.meshes.get(k);
    if (!e) return;
    for (const m of [e.opaque, e.glass]) if (m) { this.group.remove(m); m.geometry.dispose(); }
    this.meshes.delete(k);
  }

  /* ---------- editing ---------- */
  /** Damage a block (punch = 1, bullet = weapon blockDamage). Returns 'broken' | 'damaged' | null. */
  hit(x, y, z, damage, { remote = false } = {}) {
    const id = this.world.getBlock(x, y, z);
    const res = this.world.damageBlock(x, y, z, damage);
    if (res === 'broken') {
      this.effects.blockDebris(x, y, z, id, 12, 3.2);
      if (!remote) this.onEdit?.(x, y, z, B.AIR);
      this.detachFloating(x, y, z);
      this.onSound?.('break');
    } else if (res === 'damaged') {
      this.effects.blockDebris(x, y, z, id, 3, 2);
    }
    return res;
  }

  detachFloating(x, y, z) {
    const groups = this.world.findFloating(x, y, z);
    for (const g of groups) {
      for (const b of g) this.world.setBlock(b.x, b.y, b.z, B.AIR);
      this.falling.spawn(g);
    }
    if (groups.length) this.onSound?.('collapse');
  }

  place(x, y, z, id, { remote = false } = {}) {
    if (this.world.getBlock(x, y, z) !== B.AIR) return false;
    const ok = this.world.setBlock(x, y, z, id);
    if (ok) { if (!remote) this.onEdit?.(x, y, z, id); this.onSound?.('place'); }
    return ok;
  }

  /** Edit coming from a peer. */
  applyRemote(x, y, z, id) {
    if (id === B.AIR) {
      const old = this.world.getBlock(x, y, z);
      if (old === B.AIR) return;
      this.effects.blockDebris(x, y, z, old, 8, 3);
      this.world.setBlock(x, y, z, B.AIR);
      this.detachFloating(x, y, z);
    } else {
      this.world.setBlock(x, y, z, id);
    }
  }
}
