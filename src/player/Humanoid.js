import * as THREE from 'three';

const geo = {
  head: new THREE.BoxGeometry(0.5, 0.5, 0.5),
  torso: new THREE.BoxGeometry(0.55, 0.7, 0.3),
  limb: new THREE.BoxGeometry(0.22, 0.7, 0.22),
  gun: new THREE.BoxGeometry(0.08, 0.1, 0.6),
};
const skin = new THREE.MeshLambertMaterial({ color: 0xe0b48a });

/** Blocky soldier built from boxes. Origin is at the feet. */
export function makeHumanoid(color = 0x3a6ea5) {
  const body = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.55) });
  const g = new THREE.Group();
  const mesh = (geom, mat, x, y, z) => { const m = new THREE.Mesh(geom, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };

  const head = mesh(geo.head, skin, 0, 1.55, 0);
  mesh(geo.torso, body, 0, 1.0, 0);
  // limbs pivot at the top: put them in sub-groups
  const mkLimb = (mat, x, y) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
    const m = new THREE.Mesh(geo.limb, mat); m.position.y = -0.35; m.castShadow = true; pivot.add(m); g.add(pivot); return pivot;
  };
  const armL = mkLimb(body, -0.38, 1.3);
  const armR = mkLimb(body, 0.38, 1.3);
  const legL = mkLimb(dark, -0.14, 0.7);
  const legR = mkLimb(dark, 0.14, 0.7);
  const gun = new THREE.Mesh(geo.gun, new THREE.MeshLambertMaterial({ color: 0x222222 }));
  gun.position.set(0.3, 1.0, 0.35);
  g.add(gun);

  g.userData = { head, armL, armR, legL, legR, phase: 0 };
  return g;
}

/** Swing limbs based on horizontal speed. */
export function animateHumanoid(g, dt, speed) {
  const u = g.userData;
  u.phase += dt * Math.min(speed, 7) * 1.8;
  const s = Math.sin(u.phase) * Math.min(1, speed / 3) * 0.8;
  u.legL.rotation.x = s; u.legR.rotation.x = -s;
  u.armL.rotation.x = -s * 0.6; u.armR.rotation.x = -1.3; // right arm holds the gun forward
}
