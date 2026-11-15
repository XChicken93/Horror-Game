// PS1-style rendering: vertex lighting, perspective-correct textures (no warping or jitter),
// per-vertex fog, low internal resolution, 15-bit colour with ordered dithering.
import * as THREE from '../vendor/three.module.js';

export const MAX_LIGHTS = 14;

// Global uniforms shared by every PS1 material.
export const G = {
  uLightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
  uLightCol: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
  uLightRange: { value: new Array(MAX_LIGHTS).fill(1) },
  uLightMin: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3(-999, -999, -999)) },
  uLightMax: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3(999, 999, 999)) },
  uAmbient: { value: new THREE.Vector3(0.05, 0.05, 0.07) },
  uCamPos: { value: new THREE.Vector3() },
  uCamLight: { value: new THREE.Vector3(0.26, 0.24, 0.24) },
  uFogColor: { value: new THREE.Vector3(0.03, 0.029, 0.033) },
  uFogNear: { value: 0.8 },
  uFogFar: { value: 9.0 },
  uSnap: { value: new THREE.Vector2(160, 120) },
  uTime: { value: 0 },
  uCO: { value: 0 },
  uSniff: { value: 0 },
};

const vert = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
uniform vec3 uLightPos[${MAX_LIGHTS}];
uniform vec3 uLightCol[${MAX_LIGHTS}];
uniform float uLightRange[${MAX_LIGHTS}];
uniform vec3 uLightMin[${MAX_LIGHTS}];
uniform vec3 uLightMax[${MAX_LIGHTS}];
uniform vec3 uAmbient;
uniform vec3 uCamPos;
uniform vec3 uCamLight;
uniform vec2 uSnap;
uniform float uTime;
uniform float uCO;
uniform float uFogNear;
uniform float uFogFar;
uniform float uUnlit;
uniform float uWobble;
uniform vec3 uEmissive;
varying vec2 vUv;
varying vec3 vLight;
varying float vFog;

float inBox(vec3 p, vec3 mn, vec3 mx){
  vec3 a = smoothstep(mn - 0.25, mn + 0.05, p);
  vec3 b = 1.0 - smoothstep(mx - 0.05, mx + 0.25, p);
  return a.x * a.y * a.z * b.x * b.y * b.z;
}

void main(){
  // skinned characters: one continuous mesh deformed by a skeleton
  vec3 transformed = position;
  vec3 objectNormal = normal;
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
  vec4 wp = modelMatrix * vec4(transformed, 1.0);
  vec3 n = normalize(mat3(modelMatrix) * objectNormal);
  vec3 L = uAmbient;
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    vec3 d = uLightPos[i] - wp.xyz;
    float dist = max(length(d), 0.001);
    float att = clamp(1.0 - dist / uLightRange[i], 0.0, 1.0);
    att *= att;
    float ndl = max(dot(n, d / dist) * 0.9 + 0.1, 0.0);
    L += uLightCol[i] * att * ndl * inBox(wp.xyz, uLightMin[i], uLightMax[i]) * 1.9;
  }
  vec3 dc = uCamPos - wp.xyz;
  float dcl = length(dc);
  float catt = clamp(1.0 - dcl / 4.0, 0.0, 1.0);
  L += uCamLight * catt * catt * max(dot(n, dc / max(dcl, 0.001)), 0.0);
  L = mix(L, vec3(1.0), uUnlit);
  vLight = L + uEmissive;

  vec4 mv = viewMatrix * wp;
  vec4 p = projectionMatrix * mv;
  // stable geometry and perspective-correct textures: no jitter, no warping
  gl_Position = p;
  vUv = uv;
  float fd = length(mv.xyz);
  vFog = clamp((fd - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
}`;

const frag = /* glsl */ `
uniform sampler2D map;
uniform float uHasMap;
uniform vec3 uColor;
uniform vec3 uFogColor;
uniform float uSniff;
uniform float uOpacity;
uniform float uNoFog;
varying vec2 vUv;
varying vec3 vLight;
varying float vFog;
void main(){
  vec2 uv = vUv;
  vec4 t = uHasMap > 0.5 ? texture2D(map, uv) : vec4(1.0);
  if (t.a < 0.5) discard;
  vec3 c = t.rgb * uColor * min(vLight, vec3(2.2));
  float g = dot(c, vec3(0.3, 0.59, 0.11));
  c = mix(c, vec3(g * 0.55, g * 0.6, g * 0.78), uSniff * 0.85);
  c = mix(c, uFogColor, vFog * (1.0 - uNoFog));
  gl_FragColor = vec4(c, uOpacity);
}`;

const cache = new Map();

/**
 * Create (or reuse) a PS1 material.
 * opts: map, color, unlit, emissive, opacity, side, wobble, noFog, unique
 */
export function ps1Mat(opts = {}) {
  const key = opts.unique ? null : [
    opts.map ? opts.map.uuid : '-', opts.color ?? 0xffffff, opts.unlit ? 1 : 0,
    opts.emissive ?? 0, opts.opacity ?? 1, opts.side ?? 0, opts.wobble ?? 1, opts.noFog ? 1 : 0,
  ].join('|');
  if (key && cache.has(key)) return cache.get(key);
  const col = new THREE.Color(opts.color ?? 0xffffff);
  const em = new THREE.Color(opts.emissive ?? 0x000000);
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...G,
      map: { value: opts.map || null },
      uHasMap: { value: opts.map ? 1 : 0 },
      uColor: { value: new THREE.Vector3(col.r, col.g, col.b) },
      uEmissive: { value: new THREE.Vector3(em.r, em.g, em.b) },
      uUnlit: { value: opts.unlit ? 1 : 0 },
      uOpacity: { value: opts.opacity ?? 1 },
      uWobble: { value: opts.wobble ?? 1 },
      uNoFog: { value: opts.noFog ? 1 : 0 },
    },
    vertexShader: vert,
    fragmentShader: frag,
    side: opts.side ?? THREE.FrontSide,
    transparent: (opts.opacity ?? 1) < 1,
    depthWrite: (opts.opacity ?? 1) >= 1,
  });
  if (key) cache.set(key, m);
  return m;
}

// ---------------------------------------------------------------------------
// Post-processing: upscale low-res buffer, CO hallucination, dither, quantise.
export const P = {
  tDiffuse: { value: null },
  uRes: { value: new THREE.Vector2(320, 240) },
  uTime: { value: 0 },
  uCO: { value: 0 },
  uFlash: { value: 0 },
  uFade: { value: 0 },
  uSniff: { value: 0 },
  uPulse: { value: 0 },
  uRed: { value: 0 },
  uBlackout: { value: 0 },
  uStretch: { value: 0 },
};

const postFrag = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uRes;
uniform float uTime, uCO, uFlash, uFade, uSniff, uPulse, uRed, uBlackout, uStretch;
varying vec2 vUv;
float b2(vec2 p){ return mod(p.x + p.y, 2.0) * 2.0 + p.y; }
float bayer4(vec2 p){
  p = mod(p, 4.0);
  vec2 s = mod(p, 2.0);
  vec2 l = floor(p / 2.0);
  return 4.0 * b2(s) + b2(l);
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 uv = vUv;
  float co = uCO;
  float h = smoothstep(0.25, 1.0, co);
  // breathing tunnel stretch
  vec2 cc = uv - 0.5;
  cc *= 1.0 - uStretch * 0.08; // tunnel vision, steady
  uv = cc + 0.5;
  vec2 px = floor(uv * uRes) + 0.5;
  vec2 suv = px / uRes;
  vec3 c = texture2D(tDiffuse, suv).rgb;
  // double vision
  float dv = h * 0.012;
  vec3 c2 = texture2D(tDiffuse, suv + vec2(dv, dv * 0.35)).rgb;
  c = mix(c, max(c, c2 * 0.9), 0.55 * h);
  // chromatic split
  float ch = h * 0.006 + uRed * 0.01;
  c.r = mix(c.r, texture2D(tDiffuse, suv + vec2(ch, 0.0)).r, 0.7);
  c.b = mix(c.b, texture2D(tDiffuse, suv - vec2(ch, 0.0)).b, 0.7);
  // sniff vision tint + grain
  float grain = hash(px + fract(uTime) * 91.0) - 0.5;
  c += grain * (0.025 + uSniff * 0.04 + h * 0.03);
  // vignette, pulses with the heartbeat
  float v = length(vUv - 0.5);
  c *= 1.0 - smoothstep(0.28, 0.78, v) * (0.55 + h * 0.6 + uPulse * h * 0.35);
  c *= 1.0 - uPulse * 0.22 * h;
  // flashes, red, blackout
  c += vec3(uFlash * 0.9, uFlash * 0.92, uFlash);
  c = mix(c, c * vec3(1.3, 0.25, 0.2) + vec3(0.12, 0.0, 0.0), uRed);
  c *= 1.0 - uBlackout;
  // ordered dither + 15-bit colour
  float d = (bayer4(floor(vUv * uRes)) / 16.0 - 0.5) / 31.0 * 1.6;
  c = floor(clamp(c + d, 0.0, 1.0) * 31.0 + 0.5) / 31.0;
  c *= 1.0 - uFade;
  gl_FragColor = vec4(c, 1.0);
}`;

export function makePost() {
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: P,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: postFrag,
    depthTest: false, depthWrite: false,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  return { scene, cam };
}

// Give a BoxGeometry world-planar UVs so textures tile at `scale` metres per repeat.
export function planarUV(geo, offset, scale = 1) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + offset.x, y = pos.getY(i) + offset.y, z = pos.getZ(i) + offset.z;
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let u, v;
    if (nx >= ny && nx >= nz) { u = z; v = y; }
    else if (ny >= nx && ny >= nz) { u = x; v = z; }
    else { u = x; v = y; }
    uv.setXY(i, u / scale, v / scale);
  }
  uv.needsUpdate = true;
}
