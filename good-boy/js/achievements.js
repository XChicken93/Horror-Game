// Achievements: little honours for a good dog. Saved in this browser.
import * as AU from './audio.js';

export const ACH = [
  { id: 'sit', name: 'Good Boy', desc: 'Sit when Claire says "Biscuit, sit."' },
  { id: 'pets', name: 'Everybody Pets the Dog', desc: 'Get a pat on the head from the man, the woman and the girl.' },
  { id: 'jar', name: 'Counter Surfer', desc: 'Knock the cookie jar off the counter.' },
  { id: 'table', name: 'King of the Table', desc: 'Stand on the kitchen table. Nobody is looking.' },
  { id: 'zoomies', name: 'Zoomies', desc: 'Run for twenty seconds without stopping.' },
  { id: 'playdead', name: 'Play Dead', desc: 'Lie still on the floor for thirty seconds.' },
  { id: 'speak', name: 'Speak!', desc: 'Bark fifty times in one night.' },
  { id: 'snow', name: 'Cold Nose', desc: 'Go out through the flap into the snow.' },
  { id: 'shake', name: 'Shake It Off', desc: 'Come in from the snow and shake yourself dry.' },
  { id: 'digger', name: 'Best Digger in Cutter County', desc: 'Dig up the tin, your bone and the mitten.' },
  { id: 'pond', name: 'The Long Way Round', desc: 'Dig under the gate and follow him to the pond.' },
  { id: 'nose', name: 'The Nose Knows', desc: 'Follow six different smells.' },
  { id: 'photos', name: 'Family Album', desc: 'Look at every photograph in the house.' },
  { id: 'words', name: 'Good Listener', desc: 'Understand two hundred words.' },
  { id: 'smoke', name: 'Like Smoke', desc: 'Bark the thing apart.' },
  { id: 'hide', name: 'Under the Bed', desc: 'Hide from it while it is hunting you, and let it walk past.' },
  { id: 'wagthing', name: 'Wrong Tail', desc: 'Wag your tail at the thing from the furnace. It does not wag back.' },
  { id: 'caught', name: 'Second Wind', desc: 'Get caught by it, wake up on the floor, and keep going.' },
  { id: 'through', name: 'Through the Fire', desc: 'Walk into the open mouth of the hot box.' },
  { id: 'carried', name: 'Carried', desc: 'Be picked up by Danny on the other side.' },
  { id: 'awake', name: 'Everybody Up', desc: 'Wake all three of them at the very end.' },
  { id: 'untouchable', name: 'Untouchable', desc: 'Be hunted by it, and still reach an ending without it ever catching you.' },
  { id: 'wire', name: 'Down to the Wire', desc: 'Get them out with less than ten minutes left.' },
  { id: 'home', name: 'Home', desc: 'Get the whole family out of the house.' },
  { id: 'allend', name: 'He Still Waits', desc: 'Find all six endings.' },
  { id: 'monsters', name: 'Know Your Monsters', desc: 'Try every shape of the thing on the title screen.' },
];
const KEY = 'goodboy_ach', PROG = 'goodboy_achprog';
let got = new Set(), prog = {};
try { got = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); prog = JSON.parse(localStorage.getItem(PROG) || '{}'); } catch (e) { /* storage blocked */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...got])); localStorage.setItem(PROG, JSON.stringify(prog)); } catch (e) { /* storage blocked */ } };

export const achCount = () => got.size;
export const hasAch = (id) => got.has(id);
export function resetAch() { got = new Set(); prog = {}; save(); }

/** Add one thing to a set-type progress; returns how many distinct things there are now. */
export function achSet(key, v) {
  const s = new Set(prog[key] || []); s.add(v); prog[key] = [...s]; save(); return s.size;
}

let toastEl = null, queue = [], showing = false;
function showNext() {
  if (showing || !queue.length) return;
  const a = queue.shift(); showing = true;
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.id = 'achToast'; document.body.appendChild(toastEl); }
  toastEl.innerHTML = `<div class="ah">ACHIEVEMENT</div><div class="an">${a.name}</div><div class="ad">${a.desc}</div>`;
  toastEl.classList.add('on');
  try { AU.chime(); } catch (e) { /* audio not ready */ }
  setTimeout(() => { toastEl.classList.remove('on'); setTimeout(() => { showing = false; showNext(); }, 700); }, 4200);
}
export function unlock(id) {
  if (got.has(id)) return false;
  const a = ACH.find((x) => x.id === id);
  if (!a) return false;
  got.add(id); save();
  queue.push(a); showNext();
  return true;
}

export function achListHTML() {
  return ACH.map((a) => `<div class="ai ${got.has(a.id) ? 'got' : ''}"><b>${got.has(a.id) ? '★' : '☆'} ${a.name}</b><span>${a.desc}</span></div>`).join('');
}
