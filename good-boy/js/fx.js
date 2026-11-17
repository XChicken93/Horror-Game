// Things you can actually see in the air: falling snow out back, snow and dirt thrown up
// by your paws, your breath in the cold, the furnace pipe steaming once it is dug out.
import * as THREE from '../vendor/three.module.js';
import { G } from './ps1.js';

const MAX = 1400;
const FLAKES = 520;
let geo, posA, colA, sizeA, lifeA;
const vel = new Float32Array(MAX * 3);
const maxLife = new Float32Array(MAX);
const grav = new Float32Array(MAX);
let head = FLAKES;

const mat = new THREE.ShaderMaterial({
  uniforms: { uFogColor: G.uFogColor, uFogFar: G.uFogFar },
  vertexShader: `
    attribute vec3 color; attribute float size; attribute float life;
    uniform float uFogFar;
    varying vec3 vCol; varying float vA;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = clamp(size * 120.0 / max(-mv.z, 0.2), 1.0, 7.0);
      float fog = clamp(-mv.z / (uFogFar * 1.2), 0.0, 1.0);
      vCol = color;
      vA = clamp(life, 0.0, 1.0) * (1.0 - fog);
    }`,
  fragmentShader: `
    uniform vec3 uFogColor;
    varying vec3 vCol; varying float vA;
    void main(){ if (vA < 0.04) discard; gl_FragColor = vec4(mix(uFogColor, vCol, vA), 1.0); }`,
  depthWrite: false,
});

/** inside(x, y, z) -> true where no snow should fall (under the roof). */
let insideFn = () => false;
/** ash: grey-orange flakes instead of snow (the other side). inside2: extra roofed places. */
export const FXCFG = { ash: false, inside2: null };

export function initFx(scene, inside) {
  insideFn = inside;
  geo = new THREE.BufferGeometry();
  posA = new Float32Array(MAX * 3); colA = new Float32Array(MAX * 3); sizeA = new Float32Array(MAX); lifeA = new Float32Array(MAX);
  geo.setAttribute('position', new THREE.BufferAttribute(posA, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colA, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizeA, 1));
  geo.setAttribute('life', new THREE.BufferAttribute(lifeA, 1));
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 4;
  scene.add(pts);
  for (let i = 0; i < FLAKES; i++) { lifeA[i] = 0; posA[i * 3 + 1] = -99; }
}

export function puff(x, y, z, o = {}) {
  const i = head; head = head + 1 >= MAX ? FLAKES : head + 1;
  const s = o.spread ?? 0.05;
  posA[i * 3] = x + (Math.random() - 0.5) * s;
  posA[i * 3 + 1] = y + (Math.random() - 0.5) * s;
  posA[i * 3 + 2] = z + (Math.random() - 0.5) * s;
  const c = o.col || [0.85, 0.88, 0.95];
  const k = 0.85 + Math.random() * 0.15;
  colA[i * 3] = c[0] * k; colA[i * 3 + 1] = c[1] * k; colA[i * 3 + 2] = c[2] * k;
  sizeA[i] = o.size ?? 0.02;
  maxLife[i] = o.life ?? 1;
  lifeA[i] = 1;
  vel[i * 3] = o.vx ?? 0; vel[i * 3 + 1] = o.vy ?? 0; vel[i * 3 + 2] = o.vz ?? 0;
  grav[i] = o.grav ?? 0;
}

/** snow kicked up by digging paws, thrown back between the legs and to the sides */
export function spray(x, y, z, yaw, o = {}) {
  const n = o.n ?? 6;
  const bx = Math.sin(yaw), bz = Math.cos(yaw); // backwards
  for (let i = 0; i < n; i++) {
    const side = (Math.random() - 0.5) * 1.6;
    const sp = 0.8 + Math.random() * 1.4;
    puff(x, y, z, {
      col: o.col || (Math.random() < 0.25 ? [0.42, 0.36, 0.3] : [0.86, 0.9, 0.98]),
      vx: (bx + Math.cos(yaw) * side) * sp, vy: 1.0 + Math.random() * 1.6, vz: (bz - Math.sin(yaw) * side) * sp,
      grav: 5.5, life: 0.7 + Math.random() * 0.4, size: 0.018 + Math.random() * 0.02, spread: 0.12,
    });
  }
}

/** your breath, in cold air */
export function breath(x, y, z, fx, fz, strength = 1) {
  for (let i = 0; i < 5 * strength; i++) {
    puff(x + fx * 0.18, y, z + fz * 0.18, { col: [0.7, 0.72, 0.78], vx: fx * (0.25 + Math.random() * 0.3), vy: 0.12, vz: fz * (0.25 + Math.random() * 0.3), life: 0.9 + Math.random() * 0.6, size: 0.03 + Math.random() * 0.03, spread: 0.05 });
  }
}

export function updateFx(dt, cam, wind = 0, snowing = true) {
  // falling snow in a box around the camera, only where there is open sky
  for (let i = 0; i < FLAKES; i++) {
    let y = posA[i * 3 + 1];
    if (y < -0.05 || lifeA[i] <= 0 || Math.abs(posA[i * 3] - cam.x) > 7 || Math.abs(posA[i * 3 + 2] - cam.z) > 7) {
      if (!snowing) { lifeA[i] = 0; continue; }
      posA[i * 3] = cam.x + (Math.random() - 0.5) * 14;
      posA[i * 3 + 2] = cam.z + (Math.random() - 0.5) * 14;
      posA[i * 3 + 1] = y < -0.05 || lifeA[i] <= 0 ? 0.5 + Math.random() * 4 : 4;
      vel[i * 3 + 1] = -(0.6 + Math.random() * 0.6);
      vel[i * 3] = 0.6 + Math.random() * 0.5; vel[i * 3 + 2] = -0.25 + Math.random() * 0.5;
      const k = 0.75 + Math.random() * 0.25;
      if (FXCFG.ash) { const e = Math.random() < 0.12; colA[i * 3] = e ? 1.0 : 0.42 * k; colA[i * 3 + 1] = e ? 0.45 : 0.38 * k; colA[i * 3 + 2] = e ? 0.12 : 0.36 * k; }
      else { colA[i * 3] = 0.82 * k; colA[i * 3 + 1] = 0.86 * k; colA[i * 3 + 2] = 0.95 * k; }
      sizeA[i] = 0.012 + Math.random() * 0.014;
      lifeA[i] = 1;
    }
    posA[i * 3] += (vel[i * 3] * (1 + wind * 2) + Math.sin(posA[i * 3 + 1] * 2 + i) * 0.3) * dt;
    posA[i * 3 + 1] += vel[i * 3 + 1] * dt;
    posA[i * 3 + 2] += vel[i * 3 + 2] * dt;
    lifeA[i] = insideFn(posA[i * 3], posA[i * 3 + 1], posA[i * 3 + 2]) || (FXCFG.inside2 && FXCFG.inside2(posA[i * 3], posA[i * 3 + 1], posA[i * 3 + 2])) ? 0.001 : 1;
  }
  for (let i = FLAKES; i < MAX; i++) {
    if (lifeA[i] <= 0) continue;
    lifeA[i] -= dt / maxLife[i];
    vel[i * 3 + 1] -= grav[i] * dt;
    posA[i * 3] += vel[i * 3] * dt;
    posA[i * 3 + 1] += vel[i * 3 + 1] * dt;
    posA[i * 3 + 2] += vel[i * 3 + 2] * dt;
    if (grav[i] > 0 && posA[i * 3 + 1] < 0.01) { posA[i * 3 + 1] = 0.01; vel[i * 3] = vel[i * 3 + 1] = vel[i * 3 + 2] = 0; }
  }
  geo.attributes.position.needsUpdate = true;
  geo.attributes.color.needsUpdate = true;
  geo.attributes.size.needsUpdate = true;
  geo.attributes.life.needsUpdate = true;
}
