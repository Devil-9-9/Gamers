import * as THREE from 'three';
import { DAY_LENGTH_SEC } from './Constants.js';

const SKY_DAY = new THREE.Color(0x87c7f2);
const SKY_DUSK = new THREE.Color(0xf09a5a);
const SKY_NIGHT = new THREE.Color(0x070b18);

export class DayNight {
  constructor(scene, renderer, shadowRadius = 40) {
    this.scene = scene;
    this.time = 0.30; // 0..1 (0.25 = sunrise, 0.5 = noon, 0.75 = sunset)
    this.sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.set(1024, 1024);
    s.camera.left = -shadowRadius; s.camera.right = shadowRadius;
    s.camera.top = shadowRadius; s.camera.bottom = -shadowRadius;
    s.camera.near = 1; s.camera.far = 200;
    s.bias = -0.0006; s.normalBias = 0.05;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x445533, 0.7);
    scene.add(this.hemi);
    scene.background = SKY_DAY.clone();
    scene.fog = new THREE.Fog(SKY_DAY.clone(), 40, 120);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // visible sun & moon discs
    const mk = (c, r) => new THREE.Mesh(new THREE.SphereGeometry(r, 12, 12), new THREE.MeshBasicMaterial({ color: c, fog: false }));
    this.sunMesh = mk(0xfff4c0, 6); this.moonMesh = mk(0xdfe8ff, 4);
    scene.add(this.sunMesh, this.moonMesh);
    this.stars = this.makeStars();
    scene.add(this.stars);
  }

  makeStars() {
    const pts = [];
    for (let i = 0; i < 400; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.05, Math.random() - 0.5).normalize().multiplyScalar(300);
      pts.push(v.x, v.y, v.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  }

  get clock() {
    const mins = Math.floor(((this.time * 24 + 6) % 24) * 60); // time 0 -> 06:00
    return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
  }

  setTime(t) { this.time = ((t % 1) + 1) % 1; }

  update(dt, focus) {
    this.time = (this.time + dt / DAY_LENGTH_SEC) % 1;
    const ang = (this.time - 0.25) * Math.PI * 2;      // sun above horizon between 0.25 and 0.75
    const dir = new THREE.Vector3(Math.cos(ang) * 0.8, Math.sin(ang), 0.45).normalize();
    const elev = dir.y;                                 // -1..1
    const day = THREE.MathUtils.smoothstep(elev, -0.05, 0.25);
    const dusk = 1 - Math.min(1, Math.abs(elev) / 0.3);

    // shadow-casting light follows the player, snapped to a texel-ish grid to avoid shimmering
    const snap = (v) => Math.round(v / 2) * 2;
    this.sun.target.position.set(snap(focus.x), 0, snap(focus.z));
    this.sun.position.copy(this.sun.target.position).addScaledVector(dir.y > 0.02 ? dir : dir.clone().multiplyScalar(-1), 100);
    this.sun.intensity = Math.max(0.0, day) * 2.2;
    this.sun.castShadow = elev > 0.02 || elev < -0.12; // moon casts a weak shadow too
    if (elev < 0) { this.sun.color.set(0x6f86c8); this.sun.intensity = Math.max(this.sun.intensity, 0.35); }
    else this.sun.color.set(0xfff2d8).lerp(new THREE.Color(0xff9a50), dusk * 0.7);

    this.hemi.intensity = 0.12 + day * 0.65;

    const sky = SKY_NIGHT.clone().lerp(SKY_DAY, day).lerp(SKY_DUSK, dusk * 0.55 * (day > 0.02 ? 1 : 0.4));
    this.scene.background.copy(sky);
    this.scene.fog.color.copy(sky);
    this.scene.fog.near = 30 + day * 20;
    this.scene.fog.far = 85 + day * 40;

    this.sunMesh.position.copy(focus).addScaledVector(dir, 220);
    this.moonMesh.position.copy(focus).addScaledVector(dir, -220);
    this.stars.position.copy(focus);
    this.stars.material.opacity = 1 - day;
  }
}
