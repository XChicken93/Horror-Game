// Dread: something is always a little wrong in this house, and it gets worse as the night
// goes on. Small sounds all the time; every half minute or so, something bigger.
import * as THREE from '../vendor/three.module.js';
import { ps1Mat } from './ps1.js';
import * as AU from './audio.js';
import { doors, lights, refs, spots, items, roomAt, isOutside, BASE_Y } from './house.js';
import { showSubtitle } from './humans.js';
import { dog, inBasement, dogForward, lookAtPoint } from './player.js';
import { emit } from './scent.js';

let C = null; // { S, F, scene, later, scared, say }
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const note = (t, secs = 3) => showSubtitle('note', `<span class="note">${t}</span>`, secs);
const ROOMNAME = { parents: 'the parents\' room', lily: 'the girl\'s room', danny: 'Danny\'s room', laundry: 'the laundry room', kitchen: 'the kitchen', living: 'the living room', entry: 'by the front door', hall: 'the hall', basement: 'under the house' };
const ROOMSPOT = { parents: [1.6, 1.6], lily: [6.2, 1.2], danny: [9.2, 1.0], laundry: [11.6, 2.4], kitchen: [12.8, 8.8], living: [4.0, 6.0], entry: [0.6, 6.2] };

export function initDread(ctx) { C = ctx; C.S.nextDread = 45; C.S.nextMicro = 8; C.S.dreadLog = []; }

const indoors = () => !isOutside(dog.pos.x, dog.pos.z, dog.y);
const groundFloor = () => indoors() && !inBasement() && dog.y > -0.3;
const familyAwake = () => [C.F.father, C.F.mother, C.F.lily].filter((h) => (!h.asleep || C.S.t < h.awakeUntil) && !h.unconscious);

// --------------------------------------------------------------------------
const EVENTS = [
  {
    id: 'stepsBehind', w: 3, ok: () => groundFloor() || inBasement(),
    run() {
      const f = dogForward();
      const x = dog.pos.x - f.x * 1.8, z = dog.pos.z - f.z * 1.8;
      for (let i = 0; i < 3; i++) C.later(i * 0.75, () => AU.step('heavy', x - f.x * (2 - i) * 0.4, dog.y + 0.05, z - f.z * (2 - i) * 0.4, 0.9));
      C.later(2.6, () => AU.breathing(x, dog.y + 1.7, z, 0.7));
    },
  },
  {
    id: 'knockUnder', w: 2, ok: () => groundFloor(),
    run() { AU.knock(dog.pos.x, -0.4, dog.pos.z, 3, 0.9); C.later(2.2, () => AU.knock(dog.pos.x + 0.6, -0.4, dog.pos.z, 1, 0.6)); },
  },
  {
    id: 'whisper', w: 2, ok: () => indoors() && C.S.coOn,
    run() {
      const f = dogForward();
      const x = dog.pos.x - f.z * 0.9, z = dog.pos.z + f.x * 0.9;
      AU.ventVoice(x, dog.y + 0.5, z);
      C.later(1.2, () => note('(right beside you, very quietly: <i>Biscuit.</i>)', 2.5));
    },
  },
  {
    id: 'doorDrift', w: 2, ok: () => groundFloor(),
    run() {
      const fwd = dogForward();
      for (const name of ['parents', 'lily', 'laundry']) {
        const d = doors[name];
        if (name === 'laundry' && C.S.locked) continue;
        const p = v3(d.hingeX + 0.45, 0, d.hingeZ);
        const to = v3(p.x - dog.pos.x, 0, p.z - dog.pos.z); const dd = to.length();
        if (dd > 9 || dd < 1.5 || fwd.dot(to.normalize()) > 0.2) continue;
        const a0 = d.target; d.speed = 0.22; d.target = Math.max(0.35, a0 - 0.7);
        AU.creak(p.x, 1, p.z, 3.5, 1.1);
        C.later(10, () => { d.speed = 0.4; d.target = a0; });
        return;
      }
    },
  },
  {
    id: 'stare', w: 2, ok: () => groundFloor() && familyAwake().filter((h) => dist2d(h.pos, dog.pos) < 8 && Math.abs(h.pos.y - dog.y) < 1).length >= 1,
    run() {
      // every one of them stops and looks at you at the same moment, and holds it
      const S = C.S;
      for (const h of familyAwake()) {
        if (dist2d(h.pos, dog.pos) > 8) continue;
        h.lookAt = null; h.look(v3(dog.pos.x, dog.y + 0.35, dog.pos.z), 6.5, S.t);
        h.blinkAt = S.t + 7;
        if (S.co > 0.15) { C.later(3.2, () => h.setFace(true)); C.later(3.45, () => h.setFace(false)); }
      }
      AU.stinger(0.25);
    },
  },
  {
    id: 'flicker', w: 3, ok: () => groundFloor() && C.S.power !== false && !C.S.stalkOn,
    run() {
      const room = roomAt(dog.pos.x, dog.pos.z, dog.y);
      const L = room === 'kitchen' ? lights[0] : room === 'living' || room === 'entry' ? lights[1] : lights[3];
      if (!L || !L.on) return;
      const f0 = L.flicker; L.flicker = 1;
      C.later(0.6, () => { L.on = false; AU.knock(L.pos.x, L.pos.y, L.pos.z, 1, 0.2); });
      // when it comes back on, for a moment, something is standing in the room
      C.later(2.6, () => {
        L.on = true; L.flicker = f0;
        if (C.S.co < 0.12 || C.S.presenceActive) return;
        const f = dogForward(), side = Math.random() < 0.5 ? -1 : 1;
        const x = dog.pos.x + f.x * 3.2 - f.z * side * 1.6, z = dog.pos.z + f.z * 3.2 + f.x * side * 1.6;
        if (roomAt(x, z, 0) !== room) return;
        const p = C.S.presence;
        p.setPos(x, z, 0); p.yaw = Math.atan2(dog.pos.x - x, dog.pos.z - z); p.update(0.001, C.S.t, 0, dog.pos);
        p.root.visible = true; C.S.glimpse = 0.22;
        C.later(0.25, () => C.scared(0.7));
      });
    },
  },
  {
    id: 'phone', w: 1, ok: () => indoors() && C.S.coOn && C.S.co > 0.15, once: true,
    run() { AU.phone(9.08, 1.4, 6.0, 1); C.later(3.5, () => note('(The phone rings once in the kitchen, and stops. Nobody calls this late.)', 3.5)); },
  },
  {
    id: 'groan', w: 2, ok: () => indoors(), run() { AU.groan(9 + Math.random() * 4, -0.6, -1.5 + Math.random() * 3, 0.9); },
  },
  {
    id: 'ball', w: 1, ok: () => groundFloor() && roomAt(dog.pos.x, dog.pos.z, dog.y) === 'hall' && C.ball && !C.ball.carried && !C.ball.gone, once: true,
    run() {
      // his ball comes bouncing down the hall toward you out of the dark
      const fromX = dog.pos.x < 7 ? 13.0 : 0.6;
      const b = C.ball;
      b.mesh.position.set(fromX, 0.05, 4.25);
      C.S.ballRoll = { x0: fromX, x1: dog.pos.x + (fromX > dog.pos.x ? 0.9 : -0.9), t: 0 };
      AU.ballBounce(fromX, 0.3, 4.25, 7);
      C.later(0.3, () => C.scared(0.5));
      C.later(4, () => note('(Danny\'s ball. It stops right in front of you, as if somebody wanted to play.)', 3.5));
    },
  },
  {
    id: 'callFromDark', w: 2, ok: () => groundFloor() && C.S.deep,
    run() {
      // her voice, from a dark room she is not in
      const S = C.S, m = C.F.mother;
      const myRoom = roomAt(dog.pos.x, dog.pos.z, dog.y), herRoom = roomAt(m.pos.x, m.pos.z, 0);
      const keys = Object.keys(ROOMSPOT).filter((k) => k !== myRoom && k !== herRoom);
      const k = keys[Math.floor(Math.random() * keys.length)];
      const [x, z] = ROOMSPOT[k];
      AU.speak('mother', 5, 'whisper', () => [x, 1.4, z], 0.95);
      C.later(0.4, () => note(`(from ${ROOMNAME[k]}, in the dark, in the woman's voice: <i>Biscuit. Come here, boy. Come here.</i> But she is asleep in her bed.)`, 4.5));
      S.fakeCall = { x, z, until: S.t + 30 };
    },
  },
  {
    id: 'prints', w: 2, ok: () => groundFloor() && C.S.coOn && C.S.co > 0.1,
    run() {
      // small wet boot prints, from the front door to the basement door
      const pts = [[1.5, 9.6], [1.55, 8.9], [1.45, 8.2], [1.55, 7.5], [1.45, 6.8], [1.55, 6.1], [1.6, 5.3], [2.1, 4.4], [2.8, 4.2], [3.5, 4.3], [4.2, 4.2], [4.9, 4.3], [5.6, 4.2], [6.3, 4.3], [7.0, 4.2], [7.7, 4.3], [8.4, 4.2], [9.1, 4.3], [9.8, 4.2], [10.5, 4.3], [11.2, 4.2], [11.9, 4.3], [12.6, 4.2], [13.2, 3.9]];
      bootPrints(pts);
      C.S.prints = C.S.t + 70;
    },
  },
  {
    id: 'sleepwalk', w: 2, once: true, ok: () => groundFloor() && C.S.deep && C.S.ch < 8 && C.S.co > 0.3 && C.F.father.pose === 'sleep' && !C.S.cut,
    run() {
      // he is out of bed, standing at the end of the hall with his face to the wall
      const f = C.F.father;
      f.setActivity({ spot: v3(0.35, 0, 4.25), face: -Math.PI / 2, pose: 'stand' });
      f.asleep = true; f.awakeUntil = 0;
      C.S.sleepwalk = { t: 0, turned: false };
    },
  },
  {
    id: 'tvOn', w: 1, ok: () => groundFloor() && C.S.deep && C.S.power !== false && !C.S.tvOn,
    run() {
      const S = C.S;
      S.tvOn = true; S.tvFace = 3.5; AU.setTV(true); lights[2].on = true;
      AU.stinger(0.4);
      C.later(5, () => { S.tvOn = false; AU.setTV(false); lights[2].on = false; });
    },
  },
  {
    id: 'eyes', w: 2, ok: () => groundFloor() && dog.lying > 0.5 && ['parents', 'lily', 'living'].includes(roomAt(dog.pos.x, dog.pos.z, dog.y)),
    run() {
      // lying flat, you see under the furniture: two eyes, looking back
      const f = dogForward();
      const x = dog.pos.x + f.x * 1.6, z = dog.pos.z + f.z * 1.6;
      eyes(x, z);
      C.later(0.1, () => C.scared(0.6));
    },
  },
];

// --------------------------------------------------------------------------
let printM = null, eyeMesh = null;
const prints = [];
function bootPrints(pts) {
  if (!printM) {
    const c = document.createElement('canvas'); c.width = 8; c.height = 16;
    const g = c.getContext('2d'); g.fillStyle = '#1c2026'; g.fillRect(2, 1, 4, 8); g.fillRect(2, 11, 4, 4);
    const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace;
    printM = ps1Mat({ map: t });
  }
  for (const m of prints) C.scene.remove(m);
  prints.length = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x, z] = pts[i], [x2, z2] = pts[i + 1];
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.2), printM);
    const ang = Math.atan2(x2 - x, z2 - z);
    m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, ang + Math.PI, 0);
    m.position.set(x + Math.cos(ang) * (i % 2 ? 0.07 : -0.07), 0.006, z);
    C.scene.add(m); prints.push(m);
  }
}
function eyes(x, z) {
  if (!eyeMesh) {
    eyeMesh = new THREE.Group();
    const m = ps1Mat({ color: 0xffe0a0, unlit: true });
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.01), m); e.position.x = s * 0.06; eyeMesh.add(e); }
    C.scene.add(eyeMesh);
  }
  eyeMesh.position.set(x, 0.12, z);
  eyeMesh.rotation.y = Math.atan2(dog.pos.x - x, dog.pos.z - z);
  eyeMesh.visible = true;
  C.S.eyesT = 0.7;
}

// --------------------------------------------------------------------------
export function updateDread(dt) {
  const S = C.S;
  if (S.cut || S.ended || S.inspectOpen) return;
  // the small things: the house settling, never quite quiet
  S.nextMicro -= dt;
  if (S.nextMicro <= 0) {
    S.nextMicro = 6 + Math.random() * 12 - S.co * 4;
    if (indoors()) {
      const r = Math.random();
      const x = Math.random() * 14, z = Math.random() * 10;
      if (r < 0.35) AU.creak(x, 1.5 + Math.random(), z, 0.4 + Math.random() * 0.8, 0.55);
      else if (r < 0.55) AU.knock(x, 2.5, z, 1, 0.25);
      else if (r < 0.7) AU.groan(9 + Math.random() * 4, -0.6, -1.5, 0.35);
      else if (r < 0.82 && S.coOn) AU.ventVoice(spots.lilyVent.x, 0.1, spots.lilyVent.z);
      else AU.step('heavy', x, 2.7, z, 0.35); // someone in the attic. There is no attic.
    }
  }
  // the bigger things
  S.nextDread -= dt;
  if (S.nextDread <= 0 && S.t > 40) {
    S.nextDread = 32 + Math.random() * 38 - S.co * 18;
    const pool = EVENTS.filter((e) => (!e.once || !S.dreadLog.includes(e.id)) && !S.dreadLog.slice(-3).includes(e.id) && e.ok());
    let total = 0; for (const e of pool) total += e.w;
    let r = Math.random() * total;
    for (const e of pool) { r -= e.w; if (r <= 0) { S.dreadLog.push(e.id); e.run(); break; } }
  }
  // things in progress
  if (S.ballRoll) {
    const B = S.ballRoll, b = C.ball; B.t += dt;
    const k = Math.min(1, B.t / 3.2), e = 1 - Math.pow(1 - k, 2.4);
    b.mesh.position.x = B.x0 + (B.x1 - B.x0) * e;
    b.mesh.position.y = 0.05 + Math.abs(Math.sin(B.t * 6)) * 0.25 * (1 - k);
    b.mesh.rotation.z -= dt * 10 * (1 - k);
    if (k >= 1) S.ballRoll = null;
  }
  if (S.glimpse > 0) { S.glimpse -= dt; if (S.glimpse <= 0 && !S.presenceActive && !(S.stalk && S.stalk.state !== 'away')) S.presence.root.visible = false; }
  if (S.eyesT > 0) { S.eyesT -= dt; if (S.eyesT <= 0 && eyeMesh) eyeMesh.visible = false; }
  if (S.prints && S.t > S.prints) { for (const m of prints) C.scene.remove(m); prints.length = 0; S.prints = 0; }
  if (S.sleepwalk) {
    const W = S.sleepwalk, f = C.F.father; W.t += dt;
    if (!W.turned && dist2d(dog.pos, f.pos) < 2.4 && !f.path.length) {
      W.turned = true;
      f.setFace(true); f.look(v3(dog.pos.x, dog.y + 0.4, dog.pos.z), 6, S.t);
      AU.stinger(0.9); C.scared(1);
      lookAtPoint(f.pos.x, 1.6, f.pos.z, 1.2);
      C.later(1.5, () => note('(His eyes are open. He is not awake. He does not know you.)', 3.5));
    }
    if ((W.turned && W.t > 14) || W.t > 60 || S.ch >= 8 || S.alarmOn) {
      S.sleepwalk = null; f.setFace(false);
      f.setActivity({ spot: spots.parentBedF.clone(), pose: 'sleep', face: 0 });
    }
  }
  // the false call: if you go to where her voice was, there is only cold air
  if (S.fakeCall && S.t < S.fakeCall.until && Math.hypot(dog.pos.x - S.fakeCall.x, dog.pos.z - S.fakeCall.z) < 1.2) {
    S.fakeCall = null;
    for (let i = 0; i < 30; i++) emit(dog.pos.x, 0.3 + Math.random() * 1.5, dog.pos.z, 'wrong', { spread: 1.5, life: 2, size: 0.06 });
    AU.breathing(dog.pos.x, 1.6, dog.pos.z, 0.8);
    note('(Nobody. Only the smell of the hot box, very strong, as if something had just been standing here.)', 3.5);
  }
  // the constant drone, rising with the poison and with whatever is near
  AU.setDrone(Math.min(1, (S.coOn ? 0.2 + S.co * 0.7 : 0.08) + (S.stalkNear || 0) * 0.5 + (S.presenceActive ? 0.3 : 0)), S.t);
}
