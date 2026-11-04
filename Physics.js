// cannon-es drives unsupported ("floating") blocks: g = 9.81 m/s^2, F = m*a, mass 1 kg per block.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GRAVITY } from './Constants.js';
import { B, BLOCKS, isSolid } from '../blocks/BlockTypes.js';
import { BLOCK_COLORS } from '../blocks/TextureAtlas.js';

export class PhysicsWorld {
  constructor() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -GRAVITY, 0) });
    this.world.allowSleep = false;
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.solver.iterations = 6;
    this.material = new CANNON.Material('block');
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.material, this.material, { friction: 0.3, restitution: 0.05 }));
  }
  step(dt) { this.world.step(1 / 60, Math.min(dt, 0.05), 3); }
}

/**
 * Falling block groups. Bodies are simulated by cannon-es; the voxel terrain is the "ground":
 * when a body's underside enters a solid voxel it settles back into the grid as a normal block.
 */
export class FallingBlocks {
  constructor(scene, world, physics, onSettle) {
    this.scene = scene; this.world = world; this.physics = physics; this.onSettle = onSettle;
    this.items = [];
    this.geo = new THREE.BoxGeometry(1, 1, 1);
    this.mats = new Map();
  }

  mat(id) {
    if (!this.mats.has(id)) this.mats.set(id, new THREE.MeshLambertMaterial({ color: BLOCK_COLORS[id] ?? 0x999999, transparent: id === B.GLASS, opacity: id === B.GLASS ? 0.5 : 1 }));
    return this.mats.get(id);
  }

  /** blocks: [{x,y,z,id}] already removed from the world. */
  spawn(blocks) {
    for (const b of blocks) {
      const body = new CANNON.Body({ mass: 1, material: this.physics.material, shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)), linearDamping: 0.05 });
      body.position.set(b.x + 0.5, b.y + 0.5, b.z + 0.5);
      body.fixedRotation = true;
      body.updateMassProperties();
      body.velocity.set((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8);
      this.physics.world.addBody(body);
      const mesh = new THREE.Mesh(this.geo, this.mat(b.id));
      mesh.castShadow = true;
      mesh.position.copy(body.position);
      this.scene.add(mesh);
      this.items.push({ body, mesh, id: b.id, age: 0 });
    }
  }

  update(dt) {
    if (!this.items.length) return;
    this.physics.step(dt);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      const p = it.body.position;
      it.mesh.position.set(p.x, p.y, p.z);
      const below = isSolid(this.world.getBlock(Math.floor(p.x), Math.floor(p.y - 0.5 - 0.04), Math.floor(p.z)));
      if ((below && it.body.velocity.y <= 0.2) || it.age > 8 || p.y < 1) {
        this.settle(it, i);
      }
    }
  }

  settle(it, index) {
    const p = it.body.position;
    const x = Math.floor(p.x), z = Math.floor(p.z);
    let y = Math.max(1, Math.floor(p.y - 0.5 + 0.5));
    while (isSolid(this.world.getBlock(x, y, z)) && y < 47) y++;
    this.world.setBlock(x, y, z, it.id);
    this.onSettle?.(x, y, z, it.id);
    this.physics.world.removeBody(it.body);
    this.scene.remove(it.mesh);
    this.items.splice(index, 1);
  }
}

export { BLOCKS };
