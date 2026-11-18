// Cutscenes: when something big happens, the game takes the camera and shows you.
// A cutscene is a list of shots. Each shot has a duration, a camera position and a point to
// look at (either can be a function of k = 0..1 through the shot), an optional field of view,
// roll, shake, and start / update / end hooks that move the actors. Hard cuts between shots.
// The HUD goes away and the letterbox comes in; subtitles stay.
import * as THREE from '../vendor/three.module.js';
import { dog } from './player.js';
import { ps1Mat } from './ps1.js';
import { T } from './textures.js';

let C = null;
let cur = null;
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
export function initCine(ctx) { C = ctx; }
export const playing = () => !!cur;

export function playCine(shots, onDone) {
  if (cur && cur.onDone) { const f = cur.onDone; cur = null; f(); }
  cur = { shots, i: -1, t: 0, onDone };
  C.S.cine = true; C.S.cineShake = 0;
  document.body.classList.add('cine');
  dog.frozen = true;
  next();
}
function next() {
  cur.i++;
  cur.t = 0;
  if (cur.i >= cur.shots.length) { finish(); return; }
  const sh = cur.shots[cur.i];
  if (sh.start) sh.start();
}
function finish() {
  const done = cur.onDone;
  cur = null;
  C.S.cine = false; C.S.cineShake = 0;
  document.body.classList.remove('cine');
  dog.frozen = false; dog.forceMove = false; dog.forceLie = false;
  const cam = C.camera; if (Math.abs(cam.fov - 72) > 0.1) { cam.fov = 72; cam.updateProjectionMatrix(); }
  if (done) done();
}
const val = (v, k, t) => (typeof v === 'function' ? v(k, t) : v);

/** Call last in the frame, after everything else has moved: it owns the camera. */
export function updateCine(dt) {
  if (!cur) return;
  const sh = cur.shots[cur.i];
  cur.t += dt;
  const k = Math.min(1, cur.t / sh.dur);
  const e = sh.ease === 'linear' ? k : k * k * (3 - 2 * k);
  if (sh.update) sh.update(cur.t, e, dt);
  if (!cur || cur.shots[cur.i] !== sh) return; // the update may have ended the scene
  const cam = C.camera;
  tmp.copy(val(sh.pos, e, cur.t));
  tmp2.copy(val(sh.look, e, cur.t));
  const sk = (sh.shake || 0) + (C.S.cineShake || 0);
  if (sk > 0) { tmp.x += (Math.random() - 0.5) * 0.08 * sk; tmp.y += (Math.random() - 0.5) * 0.08 * sk; tmp2.x += (Math.random() - 0.5) * 0.05 * sk; }
  C.S.cineShake = Math.max(0, (C.S.cineShake || 0) - dt * 2.5);
  cam.position.copy(tmp);
  cam.up.set(0, 1, 0);
  cam.lookAt(tmp2);
  const roll = val(sh.roll || 0, e, cur.t);
  if (roll) cam.rotateZ(roll);
  const fov = val(sh.fov ?? 66, e, cur.t);
  if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = fov; cam.updateProjectionMatrix(); }
  if (cur.t >= sh.dur) { if (sh.end) sh.end(); if (cur && cur.shots[cur.i] === sh) next(); }
}
export function cineShake(v) { if (C) C.S.cineShake = Math.max(C.S.cineShake || 0, v); }

/** A film title in the middle of the screen. */
export function cineTitle(text, sub = '', secs = 3.5) {
  const el = document.getElementById('cineTitle');
  if (!el) return;
  el.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
  el.classList.add('on');
  setTimeout(() => el.classList.remove('on'), secs * 1000);
}

/** Blood on the lens. */
export function splat(amount = 1) {
  const c = document.getElementById('splat');
  if (!c) return;
  c.width = 480; c.height = 300;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  const n = Math.floor(5 + amount * 12);
  for (let i = 0; i < n; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height * 0.8, r = 4 + Math.random() * 26 * amount;
    g.fillStyle = `rgba(${90 + Math.random() * 50},0,${Math.random() * 10},${0.55 + Math.random() * 0.4})`;
    g.beginPath(); g.ellipse(x, y, r, r * (0.6 + Math.random() * 0.6), Math.random() * 3, 0, Math.PI * 2); g.fill();
    // drips
    for (let d = 0; d < 3; d++) { const dx = x + (Math.random() - 0.5) * r; g.fillRect(dx, y, 1.5 + Math.random() * 3, r * (1 + Math.random() * 3)); }
    for (let s = 0; s < 8; s++) { const a = Math.random() * 6.28, rr = r * (1.2 + Math.random() * 1.6); g.beginPath(); g.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 1 + Math.random() * 3, 0, 6.28); g.fill(); }
  }
  c.classList.add('on');
  setTimeout(() => c.classList.remove('on'), 1600 + amount * 900);
}

// small helpers for writing shots
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const lerpV = (a, b) => (k) => tmp.copy(a).lerp(b, k).clone();
/** a point that orbits a centre: radius, height, start and end angle (radians) */
export const orbit = (c, r, h, a0, a1) => (k) => new THREE.Vector3(c.x + Math.sin(a0 + (a1 - a0) * k) * r, c.y + h, c.z + Math.cos(a0 + (a1 - a0) * k) * r);

// ---------------------------------------------------------------------------
// Biscuit, seen from outside: only ever shown in cutscenes. A golden retriever mix, eight
// years old, grey around the muzzle, one ear that never stood up.
export const cineDog = { g: null };
export function makeCineDog(scene) {
  const fur = ps1Mat({ map: T.fur, color: 0xd0a468, emissive: 0x24180c });
  const dark = ps1Mat({ map: T.fur, color: 0x9a6c3a, emissive: 0x140c06 });
  const grey = ps1Mat({ map: T.fur, color: 0xc8beb0 });
  const black = ps1Mat({ color: 0x0a0806 });
  const g = new THREE.Group(); scene.add(g); g.visible = false;
  const body = new THREE.Group(); body.position.y = 0.42; g.add(body);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), fur); torso.scale.set(0.85, 0.85, 1.9); body.add(torso);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), fur); chest.position.set(0, 0.03, -0.26); body.add(chest);
  const neck = new THREE.Group(); neck.position.set(0, 0.12, -0.34); body.add(neck);
  const nm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.22, 8), fur); nm.rotation.x = 0.6; nm.position.set(0, 0.05, -0.04); neck.add(nm);
  const head = new THREE.Group(); head.position.set(0, 0.16, -0.12); neck.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), fur); skull.scale.set(0.95, 0.9, 1.05); head.add(skull);
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.075, 0.15), grey); muzzle.position.set(0, -0.035, -0.13); head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.035, 0.03), black); nose.position.set(0, -0.012, -0.21); head.add(nose);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.017, 6, 4), black); eye.position.set(s * 0.05, 0.025, -0.085); head.add(eye);
    const ear = new THREE.Group(); ear.position.set(s * 0.085, 0.05, 0.0); head.add(ear);
    const em = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.15, 0.09), dark); em.position.y = -0.07; ear.add(em);
    ear.rotation.z = s * (s > 0 ? 0.25 : 0.7); // the left one never stood up
  }
  const legs = [];
  for (const [x, z] of [[-0.1, -0.26], [0.1, -0.26], [-0.1, 0.27], [0.1, 0.27]]) {
    const hip = new THREE.Group(); hip.position.set(x, -0.05, z); body.add(hip);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.22, 6), fur); up.position.y = -0.11; hip.add(up);
    const knee = new THREE.Group(); knee.position.y = -0.21; hip.add(knee);
    const lo = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.028, 0.16, 6), fur); lo.position.y = -0.08; knee.add(lo);
    const paw = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.035, 0.08), dark); paw.position.set(0, -0.17, -0.015); knee.add(paw);
    legs.push({ hip, knee, front: z < 0 });
  }
  const tail = new THREE.Group(); tail.position.set(0, 0.07, 0.36); body.add(tail);
  const tm = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.03, 0.26, 6), fur); tm.position.y = 0.12; tail.add(tm);
  tail.rotation.x = 2.0;
  Object.assign(cineDog, { g, body, neck, head, legs, tail, mode: 'stand', t: 0 });
  return cineDog;
}
/** pose him: 'stand' | 'run' | 'walk' | 'cower' | 'lie' | 'tremble' | 'wag' */
export function poseCineDog(x, y, z, yaw, mode, dt) {
  const D = cineDog; if (!D.g) return;
  D.g.visible = true; D.t += dt;
  D.g.position.set(x, y, z); D.g.rotation.y = yaw;
  const t = D.t, run = mode === 'run', walk = mode === 'walk';
  const sp = run ? 14 : 7;
  D.body.position.y = mode === 'lie' ? 0.2 : mode === 'cower' ? 0.34 : 0.42 + (run ? Math.abs(Math.sin(t * sp)) * 0.05 : 0);
  D.body.rotation.x = mode === 'cower' ? -0.12 : run ? Math.sin(t * sp) * 0.06 : 0;
  D.legs.forEach((l, i) => {
    const ph = (i === 0 || i === 3 ? 0 : Math.PI) + (l.front ? 0 : 0.3);
    const s = run || walk ? Math.sin(t * sp + ph) * (run ? 0.9 : 0.45) : 0;
    l.hip.rotation.x = mode === 'lie' ? (l.front ? -1.45 : 1.4) : s;
    l.knee.rotation.x = mode === 'lie' ? (l.front ? 0.1 : -0.3) : Math.max(0, -s) * (l.front ? -0.6 : 0.8);
  });
  D.neck.rotation.x = mode === 'cower' ? 0.55 : mode === 'lie' ? 0.35 : run ? -0.15 : -0.05;
  D.head.rotation.y = mode === 'tremble' ? Math.sin(t * 40) * 0.03 : 0;
  D.tail.rotation.x = mode === 'cower' || mode === 'tremble' ? 2.85 : mode === 'wag' ? 1.3 : run ? 1.7 : 2.0;
  D.tail.rotation.z = mode === 'wag' ? Math.sin(t * 18) * 0.7 : 0;
  if (mode === 'tremble' || mode === 'cower') D.body.position.x = Math.sin(t * 50) * 0.006;
}
/** where his head is, and a camera in front of his face (side: + to his left) */
export function dogHeadAt(p, yaw) { return new THREE.Vector3(p.x - Math.sin(yaw) * 0.46, (p.y || 0) + 0.7, p.z - Math.cos(yaw) * 0.46); }
export function dogFaceCam(p, yaw, dist = 0.9, side = 0.25, up = 0.04) { const h = dogHeadAt(p, yaw); return new THREE.Vector3(h.x - Math.sin(yaw) * dist + Math.cos(yaw) * side, h.y + up, h.z - Math.cos(yaw) * dist - Math.sin(yaw) * side); }
export function hideCineDog() { if (cineDog.g) cineDog.g.visible = false; }
