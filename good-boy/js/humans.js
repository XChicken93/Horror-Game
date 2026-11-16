// The family: low-poly bodies, procedural animation, pathing, muffled speech.
import * as THREE from '../vendor/three.module.js';
import { ps1Mat } from './ps1.js';
import { T } from './textures.js';
import { speak, step, setPos } from './audio.js';
import { roomAt, colliders } from './house.js';

// people can't walk through walls: push them back out of any wall they step into
function wallPush(pos, r, y) {
  for (const c of colliders) {
    if (c.tag !== 'wall' || c.disabled || y + 1.5 < c.minY || y > c.maxY - 0.05) continue;
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX)), cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); pos.x += dx / d * (r - d); pos.z += dz / d * (r - d); }
    else { const l = pos.x - c.minX, rr = c.maxX - pos.x, b = pos.z - c.minZ, f = c.maxZ - pos.z, m = Math.min(l, rr, b, f); if (m === l) pos.x = c.minX - r; else if (m === rr) pos.x = c.maxX + r; else if (m === b) pos.z = c.minZ - r; else pos.z = c.maxZ + r; }
  }
}

// ---------------------------------------------------------------------------
// Words a dog actually knows. Everything else is noise. Biscuit learns more words as
// the night goes on, so the family slowly becomes understandable.
export const VOCAB = new Set(['biscuit', 'good', 'boy', 'no', 'bed', 'quiet', 'outside', 'walk', 'danny', 'come', 'here',
  'food', 'bad', 'dog', 'sit', 'stay', 'okay', 'love', 'you', 'night', 'home', 'ball', 'down', 'hey', 'buddy']);
export const VOCAB_STATE = { all: false, total: 0 };
const norm = (w) => w.toLowerCase().replace(/[^a-z0-9-]/g, '');
export function learnWords(list) {
  const fresh = [];
  for (const w of list) { const k = norm(w); if (!VOCAB.has(k)) { VOCAB.add(k); fresh.push(w); } }
  return fresh;
}
export function knows(word) { return VOCAB_STATE.all || VOCAB.has(norm(word)); }
export function clarity() { return VOCAB_STATE.all ? 1 : Math.min(1, (VOCAB.size - 25) / 220); }
const SYL = ['mm', 'hrm', 'wuh', 'bah', 'mwa', 'nnh', 'rrh', 'hm', 'ah', 'muh', 'wha', 'gm', 'uhn', 'rah', 'meh', 'oh'];

export function garble(text, co = 0) {
  const words = text.split(/\s+/);
  let html = '', n = 0;
  for (const w of words) {
    const core = w.replace(/[^a-zA-Z'0-9-]/g, '');
    const punct = w.replace(/[a-zA-Z'0-9-]/g, '');
    const lc = core.toLowerCase();
    let syls = Math.max(1, Math.round(core.length / 3));
    n += syls;
    if (knows(core) && !(co > 0.88 && Math.random() < 0.35)) {
      html += `<b>${core}</b>${punct} `;
    } else {
      const parts = [];
      for (let i = 0; i < syls; i++) parts.push(SYL[(lc.charCodeAt(i % Math.max(1, lc.length)) + i * 7 + lc.length) % SYL.length]);
      html += `<i>${parts.join('-')}</i>${punct} `;
    }
  }
  return { html: html.trim(), syllables: Math.max(1, n) };
}

// every line is recorded with a snapshot of the scene, for the rewind at the end
export const speechHook = { fn: null };
export const speechLog = [];
let subtitleEl = null;
export function setSubtitleEl(el) { subtitleEl = el; }
export const LABEL = { father: 'THE MAN', mother: 'THE WOMAN', lily: 'THE GIRL', danny: 'DANNY' };
let subTimer = null;
export function showSubtitle(who, html, secs) {
  if (!subtitleEl) return;
  subtitleEl.innerHTML = who === 'note' ? html : `<span class="who who-${who}">${LABEL[who] || who}</span> ${html}`;
  subtitleEl.style.opacity = 1;
  clearTimeout(subTimer);
  subTimer = setTimeout(() => { subtitleEl.style.opacity = 0; }, Math.max(1800, secs * 1000 + 900));
}

// ---------------------------------------------------------------------------
// Navigation graph
const NODES = {
  E: [1.5, 7.6, 'entry'], ED: [1.5, 9.2, 'entry'], EH: [1.5, 5.0, 'door'],
  H0: [1.95, 4.25, 'hall'], H1: [5.9, 4.25, 'hall'], H2: [9.45, 4.25, 'hall'], H3: [11.45, 4.25, 'hall'], H4: [13.4, 4.25, 'hall'],
  LVH: [5.75, 5.0, 'door'], LV: [6.0, 6.2, 'living'], LVE: [3.0, 7.75, 'door'], LVK: [9.0, 7.0, 'door'],
  KW: [9.7, 8.6, 'kitchen'], KS: [12.8, 8.6, 'kitchen'], KN: [12.8, 5.8, 'kitchen'], KH: [11.5, 5.0, 'door'],
  PD: [1.95, 3.5, 'door'], P: [2.9, 2.6, 'parents'], LD: [5.95, 3.5, 'door'], L: [6.3, 2.5, 'lily'],
  LaD: [11.45, 3.5, 'door'], La: [11.45, 2.3, 'laundry'], BD: [13.4, 3.6, 'door'],
};
const EDGES = [['E', 'ED'], ['E', 'EH'], ['EH', 'H0'], ['H0', 'H1'], ['H1', 'H2'], ['H2', 'H3'], ['H3', 'H4'], ['H4', 'BD'],
  ['H1', 'LVH'], ['LVH', 'LV'], ['LV', 'LVE'], ['LVE', 'E'], ['LV', 'LVK'], ['LVK', 'KW'], ['KW', 'KS'], ['KS', 'KN'], ['KN', 'KH'], ['KH', 'H3'],
  ['H0', 'PD'], ['PD', 'P'], ['H1', 'LD'], ['LD', 'L'], ['H3', 'LaD'], ['LaD', 'La']];
const ADJ = {};
for (const k in NODES) ADJ[k] = [];
for (const [a, b] of EDGES) { ADJ[a].push(b); ADJ[b].push(a); }
const nd = (k) => new THREE.Vector3(NODES[k][0], 0, NODES[k][1]);

function nearestNode(p) {
  const room = roomAt(p.x, p.z, 0);
  const tag = room === 'stairs' ? 'door' : room;
  let best = null, bd = 1e9;
  for (const k in NODES) {
    if (NODES[k][2] !== tag && !(tag === 'door' && k === 'BD')) continue;
    const d = Math.hypot(NODES[k][0] - p.x, NODES[k][1] - p.z);
    if (d < bd) { bd = d; best = k; }
  }
  if (!best) for (const k in NODES) { const d = Math.hypot(NODES[k][0] - p.x, NODES[k][1] - p.z); if (d < bd) { bd = d; best = k; } }
  return best;
}
export function findPath(from, to) {
  const a = nearestNode(from), b = nearestNode(to);
  if (roomAt(from.x, from.z) === roomAt(to.x, to.z) && roomAt(to.x, to.z) !== 'hall') return [to.clone()];
  const dist = {}, prev = {}, q = new Set(Object.keys(NODES));
  for (const k of q) dist[k] = 1e9;
  dist[a] = 0;
  while (q.size) {
    let u = null; for (const k of q) if (u === null || dist[k] < dist[u]) u = k;
    q.delete(u);
    if (u === b) break;
    for (const v of ADJ[u]) {
      const alt = dist[u] + Math.hypot(NODES[u][0] - NODES[v][0], NODES[u][1] - NODES[v][1]);
      if (alt < dist[v]) { dist[v] = alt; prev[v] = u; }
    }
  }
  const out = []; let c = b;
  while (c && c !== a) { out.unshift(nd(c)); c = prev[c]; }
  out.unshift(nd(a));
  out.push(to.clone());
  return out;
}

// ---------------------------------------------------------------------------
// Body building: tapered limbs, a shaped torso, a sculpted head, real hands.
function pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
function facet(g) { const n = g.toNonIndexed(); n.computeVertexNormals(); return n; }
function scaleUV(geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
}
function limb(rt, rb, len, mat, parent, y, o = {}) {
  let g = new THREE.CylinderGeometry(rt, rb, len, o.seg ?? 6, 1);
  if (o.sz) g.scale(1, 1, o.sz);
  scaleUV(g, Math.max(1, Math.round((Math.PI * (rt + rb)) / 0.28)), len / 0.28);
  g = facet(g);
  const m = new THREE.Mesh(g, mat);
  m.position.set(o.x ?? 0, y, o.z ?? 0);
  parent.add(m);
  return m;
}
// a cylinder re-shaped by width/depth profiles along its height
function shaped(len, prof, mat, parent, y, o = {}) {
  let g = new THREE.CylinderGeometry(1, 1, len, 8, prof.length - 1, !!o.open);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const vy = p.getY(i), t = Math.max(0, Math.min(1, vy / len + 0.5));
    const r = Math.hypot(p.getX(i), p.getZ(i));
    const dx = r > 1e-6 ? p.getX(i) / r : 0, dz = r > 1e-6 ? p.getZ(i) / r : 0;
    const f = t * (prof.length - 1), i0 = Math.min(prof.length - 2, Math.floor(f)), k = f - i0;
    const w = prof[i0][0] + (prof[i0 + 1][0] - prof[i0][0]) * k;
    const d = prof[i0][1] + (prof[i0 + 1][1] - prof[i0][1]) * k;
    const front = prof[i0][2] !== undefined ? (prof[i0][2] + ((prof[i0 + 1][2] ?? prof[i0][2]) - prof[i0][2]) * k) : 0;
    p.setXYZ(i, dx * w * r, vy, dz * (d + (dz > 0 ? front * dz : 0)) * r);
  }
  scaleUV(g, 2, len / 0.32);
  g = facet(g);
  const m = new THREE.Mesh(g, mat);
  m.position.y = y;
  parent.add(m);
  return m;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const gauss = (x, y, sx, sy) => Math.exp(-(x * x) / (sx * sx) - (y * y) / (sy * sy));
// sculpted head: jaw, chin, brow, sockets, nose, cheekbones, lips
function headGeo(r, o = {}) {
  let g = new THREE.SphereGeometry(r, 12, 10, -Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) / r, y = p.getY(i) / r, z = p.getZ(i) / r;
    const th = Math.atan2(x, z);
    let rad = 1;
    // jaw narrows, chin comes forward
    const jaw = smooth(0.1, -0.85, y);
    x *= 1 - jaw * (o.child ? 0.14 : o.wide ? 0.18 : 0.2);
    z *= 1 - jaw * 0.1 * (1 - Math.cos(th));
    rad += gauss(th, y + 0.62, 0.35, 0.16) * 0.1;
    // skull is longer front to back, flat at the sides
    z *= 1.08; x *= 0.92;
    // brow ridge, sockets, nose, cheekbones, mouth
    rad += gauss(th, y - 0.32, 0.55, 0.06) * (o.child ? 0.02 : 0.06);
    for (const sgn of [-1, 1]) {
      rad -= gauss(th - sgn * 0.36, y - 0.2, 0.13, 0.09) * 0.08;
      rad += gauss(th - sgn * 0.6, y - 0.02, 0.18, 0.12) * 0.05;
    }
    const nose = gauss(th, y + 0.05, 0.075, 0.16) * (o.child ? 0.14 : 0.22) + gauss(th, y - 0.12, 0.05, 0.15) * 0.06;
    rad += nose;
    rad += gauss(th, y + 0.31, 0.2, 0.04) * 0.035 - gauss(th, y + 0.36, 0.16, 0.02) * 0.02;
    // neck stump
    if (y < -0.8) rad -= (y + 0.8) * -0.2;
    p.setXYZ(i, x * rad * r, y * rad * r * 1.18, z * rad * r);
  }
  return facet(g);
}
function hand(mat, parent, y, s, side) {
  const h = pivot(parent, 0, y, 0);
  const palm = new THREE.Mesh(facet(new THREE.BoxGeometry(0.06 * s, 0.085 * s, 0.024 * s)), mat);
  palm.position.y = -0.04 * s; h.add(palm);
  const fingers = new THREE.Mesh(facet(new THREE.BoxGeometry(0.056 * s, 0.1 * s, 0.016 * s)), mat);
  fingers.position.set(0, -0.13 * s, 0.006 * s); fingers.rotation.x = 0.18; h.add(fingers);
  const thumb = new THREE.Mesh(facet(new THREE.BoxGeometry(0.016 * s, 0.06 * s, 0.016 * s)), mat);
  thumb.position.set(-side * 0.036 * s, -0.06 * s, 0.012 * s); thumb.rotation.z = side * 0.5; h.add(thumb);
  return h;
}

// One continuous skinned body: rings of vertices swept along the skeleton. Each vertex is
// weighted between the bones either side of a joint, so shoulders, hips, elbows and knees
// stay attached and the skin stretches when they bend.
class BodyBuilder {
  constructor(seg) { this.seg = seg; this.pos = []; this.uv = []; this.si = []; this.sw = []; this.idx = []; this.groups = []; }
  vert(x, y, z, u, v, w) {
    this.pos.push(x, y, z); this.uv.push(u, v);
    const ws = w.filter((e) => e[1] > 1e-4).sort((p, q) => q[1] - p[1]).slice(0, 4);
    let tot = ws.reduce((t, e) => t + e[1], 0) || 1;
    for (let k = 0; k < 4; k++) { this.si.push(ws[k] ? ws[k][0] : 0); this.sw.push(ws[k] ? ws[k][1] / tot : 0); }
    return this.pos.length / 3 - 1;
  }
  tube(rings, mat, o = {}) {
    const seg = this.seg, base = this.pos.length / 3, i0 = this.idx.length;
    const P = (i) => [this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]];
    rings.forEach((r) => {
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
        const x = r.x + dx * r.rx, z = r.z + dz * r.rz + (dz > 0 ? (r.front || 0) * dz * dz : 0);
        this.vert(x, r.y, z, (j / seg) * (o.uRep || 1), r.y / 0.3, r.w(x, r.y, z));
      }
    });
    const tri = (a, b, c, cx, cz) => {
      // keep every face pointing outward
      const A = P(a), B = P(b), C = P(c);
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
      const nx = uy * vz - uz * vy, nz = ux * vy - uy * vx;
      const ox = (A[0] + B[0] + C[0]) / 3 - cx, oz = (A[2] + B[2] + C[2]) / 3 - cz;
      if (nx * ox + nz * oz < 0) this.idx.push(a, c, b); else this.idx.push(a, b, c);
    };
    for (let k = 0; k < rings.length - 1; k++) {
      const cx = (rings[k].x + rings[k + 1].x) / 2, cz = (rings[k].z + rings[k + 1].z) / 2;
      for (let j = 0; j < seg; j++) {
        const a = base + k * (seg + 1) + j, b = a + 1, c = a + seg + 1, d = c + 1;
        tri(a, b, c, cx, cz); tri(b, d, c, cx, cz);
      }
    }
    const cap = (k, down) => {
      const r = rings[k];
      const c = this.vert(r.x, r.y, r.z, 0.5, r.y / 0.3, r.w(r.x, r.y, r.z));
      for (let j = 0; j < seg; j++) {
        const a = base + k * (seg + 1) + j, b = a + 1;
        const A = P(a), B = P(b);
        const ny = (A[2] - r.z) * (B[0] - r.x) - (A[0] - r.x) * (B[2] - r.z);
        if ((ny > 0) === down) this.idx.push(c, b, a); else this.idx.push(c, a, b);
      }
    };
    if (o.capStart) cap(0, rings[0].y < rings[rings.length - 1].y);
    if (o.capEnd) cap(rings.length - 1, rings[rings.length - 1].y < rings[0].y);
    this.groups.push([i0, this.idx.length - i0, mat]);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.idx);
    for (const [st, c, m] of this.groups) g.addGroup(st, c, m);
    const n = g.toNonIndexed();
    n.computeVertexNormals();
    return n;
  }
}

export class Human {
  constructor(name, spec, scene) {
    this.name = name; this.spec = spec;
    const s = spec.height / 1.85;
    this.s = s;
    const root = new THREE.Group(); scene.add(root);
    this.root = root;
    const body = pivot(root, 0, 0, 0); this.body = body;
    const uniq = !!(spec.ghost || spec.presence);
    const shirt = ps1Mat({ map: spec.shirt || null, color: spec.shirtCol ?? 0xffffff, unique: true });
    const pants = ps1Mat({ map: spec.pants || null, color: spec.pantsCol ?? 0xffffff, unique: true });
    const skin = ps1Mat({ map: T.skin, color: spec.skinCol ?? 0xffffff, unique: true });
    const hair = ps1Mat({ map: spec.hair || null, unique: uniq });
    const shoe = ps1Mat({ color: spec.shoeCol ?? 0x1a1410, unique: uniq });
    this.faceMat = ps1Mat({ map: spec.face, unique: true });
    this.mats = [shirt, pants, skin, hair, this.faceMat, shoe];
    // ---- skeleton -------------------------------------------------------------
    // Retro-realism: proportions are almost right. Torso a little tall, arms a little
    // long, the neck a touch long. Everything is one continuous skinned mesh.
    const fem = spec.build === 'woman', kid = spec.build === 'child';
    const lthin = spec.presence ? 0.62 : 0.9, tthin = spec.presence ? 0.72 : 1;
    const leg = 0.96 * s * (spec.presence ? 1.1 : 1), torso = 0.66 * s, headR = 0.098 * (kid ? Math.max(s, 0.8) : s);
    const armL = spec.presence ? 1.5 : 1.1;
    const U = 0.3 * s * armL, F = 0.26 * s * armL;
    const hx = (fem ? 0.092 : 0.088) * s * tthin, shx = (fem ? 0.182 : kid ? 0.19 : 0.2) * s * tthin, shy = torso - 0.1 * s;
    this.legLen = leg;
    const bones = [];
    const bone = (parent, x, y, z) => { const b = new THREE.Bone(); b.position.set(x, y, z); if (parent) parent.add(b); bones.push(b); return b; };
    const bodyB = bone(null, 0, 0, 0);
    body.add(bodyB);
    const hips = bone(bodyB, 0, leg, 0); this.hips = hips;
    this.legs = [-1, 1].map((side) => {
      const hip = bone(hips, side * hx, -0.06 * s, 0);
      const knee = bone(hip, 0, -leg / 2 + 0.06 * s, 0);
      return { hip, knee };
    });
    const chest = bone(hips, 0, 0.04 * s, 0); this.chest = chest;
    this.arms = [-1, 1].map((side) => {
      const sh = bone(chest, side * shx, shy, 0);
      const el = bone(sh, 0, -U, 0);
      return { sh, el };
    });
    const neck = bone(chest, 0, torso - 0.02 * s, 0); this.neck = neck;
    const bi = (b) => bones.indexOf(b);

    // ---- skin ---------------------------------------------------------------------
    const mesh = new BodyBuilder(9);
    const hipsY = leg, chestY = leg + 0.04 * s, shY = chestY + shy, neckY = chestY + torso - 0.02 * s;
    // torso profile: [y above the hips (x s), half-width, half-depth, depth offset, front bulge]
    const T_MAN = [[-0.13, 0.05, 0.05, 0], [-0.09, 0.12, 0.09, -0.005], [-0.03, 0.155, 0.105, -0.012], [0.03, 0.16, 0.105, -0.006], [0.13, 0.148, 0.098, 0.004],
      [0.25, 0.15, 0.1, 0.012], [0.37, 0.152, 0.118, 0.014], [0.47, 0.156, 0.124, 0.012], [0.55, 0.16, 0.112, 0.002], [0.61, 0.175, 0.092, -0.008],
      [0.655, 0.14, 0.075, -0.012], [0.69, 0.085, 0.06, -0.01], [0.715, 0.052, 0.048, 0]];
    const T_WOMAN = [[-0.13, 0.05, 0.05, 0], [-0.09, 0.125, 0.09, -0.008], [-0.03, 0.168, 0.108, -0.016], [0.03, 0.165, 0.102, -0.008], [0.15, 0.125, 0.088, 0.002],
      [0.25, 0.128, 0.09, 0.004], [0.36, 0.13, 0.095, 0.006, 0.03], [0.44, 0.133, 0.098, 0.006, 0.038], [0.52, 0.138, 0.095, 0, 0.012], [0.6, 0.158, 0.082, -0.008],
      [0.645, 0.125, 0.068, -0.01], [0.68, 0.075, 0.055, -0.008], [0.705, 0.046, 0.043, 0]];
    const T_KID = [[-0.13, 0.05, 0.05, 0], [-0.09, 0.115, 0.085, -0.004], [-0.03, 0.14, 0.095, -0.008], [0.03, 0.14, 0.095, -0.002], [0.15, 0.135, 0.092, 0.01],
      [0.27, 0.13, 0.092, 0.012], [0.4, 0.13, 0.094, 0.006], [0.52, 0.135, 0.09, 0], [0.6, 0.155, 0.08, -0.008], [0.645, 0.12, 0.066, -0.01],
      [0.68, 0.07, 0.052, -0.008], [0.705, 0.046, 0.043, 0]];
    const tp = fem ? T_WOMAN : kid ? T_KID : T_MAN;
    const torsoW = (x, y) => {
      const yr = (y - hipsY) / s;
      const wC = smooth(0.02, 0.2, yr), wN = smooth(0.66, 0.73, yr) * 0.35;
      const ax = Math.abs(x);
      const wS = smooth(shx * 0.5, shx * 0.92, ax) * smooth(0.46, 0.6, yr) * 0.6;
      const sideArm = x < 0 ? this.arms[0].sh : this.arms[1].sh;
      return [[bi(hips), (1 - wC) * (1 - wS)], [bi(chest), wC * (1 - wS) * (1 - wN)], [bi(neck), wC * wN * (1 - wS)], [bi(sideArm), wS]];
    };
    const ring = (row, mul = 1) => ({ y: hipsY + row[0] * s, x: 0, z: (row[3] || 0) * s, rx: row[1] * s * tthin * mul, rz: row[2] * s * tthin * mul, front: (row[4] || 0) * s, w: torsoW });
    // trousers up to the waist, shirt over it with an untucked hem
    mesh.tube(tp.filter((r) => r[0] <= 0.15).map((r) => ring(r)), 1, { capStart: true });
    mesh.tube([ring([0.07, ...tp.find((r) => r[0] >= 0.03).slice(1)], 1.05), ...tp.filter((r) => r[0] > 0.07).map((r) => ring(r))], 0, { uRep: 2 });
    // legs: hip to ankle, weighted across the hip and knee
    const LEG = [[-0.1, 0.09, 0.095, 0], [0, 0.088, 0.092, 0], [0.12, 0.083, 0.088, 0.008], [0.3, 0.072, 0.078, 0.012], [0.43, 0.058, 0.062, 0.006], [0.5, 0.05, 0.056, 0.004],
      [0.56, 0.05, 0.055, -0.004], [0.66, 0.054, 0.06, -0.016], [0.8, 0.04, 0.044, -0.006], [0.94, 0.029, 0.033, 0], [1.0, 0.028, 0.032, 0]];
    const hipY = hipsY - 0.06 * s, kneeY = hipY - leg / 2 + 0.06 * s, ankleY = kneeY - leg / 2 + 0.06 * s;
    this.legs.forEach((l, i) => {
      const side = i ? 1 : -1;
      const w = (x, y) => {
        const wH = smooth(hipY - 0.02 * s, hipY + 0.08 * s, y) * 0.6, wK = smooth(kneeY + 0.06 * s, kneeY - 0.06 * s, y);
        return [[bi(hips), wH], [bi(l.hip), (1 - wK) * (1 - wH)], [bi(l.knee), wK * (1 - wH)]];
      };
      mesh.tube(LEG.map(([f, rx, rz, dz]) => ({ y: hipY - f * (hipY - ankleY), x: side * hx, z: dz * s, rx: rx * s * lthin, rz: rz * s * lthin, w })), 1, { capEnd: true });
    });
    // arms: shoulder (inside the deltoid) to wrist, weighted across shoulder and elbow
    const ARM_UP = [[-0.045, 0.042, 0.048, 'a'], [-0.015, 0.055, 0.057, 'a'], [0.04, 0.058, 0.058, 'a'], [0.4, 0.046, 0.05, 'u'], [0.75, 0.043, 0.045, 'u'], [0.95, 0.037, 0.039, 'u'], [1.0, 0.035, 0.037, 'u']];
    const ARM_LO = [[0, 0.035, 0.037], [0.08, 0.037, 0.036], [0.3, 0.038, 0.036], [0.75, 0.029, 0.025], [1.0, 0.022, 0.019]];
    this.arms.forEach((a, i) => {
      const side = i ? 1 : -1;
      const elY = shY - U;
      const w = (x, y) => {
        const wC = smooth(shY - 0.02 * s, shY + 0.05 * s, y) * 0.8, wE = smooth(elY + 0.04 * s, elY - 0.04 * s, y);
        return [[bi(chest), wC], [bi(a.sh), (1 - wE) * (1 - wC)], [bi(a.el), wE * (1 - wC)]];
      };
      const yOf = (d, kind) => (kind === 'a' ? shY - d * s : shY - d * U);
      mesh.tube(ARM_UP.map(([d, rx, rz, k]) => ({ y: yOf(d, k), x: side * shx, z: 0, rx: rx * s * lthin, rz: rz * s * lthin, w })), 0, { uRep: 1 });
      mesh.tube(ARM_LO.map(([f, rx, rz]) => ({ y: elY - f * F, x: side * shx, z: f > 0.05 && f < 0.5 ? 0.004 * s : 0, rx: rx * s * lthin, rz: rz * s * lthin, w })), spec.rolled ? 2 : 0, { uRep: 1 });
    });
    // neck
    const nw = (x, y) => { const k = smooth(chestY + torso - 0.05 * s, neckY + 0.04 * s, y); return [[bi(chest), 1 - k], [bi(neck), k]]; };
    mesh.tube([[chestY + torso - 0.035 * s, 0.05, 0.045], [neckY + 0.02 * s, 0.043, 0.042], [neckY + 0.07 * s, 0.041, 0.041], [neckY + 0.12 * s, 0.039, 0.039]]
      .map(([y, rx, rz]) => ({ y, x: 0, z: 0.006 * s, rx: rx * s, rz: rz * s, w: nw })), 2, { uRep: 1 });

    const geo = mesh.build();
    const skinMesh = new THREE.SkinnedMesh(geo, [shirt, pants, skin]);
    skinMesh.frustumCulled = false;
    root.add(skinMesh);
    root.updateMatrixWorld(true);
    skinMesh.bind(new THREE.Skeleton(bones));
    this.skinMesh = skinMesh;

    // rigid extremities on the bones: shoes and hands
    for (const l of this.legs) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.09 * s * lthin, 0.065 * s, 0.24 * s, 2, 1, 3), shoe);
      sh.position.set(0, -leg / 2 + 0.09 * s, 0.05 * s);
      const sp = sh.geometry.attributes.position;
      for (let i = 0; i < sp.count; i++) if (sp.getZ(i) > 0.05 * s) { sp.setX(i, sp.getX(i) * 0.75); if (sp.getY(i) > 0) sp.setY(i, sp.getY(i) * 0.4); }
      sh.geometry = facet(sh.geometry);
      l.knee.add(sh);
    }
    this.arms.forEach((a, i) => hand(skin, a.el, -F + 0.005 * s, s * (spec.presence ? 1.5 : 1), i ? 1 : -1));
    this.handY = -F - 0.06 * s;
    const hg = headGeo(headR, { child: kid, wide: !fem && !kid, fem });
    this.head = new THREE.Mesh(hg, this.faceMat);
    this.head.position.set(0, 0.068 * s + headR * 0.98, 0.018 * s);
    this.totalLen = leg + 0.04 * s + torso + 0.068 * s + headR * 2.1;
    this.headH = leg + 0.04 * s + torso + 0.068 * s + headR;
    neck.add(this.head);
    // hair volume
    if (spec.hairStyle && spec.hairStyle !== 'none') {
      const cap = new THREE.Mesh(facet(new THREE.SphereGeometry(headR * 1.06, 10, 5, -Math.PI / 2, Math.PI * 2, 0, Math.PI * (spec.hairStyle === 'short' ? 0.42 : 0.5))), hair);
      cap.scale.set(0.95, 1.18, 1.14);
      cap.rotation.x = -0.42;
      cap.position.set(0, headR * 0.06, -headR * 0.05);
      this.head.add(cap);
      if (spec.hairStyle === 'long') {
        const back = new THREE.Mesh(facet(new THREE.CylinderGeometry(headR * 1.08, headR * 1.25, headR * 2.6, 8, 2, true, Math.PI * 0.62, Math.PI * 1.76)), hair);
        back.material.side = THREE.DoubleSide;
        back.position.set(0, -headR * 0.7, -headR * 0.12);
        back.scale.set(1, 1, 0.85);
        this.head.add(back);
      }
      if (spec.hairStyle === 'child') {
        for (const sd of [-1, 1]) {
          const tail = limb(0.028 * s * 1.6, 0.01 * s * 1.6, 0.17, hair, this.head, -headR * 0.5, { x: sd * headR * 1.02, z: -headR * 0.35, seg: 6 });
          tail.rotation.z = sd * 0.25;
        }
      }
    }
    this.blinkAt = 2 + Math.random() * 4; this.blinkUntil = 0;
    this.nextTick = 0; this.twitchAt = 3 + Math.random() * 6; this.twitch = null; this._rOff = new THREE.Vector3(); this._rRot = new THREE.Euler();
    this.pos = new THREE.Vector3(); this.yaw = 0; this.headYaw = 0; this.headPitch = 0;
    this.path = []; this.walkPhase = 0; this.moving = false;
    this.pose = 'stand'; this.poseBlend = 0;
    this.activity = null; this.override = null;
    this.speechUntil = 0; this.lastSpoke = -99; this.lookAt = null; this.lookUntil = 0;
    this.asleep = false; this.unconscious = false; this.awakeUntil = 0;
    this.speed = 1.15; this.stepTimer = 0;
    this.visible = true;
    this.wrongFace = false;
    this.arrived = null;
  }
  setPos(x, z, y = 0) { this.pos.set(x, y, z); }
  /** Put something in a hand (side 1 or 0). It rides on the forearm bone. */
  hold(obj, side = 1, o = {}) {
    const el = this.arms[side].el;
    el.add(obj);
    obj.position.set(o.x ?? 0, this.handY + (o.y ?? 0), o.z ?? 0.03);
    obj.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
    obj.visible = true;
    (this.held = this.held || []).push(obj);
    return obj;
  }
  /** Let go of it: it is put down where the hand is, or at a given place. */
  release(obj, scene, at) {
    const wp = new THREE.Vector3(); obj.getWorldPosition(wp);
    scene.add(obj);
    obj.position.copy(at || wp); obj.rotation.set(0, at && at.ry !== undefined ? at.ry : 0, 0);
    if (this.held) this.held = this.held.filter((x) => x !== obj);
  }
  setFace(wrong) {
    if (this.wrongFace === wrong) return;
    this.wrongFace = wrong;
  }
  goTo(target, onArrive) {
    const path = findPath(this.pos, target);
    // never walk back to a waypoint that is behind us
    const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    while (path.length > 1 && d2(this.pos, path[1]) <= d2(path[0], path[1]) + 0.05) path.shift();
    this.path = path;
    this.arrived = onArrive || null;
    this.pose = 'stand';
  }
  setActivity(a) {
    // a: {spot, face, pose, approach}
    this.activity = a;
    this.asleep = false;
    if (this.pos.y > -1) this.pos.y = 0;
    const target = a.approach || a.spot;
    this.goTo(target, () => {
      if (a.approach) { this.path = [a.spot.clone()]; this.arrived = () => this.settle(); }
      else this.settle();
    });
  }
  settle() {
    const a = this.activity;
    if (!a) return;
    this.pos.x = a.spot.x; this.pos.z = a.spot.z;
    if (a.pose === 'sleep') this.pos.y = a.spot.y || 0;
    if (a.face !== undefined) this.yaw = a.face;
    this.pose = a.pose || 'stand';
    if (this.pose === 'sleep' || this.pose === 'slump') this.asleep = true;
  }
  say(text, tone, now, co, opts = {}) {
    if (!opts.force && now - this.lastSpoke < (opts.cooldown ?? 3)) return false;
    const g = garble(text, co);
    const head = () => { const p = this.headWorld(); return [p.x, p.y, p.z]; };
    const r = speak(this.spec.voice || this.name, g.syllables, tone, head, clarity());
    const dur = r ? r.total : g.syllables * 0.18;
    this.speechUntil = now + dur; this.lastSpoke = now;
    this._spk = r ? r.p : null;
    if (!opts.silentSub) showSubtitle(this.name, g.html, dur);
    const rec = { who: this.name, text, t: now, clue: opts.clue || null, hl: opts.hl || null };
    speechLog.push(rec);
    if (speechHook.fn) speechHook.fn(rec, this);
    return true;
  }
  headWorld() { const v = new THREE.Vector3(); this.head.getWorldPosition(v); return v; }
  look(target, secs, now) { this.lookAt = target; this.lookUntil = now + secs; }

  poseStep(now, co) {
    const L = this.legs, Ar = this.arms;
    let hipY = this.legLen;
    const sway = co > 0.5 && this.moving ? Math.sin(now * 2.1) * 0.12 * co : 0;
    this.body.rotation.set(0, 0, sway);
    for (const [i, a] of Ar.entries()) { a.sh.rotation.set(0, 0, i ? 0.11 : -0.11); a.el.rotation.set(-0.08, 0, 0); }
    this.chest.rotation.set(0, 0, 0);
    if (this.pose === 'sit' || this.pose === 'slump') {
      hipY = 0.47;
      for (const l of L) { l.hip.rotation.set(-Math.PI / 2, 0, 0); l.knee.rotation.set(Math.PI / 2, 0, 0); }
      for (const a of Ar) { a.sh.rotation.set(-0.45, 0, 0); a.el.rotation.set(-0.6, 0, 0); }
      this.chest.rotation.x = this.pose === 'slump' ? 0.3 : -0.08;
      if (this.pose === 'slump') for (const a of Ar) { a.sh.rotation.set(-0.15, 0, a === Ar[0] ? 0.18 : -0.18); a.el.rotation.set(0, 0, 0); }
    } else if (this.pose === 'floor') {
      hipY = 0.12;
      for (const [i, l] of L.entries()) { l.hip.rotation.set(-Math.PI / 2, i ? 0.4 : -0.4, 0); l.knee.rotation.set(1.6, 0, 0); }
      for (const a of Ar) { a.sh.rotation.set(-1.0, 0, 0); a.el.rotation.set(-0.3, 0, 0); }
      this.chest.rotation.x = 0.35;
    } else if (this.pose === 'kneel') {
      hipY = 0.5;
      L[0].hip.rotation.set(-1.4, 0, 0); L[0].knee.rotation.set(1.4, 0, 0);
      L[1].hip.rotation.set(0.1, 0, 0); L[1].knee.rotation.set(1.6, 0, 0);
      for (const a of Ar) { a.sh.rotation.set(-1.1, 0, 0); a.el.rotation.set(-0.6, 0, 0); }
      this.chest.rotation.x = 0.2;
    } else if (this.pose === 'sleep') {
      for (const l of L) { l.hip.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); }
      for (const [i, a] of Ar.entries()) a.sh.rotation.set(0, 0, i ? -0.08 : 0.08);
    } else if (this.pose === 'sink') {
      for (const l of L) { l.hip.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); }
      for (const [i, a] of Ar.entries()) { a.sh.rotation.set(-0.9 + (Math.floor(now * 2 + i) % 2) * 0.2, 0, 0); a.el.rotation.set(-0.6, 0, 0); }
      this.chest.rotation.x = 0.12;
    } else if (this.pose === 'stare') {
      for (const l of L) { l.hip.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); }
      this.chest.rotation.x = 0.06;
    } else {
      // stiff walk: hips swing, knees barely bend, arms hang almost dead
      const w = this.moving ? Math.sign(Math.sin(this.walkPhase)) * Math.min(1, Math.abs(Math.sin(this.walkPhase)) * 2) : 0;
      L[0].hip.rotation.set(w * 0.34, 0, 0); L[1].hip.rotation.set(-w * 0.34, 0, 0);
      L[0].knee.rotation.set(Math.max(0, -w) * 0.25, 0, 0); L[1].knee.rotation.set(Math.max(0, w) * 0.25, 0, 0);
      Ar[0].sh.rotation.set(-w * 0.1, 0, -0.11); Ar[1].sh.rotation.set(w * 0.1, 0, 0.11);
      if (this.override?.type === 'rub') { Ar[1].sh.rotation.set(-2.6, 0, -0.3); Ar[1].el.rotation.set(-1.6, 0, 0); }
    }
    // hand gestures that ride on top of any pose
    const ov = this.override?.type, A1 = Ar[1], A0 = Ar[0];
    if (ov === 'carry') { A1.sh.rotation.set(-0.55, 0, 0.12); A1.el.rotation.set(-1.15, 0, 0); }
    else if (ov === 'carry2') { for (const a of Ar) { a.sh.rotation.set(-0.6, 0, a === A1 ? 0.25 : -0.25); a.el.rotation.set(-1.0, 0, 0); } }
    else if (ov === 'point') { A1.sh.rotation.set(-1.05, 0, 0.12); A1.el.rotation.set(-0.08, 0, 0); A0.sh.rotation.set(-0.5, 0, -0.1); A0.el.rotation.set(-1.1, 0, 0); }
    else if (ov === 'reach') { A1.sh.rotation.set(-1.3 + (Math.floor(now * 3) % 2) * 0.12, 0, 0.1); A1.el.rotation.set(-0.25, 0, 0); }
    else if (ov === 'pour') { A1.sh.rotation.set(-1.15, 0, 0.3); A1.el.rotation.set(-0.5, 0, 0); A0.sh.rotation.set(-1.0, 0, -0.25); A0.el.rotation.set(-0.6, 0, 0); }
    else if (ov === 'pat') { A1.sh.rotation.set(-1.25, 0, 0.1); A1.el.rotation.set(-0.15 - (Math.floor(now * 4) % 2) * 0.35, 0, 0); }
    else if (ov === 'wave') { A1.sh.rotation.set(-2.6, 0, -0.3); A1.el.rotation.set(-0.4 - (Math.floor(now * 5) % 2) * 0.5, 0, 0); }
    else if (ov === 'read') { for (const a of Ar) { a.sh.rotation.set(-0.85, 0, a === A1 ? 0.3 : -0.3); a.el.rotation.set(-1.25, 0, 0); } }
    else if (ov === 'scribble') { A1.sh.rotation.set(-1.15, 0, 0.05 + (Math.floor(now * 6) % 3) * 0.06); A1.el.rotation.set(-0.35 - (Math.floor(now * 5) % 2) * 0.12, 0, 0); }
    else if (ov === 'hug') { for (const a of Ar) { a.sh.rotation.set(-1.0, 0, a === A1 ? -0.5 : 0.5); a.el.rotation.set(-1.4, 0, 0); } }
    else if (ov === 'stretch') { for (const a of Ar) { a.sh.rotation.set(-2.9, 0, a === A1 ? 0.25 : -0.25); a.el.rotation.set(-0.2, 0, 0); } this.chest.rotation.x = -0.15; }
    else if (ov === 'rubeyes') { A1.sh.rotation.set(-2.3, 0, -0.5); A1.el.rotation.set(-2.0 - (Math.floor(now * 5) % 2) * 0.15, 0, 0); }
    else if (ov === 'shiver') { for (const a of Ar) { a.sh.rotation.set(-0.7, 0, a === A1 ? -0.55 : 0.55); a.el.rotation.set(-1.9, 0, 0); } this.chest.rotation.z = (Math.floor(now * 12) % 2 ? 0.02 : -0.02); }
    this.hips.position.y = hipY;
    // the root: snapped facing; lying down for sleep
    if (this.pose === 'sleep') {
      this._rRot.set(-Math.PI / 2, 0, 0);
      this._rOff.set(0, 0.12, this.totalLen * 0.5);
    } else {
      this._rRot.set(0, this.yaw, 0);
      this._rOff.set(0, 0, 0);
    }
    // head look: no easing, it just snaps to you
    let ty = 0, tp = 0;
    if (this.pose === 'slump') tp = 0.75;
    if (this.lookAt && now < this.lookUntil && this.pose !== 'sleep') {
      const hp = this.headWorld();
      const dx = this.lookAt.x - hp.x, dz = this.lookAt.z - hp.z, dy = this.lookAt.y - hp.y;
      let a = Math.atan2(dx, dz) - this.yaw; while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2;
      ty = Math.max(-1.3, Math.min(1.3, a));
      tp = Math.max(-0.6, Math.min(0.95, -Math.atan2(dy, Math.hypot(dx, dz))));
      if (Math.abs(a) > 1.2 && !this.moving && (this.pose === 'stand' || this.pose === 'stare')) this.yaw += Math.sign(a) * 0.35;
    }
    this.headYaw = ty; this.headPitch = tp;
    // twitches: a head jerk, a shoulder spasm, a whole-body flinch
    if (now > this.twitchAt && this.pose !== 'sleep') {
      const kinds = ['head', 'head', 'shoulder', 'flinch', 'tilt'];
      this.twitch = { kind: kinds[Math.floor(Math.random() * kinds.length)], until: now + 0.12 + Math.random() * 0.25, v: (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.45) };
      this.twitchAt = now + (2.5 + Math.random() * 7) / (1 + co * 2.5 + (this.spec.presence ? 3 : 0));
    }
    let nz = 0;
    if (this.twitch && now < this.twitch.until) {
      const t = this.twitch;
      if (t.kind === 'head') { this.headYaw += t.v; this.headPitch += t.v * 0.3; }
      if (t.kind === 'tilt') nz = t.v * 0.7;
      if (t.kind === 'shoulder') Ar[t.v > 0 ? 1 : 0].sh.rotation.z += t.v * 0.5;
      if (t.kind === 'flinch') { this.chest.rotation.x += 0.15; this._rRot.y += t.v * 0.25; }
    }
    this.neck.rotation.set(this.headPitch, this.headYaw, nz);
  }

  update(dt, now, co, dogPos) {
    // movement along path
    this.moving = false;
    if (this.path.length) {
      const tgt = this.path[0];
      const dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      const sp = this.speed * (1 - co * 0.45) * (this.override?.hurry ? 1.8 : 1);
      if (d < 0.08) {
        this._unstick = 0;
        this.path.shift();
        if (!this.path.length && this.arrived) { const f = this.arrived; this.arrived = null; f(); }
      } else {
        const want = Math.atan2(dx, dz);
        let da = want - this.yaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        this.yaw += da * Math.min(1, dt * 6);
        const mv = Math.min(d, sp * dt);
        const ox = this.pos.x, oz = this.pos.z;
        this.pos.x += (dx / d) * mv; this.pos.z += (dz / d) * mv;
        this.moving = true;
        if (!this.spec.ghost) {
          wallPush(this.pos, 0.2, this.pos.y);
          // stuck against something: find a fresh way round, through the doorways
          const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
          this._stuck = moved < mv * 0.3 ? (this._stuck || 0) + dt : 0;
          if (this._stuck > 0.7) {
            this._stuck = 0; this._unstick = (this._unstick || 0) + 1;
            const goal = this.path[this.path.length - 1];
            if (this._unstick > 3) { this.pos.x = this.path[0].x; this.pos.z = this.path[0].z; this._unstick = 0; } // last resort
            else { const np = findPath(this.pos, goal); if (np.length) this.path = np; }
          }
        }
        this.walkPhase += dt * 6.2;
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) { this.stepTimer = 0.55 / (sp + 0.1) * 1.1; step('heavy', this.pos.x, 0.05, this.pos.z, this.s * 0.7); }
      }
    }
    // ---- pose: PS1-era NPC animation. Limbs update in stiff steps at ~8 fps while the
    // body slides smoothly underneath them, with sudden twitches.
    const R = this.root;
    const tick = now >= this.nextTick || this.pose !== this._lastPose;
    if (tick) {
      this.nextTick = now + 0.11 + Math.random() * 0.05;
      this._lastPose = this.pose;
      this.poseStep(now, co);
    }
    R.position.copy(this.pos).add(this._rOff);
    R.rotation.copy(this._rRot);
    // talking head bob
    if (now < this.speechUntil) this.head.rotation.x = (Math.floor(now * 9) % 2) * 0.07; else this.head.rotation.x = 0;
    if (this._spk && now < this.speechUntil + 0.5) { const p = this.headWorld(); setPos(this._spk, p.x, p.y, p.z); }
    // eyes: open, blinking, closed in sleep, or wrong
    if (now > this.blinkAt) { this.blinkUntil = now + 0.13; this.blinkAt = now + 2.5 + Math.random() * 5; }
    const sp = this.spec;
    let ft = sp.face;
    if (this.wrongFace) ft = sp.faceWrong;
    else if ((this.asleep && now >= this.awakeUntil && (this.pose === 'sleep' || this.pose === 'slump')) || now < this.blinkUntil) ft = sp.faceClosed || sp.face;
    if (this.faceMat.uniforms.map.value !== ft) this.faceMat.uniforms.map.value = ft;
    R.visible = this.visible;
  }
}

export function makeFamily(scene) {
  const father = new Human('father', { height: 1.86, build: 'man', shirt: T.flannel, pants: T.jeans, face: T.headFather, faceClosed: T.headFatherClosed, faceWrong: T.headFatherW, hair: T.hairFather, hairStyle: 'short', shoeCol: 0x2a1a10, rolled: true }, scene);
  const mother = new Human('mother', { height: 1.68, build: 'woman', shirt: T.cardigan, pants: T.slacks, face: T.headMother, faceClosed: T.headMotherClosed, faceWrong: T.headMotherW, hair: T.hairMother, hairStyle: 'long', skinCol: 0xe0c8c0, shoeCol: 0x3a2a2a }, scene);
  const lily = new Human('lily', { height: 1.22, build: 'child', shirt: T.pajama, pants: T.pajama, face: T.headLily, faceClosed: T.headLilyClosed, faceWrong: T.headLilyW, hair: T.hairLily, hairStyle: 'child', shoeCol: 0xd8a0b0 }, scene);
  const danny = new Human('danny', { height: 1.68, build: 'man', shirt: T.hoodie, pants: T.jeans, face: T.headDanny, faceClosed: T.headDannyClosed, faceWrong: T.headDanny, hair: T.hairDanny, hairStyle: 'short', ghost: true, voice: 'danny' }, scene);
  danny.visible = false;
  return { father, mother, lily, danny };
}
export { headGeo, facet };
