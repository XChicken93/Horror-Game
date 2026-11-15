// Biscuit: first-person dog controller.
import * as THREE from '../vendor/three.module.js';
import { ps1Mat } from './ps1.js';
import { collide, floorAt, BASE_Y } from './house.js';
import { step } from './audio.js';

export const keys = new Set();
export const input = { mdx: 0, mdy: 0, sniff: false, eDown: false, eStart: 0, cDown: false, cStart: 0, locked: false, enabled: false };

export const dog = {
  pos: new THREE.Vector3(1.5, 0, 8.9), yaw: 0, pitch: -0.05, y: 0,
  eye: 0.42, lying: 0, carrying: null, stepT: 0, bob: 0, moving: false, speed: 0,
  stumble: 0, roll: 0, barkKick: 0, frozen: false, radius: 0.21,
};

export function initInput(canvas, handlers) {
  addEventListener('keydown', (e) => {
    if (!input.enabled) { if (handlers.anyKey) handlers.anyKey(e); return; }
    const k = e.key.toLowerCase();
    if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
    if (e.repeat) return;
    keys.add(k);
    if (k === ' ') handlers.bark();
    if (k === 'q') handlers.whine();
    if (k === 'e') { input.eDown = true; input.eStart = performance.now(); input.eUsedHold = false; }
    if (k === 'c') { input.cDown = true; input.cStart = performance.now(); }
    if (k === 'f') input.sniff = true;
  });
  addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    keys.delete(k);
    if (!input.enabled) return;
    if (k === 'e') {
      const held = performance.now() - input.eStart;
      input.eDown = false;
      if (!input.eUsedHold && held < 600) handlers.interact();
    }
    if (k === 'c') input.cDown = false;
    if (k === 'f') input.sniff = false;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (!input.enabled) return;
    if (e.button === 2) input.sniff = true;
    if (!input.locked && canvas.requestPointerLock) canvas.requestPointerLock();
    input.drag = true;
  });
  addEventListener('mouseup', (e) => { if (e.button === 2) input.sniff = false; input.drag = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => { input.locked = document.pointerLockElement === canvas; });
  addEventListener('mousemove', (e) => {
    if (!input.enabled) return;
    if (input.locked || input.drag) { input.mdx += e.movementX; input.mdy += e.movementY; }
  });
  addEventListener('blur', () => { keys.clear(); input.sniff = false; input.eDown = false; input.cDown = false; });
}

export function makeSnout(camera) {
  const g = new THREE.Group();
  const fur = ps1Mat({ color: 0xa07040, emissive: 0x1c120a });
  const dark = ps1Mat({ color: 0x5a3a20, emissive: 0x0e0905 });
  const m1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.1), fur); m1.position.set(0, 0, 0); g.add(m1);
  const m2 = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.026, 0.05), dark); m2.position.set(0, -0.003, -0.06); g.add(m2);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.016, 0.016), ps1Mat({ color: 0x0a0806 })); nose.position.set(0, 0.006, -0.088); g.add(nose);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 0.07), dark); jaw.position.set(0, -0.022, -0.03); g.add(jaw);
  g.position.set(0, -0.112, -0.2);
  g.rotation.x = 0.12;
  camera.add(g);
  dog.snout = g; dog.jaw = jaw;
  const mouth = new THREE.Group(); mouth.position.set(0, -0.13, -0.42); camera.add(mouth);
  dog.mouth = mouth;
  return g;
}

const fwd = new THREE.Vector3(), right = new THREE.Vector3();
// stand close to these and Biscuit puts his front paws up to see over them
const PAWS_UP = [
  [0.3, 2.62, 0.0, 2.6],   // parents' bed
  [6.45, 7.95, 0.1, 2.4],  // Lily's bed
  [4.75, 7.25, 7.75, 8.35],// couch seat
];
export function updateDog(dt, camera, co, t) {
  const d = dog;
  // look
  const sens = 0.0023;
  d.yaw -= input.mdx * sens; d.pitch -= input.mdy * sens;
  input.mdx = 0; input.mdy = 0;
  if (keys.has('arrowleft')) d.yaw += dt * 2.2;
  if (keys.has('arrowright')) d.yaw -= dt * 2.2;
  if (keys.has('arrowup')) d.pitch += dt * 1.5;
  if (keys.has('arrowdown')) d.pitch -= dt * 1.5;
  d.pitch = Math.max(-1.1, Math.min(1.25, d.pitch));
  // stumble / drift when poisoned
  if (co > 0.55) {
    d.stumble += dt * (0.6 + co);
    d.yaw += Math.sin(d.stumble * 0.9) * dt * (co - 0.55) * 0.5;
  }
  // move
  let mx = 0, mz = 0;
  if (!d.frozen) {
    if (keys.has('w')) mz += 1; if (keys.has('s')) mz -= 1;
    if (keys.has('a')) mx -= 1; if (keys.has('d')) mx += 1;
  }
  const lyingNow = input.cDown && !d.frozen;
  d.lying += ((lyingNow ? 1 : 0) - d.lying) * Math.min(1, dt * 4);
  if (lyingNow) { mx = 0; mz = 0; }
  const run = keys.has('shift');
  let sp = (run ? 3.9 : 1.9) * (1 - co * 0.5);
  if (input.sniff) sp *= 0.55;
  fwd.set(-Math.sin(d.yaw), 0, -Math.cos(d.yaw));
  right.set(Math.cos(d.yaw), 0, -Math.sin(d.yaw));
  const len = Math.hypot(mx, mz);
  d.moving = len > 0;
  if (len > 0) {
    const vx = (fwd.x * mz + right.x * mx) / len * sp, vz = (fwd.z * mz + right.z * mx) / len * sp;
    d.pos.x += vx * dt; d.pos.z += vz * dt;
    d.bob += dt * sp * 4.2;
    d.stepT -= dt;
    if (d.stepT <= 0) {
      d.stepT = run ? 0.13 : 0.2;
      const onStairs = d.pos.x > 12.5 && d.pos.z > 0.4 && d.pos.z < 3.0;
      const carpet = (d.pos.z < 3.5 && d.pos.x < 8) || (Math.abs(d.pos.z - 4.25) < 0.35);
      step(onStairs ? 'stair' : carpet ? 'soft' : 'claw', undefined, undefined, undefined, onStairs ? 0.5 : 1);
    }
  }
  d.speed = len > 0 ? sp : 0;
  collide(d.pos, d.radius, d.y, 0.5);
  const fy = floorAt(d.pos.x, d.pos.z, d.y);
  d.y += (fy - d.y) * Math.min(1, dt * 14);
  d.pos.y = d.y;
  // paws up on beds and the couch
  let pawsUp = false;
  if (!lyingNow && d.y > -0.1) for (const [x0, x1, z0, z1] of PAWS_UP) if (d.pos.x > x0 && d.pos.x < x1 && d.pos.z > z0 && d.pos.z < z1) pawsUp = true;
  d.paws = (d.paws || 0) + ((pawsUp ? 1 : 0) - (d.paws || 0)) * Math.min(1, dt * 5);
  // camera
  const eye = d.eye - d.lying * 0.24 + d.paws * 0.42;
  const bob = d.moving ? Math.sin(d.bob) * 0.018 : Math.sin(t * 1.6) * 0.004;
  camera.position.set(d.pos.x, d.y + eye + bob, d.pos.z);
  const targetRoll = (d.moving ? Math.cos(d.bob * 0.5) * 0.012 : 0) + (co > 0.4 ? Math.sin(t * 0.37) * (co - 0.4) * 0.22 : 0);
  d.roll += (targetRoll - d.roll) * Math.min(1, dt * 3);
  camera.rotation.set(d.pitch + d.barkKick * 0.08, d.yaw, d.roll, 'YXZ');
  d.barkKick = Math.max(0, d.barkKick - dt * 5);
  if (d.snout) {
    d.snout.position.y = -0.112 - d.barkKick * 0.03 + (d.moving ? Math.sin(d.bob) * 0.006 : 0);
    d.jaw.position.y = -0.022 - d.barkKick * 0.015;
  }
  return d;
}

export function dogForward() { return new THREE.Vector3(-Math.sin(dog.yaw), 0, -Math.cos(dog.yaw)); }
export function inBasement() { return dog.y < -0.6; }
export { BASE_Y };
