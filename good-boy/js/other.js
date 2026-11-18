// THE OTHER SIDE. The last chapter: Biscuit goes into the furnace and comes out on a street
// that is almost his. The family is here, and dead. The thing is here. So is Danny.
//
// The world is built far from the house (x around OX) so none of it touches the real one.
// Stages: street -> house -> risen -> feast -> run1 -> safe -> torn -> danny -> walk -> peek
//         -> chase -> edge -> throw -> (home)
import * as THREE from '../vendor/three.module.js';
import { ps1Mat, G, P, planarUV } from './ps1.js';
import { T } from './textures.js';
import * as AU from './audio.js';
import { colliders, lights, collide, SURFACES } from './house.js';
import { dog, input, act, lookAtPoint } from './player.js';
import { puff, FXCFG } from './fx.js';
import { showSubtitle } from './humans.js';

export const OX = 300;
const HALE = { x0: OX - 6, x1: OX + 6, z0: 8, z1: 15 };   // the house that is almost theirs
const SAFE = { x0: OX + 40, x1: OX + 50, z0: 8, z1: 14 }; // the yellow house with the dog flap
const FLAP_X = OX + 45;
const TEAR_END = new THREE.Vector3(OX + 241, 1.9, 0);
const EDGE_X = OX + 227.5;          // where the road gives way
const CHECKPOINTS = [OX + 85, OX + 120, OX + 155, OX + 190, OX + 212];
let C = null;                        // story context
const W = new THREE.Group();         // everything over here
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** half-width of the road: it starts to close in past x = OX + 100 */
export const roadW = (x) => (x < OX + 100 ? 8 : Math.max(2.4, 8 - (x - OX - 100) * (5.6 / 125)));

// ---------------------------------------------------------------------------
// building helpers
function mat(o) { return ps1Mat(o); }
const sg = (n) => Math.max(1, Math.min(24, Math.ceil(n / 1.5)));
function blk(x0, y0, z0, x1, y1, z1, m, o = {}) {
  const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0, sg(x1 - x0), sg(y1 - y0), sg(z1 - z0));
  const c = v3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  if (o.uv) planarUV(geo, c, o.uv);
  const me = new THREE.Mesh(geo, m); me.position.copy(c); (o.parent || W).add(me);
  if (o.wall || o.solid) colliders.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: y0, maxY: y1, tag: o.wall ? 'wall' : undefined, other: true });
  return me;
}
function put(geo, m, x, y, z, o = {}) {
  const me = new THREE.Mesh(geo, m); me.position.set(x, y, z);
  if (o.rx) me.rotation.x = o.rx; if (o.ry) me.rotation.y = o.ry; if (o.rz) me.rotation.z = o.rz;
  (o.parent || W).add(me); return me;
}
// a flat, finely divided floor (vertex lighting needs the vertices)
function plane(x0, z0, x1, z1, y, m, uv, step) {
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.min(200, Math.ceil((x1 - x0) / step)), Math.min(60, Math.ceil((z1 - z0) / step)));
  geo.rotateX(-Math.PI / 2);
  const c = v3((x0 + x1) / 2, y, (z0 + z1) / 2);
  planarUV(geo, c, uv);
  const me = new THREE.Mesh(geo, m); me.position.copy(c); W.add(me); return me;
}
const seg = (x0, z0, x1, z1, maxY = 3) => colliders.push({ seg: [x0, z0, x1, z1], minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1), minY: 0, maxY, other: true });

// lights over here: a list of sources, the nearest twelve get the real light slots each frame
const OL = [];
function src(x, y, z, col, range, box, o = {}) { const L = { pos: v3(x, y, z), color: new THREE.Color(col), range, box, on: true, k: o.k || 1, k0: o.k || 1, flicker: o.flicker || 0 }; OL.push(L); return L; }
const OUT_BOX = [OX - 90, -1, -40, OX + 270, 14, 8.05]; // the street side of the house fronts

const M = {};
function mats() {
  M.ground = mat({ map: T.dirt, color: 0x8a7060 });
  M.road = mat({ map: T.concrete, color: 0x6a605a });
  M.walk = mat({ map: T.concrete, color: 0x7a7068 });
  M.line = mat({ color: 0xb08a20, emissive: 0x1a1000 });
  M.ext = mat({ map: T.exterior, color: 0x9a8a80 });
  M.extY = mat({ map: T.exterior, color: 0xc8b060 });
  M.roof = mat({ color: 0x2a2220 });
  M.winDark = mat({ color: 0x080606 });
  M.winLit = mat({ color: 0xc87830, unlit: true });
  M.fence = mat({ map: T.wood, color: 0x6a5a48 });
  M.pole = mat({ color: 0x3a3632 });
  M.lamp = mat({ color: 0xffb060, unlit: true, noFog: true });
  M.lampOff = mat({ color: 0x2a2220 });
  M.trunk = mat({ map: T.bark, color: 0x4a4038 });
  M.wallIn = mat({ map: T.wallRose, color: 0x8a6a68 });
  M.wallSafe = mat({ map: T.wallKitchen, color: 0xa08a60 });
  M.floorIn = mat({ map: T.planks, color: 0x6a5040 });
  M.ceil = mat({ map: T.ceiling, color: 0x6a5a50 });
  M.plaid = mat({ map: T.plaid, color: 0x8a6a6a });
  M.wood = mat({ map: T.wood });
  M.metal = mat({ map: T.metal, color: 0x8a8070 });
  M.black = mat({ color: 0x020202 });
  M.red = mat({ color: 0xb01810, emissive: 0x300000 });
  M.fire = mat({ color: 0xff6a18, unlit: true });
  M.glass = mat({ color: 0x101418 });
}

function house(x0, x1, side, col = M.ext) {
  // a whole house, seen from the street: solid. side +1 = north (z > 0), -1 = south
  const z0 = side > 0 ? 8 : -15, z1 = side > 0 ? 15 : -8, fz = side > 0 ? 7.98 : -7.98;
  blk(x0, 0, z0, x1, 3.2, z1, col, { solid: true, uv: 2 });
  const roof = put(new THREE.CylinderGeometry(0.01, (z1 - z0) * 0.62, x1 - x0 + 0.4, 4, 1), M.roof, (x0 + x1) / 2, 4.3, (z0 + z1) / 2, { rz: Math.PI / 2 });
  roof.rotation.x = Math.PI / 4; roof.scale.set(1, 1, 0.55);
  const nw = Math.max(1, Math.floor((x1 - x0) / 3.2));
  for (let i = 0; i < nw; i++) {
    const wx = x0 + (i + 0.5) * (x1 - x0) / nw;
    const lit = ((wx * 7.3) | 0) % 5 === 0;
    blk(wx - 0.6, 1.1, fz - 0.02, wx + 0.6, 2.2, fz + 0.02, lit ? M.winLit : M.winDark);
  }
}
function fence(x0, x1, z) { blk(x0, 0, z - 0.04, x1, 1.3, z + 0.04, M.fence, { wall: true, uv: 1 }); }
function car(x, z, ry, col, parent) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; (parent || W).add(g);
  const body = mat({ color: col }), glass = M.glass;
  put(new THREE.BoxGeometry(4.2, 0.7, 1.8), body, 0, 0.6, 0, { parent: g });
  put(new THREE.BoxGeometry(2.2, 0.55, 1.6), body, -0.2, 1.22, 0, { parent: g });
  put(new THREE.BoxGeometry(2.24, 0.42, 1.62), glass, -0.2, 1.24, 0, { parent: g });
  for (const [wx, wz] of [[1.3, 0.85], [1.3, -0.85], [-1.3, 0.85], [-1.3, -0.85]]) put(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10), M.black, wx, 0.34, wz, { parent: g, rx: Math.PI / 2 });
  const hl = mat({ color: 0xfff0c0, unlit: true });
  for (const s of [-0.6, 0.6]) { put(new THREE.BoxGeometry(0.05, 0.16, 0.3), hl, 2.11, 0.68, s, { parent: g }); put(new THREE.BoxGeometry(0.05, 0.14, 0.3), M.red, -2.11, 0.7, s, { parent: g }); }
  g.headMat = hl;
  return g;
}
function streetlight(x, z, side) {
  // a pole on a pivot at its base, so it can fall across the road
  const g = new THREE.Group(); g.position.set(x, 0, z); W.add(g);
  put(new THREE.CylinderGeometry(0.08, 0.11, 5.6, 6), M.pole, 0, 2.8, 0, { parent: g });
  put(new THREE.BoxGeometry(0.1, 0.1, 1.4), M.pole, 0, 5.5, -side * 0.65, { parent: g });
  const head = put(new THREE.BoxGeometry(0.3, 0.14, 0.45), M.lamp.clone(), 0, 5.42, -side * 1.3, { parent: g });
  head.material = mat({ color: 0xffb060, unlit: true, noFog: true, unique: true });
  const L = src(x, 5.2, z - side * 1.3, 0xff9a40, 9, OUT_BOX, { flicker: 0.15 });
  return { g, head, L, side };
}
function deadTree(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); W.add(g);
  put(new THREE.CylinderGeometry(0.12, 0.22, 4.2, 6), M.trunk, 0, 2.1, 0, { parent: g });
  for (let i = 0; i < 6; i++) { const b = put(new THREE.CylinderGeometry(0.03, 0.07, 1.6, 4), M.trunk, 0, 2.4 + i * 0.3, 0, { parent: g, rz: (i % 2 ? 1 : -1) * (0.7 + i * 0.08), ry: i * 1.1 }); b.translateY(0.7); }
  return g;
}
// the tear: a jagged rip in the air, burning orange
function makeTear() {
  const g = new THREE.Group(); W.add(g);
  const sh = new THREE.Shape(); const n = 14;
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, y = -2 + t * 4; const w = Math.sin(t * Math.PI) * (0.9 + ((i * 37) % 7) / 14); pts.push([w * (i % 2 ? 0.75 : 1), y]); }
  sh.moveTo(0, -2.2); for (const [x, y] of pts) sh.lineTo(x, y); sh.lineTo(0, 2.3); for (const [x, y] of pts.slice().reverse()) sh.lineTo(-x * (0.9 + ((y * 10) | 0) % 3 * 0.05), y); sh.lineTo(0, -2.2);
  const geo = new THREE.ShapeGeometry(sh);
  const outer = put(geo, mat({ color: 0xff5010, unlit: true, noFog: true, opacity: 0.45, side: THREE.DoubleSide, unique: true }), 0, 0, 0, { parent: g }); outer.scale.set(1.5, 1.12, 1);
  const mid = put(geo, mat({ color: 0xff8a20, unlit: true, noFog: true, side: THREE.DoubleSide, unique: true }), 0, 0, 0.01, { parent: g });
  const core = put(geo, mat({ color: 0xfff0b0, unlit: true, noFog: true, side: THREE.DoubleSide, unique: true }), 0, 0, 0.02, { parent: g }); core.scale.set(0.35, 0.9, 1);
  g.parts = { outer, mid, core };
  g.visible = false;
  return g;
}
// Biscuit in Danny's arms, at the bottom of the view
function makeArms(camera) {
  const g = new THREE.Group(); camera.add(g); g.visible = false;
  const fur = mat({ map: T.fur, color: 0xc89a60, emissive: 0x1c140c }), dark = mat({ map: T.fur, color: 0x8a6036 });
  const hood = mat({ map: T.hoodie, color: 0x9aa0aa }), skin = mat({ map: T.skin, color: 0xe0c0a8 });
  // his back and shoulders, low in your arms; his head up, looking where you look
  const back = put(new THREE.SphereGeometry(0.2, 8, 6), fur, 0, -0.5, -0.5, { parent: g }); back.scale.set(1.05, 0.7, 1.2);
  const head = new THREE.Group(); head.position.set(0.04, -0.27, -0.66); g.add(head);
  const skull = put(new THREE.SphereGeometry(0.1, 8, 6), fur, 0, 0, 0, { parent: head }); skull.scale.set(1, 0.95, 1.05);
  put(new THREE.BoxGeometry(0.08, 0.07, 0.13), fur, 0, -0.035, -0.12, { parent: head });
  put(new THREE.BoxGeometry(0.04, 0.03, 0.03), M.black, 0, -0.012, -0.19, { parent: head });
  for (const s of [-1, 1]) {
    const ear = put(new THREE.BoxGeometry(0.035, 0.13, 0.08), dark, s * 0.095, -0.045, 0.01, { parent: head, rz: s * (s > 0 ? 0.15 : 0.45) }); void ear; // one ear never stood up
    put(new THREE.BoxGeometry(0.06, 0.12, 0.06), fur, s * 0.12, -0.55, -0.62, { parent: g });
  }
  for (const s of [-1, 1]) {
    put(new THREE.BoxGeometry(0.11, 0.11, 0.42), hood, s * 0.21, -0.42, -0.32, { parent: g, ry: -s * 0.35 });
    put(new THREE.BoxGeometry(0.08, 0.05, 0.12), skin, s * 0.1, -0.44, -0.55, { parent: g, ry: -s * 0.9 });
  }
  g.head = head;
  return g;
}

// ---------------------------------------------------------------------------
const H = { poles: [], trees: [], cars: [], parked: [] };
let tear, arms, slabs = [];
export function buildOther(ctx) {
  C = ctx;
  mats();
  C.scene.add(W);
  // ground, road, sidewalks, the centre line
  plane(OX - 90, -40, OX + 270, 40, -0.012, M.ground, 3, 3);
  plane(OX - 90, -5, EDGE_X + 1.5, 5, 0.002, M.road, 2.5, 2);
  for (const s of [-1, 1]) plane(OX - 90, s > 0 ? 5 : -8, OX + 100, s > 0 ? 8 : -5, 0.004, M.walk, 1.2, 2);
  for (let x = OX - 88; x < EDGE_X; x += 4) blk(x, 0.002, -0.06, x + 2, 0.006, 0.06, M.line);
  // the far side of the chasm, and the dark under it
  blk(OX + 236.5, -0.01, -4, OX + 250, 0.002, 4, M.road, { uv: 2.5 });
  blk(EDGE_X + 1.5, -6, -6, OX + 236.5, -5.8, 6, M.black);
  for (let i = 0; i < 3; i++) slabs.push(blk(EDGE_X + 2 + i * 2.33, -0.2, -3, EDGE_X + 2 + (i + 1) * 2.33, 0.002, 3, M.road, { uv: 2.5 }));
  // the west end of the street just stops, in fog
  seg(OX - 62, -8, OX - 62, 8);

  // ---- north side: houses and fences, with the two that matter
  const north = [[OX - 58, OX - 46], [OX - 42, OX - 30], [OX - 26, OX - 12], [OX + 10, OX + 22], [OX + 26, OX + 36], [OX + 54, OX + 66], [OX + 70, OX + 82], [OX + 86, OX + 99]];
  for (const [a, b] of north) house(a, b, 1);
  const nGaps = [[OX - 62, OX - 58], [OX - 46, OX - 42], [OX - 30, OX - 26], [OX - 12, OX - 9.6], [OX - 8.4, HALE.x0], [HALE.x1, OX + 10], [OX + 22, OX + 26], [OX + 36, SAFE.x0], [SAFE.x1, OX + 51.4], [OX + 52.6, OX + 54], [OX + 66, OX + 70], [OX + 82, OX + 86]];
  for (const [a, b] of nGaps) fence(a, b, 8);
  // behind everything: you cannot wander off the back of the world
  seg(OX - 62, 15.3, OX + 100, 15.3);
  for (const [a, b] of [[OX - 12, HALE.x0], [SAFE.x1, OX + 54]]) fence(a, b, 15.3);
  // a broken gate leaning in each side-yard gap
  put(new THREE.BoxGeometry(1.1, 1.2, 0.06), M.fence, OX - 9.0, 0.5, 8.6, { ry: 1.2, rz: 0.25 });
  put(new THREE.BoxGeometry(1.1, 1.2, 0.06), M.fence, OX + 52.0, 0.5, 8.7, { ry: -1.1, rz: -0.3 });
  const south = [[OX - 60, OX - 48], [OX - 44, OX - 32], [OX - 28, OX - 14], [OX - 10, OX + 4], [OX + 8, OX + 20], [OX + 24, OX + 36], [OX + 56, OX + 68], [OX + 72, OX + 84], [OX + 88, OX + 99]];
  for (const [a, b] of south) house(a, b, -1);
  for (const [a, b] of [[OX - 62, OX - 60], [OX - 48, OX - 44], [OX - 32, OX - 28], [OX - 14, OX - 10], [OX + 4, OX + 8], [OX + 20, OX + 24], [OX + 36, OX + 56], [OX + 68, OX + 72], [OX + 84, OX + 88]]) fence(a, b, -8);
  // an empty lot across from the yellow house: where it tears open
  for (let x = OX - 50; x < OX + 100; x += 20) for (const s of [-1, 1]) { const sl = streetlight(x + (s > 0 ? 0 : 10), s * 7.3, s); sl.static = true; }
  for (const [x, z] of [[OX - 35, -6.6], [OX - 4, 6.6], [OX + 18, -6.6], [OX + 31, 6.6], [OX + 62, -6.6], [OX + 76, -6.6], [OX + 92, 6.6]]) { const c = car(x, z, 0, [0x5a2a20, 0x2a3a4a, 0x4a4a3a, 0x3a2a3a][((x * 3) | 0) % 4]); H.parked.push(c); colliders.push({ minX: x - 2.1, maxX: x + 2.1, minZ: z - 0.9, maxZ: z + 0.9, minY: 0, maxY: 1.5, other: true }); }
  for (const x of [OX - 20, OX + 52, OX + 84]) deadTree(x, -6.9);

  // ---- the house that is almost theirs
  {
    const { x0, x1, z0, z1 } = HALE;
    blk(x0, 0, z0 - 0.06, OX - 0.6, 2.6, z0 + 0.06, M.ext, { wall: true, uv: 2 });
    blk(OX + 0.6, 0, z0 - 0.06, x1, 2.6, z0 + 0.06, M.ext, { wall: true, uv: 2 });
    blk(OX - 0.6, 2.1, z0 - 0.06, OX + 0.6, 2.6, z0 + 0.06, M.ext, { wall: true });
    blk(x0, 0, z1 - 0.06, x1, 2.6, z1 + 0.06, M.wallIn, { wall: true, uv: 2 });
    blk(x1 - 0.06, 0, z0, x1 + 0.06, 2.6, z1, M.wallIn, { wall: true, uv: 2 });
    // the west wall has a dog flap in it, like yours at home. Ash blows in through it.
    blk(x0 - 0.06, 0, z0, x0 + 0.06, 2.6, 12.9, M.wallIn, { wall: true, uv: 2 });
    blk(x0 - 0.06, 0, 13.5, x0 + 0.06, 2.6, z1, M.wallIn, { wall: true, uv: 2 });
    blk(x0 - 0.06, 0.56, 12.9, x0 + 0.06, 2.6, 13.5, M.wallIn, { wall: true });
    H.haleFlap = new THREE.Group(); H.haleFlap.position.set(x0, 0.55, 13.2); W.add(H.haleFlap);
    put(new THREE.BoxGeometry(0.02, 0.5, 0.56), mat({ color: 0x4a3a2a, opacity: 0.6, unique: true }), 0, -0.26, 0, { parent: H.haleFlap });
    src(x0 - 0.8, 0.5, 13.2, 0x8090c8, 3.2, [x0 - 3, -1, 12, x0 + 2.5, 2, 14.5], { flicker: 0.3, k: 1.3 });
    // the front door: open, until they get up
    H.haleDoor = new THREE.Group(); H.haleDoor.position.set(OX - 0.6, 0, z0); W.add(H.haleDoor);
    put(new THREE.BoxGeometry(1.2, 2.08, 0.06), mat({ map: T.frontDoor, color: 0x8a6a5a }), 0.6, 1.04, 0, { parent: H.haleDoor });
    H.haleDoor.rotation.y = -1.45;
    H.haleDoorCol = { minX: OX - 0.6, maxX: OX + 0.6, minZ: z0 - 0.06, maxZ: z0 + 0.06, minY: 0, maxY: 2.1, tag: 'wall', other: true, disabled: true };
    colliders.push(H.haleDoorCol);
    blk(x0, 0.001, z0, x1, 0.006, z1, M.floorIn, { uv: 1.5 });
    blk(x0, 2.6, z0 - 0.3, x1, 2.8, z1 + 0.3, M.ceil, { uv: 2 });
    const roof = put(new THREE.CylinderGeometry(0.01, 5.2, x1 - x0 + 0.6, 4, 1), M.roof, OX, 3.9, (z0 + z1) / 2, { rz: Math.PI / 2 }); roof.rotation.x = Math.PI / 4; roof.scale.set(1, 1, 0.55);
    for (const wx of [OX - 3.5, OX + 3.5]) blk(wx - 0.7, 1.0, z0 - 0.08, wx + 0.7, 2.0, z0 - 0.04, M.winLit);
    blk(OX - 0.65, 2.1, z0 - 0.3, OX + 0.65, 2.18, z0 - 0.02, M.roof);
    // inside: the living room, nearly right
    blk(OX - 4.6, 0, 13.6, OX - 2.0, 0.5, 14.5, M.plaid, { solid: true }); blk(OX - 4.6, 0.5, 14.2, OX - 2.0, 1.0, 14.5, M.plaid);
    blk(OX + 3.2, 0, 12.4, OX + 4.2, 0.48, 13.4, M.plaid, { solid: true }); blk(OX + 3.2, 0.48, 13.15, OX + 4.2, 1.1, 13.4, M.plaid);
    blk(OX + 4.6, 0, 13.9, OX + 5.6, 0.55, 14.6, M.wood, { solid: true });
    const tv = blk(OX + 4.7, 0.55, 14.0, OX + 5.5, 1.15, 14.5, M.black); void tv;
    blk(OX + 4.78, 0.62, 13.98, OX + 5.42, 1.08, 14.0, mat({ map: T.tvStatic, unlit: true }));
    blk(OX - 2.5, 0.003, 10.5, OX + 2.5, 0.009, 13.5, mat({ map: T.rug, color: 0x8a6a6a }), { uv: 2 });
    blk(OX - 0.5, 1.2, 14.9, OX + 0.5, 1.9, 14.93, mat({ map: T.photoFamilyWrong, color: 0xa08080 }));
    src(OX - 2, 2.3, 11.5, 0xffa070, 7, [HALE.x0, -1, HALE.z0, HALE.x1, 3, HALE.z1], { flicker: 0.5, k: 1.8 });
    src(OX + 3, 2.3, 12.5, 0xff9060, 6, [HALE.x0, -1, HALE.z0, HALE.x1, 3, HALE.z1], { flicker: 0.3, k: 1.4 });
    src(OX, 2.0, 7.4, 0xffb070, 6, OUT_BOX, { flicker: 0.2, k: 1.5 });
  }
  // ---- the yellow house with the dog flap
  {
    const { x0, x1, z0, z1 } = SAFE;
    blk(x0, 0, z0 - 0.06, FLAP_X - 0.32, 2.6, z0 + 0.06, M.extY, { wall: true, uv: 2 });
    blk(FLAP_X + 0.32, 0, z0 - 0.06, x1, 2.6, z0 + 0.06, M.extY, { wall: true, uv: 2 });
    blk(FLAP_X - 0.32, 0.56, z0 - 0.06, FLAP_X + 0.32, 2.6, z0 + 0.06, M.extY, { wall: true });
    blk(FLAP_X - 0.3, 0.02, z0 - 0.1, FLAP_X + 0.3, 0.54, z0 - 0.08, mat({ color: 0x5a4a30, opacity: 0.55 }));
    blk(x0 + 1.5, 0, z0 - 0.1, x0 + 2.5, 2.1, z0 - 0.07, M.wood);
    blk(x0 + 5.6, 1.0, z0 - 0.09, x0 + 8.2, 1.9, z0 - 0.07, M.winLit);
    blk(x0, 0, z1 - 0.06, x1, 2.6, z1 + 0.06, M.wallSafe, { wall: true, uv: 2 });
    for (const x of [x0, x1]) blk(x - 0.06, 0, z0, x + 0.06, 2.6, z1, M.wallSafe, { wall: true, uv: 2 });
    blk(x0, 0.001, z0, x1, 0.006, z1, mat({ map: T.linoleum, color: 0x9a8a70 }), { uv: 1.5 });
    blk(x0, 2.6, z0 - 0.3, x1, 2.8, z1 + 0.3, M.ceil, { uv: 2 });
    const roof = put(new THREE.CylinderGeometry(0.01, 4.4, x1 - x0 + 0.6, 4, 1), M.roof, (x0 + x1) / 2, 3.8, (z0 + z1) / 2, { rz: Math.PI / 2 }); roof.rotation.x = Math.PI / 4; roof.scale.set(1, 1, 0.55);
    // its furnace, breathing the bad air
    const fx = OX + 45, fz = 13.2;
    blk(fx - 0.6, 0, fz - 0.4, fx + 0.6, 1.6, fz + 0.4, mat({ map: T.furnace, color: 0x8a7a6a }), { solid: true });
    H.grille = blk(fx - 0.35, 0.25, fz - 0.42, fx + 0.35, 0.75, fz - 0.4, mat({ map: T.grille, color: 0xffaa60, unlit: true, unique: true }));
    put(new THREE.CylinderGeometry(0.12, 0.12, 1.0, 8), M.metal, fx, 2.1, fz, {});
    // the exhaust pipe runs along the floor and out through the east wall. It is blocked
    // somewhere outside: smoke coughs back out of a cracked joint into the room.
    put(new THREE.CylinderGeometry(0.1, 0.1, x1 - fx - 0.55, 8), M.metal, (fx + 0.6 + x1) / 2, 0.35, fz - 0.1, { rz: Math.PI / 2 });
    H.joint = v3(fx + 2.4, 0.42, fz - 0.1);
    put(new THREE.TorusGeometry(0.115, 0.025, 4, 10), M.black, H.joint.x, 0.35, H.joint.z, { ry: Math.PI / 2 });
    // outside, in the side yard, the pipe end is stuffed with something wet and black
    put(new THREE.CylinderGeometry(0.1, 0.1, 0.7, 8), M.metal, x1 + 0.35, 0.35, fz - 0.1, { rz: Math.PI / 2 });
    H.clog = put(new THREE.IcosahedronGeometry(0.2, 1), mat({ color: 0x0a0808, emissive: 0x100404, unique: true }), x1 + 0.78, 0.35, fz - 0.1);
    H.clog.scale.set(1.3, 1, 1.1);
    H.clogPos = v3(x1 + 0.78, 0, fz - 0.1);
    // the gas line: its red handle is gone. Just the bare stem.
    put(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), mat({ color: 0xa08020 }), fx - 1.3, 0.45, fz, {});
    H.valve = new THREE.Group(); H.valve.position.set(fx - 1.3, 0.62, fz - 0.06); W.add(H.valve);
    put(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 6), M.metal, 0, 0, -0.03, { parent: H.valve, rx: Math.PI / 2 });
    // ...because it is up on top of the tall shelf in the corner, with the paint cans
    const shelfM = mat({ color: 0x5a5a58 });
    for (const [px, pz] of [[OX + 48.45, 8.45], [OX + 49.75, 8.45], [OX + 48.45, 9.55], [OX + 49.75, 9.55]]) put(new THREE.BoxGeometry(0.04, 1.45, 0.04), shelfM, px, 0.725, pz);
    for (const y of [0.35, 0.8, 1.43]) blk(OX + 48.4, y - 0.02, 8.4, OX + 49.8, y + 0.02, 9.6, shelfM);
    for (let i = 0; i < 5; i++) put(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 8), mat({ color: [0x8a2a20, 0x2a4a6a, 0xc0b080, 0x3a5a3a, 0x6a6a6a][i] }), OX + 48.6 + i * 0.27, i % 2 ? 0.48 : 0.93, 9.0);
    colliders.push({ minX: OX + 48.4, maxX: OX + 49.8, minZ: 8.4, maxZ: 9.6, minY: 0, maxY: 1.45, other: true });
    SURFACES.push({ name: 'the top of the shelf', x0: OX + 48.4, x1: OX + 49.8, z0: 8.4, z1: 9.6, top: 1.45 });
    H.handle = new THREE.Group(); H.handle.position.set(OX + 49.2, 1.47, 9.05); W.add(H.handle);
    put(new THREE.BoxGeometry(0.34, 0.05, 0.05), M.red, 0.12, 0.02, 0, { parent: H.handle });
    put(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 8), M.red, 0, 0.02, 0, { parent: H.handle });
    // a workbench and an old crate: the way up
    blk(OX + 46.5, 0, 8.25, OX + 48.3, 0.9, 9.15, M.wood, { solid: true });
    blk(OX + 46.5, 0.9, 8.25, OX + 48.3, 0.94, 9.15, mat({ map: T.wood, color: 0x6a5040 }));
    put(new THREE.BoxGeometry(0.4, 0.06, 0.1), M.metal, OX + 47.2, 0.97, 8.7, { ry: 0.4 });
    blk(OX + 45.3, 0, 9.4, OX + 46.0, 0.48, 10.1, mat({ map: T.wood, color: 0x8a7050 }), { solid: true });
    // Danny's checklist on the wall: torn in half
    blk(fx - 2.8, 1.0, z1 - 0.08, fx - 2.2, 1.35, z1 - 0.06, mat({ color: 0xe0d8c0 }));
    src(FLAP_X, 2.2, 7.2, 0xffd080, 7, OUT_BOX, { k: 1.8, flicker: 0.05 });
    H.safeLight = src(OX + 45, 2.3, 11, 0xffd090, 7, [x0, -1, z0, x1, 3, z1], { flicker: 0.05 });
    H.fireLight = src(fx, 0.5, fz - 0.8, 0xff6a18, 3.5, [x0, -1, z0, x1, 3, z1], { flicker: 0.4 });
  }
  // ---- past the last houses, the road closes in, a canyon of fences and house fronts
  for (let x = OX + 99; x < EDGE_X + 2; x += 8) {
    for (const s of [-1, 1]) {
      const za = s * roadW(x), zb = s * roadW(x + 8);
      const len = Math.hypot(8, zb - za), ang = Math.atan2(zb - za, 8);
      const f = put(new THREE.BoxGeometry(len, 3.0, 0.3), ((x / 8) | 0) % 3 ? M.ext : M.fence, x + 4, 1.5, (za + zb) / 2 + s * 0.15, { ry: -ang });
      void f;
      put(new THREE.BoxGeometry(len * 0.9, 2.0, 3.0), M.ext, x + 4, 4.2, (za + zb) / 2 + s * 1.8, { ry: -ang });
      if (((x / 8) | 0) % 2) blk(x + 3, 1.2, (za + zb) / 2 + s * 0.0 - 0.02, x + 4.4, 2.1, (za + zb) / 2 + 0.02, ((x | 0) % 3) ? M.winLit : M.winDark);
      seg(x, za, x + 8, zb);
    }
  }
  seg(EDGE_X + 1.5, -2.4, EDGE_X + 1.5, 2.4);  // you cannot step past the edge
  seg(OX + 246, -4, OX + 246, 4);

  // hazards along the chase
  for (const [x, s] of [[108, 1], [132, -1], [150, 1], [176, -1], [198, 1], [214, -1]]) { const p = streetlight(OX + x, s * (roadW(OX + x) - 0.35), s); p.trig = OX + x - 11; H.poles.push(p); }
  for (const [x, s] of [[142, -1], [186, 1]]) { const t = deadTree(OX + x, s * (roadW(OX + x) - 0.4)); H.trees.push({ g: t, side: s, trig: OX + x - 12, x: OX + x }); }
  for (const [x, lane] of [[112, -1.3], [124, 1.3], [146, 1.1], [162, -1.2], [184, -1.0], [203, 1.0]]) { const c = car(OX + x + 30, lane, Math.PI, [0x6a1a10, 0x1a2a4a, 0x4a4a4a, 0x3a3a20, 0x5a1a3a, 0x2a2a2a][H.cars.length]); c.visible = false; H.cars.push({ g: c, trig: OX + x, lane, state: 'wait' }); }
  buildChaseExtras();
  buildClutter();

  tear = makeTear();
  arms = makeArms(C.camera);
  H.endLight = src(TEAR_END.x, 2, 0, 0xff7020, 14, [OX - 90, -1, -40, OX + 270, 14, 40]);
  H.endLight.on = false;
  // no ash inside the two houses
  FXCFG.inside2 = (x, y, z) => S_().other && ((x > HALE.x0 && x < HALE.x1 && z > HALE.z0 && z < HALE.z1) || (x > SAFE.x0 && x < SAFE.x1 && z > SAFE.z0 && z < SAFE.z1));
}
const S_ = () => C.S;

// ---------------------------------------------------------------------------
// moving between worlds: the lights and the air are swapped wholesale
let saved = null;
const myLights = Array.from({ length: 14 }, (_, i) => ({ slot: i, pos: v3(), color: new THREE.Color(), base: new THREE.Color(), range: 1, intensity: 0, on: true, flicker: 0, swing: 0 }));
function takeLights() {
  saved = { L: lights.slice(), min: G.uLightMin.value.map((v) => v.clone()), max: G.uLightMax.value.map((v) => v.clone()) };
  for (let i = 0; i < 14; i++) lights[i] = myLights[i];
}
function giveLightsBack() {
  if (!saved) return;
  for (let i = 0; i < 14; i++) { lights[i] = saved.L[i]; if (saved.min[i]) G.uLightMin.value[i].copy(saved.min[i]); if (saved.max[i]) G.uLightMax.value[i].copy(saved.max[i]); }
  saved = null;
}
function assignLights() {
  const cam = C.camera.position;
  const live = OL.filter((L) => L.on && L !== H.endLight).sort((a, b) => a.pos.distanceToSquared(cam) - b.pos.distanceToSquared(cam)).slice(0, 12);
  for (let i = 0; i < 12; i++) {
    const L = live[i], my = myLights[i];
    if (!L) { my.on = false; continue; }
    my.on = true; my.pos.copy(L.pos); my.color.copy(L.color); my.range = L.range; my.intensity = L.k; my.flicker = L.flicker;
    G.uLightMin.value[i].set(L.box[0], L.box[1], L.box[2]); G.uLightMax.value[i].set(L.box[3], L.box[4], L.box[5]);
  }
  // 12: a car's headlights; 13: the tear
  const hl = myLights[12]; hl.on = !!H.headlight; if (H.headlight) { hl.pos.copy(H.headlight); hl.color.set(0xfff0c0); hl.range = 9; hl.intensity = 1.2; G.uLightMin.value[12].set(OX - 90, -1, -40); G.uLightMax.value[12].set(OX + 270, 14, 40); }
  const tl = myLights[13], E = H.endLight; tl.on = E.on; tl.pos.copy(E.pos); tl.color.copy(E.color); tl.range = E.range; tl.intensity = E.k; tl.flicker = 0.2;
  G.uLightMin.value[13].set(OX - 90, -1, -40); G.uLightMax.value[13].set(OX + 270, 14, 40);
}

// the family over here
const FAM = ['father', 'mother', 'lily'];
const DEAD = { father: [OX + 2.9, 11.2], mother: [OX - 2.4, 12.2], lily: [OX + 0.6, 13.3] };
function deadLook(h, on) {
  if (!h._origCol) h._origCol = h.mats.map((m) => m.uniforms.uColor.value.clone());
  h.mats.forEach((m, i) => { if (on) m.uniforms.uColor.value.copy(h._origCol[i]).multiplyScalar(0.55).add(v3(0.05, 0.08, 0.1)); else m.uniforms.uColor.value.copy(h._origCol[i]); });
  h.setFace(on);
}

export function enterOther() {
  const { S, F } = C;
  S.other = true; S.oStage = 'street'; S.oT = 0; S.oCatch = 0;
  takeLights();
  C.camera.far = 320; C.camera.updateProjectionMatrix();
  FXCFG.ash = true;
  for (const k of FAM) {
    const h = F[k];
    h.noNav = true; h.path = []; h.arrived = null; h.activity = null; h.override = null; h.unconscious = false; h.asleep = false; h.awakeUntil = 0;
    h.setPos(DEAD[k][0], DEAD[k][1]); h.pose = 'sleep'; h.visible = true; h.yaw = 0; deadLook(h, true);
  }
  F.danny.visible = false; F.danny.noNav = true;
  const p = S.presence; p.root.visible = false; p.visible = false; S.presenceActive = false;
  dog.human = false; dog.radius = 0.21; dog.frozen = false;
  dog.pos.set(OX + 1.5, 0, 2.2); dog.y = 0; dog.yaw = Math.PI; dog.pitch = 0.08;
  C.setObj('This is your street. Nearly. It is not snowing; that is ash. Go home.');
  C.later(1.2, () => C.ui.card('The other side', 'You went into the hot box and came out here. It is your street, almost. The houses are the wrong colours. Ash comes down instead of snow. Your house is right there, and its door is open. It smells like them.'));
  C.ach('through');
}
function leaveOther() {
  const { S, F } = C;
  S.other = false; S.oStage = null;
  giveLightsBack();
  C.camera.far = 40; C.camera.fov = 72; C.camera.updateProjectionMatrix();
  FXCFG.ash = false;
  for (const k of FAM) { const h = F[k]; h.noNav = false; deadLook(h, false); h.visible = true; h.override = null; h.speed = 1.15; }
  F.danny.noNav = false; F.danny.visible = false;
  tear.visible = false; arms.visible = false; H.endLight.on = false; H.headlight = null;
  dog.human = false; dog.radius = 0.21; S.hideDog = false;
  C.S.timeScale = 1;
}

// ---------------------------------------------------------------------------
// the thing, over here: it moves however it likes
function moveMon(target, speed, dt) {
  const p = C.S.presence;
  const dx = target.x - p.pos.x, dz = target.z - p.pos.z, d = Math.hypot(dx, dz);
  if (d > 0.05) {
    const s = Math.min(d, speed * dt);
    p.pos.x += dx / d * s; p.pos.z += dz / d * s;
    let want = Math.atan2(dx, dz), da = want - p.yaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    p.yaw += da * Math.min(1, dt * 8);
  }
  const w = roadW(p.pos.x) - 0.4;
  if (p.pos.x > OX + 100) p.pos.z = Math.max(-w, Math.min(w, p.pos.z));
  return d;
}
function showMon(mode, dt) {
  const p = C.S.presence;
  p.visible = true; p.root.visible = true;
  p.root.position.set(p.pos.x, 0, p.pos.z); p.root.rotation.set(0, p.yaw, 0);
  p.monster.update(C.S.t, dt, mode);
}
function hideMon() { const p = C.S.presence; p.visible = false; p.root.visible = false; }
// route around the front walls of the house that is almost theirs
function via(from, to) {
  const inF = from.z > HALE.z0 && from.x > HALE.x0 && from.x < HALE.x1, inT = to.z > HALE.z0 && to.x > HALE.x0 && to.x < HALE.x1;
  if (inF === inT) return [to.clone()];
  const IN = v3(OX, 0, 9.0), OUT = v3(OX, 0, 6.8);
  // already in the doorway column: just keep going through it (no flipping back and forth)
  const inDoor = Math.abs(from.x - OX) < 0.75;
  if (inF) return inDoor && from.z < 9.3 ? [OUT, to.clone()] : [IN, OUT, to.clone()];
  return inDoor && from.z > 6.5 ? [IN, to.clone()] : [OUT, IN, to.clone()];
}
function burst(x, y, z, n = 50) {
  for (let i = 0; i < n; i++) puff(x, y + Math.random() * 1.2, z, { col: Math.random() < 0.5 ? [0.05, 0.03, 0.03] : [0.5, 0.06, 0.04], vx: (Math.random() - 0.5) * 3, vy: Math.random() * 2.5, vz: (Math.random() - 0.5) * 3, grav: 3, life: 1.4, size: 0.04, spread: 0.4 });
}
function caught(respawn) {
  const { S } = C;
  S.jumpscare = 1.2; dog.frozen = true; AU.scream();
  S.oCatch++;
  C.later(1.1, () => { S.blackout = 2.4; respawn(); });
  C.later(3.4, () => { dog.frozen = false; });
}
function knock(fromX, fromZ) {
  const { S } = C;
  if (S.oKnock > 0) return;
  S.oKnock = 1.0; dog.frozen = true; S.redFlash = 0.35;
  AU.thunk(dog.pos.x, 0.3, dog.pos.z, 1); AU.thunk(dog.pos.x, 0.3, dog.pos.z, 0.6);
  const dx = dog.pos.x - fromX, dz = dog.pos.z - fromZ, d = Math.hypot(dx, dz) || 1;
  dog.pos.x += dx / d * 0.6; dog.pos.z += dz / d * 0.6;
  collide(dog.pos, dog.radius, 0, 1.6);
  C.later(0.95, () => { if (S.oStage === 'chase') dog.frozen = false; });
}

// ---------------------------------------------------------------------------
export function updateOther(dt) {
  const { S, F } = C;
  S.oT += dt;
  const st = S.oStage;
  const fam = FAM.map((k) => F[k]);
  // the air over here
  G.uAmbient.value.set(0.5, 0.36, 0.3);
  G.uCamLight.value.set(0.6, 0.5, 0.42);
  G.uFogColor.value.set(0.34, 0.16, 0.08);
  G.uFogNear.value = 5; G.uFogFar.value = 34;
  P.uCold.value = 0;
  for (const L of OL) L.k = L.k0;
  assignLights();
  AU.setDrone(st === 'chase' || st === 'feast' || st === 'run1' ? 0.9 : 0.55, S.t);
  S.oKnock = Math.max(0, (S.oKnock || 0) - dt);
  const cam = C.camera;
  if (S.oKnock > 0) { cam.position.y -= 0.55 * Math.sin(Math.min(1, S.oKnock) * Math.PI); cam.rotation.z += 0.35 * S.oKnock; }
  if (S.oShake > 0) { S.oShake -= dt; cam.position.x += (Math.random() - 0.5) * 0.06 * S.oShake; cam.position.y += (Math.random() - 0.5) * 0.06 * S.oShake; }
  for (const h of fam) if (h.visible) h.update(dt, S.t, 0, dog.pos);
  if (F.danny.visible) F.danny.update(dt, S.t, 0, dog.pos);
  const inHale = dog.pos.z > HALE.z0 && dog.pos.x > HALE.x0 && dog.pos.x < HALE.x1;
  const inSafe = dog.pos.z > SAFE.z0 && dog.pos.x > SAFE.x0 && dog.pos.x < SAFE.x1;

  // the flap in the west wall of their house moves in the wind, and ash blows in through it
  if (H.haleFlap) {
    H.haleFlap.rotation.z = Math.sin(S.t * 2.3) * 0.18 + (Math.random() < 0.01 ? 0.4 : 0);
    if ((st === 'house' || st === 'risen') && Math.random() < dt * 14) puff(HALE.x0 - 0.1, 0.1 + Math.random() * 0.45, 13.2 + (Math.random() - 0.5) * 0.5, { col: [0.45, 0.4, 0.38], vx: 0.8 + Math.random() * 0.6, vy: 0.1, vz: (Math.random() - 0.5) * 0.3, life: 2.5, size: 0.025 });
  }
  // the front door of their house: open; then it slams; then it bursts open
  if (S.oDoorT !== undefined) {
    S.oDoorT += dt;
    const k = Math.min(1, S.oDoorT / (S.oDoorTo === 0 ? 0.22 : 0.35));
    H.haleDoor.rotation.y = S.oDoorFrom + (S.oDoorTo - S.oDoorFrom) * k * k;
    if (k >= 1) S.oDoorT = undefined;
  }
  if (st === 'street') {
    if (inHale && dog.pos.z > 9.3) {
      S.oStage = 'house'; S.oT = 0;
      AU.stinger(0.35);
      C.setObj('They are lying on the floor. They are not breathing.');
    }
  } else if (st === 'house') {
    // they get up, one by one, and turn to look at you. Behind you, the door slams.
    if (S.oT > 5 && !S.oRisen) {
      S.oRisen = true;
      fam.forEach((h, i) => C.later(i * 1.6, () => {
        h.pose = 'stand'; h.speed = 0.42; h.override = { type: 'zombie' };
        h.look(C.dogHead(), 999, S.t);
        AU.groan(h.pos.x, 1, h.pos.z, 0.6);
        C.say(h, 'Biscuit.', 'whisper', { force: true, clear: true });
      }));
      C.later(3.8, () => {
        S.oDoorFrom = H.haleDoor.rotation.y; S.oDoorTo = 0; S.oDoorT = 0; H.haleDoorCol.disabled = false;
        AU.crash(OX, 1, 8); AU.thunk(OX, 1, 8, 1); S.oShake = 0.9; AU.stinger(0.9);
        // the house goes dark, but for the cold blue coming in at the flap
        for (const L of OL) if (L.box[1] === -1 && L.box[0] === HALE.x0) L.k0 = 0.35;
      });
      C.later(4.4, () => { S.oStage = 'risen'; S.oT = 0; C.setObj('The door slammed. They are coming, slowly, with their arms out.'); });
    }
  } else if (st === 'risen' || st === 'feast') {
    // the dead family come after you, slowly, and they talk to you
    S.oFollowT = (S.oFollowT || 0) - dt;
    if (S.oFollowT <= 0) {
      S.oFollowT = 0.7;
      for (const h of fam) {
        if (!h.visible || h.eaten || h === S.oVictim) continue;
        h.speed = Math.min(0.85, 0.42 + S.oT * 0.012);
        if (!S.oDoorOpen && !inHale) { const fl = v3(HALE.x0 + 0.5, 0, 13.2); h.path = d2(h.pos, fl) > 0.4 ? [fl] : []; continue; } // pressed against the wall by the flap
        const r = S.oDoorOpen ? via(h.pos, dog.pos) : [dog.pos.clone()];
        h.path = d2(h.pos, dog.pos) > 0.45 ? r : [];
      }
    }
    if (st === 'risen' && inHale) {
      const W2 = [['mother', 'Biscuit. Why didn\'t you wake us up?'], ['father', 'We were so tired, bud. So tired.'], ['lily', 'Come lie down with us, Biscuit. It is warm down here.'], ['mother', 'Danny is here with us. Stay. Stay with us.'], ['lily', 'Don\'t go. Please don\'t go. Not you too.'], ['father', 'Good boy. Lie down. Lie down now.']];
      if (S.oT > (S.oWhisperT || 2)) { S.oWhisperT = S.oT + 5.5; const [k, line] = W2[(S.oWhisperI = (S.oWhisperI || 0) + 1) % W2.length]; const h = F[k]; if (h.visible) C.say(h, line, 'whisper', { force: true, clear: true }); }
      // if they reach you, cold hands on you
      for (const h of fam) if (!h.eaten && h.visible && d2(h.pos, dog.pos) < 0.6 && S.t > (S.oGrabCD || 0)) {
        S.oGrabCD = S.t + 2.2; S.redFlash = 0.5; AU.stinger(0.7); AU.groan(h.pos.x, 1, h.pos.z, 0.8);
        const dx = dog.pos.x - h.pos.x, dz = dog.pos.z - h.pos.z, d = Math.hypot(dx, dz) || 1;
        dog.pos.x += dx / d * 0.9; dog.pos.z += dz / d * 0.9; collide(dog.pos, dog.radius, 0, 0.5);
        lookAtPoint(h.pos.x, 1.5, h.pos.z, 0.25); S.oShake = 0.6;
        showSubtitle('note', '<span class="note">(Its hands are so cold.)</span>', 1.8);
      }
    }
    // out through the flap; once you are out in the street, the front door bursts open behind you
    if (st === 'risen' && !inHale && !S.oDoorOpen && (dog.pos.z < 7.4 || S.oT > 40)) {
      S.oDoorOpen = true;
      S.oDoorFrom = H.haleDoor.rotation.y; S.oDoorTo = -1.6; S.oDoorT = 0; H.haleDoorCol.disabled = true;
      AU.crash(OX, 1, 8); AU.thunk(OX, 1, 8, 1); S.oShake = 0.7; S.oDoorAt = S.oT;
      for (const h of fam) h.path = [];
    }
    const outside = fam.filter((h) => h.pos.z < 7.6).length;
    if (st === 'risen' && S.oDoorOpen && dog.pos.z < 7 && (outside >= 1 || S.oT - S.oDoorAt > 9)) {
      S.oStage = 'feast'; S.oT = 0;
      const p = S.presence; p.setPos(OX - 26, -1.5); p.yaw = Math.PI / 2;
      AU.stinger(1); AU.whoomp(OX - 20, 1, -1);
    }
    if (st === 'feast') {
      const p = S.presence;
      if (!S.oVictim) {
        const left = fam.filter((h) => !h.eaten);
        if (left.length) {
          const v = left.sort((a, b) => d2(a.pos, p.pos) - d2(b.pos, p.pos))[0];
          const route = via(p.pos, v.pos);
          const dist = moveMon(route[0], 7.5, dt);
          showMon('hunt', dt);
          if (d2(p.pos, v.pos) < 0.7 || (route.length === 1 && dist < 0.7)) {
            S.oVictim = v; v.path = []; v.eatT = 0;
            AU.scream(); S.oShake = 0.8;
            // in the last second, the right face comes back: they know you
            v.setFace(false); C.say(v, v === F.lily ? 'BISCUIT! RUN!' : v === F.mother ? 'Run, baby. Run!' : 'GO, Biscuit! GO!', 'sharp', { force: true, clear: true });
          }
        } else if (!S.oFed) { S.oFed = true; S.oT = 0; }
      } else {
        const v = S.oVictim;
        v.eatT += dt;
        p.pos.x += (v.pos.x - p.pos.x) * Math.min(1, dt * 10); p.pos.z += (v.pos.z - p.pos.z - 0.35) * Math.min(1, dt * 10);
        showMon('scare', dt);
        v.pos.y = Math.min(0.6, v.eatT * 0.8); v.root.position.y = v.pos.y;
        v.yaw += Math.sin(S.t * 40) * 0.2;
        if (v.eatT > 1.6) { v.visible = false; v.eaten = true; burst(v.pos.x, 0.3, v.pos.z); AU.crash(v.pos.x, 1, v.pos.z); S.oVictim = null; }
      }
      if (S.oFed && S.oT > 1.4) { S.oStage = 'run1'; S.oT = 0; AU.stinger(0.8); }
    }
  } else if (st === 'run1') {
    // it comes after you. Only one house on the street has a light on.
    const p = S.presence;
    if (Math.random() < dt * 0.3) AU.creak(FLAP_X, 0.3, 8, 0.5);
    if (inSafe) {
      S.oStage = 'safe'; S.oT = 0; hideMon();
      AU.knock(FLAP_X, 0.3, 7.9, 4, 0.8);
      C.setObj('Safe, for now. This house\'s hot box is sick, like yours.');
      C.later(1, () => C.ui.card('Safe', 'It slams against the door, again and again, and then it stops. You can hear it breathing on the other side. In here it is warm, and the air is wrong: the hot box against the back wall is coughing its bad air back out into the room through a crack in its pipe. On the wall, a page in Danny\'s handwriting, torn in half: "1. CLEAR THE VE..." The rest is gone.'));
      return;
    }
    if (S.oT < 1.2) { showMon('scare', dt); return; } // it rears up first: your head start
    if (!dog.frozen) {
      const sp = d2(p.pos, dog.pos) > 12 ? 4.2 : 2.75;
      moveMon(dog.pos, sp, dt);
      collide(p.pos, 0.38, 0, 1);
    }
    showMon('hunt', dt);
    if (d2(p.pos, dog.pos) < 0.75 && !dog.frozen) caught(() => {
      dog.pos.set(OX + 14, 0, 2.5); dog.y = 0; dog.yaw = -Math.PI / 2;
      p.setPos(OX - 6, 2);
    });
  } else if (st === 'safe') {
    safeHouse(dt, inSafe);
  } else if (st === 'torn') {
    tearPulse(dt);
    // it waits out there, between you and the tear
    const p = S.presence; showMon('idle', dt);
    p.yaw = Math.atan2(FLAP_X - p.pos.x, 8 - p.pos.z);
    if (!inSafe && dog.pos.z < 7.95) dannyAppears();
  } else if (st === 'danny') {
    tearPulse(dt);
  } else if (st === 'walk' || st === 'peek' || st === 'chase') {
    tearPulse(dt);
    F.danny.setPos(dog.pos.x, dog.pos.z); F.danny.yaw = dog.yaw + Math.PI;
    arms.visible = true;
    arms.head.rotation.y = Math.sin(S.t * 0.7) * 0.25; arms.position.y = dog.moving ? Math.sin(S.t * 9) * 0.012 : 0;
    // the tear slides away down the road, and the road goes on
    if (S.oTearMove) { S.oTearMove.t += dt; const k = Math.min(1, S.oTearMove.t / 4); const e = k * k * (3 - 2 * k); tear.position.lerpVectors(S.oTearMove.from, TEAR_END, e); tear.rotation.y = -Math.PI / 2 * e; H.endLight.pos.copy(tear.position); }
    if (st === 'walk' && !S.oTearMove && dog.pos.z < 4) {
      S.oTearMove = { t: 0, from: tear.position.clone() };
      AU.whoomp(tear.position.x, 2, tear.position.z); AU.thunder(0.6);
      C.later(1.0, () => showSubtitle('note', '<span class="note">(The tear rips away down the road, further and further, and the road goes on, and on.)</span>', 4));
      C.setObj('The tear moved. Carry Biscuit down the road to it. (You are Danny. SHIFT to run.)');
    }
    if (st === 'walk' && dog.pos.x > OX + 55 && C.once('dWalk1')) C.say(F.danny, 'Does Lily still draw me? With the blue crayon? She always made my hair blue.', 'calm', { force: true });
    if (st === 'walk' && dog.pos.x > OX + 68 && C.once('dWalk2')) C.say(F.danny, 'Tell Mom it was not her fault. Tell Dad. It was nobody\'s fault.', 'sad', { force: true });
    if (st === 'walk' && dog.pos.x > OX + 80) {
      if (S.oHum) { S.oHum.stop(); S.oHum = null; }
      // something is behind the parked car you just passed
      S.oStage = 'peek'; S.oT = 0;
      const p = S.presence; p.setPos(OX + 73.6, -6.0); p.yaw = Math.atan2(dog.pos.x - p.pos.x, dog.pos.z - p.pos.z);
      AU.breathing(OX + 74, 0.8, -6, 0.9);
      showSubtitle('note', '<span class="note">(Breathing. Behind you. Behind that car.)</span>', 3.5);
      C.setObj('Something is behind you.');
    }
    if (st === 'peek') {
      const p = S.presence; showMon('idle', dt);
      p.yaw = Math.atan2(dog.pos.x - p.pos.x, dog.pos.z - p.pos.z);
      const fx = -Math.sin(dog.yaw), fz = -Math.cos(dog.yaw), dx = p.pos.x - dog.pos.x, dz = p.pos.z - dog.pos.z, dd = Math.hypot(dx, dz);
      const seen = (dx * fx + dz * fz) / dd > 0.9 && dd < 25;
      if ((seen && S.oT > 0.6) || S.oT > 6) {
        S.oStage = 'chase'; S.oT = 0; S.oChk = OX + 85;
        AU.stinger(1); AU.growl(1.2, 1); S.oShake = 0.6;
        C.say(F.danny, 'Oh no. No no no. Hold on, Biscuit. HOLD ON.', 'sharp', { force: true });
        C.setObj('RUN. Get to the tear. Jump (SPACE) over what falls.');
      }
    }
    if (st === 'chase') chase(dt);
    // the carried dog's view of where to go
  } else if (st === 'edge' || st === 'throw') {
    tearPulse(dt);
    edgeScene(dt);
  }
  // a car's headlights, while one is coming at you
  H.headlight = null;
  for (const c of H.cars) if (c.state === 'drive') H.headlight = v3(c.g.position.x - 2.4, 0.8, c.g.position.z);
}

// ---------------------------------------------------------------------------
// the yellow house: the handle is up on the shelf, the clog is outside, and it is out there
const PATROL = [v3(OX + 38, 0, 1.5), v3(OX + 57, 0, 2.5)];
function safeHouse(dt, inSafe) {
  const { S } = C;
  const p = S.presence;
  if (!(S.oValve >= 1)) H.grille.material.uniforms.uColor.value.set(1, 0.55 + Math.sin(S.t * 9) * 0.2, 0.3);
  // the blocked pipe coughs its bad air back into the room
  if (!S.oClogOut && Math.random() < dt * 6) puff(H.joint.x, H.joint.y, H.joint.z, { col: [0.08, 0.07, 0.07], vy: 0.5 + Math.random() * 0.4, vx: (Math.random() - 0.5) * 0.4, vz: -0.3, life: 2.5, size: 0.05 });
  if (!S.oClogOut && S.t > (S.oCough || 0)) { S.oCough = S.t + 3 + Math.random() * 3; AU.whoomp(H.joint.x, 0.4, H.joint.z); }
  if (!S.oClogOut) H.clog.scale.set(1.3 + Math.sin(S.t * 3) * 0.08, 1, 1.1);
  else if (Math.random() < dt * 12) puff(H.clogPos.x + 0.1, 0.4, H.clogPos.z, { col: [0.5, 0.48, 0.46], vx: 0.6, vy: 0.4 + Math.random() * 0.3, life: 2, size: 0.05 });
  // the handle falling off the shelf
  if (S.oHandle === 'falling') {
    S.oHandleT += dt; const k = Math.min(1, S.oHandleT / 0.45);
    H.handle.position.set(OX + 49.2 + k * 0.3, 1.47 - k * k * 1.44, 9.05 + k * 1.0); H.handle.rotation.z = k * 4;
    if (k >= 1) { S.oHandle = 'floor'; H.handle.rotation.set(0, 0.6, 0); AU.knock(H.handle.position.x, 0.05, H.handle.position.z, 2, 0.9); AU.thunk(H.handle.position.x, 0.05, H.handle.position.z, 0.5); if (!S.oAlert) { S.oAlert = v3(FLAP_X, 0, 7.6); S.oAlertT = 0; } }
  }
  // turning the gas off with your teeth, once the handle is back on its stem
  if (S.oHandle === 'fitted' && !(S.oValve >= 1) && input.eDown && d2(dog.pos, H.valve.position) < 0.95) {
    input.eUsedHold = true;
    S.oValve = Math.min(1, (S.oValve || 0) + dt / 2.6);
    H.valve.rotation.y = -S.oValve * Math.PI / 2;
    if (Math.random() < dt * 5) AU.rattle(H.valve.position.x, 0.6, H.valve.position.z, 0.3);
    if (S.oValve >= 1) {
      H.fireLight.on = false; H.grille.material.uniforms.uColor.value.set(0.2, 0.15, 0.1); AU.whoomp(OX + 45, 0.5, 13);
      if (S.oClogOut) fixed(); else showSubtitle('note', '<span class="note">(The fire goes out. But the pipe is still coughing.)</span>', 3);
    }
  }
  if (S.oFixed) return;
  // it scratches at the flap for a while; then it walks the street, up and down
  if (S.oT < 9) { if (S.oT > 2 && Math.random() < dt * 1.2) AU.scratch(FLAP_X, 0.3, 7.8); hideMon(); return; }
  if (!S.oPatrol) { S.oPatrol = { i: 0 }; p.setPos(OX + 44, 1); }
  const P2 = S.oPatrol;
  const out = !inSafe;
  const dd = d2(p.pos, dog.pos);
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  const seen = out && dog.y < 1 && (dd < 5 || (dd < 12 && ((dog.pos.x - p.pos.x) * fx + (dog.pos.z - p.pos.z) * fz) / dd > 0.5));
  if (seen && !P2.hunt) { P2.hunt = true; AU.stinger(0.9); AU.growl(1, 1); }
  if (P2.hunt) {
    if (!out) { P2.hunt = false; P2.scratch = S.t + 4; AU.knock(FLAP_X, 0.3, 7.9, 4, 0.8); }
    else {
      moveMon(dog.pos, dd > 10 ? 4 : 3.1, dt); collide(p.pos, 0.38, 0, 1); showMon('hunt', dt);
      S.stalkNear = dd < 8 ? 1 - dd / 8 : 0;
      if (dd < 0.75 && !dog.frozen) caught(() => { dog.pos.set(OX + 45, 0, 10.2); dog.y = 0; dog.yaw = 0; p.setPos(PATROL[0].x, PATROL[0].z); P2.hunt = false; S.oAlert = null; });
      return;
    }
  }
  if (P2.scratch && S.t < P2.scratch) { moveMon(v3(FLAP_X, 0, 7.4), 2, dt); showMon('idle', dt); if (Math.random() < dt * 2) AU.scratch(FLAP_X, 0.3, 7.8); return; }
  // a noise brings it: round through the broken gate into the side yard, or to the flap
  if (S.oAlert) {
    const intoYard = S.oAlert.z > 8;
    const route = intoYard && p.pos.z < 7.6 && Math.abs(p.pos.x - (OX + 52)) > 0.6 ? v3(OX + 52, 0, 7.2) : S.oAlert;
    const d = moveMon(route, 2.4, dt); collide(p.pos, 0.38, 0, 1); showMon('walk', dt);
    if (route === S.oAlert && d < 1.3) { S.oAlertT = (S.oAlertT || 0) + dt; if (S.oAlertT > 4) { S.oAlert = null; S.oAlertT = 0; } }
    return;
  }
  if (p.pos.z > 7.8) { moveMon(v3(OX + 52, 0, 7.2), 1.6, dt); collide(p.pos, 0.38, 0, 1); showMon('walk', dt); return; }
  if (moveMon(PATROL[P2.i], 1.3, dt) < 0.5) P2.i = 1 - P2.i;
  collide(p.pos, 0.38, 0, 1);
  showMon('walk', dt);
  if (Math.random() < dt * 0.4) AU.breathing(p.pos.x, 0.8, p.pos.z, 0.5);
}

// ---------------------------------------------------------------------------
// the chase gets worse: the sky comes down, the houses lean in and fall
const DEBRIS = [], SLABS = [];
function buildChaseExtras() {
  const roofM = mat({ color: 0x3a2a22 }), brickM = mat({ map: T.exterior, color: 0x8a5a48 });
  for (let i = 0; i < 16; i++) {
    const big = i % 3 === 0, sz = big ? 1.1 : 0.5;
    const m = put(new THREE.BoxGeometry(sz * 1.3, sz, sz), i % 2 ? roofM : brickM, 0, -20, 0);
    const shadow = put(new THREE.CircleGeometry(sz * 0.9, 10), mat({ color: 0x000000, opacity: 0.6, unique: true }), 0, 0.012, 0, { rx: -Math.PI / 2 });
    shadow.visible = false;
    DEBRIS.push({ m, shadow, sz, state: 'idle' });
  }
  for (const [x, side] of [[128, -1], [166, 1], [206, -1]]) {
    const z = side * roadW(OX + x);
    const g = new THREE.Group(); g.position.set(OX + x, 0, z); W.add(g);
    put(new THREE.BoxGeometry(6, 4.2, 0.4), M.ext, 0, 2.1, 0, { parent: g });
    for (const wx of [-1.6, 1.6]) put(new THREE.BoxGeometry(1.2, 1, 0.05), Math.random() < 0.5 ? M.winLit : M.winDark, wx, 2.6, -side * 0.23, { parent: g });
    put(new THREE.BoxGeometry(1, 2, 0.05), M.wood, 0, 1, -side * 0.23, { parent: g });
    SLABS.push({ g, x: OX + x, side, z, trig: OX + x - 14, state: 'stand' });
  }
}
function chaseExtras(dt) {
  const { S } = C;
  // embers on the wind
  if (Math.random() < dt * 30) puff(dog.pos.x + 2 + Math.random() * 12, 3 + Math.random() * 3, (Math.random() - 0.5) * 8, { col: [1, 0.5, 0.15], vx: -1.5 - Math.random(), vy: -0.4, life: 2, size: 0.02 });
  // the sky comes down in pieces: watch for their shadows
  if (dog.pos.x > OX + 95 && dog.pos.x < EDGE_X - 8) {
    S.oDebrisT = (S.oDebrisT ?? 1.5) - dt;
    if (S.oDebrisT <= 0) {
      S.oDebrisT = 0.9 + Math.random() * 1.4;
      const d = DEBRIS.find((q) => q.state === 'idle');
      if (d) {
        const x = dog.pos.x + 6 + Math.random() * 11, w = roadW(x) - 0.7;
        const z = Math.random() < 0.45 ? dog.pos.z + (Math.random() - 0.5) * 1.5 : (Math.random() * 2 - 1) * w;
        d.state = 'fall'; d.x = x; d.z = Math.max(-w, Math.min(w, z)); d.y = 16; d.vy = 0;
        d.m.position.set(d.x, d.y, d.z); d.m.rotation.set(Math.random(), Math.random(), Math.random());
        d.shadow.visible = true; d.shadow.position.set(d.x, 0.012, d.z); d.shadow.scale.setScalar(0.2);
        AU.whoomp(d.x, 6, d.z);
      }
    }
  }
  for (const d of DEBRIS) {
    if (d.state !== 'fall') continue;
    d.vy -= 16 * dt; d.y += d.vy * dt; d.m.position.y = d.y; d.m.rotation.x += dt * 3;
    d.shadow.scale.setScalar(Math.max(0.2, 1 - d.y / 16));
    if (d.y <= d.sz / 2) {
      d.state = 'down'; d.m.position.y = d.sz / 2; d.m.rotation.set(0, Math.random() * 3, 0); d.shadow.visible = false;
      AU.crash(d.x, 0.3, d.z); AU.thunk(d.x, 0.2, d.z, 1); S.oShake = Math.max(S.oShake || 0, d.sz > 1 ? 0.9 : 0.4);
      for (let i = 0; i < (d.sz > 1 ? 30 : 14); i++) puff(d.x, 0.3, d.z, { col: [0.35, 0.3, 0.27], vx: (Math.random() - 0.5) * 3, vy: Math.random() * 2, vz: (Math.random() - 0.5) * 3, grav: 3, life: 1.2, size: 0.05 });
      colliders.push({ minX: d.x - d.sz * 0.65, maxX: d.x + d.sz * 0.65, minZ: d.z - d.sz / 2, maxZ: d.z + d.sz / 2, minY: 0, maxY: d.sz * 0.9, other: true });
      if (Math.hypot(dog.pos.x - d.x, dog.pos.z - d.z) < d.sz * 0.7 + 0.35 && dog.y < d.sz) knock(d.x, d.z);
    }
  }
  // whole house fronts lean out and fall across the road
  for (const q of SLABS) {
    if (q.state === 'stand' && dog.pos.x > q.trig) { q.state = 'fall'; q.t = 0; AU.creak(q.x, 3, q.z, 3); AU.thunder(0.5); S.oShake = 0.5; }
    if (q.state === 'fall') {
      q.t += dt; const k = Math.min(1, q.t / 1.3);
      q.g.rotation.x = q.side * k * k * (Math.PI / 2 - 0.06);
      if (k >= 1) {
        q.state = 'down'; AU.crash(q.x, 0.5, q.z); AU.crash(q.x + 2, 0.5, q.z); AU.thunk(q.x, 0.3, q.z, 1); S.oShake = 1.6;
        const z1 = q.z - q.side * 4.2;
        for (let i = 0; i < 70; i++) puff(q.x + (Math.random() - 0.5) * 6, 0.4, q.z - q.side * Math.random() * 4.2, { col: [0.4, 0.35, 0.3], vx: (Math.random() - 0.5) * 4, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 4, grav: 2, life: 2, size: 0.07 });
        colliders.push({ minX: q.x - 3, maxX: q.x + 3, minZ: Math.min(q.z, z1), maxZ: Math.max(q.z, z1), minY: 0, maxY: 0.42, other: true });
        if (Math.abs(dog.pos.x - q.x) < 3.2 && (dog.pos.z - q.z) * -q.side > 0 && (dog.pos.z - q.z) * -q.side < 4.4) knock(q.x, q.z);
      }
    }
  }
}
// ---------------------------------------------------------------------------
// the street: mailboxes, bins, power lines, hydrants, a bike in the yard
function buildClutter() {
  const postM = mat({ map: T.wood, color: 0x5a4a3a }), boxM = mat({ color: 0x3a3a38 }), binM = mat({ color: 0x2a3a2a }), redM = mat({ color: 0x8a2018 });
  for (let x = OX - 56; x < OX + 98; x += 14) for (const sd of [-1, 1]) {
    const z = sd * 8.4 * -1 + sd * 0; void z;
    const mz = sd * 7.7;
    if (Math.abs(x - OX) < 3 || Math.abs(x - FLAP_X) < 3) continue;
    put(new THREE.BoxGeometry(0.08, 1.0, 0.08), postM, x + 2, 0.5, mz);
    put(new THREE.BoxGeometry(0.22, 0.24, 0.45), boxM, x + 2, 1.1, mz);
    put(new THREE.BoxGeometry(0.03, 0.12, 0.04), redM, x + 2.12, 1.25, mz);
    put(new THREE.CylinderGeometry(0.28, 0.25, 0.9, 8), binM, x + 4.5, 0.45, sd * 7.5);
    put(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 8), binM, x + 4.5, 0.93, sd * 7.5, { rz: 0.3 });
  }
  // wooden power poles along the north side, with sagging lines between them
  let last = null;
  for (let x = OX - 56; x < OX + 100; x += 22) {
    put(new THREE.CylinderGeometry(0.12, 0.15, 7.5, 6), postM, x, 3.75, 7.0);
    put(new THREE.BoxGeometry(0.1, 0.1, 1.8), postM, x, 7.0, 7.0);
    if (last !== null) for (const dz of [-0.75, 0, 0.75]) { const ln = put(new THREE.BoxGeometry(22, 0.025, 0.025), M.black, (last + x) / 2, 6.7, 7.0 + dz); ln.rotation.z = 0; }
    last = x;
  }
  for (const x of [OX - 30, OX + 15, OX + 70]) { put(new THREE.CylinderGeometry(0.12, 0.14, 0.6, 8), redM, x, 0.3, -7.6); put(new THREE.SphereGeometry(0.12, 8, 4), redM, x, 0.62, -7.6); }
  // Lily's bike, on its side in the yard of the house that is almost theirs
  const bikeM = mat({ color: 0xc04a8a });
  for (const dx of [-0.5, 0.5]) put(new THREE.TorusGeometry(0.3, 0.03, 4, 12), M.black, OX + 3.2 + dx, 0.05, 6.4, { rx: Math.PI / 2 });
  put(new THREE.BoxGeometry(1.0, 0.05, 0.05), bikeM, OX + 3.2, 0.08, 6.4);
  // porch steps and railings at the two houses that matter
  for (const [cx] of [[OX], [FLAP_X - 2.7]]) { blk(cx - 0.8, 0, 7.4, cx + 0.8, 0.12, 7.95, mat({ map: T.concrete, color: 0x8a8070 })); }
}

function tearPulse(dt) {
  const { S } = C;
  if (!tear.visible) return;
  const k = 1 + Math.sin(S.t * 5.3) * 0.04 + (Math.random() < 0.05 ? 0.08 : 0);
  tear.parts.mid.scale.set(k, 1, 1); tear.parts.core.scale.set(0.35 * k, 0.9, 1);
  tear.parts.outer.material.uniforms.uOpacity.value = 0.35 + Math.sin(S.t * 3.1) * 0.1;
  H.endLight.k = 1.3 + Math.sin(S.t * 6) * 0.2;
  if (Math.random() < dt * 30) puff(tear.position.x + (Math.random() - 0.5) * 0.6, tear.position.y + (Math.random() - 0.5) * 3, tear.position.z + (Math.random() - 0.5) * 0.6, { col: [1, 0.5, 0.15], vy: 0.6, vx: (Math.random() - 0.5), life: 1.2, size: 0.03 });
}

function fixed() {
  const { S } = C;
  S.oFixed = true;
  AU.whoomp(OX + 45, 0.5, 13); AU.chime();
  H.grille.material.uniforms.uColor.value.set(0.15, 0.12, 0.1);
  H.fireLight.on = false;
  hideMon(); S.oPatrol = null; S.oAlert = null;
  lookAtPoint(FLAP_X, 0.3, 7.5, 0.8);
  C.setObj('The hot box is quiet.');
  C.later(1.2, () => {
    S.oStage = 'torn'; S.oT = 0;
    tear.visible = true; tear.position.set(OX + 45, 1.9, -10.5); tear.rotation.y = 0;
    H.endLight.on = true; H.endLight.pos.copy(tear.position);
    AU.thunder(0.3); AU.stinger(0.6); S.oShake = 1.2;
    const p = C.S.presence; p.setPos(OX + 45.5, -5.5);
    C.ui.card('Torn', 'Across the road, the air rips open, top to bottom, like paper. It burns orange. Through it you can smell home: woodsmoke, snow, Lily\'s shampoo. The thing is out there, between you and it, sitting in the road, watching the flap.');
    C.later(2, () => C.setObj('Home is on the other side of that.'));
  });
}
export function otherInteract() {
  const { S } = C;
  if (S.oStage !== 'safe') return S.other;
  if (!S.oHandle && dog.y > 1.3 && d2(dog.pos, H.handle.position) < 0.9) { S.oHandle = 'falling'; S.oHandleT = 0; act('nudge'); return true; }
  if (S.oHandle === 'floor' && dog.y < 0.4 && d2(dog.pos, H.handle.position) < 0.75) {
    S.oHandle = 'carried'; act('pickup'); AU.pickup();
    dog.mouth.add(H.handle); H.handle.position.set(0, 0, 0); H.handle.rotation.set(0, 0.4, 0.2); H.handle.scale.setScalar(0.75);
    return true;
  }
  if (S.oHandle === 'carried') {
    if (d2(dog.pos, H.valve.position) < 0.95) {
      S.oHandle = 'fitted'; act('drop'); AU.knock(H.valve.position.x, 0.6, H.valve.position.z, 1, 0.5);
      H.valve.add(H.handle); H.handle.position.set(0, 0, -0.06); H.handle.rotation.set(0, 0, 0); H.handle.scale.setScalar(1);
      showSubtitle('note', '<span class="note">(It goes back on with a click.)</span>', 2);
    } else {
      S.oHandle = 'floor'; act('drop');
      const fx = -Math.sin(dog.yaw), fz = -Math.cos(dog.yaw);
      W.add(H.handle); H.handle.scale.setScalar(1); H.handle.position.set(dog.pos.x + fx * 0.35, 0.03, dog.pos.z + fz * 0.35); H.handle.rotation.set(0, dog.yaw, 0);
    }
    return true;
  }
  if (!S.oClogOut && d2(dog.pos, H.clogPos) < 0.85) {
    S.oClogTugs = (S.oClogTugs || 0) + 1; act('pull');
    AU.rattle(H.clogPos.x, 0.35, H.clogPos.z, 1); AU.thunk(H.clogPos.x, 0.35, H.clogPos.z, 0.6);
    S.oAlert = H.clogPos.clone(); S.oAlertT = 0; // that was loud. It heard.
    for (let i = 0; i < 12; i++) puff(H.clogPos.x, 0.35, H.clogPos.z, { col: [0.05, 0.04, 0.04], vx: (Math.random() - 0.3) * 1.5, vy: Math.random() * 0.8, vz: (Math.random() - 0.5), grav: 3, life: 1, size: 0.035 });
    if (S.oClogTugs >= 3) {
      S.oClogOut = true; H.clog.position.set(H.clogPos.x + 0.6, 0.08, H.clogPos.z + 0.3); H.clog.scale.set(1.5, 0.4, 1.2);
      AU.whoomp(H.clogPos.x, 0.4, H.clogPos.z);
      if (S.oValve >= 1) fixed();
    } else showSubtitle('note', `<span class="note">(${S.oClogTugs === 1 ? 'It is stuck fast. It gives, a little.' : 'It is coming. Once more.'})</span>`, 1.8);
    return true;
  }
  return true;
}
export function otherPrompt() {
  const { S } = C;
  if (dog.frozen) return '';
  if (S.oStage === 'safe') {
    if (!S.oHandle && dog.y > 1.3 && d2(dog.pos, H.handle.position) < 0.9) return '<b>E</b> knock it down';
    if (S.oHandle === 'floor' && dog.y < 0.4 && d2(dog.pos, H.handle.position) < 0.75) return '<b>E</b> take the red handle';
    if (S.oHandle === 'carried') return d2(dog.pos, H.valve.position) < 0.95 ? '<b>E</b> put it on the stem' : '<b>E</b> drop it';
    if (S.oHandle === 'fitted' && !(S.oValve >= 1) && d2(dog.pos, H.valve.position) < 0.95) return 'hold <b>E</b> turn it with your teeth';
    if (!S.oClogOut && d2(dog.pos, H.clogPos) < 0.85) return '<b>E</b> pull';
  }
  return '';
}
/** Biscuit made a noise on the other side: out there, it hears you. */
export function otherNoise(pos, loud) {
  if (!C) return;
  const { S } = C;
  if (S.oStage === 'safe' && !S.oFixed && loud >= 0.3 && S.oPatrol && !S.oPatrol.hunt) {
    const d = d2(S.presence.pos, pos);
    if (d < loud * 14) { S.oAlert = pos.clone(); S.oAlertT = 0; }
  }
}
export function otherNext() {
  const { S, F } = C;
  const st = S.oStage;
  if (st === 'street') return ['Go into the house. The door is open.', v3(OX, 0, 9.6)];
  if (st === 'house') return ['They are not breathing.', null];
  if (st === 'risen') return [S.oDoorOpen ? 'Back out to the street.' : 'The door is shut. How do dogs get out of houses?', S.oDoorOpen ? v3(OX + 1, 0, 3) : v3(HALE.x0, 0, 13.2)];
  if (st === 'feast') return ['Something is coming down the street.', null];
  if (st === 'run1') return ['RUN. One house has a light on, and a dog flap.', v3(FLAP_X, 0, 7.4)];
  if (st === 'safe') {
    if (!S.oHandle) return ['The gas stem has no handle. Something red, up high in the corner.', H.handle.position];
    if (S.oHandle !== 'fitted') return ['Put the red handle back on the gas stem.', S.oHandle === 'carried' ? H.valve.position : H.handle.position];
    if (!(S.oValve >= 1)) return ['Turn the gas off: hold E on the handle.', H.valve.position];
    return ['The pipe still coughs. Where does it go, outside?', H.clogPos];
  }
  if (st === 'torn') return ['Go out through the dog flap.', v3(FLAP_X, 0, 8.4)];
  if (st === 'walk') return [S.oTearMove ? 'Carry Biscuit down the road to the tear.' : 'Walk out to the road. Toward the tear.', S.oTearMove ? TEAR_END : tear.position];
  if (st === 'peek') return ['Something is behind you. Look.', null];
  if (st === 'chase') return ['RUN. Get to the tear. SPACE to jump over what falls.', TEAR_END];
  void F;
  return ['', null];
}

// ---------------------------------------------------------------------------
function dannyAppears() {
  const { S, F } = C;
  S.oStage = 'danny'; S.oT = 0;
  dog.frozen = true;
  hideMon(); // it has slunk off, into the dark
  const d = F.danny;
  d.visible = true; d.setPos(dog.pos.x - 0.1, dog.pos.z - 0.95); d.pose = 'kneel'; d.yaw = 0; d.override = null;
  // he was just there, out of nowhere: a fright, then nothing but him
  AU.stinger(0.8); P.uFlash.value = 0.5; S.oShake = 0.5;
  lookAtPoint(d.pos.x, 1.05, d.pos.z, 0.3);
  dog.pitch = 0.6;
  C.later(0.25, () => C.say(d, 'WHOA! Hey! Hey, hey, hey. It is me. Biscuit, it is me.', 'calm', { force: true }));
  C.later(1.2, () => { AU.chime(); d.look(C.dogHead(), 99, S.t); d.override = { type: 'pat' }; });
  C.later(4.6, () => { C.say(d, 'Look at you. You got so grey, around your nose.', 'calm', { force: true }); AU.whine(); });
  C.later(8.6, () => C.say(d, 'I know. I know, buddy. I missed you too. Every single day.', 'sad', { force: true }));
  C.later(13.0, () => C.say(d, 'I kept waiting for you to come and find me. And you did. You always come.', 'sad', { force: true }));
  C.later(17.6, () => { C.say(d, 'Come here. I have got you.', 'calm', { force: true }); AU.tailThump && AU.tailThump(dog.pos.x, 0, dog.pos.z); });
  C.later(19.5, () => { d.override = { type: 'carry2' }; S.fade = 1; S.fadeSpeed = 4; });
  C.later(20.3, () => {
    // you are Danny now, carrying him
    dog.human = true; dog.radius = 0.28; dog.frozen = false;
    dog.pos.set(d.pos.x, 0, d.pos.z); dog.yaw = Math.PI * 0.85; dog.pitch = 0.05;
    d.visible = false; d.pose = 'stand'; d.override = null;
    arms.visible = true; S.fade = 0; S.fadeSpeed = 2;
    S.oStage = 'walk'; S.oT = 0;
    C.ui.card('Danny', 'He picks you up like you weigh nothing, the way he always did, and tucks you against his chest. He smells like snow and pencils. You are looking out through his eyes now, and he is looking at the tear.');
    C.later(1.5, () => C.say(d, 'See that? That is the way home. I will get you there. I promise.', 'calm', { force: true }));
    // he hums while he walks: the song your mother sings to Lily
    C.later(4, () => { S.oHum = AU.lullaby(() => [C.camera.position.x, C.camera.position.y - 0.2, C.camera.position.z], 0, 0.62); });
    C.setObj('You are Danny. Carry Biscuit to the tear.');
    C.ach('carried');
  });
}

// ---------------------------------------------------------------------------
// the chase down the endless road
function chase(dt) {
  const { S, F } = C;
  const p = S.presence;
  for (const c of CHECKPOINTS) if (dog.pos.x > c + 2 && c > S.oChk) S.oChk = c;
  // it comes, faster when it is far, a little slower when it is right on you
  const dd = d2(p.pos, dog.pos);
  S.oLungeCD = (S.oLungeCD ?? 6) - dt;
  if (S.oLungeCD <= 0 && dd < 10 && dd > 2.5 && !dog.frozen) { S.oLungeCD = 5 + Math.random() * 4; S.oLunge = 0.5; AU.growl(0.8, 1); AU.stinger(0.5); S.oShake = 0.4; }
  S.oLunge = Math.max(0, (S.oLunge || 0) - dt);
  const sp = dog.frozen ? 2.5 : S.oLunge > 0 ? 8.2 : dd > 16 ? 6 : dd < 4 ? 3.85 : 4.15;
  if (!(S.jumpscare > 0)) moveMon(v3(dog.pos.x, 0, dog.pos.z), sp, dt);
  showMon('hunt', dt);
  S.stalkNear = dd < 8 ? 1 - dd / 8 : 0;
  if (S.t > (S.oBeat || 0) && dd < 10) { S.oBeat = S.t + 0.35 + dd * 0.04; AU.heartbeat(0.5); S.pulse = 1; }
  if (S.t > (S.oBreath || 0) && dd < 9) { S.oBreath = S.t + 1.6; AU.breathing(p.pos.x, 0.8, p.pos.z, 1 - dd / 10); }
  if (dd < 0.8 && !dog.frozen && !(S.jumpscare > 0)) caught(() => {
    const x = S.oChk; dog.pos.set(x, 0, 0); dog.y = 0; dog.yaw = -Math.PI / 2; dog.pitch = 0;
    p.setPos(x - 17, 0);
    C.say(F.danny, 'No. NO. Get up. Get up!', 'sharp', { force: true });
  });
  // lines as you go
  if (dog.pos.x > OX + 140 && C.once('dannyRun1')) C.say(F.danny, 'Do not look back, Biscuit. Do not look back.', 'sharp', { force: true });
  if (dog.pos.x > OX + 190 && C.once('dannyRun2')) C.say(F.danny, 'It is getting smaller. Come on. Come on!', 'sharp', { force: true });
  chaseExtras(dt);
  // poles fall across the road in front of you
  for (const q of H.poles) {
    if (!q.fall && dog.pos.x > q.trig) { q.fall = 0.001; AU.creak(q.g.position.x, 3, q.g.position.z, 1.5); }
    if (q.fall && q.fall < 1) {
      q.fall = Math.min(1, q.fall + dt / 0.9);
      const a = q.fall * q.fall * (Math.PI / 2 - 0.05);
      q.g.rotation.x = -q.side * a;
      if (q.fall >= 1) {
        q.L.on = false; q.head.material.uniforms.uColor.value.set(0.15, 0.1, 0.08);
        AU.crash(q.g.position.x, 0.2, q.g.position.z); AU.thunk(q.g.position.x, 0.1, q.g.position.z, 1); S.oShake = 0.5;
        const x = q.g.position.x, z0 = q.g.position.z, z1 = z0 - q.side * 5.6;
        colliders.push({ seg: [x, z0, x, z1], minX: x, maxX: x, minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1), minY: 0, maxY: 0.32, other: true });
        for (let i = 0; i < 16; i++) puff(x, 0.2, z0 - q.side * Math.random() * 5.6, { col: [1, 0.7, 0.3], vy: 1 + Math.random() * 2, vx: (Math.random() - 0.5) * 2, grav: 6, life: 0.6, size: 0.02 });
        if (Math.abs(dog.pos.x - x) < 0.6 && (dog.pos.z - z0) * -q.side > 0 && (dog.pos.z - z0) * -q.side < 5.8 && dog.y < 0.3) knock(x, dog.pos.z);
      }
    }
  }
  for (const q of H.poles) if (q.fall >= 1 && Math.random() < dt * 9) { const x = q.g.position.x, z = q.g.position.z - q.side * 5.4; for (let i = 0; i < 4; i++) puff(x, 0.25, z, { col: [1, 0.85, 0.4], vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2, vz: (Math.random() - 0.5) * 3, grav: 7, life: 0.4, size: 0.015 }); if (Math.random() < 0.15) AU.rattle(x, 0.3, z, 0.2); }
  for (const q of H.trees) {
    if (!q.fall && dog.pos.x > q.trig) { q.fall = 0.001; AU.creak(q.x, 2, q.g.position.z, 2); }
    if (q.fall && q.fall < 1) {
      q.fall = Math.min(1, q.fall + dt / 1.2);
      q.g.rotation.x = -q.side * q.fall * q.fall * (Math.PI / 2 - 0.08);
      if (q.fall >= 1) {
        const x = q.x, z0 = q.g.position.z, z1 = z0 - q.side * 4.4;
        AU.crash(x, 0.3, z0); AU.thunk(x, 0.2, z0, 1); S.oShake = 0.6;
        colliders.push({ seg: [x, z0, x, z1], minX: x, maxX: x, minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1), minY: 0, maxY: 0.36, other: true });
        if (Math.abs(dog.pos.x - x) < 0.8 && (dog.pos.z - z0) * -q.side > 0 && (dog.pos.z - z0) * -q.side < 4.6 && dog.y < 0.3) knock(x, dog.pos.z);
      }
    }
  }
  // cars come out of the dark at you, swerve, and crash
  for (const c of H.cars) {
    const g = c.g;
    if (c.state === 'wait' && dog.pos.x > c.trig) { c.state = 'drive'; g.visible = true; g.position.set(c.trig + 30, 0, c.lane); AU.whoomp(g.position.x, 1, g.position.z); }
    if (c.state === 'drive') {
      g.position.x -= 11 * dt;
      if (Math.random() < dt * 8) AU.rattle(g.position.x, 0.5, g.position.z, 0.15);
      if (g.position.x < c.trig + 14) { c.state = 'swerve'; c.t = 0; c.z0 = g.position.z; c.zEnd = Math.sign(c.lane) * (roadW(g.position.x) - 1.1); }
      if (Math.abs(g.position.x - dog.pos.x) < 2.3 && Math.abs(g.position.z - dog.pos.z) < 1.15 && dog.y < 1.0) knock(g.position.x, g.position.z);
    }
    if (c.state === 'swerve') {
      c.t += dt; const k = Math.min(1, c.t / 0.55);
      g.position.x -= 9 * (1 - k) * dt;
      g.position.z = c.z0 + (c.zEnd - c.z0) * k;
      g.rotation.y = Math.PI + Math.sign(c.lane) * k * 0.9;
      g.rotation.z = Math.sin(k * Math.PI) * 0.15;
      if (Math.abs(g.position.x - dog.pos.x) < 2.3 && Math.abs(g.position.z - dog.pos.z) < 1.2 && dog.y < 1.0) knock(g.position.x, g.position.z);
      if (k >= 1) {
        c.state = 'wreck';
        AU.crash(g.position.x, 0.6, g.position.z); AU.crash(g.position.x + 0.5, 0.4, g.position.z); AU.thunk(g.position.x, 0.4, g.position.z, 1); S.oShake = 0.9;
        g.headMat.uniforms.uColor.value.set(0.1, 0.1, 0.1);
        for (let i = 0; i < 40; i++) puff(g.position.x, 0.6, g.position.z, { col: Math.random() < 0.5 ? [1, 0.6, 0.2] : [0.15, 0.12, 0.1], vy: 1 + Math.random() * 2.5, vx: (Math.random() - 0.5) * 3, vz: (Math.random() - 0.5) * 3, grav: 4, life: 0.9, size: 0.03 });
        colliders.push({ minX: g.position.x - 1.8, maxX: g.position.x + 1.8, minZ: g.position.z - 1.2, maxZ: g.position.z + 1.2, minY: 0, maxY: 1.4, other: true });
      }
    }
    if (c.state === 'wreck') {
      if (Math.random() < dt * 6) puff(c.g.position.x, 1.2, c.g.position.z, { col: [0.12, 0.1, 0.09], vy: 0.8, vx: 0.2, life: 2, size: 0.05 });
      if (Math.random() < dt * 22) puff(c.g.position.x + (Math.random() - 0.5) * 2, 0.9 + Math.random() * 0.4, c.g.position.z + (Math.random() - 0.5), { col: Math.random() < 0.5 ? [1, 0.55, 0.1] : [1, 0.85, 0.3], vy: 1.2 + Math.random(), life: 0.6, size: 0.04 });
      if (!c.fire) c.fire = src(c.g.position.x, 1.4, c.g.position.z, 0xff7020, 7, [OX - 90, -1, -40, OX + 270, 14, 40], { k: 1.6, flicker: 0.6 });
    }
  }
  // the road gives way
  if (dog.pos.x > EDGE_X - 0.5) startEdge();
}

// ---------------------------------------------------------------------------
// the end of the road: there is only room for one of you
function startEdge() {
  const { S, F } = C;
  S.oStage = 'edge'; S.oT = 0;
  dog.frozen = true;
  dog.pos.set(EDGE_X - 0.6, 0, Math.max(-1.5, Math.min(1.5, dog.pos.z))); dog.yaw = -Math.PI / 2;
  lookAtPoint(TEAR_END.x, 1.2, TEAR_END.z, 0.5);
  const p = S.presence; p.setPos(dog.pos.x - 13, dog.pos.z);
  AU.thunder(0.2); S.oShake = 2.5;
  H.edgeLight = H.edgeLight || src(EDGE_X - 1, 2.6, 0, 0xffa050, 9, [OX - 90, -1, -40, OX + 270, 14, 40], { k: 1.6 });
  C.later(0.3, () => { S.oSlabs = 0.001; });
  C.later(1.8, () => C.say(F.danny, 'No. No, no, no. I cannot jump that. Not holding you.', 'sad', { force: true }));
  C.later(5.0, () => { lookAtPoint(dog.pos.x - 8, 0.6, dog.pos.z, 0.6); AU.growl(1.5, 1); }); // he looks back. It is coming. Slowly. It knows.
  C.later(6.4, () => lookAtPoint(TEAR_END.x, 1.2, TEAR_END.z, 0.6));
  C.later(7.0, () => C.say(F.danny, 'Biscuit. Hey. Look at me. That night was not your fault. You hear me? None of it.', 'sad', { force: true }));
  C.later(12.6, () => C.say(F.danny, 'Tell Lily I am not in the heater. Tell her I am okay now.', 'sad', { force: true }));
  C.later(17.0, () => { C.say(F.danny, 'You can fly, right, buddy? You are a good boy. You are the best boy there ever was.', 'sad', { force: true }); AU.whine(); });
  C.later(22.0, startThrow);
}
function startThrow() {
  const { S, F } = C;
  S.oStage = 'throw'; S.oThrow = 0;
  const d = F.danny;
  d.visible = true; d.setPos(dog.pos.x, dog.pos.z); d.yaw = Math.PI / 2; d.pose = 'stand'; d.override = { type: 'point' };
  arms.visible = false;
  dog.human = false; S.hideDog = true;
  S.oFrom = v3(dog.pos.x + 0.3, 1.45, dog.pos.z); S.oTo = v3(TEAR_END.x - 0.3, 1.6, TEAR_END.z);
  C.S.timeScale = 0.25;
  C.say(d, 'Go home, Biscuit. Wake them up. I love you. GOOD BOY!', 'sharp', { force: true });
  AU.whine(); AU.stinger(0.4);
  S.oHum = AU.lullaby(() => [C.camera.position.x, C.camera.position.y, C.camera.position.z], 0, 0.9);
}
function edgeScene(dt) {
  const { S, F } = C;
  const p = S.presence;
  // the road ahead cracks and drops away into nothing
  if (S.oSlabs > 0 && S.oSlabs < 1) {
    S.oSlabs = Math.min(1, S.oSlabs + dt / 2.2);
    slabs.forEach((s, i) => { const k = Math.max(0, S.oSlabs * 1.6 - i * 0.25); s.position.y = -k * k * 6; s.rotation.z = k * (i - 1) * 0.6; s.rotation.x = k * 0.3; });
    if (Math.random() < dt * 10) puff(EDGE_X + 2 + Math.random() * 7, 0.1, (Math.random() - 0.5) * 5, { col: [0.3, 0.25, 0.2], vy: 1.5, life: 1, size: 0.05 });
  }
  if (S.oStage === 'edge') {
    moveMon(v3(dog.pos.x - 2.4, 0, dog.pos.z), 0.42, dt); showMon(S.oT > 5 && S.oT < 7 ? 'scare' : 'walk', dt);
    if (Math.random() < dt * 0.6) AU.breathing(p.pos.x, 0.8, p.pos.z, 1);
    F.danny.setPos(dog.pos.x, dog.pos.z);
    arms.visible = true; arms.head.rotation.y = 0.4; arms.head.rotation.x = 0.3;
    return;
  }
  // the throw, in slow motion: across, and then you turn and see
  S.oThrow += dt / 2.2;
  const k = Math.min(1, S.oThrow);
  const cam = C.camera;
  const pos = v3().lerpVectors(S.oFrom, S.oTo, k); pos.y += Math.sin(k * Math.PI) * 1.8;
  dog.pos.set(pos.x, 0, pos.z); dog.y = 0;
  const turn = Math.min(1, Math.max(0, (k - 0.12) / 0.3));
  const fov = 72 - turn * 30; if (Math.abs(cam.fov - fov) > 0.2) { cam.fov = fov; cam.updateProjectionMatrix(); }
  const yaw = -Math.PI / 2 + turn * Math.PI, pitch = -0.08 - turn * 0.12 + Math.sin(k * Math.PI) * -0.1;
  cam.position.copy(pos); cam.rotation.set(pitch, yaw, Math.sin(k * 6) * 0.15 * (1 - turn), 'YXZ');
  dog.yaw = yaw; dog.pitch = pitch;
  const d = F.danny;
  if (k < 0.38) { moveMon(v3(d.pos.x - 1.5, 0, d.pos.z), 4, dt); showMon('hunt', dt); }
  else if (k < 0.5) { moveMon(v3(d.pos.x - 0.3, 0, d.pos.z), 9, dt); showMon('scare', dt); d.override = null; }
  else {
    // it has him
    p.pos.x += (d.pos.x - 0.35 - p.pos.x) * Math.min(1, dt * 10);
    showMon('scare', dt);
    if (!S.oGot) { S.oGot = true; AU.scream(); S.oShake = 1; }
    d.pos.y = Math.min(0.7, (k - 0.5) * 3); d.root.position.y = d.pos.y;
    d.yaw = Math.PI / 2 + Math.sin(S.t * 35) * 0.3;
    if (k > 0.86 && d.visible) { d.visible = false; burst(d.pos.x, 0.5, d.pos.z, 80); AU.crash(d.pos.x, 1, d.pos.z); }
  }
  // the tear closes around you
  if (k > 0.8) { P.uFlash.value = Math.min(1, (k - 0.8) * 5); }
  if (k >= 1 && !S.oHome) {
    S.oHome = true; P.uFlash.value = 1;
    C.S.timeScale = 1;
    C.later(0.4, comeHome);
  }
}
function comeHome() {
  const { S } = C;
  leaveOther();
  hideMon();
  C.home();
}
/** testing: come straight home from wherever you are over there */
export function forceHome() { comeHome(); }
export function jumpToStage(stage) {
  // testing: skip ahead
  const { S } = C;
  if (stage === 'safe') { S.oDoorOpen = true; S.oStage = 'run1'; hideMon(); for (const k of FAM) { C.F[k].visible = false; C.F[k].eaten = true; } dog.pos.set(FLAP_X, 0, 9.2); dog.yaw = Math.PI; }
  if (stage === 'chase') { S.oStage = 'safe'; for (const k of FAM) { C.F[k].visible = false; C.F[k].eaten = true; } S.oClogOut = true; S.oValve = 1; fixed(); C.later(1.5, () => { dog.pos.set(FLAP_X, 0, 7.6); }); }
  if (stage === 'run') { dog.human = true; dog.radius = 0.28; arms.visible = true; tear.visible = true; H.endLight.on = true; tear.position.copy(TEAR_END); tear.rotation.y = -Math.PI / 2; H.endLight.pos.copy(TEAR_END); S.oStage = 'chase'; S.oChk = OX + 85; for (const k of FAM) { C.F[k].visible = false; C.F[k].eaten = true; } dog.pos.set(OX + 86, 0, 0); dog.yaw = -Math.PI / 2; S.presence.setPos(OX + 70, 0); }
  if (stage === 'edge') { jumpToStage('run'); dog.pos.set(EDGE_X - 1, 0, 0); S.presence.setPos(EDGE_X - 14, 0); }
}
