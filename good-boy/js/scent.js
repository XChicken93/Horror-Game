// Scent vision: drifting coloured motes only a dog can see.
import * as THREE from '../vendor/three.module.js';
import { G } from './ps1.js';

const MAX = 4200;
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
  dannyOld: { col: [1.0, 0.8, 0.25], label: 'DANNY', desc: 'very old, under the snow. a year old. his boots, and yours beside them.' },
  deer: { col: [0.85, 0.42, 0.22], label: 'DEER', desc: 'deer. musk and frozen grass. the smell that made you run, that night.' },
  bone: { col: [0.95, 0.9, 0.7], label: 'BONE', desc: 'yours. you buried it in October. it is still down there.' },
  exhaust: { col: [0.75, 0.72, 0.7], label: 'HOT METAL', desc: 'under the snow drift: hot metal, burnt-sweet. the hot box breathes out here. it cannot breathe.' },
  tin: { col: [1.0, 0.82, 0.3], label: 'DANNY + YOU', desc: 'his hands and your paws, and rusty tin. deep under the snow and the dirt.' },
};
// Scents that belong together are tracked together.
const GROUP_OF = { father: 0, mother: 1, lily: 2, danny: 3, dannyStrong: 3, dannyFaint: 3, dannyOld: 3, tin: 3, wrong: 4, exhaust: 4, food: 5, outside: 6, deer: 7, bone: 8 };
export const TRACK_NAME = ['THE MAN', 'THE WOMAN', 'THE GIRL', 'DANNY', 'THE BAD AIR', 'FOOD', 'OUTSIDE', 'DEER', 'YOUR BONE'];
export const groupOf = (kind) => GROUP_OF[kind] ?? -1;
// which scent is being followed (-1 = none)
export const TRACK = { group: -1, kind: null };
const uTrack = { value: -1 };
export function setTrack(kind) {
  TRACK.kind = kind; TRACK.group = kind ? groupOf(kind) : -1; uTrack.value = TRACK.group;
}

let geo, pts, posA, colA, sizeA, lifeA, grpA, faintA;
const vel = new Float32Array(MAX * 3);
const maxLife = new Float32Array(MAX);
let head = 0;
export const mat = new THREE.ShaderMaterial({
  uniforms: { uSniff: G.uSniff, uTime: G.uTime, uTrack },
  vertexShader: `
    attribute vec3 color; attribute float size; attribute float life; attribute float grp; attribute float faint;
    uniform float uSniff; uniform float uTrack; uniform float uTime;
    varying vec3 vCol; varying float vA;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec4 p = projectionMatrix * mv;
      gl_Position = p;
      float sz = size;
      vec3 c = color;
      float a = clamp(life, 0.0, 1.0) * uSniff * (1.0 - faint * 0.85);
      if (uTrack > -0.5) {
        if (abs(grp - uTrack) < 0.5) {
          // the one you follow: brighter, bigger, more saturated, and it stays faintly
          // visible even when you lift your nose
          float g = dot(c, vec3(0.3, 0.59, 0.11));
          c = clamp(mix(vec3(g), c, 1.6) * 1.7, 0.0, 1.0);
          sz *= 1.7;
          a = clamp(life, 0.0, 1.0) * max(uSniff, 0.4) * (0.85 + 0.15 * sin(uTime * 6.0 + position.x * 3.0));
        } else {
          float g = dot(c, vec3(0.3, 0.59, 0.11));
          c = vec3(g) * 0.55;
          a *= 0.28;
        }
      }
      gl_PointSize = clamp(sz * 110.0 / max(-mv.z, 0.3), 1.0, 6.0);
      vCol = c;
      vA = a;
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
  grpA = new Float32Array(MAX).fill(-1); faintA = new Float32Array(MAX);
  geo.setAttribute('grp', new THREE.BufferAttribute(grpA, 1));
  geo.setAttribute('faint', new THREE.BufferAttribute(faintA, 1));
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
  grpA[i] = groupOf(kind); faintA[i] = o.faint ?? 0;
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
  geo.attributes.grp.needsUpdate = true;
  geo.attributes.faint.needsUpdate = true;
}

// Danny's old trail: from his bedroom door, to the front door (where he left),
// back along the hall to the basement door, down the stairs to his boxes.
export const DANNY_TRAIL = [
  [9.45, 3.7], [9.0, 4.25], [6, 4.25], [2.2, 4.3], [1.5, 5.2], [1.5, 7.2], [1.5, 9.4],
  [1.6, 7.0], [1.8, 5.0], [4, 4.2], [8, 4.2], [12.2, 4.25], [13.3, 3.7],
];
// Out back: Danny's old path from the back door to the oak where you buried things together,
// and the last trail of all, a year old, from the tree to the field gate.
export const DANNY_TRAIL_YARD = [[14.3, 4.25], [16.0, 4.6], [17.8, 5.6], [19.6, 6.8], [21.4, 7.6], [22.5, 8.1]];
export const DANNY_TRAIL_GATE = [[22.5, 8.1], [23.6, 6.6], [24.8, 5.2], [26.2, 4.4], [27.5, 3.95], [29.5, 3.6], [32, 3.6], [34.2, 4.0], [35.4, 4.0], [36.6, 3.7]];
export const DEER_TRAIL = [[27.9, -4.5], [26.0, -3.0], [24.2, -1.0], [23.0, 1.2], [24.5, 2.8], [26.5, 3.6], [27.6, 3.9], [30, 4.5]];
export const DANNY_TRAIL_DOWN = [[13.3, 3.2, 0], [13.3, 2.0, -1.3], [13.3, 0.6, -2.6], [13.0, -0.5, -2.8], [12.6, -2.2, -2.8], [12.4, -3.1, -2.8]];
