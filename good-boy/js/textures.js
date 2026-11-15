// Procedurally painted low-resolution textures. No external assets.
import * as THREE from '../vendor/three.module.js';
import { buildFaces } from './faces.js';

let seed = 1337;
export function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
const ri = (a, b) => Math.floor(a + rnd() * (b - a + 1));

function make(w, h, draw, { repeat = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.NoColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.userData.canvas = c;
  t.userData.ctx = g;
  return t;
}

const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
function noise(g, w, h, amt, alpha = 1) {
  const d = g.getImageData(0, 0, w, h);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = (rnd() - 0.5) * amt;
    d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n;
    d.data[i + 3] = d.data[i + 3] * alpha;
  }
  g.putImageData(d, 0, 0);
}
function stain(g, x, y, r, col, a) {
  for (let i = 0; i < r * 3; i++) {
    g.fillStyle = col; g.globalAlpha = a * rnd();
    const rr = rnd() * r;
    g.fillRect(x + (rnd() - 0.5) * r * 1.6, y + (rnd() - 0.5) * r, rr, rr * 0.8);
  }
  g.globalAlpha = 1;
}
function px(g, x, y, col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }

export const T = {};

export function buildTextures() {
  // ---- floors --------------------------------------------------------------
  T.planks = make(64, 64, (g, w, h) => {
    for (let i = 0; i < 4; i++) {
      const base = 70 + rnd() * 25;
      g.fillStyle = rgb(base, base * 0.62, base * 0.36);
      g.fillRect(i * 16, 0, 16, 64);
      for (let k = 0; k < 40; k++) {
        const y = ri(0, 63), x = i * 16 + ri(1, 14);
        g.fillStyle = rgb(base * 0.75, base * 0.45, base * 0.25);
        g.fillRect(x, y, 1, ri(2, 8));
      }
      g.fillStyle = '#1a0f08';
      g.fillRect(i * 16, 0, 1, 64);
      const cut = ri(10, 54);
      g.fillRect(i * 16, cut, 16, 1);
      if (rnd() < 0.6) { g.fillStyle = '#2b180c'; g.fillRect(i * 16 + ri(3, 11), ri(4, 58), 3, 2); }
    }
    noise(g, w, h, 14);
    stain(g, 40, 30, 8, '#120a05', 0.25);
  });
  T.linoleum = make(32, 32, (g) => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = (x + y) % 2 ? '#a39f86' : '#4e6a58';
      g.fillRect(x * 8, y * 8, 8, 8);
    }
    noise(g, 32, 32, 22);
    stain(g, 20, 12, 6, '#3b3020', 0.3);
  });
  T.carpetBlue = make(32, 32, (g) => { g.fillStyle = '#2f3a52'; g.fillRect(0, 0, 32, 32); noise(g, 32, 32, 30); stain(g, 10, 20, 5, '#1b2030', 0.4); });
  T.carpetPink = make(32, 32, (g) => { g.fillStyle = '#8a6070'; g.fillRect(0, 0, 32, 32); noise(g, 32, 32, 30); });
  T.runner = make(32, 64, (g) => {
    g.fillStyle = '#5a1e1c'; g.fillRect(0, 0, 32, 64);
    g.fillStyle = '#c8a050'; g.fillRect(2, 0, 2, 64); g.fillRect(28, 0, 2, 64);
    for (let y = 0; y < 64; y += 8) { g.fillStyle = '#1e2c4a'; g.fillRect(12, y + 2, 8, 4); g.fillStyle = '#c8a050'; g.fillRect(15, y + 3, 2, 2); }
    noise(g, 32, 64, 26);
  });
  T.rug = make(64, 64, (g) => {
    g.fillStyle = '#6a1f20'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#20305a'; g.fillRect(4, 4, 56, 56);
    g.fillStyle = '#6a1f20'; g.fillRect(8, 8, 48, 48);
    g.fillStyle = '#b89050';
    for (let i = 0; i < 6; i++) { g.fillRect(32 - i * 3, 20 + i * 2, i * 6, 2); g.fillRect(32 - i * 3, 42 - i * 2, i * 6, 2); }
    for (let i = 8; i < 56; i += 6) { g.fillRect(i, 10, 2, 2); g.fillRect(i, 52, 2, 2); }
    noise(g, 64, 64, 30);
  });
  T.concrete = make(64, 64, (g) => {
    g.fillStyle = '#4a4844'; g.fillRect(0, 0, 64, 64); noise(g, 64, 64, 34);
    g.strokeStyle = '#25231f'; g.beginPath(); g.moveTo(5, 10); g.lineTo(20, 22); g.lineTo(26, 40); g.lineTo(44, 50); g.stroke();
    stain(g, 40, 18, 12, '#2a2620', 0.35); stain(g, 14, 50, 9, '#38301f', 0.3);
  });
  T.cinder = make(64, 64, (g) => {
    g.fillStyle = '#3c3a36'; g.fillRect(0, 0, 64, 64);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
      const ox = (r % 2) * 11;
      const v = 80 + rnd() * 20;
      g.fillStyle = rgb(v, v * 0.97, v * 0.9);
      g.fillRect((c * 22 + ox) % 64, r * 16 + 1, 20, 14);
      g.fillRect(((c * 22 + ox) % 64) - 64, r * 16 + 1, 20, 14);
    }
    noise(g, 64, 64, 28);
    stain(g, 30, 60, 14, '#1d1a14', 0.5); stain(g, 50, 40, 6, '#3a2c18', 0.4);
  });
  // ---- walls ---------------------------------------------------------------
  T.wallRose = make(32, 64, (g) => {
    g.fillStyle = '#7d5a56'; g.fillRect(0, 0, 32, 64);
    for (let y = 2; y < 64; y += 10) for (let x = (y / 10 % 2) * 8 + 2; x < 32; x += 16) {
      g.fillStyle = '#9b7a6a'; g.fillRect(x, y, 4, 4);
      g.fillStyle = '#4d5d3c'; g.fillRect(x + 1, y + 4, 2, 3);
    }
    g.fillStyle = '#6d4c48'; g.fillRect(0, 0, 1, 64); g.fillRect(16, 0, 1, 64);
    noise(g, 32, 64, 20);
    stain(g, 10, 6, 8, '#3c2a22', 0.25);
  });
  T.wallGreen = make(32, 64, (g) => {
    for (let x = 0; x < 32; x += 8) { g.fillStyle = '#4f5a40'; g.fillRect(x, 0, 4, 64); g.fillStyle = '#626b4d'; g.fillRect(x + 4, 0, 4, 64); }
    g.fillStyle = '#8a7a5a'; g.fillRect(0, 50, 32, 2);
    g.fillStyle = '#3a2a1c'; g.fillRect(0, 52, 32, 12);
    noise(g, 32, 64, 18); stain(g, 20, 20, 10, '#2c2a1a', 0.2);
  });
  T.wallKitchen = make(32, 64, (g) => {
    g.fillStyle = '#a49d80'; g.fillRect(0, 0, 32, 64);
    for (let y = 40; y < 64; y += 6) for (let x = 0; x < 32; x += 6) { g.fillStyle = (x + y) % 12 ? '#8aa0a0' : '#6d8a8c'; g.fillRect(x, y, 5, 5); }
    noise(g, 32, 64, 20); stain(g, 8, 30, 8, '#5a4a30', 0.3);
  });
  T.wallBlue = make(32, 64, (g) => {
    g.fillStyle = '#4a5468'; g.fillRect(0, 0, 32, 64);
    for (let y = 0; y < 64; y += 6) for (let x = (y / 6 % 2) * 4; x < 32; x += 8) { g.fillStyle = '#5b6680'; g.fillRect(x, y, 2, 2); }
    noise(g, 32, 64, 18);
  });
  T.wallStars = make(32, 64, (g) => {
    g.fillStyle = '#b0a070'; g.fillRect(0, 0, 32, 64);
    for (let i = 0; i < 10; i++) { const x = ri(1, 29), y = ri(1, 61); g.fillStyle = '#e0d090'; g.fillRect(x, y + 1, 3, 1); g.fillRect(x + 1, y, 1, 3); }
    g.fillStyle = '#7a8ab0'; g.fillRect(0, 44, 32, 3);
    noise(g, 32, 64, 16);
  });
  T.wallPaint = make(32, 32, (g) => { g.fillStyle = '#5e6a6c'; g.fillRect(0, 0, 32, 32); noise(g, 32, 32, 18); stain(g, 16, 28, 10, '#3b4040', 0.4); });
  T.panel = make(32, 64, (g) => {
    for (let x = 0; x < 32; x += 8) { const v = 60 + rnd() * 15; g.fillStyle = rgb(v, v * 0.66, v * 0.4); g.fillRect(x, 0, 8, 64); g.fillStyle = '#20140a'; g.fillRect(x, 0, 1, 64); }
    noise(g, 32, 64, 16);
  });
  T.exterior = make(32, 32, (g) => { g.fillStyle = '#26282c'; g.fillRect(0, 0, 32, 32); for (let y = 0; y < 32; y += 4) { g.fillStyle = '#1a1c20'; g.fillRect(0, y, 32, 1); } noise(g, 32, 32, 12); });
  T.ceiling = make(32, 32, (g) => { g.fillStyle = '#8c8676'; g.fillRect(0, 0, 32, 32); noise(g, 32, 32, 14); stain(g, 12, 14, 9, '#6a5a3a', 0.35); });
  T.joists = make(64, 64, (g) => {
    g.fillStyle = '#2e2216'; g.fillRect(0, 0, 64, 64);
    for (let x = 0; x < 64; x += 16) { g.fillStyle = '#5a4026'; g.fillRect(x, 0, 6, 64); g.fillStyle = '#1a120a'; g.fillRect(x + 6, 0, 1, 64); }
    noise(g, 64, 64, 18);
    g.fillStyle = '#ddd'; g.globalAlpha = 0.25; g.fillRect(20, 10, 10, 1); g.fillRect(22, 11, 6, 1); g.globalAlpha = 1; // cobweb
  });
  T.trim = make(16, 16, (g) => { g.fillStyle = '#3a2614'; g.fillRect(0, 0, 16, 16); noise(g, 16, 16, 14); });
  // ---- furniture & materials ----------------------------------------------
  T.wood = make(32, 32, (g) => {
    g.fillStyle = '#5a3a22'; g.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 30; i++) { g.fillStyle = '#3e2614'; g.fillRect(0, ri(0, 31), 32, 1); }
    noise(g, 32, 32, 14);
  });
  T.woodLight = make(32, 32, (g) => { g.fillStyle = '#8a6a44'; g.fillRect(0, 0, 32, 32); for (let i = 0; i < 20; i++) { g.fillStyle = '#6a4a2c'; g.fillRect(0, ri(0, 31), 32, 1); } noise(g, 32, 32, 14); });
  T.plaid = make(32, 32, (g) => {
    g.fillStyle = '#6a4a2a'; g.fillRect(0, 0, 32, 32);
    g.globalAlpha = 0.6;
    for (let i = 0; i < 32; i += 8) { g.fillStyle = '#9a5a20'; g.fillRect(i, 0, 3, 32); g.fillRect(0, i, 32, 3); g.fillStyle = '#2a3020'; g.fillRect(i + 5, 0, 1, 32); g.fillRect(0, i + 5, 32, 1); }
    g.globalAlpha = 1; noise(g, 32, 32, 18);
  });
  T.quilt = make(32, 32, (g) => {
    const cols = ['#7a3a30', '#3a5a6a', '#8a7a50', '#4a6a3a', '#6a4a6a', '#8a5a3a'];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = cols[ri(0, 5)]; g.fillRect(x * 8, y * 8, 8, 8); g.fillStyle = '#d8c8a0'; g.fillRect(x * 8, y * 8, 8, 1); g.fillRect(x * 8, y * 8, 1, 8); }
    noise(g, 32, 32, 20);
  });
  T.metal = make(32, 32, (g) => { g.fillStyle = '#505458'; g.fillRect(0, 0, 32, 32); noise(g, 32, 32, 26); stain(g, 20, 24, 10, '#5a3418', 0.5); stain(g, 6, 8, 6, '#6a3a18', 0.4); });
  T.enamel = make(16, 16, (g) => { g.fillStyle = '#c8c4b0'; g.fillRect(0, 0, 16, 16); noise(g, 16, 16, 12); });
  T.books = make(64, 32, (g) => {
    g.fillStyle = '#1a120a'; g.fillRect(0, 0, 64, 32);
    let x = 0; const cols = ['#5a1a1a', '#1a3a5a', '#3a4a1a', '#6a5a2a', '#2a2a2a', '#5a3a5a', '#8a7a5a'];
    while (x < 64) { const bw = ri(2, 5), bh = ri(20, 30); g.fillStyle = cols[ri(0, cols.length - 1)]; g.fillRect(x, 32 - bh, bw, bh); g.fillStyle = '#c8b070'; g.fillRect(x, 32 - bh + 4, bw, 1); x += bw + (rnd() < 0.1 ? 3 : 0); }
    noise(g, 64, 32, 16);
  });
  T.door = make(32, 64, (g) => {
    g.fillStyle = '#5a3c22'; g.fillRect(0, 0, 32, 64);
    g.fillStyle = '#3a2614'; g.fillRect(4, 4, 24, 24); g.fillRect(4, 34, 24, 26);
    g.fillStyle = '#6a4a2c'; g.fillRect(6, 6, 20, 20); g.fillRect(6, 36, 20, 22);
    noise(g, 32, 64, 14);
  }, { repeat: false });
  T.frontDoor = make(32, 64, (g) => {
    g.fillStyle = '#3a1e14'; g.fillRect(0, 0, 32, 64);
    g.fillStyle = '#0a0c14'; g.fillRect(6, 6, 20, 18);
    g.fillStyle = '#3a1e14'; g.fillRect(15, 6, 2, 18); g.fillRect(6, 14, 20, 2);
    g.fillStyle = '#2a140c'; g.fillRect(5, 30, 22, 28);
    noise(g, 32, 64, 12);
  }, { repeat: false });
  T.cardboard = make(32, 32, (g) => {
    g.fillStyle = '#7a6040'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#9a8050'; g.fillRect(0, 14, 32, 4); noise(g, 32, 32, 16);
  });
  T.boxDanny = make(32, 32, (g) => {
    g.fillStyle = '#7a6040'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#9a8050'; g.fillRect(0, 0, 32, 4);
    g.fillStyle = '#111'; g.font = 'bold 9px monospace'; g.fillText('DANNY', 2, 20);
    g.fillRect(2, 23, 26, 1);
    noise(g, 32, 32, 14);
  }, { repeat: false });
  T.jacket = make(32, 32, (g) => {
    g.fillStyle = '#7a1818'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#d8ccb0'; g.fillRect(0, 0, 8, 32); g.fillRect(24, 0, 8, 32);
    g.fillStyle = '#e8dcc0'; g.font = 'bold 12px serif'; g.fillText('D', 12, 18);
    g.fillStyle = '#1a1a1a'; g.fillRect(8, 28, 16, 4);
    noise(g, 32, 32, 14);
  }, { repeat: false });
  T.tv = make(32, 32, (g) => { g.fillStyle = '#222'; g.fillRect(0, 0, 32, 32); }, { repeat: false });
  T.tvStatic = make(32, 24, (g) => { g.fillStyle = '#888'; g.fillRect(0, 0, 32, 24); }, { repeat: false });
  T.window = make(32, 32, (g) => { g.fillStyle = '#060a14'; g.fillRect(0, 0, 32, 32); }, { repeat: false });
  T.curtain = make(16, 32, (g) => {
    g.fillStyle = '#5a3030'; g.fillRect(0, 0, 16, 32);
    for (let x = 0; x < 16; x += 4) { g.fillStyle = '#3a1a1a'; g.fillRect(x, 0, 1, 32); }
    for (let i = 0; i < 6; i++) { g.fillStyle = '#8a6a4a'; g.fillRect(ri(1, 13), ri(1, 29), 2, 2); }
    noise(g, 16, 32, 12);
  });
  T.photoDanny = make(32, 40, (g) => {
    g.fillStyle = '#6a5030'; g.fillRect(0, 0, 32, 40);
    g.fillStyle = '#7a8aa0'; g.fillRect(3, 3, 26, 34);
    g.fillStyle = '#c89a78'; g.fillRect(10, 10, 12, 14);
    g.fillStyle = '#4a2c18'; g.fillRect(9, 7, 14, 5);
    g.fillStyle = '#111'; g.fillRect(12, 15, 2, 2); g.fillRect(18, 15, 2, 2);
    g.fillStyle = '#7a2020'; g.fillRect(13, 20, 6, 1);
    g.fillStyle = '#8a1a1a'; g.fillRect(6, 25, 20, 12);
    g.fillStyle = '#000'; g.beginPath(); g.moveTo(20, 0); g.lineTo(32, 0); g.lineTo(32, 12); g.fill();
    noise(g, 32, 40, 12);
  }, { repeat: false });
  T.photoFamily = make(40, 32, (g) => {
    g.fillStyle = '#5a4030'; g.fillRect(0, 0, 40, 32); g.fillStyle = '#6a8a5a'; g.fillRect(2, 2, 36, 28);
    const xs = [7, 15, 23, 31], hs = [16, 14, 11, 8], cs = ['#5a1a1a', '#6a5068', '#8a1a1a', '#5a78a8'];
    xs.forEach((x, i) => { g.fillStyle = cs[i]; g.fillRect(x - 2, 30 - hs[i], 5, hs[i] - 3); g.fillStyle = '#c89a78'; g.fillRect(x - 1, 30 - hs[i] - 4, 3, 4); });
    g.fillStyle = '#c8a050'; g.fillRect(18, 26, 6, 3);
    noise(g, 40, 32, 10);
  }, { repeat: false });
  T.photoFamilyWrong = make(40, 32, (g) => {
    g.drawImage(T.photoFamily.image, 0, 0);
    [7, 15, 23, 31].forEach((x, i) => { const hs = [16, 14, 11, 8]; g.fillStyle = '#000'; g.fillRect(x - 1, 30 - hs[i] - 4, 3, 2); });
    g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(21, 4); g.lineTo(27, 28); g.moveTo(27, 4); g.lineTo(21, 28); g.stroke();
  }, { repeat: false });
  T.drawing = make(32, 32, (g) => {
    g.fillStyle = '#e8e4d8'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#3a8a3a'; g.fillRect(0, 18, 32, 2);
    g.fillStyle = '#6a3a1a'; g.fillRect(0, 20, 32, 12);
    g.strokeStyle = '#c03030'; g.beginPath(); g.moveTo(4, 12); g.lineTo(11, 5); g.lineTo(18, 12); g.stroke(); g.strokeRect(5, 12, 12, 6);
    g.fillStyle = '#e0c020'; g.fillRect(26, 2, 4, 4);
    const fig = (x, y, h, c) => { g.fillStyle = c; g.fillRect(x, y, 1, h); g.fillRect(x - 1, y - 2, 3, 2); g.fillRect(x - 1, y + 2, 3, 1); };
    fig(20, 12, 6, '#2030a0'); fig(23, 12, 6, '#a030a0'); fig(26, 14, 4, '#3060c0');
    g.fillStyle = '#c8a050'; g.fillRect(28, 16, 3, 2);
    fig(12, 25, 5, '#000'); // a figure under the ground
    g.fillStyle = '#000'; g.fillRect(10, 22, 6, 1);
    g.fillStyle = '#e0c020'; g.fillRect(11, 23, 1, 1); g.fillRect(13, 23, 1, 1);
  }, { repeat: false });
  T.drawingWall = make(32, 32, (g) => {
    g.fillStyle = '#e0dccc'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#e0c020'; g.fillRect(4, 4, 6, 6);
    g.fillStyle = '#c04040'; g.fillRect(12, 20, 10, 8);
    g.fillStyle = '#3050a0'; g.fillRect(16, 10, 2, 10);
  }, { repeat: false });
  T.calendar = make(32, 40, (g) => {
    g.fillStyle = '#d8d4c4'; g.fillRect(0, 0, 32, 40);
    g.fillStyle = '#6a8aa0'; g.fillRect(0, 0, 32, 14);
    g.fillStyle = '#222'; g.font = '6px monospace'; g.fillText('DEC 98', 4, 22);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 7; x++) { g.fillStyle = '#9a9a8a'; g.fillRect(2 + x * 4, 25 + y * 5, 3, 4); }
    g.strokeStyle = '#c01010'; g.strokeRect(13, 29, 6, 6);
    g.fillStyle = '#c01010'; g.fillRect(14, 31, 1, 1);
  }, { repeat: false });
  T.clockFace = make(16, 16, (g) => {
    g.fillStyle = '#d8d0b8'; g.beginPath(); g.arc(8, 8, 7.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111'; g.fillRect(8, 3, 1, 5); g.fillRect(8, 8, 4, 1);
  }, { repeat: false });
  T.fridge = make(32, 64, (g) => {
    g.fillStyle = '#c8c4b0'; g.fillRect(0, 0, 32, 64);
    g.fillStyle = '#8a8676'; g.fillRect(0, 20, 32, 1); g.fillRect(26, 8, 2, 8); g.fillRect(26, 26, 2, 12);
    g.fillStyle = '#e8e4d8'; g.fillRect(6, 30, 10, 10); g.fillStyle = '#c03030'; g.fillRect(8, 32, 3, 3); g.fillStyle = '#3050a0'; g.fillRect(12, 35, 2, 4);
    g.fillStyle = '#e0c020'; g.fillRect(6, 4, 3, 3); g.fillStyle = '#30a030'; g.fillRect(14, 10, 3, 3);
    noise(g, 32, 64, 10);
  }, { repeat: false });
  T.stove = make(32, 32, (g) => {
    g.fillStyle = '#c8c4b0'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#222'; [[8, 8], [24, 8], [8, 24], [24, 24]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); });
    noise(g, 32, 32, 10);
  }, { repeat: false });
  T.cabinet = make(32, 32, (g) => {
    g.fillStyle = '#6a4a2c'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#4a3018'; g.fillRect(2, 2, 13, 28); g.fillRect(17, 2, 13, 28);
    g.fillStyle = '#7a5a3a'; g.fillRect(4, 4, 9, 24); g.fillRect(19, 4, 9, 24);
    g.fillStyle = '#c8b070'; g.fillRect(13, 14, 1, 3); g.fillRect(18, 14, 1, 3);
    noise(g, 32, 32, 12);
  });
  T.counterTop = make(16, 16, (g) => { g.fillStyle = '#8a8a70'; g.fillRect(0, 0, 16, 16); noise(g, 16, 16, 24); });
  T.furnace = make(32, 64, (g) => {
    g.fillStyle = '#4a4440'; g.fillRect(0, 0, 32, 64);
    g.fillStyle = '#2a2420'; g.fillRect(2, 2, 28, 1); g.fillRect(2, 40, 28, 1);
    for (let i = 0; i < 10; i++) stain(g, ri(0, 32), ri(0, 64), 5, '#6a3414', 0.4);
    g.fillStyle = '#c8c0a0'; g.fillRect(4, 6, 10, 5); g.fillStyle = '#222'; g.fillRect(5, 8, 8, 1);
    noise(g, 32, 64, 24);
  }, { repeat: false });
  T.grille = make(32, 16, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 32, 16);
    for (let x = 1; x < 32; x += 4) { g.fillStyle = '#ff7a20'; g.fillRect(x, 2, 2, 12); g.fillStyle = '#ffd060'; g.fillRect(x, 6, 2, 4); }
  }, { repeat: false });
  T.grilleTeeth = make(32, 16, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 32, 16);
    for (let x = 0; x < 32; x += 4) {
      g.fillStyle = '#ff6a10';
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 4, 0); g.lineTo(x + 2, 7); g.fill();
      g.beginPath(); g.moveTo(x, 16); g.lineTo(x + 4, 16); g.lineTo(x + 2, 9); g.fill();
    }
    g.fillStyle = '#ffe080'; g.fillRect(0, 7, 32, 2);
  }, { repeat: false });
  T.jars = make(32, 16, (g) => {
    g.fillStyle = '#1a140c'; g.fillRect(0, 0, 32, 16);
    const cols = ['#8a3a1a', '#9a8a2a', '#5a7a2a', '#7a2a3a'];
    for (let x = 1; x < 32; x += 6) { g.fillStyle = cols[ri(0, 3)]; g.fillRect(x, 4, 5, 12); g.fillStyle = '#aaa'; g.fillRect(x, 3, 5, 2); }
    noise(g, 32, 16, 14);
  });
  T.washer = make(32, 32, (g) => {
    g.fillStyle = '#c0bca8'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#444'; g.fillRect(0, 0, 32, 6); g.fillStyle = '#aaa'; g.fillRect(4, 2, 3, 2); g.fillRect(24, 2, 3, 2);
    g.fillStyle = '#222'; g.beginPath(); g.arc(16, 19, 9, 0, 7); g.fill(); g.fillStyle = '#304050'; g.beginPath(); g.arc(16, 19, 6, 0, 7); g.fill();
    noise(g, 32, 32, 10);
  }, { repeat: false });
  T.dollhouse = make(32, 32, (g) => {
    g.fillStyle = '#d8c8a8'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#5a3a3a'; g.fillRect(0, 0, 32, 2); g.fillRect(0, 16, 32, 2); g.fillRect(15, 0, 2, 32);
    g.fillStyle = '#1a1a1a'; g.fillRect(0, 24, 32, 8);
    g.fillStyle = '#c8a050'; g.fillRect(4, 12, 3, 4);
    g.fillStyle = '#3050a0'; g.fillRect(20, 9, 2, 6); g.fillStyle = '#a030a0'; g.fillRect(25, 9, 2, 6);
    g.fillStyle = '#8a1a1a'; g.fillRect(9, 26, 2, 5); g.fillStyle = '#ff7a20'; g.fillRect(20, 27, 4, 3);
  }, { repeat: false });
  T.ornaments = make(16, 16, (g) => { g.fillStyle = '#1a3a1a'; g.fillRect(0, 0, 16, 16); for (let i = 0; i < 10; i++) { g.fillStyle = '#2a5a2a'; g.fillRect(ri(0, 14), ri(0, 14), 3, 2); } g.fillStyle = '#c02020'; g.fillRect(4, 6, 2, 2); g.fillStyle = '#d0b030'; g.fillRect(10, 11, 2, 2); });
  T.stocking = make(16, 32, (g) => { g.fillStyle = '#8a1414'; g.fillRect(0, 0, 16, 32); g.fillStyle = '#e8e0d0'; g.fillRect(0, 0, 16, 7); g.fillStyle = '#2a2a2a'; g.font = 'bold 7px monospace'; g.fillText('D', 5, 6); }, { repeat: false });
  T.thermostat = make(16, 16, (g) => { g.fillStyle = '#c8c0a8'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#c02020'; g.font = '7px monospace'; g.fillText('78', 3, 11); }, { repeat: false });
  T.detector = make(16, 16, (g) => { g.fillStyle = '#e0dcd0'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#222'; g.fillRect(3, 3, 10, 1); g.fillRect(3, 6, 10, 1); g.fillRect(3, 9, 10, 1); g.fillStyle = '#1a0000'; g.fillRect(7, 12, 2, 2); }, { repeat: false });
  T.cards = make(16, 16, (g) => { g.fillStyle = '#e0dcd0'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#6a6a8a'; g.fillRect(3, 4, 10, 1); g.fillRect(3, 7, 7, 1); g.fillStyle = '#5a7a5a'; g.fillRect(6, 10, 4, 4); }, { repeat: false });
  T.dogBed = make(16, 16, (g) => { g.fillStyle = '#5a6a3a'; g.fillRect(0, 0, 16, 16); for (let i = 0; i < 16; i += 4) { g.fillStyle = '#3a4a2a'; g.fillRect(i, 0, 1, 16); g.fillRect(0, i, 16, 1); } noise(g, 16, 16, 14); });
  T.snowGround = make(32, 32, (g) => { g.fillStyle = '#9aa4b8'; g.fillRect(0, 0, 32, 32); for (let i = 0; i < 26; i++) { g.fillStyle = rnd() < 0.5 ? '#8a94a8' : '#aab4c6'; g.fillRect(ri(0, 31), ri(0, 31), ri(2, 7), 1); } noise(g, 32, 32, 20); });

  // ---- faces ---------------------------------------------------------------
  const face = (skin, hair, opts = {}) => make(16, 16, (g) => {
    g.fillStyle = skin; g.fillRect(0, 0, 16, 16);
    g.fillStyle = hair; g.fillRect(0, 0, 16, opts.fringe ?? 4); g.fillRect(0, 0, 2, opts.side ?? 8); g.fillRect(14, 0, 2, opts.side ?? 8);
    if (opts.wrong) {
      g.fillStyle = '#000'; g.fillRect(3, 6, 4, 4); g.fillRect(9, 6, 4, 4);
      g.fillRect(6, 11, 4, 5); g.fillStyle = '#300'; g.fillRect(7, 12, 2, 3);
    } else if (opts.blank) {
      g.fillStyle = '#000'; g.fillRect(4, 7, 2, 2); g.fillRect(10, 7, 2, 2);
    } else {
      g.fillStyle = '#e8e0d0'; g.fillRect(4, 7, 3, 2); g.fillRect(9, 7, 3, 2);
      g.fillStyle = '#1a1008'; g.fillRect(5, 7, 1, 2); g.fillRect(10, 7, 1, 2);
      g.fillStyle = opts.brow || hair; g.fillRect(4, 6, 3, 1); g.fillRect(9, 6, 3, 1);
      g.fillStyle = 'rgba(60,20,20,0.5)'; g.fillRect(4, 9, 3, 1); g.fillRect(9, 9, 3, 1); // tired eyes
      g.fillStyle = '#7a4030'; g.fillRect(6, 12, 4, 1);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(7, 9, 2, 2);
    }
    if (opts.stubble) { g.fillStyle = 'rgba(30,20,10,0.35)'; g.fillRect(3, 11, 10, 5); }
    noise(g, 16, 16, 10);
  }, { repeat: false });
  T.faceFather = face('#b88a6a', '#3a2a1a', { stubble: true });
  T.faceMother = face('#c89a80', '#6a3a1a', { side: 14 });
  T.faceLily = face('#d0a488', '#8a5a2a', { side: 12, fringe: 5 });
  T.faceFatherW = face('#a07a60', '#3a2a1a', { wrong: true, stubble: true });
  T.faceMotherW = face('#b08a70', '#6a3a1a', { wrong: true, side: 14 });
  T.faceLilyW = face('#b89478', '#8a5a2a', { wrong: true, side: 12, fringe: 5 });
  T.faceDanny = face('#9aa0a8', '#4a4a50', { blank: true });
  T.hairFather = make(8, 8, (g) => { g.fillStyle = '#3a2a1a'; g.fillRect(0, 0, 8, 8); noise(g, 8, 8, 14); }, { repeat: false });
  T.hairMother = make(8, 8, (g) => { g.fillStyle = '#6a3a1a'; g.fillRect(0, 0, 8, 8); noise(g, 8, 8, 14); }, { repeat: false });
  T.hairLily = make(8, 8, (g) => { g.fillStyle = '#8a5a2a'; g.fillRect(0, 0, 8, 8); noise(g, 8, 8, 14); }, { repeat: false });
  T.presence = make(16, 16, (g) => { g.fillStyle = '#050505'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#ff5a10'; g.fillRect(3, 6, 3, 2); g.fillRect(10, 6, 3, 2); g.fillStyle = '#ffb040'; g.fillRect(4, 6, 1, 1); g.fillRect(11, 6, 1, 1); g.fillStyle = '#ff3000'; g.fillRect(5, 11, 6, 1); g.fillRect(4, 12, 8, 1); }, { repeat: false });

  // ---- photographic fabrics & skin (retro-realism: photo textures on jagged meshes)
  const folds = (g, w, h, amt) => {
    for (let i = 0; i < 7; i++) {
      const x = rnd() * w, wd = 3 + rnd() * 8;
      const gr = g.createLinearGradient(x - wd, 0, x + wd, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.45, `rgba(0,0,0,${amt})`); gr.addColorStop(0.55, `rgba(255,255,255,${amt * 0.5})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - wd, 0, wd * 2, h);
    }
    for (let i = 0; i < 4; i++) { // creases across
      const y = rnd() * h; g.fillStyle = `rgba(0,0,0,${amt * 0.7})`; g.fillRect(0, y, w, 1); g.fillStyle = `rgba(255,255,255,${amt * 0.3})`; g.fillRect(0, y + 1, w, 1);
    }
  };
  const weave = (g, w, h, a) => { const d = g.getImageData(0, 0, w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const v = ((x + y) % 2 ? a : -a) + (rnd() - 0.5) * a * 2; d.data[i] += v; d.data[i + 1] += v; d.data[i + 2] += v; } g.putImageData(d, 0, 0); };
  T.flannel = make(64, 64, (g) => {
    g.fillStyle = '#5e1414'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(12,6,6,0.85)'; for (let k = 0; k < 64; k += 32) { g.fillRect(0, k + 8, 64, 9); g.fillRect(k + 8, 0, 9, 64); }
    g.fillStyle = 'rgba(20,10,10,0.5)'; for (let k = 0; k < 64; k += 32) { g.fillRect(0, k + 24, 64, 2); g.fillRect(k + 24, 0, 2, 64); }
    g.fillStyle = 'rgba(200,170,120,0.25)'; for (let k = 0; k < 64; k += 32) { g.fillRect(0, k + 29, 64, 1); g.fillRect(k + 29, 0, 1, 64); }
    weave(g, 64, 64, 9); folds(g, 64, 64, 0.35);
    stain(g, 20, 50, 6, '#2a1410', 0.35);
  });
  T.jeans = make(64, 64, (g) => {
    g.fillStyle = '#2c3e5e'; g.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if ((x + y * 2) % 4 === 0) { g.fillStyle = 'rgba(160,180,210,0.18)'; g.fillRect(x, y, 1, 1); }
    const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0.3, 'rgba(180,200,230,0)'); gr.addColorStop(0.5, 'rgba(180,200,230,0.22)'); gr.addColorStop(0.7, 'rgba(180,200,230,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(200,150,60,0.6)'; g.fillRect(0, 0, 1, 64); g.fillRect(2, 0, 1, 64);
    weave(g, 64, 64, 8); folds(g, 64, 64, 0.4);
  });
  T.cardigan = make(64, 64, (g) => {
    g.fillStyle = '#5c4660'; g.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 3) for (let x = 0; x < 64; x += 4) { g.fillStyle = 'rgba(30,15,30,0.35)'; g.fillRect(x + (y % 6 ? 2 : 0), y, 2, 2); g.fillStyle = 'rgba(200,170,200,0.15)'; g.fillRect(x + 1, y + 1, 1, 1); }
    for (let i = 0; i < 25; i++) { g.fillStyle = 'rgba(220,200,220,0.35)'; g.fillRect(rnd() * 64, rnd() * 64, 1, 1); } // pilling
    weave(g, 64, 64, 6); folds(g, 64, 64, 0.35);
  });
  T.slacks = make(64, 64, (g) => { g.fillStyle = '#3a3430'; g.fillRect(0, 0, 64, 64); weave(g, 64, 64, 7); folds(g, 64, 64, 0.45); });
  T.pajama = make(64, 64, (g) => {
    g.fillStyle = '#6a84ac'; g.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 6) for (let x = (y % 12) / 2; x < 64; x += 6) { g.fillStyle = '#e0d8b0'; g.fillRect(x, y, 2, 2); g.fillStyle = 'rgba(90,60,30,0.6)'; g.fillRect(x + 1, y + 1, 1, 1); }
    weave(g, 64, 64, 7); folds(g, 64, 64, 0.35); stain(g, 40, 20, 5, '#4a5a70', 0.3);
  });
  T.hoodie = make(64, 64, (g) => { g.fillStyle = '#4a4c52'; g.fillRect(0, 0, 64, 64); weave(g, 64, 64, 6); folds(g, 64, 64, 0.4); g.fillStyle = 'rgba(200,200,210,0.35)'; g.fillRect(28, 20, 8, 3); });
  // Biscuit's coat: golden, with darker guard hairs running one way
  T.fur = make(32, 32, (g) => {
    // short golden coat: soft mottling, little tufts in every direction, a few dark guard hairs
    g.fillStyle = '#d4a258'; g.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 60; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(236,190,120,0.55)' : 'rgba(176,122,58,0.5)'; g.fillRect(ri(0, 31), ri(0, 31), ri(2, 4), ri(2, 4)); }
    for (let i = 0; i < 90; i++) {
      const x = ri(0, 31), y = ri(0, 31);
      g.fillStyle = rnd() < 0.6 ? '#f0c888' : '#a8783c';
      if (rnd() < 0.5) g.fillRect(x, y, 1, 2); else g.fillRect(x, y, 2, 1);
    }
    for (let i = 0; i < 14; i++) { g.fillStyle = '#7a5226'; g.fillRect(ri(0, 31), ri(0, 31), 1, 1); }
    noise(g, 32, 32, 10);
  });
  T.bark = make(32, 64, (g) => {
    g.fillStyle = '#2a2420'; g.fillRect(0, 0, 32, 64);
    for (let x = 0; x < 32; x += ri(2, 4)) { g.fillStyle = rnd() < 0.5 ? '#1a1612' : '#3a322a'; g.fillRect(x, 0, ri(1, 2), 64); }
    for (let i = 0; i < 30; i++) { g.fillStyle = '#14100c'; g.fillRect(ri(0, 31), ri(0, 63), ri(2, 5), 1); }
    noise(g, 32, 64, 18);
  });
  T.fence = make(16, 32, (g) => {
    g.fillStyle = '#4a4036'; g.fillRect(0, 0, 16, 32);
    for (let i = 0; i < 20; i++) { g.fillStyle = rnd() < 0.5 ? '#3a3028' : '#5a5044'; g.fillRect(ri(0, 15), ri(0, 31), 1, ri(3, 9)); }
    noise(g, 16, 32, 16);
  });
  T.drift = make(32, 32, (g) => {
    g.fillStyle = '#b4bccc'; g.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 40; i++) { g.fillStyle = rnd() < 0.5 ? '#a0a8ba' : '#c8d0dc'; g.fillRect(ri(0, 31), ri(0, 31), ri(2, 6), 1); }
    noise(g, 32, 32, 12);
  });
  T.dirt = make(16, 16, (g) => { g.fillStyle = '#2e241c'; g.fillRect(0, 0, 16, 16); for (let i = 0; i < 30; i++) { g.fillStyle = rnd() < 0.5 ? '#1e1812' : '#4a3a2a'; g.fillRect(ri(0, 15), ri(0, 15), 1, 1); } noise(g, 16, 16, 14); });
  T.skin = make(64, 64, (g) => {
    g.fillStyle = '#c8987a'; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 300; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(150,80,60,0.12)' : 'rgba(255,230,210,0.12)'; g.fillRect(rnd() * 64, rnd() * 64, 2 + rnd() * 3, 2 + rnd() * 3); }
    for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(80,40,30,0.25)'; g.fillRect(rnd() * 64, rnd() * 64, 1, 1); }
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(70,40,90,0.15)'; g.fillRect(rnd() * 64, 0, 1, 64); } // veins
    noise(g, 64, 64, 18);
  });
  buildFaces(T);
  return T;
}

// Animated textures ----------------------------------------------------------
let staticFace = 0;
export function updateTV(t, showFace) {
  const tex = T.tvStatic, g = tex.userData.ctx;
  const d = g.createImageData(32, 24);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = rnd() * 200 + 30;
    d.data[i] = v * 0.85; d.data[i + 1] = v * 0.9; d.data[i + 2] = v; d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  // rolling bar
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, (t * 20) % 24, 32, 4);
  if (showFace) {
    staticFace = 1;
    g.fillStyle = 'rgba(0,0,0,0.75)';
    g.fillRect(12, 6, 3, 3); g.fillRect(18, 6, 3, 3); g.fillRect(14, 14, 5, 4);
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(10, 2, 13, 20);
  }
  tex.needsUpdate = true;
}

// The thing at the window: too tall, too thin, its face and hand pressed flat to the glass.
export function figureWindow() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace;
  t.userData.ctx = g;
  return t;
}
export function paintFigureWindow(tex, b, stage) {
  const g = tex.userData.ctx;
  g.fillStyle = rgb(6 + b * 170, 10 + b * 180, 20 + b * 210); g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(200,210,230,${0.2 + b * 0.5})`; g.fillRect(ri(0, 63), ri(0, 63), 1, 3); }
  const v = Math.max(0.35, b);
  // body: a long black shape filling the pane, shoulders too narrow, arms too long
  g.fillStyle = `rgba(0,0,0,${0.97})`;
  g.fillRect(24, 22, 17, 42); g.fillRect(20, 26, 4, 34); g.fillRect(41, 26, 4, 30);
  // neck stretched
  g.fillRect(29, 14, 7, 10);
  // the face, grey and too long, pressed so hard against the glass the skin has gone flat and white
  for (let y = 0; y < 24; y++) {
    const w = y < 3 ? 9 + y * 2 : y < 15 ? 16 : Math.max(6, 16 - (y - 15) * 1.4);
    for (let x = 0; x < w; x++) {
      const cx = (x - w / 2) / (w / 2), cy = (y - 9) / 12;
      const lit = (1 - Math.min(1, cx * cx * 0.7 + cy * cy * 0.5)) * (0.75 + rnd() * 0.25);
      const k = v * lit;
      g.fillStyle = rgb(30 + 170 * k, 32 + 165 * k, 30 + 150 * k);
      g.fillRect(Math.round(32 - w / 2 + x), y, 1, 1);
    }
  }
  // sunken sockets, not quite level; tiny wet points of light deep inside
  g.fillStyle = 'rgba(0,0,0,0.92)';
  g.fillRect(26, 6, 5, 4); g.fillRect(25, 7, 7, 2); g.fillRect(34, 7, 5, 4); g.fillRect(33, 8, 7, 2);
  g.fillStyle = rgb(255 * v, 250 * v, 220 * v); g.fillRect(28, 8, 1, 1); g.fillRect(36, 9, 1, 1);
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(31, 10, 2, 4); // nose, crushed flat
  // the mouth, stretched far too wide and too long
  g.fillStyle = '#000';
  const mh = stage > 0 ? 8 : 3;
  g.fillRect(28, 15, 9, mh); g.fillRect(29, 15 + mh, 7, 1); g.fillRect(27, 16, 1, Math.max(1, mh - 2)); g.fillRect(37, 16, 1, Math.max(1, mh - 2));
  if (stage > 0) { g.fillStyle = rgb(160 * v, 150 * v, 120 * v); for (let i = 0; i < 4; i++) g.fillRect(29 + i * 2, 15, 1, 2); }
  // blotches where it presses the glass
  g.fillStyle = `rgba(230,230,220,${0.35 * v})`; g.fillRect(29, 2, 6, 3); g.fillRect(27, 11, 3, 2); g.fillRect(35, 12, 3, 2);
  // its hand, flat on the pane, fingers too long
  g.fillStyle = rgb(130 * v + 20, 128 * v + 20, 120 * v + 18);
  g.fillRect(44, 22, 7, 7);
  for (let i = 0; i < 4; i++) g.fillRect(44 + i * 2, 10 - (i === 1 || i === 2 ? 2 : 0), 1, 12);
  g.fillRect(51, 24, 5, 1);
  // breath fog on the glass around the mouth
  g.fillStyle = `rgba(200,205,215,${0.25 + b * 0.2})`; g.fillRect(24, 16, 18, 6);
  g.fillStyle = '#1a120a'; g.fillRect(31, 0, 2, 64); g.fillRect(0, 31, 64, 2);
  g.fillRect(0, 0, 64, 2); g.fillRect(0, 62, 64, 2); g.fillRect(0, 0, 2, 64); g.fillRect(62, 0, 2, 64);
  tex.needsUpdate = true;
}
export function updateWindow(flash, figure) {
  const tex = T.window, g = tex.userData.ctx;
  const b = flash;
  g.fillStyle = rgb(6 + b * 180, 10 + b * 190, 20 + b * 220); g.fillRect(0, 0, 32, 32);
  // snow streaks
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(200,210,230,${0.25 + b * 0.5})`;
    const x = ri(0, 31), y = ri(0, 31);
    g.fillRect(x, y, 1, 2);
  }
  if (b > 0.05) {
    g.fillStyle = `rgba(20,24,30,${b})`; g.fillRect(0, 24, 32, 8); // tree line / fence
    for (let x = 0; x < 32; x += 5) g.fillRect(x, 20 + (x % 3), 1, 6);
  }
  if (figure && b > 0.05) {
    g.fillStyle = 'rgba(0,0,0,0.95)';
    g.fillRect(14, 9, 5, 5); g.fillRect(12, 14, 9, 12); g.fillRect(13, 26, 3, 6); g.fillRect(17, 26, 3, 6);
  }
  // mullions
  g.fillStyle = '#1a120a'; g.fillRect(15, 0, 2, 32); g.fillRect(0, 15, 32, 2);
  g.fillRect(0, 0, 32, 1); g.fillRect(0, 31, 32, 1); g.fillRect(0, 0, 1, 32); g.fillRect(31, 0, 1, 32);
  tex.needsUpdate = true;
}
