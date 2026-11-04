import { Game } from './core/Game.js';
import { getUniqueId, copyToClipboard } from './multiplayer/UniqueID.js';
import { Network } from './multiplayer/Network.js';
import { DesktopControls } from './controls/DesktopControls.js';
import { MobileControls, isTouchDevice } from './controls/MobileControls.js';

const $ = (id) => document.getElementById(id);
const touch = isTouchDevice();
const myId = getUniqueId();
$('my-id').textContent = myId;

// ---- network (optional: game works fully offline against bots) ----
const net = new Network(myId);
net.onStatus = (s) => { $('net-status').textContent = s; };
net.start();

// ---- game ----
let game;
try {
  game = new Game({ canvas: $('game'), net, myId, touch });
  game.loadWorld(net.hostSeed, [], $('opt-bots').checked);
} catch (err) {
  $('net-status').textContent = 'Could not start 3D: ' + err.message;
  console.error(err);
}

net.onSeed = (seed, edits) => {
  if (!game) return;
  game.loadWorld(seed, edits, $('opt-bots').checked);
  game.hud.toast('Joined host world');
};

// ---- controls ----
const desktop = new DesktopControls(game.input, $('game'));
desktop.getMode = () => game.mode;
const mobile = new MobileControls(game.input);
mobile.getMode = () => game.mode;

// ---- menu ----
$('copy-id').addEventListener('click', async () => {
  const ok = await copyToClipboard(myId);
  $('copy-id').textContent = ok ? 'COPIED' : 'SELECT';
  setTimeout(() => ($('copy-id').textContent = 'COPY'), 1400);
});
$('join-btn').addEventListener('click', () => net.join($('friend-id').value));
$('friend-id').addEventListener('keydown', (e) => { if (e.key === 'Enter') net.join($('friend-id').value); });

function portraitCheck() {
  const portrait = touch && window.innerHeight > window.innerWidth;
  $('rotate-hint').classList.toggle('hidden', !portrait || $('menu').classList.contains('hidden') === false);
}
window.addEventListener('resize', portraitCheck);

async function deploy() {
  game.audio.unlock();
  $('menu').classList.add('hidden');
  game.hud.show(true);
  if (touch) {
    mobile.setEnabled(true);
    try { await document.documentElement.requestFullscreen?.(); } catch (_) { /* iOS Safari: not supported */ }
    try { await screen.orientation?.lock?.('landscape'); } catch (_) { /* needs fullscreen/PWA */ }
  } else {
    desktop.setEnabled(true);
    $('game').requestPointerLock?.();
  }
  game.start();
  portraitCheck();
  const p = $('rotate-hint');
  if (touch && window.innerHeight > window.innerWidth) p.classList.remove('hidden');
}
$('play-btn').addEventListener('click', deploy);
$('opt-bots').addEventListener('change', () => game.loadWorld(game.seed, [...game.world.edits].map(([k, v]) => [...k.split(',').map(Number), v]), $('opt-bots').checked));

// hide the rotate hint once landscape
window.addEventListener('resize', () => {
  const portrait = touch && window.innerHeight > window.innerWidth && game?.running;
  $('rotate-hint').classList.toggle('hidden', !portrait);
});

window.__game = game; // handy for debugging in the console
