// Painted head textures for the family: realistic-ish, tired, and a little wrong.
// The texture wraps around a sculpted sphere: u = angle around the head (front at the centre),
// v = polar angle from the crown. Features are placed with the same coordinates the sculpt uses.
import * as THREE from '../vendor/three.module.js';

const W = 512, HH = 256, K = W / 256;
export const X = (th) => W / 2 + (th / (Math.PI * 2)) * W;
export const Y = (yn) => (Math.acos(Math.max(-1, Math.min(1, yn))) / Math.PI) * HH;

let seed = 99;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function toTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function blob(g, x, y, rx, ry, col, a) {
  const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
  g.save(); g.translate(x, y); g.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); g.translate(-x, -y);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, Math.max(rx, ry), 0, Math.PI * 2); g.fill(); g.restore();
}
function ell(g, x, y, rx, ry, col, a = 1, rot = 0) { g.fillStyle = rgba(col, a); g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill(); }
function line(g, pts, col, a, w) {
  g.strokeStyle = rgba(col, a); g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
}

// hairline height (canvas y) as a function of the angle around the head
function hairlineY(th, style) {
  const a = Math.abs(th);
  const front = style === 'child' ? 0.42 : style === 'long' ? 0.5 : 0.56;
  const pts = style === 'short'
    ? [[0, front], [0.65, 0.47], [1.0, 0.4], [1.45, 0.3], [1.75, 0.2], [2.3, -0.2], [Math.PI, -0.45]]
    : [[0, front], [0.65, front - 0.06], [1.05, 0.35], [1.3, -1.0], [Math.PI, -1.0]];
  for (let i = 1; i < pts.length; i++) {
    if (a <= pts[i][0]) {
      const t = (a - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
      return Y(pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t);
    }
  }
  return Y(-1);
}

/**
 * o: { skin:[r,g,b], hair:[r,g,b], iris:[r,g,b], style:'short'|'long'|'child'|'none',
 *      state:'open'|'closed'|'wrong'|'blank'|'presence', stubble, wrinkles, freckles, blush, redEyes, lips:[r,g,b], sad }
 */
export function paintHead(o) {
  seed = o.seed || 99;
  const c = document.createElement('canvas'); c.width = W; c.height = HH;
  const g = c.getContext('2d');
  const wrong = o.state === 'wrong', blank = o.state === 'blank', pres = o.state === 'presence';
  let skin = o.skin;
  if (wrong) skin = mix(skin, [150, 156, 150], 0.45);
  if (blank) skin = [128, 134, 142];
  if (pres) skin = [6, 5, 5];
  g.fillStyle = rgba(skin); g.fillRect(0, 0, W, HH);

  // mottled skin
  for (let i = 0; i < 900; i++) {
    const x = rnd() * W, y = rnd() * HH;
    blob(g, x, y, 3 + rnd() * 6, 3 + rnd() * 6, rnd() < 0.5 ? mix(skin, [150, 60, 50], 0.4) : mix(skin, [255, 230, 210], 0.3), 0.06);
  }
  // baked shading: sides of the face, under the chin, cheek hollows, temples
  const dark = mix(skin, [40, 20, 20], 0.6);
  for (const s of [-1, 1]) {
    blob(g, X(s * 0.85), Y(-0.1), 26 * K, 34 * K, dark, 0.25);
    blob(g, X(s * 0.55), Y(-0.25), 9 * K, 10 * K, dark, 0.18); // cheek hollow
    blob(g, X(s * 0.7), Y(0.38), 8 * K, 7 * K, dark, 0.15);   // temple
  }
  const neckY = Y(-0.72);
  const ng = g.createLinearGradient(0, neckY - 6 * K, 0, neckY + 10 * K);
  ng.addColorStop(0, rgba(dark, 0)); ng.addColorStop(1, rgba(dark, 0.55));
  g.fillStyle = ng; g.fillRect(0, neckY - 6 * K, W, HH);
  // jawline
  line(g, [[X(-1.2), Y(-0.45)], [X(-0.7), Y(-0.62)], [X(-0.25), Y(-0.7)], [X(0.25), Y(-0.7)], [X(0.7), Y(-0.62)], [X(1.2), Y(-0.45)]], dark, 0.25, 2.2 * K);

  // photo look: harsh on-camera flash, falling off hard toward the ears
  if (!pres) {
    blob(g, X(0), Y(0.05), 70 * K, 60 * K, mix(skin, [255, 245, 235], 0.35), 0.35);
    for (const [th, yn, rx, ry, a] of [[0, 0.45, 18, 7, 0.28], [0, 0.05, 3, 9, 0.35], [0, -0.06, 3.5, 3, 0.45], [-0.5, 0.02, 7, 4, 0.18], [0.5, 0.02, 7, 4, 0.18], [0, -0.6, 6, 3, 0.2]]) {
      blob(g, X(th), Y(yn), rx * K, ry * K, [255, 250, 240], blank ? a * 0.5 : a);
    }
    // moles, blemishes, broken capillaries
    for (let i = 0; i < 6; i++) ell(g, X((rnd() - 0.5) * 1.4), Y(0.3 - rnd() * 0.9), (0.5 + rnd() * 0.7) * K, (0.5 + rnd() * 0.7) * K, [70, 40, 30], 0.7);
    for (let i = 0; i < 18; i++) blob(g, X((rnd() - 0.5) * 1.2), Y(0.2 - rnd() * 0.7), 1.2 * K, 1.2 * K, [170, 70, 60], 0.25);
    if (o.wrinkles) for (let i = 0; i < 14; i++) { const th = (rnd() < 0.5 ? -1 : 1) * (0.3 + rnd() * 0.3), yn = -0.05 - rnd() * 0.15; line(g, [[X(th), Y(yn)], [X(th) + (rnd() - 0.5) * 3 * K, Y(yn) + (rnd() - 0.5) * 3 * K]], [180, 60, 60], 0.35, 0.5 * K); }
  }
  // ears
  for (const s of [-1, 1]) {
    const ex = X(s * Math.PI / 2), ey = Y(0.05);
    ell(g, ex, ey, 4.5 * K, 9 * K, mix(skin, [180, 90, 80], 0.25));
    ell(g, ex, ey, 2.5 * K, 6 * K, dark, 0.35);
  }

  // stubble
  if (o.stubble && !pres) {
    for (let i = 0; i < 2600; i++) {
      const th = (rnd() - 0.5) * 2.6, yn = -0.18 - rnd() * 0.62;
      if (Math.abs(th) < 0.22 && yn < -0.28 && yn > -0.42) continue; // lips
      if (Math.abs(th) > 0.55 && yn > -0.3) continue; // cheeks stay clean
      g.fillStyle = rgba([40, 30, 25], 0.25 + rnd() * 0.3);
      g.fillRect(X(th), Y(yn), K * 0.9, K * 0.9);
    }
  }

  // eye sockets, eyes, brows
  const browCol = mix(o.hair || [40, 30, 20], [0, 0, 0], 0.2);
  for (const s of [-1, 1]) {
    const cx = X(s * 0.36), cy = Y(0.2);
    if (pres) {
      blob(g, cx, cy, 9 * K, 6 * K, [255, 80, 10], 0.9);
      ell(g, cx, cy, 4 * K, 2 * K, [255, 200, 90]);
      ell(g, cx, cy, 1.2 * K, 1.5 * K, [255, 255, 200]);
      continue;
    }
    blob(g, cx, cy + 0.5 * K, 13 * K, 8 * K, wrong ? [10, 0, 5] : [70, 35, 35], wrong ? 0.85 : 0.38);
    if (o.redEyes && !wrong) blob(g, cx, cy + 1.5 * K, 8 * K, 4 * K, [190, 70, 70], 0.35);
    // eyebag
    if (!blank) line(g, [[cx - 5 * K, cy + 3.6 * K], [cx, cy + 4.8 * K], [cx + 5 * K, cy + 3.6 * K]], dark, o.wrinkles ? 0.55 : 0.3, 1.3 * K);
    if (o.state === 'closed') {
      ell(g, cx, cy, 6 * K, 2.6 * K, mix(skin, [120, 60, 50], 0.2));
      line(g, [[cx - 5.5 * K, cy + 0.6 * K], [cx, cy + 1.8 * K], [cx + 5.5 * K, cy + 0.6 * K]], [25, 15, 12], 0.9, 1.1 * K);
    } else if (wrong || blank) {
      ell(g, cx, cy, 6.5 * K, 3.8 * K, [0, 0, 0]);
      if (wrong) { ell(g, cx - 1.5 * K, cy - 1 * K, 0.8 * K, 0.6 * K, [200, 210, 220], 0.7); line(g, [[cx - 2 * K, cy + 3 * K], [cx - 2.5 * K, cy + 14 * K]], [20, 5, 5], 0.6, 1.2 * K); }
    } else {
      ell(g, cx, cy, 5.8 * K, 2.5 * K, [214, 204, 192]);
      line(g, [[cx + s * 4 * K, cy], [cx + s * 1.8 * K, cy + 0.6 * K]], [190, 70, 60], 0.5, 0.6 * K); // bloodshot
      const ix = cx - s * 0.6 * K;
      for (const sd of [-1, 1]) for (let v = 0; v < 3; v++) line(g, [[cx + sd * 5.5 * K, cy + (rnd() - 0.5) * 2 * K], [cx + sd * (3 + rnd()) * K, cy + (rnd() - 0.5) * 1.5 * K]], [180, 50, 50], 0.45, 0.35 * K);
      const ir = o.iris || [80, 60, 40];
      ell(g, ix, cy, 2.5 * K, 2.5 * K, mix(ir, [0, 0, 0], 0.55));
      ell(g, ix, cy, 2.1 * K, 2.1 * K, ir);
      for (let r = 0; r < 16; r++) { const an = (r / 16) * Math.PI * 2; line(g, [[ix + Math.cos(an) * 0.9 * K, cy + Math.sin(an) * 0.9 * K], [ix + Math.cos(an) * 2.1 * K, cy + Math.sin(an) * 2.1 * K]], rnd() < 0.5 ? mix(ir, [255, 240, 200], 0.35) : mix(ir, [0, 0, 0], 0.4), 0.6, 0.3 * K); }
      ell(g, ix, cy, 1.05 * K, 1.05 * K, [6, 4, 4]);
      ell(g, ix - 0.8 * K, cy - 0.9 * K, 0.55 * K, 0.45 * K, [255, 255, 255], 0.95);
      ell(g, ix + 0.9 * K, cy + 0.7 * K, 0.25 * K, 0.25 * K, [255, 255, 255], 0.6);
      blob(g, cx, cy - 1.4 * K, 6 * K, 1.6 * K, [40, 20, 15], 0.45); // lid shadow over the eye
      for (let l = 0; l < 9; l++) { const lx = cx - 5 * K + l * 1.25 * K; line(g, [[lx, cy - 2.2 * K + Math.abs(l - 4) * 0.12 * K], [lx + s * 0.4 * K, cy - 3.4 * K]], [15, 8, 6], 0.8, 0.35 * K); }
      // upper lid & crease, lower lid
      g.save(); g.beginPath(); g.ellipse(cx, cy, 5.8 * K, 2.5 * K, 0, 0, Math.PI * 2); g.clip();
      g.fillStyle = rgba(mix(skin, [80, 40, 30], 0.3)); g.fillRect(cx - 7 * K, cy - 3 * K, 14 * K, 1.4 * K); g.restore();
      line(g, [[cx - 6 * K, cy + 0.2 * K], [cx - 3 * K, cy - 2.4 * K], [cx + 3 * K, cy - 2.4 * K], [cx + 6 * K, cy + 0.2 * K]], [20, 12, 10], 0.95, 1.1 * K);
      line(g, [[cx - 5.5 * K, cy - 4.2 * K], [cx, cy - 5 * K], [cx + 5.5 * K, cy - 4.2 * K]], dark, 0.45, 0.9 * K);
      line(g, [[cx - 5 * K, cy + 1.6 * K], [cx, cy + 2.6 * K], [cx + 5 * K, cy + 1.6 * K]], [170, 90, 80], 0.6, 0.8 * K);
    }
    // brow: sad (inner end raised)
    const inner = [X(s * 0.13), Y(o.sad ? 0.355 : 0.32)], mid = [X(s * 0.33), Y(0.335)], outer = [X(s * 0.56), Y(0.29)];
    line(g, [inner, mid, outer], blank ? [60, 62, 70] : browCol, wrong ? 0.6 : 0.9, (o.style === 'short' ? 2.4 : 1.7) * K);
    for (let i = 0; i < 14; i++) {
      const t = rnd(); const bx = inner[0] + (outer[0] - inner[0]) * t, by = inner[1] + (outer[1] - inner[1]) * t - Math.sin(t * Math.PI) * 1.5 * K;
      line(g, [[bx, by + 1 * K], [bx + s * 1.5 * K, by - 0.6 * K]], browCol, 0.5, 0.6 * K);
    }
    // crow's feet
    if (o.wrinkles) for (let i = 0; i < 3; i++) line(g, [[X(s * 0.52), Y(0.2) + (i - 1) * 2 * K], [X(s * 0.6), Y(0.2) + (i - 1) * 3 * K]], dark, 0.35, 0.6 * K);
  }
  if (!pres) {
    // nose
    const nb = Y(0.2), nt = Y(-0.06);
    for (const s of [-1, 1]) line(g, [[X(s * 0.06), nb], [X(s * 0.075), nt - 2 * K], [X(s * 0.11), nt + 2 * K]], dark, 0.35, 1.2 * K);
    blob(g, X(0), nt, 3 * K, 3 * K, mix(skin, [255, 235, 220], 0.5), 0.5);
    for (const s of [-1, 1]) ell(g, X(s * 0.055), Y(-0.12), 1.4 * K, 0.9 * K, [40, 20, 18], 0.85);
    blob(g, X(0), Y(-0.15), 7 * K, 2 * K, dark, 0.3);
    // nasolabial folds
    for (const s of [-1, 1]) line(g, [[X(s * 0.13), Y(-0.1)], [X(s * 0.2), Y(-0.24)], [X(s * 0.2), Y(-0.36)]], dark, o.wrinkles ? 0.45 : 0.22, 1.1 * K);
    // mouth
    const my = Y(-0.35), mw = 8.5 * K;
    const lips = o.lips || mix(skin, [150, 60, 60], 0.45);
    if (wrong || blank) {
      ell(g, X(0), my + 2 * K, 5.5 * K, (wrong ? 6 : 2.5) * K, [5, 0, 0]);
      if (wrong) ell(g, X(0), my + 3.5 * K, 3.5 * K, 3.5 * K, [40, 5, 5], 0.8);
    } else {
      ell(g, X(0), my - 1.1 * K, mw, 1.6 * K, mix(lips, [60, 20, 20], 0.2));
      ell(g, X(0), my + 1.5 * K, mw * 0.85, 2.1 * K, lips);
      blob(g, X(0), my + 1.2 * K, mw * 0.5, 1 * K, [255, 220, 210], 0.25);
      for (let l = 0; l < 14; l++) { const lx = X(0) - mw * 0.8 + l * mw * 0.12; line(g, [[lx, my + 0.4 * K], [lx + (rnd() - 0.5) * 0.4 * K, my + 3 * K]], mix(lips, [60, 20, 20], 0.4), 0.35, 0.3 * K); }
      const down = (o.sad ? 1.6 : 0.6) * K;
      line(g, [[X(0) - mw - 0.5 * K, my + down], [X(0) - mw * 0.5, my + 0.1 * K], [X(0), my + 0.3 * K], [X(0) + mw * 0.5, my + 0.1 * K], [X(0) + mw + 0.5 * K, my + down]], [45, 15, 15], 0.95, 1.0 * K);
      blob(g, X(0), my + 5 * K, 6 * K, 2 * K, dark, 0.25); // under the lip
    }
    // chin
    blob(g, X(0), Y(-0.6), 7 * K, 4 * K, mix(skin, [255, 235, 220], 0.4), 0.25);
    // forehead lines
    if (o.wrinkles) for (const yn of [0.43, 0.48]) line(g, [[X(-0.35), Y(yn)], [X(-0.1), Y(yn + 0.01)], [X(0.12), Y(yn)], [X(0.35), Y(yn + 0.01)]], dark, 0.3, 0.8 * K);
    if (o.blush) for (const s of [-1, 1]) blob(g, X(s * 0.45), Y(-0.05), 9 * K, 6 * K, [200, 80, 80], wrong ? 0 : 0.22);
    if (o.freckles) for (let i = 0; i < 70; i++) { const th = (rnd() - 0.5) * 1.1, yn = 0.05 - rnd() * 0.22; ell(g, X(th), Y(yn), 0.6 * K, 0.6 * K, [140, 80, 50], 0.5); }
  } else {
    // a mouth that is too wide
    g.fillStyle = rgba([0, 0, 0]); g.fillRect(X(-0.6), Y(-0.3), X(0.6) - X(-0.6), 7 * K);
    for (let x = X(-0.58); x < X(0.58); x += 3 * K) {
      g.fillStyle = rgba([255, 120, 20], 0.9);
      g.beginPath(); g.moveTo(x, Y(-0.3)); g.lineTo(x + 2.4 * K, Y(-0.3)); g.lineTo(x + 1.2 * K, Y(-0.3) + 3 * K); g.fill();
      g.beginPath(); g.moveTo(x, Y(-0.3) + 7 * K); g.lineTo(x + 2.4 * K, Y(-0.3) + 7 * K); g.lineTo(x + 1.2 * K, Y(-0.3) + 4 * K); g.fill();
    }
  }
  // veins when the poison shows
  if (wrong) {
    for (let v = 0; v < 10; v++) {
      let x = X((rnd() - 0.5) * 1.6), y = Y(0.2 + (rnd() - 0.5) * 0.5);
      const pts = [[x, y]];
      for (let i = 0; i < 6; i++) { x += (rnd() - 0.5) * 8 * K; y += (rnd() - 0.3) * 6 * K; pts.push([x, y]); }
      line(g, pts, [70, 40, 90], 0.35, 0.8 * K);
    }
  }

  // hair
  if (o.style && o.style !== 'none') {
    const hc = o.hair;
    for (let x = 0; x < W; x++) {
      const th = ((x - W / 2) / W) * Math.PI * 2;
      const hy = hairlineY(th, o.style);
      const gr = g.createLinearGradient(0, 0, 0, hy);
      gr.addColorStop(0, rgba(mix(hc, [0, 0, 0], 0.25))); gr.addColorStop(0.85, rgba(hc)); gr.addColorStop(1, rgba(mix(hc, skin, 0.4)));
      g.fillStyle = gr; g.fillRect(x, 0, 1, hy);
    }
    // strands
    for (let i = 0; i < 1400; i++) {
      const x = rnd() * W, th = ((x - W / 2) / W) * Math.PI * 2;
      const hy = hairlineY(th, o.style);
      const y0 = rnd() * hy;
      const len = (o.style === 'short' ? 3 : 10) * K * (0.5 + rnd());
      line(g, [[x, y0], [x + (rnd() - 0.5) * 2 * K, Math.min(hy, y0 + len)]], rnd() < 0.5 ? mix(hc, [255, 240, 220], 0.25) : mix(hc, [0, 0, 0], 0.4), 0.35, 0.7 * K);
    }
    if (o.style === 'long' || o.style === 'child') line(g, [[X(0.08), 0], [X(0.08), Y(0.62)]], mix(skin, [0, 0, 0], 0.2), 0.6, 1 * K); // parting
    if (o.style === 'child') for (let x = X(-0.5); x < X(0.5); x += 2 * K) line(g, [[x, Y(0.45)], [x + (rnd() - 0.5) * 2 * K, Y(0.4) + rnd() * 3 * K]], o.hair, 0.9, 1.3 * K); // fringe
  } else if (blank) {
    g.fillStyle = rgba([70, 72, 80]); for (let x = 0; x < W; x++) { const th = ((x - W / 2) / W) * Math.PI * 2; g.fillRect(x, 0, 1, hairlineY(th, 'short')); }
  }

  // grain
  const d = g.getImageData(0, 0, W, HH);
  for (let i = 0; i < d.data.length; i += 4) { const n = (rnd() - 0.5) * (pres ? 6 : 22) + ((i / 4) % 3 === 0 ? (rnd() - 0.5) * 10 : 0); d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; }
  g.putImageData(d, 0, 0);
  return toTex(c);
}

export function hairTex(col) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = rgba(col); g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 500; i++) {
    const x = rnd() * 64, y = rnd() * 64;
    line(g, [[x, y], [x + (rnd() - 0.5) * 2, y + 4 + rnd() * 10]], rnd() < 0.5 ? mix(col, [255, 240, 220], 0.25) : mix(col, [0, 0, 0], 0.45), 0.5, 0.8);
  }
  const t = toTex(c); t.wrapT = THREE.RepeatWrapping; return t;
}

export function buildFaces(T) {
  const fam = {
    Father: { skin: [176, 128, 100], hair: [52, 38, 26], iris: [70, 90, 100], style: 'short', stubble: true, wrinkles: true, sad: true, seed: 11 },
    Mother: { skin: [204, 160, 138], hair: [92, 52, 28], iris: [70, 55, 35], style: 'long', redEyes: true, sad: true, lips: [160, 82, 82], seed: 23 },
    Lily: { skin: [214, 172, 146], hair: [128, 86, 44], iris: [60, 90, 70], style: 'child', freckles: true, blush: true, seed: 37 },
  };
  for (const [n, o] of Object.entries(fam)) {
    T['head' + n] = paintHead({ ...o, state: 'open' });
    T['head' + n + 'Closed'] = paintHead({ ...o, state: 'closed' });
    T['head' + n + 'W'] = paintHead({ ...o, state: 'wrong' });
    T['hair' + n] = hairTex(o.hair);
  }
  const dannyFace = { skin: [214, 176, 150], hair: [90, 52, 24], iris: [70, 110, 150], style: 'short', freckles: true, seed: 51 };
  T.headDanny = paintHead({ ...dannyFace, state: 'open' });
  T.headDannyClosed = paintHead({ ...dannyFace, state: 'closed' });
  T.hairDanny = hairTex([90, 52, 24]);
  T.headPresence = paintHead({ skin: [6, 5, 5], style: 'none', state: 'presence', seed: 66 });
}
