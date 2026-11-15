// The family: low-poly bodies, procedural animation, pathing, muffled speech.
import * as THREE from '../vendor/three.module.js';
import { ps1Mat } from './ps1.js';
import { T } from './textures.js';
import { speak, step, setPos } from './audio.js';
import { roomAt } from './house.js';

// ---------------------------------------------------------------------------
// Words a dog actually knows. Everything else is noise.
const KNOWN = new Set(['biscuit', 'good', 'boy', 'no', 'bed', 'quiet', 'outside', 'walk', 'danny', 'come', 'here',
  'food', 'bad', 'dog', 'sit', 'stay', 'okay', 'love', 'you', 'night', 'home', 'ball', 'down', 'hey', 'buddy']);
const SYL = ['mm', 'hrm', 'wuh', 'bah', 'mwa', 'nnh', 'rrh', 'hm', 'ah', 'muh', 'wha', 'gm', 'uhn', 'rah', 'meh', 'oh'];

export function garble(text, co = 0) {
  const words = text.split(/\s+/);
  let html = '', n = 0;
  for (const w of words) {
    const core = w.replace(/[^a-zA-Z']/g, '');
    const punct = w.replace(/[a-zA-Z']/g, '');
    const lc = core.toLowerCase();
    let syls = Math.max(1, Math.round(core.length / 3));
    n += syls;
    if (KNOWN.has(lc) && !(co > 0.85 && Math.random() < 0.5)) {
      html += `<b>${core}</b>${punct} `;
    } else {
      const parts = [];
      for (let i = 0; i < syls; i++) parts.push(SYL[(lc.charCodeAt(i % Math.max(1, lc.length)) + i * 7 + lc.length) % SYL.length]);
      html += `<i>${parts.join('-')}</i>${punct} `;
    }
  }
  return { html: html.trim(), syllables: Math.max(1, n) };
}

export const speechLog = [];
let subtitleEl = null;
export function setSubtitleEl(el) { subtitleEl = el; }
const LABEL = { father: 'THE MAN', mother: 'THE WOMAN', lily: 'THE GIRL', danny: '???' };
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

export class Human {
  constructor(name, spec, scene) {
    this.name = name; this.spec = spec;
    const s = spec.height / 1.85;
    this.s = s;
    const root = new THREE.Group(); scene.add(root);
    this.root = root;
    const body = pivot(root, 0, 0, 0); this.body = body;
    const uniq = !!(spec.ghost || spec.presence);
    const shirt = ps1Mat({ map: spec.shirt || null, color: spec.shirtCol ?? 0xffffff, unique: uniq });
    const pants = ps1Mat({ map: spec.pants || null, color: spec.pantsCol ?? 0xffffff, unique: uniq });
    const skin = ps1Mat({ map: T.skin, color: spec.skinCol ?? 0xffffff, unique: true });
    const hair = ps1Mat({ map: spec.hair || null, unique: uniq });
    const shoe = ps1Mat({ color: spec.shoeCol ?? 0x1a1410, unique: uniq });
    this.faceMat = ps1Mat({ map: spec.face, unique: true });
    this.mats = [shirt, pants, skin, hair, this.faceMat, shoe];
    // retro-realism: everything is almost right. Limbs a little too long and thin,
    // the torso too tall, the shoulders sunk, the neck a touch long.
    const fem = spec.build === 'woman', kid = spec.build === 'child', thin = spec.presence ? 0.62 : 0.84;
    const leg = 0.96 * s * (spec.presence ? 1.1 : 1), torso = 0.66 * s, headR = 0.098 * (kid ? Math.max(s, 0.8) : s);
    this.legLen = leg;
    const hips = pivot(body, 0, leg, 0); this.hips = hips;
    // pelvis
    limb(0.155 * s * thin, 0.16 * s * thin, 0.16 * s, pants, hips, -0.03 * s, { sz: 0.68, seg: 12 });
    // legs: thigh, shin, ankle, shoe
    this.legs = [-1, 1].map((side) => {
      const hip = pivot(hips, side * 0.088 * s * thin, -0.06 * s, 0);
      limb(0.075 * s * thin, 0.055 * s * thin, leg / 2, pants, hip, -leg / 4 + 0.03 * s, { sz: 0.95 });
      const knee = pivot(hip, 0, -leg / 2 + 0.06 * s, 0);
      limb(0.054 * s * thin, 0.04 * s * thin, leg / 2 - 0.06 * s, pants, knee, -leg / 4 + 0.03 * s);
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.09 * s * thin, 0.065 * s, 0.24 * s, 2, 1, 3), shoe);
      sh.position.set(0, -leg / 2 + 0.09 * s, 0.05 * s);
      const sp = sh.geometry.attributes.position;
      for (let i = 0; i < sp.count; i++) if (sp.getZ(i) > 0.05 * s) { sp.setX(i, sp.getX(i) * 0.75); if (sp.getY(i) > 0) sp.setY(i, sp.getY(i) * 0.4); }
      sh.geometry.computeVertexNormals();
      knee.add(sh);
      return { hip, knee };
    });
    // torso: hips -> waist -> chest -> shoulders -> collar
    const chest = pivot(hips, 0, 0.04 * s, 0); this.chest = chest;
    const prof = fem
      ? [[0.16, 0.1], [0.125, 0.085], [0.135, 0.09, 0.03], [0.15, 0.095, 0.035], [0.145, 0.08], [0.05, 0.045]]
      : kid ? [[0.15, 0.095], [0.135, 0.09], [0.135, 0.09], [0.14, 0.085], [0.135, 0.075], [0.05, 0.045]]
        : [[0.165, 0.11], [0.15, 0.11, 0.02], [0.165, 0.115], [0.18, 0.11], [0.165, 0.09], [0.055, 0.05]];
    shaped(torso, prof.map(([w, d, f]) => [w * s * thin, d * s * thin, (f || 0) * s]), shirt, chest, torso / 2);
    // arms: sleeve, forearm, wrist, hand
    const armL = spec.presence ? 1.55 : 1.2;
    this.arms = [-1, 1].map((side) => {
      const sh = pivot(chest, side * (fem ? 0.15 : kid ? 0.15 : 0.17) * s * (thin / 0.84), torso - 0.11 * s, 0);
      limb(0.052 * s * thin, 0.042 * s * thin, 0.3 * s * armL, shirt, sh, -0.15 * s * armL);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.045 * s * thin, 5, 4), shirt); sh.add(ball);
      const el = pivot(sh, 0, -0.3 * s * armL, 0);
      limb(0.042 * s * thin, 0.034 * s * thin, 0.24 * s * armL, spec.rolled ? skin : shirt, el, -0.12 * s * armL);
      limb(0.03 * s * thin, 0.028 * s * thin, 0.03 * s, skin, el, -0.25 * s * armL);
      hand(skin, el, -0.255 * s * armL, s * (spec.presence ? 1.5 : 1), side);
      return { sh, el };
    });
    // neck and head
    const neck = pivot(chest, 0, torso - 0.02 * s, 0); this.neck = neck;
    limb(0.04 * s, 0.048 * s, 0.11 * s, skin, neck, 0.035 * s);
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
  setFace(wrong) {
    if (this.wrongFace === wrong) return;
    this.wrongFace = wrong;
  }
  goTo(target, onArrive) {
    this.path = findPath(this.pos, target);
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
    const r = speak(this.spec.voice || this.name, g.syllables, tone, head);
    const dur = r ? r.total : g.syllables * 0.18;
    this.speechUntil = now + dur; this.lastSpoke = now;
    this._spk = r ? r.p : null;
    if (!opts.silentSub) showSubtitle(this.name, g.html, dur);
    speechLog.push({ who: this.name, text, t: now });
    return true;
  }
  headWorld() { const v = new THREE.Vector3(); this.head.getWorldPosition(v); return v; }
  look(target, secs, now) { this.lookAt = target; this.lookUntil = now + secs; }

  poseStep(now, co) {
    const L = this.legs, Ar = this.arms;
    let hipY = this.legLen;
    const sway = co > 0.5 && this.moving ? Math.sin(now * 2.1) * 0.12 * co : 0;
    this.body.rotation.set(0, 0, sway);
    for (const a of Ar) { a.sh.rotation.set(0, 0, 0); a.el.rotation.set(0, 0, 0); }
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
      Ar[0].sh.rotation.set(-w * 0.1, 0, 0.04); Ar[1].sh.rotation.set(w * 0.1, 0, -0.04);
      if (this.override?.type === 'rub') { Ar[1].sh.rotation.set(-2.6, 0, -0.3); Ar[1].el.rotation.set(-1.6, 0, 0); }
    }
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
      this.twitchAt = now + (2.5 + Math.random() * 7) / (1 + co * 2.5 + (this.spec.ghost ? 2 : 0));
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
        this.path.shift();
        if (!this.path.length && this.arrived) { const f = this.arrived; this.arrived = null; f(); }
      } else {
        const want = Math.atan2(dx, dz);
        let da = want - this.yaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        this.yaw += da * Math.min(1, dt * 6);
        const mv = Math.min(d, sp * dt);
        this.pos.x += (dx / d) * mv; this.pos.z += (dz / d) * mv;
        this.moving = true;
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
  const danny = new Human('danny', { height: 1.55, build: 'child', shirtCol: 0x3a3c40, pantsCol: 0x2a2c30, skinCol: 0x9098a0, face: T.headDanny, faceClosed: T.headDanny, faceWrong: T.headDanny, hair: T.hairDanny, hairStyle: 'short', ghost: true, voice: 'danny' }, scene);
  danny.visible = false;
  return { father, mother, lily, danny };
}
