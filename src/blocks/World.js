// Pure voxel world data (no rendering imports, so it can run in Node for tests).
import { CHUNK, WORLD_H } from '../core/Constants.js';
import { fbm, hash2 } from '../core/Noise.js';
import { B, BLOCKS, isSolid } from './BlockTypes.js';

const key = (a, b) => a + ',' + b;
const mod = (n, m) => ((n % m) + m) % m;

export class World {
  constructor(seed = 1337) {
    this.seed = seed;
    this.chunks = new Map();      // "cx,cz" -> Uint8Array(CHUNK*WORLD_H*CHUNK)
    this.dirty = new Set();       // chunk keys needing a re-mesh
    this.edits = new Map();       // "x,y,z" -> id, for syncing late joiners
    this.damage = new Map();      // "x,y,z" -> damage taken
  }

  /* ---------- terrain ---------- */
  heightAt(x, z) {
    const n = fbm(x * 0.018, z * 0.018, this.seed, 4);
    const ridge = fbm(x * 0.05 + 40, z * 0.05 - 17, this.seed + 7, 2);
    return Math.max(5, Math.min(WORLD_H - 16, Math.floor(10 + n * 22 + ridge * 5)));
  }

  chunkIndex(lx, y, lz) { return (y * CHUNK + lz) * CHUNK + lx; }

  generateChunk(cx, cz) {
    const data = new Uint8Array(CHUNK * WORLD_H * CHUNK);
    const ox = cx * CHUNK, oz = cz * CHUNK;
    for (let lx = 0; lx < CHUNK; lx++) {
      for (let lz = 0; lz < CHUNK; lz++) {
        const wx = ox + lx, wz = oz + lz;
        const h = this.heightAt(wx, wz);
        const beach = h <= 11;
        for (let y = 0; y <= h; y++) {
          let id;
          if (y === 0) id = B.BEDROCK;
          else if (y < h - 3) id = B.STONE;
          else if (y < h) id = beach ? B.SAND : B.DIRT;
          else id = beach ? B.SAND : B.GRASS;
          data[this.chunkIndex(lx, y, lz)] = id;
        }
        // trees (kept away from chunk borders so they never get cut in half)
        if (!beach && lx > 2 && lx < CHUNK - 3 && lz > 2 && lz < CHUNK - 3 && hash2(wx, wz, this.seed + 99) < 0.012) {
          const th = 4 + Math.floor(hash2(wx, wz, this.seed + 5) * 2);
          for (let t = 1; t <= th; t++) data[this.chunkIndex(lx, h + t, lz)] = B.WOOD;
          for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = th - 1; dy <= th + 1; dy++) {
            if (Math.abs(dx) + Math.abs(dz) + (dy - th + 1) > 4) continue;
            const idx = this.chunkIndex(lx + dx, h + dy + 1, lz + dz);
            if (data[idx] === B.AIR) data[idx] = B.LEAVES;
          }
        }
      }
    }
    this.chunks.set(key(cx, cz), data);
    // re-apply remembered edits (e.g. chunk unloaded then reloaded, or edits received early)
    for (const [k, id] of this.edits) {
      const [x, y, z] = k.split(',').map(Number);
      if (Math.floor(x / CHUNK) === cx && Math.floor(z / CHUNK) === cz) {
        data[this.chunkIndex(mod(x, CHUNK), y, mod(z, CHUNK))] = id;
      }
    }
    return data;
  }

  ensureChunk(cx, cz) {
    return this.chunks.get(key(cx, cz)) || this.generateChunk(cx, cz);
  }
  hasChunk(cx, cz) { return this.chunks.has(key(cx, cz)); }

  /* ---------- block access ---------- */
  getBlock(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 0) return B.BEDROCK;
    if (y >= WORLD_H) return B.AIR;
    const c = this.chunks.get(key(Math.floor(x / CHUNK), Math.floor(z / CHUNK)));
    if (!c) return B.AIR;
    return c[this.chunkIndex(mod(x, CHUNK), y, mod(z, CHUNK))];
  }

  setBlock(x, y, z, id, record = true) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 1 || y >= WORLD_H) return false;
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const c = this.chunks.get(key(cx, cz));
    if (!c) return false;
    const lx = mod(x, CHUNK), lz = mod(z, CHUNK);
    const i = this.chunkIndex(lx, y, lz);
    if (c[i] === id) return false;
    c[i] = id;
    this.damage.delete(x + ',' + y + ',' + z);
    if (record) this.edits.set(x + ',' + y + ',' + z, id);
    this.dirty.add(key(cx, cz));
    if (lx === 0) this.dirty.add(key(cx - 1, cz));
    if (lx === CHUNK - 1) this.dirty.add(key(cx + 1, cz));
    if (lz === 0) this.dirty.add(key(cx, cz - 1));
    if (lz === CHUNK - 1) this.dirty.add(key(cx, cz + 1));
    return true;
  }

  /** Apply damage. Returns 'broken', 'damaged' or null (unbreakable / empty). */
  damageBlock(x, y, z, amount) {
    const id = this.getBlock(x, y, z);
    if (id === B.AIR) return null;
    const hp = BLOCKS[id].hp;
    if (!isFinite(hp)) return null;
    const k = Math.floor(x) + ',' + Math.floor(y) + ',' + Math.floor(z);
    const taken = (this.damage.get(k) || 0) + amount;
    if (taken >= hp) { this.setBlock(x, y, z, B.AIR); return 'broken'; }
    this.damage.set(k, taken);
    return 'damaged';
  }

  /* ---------- queries ---------- */
  /** Is the AABB intersecting any solid block? */
  boxSolid(minx, miny, minz, maxx, maxy, maxz) {
    for (let x = Math.floor(minx); x <= Math.floor(maxx - 1e-6); x++)
      for (let y = Math.floor(miny); y <= Math.floor(maxy - 1e-6); y++)
        for (let z = Math.floor(minz); z <= Math.floor(maxz - 1e-6); z++)
          if (isSolid(this.getBlock(x, y, z))) return true;
    return false;
  }

  /** Voxel DDA ray. Returns { x,y,z, nx,ny,nz, id, dist } or null. */
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len; dy /= len; dz /= len;
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
    const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity;
    const tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
    const tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
    let tx = dx !== 0 ? (sx > 0 ? x + 1 - ox : ox - x) * tdx : Infinity;
    let ty = dy !== 0 ? (sy > 0 ? y + 1 - oy : oy - y) * tdy : Infinity;
    let tz = dz !== 0 ? (sz > 0 ? z + 1 - oz : oz - z) * tdz : Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;
    for (let i = 0; i < 512; i++) {
      const id = this.getBlock(x, y, z);
      if (id !== B.AIR) return { x, y, z, nx, ny, nz, id, dist: t };
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; nx = 0; ny = -sy; nz = 0; }
      else { z += sz; t = tz; tz += tdz; nx = 0; ny = 0; nz = -sz; }
      if (t > maxDist) return null;
      if (y < -1 || y > WORLD_H + 1) return null;
    }
    return null;
  }

  /**
   * After a block at (x,y,z) was removed, find solid groups that lost their anchor to the ground.
   * A group is "grounded" if any block is at/below terrain height + 1, or the group is huge (> limit).
   * Returns an array of groups, each [{x,y,z,id}, ...].
   */
  findFloating(x, y, z, limit = 300) {
    const groups = [];
    const seen = new Set();
    const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    for (const [ax, ay, az] of dirs) {
      const sx = x + ax, sy = y + ay, sz = z + az;
      const sk = sx + ',' + sy + ',' + sz;
      if (seen.has(sk) || !isSolid(this.getBlock(sx, sy, sz)) || this.getBlock(sx, sy, sz) === B.BEDROCK) continue;
      const comp = [];
      const queue = [[sx, sy, sz]];
      const local = new Set([sk]);
      let grounded = false;
      while (queue.length && !grounded) {
        const [cx, cy, cz] = queue.pop();
        comp.push({ x: cx, y: cy, z: cz, id: this.getBlock(cx, cy, cz) });
        if (cy <= this.heightAt(cx, cz) + 1 || comp.length > limit) { grounded = true; break; }
        for (const [bx, by, bz] of dirs) {
          const nx = cx + bx, ny = cy + by, nz = cz + bz;
          const nk = nx + ',' + ny + ',' + nz;
          if (local.has(nk)) continue;
          if (!isSolid(this.getBlock(nx, ny, nz))) continue;
          local.add(nk);
          queue.push([nx, ny, nz]);
        }
      }
      for (const k of local) seen.add(k);
      if (!grounded && comp.length) groups.push(comp);
    }
    return groups;
  }

  /** Find a safe spawn position near (x,z). */
  spawnPoint(x = 0, z = 0) {
    this.ensureChunk(Math.floor(x / CHUNK), Math.floor(z / CHUNK));
    for (let y = WORLD_H - 2; y > 0; y--) {
      if (isSolid(this.getBlock(x, y, z))) return { x: x + 0.5, y: y + 1.01, z: z + 0.5 };
    }
    return { x: x + 0.5, y: this.heightAt(x, z) + 2, z: z + 0.5 };
  }
}
