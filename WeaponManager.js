import { AK47 } from './AK47.js';
import { Sniper } from './Sniper.js';
import { Pistol } from './Pistol.js';
import { Shotgun } from './Shotgun.js';
import { resolveShot, falloff } from './Ballistics.js';

/**
 * Player-owned weapons: ammo, reload, recoil, ADS, spread and shot resolution.
 * `game` provides: world, blocks, effects, audio, hud, getTargets(), net, camera.
 */
export class WeaponManager {
  constructor(game) {
    this.game = game;
    this.weapons = [new AK47(), new Sniper(), new Pistol(), new Shotgun()];
    this.cur = 0;
    this.recoilAccum = 0;
    this.wasFire = false;
    this.swapT = 0;
    this.onChange = null;
  }

  get weapon() { return this.weapons[this.cur]; }

  select(i) {
    if (i === this.cur || i < 0 || i >= this.weapons.length) return;
    this.weapon.cancelReload();
    this.cur = i;
    this.swapT = 0.35;
    this.recoilAccum = 0;
    this.onChange?.(this.weapon);
  }

  next() { this.select((this.cur + 1) % this.weapons.length); }

  refillAll() { for (const w of this.weapons) w.refill(); }

  /** Called every frame while in COMBAT mode (or always, to tick cooldowns). */
  update(dt, input, player, combatMode) {
    const w = this.weapon;
    for (const x of this.weapons) x.tick(dt);
    if (this.swapT > 0) this.swapT -= dt;

    // recoil recovery: pull the view back down toward where it started
    if (this.recoilAccum > 0) {
      const rec = Math.min(this.recoilAccum, this.recoilAccum * w.recoilRecover * dt + 0.0004);
      player.pitch -= rec; this.recoilAccum -= rec;
    }

    player.ads = combatMode && player.alive && input.aim && !w.reloading && this.swapT <= 0;
    player.speedMult = w.moveMult;
    player.lookMult = player.ads ? (w.scope ? 0.25 : 0.6) : 1;

    if (!combatMode || !player.alive) { this.wasFire = input.fire; return; }

    if (input.consume('reload') && w.startReload()) this.game.audio.play('reload');

    const trigger = input.fire && (w.auto || !this.wasFire);
    this.wasFire = input.fire;
    if (!trigger || this.swapT > 0 || w.reloading) return;
    if (w.ammo <= 0) {
      if (!this.wasEmptyClick) this.game.audio.play('empty');
      this.wasEmptyClick = true;
      if (w.startReload()) this.game.audio.play('reload');
      return;
    }
    this.wasEmptyClick = false;
    if (!w.canFire()) return;
    this.fire(player, w);
  }

  fire(player, w) {
    const g = this.game;
    w.consumeShot();
    g.audio.play(w.sound);
    g.viewModel.kickShot(w.pellets > 1 ? 1.2 : 0.7);

    // spread: tighter when aiming / crouched, wider when moving or airborne
    const b = player.body;
    const moving = Math.hypot(b.vx, b.vz) > 1.5;
    let spread = w.spread * (player.ads ? w.adsSpreadMult : 1) * (moving ? 1.5 : 1) * (player.crouching ? 0.7 : 1) * (b.onGround ? 1 : 2.2);

    const o = player.eyePos;
    const f = player.forward(), r = player.right();
    const up = { x: -Math.sin(player.pitch) * Math.sin(player.yaw), y: Math.cos(player.pitch), z: -Math.sin(player.pitch) * Math.cos(player.yaw) };
    const muzzle = { x: o.x + f.x * 0.7 + r.x * 0.18, y: o.y + f.y * 0.7 - 0.12, z: o.z + f.z * 0.7 + r.z * 0.18 };
    g.effects.muzzle(g.v3(muzzle));

    const targets = g.getTargets();
    let hitAny = false, killed = false;
    for (let p = 0; p < w.pellets; p++) {
      const sx = (Math.random() - 0.5) * 2 * spread, sy = (Math.random() - 0.5) * 2 * spread;
      let d = { x: f.x + r.x * sx + up.x * sy, y: f.y + up.y * sy, z: f.z + r.z * sx + up.z * sy + 0 };
      const len = Math.hypot(d.x, d.y, d.z); d = { x: d.x / len, y: d.y / len, z: d.z / len };
      const res = resolveShot(g.world, o, d, w.range, targets, player);
      g.effects.tracer(g.v3(muzzle), g.v3(res.point));
      g.net?.sendShot(muzzle, res.point, this.cur);

      if (res.kind === 'entity') {
        const dmg = w.damage * falloff(res.t, w.range) * (res.headshot ? w.headMult : 1);
        const dead = res.target.takeDamage(dmg, player, res.headshot);
        hitAny = true; killed = killed || !!dead;
        g.effects.blockDebris(res.point.x - 0.5, res.point.y - 0.5, res.point.z - 0.5, 7, 2, 2.2); // blood-ish sparks
      } else if (res.kind === 'block') {
        const bl = res.block;
        g.blocks.hit(bl.x, bl.y, bl.z, w.blockDamage);
        g.effects.impact(res.point.x, res.point.y, res.point.z, bl.id);
      }
    }
    if (hitAny) g.hud.hitmarker(killed);
    if (hitAny) g.audio.play(killed ? 'kill' : 'hit');

    // recoil: pitch kicks up (recovers later), yaw wobbles
    const kick = w.recoilPitch * (player.ads ? 0.7 : 1) * (0.85 + Math.random() * 0.3);
    player.pitch = Math.min(1.5, player.pitch + kick);
    this.recoilAccum += kick * 0.85;
    player.yaw += (Math.random() - 0.5) * 2 * w.recoilYaw;
  }
}
