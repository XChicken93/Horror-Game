// The night of December 13th, 1998. Six chapters, the family's schedule, the puzzles,
// the scares, the endings, and the rewind through everything they said.
import * as THREE from '../vendor/three.module.js';
import { G, P } from './ps1.js';
import { T, updateTV, updateWindow } from './textures.js';
import * as AU from './audio.js';
import { doors, lights, items, spots, refs, windows, roomAt, floorAt, collide, BASE_Y } from './house.js';
import { Human, speechLog, showSubtitle, learnWords, VOCAB_STATE, speechHook, LABEL } from './humans.js';
import { emit, SCENT, DANNY_TRAIL, DANNY_TRAIL_DOWN } from './scent.js';
import { dog, input, inBasement, dogForward } from './player.js';
import { inspectables, puzzle, DOCS, PHOTOS } from './lore.js';

export const S = {
  t: 0, co: 0, dogCO: 0, coOn: false, coT0: 0, strikes: 0, fired: new Set(), locked: false, ended: false, cut: null,
  scratches: 0, flash: 0, nextLightning: 22, figureFlash: false, ch: 1,
  tvOn: true, tvFace: 0, nextBeat: 0, blackout: 0, presence: null, presenceActive: false, presenceSleep: 0,
  jumpscare: 0, sniff: 0, label: '', prompt: '', follow: null, lastWindow: 0, deep: false,
  ghostState: null, clockAcc: 0, bedHold: 0, lullaby: null, crayons: 0, inspectOpen: null, timers: [],
  got: { jacketUp: false, tagUp: false }, father: { tag: false, jacket: false }, alarmOn: false, alarmDone: false,
};

const CO_DUR = 1500; // from the moment the furnace lights, the house has about 25 minutes
let F, scene, ui;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// What Biscuit learns. Each puzzle solved unlocks a group of words.
const WORDS = {
  dinner: ['i', 'me', 'my', 'your', 'the', 'a', 'is', 'it', 'its', 'im', 'to', 'and', 'again', 'dinner', 'forgot', 'sorry', 'eat', 'hungry', 'oh', 'yes', 'what', 'where', 'there', 'here', 'all', 'just', 'so', 'some'],
  crayons: ['lily', 'mommy', 'daddy', 'mom', 'dad', 'house', 'under', 'heaven', 'hear', 'he', 'him', 'his', 'she', 'her', 'that', 'thats', 'this', 'look', 'our', 'we', 'at', 'in', 'on', 'can', 'cant', 'find', 'red', 'blue', 'yellow', 'black', 'crayons', 'lost', 'please', 'says', 'but', 'now', 'are', 'was', 'be', 'made', 'did', 'go', 'family', 'night', 'lives', 'whos', 'who', 'one'],
  door: ['basement', 'door', 'hook', 'reach', 'dark', 'scared', 'voice', 'talking', 'heater', 'calling', 'open', 'latch', 'every', 'time', 'kicks', 'pulls', 'fix', 'going', 'get', 'up', 'too', 'dont', 'do', 'not', 'of', 'for', 'with', 'someone', 'downstairs', 'wants', 'first', 'bring', 'back', 'need', 'something', 'stand', 'are', 'hey', 'hear', 'holding', 'only', 'was', 'were'],
  room: ['furnace', 'smoke', 'alarm', 'thing', 'beeping', 'chirping', 'battery', 'took', 'out', 'new', 'check', 'broken', 'heat', 'turned', 'turning', 'seventy-eight', 'freezing', 'noise', 'making', 'weekend', 'tomorrow', 'year', 'room', 'key', 'never', 'nobody', 'tell', 'minute', 'lie', 'tonight', 'been', 'day', 'whole', 'will', 'ill', 'put', 'kitchen', 'said', 'always', 'smells', 'like', 'still', 'cold', 'its'],
  pond: ['pond', 'ice', 'coat', 'jacket', 'storm', 'looking', 'ran', 'went', 'without', 'deer', 'after', 'christmas', 'wait', 'could', 'thought', 'drawer', 'god', 'head', 'headache', 'tired', 'sleep', 'feel', 'think', 'air', 'wrong', 'everybody', 'worst', 'pressure', 'did', 'why', 'hard', 'killing', 'gone', 'found', 'never', 'blamed', 'sweetheart', 'warning', 'us'],
};
function learn(group, why) {
  const fresh = learnWords(WORDS[group]);
  if (fresh.length) { ui.vocab(why, fresh); AU.chime(); }
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
  // Danny: warm, gold, gentle. He is not the thing that chases you.
  for (const m of F.danny.mats) m.uniforms.uEmissive.value.set(0.22, 0.17, 0.06);
  speechHook.fn = (rec) => { rec.snap = snapshot(); rec.clock = clockStr(S.t); };
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
function lightning(withFigure = false) {
  let best = windows[0], bd = 1e9;
  for (const w of windows) { const d = w.pos.distanceTo(dog.pos); if (d < bd) { bd = d; best = w; } }
  lights[7].pos.copy(best.pos).addScaledVector(best.out, 2.5);
  lights[7].pos.y = 2.2;
  S.flashSeq = [[0, 1], [0.07, 0.1], [0.14, 0.85], [0.3, 0]];
  S.flashT = 0;
  S.figureFlash = withFigure;
  AU.thunder(1 + Math.random() * 0.6);
}
function updateLightning(dt) {
  if (S.flashSeq) {
    S.flashT += dt;
    let v = 0;
    for (const [tt, val] of S.flashSeq) if (S.flashT >= tt) v = val;
    if (S.flashT > 0.5) { S.flashSeq = null; v = 0; S.figureFlash = false; }
    S.flash = v;
  } else S.flash = Math.max(0, S.flash - dt * 4);
  lights[7].intensity = S.flash * (inBasement() ? 0.15 : 2.4);
  P.uFlash.value = S.flash * (inBasement() ? 0.02 : 0.12);
  S.lastWindow -= dt;
  if (S.flash > 0.01 || S.lastWindow <= 0) { updateWindow(S.flash, S.figureFlash); S.lastWindow = 0.12; }
  if (S.t > S.nextLightning) { lightning(); S.nextLightning = S.t + 25 + Math.random() * 30; }
}

// ===========================================================================
// CHAPTERS
function feedBiscuit(m) {
  // Chapter 1: she fills your bowl
  const b = puzzle.bowl;
  b.gone = true; b.mesh.visible = false;
  m.look(dogHead(), 4, S.t);
  say(m, "Oh, Biscuit. I'm sorry. I forgot your dinner again. I forget everything lately.", 'sad');
  later(2.5, () => {
    b.mesh.position.copy(b.home); b.mesh.rotation.set(0, 0, 0); b.mesh.visible = true; b.gone = false;
    b.kibble.visible = true; b.full = true; b.label = 'your full bowl';
    AU.pickup();
    setObj('Eat your dinner.');
  });
}
function eatDinner() {
  const b = puzzle.bowl;
  b.full = false; b.kibble.visible = false; b.label = 'your empty bowl';
  AU.eat();
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
  say(l, 'Biscuit! I lost my crayons. Can you find them? The red one, the blue one, the yellow one and the black one. Please?', 'calm');
  updateCrayonObj();
  // the grown-ups talk. Biscuit catches more of it than before.
  later(14, () => {
    const m = F.mother;
    m.setActivity({ spot: v3(12.6, 0, 4.05), face: Math.PI, pose: 'stand' });
    later(6, () => say(m, "It's freezing in here. I'm turning the heat up to seventy-eight.", 'calm', { clue: 'The thermostat went up to 78. The furnace would run hard all night.', hl: 'seventy-eight' }));
    later(11, () => m.setActivity({ spot: spots.sink.clone(), face: 0, pose: 'sink' }));
  });
  later(30, () => say(F.father, "Furnace has been making that noise again. I'll look at it this weekend.", 'calm', { clue: 'He already knew something was wrong with it. He had known since November.', hl: "I'll look at it this weekend" }));
  later(44, () => say(F.mother, 'And that alarm thing in the kitchen kept chirping all day, so I took the battery out. I will get a new one tomorrow.', 'calm', { clue: 'It was not a smoke alarm. It was the carbon monoxide detector, warning them. She silenced it.', hl: 'so I took the battery out' }));
  later(58, () => say(F.father, 'Did you call the gas company back?', 'calm'));
  later(62, () => say(F.mother, 'No. After Christmas. We cannot afford it before Christmas.', 'sad', { clue: 'The gas company had already been. They left a red tag on the furnace.', hl: 'After Christmas' }));
}
function updateCrayonObj() { setObj(`The girl lost her coloured sticks. Find them and bring them to her. (${S.crayons}/4)`); }
function giveCrayon(it) {
  const l = F.lily;
  it.gone = true; it.mesh.visible = false;
  S.crayons++;
  const lines = ['Red! Good boy!', 'Blue! You found it!', 'Yellow! You are so smart, Biscuit.', 'Black. That is the last one!'];
  say(l, lines[Math.min(3, S.crayons - 1)], 'calm');
  updateCrayonObj();
  if (S.crayons >= 4) later(3, finishDrawing);
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
  S.coOn = true; S.coT0 = S.t;
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
  say(mother, 'I am going to lie down. My head is killing me.', 'sleepy', { clue: 'Headache, confusion and sleepiness: the first signs of carbon monoxide poisoning.', hl: 'My head is killing me' });
  later(2.5, () => {
    lights[0].on = false;
    mother.setActivity({ spot: spots.parentBedM.clone(), pose: 'sleep', face: 0 });
    puzzle.letterOut = true; refs.letter.visible = true;
    puzzle.key.gone = false; puzzle.key.mesh.visible = true;
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
  later(8, () => setObj('Danny\'s door has been shut for a year. The woman keeps its key. (The basement is open too.)'));
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
  if (!once('notebookLearn')) return;
  learn('room', 'Danny talked about the hot box and the beeping thing all the time. Now the words connect.');
  checkCh5Obj();
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
  checkCh5Obj();
}
function checkCh5Obj() {
  if (S.ch >= 6) return;
  const j = S.got.jacketUp ? '[x]' : '[ ]', t = S.got.tagUp ? '[x]' : '[ ]';
  if (puzzle.dannyOpen || S.fired.has('basementGhost')) setObj(`Find what Danny wants you to find. Carry it up out of the basement.  ${j} his jacket  ${t} a red paper`);
  if (S.got.jacketUp && S.got.tagUp) startWakeChapter();
}
function startWakeChapter() {
  if (S.ch >= 6) return;
  S.ch = 6;
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
  later(3, () => {
    S.cut = null;
    S.finalFollow = true;
    f.asleep = false; f.awakeUntil = S.t + 99999;
    setObj('Lead him out. To the front door, and the cold, clean air.');
  });
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

  // middle of the night
  if (co > 0.2 && !puzzle.dannyOpen && once('dannyLight')) { refs.dannyDoorLight.visible = true; S.dannyLightOn = true; }
  if (co > 0.3 && once('knock')) {
    AU.knock(1.5, 1.2, 10.2, 3, 1.1);
    later(3, () => { if (!S.deep && awake(father) && father.pose !== 'sleep') say(father, 'Who the hell is out in this?', 'calm'); });
  }
  if (co > 0.42 && once('basementLullaby')) AU.lullaby(() => [9.5, BASE_Y + 1.2, -2.5], 0.8, 0.75);
  if (co > 0.62 && once('wrongPhotos')) { refs.photoWrong(); AU.stinger(0.4); }
  if (co > 0.62) { for (const h of [father, mother]) if (h.asleep && h.pose === 'sleep' && S.t > h.awakeUntil) h.setFace(true); }
  if (co > 0.9) for (const h of [father, mother, lily]) if (!S.alarmOn && !S.finalFollow) h.unconscious = true;
  if (co > 0.92 && lily.pose === 'sit' && !S.alarmDone && once('lilyFaints')) { lily.setActivity({ spot: spots.lilyBed.clone(), pose: 'sleep', face: 0 }); }
  if (co >= 1 && !S.ended && !S.cut) endByTime();

  // the finale: leading him out
  if (S.finalFollow) {
    father.speed = 1.0;
    S.ffRepath = (S.ffRepath || 0) - dt;
    if (S.ffRepath <= 0) {
      S.ffRepath = 1.5;
      if (dist2d(father.pos, dog.pos) > 1.3) { const tgt = v3(dog.pos.x, 0, dog.pos.z); father.goTo(tgt); }
      else father.path = [];
    }
    father.look(dogHead(), 1, S.t);
    if (dist2d(father.pos, spots.frontDoor) < 1.6 && dist2d(dog.pos, spots.frontDoor) < 1.8 && once('frontDoor')) {
      S.finalFollow = false; S.cut = 'home';
      father.path = []; father.yaw = Math.PI; father.pose = 'stand';
      doors.front.target = 1.6; doors.front.speed = 2; AU.creak(1.5, 1, 10, 1); S.windBoost = 0.7;
      say(father, 'Air. Cold air. Biscuit, stay. Stay right here. I am getting them. CLAIRE!', 'sharp');
      later(5, () => finish('home'));
    }
  }
}

// ---------------------------------------------------------------------------
// Scares and guidance that depend on where Biscuit is
function scares(dt) {
  const { danny } = F;
  const room = roomAt(dog.pos.x, dog.pos.z, dog.y);
  const fwd = dogForward();
  if (S.coOn && room === 'living' && S.tvOn && !S.fired.has('tvFace')) {
    const to = v3(8 - dog.pos.x, 0, 5.7 - dog.pos.z); const d = to.length(); to.normalize();
    if (d < 4 && fwd.dot(to) > 0.85) { S.fired.add('tvFace'); S.tvFace = 0.35; AU.stinger(0.6); }
  }
  if (S.co > 0.18 && room === 'living' && once('figure')) lightning(true);
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
    checkCh5Obj();
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
    } else if (g.kind === 'drawer') {
      if (dist2d(dog.pos, danny.pos) < 1.6 || g.t > 30) { danny.visible = false; S.ghostState = null; }
    }
  }
  // the furnace
  refs.grilleMat.uniforms.map.value = S.dogCO > 0.55 || S.presenceActive ? T.grilleTeeth : T.grille;
  const br = 0.6 + 0.4 * Math.sin(S.t * (0.5 + S.co * 0.6));
  refs.grilleMat.uniforms.uColor.value.setScalar(S.coOn ? 0.5 + br * 0.6 : 0.1);
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
    lights[4].on = false; S.presenceActive = true; S.presence.setPos(spots.furnace.x, spots.furnace.z, BASE_Y);
    if (once('presenceCard')) ui.card('It is not Danny.', 'Danny smelled of snow and pencils. This smells of the hot box, of the bad air that has been filling the house. It has no shape. Your poisoned head is giving it one. RUN. Up the stairs.');
  });
}
function updatePresence(dt) {
  const p = S.presence;
  if (!S.presenceActive) { p.root.visible = false; return; }
  if (S.presenceSleep > 0) { S.presenceSleep -= dt; p.root.visible = false; return; }
  p.visible = true;
  const target = dog.pos;
  const d = Math.hypot(target.x - p.pos.x, target.z - p.pos.z);
  p.speed = 1.5 + S.co * 1.2;
  p.path = [v3(target.x, 0, target.z)];
  p.update(dt, S.t, 0, dog.pos);
  p.pos.y = floorAt(p.pos.x, p.pos.z, p.pos.y);
  p.root.position.y = p.pos.y;
  for (const a of p.arms) a.sh.rotation.x = -1.45 + Math.sin(S.t * 9) * 0.05;
  p.root.visible = Math.random() > 0.06;
  for (let i = 0; i < 3; i++) emit(p.pos.x, p.pos.y + 0.6 + Math.random() * 1.6, p.pos.z, 'wrong', { spread: 0.5, life: 1.5, size: 0.06 });
  if (!inBasement() || dog.y > -0.25) { S.presenceActive = false; p.root.visible = false; AU.stinger(0.4); return; }
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
    p.pos.set(spots.furnace.x, BASE_Y, spots.furnace.z);
    S.coT0 -= 20; // it costs you
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
  const { father, mother, lily } = F;
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
export function onWhine() {
  if (S.ended || S.cut || S.inspectOpen) return;
  AU.whine();
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
const nearFullBowl = () => puzzle.bowl.full && !puzzle.bowl.carried && dist2d(dog.pos, puzzle.bowl.mesh.position) < 0.7;

export function onInteract() {
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
  if (nearRope()) { pullDrawer(); return; }
  if (nearStool()) { grabStool(); return; }
  const h = nearestHuman(1.3);
  if (h) { tug(h); return; }
  const dn = nearestDoor();
  if (dn) { scratchDoor(dn); return; }
}

function openInspect(def) {
  S.inspectOpen = def; def.read = true;
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
  if (def.id === 'clipping') readClipping();
  if (def.id === 'letter' && once('letterLearn')) learn('room', 'Her letter. Biscuit cannot read it, but he knows her voice when she reads to herself.');
}

function grabStool() {
  const st = puzzle.stool;
  st.dragging = true; puzzle.setStoolCol();
  AU.drawer(st.mesh.position.x, 0.2, st.mesh.position.z);
}
function releaseStool() {
  const st = puzzle.stool;
  if (!st.dragging) return;
  st.dragging = false; puzzle.setStoolCol();
  AU.knock(st.mesh.position.x, 0.1, st.mesh.position.z, 1, 0.4);
}
function updateStool() {
  const st = puzzle.stool;
  if (!st.dragging) return;
  if (inBasement() || dog.y < -0.2) { releaseStool(); return; }
  const f = dogForward();
  const p = v3(dog.pos.x + f.x * 0.5, 0, dog.pos.z + f.z * 0.5);
  collide(p, 0.18, 0, 0.35);
  st.mesh.position.set(p.x, 0, p.z);
  st.mesh.rotation.y = dog.yaw;
  S.stoolScrape = (S.stoolScrape || 0) - 1 / 60;
  if (dog.moving && S.stoolScrape <= 0) { S.stoolScrape = 0.45; AU.drawer(p.x, 0.1, p.z); }
}
function pullDrawer() {
  puzzle.drawerOpen = true;
  AU.drawer(10.5, BASE_Y + 0.7, -3.4);
  refs.drawerRope.visible = false;
  S.drawerAnim = 0;
  later(0.7, () => { const t = puzzle.tag; t.gone = false; t.mesh.visible = true; });
}

function pickItem(it) {
  it.carried = true;
  dog.carrying = it;
  dog.mouth.add(it.mesh);
  it.mesh.position.set(0, 0, 0);
  it.mesh.rotation.set(0, it.name === 'jacket' ? Math.PI / 2 : 0.4, 0.2);
  it.mesh.scale.setScalar(it.name === 'jacket' ? 0.45 : it.name === 'bowl' ? 0.7 : 0.8);
  AU.pickup();
  if ((it === puzzle.jacket || it === puzzle.tag) && inBasement()) wakePresence();
}

function dropItem(it, silent) {
  it.carried = false; dog.carrying = null;
  scene.attach(it.mesh);
  const f = dogForward();
  const x = dog.pos.x + f.x * 0.35, z = dog.pos.z + f.z * 0.35;
  it.mesh.position.set(x, floorAt(x, z, dog.y) + 0.03, z);
  it.mesh.rotation.set(0, dog.yaw, 0);
  it.mesh.scale.setScalar(1);
  if (!inBasement() && dog.y > -0.3) {
    if (it === puzzle.jacket && !S.got.jacketUp) { S.got.jacketUp = true; checkCh5Obj(); }
    if (it === puzzle.tag && !S.got.tagUp) { S.got.tagUp = true; checkCh5Obj(); }
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
    if (h === mother && S.ch === 1 && !it.full) return feedBiscuit(h);
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
    if (h === lily && S.ch >= 6 && !S.alarmDone && !S.alarmOn) { it.gone = true; it.mesh.visible = false; return lilyFixesAlarm(); }
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
  if (n === 'leash') return say(h, 'No walk tonight, buddy. Not in this storm.', 'calm');
  if (n === 'drawing') {
    if (h === lily) return say(h, 'You like it? Danny is the one under the house. He has yellow eyes because it is dark down there.', 'calm');
    return say(h, 'Oh... oh, Lily.', 'sad');
  }
}

function tug(h) {
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
  if (inBasement()) {
    S.follow = null;
    say(h, 'Biscuit! Get out of there! Come up here. Come!', 'sharp');
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
  AU.bark(1.3); AU.scream();
  dog.barkKick = 2;
  S.redFlash = 0.8;
  if (S.co >= 0.3) { badDogEnding(h); return; }
  say(h, 'AGH! He BIT me! Biscuit! What the hell!', 'sharp');
  S.strikes = 3;
  if (awake(F.father) || h === F.father) later(1.8, lockUp);
}
function scratchDoor(name) {
  AU.scratch();
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
    emit(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f + 0.05, a[2] + (b[2] - a[2]) * f, 'danny', { spread: 0.15, life: 3, vy: 0.01, size: 0.025 });
  }
  for (const it of items) {
    if (it.gone || !it.mesh.visible) continue;
    const p = new THREE.Vector3(); it.mesh.getWorldPosition(p);
    if (it.name === 'jacket' && Math.random() < 0.5 * k) emit(p.x, p.y + 0.05, p.z, 'dannyStrong', { spread: 0.35, life: 2.5, vy: 0.08, size: 0.04 });
    if (it.name === 'ball' && Math.random() < 0.08 * k) emit(p.x, p.y, p.z, 'dannyFaint', { spread: 0.1, life: 2 });
    if ((it.crayon || it.name === 'drawing') && Math.random() < 0.2 * k) emit(p.x, p.y + 0.05, p.z, 'lily', { spread: 0.15, life: 2, vy: 0.06 });
    if ((it.name === 'key' || it.name === 'tag') && Math.random() < 0.2 * k) emit(p.x, p.y + 0.05, p.z, it.name === 'key' ? 'mother' : 'father', { spread: 0.15, life: 2, vy: 0.06 });
    if (it.name === 'battery' && S.ch >= 6 && Math.random() < 0.2 * k) emit(p.x, p.y + 0.05, p.z, 'mother', { spread: 0.15, life: 2, vy: 0.06 });
  }
  if (Math.random() < 0.05 * k) emit(spots.bowl.x, 0.08, spots.bowl.z + 0.4, 'food', { spread: 0.3, life: 2 });
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
  cand.push([dist2d(p, v3(1.5, 0, 9.9)) - 0.3, 'outside']);
  cand.sort((a, b) => a[0] - b[0]);
  if (!cand.length || cand[0][0] > 2.2) return '';
  const s = SCENT[cand[0][1]];
  const c = s.col.map((v) => Math.round(v * 255)).join(',');
  return `<span style="color:rgb(${c})">${s.label}</span> — ${s.desc}`;
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
  if (it) return `<b>E</b> take ${it.label} in your mouth`;
  if (ins && !ins.item) return '<b>E</b> look again';
  if (nearRope()) return '<b>E</b> pull the rope';
  if (nearStool()) return '<b>E</b> push the stool with your nose';
  const h = nearestHuman(1.3);
  if (h) {
    if (!awake(h)) return `<b>E</b> nudge · <b>SPACE</b> bark to wake`;
    return h === F.lily ? `<b>E</b> tug her sleeve` : `<b>E</b> tug sleeve · hold <b>E</b> bite`;
  }
  if (nearestDoor()) return `<b>E</b> scratch the door`;
  if (dist2d(dog.pos, spots.dogBed) < 0.6) return `hold <b>C</b> lie down in your bed`;
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
    case 'home': return [
      'He carried Lily out in his arms and half dragged Claire through the snow, and they stood in the yard in their pajamas, breathing.',
      'The fire department shut off the gas at 4 a.m. The technician who had red-tagged the furnace came himself. He said another hour.',
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
  try {
    const found = JSON.parse(localStorage.getItem('goodboy_endings') || '[]');
    if (!found.includes(id)) found.push(id);
    localStorage.setItem('goodboy_endings', JSON.stringify(found));
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
  if (S.coOn) S.co = Math.max(S.co, Math.min(1, (S.t - S.coT0) / CO_DUR));
  const extra = inBasement() ? 0.12 : 0;
  S.dogCO = Math.min(1, S.co + (S.coOn ? extra : 0));
  G.uCO.value = S.dogCO * 0.9;
  P.uCO.value = S.dogCO;

  for (let i = S.timers.length - 1; i >= 0; i--) if (S.t >= S.timers[i].at) { const f = S.timers[i].fn; S.timers.splice(i, 1); f(); }

  phaseUpdate(dt);
  scares(dt);
  updatePresence(dt);
  updateFollow(dt);
  updateLightning(dt);
  updateStool();
  if (puzzle.drawerOpen && S.drawerAnim !== undefined && S.drawerAnim < 1) { S.drawerAnim = Math.min(1, S.drawerAnim + dt * 3); refs.drawer.position.z = -3.55 + S.drawerAnim * 0.3; }

  const m = F.mother;
  if (m.override && S.t > m.override.until) m.override = null;
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
      if (h.gaze > 1.8 && !h.wrongFace) { h.setFace(true); AU.stinger(0.3); later(1.2, () => h.setFace(false)); }
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
  if (S.clockAcc > tickEvery) { S.clockAcc = 0; AU.clockTick(12.8, 2, 5.1, 0.6); refs.clockHand.rotation.z -= Math.PI / 30; }

  if (S.dogCO > 0.42 && S.t > S.nextBeat) {
    const bpm = 62 + S.dogCO * 70 + (S.presenceActive ? 50 : 0);
    S.nextBeat = S.t + 60 / bpm;
    AU.heartbeat((S.dogCO - 0.4) * 0.9 + (S.presenceActive ? 0.3 : 0));
    S.pulse = 1;
  }
  S.pulse = Math.max(0, (S.pulse || 0) - dt * 5);
  P.uPulse.value = S.pulse;
  P.uStretch.value = Math.max(0, Math.min(1, (S.co - 0.78) * 4));

  if (S.dogCO > 0.85 && Math.random() < dt * 0.06) S.blackout = 0.6 + Math.random() * 0.6;
  S.blackout = Math.max(0, S.blackout - dt);
  P.uBlackout.value = Math.min(1, S.blackout * 2);
  if (S.jumpscare > 0) {
    S.jumpscare -= dt;
    const p = S.presence;
    p.root.visible = true;
    const cam = ui.camera;
    const f = dogForward();
    p.root.position.set(cam.position.x + f.x * 0.55, cam.position.y - p.headH - 0.05, cam.position.z + f.z * 0.55);
    p.root.rotation.set(0, dog.yaw, 0);
    p.neck.rotation.set(0.2, 0, Math.sin(S.t * 40) * 0.2);
    P.uRed.value = 0.7;
  } else P.uRed.value = Math.max(0, (S.redFlash || 0));
  S.redFlash = Math.max(0, (S.redFlash || 0) - dt);

  emitScents(dt);
  const sniffTarget = input.sniff ? 1 : 0;
  S.sniff += (sniffTarget - S.sniff) * Math.min(1, dt * 6);
  G.uSniff.value = S.sniff;
  P.uSniff.value = S.sniff;
  if (input.sniff) { S.sniffSnd = (S.sniffSnd || 0) - dt; if (S.sniffSnd <= 0) { S.sniffSnd = 0.35; AU.step('soft'); } }
  S.label = S.sniff > 0.5 ? sniffLabel() : '';
  S.prompt = computePrompt();

  const ft = S.fade || 0;
  S.fadeV = (S.fadeV || 0) + (ft - (S.fadeV || 0)) * Math.min(1, dt * (S.fadeSpeed || 2) * 2);
  P.uFade.value = Math.max(S.fadeV, 0);

  AU.updateAmbience(S.coOn ? S.dogCO + 0.02 : 0, S.t, S.windBoost || 0);
  G.uAmbient.value.set(0.06 + S.flash * 0.1, 0.065 + S.flash * 0.1, 0.095 + S.flash * 0.12);
  if (S.debugLight) G.uAmbient.value.setScalar(S.debugLight); // testing aid only
}

// testing hooks
export const DBG = { ignite, motherToBed, startWakeChapter, checkCh5Obj, finish };
