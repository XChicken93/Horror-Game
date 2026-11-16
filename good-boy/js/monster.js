// The thing from the furnace. Five ways a poisoned dog's head could shape it.
// Pick one with ?monster=1..5 (or on the title screen). The Human it rides on still does the
// walking and the path-finding; we hide its body and hang one of these on its root instead.
// Every model faces +z, stands on y = 0, and has update(t, dt, mode) where
// mode is 'idle' | 'walk' | 'hunt' | 'scare'. Limbs move in stiff steps, with snaps.
import * as THREE from '../vendor/three.module.js';
import { ps1Mat } from './ps1.js';
import { T } from './textures.js';
import { headGeo, facet } from './humans.js';

export const MONSTERS = [
  { id: 1, name: 'The Hollow Man', blurb: 'Nine feet of burnt skin over ribs. Its jaw hangs to its chest. Ember eyes.' },
  { id: 2, name: 'The Breather', blurb: 'The furnace itself, walking on its ducts. The grille is a mouth.' },
  { id: 3, name: 'Wrong Danny', blurb: "Danny's hoodie, soaked through. No face. Just a mouth, top to bottom." },
  { id: 4, name: 'The Crawler', blurb: 'Bent over backwards, fast, low. Its head hangs upside down at your height.' },
  { id: 5, name: 'The Smoke Family', blurb: 'Black smoke with their faces in it. Too many arms.' },
];

export function monsterChoice() {
  let n = 0;
  try { n = +new URLSearchParams(location.search).get('monster') || +localStorage.getItem('gb_monster') || 0; } catch (e) { /* storage blocked */ }
  return n >= 1 && n <= 5 ? n : 1;
}
export function setMonsterChoice(n) { try { localStorage.setItem('gb_monster', String(n)); } catch (e) { /* storage blocked */ } }

// ---------------------------------------------------------------------------
const W = 512, HH = 256;
const X = (th) => W / 2 + (th / (Math.PI * 2)) * W;
const Y = (yn) => (Math.acos(Math.max(-1, Math.min(1, yn))) / Math.PI) * HH;
function canvasTex(draw) {
  const c = document.createElement('canvas'); c.width = W; c.height = HH;
  const g = c.getContext('2d'); draw(g);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.NoColorSpace; t.wrapS = THREE.RepeatWrapping;
  return t;
}
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
function cracks(g, n, col, w, x0 = 0, x1 = W, y0 = 0, y1 = HH) {
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    let x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 30; y += (rnd() - 0.3) * 22; g.lineTo(x, y); }
    g.stroke();
  }
}
// burnt skin: near-black, ash flecks, glowing seams
function burntTex() {
  return canvasTex((g) => {
    g.fillStyle = '#1a1210'; g.fillRect(0, 0, W, HH);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${40 + rnd() * 40},${30 + rnd() * 20},${25 + rnd() * 15},${0.2 + rnd() * 0.4})`; g.fillRect(rnd() * W, rnd() * HH, 2 + rnd() * 5, 2 + rnd() * 5); }
    cracks(g, 26, 'rgba(255,90,20,0.95)', 2.2);
    cracks(g, 30, 'rgba(255,170,60,0.7)', 1);
  });
}
// a skull face for the Hollow Man: sockets, no lips, teeth to the jaw
function hollowFace() {
  return canvasTex((g) => {
    g.fillStyle = '#1c1310'; g.fillRect(0, 0, W, HH);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${50 + rnd() * 50},${35 + rnd() * 25},${30},${0.3})`; g.fillRect(rnd() * W, rnd() * HH, 3, 3); }
    cracks(g, 18, 'rgba(255,100,30,0.9)', 2);
    for (const s of [-1, 1]) {
      g.fillStyle = '#000'; g.beginPath(); g.ellipse(X(s * 0.36), Y(0.2), 22, 18, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,120,30,0.25)'; g.beginPath(); g.ellipse(X(s * 0.36), Y(0.2), 30, 24, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#000'; g.fillRect(X(-0.07), Y(0.0), X(0.07) - X(-0.07), 16);
    g.fillStyle = '#0a0000'; g.fillRect(X(-0.5), Y(-0.3), X(0.5) - X(-0.5), HH - Y(-0.3));
    g.fillStyle = '#d8ccb0';
    for (let i = 0; i < 14; i++) { const x = X(-0.45 + i * 0.07); g.beginPath(); g.moveTo(x, Y(-0.3)); g.lineTo(x + 6, Y(-0.3)); g.lineTo(x + 3, Y(-0.3) + 12 + rnd() * 10); g.fill(); }
  });
}
// featureless wet grey face with a vertical mouth
function wrongDannyFace() {
  return canvasTex((g) => {
    g.fillStyle = '#7d8a92'; g.fillRect(0, 0, W, HH);
    for (let i = 0; i < 1200; i++) { g.fillStyle = `rgba(${90 + rnd() * 40},${110 + rnd() * 30},${125 + rnd() * 30},0.25)`; g.fillRect(rnd() * W, rnd() * HH, 3, 3); }
    for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(40,60,80,0.35)'; g.lineWidth = 1; const x = rnd() * W; g.beginPath(); g.moveTo(x, rnd() * 80); g.lineTo(x + (rnd() - 0.5) * 6, 120 + rnd() * 130); g.stroke(); }
    // faint dents where the eyes should be
    for (const s of [-1, 1]) { g.fillStyle = 'rgba(40,50,60,0.4)'; g.beginPath(); g.ellipse(X(s * 0.36), Y(0.2), 16, 8, 0, 0, Math.PI * 2); g.fill(); }
    // the vertical mouth: forehead to chin
    const cx = X(0), top = Y(0.75), bot = Y(-0.85);
    g.fillStyle = '#100204'; g.beginPath(); g.moveTo(cx, top); g.quadraticCurveTo(cx + 22, (top + bot) / 2, cx, bot); g.quadraticCurveTo(cx - 22, (top + bot) / 2, cx, top); g.fill();
    g.fillStyle = 'rgba(160,20,30,0.8)'; g.beginPath(); g.moveTo(cx, top + 10); g.quadraticCurveTo(cx + 8, (top + bot) / 2, cx, bot - 10); g.quadraticCurveTo(cx - 8, (top + bot) / 2, cx, top + 10); g.fill();
    g.fillStyle = '#e6dcc6';
    for (let y = top + 8; y < bot - 8; y += 9) {
      const w = Math.sin(((y - top) / (bot - top)) * Math.PI) * 20;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * w, y); g.lineTo(cx + s * w, y + 7); g.lineTo(cx + s * (w - 9), y + 3.5); g.fill(); }
    }
  });
}
// pale upside-down grin face for the Crawler (painted upright; the head is flipped)
function crawlerFace() {
  return canvasTex((g) => {
    g.fillStyle = '#c9c0b4'; g.fillRect(0, 0, W, HH);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${150 + rnd() * 60},${140 + rnd() * 50},${130 + rnd() * 50},0.3)`; g.fillRect(rnd() * W, rnd() * HH, 3, 3); }
    for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(90,60,90,0.35)'; g.lineWidth = 1.2; let x = rnd() * W, y = rnd() * HH; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 20; y += (rnd() - 0.5) * 20; g.lineTo(x, y); } g.stroke(); }
    for (const s of [-1, 1]) {
      g.fillStyle = 'rgba(60,30,40,0.6)'; g.beginPath(); g.ellipse(X(s * 0.36), Y(0.2), 26, 20, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#050505'; g.beginPath(); g.ellipse(X(s * 0.36), Y(0.2), 19, 15, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(X(s * 0.36) + s * 2, Y(0.2) - 1, 2.6, 0, Math.PI * 2); g.fill();
    }
    // a grin that goes to the ears
    const my = Y(-0.32);
    g.fillStyle = '#1a0306';
    g.beginPath(); g.moveTo(X(-1.25), my - 18); g.quadraticCurveTo(X(0), my + 34, X(1.25), my - 18); g.quadraticCurveTo(X(0), my + 6, X(-1.25), my - 18); g.fill();
    g.fillStyle = '#efe6d0';
    for (let i = -16; i <= 16; i++) {
      const t = i / 17, x = X(t * 1.2), yTop = my - 18 + (1 - t * t) * 13, yBot = my - 18 + (1 - t * t) * 30;
      g.fillRect(x - 3, yTop, 5, 6); g.fillRect(x - 3, yBot - 6, 5, 6);
    }
  });
}

// ---------------------------------------------------------------------------
const glow = (c) => ps1Mat({ color: c, unlit: true, noFog: true, unique: true });
const solid = (c, o = {}) => ps1Mat({ color: c, unique: true, ...o });
function M(geo, mat, parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m;
}
function piv(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
// a limb segment that hangs down from its pivot
const seg = (r0, r1, len, s = 6) => { const g = new THREE.CylinderGeometry(r0, r1, len, s, 2); g.translate(0, -len / 2, 0); return facet(g); };
const step = (t, fps = 10) => Math.floor(t * fps) / fps;
const hash = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

// 1 -------------------------------------------------------------------------
function hollowMan() {
  const g = new THREE.Group();
  const skinT = burntTex();
  const skin = solid(0xffffff, { map: skinT }); skin.uniforms.uEmissive.value.set(0.12, 0.05, 0.02);
  const bone = solid(0x2a201a);
  const ember = glow(0xffa040), coal = glow(0xff4010);
  const hips = piv(g, 0, 1.5, 0);
  const legs = [-1, 1].map((s) => {
    const hip = piv(hips, s * 0.11, 0, 0);
    M(seg(0.07, 0.045, 0.78), skin, hip);
    const knee = piv(hip, 0, -0.78, 0);
    M(new THREE.IcosahedronGeometry(0.05, 0), skin, knee);
    M(seg(0.045, 0.03, 0.74), skin, knee);
    const ankle = piv(knee, 0, -0.74, 0);
    for (let i = -1; i <= 1; i++) M(seg(0.012, 0.004, 0.2, 4), bone, ankle, i * 0.025, 0.02, 0.02, 1.35, 0, 0);
    return { hip, knee };
  });
  // pelvis, spine, ribs, sunken belly
  M(facet(new THREE.CylinderGeometry(0.12, 0.09, 0.14, 7)), skin, hips, 0, 0.02, 0);
  const chest = piv(hips, 0, 0.08, 0);
  M(seg(0.035, 0.035, 0.7).translate(0, 0.7, -0.05), skin, chest);
  M(facet(new THREE.CylinderGeometry(0.07, 0.1, 0.3, 7)).translate(0, 0.2, -0.04), skin, chest);
  for (let i = 0; i < 6; i++) {
    const r = 0.13 + Math.sin((i / 5) * Math.PI * 0.8 + 0.4) * 0.05;
    const rib = M(new THREE.TorusGeometry(r, 0.014, 4, 10, Math.PI * 1.4), skin, chest, 0, 0.38 + i * 0.065, -0.03, Math.PI / 2, 0, -Math.PI * 0.2);
    rib.scale.set(1, 0.75, 1);
    // glowing gaps between the ribs
    if (i < 5) M(new THREE.PlaneGeometry(r * 1.3, 0.025), coal, chest, 0, 0.41 + i * 0.065, r * 0.72 - 0.03);
  }
  const core = M(new THREE.IcosahedronGeometry(0.07, 1), coal, chest, 0, 0.55, -0.02);
  const shoulders = piv(chest, 0, 0.78, -0.03);
  M(facet(new THREE.BoxGeometry(0.5, 0.06, 0.1)), skin, shoulders);
  const arms = [-1, 1].map((s) => {
    const sh = piv(shoulders, s * 0.26, 0, 0);
    M(new THREE.IcosahedronGeometry(0.05, 0), skin, sh);
    M(seg(0.052, 0.04, 0.72), skin, sh);
    const el = piv(sh, 0, -0.72, 0);
    M(seg(0.04, 0.028, 0.68), skin, el);
    const wr = piv(el, 0, -0.68, 0);
    M(facet(new THREE.BoxGeometry(0.05, 0.08, 0.02)), skin, wr, 0, -0.04, 0);
    const fingers = [];
    for (let i = 0; i < 5; i++) { const f = piv(wr, (i - 2) * 0.014, -0.08, 0); M(seg(0.007, 0.003, 0.26, 4), bone, f); fingers.push(f); }
    return { sh, el, fingers };
  });
  const neck = piv(shoulders, 0, 0.04, 0.02);
  M(seg(0.028, 0.03, 0.3).translate(0, 0.3, 0), skin, neck);
  const head = piv(neck, 0, 0.36, 0.02);
  const skull = M(headGeo(0.13), ps1Mat({ map: hollowFace(), unique: true }), head, 0, 0.06, 0);
  skull.scale.set(0.85, 1.35, 1);
  skull.material.uniforms.uEmissive.value.set(0.15, 0.06, 0.03);
  for (const s of [-1, 1]) M(new THREE.IcosahedronGeometry(0.02, 1), ember, head, s * 0.045, 0.09, 0.105);
  // the jaw, unhinged: it hangs to the chest
  const jaw = piv(head, 0, -0.04, 0.03);
  const jawM = M(facet(new THREE.BoxGeometry(0.11, 0.32, 0.05)).translate(0, -0.16, 0.02), skin, jaw);
  M(new THREE.PlaneGeometry(0.1, 0.3).translate(0, -0.15, 0.05), coal, jaw);
  for (let i = 0; i < 6; i++) M(new THREE.ConeGeometry(0.008, 0.035, 4).rotateX(Math.PI), bone, jaw, -0.04 + i * 0.016, -0.3, 0.06, -0.3, 0, 0);
  void jawM;
  return {
    g, headH: 2.8, face: skull,
    update(t, dt, mode) {
      const ts = step(t, 9);
      const walk = mode === 'walk' || mode === 'hunt';
      const w = walk ? Math.sin(ts * (mode === 'hunt' ? 7 : 3.4)) : 0;
      legs[0].hip.rotation.x = w * 0.4; legs[1].hip.rotation.x = -w * 0.4;
      legs[0].knee.rotation.x = Math.max(0, -w) * 0.5; legs[1].knee.rotation.x = Math.max(0, w) * 0.5;
      hips.position.y = 1.5 - Math.abs(w) * 0.04;
      chest.rotation.x = mode === 'hunt' ? 0.35 : 0.12;
      const reach = mode === 'hunt' || mode === 'scare';
      arms.forEach((a, i) => {
        const s = i ? 1 : -1;
        a.sh.rotation.set(reach ? -1.35 + Math.sin(ts * 11 + i) * 0.08 : -w * s * 0.15, 0, s * (reach ? 0.05 : 0.08));
        a.el.rotation.x = reach ? -0.25 : -0.12;
        a.fingers.forEach((f, k) => { f.rotation.x = -0.2 - (hash(Math.floor(t * 6) + k + i * 9) > 0.7 ? 0.6 : 0); f.rotation.z = (k - 2) * 0.12; });
      });
      // head: a slow sideways tilt, then a hard snap back
      const ph = (t * 0.35) % 1;
      neck.rotation.z = mode === 'scare' ? Math.sin(t * 50) * 0.15 : ph < 0.85 ? ph * 1.6 : 0;
      neck.rotation.x = mode === 'hunt' ? -0.25 : 0.08;
      jaw.rotation.x = (mode === 'scare' ? 0.45 : 0.25) + Math.sin(t * 23) * 0.04;
      ember.uniforms.uColor.value.set(1, 0.55 + Math.sin(t * 13) * 0.2, 0.2);
      skin.uniforms.uEmissive.value.set(0.1 + Math.sin(t * 2) * 0.05, 0.04, 0.015);
      core.scale.setScalar(0.8 + Math.abs(Math.sin(t * (mode === 'hunt' ? 6 : 1.5))) * 0.5);
    },
  };
}

// 2 -------------------------------------------------------------------------
function breather() {
  const g = new THREE.Group();
  const metal = solid(0x5a4232), dark = solid(0x1c1410), rust = solid(0x7a4a2a);
  const fire = glow(0xff6a20), blue = glow(0x60a0ff), tooth = solid(0xb8b0a0);
  const body = piv(g, 0, 1.15, 0);
  M(facet(new THREE.BoxGeometry(0.85, 0.95, 0.7)), metal, body);
  for (const y of [-0.3, 0.3]) M(facet(new THREE.BoxGeometry(0.88, 0.04, 0.73)), rust, body, 0, y, 0);
  for (let i = 0; i < 10; i++) M(new THREE.IcosahedronGeometry(0.014, 0), rust, body, -0.38 + (i % 5) * 0.19, i < 5 ? 0.42 : -0.42, 0.36);
  // the grille mouth: an upper plate, a hinged lower plate, teeth, fire inside
  M(new THREE.PlaneGeometry(0.62, 0.42), fire, body, 0, -0.05, 0.33);
  const upper = piv(body, 0, 0.12, 0.36);
  M(facet(new THREE.BoxGeometry(0.66, 0.12, 0.04)), dark, upper, 0, 0.04, 0);
  for (let i = 0; i < 9; i++) M(new THREE.ConeGeometry(0.022, 0.12, 4).rotateX(Math.PI), tooth, upper, -0.28 + i * 0.07, -0.07, 0.01);
  const lower = piv(body, 0, -0.24, 0.36);
  M(facet(new THREE.BoxGeometry(0.66, 0.24, 0.04)).translate(0, -0.08, 0), dark, lower);
  for (let i = 0; i < 6; i++) M(facet(new THREE.BoxGeometry(0.6, 0.012, 0.05)), rust, lower, 0, -0.16 + i * 0.03, 0.01);
  for (let i = 0; i < 8; i++) M(new THREE.ConeGeometry(0.02, 0.1, 4), tooth, lower, -0.25 + i * 0.07, 0.07, 0.01);
  // pilot-light eyes, side by side under the lid, and two more that open late
  const eyes = [];
  for (const [x, y] of [[-0.18, 0.3], [0.18, 0.3], [-0.3, 0.22], [0.3, 0.22]]) { const e = M(new THREE.IcosahedronGeometry(0.035, 1), blue, body, x, y, 0.36); eyes.push(e); }
  // the flue: a neck that curls forward, with a vent hood for a head
  const flue = piv(body, 0, 0.47, -0.1);
  const fl1 = piv(flue);
  M(seg(0.09, 0.09, 0.5, 8).rotateX(Math.PI), metal, fl1);
  const fl2 = piv(fl1, 0, 0.5, 0);
  M(seg(0.09, 0.08, 0.45, 8).rotateX(Math.PI), metal, fl2);
  for (const p of [fl1, fl2]) for (let i = 1; i < 4; i++) M(new THREE.TorusGeometry(0.095, 0.012, 3, 10), rust, p, 0, i * 0.12, 0, Math.PI / 2, 0, 0);
  const hood = piv(fl2, 0, 0.48, 0);
  M(facet(new THREE.ConeGeometry(0.22, 0.25, 4, 1, true)).rotateY(Math.PI / 4), metal, hood, 0, 0, 0.05, Math.PI / 2, 0, 0);
  M(new THREE.CircleGeometry(0.15, 8), dark, hood, 0, 0, 0.17);
  for (const s of [-1, 1]) M(new THREE.IcosahedronGeometry(0.03, 1), fire, hood, s * 0.06, 0.02, 0.18);
  // six duct legs, bent like a spider's
  const legs = [];
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1, k = i % 3;
    const root = piv(body, side * 0.42, -0.2, -0.25 + k * 0.25);
    root.rotation.y = side * (Math.PI / 2) + (k - 1) * side * -0.5;
    const up = piv(root);
    M(seg(0.06, 0.05, 0.75, 7).rotateX(Math.PI), metal, up);
    for (let r = 1; r < 4; r++) M(new THREE.TorusGeometry(0.063, 0.01, 3, 8), rust, up, 0, r * 0.19, 0, Math.PI / 2, 0, 0);
    const kn = piv(up, 0, 0.75, 0);
    M(new THREE.IcosahedronGeometry(0.07, 0), rust, kn);
    M(seg(0.05, 0.015, 1.25, 6), dark, kn);
    legs.push({ up, kn, side, k });
  }
  return {
    g, headH: 1.2, face: upper,
    update(t, dt, mode) {
      const ts = step(t, 12);
      const walk = mode === 'walk' || mode === 'hunt';
      const sp = mode === 'hunt' ? 9 : 4;
      legs.forEach((l, i) => {
        const ph = walk ? Math.sin(ts * sp + (i % 2) * Math.PI + l.k * 0.7) : Math.sin(t * 0.6 + i) * 0.1;
        l.up.rotation.z = 0; l.up.rotation.x = -0.9 + Math.max(0, ph) * 0.35;
        l.kn.rotation.x = 1.9 - Math.max(0, ph) * 0.3;
        l.up.rotation.y = ph * 0.25;
      });
      body.position.y = 1.15 + (walk ? Math.abs(Math.sin(ts * sp)) * 0.05 : 0);
      body.rotation.z = walk ? Math.sin(ts * sp * 0.5) * 0.05 : 0;
      // it breathes: the mouth opens with each one
      const br = (Math.sin(t * (mode === 'hunt' || mode === 'scare' ? 5 : 1.4)) + 1) / 2;
      lower.rotation.x = mode === 'scare' ? 0.95 : 0.15 + br * 0.45;
      upper.rotation.x = mode === 'scare' ? -0.3 : -br * 0.1;
      fire.uniforms.uColor.value.set(1, 0.35 + br * 0.3 + hash(Math.floor(t * 20)) * 0.15, 0.1);
      const late = mode === 'hunt' || mode === 'scare';
      eyes[2].visible = eyes[3].visible = late;
      fl1.rotation.x = 0.5 + Math.sin(t * 0.8) * 0.1 + (mode === 'scare' ? 0.5 : 0);
      fl2.rotation.x = 0.7 + Math.sin(t * 1.1) * 0.15;
      hood.rotation.z = Math.sin(step(t, 4) * 3) * 0.3;
    },
  };
}

// 3 -------------------------------------------------------------------------
function wrongDanny() {
  const g = new THREE.Group();
  const hoodie = ps1Mat({ map: T.hoodie, color: 0x9aa6b4, unique: true });
  const jeans = ps1Mat({ map: T.jeans, color: 0x5a6070, unique: true });
  const pale = solid(0x8c9aa4);
  const inner = glow(0x200608), tooth = solid(0xe0d6c0);
  const hips = piv(g, 0, 1.12, 0);
  const legs = [-1, 1].map((s) => {
    const hip = piv(hips, s * 0.1, 0, 0);
    M(seg(0.075, 0.06, 0.58), jeans, hip);
    const knee = piv(hip, 0, -0.58, 0);
    M(seg(0.06, 0.05, 0.54), jeans, knee);
    M(facet(new THREE.BoxGeometry(0.08, 0.05, 0.22)), pale, knee, 0, -0.56, 0.04);
    return { hip, knee };
  });
  const chest = piv(hips, 0, 0.02, 0);
  M(facet(new THREE.CylinderGeometry(0.2, 0.17, 0.7, 8)).translate(0, 0.35, 0), hoodie, chest);
  M(facet(new THREE.BoxGeometry(0.22, 0.12, 0.03)), hoodie, chest, 0, 0.2, 0.17);
  const shoulders = piv(chest, 0, 0.66, 0);
  const arms = [-1, 1].map((s) => {
    const sh = piv(shoulders, s * 0.22, 0, 0);
    M(seg(0.07, 0.06, 0.55), hoodie, sh);
    const el = piv(sh, 0, -0.55, 0);
    M(seg(0.06, 0.05, 0.6), hoodie, el);
    const wr = piv(el, 0, -0.6, 0);
    M(facet(new THREE.BoxGeometry(0.06, 0.1, 0.025)), pale, wr, 0, -0.05, 0);
    for (let i = 0; i < 4; i++) M(seg(0.007, 0.004, 0.2, 4), pale, wr, -0.022 + i * 0.015, -0.1, 0);
    return { sh, el };
  });
  const neck = piv(shoulders, 0, 0.06, 0);
  const head = piv(neck, 0, 0.18, 0.02);
  const face = M(headGeo(0.105), ps1Mat({ map: wrongDannyFace(), unique: true }), head);
  face.scale.set(1, 1.15, 1);
  M(new THREE.PlaneGeometry(0.03, 0.2), inner, head, 0, -0.01, 0.112);
  // the hood, hanging wet around it
  const hood = M(facet(new THREE.SphereGeometry(0.16, 9, 7, Math.PI * 0.8, Math.PI * 1.4, 0, Math.PI * 0.7)), hoodie, head, 0, 0.03, -0.025);
  hood.material.side = THREE.DoubleSide; hood.rotation.x = 0.1; hood.scale.set(1, 1.15, 1.15);
  // the mouth's sides split open sideways during the scare
  const lips = [-1, 1].map((s) => { const p = piv(head, s * 0.004, 0, 0.11); M(facet(new THREE.BoxGeometry(0.012, 0.22, 0.02)), pale, p); for (let i = 0; i < 7; i++) M(new THREE.ConeGeometry(0.006, 0.03, 3).rotateZ(-s * Math.PI / 2), tooth, p, -s * 0.012, -0.09 + i * 0.03, 0.005); return p; });
  return {
    g, headH: 1.98, face,
    update(t, dt, mode) {
      const ts = step(t, 8);
      const walk = mode === 'walk' || mode === 'hunt';
      const w = walk ? Math.sin(ts * (mode === 'hunt' ? 8 : 3.5)) : 0;
      legs[0].hip.rotation.x = w * 0.45; legs[1].hip.rotation.x = -w * 0.45;
      legs[0].knee.rotation.x = Math.max(0, -w) * 0.6; legs[1].knee.rotation.x = Math.max(0, w) * 0.6;
      chest.rotation.x = mode === 'hunt' ? 0.3 : 0.05;
      arms.forEach((a, i) => {
        const s = i ? 1 : -1;
        if (mode === 'hunt') { a.sh.rotation.set(-0.6 + Math.sin(ts * 14 + i * 2) * 0.9, 0, s * 0.35); a.el.rotation.x = -0.8 + Math.sin(ts * 9 + i) * 0.5; }
        else if (mode === 'scare') { a.sh.rotation.set(-1.6, 0, s * 0.5); a.el.rotation.x = -0.3; }
        else { a.sh.rotation.set(-w * s * 0.12, 0, s * 0.06); a.el.rotation.x = -0.05; }
      });
      // its head turns all the way round, then back, in hard steps
      const ph = (t * 0.18) % 1;
      neck.rotation.y = mode === 'scare' ? 0 : ph > 0.55 && ph < 0.8 ? Math.PI : 0;
      neck.rotation.z = mode === 'hunt' ? 1.2 : mode === 'scare' ? Math.sin(t * 40) * 0.12 : 0.15;
      const open = mode === 'scare' ? 0.06 : 0.008 + Math.max(0, Math.sin(t * 2.2)) * 0.012;
      lips[0].position.x = -open; lips[1].position.x = open;
    },
  };
}

// 4 -------------------------------------------------------------------------
function crawler() {
  const g = new THREE.Group();
  const skin = solid(0xb8b0a6), dim = solid(0x8a7e78), nail = solid(0x2a2020);
  // a body bent over backwards: belly up, chest toward you
  const body = piv(g, 0, 0.85, 0);
  const torso = M(facet(new THREE.CylinderGeometry(0.15, 0.12, 0.7, 8)), skin, body, 0, 0, 0, Math.PI / 2, 0, 0);
  torso.scale.set(1, 1, 0.7);
  for (let i = 0; i < 5; i++) M(new THREE.TorusGeometry(0.12, 0.01, 3, 8, Math.PI), dim, body, 0, 0.04, 0.2 - i * 0.07, 0, 0, 0);
  // four limbs: arms reach back over the head to the floor, legs bent the wrong way
  const limbs = [];
  for (const [x, z, front] of [[-0.16, 0.3, 1], [0.16, 0.3, 1], [-0.14, -0.3, 0], [0.14, -0.3, 0]]) {
    const r = piv(body, x, 0, z);
    const up = piv(r);
    M(seg(0.045, 0.035, 0.62), skin, up);
    const kn = piv(up, 0, -0.62, 0);
    M(new THREE.IcosahedronGeometry(0.045, 0), dim, kn);
    M(seg(0.035, 0.025, 0.6), skin, kn);
    const hand = piv(kn, 0, -0.6, 0);
    for (let i = 0; i < 4; i++) M(seg(0.008, 0.004, 0.14, 4), nail, hand, -0.02 + i * 0.013, 0, 0, front ? 1.2 : -1.2, 0, 0);
    limbs.push({ up, kn, x: Math.sign(x), front });
  }
  // the neck comes out of the chest and bends down, the head hangs upside down
  const neck = piv(body, 0, 0.02, 0.36);
  M(seg(0.04, 0.035, 0.38).rotateX(-Math.PI / 2), skin, neck);
  const head = piv(neck, 0, -0.05, 0.38);
  const face = M(headGeo(0.12), ps1Mat({ map: crawlerFace(), unique: true }), head);
  face.rotation.z = Math.PI; face.scale.set(1, 1.15, 1);
  const hair = solid(0x0a0808);
  for (let i = 0; i < 9; i++) M(seg(0.01, 0.003, 0.35 + hash(i) * 0.15, 3), hair, head, -0.08 + i * 0.02, -0.08, -0.03 + hash(i + 3) * 0.05, Math.PI + 0.2, 0, 0);
  return {
    g, headH: 0.82, face,
    update(t, dt, mode) {
      const ts = step(t, mode === 'hunt' ? 16 : 10);
      const walk = mode === 'walk' || mode === 'hunt';
      const sp = mode === 'hunt' ? 14 : 5;
      limbs.forEach((l, i) => {
        const ph = walk ? Math.sin(ts * sp + (i === 0 || i === 3 ? 0 : Math.PI)) : 0;
        // arms point down and forward, legs down and back; elbows and knees poke up
        l.up.rotation.set(l.front ? 0.9 + ph * 0.35 : -0.9 + ph * 0.35, 0, l.x * 0.5);
        l.kn.rotation.set(l.front ? -1.7 : 1.7, 0, 0);
      });
      body.position.y = 0.85 + (walk ? Math.abs(Math.sin(ts * sp)) * 0.04 : Math.sin(t * 1.3) * 0.02);
      // the head: still for a long time, then a snap to the side, a twitch, a shudder
      const k = Math.floor(t * 1.4);
      neck.rotation.z = mode === 'scare' ? Math.sin(t * 60) * 0.18 : hash(k) > 0.6 ? (hash(k + 1) - 0.5) * 1.6 : 0;
      neck.rotation.x = mode === 'scare' ? -0.3 : mode === 'hunt' ? -0.15 : 0;
      head.rotation.y = mode === 'idle' && hash(k + 7) > 0.8 ? Math.PI * 0.5 : 0;
    },
  };
}

// 5 -------------------------------------------------------------------------
function smokeFamily() {
  const g = new THREE.Group();
  const puffs = [];
  const mats = [0.85, 0.7, 0.55].map((o) => ps1Mat({ color: 0x050404, opacity: o, unique: true }));
  for (let i = 0; i < 46; i++) {
    const r = 0.16 + hash(i) * 0.22;
    const m = M(new THREE.IcosahedronGeometry(r, 1), mats[i % 3], g);
    puffs.push({ m, a: hash(i + 1) * Math.PI * 2, h: 0.15 + (i / 46) * 2.4, rad: 0.12 + hash(i + 2) * 0.25, sp: 0.4 + hash(i + 3) * 0.9 });
  }
  // their faces, pressed out through the smoke
  const faces = [[T.headFatherW, 2.1, 0, 0.11], [T.headMotherW, 1.55, -0.18, 0.1], [T.headLilyW, 1.05, 0.16, 0.085]].map(([tex, y, x, r], i) => {
    const mat = ps1Mat({ map: tex, unique: true }); mat.uniforms.uUnlit.value = 1; mat.uniforms.uColor.value.set(0.7, 0.72, 0.75);
    const p = piv(g, x, y, 0.22);
    const f = M(headGeo(r), mat, p); f.scale.set(1, 1.3, 0.9);
    const mouth = M(new THREE.CircleGeometry(r * 0.32, 8), ps1Mat({ color: 0x000000, unique: true }), p, 0, -r * 0.5, r * 1.02);
    mouth.scale.set(0.7, 1.6, 1);
    return { p, f, mouth, i };
  });
  const arm = solid(0x080606), hand = solid(0x6a6460);
  const arms = [];
  for (let i = 0; i < 9; i++) {
    const a = piv(g, (hash(i + 20) - 0.5) * 0.4, 0.6 + hash(i + 21) * 1.6, 0.05);
    a.rotation.y = (i / 9) * Math.PI * 2;
    const up = piv(a);
    M(seg(0.025, 0.018, 0.6).rotateX(-Math.PI / 2), arm, up);
    const el = piv(up, 0, 0, 0.6);
    M(seg(0.018, 0.012, 0.55).rotateX(-Math.PI / 2), arm, el);
    const h = piv(el, 0, 0, 0.55);
    for (let k = 0; k < 4; k++) M(seg(0.007, 0.003, 0.16, 3).rotateX(-Math.PI / 2), hand, h, -0.02 + k * 0.013, 0, 0, 0, (k - 1.5) * 0.15, 0);
    arms.push({ a, up, el, base: a.rotation.y, i });
  }
  const eyes = glow(0xffe0c0);
  return {
    g, headH: 2.1, face: faces[0].f,
    update(t, dt, mode) {
      const fast = mode === 'hunt' || mode === 'scare' ? 2.2 : 1;
      for (const p of puffs) {
        const a = p.a + t * p.sp * fast;
        const flare = mode === 'scare' ? 1.6 : 1;
        p.m.position.set(Math.cos(a) * p.rad * flare, p.h + Math.sin(t * p.sp + p.a) * 0.08, Math.sin(a) * p.rad * flare - (mode === 'scare' ? 0.45 : 0));
        const s = 0.85 + Math.sin(t * 2 * p.sp + p.a) * 0.2; p.m.scale.setScalar(s);
      }
      const ts = step(t, 8);
      for (const f of faces) {
        // each face pushes forward, stretches, sinks back
        const ph = Math.sin(t * 0.7 + f.i * 2.1);
        f.p.position.z = mode === 'scare' ? 0.3 : 0.12 + Math.max(0, ph) * 0.18;
        f.f.scale.set(1, 1.3 + Math.max(0, ph) * 0.35 + (mode === 'scare' ? 0.4 : 0), 0.9);
        f.mouth.scale.set(0.7, 1.6 + Math.max(0, ph) * 1.6 + (mode === 'scare' ? 2 : 0), 1);
        f.p.rotation.z = hash(Math.floor(t * 3) + f.i * 5) > 0.75 ? (hash(f.i + Math.floor(t * 3)) - 0.5) * 1.2 : 0;
      }
      for (const a of arms) {
        const reach = mode === 'hunt' || mode === 'scare' ? 1 : 0.35 + Math.max(0, Math.sin(t * 0.9 + a.i)) * 0.4;
        a.a.rotation.y = mode === 'hunt' || mode === 'scare' ? (a.i / 9 - 0.5) * 1.6 : a.base + Math.sin(t * 0.3 + a.i) * 0.4;
        a.up.rotation.x = -0.3 + Math.sin(ts * 3 + a.i) * 0.3;
        a.up.scale.setScalar(0.4 + reach * 0.7);
        a.el.rotation.x = 0.4 + Math.sin(ts * 5 + a.i * 2) * 0.4;
      }
      eyes.uniforms.uColor.value.setScalar(0.8);
    },
  };
}

const BUILD = [null, hollowMan, breather, wrongDanny, crawler, smokeFamily];

/** Hang monster n on a Human's root, hiding its own body. */
export function dressPresence(p, n) {
  for (const c of [...p.root.children]) c.visible = false;
  const m = BUILD[n]();
  p.root.add(m.g);
  p.monster = m; p.monster.n = n;
  p.headH = m.headH;
  return m;
}
/** Swap to a different one (title screen picker). */
export function swapMonster(p, n) {
  if (p.monster) p.root.remove(p.monster.g);
  return dressPresence(p, n);
}
