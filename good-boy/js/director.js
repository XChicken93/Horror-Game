// The director: the part of the game that decides when you are afraid.
//
// Two layers, the way the best stalker games do it:
//  - the DIRECTOR knows where you are. It keeps a "menace" gauge of how much pressure you are
//    under, builds it slowly, lets it peak, then pulls the thing away before fear goes stale.
//    It never lets you settle into a pattern: every wait, every route, every choice is rolled.
//  - the THING does not know where you are. It has to hear you and see you. It roams, it
//    investigates noises, it hunts what it sees, it searches where it lost you, and sometimes
//    it just stops in a dark doorway and waits.
//
// Everything Biscuit does makes some noise. Barking is loud; running is louder than walking;
// knocking things over, dragging the stool, scratching at doors, whining: all of it carries.
// The puzzles need you to do those things. So every one of them is a risk.
//
// Before the power goes (chapters 4-5) it is still in the walls: you only hear it, follow you,
// knock, breathe through the vents; and if you are loud enough for long enough, it comes out.
// After the power goes it walks the house.
import * as THREE from '../vendor/three.module.js';
import * as AU from './audio.js';
import { G } from './ps1.js';
import { lights, roomAt } from './house.js';
import { dog, dogForward } from './player.js';
import { emit } from './scent.js';
import { showSubtitle } from './humans.js';

let C = null;
export function initDirector(ctx) { C = ctx; }

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// every room's walkable spots, and the vents / dark places it can come out of or go back into
const NODES = [[1.5, 7.6], [1.95, 4.25], [5.9, 4.25], [9.45, 4.25], [11.45, 4.25], [13.0, 4.25], [6, 6.2], [4.4, 8.6], [8.0, 8.4], [9.7, 8.6], [12.8, 8.6], [12.8, 5.8], [2.9, 2.6], [6.3, 2.5], [11.45, 2.3], [3.6, 6.0], [1.2, 1.4], [7.2, 1.0], [9.2, 1.4], [10.4, 6.0], [2.2, 9.2]];
const VENTS = [[5.2, 0.35, 0.3], [9.0, 0.3, 0.3], [2.0, 0.3, 0.3], [13.6, 0.3, 6.0], [3.2, 0.3, 9.7], [11.4, 0.3, 3.7], [7.8, 0.3, 4.9]];
// where an ambush is worst: doorways
const DOORWAYS = [[1.95, 3.9], [5.95, 3.9], [9.45, 3.9], [11.45, 3.9], [5.75, 5.3], [11.5, 5.3], [1.5, 5.3], [13.4, 3.9]];

const D = {
  menace: 0, mode: 'calm', modeT: 0, calmFor: rnd(15, 30), peakT: 0,
  noises: [], lastNoise: null,
  wall: null, // tier 1: where the sound of it is, in the walls
  st: 'away', stT: 0, target: null, lastSeen: null, hush: 0, cueT: 0, glimpse: 0,
};
export const director = D;

/** Something Biscuit did made a sound. loud: 0..1 (a bark is 1; a footstep 0.05-0.3). */
export function noise(x, y, z, loud) {
  if (!C) return;
  D.noises.push({ pos: v3(x, y, z), loud, t: C.S.t });
  if (D.noises.length > 30) D.noises.shift();
  if (active()) D.menace = Math.min(1, D.menace + loud * 0.05);
}

function tier() {
  const { S } = C;
  if (S.ended || S.other || S.ch >= 10 || !S.coOn) return 0;
  if (S.power === false) return 2;
  if (S.deep && S.ch >= 4) return 1;
  return 0;
}
function active() { return tier() > 0; }
function blocked() {
  const { S } = C;
  return S.cut || S.finalFollow || S.alarmOn || S.escortUp || S.presenceActive || S.inspectOpen || S.jumpscare > 0;
}
export function hushLevel() { return D.hush > 0 ? Math.max(0, 1 - D.hush) : 1; }

// ---------------------------------------------------------------------------
export function updateDirector(dt) {
  const { S } = C;
  const T = tier();
  D.hush = Math.max(0, D.hush - dt);
  D.glimpse = Math.max(0, D.glimpse - dt);
  if (!T) { if (D.st !== 'away') vanish(true); D.menace = 0; S.stalkNear = 0; return; }
  if (blocked()) { if (D.st !== 'away' && !S.presenceActive) vanish(true); return; }
  // the gauge drifts down when nothing is near; rises with what is happening to you
  const p = S.presence;
  const near = D.st !== 'away' && D.st !== 'gone' ? Math.max(0, 1 - d2(p.pos, dog.pos) / 9) : (D.wall ? Math.max(0, 1 - d2(D.wall, dog.pos) / 7) * 0.6 : 0);
  D.menace = Math.max(0, Math.min(1, D.menace + (near * 0.18 + (D.st === 'hunt' ? 0.25 : 0) - 0.035) * dt));
  D.modeT += dt;
  if (T === 1) walls(dt);
  else stalker(dt);
}

// ---------------------------------------------------------------------------
// Tier 1: it is in the walls. You hear it come toward the noise you make.
function walls(dt) {
  const { S } = C;
  // it moves through the walls toward your last loud noise, or toward wherever you are, slowly
  const loud = D.noises.filter((n) => S.t - n.t < 6 && n.loud > 0.25).pop();
  if (D.mode === 'calm') {
    if (D.modeT > D.calmFor || (loud && Math.random() < 0.5)) { D.mode = 'build'; D.modeT = 0; D.wall = v3(...pick(VENTS)); D.wall.y = 0.3; }
    return;
  }
  if (D.mode === 'build' || D.mode === 'near') {
    const goal = loud ? loud.pos : dog.pos;
    const step = (D.mode === 'near' ? 0.9 : 0.45) * dt * (loud ? 2 : 1);
    const dd = d2(D.wall, goal);
    if (dd > 0.5) { D.wall.x += (goal.x - D.wall.x) / dd * step; D.wall.z += (goal.z - D.wall.z) / dd * step; }
    // what you hear: knocks inside the wall, scraping, breathing from the nearest vent
    D.cueT -= dt;
    if (D.cueT <= 0) {
      D.cueT = rnd(1.4, 4.5) * (1.2 - D.menace * 0.6);
      const r = Math.random();
      const w = D.wall;
      if (r < 0.4) AU.knock(w.x, rnd(0.2, 2), w.z, Math.floor(rnd(1, 4)), 0.4 + D.menace * 0.5);
      else if (r < 0.7) { const v = VENTS.reduce((a, b) => (Math.hypot(b[0] - w.x, b[2] - w.z) < Math.hypot(a[0] - w.x, a[2] - w.z) ? b : a)); AU.breathing(v[0], v[1], v[2], 0.4 + D.menace * 0.6); for (let i = 0; i < 10; i++) emit(v[0], v[1] + 0.1, v[2], 'wrong', { spread: 0.2, life: 3, vy: 0.2, size: 0.05 }); }
      else if (r < 0.85) AU.creak(w.x, 1, w.z, rnd(0.3, 0.8));
      else flickerNear(w, 0.8);
    }
    if (d2(D.wall, dog.pos) < 3.5 && D.mode === 'build') { D.mode = 'near'; D.modeT = 0; }
    // you stopped making noise and kept still: it loses interest (usually)
    if (D.mode === 'near' && !loud && dog.lying > 0.5 && D.modeT > 6 && Math.random() < dt * 0.4) release();
    // too loud for too long, too close: it comes out of the wall
    if (D.mode === 'near' && D.menace > 0.8 && D.modeT > 5 && !S.cut && Math.random() < dt * 0.5) comeOut();
    if (D.modeT > 70) release();
  }
  if (D.mode === 'out') {
    const p = S.presence;
    D.stT += dt;
    p.speed = 1.6; if (D.stT > 0.4) p.path = [dog.pos.clone()];
    p.update(dt, S.t, 0, dog.pos); p.pos.y = 0; p.root.position.y = 0; p.visible = true; p.root.visible = Math.random() > 0.08;
    p.monster.update(S.t, dt, 'hunt');
    for (let i = 0; i < 2; i++) emit(p.pos.x, 0.4 + Math.random() * 1.4, p.pos.z, 'wrong', { spread: 0.4, life: 1.5, size: 0.06 });
    S.stalkNear = Math.max(0, 1 - d2(p.pos, dog.pos) / 6);
    if (C.hidden(d2(p.pos, dog.pos)) && D.stT > 1.5) { vanish(); release(); showSubtitle('note', '<span class="note">(It goes right past you. It goes back into the wall.)</span>', 3); return; }
    if (d2(p.pos, dog.pos) < 0.75) { vanish(); C.caught(); release(true); return; }
    if (D.stT > 6) { vanish(); release(); }
  }
}
function comeOut() {
  const { S } = C;
  // silence, first
  D.hush = 1.4; D.mode = 'waitOut';
  C.later(1.4, () => {
    if (tier() !== 1 || blocked()) { D.mode = 'calm'; return; }
    const p = S.presence;
    const v = VENTS.filter((q) => { const d = Math.hypot(q[0] - dog.pos.x, q[2] - dog.pos.z); return d > 2.5 && d < 7; });
    const at = v.length ? pick(v) : [D.wall.x, 0, D.wall.z];
    p.setPos(at[0], at[2], 0); p.path = []; p.yaw = Math.atan2(dog.pos.x - at[0], dog.pos.z - at[2]);
    AU.stinger(1); AU.whoomp(at[0], 0.5, at[2]); AU.growl(1.2, 1);
    for (let i = 0; i < 30; i++) emit(at[0], 0.3, at[2], 'wrong', { spread: 0.5, life: 2, vy: 0.8, size: 0.07 });
    D.mode = 'out'; D.stT = 0;
  });
}
function release(caught) {
  D.mode = 'calm'; D.modeT = 0; D.wall = null; D.calmFor = caught ? rnd(40, 70) : rnd(18, 50);
  D.menace = Math.max(0, D.menace - 0.6);
}

// ---------------------------------------------------------------------------
// Tier 2: it walks the house. It hears, it sees, it searches, it waits.
function senses() {
  const { S } = C;
  const p = S.presence;
  const d = d2(p.pos, dog.pos);
  const dogIn = !S.outside && dog.y > -0.3;
  if (!dogIn || C.hidden(d)) return false;
  const light = C.flashOn();
  const range = light ? 12 : 4.8;
  if (d > range) return false;
  const sameRoom = roomAt(p.pos.x, p.pos.z, 0) === roomAt(dog.pos.x, dog.pos.z, dog.y);
  if (!sameRoom && d > 2.2 && !(light && d < 7)) return false;
  // it looks where it is facing; up close it just knows
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  const dot = ((dog.pos.x - p.pos.x) * fx + (dog.pos.z - p.pos.z) * fz) / Math.max(0.01, d);
  return d < 1.6 || dot > (light ? 0.1 : 0.35);
}
function heard() {
  const { S } = C;
  const p = S.presence;
  let best = null;
  for (const n of D.noises) {
    if (S.t - n.t > 1.2 || n.heard) continue;
    const r = n.loud * 10; // a bark carries ten metres, through walls
    if (d2(n.pos, p.pos) < r) { n.heard = true; if (!best || n.loud > best.loud) best = n; }
  }
  return best;
}
function goNode(x, z, speed) {
  const p = C.S.presence;
  p.speed = speed;
  p.goTo(v3(x, 0, z));
}
function stalker(dt) {
  const { S } = C;
  const p = S.presence;
  D.stT += dt;
  if (D.st === 'away' || D.st === 'gone') {
    p.root.visible = false; p.visible = false; S.stalkNear = 0;
    // a summons (you took his flashlight, his jacket) or a loud noise brings it sooner
    const loud = D.noises.filter((n) => S.t - n.t < 3 && n.loud > 0.5).pop();
    if (C.summoned()) { D.calmFor = 0; C.clearSummon(); }
    if (D.stT > D.calmFor || (loud && D.stT > D.calmFor * 0.4 && Math.random() < 0.6)) spawn(loud);
    // even when it is away, the house is not quiet
    D.cueT -= dt;
    if (D.cueT <= 0) { D.cueT = rnd(6, 16); const n = pick(NODES); const r = Math.random(); if (r < 0.35) AU.step('heavy', n[0], 0.1, n[1], 0.25); else if (r < 0.55) AU.creak(n[0], 1, n[1], 0.4); else if (r < 0.65) flickerNear(v3(n[0], 0, n[1]), 0.6); }
    return;
  }
  p.visible = true;
  p.root.visible = Math.random() > 0.04;
  const d = d2(p.pos, dog.pos);
  S.stalkNear = d < 7 ? 1 - d / 7 : 0;
  const sees = senses();
  const h = heard();
  if (sees && D.st !== 'hunt') { D.st = 'hunt'; D.stT = 0; AU.stinger(0.8); C.scared(1); AU.whoomp(p.pos.x, 1.2, p.pos.z); D.peakT = 0; }
  if (D.st === 'hunt') {
    p.speed = (1.3 + S.co * 0.9) * (Math.random() < 0.02 ? 0.2 : 1);
    D.re = (D.re || 0) - dt;
    if (sees) { D.lastSeen = dog.pos.clone(); D.lost = 0; } else D.lost = (D.lost || 0) + dt;
    if (D.re <= 0) { D.re = 0.5; if (D.lastSeen) p.goTo(D.lastSeen.clone()); }
    if (D.lost > 3.5) { D.st = 'search'; D.stT = 0; D.searchN = Math.floor(rnd(2, 5)); D.target = D.lastSeen; }
    if (d < 0.75 && !dog.frozen) { C.caught(); vanish(); D.calmFor = rnd(35, 70); return; }
  } else if (h) {
    // it heard you: it goes to where the noise was, not to where you are now
    D.st = 'investigate'; D.stT = 0; D.target = h.pos.clone(); goNode(h.pos.x, h.pos.z, 1.05 + h.loud * 0.4);
    if (h.loud > 0.6) { AU.growl(0.6, 0.6); }
  } else if (D.st === 'investigate' || D.st === 'search') {
    if (!p.path.length) {
      // arrived: it stands and listens. Then it looks around nearby. Sometimes it decides to wait.
      D.wait = (D.wait ?? rnd(1.5, 4.5)) - dt;
      if (D.wait <= 0) {
        D.wait = undefined;
        if (Math.random() < 0.22) { const dw = DOORWAYS.slice().sort((a, b) => Math.hypot(a[0] - p.pos.x, a[1] - p.pos.z) - Math.hypot(b[0] - p.pos.x, b[1] - p.pos.z))[0]; D.st = 'ambush'; D.stT = 0; D.ambushFor = rnd(10, 22); goNode(dw[0], dw[1], 0.9); }
        else if ((D.searchN = (D.searchN ?? 2) - 1) > 0) { const c = D.target || p.pos; const near = NODES.filter((n) => Math.hypot(n[0] - c.x, n[1] - c.z) < 5); const n = near.length ? pick(near) : pick(NODES); goNode(n[0], n[1], 0.85); }
        else { D.st = 'roam'; D.stT = 0; }
      }
      p.yaw += Math.sin(S.t * 1.7) * dt * 1.5; // turning its head, listening
    }
  } else if (D.st === 'ambush') {
    // perfectly still and silent, in a doorway, in the dark
    p.path = [];
    if (D.stT > D.ambushFor) { D.st = 'roam'; D.stT = 0; }
  } else if (D.st === 'roam') {
    if (!p.path.length) {
      // the director nudges it: when you have had it easy, toward you (roughly); when you are
      // already afraid, away. It never knows exactly where you are.
      const toward = D.menace < 0.45 ? 0.7 : 0.25;
      let n;
      if (Math.random() < toward) { const fuzzy = v3(dog.pos.x + rnd(-3.5, 3.5), 0, dog.pos.z + rnd(-3.5, 3.5)); n = NODES.slice().sort((a, b) => Math.hypot(a[0] - fuzzy.x, a[1] - fuzzy.z) - Math.hypot(b[0] - fuzzy.x, b[1] - fuzzy.z))[Math.floor(rnd(0, 3))]; }
      else n = pick(NODES);
      goNode(n[0], n[1], rnd(0.55, 0.9));
      if (Math.random() < 0.25) p.path = p.path.slice(0, 1); // it stops halfway. Then goes on. Or doesn't.
    }
  }
  // the director pulls it out before it gets old: after a peak, or after a long time
  if (D.menace > 0.85) D.peakT += dt;
  if ((D.peakT > 10 && D.st !== 'hunt') || (D.stT > 80 && D.st === 'roam')) { leave(); return; }
  // what you notice while it is near and you cannot see it
  if (D.st !== 'ambush') {
    p.update(dt, S.t, 0, dog.pos); p.pos.y = 0; p.root.position.y = 0;
    D.stepT = (D.stepT || 0) - dt;
    if (p.moving && D.stepT <= 0 && d < 12) { D.stepT = 0.55 / Math.max(0.3, p.speed); AU.step('heavy', p.pos.x, 0.1, p.pos.z, 0.5); }
  } else p.root.position.copy(p.pos);
  p.monster.update(S.t, dt, D.st === 'hunt' ? 'hunt' : D.st === 'ambush' ? 'idle' : p.moving ? 'walk' : 'idle');
  if (D.st !== 'ambush') for (let i = 0; i < 2; i++) emit(p.pos.x, 0.4 + Math.random() * 1.6, p.pos.z, 'wrong', { spread: 0.5, life: 2, size: 0.06 });
  D.breathT = (D.breathT || 0) - dt;
  if (D.breathT <= 0 && d < 9 && D.st !== 'ambush') { D.breathT = rnd(1.8, 3.6); AU.breathing(p.pos.x, 1.6, p.pos.z, 1 - d / 10); }
  if (D.st === 'ambush' && d < 3 && Math.random() < dt * 0.5) AU.breathing(p.pos.x, 1.6, p.pos.z, 0.25);
  if (Math.random() < dt * 0.6 && d < 10) flickerNear(p.pos, 0.6);
}
function spawn(loud) {
  const { S } = C;
  const p = S.presence;
  const myRoom = roomAt(dog.pos.x, dog.pos.z, dog.y);
  const fwd = dogForward();
  const opts = VENTS.filter(([x, , z]) => { const dx = x - dog.pos.x, dz = z - dog.pos.z, d = Math.hypot(dx, dz); return d > 4 && d < 13 && ((dx * fwd.x + dz * fwd.z) / d < 0.3 || roomAt(x, z, 0) !== myRoom); });
  if (!opts.length || S.outside || dog.y < -0.3) { D.stT = D.calmFor - 3; return; }
  // silence first
  D.hush = 1.6;
  const [x, , z] = pick(opts);
  C.later(1.6, () => {
    if (tier() !== 2 || blocked()) { D.st = 'away'; D.stT = 0; return; }
    p.setPos(x, z, 0); p.path = []; p.arrived = null; p.yaw = Math.random() * 6.28;
    AU.knock(x, 0.3, z, 3, 0.7); AU.whoomp(x, 0.4, z);
    for (let i = 0; i < 25; i++) emit(x, 0.3, z, 'wrong', { spread: 0.4, life: 2.5, vy: 0.6, size: 0.06 });
    D.st = loud ? 'investigate' : 'roam'; D.stT = 0; D.peakT = 0; D.searchN = 3;
    if (loud) { D.target = loud.pos.clone(); goNode(loud.pos.x, loud.pos.z, 1.0); }
  });
  D.st = 'gone'; D.stT = -99;
}
function leave() {
  const { S } = C;
  const p = S.presence;
  // it goes back into the nearest vent
  const v = VENTS.slice().sort((a, b) => Math.hypot(a[0] - p.pos.x, a[2] - p.pos.z) - Math.hypot(b[0] - p.pos.x, b[2] - p.pos.z))[0];
  for (let i = 0; i < 25; i++) emit(p.pos.x, 0.3 + Math.random() * 1.5, p.pos.z, 'wrong', { spread: 0.5, life: 2, vy: 0.4, size: 0.06 });
  AU.knock(v[0], 0.3, v[2], 2, 0.5);
  vanish();
  D.calmFor = Math.random() < 0.2 ? rnd(6, 12) : rnd(22, 60); // usually a breather. Not always.
  D.menace = Math.max(0, D.menace - 0.5);
}
function vanish(quiet) {
  const { S } = C;
  const p = S.presence;
  if (!S.presenceActive && !(S.jumpscare > 0)) { p.root.visible = false; p.visible = false; }
  p.path = [];
  D.st = 'away'; D.stT = 0; S.stalkNear = 0;
  if (quiet) D.calmFor = Math.max(D.calmFor, 10);
}
/** bark it apart: it scatters, and stays away a while */
export function repelled() { vanish(); D.calmFor = rnd(25, 45); D.menace = Math.max(0, D.menace - 0.4); D.mode = 'calm'; D.modeT = 0; D.wall = null; }
export function directorVisible() { return D.st !== 'away' && D.st !== 'gone' && C.S.presence.visible; }

// the lights in the room it is in flicker
function flickerNear(pos, amount) {
  for (let i = 0; i < lights.length; i++) {
    const L = lights[i]; if (!L || !L.on || i === 7) continue;
    const mn = G.uLightMin.value[i], mx = G.uLightMax.value[i];
    if (pos.x > mn.x && pos.x < mx.x && pos.z > mn.z && pos.z < mx.z) { const was = L.flicker; L.flicker = Math.max(was, amount); setTimeout(() => { L.flicker = was; }, 900 + Math.random() * 1500); }
  }
}
