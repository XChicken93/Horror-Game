// The night of December 13th, 1998. Seven chapters, the family's schedule, the puzzles,
// the scares, the endings, and the rewind through everything they said.
import * as THREE from '../vendor/three.module.js';
import { G, P, ps1Mat } from './ps1.js';
import { T, updateTV, updateWindow } from './textures.js';
import * as AU from './audio.js';
import { doors, lights, items, spots, refs, windows, roomAt, floorAt, collide, isOutside, BASE_Y } from './house.js';
import { Human, speechLog, showSubtitle, learnWords, knows, VOCAB, VOCAB_STATE, speechHook, LABEL } from './humans.js';
import { emit, SCENT, DANNY_TRAIL, DANNY_TRAIL_DOWN, DANNY_TRAIL_YARD, DANNY_TRAIL_GATE, DEER_TRAIL, TRACK, TRACK_NAME, setTrack, groupOf } from './scent.js';
import { dog, input, inBasement, dogForward, act, lookAtPoint } from './player.js';
import { inspectables, puzzle, DOCS, PHOTOS } from './lore.js';
import { yard, digHole, updateFlap, pawPrint } from './yard.js';
import { puff, spray, breath } from './fx.js';
import { initDread, updateDread, dreadOnce } from './dread.js';
import { dressPresence, monsterChoice } from './monster.js';
import { unlock, achSet } from './achievements.js';
import { buildOther, enterOther, updateOther, otherInteract, otherPrompt, otherNext, jumpToStage } from './other.js';
import { keys } from './player.js';

export const S = {
  t: 0, co: 0, dogCO: 0, coOn: false, coT0: 0, strikes: 0, fired: new Set(), locked: false, ended: false, cut: null,
  scratches: 0, flash: 0, nextLightning: 22, figureFlash: false, ch: 1,
  tvOn: true, tvFace: 0, nextBeat: 0, blackout: 0, presence: null, presenceActive: false, presenceSleep: 0,
  jumpscare: 0, sniff: 0, label: '', prompt: '', follow: null, lastWindow: 0, deep: false,
  ghostState: null, clockAcc: 0, bedHold: 0, lullaby: null, crayons: 0, inspectOpen: null, timers: [],
  got: { jacketUp: false, tagUp: false }, father: { tag: false, jacket: false }, alarmOn: false, alarmDone: false,
  coAcc: 0, outside: false, yardDone: { vent: false, tin: false, gate: false }, cold: 0, digNothing: 0,
};

const CO_DUR = 3300; // from the moment the furnace lights, the house has about half an hour
const FATHER_YARD = [[14.3, 4.25], [16.5, 1.5], [19.0, -2.0], [20.6, -4.6]];
let F, scene, ui;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// What Biscuit learns. Each puzzle solved unlocks a group of words.
const WORDS = {
  dinner: ['i', 'me', 'my', 'your', 'the', 'a', 'is', 'it', 'its', 'im', 'to', 'and', 'again', 'dinner', 'forgot', 'sorry', 'eat', 'hungry', 'oh', 'yes', 'what', 'where', 'there', 'here', 'all', 'just', 'so', 'some'],
  crayons: ['lily', 'mommy', 'daddy', 'mom', 'dad', 'house', 'under', 'heaven', 'hear', 'he', 'him', 'his', 'she', 'her', 'that', 'thats', 'this', 'look', 'our', 'we', 'at', 'in', 'on', 'can', 'cant', 'find', 'red', 'blue', 'yellow', 'black', 'crayons', 'lost', 'please', 'says', 'but', 'now', 'are', 'was', 'be', 'made', 'did', 'go', 'family', 'night', 'lives', 'whos', 'who', 'one'],
  door: ['basement', 'door', 'hook', 'reach', 'dark', 'scared', 'voice', 'talking', 'heater', 'calling', 'open', 'latch', 'every', 'time', 'kicks', 'pulls', 'fix', 'going', 'get', 'up', 'too', 'dont', 'do', 'not', 'of', 'for', 'with', 'someone', 'downstairs', 'wants', 'first', 'bring', 'back', 'need', 'something', 'stand', 'are', 'hey', 'hear', 'holding', 'only', 'was', 'were'],
  room: ['furnace', 'smoke', 'alarm', 'thing', 'beeping', 'chirping', 'battery', 'took', 'out', 'new', 'check', 'broken', 'heat', 'turned', 'turning', 'seventy-eight', 'freezing', 'noise', 'making', 'weekend', 'tomorrow', 'year', 'room', 'key', 'never', 'nobody', 'tell', 'minute', 'lie', 'tonight', 'been', 'day', 'whole', 'will', 'ill', 'put', 'kitchen', 'said', 'always', 'smells', 'like', 'still', 'cold', 'its'],
  yard: ['outside', 'snow', 'dig', 'dug', 'digging', 'tree', 'treasure', 'buried', 'gate', 'came', 'come', 'always', 'mad', 'home', 'run', 'off', 'field', 'they', 'you', 'go', 'need', 'am', 'okay', 'good', 'boy', 'best', 'promise'],
  home: ['dark', 'scared', 'stay', 'here', 'right', 'let', 'go', 'take', 'down', 'boxes', 'things', 'warm', 'sleep', 'together', 'where', 'why', 'see', 'not', 'will', 'anywhere'],
  pond: ['pond', 'ice', 'coat', 'jacket', 'storm', 'looking', 'ran', 'went', 'without', 'deer', 'after', 'christmas', 'wait', 'could', 'thought', 'drawer', 'god', 'head', 'headache', 'tired', 'sleep', 'feel', 'think', 'air', 'wrong', 'everybody', 'worst', 'pressure', 'did', 'why', 'hard', 'killing', 'gone', 'found', 'never', 'blamed', 'sweetheart', 'warning', 'us'],
};
// You do not learn a whole language at once. Each puzzle teaches a handful of words and
// leaves the rest for later; every photograph, letter and drawing you look at teaches a few more.
const pending = [];
function learn(group, why) {
  const list = WORDS[group].filter((w) => !knows(w));
  const now = list.slice(0, 9), rest = list.slice(9);
  for (const w of rest) if (!pending.includes(w)) pending.push(w);
  const extra = pending.filter((w) => !now.includes(w) && !knows(w)).slice(0, 3);
  const fresh = learnWords([...now, ...extra]);
  for (const w of fresh) { const i = pending.indexOf(w); if (i >= 0) pending.splice(i, 1); }
  if (fresh.length) { ui.vocab(why, fresh); AU.chime(); }
}
const DOC_WORDS = {
  notebook: ['furnace', 'battery', 'alarm', 'check', 'new', 'broken', 'heat'], essay: ['dog', 'door', 'bus', 'wait', 'snow', 'back', 'always'],
  letter: ['sorry', 'never', 'blamed', 'sweetheart', 'gone', 'why'], clipping: ['pond', 'ice', 'storm', 'coat', 'jacket', 'looking', 'ran'],
  tag: ['furnace', 'drawer', 'after', 'christmas', 'warning'], drawing: ['family', 'house', 'under', 'heaven', 'lives'],
  photo_lake: ['dad', 'lake', 'fish', 'water'], photo_school: ['school', 'bus', 'danny'], photo_puppy: ['jacket', 'little', 'christmas', 'box'],
  photo_christmas: ['christmas', 'family', 'tree'], photo_furnace: ['furnace', 'flashlight', 'check', 'october'],
  photo_birthday: ['birthday', 'cake', 'thirteen', 'dark'], photo_porch: ['summer', 'house', 'paint', 'steps'],
  collar: ['little', 'first'], tin: ['treasure', 'buried', 'dig', 'promise'], doghouse: ['built', 'bed'], snowman: ['scarf', 'cold'], mitten: ['found', 'looked', 'days'],
};
function learnSight(id) {
  if (!once('sight_' + id)) return;
  const own = (DOC_WORDS[id] || []).filter((w) => !knows(w));
  const extra = pending.filter((w) => !own.includes(w) && !knows(w)).slice(0, own.length ? 2 : 4);
  const fresh = learnWords([...own, ...extra]);
  for (const w of fresh) { const i = pending.indexOf(w); if (i >= 0) pending.splice(i, 1); }
  if (fresh.length) { ui.vocab('You looked at it for a long time. A few of their words make sense now.', fresh, true); AU.chime(); }
}
function setObj(text) { S.obj = text; ui.objective(text); }

export function initStory(family, sc, uiRefs) {
  F = family; scene = sc; ui = uiRefs;
  const { father, mother, lily } = F;
  father.setPos(8.25, 7.55); father.yaw = Math.PI; father.activity = { spot: spots.armchair.clone(), face: Math.PI, pose: 'sit' }; father.settle();
  mother.setPos(11.75, 9.15); mother.yaw = 0; mother.activity = { spot: spots.sink.clone(), face: 0, pose: 'sink' }; mother.settle();
  lily.setPos(5.3, 6.55); lily.yaw = 2.6; lily.activity = { spot: spots.lilyDraw.clone(), face: 2.6, pose: 'floor' }; lily.settle();
  // the thing in the basement: the furnace, as a poisoned dog sees it
  S.presence = new Human('presence', { height: 2.35, build: 'man', presence: true, shirtCol: 0x040404, pantsCol: 0x040404, skinCol: 0x030303, face: T.headPresence, faceClosed: T.headPresence, faceWrong: T.headPresence, hairStyle: 'none', voice: 'father' }, scene);
  for (const m of S.presence.mats) { m.uniforms.uColor.value.set(0.02, 0.02, 0.02); m.uniforms.uEmissive.value.set(0.05, 0.012, 0.006); }
  S.presence.faceMat.uniforms.uUnlit.value = 1;
  S.presence.faceMat.uniforms.uColor.value.set(1, 1, 1);
  S.presence.visible = false; S.presence.root.visible = false;
  S.presence.setPos(spots.furnace.x, spots.furnace.z, BASE_Y);
  dressPresence(S.presence, monsterChoice());
  // Danny: warm, gold, gentle. He is not the thing that chases you.
  for (const m of F.danny.mats) m.uniforms.uEmissive.value.set(0.22, 0.17, 0.06);
  dog.onStep = (x, z, yaw, side) => pawPrint(x, z, yaw, side);
  initDread({ S, F, scene, later, scared: (k) => scared(k), say, ball: items.find((i) => i.name === 'ball') });
  speechHook.fn = (rec) => { rec.snap = S.other ? null : snapshot(); rec.clock = clockStr(S.t); };
  makeHandProps();
  buildOther({ S, F, scene, camera: ui.camera, ui, later, say, setObj, once, dogHead: () => dogHead(), ach: (id) => ach(id), home: () => comeHomeReal() });
  setObj('Your bowl is empty. The woman forgot to feed you again.');
}

const awake = (h) => !h.asleep || S.t < h.awakeUntil;
const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const sameFloor = (h) => (h.pos.y < -1) === inBasement();
function once(id) { if (S.fired.has(id)) return false; S.fired.add(id); return true; }
function later(secs, fn) { S.timers.push({ at: S.t + secs, fn }); }
function dogHead() { return v3(dog.pos.x, dog.y + 0.35, dog.pos.z); }
function say(h, text, tone, o = {}) { return h.say(text, tone, S.t, S.co, { force: true, ...o }); }
function clockStr(t) {
  const mins = 21 * 60 + 40 + Math.floor(t * 20 / 60);
  const h = Math.floor(mins / 60) % 24, m = mins % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 && h < 24 ? 'PM' : 'AM'}`;
}
function snapshot() {
  const s = { dog: { x: dog.pos.x, y: dog.y, z: dog.pos.z, yaw: dog.yaw } };
  for (const k of ['father', 'mother', 'lily', 'danny']) {
    const h = F[k];
    s[k] = { x: h.pos.x, y: h.pos.y, z: h.pos.z, yaw: h.yaw, pose: h.pose, vis: h.visible };
  }
  return s;
}

// ---------------------------------------------------------------------------
// Lightning
const ray = new THREE.Raycaster();
/** is there a clear line from your eyes to this point? */
function canSee(pt, ignore) {
  const eye = v3(dog.pos.x, dog.y + dog.eye, dog.pos.z);
  const dir = pt.clone().sub(eye); const d = dir.length(); dir.normalize();
  ray.set(eye, dir); ray.far = d - 0.05;
  const hits = ray.intersectObjects(scene.children, true);
  for (const h of hits) {
    const o = h.object;
    if (o === ignore || !o.isMesh || o.isSkinnedMesh) continue;
    let vis = true; for (let q = o; q; q = q.parent) if (!q.visible) { vis = false; break; }
    if (vis) return false;
  }
  return true;
}
function lightning() {
  let best = windows[0], bd = 1e9;
  for (const w of windows) { const d = w.pos.distanceTo(dog.pos); if (d < bd) { bd = d; best = w; } }
  lights[7].pos.copy(best.pos).addScaledVector(best.out, 2.5);
  lights[7].pos.y = 2.2;
  if (isOutside(dog.pos.x, dog.pos.z, dog.y)) lights[7].pos.set(dog.pos.x + 6, 9, dog.pos.z - 4);
  S.flashSeq = [[0, 1], [0.07, 0.1], [0.14, 0.85], [0.3, 0]];
  S.flashT = 0;
  AU.thunder(1 + Math.random() * 0.6);
}
// your heart jumps; you flinch and whimper
function scared(k = 1) {
  S.pulse = 1; S.fearT = Math.max(S.fearT || 0, 4 * k);
  dog.shiverFear = 1;
  if (Math.random() < 0.7) later(0.9, () => { AU.whine(); act('whine'); });
  AU.heartbeat(0.8 * k); later(0.35, () => AU.heartbeat(0.8 * k)); later(0.65, () => AU.heartbeat(0.7 * k));
}
function updateLightning(dt) {
  if (S.flashSeq) {
    S.flashT += dt;
    let v = 0;
    for (const [tt, val] of S.flashSeq) if (S.flashT >= tt) v = val;
    if (S.flashT > 0.5) { S.flashSeq = null; v = 0; S.figureFlash = false; }
    S.flash = v;
  } else S.flash = Math.max(0, S.flash - dt * 4);
  const cam = ui.camera;
  if (Math.abs(cam.fov - 72) > 0.1) { cam.fov += (72 - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); }
  S.lastWindow -= dt;
  if (S.flash > 0.01 || S.lastWindow <= 0) { updateWindow(S.flash, S.figureFlash); S.lastWindow = 0.12; }
  if (S.t > S.nextLightning) { lightning(); S.nextLightning = S.t + (S.outside ? 12 + Math.random() * 14 : 25 + Math.random() * 30); }
}

// ===========================================================================
// CHAPTERS
// props the family hands things around with
let kibbleBag = null, newspaper = null, crayonHand = null;
function makeHandProps() {
  // the dog food: a paper sack, folded over at the top, a dog on the label
  kibbleBag = new THREE.Group();
  const paperM = ps1Mat({ color: 0x9a6a3a }), labelM = ps1Mat({ color: 0xc83a2a }), whiteM = ps1Mat({ color: 0xe8e0d0 });
  const sack = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.1), paperM); sack.position.y = -0.15; kibbleBag.add(sack);
  const fold = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.06), paperM); fold.position.set(0, 0.015, 0); fold.rotation.x = 0.4; kibbleBag.add(fold);
  const lab = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.004), labelM); lab.position.set(0, -0.16, 0.052); kibbleBag.add(lab);
  const dogPic = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.004), whiteM); dogPic.position.set(0, -0.15, 0.055); kibbleBag.add(dogPic);
  kibbleBag.visible = false; scene.add(kibbleBag);
  // his newspaper, and her red crayon
  newspaper = new THREE.Group();
  const np = ps1Mat({ color: 0xd8d2c0 }), ink = ps1Mat({ color: 0x3a3a3a });
  for (const s of [-1, 1]) { const pg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.38, 0.004), np); pg.position.set(s * 0.14, 0, 0); pg.rotation.y = -s * 0.25; newspaper.add(pg);
    for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.012, 0.002), ink); l.position.set(s * 0.14, 0.13 - i * 0.05, 0.004 * -s * 0); pg.add(l); l.position.set(0, 0.13 - i * 0.05, 0.004); } }
  F.father.hold(newspaper, 1, { x: -0.16, y: 0.02, z: 0.08, rx: -0.3 }); newspaper.visible = false;
  crayonHand = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 6), ps1Mat({ color: 0xc02020 }));
  F.lily.hold(crayonHand, 1, { z: 0.02, rx: 1.2 }); crayonHand.visible = false;
}
function petDog(h) {
  // a hand on your head. Standing grown-ups crouch down for it.
  if (h.path.length || (h.override && !['read', 'scribble', 'rubeyes', 'stretch', 'shiver'].includes(h.override.type)) || S.feeding) return;
  const was = h.pose;
  if (was === 'stand' || was === 'sink') h.pose = 'kneel';
  h.override = { type: 'pat', until: S.t + 2.6 };
  later(2.7, () => { if (h.pose === 'kneel' && !h.path.length) h.pose = was; });
}
function ach(id, arg) {
  if (id === 'pets') { if (achSet('pets', arg) >= 3) unlock('pets'); return; }
  unlock(id);
}
// the ones you earn by just doing things, checked every frame
function updateAch(dt) {
  if (S.ended || S.cut) return;
  const run = (keys.has('shift') || input.stickRun) && dog.moving;
  S.runT = run ? (S.runT || 0) + dt : 0;
  if (S.runT > 20) ach('zoomies');
  S.lieT = dog.lying > 0.5 && !S.outside ? (S.lieT || 0) + dt : 0;
  if (S.lieT > 30) ach('playdead');
  if (S.outside) ach('snow');
  if (dog.y > 0.7 && dog.pos.x > 10.55 && dog.pos.x < 11.95 && dog.pos.z > 6.6 && dog.pos.z < 7.6 && dog.y < 1) ach('table');
  if (VOCAB.size >= 200) ach('words');
}
function familyGestures(dt) {
  const { father, mother, lily } = F;
  // he reads the paper in his chair, and turns the pages
  const reading = father.pose === 'sit' && !father.path.length && awake(father) && !father.asleep && S.ch < 3 && (!father.override || father.override.type === 'read');
  if (reading && !father.override) father.override = { type: 'read' };
  if (!reading && father.override?.type === 'read') father.override = null;
  newspaper.visible = father.override?.type === 'read';
  if (newspaper.visible && Math.random() < dt / 14) AU.paper(father.pos.x, 1, father.pos.z);
  // she draws on the floor, when she has her crayons
  const drawing = lily.pose === 'floor' && !lily.path.length && S.ch < 3 && (S.ch < 2 || S.crayons >= 6) && (!lily.override || lily.override.type === 'scribble');
  if (drawing && !lily.override) lily.override = { type: 'scribble' };
  if (!drawing && lily.override?.type === 'scribble') lily.override = null;
  crayonHand.visible = lily.override?.type === 'scribble';
  // now and then: a stretch, a shiver; once the air goes bad, rubbing at a headache
  for (const h of [father, mother, lily]) {
    if (h.override || h.path.length || (h.asleep && S.t >= h.awakeUntil) || h.pose !== 'stand') continue;
    if (Math.random() < dt / 20) {
      const k = S.co > 0.25 ? (Math.random() < 0.6 ? 'rubeyes' : 'shiver') : (Math.random() < 0.5 ? 'stretch' : 'shiver');
      h.override = { type: k, until: S.t + 2 + Math.random() * 1.5 };
    }
  }
}
function askSit(m) {
  // Chapter 1: she takes the bowl from you, and asks you to sit for it, the way Danny taught you
  const b = puzzle.bowl;
  b.gone = true;
  m.path = []; m.pose = 'stand';
  m.hold(b.mesh, 1, { y: -0.02, z: 0.1 });
  m.override = { type: 'carry' };
  m.look(dogHead(), 8, S.t);
  say(m, "Oh, Biscuit. Your bowl. I forgot again, didn't I.", 'sad');
  S.wantSit = m;
  setObj('She is holding your bowl. Listen to her.');
  later(3.6, () => {
    if (S.wantSit !== m) return;
    m.override = { type: 'point' }; m.look(dogHead(), 6, S.t);
    say(m, 'Biscuit, sit.', 'calm', { force: true });
    setObj('She said: Biscuit, sit. Sit for her. (X)');
    const nag = () => { if (S.wantSit !== m) return; m.override = { type: 'point' }; m.look(dogHead(), 4, S.t); say(m, 'Biscuit. Sit.', 'calm', { force: true }); later(12, nag); };
    later(12, nag);
  });
}
const PANTRY = v3(12.85, 0, 5.85), BOWL_SIDE = v3(10.3, 0, 9.02), BAG_SHELF = v3(13.55, 0.94, 6.6);
function feedBiscuit(m) {
  // Chapter 1: she goes and gets the food, comes back, and fills your bowl in front of you
  S.wantSit = null; S.feeding = true;
  const b = puzzle.bowl;
  m.override = { type: 'carry' };
  m.look(dogHead(), 3, S.t);
  say(m, 'Good boy. Good sit. Stay. I will get your food.', 'calm', { force: true });
  setObj('Good boy. She is getting your food.');
  ach('sit');
  later(2.2, () => m.goTo(PANTRY.clone(), () => {
    m.yaw = Math.PI / 2; m.pose = 'kneel'; m.override = { type: 'reach' };
    AU.cupboard(13.38, 0.4, 5.85);
    later(1.5, () => {
      m.hold(kibbleBag, 0, { y: 0.05, z: 0.06 });
      AU.paper(13.2, 0.4, 5.85);
      m.override = { type: 'carry2' };
      later(0.6, () => {
        m.pose = 'stand';
        m.goTo(BOWL_SIDE.clone(), () => {
          m.yaw = 0; m.pose = 'kneel';
          m.look(v3(10.3, 0.1, 9.6), 4, S.t);
          later(0.7, () => {
            // the bowl goes down where it lives
            m.release(b.mesh, scene, b.home.clone());
            AU.pickup();
            m.override = { type: 'pour' };
            kibbleBag.rotation.set(0, 0, -1.9); kibbleBag.position.x += 0.06;
            AU.kibblePour(10.3, 0.3, 9.6);
            b.kibble.visible = true; b.kibble.scale.set(0.5, 0.4, 0.5);
            later(0.6, () => b.kibble.scale.set(0.8, 0.7, 0.8));
            later(1.2, () => b.kibble.scale.set(1, 1, 1));
            later(1.8, () => {
              kibbleBag.rotation.set(0, 0, 0); kibbleBag.position.x -= 0.06;
              b.gone = false; b.full = true; b.label = 'your full bowl'; S.feeding = false;
              m.override = { type: 'carry' }; m.pose = 'stand';
              m.look(dogHead(), 4, S.t);
              say(m, "There you go. I'm sorry, Biscuit. I forgot your dinner again. I forget everything lately.", 'sad', { force: true });
              setObj('Eat your dinner.');
              later(3.5, () => m.goTo(v3(12.85, 0, 6.6), () => {
                m.yaw = Math.PI / 2; m.override = { type: 'reach', until: S.t + 0.8 };
                later(0.6, () => { m.release(kibbleBag, scene, BAG_SHELF.clone()); kibbleBag.rotation.set(0, 0.3, 0); m.override = null; m.setActivity({ spot: spots.sink.clone(), face: 0, pose: 'sink' }); });
              }));
            });
          });
        });
      });
    });
  }));
}
function eatDinner() {
  const b = puzzle.bowl;
  b.full = false; b.kibble.visible = false; b.label = 'your empty bowl';
  AU.eat(); act('eat', 2.1);
  dog.frozen = true; later(2, () => { dog.frozen = false; });
  later(1.6, () => {
    learn('dinner', 'Fed and warm, Biscuit listens to them properly for once.');
    S.ch = 2;
    later(3, startCrayons);
  });
}
function startCrayons() {
  const l = F.lily;
  for (const c of puzzle.crayons) { c.gone = false; c.mesh.visible = true; }
  l.look(dogHead(), 6, S.t);
  say(l, 'Biscuit! I lost my crayons. All of them. The red one, the blue one, the yellow one, the black one, the green one and the purple one. Can you find them? Please?', 'calm');
  updateCrayonObj();
  // the grown-ups talk. Biscuit catches more of it than before.
  later(14, () => {
    const m = F.mother;
    m.setActivity({ spot: v3(12.6, 0, 4.05), face: Math.PI, pose: 'stand' });
    later(5.5, () => { m.override = { type: 'reach', until: S.t + 3 }; });
    later(6, () => say(m, "It's freezing in here. I'm turning the heat up to seventy-eight.", 'calm', { clue: 'The thermostat went up to 78. The furnace would run hard all night.', hl: 'seventy-eight' }));
    later(11, () => m.setActivity({ spot: spots.sink.clone(), face: 0, pose: 'sink' }));
  });
  later(30, () => say(F.father, "Furnace has been making that noise again. I'll look at it this weekend.", 'calm', { clue: 'He already knew something was wrong with it. He had known since November.', hl: "I'll look at it this weekend" }));
  later(44, () => say(F.mother, 'And that alarm thing in the kitchen kept chirping all day, so I took the battery out. I will get a new one tomorrow.', 'calm', { clue: 'It was not a smoke alarm. It was the carbon monoxide detector, warning them. She silenced it.', hl: 'so I took the battery out' }));
  later(58, () => say(F.father, 'Did you call the gas company back?', 'calm'));
  later(62, () => say(F.mother, 'No. After Christmas. We cannot afford it before Christmas.', 'sad', { clue: 'The gas company had already been. They left a red tag on the furnace.', hl: 'After Christmas' }));
}
function updateCrayonObj() { setObj(`The girl lost her coloured sticks all over the house. Find them and bring them to her. Sniff for her smell on them. (${S.crayons}/6)`); }
function giveCrayon(it) {
  const l = F.lily;
  it.gone = true; it.mesh.visible = false;
  S.crayons++;
  const lines = ['One! Good boy!', 'Two! You found another one!', 'Three! You are so smart, Biscuit.', 'Four. Where do they keep going?', 'Five! Just one more!', 'That is all of them! Good boy!'];
  say(l, lines[Math.min(5, S.crayons - 1)], 'calm');
  updateCrayonObj();
  if (S.crayons >= 6) later(3, finishDrawing);
}
function finishDrawing() {
  const l = F.lily;
  setObj('She is drawing something.');
  later(4, () => {
    const d = puzzle.drawing;
    d.gone = false; d.mesh.visible = true;
    d.mesh.position.set(l.pos.x + 0.4, 0.012, l.pos.z + 0.3);
    say(l, 'Look. This is our family. That is Mommy, and Daddy, and me, and you. And that is Danny. He is under the house. Mommy says he is in heaven, but I can hear him under the house at night.', 'calm',
      { clue: 'What Lily hears under the house is the furnace, knocking and breathing through the heating vents.', hl: 'I can hear him under the house at night' });
    later(9, () => {
      learn('crayons', "Lily talks to Biscuit all day. Tonight, he starts to understand her.");
      setObj("Look at what she drew.");
    });
    later(22, startBedtime);
  });
}
function startBedtime() {
  if (S.ch >= 3) return;
  S.ch = 3;
  const { mother, lily, father } = F;
  say(mother, 'Lily. Bed. Come on, it is late.', 'calm');
  later(3, () => say(lily, 'Can Biscuit sleep with me tonight?', 'calm'));
  later(6, () => say(mother, 'Not tonight, honey. He has his own bed.', 'calm'));
  later(2, () => {
    lily.setActivity({ spot: spots.lilyBed.clone(), pose: 'sleep', face: 0 });
    mother.setActivity({ spot: spots.lilyBedSide.clone(), pose: 'stand', face: Math.PI / 2 });
  });
  later(10, ignite);
  later(18, () => { S.lullaby = AU.lullaby(() => { const p = mother.headWorld(); return [p.x, p.y, p.z]; }, S.co, 0.6); });
  later(36, () => { mother.setActivity({ spot: spots.motherChair.clone(), face: Math.PI, pose: 'sit' }); });
  setObj('Something under the house is breathing. The girl\'s room is warm.');
}
function ignite() {
  S.coOn = true; S.coT0 = S.t; S.coAcc = 0;
  AU.whoomp(spots.furnace.x, BASE_Y + 1, spots.furnace.z);
  for (const L of lights) if (L && L.slot < 4) L.intensity = 0.35;
  later(0.25, () => { for (const L of lights) if (L && L.slot < 4) L.intensity = 1; });
  later(0.5, () => { for (const L of lights) if (L && L.slot < 4) L.intensity = 0.6; });
  later(0.7, () => { for (const L of lights) if (L && L.slot < 4) L.intensity = 1; });
  S.nextRattle = S.t + 6;
}
function rattleDoor() {
  const d = doors.basement;
  AU.rattle(13.4, 1.6, 3.5, 1);
  S.doorShake = 0.6;
  if (once('latchLine') && !S.deep && awake(F.father)) {
    later(2, () => say(F.father, 'Hear that? Every time the furnace kicks on, it pulls on the basement door. That old latch is the only thing holding it shut. Danny was going to fix it.', 'calm',
      { clue: 'This is why the basement door opens. The running furnace pulls air, and with the latch off, the door swings open on its own.', hl: 'Every time the furnace kicks on, it pulls on the basement door' }));
  }
}
function lilyHearsVent() {
  const l = F.lily;
  AU.ventVoice(spots.lilyVent.x, 0.1, spots.lilyVent.z);
  later(2.5, () => {
    l.asleep = false; l.awakeUntil = S.t + 99999;
    l.look(dogHead(), 8, S.t);
    say(l, 'Biscuit? Do you hear him too? It is Danny. He is talking in the heater. He is under the house.', 'whisper',
      { clue: 'Biscuit heard it too: the furnace breathing through the vent. To a little girl who misses her brother, it sounded like his voice.', hl: 'He is talking in the heater' });
    later(6, () => {
      setObj('Follow the girl.');
      l.setActivity({ spot: v3(13.4, 0, 4.05), face: Math.PI, pose: 'stand' });
      S.lilyToLatch = true;
    });
  });
}
function lilyAtLatch() {
  const l = F.lily;
  say(l, 'There is a hook up there. I can not reach it. I need something to stand on.', 'calm');
  setObj('The girl can\'t reach the hook. Push something over for her to stand on.');
  S.lilyWaiting = true;
}
function lilyUnhooks() {
  const l = F.lily, st = puzzle.stool;
  S.lilyWaiting = false;
  st.dragging = false; puzzle.setStoolCol();
  l.path = []; l.pos.set(st.mesh.position.x, 0.36, st.mesh.position.z); l.yaw = Math.PI; l.pose = 'stand';
  later(1.6, () => {
    puzzle.latched = false; refs.hook.rotation.z = 1.2;
    AU.knock(13.72, 1.95, 3.55, 1, 0.5);
    doors.basement.target = 0.95; doors.basement.speed = 0.5; AU.creak(13.4, 1, 3.5, 2.8, 1.2);
    l.pos.y = 0;
    say(l, 'Danny? Danny, are you down there?', 'whisper');
  });
  later(6, () => say(l, 'It is too dark. I am scared. You go first, Biscuit. Find him. Bring him back.', 'whisper'));
  later(11, () => {
    l.setActivity({ spot: spots.lilySit.clone(), face: 0, pose: 'sit' });
    learn('door', 'The girl explains things to Biscuit like he is a person. Tonight, he is.');
    S.ch = 4;
    setObj('The basement is open. Danny\'s smell goes down the stairs.');
    later(20, motherToBed);
  });
}
function motherToBed() {
  const { mother, father } = F;
  say(mother, 'I am going to lie down. My head is killing me. And I am putting Danny\'s key back in the cookie jar, up high, where it stays.', 'sleepy', { clue: 'Headache, confusion and sleepiness: the first signs of carbon monoxide poisoning.', hl: 'My head is killing me' });
  later(2.5, () => {
    lights[0].on = false;
    later(6, () => AU.flush(0.5, 1.0, 2.8));
    mother.setActivity({ spot: spots.parentBedM.clone(), pose: 'sleep', face: 0 });
    puzzle.letterOut = true; refs.letter.visible = true;
    puzzle.keyInJar = true; // up on the counter, where nobody can reach it
  });
  later(25, () => {
    if (S.cut) return;
    say(father, 'I do not feel so good. I am going to bed.', 'sleepy', { clue: 'Everyone in the house was being poisoned. Biscuit too.', hl: 'I do not feel so good' });
    later(3, () => {
      S.tvOn = false; AU.setTV(false); lights[2].on = false; lights[1].on = false;
      father.setActivity({ spot: spots.parentBedF.clone(), pose: 'sleep', face: 0 });
      later(14, () => { lights[3].on = false; S.deep = true; });
    });
  });
  later(8, () => setObj('Danny\'s door has been shut for a year. The woman keeps its key in the cookie jar, high on the kitchen counter.'));
}
function lilyUnlocks() {
  const l = F.lily;
  say(l, 'Danny\'s key! Mommy said nobody goes in there. Okay. Just for a minute. Do not tell.', 'whisper');
  l.setActivity({ spot: v3(9.45, 0, 4.0), face: Math.PI, pose: 'stand' });
  S.lilyToDanny = true;
}
function openDannyRoom() {
  const l = F.lily;
  doors.danny.locked = false; doors.danny.target = 1.35; doors.danny.speed = 0.6;
  AU.creak(9.45, 1, 3.5, 2.2, 1);
  puzzle.dannyOpen = true;
  lights[8].on = true; refs.dannyLampShade.material.uniforms.uEmissive.value.set(0.5, 0.45, 0.25);
  refs.dannyDoorLight.visible = false; S.dannyLightOn = false;
  later(2, () => say(l, 'His lamp is still on. It still smells like him.', 'whisper'));
  later(6, () => l.setActivity({ spot: spots.lilySit.clone(), face: 0, pose: 'sit' }));
  setObj('Danny\'s room. Everything is exactly where he left it. Look around.');
}
function readNotebook() {
  puzzle.dannyNotebookRead = true;
  if (!once('notebookLearn')) return;
  learn('room', 'Danny talked about the hot box and the beeping thing all the time. Now the words connect.');
  later(4, startYardChapter);
}

// ===========================================================================
// CHAPTER 5: out back. Danny's job, what you buried together, and the gate.
function startYardChapter() {
  if (S.ch >= 5) return;
  S.ch = 5;
  ui.card('Danny\'s job', 'His list says: after a big snow, somebody has to dig out the furnace pipe outside, or the bad air comes back in. He is not here to do it. You can dig.');
  // he waits by your flap at the end of the hall
  const d = F.danny;
  if (!S.ghostState) {
    d.visible = true; d.setPos(13.25, 4.25); d.yaw = Math.PI / 2; d.pose = 'floor';
    d.look(v3(14, 0.3, 4.25), 30, S.t);
    S.ghostState = { kind: 'flap', t: 0 };
  }
  checkYard();
}
function checkYard() {
  if (S.ch !== 5) return;
  const Y = S.yardDone, c = (b) => (b ? '[x]' : '[ ]');
  const flap = yard.flapOpen ? '' : ' Your flap is at the end of the hall. Its storm cover is in.';
  setObj(`Out back, under the snow.${flap}  ${c(Y.vent)} dig out the furnace pipe (hold R)  ${c(Y.tin)} find what you and Danny buried (sniff)  ${c(Y.gate)} follow his last trail to where it ends (sniff, then T)`);
  if (Y.vent && Y.tin && Y.gate && once('yardDone')) later(4, startLightsOut);
}
// ===========================================================================
// CHAPTER 6: lights out. The girl is gone.
const LILY_TRAIL = [[7.25, 1.95], [6.6, 2.8], [5.95, 3.3], [6.0, 4.25], [9.0, 4.25], [11.45, 4.6], [11.6, 6.0], [12.8, 6.4], [12.4, 5.2], [12.6, 4.3], [13.35, 3.8]];
const LILY_TRAIL_DOWN = [[13.3, 3.2, 0], [13.3, 2.0, -1.3], [13.3, 0.6, -2.6], [12.6, -0.3, -2.8], [10.5, -0.6, -2.8], [8.6, -0.55, -2.8], [7.75, -0.5, -2.8]];
function startLightsOut() {
  if (S.ch >= 6) return;
  S.ch = 6;
  S.pendingCut = true;
  setObj('Go back inside. Something is wrong with the house.');
}
function powerCut() {
  S.pendingCut = false; S.power = false;
  lightning(); S.flashSeq = [[0, 1], [0.05, 0.2], [0.1, 1], [0.25, 0.6], [0.4, 0]];
  AU.thunder(3); later(0.2, () => AU.stinger(0.8));
  for (const i of [0, 1, 2, 3, 4, 6, 8, 10, 13]) if (lights[i]) lights[i].on = false;
  S.tvOn = false; AU.setTV(false); AU.setFridge(false);
  S.clockStopped = true;
  const fl = puzzle.flashlight;
  if (!fl.carried && dist2d(fl.mesh.position, v3(9.1, 0, 2.25)) < 0.5) { fl.mesh.position.set(9.1, 0.03, 2.25); }
  S.flashOn = true;
  later(2.5, () => {
    const l = F.lily;
    AU.scream(); // small and far away
    showSubtitle('lily', 'BISCUIT! It is dark! Danny? Danny, is that you?', 3);
    later(2.2, () => {
      // and then she is gone from her bed
      l.path = []; l.activity = null; l.asleep = false; l.awakeUntil = 1e9;
      l.setPos(7.75, -0.55, BASE_Y); l.yaw = Math.PI; l.pose = 'stand'; l.setFace(true);
      S.lilyGone = true;
      setObj('The lights are out. The girl screamed, and then she stopped. Find her. (Sniff for her, then T to follow only her smell.)');
    });
  });
  later(8, () => ui.card('Lights out', 'The storm has taken the power. The furnace does not need it. It keeps breathing in the dark. And now that the house is dark, the thing that lives in the bad air does not have to stay under the house.'));
  S.stalkOn = true; S.stalk = { state: 'away', t: 1e9 };
}
function lilyFound() {
  const l = F.lily;
  l.look(dogHead(), 6, S.t);
  say(l, 'Shh. Biscuit. Danny says it is warm down here. He says we can all go to sleep down here, together.', 'whisper',
    { clue: 'The poisoned air was making Lily confused and sleepy. The furnace "voice" was telling her to lie down by it.', hl: 'we can all go to sleep down here' });
  setObj('She does not know where she is. Snap her out of it. (Bark: B)');
  S.lilyDazed = true;
  later(3, () => { if (!S.presenceActive) wakePresence(); });
}
function lilyWakesUp() {
  const l = F.lily;
  S.lilyDazed = false; l.setFace(false);
  say(l, 'Biscuit? Where... why is it so dark? I am scared. I want to go up. Take me up, Biscuit. Do not let go.', 'sad');
  setObj('Take her back up to her room. Stay close; she is slow, and she is scared of the dark.');
  S.escort = { repath: 0 };
}
function updateEscort(dt) {
  const E2 = S.escort; if (!E2) return;
  const l = F.lily;
  const d = dist2d(l.pos, dog.pos);
  const inB = l.pos.y < -0.3 || (l.pos.x > 12.5 && l.pos.z < 3.1);
  if (inB) {
    // in the basement and on the stairs: straight at you, step by step
    l.speed = 0.95;
    l.path = d > 1.0 && d < 7 ? [v3(dog.pos.x, 0, dog.pos.z)] : [];
    if (d >= 7 && S.t - (E2.cry || -99) > 6) { E2.cry = S.t; say(l, 'Biscuit! Where are you? I can not see!', 'sharp', { force: false, cooldown: 5 }); }
    l.pos.y = floorAt(l.pos.x, l.pos.z, l.pos.y);
  } else {
    l.pos.y = 0;
    E2.repath -= dt;
    if (E2.repath <= 0) { E2.repath = 1.0; if (d > 1.3) l.goTo(v3(dog.pos.x, 0, dog.pos.z)); else l.path = []; }
    l.speed = 1.0;
    if (roomAt(l.pos.x, l.pos.z, 0) === 'lily' && roomAt(dog.pos.x, dog.pos.z, dog.y) === 'lily') {
      S.escort = null; S.lilyGone = false;
      l.setActivity({ spot: spots.lilySit.clone(), face: 0, pose: 'sit' });
      say(l, 'I will stay right here. I will not go anywhere. Danny\'s things are down there, Biscuit. In his boxes. He wants you to find them.', 'whisper');
      learn('home', 'You brought her home. You understand her better than ever.');
      later(6, startBasementChapter);
    }
  }
}
function updateFlashlight(dt) {
  const L = lights[12], fl = puzzle.flashlight;
  if (!S.flashOn || fl.gone) { L.on = false; refs.flashLens.material.uniforms.uColor.value.setScalar(0.15); return; }
  L.on = true;
  // the batteries are old: it flickers, and sometimes it goes out for a terrible second
  S.flashDie = (S.flashDie || 0) - dt;
  if (S.flashDie < -3 && Math.random() < dt * (S.stalk && S.stalk.state === 'hunt' || S.presenceActive ? 0.5 : 0.08)) S.flashDie = 0.4 + Math.random() * 1.4;
  const flick = S.flashDie > 0 ? (Math.random() < 0.15 ? 0.6 : 0.02) : 0.88 + Math.random() * 0.12;
  L.intensity = flick * 1.6;
  if (fl.carried) {
    const f = dogForward(), c = ui.camera;
    const pt = c.getWorldDirection(v3(0, 0, 0));
    L.pos.set(c.position.x + pt.x * 1.0, c.position.y + pt.y * 1.0, c.position.z + pt.z * 1.0);
    L.range = 6.5;
  } else {
    const p = fl.mesh.position, a = fl.mesh.rotation.y;
    L.pos.set(p.x - Math.sin(a) * 0.7, p.y + 0.25, p.z - Math.cos(a) * 0.7);
    L.range = 4;
  }
  refs.flashLens.material.uniforms.uColor.value.setScalar(flick > 0.3 ? 1 : 0.2);
}

function startBasementChapter() {
  if (S.ch >= 7) return;
  S.ch = 7;
  ui.card('Under the house', 'Danny\'s smell goes down the basement stairs, to his boxes, and into the dark where the hot box breathes. He wants you to find something.');
  checkBasement();
}
function pullCover() {
  act('pull');
  const watcher = [F.father, F.mother].find((h) => awake(h) && !S.deep && h.pose !== 'sleep' && sameFloor(h) && !h.unconscious);
  AU.drawer(13.9, 0.3, 4.25);
  if (watcher) {
    later(0.4, () => AU.knock(13.9, 0.3, 4.25, 1, 0.5));
    watcher.look(dogHead(), 4, S.t);
    say(watcher, 'No. Biscuit. Not tonight. Not in this storm. You will run off again.', 'sharp',
      { force: false, cooldown: 8, clue: 'Biscuit had run off once before, on a night like this one.', hl: 'You will run off again' });
    return;
  }
  yard.flapOpen = true;
  refs.flapCoverCol.disabled = true;
  later(0.35, () => {
    const c = refs.flapCover;
    c.position.set(13.62, 0.03, 4.0); c.rotation.set(0, 0.3, Math.PI / 2);
    AU.thunk(13.7, 0.05, 4.1, 0.8);
    emit(13.9, 0.2, 4.25, 'outside', { spread: 0.4, life: 2, vx: -0.3 });
    checkYard();
  });
}
function digDone(sp) {
  sp.done = true;
  sp.mound.visible = false;
  digHole(sp.pos.x, sp.pos.z, 0.42, true);
  AU.chime();
  if (sp === yard.vent) {
    S.yardDone.vent = true;
    ui.card('The pipe can breathe.', 'The snow had buried the hot box\'s breath, so it was breathing back into the house. Now it breathes out here instead. The bad air will build more slowly. But the hot box is still broken inside, and the house is still filling up.');
  } else if (sp === yard.tin) {
    S.yardDone.tin = true;
    const it = yard.tinItem;
    it.gone = false; it.mesh.visible = true; it.mesh.position.set(sp.pos.x, 0.05, sp.pos.z);
    learn('yard', 'You remember digging this hole with him in the summer. You remember every word he said out here.');
  } else if (sp === yard.gateDig) {
    refs.gateCol.disabled = true;
    digHole(27.75, 4.0, 0.45, true); digHole(28.3, 4.0, 0.45, true);
    showSubtitle('note', '<span class="note">(A hole under the gate, just big enough. His trail goes on, out across the field.)</span>', 3.5);
  } else if (sp === yard.mitten) {
    const it = yard.mittenItem;
    it.gone = false; it.mesh.visible = true;
  } else if (sp === yard.bone) {
    const it = yard.boneItem;
    it.gone = false; it.mesh.visible = true; it.mesh.position.set(sp.pos.x, 0.04, sp.pos.z);
    showSubtitle('note', '<span class="note">(Your bone. You buried it in October, the day the man raked the leaves.)</span>', 3);
  }
  if (yard.tin.done && yard.bone.done && yard.mitten.done) ach('digger');
  checkYard();
}
function gateScene() {
  const d = F.danny;
  S.ghostState = null;
  d.visible = true; d.setPos(29.4, 3.95); d.pose = 'stand';
  d.yaw = Math.atan2(dog.pos.x - 29.4, dog.pos.z - 3.95);
  d.look(dogHead(), 12, S.t);
  AU.ventVoice(29.4, 1.3, 3.95);
  later(1.5, () => say(d, 'You came back, Biscuit. You always come back. I am not mad. Go home now. They need you.', 'whisper',
    { clue: 'Danny never blamed Biscuit for running off that night.', hl: 'I am not mad' }));
  later(9, () => { d.path = [v3(33, 0, 3.2), v3(37, 0, 2.6)]; d.speed = 0.6; S.ghostState = { kind: 'field', t: 0 }; });
  later(11, () => {
    ui.card('The gate', 'It was open, that night. You smelled the deer and you ran. He came after you without his coat, calling your name, out across the field toward the pond. You came home in the morning. He did not.');
    S.yardDone.gate = true;
    checkYard();
  });
}
function updateDigging(dt) {
  const want = input.rDown && !dog.frozen && !S.cut && !dog.carrying && !puzzle.stool.dragging && !input.cDown;
  dog.digging = want && S.outside;
  if (want && !S.outside) {
    if (S.t - (S.lastFloorNote || -99) > 6) { S.lastFloorNote = S.t; showSubtitle('note', `<span class="note">(${dist2d(dog.pos, spots.dogBed) < 0.7 ? 'You scratch your bed around in a circle. It does not help.' : 'You scrape at the floor. There is nothing to dig in here. Outside, under the snow.'})</span>`, 2.5); }
    if (dist2d(dog.pos, spots.dogBed) < 0.7) dog.digging = true;
    return;
  }
  if (!dog.digging) { S.digNothing = 0; return; }
  const f = dogForward();
  const px = dog.pos.x + f.x * 0.32, pz = dog.pos.z + f.z * 0.32;
  S.digSnd = (S.digSnd || 0) - dt;
  if (S.digSnd <= 0) {
    S.digSnd = 0.2 + Math.random() * 0.06;
    AU.dig(true);
    spray(px, 0.05, pz, dog.yaw, { n: 7 });
    digHole(px, pz, 0.2 + Math.random() * 0.06, false);
  }
  let best = null, bd = 1e9;
  for (const sp of yard.digSpots) {
    if (sp.done) continue;
    const d = Math.hypot(sp.pos.x - px, sp.pos.z - pz);
    if (d < sp.r && d < bd) { bd = d; best = sp; }
  }
  if (best) {
    best.progress += dt;
    const k = Math.max(0.05, 1 - best.progress / best.need);
    best.mound.scale.set(best.base.x * (0.55 + 0.45 * k), best.base.y * k, best.base.z * (0.55 + 0.45 * k));
    if (best === yard.vent && S.coOn && Math.random() < dt * 6) emit(spots.vent.x, 0.4, spots.vent.z, 'exhaust', { spread: 0.3, life: 2, vy: 0.2 });
    if (best.progress > best.need * 0.5) spray(px, 0.05, pz, dog.yaw, { n: 1, col: [0.3, 0.24, 0.18] });
    if (best.progress >= best.need) digDone(best);
    S.digNothing = 0;
  } else {
    S.digNothing += dt;
    if (S.digNothing > 3) { S.digNothing = -4; showSubtitle('note', '<span class="note">(Just snow, and frozen ground under it. Nothing here. Sniff for it first.)</span>', 2.5); }
  }
}
function updateYard(dt) {
  updateFlap(dt, dog.pos, (v) => AU.flap(14.0, 0.3, 4.25, 0.4 + v));
  // coming in from the snow: shake it off
  if (S.wasOutside && !S.outside && !inBasement()) later(0.5, () => { if (!S.outside && !dog.frozen) { act('shake'); AU.shakeSnd(); ach('shake'); for (let i = 0; i < 14; i++) puff(dog.pos.x, dog.y + 0.35, dog.pos.z, { col: [0.85, 0.88, 0.95], vx: (Math.random() - 0.5) * 2.5, vy: Math.random() * 1.2, vz: (Math.random() - 0.5) * 2.5, grav: 4, life: 0.6, size: 0.02, spread: 0.3 }); } });
  if (!S.wasOutside && S.outside && once('firstOutside')) ui.card('Outside', 'The air out here is cold and clean, and your head clears. It is the house. Something in the house is making all of you sick.');
  S.wasOutside = S.outside;
  // cold
  S.cold = Math.max(0, S.cold + (S.outside ? dt * (dog.pos.x > 28.2 ? 1.6 : 1) : -dt * 2.5));
  P.uCold.value += (Math.min(1, Math.max(0, (S.cold - 25) / 120)) - P.uCold.value) * Math.min(1, dt * 2);
  if (S.cold > 160 && !S.coldDown && S.outside) {
    S.coldDown = true; dog.frozen = true; S.blackout = 3;
    later(1.2, () => {
      if (dog.carrying) dropItem(dog.carrying, true);
      dog.pos.copy(spots.flapIn); dog.y = 0; dog.yaw = Math.PI / 2; S.cold = 60; S.coAcc += 25 / CO_DUR;
      showSubtitle('note', '<span class="note">(The cold put you down in the snow. You came to inside your flap, shaking, and you lost time.)</span>', 4);
    });
    later(3, () => { dog.frozen = false; S.coldDown = false; });
  }
  dog.shiver = Math.max(0, Math.min(1, (S.cold - 70) / 60));
  dog.panting = S.outside && dog.speed > 3;
  if (S.cold > 90 && once('coldNote')) showSubtitle('note', '<span class="note">(The cold is getting into you; everything is going blue. Go back inside to warm up before it puts you down.)</span>', 4);
  // your breath smokes in the cold
  if (S.outside) {
    S.nextBreath = (S.nextBreath || 0) - dt;
    if (S.nextBreath <= 0) { S.nextBreath = dog.panting ? 0.4 : 1.4; const f = dogForward(); breath(dog.pos.x, dog.y + 0.33, dog.pos.z, f.x, f.z, dog.panting ? 0.6 : 1); }
  }
  // the vent, dug clear, steams
  if (S.yardDone.vent && S.coOn && Math.random() < dt * 14) puff(spots.vent.x + 0.08, spots.vent.y, spots.vent.z, { col: [0.62, 0.64, 0.68], vx: 0.25 + Math.random() * 0.2, vy: 0.35 + Math.random() * 0.2, vz: (Math.random() - 0.5) * 0.2, life: 1.6, size: 0.04, spread: 0.06 });
  // the sheet on the line moves in the wind
  if (refs.sheet) refs.sheet.rotation.x = Math.sin(S.t * 1.3) * 0.12 + Math.sin(S.t * 3.1) * 0.04;
  if (refs.tire) refs.tire.rotation.z = Math.sin(S.t * 0.7) * 0.05;
  // the gate: where his last trail goes
  if (S.outside && TRACK.group === 3) S.trackedDannyOut = true;
  if (S.outside && dist2d(dog.pos, spots.gate) < 1.9 && !S.yardDone.gate && !S.fired.has('gate')) {
    // you made it to the gate: if you followed his smell out here at all, or you wait and sniff the air, it is enough
    S.gateWait = (S.gateWait || 0) + dt;
    if (TRACK.group === 3 || S.trackedDannyOut || S.gateWait > 4) { S.fired.add('gate'); gateScene(); }
    else if (S.t - (S.gateNote || -99) > 9) { S.gateNote = S.t; showSubtitle('note', '<span class="note">(His trail ends here, at the gate. So many smells cross here. Stay a moment.)</span>', 3.5); }
  } else S.gateWait = 0;
  if (S.outside && S.fired.has('gate') && !yard.gateDig.done && dist2d(dog.pos, spots.gate) < 1.6 && once('gateDigNote'))
    later(12, () => showSubtitle('note', '<span class="note">(His trail goes on under the gate. Snow is piled against the bottom of it. You could dig under. Hold R.)</span>', 4.5));
  // the pond, where it ends
  if (S.outside && dog.pos.x > 33 && once('pond')) {
    ach('pond');
    const d = F.danny;
    d.visible = true; d.setPos(39.3, 3.0); d.pose = 'stand'; d.yaw = Math.atan2(dog.pos.x - 39.3, dog.pos.z - 3.0);
    d.look(dogHead(), 6, S.t); S.ghostState = { kind: 'pond', t: 0 };
    AU.ventVoice(39.3, 1.2, 3.0);
    later(2, () => ui.card('The pond', 'The ice is thin here, by the dead tree. It always was. His smell goes out onto it, and stops. You did not come this far, that night. You were across the field, chasing the deer, and you did not hear the ice.'));
  }
  if (S.ghostState && S.ghostState.kind === 'pond' && (S.ghostState.t > 6 || dist2d(dog.pos, F.danny.pos) < 3)) { F.danny.visible = false; S.ghostState = null; }
  // the deer, out in the field, only when the lightning shows it
}
function readClipping() {
  if (!once('clippingLearn')) return;
  later(0.5, () => learn('pond', 'Biscuit remembers that night. The words come back with it.'));
  // Danny shows you the drawer
  later(4, () => {
    const d = F.danny;
    d.visible = true; d.setPos(10.5, -2.4, BASE_Y); d.yaw = 0; d.pose = 'stand';
    d.look(v3(10.5, BASE_Y + 0.5, -3.5), 20, S.t);
    S.ghostState = { kind: 'drawer', t: 0 };
  });
  checkBasement();
}
function checkBasement() {
  if (S.ch !== 7) return;
  const j = S.got.jacketUp ? '[x]' : '[ ]', t = S.got.tagUp ? '[x]' : '[ ]';
  setObj(`Find what Danny wants you to find. Carry it up out of the basement.  ${j} his jacket  ${t} a red paper`);
  if (S.got.jacketUp && S.got.tagUp) later(2, startWakeChapter);
}
function startWakeChapter() {
  if (S.ch >= 8) return;
  S.ch = 8;
  setObj('The man and the woman will not wake up. The beeping box in the kitchen is silent. Its heart is lying on the kitchen floor.');
  if (puzzle.battery.gone) { puzzle.battery.gone = false; puzzle.battery.mesh.visible = true; puzzle.battery.mesh.position.set(10.55, 0.03, 5.45); }
}
function lilyFixesAlarm() {
  const l = F.lily;
  say(l, 'This is from the beeping thing in the kitchen! Mommy took it out. Danny always said never take it out.', 'calm');
  l.setActivity({ spot: v3(10.6, 0, 5.55), face: Math.PI, pose: 'stand' });
  S.lilyToAlarm = true;
}
function alarmGoesOff() {
  const { lily: l, father: f, mother: m } = F;
  l.pos.y = 0.45;
  later(1.2, () => {
    S.alarmOn = true; lights[9].on = true;
    AU.alarm(true, 10.6, 1.4, 5.1);
    l.pos.y = 0;
    say(l, 'It is screaming! MOMMY! DADDY!', 'sharp');
    S.deep = false;
    for (const h of [f, m]) { h.unconscious = false; h.asleep = false; h.awakeUntil = S.t + 99999; }
    later(3, () => say(m, 'Tom? Tom, what is that noise...', 'sleepy'));
    later(2, () => {
      f.setActivity({ spot: v3(10.6, 0, 5.75), face: Math.PI, pose: 'stand' });
      S.fatherToAlarm = true;
    });
    later(6, () => l.setActivity({ spot: spots.lilySit.clone(), face: 0, pose: 'sit' }));
  });
}
function fatherKillsAlarm() {
  const f = F.father;
  say(f, 'That stupid thing. It has been doing that all day.', 'sleepy', { clue: 'It had been warning them all day. He pulled the battery out again, half asleep.', hl: 'It has been doing that all day' });
  later(3, () => {
    S.alarmOn = false; S.alarmDone = true; lights[9].on = false; AU.alarm(false);
    AU.knock(10.6, 1.4, 5.1, 1, 0.4);
    f.setActivity({ spot: spots.motherChair.clone(), face: Math.PI, pose: 'sit' });
    F.mother.setActivity({ spot: spots.parentBedM.clone(), pose: 'sleep', face: 0 });
    F.mother.awakeUntil = S.t + 25;
    setObj('The man is awake, but he does not understand. Show him why the house is wrong.');
  });
}
function fatherReadsTag() {
  const f = F.father;
  S.father.tag = true;
  f.look(dogHead(), 10, S.t);
  say(f, 'Cutter Gas. Cracked heat exchanger. Carbon monoxide. Do not operate. I put this in the drawer. I thought it could wait until after Christmas.', 'sad',
    { clue: 'The technician red-tagged the furnace on November 30th. Tom hid the tag in the workbench drawer.', hl: 'I put this in the drawer' });
  later(9, () => say(f, 'The headaches. The alarm. Oh God. It was not chirping. It was warning us.', 'sad', { clue: 'He finally understands.', hl: 'It was warning us' }));
  later(15, () => {
    if (S.father.jacket) return finale();
    say(f, 'I can not... think... I can not get up...', 'sleepy');
    setObj('He understands. But the bad air is holding him down. Give him a reason to get up.');
  });
}
function fatherSeesJacket() {
  const f = F.father;
  S.father.jacket = true;
  f.look(dogHead(), 10, S.t);
  say(f, 'His jacket. He went out without it. That night. He ran out in the storm without his coat to find you.', 'sad',
    { clue: 'Danny died a year ago tonight, looking for Biscuit in the snow. He never put his jacket on.', hl: 'without his coat to find you' });
  if (S.father.tag) later(8, finale);
  else {
    later(8, () => say(f, 'It still smells like him. Where did you find this, Biscuit?', 'sad'));
    later(11, () => setObj('He is holding the jacket and crying. He still does not know what is wrong with the house.'));
  }
}
function finale() {
  const f = F.father;
  S.cut = 'finale';
  say(f, 'No. Not again. NOT AGAIN. CLAIRE! LILY! Get up! Everybody OUT! NOW!', 'sharp',
    { clue: 'For the first time in a year, he followed Biscuit.', hl: 'Not again' });
  VOCAB_STATE.all = true;
  later(1, () => { ui.vocab('Biscuit understands every word.', ['everything']); AU.chime(); });
  later(4.5, () => say(f, 'I can not... the air... Biscuit, I can not get up...', 'sleepy'));
  later(8, () => {
    S.cut = null;
    f.unconscious = true; f.asleep = true; f.awakeUntil = 0; f.path = [];
    if (f.pose === 'sit') f.pose = 'slump';
    furnaceOpens();
  });
}
// Chapter 9: the hot box opens its mouth, and the only way to stop it is from inside
function furnaceOpens() {
  S.ch = 9; S.furnaceMaw = true;
  AU.whoomp(spots.furnace.x, BASE_Y + 1, spots.furnace.z); AU.stinger(0.6); AU.thunder(0.4);
  lights[5].on = true;
  ui.card('The hot box is open', 'From down in the basement comes a roar, and the whole house shakes. He has fallen, and he will not get up. The hot box has opened its grille like a mouth, and behind it there is no fire. There is a street. You know, the way dogs know things, that the only way to stop it is from the inside.');
  setObj('He fell down and will not wake up. The hot box is pouring the bad air into everything. Go down to it, and go INTO it.');
}
function intoFurnace() {
  dog.frozen = true;
  AU.whoomp(spots.furnace.x, BASE_Y + 1, spots.furnace.z); AU.stinger(0.8);
  S.fade = 1; S.fadeSpeed = 3;
  later(1.4, () => { enterOther(); S.fade = 0; S.fadeSpeed = 1; dog.frozen = false; });
}
// back from the other side: the furnace is dead quiet, and they are still asleep
function comeHomeReal() {
  S.ch = 10; S.otherDone = true;
  const { father, mother, lily } = F;
  S.coOn = false; S.furnaceMaw = false; lights[5].on = false;
  S.power = true; for (const i of [0, 1, 3, 4, 13]) if (lights[i]) lights[i].on = true;
  S.stalkOn = false; if (S.stalk) { S.stalk.state = 'away'; S.stalk.t = 1e9; }
  S.presenceActive = false; S.presenceSleep = 0; S.presence.root.visible = false; S.presence.visible = false;
  S.alarmOn = false; AU.alarm(false); S.finalFollow = false; S.cut = null; S.escort = false; S.lilyDazed = false;
  const put = (h, a) => { h.path = []; h.arrived = null; h.override = null; h.eaten = false; h.visible = true; h.activity = a; h.settle(); h.unconscious = true; h.asleep = true; h.awakeUntil = 0; };
  put(father, { spot: spots.armchair.clone(), face: Math.PI, pose: 'slump' });
  put(mother, { spot: spots.parentBedM.clone(), pose: 'sleep', face: 0 });
  put(lily, { spot: spots.lilyBed.clone(), pose: 'sleep', face: 0 });
  F.danny.visible = false; F.danny.path = [];
  puzzle.latched = false; refs.hook.rotation.z = 1.2; doors.basement.target = 0.95;
  dog.human = false; S.hideDog = false;
  dog.pos.set(11.4, BASE_Y, -1.5); dog.y = BASE_Y; dog.yaw = 1.48; dog.pitch = 0;
  dog.frozen = true; later(2.5, () => { dog.frozen = false; });
  P.uFlash.value = 1;
  S.wakeList = [];
  VOCAB_STATE.all = true;
  later(2, () => ui.card('You understand', 'Danny went out into the snow after you once, and he did not come back. Tonight he went into the dark after you again, and this time he got you home. You understand all of it now: every word they said, and what it meant. The hot box is quiet and cold. The air in the house is still bad. They are still asleep. Wake them up. All of them.'));
  setObj('Wake them up. All three. Bark at them, nudge them. Then lead them out the front door.');
}
function wakeFinal(h) {
  if (!h.unconscious || S.wakeList.includes(h)) return;
  h.unconscious = false; h.asleep = false; h.awakeUntil = S.t + 1e6;
  if (h.pose === 'sleep') { h.pos.y = 0; h.pos.x += h === F.lily ? 0.7 : -0.7; }
  h.pose = 'stand'; h.activity = null; h.speed = 1.05;
  h.look(dogHead(), 6, S.t);
  const line = h === F.father ? 'Biscuit...? What... the air. Oh God. CLAIRE! LILY!' : h === F.mother ? 'Biscuit? My head... Tom? Tom, what is happening?' : 'Biscuit! I dreamed about Danny. He said you were coming to get us.';
  say(h, line, h === F.lily ? 'calm' : 'sharp');
  S.wakeList.push(h); AU.chime();
  if (S.wakeList.length >= 3) { ach('awake'); setObj('They are all up. Lead them out: the front door, and the cold, clean air.'); }
  else setObj(`Wake them up. ${S.wakeList.length} of 3 awake. Bark at them, nudge them.`);
}

// ---------------------------------------------------------------------------
// The family's ongoing schedule and the house reacting
function phaseUpdate(dt) {
  const { father, mother, lily } = F;
  const co = S.co;
  if (S.t > 6 && once('intro1')) say(lily, 'Biscuit! Come here, look what I am making!', 'calm');
  if (S.t > 18 && once('intro2')) say(father, "Cable's out again. Storm is supposed to get worse tonight.", 'calm');
  // the latch rattles every time the furnace cycles
  if (S.coOn && puzzle.latched && S.t > (S.nextRattle || 1e9)) { S.nextRattle = S.t + 14 + Math.random() * 10; rattleDoor(); }
  if (S.doorShakeT > 0) {
    S.doorShakeT -= dt;
    const d = S.doorShakeD;
    if (Math.abs(d.angle) < 0.3) d.pivot.rotation.y = d.base + d.angle + (S.doorShakeT > 0 ? Math.sin(S.t * 55) * 0.01 : 0);
  }
  if (S.doorShake > 0) {
    S.doorShake -= dt;
    doors.basement.pivot.rotation.y = doors.basement.base + doors.basement.angle + (S.doorShake > 0 ? Math.sin(S.t * 70) * 0.025 : 0);
  }
  // Chapter 3: the vent in Lily's room
  if (S.ch === 3 && S.coOn && lily.pose === 'sleep' && dist2d(dog.pos, spots.lilyVent) < 1.3 && once('vent')) lilyHearsVent();
  if (S.lilyToLatch && !lily.path.length && dist2d(lily.pos, v3(13.4, 0, 4.05)) < 0.2) { S.lilyToLatch = false; lilyAtLatch(); }
  if (S.lilyWaiting && dist2d(puzzle.stool.mesh.position, v3(13.4, 0, 4.0)) < 0.85) lilyUnhooks();
  if (S.lilyToDanny && !lily.path.length && dist2d(lily.pos, v3(9.45, 0, 4.0)) < 0.25) { S.lilyToDanny = false; openDannyRoom(); }
  if (S.lilyToAlarm && !lily.path.length && dist2d(lily.pos, v3(10.6, 0, 5.55)) < 0.25) { S.lilyToAlarm = false; alarmGoesOff(); }
  if (S.fatherToAlarm && !father.path.length && dist2d(father.pos, v3(10.6, 0, 5.75)) < 0.3) { S.fatherToAlarm = false; fatherKillsAlarm(); }
  if (S.alarmOn) { lights[9].intensity = (Math.floor(S.t * 4) % 2) ? 1.6 : 0.2; refs.detectorLed.material.uniforms.uColor.value.set((Math.floor(S.t * 4) % 2) ? 1 : 0.2, 0, 0); }

  // chapter 6: the power goes as soon as you are back under the roof
  if (S.pendingCut) { S.cutWait = (S.outside || inBasement()) ? 0 : (S.cutWait || 0) + dt; if (S.cutWait > 2.5) powerCut(); }
  if (S.lilyGone && !S.escort && roomAt(dog.pos.x, dog.pos.z, dog.y) === 'lily' && once('emptyBed')) ui.card('Her bed is empty', 'The blanket is still warm. Her smell goes out of the door and away down the hall.');
  if (S.lilyGone && !S.escort && !S.lilyDazed && inBasement() && dist2d(dog.pos, lily.pos) < 2.8 && once('lilyFound')) lilyFound();
  if (S.power === false) for (const i of [0, 1, 2, 3, 4, 6, 8, 10, 13]) if (lights[i]) lights[i].on = false;
  // middle of the night
  // the first time you go down into the basement, something down there is singing
  if (inBasement() && S.coOn && once('basementLullaby')) { AU.lullaby(() => [9.5, BASE_Y + 1.2, -2.5], 0.8, 0.75); AU.groan(9, -1, -1, 0.7); }
  // lying down for the first time, near a bed: something is under it, looking back
  if (dog.lying > 0.5 && !S.wasLying) { const r = roomAt(dog.pos.x, dog.pos.z, dog.y); if (r === 'parents' || r === 'lily') dreadOnce('eyes'); if (dist2d(dog.pos, spots.dogBed) < 0.7 && S.coOn) dreadOnce('ball'); }
  S.wasLying = dog.lying > 0.5;
  // landing on the kitchen counter for the first time: the phone rings, once
  if (dog.surface && dog.surface.name === 'the counter' && S.coOn) dreadOnce('phone');
  if (co > 0.9 && S.ch < 10) for (const h of [father, mother, lily]) if (!S.alarmOn && !S.finalFollow) h.unconscious = true;
  if (co > 0.92 && lily.pose === 'sit' && !S.alarmDone && once('lilyFaints')) { lily.setActivity({ spot: spots.lilyBed.clone(), pose: 'sleep', face: 0 }); }
  if (co >= 1 && !S.ended && !S.cut) endByTime();

  if (S.ch === 9 && S.furnaceMaw && !S.other && inBasement() && dist2d(dog.pos, spots.furnace) < 1.2 && once('intoFurnace')) intoFurnace();
  if (S.ch === 10 && S.wakeList) {
    S.wlRepath = (S.wlRepath || 0) - dt;
    for (const [i, h] of S.wakeList.entries()) {
      if (S.wlRepath <= 0) {
        if (S.outside || (inBasement() && h.pos.y > -1)) h.path = [];
        else if (dist2d(h.pos, dog.pos) > 1.3 + i * 0.5) h.goTo(v3(dog.pos.x, dog.y < -1 ? BASE_Y : 0, dog.pos.z));
        else h.path = [];
      }
      h.look(dogHead(), 1, S.t);
    }
    if (S.wlRepath <= 0) S.wlRepath = 1.2;
    if (S.wakeList.length >= 3 && dist2d(dog.pos, spots.frontDoor) < 1.8 && S.wakeList.every((h) => dist2d(h.pos, spots.frontDoor) < 4) && once('outTogether')) {
      for (const h of S.wakeList) h.path = [];
      doors.front.target = 1.6; doors.front.speed = 2; AU.creak(1.5, 1, 10, 1); S.windBoost = 0.7;
      say(F.father, 'Out. Everybody out. Cold air. Breathe. Good boy, Biscuit. Good boy.', 'sharp');
      later(4.5, () => finish('home'));
    }
  }
  // the finale: leading him out
  if (S.finalFollow) {
    father.speed = 1.0;
    S.ffRepath = (S.ffRepath || 0) - dt;
    if (S.ffRepath <= 0) {
      S.ffRepath = 1.5;
      if (S.outside || inBasement()) father.path = [];
      else if (dist2d(father.pos, dog.pos) > 1.3) { const tgt = v3(dog.pos.x, 0, dog.pos.z); father.goTo(tgt); }
      else father.path = [];
    }
    father.look(dogHead(), 1, S.t);
    if (dist2d(father.pos, spots.frontDoor) < 2.3 && dist2d(dog.pos, spots.frontDoor) < 1.6 && once('frontDoor')) {
      S.finalFollow = false; S.cut = 'home';
      father.path = []; father.yaw = Math.PI; father.pose = 'stand';
      doors.front.target = 1.6; doors.front.speed = 2; AU.creak(1.5, 1, 10, 1); S.windBoost = 0.7;
      say(father, 'Air. Cold air. Biscuit, stay. Stay right here. I am getting them. CLAIRE!', 'sharp');
      later(5, () => finish('home'));
    }
  }
}

// ---------------------------------------------------------------------------
// Doors you can push open just by walking into them (and that open for the family too)
const PUSH_OPEN = { parents: 1.4, lily: 1.2, laundry: 1.5, basement: 0.95, danny: 1.35 };
function updatePushDoors() {
  for (const [name, open] of Object.entries(PUSH_OPEN)) {
    const d = doors[name];
    if (d.locked || (name === 'laundry' && S.locked) || (name === 'basement' && puzzle.latched)) continue;
    if (d.angle > 0.5 || d.target > 0.5) continue;
    const at = (p, reach) => Math.abs(p.z - d.hingeZ) < reach && p.x > d.hingeX - 0.1 && p.x < d.hingeX + d.width + 0.1;
    const dogPush = dog.moving && dog.y > -0.3 && at(dog.pos, 0.45);
    const human = [F.father, F.mother, F.lily].some((h) => h.path.length && Math.abs(h.pos.y) < 0.3 && at(h.pos, 0.9));
    if (!dogPush && !human) continue;
    d.target = open; d.speed = dogPush ? 1.6 : 1.2;
    AU.creak(d.hingeX + d.width / 2, 1, d.hingeZ, 1.0, 0.6);
    if (dogPush) { act('nudge'); if (S.coOn) later(3, () => dreadOnce('doorDrift')); }
  }
}

// ---------------------------------------------------------------------------
// Scares and guidance that depend on where Biscuit is
function scares(dt) {
  const { danny } = F;
  const room = roomAt(dog.pos.x, dog.pos.z, dog.y);
  const fwd = dogForward();


  if (S.dannyLightOn) {
    S.dannyStepT = (S.dannyStepT || 0) - dt;
    if (S.dannyStepT <= 0) { S.dannyStepT = 2.5 + Math.random() * 3; AU.step('heavy', 9.4 + Math.random(), 0.1, 2.0, 0.3); }
    if (dist2d(dog.pos, v3(9.45, 0, 3.6)) < 1.4 && once('dannyWhisper')) {
      S.dannyLightOn = false; refs.dannyDoorLight.visible = false;
      later(1.5, () => { F.danny.pos.set(9.45, 0, 2.5); say(F.danny, 'Biscuit. It is okay. It is me. Come find me.', 'whisper'); });
    }
  }
  // Danny at the basement door, beckoning you down
  if (!puzzle.latched && room === 'hall' && !S.ghostState && !S.fired.has('hallGhost') && dog.pos.x < 10) {
    const to = v3(13.3 - dog.pos.x, 0, 3.9 - dog.pos.z).normalize();
    if (fwd.dot(to) > 0.88) {
      S.fired.add('hallGhost');
      S.ghostState = { kind: 'hall', t: 0 };
      danny.visible = true; danny.setPos(13.3, 4.1); danny.yaw = -Math.PI / 2; danny.pose = 'stand';
      danny.look(dogHead(), 3, S.t);
      AU.ventVoice(13.3, 1, 3.5);
    }
  }
  if (inBasement() && dog.pos.z < 1.2 && dog.y < -2.3 && once('basementGhost')) {
    lights[4].on = true; lights[4].flicker = 0.5;
    S.ghostState = { kind: 'boxes', t: 0 };
    danny.visible = true; danny.setPos(12.0, -2.2, BASE_Y); danny.yaw = 0.6; danny.pose = 'stand';
    danny.look(dogHead(), 6, S.t);
    checkBasement();
  }
  if (S.ghostState) {
    const g = S.ghostState; g.t += dt;
    if (g.kind === 'hall') {
      if (g.t > 2.5 && !g.walking) { g.walking = true; danny.path = [v3(13.3, 0, 3.3), v3(13.3, 0, 2.6)]; danny.speed = 0.7; }
      if (danny.pos.z < 3.4) danny.pos.y = floorAt(danny.pos.x, danny.pos.z, 0);
      if (g.t > 7 || dist2d(dog.pos, danny.pos) < 2.6) { danny.visible = false; S.ghostState = null; }
    } else if (g.kind === 'boxes') {
      // he looks at you, then at his box, then fades
      if (g.t > 2.5) danny.look(v3(12.4, BASE_Y + 0.5, -3.4), 10, S.t);
      if (dist2d(dog.pos, danny.pos) < 2.0 || g.t > 25) { danny.visible = false; S.ghostState = null; lights[4].flicker = 0.2; }
    } else if (g.kind === 'flap') {
      if (dist2d(dog.pos, danny.pos) < 1.7 || g.t > 40) { danny.visible = false; S.ghostState = null; }
    } else if (g.kind === 'field') {
      if (!danny.path.length || g.t > 12) { danny.visible = false; S.ghostState = null; }
    } else if (g.kind === 'drawer') {
      if (dist2d(dog.pos, danny.pos) < 1.6 || g.t > 30) { danny.visible = false; S.ghostState = null; }
    }
  }
  // the furnace
  refs.grilleMat.uniforms.map.value = S.dogCO > 0.55 || S.presenceActive || S.furnaceMaw ? T.grilleTeeth : T.grille;
  const br = 0.6 + 0.4 * Math.sin(S.t * (0.5 + S.co * 0.6));
  refs.grilleMat.uniforms.uColor.value.setScalar(S.furnaceMaw ? 1.4 + br * 0.6 : S.coOn ? 0.5 + br * 0.6 : 0.1);
  if (S.furnaceMaw && inBasement() && Math.random() < 0.3) emit(spots.furnace.x + (Math.random() - 0.5) * 0.5, BASE_Y + 0.4 + Math.random() * 0.4, spots.furnace.z, 'wrong', { spread: 0.3, life: 2, vz: 0.3, size: 0.05 });
  lights[5].intensity = S.coOn ? (0.6 + br * 0.8) * (0.7 + S.co) : 0;
  const sc = 1 + (S.coOn ? br * 0.015 * (1 + S.co * 2) : 0);
  refs.furnace.scale.set(sc, 1 + (sc - 1) * 0.5, sc);
}

// ---------------------------------------------------------------------------
// The thing from the furnace
function wakePresence() {
  if (S.presenceActive || S.presenceSleep > 0) { if (S.presenceSleep > 0) S.presenceActive = true; return; }
  AU.stinger(1);
  later(0.3, () => AU.whoomp(spots.furnace.x, BASE_Y + 1, spots.furnace.z));
  lights[4].flicker = 1;
  later(1.2, () => {
    if (S.monsterTest) lights[4].flicker = 0.7; else lights[4].on = false;
    S.presenceActive = true; S.metThing = true; S.presence.setPos(spots.furnace.x, spots.furnace.z, BASE_Y);
    if (!S.monsterTest && once('presenceCard')) ui.card('It is not Danny.', 'Danny smelled of snow and pencils. This smells of the hot box, of the bad air that has been filling the house. It has no shape. Your poisoned head is giving it one. RUN. Up the stairs.');
  });
}
// Upstairs, once the lights are out, it walks the dark rooms looking for you.
const STALK_NODES = [[1.5, 7.6], [1.95, 4.25], [5.9, 4.25], [9.45, 4.25], [11.45, 4.25], [13.0, 4.25], [6, 6.2], [4.4, 8.6], [8.0, 8.4], [9.7, 8.6], [12.8, 8.6], [12.8, 5.8], [2.9, 2.6], [6.3, 2.5], [11.45, 2.3], [3.6, 6.0]];
// it comes once for each of these: taking Danny's flashlight in the dark, and carrying his jacket up
function summonHunt(why) {
  if (!once('hunt_' + why) || !S.stalk) return;
  later(2.5, () => { S.stalk.state = 'away'; S.stalk.t = 0; S.stalk.pending = true; });
}
function dogHidden(d) {
  if (dog.lying < 0.5 || dog.moving || (puzzle.flashlight.carried && S.flashOn)) return false;
  const x = dog.pos.x, z = dog.pos.z;
  const under = (x > 10.4 && x < 12.1 && z > 6.5 && z < 7.7) || (x > 0.3 && x < 2.62 && z < 2.6) || (x > 6.45 && x < 7.95 && z < 2.4);
  return under ? d > 0.8 : d > 1.7;
}
function updateStalker(dt) {
  const p = S.presence, K = S.stalk;
  if (!S.stalkOn || !K || S.cut || S.finalFollow || S.alarmOn || S.ended || S.escortUp) { if (!(S.glimpse > 0) && !(S.jumpscare > 0)) p.root.visible = false; if (K && K.state !== 'away') { K.state = 'away'; K.t = 1e9; } return; }
  K.t -= dt;
  const dogIn = !S.outside && !inBasement() && dog.y > -0.3;
  if (K.state === 'away') {
    if (!(S.glimpse > 0) && !(S.jumpscare > 0)) p.root.visible = false;
    p.visible = false;
    if (K.t <= 0 && K.pending) {
      K.t = 3;
      if (!dogIn) return;
      const fwd = dogForward();
      const myRoom = roomAt(dog.pos.x, dog.pos.z, dog.y);
      const opts = STALK_NODES.filter(([x, z]) => { const dx = x - dog.pos.x, dz = z - dog.pos.z, d = Math.hypot(dx, dz); return d > 4.5 && d < 12 && ((dx * fwd.x + dz * fwd.z) / d < 0.2 || roomAt(x, z, 0) !== myRoom); });
      if (!opts.length) return;
      const [x, z] = opts[Math.floor(Math.random() * opts.length)];
      p.setPos(x, z, 0); p.path = []; p.arrived = null;
      K.state = 'roam'; K.t = 45 + Math.random() * 35; K.re = 0; K.pending = false;
      AU.knock(x, 0.2, z, 2, 0.5); // something under the floor, coming up
    }
    return;
  }
  p.visible = true;
  p.root.visible = Math.random() > 0.05;
  const d = dist2d(p.pos, dog.pos);
  const pr = roomAt(p.pos.x, p.pos.z, 0), dr = roomAt(dog.pos.x, dog.pos.z, dog.y);
  const sees = dogIn && !dogHidden(d) && (d < 3.2 || (d < 8 && pr === dr));
  if (K.state === 'roam') {
    p.speed = 0.75;
    if (!p.path.length) {
      // it drifts toward wherever you are, room by room
      const near = STALK_NODES.filter(([x, z]) => Math.hypot(x - dog.pos.x, z - dog.pos.z) < 6.5);
      const [x, z] = near.length && Math.random() < 0.7 ? near[Math.floor(Math.random() * near.length)] : STALK_NODES[Math.floor(Math.random() * STALK_NODES.length)];
      p.goTo(v3(x, 0, z));
    }
    if (sees) { S.metThing = true; K.state = 'hunt'; K.lost = 0; K.re = 0; AU.stinger(0.8); scared(1); AU.whoomp(p.pos.x, 1.2, p.pos.z); }
    if (K.t <= 0 && !sees) { K.state = 'away'; K.t = 1e9; }
  } else if (K.state === 'hunt') {
    p.speed = 1.35 + S.co * 0.9;
    K.re -= dt;
    if (K.re <= 0) { K.re = 0.6; p.goTo(v3(dog.pos.x, 0, dog.pos.z)); }
    K.lost = sees ? 0 : K.lost + dt;
    if (K.lost > 4 && dogIn && dogHidden(d)) ach('hide');
    if (K.lost > 4 || !dogIn) { K.state = 'roam'; K.t = 14; p.path = []; if (!dogIn) { K.state = 'away'; K.t = 1e9; } }
    if (d < 0.75 && dogIn) caughtUpstairs();
  }
  p.update(dt, S.t, 0, dog.pos);
  p.pos.y = 0; p.root.position.y = 0;
  p.monster.update(S.t, dt, K.state === 'hunt' ? 'hunt' : p.moving ? 'walk' : 'idle');
  for (let i = 0; i < 2; i++) emit(p.pos.x, 0.5 + Math.random() * 1.8, p.pos.z, 'wrong', { spread: 0.5, life: 2, size: 0.06 });
  S.breathT = (S.breathT || 0) - dt;
  if (S.breathT <= 0 && d < 9) { S.breathT = 2.6; AU.breathing(p.pos.x, 1.9, p.pos.z, 1 - d / 10); }
  S.stalkNear = d < 7 ? 1 - d / 7 : 0;
}
function caughtUpstairs() {
  S.jumpscare = 1.2; dog.frozen = true;
  AU.scream();
  const K = S.stalk; K.state = 'away'; K.t = 1e9;
  later(1.1, () => {
    S.blackout = 2.8;
    if (dog.carrying) dropItem(dog.carrying, true);
    releaseStool();
    S.coAcc += 45 / CO_DUR;
    caughtCount();
  });
  later(3.6, () => { if (!S.cut && !S.ended) dog.frozen = false; });
}
function caughtCount() {
  S.catches = (S.catches || 0) + 1;
  if (S.catches >= 3) { S.cut = 'dark'; later(1.5, () => finish('dark')); return; }
  later(5, () => { if (!S.ended) ach('caught'); });
  later(3, () => ui.card(S.catches === 1 ? 'You wake up on the floor' : 'Again', S.catches === 1
    ? 'Your head is pounding. You do not know how long you were gone. The air is thicker than it was. It is still in the house.'
    : 'Longer, this time. It was harder to come back. You know, the way animals know things, that if it takes you again you will not wake up.'));
}
// barking scatters it, like smoke. But not twice in a row.
function barkRepel() {
  const p = S.presence, fwd = dogForward();
  const near = (S.presenceActive || (S.stalk && S.stalk.state !== 'away')) && p.root.visible !== undefined && p.visible;
  if (!near) return false;
  const dx = p.pos.x - dog.pos.x, dz = p.pos.z - dog.pos.z, d = Math.hypot(dx, dz);
  if (d > 4.5 || Math.abs(p.pos.y - dog.y) > 1.2 || (dx * fwd.x + dz * fwd.z) / d < 0.45) return false;
  if (S.t < (S.repelCD || 0)) { if (once('rawThroat')) showSubtitle('note', '<span class="note">(Your throat is raw. It does not work twice so fast.)</span>', 3); return false; }
  S.repelCD = S.t + 25;
  AU.stinger(0.5);
  for (let i = 0; i < 40; i++) emit(p.pos.x, p.pos.y + Math.random() * 2.2, p.pos.z, 'wrong', { spread: 1.2, life: 1.5, size: 0.07, vy: 0.4 });
  ach('smoke');
  if (S.presenceActive) S.presenceSleep = 12;
  else { S.stalk.state = 'away'; S.stalk.t = 1e9; }
  p.root.visible = false; p.visible = false;
  if (once('repelNote')) showSubtitle('note', '<span class="note">(It comes apart when you bark at it, like smoke. It is not gone. It will come back.)</span>', 3.5);
  return true;
}
// straight to the basement, with it: for meeting the thing (title screen button)
function monsterRoom() {
  S.monsterTest = true;
  puzzle.latched = false; refs.hook.rotation.z = 1.2; doors.basement.target = 0.95;
  dog.pos.set(11.6, BASE_Y, -2.4); dog.y = BASE_Y; dog.yaw = Math.atan2(4, -1.3); dog.pitch = 0.12;
  S.fade = 0; S.fadeV = 0.6;
  setObj('It is down here with you. Run up the stairs, hide (hold C), or bark it apart (B).');
  later(2.5, wakePresence);
}
function updatePresence(dt) {
  const p = S.presence;
  // in the basement test, it comes back every time you go back down
  if (S.monsterTest && !S.presenceActive && !S.ended && inBasement() && dog.y < -1 && !S.reWake) { S.reWake = true; later(2.5, () => { S.reWake = false; if (inBasement() && dog.y < -1 && !S.presenceActive) wakePresence(); }); }
  if (S.monsterPreview) { // testing / preview aid: hold it still where we put it
    const M = S.monsterPreview;
    p.setPos(M.x, M.z, M.y); p.yaw = M.yaw; p.visible = true; p.path = [];
    p.update(dt, S.t, 0, dog.pos); p.root.position.y = M.y; p.root.rotation.set(0, M.yaw, 0);
    p.monster.update(S.t, dt, M.mode); p.root.visible = true; return;
  }
  if (!S.presenceActive) { updateStalker(dt); return; }
  if (S.presenceSleep > 0) { S.presenceSleep -= dt; p.root.visible = false; return; }
  p.visible = true;
  const target = dog.pos;
  const d = Math.hypot(target.x - p.pos.x, target.z - p.pos.z);
  p.speed = 1.5 + S.co * 1.2;
  p.path = [v3(target.x, 0, target.z)];
  p.update(dt, S.t, 0, dog.pos);
  p.pos.y = floorAt(p.pos.x, p.pos.z, p.pos.y);
  p.root.position.y = p.pos.y;
  p.monster.update(S.t, dt, 'hunt');
  p.root.visible = Math.random() > 0.06;
  for (let i = 0; i < 3; i++) emit(p.pos.x, p.pos.y + 0.6 + Math.random() * 1.6, p.pos.z, 'wrong', { spread: 0.5, life: 1.5, size: 0.06 });
  if (!inBasement() || dog.y > -0.25) { S.presenceActive = false; p.root.visible = false; AU.stinger(0.4); if (S.stalk) { S.stalk.state = 'away'; S.stalk.t = 1e9; } return; }
  if (d < 0.75) caught();
}
function caught() {
  S.jumpscare = 1.2;
  dog.frozen = true;
  later(3.2, () => { if (!S.cut) dog.frozen = false; });
  AU.scream();
  const p = S.presence;
  S.presenceSleep = 7;
  later(1.1, () => {
    S.blackout = 2.2;
    const it = dog.carrying;
    if (it) dropItem(it, true);
    for (const x of [puzzle.jacket, puzzle.tag]) if (!x.carried && x.mesh.position.y < -1) { x.mesh.position.copy(x === puzzle.tag ? v3(10.5, BASE_Y + 0.02, -3.05) : x.home); x.mesh.rotation.set(0, 0.3, 0); }
    dog.pos.set(12.0, BASE_Y, -1.8); dog.y = BASE_Y; dog.yaw = Math.PI * 0.8;
    if (S.escort || S.lilyDazed) { F.lily.path = []; F.lily.setPos(12.5, -2.3, BASE_Y); }
    p.pos.set(spots.furnace.x, BASE_Y, spots.furnace.z);
    S.coAcc += 20 / CO_DUR; // it costs you
    caughtCount();
  });
}

function unlockLaundry() {
  doors.laundry.target = 1.5; S.locked = false;
  AU.creak(11.45, 1, 3.5, 1);
  if (S.nightPos) {
    lights[6].pos.copy(S.nightPos); lights[6].color.set(0xff90b0); lights[6].range = 2.8;
    G.uLightMin.value[6].set(4.5, -0.1, 0); G.uLightMax.value[6].set(8, 3, 3.5);
  }
}

// ---------------------------------------------------------------------------
// Barking, whining, tugging, biting
export function onBark() {
  if (S.ended || S.cut || S.inspectOpen) return;
  AU.bark(1); dog.barkKick = 1;
  S.barks = (S.barks || 0) + 1; if (S.barks >= 50) ach('speak');
  if (S.other) return;
  if (S.ch === 10) for (const h of [F.father, F.mother, F.lily]) if (h.unconscious && sameFloor(h) && dist2d(h.pos, dog.pos) < 3.2) wakeFinal(h);
  if (S.outside) { const f = dogForward(); breath(dog.pos.x, dog.y + 0.33, dog.pos.z, f.x, f.z, 2); }
  const { father, mother, lily } = F;
  if (S.lilyDazed && dist2d(lily.pos, dog.pos) < 3.8 && Math.abs(lily.pos.y - dog.y) < 1) { lilyWakesUp(); return; }
  if (!puzzle.latched && dist2d(dog.pos, v3(13.4, 0, 3.5)) < 2.5 && !inBasement()) dreadOnce('whisper');
  if (barkRepel()) return;
  if (inBasement()) { if (S.coOn) later(0.9, () => AU.whoomp(spots.furnace.x, BASE_Y + 1, spots.furnace.z)); return; }
  for (const h of [father, mother, lily]) {
    if (!sameFloor(h)) continue;
    const d = dist2d(h.pos, dog.pos);
    if (h.asleep && !(S.t < h.awakeUntil)) { if (d < 2.6) wake(h); continue; }
    if (d > 7.5) continue;
    h.look(dogHead(), 4, S.t);
    h.annoy = (h.annoy || 0) + 1;
    if (h.annoy >= 3) { h.annoy = 0; scold(h); }
    else if (h.annoy === 1) {
      const lines = h === lily ? ['Biscuit? What is it? What do you see?', 'Shh, Biscuit. Shh.'] : ['Biscuit. Hey. Quiet.', 'What is it, buddy? There is nothing there.', 'Quiet, Biscuit.'];
      say(h, lines[Math.floor(Math.random() * lines.length)], 'calm', { force: false, cooldown: 2 });
    }
  }
}
function wake(h) {
  act('nudge');
  if (S.ch === 10 && h.unconscious) { wakeFinal(h); return; }
  if (h === F.father && S.deep && h.pose === 'sleep' && S.ch < 8) dreadOnce('sleepwalk');
  if (h.unconscious || (S.deep && h !== F.lily)) {
    if (S.t - (h.lastNoWake || 0) > 6) {
      h.lastNoWake = S.t;
      showSubtitle('note', `<span class="note">(${h === F.father ? 'he' : 'she'} does not wake up. The air in here is too heavy. Something louder than you has to wake them.)</span>`, 3.5);
      AU.stinger(0.25);
    }
    return;
  }
  h.awakeUntil = S.t + 25;
  h.look(dogHead(), 6, S.t);
  if (h.pose === 'slump') h.pose = 'sit';
  const lines = h === F.lily ? ['Biscuit? Is it morning?', 'Mm. Biscuit. Go to sleep.'] : ['Mm... Biscuit... go lie down. Go to bed.', 'What... what time is it... Biscuit, no.'];
  say(h, lines[Math.floor(Math.random() * lines.length)], 'sleepy');
}
function scold(h) {
  S.strikes++;
  const lines = S.strikes >= 3 ? ['That is IT. I swear to God, Biscuit.'] : ['Biscuit! NO! Quiet!', 'What is wrong with you tonight? Bad dog.', 'Enough! Go lie down. Bed!'];
  say(h, lines[Math.floor(Math.random() * lines.length)], 'sharp');
  if (S.strikes >= 3 && awake(F.father) && !S.deep && !S.locked) later(1.5, lockUp);
}
function lockUp() {
  if (S.locked || S.ended || S.cut) return;
  const f = F.father;
  say(f, 'That is it. Laundry room. You can bark in there all night.', 'sharp');
  S.fade = 1; S.fadeSpeed = 1.5;
  dog.frozen = true;
  later(1.4, () => {
    if (dog.carrying) dropItem(dog.carrying, true);
    releaseStool();
    dog.pos.set(11.45, 0, 1.9); dog.y = 0; dog.yaw = Math.PI;
    doors.laundry.target = 0; doors.laundry.angle = 0.0001; doors.laundry.pivot.rotation.y = doors.laundry.base; doors.laundry.setCollider();
    S.locked = true; S.strikes = 0; S.scratches = 0;
    S.nightPos = lights[6].pos.clone();
    lights[6].pos.set(11.45, 2.3, 1.6); lights[6].color.set(0xc8b890); lights[6].range = 4.5;
    G.uLightMin.value[6].set(10.5, -0.1, 0); G.uLightMax.value[6].set(12.5, 3, 3.5);
    AU.knock(11.45, 1, 3.5, 1, 1.2);
    f.pos.set(11.45, 0, 4.2);
    if (f.activity) f.setActivity(f.activity);
  });
  later(2.6, () => { S.fade = 0; dog.frozen = false; });
}
export function onSit() {
  if (S.ended || S.cut || S.inspectOpen || S.other) return;
  if (S.wantSit && dist2d(S.wantSit.pos, dog.pos) < 2.6) { feedBiscuit(S.wantSit); return; }
  const h = [F.father, F.mother, F.lily].find((x) => awake(x) && !x.asleep && sameFloor(x) && dist2d(x.pos, dog.pos) < 2.6);
  if (!h || S.t - (h.lastSit || -99) < 15) return;
  h.lastSit = S.t; h.look(dogHead(), 4, S.t);
  S.strikes = Math.max(0, S.strikes - 1); h.annoy = 0;
  const lines = h === F.lily ? ['You sat! Good boy! I do not have a treat. Sorry.', 'Biscuit, you are so polite.'] : h === F.father ? ['Good boy. Good sit. He taught you that.', 'Yeah. Good boy.'] : ['Good boy. You are such a good boy.', 'You always sit for Danny\'s chair, you know that?'];
  say(h, lines[Math.floor(Math.random() * lines.length)], 'calm', { force: false, cooldown: 4 });
  petDog(h); ach('pets', h.name);
}
export function onWag() {
  if (S.ended || S.cut || S.inspectOpen) return;
  AU.wagSwish();
  if (S.other) return;
  if (S.coOn) dreadOnce('stare');
  { const p = S.presence; if (p.visible && p.root.visible && dist2d(p.pos, dog.pos) < 7 && Math.abs(p.pos.y - dog.y) < 1.5) ach('wagthing'); }
  const h = [F.father, F.mother, F.lily].find((x) => awake(x) && !x.asleep && sameFloor(x) && dist2d(x.pos, dog.pos) < 3);
  if (!h || S.t - (h.lastWag || -99) < 15) return;
  h.lastWag = S.t; h.look(dogHead(), 3, S.t);
  S.strikes = Math.max(0, S.strikes - 1); h.annoy = 0;
  const lines = h === F.lily ? ['Your tail! Ha! Your whole butt is wagging!', 'Are you happy? I am happy too. A little.'] : h === F.father ? ['Hey, bud. Hey. At least somebody is happy.', 'What are you so happy about?'] : ['Oh, look at that tail. Hi, sweetheart.', 'Hi. Hi, Biscuit. I know.'];
  say(h, lines[Math.floor(Math.random() * lines.length)], 'calm', { force: false, cooldown: 4 });
  petDog(h); ach('pets', h.name);
}
export function onWhine() {
  if (S.ended || S.cut || S.inspectOpen) return;
  AU.whine(); act('whine');
  if (S.other) return;
  for (const h of [F.father, F.mother, F.lily]) {
    if (!awake(h) || !sameFloor(h) || dist2d(h.pos, dog.pos) > 2.8) continue;
    if (S.t - (h.lastComfort || -99) < 10) continue;
    h.lastComfort = S.t;
    h.look(dogHead(), 5, S.t);
    S.strikes = Math.max(0, S.strikes - 1); h.annoy = 0;
    const lines = h === F.lily ? ['Are you scared too? Me too. It is okay. Good boy.', 'I love you, Biscuit.']
      : ['Hey buddy. Hey. It is okay. Good boy.', 'You are shaking. What is the matter with you tonight?', 'I know. I miss him too, bud.'];
    say(h, lines[Math.floor(Math.random() * lines.length)], 'calm');
    return;
  }
}

// ---------------------------------------------------------------------------
// Interaction: look, take, drop, push, pull, tug, scratch
function nearestHuman(maxD) {
  let best = null, bd = maxD;
  for (const h of [F.father, F.mother, F.lily]) {
    if (!sameFloor(h)) continue;
    const hp = h.pose === 'sleep' ? v3(h.pos.x, 0, h.pos.z) : h.pos;
    const d = dist2d(hp, dog.pos) - (h.pose === 'sleep' ? 0.6 : 0);
    if (d < bd) { bd = d; best = h; }
  }
  return best;
}
function nearestItem(maxD) {
  let best = null, bd = maxD;
  const fwd = dogForward();
  for (const it of items) {
    if (it.carried || it.gone || !it.mesh.visible) continue;
    const p = it.mesh.position;
    if (Math.abs(p.y - dog.y) > 0.8) continue;
    if (it.under) {
      // under furniture: only lying flat, with a paw stretched in
      const d = dist2d(p, dog.pos);
      if (dog.lying > 0.5 && d < 1.1 && (!best || d < bd)) { bd = d; best = it; }
      continue;
    }
    const to = v3(p.x - dog.pos.x, 0, p.z - dog.pos.z); const d = to.length();
    if (d < bd && (d < 0.35 || fwd.dot(to.normalize()) > 0.3)) { bd = d; best = it; }
  }
  return best;
}
function inspectPos(def) {
  if (def.item) { const p = new THREE.Vector3(); def.item.mesh.getWorldPosition(p); return p; }
  return def.pos;
}
function nearestInspect() {
  const fwd = dogForward();
  let best = null, bd = 1e9;
  for (const def of inspectables) {
    if (def.needs && !def.needs()) continue;
    if (def.item && (def.item.gone || def.item.carried || !def.item.mesh.visible || def.read)) continue;
    const p = inspectPos(def);
    if (Math.abs(p.y - dog.y) > 2.2) continue;
    const ref = def.dogPos || p;
    const d = dist2d(ref, dog.pos);
    if (d > def.reach) continue;
    const to = v3(p.x - dog.pos.x, 0, p.z - dog.pos.z).normalize();
    if (fwd.dot(to) < 0.25 && d > 0.4) continue;
    if (d < bd) { bd = d; best = def; }
  }
  return best;
}
function nearestDoor() {
  for (const [name, x, z] of [['laundry', 11.45, 3.5], ['danny', 9.45, 3.5], ['front', 1.5, 10.0], ['basement', 13.4, 3.5]]) {
    const d = doors[name];
    if (Math.abs(d.angle) > 0.3) continue;
    if (dist2d(dog.pos, v3(x, 0, z)) < 0.85) return name;
  }
  return null;
}
const nearStool = () => !inBasement() && dist2d(dog.pos, puzzle.stool.mesh.position) < 0.75;
const nearRope = () => inBasement() && !puzzle.drawerOpen && dist2d(dog.pos, spots.drawerPull) < 0.75;
const nearJar = () => !puzzle.jarFallen && dog.surface && dog.surface.name === 'the counter' && dist2d(dog.pos, spots.jar) < 0.75;
function knockJar() {
  puzzle.jarFallen = true;
  act('nudge');
  ach('jar');
  S.jarFall = { t: 0, x0: refs.jar.position.x, z0: refs.jar.position.z };
  later(0.55, () => {
    AU.crash(13.2, 0.1, 7.55);
    refs.jar.visible = false;
    for (let i = 0; i < 7; i++) { const sh = refs.jar.clone(); sh.visible = true; sh.scale.set(0.35 + Math.random() * 0.3, 0.12, 0.35 + Math.random() * 0.3); sh.position.set(13.05 + (Math.random() - 0.5) * 0.6, 0.01, 7.55 + (Math.random() - 0.5) * 0.6); sh.rotation.y = Math.random() * 3; scene.add(sh); }
    if (puzzle.keyInJar) { puzzle.keyInJar = false; const k = puzzle.key; k.gone = false; k.mesh.visible = true; k.mesh.position.set(12.95, 0.02, 7.7); }
    const f = F.father;
    if (awake(f) && !S.deep && sameFloor(f)) { say(f, 'BISCUIT! What did you break? Get DOWN off the counter!', 'sharp'); S.strikes++; }
  });
}
const nearCover = () => !yard.flapOpen && dist2d(dog.pos, v3(13.62, 0, 4.25)) < 0.55;
const nearFullBowl = () => puzzle.bowl.full && !puzzle.bowl.carried && dist2d(dog.pos, puzzle.bowl.mesh.position) < 0.7;

export function onInteract() {
  if (S.other) { otherInteract(); return; }
  if (S.inspectOpen) { closeInspect(); return; }
  if (S.ended || S.cut || dog.frozen) return;
  if (puzzle.stool.dragging) { releaseStool(); return; }
  if (dog.carrying) { dropItem(dog.carrying); return; }
  if (nearFullBowl()) { eatDinner(); return; }
  // unread things first, then things to carry, then re-reading
  const ins = nearestInspect();
  if (ins && !ins.read) { openInspect(ins); return; }
  const it = nearestItem(0.85);
  if (it && !(it === puzzle.bowl && it.full)) { pickItem(it); return; }
  if (ins && !ins.item) { openInspect(ins); return; }
  if (nearRope()) { act('pull'); pullDrawer(); return; }
  if (nearCover()) { pullCover(); return; }
  if (nearJar()) { knockJar(); return; }
  if (nearStool()) { grabStool(); return; }
  const h = nearestHuman(1.3);
  if (h) { tug(h); return; }
  const dn = nearestDoor();
  if (dn) { scratchDoor(dn); return; }
}

function openInspect(def) {
  S.inspectOpen = def; def.read = true;
  if (def.id.startsWith('photo') && inspectables.filter((d) => d.id.startsWith('photo')).every((d) => d.read)) ach('photos');
  dog.frozen = true;
  AU.paper(dog.pos.x, dog.y + 0.5, dog.pos.z);
  ui.inspect(def);
}
export function closeInspect() {
  const def = S.inspectOpen;
  if (!def) return;
  S.inspectOpen = null; dog.frozen = false;
  ui.closeInspect();
  if (def.id === 'notebook') readNotebook();
  later(0.6, () => learnSight(def.id));
  if (def.id.startsWith('photo_') && S.power === false && once('wrongPhotos')) later(0.3, () => { refs.photoWrong(); AU.stinger(0.5); scared(0.6); showSubtitle('note', '<span class="note">(Behind you, along the hall, every face in every frame has changed.)</span>', 3.5); });
  if (def.id === 'letter') later(1.5, () => dreadOnce('callFromDark'));
  if (def.id === 'notebook') later(1.0, () => dreadOnce('knockUnder'));
  if (def.id === 'clipping') readClipping();
  if (def.id === 'letter' && once('letterLearn')) learn('room', 'Her letter. Biscuit cannot read it, but he knows her voice when she reads to herself.');
}

function grabStool() {
  const st = puzzle.stool;
  st.dragging = true; puzzle.setStoolCol(); act('nudge');
  later(1.2, () => dreadOnce('flicker'));
  AU.scoot(st.mesh.position.x, 0.2, st.mesh.position.z);
}
function releaseStool() {
  const st = puzzle.stool;
  if (!st.dragging) return;
  st.dragging = false; puzzle.setStoolCol(); dog.pushing = false;
  AU.knock(st.mesh.position.x, 0.1, st.mesh.position.z, 1, 0.4);
}
function updateStool() {
  const st = puzzle.stool;
  dog.pushing = st.dragging;
  if (!st.dragging) return;
  if (inBasement() || dog.y < -0.2 || S.outside) { releaseStool(); return; }
  const f = dogForward();
  const p = v3(dog.pos.x + f.x * 0.5, 0, dog.pos.z + f.z * 0.5);
  collide(p, 0.18, 0, 0.35);
  st.mesh.position.set(p.x, 0, p.z);
  st.mesh.rotation.y = dog.yaw;
  S.stoolScrape = (S.stoolScrape || 0) - 1 / 60;
  if (dog.moving && S.stoolScrape <= 0) { S.stoolScrape = 0.7; AU.scoot(p.x, 0.1, p.z); }
}
function pullDrawer() {
  puzzle.drawerOpen = true;
  AU.drawer(10.5, BASE_Y + 0.7, -3.4);
  refs.drawerRope.visible = false;
  S.drawerAnim = 0;
  later(0.7, () => { const t = puzzle.tag; t.gone = false; t.mesh.visible = true; });
}

function pickItem(it) {
  act('pickup');
  if (it.name === 'key' && puzzle.jarFallen) later(1.5, () => dreadOnce('stepsBehind'));
  if (it.name === 'ball') later(0.8, () => dreadOnce('tvOn'));
  if (it.name === 'flashlight' && S.power === false) summonHunt('flashlight');
  it.carried = true;
  dog.carrying = it;
  dog.mouth.add(it.mesh);
  it.mesh.position.set(0, 0, 0);
  it.mesh.rotation.set(0, it.name === 'jacket' ? Math.PI / 2 : 0.4, 0.2);
  it.mesh.scale.setScalar(it.name === 'jacket' ? 0.45 : it.name === 'bowl' ? 0.7 : it.name === 'tin' ? 0.6 : 0.8);
  AU.pickup();
  if ((it === puzzle.jacket || it === puzzle.tag) && inBasement()) wakePresence();
}

function dropItem(it, silent) {
  if (!silent) act('drop');
  it.carried = false; dog.carrying = null;
  scene.attach(it.mesh);
  const f = dogForward();
  const x = dog.pos.x + f.x * 0.35, z = dog.pos.z + f.z * 0.35;
  it.mesh.position.set(x, floorAt(x, z, dog.y) + 0.03, z);
  it.mesh.rotation.set(0, dog.yaw, 0);
  it.mesh.scale.setScalar(1);
  if (!inBasement() && dog.y > -0.3) {
    if (it === puzzle.jacket && !S.got.jacketUp) { S.got.jacketUp = true; checkBasement(); if (S.power === false) summonHunt('jacket'); }
    if (it === puzzle.tag && !S.got.tagUp) { S.got.tagUp = true; checkBasement(); }
  }
  if (silent) return;
  AU.pickup();
  let h = null, bd = 1.8;
  for (const c of [F.father, F.mother, F.lily]) {
    if (!sameFloor(c)) continue;
    const cp = c.pose === 'sleep' ? v3(c.pos.x, 0, c.pos.z + 0.3) : c.pos;
    const d = dist2d(cp, it.mesh.position);
    if (d < bd) { bd = d; h = c; }
  }
  if (!h) return;
  if (!awake(h)) { showSubtitle('note', '<span class="note">(asleep. Wake them first.)</span>', 2); return; }
  h.look(it.mesh.position, 4, S.t);
  reactToItem(h, it);
}

function reactToItem(h, it) {
  const { father, mother, lily } = F;
  const n = it.name;
  if (n === 'bowl') {
    if (h === mother && S.ch === 1 && !it.full) return askSit(h);
    if (h === lily) return say(h, 'Mommy! Biscuit is hungry! Give it to Mommy, Biscuit.', 'calm');
    return say(h, 'Go ask your mother, bud.', 'calm');
  }
  if (it.crayon) {
    if (h === lily && S.ch === 2) return giveCrayon(it);
    return say(h, 'That is Lily\'s. Give it to Lily.', 'calm');
  }
  if (n === 'key') {
    if (h === lily && puzzle.key && S.ch >= 4) { it.gone = true; it.mesh.visible = false; return lilyUnlocks(); }
    return say(h, 'Where did you get that? Give me that.', 'sad');
  }
  if (n === 'battery') {
    if (h === lily && S.ch >= 8 && !S.alarmDone && !S.alarmOn) { it.gone = true; it.mesh.visible = false; return lilyFixesAlarm(); }
    if (h === lily) return say(h, 'That is from the beeping thing. Mommy said it was broken.', 'calm');
    if (h === mother) return say(h, 'Oh. That. I will get a new one tomorrow.', 'sleepy');
    return say(h, 'A battery? Huh.', 'calm');
  }
  if (n === 'tag') {
    if (h === father && (S.alarmDone || !S.deep) && !S.father.tag) { it.gone = true; it.mesh.visible = false; return fatherReadsTag(); }
    if (h === lily) return say(h, 'I can not read big words. Show Daddy. Daddy has to see.', 'calm');
    return say(h, 'What is this... I can not... my head...', 'sleepy');
  }
  if (n === 'jacket') {
    if (h === father && (S.alarmDone || !S.deep) && !S.father.jacket) { it.gone = true; it.mesh.visible = false; return fatherSeesJacket(); }
    if (h === lily) return say(h, 'That is Danny\'s jacket. Show Daddy. Daddy has to see it.', 'whisper');
    if (h === mother) return say(h, 'Where did you... that is his jacket. He went out without it, that night. He went out in the snow to find you.', 'sad', { clue: 'Claire knew. She never blamed Biscuit.', hl: 'He went out in the snow to find you' });
  }
  if (n === 'ball') {
    S.strikes = 0;
    if (h === father) return say(h, 'Where did you find that? That was Danny\'s ball.', 'sad');
    if (h === mother) return say(h, 'Oh, Biscuit. Oh, sweetheart. Not his ball.', 'sad');
    return say(h, 'Danny\'s ball! You want to play? We can not play inside.', 'calm');
  }
  if (n === 'tin') {
    if (h === lily) return say(h, 'Danny\'s treasure! He said I could open it when I am big. Did you dig it up? You are not allowed!', 'calm');
    if (h === father) return say(h, 'Your treasure. He made me promise never to dig it up. Not until twenty-ten.', 'sad', { clue: 'Tom had kept that promise. He had never been out to the tree since.', hl: 'He made me promise' });
    return say(h, 'Oh, Biscuit. You two and your holes. He was so proud of that hole.', 'sad');
  }
  if (n === 'mitten') {
    if (h === mother) return say(h, 'Oh. Oh, God. His mitten. I knitted these. We only ever found the one.', 'sad', { clue: 'They searched the pond for days. Biscuit found what they could not.', hl: 'We only ever found the one' });
    if (h === father) return say(h, 'Where did you... we looked for this. We looked for days.', 'sad');
    return say(h, 'That is Danny\'s. It is all wet and frozen.', 'whisper');
  }
  if (n === 'bone') {
    if (h === lily) return say(h, 'Ew! Biscuit! That is from outside!', 'calm');
    return say(h, 'Not in the house with that. Good grief.', 'calm');
  }
  if (n === 'leash') return say(h, 'No walk tonight, buddy. Not in this storm.', 'calm');
  if (n === 'drawing') {
    if (h === lily) return say(h, 'You like it? Danny is the one under the house. He has yellow eyes because it is dark down there.', 'calm');
    return say(h, 'Oh... oh, Lily.', 'sad');
  }
}

function tug(h) {
  act(awake(h) ? 'tug' : 'nudge');
  if (awake(h)) AU.growl(0.6, 0.35);
  if (!awake(h)) { if (!h.unconscious && !(S.deep && h !== F.lily)) AU.whine(); wake(h); return; }
  h.look(dogHead(), 3, S.t);
  if (S.follow || S.finalFollow || h === F.lily && S.ch >= 3) {
    if (h === F.lily && S.ch >= 3) say(h, 'I am scared to go anywhere, Biscuit. Bring me things. I will help.', 'whisper', { force: false, cooldown: 6 });
    return;
  }
  say(h, h === F.lily ? 'Where are we going? Okay, okay!' : 'Okay, okay. What? What is it? Where are we going?', 'calm');
  S.follow = { h, until: S.t + 14, prev: h.activity, repath: 0 };
  h.asleep = false;
}
function updateFollow(dt) {
  const f = S.follow;
  if (!f) return;
  const h = f.h;
  f.repath -= dt;
  if (f.repath <= 0) {
    f.repath = 1.0;
    if (dist2d(h.pos, dog.pos) > 1.4) { const tgt = v3(dog.pos.x, 0, dog.pos.z); h.goTo(tgt); }
    else h.path = [];
  }
  if (dist2d(h.pos, dog.pos) < 1.1) h.path = [];
  h.look(dogHead(), 1, S.t);
  if (inBasement() || S.outside) {
    S.follow = null;
    say(h, S.outside ? 'Biscuit! Get in here! It is freezing!' : 'Biscuit! Get out of there! Come up here. Come!', 'sharp');
    later(3, () => { if (f.prev && !S.cut) h.setActivity(f.prev); });
    return;
  }
  if (S.t > f.until) {
    S.follow = null;
    say(h, h === F.lily ? 'There is nothing here, silly.' : 'There is nothing here, bud. Come on. Go lie down.', 'calm');
    later(1.5, () => { if (f.prev && !S.cut) h.setActivity(f.prev); });
  }
}
function bite(h) {
  if (S.ended || S.cut) return;
  AU.growl(0.5, 1.2); AU.snap(); AU.scream(); act('bite');
  dog.barkKick = 0;
  S.redFlash = 0.8;
  if (S.co >= 0.3) { badDogEnding(h); return; }
  say(h, 'AGH! He BIT me! Biscuit! What the hell!', 'sharp');
  S.strikes = 3;
  if (awake(F.father) || h === F.father) later(1.8, lockUp);
}
function scratchMarks(d) {
  d.marks = (d.marks || 0) + 1;
  if (d.marks > 7) return;
  const local = d.mesh.worldToLocal(v3(dog.pos.x, 0.4, dog.pos.z));
  const side = local.z >= 0 ? 1 : -1;
  const g = new THREE.Group();
  const m = refs.scratchM || (refs.scratchM = ps1Mat({ color: 0xb09868, emissive: 0x100c08 }));
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.13 + Math.random() * 0.05, 0.004), m); b.position.set(i * 0.018, 0, 0); b.rotation.z = 0.12; g.add(b); }
  g.position.set(Math.max(-d.width / 2 + 0.1, Math.min(d.width / 2 - 0.15, local.x + (Math.random() - 0.5) * 0.25)), -1.02 + 0.42 + Math.random() * 0.25, side * 0.027);
  g.rotation.z = (Math.random() - 0.5) * 0.4;
  d.mesh.add(g);
}
function scratchDoor(name) {
  AU.scratch(); act('scratch');
  const dd = doors[name];
  if (dd) { S.doorShakeD = dd; S.doorShakeT = 0.9; later(0.5, () => scratchMarks(dd)); }
  if (name === 'laundry' && S.locked) {
    S.scratches++;
    if (S.scratches >= 4 && !S.rescuing) {
      const m = awake(F.mother) && !S.deep ? F.mother : (awake(F.lily) && F.lily.pose !== 'sleep' ? F.lily : null);
      if (!m) return;
      S.rescuing = true;
      const prev = m.activity;
      m.goTo(v3(11.45, 0, 4.1), () => {
        say(m, m === F.lily ? 'Shh. Biscuit. Do not tell Dad.' : 'Fine. FINE. Just be quiet. Please.', 'sad');
        unlockLaundry(); S.rescuing = false;
        later(2, () => prev && m.setActivity(prev));
      });
    }
    return;
  }
  if (name === 'danny') {
    if (S.coOn && !puzzle.dannyOpen && once('dannyLight')) later(1.5, () => { refs.dannyDoorLight.visible = true; S.dannyLightOn = true; AU.stinger(0.4); });
    const m = F.mother;
    if (awake(m) && !S.deep && dist2d(m.pos, dog.pos) < 7 && sameFloor(m)) say(m, 'Biscuit, no. Not his door. Please, not his door.', 'sad', { force: false, cooldown: 6 });
    return;
  }
  if (name === 'basement' && puzzle.latched) {
    AU.rattle(13.4, 1.6, 3.5, 0.6);
    showSubtitle('note', '<span class="note">(It moves a little, then stops. Something holds it shut, high up.)</span>', 2.5);
    return;
  }
  if (name === 'front') {
    emit(1.5, 0.05, 9.95, 'outside', { spread: 0.8, life: 2 });
    if (S.coOn && once('knock')) later(1.2, () => {
      // something on the other side knocks back, three times
      AU.knock(1.5, 1.2, 10.2, 3, 1.1); scared(0.8);
      later(3, () => { if (!S.deep && awake(F.father) && F.father.pose !== 'sleep') say(F.father, 'Who the hell is out in this?', 'calm'); });
    });
    for (const h of [F.father, F.mother]) {
      if (awake(h) && !S.deep && dist2d(h.pos, dog.pos) < 6) { say(h, 'He is not coming home, Biscuit. He is not coming home.', 'sad', { force: false, cooldown: 15 }); break; }
    }
  }
}

// ---------------------------------------------------------------------------
// Scents
function emitScents(dt) {
  const k = dt * 60;
  const { father, mother, lily } = F;
  for (const h of [father, mother, lily]) {
    if (Math.random() < 0.25 * k) emit(h.pos.x, h.pos.y + 0.05, h.pos.z, h.name, { spread: 0.25, life: 9, vy: 0.005, size: 0.03 });
    if (Math.random() < 0.12 * k) emit(h.pos.x, h.pos.y + 0.6 + Math.random() * 0.8, h.pos.z, h.name, { spread: 0.4, life: 3 });
  }
  if (Math.random() < 0.35 * k) {
    const i = Math.floor(Math.random() * (DANNY_TRAIL.length - 1)), f = Math.random();
    const a = DANNY_TRAIL[i], b = DANNY_TRAIL[i + 1];
    emit(a[0] + (b[0] - a[0]) * f, 0.05, a[1] + (b[1] - a[1]) * f, 'danny', { spread: 0.15, life: 3, vy: 0.01, size: 0.025 });
  }
  if (Math.random() < 0.15 * k) {
    const i = Math.floor(Math.random() * (DANNY_TRAIL_DOWN.length - 1)), f = Math.random();
    const a = DANNY_TRAIL_DOWN[i], b = DANNY_TRAIL_DOWN[i + 1];
    // points are [x, z, y]
    emit(a[0] + (b[0] - a[0]) * f, a[2] + (b[2] - a[2]) * f + 0.05, a[1] + (b[1] - a[1]) * f, 'danny', { spread: 0.15, life: 3, vy: 0.01, size: 0.025 });
  }
  for (const it of items) {
    if (it.gone || !it.mesh.visible) continue;
    const p = new THREE.Vector3(); it.mesh.getWorldPosition(p);
    if (it.name === 'jacket' && Math.random() < 0.5 * k) emit(p.x, p.y + 0.05, p.z, 'dannyStrong', { spread: 0.35, life: 2.5, vy: 0.08, size: 0.04 });
    if (it.name === 'ball' && Math.random() < 0.08 * k) emit(p.x, p.y, p.z, 'dannyFaint', { spread: 0.1, life: 2 });
    if ((it.crayon || it.name === 'drawing') && Math.random() < 0.2 * k) emit(p.x, p.y + 0.05, p.z, 'lily', { spread: 0.15, life: 2, vy: 0.06 });
    if ((it.name === 'key' || it.name === 'tag') && Math.random() < 0.2 * k) emit(p.x, p.y + 0.05, p.z, it.name === 'key' ? 'mother' : 'father', { spread: 0.15, life: 2, vy: 0.06 });
    if (it.name === 'battery' && S.ch >= 8 && Math.random() < 0.2 * k) emit(p.x, p.y + 0.05, p.z, 'mother', { spread: 0.15, life: 2, vy: 0.06 });
  }
  if (Math.random() < 0.05 * k) emit(spots.bowl.x, 0.08, spots.bowl.z + 0.4, 'food', { spread: 0.3, life: 2 });
  if (S.lilyGone && !S.escort) {
    if (Math.random() < 0.5 * k) { const i = Math.floor(Math.random() * (LILY_TRAIL.length - 1)), f = Math.random(); const a = LILY_TRAIL[i], b = LILY_TRAIL[i + 1]; emit(a[0] + (b[0] - a[0]) * f, 0.05, a[1] + (b[1] - a[1]) * f, 'lily', { spread: 0.15, life: 3.5, vy: 0.01, size: 0.028, faint: 1 }); }
    if (Math.random() < 0.3 * k) { const i = Math.floor(Math.random() * (LILY_TRAIL_DOWN.length - 1)), f = Math.random(); const a = LILY_TRAIL_DOWN[i], b = LILY_TRAIL_DOWN[i + 1]; emit(a[0] + (b[0] - a[0]) * f, a[2] + (b[2] - a[2]) * f + 0.05, a[1] + (b[1] - a[1]) * f, 'lily', { spread: 0.15, life: 3.5, vy: 0.01, size: 0.028, faint: 1 }); }
  }
  // out back: old trails under the snow, too faint to see unless you follow them
  const trail = (pts, kind, rate, o) => {
    if (Math.random() >= rate * k) return;
    const i = Math.floor(Math.random() * (pts.length - 1)), f = Math.random();
    const a = pts[i], b = pts[i + 1];
    emit(a[0] + (b[0] - a[0]) * f, 0.05, a[1] + (b[1] - a[1]) * f, kind, { spread: 0.18, life: 3.5, vy: 0.012, size: 0.028, ...o });
  };
  const near = dog.pos.x > 12 || S.outside;
  if (near) {
    trail(DANNY_TRAIL_YARD, 'dannyOld', 0.45, { faint: 1 });
    trail(DANNY_TRAIL_GATE, 'dannyOld', 0.45, { faint: 1 });
    trail(DEER_TRAIL, 'deer', 0.5);
    trail(FATHER_YARD, 'father', 0.25, { faint: 0.6 });
    for (const sp of yard.digSpots) {
      if (sp.done) continue;
      if (sp === yard.vent && !S.coOn) continue;
      if (Math.random() < (sp === yard.vent ? 0.5 : 0.35) * k) emit(sp.pos.x, 0.08, sp.pos.z, sp.scent, { spread: 0.35, life: 2.5, vy: 0.08, size: 0.035, faint: sp === yard.tin ? 1 : 0 });
    }
    if (!yard.flapOpen && Math.random() < 0.1 * k) emit(13.85, 0.05, 4.25, 'outside', { spread: 0.3, life: 2, vx: -0.15 });
  }
  if (Math.random() < 0.1 * k) emit(1.5, 0.05, 9.9, 'outside', { spread: 0.8, life: 2, vz: -0.15 });
  const co = S.co;
  if (S.coOn) {
    const c = refs.flueCrack;
    if (Math.random() < (0.3 + co) * k) emit(c.x + 0.2, c.y, c.z, 'wrong', { spread: 0.3, life: 6, vy: 0.04, vx: 0.08, size: 0.05 });
    if (doors.basement.angle > 0.3 && Math.random() < (0.15 + co) * 0.6 * k) emit(13.4, 0.3 + Math.random() * 1.8, 3.4, 'wrong', { spread: 0.5, life: 6, vz: 0.12, size: 0.05 });
    if (Math.random() < 0.2 * k) emit(spots.lilyVent.x, 0.05, spots.lilyVent.z, 'wrong', { spread: 0.2, life: 3, vy: 0.15, size: 0.04 });
    if (Math.random() < co * 1.2 * k) {
      const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 5;
      emit(dog.pos.x + Math.cos(a) * r, dog.y + 0.2 + Math.random() * 1.8, dog.pos.z + Math.sin(a) * r, 'wrong', { spread: 0.4, life: 5, size: 0.05, vy: -0.01 });
    }
  }
}
function sniffLabel() {
  const p = dog.pos;
  const cand = [];
  for (const h of [F.father, F.mother, F.lily]) if (sameFloor(h)) cand.push([dist2d(h.pos, p) - 0.5, h.name]);
  for (const it of items) {
    if (it.gone || it.carried || !it.mesh.visible) continue;
    const ip = new THREE.Vector3(); it.mesh.getWorldPosition(ip);
    if (Math.abs(ip.y - dog.y) > 1.2) continue;
    if (it.name === 'jacket') cand.push([dist2d(ip, p) - 1.5, 'dannyStrong']);
    if (it.name === 'ball') cand.push([dist2d(ip, p) - 0.3, 'dannyFaint']);
    if (it.crayon) cand.push([dist2d(ip, p) - 0.6, 'lily']);
  }
  if (dog.carrying && dog.carrying.name === 'jacket') cand.push([-5, 'dannyStrong']);
  for (const tr of DANNY_TRAIL) cand.push([Math.hypot(tr[0] - p.x, tr[1] - p.z) + 0.4, 'danny']);
  if (S.coOn && (inBasement() || dist2d(p, v3(13.4, 0, 3.6)) < 2.5 || dist2d(p, spots.lilyVent) < 1.5)) cand.push([0.3, 'wrong']);
  if (S.co > 0.5) cand.push([1.4 - S.co, 'wrong']);
  cand.push([dist2d(p, spots.bowl) - 0.3, 'food']);
  if (S.lilyGone && !S.escort) for (const q of LILY_TRAIL) cand.push([Math.hypot(q[0] - p.x, q[1] - p.z) + 0.2, 'lily']);
  if (S.outside || p.x > 12.5) {
    const segD = (pts, q) => { let m = 1e9; for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; const vx = bx - ax, vz = bz - az; const t = Math.max(0, Math.min(1, ((q.x - ax) * vx + (q.z - az) * vz) / (vx * vx + vz * vz))); m = Math.min(m, Math.hypot(q.x - ax - vx * t, q.z - az - vz * t)); } return m; };
    cand.push([segD(DANNY_TRAIL_YARD, p) + 0.35, 'dannyOld']);
    cand.push([segD(DANNY_TRAIL_GATE, p) + 0.35, 'dannyOld']);
    cand.push([segD(DEER_TRAIL, p) + 0.25, 'deer']);
    cand.push([segD(FATHER_YARD, p) + 0.6, 'father']);
    for (const sp of yard.digSpots) if (!sp.done && (sp !== yard.vent || S.coOn)) cand.push([dist2d(p, sp.pos) - 0.5, sp.scent]);
  }
  // the scent you are following wins if it is anywhere close
  if (TRACK.group >= 0) for (const c of cand) if (groupOf(c[1]) === TRACK.group && c[0] < 1.6) c[0] -= 2;
  cand.push([dist2d(p, v3(1.5, 0, 9.9)) - 0.3, 'outside']);
  cand.sort((a, b) => a[0] - b[0]);
  if (!cand.length || cand[0][0] > 2.2) { S.labelKind = null; return ''; }
  const kind = cand[0][1];
  S.labelKind = kind;
  const s = SCENT[kind];
  const c = s.col.map((v) => Math.round(v * 255)).join(',');
  const tracked = groupOf(kind) === TRACK.group;
  return `<span style="color:rgb(${c})">${s.label}</span> — ${s.desc} <span class="tk">${tracked ? 'following · T stop' : 'T follow only this'}</span>`;
}

// ---------------------------------------------------------------------------
// What to do next, in plain words, and where. Shown under the objective with a
// marker pointing the way.
const ROOMS = { entry: 'by the front door', living: 'in the living room', kitchen: 'in the kitchen', hall: 'in the hall', parents: 'in the parents\' bedroom', lily: 'in Lily\'s room', danny: 'in Danny\'s room', laundry: 'in the laundry room', stairs: 'on the basement stairs', basement: 'in the basement', yard: 'outside' };
const posOf = (it) => { const p = new THREE.Vector3(); it.mesh.getWorldPosition(p); return p; };
function nextStep() {
  const { father: f, mother: m, lily: l } = F;
  const carry = dog.carrying;
  const pz = puzzle, Y = S.yardDone;
  if (S.monsterTest) return [S.presenceActive ? 'It is down here with you. Run up the stairs, hide (hold C), or bark it apart (B).' : inBasement() ? 'Something is coming out of the furnace.' : 'Go back down the basement stairs. It is waiting.', S.presenceActive || inBasement() ? null : spots.stairBottom];
  if (S.ch === 9) return ['Go down to the hot box in the basement and walk into its open mouth.', spots.furnace];
  if (S.ch === 10) {
    const left = [f, m, l].filter((h) => h.unconscious);
    if (left.length) { const h = left.sort((a, b) => dist2d(a.pos, dog.pos) - dist2d(b.pos, dog.pos))[0]; return [`Wake ${h === f ? 'Tom (in his armchair)' : h === m ? 'Claire (in bed)' : 'Lily (in her bed)'}: bark at them (B) or nudge them (E).`, h.pos]; }
    return ['Lead them all out of the front door.', spots.frontDoor];
  }
  if (S.finalFollow) return ['Lead Tom to the front door. Walk slowly; he follows you.', spots.frontDoor];
  switch (S.ch) {
    case 1:
      if (S.wantSit) return ['She said "Biscuit, sit." Sit in front of her: press X.', m.pos];
      if (S.feeding) return ['Good boy. Wait while she fills your bowl.', null];
      if (pz.bowl.full) return ['Eat your dinner: walk to your bowl and press E.', posOf(pz.bowl)];
      if (carry === pz.bowl) return ['Carry the bowl to Claire (the woman) at the kitchen sink, then press E to drop it near her.', m.pos];
      return ['Pick up your empty bowl with E. It is on the kitchen floor by the fridge.', posOf(pz.bowl)];
    case 2: {
      if (S.crayons >= 6) return pz.drawing.mesh.visible && !pz.drawingDoc.read ? ['Look at Lily\'s drawing on the floor: walk up to it and press E.', posOf(pz.drawing)] : ['Wait. It is getting late.', null];
      if (carry && carry.crayon) return ['Bring the crayon to Lily in the living room and press E to drop it by her.', l.pos];
      let best = null, bd = 1e9;
      for (const c of pz.crayons) { if (c.gone || c.carried || !c.mesh.visible) continue; const d = dist2d(c.mesh.position, dog.pos); if (d < bd) { bd = d; best = c; } }
      if (!best) return ['Find Lily\'s crayons.', null];
      if (best.under) return [`A crayon rolled under ${best.underWhat}. Stand beside it, hold C to lie flat, then press E to drag it out.`, best.mesh.position];
      return [`Find Lily\'s crayons (${S.crayons}/6). Hold F to sniff: her green smell is on them. Press E to pick one up.`, best.mesh.position];
    }
    case 3:
      if (S.lilyWaiting) {
        if (pz.stool.dragging) return ['Push the stool under the hook on the basement door (end of the hall). Press E to let go of it there.', v3(13.4, 0, 4.0)];
        return ['Lily needs something to stand on. Go to the step stool in the kitchen and press E to push it with your nose.', pz.stool.mesh.position];
      }
      if (S.lilyToLatch) return ['Follow Lily.', l.pos];
      if (S.coOn && l.pose === 'sleep') return ['Something is breathing in Lily\'s room. Go and stand by the heating vent beside her bed.', spots.lilyVent];
      return ['It is bedtime. Stay near the family.', l.pos];
    case 4:
      if (pz.dannyOpen) return pz.dannyNotebookRead ? ['Look around Danny\'s room.', null] : ['Read Danny\'s notebook on his desk: walk up to the desk and press E.', v3(10.15, 0, 0.9)];
      if (S.lilyToDanny) return ['Follow Lily to Danny\'s door.', l.pos];
      if (carry === pz.key) return ['Bring the key to Lily in her room. Press E to drop it by her.', l.pos];
      if (!pz.key.gone && pz.key.mesh.visible) return ['Danny\'s key fell out of the broken jar. Pick it up off the kitchen floor (E).', posOf(pz.key)];
      if (pz.keyInJar) {
        if (dog.surface && dog.surface.name === 'the counter') return ['Walk along the counter to the cookie jar and press E to push it off.', spots.jar];
        if (dog.surface && dog.surface.name === 'a kitchen chair') return ['Now jump (Space) from the chair up onto the counter. Run at it (Shift) if you fall short.', v3(13.7, 0.94, 7.1)];
        return ['The key is in the cookie jar, high on the kitchen counter. Jump (Space) onto the kitchen chair nearest the counter first.', v3(12.3, 0.47, 7.1)];
      }
      return ['Wait. The woman is going to bed.', null];
    case 5:
      if (!yard.flapOpen) return ['Go to your dog flap at the far end of the hall and press E to pull its storm cover off.', v3(13.62, 0, 4.25)];
      if (!Y.vent) return ['Go outside through the flap. Dig out the furnace pipe in the snow drift against the house: stand at the drift and hold R.', yard.vent.pos];
      if (!Y.tin) return ['Find what you and Danny buried under the big oak tree. Sniff (F) for a gold smell coming up through the snow, stand on it and hold R to dig.', v3(22.3, 0, 7.6)];
      if (!Y.gate) return ['Follow Danny\'s last trail to the gate in the far fence (sniff with F, press T on his gold smell). Stand at the gate; you do not have to get through it.', spots.gate];
      return ['Go back inside.', spots.flapIn];
    case 6:
      if (S.pendingCut) return ['Go back inside, through your flap.', spots.flapIn];
      if (S.escort) return ['Lead Lily back up to her room. Stay close and keep moving; she follows you.', spots.lilySit];
      if (S.lilyDazed) return ['Bark at Lily to snap her out of it. Press B.', l.pos];
      if (S.lilyGone) {
        if (!pz.flashlight.carried && S.flashOn && !inBasement()) return ['It is pitch black down there. Get Danny\'s flashlight from his bedroom floor (E). It lights where you look.', posOf(pz.flashlight)];
        return ['Find Lily. Sniff (F), press T on her green smell, and follow it. It goes down to the basement.', l.pos];
      }
      return ['Listen.', null];
    case 7: {
      if (!S.got.jacketUp) {
        if (carry === pz.jacket) return ['Carry the jacket up the stairs and out of the basement, then press E to drop it.', spots.stairTop];
        return ['Find Danny\'s jacket in his boxes in the far corner of the basement and pick it up (E).', posOf(pz.jacket)];
      }
      if (!S.got.tagUp) {
        if (carry === pz.tag) return ['Carry the red tag up the stairs and out of the basement, then press E to drop it.', spots.stairTop];
        if (pz.tag.mesh.visible) return ['Pick up the red tag by the workbench (E).', posOf(pz.tag)];
        return ['Pull the rope on the workbench drawer in the basement (E). Something is inside.', spots.drawerPull];
      }
      return ['Go back upstairs.', spots.stairTop];
    }
    case 8: {
      if (S.alarmOn) return ['The alarm is screaming. Watch.', null];
      if (!S.alarmDone) {
        if (carry === pz.battery) return ['Bring the battery to Lily in her room and press E to drop it by her.', l.pos];
        return ['Pick up the alarm\'s battery from the kitchen floor, under the beeping box by the hall door (E).', posOf(pz.battery)];
      }
      if (!S.father.tag) { if (carry === pz.tag) return ['Bring the red tag to Tom at the kitchen table and press E to drop it at his feet.', f.pos]; return ['Show Tom the red tag. Pick it up (E) where you left it.', posOf(pz.tag)]; }
      if (!S.father.jacket) { if (carry === pz.jacket) return ['Bring Danny\'s jacket to Tom and press E to drop it at his feet.', f.pos]; return ['Show Tom Danny\'s jacket. Pick it up (E) where you left it.', posOf(pz.jacket)]; }
      return ['Stay with him.', f.pos];
    }
  }
  return ['', null];
}
// things you can pick up catch the light now and then, so you can find them on the floor
function updateGlints(dt) {
  S.glintT = (S.glintT || 0) - dt;
  if (S.glintT > 0) return;
  S.glintT = 0.35;
  for (const it of items) {
    if (it.carried || it.gone || !it.mesh.visible || Math.random() > 0.35) continue;
    const p = posOf(it);
    if (Math.abs(p.y - dog.y) > 1.6 || dist2d(p, dog.pos) > 8) continue;
    puff(p.x + (Math.random() - 0.5) * 0.08, p.y + 0.05, p.z + (Math.random() - 0.5) * 0.08, { col: [1, 0.95, 0.75], vy: 0.25, life: 0.55, size: 0.03, spread: 0.02 });
    puff(p.x, p.y + 0.06, p.z, { col: [1, 0.92, 0.6], vy: 0.1, life: 0.35, size: 0.05, spread: 0.01 });
  }
}
// The world going on: animals out in the dark, doors, water in the pipes, the family talking
const CHATTER = [
  [['mother', 'Did you lock the truck?'], ['father', 'Yeah. I think so.']],
  [['father', 'Roads are going to be bad tomorrow.'], ['mother', 'Then do not go.']],
  [['mother', 'Lily asked about him again today.'], ['father', 'What did you tell her?'], ['mother', 'The truth. Sort of.']],
  [['father', 'We should put the tree up this weekend.'], ['mother', 'I can not, Tom. Not this year either.']],
  [['father', 'Claire, where is the big flashlight?'], ['mother', 'In Danny\'s room. Where it always was.']],
  [['mother', 'Is it cold in here, or is it me?'], ['father', 'It is you. It is always you.']],
  [['mother', 'Do you smell something?'], ['father', 'It is just the furnace. It always smells when it first kicks on.']],
  [['father', 'Lily, teeth. Now, please.'], ['lily', 'I did them already!'], ['father', 'Did you, though.']],
];
function updateLife(dt) {
  if (S.cut || S.ended) return;
  S.nextLife = (S.nextLife ?? 14) - dt;
  if (S.nextLife > 0) return;
  S.nextLife = 14 + Math.random() * 18;
  const { father: f, mother: m, lily: l } = F;
  const evening = !S.deep && awake(f) && awake(m) && !f.asleep && !m.asleep && S.ch <= 4;
  const r = Math.random();
  if (evening && r < 0.35 && (S.chatI || 0) < CHATTER.length) {
    // they talk in the next room. You only catch the words if you are close.
    S.chatI = S.chatI || 0;
    const pair = CHATTER[S.chatI++];
    pair.forEach(([who, text], i) => later(i * 3.4, () => {
      const h = F[who]; if (!awake(h) || h.asleep) return;
      const far = dist2d(h.pos, dog.pos) > 7 || !sameFloor(h);
      say(h, text, 'calm', { force: false, cooldown: 1, silentSub: far });
    }));
    return;
  }
  const pick = Math.random();
  if (pick < 0.22) AU.owl(26 + Math.random() * 12, 5, -8 + Math.random() * 20);
  else if (pick < 0.32) AU.coyote(55, 2, -20 + Math.random() * 40);
  else if (pick < 0.42) AU.farDog(-40, 1, 40);
  else if (pick < 0.52) AU.chimes(14.3, 2.1, 5.2);
  else if (pick < 0.68) { const D = [[1.95, 3.5], [5.95, 3.5], [11.45, 3.5], [11.5, 5.0]]; const [x, z] = D[Math.floor(Math.random() * D.length)]; if (Math.hypot(x - dog.pos.x, z - dog.pos.z) > 3) AU.doorSomewhere(x, 1.2, z); }
  else if (pick < 0.78 && !S.deep) AU.flush(0.5, 1.0, 2.8);
  else if (pick < 0.88 && m.pose === 'sink') AU.dishes(11.75, 1.0, 9.6);
  else AU.groan(10, -0.5, 1, 0.3);
}
function updateGuide(dt) {
  S.guideT = (S.guideT || 0) - dt;
  if (S.guideT > 0) return;
  S.guideT = 0.25;
  const [text, at] = S.other ? otherNext() : nextStep();
  let where = '';
  if (S.other) { ui.guide(text, at, at ? 'down the road' : '', at ? Math.hypot(at.x - dog.pos.x, at.z - dog.pos.z) : 0); return; }
  if (at) {
    const tUp = at.y > -0.5, meUp = dog.y > -0.5;
    const tOut = isOutside(at.x, at.z, at.y), meOut = S.outside;
    const room = roomAt(at.x, at.z, at.y);
    const d = Math.hypot(at.x - dog.pos.x, at.z - dog.pos.z);
    where = tUp && !meUp ? 'upstairs' : !tUp && meUp ? 'downstairs, in the basement' : tOut && !meOut ? 'outside, through your flap' : !tOut && meOut ? 'inside the house' : ROOMS[room] || '';
    ui.guide(text, at, where, d);
  } else ui.guide(text, null, '', 0);
}

export function onTrack() {
  if (S.ended || S.cut || S.inspectOpen) return;
  if (S.sniff > 0.5 && S.labelKind) {
    if (groupOf(S.labelKind) === TRACK.group) { setTrack(null); ui.track(null); AU.sniffSnd(); return; }
    setTrack(S.labelKind);
    if (achSet('nose', TRACK.group) >= 6) ach('nose');
    const col = SCENT[S.labelKind].col.map((v) => Math.round(v * 255)).join(',');
    ui.track(TRACK_NAME[TRACK.group], col);
    AU.sniffSnd(S.outside); later(0.25, () => AU.sniffSnd(S.outside));
    if (once('trackCard')) ui.card('Following one smell', 'Every other smell goes quiet and grey. This one glows, and stays with you even when you lift your nose. Old, faint trails only show up when you follow them. Press T again to let go.');
    return;
  }
  if (TRACK.group >= 0) { setTrack(null); ui.track(null); return; }
  showSubtitle('note', '<span class="note">(Hold F and sniff first. When you smell the one you want, press T to follow only that.)</span>', 3);
}

function computePrompt() {
  if (S.inspectOpen) return '';
  if (S.cut || S.ended || dog.frozen) return '';
  if (puzzle.stool.dragging) return '<b>E</b> let go of the stool';
  if (dog.carrying) return `<b>E</b> drop ${dog.carrying.label}`;
  if (nearFullBowl()) return '<b>E</b> eat';
  const ins = nearestInspect();
  if (ins && !ins.read) return '<b>E</b> look closer <span class="new">new</span>';
  const it = nearestItem(0.85);
  if (it) return it.under ? `<b>E</b> stretch under ${it.underWhat} and drag out ${it.label}` : `<b>E</b> take ${it.label} in your mouth`;
  const un = puzzle.crayons.find((c) => c.under && !c.gone && !c.carried && c.mesh.visible && dist2d(c.mesh.position, dog.pos) < 1.05);
  if (un && dog.lying < 0.5) return `it rolled under ${un.underWhat}. hold <b>C</b> to lie flat and reach`;
  if (ins && !ins.item) return '<b>E</b> look again';
  if (nearRope()) return '<b>E</b> pull the rope';
  if (nearCover()) return '<b>E</b> pull the storm cover off your flap';
  if (nearJar()) return '<b>E</b> push the cookie jar off the counter';
  if (nearStool()) return '<b>E</b> push the stool with your nose';
  const h = nearestHuman(1.3);
  if (h) {
    if (!awake(h)) return `<b>E</b> nudge · <b>B</b> bark to wake`;
    return h === F.lily ? `<b>E</b> tug her sleeve` : `<b>E</b> tug sleeve · hold <b>E</b> bite`;
  }
  if (nearestDoor()) return `<b>E</b> scratch the door`;
  if (dist2d(dog.pos, spots.dogBed) < 0.6) return `hold <b>C</b> lie down in your bed`;
  if (S.outside) return dog.digging ? 'digging…' : `hold <b>R</b> dig`;
  return '';
}

// ---------------------------------------------------------------------------
// Endings
const ENDINGS = {
  goodboy: { n: 1, title: 'GOOD BOY' },
  wait: { n: 2, title: 'THE LONG WAIT' },
  laundry: { n: 3, title: 'THE LAUNDRY ROOM' },
  baddog: { n: 4, title: 'BAD DOG' },
  home: { n: 5, title: 'HOME' },
  dark: { n: 6, title: 'UNDER THE HOUSE' },
};
function endByTime() {
  const inLaundry = roomAt(dog.pos.x, dog.pos.z, dog.y) === 'laundry' && Math.abs(doors.laundry.angle) < 0.3;
  if (S.locked || inLaundry) return finish('laundry');
  if (dist2d(dog.pos, spots.frontDoor) < 2.2) return finish('wait');
  return finish('goodboy');
}
export function sleepInBed() {
  if (!S.coOn) { showSubtitle('note', '<span class="note">You are not tired. Something is wrong tonight.</span>', 2.5); S.bedHold = 0; return; }
  finish('goodboy');
}
function badDogEnding(h) {
  S.cut = 'baddog';
  dog.frozen = true;
  say(h, 'AGH! He BIT me! Biscuit, what the hell is WRONG with you?!', 'sharp');
  later(3.5, () => say(h, 'GET OUT! Out! OUT!', 'sharp'));
  later(5.5, () => { S.fade = 1; S.fadeSpeed = 0.8; });
  later(7, () => { doors.front.target = 1.6; doors.front.speed = 3; AU.creak(1.5, 1, 10, 0.6); S.windBoost = 0.8; });
  later(9, () => finish('baddog'));
}
function ENDING_TEXT(id) {
  const jacket = dog.carrying && dog.carrying.name === 'jacket';
  switch (id) {
    case 'goodboy': return [
      'You lay down. It was warm. The furnace hummed to you through the floor, low and kind, the way it always had.',
      'The house was so quiet.',
      jacket ? 'You kept his jacket under your chin all night. It smelled like him.' : 'You were a good boy. You did what they told you.',
      'In the morning the storm had passed. The snow was bright and clean, and nobody came to fill your bowl.',
    ];
    case 'wait': return [
      'You waited by the door, the way you had every night for a year.',
      'Someone would come home. Someone always came home. You did, once.',
      'The house went quiet behind you, room by room.',
      'Three days later, someone came. A man from the gas company, and then a lot of men, and then a woman with a blanket who carried you out into the cold.',
    ];
    case 'laundry': return [
      'The window over the dryer had been cracked open all winter. Nobody ever fixed it.',
      'The air that came in was cold, and clean, and you breathed it.',
      'You scratched at the door until your paws bled. Nobody came.',
      'You were the only one they found alive. A neighbour took you in. You still wait by her door.',
    ];
    case 'baddog': return [
      'He threw you out into the snow and stood in the open doorway, shaking, breathing the cold air.',
      'His head cleared. He sat down hard on the step. He did not know why he was crying.',
      'The fire department found the cracked furnace at 4 a.m. Everyone lived.',
      'They said Biscuit had turned. They said it was kinder this way. Lily was eight.',
      'She is thirty now. She has never once ignored an animal that would not stop barking.',
    ];
    case 'dark': return [
      'It took you a third time, and this time you did not fight it.',
      'It was warm, where it took you. Warm and close and quiet, like the inside of his jacket when you were small.',
      'The house went on breathing without you.',
      'They found all four of them on the eighteenth, when the mail piled up. The dog was lying across the girl\'s doorway, as if he had been guarding it.',
    ];
    case 'home': if (S.otherDone) return [
      'You barked until they woke up, all three of them, and you did not stop until they were standing.',
      'They followed you down the hall and out of the front door, into the snow, and stood in the yard in their pajamas, breathing.',
      'The fire department shut off the gas at 4 a.m. The technician who had red-tagged the furnace came himself. He could not understand it. The burner was out, he said, and the gas was shut off at the valve. By hand. From the inside.',
      'Tom held Danny\'s jacket and cried, and for the first time in a year he said his son\'s name out loud.',
      'Lily told the firemen that Danny carried Biscuit home. Nobody corrected her.',
      'You lay down in the snow by the truck, and you were not waiting for anyone anymore. Good boy.',
    ];
    return [
      'He carried Lily out in his arms and half dragged Claire through the snow, and they stood in the yard in their pajamas, breathing.',
      S.yardDone.vent
        ? 'The fire department shut off the gas at 4 a.m. The technician who had red-tagged the furnace came himself. Somebody had dug the exhaust pipe out of the drift, he said. By hand, it looked like. Or by paws. He said that bought them the hour.'
        : 'The fire department shut off the gas at 4 a.m. The technician who had red-tagged the furnace came himself. He said another hour.',
      'They sat in the truck under one blanket. Tom held Danny\'s jacket and cried, and for the first time in a year he said his son\'s name out loud.',
      'Lily told the firemen that Danny had been talking in the heater all night. Nobody corrected her.',
      'You did not understand all of the words. You understood that.',
    ];
  }
}
function finish(id) {
  if (S.ended) return;
  S.ended = true;
  S.endId = id;
  dog.frozen = true;
  input.enabled = false;
  AU.alarm(false);
  releaseStool();
  if (document.exitPointerLock) document.exitPointerLock();
  S.fade = 1; S.fadeSpeed = id === 'goodboy' ? 0.3 : 0.6;
  if (!S.catches && S.metThing) ach('untouchable'); // only counts if it ever came for you
  if (id === 'home') { ach('home'); const rate = S.yardDone.vent ? 0.55 : 1; if ((1 - S.coAcc) * CO_DUR / rate < 600) ach('wire'); }
  try {
    const found = JSON.parse(localStorage.getItem('goodboy_endings') || '[]');
    if (!found.includes(id)) found.push(id);
    localStorage.setItem('goodboy_endings', JSON.stringify(found));
    if (found.length >= 6) ach('allend');
  } catch (e) { /* storage unavailable */ }
  setTimeout(() => startMontage(id), id === 'goodboy' ? 4000 : 2600);
}

// ---------------------------------------------------------------------------
// The rewind: back through every moment of dialogue, stopping on what mattered
function startMontage(id) {
  const list = [];
  let last = '';
  for (const r of speechLog) { if (!r.snap || r.text === last) continue; last = r.text; list.push(r); }
  list.reverse();
  S.montage = { id, list, i: -1, t: 0, dur: 0, cam: null };
  for (const k of ['father', 'mother', 'lily', 'danny']) { F[k].path = []; F[k].arrived = null; }
  S.presence.root.visible = false;
  if (dog.snout) dog.snout.visible = false;
  if (dog.mouth) dog.mouth.visible = false;
  if (dog.body) dog.body.visible = false;
  ui.montageShow(true);
  P.uFade.value = 0; P.uBlackout.value = 0; P.uRed.value = 0; P.uFlash.value = 0; P.uCO.value = 0; G.uCO.value = 0; P.uStretch.value = 0;
  for (const L of lights) if (L) { L.on = L.slot !== 7 && L.slot !== 9; L.intensity = 1; L.flicker = 0; }
  nextMontage();
}
function nextMontage() {
  const M = S.montage;
  M.i++;
  if (M.i >= M.list.length) return endMontage();
  const r = M.list[M.i];
  M.t = 0; M.dur = r.clue ? 6.5 : 0.42;
  const s = r.snap;
  for (const k of ['father', 'mother', 'lily', 'danny']) {
    const h = F[k], q = s[k];
    h.pos.set(q.x, q.y, q.z); h.yaw = q.yaw; h.pose = q.pose; h.visible = k === 'danny' ? (q.vis && r.who === 'danny') : true;
    h.lookAt = null; h.wrongFace = false; h.twitch = null; h.twitchAt = 1e9;
  }
  const sp = F[r.who];
  // frame the speaker from where Biscuit was, or from in front of them
  const head = v3(sp.pos.x, sp.pos.y + (sp.pose === 'sleep' ? 0.75 : sp.pose === 'sit' || sp.pose === 'slump' ? 1.2 * sp.s : sp.pose === 'floor' ? 0.85 * sp.s : 1.62 * sp.s), sp.pos.z);
  if (sp.pose === 'sleep') head.z = sp.pos.z + 0.05;
  const dg = v3(s.dog.x, s.dog.y, s.dog.z);
  let camPos = null;
  const room = roomAt(sp.pos.x, sp.pos.z, sp.pos.y);
  const dd = dist2d(dg, head);
  // from where Biscuit stood, if he was in the same room; otherwise find a clear spot facing them
  // a portrait of the speaker, from a clear spot in their room, a little below eye level
  const camY = sp.pose === 'sleep' ? head.y + 0.55 : head.y - 0.18;
  for (const a of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, Math.PI]) {
    if (camPos) break;
    for (const r of [1.4, 1.0, 0.75]) {
      const c = v3(sp.pos.x + Math.sin(sp.yaw + a) * r, camY, sp.pos.z + Math.cos(sp.yaw + a) * r);
      if (roomAt(c.x, c.z, sp.pos.y) !== room) continue;
      const q = c.clone(); collide(q, 0.12, sp.pos.y + 0.1, 0.6);
      if (dist2d(q, c) > 0.01) continue;
      camPos = c; break;
    }
  }
  if (!camPos) camPos = v3(sp.pos.x + Math.sin(sp.yaw) * 0.8, camY, sp.pos.z + Math.cos(sp.yaw) * 0.8);
  M.cam = { pos: camPos, look: head };
  sp.lookAt = camPos.clone(); sp.lookUntil = S.t + 99;
  for (const k of ['father', 'mother', 'lily', 'danny']) { F[k].nextTick = 0; F[k]._lastPose = null; F[k].update(0.001, S.t, 0, dog.pos); }
  let text = r.text;
  if (r.hl && text.includes(r.hl)) text = text.replace(r.hl, `<mark>${r.hl}</mark>`);
  const NAME = { father: 'TOM', mother: 'CLAIRE', lily: 'LILY', danny: 'DANNY' };
  ui.montageLine({ time: r.clock, who: NAME[r.who] || r.who, text, note: r.clue, clue: !!r.clue, idx: M.list.length - M.i });
  if (r.clue) AU.chime(); else AU.rewindWhir(0.35);
}
function endMontage() {
  const id = S.montage.id;
  S.montage = null;
  ui.montageShow(false);
  P.uFade.value = 1;
  ui.showEnding(ENDINGS[id], ENDING_TEXT(id), id);
}
export function skipMontage(all) {
  if (!S.montage) return;
  if (all) { S.montage.i = S.montage.list.length; endMontage(); return; }
  S.montage.t = S.montage.dur;
}
function updateMontage(dt) {
  const M = S.montage;
  M.t += dt;
  if (M.t >= M.dur) { nextMontage(); if (!S.montage) return; }
  const cam = ui.camera;
  cam.position.copy(M.cam.pos);
  cam.lookAt(M.cam.look);
  G.uAmbient.value.set(0.32, 0.3, 0.27);
  P.uSniff.value = 0.55; G.uSniff.value = 0;
  P.uFade.value = 0;
  for (const k of ['father', 'mother', 'lily', 'danny']) F[k].update(0.001, S.t, 0, dog.pos);
  F.danny.root.visible = F.danny.visible;
}

// ---------------------------------------------------------------------------
export function updateStory(dt) {
  if (S.montage) { updateMontage(dt); return; }
  if (S.ended) { S.fadeV = Math.min(1, (S.fadeV || 0) + dt * S.fadeSpeed); P.uFade.value = S.fadeV; return; }
  if (S.inspectOpen) { S.prompt = ''; return; }
  S.t += dt;
  // the vent dug clear: the furnace breathes out instead of back into the house
  if (S.coOn && !S.other) { S.coAcc += dt / CO_DUR * (S.yardDone.vent ? 0.55 : 1); S.co = Math.min(1, S.coAcc); }
  S.outside = isOutside(dog.pos.x, dog.pos.z, dog.y);
  const extra = inBasement() ? 0.12 : 0;
  // out in the clean cold air, your head clears
  const dogTarget = S.other ? 0 : Math.min(1, S.outside ? S.co * 0.3 : S.co + (S.coOn ? extra : 0));
  S.dogCO += (dogTarget - S.dogCO) * Math.min(1, dt * (dogTarget < S.dogCO ? 0.35 : 0.8));
  if (S.dogCO > 0.42 && once('poisonCard')) ui.card('The bad air is in you now', 'Your eyes are doubling and the edges of everything are going dark, in time with your heart. That is the poison, in you too. The longer you stay inside, the worse it gets. Clean air outside clears it, for a while. When it is this bad, do not stare at them: their faces go wrong.');
  G.uCO.value = S.dogCO * 0.9;
  P.uCO.value = S.dogCO;

  for (let i = S.timers.length - 1; i >= 0; i--) if (S.t >= S.timers[i].at) { const f = S.timers[i].fn; S.timers.splice(i, 1); f(); }

  if (S.other) { otherFrame(dt); return; }
  phaseUpdate(dt);
  scares(dt);
  updatePresence(dt);
  updateFollow(dt);
  updateLightning(dt);
  updateStool();
  updatePushDoors();
  updateDigging(dt);
  updateYard(dt);
  updateEscort(dt);
  updateFlashlight(dt);
  updateDread(dt);
  updateGuide(dt);
  // the time limit: how long the air in the house will let them live
  if (S.coOn && !S.ended) {
    const rate = S.yardDone.vent ? 0.55 : 1;
    ui.timer(Math.max(0, (1 - S.coAcc) * CO_DUR / rate));
  } else ui.timer(null);
  updateGlints(dt);
  updateLife(dt);
  updateAch(dt);
  if (S.jarFall) {
    // over the edge, tumbling, onto the floor
    const J = S.jarFall; J.t += dt; const k = Math.min(1, J.t / 0.55);
    refs.jar.position.set(J.x0 - k * 0.6, 0.94 + 0.08 * Math.sin(k * Math.PI) - 0.94 * k * k, J.z0);
    refs.jar.rotation.z = k * 1.8;
    if (k >= 1) S.jarFall = null;
  }
  // fear: your heart races, you slow down, you shake
  S.fearT = Math.max(0, (S.fearT || 0) - dt);
  dog.fear = Math.min(1, S.fearT / 4 + (S.stalkNear || 0) * 0.5);
  if (puzzle.drawerOpen && S.drawerAnim !== undefined && S.drawerAnim < 1) { S.drawerAnim = Math.min(1, S.drawerAnim + dt * 3); refs.drawer.position.z = -3.55 + S.drawerAnim * 0.3; }

  for (const h of [F.father, F.mother, F.lily]) if (h.override && S.t > h.override.until) h.override = null;
  familyGestures(dt);
  if (S.lullaby) S.lullaby.update();

  for (const h of [F.father, F.mother, F.lily, F.danny]) h.update(dt, S.t, S.co, dog.pos);
  F.danny.root.visible = F.danny.visible && Math.random() > 0.05;
  for (const h of [F.father, F.mother, F.lily]) {
    if (h.pose === 'sleep' || !sameFloor(h) || h.pos.y > 0.2) continue;
    const dx = dog.pos.x - h.pos.x, dz = dog.pos.z - h.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.42 && d > 1e-4) { dog.pos.x += dx / d * (0.42 - d); dog.pos.z += dz / d * (0.42 - d); }
  }
  for (const h of [F.father, F.mother, F.lily]) {
    if (awake(h) && !h.asleep && dist2d(h.pos, dog.pos) < 2 && Math.random() < dt * 0.3 && !(h.lookUntil > S.t)) h.look(dogHead(), 2 + Math.random() * 2, S.t);
    if (h.annoy && Math.random() < dt / 20) h.annoy--;
    if (S.dogCO > 0.5 && !h.asleep) {
      const to = v3(h.pos.x - dog.pos.x, 0, h.pos.z - dog.pos.z); const d = to.length();
      const looking = d < 3 && dogForward().dot(to.normalize()) > 0.93;
      h.gaze = looking ? (h.gaze || 0) + dt : 0;
      if (h.gaze > 1.8 && !h.wrongFace && once('gazeWrong')) { h.setFace(true); AU.stinger(0.3); later(1.2, () => h.setFace(false)); }
    }
  }

  if (input.eDown && !input.eUsedHold && !dog.carrying) {
    const held = (performance.now() - input.eStart) / 1000;
    const h = nearestHuman(1.3);
    if (h && h !== F.lily && held > 1.1) { input.eUsedHold = true; if (!awake(h)) wake(h); if (awake(h)) bite(h); }
  }
  if (input.cDown && dist2d(dog.pos, spots.dogBed) < 0.6 && !S.cut) {
    S.bedHold += dt;
    if (S.bedHold > 3) { S.bedHold = -99; sleepInBed(); }
  } else if (S.bedHold > 0) S.bedHold = 0; else if (!input.cDown) S.bedHold = 0;

  if (S.tvOn) {
    S.tvAcc = (S.tvAcc || 0) - dt;
    if (S.tvAcc <= 0) { S.tvAcc = 0.07; updateTV(S.t, S.tvFace > 0); }
    S.tvFace -= dt;
    lights[2].intensity = 0.7 + Math.random() * 0.4;
    refs.tvScreen.material.uniforms.uColor.value.setScalar(1);
  } else refs.tvScreen.material.uniforms.uColor.value.setScalar(0.05);
  refs.lampShade.material.uniforms.uEmissive.value.setScalar(lights[1].on ? 0.3 : 0);

  S.clockAcc += dt;
  const tickEvery = S.co > 0.6 ? 1 + Math.sin(S.t) * 0.6 : 1;
  if (S.clockAcc > tickEvery && !S.clockStopped) { S.clockAcc = 0; AU.clockTick(12.8, 2, 5.1, 0.6); refs.clockHand.rotation.z -= Math.PI / 30; }

  if ((S.dogCO > 0.42 || (S.stalkNear || 0) > 0.2 || (dog.fear || 0) > 0.3) && S.t > S.nextBeat) {
    const bpm = 62 + S.dogCO * 70 + (S.presenceActive ? 50 : 0) + (S.stalkNear || 0) * 60 + (dog.fear || 0) * 30;
    S.nextBeat = S.t + 60 / bpm;
    AU.heartbeat(Math.max(0.15, (S.dogCO - 0.4) * 0.9) + (S.presenceActive ? 0.3 : 0) + (S.stalkNear || 0) * 0.4);
    S.pulse = 1;
  }
  S.pulse = Math.max(0, (S.pulse || 0) - dt * 5);
  P.uPulse.value = S.pulse;
  P.uStretch.value = Math.max(0, Math.min(1, (S.co - 0.78) * 4));

  if (S.dogCO > 0.85 && Math.random() < dt * 0.06) S.blackout = 0.6 + Math.random() * 0.6;
  S.blackout = Math.max(0, S.blackout - dt);
  P.uBlackout.value = Math.min(1, S.blackout * 2);
  jumpscareStep(dt);
  emitScents(dt);
  houseTail(dt);
}
function otherFrame(dt) {
  updateOther(dt);
  updateGuide(dt);
  ui.timer(null);
  if (S.oStage !== 'throw') P.uFlash.value = Math.max(0, P.uFlash.value - dt * 1.5);
  S.blackout = Math.max(0, S.blackout - dt);
  P.uBlackout.value = Math.min(1, S.blackout * 2);
  S.pulse = Math.max(0, (S.pulse || 0) - dt * 5); P.uPulse.value = S.pulse;
  P.uCO.value = 0; G.uCO.value = 0; P.uStretch.value = 0; P.uSniff.value = 0; G.uSniff.value = 0;
  jumpscareStep(dt);
  S.label = ''; S.prompt = otherPrompt();
  const ft = S.fade || 0;
  S.fadeV = (S.fadeV || 0) + (ft - (S.fadeV || 0)) * Math.min(1, dt * (S.fadeSpeed || 2) * 2);
  P.uFade.value = Math.max(S.fadeV, 0);
  AU.updateAmbience(0.2, S.t, 0.6);
}
function jumpscareStep(dt) {
  if (S.jumpscare > 0) {
    S.jumpscare -= dt;
    const p = S.presence;
    p.root.visible = true;
    const cam = ui.camera;
    const f = dogForward();
    p.root.position.set(cam.position.x + f.x * 0.55, cam.position.y - p.headH, cam.position.z + f.z * 0.55);
    p.root.rotation.set(0, dog.yaw, 0);
    p.monster.update(S.t, dt, 'scare');
    // put its face right in front of yours, whatever shape it is
    p.root.updateMatrixWorld(true);
    const fp = p.monster.face.getWorldPosition(v3());
    const near = 0.66 - (1.2 - S.jumpscare) * 0.14;
    p.root.position.x += cam.position.x + f.x * near - fp.x;
    p.root.position.y += cam.position.y - 0.02 - fp.y;
    p.root.position.z += cam.position.z + f.z * near - fp.z;
    P.uRed.value = 0.7;
  } else P.uRed.value = Math.max(0, (S.redFlash || 0));
  S.redFlash = Math.max(0, (S.redFlash || 0) - dt);
}
function houseTail(dt) {
  P.uFlash.value = Math.max(0, P.uFlash.value - dt * 0.45);
  G.uFogNear.value = 3.0;
  const sniffTarget = input.sniff ? 1 : 0;
  S.sniff += (sniffTarget - S.sniff) * Math.min(1, dt * 6);
  G.uSniff.value = S.sniff;
  P.uSniff.value = S.sniff;
  if (input.sniff && S.deep && !S.outside && !inBasement()) dreadOnce('prints');
  if (input.sniff) { S.sniffSnd = (S.sniffSnd || 0) - dt; if (S.sniffSnd <= 0) { S.sniffSnd = 2.6; AU.sniffSnd(S.outside); } } else S.sniffSnd = 0; // one when you start, then now and then
  S.label = S.sniff > 0.5 ? sniffLabel() : '';
  S.prompt = computePrompt();

  const ft = S.fade || 0;
  S.fadeV = (S.fadeV || 0) + (ft - (S.fadeV || 0)) * Math.min(1, dt * (S.fadeSpeed || 2) * 2);
  P.uFade.value = Math.max(S.fadeV, 0);

  AU.updateAmbience(S.coOn ? S.dogCO + 0.02 : 0, S.t, (S.windBoost || 0) + (S.outside ? 0.45 : 0));
  // out under the sky: brighter snow-light, longer sight, paler fog
  S.outK = (S.outK || 0) + ((S.outside ? 1 : 0) - (S.outK || 0)) * Math.min(1, dt * 1.5);
  const ok = S.outK;
  // with the power out, the house is nearly black: what you can see, you see by lightning and the flashlight
  const dk = S.power === false && !S.outside ? 0.62 : 1;
  G.uAmbient.value.set((0.15 + ok * 0.0) * dk + S.flash * 0.1, (0.15 + ok * 0.01) * dk + S.flash * 0.1, (0.18 + ok * 0.01) * dk + S.flash * 0.12);
  G.uCamLight.value.set(0.46, 0.43, 0.4);
  G.uFogFar.value = 15 + ok * 3;
  G.uFogColor.value.set(0.05 + ok * 0.03, 0.048 + ok * 0.035, 0.055 + ok * 0.05);
  if (S.debugLight) G.uAmbient.value.setScalar(S.debugLight); // testing aid only
}

// testing hooks
function startOther() { S.ch = 9; S.furnaceMaw = true; for (const id of ['intro1', 'intro2', 'trackCard', 'poisonCard']) S.fired.add(id); enterOther(); }
export const DBG = { startOther, otherStage: (st) => jumpToStage(st), comeHome: () => comeHomeReal(), finale, monsterRoom, powerCut, startLightsOut, lightning, ignite, motherToBed, startWakeChapter, checkBasement, startYardChapter, startBasementChapter, checkYard, finish };
