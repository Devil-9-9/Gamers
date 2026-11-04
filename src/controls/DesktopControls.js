/** Keyboard + mouse (pointer lock). Writes into the shared InputState. */
export class DesktopControls {
  constructor(input, canvas) {
    this.input = input; this.canvas = canvas; this.enabled = false; this.keys = new Set();
    this.getMode = () => 'combat';
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled || document.pointerLockElement !== canvas) return;
      input.lookDX += e.movementX; input.lookDY += e.movementY;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (document.pointerLockElement !== canvas) { canvas.requestPointerLock?.(); return; }
      if (e.button === 0) input.fire = true;
      if (e.button === 2) { if (this.getMode() === 'build') input.press('place'); else input.aim = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) input.fire = false;
      if (e.button === 2) input.aim = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      input.press(e.deltaY > 0 ? 'nextBlock' : 'prevBlock');
    }, { passive: true });
    document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas) input.reset(); });
  }

  setEnabled(v) { this.enabled = v; if (!v) this.input.reset(); }

  key(e, down) {
    if (!this.enabled) return;
    const i = this.input;
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.keys[down ? 'add' : 'delete']('f'); break;
      case 'KeyS': case 'ArrowDown': this.keys[down ? 'add' : 'delete']('b'); break;
      case 'KeyA': case 'ArrowLeft': this.keys[down ? 'add' : 'delete']('l'); break;
      case 'KeyD': case 'ArrowRight': this.keys[down ? 'add' : 'delete']('r'); break;
      case 'Space': i.jump = down; e.preventDefault(); break;
      case 'ShiftLeft': case 'ShiftRight': i.sprint = down; break;
      case 'KeyC': case 'ControlLeft': i.crouch = down; break;
      default:
        if (!down) return;
        if (e.code === 'KeyR') i.press('reload');
        else if (e.code === 'KeyF') i.press('toggleBuild');
        else if (e.code === 'KeyG') i.press('place');
        else if (e.code === 'KeyX') i.press('breakBlock');
        else if (e.code === 'KeyQ') i.press('prevBlock');
        else if (e.code === 'KeyE') i.press('nextBlock');
        else if (e.code === 'Tab') { i.press('swap'); e.preventDefault(); }
        else if (/^Digit[1-4]$/.test(e.code)) i.press('weapon' + (Number(e.code.slice(5)) - 1));
        else if (/^Digit[5-9]$/.test(e.code)) i.press('slot' + (Number(e.code.slice(5)) - 5));
    }
    i.moveZ = (this.keys.has('f') ? 1 : 0) - (this.keys.has('b') ? 1 : 0);
    i.moveX = (this.keys.has('r') ? 1 : 0) - (this.keys.has('l') ? 1 : 0);
  }
}
