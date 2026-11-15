// The Hale farmhouse: geometry, colliders, lights, props, interactables.
import * as THREE from '../vendor/three.module.js';
import { ps1Mat, planarUV, G } from './ps1.js';
import { T } from './textures.js';

export const H = 2.6;          // ground-floor ceiling height
export const BASE_Y = -2.8;    // basement floor
export const colliders = [];   // {minX,maxX,minZ,maxZ,minY,maxY, tag?}
export const items = [];       // interactable pickups
export const spots = {};       // named world positions
export const refs = {};        // named meshes for story events

export let scene;

function segs(len) { return Math.max(1, Math.min(10, Math.round(len / 0.6))); }

/** Axis-aligned box from min/max corners. mat can be a material or array of 6. */
export function box(x0, y0, z0, x1, y1, z1, mat, o = {}) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const geo = new THREE.BoxGeometry(w, h, d, segs(w), segs(h), segs(d));
  const c = new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  if (!o.keepUV) planarUV(geo, c, o.uvScale ?? 1);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(c);
  (o.parent || scene).add(m);
  if (o.solid) colliders.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: y0, maxY: y1, tag: o.tag });
  return m;
}

/** Box positioned by centre & size, useful for props. */
export function prop(cx, cy, cz, w, h, d, mat, o = {}) {
  const geo = new THREE.BoxGeometry(w, h, d, o.seg ?? 1, o.seg ?? 1, o.seg ?? 1);
  if (o.planar) planarUV(geo, new THREE.Vector3(cx, cy, cz), o.uvScale ?? 1);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(cx, cy, cz);
  if (o.ry) m.rotation.y = o.ry;
  if (o.rx) m.rotation.x = o.rx;
  if (o.rz) m.rotation.z = o.rz;
  (o.parent || scene).add(m);
  if (o.solid) colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, minY: cy - h / 2, maxY: cy + h / 2, tag: o.tag });
  return m;
}

/** Wall along X at constant z. openings: [{a,b,y0,y1}] in x. matN faces -z, matS faces +z. */
function wallZ(z, x0, x1, y0, y1, matN, matS, openings = [], t = 0.12) {
  const trim = ps1Mat({ map: T.trim });
  const mats = [trim, trim, trim, trim, matS, matN];
  const ops = [...openings].sort((p, q) => p.a - q.a);
  let x = x0;
  for (const op of ops) {
    if (op.a > x) box(x, y0, z - t / 2, op.a, y1, z + t / 2, mats, { solid: true });
    if (op.y0 > y0) box(op.a, y0, z - t / 2, op.b, op.y0, z + t / 2, mats, { solid: true });
    if (op.y1 < y1) box(op.a, op.y1, z - t / 2, op.b, y1, z + t / 2, mats, { solid: true });
    if (op.y0 > y0) colliders.push({ minX: op.a, maxX: op.b, minZ: z - t / 2, maxZ: z + t / 2, minY: op.y0 - 0.05, maxY: op.y1 }); // the glass
    // door/window frame
    const fm = ps1Mat({ map: T.trim });
    box(op.a - 0.06, op.y0, z - t / 2 - 0.02, op.a, op.y1, z + t / 2 + 0.02, fm);
    box(op.b, op.y0, z - t / 2 - 0.02, op.b + 0.06, op.y1, z + t / 2 + 0.02, fm);
    box(op.a - 0.06, op.y1, z - t / 2 - 0.02, op.b + 0.06, op.y1 + 0.06, z + t / 2 + 0.02, fm);
    x = op.b;
  }
  if (x < x1) box(x, y0, z - t / 2, x1, y1, z + t / 2, mats, { solid: true });
}

/** Wall along Z at constant x. matW faces -x, matE faces +x. */
function wallX(x, z0, z1, y0, y1, matW, matE, openings = [], t = 0.12) {
  const trim = ps1Mat({ map: T.trim });
  const mats = [matE, matW, trim, trim, trim, trim];
  const ops = [...openings].sort((p, q) => p.a - q.a);
  let z = z0;
  for (const op of ops) {
    if (op.a > z) box(x - t / 2, y0, z, x + t / 2, y1, op.a, mats, { solid: true });
    if (op.y0 > y0) box(x - t / 2, y0, op.a, x + t / 2, op.y0, op.b, mats, { solid: true });
    if (op.y1 < y1) box(x - t / 2, op.y1, op.a, x + t / 2, y1, op.b, mats, { solid: true });
    if (op.y0 > y0) colliders.push({ minX: x - t / 2, maxX: x + t / 2, minZ: op.a, maxZ: op.b, minY: op.y0 - 0.05, maxY: op.y1 }); // the glass
    const fm = ps1Mat({ map: T.trim });
    box(x - t / 2 - 0.02, op.y0, op.a - 0.06, x + t / 2 + 0.02, op.y1, op.a, fm);
    box(x - t / 2 - 0.02, op.y0, op.b, x + t / 2 + 0.02, op.y1, op.b + 0.06, fm);
    box(x - t / 2 - 0.02, op.y1, op.a - 0.06, x + t / 2 + 0.02, op.y1 + 0.06, op.b + 0.06, fm);
    z = op.b;
  }
  if (z < z1) box(x - t / 2, y0, z, x + t / 2, y1, z1, mats, { solid: true });
}

function floor(x0, z0, x1, z1, topMat, botMat, y = 0) {
  const side = ps1Mat({ map: T.trim });
  box(x0, y - 0.2, z0, x1, y, z1, [side, side, topMat, botMat, side, side]);
}

// --------------------------------------------------------------------------
// Doors
export const doors = {};
function makeDoor(name, hingeX, hingeZ, width, axis, closedAngle, tex, o = {}) {
  // axis 'x': door spans along +x from hinge when closed; 'z': spans along +z
  const pivot = new THREE.Group();
  pivot.position.set(hingeX, o.y ?? 0, hingeZ);
  scene.add(pivot);
  const mat = ps1Mat({ map: tex });
  const edge = ps1Mat({ map: T.trim });
  const geo = new THREE.BoxGeometry(width, 2.04, 0.05, 2, 3, 1);
  const mesh = new THREE.Mesh(geo, [edge, edge, edge, edge, mat, mat]);
  mesh.position.set(width / 2, 1.02, 0);
  pivot.add(mesh);
  const knob = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.12), ps1Mat({ color: 0xb09040 }));
  knob.position.set(width - 0.1, 0.95, 0);
  pivot.add(knob);
  pivot.rotation.y = (axis === 'x' ? 0 : -Math.PI / 2) + closedAngle;
  const col = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, minY: (o.y ?? 0), maxY: (o.y ?? 0) + 2.05, tag: 'door:' + name, door: true };
  colliders.push(col);
  const d = {
    name, pivot, mesh, width, axis, base: pivot.rotation.y, angle: 0, target: 0, col, speed: 1.6, locked: !!o.locked,
    hingeX, hingeZ,
    setCollider() {
      // the leaf is a line segment collider that follows the hinge rotation
      const a = this.pivot.rotation.y;
      col.seg = [this.hingeX, this.hingeZ, this.hingeX + Math.cos(a) * this.width, this.hingeZ - Math.sin(a) * this.width];
      col.minX = Math.min(col.seg[0], col.seg[2]); col.maxX = Math.max(col.seg[0], col.seg[2]);
      col.minZ = Math.min(col.seg[1], col.seg[3]); col.maxZ = Math.max(col.seg[1], col.seg[3]);
      col.disabled = false;
    },
  };
  d.setCollider();
  doors[name] = d;
  return d;
}

export function updateDoors(dt, onCreak) {
  for (const d of Object.values(doors)) {
    if (Math.abs(d.angle - d.target) > 0.001) {
      const step = Math.sign(d.target - d.angle) * Math.min(Math.abs(d.target - d.angle), d.speed * dt);
      d.angle += step;
      d.pivot.rotation.y = d.base + d.angle;
      d.setCollider();
      if (onCreak) onCreak(d, Math.abs(step) / dt);
    }
  }
}

// --------------------------------------------------------------------------
// Lights (fixed slots, see ps1.js)
export const lights = [];
function light(slot, name, pos, color, range, box, o = {}) {
  const L = { slot, name, pos: new THREE.Vector3(...pos), color: new THREE.Color(color), base: new THREE.Color(color), range, intensity: 1, on: o.on ?? true, flicker: o.flicker || 0, swing: o.swing || 0 };
  G.uLightMin.value[slot].set(box[0], box[1], box[2]);
  G.uLightMax.value[slot].set(box[3], box[4], box[5]);
  lights[slot] = L;
  if (o.bulb) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.08), ps1Mat({ color: 0xfff0c0, unlit: true, unique: true }));
    b.position.copy(L.pos);
    scene.add(b);
    L.bulbMesh = b;
  }
  return L;
}
export function updateLights(t) {
  for (let i = 0; i < lights.length; i++) {
    const L = lights[i];
    if (!L) continue;
    let k = L.on ? L.intensity : 0;
    if (L.flicker) k *= 1 - L.flicker * (Math.random() < 0.08 ? Math.random() : 0) - L.flicker * 0.15 * Math.sin(t * 13.1 + i);
    let p = L.pos;
    if (L.swing) {
      p = L.pos.clone();
      p.x += Math.sin(t * 0.9) * L.swing; p.z += Math.cos(t * 0.7) * L.swing * 0.6;
      if (L.bulbMesh) L.bulbMesh.position.copy(p);
    }
    G.uLightPos.value[i].copy(p);
    G.uLightCol.value[i].set(L.color.r * k, L.color.g * k, L.color.b * k);
    G.uLightRange.value[i] = L.range;
    if (L.bulbMesh) L.bulbMesh.material.uniforms.uColor.value.set(k > 0.1 ? 1 : 0.15, k > 0.1 ? 0.95 : 0.14, k > 0.1 ? 0.75 : 0.12);
  }
}

// --------------------------------------------------------------------------
// Items the dog can carry.
function addItem(name, label, mesh, o = {}) {
  const it = { name, label, mesh, home: mesh.position.clone(), carried: false, scent: o.scent, smell: o.smell, y: mesh.position.y };
  items.push(it);
  return it;
}

// --------------------------------------------------------------------------
export const windows = [];
function windowPane(x, y, z, w, h, facing) {
  // facing: direction from inside to outside ('n','s','e','w')
  const m = ps1Mat({ map: T.window, unlit: true, noFog: false });
  const geo = new THREE.PlaneGeometry(w, h);
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  const rot = { n: 0, s: Math.PI, e: -Math.PI / 2, w: Math.PI / 2 }[facing];
  mesh.rotation.y = rot;
  scene.add(mesh);
  // sill
  const sx = facing === 'n' || facing === 's' ? w + 0.1 : 0.18;
  const sz = facing === 'n' || facing === 's' ? 0.18 : w + 0.1;
  prop(x, y - h / 2 - 0.03, z, sx, 0.05, sz, ps1Mat({ map: T.trim }));
  const out = { n: [0, 0, -1], s: [0, 0, 1], e: [1, 0, 0], w: [-1, 0, 0] }[facing];
  windows.push({ mesh, pos: new THREE.Vector3(x, y, z), out: new THREE.Vector3(...out) });
  return mesh;
}
function curtains(x, y, z, w, facing) {
  const m = ps1Mat({ map: T.curtain });
  const along = facing === 'n' || facing === 's';
  const off = facing === 'n' ? 0.1 : facing === 's' ? -0.1 : facing === 'e' ? -0.1 : 0.1;
  for (const s of [-1, 1]) {
    if (along) prop(x + s * (w / 2 + 0.05), y - 0.15, z + off, 0.3, 1.7, 0.06, m);
    else prop(x + off, y - 0.15, z + s * (w / 2 + 0.05), 0.06, 1.7, 0.3, m);
  }
}

// ==========================================================================
export function buildHouse(sc) {
  scene = sc;
  const M = {
    planks: ps1Mat({ map: T.planks }), lino: ps1Mat({ map: T.linoleum }), carpetB: ps1Mat({ map: T.carpetBlue }),
    carpetP: ps1Mat({ map: T.carpetPink }), concrete: ps1Mat({ map: T.concrete }), cinder: ps1Mat({ map: T.cinder }),
    rose: ps1Mat({ map: T.wallRose }), green: ps1Mat({ map: T.wallGreen }), kitchen: ps1Mat({ map: T.wallKitchen }),
    blue: ps1Mat({ map: T.wallBlue }), stars: ps1Mat({ map: T.wallStars }), paint: ps1Mat({ map: T.wallPaint }),
    panel: ps1Mat({ map: T.panel }), ext: ps1Mat({ map: T.exterior }), ceil: ps1Mat({ map: T.ceiling }),
    joists: ps1Mat({ map: T.joists }), trim: ps1Mat({ map: T.trim }), wood: ps1Mat({ map: T.wood }),
    woodL: ps1Mat({ map: T.woodLight }), plaid: ps1Mat({ map: T.plaid }), metal: ps1Mat({ map: T.metal }),
    enamel: ps1Mat({ map: T.enamel }), quilt: ps1Mat({ map: T.quilt }), card: ps1Mat({ map: T.cardboard }),
    black: ps1Mat({ color: 0x050505 }), counter: ps1Mat({ map: T.counterTop }), cab: ps1Mat({ map: T.cabinet }),
  };
  refs.M = M;

  // ---- floors -------------------------------------------------------------
  floor(0, 5, 3, 10, M.planks, M.joists);       // entry
  floor(3, 5, 9, 10, M.planks, M.joists);       // living
  floor(9, 5, 14, 10, M.lino, M.joists);        // kitchen
  floor(0, 3.5, 14, 5, M.planks, M.joists);     // hall
  floor(0, 0, 4.5, 3.5, M.carpetB, M.joists);   // parents
  floor(4.5, 0, 8, 3.5, M.carpetP, M.joists);   // lily
  floor(8, 0, 10.5, 3.5, M.planks, M.joists);   // danny
  floor(10.5, 0, 12.5, 3.5, M.lino, M.joists);  // laundry
  floor(12.5, 3.0, 14, 3.5, M.planks, M.joists);// stair landing
  // ceiling over everything
  box(0, H, 0, 14, H + 0.15, 10, [M.trim, M.trim, M.trim, M.ceil, M.trim, M.trim]);
  // outside snow (seen through the front door at the end)
  box(-20, -0.3, 10.1, 34, -0.05, 40, ps1Mat({ map: T.snowGround }), { uvScale: 3 });

  // ---- walls --------------------------------------------------------------
  const win = (a, b, y0 = 0.9, y1 = 1.9) => ({ a, b, y0, y1 });
  const door = (a, b, y1 = 2.05) => ({ a, b, y0: 0, y1 });
  // north exterior z=0
  wallZ(0, 0, 4.5, 0, H, M.ext, M.blue, [win(1.5, 2.7)]);
  wallZ(0, 4.5, 8, 0, H, M.ext, M.stars, [win(5.6, 6.8)]);
  wallZ(0, 8, 10.5, 0, H, M.ext, M.panel);
  wallZ(0, 10.5, 12.5, 0, H, M.ext, M.paint, [win(11.2, 12.0, 1.4, 1.95)]);
  wallZ(0, 12.5, 14, 0, H, M.ext, M.panel);
  // hall north z=3.5
  wallZ(3.5, 0, 4.5, 0, H, M.blue, M.green, [door(1.5, 2.4)]);
  wallZ(3.5, 4.5, 8, 0, H, M.stars, M.green, [door(5.5, 6.4)]);
  wallZ(3.5, 8, 10.5, 0, H, M.panel, M.green, [door(9.0, 9.9)]);
  wallZ(3.5, 10.5, 12.5, 0, H, M.paint, M.green, [door(11.0, 11.9)]);
  wallZ(3.5, 12.5, 14, 0, H, M.panel, M.green, [door(13.0, 13.8)]);
  // hall south z=5
  wallZ(5, 0, 3, 0, H, M.green, M.green, [door(1.0, 2.0, 2.2)]);
  wallZ(5, 3, 9, 0, H, M.green, M.rose, [door(5.0, 6.5, 2.2)]);
  wallZ(5, 9, 14, 0, H, M.green, M.kitchen, [door(11.0, 12.0, 2.1)]);
  // south exterior z=10
  wallZ(10, 0, 3, 0, H, M.green, M.ext, [win(0.2, 0.8, 0.8, 1.95), door(1.0, 2.0)]); // a narrow sidelight by the front door
  wallZ(10, 3, 9, 0, H, M.rose, M.ext, [win(4.5, 6.0, 0.8, 2.0), win(7.0, 8.2, 0.8, 2.0)]);
  wallZ(10, 9, 14, 0, H, M.kitchen, M.ext, [win(11.0, 12.5, 1.15, 2.0)]);
  // west exterior x=0
  wallX(0, 0, 3.5, 0, H, M.ext, M.blue);
  wallX(0, 3.5, 5, 0, H, M.ext, M.green);
  wallX(0, 5, 10, 0, H, M.ext, M.green);
  // east exterior x=14
  wallX(14, 0, 3.5, BASE_Y, H, M.panel, M.ext);
  wallX(14, 3.5, 5, 0, H, M.green, M.ext, [door(3.75, 4.75)]); // the back door, with Biscuit's flap
  wallX(14, 5, 10, 0, H, M.kitchen, M.ext, [win(6.5, 7.8, 1.0, 2.0)]);
  // interior x walls
  wallX(4.5, 0, 3.5, 0, H, M.blue, M.stars);
  wallX(8, 0, 3.5, 0, H, M.stars, M.panel);
  wallX(10.5, 0, 3.5, 0, H, M.panel, M.paint);
  wallX(12.5, 0, 3.5, 0, H, M.paint, M.panel);
  wallX(12.5, 0.4, 3.5, BASE_Y, 0, M.cinder, M.panel);
  wallX(3, 5, 10, 0, H, M.green, M.rose, [door(7.0, 8.5, 2.2)]);
  wallX(9, 5, 10, 0, H, M.rose, M.kitchen, [door(6.5, 8.5, 2.2)]);
  // baseboards (detail)
  const bb = (x0, z0, x1, z1) => box(x0, 0, z0, x1, 0.1, z1, M.trim);
  bb(3.06, 9.88, 8.94, 9.94); bb(3.06, 5.06, 5, 5.12); bb(6.5, 5.06, 8.94, 5.12);
  bb(0.06, 3.56, 1.5, 3.62); bb(2.4, 3.56, 5.5, 3.62); bb(6.4, 3.56, 9.0, 3.62); bb(9.9, 3.56, 11, 3.62); bb(11.9, 3.56, 13, 3.62);
  bb(0.06, 4.88, 1.0, 4.94); bb(2, 4.88, 5, 4.94); bb(6.5, 4.88, 11, 4.94); bb(12, 4.88, 13.94, 4.94);

  // ---- basement -------------------------------------------------------------
  box(6, BASE_Y - 0.2, -4, 14, BASE_Y, 3.5, M.concrete, { uvScale: 2 });
  box(6, -0.2, -4, 14, 0, 0, [M.trim, M.trim, M.trim, M.joists, M.trim, M.trim]);
  wallX(6, -4, 3.5, BASE_Y, -0.2, M.ext, M.cinder);
  wallX(14, -4, 0, BASE_Y, -0.2, M.cinder, M.ext);
  wallZ(-4, 6, 14, BASE_Y, -0.2, M.ext, M.cinder);
  wallZ(3.5, 6, 12.5, BASE_Y, -0.2, M.cinder, M.ext);
  wallZ(3.5, 12.5, 14, BASE_Y, -0.2, M.panel, M.ext);
  // exposed floor joists under the ground floor for z 0..3.5 (already from floors), beams
  for (let x = 6.5; x < 14; x += 1.5) box(x, -0.45, -4, x + 0.15, -0.2, 3.5, M.wood);
  // high basement windows (snow-blocked)
  const bw = (x) => { const m = ps1Mat({ color: 0x9aa4b8, unlit: true }); prop(x, -0.55, -3.93, 0.7, 0.3, 0.02, m); prop(x, -0.55, -3.92, 0.74, 0.04, 0.03, M.trim); };
  bw(8); bw(11.5);
  // stairs: top at z=3.0 (y=0) down to z=0.4 (y=-2.8)
  const steps = 11;
  for (let i = 0; i < steps; i++) {
    const z1 = 3.0 - (i * 2.6) / steps, z0 = 3.0 - ((i + 1) * 2.6) / steps;
    const y = -((i + 1) * 2.8) / steps;
    box(12.56, y - 0.05, z0, 13.94, y + 0.0, z1, M.woodL);
    box(12.56, y - 0.25, z0, 13.94, y - 0.05, z0 + 0.04, M.wood);
  }
  box(12.56, BASE_Y, 0.4, 13.94, BASE_Y + 0.02, 0.6, M.woodL);
  // handrail
  prop(12.62, -1.0, 1.7, 0.05, 0.05, 3.2, M.wood, { rx: -0.82 });
  spots.stairTop = new THREE.Vector3(13.25, 0, 3.25);
  spots.stairBottom = new THREE.Vector3(13.25, BASE_Y, 0.1);

  // ---- doors --------------------------------------------------------------
  makeDoor('front', 1.0, 10.0, 1.0, 'x', 0, T.frontDoor, { alwaysSolid: false });
  makeDoor('parents', 1.5, 3.5, 0.9, 'x', 0, T.door); doors.parents.angle = doors.parents.target = 1.4;
  makeDoor('lily', 5.5, 3.5, 0.9, 'x', 0, T.door); doors.lily.angle = doors.lily.target = 1.2;
  makeDoor('danny', 9.0, 3.5, 0.9, 'x', 0, T.door, { locked: true, alwaysSolid: true });
  makeDoor('laundry', 11.0, 3.5, 0.9, 'x', 0, T.door); doors.laundry.angle = doors.laundry.target = 1.5;
  makeDoor('basement', 13.0, 3.5, 0.8, 'x', 0, T.door, { alwaysSolid: false });
  for (const d of Object.values(doors)) { d.pivot.rotation.y = d.base + d.angle; d.setCollider(); }
  // the light under Danny's door
  refs.dannyDoorLight = prop(9.45, 0.012, 3.58, 0.86, 0.012, 0.08, ps1Mat({ color: 0xffd890, unlit: true, unique: true }));
  refs.dannyDoorLight.visible = false;

  // ---- windows --------------------------------------------------------------
  windowPane(2.1, 1.4, 0.07, 1.2, 1.0, 'n'); curtains(2.1, 1.6, 0.07, 1.2, 'n');
  windowPane(6.2, 1.4, 0.07, 1.2, 1.0, 'n'); curtains(6.2, 1.6, 0.07, 1.2, 'n');
  windowPane(11.6, 1.675, 0.07, 0.8, 0.55, 'n');
  refs.livingWin1 = windowPane(5.25, 1.4, 9.93, 1.5, 1.2, 's'); curtains(5.25, 1.6, 9.93, 1.5, 's');
  refs.livingWin2 = windowPane(7.6, 1.4, 9.93, 1.2, 1.2, 's'); curtains(7.6, 1.6, 9.93, 1.2, 's');
  windowPane(11.75, 1.575, 9.93, 1.5, 0.85, 's');
  windowPane(13.93, 1.5, 7.15, 1.3, 1.0, 'e'); curtains(13.93, 1.6, 7.15, 1.3, 'e');
  windowPane(0.5, 1.375, 9.93, 0.6, 1.15, 's');

  // ---- lights -------------------------------------------------------------
  light(0, 'kitchen', [11.5, 2.35, 7.5], 0xffd9a0, 7.5, [9, -0.1, 5, 14, 3, 10], { bulb: true });
  light(1, 'lamp', [3.7, 1.55, 9.3], 0xffc070, 6.0, [0, -0.1, 5, 9, 3, 10]);
  light(2, 'tv', [8.0, 0.75, 5.6], 0x7090d0, 3.8, [3, -0.1, 5, 9, 3, 10], { flicker: 0.6 });
  light(3, 'hall', [7.0, 2.35, 4.25], 0xd0b890, 6.5, [0, -0.1, 3.5, 14, 3, 5], { bulb: true });
  light(4, 'basement', [10.0, -0.75, -1.2], 0xffe0a8, 6.5, [6, -3, -4, 14, -0.1, 3.5], { bulb: true, swing: 0.08 });
  light(5, 'furnace', [7.7, -2.25, -0.95], 0xff6a18, 3.6, [6, -3, -4, 14, -0.1, 3.5], { flicker: 0.4 });
  light(6, 'night', [4.85, 0.35, 1.6], 0xff90b0, 2.8, [4.5, -0.1, 0, 8, 3, 3.5]);
  light(7, 'lightning', [6, 3, 14], 0xb8c8ff, 14, [-1, -3, -10, 36, 8, 16]);
  lights[7].intensity = 0; lights[4].on = false;
  // a little wall lamp in the entry, by the coats
  light(13, 'entry', [0.25, 1.85, 6.0], 0xffc888, 4.8, [0, -0.1, 5, 3, 3, 10], { bulb: true });

  // ======================================================================
  // PROPS
  // ---- entry ---------------------------------------------------------------
  // coat rack + coats
  prop(0.12, 1.75, 6.9, 0.06, 0.08, 1.6, M.wood);
  const coat = (z, col, h = 1.0) => prop(0.25, 1.75 - h / 2, z, 0.22, h, 0.4, ps1Mat({ color: col }), {});
  coat(6.3, 0x4a3a22, 1.05); coat(6.8, 0x3a2a3a, 0.95); coat(7.3, 0xa04a6a, 0.6);
  // Danny's empty hook with name tag
  prop(0.16, 1.72, 7.75, 0.08, 0.04, 0.04, ps1Mat({ color: 0xb09040 }));
  prop(0.13, 1.82, 7.75, 0.02, 0.06, 0.14, ps1Mat({ color: 0xd8d0b8 }));
  // boot tray + boots (Danny's small sneakers still there)
  prop(0.45, 0.02, 8.4, 0.5, 0.03, 1.2, M.black);
  prop(0.4, 0.12, 8.0, 0.14, 0.2, 0.28, ps1Mat({ color: 0x2a2018 })); prop(0.58, 0.12, 8.0, 0.14, 0.2, 0.28, ps1Mat({ color: 0x2a2018 }));
  prop(0.4, 0.07, 8.45, 0.11, 0.12, 0.24, ps1Mat({ color: 0xc8c8c8 })); prop(0.55, 0.07, 8.45, 0.11, 0.12, 0.24, ps1Mat({ color: 0xc8c8c8 }));
  prop(0.4, 0.09, 8.85, 0.12, 0.16, 0.26, ps1Mat({ color: 0xa04a6a })); prop(0.56, 0.09, 8.85, 0.12, 0.16, 0.26, ps1Mat({ color: 0xa04a6a }));
  // bench
  prop(2.6, 0.45, 8.6, 0.4, 0.06, 1.2, M.wood, { solid: true });
  prop(2.6, 0.22, 8.05, 0.36, 0.44, 0.06, M.wood); prop(2.6, 0.22, 9.15, 0.36, 0.44, 0.06, M.wood);
  // doormat
  prop(1.5, 0.01, 9.55, 0.9, 0.02, 0.6, ps1Mat({ color: 0x4a3a22 }));
  spots.frontDoor = new THREE.Vector3(1.5, 0, 9.3);
  spots.waitSpot = new THREE.Vector3(1.5, 0, 9.4);

  // ---- living room -----------------------------------------------------------
  prop(6, 0.01, 7.6, 3.2, 0.02, 2.2, ps1Mat({ map: T.rug }), { planar: false });
  // couch facing north
  const couch = new THREE.Group(); scene.add(couch);
  prop(6, 0.25, 8.6, 2.2, 0.3, 0.9, M.plaid, { solid: true, planar: true, uvScale: 0.6 });
  prop(6, 0.65, 9.0, 2.2, 0.6, 0.2, M.plaid, { solid: true, planar: true, uvScale: 0.6 });
  prop(4.85, 0.45, 8.6, 0.18, 0.5, 0.9, M.plaid, { solid: true }); prop(7.15, 0.45, 8.6, 0.18, 0.5, 0.9, M.plaid, { solid: true });
  prop(5.5, 0.45, 8.5, 0.9, 0.12, 0.7, M.plaid); prop(6.5, 0.45, 8.5, 0.9, 0.12, 0.7, M.plaid);
  prop(6.8, 0.6, 8.8, 0.35, 0.3, 0.15, ps1Mat({ color: 0x8a5a3a }), { rz: 0.3 }); // throw pillow
  colliders.push({ minX: 4.95, maxX: 7.05, minZ: 8.12, maxZ: 8.88, minY: 0, maxY: 0.51 });
  colliders.push({ minX: 5.45, maxX: 6.55, minZ: 7.0, maxZ: 7.6, minY: 0.4, maxY: 0.445 });
  spots.couch = new THREE.Vector3(6, 0, 8.4);
  // coffee table with mugs and sympathy cards
  prop(6, 0.42, 7.3, 1.1, 0.05, 0.6, M.wood);
  for (const [x, z] of [[5.5, 7.05], [6.5, 7.05], [5.5, 7.55], [6.5, 7.55]]) prop(x, 0.2, z, 0.05, 0.4, 0.05, M.wood, { solid: true });
  prop(5.75, 0.5, 7.2, 0.08, 0.1, 0.08, ps1Mat({ color: 0xd8d0c0 })); prop(6.35, 0.5, 7.4, 0.08, 0.1, 0.08, ps1Mat({ color: 0x6a3030 }));
  const cardM = ps1Mat({ map: T.cards });
  for (let i = 0; i < 5; i++) prop(5.9 + i * 0.08, 0.53, 7.25 + (i % 2) * 0.1, 0.12, 0.16, 0.01, cardM, { ry: (i - 2) * 0.25 });
  // TV on stand against hall wall
  prop(8.0, 0.25, 5.35, 1.0, 0.5, 0.45, M.wood, { solid: true });
  prop(8.0, 0.8, 5.4, 0.7, 0.58, 0.55, ps1Mat({ color: 0x1a1a1c }), { solid: true });
  refs.tvScreen = prop(8.0, 0.82, 5.68, 0.52, 0.42, 0.01, ps1Mat({ map: T.tvStatic, unlit: true, unique: true }));
  prop(7.8, 1.15, 5.4, 0.02, 0.3, 0.02, M.metal, { rz: 0.4 }); prop(8.2, 1.15, 5.4, 0.02, 0.3, 0.02, M.metal, { rz: -0.4 });
  // armchair (father's)
  prop(8.25, 0.25, 7.6, 0.8, 0.3, 0.8, ps1Mat({ color: 0x5a4a32 }), { solid: true });
  prop(8.25, 0.7, 7.98, 0.8, 0.7, 0.18, ps1Mat({ color: 0x5a4a32 }), { solid: true });
  prop(7.88, 0.5, 7.6, 0.12, 0.3, 0.8, ps1Mat({ color: 0x4a3a28 })); prop(8.62, 0.5, 7.6, 0.12, 0.3, 0.8, ps1Mat({ color: 0x4a3a28 }));
  spots.armchair = new THREE.Vector3(8.25, 0, 7.55);
  // side table with Danny's photo, black ribbon and an unlit candle
  prop(8.75, 0.3, 8.6, 0.4, 0.6, 0.4, M.wood, { solid: true });
  refs.dannyPhoto = prop(8.75, 0.75, 8.62, 0.22, 0.28, 0.03, ps1Mat({ map: T.photoDanny }), { ry: Math.PI + 0.3 });
  prop(8.62, 0.66, 8.5, 0.05, 0.12, 0.05, ps1Mat({ color: 0xe8e0c8 }));
  // floor lamp
  prop(3.7, 0.75, 9.3, 0.04, 1.5, 0.04, M.metal);
  prop(3.7, 0.02, 9.3, 0.3, 0.04, 0.3, M.metal, { solid: true });
  refs.lampShade = prop(3.7, 1.55, 9.3, 0.4, 0.3, 0.4, ps1Mat({ color: 0xd8b880, emissive: 0x403010, unique: true }));
  // bookshelf on west wall with christmas stockings (4, one with D)
  prop(3.25, 0.95, 5.95, 0.35, 1.9, 1.2, M.wood, { solid: true });
  for (let i = 0; i < 4; i++) prop(3.43, 0.3 + i * 0.45, 5.95, 0.01, 0.38, 1.1, ps1Mat({ map: T.books }));
  const stockM = ps1Mat({ map: T.stocking });
  for (let i = 0; i < 4; i++) prop(3.45, 1.7, 5.5 + i * 0.3, 0.02, 0.3, 0.16, i === 3 ? stockM : ps1Mat({ color: [0x8a1414, 0x1a5a2a, 0x8a1414][i] }));
  // half-decorated fake tree, lights off, box of ornaments unopened
  const tree = ps1Mat({ map: T.ornaments });
  for (let i = 0; i < 4; i++) prop(3.7, 0.35 + i * 0.35, 6.2 + 3.0, 0.9 - i * 0.2, 0.35, 0.9 - i * 0.2, tree, { ry: i * 0.4 });
  colliders.push({ minX: 3.2, maxX: 4.2, minZ: 8.7, maxZ: 9.7, minY: 0, maxY: 1.6 });
  prop(4.4, 0.12, 9.6, 0.4, 0.24, 0.3, ps1Mat({ map: T.cardboard }), { solid: true });
  // dog bed
  refs.dogBed = prop(4.2, 0.06, 7.0, 0.8, 0.12, 0.65, ps1Mat({ map: T.dogBed }));
  prop(4.2, 0.14, 6.7, 0.8, 0.1, 0.08, ps1Mat({ map: T.dogBed })); prop(3.82, 0.14, 7.0, 0.06, 0.1, 0.65, ps1Mat({ map: T.dogBed }));
  spots.dogBed = new THREE.Vector3(4.2, 0, 7.0);
  // Lily's crayons scattered on the rug
  const cray = [0xc03030, 0x3050a0, 0xe0c020, 0x30a030, 0x111111];
  for (let i = 0; i < 7; i++) prop(5.0 + Math.random() * 0.6, 0.03, 6.4 + Math.random() * 0.4, 0.08, 0.02, 0.02, ps1Mat({ color: cray[i % 5] }), { ry: Math.random() * 3 });
  spots.lilyDraw = new THREE.Vector3(5.3, 0, 6.55);

  // ---- kitchen -------------------------------------------------------------
  // east counters with cabinets
  prop(13.7, 0.45, 7.3, 0.6, 0.9, 4.5, M.cab, { solid: true, planar: true });
  prop(13.68, 0.92, 7.3, 0.64, 0.04, 4.5, M.counter, { planar: true, uvScale: 0.5 });
  prop(13.8, 1.85, 7.3, 0.4, 0.7, 4.5, M.cab, { planar: true });
  // south counter with sink under the window
  prop(12.3, 0.45, 9.7, 2.6, 0.9, 0.6, M.cab, { solid: true, planar: true });
  prop(12.3, 0.92, 9.68, 2.6, 0.04, 0.64, M.counter, { planar: true, uvScale: 0.5 });
  prop(11.75, 0.9, 9.68, 0.7, 0.05, 0.45, M.metal);
  prop(11.75, 1.05, 9.88, 0.04, 0.25, 0.04, M.metal);
  // dishes
  for (let i = 0; i < 4; i++) prop(12.6 + i * 0.12, 1.0, 9.7, 0.02, 0.18, 0.18, ps1Mat({ color: 0xd8d4c4 }));
  // stove on east counter
  prop(13.68, 0.945, 8.6, 0.6, 0.01, 0.7, ps1Mat({ map: T.stove }));
  prop(13.4, 0.5, 8.6, 0.02, 0.4, 0.6, M.black);
  // kettle
  prop(13.6, 1.05, 8.45, 0.2, 0.18, 0.2, ps1Mat({ color: 0x8a2a1a }));
  // radio + pill bottles
  prop(13.7, 1.02, 6.0, 0.3, 0.16, 0.2, ps1Mat({ color: 0x3a2a1a }));
  for (let i = 0; i < 3; i++) prop(13.6, 1.0, 6.5 + i * 0.07, 0.05, 0.1, 0.05, ps1Mat({ color: 0xc07a20 }));
  // fridge
  prop(9.55, 0.9, 9.62, 0.75, 1.8, 0.7, ps1Mat({ map: T.fridge }), { solid: true });
  // dog bowls by the fridge
  prop(10.6, 0.04, 9.6, 0.24, 0.07, 0.24, M.metal);
  prop(10.6, 0.075, 9.6, 0.18, 0.01, 0.18, ps1Mat({ color: 0x3a4a6a }));
  spots.bowl = new THREE.Vector3(10.45, 0, 9.2);
  // table + 4 chairs + 4 place settings (one is still set for Danny)
  prop(11.25, 0.76, 7.1, 1.4, 0.05, 1.0, M.woodL);
  for (const [x, z] of [[10.6, 6.65], [11.9, 6.65], [10.6, 7.55], [11.9, 7.55]]) prop(x, 0.37, z, 0.06, 0.74, 0.06, M.woodL, { solid: true });
  const chair = (x, z, ry, tag) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    prop(0, 0.45, 0, 0.42, 0.04, 0.42, M.woodL, { parent: g });
    prop(0, 0.75, -0.19, 0.42, 0.55, 0.04, M.woodL, { parent: g });
    for (const [a, b] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) prop(a, 0.22, b, 0.04, 0.45, 0.04, M.woodL, { parent: g });
    return g;
  };
  chair(11.25, 6.3, 0, 'danny'); chair(11.25, 7.95, Math.PI); chair(10.2, 7.1, Math.PI / 2); chair(12.3, 7.1, -Math.PI / 2);
  const plate = ps1Mat({ color: 0xd8d4c4 });
  for (const [x, z] of [[11.25, 6.75], [11.25, 7.45], [10.75, 7.1], [11.75, 7.1]]) prop(x, 0.795, z, 0.24, 0.01, 0.24, plate);
  prop(11.25, 0.81, 6.75, 0.03, 0.01, 0.2, M.metal); // untouched fork at Danny's place
  spots.dannyChair = new THREE.Vector3(11.25, 0, 6.3);
  spots.motherChair = new THREE.Vector3(11.25, 0, 7.95);
  spots.sink = new THREE.Vector3(11.75, 0, 9.15);
  // wall clock & calendar & phone
  refs.clock = prop(12.8, 2.0, 5.08, 0.32, 0.32, 0.02, ps1Mat({ map: T.clockFace }));
  refs.clockHand = prop(12.8, 2.0, 5.1, 0.015, 0.13, 0.01, M.black);
  prop(9.95, 1.5, 9.25, 0.3, 0.38, 0.01, ps1Mat({ map: T.calendar }), { ry: Math.PI });
  prop(9.08, 1.4, 6.0, 0.04, 0.22, 0.1, ps1Mat({ color: 0xc8c0a0 }));
  // CO detector on the wall by the hall door, LED dark, battery fallen below
  refs.detector = prop(10.6, 1.4, 5.08, 0.14, 0.14, 0.03, ps1Mat({ map: T.detector }));
  // trash can
  prop(13.6, 0.3, 5.4, 0.35, 0.6, 0.35, M.metal, { solid: true });

  // ---- hall ---------------------------------------------------------------
  prop(7, 0.005, 4.25, 12, 0.01, 0.7, ps1Mat({ map: T.runner }), { planar: true, uvScale: 0.8 });
  const fam = ps1Mat({ map: T.photoFamily, unique: true });
  refs.hallPhotos = [];
  for (const x of [3.0, 4.0, 7.2, 8.3]) refs.hallPhotos.push(prop(x, 1.42, 3.585, 0.42, 0.32, 0.01, fam));
  refs.hallPhotoMat = fam;
  // thermostat cranked to 78
  prop(12.6, 1.45, 3.57, 0.12, 0.12, 0.02, ps1Mat({ map: T.thermostat }));
  // small table
  prop(0.4, 0.4, 4.25, 0.4, 0.8, 0.8, M.wood, { solid: true });
  prop(0.4, 0.88, 4.1, 0.18, 0.16, 0.12, ps1Mat({ color: 0x1a1a1a }));

  // ---- parents' room --------------------------------------------------------
  prop(1.4, 0.25, 1.1, 1.6, 0.5, 2.0, M.wood, { solid: true });
  prop(1.4, 0.55, 1.15, 1.55, 0.12, 1.9, M.quilt, { planar: true, uvScale: 0.7 });
  prop(1.4, 0.8, 0.12, 1.7, 1.2, 0.1, M.wood);
  prop(0.95, 0.66, 0.4, 0.5, 0.12, 0.3, ps1Mat({ color: 0xd8d4c8 })); prop(1.85, 0.66, 0.4, 0.5, 0.12, 0.3, ps1Mat({ color: 0xd8d4c8 }));
  prop(0.35, 0.3, 0.4, 0.4, 0.6, 0.4, M.wood, { solid: true }); prop(2.5, 0.3, 0.4, 0.4, 0.6, 0.4, M.wood, { solid: true });
  prop(2.5, 0.68, 0.4, 0.14, 0.16, 0.1, ps1Mat({ color: 0xe8e4e0 })); // tissue box
  prop(0.35, 0.75, 0.4, 0.2, 0.3, 0.2, ps1Mat({ color: 0xc8b080 })); // lamp
  prop(3.8, 0.55, 0.35, 1.0, 1.1, 0.5, M.wood, { solid: true });
  prop(3.8, 1.4, 0.15, 0.6, 0.6, 0.02, ps1Mat({ color: 0x404850 })); // mirror
  spots.parentBedF = new THREE.Vector3(1.85, 0.62, 1.2);
  spots.parentBedM = new THREE.Vector3(0.95, 0.62, 1.2);
  spots.parentBedSide = new THREE.Vector3(2.5, 0, 1.4);

  // ---- Lily's room ---------------------------------------------------------
  prop(7.25, 0.2, 1.1, 0.9, 0.4, 1.8, M.woodL, { solid: true });
  prop(7.25, 0.45, 1.15, 0.85, 0.1, 1.7, ps1Mat({ color: 0x8a90c8 }));
  prop(7.25, 0.53, 0.4, 0.5, 0.08, 0.25, ps1Mat({ color: 0xe8e0e8 }));
  prop(7.25, 0.65, 0.12, 0.9, 0.5, 0.06, M.woodL);
  prop(6.9, 0.6, 0.55, 0.2, 0.2, 0.15, ps1Mat({ color: 0x8a6a4a })); // teddy
  prop(6.9, 0.75, 0.55, 0.14, 0.12, 0.12, ps1Mat({ color: 0x8a6a4a }));
  // nightlight
  prop(4.62, 0.35, 1.6, 0.04, 0.1, 0.08, ps1Mat({ color: 0xffb0c8, unlit: true }));
  // dollhouse of the farmhouse, with a figure in its basement
  prop(5.3, 0.3, 2.9, 0.8, 0.6, 0.4, ps1Mat({ map: T.dollhouse }), { solid: true, ry: Math.PI });
  prop(5.3, 0.68, 2.9, 0.84, 0.16, 0.44, ps1Mat({ color: 0x5a3a3a }));
  // toys
  prop(6.0, 0.08, 2.2, 0.16, 0.16, 0.16, ps1Mat({ color: 0xc03030 }));
  prop(5.0, 0.05, 0.9, 0.3, 0.1, 0.2, ps1Mat({ color: 0x3050a0 }));
  // drawings taped on the walls
  const dw = ps1Mat({ map: T.drawingWall });
  prop(4.57, 1.3, 0.8, 0.01, 0.3, 0.3, dw); prop(7.93, 1.3, 2.3, 0.01, 0.3, 0.3, dw); prop(6.0, 1.4, 0.07, 0.3, 0.3, 0.01, ps1Mat({ map: T.drawing }));
  spots.lilyBed = new THREE.Vector3(7.25, 0.52, 1.2);
  spots.lilyBedSide = new THREE.Vector3(6.4, 0, 1.3);
  spots.lilyDoor = new THREE.Vector3(5.95, 0, 3.1);

  // ---- laundry ---------------------------------------------------------------
  prop(10.95, 0.45, 0.4, 0.65, 0.9, 0.65, ps1Mat({ map: T.washer }), { solid: true, ry: Math.PI });
  prop(11.65, 0.45, 0.4, 0.65, 0.9, 0.65, ps1Mat({ map: T.washer }), { solid: true, ry: Math.PI });
  prop(12.2, 0.45, 1.8, 0.5, 0.9, 0.6, M.enamel, { solid: true });
  prop(12.05, 0.2, 2.95, 0.5, 0.4, 0.35, ps1Mat({ color: 0xc8c0a0 }), { solid: true });
  prop(12.05, 0.42, 2.95, 0.45, 0.08, 0.3, ps1Mat({ map: T.flannel }));
  prop(11.6, 1.7, 0.2, 1.6, 0.04, 0.35, M.wood);
  for (let i = 0; i < 4; i++) prop(11.0 + i * 0.35, 1.82, 0.2, 0.2, 0.2, 0.2, ps1Mat({ color: [0xd04020, 0x2050a0, 0xe0d0a0, 0x30a030][i] }));
  spots.laundry = new THREE.Vector3(11.45, 0, 2.0);

  // ---- stairwell bulb on string ---------------------------------------------
  prop(13.4, 2.3, 2.8, 0.01, 0.6, 0.01, M.black);

  // ---- basement -------------------------------------------------------------
  // the furnace
  const fur = new THREE.Group(); fur.position.set(7.6, BASE_Y, -1.85); scene.add(fur);
  const furM = ps1Mat({ map: T.furnace });
  prop(0, 0.95, 0, 1.3, 1.9, 1.1, furM, { parent: fur });
  refs.grilleMat = ps1Mat({ map: T.grille, unlit: true, unique: true });
  refs.grille = prop(0, 0.55, 0.56, 0.9, 0.38, 0.01, refs.grilleMat, { parent: fur });
  prop(0, 2.1, 0, 0.3, 0.4, 0.3, M.metal, { parent: fur });
  // flue pipe up into the ceiling with a cracked joint
  prop(0, 2.55, 0, 0.22, 0.5, 0.22, M.metal, { parent: fur });
  refs.flueCrack = new THREE.Vector3(7.6, BASE_Y + 2.35, -1.85);
  prop(0.25, 2.62, 0, 0.6, 0.18, 0.18, M.metal, { parent: fur });
  // ducts snaking along the ceiling (the "arms")
  prop(10.0, -0.55, -1.85, 4.8, 0.3, 0.45, M.metal);
  prop(8.4, -0.55, 0.8, 0.45, 0.3, 5.0, M.metal);
  colliders.push({ minX: 6.9, maxX: 8.3, minZ: -2.45, maxZ: -1.25, minY: BASE_Y, maxY: -0.5 });
  refs.furnace = fur;
  spots.furnace = new THREE.Vector3(7.6, BASE_Y, -1.1);
  // water heater
  prop(6.55, BASE_Y + 0.75, -3.3, 0.6, 1.5, 0.6, M.enamel, { solid: true });
  // workbench + tools
  prop(10.5, BASE_Y + 0.85, -3.7, 2.4, 0.08, 0.6, M.wood);
  for (const x of [9.4, 11.6]) prop(x, BASE_Y + 0.42, -3.7, 0.08, 0.84, 0.5, M.wood, { solid: true });
  prop(10.5, BASE_Y + 1.6, -3.95, 2.4, 1.0, 0.03, ps1Mat({ color: 0x6a5a3a }));
  for (let i = 0; i < 6; i++) prop(9.6 + i * 0.35, BASE_Y + 1.55, -3.92, 0.04, 0.3, 0.03, M.metal, { rz: (i % 3 - 1) * 0.3 });
  // shelves with jars
  prop(6.25, BASE_Y + 1.0, 0.5, 0.45, 2.0, 1.6, M.wood, { solid: true });
  for (let i = 0; i < 4; i++) prop(6.49, BASE_Y + 0.35 + i * 0.45, 0.5, 0.01, 0.3, 1.5, ps1Mat({ map: T.jars }));
  // chest freezer
  prop(9.5, BASE_Y + 0.45, 2.9, 1.4, 0.9, 0.7, M.enamel, { solid: true });
  // christmas boxes
  prop(7.2, BASE_Y + 0.25, 2.8, 0.7, 0.5, 0.5, M.card, { solid: true });
  prop(7.25, BASE_Y + 0.7, 2.8, 0.6, 0.4, 0.45, M.card);
  // Danny's boxes, one open
  const dbox = ps1Mat({ map: T.boxDanny });
  prop(13.3, BASE_Y + 0.3, -3.3, 0.7, 0.6, 0.6, [M.card, M.card, M.card, M.card, dbox, M.card], { solid: true });
  prop(13.3, BASE_Y + 0.85, -3.35, 0.6, 0.5, 0.5, [M.card, M.card, M.card, M.card, dbox, M.card]);
  prop(12.4, BASE_Y + 0.25, -3.4, 0.6, 0.5, 0.5, [M.card, M.card, M.card, M.card, dbox, M.card], { solid: true });
  prop(12.4, BASE_Y + 0.52, -3.12, 0.6, 0.02, 0.25, M.card, { rx: -0.9 }); // open flap
  // Danny's bicycle leaning
  const bike = new THREE.Group(); bike.position.set(11.0, BASE_Y, -3.1); bike.rotation.z = 0.15; scene.add(bike);
  prop(-0.5, 0.33, 0, 0.6, 0.6, 0.04, ps1Mat({ color: 0x111111 }), { parent: bike });
  prop(0.5, 0.33, 0, 0.6, 0.6, 0.04, ps1Mat({ color: 0x111111 }), { parent: bike });
  prop(0, 0.55, 0, 0.9, 0.05, 0.05, ps1Mat({ color: 0x2050c0 }), { parent: bike });
  prop(0.35, 0.8, 0, 0.05, 0.45, 0.05, ps1Mat({ color: 0x2050c0 }), { parent: bike });
  colliders.push({ minX: 10.3, maxX: 11.7, minZ: -3.3, maxZ: -2.9, minY: BASE_Y, maxY: BASE_Y + 1 });
  // hockey stick
  prop(13.85, BASE_Y + 0.6, -2.4, 0.04, 1.2, 0.04, M.woodL, { rz: 0.1 });
  spots.dannyBoxes = new THREE.Vector3(12.4, BASE_Y, -2.7);
  // pull-string bulb
  prop(10.0, -0.45, -1.2, 0.01, 0.3, 0.01, M.black);

  // ======================================================================
  // ITEMS
  const jacketMesh = new THREE.Group();
  prop(0, 0, 0, 0.42, 0.05, 0.34, ps1Mat({ map: T.jacket }), { parent: jacketMesh });
  prop(-0.25, 0.0, 0.05, 0.16, 0.04, 0.3, ps1Mat({ color: 0xd8ccb0 }), { parent: jacketMesh, ry: 0.4 });
  prop(0.25, 0.0, 0.05, 0.16, 0.04, 0.3, ps1Mat({ color: 0xd8ccb0 }), { parent: jacketMesh, ry: -0.4 });
  jacketMesh.position.set(12.4, BASE_Y + 0.53, -3.4);
  jacketMesh.rotation.y = 0.3;
  scene.add(jacketMesh);
  addItem('jacket', "Danny's jacket", jacketMesh, { scent: 'danny' });

  const ball = prop(2.3, 0.05, 7.4, 0.1, 0.1, 0.1, ps1Mat({ color: 0xc8e040 }));
  addItem('ball', 'tennis ball', ball, { scent: 'dannyFaint' });
  const leash = new THREE.Group();
  prop(0, 0, 0, 0.04, 0.02, 0.5, ps1Mat({ color: 0xa02020 }), { parent: leash });
  prop(0, 0, 0.28, 0.08, 0.04, 0.08, M.metal, { parent: leash });
  leash.position.set(0.35, 0.03, 9.3); leash.rotation.y = 0.6; scene.add(leash);
  addItem('leash', 'leash', leash);
  const battery = prop(10.55, 0.03, 5.35, 0.06, 0.04, 0.1, ps1Mat({ color: 0x2a2a2a }), { ry: 0.7 });
  prop(0, 0.021, 0.03, 0.06, 0.005, 0.03, ps1Mat({ color: 0xc8a020 }), { parent: battery });
  addItem('battery', 'battery', battery);
  const drawing = prop(5.45, 0.012, 6.75, 0.3, 0.01, 0.3, ps1Mat({ map: T.drawing }), { ry: 0.2 });
  addItem('drawing', "Lily's drawing", drawing, { scent: 'lily' });

  return M;
}

// Things a dog can jump up onto. top = the height you stand at.
export const SURFACES = [
  { name: 'couch', x0: 4.95, x1: 7.05, z0: 8.12, z1: 8.88, top: 0.51 },
  { name: 'parents\' bed', x0: 0.62, x1: 2.18, z0: 0.2, z1: 2.1, top: 0.61 },
  { name: 'Lily\'s bed', x0: 6.82, x1: 7.68, z0: 0.3, z1: 2.0, top: 0.5 },
  { name: 'armchair', x0: 7.85, x1: 8.65, z0: 7.2, z1: 7.88, top: 0.4 },
  { name: 'coffee table', x0: 5.45, x1: 6.55, z0: 7.0, z1: 7.6, top: 0.445 },
  { name: 'bench', x0: 2.4, x1: 2.8, z0: 8.0, z1: 9.2, top: 0.48 },
  { name: 'your bed', x0: 3.8, x1: 4.6, z0: 6.68, z1: 7.32, top: 0.12 },
  // the kitchen: a chair, then the counter
  { name: 'a kitchen chair', x0: 11.04, x1: 11.46, z0: 6.09, z1: 6.51, top: 0.47 },
  { name: 'a kitchen chair', x0: 11.04, x1: 11.46, z0: 7.74, z1: 8.16, top: 0.47 },
  { name: 'a kitchen chair', x0: 9.99, x1: 10.41, z0: 6.89, z1: 7.31, top: 0.47 },
  { name: 'a kitchen chair', x0: 12.06, x1: 12.56, z0: 6.86, z1: 7.34, top: 0.47 },
  { name: 'the kitchen table', x0: 10.55, x1: 11.95, z0: 6.6, z1: 7.6, top: 0.785 },
  { name: 'the counter', x0: 13.38, x1: 14.0, z0: 5.05, z1: 9.55, top: 0.94 },
  { name: 'the counter', x0: 11.0, x1: 13.6, z0: 9.38, z1: 10.0, top: 0.94 },
];
/** the highest surface under (x, z) that you could be standing on from height y */
export function surfaceAt(x, z, y) {
  let best = null;
  for (const s of SURFACES) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1 && y >= s.top - 0.14 && (!best || s.top > best.top)) best = s;
  return best;
}

// ---- floor height & collision ---------------------------------------------
export function floorAt(x, z, y) {
  if (x > 12.5 && x < 14 && z > 0.4 && z < 3.0 && y > BASE_Y - 0.4) {
    return Math.min(0, Math.max(BASE_Y, -2.8 * (3.0 - z) / 2.6));
  }
  if (x > 12.5 && x < 14 && z <= 0.4 && y < -0.5) return BASE_Y;
  if (y < -1.4) return BASE_Y;
  return 0;
}

export function collide(pos, radius, y, height) {
  for (let iter = 0; iter < 2; iter++) {
    for (const c of colliders) {
      if (c.disabled) continue;
      if (y + height < c.minY || y > c.maxY - 0.02) continue;
      if (c.seg) {
        const [ax, az, bx, bz] = c.seg;
        const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz;
        let t = ((pos.x - ax) * vx + (pos.z - az) * vz) / L2;
        t = Math.max(0, Math.min(1, t));
        const qx = ax + vx * t, qz = az + vz * t;
        const dx = pos.x - qx, dz = pos.z - qz, d = Math.hypot(dx, dz);
        const r = radius + 0.03;
        if (d < r && d > 1e-6) { pos.x += dx / d * (r - d); pos.z += dz / d * (r - d); }
        continue;
      }
      const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2), push = radius - d;
          pos.x += (dx / d) * push; pos.z += (dz / d) * push;
        } else {
          // centre inside the box: push out along the shallowest axis
          const l = pos.x - c.minX, r = c.maxX - pos.x, b = pos.z - c.minZ, f = c.maxZ - pos.z;
          const m = Math.min(l, r, b, f);
          if (m === l) pos.x = c.minX - radius; else if (m === r) pos.x = c.maxX + radius;
          else if (m === b) pos.z = c.minZ - radius; else pos.z = c.maxZ + radius;
        }
      }
    }
  }
}

/** under open sky (the back yard, the front step) rather than inside the house */
export function isOutside(x, z, y = 0) {
  return y > -0.5 && (x > 14.06 || z > 10.06 || z < -0.06);
}
export function roomAt(x, z, y = 0) {
  if (isOutside(x, z, y)) return 'yard';
  if (y < -0.3) return (x > 12.5 && z > 0.4) ? 'stairs' : 'basement';
  if (z >= 5) return x < 3 ? 'entry' : x < 9 ? 'living' : 'kitchen';
  if (z >= 3.5) return 'hall';
  if (x < 4.5) return 'parents';
  if (x < 8) return 'lily';
  if (x < 10.5) return 'danny';
  if (x < 12.5) return 'laundry';
  return 'stairs';
}
export { light, addItem };
