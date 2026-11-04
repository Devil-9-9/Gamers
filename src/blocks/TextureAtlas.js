import * as THREE from 'three';
import { T, BLOCKS } from './BlockTypes.js';
import { hash2 } from '../core/Noise.js';

export const TILE = 16;
export const GRID = 4;

function rand(tile, x, y) { return hash2(x + tile * 31, y - tile * 17, 777); }
const clamp = (v) => Math.max(0, Math.min(255, v));

function fill(ctx, tile, base, jitter = 18, fn) {
  const img = ctx.createImageData(TILE, TILE);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    let [r, g, b, a] = base;
    const j = (rand(tile, x, y) - 0.5) * jitter * 2;
    r = clamp(r + j); g = clamp(g + j); b = clamp(b + j); a = a ?? 255;
    if (fn) { const o = fn(x, y, [r, g, b, a]); if (o) [r, g, b, a] = o; }
    const i = (y * TILE + x) * 4;
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = a;
  }
  return img;
}

const GENERATORS = {
  [T.GRASS_TOP]: (c) => fill(c, T.GRASS_TOP, [96, 170, 70, 255], 16),
  [T.GRASS_SIDE]: (c) => fill(c, T.GRASS_SIDE, [134, 96, 62, 255], 14, (x, y, p) => (y < 3 + (rand(T.GRASS_SIDE, x, 0) > 0.5 ? 1 : 0) ? [90, 160, 64, 255] : p)),
  [T.DIRT]: (c) => fill(c, T.DIRT, [134, 96, 62, 255], 14),
  [T.STONE]: (c) => fill(c, T.STONE, [125, 128, 132, 255], 16, (x, y, p) => (rand(T.STONE, x * 3, y * 3) > 0.93 ? [95, 98, 102, 255] : p)),
  [T.SAND]: (c) => fill(c, T.SAND, [222, 207, 150, 255], 10),
  [T.WOOD_SIDE]: (c) => fill(c, T.WOOD_SIDE, [104, 78, 46, 255], 8, (x, y, p) => (x % 4 === 0 ? [p[0] - 18, p[1] - 14, p[2] - 10, 255] : p)),
  [T.WOOD_TOP]: (c) => fill(c, T.WOOD_TOP, [168, 135, 82, 255], 8, (x, y, p) => {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    return Math.floor(d) % 3 === 0 ? [p[0] - 30, p[1] - 26, p[2] - 20, 255] : p;
  }),
  [T.LEAVES]: (c) => fill(c, T.LEAVES, [58, 132, 48, 255], 20, (x, y, p) => (rand(T.LEAVES, x * 5, y * 5) > 0.82 ? [0, 0, 0, 0] : p)),
  [T.BRICK]: (c) => fill(c, T.BRICK, [160, 70, 56, 255], 10, (x, y, p) => {
    const row = Math.floor(y / 4);
    const off = row % 2 ? 4 : 0;
    return (y % 4 === 3 || (x + off) % 8 === 7) ? [190, 182, 170, 255] : p;
  }),
  [T.GLASS]: (c) => fill(c, T.GLASS, [190, 225, 240, 70], 0, (x, y, p) => ((x === 0 || y === 0 || x === 15 || y === 15) ? [220, 240, 250, 190] : (x === y || x === y + 1) && x < 6 ? [255, 255, 255, 140] : p)),
  [T.PLANKS]: (c) => fill(c, T.PLANKS, [176, 140, 86, 255], 9, (x, y, p) => (y % 4 === 3 ? [p[0] - 38, p[1] - 32, p[2] - 24, 255] : p)),
  [T.BEDROCK]: (c) => fill(c, T.BEDROCK, [50, 50, 54, 255], 26),
  [T.METAL]: (c) => fill(c, T.METAL, [150, 156, 166, 255], 6, (x, y, p) => {
    const edge = x === 0 || y === 0 || x === 15 || y === 15;
    const rivet = (x === 2 || x === 13) && (y === 2 || y === 13);
    return edge ? [105, 110, 120, 255] : rivet ? [215, 220, 228, 255] : p;
  }),
};

export function buildAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TILE * GRID;
  const ctx = canvas.getContext('2d');
  for (const [tile, gen] of Object.entries(GENERATORS)) {
    const t = Number(tile);
    ctx.putImageData(gen(ctx), (t % GRID) * TILE, Math.floor(t / GRID) * TILE);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  return { canvas, texture };
}

/** UV rectangle [u0, v0, u1, v1] for a tile index (v up, matching three.js). */
export function tileUV(t) {
  const col = t % GRID, row = Math.floor(t / GRID);
  const e = 0.0015;
  return [col / GRID + e, 1 - (row + 1) / GRID + e, (col + 1) / GRID - e, 1 - row / GRID - e];
}

/** Draw a block's side texture into a small canvas (hotbar icon). */
export function drawBlockIcon(target, atlasCanvas, blockId) {
  const t = BLOCKS[blockId].side;
  target.width = target.height = TILE;
  const ctx = target.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlasCanvas, (t % GRID) * TILE, Math.floor(t / GRID) * TILE, TILE, TILE, 0, 0, TILE, TILE);
}

export const BLOCK_COLORS = {
  1: 0x60aa46, 2: 0x86603e, 3: 0x7d8084, 4: 0xdecf96, 5: 0x684e2e, 6: 0x3a8430,
  7: 0xa04638, 8: 0xbfe1f0, 9: 0xb08c56, 10: 0x323236, 11: 0x969ca6,
};
