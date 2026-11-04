import * as THREE from 'three';
import { REACH } from '../core/Constants.js';
import { HOTBAR } from './BlockTypes.js';

/** Minecraft side: aim highlight, punch/break, place against the targeted face, hotbar. */
export class BuildTool {
  constructor(game) {
    this.game = game;
    this.slot = 0;
    this.breakCd = 0;
    this.target = null;
    this.onChange = null;
    const geo = new THREE.BoxGeometry(1.004, 1.004, 1.004);
    this.outline = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
    this.outline.visible = false;
    game.scene.add(this.outline);
  }

  get blockId() { return HOTBAR[this.slot]; }

  select(i) { this.slot = ((i % HOTBAR.length) + HOTBAR.length) % HOTBAR.length; this.onChange?.(this.slot); }

  update(dt, input, player, combatMode) {
    const g = this.game;
    this.breakCd -= dt;
    if (!player.alive) { this.outline.visible = false; return; }

    if (input.consume('nextBlock')) this.select(this.slot + 1);
    if (input.consume('prevBlock')) this.select(this.slot - 1);
    for (let i = 0; i < HOTBAR.length; i++) if (input.consume('slot' + i)) this.select(i);

    const o = player.eyePos, f = player.forward();
    this.target = g.world.raycast(o.x, o.y, o.z, f.x, f.y, f.z, REACH);
    const t = this.target;
    this.outline.visible = !!t;
    if (t) this.outline.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);

    // break: X key / BREAK press anywhere; held fire while in BUILD mode
    const wantBreak = input.consume('breakBlock') || (!combatMode && input.fire);
    if (wantBreak && t && this.breakCd <= 0) {
      g.blocks.hit(t.x, t.y, t.z, 1);
      g.viewModel.kickShot(0.5);
      this.breakCd = 0.18;
    }

    // place on the face we're looking at (works in either mode so you can build mid-fight)
    if (input.consume('place') && t) {
      const px = t.x + t.nx, py = t.y + t.ny, pz = t.z + t.nz;
      const b = player.body, r = b.radius;
      const overlapsMe = px + 1 > b.x - r && px < b.x + r && pz + 1 > b.z - r && pz < b.z + r && py + 1 > b.y && py < b.y + b.height;
      if (!overlapsMe) g.blocks.place(px, py, pz, this.blockId);
    }
  }
}
