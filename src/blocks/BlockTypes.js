// Block registry. `tiles` are indices into the procedural texture atlas (see TextureAtlas.js).
export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WOOD: 5, LEAVES: 6,
  BRICK: 7, GLASS: 8, PLANKS: 9, BEDROCK: 10, METAL: 11,
};

export const T = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, SAND: 4, WOOD_SIDE: 5, WOOD_TOP: 6,
  LEAVES: 7, BRICK: 8, GLASS: 9, PLANKS: 10, BEDROCK: 11, METAL: 12,
};

// hp: damage needed to break (punch = 1, bullet = weapon.blockDamage)
export const BLOCKS = {
  [B.GRASS]:   { name: 'Grass',   top: T.GRASS_TOP, side: T.GRASS_SIDE, bottom: T.DIRT, hp: 2 },
  [B.DIRT]:    { name: 'Dirt',    top: T.DIRT, side: T.DIRT, bottom: T.DIRT, hp: 2 },
  [B.STONE]:   { name: 'Stone',   top: T.STONE, side: T.STONE, bottom: T.STONE, hp: 6 },
  [B.SAND]:    { name: 'Sand',    top: T.SAND, side: T.SAND, bottom: T.SAND, hp: 1 },
  [B.WOOD]:    { name: 'Log',     top: T.WOOD_TOP, side: T.WOOD_SIDE, bottom: T.WOOD_TOP, hp: 4 },
  [B.LEAVES]:  { name: 'Leaves',  top: T.LEAVES, side: T.LEAVES, bottom: T.LEAVES, hp: 1, cutout: true },
  [B.BRICK]:   { name: 'Brick',   top: T.BRICK, side: T.BRICK, bottom: T.BRICK, hp: 8 },
  [B.GLASS]:   { name: 'Glass',   top: T.GLASS, side: T.GLASS, bottom: T.GLASS, hp: 1, glass: true },
  [B.PLANKS]:  { name: 'Planks',  top: T.PLANKS, side: T.PLANKS, bottom: T.PLANKS, hp: 3 },
  [B.BEDROCK]: { name: 'Bedrock', top: T.BEDROCK, side: T.BEDROCK, bottom: T.BEDROCK, hp: Infinity },
  [B.METAL]:   { name: 'Metal',   top: T.METAL, side: T.METAL, bottom: T.METAL, hp: 14 },
};

// Hotbar order for BUILD mode
export const HOTBAR = [B.PLANKS, B.BRICK, B.STONE, B.METAL, B.WOOD, B.GLASS, B.DIRT, B.SAND];

export const isSolid = (id) => id !== B.AIR;
export const isOpaque = (id) => id !== B.AIR && !BLOCKS[id]?.glass && !BLOCKS[id]?.cutout;
