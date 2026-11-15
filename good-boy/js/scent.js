// Scent vision: drifting coloured motes only a dog can see.
import * as THREE from '../vendor/three.module.js';
import { G } from './ps1.js';

const MAX = 2600;
export const SCENT = {
  father: { col: [0.35, 0.55, 1.0], label: 'THE MAN', desc: 'sawdust, cold coffee, tired sweat. sadness, old and heavy.' },
  mother: { col: [0.95, 0.45, 0.85], label: 'THE WOMAN', desc: 'dish soap, lavender, salt. she has been crying again.' },
  lily: { col: [0.45, 1.0, 0.5], label: 'THE GIRL', desc: 'warm milk, crayons, sleep. she smells like home.' },
  danny: { col: [1.0, 0.85, 0.3], label: 'DANNY', desc: 'faint. old. it goes this way. he went this way.' },
  dannyStrong: { col: [1.0, 0.9, 0.35], label: 'DANNY', desc: 'DANNY. strong. right here. he is HERE.' },
  dannyFaint: { col: [1.0, 0.85, 0.3], label: 'DANNY', desc: 'his ball. it still smells of his hands.' },
  wrong: { col: [0.6, 0.6, 0.62], label: 'WRONG', desc: 'from below. hot metal, burnt-sweet, wrong. it makes your head heavy.' },
  food: { col: [0.9, 0.55, 0.25], label: 'FOOD', desc: 'your bowl. empty. they forgot again.' },
  outside: { col: [0.7, 0.85, 1.0], label: 'OUTSIDE', desc: 'snow, pine, cold, clean air under the door.' },
};

let geo, pts, posA, colA, sizeA, lifeA;
const vel = new Float32Array(MAX * 3);
const maxLife = new Float32Array(MAX);
let head = 0;
export const mat = new THREE.ShaderMaterial({
  uniforms: { uSniff: G.uSniff, uTime: G.uTime },
  vertexShader: `
    attribute vec3 color; attribute float size; attribute float life;
    uniform float uSniff;
    varying vec3 vCol; varying float vA;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec4 p = projectionMatrix * mv;
      gl_Position = p;
      gl_PointSize = clamp(size * 110.0 / max(-mv.z, 0.3), 1.0, 4.0);
      vCol = color;
      vA = clamp(life, 0.0, 1.0) * uSniff;
    }`,
  fragmentShader: `
    varying vec3 vCol; varying float vA;
    void main(){ if (vA < 0.02) discard; gl_FragColor = vec4(vCol * vA, 1.0); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});

export function initScent(scene) {
  geo = new THREE.BufferGeometry();
  posA = new Float32Array(MAX * 3); colA = new Float32Array(MAX * 3); sizeA = new Float32Array(MAX); lifeA = new Float32Array(MAX);
  geo.setAttribute('position', new THREE.BufferAttribute(posA, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colA, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizeA, 1));
  geo.setAttribute('life', new THREE.BufferAttribute(lifeA, 1));
  pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 5;
  scene.add(pts);
}

export function emit(x, y, z, kind, o = {}) {
  const i = head; head = (head + 1) % MAX;
  const c = SCENT[kind].col;
  posA[i * 3] = x + (Math.random() - 0.5) * (o.spread ?? 0.2);
  posA[i * 3 + 1] = y + (Math.random() - 0.5) * (o.spreadY ?? 0.1);
  posA[i * 3 + 2] = z + (Math.random() - 0.5) * (o.spread ?? 0.2);
  colA[i * 3] = c[0]; colA[i * 3 + 1] = c[1]; colA[i * 3 + 2] = c[2];
  sizeA[i] = o.size ?? 0.035;
  const L = o.life ?? 4;
  lifeA[i] = 1; maxLife[i] = L;
  vel[i * 3] = o.vx ?? (Math.random() - 0.5) * 0.05;
  vel[i * 3 + 1] = o.vy ?? 0.03 + Math.random() * 0.03;
  vel[i * 3 + 2] = o.vz ?? (Math.random() - 0.5) * 0.05;
}

export function updateScent(dt, t) {
  for (let i = 0; i < MAX; i++) {
    if (lifeA[i] <= 0) continue;
    lifeA[i] -= dt / maxLife[i];
    posA[i * 3] += vel[i * 3] * dt + Math.sin(t * 1.3 + i) * 0.002;
    posA[i * 3 + 1] += vel[i * 3 + 1] * dt;
    posA[i * 3 + 2] += vel[i * 3 + 2] * dt + Math.cos(t * 1.1 + i) * 0.002;
  }
  geo.attributes.position.needsUpdate = true;
  geo.attributes.life.needsUpdate = true;
  geo.attributes.color.needsUpdate = true;
  geo.attributes.size.needsUpdate = true;
}

// Danny's old trail: from his bedroom door, to the front door (where he left),
// back along the hall to the basement door, down the stairs to his boxes.
export const DANNY_TRAIL = [
  [9.45, 3.7], [9.0, 4.25], [6, 4.25], [2.2, 4.3], [1.5, 5.2], [1.5, 7.2], [1.5, 9.4],
  [1.6, 7.0], [1.8, 5.0], [4, 4.2], [8, 4.2], [12.2, 4.25], [13.3, 3.7],
];
export const DANNY_TRAIL_DOWN = [[13.3, 3.2, 0], [13.3, 2.0, -1.3], [13.3, 0.6, -2.6], [13.0, -0.5, -2.8], [12.6, -2.2, -2.8], [12.4, -3.1, -2.8]];
