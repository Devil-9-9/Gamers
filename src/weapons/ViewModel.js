import * as THREE from 'three';

/** First-person gun made of boxes, parented to the camera. Handles ADS slide, recoil kick, reload dip, walk bob. */
export class ViewModel {
  constructor(camera) {
    this.camera = camera;
    this.root = new THREE.Group();
    camera.add(this.root);
    this.gun = new THREE.Group();
    this.root.add(this.gun);
    this.kick = 0; this.ads = 0; this.bob = 0; this.reload = 0;
    this.mat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    this.dark = new THREE.MeshLambertMaterial({ color: 0x151515 });
    this.hand = new THREE.MeshLambertMaterial({ color: 0xe0b48a });
    this.parts = [];
  }

  setWeapon(w) {
    for (const p of this.parts) { this.gun.remove(p); p.geometry.dispose(); }
    this.parts = [];
    const add = (sx, sy, sz, x, y, z, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
      m.position.set(x, y, z); this.gun.add(m); this.parts.push(m); return m;
    };
    const body = new THREE.MeshLambertMaterial({ color: w.color });
    const L = w.length;
    add(0.07, 0.1, L, 0, 0, -L / 2, body);                 // receiver / barrel
    add(0.04, 0.04, L * 0.45, 0, 0.02, -L - L * 0.2, this.dark); // barrel extension
    add(0.06, 0.16, 0.08, 0, -0.12, -L * 0.15, this.dark); // grip
    if (w.scope) add(0.05, 0.05, 0.28, 0, 0.09, -L * 0.45, this.dark);
    else add(0.015, 0.03, 0.015, 0, 0.065, -L * 0.9, this.dark); // front sight
    if (w.mag > 6) add(0.05, 0.2, 0.08, 0, -0.14, -L * 0.5, this.dark); // magazine
    add(0.07, 0.07, 0.14, 0.02, -0.04, 0.02, this.hand);   // hand
    this.root.visible = true;
  }

  kickShot(amount = 1) { this.kick = Math.min(1.5, this.kick + amount); }

  update(dt, { ads, reloading, moving, sprinting, visible }) {
    this.root.visible = visible;
    this.ads += ((ads ? 1 : 0) - this.ads) * Math.min(1, dt * 14);
    this.reload += ((reloading ? 1 : 0) - this.reload) * Math.min(1, dt * 8);
    this.kick *= Math.max(0, 1 - dt * 16);
    this.bob += dt * (sprinting ? 12 : 8) * (moving ? 1 : 0.2);
    const bobAmt = moving ? (sprinting ? 0.02 : 0.01) * (1 - this.ads) : 0.002;
    const hip = { x: 0.24, y: -0.22, z: -0.45 };
    const adsP = { x: 0.0, y: -0.115, z: -0.35 };
    const lerp = (a, b) => a + (b - a) * this.ads;
    this.root.position.set(
      lerp(hip.x, adsP.x) + Math.sin(this.bob) * bobAmt,
      lerp(hip.y, adsP.y) + Math.abs(Math.cos(this.bob)) * bobAmt - this.reload * 0.18,
      lerp(hip.z, adsP.z) + this.kick * 0.07,
    );
    this.root.rotation.set(this.kick * 0.08 + this.reload * 0.6 + (sprinting ? 0.35 : 0), sprinting ? 0.4 : 0, this.reload * -0.3);
  }
}
