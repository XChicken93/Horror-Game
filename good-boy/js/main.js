import * as THREE from '../vendor/three.module.js';
import { G, P, makePost } from './ps1.js';
import { buildTextures, updateWindow } from './textures.js';
import { buildHouse, updateDoors, updateLights, spots } from './house.js';
import { makeFamily, setSubtitleEl } from './humans.js';
import { initScent, updateScent } from './scent.js';
import { dog, input, initInput, makeSnout, updateDog } from './player.js';
import * as AU from './audio.js';
import { S, initStory, updateStory, onBark, onWhine, onInteract, closeInspect, skipMontage, DBG } from './story.js';
import { buildLore, PHOTOS, puzzle } from './lore.js';
import { T } from './textures.js';
import { refs } from './house.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
const LOW_H = 240;
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
initScent(scene);
const family = makeFamily(scene);
makeSnout(camera);
setSubtitleEl($('subs'));

let cardTimer = null;
const ui = {
  camera,
  objective(text) {
    const el = $('objective');
    el.classList.remove('show'); void el.offsetWidth;
    el.innerHTML = text.replace(/\[x\]/g, '<span class="chk done">&#10003;</span>').replace(/\[ \]/g, '<span class="chk"></span>');
    el.classList.add('show');
  },
  vocab(why, words) {
    const el = $('card');
    el.innerHTML = `<div class="ct">BISCUIT UNDERSTANDS MORE</div><div class="cw">${why}</div><div class="cl">${words.slice(0, 40).map((w) => `<span>${w}</span>`).join('')}${words.length > 40 ? `<span>+${words.length - 40} more</span>` : ''}</div>`;
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
    $('endNum').textContent = `ENDING ${meta.n} OF 5`;
    $('endTitle').textContent = meta.title;
    const body = $('endText'); body.innerHTML = '';
    paras.forEach((p, i) => {
      const d = document.createElement('p'); d.textContent = p; d.style.animationDelay = `${1.2 + i * 3.2}s`; body.appendChild(d);
    });
    let found = [];
    try { found = JSON.parse(localStorage.getItem('goodboy_endings') || '[]'); } catch (e) { /* none */ }
    $('endFound').textContent = `endings found: ${found.length} / 5`;
    $('endFound').style.animationDelay = `${2 + paras.length * 3.2}s`;
    setTimeout(() => { ui.canRestart = true; }, 2500 + paras.length * 3200);
  },
};
initStory(family, scene, ui);

// ---------------------------------------------------------------------------
let started = false, introDone = false;
initInput(canvas, {
  bark: onBark, whine: onWhine, interact: onInteract,
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
  if (found.length) $('titleFound').textContent = `endings found: ${found.length} / 5`;
} catch (e) { /* storage unavailable */ }

const INTRO = [
  'December 13th, 1998.',
  'The Hale farm, Cutter County.',
  'A storm is coming in off the hills.',
  'It has been one year since Danny went away.',
  'Biscuit still waits by the door.',
];
function startGame() {
  if (started) return;
  started = true;
  AU.initAudio();
  AU.startAmbience({ furnace: spots.furnace });
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
  $('intro').style.display = 'none';
  $('hud').style.display = 'block';
  input.enabled = true;
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
    titleT += dt;
    camera.position.set(4.5 + Math.sin(titleT * 0.05) * 0.6, 0.45, 8.2);
    camera.rotation.set(0.05, -0.9 + Math.sin(titleT * 0.07) * 0.25, 0, 'YXZ');
    for (const h of Object.values(family)) h.update(dt, titleT, 0, dog.pos);
    family.danny.root.visible = false;
    P.uFade.value = 0.35;
  }
  updateDoors(dt);
  updateLights(S.t || titleT);
  updateScent(dt, S.t);
  G.uTime.value += dt; P.uTime.value += dt;
  G.uCamPos.value.copy(camera.position);
  if (AU.A.ready) { camera.getWorldDirection(fwdV); AU.setListener(camera.position, fwdV); }
  if (S.prompt !== lastPrompt) { lastPrompt = S.prompt; $('prompt').innerHTML = S.prompt; }
  if (S.label !== lastLabel) { lastLabel = S.label; $('label').innerHTML = S.label; $('label').style.opacity = S.label ? 1 : 0; }
  $('lockHint').style.display = introDone && !input.locked && !S.ended ? 'block' : 'none';

  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(post.scene, post.cam);
}
frame();

// debug hooks for testing
window.__gb = { S, dog, family, input, startGame, endIntro, camera, puzzle, DBG };
