import {
  MAX_HP, PLAYER_HEIGHT, PLAYER_EYE, PLAYER_CROUCH_HEIGHT, PLAYER_CROUCH_EYE, PLAYER_RADIUS,
  WALK_SPEED, SPRINT_SPEED, CROUCH_SPEED, JUMP_SPEED,
} from '../core/Constants.js';
import { VoxelBody } from './VoxelBody.js';

const LOOK_SENS = 0.0022;

export class Player {
  constructor(world, spawn) {
    this.world = world;
    this.body = new VoxelBody(world, spawn.x, spawn.y, spawn.z, PLAYER_RADIUS, PLAYER_HEIGHT);
    this.yaw = 0; this.pitch = 0;
    this.hp = MAX_HP; this.alive = true; this.respawnT = 0;
    this.kills = 0; this.deaths = 0;
    this.crouching = false; this.sprinting = false; this.ads = false;
    this.eye = PLAYER_EYE;
    this.speedMult = 1; this.lookMult = 1;
    this.stepT = 0;
    this.onHurt = null; this.onDeath = null; this.onRespawn = null; this.onSound = null;
    this.spawnFn = () => spawn;
    this.id = 'me';
  }

  /* target interface used by Ballistics */
  get pos() { return this.body; }
  get radius() { return PLAYER_RADIUS; }
  get height() { return this.body.height; }
  get eyePos() { return { x: this.body.x, y: this.body.y + this.eye, z: this.body.z }; }

  forward() {
    const cp = Math.cos(this.pitch);
    return { x: -Math.sin(this.yaw) * cp, y: Math.sin(this.pitch), z: -Math.cos(this.yaw) * cp };
  }
  right() { return { x: Math.cos(this.yaw), y: 0, z: -Math.sin(this.yaw) }; }

  takeDamage(amount, attacker = null, headshot = false) {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.onHurt?.(amount, attacker, headshot);
    if (this.hp <= 0) {
      this.alive = false; this.deaths++; this.respawnT = 3;
      this.onDeath?.(attacker, headshot);
      return true;
    }
    return false;
  }

  respawn() {
    const s = this.spawnFn();
    Object.assign(this.body, { x: s.x, y: s.y, z: s.z, vx: 0, vy: 0, vz: 0 });
    this.hp = MAX_HP; this.alive = true; this.crouching = false;
    this.onRespawn?.();
  }

  update(dt, input) {
    if (!this.alive) {
      this.respawnT -= dt;
      this.body.vx = this.body.vz = 0;
      this.body.step(dt);
      if (this.respawnT <= 0) this.respawn();
      return;
    }
    const b = this.body;

    // look (scaled down when aiming so scopes stay controllable)
    const [dx, dy] = input.consumeLook();
    const s = LOOK_SENS * this.lookMult;
    this.yaw -= dx * s;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - dy * s));

    // stance
    const wantCrouch = input.crouch;
    if (wantCrouch && !this.crouching) { this.crouching = true; b.height = PLAYER_CROUCH_HEIGHT; }
    else if (!wantCrouch && this.crouching && b.canStand(PLAYER_HEIGHT)) { this.crouching = false; b.height = PLAYER_HEIGHT; }
    const eyeTarget = this.crouching ? PLAYER_CROUCH_EYE : PLAYER_EYE;
    this.eye += (eyeTarget - this.eye) * Math.min(1, dt * 14);

    // movement
    const fwd = { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
    const rgt = { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
    let mx = input.moveX, mz = input.moveZ;
    const mag = Math.hypot(mx, mz);
    if (mag > 1) { mx /= mag; mz /= mag; }
    this.sprinting = input.sprint && mz > 0.3 && !this.crouching && !this.ads;
    const base = this.crouching ? CROUCH_SPEED : this.sprinting ? SPRINT_SPEED : WALK_SPEED;
    const speed = base * this.speedMult * (this.ads ? 0.6 : 1);
    const tx = (fwd.x * mz + rgt.x * mx) * speed;
    const tz = (fwd.z * mz + rgt.z * mx) * speed;
    const accel = b.onGround ? 14 : 3;
    const k = Math.min(1, accel * dt);
    b.vx += (tx - b.vx) * k;
    b.vz += (tz - b.vz) * k;

    if (input.jump && b.onGround && !this.crouching) { b.vy = JUMP_SPEED; this.onSound?.('jump'); }
    b.step(dt);

    // fall damage (g = 9.81: a 4-block drop lands at ~8.9 m/s, safe; 8 blocks ~12.5 m/s, hurts)
    if (b.landedSpeed > 11) this.takeDamage((b.landedSpeed - 11) * 9, null);
    // footsteps
    const hs = Math.hypot(b.vx, b.vz);
    if (b.onGround && hs > 1.5) {
      this.stepT -= dt * hs;
      if (this.stepT <= 0) { this.stepT = 2.4; this.onSound?.('step'); }
    }
    if (b.y < -5) { this.respawn(); }
  }
}
