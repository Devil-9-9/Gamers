import { MAX_HP } from '../core/Constants.js';
import { HOTBAR } from '../blocks/BlockTypes.js';
import { drawBlockIcon } from '../blocks/TextureAtlas.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      root: $('hud'), hp: $('hp-fill'), hpText: $('hp-text'), mode: $('mode-text'), kills: $('kill-count'), time: $('time-text'),
      ammoMag: $('ammo-mag'), ammoRes: $('ammo-res'), wname: $('weapon-name'), cross: $('crosshair'), hit: $('hitmarker'),
      flash: $('damage-flash'), scope: $('scope-overlay'), feed: $('killfeed'), hotbar: $('hotbar'), toast: $('toast'), ammoBox: $('ammo'),
    };
    this.slots = [];
    this.toastT = null;
  }

  show(v) { this.el.root.classList.toggle('hidden', !v); }

  buildHotbar(atlasCanvas, onPick) {
    this.el.hotbar.innerHTML = '';
    this.slots = HOTBAR.map((id, i) => {
      const s = document.createElement('div'); s.className = 'slot';
      const c = document.createElement('canvas'); drawBlockIcon(c, atlasCanvas, id); s.appendChild(c);
      s.style.pointerEvents = 'auto';
      s.addEventListener('touchstart', (e) => { e.preventDefault(); onPick(i); }, { passive: false });
      s.addEventListener('click', () => onPick(i));
      this.el.hotbar.appendChild(s); return s;
    });
  }

  selectSlot(i) { this.slots.forEach((s, k) => s.classList.toggle('sel', k === i)); }

  setHp(hp) {
    const p = Math.max(0, Math.min(1, hp / MAX_HP));
    this.el.hp.style.width = (p * 100) + '%';
    this.el.hp.style.background = p > 0.5 ? '' : p > 0.25 ? 'linear-gradient(#f0c040,#c08a10)' : 'linear-gradient(#ff5a4a,#b01c10)';
    this.el.hpText.textContent = Math.ceil(hp);
  }

  setWeapon(w) { this.el.wname.textContent = w.name; this.setAmmo(w); this.el.scope.classList.add('hidden'); }

  setAmmo(w) {
    this.el.ammoMag.textContent = w.reloading ? '--' : w.ammo;
    this.el.ammoMag.classList.toggle('low', w.ammo <= Math.ceil(w.mag * 0.25));
    this.el.ammoRes.textContent = w.reserve;
  }

  setMode(mode) {
    this.el.mode.textContent = mode === 'build' ? 'BUILD MODE' : 'COMBAT';
    this.el.cross.classList.toggle('build', mode === 'build');
    this.el.hotbar.style.opacity = mode === 'build' ? 1 : 0.55;
  }

  setKills(n) { this.el.kills.textContent = n; }
  setTime(t) { this.el.time.textContent = t; }

  setAds(on, scoped) {
    this.el.cross.classList.toggle('ads', on);
    this.el.scope.classList.toggle('hidden', !(on && scoped));
  }

  hitmarker(kill) {
    const h = this.el.hit; h.classList.remove('show', 'kill'); void h.offsetWidth;
    h.classList.add('show'); if (kill) h.classList.add('kill');
    clearTimeout(this._ht); this._ht = setTimeout(() => h.classList.remove('show'), 90);
  }

  damageFlash() {
    const f = this.el.flash; f.classList.remove('show'); void f.offsetWidth; f.classList.add('show');
    setTimeout(() => f.classList.remove('show'), 60);
  }

  killfeed(text) {
    const d = document.createElement('div'); d.textContent = text; this.el.feed.prepend(d);
    setTimeout(() => d.remove(), 4000);
    while (this.el.feed.children.length > 5) this.el.feed.lastChild.remove();
  }

  toast(text, ms = 1800) {
    const t = this.el.toast; t.textContent = text; t.classList.add('show');
    clearTimeout(this.toastT); this.toastT = setTimeout(() => t.classList.remove('show'), ms);
  }
}
