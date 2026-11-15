// Who Danny was, and what happened. Photographs, letters, Danny's room, and the
// physical puzzle pieces of the night: crayons, the stool, the latch, the drawer.
import * as THREE from '../vendor/three.module.js';
import { ps1Mat } from './ps1.js';
import { T } from './textures.js';
import { box, prop, addItem, items, colliders, refs, spots, light, lights, doors, BASE_Y } from './house.js';

export const inspectables = [];
export const puzzle = {};

// ---------------------------------------------------------------------------
// Photographs, painted like faded 90s prints
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
function canvasTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace;
  return t;
}
function person(g, x, y, h, o) {
  // y = feet. A simple but readable photographed person.
  const hw = h * 0.12, headR = h * 0.075;
  const hy = y - h + headR;
  g.fillStyle = o.pants || '#2a3a5a'; g.fillRect(x - hw * 0.8, y - h * 0.45, hw * 0.75, h * 0.45); g.fillRect(x + hw * 0.05, y - h * 0.45, hw * 0.75, h * 0.45);
  g.fillStyle = o.shirt || '#7a1a1a'; g.beginPath(); g.moveTo(x - hw, y - h * 0.82); g.lineTo(x + hw, y - h * 0.82); g.lineTo(x + hw * 0.85, y - h * 0.44); g.lineTo(x - hw * 0.85, y - h * 0.44); g.fill();
  g.fillRect(x - hw * 1.35, y - h * 0.8, hw * 0.4, h * 0.32); g.fillRect(x + hw * 0.95, y - h * 0.8, hw * 0.4, h * 0.32);
  g.fillStyle = o.skin || '#d0a080'; g.fillRect(x - hw * 1.3, y - h * 0.5, hw * 0.3, h * 0.08); g.fillRect(x + hw, y - h * 0.5, hw * 0.3, h * 0.08);
  g.fillRect(x - headR * 0.35, hy + headR * 0.8, headR * 0.7, h * 0.05);
  g.beginPath(); g.ellipse(x, hy, headR * 0.85, headR, 0, 0, 7); g.fill();
  g.fillStyle = o.hair || '#4a2c18'; g.beginPath(); g.ellipse(x, hy - headR * 0.45, headR * 0.92, headR * 0.6, 0, Math.PI, 0); g.fill();
  if (o.long) g.fillRect(x - headR * 0.95, hy - headR * 0.3, headR * 0.35, headR * 1.8), g.fillRect(x + headR * 0.6, hy - headR * 0.3, headR * 0.35, headR * 1.8);
  if (o.cap) { g.fillStyle = o.cap; g.fillRect(x - headR, hy - headR * 1.05, headR * 2, headR * 0.6); g.fillRect(x - headR * 1.3, hy - headR * 0.55, headR * 1.2, headR * 0.2); }
  g.fillStyle = '#1a1010'; g.fillRect(x - headR * 0.45, hy - headR * 0.05, Math.max(1, headR * 0.2), Math.max(1, headR * 0.18)); g.fillRect(x + headR * 0.25, hy - headR * 0.05, Math.max(1, headR * 0.2), Math.max(1, headR * 0.18));
  g.strokeStyle = '#7a3030'; g.lineWidth = Math.max(1, headR * 0.12); g.beginPath();
  if (o.smile !== false) g.arc(x, hy + headR * 0.25, headR * 0.35, 0.2, Math.PI - 0.2); else { g.moveTo(x - headR * 0.3, hy + headR * 0.5); g.lineTo(x + headR * 0.3, hy + headR * 0.5); }
  g.stroke();
}
function dog(g, x, y, s, o = {}) {
  g.fillStyle = o.col || '#c89040';
  g.beginPath(); g.ellipse(x, y - s * 0.45, s * 0.6, s * 0.3, 0, 0, 7); g.fill();
  g.fillRect(x - s * 0.45, y - s * 0.3, s * 0.12, s * 0.3); g.fillRect(x + s * 0.3, y - s * 0.3, s * 0.12, s * 0.3);
  g.beginPath(); g.ellipse(x + s * 0.55, y - s * 0.8, s * 0.26, s * 0.22, 0, 0, 7); g.fill();
  g.fillRect(x + s * 0.6, y - s * 0.75, s * 0.3, s * 0.14);
  g.fillStyle = '#7a4a1a'; g.beginPath(); g.ellipse(x + s * 0.42, y - s * 0.72, s * 0.08, s * 0.18, 0.4, 0, 7); g.fill(); // the floppy ear
  g.fillStyle = '#111'; g.fillRect(x + s * 0.86, y - s * 0.72, s * 0.06, s * 0.06); g.fillRect(x + s * 0.58, y - s * 0.86, s * 0.05, s * 0.05);
  g.strokeStyle = o.col || '#c89040'; g.lineWidth = s * 0.08; g.beginPath(); g.moveTo(x - s * 0.55, y - s * 0.5); g.lineTo(x - s * 0.85, y - s * 0.75); g.stroke();
}
function photo(draw, date, w = 160, h = 120) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#e8e2d0'; g.fillRect(0, 0, w, h);
  const ix = 5, iy = 5, iw = w - 10, ih = h - 16;
  g.save(); g.beginPath(); g.rect(ix, iy, iw, ih); g.clip(); g.translate(ix, iy);
  draw(g, iw, ih);
  g.restore();
  if (date) { g.fillStyle = '#ff9a30'; g.font = 'bold 8px monospace'; g.fillText(date, ix + iw - 52, iy + ih - 4); }
  // fade, warm cast, grain, a crease
  const d = g.getImageData(0, 0, w, h);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = (rnd() - 0.5) * 26;
    d.data[i] = d.data[i] * 0.86 + 30 + n; d.data[i + 1] = d.data[i + 1] * 0.84 + 22 + n; d.data[i + 2] = d.data[i + 2] * 0.74 + 12 + n;
  }
  g.putImageData(d, 0, 0);
  g.strokeStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.moveTo(w * 0.7, 0); g.lineTo(w * 0.6, h); g.stroke();
  return c;
}
function wrongPhoto(c) {
  const w = document.createElement('canvas'); w.width = c.width; w.height = c.height;
  const g = w.getContext('2d'); g.drawImage(c, 0, 0);
  g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 3;
  for (let i = 0; i < 14; i++) { const x = 20 + rnd() * (c.width - 40), y = 15 + rnd() * 40; g.beginPath(); g.moveTo(x - 4, y - 3); g.lineTo(x + 4, y + 3); g.moveTo(x + 4, y - 3); g.lineTo(x - 4, y + 3); g.stroke(); }
  return w;
}
const DANNY = { skin: '#d6a888', hair: '#5a3418', shirt: '#9a1c1c' };
const TOM = { skin: '#c49070', hair: '#3a2a1a', shirt: '#6a1414', pants: '#2c3e5e' };
const CLAIRE = { skin: '#dcb098', hair: '#6a3a1a', shirt: '#6a5068', long: true };
const LILY = { skin: '#e0b496', hair: '#8a5a2a', shirt: '#6a84ac', long: true };

export const PHOTOS = {
  lake: photo((g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h * 0.5); sky.addColorStop(0, '#6aa0d8'); sky.addColorStop(1, '#c8e0f0'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a5a2a'; for (let x = 0; x < w; x += 6) g.fillRect(x, h * 0.35 - rnd() * 10, 7, 20);
    g.fillStyle = '#3a6a8a'; g.fillRect(0, h * 0.5, w, h * 0.5);
    g.fillStyle = '#8a6a44'; g.fillRect(0, h * 0.78, w * 0.7, h * 0.22);
    person(g, w * 0.3, h * 0.95, h * 0.7, { ...TOM, cap: '#2a4a2a' });
    person(g, w * 0.55, h * 0.95, h * 0.55, { ...DANNY, shirt: '#e0e0d0' });
    g.fillStyle = '#9aa0a0'; g.fillRect(w * 0.6, h * 0.55, w * 0.16, h * 0.06); // the fish
    dog(g, w * 0.78, h * 0.97, h * 0.22, { col: '#a07030' });
  }, "'96 7 14"),
  school: photo((g, w, h) => {
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { g.fillStyle = `rgb(${70 + rnd() * 30},${90 + rnd() * 30},${140 + rnd() * 40})`; g.fillRect(x, y, 2, 2); }
    g.fillStyle = '#3a5a8a'; g.beginPath(); g.ellipse(w * 0.5, h * 1.05, w * 0.36, h * 0.38, 0, 0, 7); g.fill();
    g.fillStyle = '#e8e8e0'; g.beginPath(); g.moveTo(w * 0.42, h * 0.7); g.lineTo(w * 0.5, h * 0.82); g.lineTo(w * 0.58, h * 0.7); g.fill();
    g.fillStyle = DANNY.skin; g.fillRect(w * 0.45, h * 0.58, w * 0.1, h * 0.14);
    g.beginPath(); g.ellipse(w * 0.5, h * 0.42, w * 0.13, h * 0.22, 0, 0, 7); g.fill();
    g.fillStyle = DANNY.hair; g.beginPath(); g.ellipse(w * 0.5, h * 0.27, w * 0.14, h * 0.12, 0, Math.PI, 0); g.fill(); g.fillRect(w * 0.37, h * 0.26, w * 0.26, h * 0.06);
    g.fillStyle = '#2a1a10'; g.fillRect(w * 0.44, h * 0.4, 4, 3); g.fillRect(w * 0.54, h * 0.4, 4, 3);
    g.strokeStyle = '#8a4040'; g.lineWidth = 2; g.beginPath(); g.arc(w * 0.5, h * 0.5, w * 0.04, 0.3, Math.PI - 0.3); g.stroke();
    g.fillStyle = 'rgba(160,80,60,0.25)'; g.fillRect(w * 0.42, h * 0.46, 5, 3); g.fillRect(w * 0.55, h * 0.46, 5, 3);
    g.fillStyle = '#e8e2d0'; g.font = '7px monospace'; g.fillText('CUTTER HIGH  1997', 6, h - 5);
  }),
  puppy: photo((g, w, h) => {
    g.fillStyle = '#d8dee8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#5a6a5a'; for (let x = 0; x < w; x += 9) { g.beginPath(); g.moveTo(x, h * 0.5); g.lineTo(x + 5, h * 0.2); g.lineTo(x + 10, h * 0.5); g.fill(); }
    g.fillStyle = '#eef0f4'; g.fillRect(0, h * 0.62, w, h);
    person(g, w * 0.48, h * 1.02, h * 0.82, { ...DANNY, shirt: '#b02020' });
    dog(g, w * 0.4, h * 0.6, h * 0.16, { col: '#d8a050' }); // a very small Biscuit peeking out of the jacket
  }, "'92 12 24"),
  christmas: photo((g, w, h) => {
    g.fillStyle = '#5a3a30'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1a4a1a'; g.beginPath(); g.moveTo(w * 0.85, h * 0.05); g.lineTo(w * 1.02, h * 0.75); g.lineTo(w * 0.68, h * 0.75); g.fill();
    for (let i = 0; i < 18; i++) { g.fillStyle = ['#ff4040', '#ffd040', '#40a0ff'][i % 3]; g.fillRect(w * 0.72 + rnd() * w * 0.25, h * 0.15 + rnd() * h * 0.55, 2, 2); }
    g.fillStyle = '#6a4a2a'; g.fillRect(0, h * 0.62, w * 0.75, h * 0.25);
    person(g, w * 0.14, h * 0.86, h * 0.62, TOM); person(g, w * 0.3, h * 0.86, h * 0.56, CLAIRE);
    person(g, w * 0.48, h * 0.86, h * 0.52, { ...DANNY, shirt: '#2a6a2a' }); person(g, w * 0.62, h * 0.88, h * 0.34, LILY);
    dog(g, w * 0.45, h * 0.99, h * 0.2);
    g.fillStyle = '#c03030'; g.fillRect(w * 0.1, h * 0.9, 10, 7); g.fillStyle = '#3070c0'; g.fillRect(w * 0.6, h * 0.92, 12, 6);
  }, "'96 12 25"),
  furnace: photo((g, w, h) => {
    g.fillStyle = '#1a1612'; g.fillRect(0, 0, w, h);
    const glow = g.createRadialGradient(w * 0.3, h * 0.7, 2, w * 0.3, h * 0.7, w * 0.5); glow.addColorStop(0, 'rgba(255,140,40,0.9)'); glow.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = '#4a4440'; g.fillRect(w * 0.08, h * 0.15, w * 0.38, h * 0.8);
    g.fillStyle = glow; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff9a40'; g.fillRect(w * 0.14, h * 0.6, w * 0.26, h * 0.06);
    person(g, w * 0.62, h * 1.0, h * 0.78, TOM);
    person(g, w * 0.82, h * 1.0, h * 0.6, { ...DANNY, shirt: '#3a3c40', smile: true });
    g.fillStyle = '#fff6c0'; g.fillRect(w * 0.88, h * 0.55, 6, 3); // flashlight
    g.fillStyle = '#9a9a9a'; g.fillRect(w * 0.7, h * 0.58, 10, 2); // wrench
  }, "'97 10 05"),
};
const PHOTO_TEX = {};
const PHOTO_TEX_WRONG = {};
for (const k of Object.keys(PHOTOS)) { PHOTO_TEX[k] = canvasTex(PHOTOS[k]); PHOTO_TEX_WRONG[k] = canvasTex(wrongPhoto(PHOTOS[k])); }

// ---------------------------------------------------------------------------
// Documents. The dog cannot read them; you can.
export const DOCS = {
  notebook: {
    style: 'notebook', title: 'A spiral notebook on Danny\'s desk',
    body: `<p class="hand">FURNACE — Grandpa's list<br>do every October!! (Dad never remembers)</p>
<p class="hand">1. new filter (16x25)<br>2. check the flue pipe for rust + CRACKS<br>3. pilot flame should be BLUE. yellow = bad<br>4. test the CO alarm + put a NEW BATTERY in it</p>
<p class="hand">CO = carbon monoxide. no smell. makes you sleepy + headachy.<br>if the alarm chirps DON'T just take the battery out!!</p>
<p class="hand">if I'm not here somebody has to do this.<br>— D.H.</p>`,
    memory: 'He wrote this at the kitchen table with his tongue sticking out. Every October he went down to the hot box with the man and a flashlight, and came back up smelling of dust and smoke.',
  },
  essay: {
    style: 'lined', title: 'Pinned to the corkboard: an English essay',
    body: `<p class="hand"><b>My Dog Biscuit</b> — Danny Hale, Grade 9, Mrs. Pruitt</p>
<p class="hand">My dog Biscuit is a golden mutt with one ear that flops over. I picked him out of a box at the feed store when I was eight. He was the smallest one and he fit inside my jacket.</p>
<p class="hand">Biscuit knows about twenty words. His favorites are WALK, BALL and his name. He waits by the front door every day at 3:40 when my bus comes, even in the snow.</p>
<p class="hand">Mom says he isn't a guard dog. But he barks at everything that's wrong. Last winter the stove got left on and he barked until all of us woke up.</p>
<p class="hand">Biscuit runs away sometimes when he smells deer. He always comes back. He's the bravest dog I know, because even when he is scared he comes back.</p>
<p class="grade">A — What a lovely tribute. He sounds like a very good boy!</p>`,
    memory: 'He read this out loud to you on the bed, twice. You did not understand it. You understood his hand on your ear.',
  },
  letter: {
    style: 'lined', title: 'A letter on the kitchen table, in the woman\'s handwriting',
    body: `<p class="hand">Danny,</p>
<p class="hand">It's a year tomorrow. I still set your place at the table. Your father says I have to stop. He won't say your name. He won't go down to the basement where your things are.</p>
<p class="hand">I can't go in your room either. I keep the door locked and the key in my pocket, like you might come home and need it.</p>
<p class="hand">Lily says she hears you at night, talking in the heater. I don't know how to tell her it's just the furnace.</p>
<p class="hand">The alarm in the kitchen kept chirping all day and I couldn't stand it, so I took the battery out. I can't think about anything. My head hurts all the time. I'm so tired, baby.</p>
<p class="hand">We never blamed Biscuit. I need you to know that. He still waits by the door for you every night.</p>
<p class="hand">— Mom</p>`,
    memory: 'Salt. Her tears are on the paper. The paper smells of her hands and of Danny\'s room.',
  },
  clipping: {
    style: 'news', title: 'A newspaper clipping, folded inside the box',
    body: `<p class="masthead">THE CUTTER COUNTY LEDGER — Tuesday, December 16, 1997</p>
<h3>Local Teen Dies Searching for Family Dog</h3>
<p>Daniel "Danny" Hale, 15, of Route 9 died Sunday after falling through the ice on Miller's Pond during Saturday night's storm.</p>
<p>According to family members, the Hales' dog broke loose while chasing deer near the property. Danny ran out after the dog without a coat. His father found him at the pond shortly before dawn.</p>
<p>The dog returned to the house the next morning, unharmed.</p>
<p>Danny was a freshman at Cutter High, where he played left wing for the Snowhawks. He is survived by his parents, Tom and Claire, and his sister, Lily, 7.</p>`,
    memory: 'You remember the deer. You remember the snow, and running, and running, and the cold. You remember coming home in the morning to the door. Everyone was crying. You have waited by that door every night since, for him to come back the way you did.',
  },
  tag: {
    style: 'tag', title: 'A red cardboard tag, from the workbench drawer',
    body: `<p class="tagHead">DANGER — DO NOT OPERATE</p>
<p>CUTTER GAS &amp; ELECTRIC — APPLIANCE RED TAG</p>
<p>Appliance: forced-air gas furnace (basement)<br>Condition: <b>CRACKED HEAT EXCHANGER.</b> Flue pipe corroded.<br><b>CARBON MONOXIDE HAZARD.</b></p>
<p>Gas to appliance must remain OFF until repaired or replaced.<br>Customer advised: T. Hale &nbsp; Date: 11/30/98<br>Technician: R. Okafor</p>
<p class="hand small">"after Christmas" — T.</p>`,
    memory: 'It smells of the man\'s hands, and of the drawer he shut it in, and very faintly of being ashamed.',
  },
  drawing: {
    style: 'drawing', title: 'Lily\'s drawing', img: 'drawing',
    body: '<p class="hand">OUR FAMLY — by Lily</p>',
    memory: 'Crayons and milk and her fingers. She drew you with your floppy ear. She drew Danny under the ground, with yellow eyes, smiling.',
  },
};
for (const k of ['lake', 'school', 'puppy', 'christmas', 'furnace']) DOCS['photo_' + k] = { style: 'photo', photo: k };
DOCS.photo_lake.title = 'A photograph in the hall'; DOCS.photo_lake.memory = 'The lake. Danny threw sticks into the water all afternoon and you brought every one of them back. The man caught one fish and was so proud of it.';
DOCS.photo_school.title = 'A school portrait in the hall'; DOCS.photo_school.memory = 'His school picture. He hated that shirt. He smelled of pencils and the bus and cold air, and his bus came at 3:40 every day.';
DOCS.photo_puppy.title = 'A photograph in the hall'; DOCS.photo_puppy.memory = 'The day he picked you. You were the smallest one in the box. He carried you home inside his red jacket and you slept against his heart.';
DOCS.photo_christmas.title = 'A photograph in the hall'; DOCS.photo_christmas.memory = 'His last Christmas. He hid your ball inside a box inside a box inside a box, and laughed until he cried while you tore them open.';
DOCS.photo_furnace.title = 'A photograph above Danny\'s desk'; DOCS.photo_furnace.memory = 'Every October Danny and the man went down to the hot box together. Danny did the talking. The man always said, "You\'re the expert, kid." Nobody has gone down since.';
DOCS.collar = { style: 'memory', title: 'A tiny red collar on Danny\'s shelf', memory: 'Your first collar. It would not fit around your leg now. He kept it on his shelf next to his hockey trophies, like it was one of them.' };

// ---------------------------------------------------------------------------
function inspect(id, x, y, z, reach, o = {}) {
  const def = { id, pos: new THREE.Vector3(x, y, z), reach, read: false, ...o, doc: DOCS[id] };
  inspectables.push(def);
  return def;
}

export function buildLore(scene, M) {
  // ---- hall photographs: each frame gets its own picture ----------------------
  const hallKeys = ['lake', 'school', 'puppy', 'christmas'];
  refs.hallPhotos.forEach((m, i) => {
    m.material = ps1Mat({ map: PHOTO_TEX[hallKeys[i]], unique: true });
    m.userData.photo = hallKeys[i];
    inspect('photo_' + hallKeys[i], m.position.x, 1.55, 3.6, 1.1, { dogPos: new THREE.Vector3(m.position.x, 0, 4.1) });
  });
  refs.photoWrong = () => refs.hallPhotos.forEach((m) => { m.material.uniforms.map.value = PHOTO_TEX_WRONG[m.userData.photo]; });

  // ---- Danny's room ------------------------------------------------------------
  const plaid = ps1Mat({ map: T.flannel, color: 0x8090c0 });
  prop(8.55, 0.2, 1.08, 0.9, 0.4, 1.9, M.woodL, { solid: true });
  prop(8.55, 0.45, 1.12, 0.88, 0.1, 1.8, plaid, { planar: true, uvScale: 0.6 });
  prop(8.55, 0.53, 0.35, 0.55, 0.08, 0.28, ps1Mat({ color: 0xd8d4c4 }));
  prop(8.55, 0.7, 0.12, 0.92, 0.7, 0.06, M.woodL);
  prop(8.4, 0.08, 2.3, 0.14, 0.12, 0.26, ps1Mat({ color: 0xd8d8d8 })); prop(8.6, 0.08, 2.32, 0.14, 0.12, 0.26, ps1Mat({ color: 0xd8d8d8 })); // his sneakers
  // desk + chair + lamp
  prop(10.2, 0.74, 0.72, 0.5, 0.05, 1.1, M.wood);
  for (const [x, z] of [[10.0, 0.22], [10.0, 1.22], [10.42, 0.22], [10.42, 1.22]]) prop(x, 0.37, z, 0.05, 0.74, 0.05, M.wood, { solid: true });
  prop(9.72, 0.45, 0.75, 0.4, 0.05, 0.4, M.wood); prop(9.54, 0.75, 0.75, 0.04, 0.6, 0.4, M.wood);
  refs.dannyLampShade = prop(10.25, 0.95, 0.3, 0.16, 0.14, 0.16, ps1Mat({ color: 0x3a6a3a, emissive: 0x000000, unique: true }));
  prop(10.25, 0.82, 0.3, 0.03, 0.14, 0.03, M.metal);
  light(8, 'dannyLamp', [10.2, 1.0, 0.45], 0xffd9a0, 4.2, [8, -0.1, 0, 10.5, 3, 3.5]);
  lights[8].on = false;
  // notebook, pencils, cassette player
  prop(10.15, 0.775, 0.9, 0.22, 0.02, 0.3, ps1Mat({ color: 0xe0dcc8 }), { ry: 0.2 });
  prop(10.3, 0.79, 1.15, 0.2, 0.05, 0.12, ps1Mat({ color: 0x1a1a1a }));
  // corkboard: essay + furnace photo
  prop(10.44, 1.45, 0.75, 0.02, 0.6, 0.9, ps1Mat({ color: 0x9a7a4a }));
  prop(10.42, 1.38, 1.0, 0.01, 0.34, 0.24, ps1Mat({ color: 0xe8e4d4 }));
  prop(10.42, 1.5, 0.48, 0.01, 0.2, 0.26, ps1Mat({ map: PHOTO_TEX.furnace }), { ry: Math.PI / 2 });
  // shelf, trophies, the collar
  prop(9.7, 1.5, 0.15, 1.1, 0.04, 0.24, M.wood);
  for (let i = 0; i < 3; i++) { prop(9.95 + i * 0.2, 1.62, 0.15, 0.08, 0.2, 0.08, ps1Mat({ color: 0xc8a030, emissive: 0x201400 })); }
  prop(9.35, 1.54, 0.15, 0.12, 0.05, 0.08, ps1Mat({ color: 0xc02020 }));
  // hockey poster and a star map
  const poster = document.createElement('canvas'); poster.width = 48; poster.height = 64;
  { const g = poster.getContext('2d'); g.fillStyle = '#0a1a3a'; g.fillRect(0, 0, 48, 64); g.fillStyle = '#e8e8f0'; g.font = 'bold 9px monospace'; g.fillText('SNOW', 4, 14); g.fillText('HAWKS', 4, 25); g.fillStyle = '#c03030'; g.beginPath(); g.moveTo(24, 32); g.lineTo(40, 56); g.lineTo(8, 56); g.fill(); g.fillStyle = '#e8e8f0'; g.fillRect(20, 44, 8, 2); }
  prop(8.9, 1.6, 0.08, 0.5, 0.66, 0.01, ps1Mat({ map: canvasTex(poster) }));
  prop(10.35, 0.7, 3.2, 0.04, 1.4, 0.04, M.woodL, { rz: 0.08 }); // hockey stick
  prop(10.25, 0.9, 3.3, 0.02, 1.8, 0.02, M.metal, { rz: -0.1 }); // fishing rod
  prop(9.25, 0.006, 1.6, 1.2, 0.01, 1.6, ps1Mat({ color: 0x3a4a6a }));
  inspect('notebook', 10.15, 0.8, 0.9, 1.0, { dogPos: new THREE.Vector3(9.55, 0, 1.1), needs: () => puzzle.dannyOpen });
  inspect('essay', 10.42, 1.38, 1.0, 1.0, { dogPos: new THREE.Vector3(9.8, 0, 1.6), needs: () => puzzle.dannyOpen });
  inspect('photo_furnace', 10.42, 1.5, 0.48, 1.0, { dogPos: new THREE.Vector3(9.8, 0, 0.55), needs: () => puzzle.dannyOpen });
  inspect('collar', 9.35, 1.54, 0.15, 1.0, { dogPos: new THREE.Vector3(9.35, 0, 0.6), needs: () => puzzle.dannyOpen });

  // ---- the basement door's hook latch -------------------------------------------
  refs.hook = prop(13.72, 1.95, 3.58, 0.02, 0.1, 0.02, M.metal);
  prop(13.82, 1.92, 3.58, 0.03, 0.03, 0.03, M.metal);
  puzzle.latched = true;

  // ---- Lily's heating vent --------------------------------------------------------
  const vent = document.createElement('canvas'); vent.width = 16; vent.height = 16;
  { const g = vent.getContext('2d'); g.fillStyle = '#2a2a2a'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#000'; for (let y = 2; y < 16; y += 3) g.fillRect(1, y, 14, 1); }
  prop(7.5, 0.006, 2.75, 0.36, 0.01, 0.24, ps1Mat({ map: canvasTex(vent) }));
  prop(12.1, 0.006, 4.65, 0.36, 0.01, 0.24, ps1Mat({ map: canvasTex(vent) }));
  spots.lilyVent = new THREE.Vector3(7.5, 0, 2.75);
  spots.lilySit = new THREE.Vector3(7.25, 0, 1.95);

  // ---- the kitchen step stool (Biscuit can push it) ----------------------------------
  const stool = new THREE.Group();
  prop(0, 0.34, 0, 0.36, 0.04, 0.3, M.woodL, { parent: stool });
  prop(0, 0.18, 0, 0.3, 0.03, 0.24, M.woodL, { parent: stool });
  for (const [x, z] of [[-0.15, -0.12], [0.15, -0.12], [-0.15, 0.12], [0.15, 0.12]]) prop(x, 0.17, z, 0.03, 0.34, 0.03, M.woodL, { parent: stool });
  stool.position.set(12.55, 0, 8.75);
  scene.add(stool);
  const stoolCol = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, minY: 0, maxY: 0.36, tag: 'stool' };
  colliders.push(stoolCol);
  puzzle.stool = { mesh: stool, col: stoolCol, dragging: false };
  puzzle.setStoolCol = () => { const p = stool.position; Object.assign(stoolCol, { minX: p.x - 0.18, maxX: p.x + 0.18, minZ: p.z - 0.16, maxZ: p.z + 0.16, disabled: puzzle.stool.dragging }); };
  puzzle.setStoolCol();

  // ---- the workbench drawer, with a rope pull hanging down ------------------------------
  refs.drawer = prop(10.5, BASE_Y + 0.72, -3.55, 0.6, 0.14, 0.4, M.wood);
  refs.drawerRope = prop(10.5, BASE_Y + 0.48, -3.34, 0.015, 0.36, 0.015, ps1Mat({ color: 0xb09060 }));
  prop(10.5, BASE_Y + 0.29, -3.34, 0.05, 0.05, 0.05, ps1Mat({ color: 0xb09060 }));
  spots.drawerPull = new THREE.Vector3(10.5, BASE_Y, -2.95);
  puzzle.drawerOpen = false;

  // ---- newspaper in Danny's box ------------------------------------------------------
  prop(12.62, BASE_Y + 0.53, -3.15, 0.2, 0.01, 0.26, ps1Mat({ color: 0xd8d4c0 }), { ry: 0.5, rx: -0.9 });
  inspect('clipping', 12.6, BASE_Y + 0.5, -3.2, 1.0, { dogPos: new THREE.Vector3(12.5, BASE_Y, -2.6) });

  // ---- Claire's letter on the kitchen table (once she has gone to bed) ---------------------
  refs.letter = prop(11.25, 0.795, 7.4, 0.2, 0.01, 0.26, ps1Mat({ color: 0xe8e4d4 }), { ry: 0.3 });
  refs.letter.visible = false;
  inspect('letter', 11.25, 0.8, 7.4, 1.1, { dogPos: new THREE.Vector3(11.25, 0, 8.4), needs: () => puzzle.letterOut });

  // ---- carry-able puzzle items ----------------------------------------------------------
  const bowl = new THREE.Group();
  prop(0, 0, 0, 0.24, 0.07, 0.24, M.metal, { parent: bowl });
  const kibble = prop(0, 0.04, 0, 0.18, 0.02, 0.18, ps1Mat({ color: 0x7a4a20 }), { parent: bowl });
  kibble.visible = false;
  bowl.position.set(10.3, 0.04, 9.6); scene.add(bowl);
  puzzle.bowl = addItem('bowl', 'your empty bowl', bowl);
  puzzle.bowl.kibble = kibble;

  const crayon = (col, x, z, label) => {
    const m = prop(x, 0.02, z, 0.09, 0.02, 0.022, ps1Mat({ color: col }), { ry: rnd() * 3 });
    const it = addItem('crayon', label, m, { scent: 'lily' });
    it.crayon = true; it.gone = true; m.visible = false;
    return it;
  };
  puzzle.crayons = [
    crayon(0xc02828, 6.4, 7.92, 'a red crayon'),
    crayon(0x2850c0, 9.7, 3.85, 'a blue crayon'),
    crayon(0xe0c020, 11.0, 7.25, 'a yellow crayon'),
    crayon(0x111111, 2.2, 9.3, 'a black crayon'),
  ];

  const key = new THREE.Group();
  prop(0, 0, 0, 0.09, 0.012, 0.03, ps1Mat({ color: 0xc8a840 }), { parent: key });
  prop(0.06, 0, 0, 0.03, 0.014, 0.04, ps1Mat({ color: 0xc8a840 }), { parent: key });
  prop(-0.02, 0, -0.03, 0.06, 0.006, 0.04, ps1Mat({ color: 0xc02020 }), { parent: key }); // a red ribbon
  key.position.set(0.3, 0.02, 1.35); scene.add(key);
  puzzle.key = addItem('key', "the key to Danny's room", key);
  puzzle.key.gone = true; key.visible = false;

  const tag = new THREE.Group();
  prop(0, 0, 0, 0.1, 0.01, 0.17, ps1Mat({ color: 0xc01818 }), { parent: tag });
  prop(0, 0.006, 0.06, 0.02, 0.004, 0.02, ps1Mat({ color: 0xe0e0e0 }), { parent: tag });
  tag.position.set(10.5, BASE_Y + 0.02, -3.05); scene.add(tag);
  puzzle.tag = addItem('tag', 'the red tag', tag);
  puzzle.tag.gone = true; tag.visible = false;
  puzzle.tagDoc = inspect('tag', 0, 0, 0, 0.8, { item: puzzle.tag });

  // the jacket and the drawing already exist; the drawing waits for Lily to finish it
  puzzle.jacket = items.find((i) => i.name === 'jacket');
  puzzle.battery = items.find((i) => i.name === 'battery');
  puzzle.drawing = items.find((i) => i.name === 'drawing');
  puzzle.drawing.gone = true; puzzle.drawing.mesh.visible = false;
  puzzle.drawingDoc = inspect('drawing', 0, 0, 0, 0.8, { item: puzzle.drawing });

  // ---- the CO detector's warning light ---------------------------------------------------
  light(9, 'alarm', [10.6, 1.4, 5.25], 0xff2010, 3.0, [9, -0.1, 4.6, 14, 3, 10]);
  lights[9].on = false;
  refs.detectorLed = prop(10.6, 1.35, 5.1, 0.025, 0.025, 0.01, ps1Mat({ color: 0x300000, unlit: true, unique: true }));
}

export { PHOTO_TEX };
