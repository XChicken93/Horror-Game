// Touch controls, for phones and tablets: a joystick to walk, drag to look, and buttons
// for everything else. The buttons send the same keys the keyboard does, so every
// prompt in the game ("E take...", "hold R dig") still matches the button you press.
import { input } from './player.js';

export const isTouch = (() => {
  const q = new URLSearchParams(location.search);
  if (q.get('mobile') === '1') return true;
  if (q.get('mobile') === '0') return false;
  return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
})();

const send = (type, key) => dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));

// [key, label, kind, name, size, side, x, y]  kind: 'tap' | 'hold' (held while touched) | 'toggle'
// x/y are offsets in px from that side's bottom corner (right side: from the right edge).
const BUTTONS = [
  // right thumb: the things you do all the time, in an arc around E
  ['e', 'E', 'hold', 'use', 54, 'right', 14, 16],
  [' ', '⤒', 'tap', 'jump', 46, 'right', 78, 12],
  ['b', 'B', 'tap', 'bark', 46, 'right', 18, 82],
  ['f', 'F', 'hold', 'sniff', 46, 'right', 74, 66],
  ['r', 'R', 'hold', 'dig', 38, 'right', 132, 26],
  ['t', 'T', 'tap', 'follow', 38, 'right', 26, 140],
  // left edge: the occasional ones, in a slim column clear of the joystick
  ['Shift', '»', 'toggle', 'run', 36, 'left', 10, 214],
  ['c', 'C', 'hold', 'lie', 36, 'left', 10, 170],
  ['x', 'X', 'tap', 'sit', 36, 'left', 10, 126],
  ['g', 'G', 'tap', 'wag', 36, 'left', 10, 82],
  ['q', 'Q', 'tap', 'whine', 36, 'left', 10, 38],
  ['h', '?', 'hold', 'remember', 36, 'left', 10, 258],
];

export function initTouch() {
  if (!isTouch) return;
  document.body.classList.add('touch');
  const root = document.createElement('div'); root.id = 'touchUI'; document.body.appendChild(root);

  // ---- joystick: wherever your left thumb lands on the left side of the screen
  const stick = document.createElement('div'); stick.id = 'stick'; stick.innerHTML = '<div id="knob"></div>'; root.appendChild(stick);
  const knob = stick.firstChild;
  let stickId = null, sx = 0, sy = 0;
  const R = 56;
  // ---- look: any other touch that is not on a button
  let lookId = null, lx = 0, ly = 0;

  const zone = document.createElement('div'); zone.id = 'touchZone'; root.appendChild(zone);
  zone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth * 0.42 && t.clientX > 56 && stickId === null) {
        stickId = t.identifier; sx = t.clientX; sy = t.clientY;
        stick.style.left = `${sx - R}px`; stick.style.top = `${sy - R}px`; stick.classList.add('on');
        knob.style.transform = 'translate(0px, 0px)';
      } else if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
    }
  }, { passive: false });
  zone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        let dx = t.clientX - sx, dy = t.clientY - sy; const d = Math.hypot(dx, dy);
        if (d > R) { dx *= R / d; dy *= R / d; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        const m = Math.min(1, d / R);
        input.stickX = Math.abs(dx / R) < 0.15 ? 0 : dx / R; input.stickY = Math.abs(dy / R) < 0.15 ? 0 : -dy / R;
        input.stickRun = m > 0.95;
      } else if (t.identifier === lookId) {
        input.mdx += (t.clientX - lx) * 1.7; input.mdy += (t.clientY - ly) * 1.7;
        lx = t.clientX; ly = t.clientY;
      }
    }
  }, { passive: false });
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) { stickId = null; input.stickX = 0; input.stickY = 0; input.stickRun = false; stick.classList.remove('on'); }
      if (t.identifier === lookId) lookId = null;
    }
  };
  zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);

  // ---- buttons
  const make = ([key, label, kind, name, size, side, x, y]) => {
    const b = document.createElement('div'); b.className = 'tbtn';
    b.innerHTML = `<span>${label}</span><small>${name}</small>`;
    b.style.width = b.style.height = `${size}px`;
    b.style[side] = `${x}px`; b.style.bottom = `${y}px`;
    b.style.fontSize = `${Math.round(size * 0.38)}px`;
    root.appendChild(b);
    let on = false;
    b.addEventListener('touchstart', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (kind === 'toggle') { on = !on; send(on ? 'keydown' : 'keyup', key); b.classList.toggle('lit', on); return; }
      b.classList.add('lit'); send('keydown', key);
      if (kind === 'tap') setTimeout(() => { send('keyup', key); b.classList.remove('lit'); }, 90);
    }, { passive: false });
    if (kind === 'hold') {
      const up = (e) => { e.preventDefault(); b.classList.remove('lit'); send('keyup', key); };
      b.addEventListener('touchend', up); b.addEventListener('touchcancel', up);
    }
  };
  BUTTONS.forEach(make);

  // ---- turn the phone sideways
  const rot = document.createElement('div'); rot.id = 'rotate';
  rot.innerHTML = '<div>⟳</div>Turn your phone sideways.<small>Good Boy plays in landscape. Headphones help.</small>';
  document.body.appendChild(rot);
}

/** Go full screen on the first tap, and try to hold landscape. */
export function goFullscreen() {
  if (!isTouch) return;
  const el = document.documentElement;
  try {
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen && el.webkitRequestFullscreen();
    if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* not supported */ } }).catch(() => {});
  } catch (e) { /* not allowed here */ }
}
