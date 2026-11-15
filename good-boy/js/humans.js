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
function part(w, h, d, mat, parent, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

export class Human {
  constructor(name, spec, scene) {
    this.name = name; this.spec = spec;
    const s = spec.height / 1.85;
    this.s = s;
    const root = new THREE.Group(); scene.add(root);
    this.root = root;
    const body = pivot(root, 0, 0, 0); this.body = body;
    const shirt = ps1Mat({ map: spec.shirt, color: spec.shirtCol ?? 0xffffff, unique: !!spec.ghost, opacity: spec.ghost ? 0.999 : 1 });
    const pants = ps1Mat({ map: spec.pants, color: spec.pantsCol ?? 0xffffff, unique: !!spec.ghost });
    const skin = ps1Mat({ map: T.skin, color: spec.skinCol ?? 0xffffff, unique: !!spec.ghost });
    const hair = ps1Mat({ map: spec.hair, unique: !!spec.ghost });
    this.faceMat = ps1Mat({ map: spec.face, unique: true });
    this.mats = [shirt, pants, skin, hair, this.faceMat];
    const leg = 0.9 * s, torso = 0.58 * s, headS = 0.23 * s;
    this.legLen = leg;
    const hips = pivot(body, 0, leg, 0); this.hips = hips;
    // legs
    this.legs = [-1, 1].map((side) => {
      const hip = pivot(hips, side * 0.1 * s, 0, 0);
      part(0.15 * s, leg / 2, 0.17 * s, pants, hip, 0, -leg / 4, 0);
      const knee = pivot(hip, 0, -leg / 2, 0);
      part(0.13 * s, leg / 2, 0.15 * s, pants, knee, 0, -leg / 4, 0);
      part(0.14 * s, 0.07 * s, 0.26 * s, ps1Mat({ color: spec.shoeCol ?? 0x1a1410 }), knee, 0, -leg / 2 + 0.03 * s, 0.05 * s);
      return { hip, knee };
    });
    // torso
    const chest = pivot(hips, 0, 0, 0); this.chest = chest;
    part(0.38 * s, torso, 0.22 * s, shirt, chest, 0, torso / 2, 0);
    // arms
    this.arms = [-1, 1].map((side) => {
      const sh = pivot(chest, side * 0.25 * s, torso - 0.05 * s, 0);
      part(0.11 * s, 0.3 * s, 0.12 * s, shirt, sh, 0, -0.15 * s, 0);
      const el = pivot(sh, 0, -0.3 * s, 0);
      part(0.1 * s, 0.28 * s, 0.1 * s, shirt, el, 0, -0.14 * s, 0);
      part(0.08 * s, 0.1 * s, 0.09 * s, skin, el, 0, -0.32 * s, 0);
      return { sh, el };
    });
    // head
    const neck = pivot(chest, 0, torso, 0); this.neck = neck;
    part(0.09 * s, 0.08 * s, 0.09 * s, skin, neck, 0, 0.03 * s, 0);
    const headMats = [hair, hair, hair, skin, this.faceMat, hair];
    this.head = part(headS, headS * 1.15, headS * 1.05, headMats, neck, 0, 0.06 * s + headS * 0.57, 0);
    if (spec.longHair) part(headS * 1.08, headS * 1.2, 0.06 * s, hair, neck, 0, 0.06 * s + headS * 0.4, -headS * 0.55);
    if (spec.pigtails) for (const sd of [-1, 1]) part(0.06 * s, 0.14 * s, 0.06 * s, hair, neck, sd * headS * 0.62, 0.06 * s + headS * 0.45, -0.02);

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
    this.faceMat.uniforms.map.value = wrong ? this.spec.faceWrong : this.spec.face;
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
        this.walkPhase += dt * sp * 5.2;
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) { this.stepTimer = 0.55 / (sp + 0.1) * 1.1; step('heavy', this.pos.x, 0.05, this.pos.z, this.s * 0.7); }
      }
    }
    // pose
    const R = this.root;
    R.position.copy(this.pos);
    R.rotation.set(0, this.yaw, 0);
    const L = this.legs, Ar = this.arms, s = this.s;
    let hipY = this.legLen;
    const sway = co > 0.5 && this.moving ? Math.sin(now * 2.1) * 0.12 * co : 0;
    this.body.rotation.set(0, 0, sway);
    for (const a of Ar) { a.sh.rotation.set(0, 0, 0); a.el.rotation.set(0, 0, 0); }
    this.chest.rotation.set(0, 0, 0);
    if (this.pose === 'sit' || this.pose === 'slump') {
      hipY = 0.47;
      for (const l of L) { l.hip.rotation.set(-Math.PI / 2, 0, 0); l.knee.rotation.set(Math.PI / 2, 0, 0); }
      for (const [i, a] of Ar.entries()) { a.sh.rotation.set(-0.5, 0, 0); a.el.rotation.set(-0.7, 0, 0); }
      this.chest.rotation.x = this.pose === 'slump' ? 0.25 : -0.1;
      if (this.pose === 'slump') for (const a of Ar) { a.sh.rotation.set(-0.2, 0, a === Ar[0] ? 0.15 : -0.15); a.el.rotation.set(0, 0, 0); }
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
      hipY = this.legLen;
      for (const l of L) { l.hip.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); }
      for (const [i, a] of Ar.entries()) a.sh.rotation.set(0, 0, i ? -0.1 : 0.1);
    } else if (this.pose === 'sink') {
      for (const l of L) { l.hip.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); }
      for (const [i, a] of Ar.entries()) { a.sh.rotation.set(-0.9 + Math.sin(now * 3 + i) * 0.15, 0, 0); a.el.rotation.set(-0.6, 0, 0); }
      this.chest.rotation.x = 0.12;
    } else if (this.pose === 'stare') {
      for (const l of L) { l.hip.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); }
      this.chest.rotation.x = 0.04;
    } else {
      // stand / walk cycle
      const w = this.moving ? Math.sin(this.walkPhase) : 0;
      const k = this.moving ? 1 : 0;
      L[0].hip.rotation.set(w * 0.5, 0, 0); L[1].hip.rotation.set(-w * 0.5, 0, 0);
      L[0].knee.rotation.set(Math.max(0, -w) * 0.7 * k, 0, 0); L[1].knee.rotation.set(Math.max(0, w) * 0.7 * k, 0, 0);
      Ar[0].sh.rotation.set(-w * 0.4, 0, 0.06); Ar[1].sh.rotation.set(w * 0.4, 0, -0.06);
      Ar[0].el.rotation.set(-0.2 * k, 0, 0); Ar[1].el.rotation.set(-0.2 * k, 0, 0);
      if (!this.moving) { const br = Math.sin(now * 1.3 + this.s * 10) * 0.012; this.chest.rotation.x = br; }
      if (this.override?.type === 'rub') { Ar[1].sh.rotation.set(-2.6, 0, -0.3); Ar[1].el.rotation.set(-1.6, 0, 0); }
    }
    this.hips.position.y = hipY + (this.moving ? Math.abs(Math.cos(this.walkPhase)) * 0.03 : 0);
    if (this.pose === 'sleep') {
      // lying on the back along the bed, head north
      R.rotation.set(-Math.PI / 2, 0, 0);
      R.position.set(this.pos.x, this.pos.y + 0.12, this.pos.z + this.spec.height * 0.5);
    } else if (this.pose === 'sit' || this.pose === 'slump' || this.pose === 'floor') {
      R.position.y = this.pos.y;
    }
    // head look
    let ty = 0, tp = 0;
    if (this.pose === 'slump') tp = 0.7;
    if (this.lookAt && now < this.lookUntil && this.pose !== 'sleep') {
      const hp = this.headWorld();
      const dx = this.lookAt.x - hp.x, dz = this.lookAt.z - hp.z, dy = this.lookAt.y - hp.y;
      let a = Math.atan2(dx, dz) - this.yaw; while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2;
      ty = Math.max(-1.3, Math.min(1.3, a));
      tp = Math.max(-0.6, Math.min(0.9, -Math.atan2(dy, Math.hypot(dx, dz))));
      // turn the body if the head can't reach
      if (Math.abs(a) > 1.2 && !this.moving && (this.pose === 'stand' || this.pose === 'stare')) this.yaw += Math.sign(a) * dt * 2.5;
    }
    this.headYaw += (ty - this.headYaw) * Math.min(1, dt * 5);
    this.headPitch += (tp - this.headPitch) * Math.min(1, dt * 5);
    this.neck.rotation.set(this.headPitch, this.headYaw, 0);
    // talking head bob
    if (now < this.speechUntil) this.head.rotation.x = Math.sin(now * 18) * 0.05; else this.head.rotation.x = 0;
    if (this._spk && now < this.speechUntil + 0.5) { const p = this.headWorld(); setPos(this._spk, p.x, p.y, p.z); }
    R.visible = this.visible;
  }
}

export function makeFamily(scene) {
  const father = new Human('father', { height: 1.86, shirt: T.flannel, pants: T.jeans, face: T.faceFather, faceWrong: T.faceFatherW, hair: T.hairFather, shoeCol: 0x2a1a10 }, scene);
  const mother = new Human('mother', { height: 1.68, shirt: T.cardigan, pants: T.slacks, face: T.faceMother, faceWrong: T.faceMotherW, hair: T.hairMother, longHair: true, skinCol: 0xf0d8d0 }, scene);
  const lily = new Human('lily', { height: 1.22, shirt: T.pajama, pants: T.pajama, face: T.faceLily, faceWrong: T.faceLilyW, hair: T.hairLily, pigtails: true, shoeCol: 0xd8a0b0 }, scene);
  const danny = new Human('danny', { height: 1.55, shirt: null, shirtCol: 0x3a3c40, pants: null, pantsCol: 0x2a2c30, skinCol: 0x7a8088, face: T.faceDanny, faceWrong: T.faceDanny, hair: T.hairFather, ghost: true, voice: 'danny' }, scene);
  danny.visible = false;
  return { father, mother, lily, danny };
}
