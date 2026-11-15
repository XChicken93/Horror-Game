// The night of December 13th, 1998. Timeline, reactions, scares and endings.
import * as THREE from '../vendor/three.module.js';
import { G, P } from './ps1.js';
import { T, updateTV, updateWindow } from './textures.js';
import * as AU from './audio.js';
import { doors, lights, items, spots, refs, windows, roomAt, floorAt, BASE_Y } from './house.js';
import { Human, speechLog, showSubtitle } from './humans.js';
import { emit, SCENT, DANNY_TRAIL, DANNY_TRAIL_DOWN } from './scent.js';
import { dog, input, inBasement, dogForward } from './player.js';

export const S = {
  t: 0, co: 0, dogCO: 0, strikes: 0, fired: new Set(), locked: false, ended: false, cut: null,
  scratches: 0, closedCount: 0, doorReopenAt: 0, flash: 0, nextLightning: 22, figureFlash: false,
  tvOn: true, tvFace: 0, nextBeat: 0, blackout: 0, presence: null, presenceActive: false, presenceSleep: 0,
  jumpscare: 0, sniff: 0, label: '', prompt: '', lilyAt: false, follow: null, lastWindow: 0,
  ghostState: null, clockAcc: 0, bedHold: 0, wrongShown: false, lullaby: null,
};

const CO_START = 70, CO_DUR = 840; // the furnace kills a house in about 15 minutes of game time
let F, scene, ui;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

export function initStory(family, sc, uiRefs) {
  F = family; scene = sc; ui = uiRefs;
  const { father, mother, lily } = F;
  father.setPos(8.25, 7.55); father.yaw = Math.PI; father.activity = { spot: spots.armchair.clone(), face: Math.PI, pose: 'sit' }; father.settle();
  mother.setPos(11.75, 9.15); mother.yaw = 0; mother.activity = { spot: spots.sink.clone(), face: 0, pose: 'sink' }; mother.settle();
  lily.setPos(5.3, 6.55); lily.yaw = 2.6; lily.activity = { spot: spots.lilyDraw.clone(), face: 2.6, pose: 'floor' }; lily.settle();
  // the thing in the basement
  S.presence = new Human('presence', { height: 2.35, build: 'man', presence: true, shirtCol: 0x040404, pantsCol: 0x040404, skinCol: 0x030303, face: T.headPresence, faceClosed: T.headPresence, faceWrong: T.headPresence, hairStyle: 'none', voice: 'father' }, scene);
  for (const m of S.presence.mats) { m.uniforms.uColor.value.set(0.02, 0.02, 0.02); m.uniforms.uEmissive.value.set(0.05, 0.012, 0.006); }
  S.presence.faceMat.uniforms.uUnlit.value = 1;
  S.presence.faceMat.uniforms.uColor.value.set(1, 1, 1);
  S.presence.visible = false; S.presence.root.visible = false;
  S.presence.setPos(spots.furnace.x, spots.furnace.z, BASE_Y);
  F.danny.setFace(false);
}

const awake = (h) => !h.asleep || S.t < h.awakeUntil;
const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const sameFloor = (h) => (h.pos.y < -1) === inBasement();
function once(id) { if (S.fired.has(id)) return false; S.fired.add(id); return true; }
function later(secs, fn) { S.timers.push({ at: S.t + secs, fn }); }
S.timers = [];

function dogHead() { return v3(dog.pos.x, dog.y + 0.35, dog.pos.z); }
function say(h, text, tone, o) { return h.say(text, tone, S.t, S.co, o); }

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

// ---------------------------------------------------------------------------
// The family's schedule
function phaseUpdate() {
  const { father, mother, lily, danny } = F;
  const co = S.co, t = S.t;
  if (t > 4 && once('intro1')) say(lily, 'Biscuit! Come here, look what I made!', 'calm', { force: true });
  if (t > 16 && once('intro2')) say(father, "Cable's out again. Storm's supposed to get worse tonight.", 'calm', { force: true });
  if (t > 24 && once('intro3')) say(mother, "It's freezing in here. I turned the heat up to seventy-eight.", 'calm', { force: true });
  if (t > 32 && once('intro4')) say(father, "Furnace has been making that noise again. I'll look at it this weekend.", 'calm', { force: true });
  if (t > 42 && once('intro5')) say(mother, 'And that smoke alarm thing kept chirping all day, so I took the battery out. I will get a new one tomorrow.', 'calm', { force: true });
  if (t > 55 && once('intro6')) say(lily, 'Biscuit, you have to sleep in your bed tonight, okay? Good boy.', 'calm', { force: true });

  if (co > 0.015 && once('ignite')) {
    AU.whoomp(spots.furnace.x, BASE_Y + 1, spots.furnace.z);
    for (const L of lights) if (L && L.slot < 4) L.intensity = 0.35;
    later(0.25, () => { for (const L of lights) if (L && L.slot < 4) L.intensity = 1; });
    later(0.5, () => { for (const L of lights) if (L && L.slot < 4) L.intensity = 0.6; });
    later(0.7, () => { for (const L of lights) if (L && L.slot < 4) L.intensity = 1; });
  }
  if (co > 0.05 && once('doorAjar')) {
    doors.basement.target = 0.95; doors.basement.speed = 0.25;
    AU.creak(13.4, 1, 3.5, 3.5, 1.2);
    later(4, () => { if (awake(father)) say(father, 'Did you leave the basement door open again?', 'calm', { force: true }); });
    later(7.5, () => say(mother, 'No. I have not been down there. You know I can not go down there.', 'sad', { force: true }));
  }
  if (co > 0.13 && once('bedtime')) {
    say(mother, 'Lily. Bed. Come on, it is late.', 'calm', { force: true });
    later(3, () => say(lily, 'Can Biscuit sleep with me tonight?', 'calm', { force: true }));
    later(6, () => say(mother, 'Not tonight, honey. He has his own bed.', 'calm', { force: true }));
    later(2, () => {
      lily.setActivity({ spot: spots.lilyBed.clone(), pose: 'sleep', face: 0 });
      mother.setActivity({ spot: spots.lilyBedSide.clone(), pose: 'stand', face: Math.PI / 2 });
    });
    later(18, () => {
      S.lullaby = AU.lullaby(() => { const p = mother.headWorld(); return [p.x, p.y, p.z]; }, S.co, 0.6);
    });
    later(36, () => {
      mother.setActivity({ spot: spots.motherChair.clone(), face: Math.PI, pose: 'sit' });
      lights[6].on = true;
    });
  }
  if (co > 0.2 && once('dannyLight')) {
    refs.dannyDoorLight.visible = true;
    S.dannyLightOn = true;
  }
  if (co > 0.25 && once('headache')) {
    say(mother, 'I have the worst headache.', 'sleepy', { force: true });
    mother.override = { type: 'rub', until: S.t + 10 };
    later(4, () => say(father, 'Me too. It is the storm. All that pressure.', 'sleepy', { force: true }));
  }
  if (co > 0.3 && once('chair')) {
    if (!father.asleep) {
      father.setActivity({ spot: v3(11.25, 0, 5.85), face: 0, pose: 'stare' });
      later(9, () => say(father, 'A year tomorrow. A whole year.', 'sad', { force: true }));
      later(14, () => say(mother, 'Do not. Please. Not tonight.', 'sad', { force: true }));
      later(22, () => { if (!S.cut) father.setActivity({ spot: spots.armchair.clone(), face: Math.PI, pose: 'sit', approach: v3(8.25, 0, 6.9) }); });
    }
  }
  if (co > 0.34 && once('knock')) {
    AU.knock(1.5, 1.2, 10.2, 3, 1.1);
    later(3, () => { if (awake(father) && father.pose !== 'sleep') say(father, 'Who the hell is out in this?', 'calm', { force: true }); });
    later(7, () => say(mother, 'It is just the wind. It is only the wind.', 'sleepy', { force: true }));
    S.knockedAt = S.t;
  }
  if (co > 0.38 && once('motherBed')) {
    say(mother, 'I am going to lie down. Do not stay up all night.', 'sleepy', { force: true });
    later(2, () => {
      lights[0].on = false; AU.setFridge(true);
      mother.setActivity({ spot: spots.parentBedM.clone(), pose: 'sleep', face: 0 });
    });
  }
  if (co > 0.42 && once('fatherSlump')) {
    if (father.activity && father.activity.pose === 'sit' && !S.cut) { father.pose = 'slump'; father.asleep = true; father.activity.pose = 'slump'; }
    else later(15, () => { S.fired.delete('fatherSlump'); });
  }
  if (co > 0.47 && once('basementLullaby')) {
    AU.lullaby(() => [9.5, BASE_Y + 1.2, -2.5], 0.8, 0.75);
  }
  if (co > 0.6 && once('lilyWakes')) {
    if (S.locked) {
      lily.asleep = false; lily.awakeUntil = S.t + 999;
      lily.setActivity({ spot: v3(11.45, 0, 4.1), face: Math.PI, pose: 'stand' });
      S.lilyRescue = true;
    } else {
      lily.asleep = false; lily.awakeUntil = S.t + 60;
      lily.setActivity({ spot: spots.lilyDoor.clone(), face: 0, pose: 'stare' });
      S.lilyAt = true;
      lily.setFace(true);
    }
  }
  if (co > 0.66 && once('wrongPhotos')) {
    refs.hallPhotoMat.uniforms.map.value = T.photoFamilyWrong;
    AU.stinger(0.4);
  }
  if (co > 0.72 && once('fatherBed')) {
    if (father.activity && father.activity.pose !== 'sleep' && !S.cut) {
      father.asleep = false; father.pose = 'sit';
      say(father, 'I do not feel... I do not feel so good.', 'sleepy', { force: true });
      later(3, () => {
        S.tvOn = false; AU.setTV(false); lights[2].on = false; lights[1].on = false;
        father.setActivity({ spot: spots.parentBedF.clone(), pose: 'sleep', face: 0 });
        later(14, () => { lights[3].on = false; });
      });
    }
  }
  if (co > 0.66) { for (const h of [father, mother, lily]) if (h.asleep && h.pose === 'sleep') h.setFace(true); }
  if (co > 0.9) for (const h of [father, mother, lily]) h.unconscious = true;
  if (co >= 1 && !S.ended && !S.cut) endByTime();

  // Lily at her doorway in the dark
  if (S.lilyAt && dist2d(dog.pos, lily.pos) < 3 && once('lilyWhisper')) {
    lily.look(dogHead(), 12, S.t);
    say(lily, 'Biscuit... Danny is calling me. From down there. Can you hear him? He wants me to come down.', 'whisper', { force: true });
    later(9, () => {
      lily.setFace(false); S.lilyAt = false;
      lily.setActivity({ spot: spots.lilyBed.clone(), pose: 'sleep', face: 0 });
    });
  }
  // Lily letting the dog out
  if (S.lilyRescue && dist2d(lily.pos, v3(11.45, 0, 4.1)) < 0.3 && once('lilyOpens')) {
    unlockLaundry();
    say(lily, 'Shh. Biscuit. Why are you in here? Do not tell Dad. Danny is calling me.', 'whisper', { force: true });
    later(6, () => lily.setActivity({ spot: spots.lilyBed.clone(), pose: 'sleep', face: 0 }));
  }

  // The basement door drifts open again after being shut
  if (S.doorReopenAt && S.t > S.doorReopenAt) {
    S.doorReopenAt = 0; doors.basement.target = 0.95; doors.basement.speed = 0.3;
    AU.creak(13.4, 1, 3.5, 3, 1);
  }
}

// ---------------------------------------------------------------------------
// Scares that depend on where Biscuit is
function scares(dt) {
  const { danny } = F;
  const room = roomAt(dog.pos.x, dog.pos.z, dog.y);
  const fwd = dogForward();
  // TV face
  if (S.co > 0.09 && room === 'living' && S.tvOn && !S.fired.has('tvFace')) {
    const to = v3(8 - dog.pos.x, 0, 5.7 - dog.pos.z); const d = to.length(); to.normalize();
    if (d < 4 && fwd.dot(to) > 0.85) { S.fired.add('tvFace'); S.tvFace = 0.35; AU.stinger(0.6); }
  }
  // figure in the windows
  if (S.co > 0.22 && room === 'living' && once('figure')) lightning(true);
  // Danny's door
  if (S.dannyLightOn) {
    S.dannyStepT = (S.dannyStepT || 0) - dt;
    if (S.dannyStepT <= 0) { S.dannyStepT = 2.5 + Math.random() * 3; AU.step('heavy', 9.4 + Math.random(), 0.1, 2.0, 0.35); }
    if (dist2d(dog.pos, v3(9.45, 0, 3.6)) < 1.4) {
      S.dannyLightOn = false; refs.dannyDoorLight.visible = false;
      later(0.8, () => AU.knock(9.45, 1.0, 3.45, 1, 0.9));
      if (S.co > 0.5 && once('dannyWhisper')) later(2.5, () => { F.danny.pos.set(9.45, 0, 2.5); say(F.danny, 'Biscuit... come down. Come find me.', 'whisper', { force: true }); });
      later(40, () => { if (S.co < 0.9) { S.dannyLightOn = true; refs.dannyDoorLight.visible = true; } });
    }
  }
  // ghost of Danny in the hall, walking down to the basement
  if (S.co > 0.43 && room === 'hall' && !S.ghostState && !S.fired.has('hallGhost') && dog.pos.x < 9.5) {
    const to = v3(13.3 - dog.pos.x, 0, 3.9 - dog.pos.z).normalize();
    if (fwd.dot(to) > 0.9) {
      S.fired.add('hallGhost');
      S.ghostState = { kind: 'hall', t: 0 };
      danny.visible = true; danny.setPos(13.3, 4.1); danny.yaw = Math.PI; danny.pose = 'stand';
      danny.look(dogHead(), 3, S.t);
      AU.stinger(0.5);
    }
  }
  // Danny by his boxes, the first time you reach the bottom of the stairs
  if (inBasement() && dog.pos.z < 1.2 && dog.y < -2.3 && once('basementGhost')) {
    lights[4].on = true; lights[4].flicker = 0.8;
    AU.whoomp(10, -1, -1.2);
    S.ghostState = { kind: 'boxes', t: 0 };
    danny.visible = true; danny.setPos(12.4, -2.3, BASE_Y); danny.yaw = Math.PI; danny.pose = 'stare';
  }
  if (S.ghostState) {
    const g = S.ghostState; g.t += dt;
    if (g.kind === 'hall') {
      if (g.t > 2.2 && !danny.path.length && !g.walking) { g.walking = true; danny.path = [v3(13.3, 0, 3.3), v3(13.3, 0, 2.6)]; danny.speed = 0.7; }
      if (danny.pos.z < 3.4) danny.pos.y = floorAt(danny.pos.x, danny.pos.z, 0);
      if (g.t > 6.5 || dist2d(dog.pos, danny.pos) < 3.2) { danny.visible = false; S.ghostState = null; }
    } else if (g.kind === 'boxes') {
      if (dist2d(dog.pos, danny.pos) < 2.8 || g.t > 25) {
        danny.visible = false; S.ghostState = null; AU.stinger(0.8); lights[4].flicker = 0.3;
      }
    }
  }
  // furnace answers barks; furnace grows teeth
  refs.grilleMat.uniforms.map.value = S.dogCO > 0.55 || S.presenceActive ? T.grilleTeeth : T.grille;
  const br = 0.6 + 0.4 * Math.sin(S.t * (0.5 + S.co * 0.6));
  refs.grilleMat.uniforms.uColor.value.setScalar(S.co > 0.015 ? 0.5 + br * 0.6 : 0.1);
  lights[5].intensity = S.co > 0.015 ? (0.6 + br * 0.8) * (0.7 + S.co) : 0;
  const sc = 1 + (S.co > 0.015 ? br * 0.015 * (1 + S.co * 2) : 0);
  refs.furnace.scale.set(sc, 1 + (sc - 1) * 0.5, sc);
}

// ---------------------------------------------------------------------------
// The presence: what the furnace looks like to a dog with a head full of poison.
function updatePresence(dt) {
  const p = S.presence;
  if (!S.presenceActive) { p.root.visible = false; return; }
  if (S.presenceSleep > 0) { S.presenceSleep -= dt; p.root.visible = false; return; }
  p.visible = true;
  const target = dog.pos;
  const d = Math.hypot(target.x - p.pos.x, target.z - p.pos.z);
  p.speed = 1.55 + S.co * 1.4;
  p.path = [v3(target.x, 0, target.z)];
  p.update(dt, S.t, 0, dog.pos);
  p.pos.y = floorAt(p.pos.x, p.pos.z, p.pos.y);
  p.root.position.y = p.pos.y;
  // limbs: long reaching arms, jerky
  for (const a of p.arms) { a.sh.rotation.x = -1.45 + Math.sin(S.t * 9) * 0.05; }
  p.root.visible = Math.random() > 0.06;
  for (let i = 0; i < 3; i++) emit(p.pos.x, p.pos.y + 0.6 + Math.random() * 1.6, p.pos.z, 'wrong', { spread: 0.5, life: 1.5, size: 0.06 });
  if (!inBasement() || dog.y > -0.25) {
    // it can not follow you upstairs
    S.presenceActive = false; p.root.visible = false;
    AU.stinger(0.4);
    return;
  }
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
    const j = items.find((i) => i.name === 'jacket');
    if (j && !j.carried) { j.mesh.position.copy(j.home); j.mesh.rotation.set(0, 0.3, 0); }
    dog.pos.set(12.6, BASE_Y, -2.4); dog.y = BASE_Y; dog.yaw = Math.PI * 0.8;
    p.pos.set(spots.furnace.x, BASE_Y, spots.furnace.z);
    S.co = Math.min(1, S.co + 0.02);
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
  if (S.ended || S.cut) return;
  AU.bark(1); dog.barkKick = 1;
  const { father, mother, lily } = F;
  if (inBasement()) {
    if (S.co > 0.2) later(0.9, () => AU.whoomp(spots.furnace.x, BASE_Y + 1, spots.furnace.z));
    return;
  }
  const nearBasement = dist2d(dog.pos, v3(13.4, 0, 3.6)) < 2.2 && doors.basement.angle > 0.3;
  for (const h of [father, mother, lily]) {
    if (!sameFloor(h)) continue;
    const d = dist2d(h.pos, dog.pos);
    if (h.asleep && !(S.t < h.awakeUntil)) {
      if (d < 2.6) wake(h);
      continue;
    }
    if (d > 7.5) continue;
    h.look(dogHead(), 4, S.t);
    h.annoy = (h.annoy || 0) + 1;
    if (nearBasement && (h === father || h === mother) && S.closedCount < 3 && !S.cut && !h.going) {
      goCloseBasement(h); return;
    }
    if (h.annoy >= 3) { h.annoy = 0; scold(h); }
    else if (h.annoy === 1) {
      const lines = h === lily ? ['Biscuit? What is it? What do you see?', 'Shh, Biscuit. Shh.'] : ['Biscuit. Hey. Quiet.', 'What is it, buddy? There is nothing there.', 'Quiet, Biscuit.'];
      say(h, lines[Math.floor(Math.random() * lines.length)], 'calm', { cooldown: 2 });
    }
  }
}
function wake(h) {
  if (h.unconscious) {
    if (S.t - (h.lastNoWake || 0) > 6) { h.lastNoWake = S.t; showSubtitle(h.name, '<i>...mm...</i> <span class="note">(they do not wake up)</span>', 2.5); AU.stinger(0.25); }
    return;
  }
  h.awakeUntil = S.t + 25;
  h.look(dogHead(), 6, S.t);
  if (h.pose === 'slump') { h.pose = 'sit'; later(25, () => { if (h.activity && h.activity.pose === 'slump' && h.pose === 'sit' && !S.cut) h.pose = 'slump'; }); }
  const lines = h === F.lily ? ['Biscuit? Is it morning?', 'Mm. Biscuit. Go to sleep.']
    : ['Mm... Biscuit... go lie down. Go to bed.', 'What... what time is it... Biscuit, no.', 'Not now, buddy... so tired...'];
  say(h, lines[Math.floor(Math.random() * lines.length)], 'sleepy', { cooldown: 1 });
}
function scold(h) {
  S.strikes++;
  const lines = S.strikes >= 3 ? ['That is IT. I swear to God, Biscuit.'] : ['Biscuit! NO! Quiet!', 'What is wrong with you tonight? Bad dog.', 'Enough! Go lie down. Bed!'];
  say(h, lines[Math.floor(Math.random() * lines.length)], 'sharp', { force: true });
  if (S.strikes >= 3 && awake(F.father) && !S.locked) later(1.5, lockUp);
}
function goCloseBasement(h) {
  h.going = true;
  S.closedCount++;
  const lines = [
    ['Who keeps opening this?', 'His things are down there. I can not.'],
    ['Biscuit, get away from there.', 'No. Not down there. Not tonight.'],
    ['Again? This door...', 'Stop it, Biscuit. Please.'],
  ][Math.min(2, S.closedCount - 1)];
  say(h, lines[0], 'calm', { force: true });
  const prev = h.activity;
  h.goTo(v3(13.4, 0, 4.0), () => {
    h.yaw = Math.PI; h.look(v3(13.4, -1, 2.5), 3, S.t);
    later(1.5, () => {
      say(h, lines[1], 'sad', { force: true });
      doors.basement.speed = 1.8; doors.basement.target = 0; AU.creak(13.4, 1, 3.5, 0.6, 0.8);
      later(0.5, () => AU.knock(13.4, 1, 3.5, 1, 0.6));
      S.doorReopenAt = S.t + 40 + Math.random() * 20;
      later(2.5, () => { h.going = false; if (prev && !S.cut) h.setActivity(prev); });
    });
  });
}
function lockUp() {
  if (S.locked || S.ended || S.cut) return;
  const f = F.father;
  say(f, 'That is it. Laundry room. You can bark in there all night.', 'sharp', { force: true });
  S.fade = 1; S.fadeSpeed = 1.5;
  dog.frozen = true;
  later(1.4, () => {
    if (dog.carrying) dropItem(dog.carrying, true);
    dog.pos.set(11.45, 0, 1.9); dog.y = 0; dog.yaw = 0; // facing the window
    dog.yaw = Math.PI; // face the door
    doors.laundry.target = 0; doors.laundry.angle = 0.0001; doors.laundry.pivot.rotation.y = doors.laundry.base; doors.laundry.setCollider();
    S.locked = true; S.strikes = 0; S.scratches = 0;
    // he left the laundry light on for you
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
  if (S.ended || S.cut) return;
  AU.whine();
  for (const h of [F.father, F.mother, F.lily]) {
    if (!awake(h) || !sameFloor(h) || dist2d(h.pos, dog.pos) > 2.8) continue;
    if (S.t - (h.lastComfort || -99) < 10) continue;
    h.lastComfort = S.t;
    h.look(dogHead(), 5, S.t);
    S.strikes = Math.max(0, S.strikes - 1); h.annoy = 0;
    const lines = h === F.lily ? ['Are you scared too? Me too. It is okay. Good boy.', 'I love you, Biscuit.']
      : ['Hey buddy. Hey. It is okay. Good boy.', 'You are shaking. What is the matter with you tonight?', 'I know. I miss him too, bud.'];
    say(h, lines[Math.floor(Math.random() * lines.length)], 'calm', { force: true });
    return;
  }
}

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
    if (it.carried || it.gone) continue;
    const p = it.mesh.position;
    if (Math.abs(p.y - dog.y) > 0.8) continue;
    const to = v3(p.x - dog.pos.x, 0, p.z - dog.pos.z); const d = to.length();
    if (d < bd && (d < 0.35 || fwd.dot(to.normalize()) > 0.3)) { bd = d; best = it; }
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

export function onInteract() {
  if (S.ended || S.cut || dog.frozen) return;
  if (dog.carrying) { dropItem(dog.carrying); return; }
  const it = nearestItem(0.85);
  if (it) { pickItem(it); return; }
  const h = nearestHuman(1.3);
  if (h) { tug(h); return; }
  const dn = nearestDoor();
  if (dn) { scratchDoor(dn); return; }
}

function pickItem(it) {
  it.carried = true;
  dog.carrying = it;
  dog.mouth.add(it.mesh);
  it.mesh.position.set(0, 0, 0);
  it.mesh.rotation.set(0, it.name === 'jacket' ? Math.PI / 2 : 0.4, 0.2);
  it.mesh.scale.setScalar(it.name === 'jacket' ? 0.45 : 0.8);
  AU.pickup();
  if (it.name === 'jacket' && once('presenceWake')) {
    AU.stinger(1);
    later(0.3, () => AU.whoomp(spots.furnace.x, BASE_Y + 1, spots.furnace.z));
    lights[4].flicker = 1;
    later(1.2, () => { lights[4].on = false; S.presenceActive = true; S.presence.setPos(spots.furnace.x, spots.furnace.z, BASE_Y); });
  } else if (it.name === 'jacket' && inBasement() && !S.presenceActive && S.presenceSleep <= 0) {
    later(1.5, () => { if (inBasement()) { S.presenceActive = true; S.presence.setPos(spots.furnace.x, spots.furnace.z, BASE_Y); } });
  } else if (it.name === 'jacket' && S.presenceSleep > 0) {
    S.presenceActive = true;
  }
}

function dropItem(it, silent) {
  it.carried = false; dog.carrying = null;
  scene.attach(it.mesh);
  const f = dogForward();
  const x = dog.pos.x + f.x * 0.35, z = dog.pos.z + f.z * 0.35;
  it.mesh.position.set(x, floorAt(x, z, dog.y) + 0.03, z);
  it.mesh.rotation.set(0, dog.yaw, 0);
  it.mesh.scale.setScalar(1);
  if (silent) return;
  AU.pickup();
  // who is here to see it?
  let h = null, bd = 1.8;
  for (const c of [F.father, F.mother, F.lily]) {
    if (!sameFloor(c)) continue;
    const cp = c.pose === 'sleep' ? v3(c.pos.x, 0, c.pos.z + 0.3) : c.pos;
    const d = dist2d(cp, it.mesh.position);
    if (d < bd) { bd = d; h = c; }
  }
  if (!h) return;
  if (!awake(h)) { showSubtitle(h.name, '<span class="note">(asleep — wake them first)</span>', 2); return; }
  h.look(it.mesh.position, 4, S.t);
  reactToItem(h, it);
}

function reactToItem(h, it) {
  const { father, mother, lily } = F;
  if (it.name === 'jacket') { trueEnding(h); return; }
  if (it.name === 'ball') {
    S.strikes = 0;
    if (h === father) say(h, 'Where did you find that? That is... that was Danny\'s ball.', 'sad', { force: true });
    else if (h === mother) say(h, 'Oh, Biscuit. Oh, sweetheart. Not his ball.', 'sad', { force: true });
    else say(h, 'Danny\'s ball! You want to play? We can not play inside.', 'calm', { force: true });
    return;
  }
  if (it.name === 'leash') {
    say(h, S.co > 0.3 ? 'Outside? No. No walk. Not in this. Go lie down.' : 'No walk tonight, buddy. Not in this storm.', 'calm', { force: true });
    return;
  }
  if (it.name === 'battery') {
    if (h === mother) say(h, 'Oh. That. Thank you, sweetie. I will put it back tomorrow.', 'sleepy', { force: true });
    else if (h === father) say(h, 'What have you got? A battery? Huh. Where did that come from?', 'calm', { force: true });
    else say(h, 'Is this from the beeping thing? I will keep it safe.', 'calm', { force: true });
    it.gone = true;
    later(1.2, () => { it.mesh.position.set(13.65, 0.96, 7.6); });
    S.batteryGiven = true;
    return;
  }
  if (it.name === 'drawing') {
    if (h === lily) say(h, 'You like my drawing? That is Mommy and Daddy and me and you. And that is Danny. He lives under the house now.', 'calm', { force: true });
    else say(h, 'Oh... oh, Lily.', 'sad', { force: true });
  }
}

function tug(h) {
  if (!awake(h)) {
    if (!h.unconscious) { AU.whine(); wake(h); }
    else wake(h);
    return;
  }
  h.look(dogHead(), 3, S.t);
  if (S.follow) return;
  say(h, h === F.lily ? 'Where are we going? Okay, okay!' : 'Okay, okay. What? What is it? Where are we going?', 'calm', { force: true });
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
    if (dist2d(h.pos, dog.pos) > 1.4) {
      const tgt = v3(dog.pos.x, 0, dog.pos.z);
      h.path = []; h.goTo(tgt); h.path[h.path.length - 1] = tgt;
      // stop short of the dog
    } else h.path = [];
  }
  if (dist2d(h.pos, dog.pos) < 1.1) h.path = [];
  h.look(dogHead(), 1, S.t);
  // led to the basement door
  if (dist2d(dog.pos, v3(13.4, 0, 3.6)) < 2 && dist2d(h.pos, v3(13.4, 0, 3.9)) < 2.2 && doors.basement.angle > 0.3 && !S.cut) {
    S.follow = null;
    if (h === F.lily) { say(h, 'I am not allowed down there. Mommy says.', 'whisper', { force: true }); later(3, () => h.setActivity(f.prev)); return; }
    goCloseBasement(h);
    return;
  }
  if (inBasement()) {
    S.follow = null;
    say(h, 'Biscuit! Get out of there! Come up here. Come!', 'sharp', { force: true });
    later(3, () => { if (f.prev && !S.cut) h.setActivity(f.prev); });
    return;
  }
  if (S.t > f.until) {
    S.follow = null;
    say(h, h === F.lily ? 'There is nothing here, silly.' : 'There is nothing here, bud. Come on. Go lie down.', 'calm', { force: true });
    later(1.5, () => { if (f.prev && !S.cut) h.setActivity(f.prev); });
  }
}

function bite(h) {
  if (S.ended || S.cut) return;
  AU.bark(1.3); AU.scream();
  dog.barkKick = 2;
  S.redFlash = 0.8;
  if (S.co >= 0.45) { badDogEnding(h); return; }
  say(h, 'AGH! He BIT me! Biscuit! What the hell!', 'sharp', { force: true });
  S.strikes = 3;
  if (awake(F.father) || h === F.father) later(1.8, lockUp);
}

function scratchDoor(name) {
  AU.scratch();
  if (name === 'laundry' && S.locked) {
    S.scratches++;
    if (S.scratches >= 4 && S.co < 0.38 && !S.rescuing) {
      S.rescuing = true;
      const m = F.mother;
      const prev = m.activity;
      m.goTo(v3(11.45, 0, 4.1), () => {
        say(m, 'Fine. FINE. Just be quiet. Please. Just be quiet.', 'sad', { force: true });
        unlockLaundry(); S.rescuing = false;
        later(2, () => prev && m.setActivity(prev));
      });
    }
    return;
  }
  if (name === 'danny') {
    const m = F.mother;
    if (awake(m) && dist2d(m.pos, dog.pos) < 7 && sameFloor(m)) say(m, 'Biscuit, no. Not his door. Please, not his door.', 'sad', { cooldown: 6 });
    return;
  }
  if (name === 'front') {
    emit(1.5, 0.05, 9.95, 'outside', { spread: 0.8, life: 2 });
    for (const h of [F.father, F.mother]) {
      if (awake(h) && dist2d(h.pos, dog.pos) < 6) { say(h, 'He is not coming home, Biscuit. He is not coming home.', 'sad', { cooldown: 15 }); break; }
    }
  }
}

// ---------------------------------------------------------------------------
// Ambient per-frame scent emissions
function emitScents(dt) {
  const k = dt * 60;
  const { father, mother, lily } = F;
  for (const h of [father, mother, lily]) {
    if (Math.random() < 0.25 * k) emit(h.pos.x, h.pos.y + 0.05, h.pos.z, h.name, { spread: 0.25, life: 9, vy: 0.005, size: 0.03 });
    if (Math.random() < 0.12 * k) emit(h.pos.x, h.pos.y + 0.6 + Math.random() * 0.8, h.pos.z, h.name, { spread: 0.4, life: 3 });
  }
  // Danny's old trail
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
    if (it.gone) continue;
    const p = new THREE.Vector3(); it.mesh.getWorldPosition(p);
    if (it.name === 'jacket' && Math.random() < 0.5 * k) emit(p.x, p.y + 0.05, p.z, 'dannyStrong', { spread: 0.35, life: 2.5, vy: 0.08, size: 0.04 });
    if (it.name === 'ball' && Math.random() < 0.08 * k) emit(p.x, p.y, p.z, 'dannyFaint', { spread: 0.1, life: 2 });
    if (it.name === 'drawing' && Math.random() < 0.05 * k) emit(p.x, p.y, p.z, 'lily', { spread: 0.2, life: 2 });
  }
  if (Math.random() < 0.05 * k) emit(spots.bowl.x, 0.08, spots.bowl.z + 0.4, 'food', { spread: 0.3, life: 2 });
  if (Math.random() < 0.1 * k) emit(1.5, 0.05, 9.9, 'outside', { spread: 0.8, life: 2, vz: -0.15 });
  // the wrong smell
  const co = S.co;
  if (co > 0.015) {
    const c = refs.flueCrack;
    if (Math.random() < (0.3 + co) * k) emit(c.x + 0.2, c.y, c.z, 'wrong', { spread: 0.3, life: 6, vy: 0.04, vx: 0.08, size: 0.05 });
    if (doors.basement.angle > 0.3 && Math.random() < (0.15 + co) * 0.6 * k) emit(13.4, 0.3 + Math.random() * 1.8, 3.4, 'wrong', { spread: 0.5, life: 6, vz: 0.12, size: 0.05 });
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
    if (it.gone || it.carried) continue;
    const ip = new THREE.Vector3(); it.mesh.getWorldPosition(ip);
    if (Math.abs(ip.y - dog.y) > 1.2) continue;
    if (it.name === 'jacket') cand.push([dist2d(ip, p) - 1.5, 'dannyStrong']);
    if (it.name === 'ball') cand.push([dist2d(ip, p) - 0.3, 'dannyFaint']);
  }
  if (dog.carrying && dog.carrying.name === 'jacket') cand.push([-5, 'dannyStrong']);
  for (const tr of DANNY_TRAIL) cand.push([Math.hypot(tr[0] - p.x, tr[1] - p.z) + 0.4, 'danny']);
  if (S.co > 0.015 && (inBasement() || dist2d(p, v3(13.4, 0, 3.6)) < 2.5)) cand.push([0.3, 'wrong']);
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
  if (S.cut || S.ended || dog.frozen) return '';
  if (dog.carrying) return `<b>E</b> drop ${dog.carrying.label}`;
  const it = nearestItem(0.85);
  if (it) return `<b>E</b> take ${it.label} in your mouth`;
  const h = nearestHuman(1.3);
  if (h) {
    if (!awake(h)) return `<b>E</b> nudge · <b>SPACE</b> bark to wake`;
    return h === F.lily ? `<b>E</b> tug her sleeve` : `<b>E</b> tug sleeve · hold <b>E</b> bite`;
  }
  const d = nearestDoor();
  if (d) return `<b>E</b> scratch the door`;
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
  if (S.co < 0.25) { showSubtitle('note', '<span class="note">You are not tired. Something is wrong tonight.</span>', 2.5); S.bedHold = 0; return; }
  finish('goodboy');
}
function trueEnding(h) {
  S.cut = 'home';
  dog.frozen = true;
  const { father, mother, lily } = F;
  h.look(dogHead(), 30, S.t);
  h.path = []; h.asleep = false; h.awakeUntil = S.t + 999;
  if (h.pose !== 'sleep') {
    h.pose = 'kneel';
    const dx = dog.pos.x - h.pos.x, dz = dog.pos.z - h.pos.z, d = Math.hypot(dx, dz);
    h.yaw = Math.atan2(dx, dz);
    if (d > 0.9) { h.pos.x += dx / d * (d - 0.8); h.pos.z += dz / d * (d - 0.8); }
  }
  if (h === lily) {
    say(h, 'That is Danny\'s jacket... DADDY! DADDY! Biscuit found Danny\'s jacket!', 'sharp', { force: true });
    later(5, () => say(father, 'Lily? What... what is... why is it so... my head...', 'sleepy', { force: true }));
    later(10, () => say(father, 'CLAIRE! Get up! Get up! Something is wrong with the air! Everybody OUT! NOW!', 'sharp', { force: true }));
  } else {
    say(h, 'Where... where did you get this?', 'sad', { force: true });
    later(4.5, () => say(h, 'It still smells like him. Oh, God. It still smells like him.', 'sad', { force: true }));
    later(9.5, () => say(h, 'Why can I not... my head... why is it so hard to think...', 'sleepy', { force: true }));
    if (h === father) later(14, () => say(h, 'CLAIRE! CLAIRE! Get Lily! Something is wrong with the air! Everybody OUT! NOW!', 'sharp', { force: true }));
    else later(14, () => say(h, 'TOM! TOM, wake up! Something is wrong! Get Lily! Get OUT!', 'sharp', { force: true }));
  }
  later(19, () => { doors.front.target = 1.6; doors.front.speed = 2; AU.creak(1.5, 1, 10, 1); AU.updateAmbience(S.co, S.t, 0.8); S.windBoost = 0.6; });
  later(20, () => finish('home'));
}
function badDogEnding(h) {
  S.cut = 'baddog';
  dog.frozen = true;
  say(h, 'AGH! He BIT me! Biscuit, what the hell is WRONG with you?!', 'sharp', { force: true });
  later(3.5, () => say(h, 'GET OUT! Out! OUT!', 'sharp', { force: true }));
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
      'Someone would come home. Someone always came home.',
      'The house went quiet behind you, room by room.',
      'Three days later, someone did. A man from the gas company, and then a lot of men, and then a woman with a blanket who carried you out into the cold.',
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
      'The fire department found the cracked flue at 4 a.m. Everyone lived.',
      'They said Biscuit had turned. They said it was kinder this way. Lily was eight.',
      'She is thirty now. She has never once ignored an animal that would not stop barking.',
    ];
    case 'home': return [
      'He followed you. For the first time in a year, somebody followed you.',
      'They stood in the snow in their pajamas, the three of them, and you, and the house breathing out its poison into the dark.',
      'The fire department found the cracked flue at 4 a.m. The man from the gas company said another hour.',
      'They sat in the truck under one blanket. He held Danny\'s jacket, and he cried, and for the first time he said his son\'s name out loud.',
      'You did not understand the words. But you understood that.',
    ];
  }
}

function finish(id) {
  if (S.ended) return;
  S.ended = true;
  S.endId = id;
  dog.frozen = true;
  input.enabled = false;
  if (document.exitPointerLock) document.exitPointerLock();
  S.fade = 1; S.fadeSpeed = id === 'goodboy' ? 0.25 : 0.5;
  try {
    const found = JSON.parse(localStorage.getItem('goodboy_endings') || '[]');
    if (!found.includes(id)) found.push(id);
    localStorage.setItem('goodboy_endings', JSON.stringify(found));
  } catch (e) { /* storage unavailable */ }
  setTimeout(() => ui.showEnding(ENDINGS[id], ENDING_TEXT(id), speechLog.slice(), id), id === 'goodboy' ? 4200 : 2400);
}

// ---------------------------------------------------------------------------
export function updateStory(dt) {
  if (S.ended) { S.fadeV = Math.min(1, (S.fadeV || 0) + dt * S.fadeSpeed); P.uFade.value = S.fadeV; return; }
  S.t += dt;
  S.co = Math.max(S.co, Math.min(1, (S.t - CO_START) / CO_DUR));
  if (S.t < CO_START) S.co = 0;
  const extra = inBasement() ? 0.12 : 0;
  S.dogCO = Math.min(1, S.co + extra);
  G.uCO.value = S.dogCO * 0.9;
  P.uCO.value = S.dogCO;

  // timers
  for (let i = S.timers.length - 1; i >= 0; i--) if (S.t >= S.timers[i].at) { const f = S.timers[i].fn; S.timers.splice(i, 1); f(); }

  phaseUpdate();
  scares(dt);
  updatePresence(dt);
  updateFollow(dt);
  updateLightning(dt);

  // mother's rub-temples override expiry
  const m = F.mother;
  if (m.override && S.t > m.override.until) m.override = null;
  if (S.lullaby) S.lullaby.update();

  // humans
  for (const h of [F.father, F.mother, F.lily, F.danny]) h.update(dt, S.t, S.co, dog.pos);
  F.danny.root.visible = F.danny.visible && Math.random() > 0.12;
  // people are solid: they shove past the dog
  for (const h of [F.father, F.mother, F.lily]) {
    if (h.pose === 'sleep' || !sameFloor(h)) continue;
    const dx = dog.pos.x - h.pos.x, dz = dog.pos.z - h.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.42 && d > 1e-4) { dog.pos.x += dx / d * (0.42 - d); dog.pos.z += dz / d * (0.42 - d); }
  }
  // the family notice the dog sometimes
  for (const h of [F.father, F.mother, F.lily]) {
    if (awake(h) && !h.asleep && dist2d(h.pos, dog.pos) < 2 && Math.random() < dt * 0.3 && !(h.lookUntil > S.t)) h.look(dogHead(), 2 + Math.random() * 2, S.t);
    if (h.annoy && Math.random() < dt / 20) h.annoy--;
    // faces go wrong when the poison is in your head and you look too long
    if (S.dogCO > 0.5 && !h.asleep) {
      const to = v3(h.pos.x - dog.pos.x, 0, h.pos.z - dog.pos.z); const d = to.length();
      const looking = d < 3 && dogForward().dot(to.normalize()) > 0.93;
      h.gaze = looking ? (h.gaze || 0) + dt : 0;
      if (h.gaze > 1.8 && !h.wrongFace) { h.setFace(true); AU.stinger(0.3); later(1.2, () => { if (!(S.co > 0.66 && h.asleep)) h.setFace(false); }); }
    }
  }

  // hold E to bite
  if (input.eDown && !input.eUsedHold && !dog.carrying) {
    const held = (performance.now() - input.eStart) / 1000;
    const h = nearestHuman(1.3);
    if (h && h !== F.lily && held > 1.1) { input.eUsedHold = true; if (!awake(h)) wake(h); bite(h); }
  }
  // hold C in the bed to sleep
  if (input.cDown && dist2d(dog.pos, spots.dogBed) < 0.6 && !S.cut) {
    S.bedHold += dt;
    if (S.bedHold > 3) { S.bedHold = -99; sleepInBed(); }
  } else if (S.bedHold > 0) S.bedHold = 0; else if (!input.cDown) S.bedHold = 0;

  // TV
  if (S.tvOn) {
    S.tvAcc = (S.tvAcc || 0) - dt;
    if (S.tvAcc <= 0) { S.tvAcc = 0.07; updateTV(S.t, S.tvFace > 0); }
    S.tvFace -= dt;
    lights[2].intensity = 0.7 + Math.random() * 0.4;
    refs.tvScreen.material.uniforms.uColor.value.setScalar(1);
  } else refs.tvScreen.material.uniforms.uColor.value.setScalar(0.05);
  refs.lampShade.material.uniforms.uEmissive.value.setScalar(lights[1].on ? 0.3 : 0);

  // clock
  S.clockAcc += dt;
  const tickEvery = S.co > 0.6 ? 1 + Math.sin(S.t) * 0.6 : 1;
  if (S.clockAcc > tickEvery) { S.clockAcc = 0; AU.clockTick(12.8, 2, 5.1, 0.6); refs.clockHand.rotation.z -= Math.PI / 30; }

  // heartbeat
  if (S.dogCO > 0.42 && S.t > S.nextBeat) {
    const bpm = 62 + S.dogCO * 70 + (S.presenceActive ? 50 : 0);
    S.nextBeat = S.t + 60 / bpm;
    AU.heartbeat((S.dogCO - 0.4) * 0.9 + (S.presenceActive ? 0.3 : 0));
    S.pulse = 1;
  }
  S.pulse = Math.max(0, (S.pulse || 0) - dt * 5);
  P.uPulse.value = S.pulse;
  P.uStretch.value = Math.max(0, Math.min(1, (S.co - 0.78) * 4));

  // blackouts near the end
  if (S.dogCO > 0.85 && Math.random() < dt * 0.06) S.blackout = 0.6 + Math.random() * 0.6;
  S.blackout = Math.max(0, S.blackout - dt);
  P.uBlackout.value = Math.min(1, S.blackout * 2);
  // jumpscare face
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

  // scent
  emitScents(dt);
  const sniffTarget = input.sniff ? 1 : 0;
  S.sniff += (sniffTarget - S.sniff) * Math.min(1, dt * 6);
  G.uSniff.value = S.sniff;
  P.uSniff.value = S.sniff;
  if (input.sniff) { S.sniffSnd = (S.sniffSnd || 0) - dt; if (S.sniffSnd <= 0) { S.sniffSnd = 0.35; AU.step('soft'); } }
  S.label = S.sniff > 0.5 ? sniffLabel() : '';
  S.prompt = computePrompt();

  // fades
  const ft = S.fade || 0;
  S.fadeV = (S.fadeV || 0) + (ft - (S.fadeV || 0)) * Math.min(1, dt * (S.fadeSpeed || 2) * 2);
  P.uFade.value = Math.max(S.fadeV, 0);

  AU.updateAmbience(S.dogCO, S.t, S.windBoost || 0);
  G.uAmbient.value.set(0.06 + S.flash * 0.1, 0.065 + S.flash * 0.1, 0.095 + S.flash * 0.12);
  if (S.debugLight) G.uAmbient.value.setScalar(S.debugLight); // testing aid only
}
