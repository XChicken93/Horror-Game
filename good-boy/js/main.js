import * as THREE from '../vendor/three.module.js';
import { G, P, makePost } from './ps1.js';
import { buildTextures, updateWindow } from './textures.js';
import { buildHouse, updateDoors, updateLights, spots, isOutside, items, roomAt, SURFACES, colliders } from './house.js';
import { buildYard, yard } from './yard.js';
import { initFx, updateFx } from './fx.js';
import { makeFamily, setSubtitleEl } from './humans.js';
import { initScent, updateScent } from './scent.js';
import { dog, input, initInput, makeSnout, makeBody, updateDog } from './player.js';
import * as AU from './audio.js';
import { S, initStory, updateStory, onBark, onWhine, onInteract, onTrack, onSit, onWag, closeInspect, skipMontage, DBG } from './story.js';
import { buildLore, PHOTOS, puzzle, inspect } from './lore.js';
import { TRACK } from './scent.js';
import { isTouch, initTouch, goFullscreen } from './touch.js';
import { T } from './textures.js';
import { refs } from './house.js';
import { MONSTERS, monsterChoice, setMonsterChoice, swapMonster } from './monster.js';
import { ACH, achCount, achListHTML, achSet, unlock, resetAch } from './achievements.js';

const $ = (id) => document.getElementById(id);
// on a phone, name the on-screen buttons instead of keyboard keys
function touchWords(t) {
  return t.replace(/\(Space\)/g, '(⤒ jump)').replace(/\(Shift\)/g, '(» run)').replace(/Press X/g, 'Tap X').replace(/press E/g, 'tap E').replace(/Press B/g, 'Tap B')
    .replace(/hold F/gi, 'hold F (sniff)').replace(/<b>SPACE<\/b>/g, '<b>⤒</b>');
}
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
// render resolution: higher than a real PS1, so things stay readable at a distance
const LOW_H = matchMedia('(pointer: coarse)').matches ? 300 : 360;
const rt = new THREE.WebGLRenderTarget(320, LOW_H, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
const post = makePost();
P.tDiffuse.value = rt.texture;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020204);
const camera = new THREE.PerspectiveCamera(72, 4 / 3, 0.03, 40);
scene.add(camera);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  const aspect = w / h;
  const lw = Math.round(LOW_H * aspect);
  rt.setSize(lw, LOW_H);
  P.uRes.value.set(lw, LOW_H);
  G.uSnap.value.set(lw / 2, LOW_H / 2);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

buildTextures();
updateWindow(0, false);
buildHouse(scene);
buildLore(scene, refs.M);
buildYard(scene, refs.M);
inspect('tin', 0, 0, 0, 0.8, { item: yard.tinItem });
inspect('doghouse', 17.75, 0.7, -2.0, 1.2, { dogPos: spots.doghouse });
inspect('snowman', 16.4, 0.8, 7.2, 1.1, { dogPos: spots.snowman });
initScent(scene);
// snow falls everywhere except under the roof and in the basement
initFx(scene, (x, y, z) => (x > -0.1 && x < 14.1 && z > -0.1 && z < 10.1 && y < 4.9) || y < 0);
const family = makeFamily(scene);
makeSnout(camera);
makeBody(scene);
setSubtitleEl($('subs'));
initTouch();
if (isTouch) {
  $('title').querySelector('.ctl').innerHTML = 'left thumb: <b>walk</b> (push all the way to run) &nbsp; right thumb: <b>look</b><br><b>E</b> use / take / drop (hold to bite) &nbsp; <b>⤒</b> jump &nbsp; <b>B</b> bark &nbsp; hold <b>F</b> sniff<br><b>R</b> dig &nbsp; <b>C</b> lie down &nbsp; <b>T</b> follow a smell &nbsp; <b>X</b> sit &nbsp; <b>G</b> wag &nbsp; <b>Q</b> whine &nbsp; <b>»</b> run';
  $('title').querySelector('.start').textContent = 'TAP TO BEGIN';
}

let cardTimer = null;
const ui = {
  camera,
  objective(text) {
    const el = $('objective');
    el.classList.remove('show'); void el.offsetWidth;
    el.innerHTML = text.replace(/\s{2}(\[[x ]\])/g, '<br>$1').replace(/\[x\]/g, '<span class="chk done">&#10003;</span>').replace(/\[ \]/g, '<span class="chk"></span>');
    el.classList.add('show');
  },
  vocab(why, words, small) {
    const el = $('card');
    el.innerHTML = `<div class="ct">${small ? 'A FEW NEW WORDS' : 'BISCUIT UNDERSTANDS MORE'}</div><div class="cw">${why}</div><div class="cl">${words.slice(0, 40).map((w) => `<span>${w}</span>`).join('')}${words.length > 40 ? `<span>+${words.length - 40} more</span>` : ''}</div>`;
    el.classList.add('show');
    clearTimeout(cardTimer); cardTimer = setTimeout(() => el.classList.remove('show'), 7000);
  },
  card(title, text) {
    const el = $('card');
    el.innerHTML = `<div class="ct">${title}</div><div class="cw">${text}</div>`;
    el.classList.add('show');
    clearTimeout(cardTimer); cardTimer = setTimeout(() => el.classList.remove('show'), 9000);
  },
  inspect(def) {
    const d = def.doc || {};
    const el = $('inspect');
    const pic = $('inspPic'), doc = $('inspDoc');
    pic.innerHTML = ''; doc.innerHTML = ''; doc.className = 'doc ' + (d.style || '');
    $('inspTitle').textContent = d.title || '';
    if (d.style === 'photo') {
      const img = new Image(); img.src = PHOTOS[d.photo].toDataURL(); pic.appendChild(img);
    } else if (d.style === 'drawing') {
      const img = new Image(); img.src = T.drawing.userData.canvas.toDataURL(); pic.appendChild(img);
      doc.innerHTML = d.body || '';
    } else if (d.body) doc.innerHTML = d.body;
    pic.style.display = pic.childNodes.length ? 'block' : 'none';
    doc.style.display = d.body ? 'block' : 'none';
    $('inspMem').innerHTML = d.memory ? `<span>Biscuit remembers</span> ${d.memory}` : '';
    el.style.display = 'flex';
    $('subs').style.opacity = 0;
  },
  closeInspect() { $('inspect').style.display = 'none'; },
  timer(secs) {
    const el = $('timer');
    if (secs === null) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    const m = Math.floor(secs / 60), sec = Math.floor(secs % 60);
    const txt = `${m}:${String(sec).padStart(2, '0')}`;
    if (txt !== this._tTxt) { this._tTxt = txt; $('tVal').textContent = txt; el.classList.toggle('low', secs < 300); }
  },
  guide(text, at, where, d) {
    if (isTouch) text = touchWords(text);
    if (text !== this._gText) { this._gText = text; $('next').innerHTML = text ? `<span>NEXT</span> ${text}` : ''; $('next').style.opacity = text ? 1 : 0; }
    this._gAt = at; this._gWhere = where; this._gD = d;
  },
  track(name, col) {
    const el = $('track');
    if (!name) { el.style.opacity = 0; return; }
    el.innerHTML = `FOLLOWING <span style="color:rgb(${col})">● ${name}</span><small>T to let go</small>`;
    el.style.opacity = 1;
  },
  montageShow(on) { $('montage').style.display = on ? 'block' : 'none'; $('hud').style.display = on ? 'none' : 'block'; if (on) $('ending').style.display = 'none'; },
  montageLine(l) {
    $('mTime').textContent = `◀◀ ${l.time}`;
    $('mWho').textContent = l.who;
    $('mText').innerHTML = l.text;
    $('mNote').innerHTML = l.note ? l.note : '';
    $('montage').classList.toggle('clue', l.clue);
  },
  showEnding(meta, paras, id) {
    $('hud').style.display = 'none';
    const el = $('ending');
    el.style.display = 'flex';
    $('endNum').textContent = `ENDING ${meta.n} OF 6`;
    $('endTitle').textContent = meta.title;
    const body = $('endText'); body.innerHTML = '';
    paras.forEach((p, i) => {
      const d = document.createElement('p'); d.textContent = p; d.style.animationDelay = `${1.2 + i * 3.2}s`; body.appendChild(d);
    });
    let found = [];
    try { found = JSON.parse(localStorage.getItem('goodboy_endings') || '[]'); } catch (e) { /* none */ }
    $('endFound').textContent = `endings found: ${found.length} / 6`;
    $('endFound').style.animationDelay = `${2 + paras.length * 3.2}s`;
    setTimeout(() => { ui.canRestart = true; }, 2500 + paras.length * 3200);
  },
};
initStory(family, scene, ui);

// ---------------------------------------------------------------------------
let started = false, introDone = false;
initInput(canvas, {
  bark: onBark, whine: onWhine, interact: onInteract, track: onTrack, sit: onSit, wag: onWag,
  anyKey: (e) => {
    if (S.montage) { if (e.key === 'Enter' || e.key === 'Escape') skipMontage(true); else if (e.key === ' ') skipMontage(false); return; }
    if (ui.canRestart && (e.key === 'r' || e.key === 'R')) location.reload();
  },
});
$('ending').addEventListener('click', () => { if (ui.canRestart) location.reload(); });
$('montage').addEventListener('click', () => skipMontage(false));
$('inspect').addEventListener('click', () => closeInspect());
addEventListener('keydown', (e) => { if (S.inspectOpen && (e.key === 'Escape' || e.key === ' ')) { e.preventDefault(); closeInspect(); } });

try {
  const found = JSON.parse(localStorage.getItem('goodboy_endings') || '[]');
  if (found.length) $('titleFound').textContent = `endings found: ${found.length} / 6`;
  if (found.length || achCount()) $('resetSaves').style.display = 'block';
} catch (e) { /* storage unavailable */ }
// pick the shape of the thing; it walks toward you behind the title
const showMon = (n) => {
  for (const b of document.querySelectorAll('#monPick .mb')) b.classList.toggle('on', +b.dataset.n === n);
  const m = MONSTERS[n - 1]; $('monName').textContent = `${m.name}: ${m.blurb}`;
};
showMon(monsterChoice());
for (const b of document.querySelectorAll('#monPick .mb')) b.addEventListener('click', (e) => {
  e.stopPropagation();
  const n = +b.dataset.n; setMonsterChoice(n); swapMonster(S.presence, n); showMon(n);
  if (achSet('monsters', n) >= 5) unlock('monsters');
  achLabel();
});
$('monPick').addEventListener('click', (e) => e.stopPropagation());
const achLabel = () => { $('achBtn').textContent = `achievements: ${achCount()} / ${ACH.length}`; };
achLabel();
$('basementBtn').addEventListener('click', (e) => { e.stopPropagation(); startGame(); endIntro(); DBG.monsterRoom(); });
$('otherBtn').addEventListener('click', (e) => { e.stopPropagation(); startGame(); endIntro(); DBG.startOther(); });
$('achBtn').addEventListener('click', (e) => { e.stopPropagation(); $('achGrid').innerHTML = achListHTML(); $('achPanel').classList.add('on'); });
$('achPanel').addEventListener('click', (e) => { e.stopPropagation(); $('achPanel').classList.remove('on'); });
// wipe the endings you have found, so the game is new again
$('resetSaves').addEventListener('click', (e) => {
  e.stopPropagation(); // don't start the game
  const el = $('resetSaves');
  // click once to arm, again to confirm (pop-up dialogs can be blocked here)
  if (!el.dataset.armed) { el.dataset.armed = '1'; el.textContent = 'click again to forget every ending and achievement'; setTimeout(() => { delete el.dataset.armed; el.textContent = 'forget everything and start over'; }, 4000); return; }
  try { localStorage.removeItem('goodboy_endings'); } catch (err) { /* storage unavailable */ }
  resetAch(); achLabel();
  $('titleFound').textContent = '';
  $('resetSaves').style.display = 'none';
});

const INTRO = [
  'December 13th, 1998.',
  'The Hale farm, Cutter County.',
  'A storm is coming in off the hills.',
  'It has been one year since Danny went away.',
  'Biscuit still waits by the door.',
  'You are Biscuit: a golden retriever mix, eight years old, with one ear that never stood up.',
  'Something is wrong with the air tonight.',
];
function startGame() {
  if (started) return;
  started = true;
  goFullscreen();
  AU.initAudio();
  AU.startAmbience({ furnace: spots.furnace });
  AU.startDrone();
  $('title').style.display = 'none';
  const intro = $('intro');
  intro.style.display = 'flex';
  let i = 0;
  const next = () => {
    if (introDone) return;
    if (i >= INTRO.length) { endIntro(); return; }
    const p = document.createElement('p'); p.textContent = INTRO[i++]; intro.appendChild(p);
    setTimeout(next, 2600);
  };
  next();
  intro.addEventListener('click', endIntro);
  addEventListener('keydown', (e) => { if (!introDone && (e.key === 'Enter' || e.key === ' ')) endIntro(); });
}
function endIntro() {
  if (introDone) return;
  introDone = true;
  S.presence.root.visible = false; S.presence.visible = false; P.uPulse.value = 0;
  $('intro').style.display = 'none';
  $('hud').style.display = 'block';
  input.enabled = true;
  document.body.classList.add('playing');
  S.fadeV = 1; S.fade = 0; S.fadeSpeed = 0.35;
  dog.pos.set(1.5, 0, 9.05); dog.yaw = 0.05; dog.pitch = 0.05; // waiting at the door
  if (canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (e) { /* not allowed here */ } }
  setTimeout(() => $('controls').classList.add('fade'), 30000);
}
$('title').addEventListener('click', startGame);

// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
const fwdV = new THREE.Vector3();
let lastPrompt = '', lastLabel = '', titleT = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  if (introDone) {
    updateDog(dt, camera, S.dogCO, S.t);
    updateStory(dt * (S.timeScale || 1));
  } else {
    // slow drift through the dark living room behind the title
    // behind the title: the dark hall from dog height, and at the far end, something
    // standing. Every time the screen flickers, it is a little closer.
    titleT += dt;
    camera.position.set(1.3, 0.4 + Math.sin(titleT * 1.6) * 0.004, 4.25);
    camera.rotation.set(0.04 + Math.sin(titleT * 0.11) * 0.02, -Math.PI / 2 + Math.sin(titleT * 0.07) * 0.06, 0, 'YXZ');
    for (const h of Object.values(family)) h.update(dt, titleT, 0, dog.pos);
    family.danny.root.visible = false;
    const pr = S.presence, step = Math.floor(titleT / 6.5);
    const flick = (titleT % 6.5) < 0.18;
    pr.setPos(8.6 - Math.min(4.6, step * 0.9), 4.25, 0); pr.yaw = -Math.PI / 2; pr.visible = true;
    pr.update(dt, titleT, 0, camera.position);
    if (pr.monster) pr.monster.update(titleT, dt, (titleT % 6.5) < 1.2 ? 'walk' : 'idle');
    pr.root.visible = !flick;
    $('title').classList.toggle('flick', flick);
    P.uFade.value = flick ? 0.75 : 0.3;
    P.uPulse.value = 0.5 + 0.5 * Math.sin(titleT * 5.2);
  }
  updateDoors(dt);
  updateLights(S.t || titleT);
  updateScent(dt, S.t);
  updateFx(dt, camera.position, S.outside ? 0.5 : 0.2, true);
  if (dog.body) dog.body.visible = introDone && !S.montage && !S.hideDog && !dog.human;
  if (dog.snout) dog.snout.visible = !S.hideDog && !S.montage && !dog.human;
  G.uTime.value += dt; P.uTime.value += dt;
  G.uCamPos.value.copy(camera.position);
  if (AU.A.ready) { camera.getWorldDirection(fwdV); AU.setListener(camera.position, fwdV); }
  if (S.prompt !== lastPrompt) { lastPrompt = S.prompt; $('prompt').innerHTML = isTouch ? touchWords(S.prompt) : S.prompt; }
  if (S.label !== lastLabel) { lastLabel = S.label; $('label').innerHTML = S.label; $('label').style.opacity = S.label ? 1 : 0; }
  // the marker: which way to go, how far, and which room
  if (introDone && ui._gAt && !S.ended && !S.inspectOpen) {
    const at = ui._gAt;
    const dx = at.x - dog.pos.x, dz = at.z - dog.pos.z;
    const ang = Math.atan2(-dx, -dz) - dog.yaw; // 0 = straight ahead
    const near = Math.hypot(dx, dz) < 1.1 && Math.abs(at.y - dog.y) < 1.2;
    $('compass').style.opacity = near ? 0 : 1;
    $('cArrow').style.transform = `rotate(${-ang}rad)`;
    $('cText').textContent = `${Math.max(1, Math.round(ui._gD))} m · ${ui._gWhere}`;
  } else $('compass').style.opacity = 0;
  $('lockHint').style.display = introDone && !input.locked && !S.ended ? 'block' : 'none';

  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(post.scene, post.cam);
}
frame();

// debug hooks for testing
window.__gb = { S, dog, family, input, startGame, endIntro, camera, puzzle, DBG, yard, TRACK, items, roomAt, SURF: SURFACES, colliders: () => colliders };
