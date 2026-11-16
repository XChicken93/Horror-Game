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

// Solid things get bevelled edges, so they catch the light like real objects instead of
// reading as painted boxes. Only plain colours and tiling materials (wood, fabric, metal)
// are bevelled; textures that are a picture of one face (a fridge door, a TV) keep their box.
let TILE = null;
const bevelCache = new Map();
function bevelBox(w, h, d) {
  const b = Math.min(0.03, Math.min(w, h, d) * 0.16);
  const key = [w, h, d].map((v) => v.toFixed(3)).join('|');
  if (bevelCache.has(key)) return bevelCache.get(key).clone();
  const sh = new THREE.Shape();
  const x0 = -w / 2 + b, x1 = w / 2 - b, y0 = -h / 2 + b, y1 = h / 2 - b;
  sh.moveTo(x0, y0); sh.lineTo(x1, y0); sh.lineTo(x1, y1); sh.lineTo(x0, y1); sh.lineTo(x0, y0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.001, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: 1 });
  geo.translate(0, 0, -(d - 2 * b) / 2);
  geo.computeVertexNormals();
  bevelCache.set(key, geo);
  return geo.clone();
}
function canBevel(w, h, d, mat) {
  if (Array.isArray(mat) || Math.min(w, h, d) < 0.045) return false;
  const map = mat.uniforms && mat.uniforms.map.value;
  if (!map) return true;
  if (!TILE) TILE = new Set([T.wood, T.woodLight, T.plaid, T.metal, T.enamel, T.cardboard, T.quilt, T.fur, T.bark, T.fence, T.drift, T.planks, T.concrete, T.cinder, T.trim, T.exterior, T.dirt, T.snowGround].filter(Boolean));
  return TILE.has(map);
}

/** Box positioned by centre & size, useful for props. */
export function prop(cx, cy, cz, w, h, d, mat, o = {}) {
  const bev = !o.noBevel && canBevel(w, h, d, mat);
  const geo = bev ? bevelBox(w, h, d) : new THREE.BoxGeometry(w, h, d, o.seg ?? 1, o.seg ?? 1, o.seg ?? 1);
  if (o.planar || (bev && mat.uniforms.map.value)) planarUV(geo, new THREE.Vector3(cx, cy, cz), o.uvScale ?? (o.planar ? 1 : 0.5));
  const m = new THREE.Mesh(geo, mat);
  m.position.set(cx, cy, cz);
  if (o.ry) m.rotation.y = o.ry;
  if (o.rx) m.rotation.x = o.rx;
  if (o.rz) m.rotation.z = o.rz;
  (o.parent || scene).add(m);
  if (o.solid) colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, minY: cy - h / 2, maxY: cy + h / 2, tag: o.tag });
  return m;
}

// Round things. o: parent, rx, ry, rz, solid, seg, sx/sy/sz (scale), open (no caps)
function place(m, x, y, z, o) {
  m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
  if (o.sx || o.sy || o.sz) m.scale.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
  (o.parent || scene).add(m);
  return m;
}
export function cyl(x, y, z, r0, r1, h, mat, o = {}) {
  const m = place(new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, o.seg ?? 10, 1, !!o.open), mat), x, y, z, o);
  if (o.solid) { const r = Math.max(r0, r1); colliders.push({ minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r, minY: y - h / 2, maxY: y + h / 2, tag: o.tag }); }
  return m;
}
export function sph(x, y, z, r, mat, o = {}) {
  return place(new THREE.Mesh(new THREE.IcosahedronGeometry(r, o.detail ?? 1), mat), x, y, z, o);
}
export function tor(x, y, z, R, r, mat, o = {}) {
  return place(new THREE.Mesh(new THREE.TorusGeometry(R, r, o.tube ?? 5, o.seg ?? 12, o.arc ?? Math.PI * 2), mat), x, y, z, o);
}
export function cone(x, y, z, r, h, mat, o = {}) {
  return place(new THREE.Mesh(new THREE.ConeGeometry(r, h, o.seg ?? 10), mat), x, y, z, o);
}

/** Wall along X at constant z. openings: [{a,b,y0,y1}] in x. matN faces -z, matS faces +z. */
function wallZ(z, x0, x1, y0, y1, matN, matS, openings = [], t = 0.12) {
  const trim = ps1Mat({ map: T.trim });
  const mats = [trim, trim, trim, trim, matS, matN];
  const ops = [...openings].sort((p, q) => p.a - q.a);
  let x = x0;
  for (const op of ops) {
    if (op.a > x) box(x, y0, z - t / 2, op.a, y1, z + t / 2, mats, { solid: true, tag: 'wall' });
    if (op.y0 > y0) box(op.a, y0, z - t / 2, op.b, op.y0, z + t / 2, mats, { solid: true, tag: 'wall' });
    if (op.y1 < y1) box(op.a, op.y1, z - t / 2, op.b, y1, z + t / 2, mats, { solid: true, tag: 'wall' });
    if (op.y0 > y0) colliders.push({ minX: op.a, maxX: op.b, minZ: z - t / 2, maxZ: z + t / 2, minY: op.y0 - 0.05, maxY: op.y1, tag: 'wall' }); // the glass
    // door/window frame
    const fm = ps1Mat({ map: T.trim });
    box(op.a - 0.06, op.y0, z - t / 2 - 0.02, op.a, op.y1, z + t / 2 + 0.02, fm);
    box(op.b, op.y0, z - t / 2 - 0.02, op.b + 0.06, op.y1, z + t / 2 + 0.02, fm);
    box(op.a - 0.06, op.y1, z - t / 2 - 0.02, op.b + 0.06, op.y1 + 0.06, z + t / 2 + 0.02, fm);
    x = op.b;
  }
  if (x < x1) box(x, y0, z - t / 2, x1, y1, z + t / 2, mats, { solid: true, tag: 'wall' });
}

/** Wall along Z at constant x. matW faces -x, matE faces +x. */
function wallX(x, z0, z1, y0, y1, matW, matE, openings = [], t = 0.12) {
  const trim = ps1Mat({ map: T.trim });
  const mats = [matE, matW, trim, trim, trim, trim];
  const ops = [...openings].sort((p, q) => p.a - q.a);
  let z = z0;
  for (const op of ops) {
    if (op.a > z) box(x - t / 2, y0, z, x + t / 2, y1, op.a, mats, { solid: true, tag: 'wall' });
    if (op.y0 > y0) box(x - t / 2, y0, op.a, x + t / 2, op.y0, op.b, mats, { solid: true, tag: 'wall' });
    if (op.y1 < y1) box(x - t / 2, op.y1, op.a, x + t / 2, y1, op.b, mats, { solid: true, tag: 'wall' });
    if (op.y0 > y0) colliders.push({ minX: x - t / 2, maxX: x + t / 2, minZ: op.a, maxZ: op.b, minY: op.y0 - 0.05, maxY: op.y1, tag: 'wall' }); // the glass
    const fm = ps1Mat({ map: T.trim });
    box(x - t / 2 - 0.02, op.y0, op.a - 0.06, x + t / 2 + 0.02, op.y1, op.a, fm);
    box(x - t / 2 - 0.02, op.y0, op.b, x + t / 2 + 0.02, op.y1, op.b + 0.06, fm);
    box(x - t / 2 - 0.02, op.y1, op.a - 0.06, x + t / 2 + 0.02, op.y1 + 0.06, op.b + 0.06, fm);
    z = op.b;
  }
  if (z < z1) box(x - t / 2, y0, z, x + t / 2, y1, z1, mats, { solid: true, tag: 'wall' });
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
  // raised panels on both faces, so the door has depth
  const panel = ps1Mat({ map: tex, color: 0xe8e0d0 });
  for (const zs of [-1, 1]) for (const [px, py, pw, ph] of [[-0.2, 0.42, 0.28, 0.75], [0.2, 0.42, 0.28, 0.75], [-0.2, -0.45, 0.28, 0.75], [0.2, -0.45, 0.28, 0.75]]) {
    const pm = new THREE.Mesh(bevelBox(pw * width / 0.9, ph, 0.05), panel);
    pm.position.set(px * width / 0.9, py, zs * 0.016); pm.scale.z = 0.4; mesh.add(pm);
  }
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
  // the frame and the bars across the glass, standing out from it
  const bar = ps1Mat({ color: 0x3a2818 });
  const g = new THREE.Group(); g.position.copy(mesh.position); g.rotation.y = rot; scene.add(g);
  const bb = (bx, by, bw, bh) => { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.04), bar); m.position.set(bx, by, -0.015); g.add(m); };
  bb(0, 0, 0.035, h); bb(0, 0, w, 0.035);
  bb(0, h / 2, w + 0.04, 0.05); bb(0, -h / 2, w + 0.04, 0.05); bb(-w / 2, 0, 0.05, h); bb(w / 2, 0, 0.05, h);
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
  makeDoor('parents', 1.5, 3.5, 0.9, 'x', 0, T.door); doors.parents.angle = doors.parents.target = 0.04;
  makeDoor('lily', 5.5, 3.5, 0.9, 'x', 0, T.door); doors.lily.angle = doors.lily.target = 0.04;
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
  light(1, 'lamp', [3.3, 1.55, 9.6], 0xffc070, 6.0, [0, -0.1, 5, 9, 3, 10]);
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
  // a peg rack with coats hanging off it, the way coats really hang
  const woodDk = ps1Mat({ map: T.wood, color: 0x8a6a48 });
  prop(0.1, 1.78, 6.9, 0.04, 0.12, 1.7, woodDk);
  for (const z of [6.3, 6.8, 7.3, 7.75]) cyl(0.17, 1.76, z, 0.015, 0.015, 0.12, ps1Mat({ color: 0xb09040 }), { rz: Math.PI / 2 });
  const coat = (z, col, len) => {
    const m = ps1Mat({ color: col }), g = new THREE.Group(); g.position.set(0.24, 0, z); scene.add(g);
    prop(0, 1.66, 0, 0.16, 0.12, 0.42, m, { parent: g });                                // shoulders on the peg
    cyl(0, 1.66 - len / 2, 0, 0.12, 0.16, len, m, { parent: g, sz: 1.5, sx: 0.7, seg: 8 }); // the body, hanging
    for (const s2 of [-1, 1]) cyl(0.02, 1.66 - len * 0.38, s2 * 0.2, 0.045, 0.05, len * 0.7, m, { parent: g, rx: s2 * 0.12 }); // sleeves
    prop(-0.02, 1.7, 0, 0.12, 0.08, 0.2, ps1Mat({ color: col, emissive: 0x050505 }), { parent: g }); // the collar
  };
  coat(6.3, 0x4a3a22, 1.0); coat(6.8, 0x3a2a3a, 0.9); coat(7.3, 0xa04a6a, 0.58);
  // Danny's empty peg, with his name on a tag
  prop(0.13, 1.88, 7.75, 0.02, 0.06, 0.14, ps1Mat({ color: 0xd8d0b8 }));
  // the boot tray: big work boots, her boots, Lily's pink ones, and Danny's sneakers, still there
  prop(0.45, 0.015, 8.4, 0.5, 0.03, 1.25, M.black, { noBevel: true });
  const boot = (x, z, col, size, sneaker) => {
    const m = ps1Mat({ color: col }), g = new THREE.Group(); g.position.set(x, 0.03, z); scene.add(g);
    prop(0, 0.02 * size, 0, 0.1 * size, 0.04 * size, 0.27 * size, ps1Mat({ color: sneaker ? 0xe8e4dc : 0x1a1612 }), { parent: g }); // sole
    sph(0, 0.06 * size, -0.08 * size, 0.06 * size, m, { parent: g, sx: 0.85, sy: 0.7, sz: 1.2 });                                    // toe
    prop(0, (sneaker ? 0.07 : 0.13) * size, 0.05 * size, 0.09 * size, (sneaker ? 0.08 : 0.2) * size, 0.13 * size, m, { parent: g }); // ankle
    if (sneaker) prop(0, 0.1 * size, -0.03 * size, 0.06 * size, 0.01, 0.1 * size, ps1Mat({ color: 0xffffff }), { parent: g, noBevel: true }); // laces
  };
  boot(0.38, 7.95, 0x2a2018, 1.15); boot(0.56, 7.95, 0x2a2018, 1.15);
  boot(0.38, 8.4, 0x5a3a2a, 1.0); boot(0.55, 8.4, 0x5a3a2a, 1.0);
  boot(0.38, 8.85, 0xa04a6a, 0.8); boot(0.53, 8.85, 0xa04a6a, 0.8);
  boot(0.4, 9.2, 0x2a4a8a, 0.9, true); boot(0.55, 9.22, 0x2a4a8a, 0.9, true);
  // the bench: a seat on four legs
  prop(2.6, 0.45, 8.6, 0.4, 0.06, 1.2, M.wood, { solid: true });
  for (const [x, z] of [[2.45, 8.08], [2.75, 8.08], [2.45, 9.12], [2.75, 9.12]]) cyl(x, 0.21, z, 0.025, 0.02, 0.42, M.wood, { seg: 6 });
  // doormat that says WELCOME
  { const c = document.createElement('canvas'); c.width = 64; c.height = 40; const g = c.getContext('2d'); g.fillStyle = '#4a3a22'; g.fillRect(0, 0, 64, 40); for (let i = 0; i < 300; i++) { g.fillStyle = Math.random() < 0.5 ? '#3a2a18' : '#5a4a2e'; g.fillRect(Math.random() * 64, Math.random() * 40, 1, 2); } g.strokeStyle = '#2a1e10'; g.strokeRect(3, 3, 58, 34); g.fillStyle = '#2a1e10'; g.font = 'bold 11px monospace'; g.fillText('WELCOME', 8, 24);
    const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace;
    prop(1.5, 0.01, 9.55, 0.9, 0.02, 0.6, ps1Mat({ map: t }), { noBevel: true }); }
  spots.frontDoor = new THREE.Vector3(1.5, 0, 9.3);
  spots.waitSpot = new THREE.Vector3(1.5, 0, 9.4);

  // ---- living room -----------------------------------------------------------
  prop(6, 0.01, 7.6, 3.2, 0.02, 2.2, ps1Mat({ map: T.rug }), { planar: false, noBevel: true });
  // the couch: a frame on short legs, two seat cushions, two back cushions, rolled arms
  prop(6, 0.22, 8.6, 2.2, 0.26, 0.9, M.plaid, { solid: true, planar: true, uvScale: 0.6 });
  prop(6, 0.62, 9.0, 2.2, 0.62, 0.2, M.plaid, { solid: true, planar: true, uvScale: 0.6 });
  for (const sx of [4.85, 7.15]) {
    prop(sx, 0.36, 8.6, 0.18, 0.4, 0.9, M.plaid, { solid: true });
    cyl(sx, 0.58, 8.6, 0.1, 0.1, 0.9, M.plaid, { rx: Math.PI / 2, seg: 10 }); // the roll on top of the arm
  }
  for (const x of [4.9, 7.1]) for (const z of [8.22, 9.0]) cyl(x, 0.045, z, 0.03, 0.022, 0.09, M.wood, { seg: 6 });
  prop(5.5, 0.43, 8.5, 0.92, 0.16, 0.72, M.plaid); prop(6.5, 0.43, 8.5, 0.92, 0.16, 0.72, M.plaid);
  colliders.push({ minX: 4.95, maxX: 7.05, minZ: 8.12, maxZ: 8.88, minY: 0, maxY: 0.51 });
  colliders.push({ minX: 5.45, maxX: 6.55, minZ: 7.0, maxZ: 7.6, minY: 0.4, maxY: 0.445 });
  spots.couch = new THREE.Vector3(6, 0, 8.4);
  prop(5.5, 0.78, 8.82, 0.92, 0.42, 0.2, M.plaid, { rx: -0.18 }); prop(6.5, 0.78, 8.82, 0.92, 0.42, 0.2, M.plaid, { rx: -0.18 }); // back cushions
  sph(6.8, 0.62, 8.72, 0.17, ps1Mat({ color: 0x8a5a3a }), { sx: 1.1, sy: 0.9, sz: 0.45, rz: 0.3 }); // a plump throw pillow
  // light switches and outlets, at the height people put them
  const switchPlate = ps1Mat({ color: 0xe0dccc, emissive: 0x141410 });
  for (const [x, y, z, ry] of [[2.2, 1.2, 4.95, 0], [5.0, 1.2, 4.95, 0], [11.0, 1.2, 4.95, 0], [1.4, 1.2, 3.55, 0], [3.06, 1.2, 6.6, Math.PI / 2], [9.06, 1.2, 6.2, Math.PI / 2], [4.5, 0.3, 9.93, 0], [12.2, 1.1, 9.93, 0], [6.5, 0.3, 5.07, 0], [1.0, 0.3, 0.07, 0]]) {
    prop(x, y, z, 0.08, 0.12, 0.012, switchPlate, { ry, noBevel: true });
  }
  // coffee table: a top, a shelf underneath, four tapered legs; mugs, and the sympathy cards
  prop(6, 0.42, 7.3, 1.1, 0.05, 0.6, M.wood);
  prop(6, 0.14, 7.3, 1.0, 0.03, 0.5, M.wood);
  for (const [x, z] of [[5.5, 7.05], [6.5, 7.05], [5.5, 7.55], [6.5, 7.55]]) cyl(x, 0.2, z, 0.028, 0.02, 0.4, M.wood, { solid: true, seg: 6 });
  const mug = (x, z, col) => { const m = ps1Mat({ color: col }); cyl(x, 0.5, z, 0.04, 0.035, 0.1, m); tor(x + 0.045, 0.5, z, 0.025, 0.008, m, { ry: Math.PI / 2 * 0, rz: 0, seg: 8, tube: 4 }); cyl(x, 0.545, z, 0.034, 0.034, 0.005, ps1Mat({ color: 0x2a1a10 })); };
  mug(5.75, 7.2, 0xd8d0c0); mug(6.35, 7.4, 0x6a3030);
  const cardM = ps1Mat({ map: T.cards });
  for (let i = 0; i < 5; i++) prop(5.9 + i * 0.08, 0.53, 7.25 + (i % 2) * 0.1, 0.12, 0.16, 0.01, cardM, { ry: (i - 2) * 0.25, rx: -0.15 });
  // TV on stand against hall wall
  prop(8.0, 0.25, 5.35, 1.0, 0.5, 0.45, M.wood, { solid: true });
  prop(8.0, 0.8, 5.4, 0.7, 0.58, 0.55, ps1Mat({ color: 0x1a1a1c }), { solid: true });
  refs.tvScreen = prop(8.0, 0.82, 5.68, 0.52, 0.42, 0.01, ps1Mat({ map: T.tvStatic, unlit: true, unique: true }));
  prop(8.0, 0.8, 5.22, 0.5, 0.42, 0.3, ps1Mat({ color: 0x141416 })); // the picture tube bulging out the back
  for (let i = 0; i < 2; i++) prop(8.29, 0.94 - i * 0.12, 5.69, 0.04, 0.04, 0.03, ps1Mat({ color: 0x8a8a84 }));
  prop(7.75, 0.54, 5.69, 0.4, 0.05, 0.02, ps1Mat({ color: 0x2a2a2a }), { noBevel: true }); // speaker grille
  prop(7.8, 1.15, 5.4, 0.02, 0.3, 0.02, M.metal, { rz: 0.4 }); prop(8.2, 1.15, 5.4, 0.02, 0.3, 0.02, M.metal, { rz: -0.4 });
  // the VCR under the TV, with its clock blinking 12:00
  prop(8.0, 0.53, 5.45, 0.42, 0.08, 0.3, ps1Mat({ color: 0x1e1e20 }));
  prop(7.92, 0.53, 5.605, 0.2, 0.012, 0.01, ps1Mat({ color: 0x050505 }), { noBevel: true });
  prop(8.13, 0.53, 5.605, 0.05, 0.02, 0.01, ps1Mat({ color: 0x40ff60, unlit: true }), { noBevel: true });
  // his armchair: deep seat cushion, rolled arms, a tall back with wings, stubby legs
  const chairM = ps1Mat({ color: 0x5a4a32 }), chairD = ps1Mat({ color: 0x4a3a28 });
  prop(8.25, 0.22, 7.6, 0.8, 0.26, 0.8, chairM, { solid: true });
  prop(8.25, 0.38, 7.55, 0.6, 0.1, 0.62, chairM);
  prop(8.25, 0.72, 7.98, 0.8, 0.78, 0.18, chairM, { solid: true });
  for (const sx of [7.9, 8.6]) { prop(sx, 0.42, 7.6, 0.12, 0.26, 0.8, chairD); cyl(sx, 0.56, 7.6, 0.075, 0.075, 0.8, chairD, { rx: Math.PI / 2 }); prop(sx, 0.95, 7.88, 0.1, 0.36, 0.2, chairM); }
  for (const x of [7.9, 8.6]) for (const z of [7.25, 7.95]) cyl(x, 0.045, z, 0.03, 0.022, 0.09, M.wood, { seg: 6 });
  spots.armchair = new THREE.Vector3(8.25, 0, 7.55);
  // side table with Danny's photo in a stand-up frame, and an unlit candle
  prop(8.75, 0.58, 8.6, 0.42, 0.04, 0.42, M.wood, { solid: true });
  for (const [x, z] of [[8.58, 8.43], [8.92, 8.43], [8.58, 8.77], [8.92, 8.77]]) cyl(x, 0.28, z, 0.02, 0.016, 0.56, M.wood, { seg: 6 });
  colliders.push({ minX: 8.54, maxX: 8.96, minZ: 8.39, maxZ: 8.81, minY: 0, maxY: 0.6 });
  refs.dannyPhoto = prop(8.75, 0.75, 8.62, 0.22, 0.28, 0.03, ps1Mat({ map: T.photoDanny }), { ry: Math.PI + 0.3, rx: -0.12, noBevel: true });
  prop(8.75, 0.75, 8.645, 0.26, 0.32, 0.02, M.wood, { ry: Math.PI + 0.3, rx: -0.12 });
  cyl(8.6, 0.67, 8.5, 0.025, 0.025, 0.14, ps1Mat({ color: 0xe8e0c8 })); cyl(8.6, 0.745, 8.5, 0.002, 0.002, 0.015, M.black); cyl(8.6, 0.605, 8.5, 0.05, 0.05, 0.012, M.metal);
  tor(8.75, 0.9, 8.6, 0.05, 0.006, ps1Mat({ color: 0x0a0a0a }), { ry: Math.PI + 0.3, seg: 8, tube: 3 }); // the black ribbon
  // floor lamp: a weighted base, a thin pole, a fabric shade
  cyl(3.3, 0.02, 9.6, 0.15, 0.17, 0.04, M.metal, { solid: true });
  cyl(3.3, 0.76, 9.6, 0.012, 0.012, 1.46, M.metal, { seg: 6 });
  refs.lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.24, 0.3, 10, 1, true), ps1Mat({ color: 0xd8b880, emissive: 0x403010, unique: true, side: THREE.DoubleSide }));
  refs.lampShade.position.set(3.3, 1.55, 9.6); scene.add(refs.lampShade);
  // the bookshelf: sides, shelves, and real books, some of them leaning
  const shelfM = ps1Mat({ map: T.wood, color: 0x9a7a58 });
  prop(3.2, 0.95, 5.35, 0.3, 1.9, 0.03, shelfM, { noBevel: true }); prop(3.2, 0.95, 6.55, 0.3, 1.9, 0.03, shelfM, { noBevel: true });
  prop(3.07, 0.95, 5.95, 0.03, 1.9, 1.2, shelfM, { noBevel: true });
  for (let i = 0; i < 5; i++) prop(3.2, 0.03 + i * 0.46, 5.95, 0.3, 0.03, 1.2, shelfM, { noBevel: true });
  colliders.push({ minX: 3.05, maxX: 3.35, minZ: 5.33, maxZ: 6.57, minY: 0, maxY: 1.9 });
  { let seed = 3; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const spines = [0x6a1a14, 0x1a3a6a, 0x2a4a2a, 0x8a7a4a, 0x3a2a4a, 0xa08060, 0x4a2a1a, 0x1a1a1a, 0x7a2a3a];
    for (let sh = 0; sh < 4; sh++) {
      let z = 5.4;
      while (z < 6.45) {
        const w = 0.03 + r() * 0.035, h = 0.24 + r() * 0.14, lean = r() < 0.1 ? 0.25 : 0;
        if (r() < 0.07) { z += 0.06; continue; } // a gap
        prop(3.2, 0.05 + sh * 0.46 + h / 2, z + w / 2, 0.22, h, w, ps1Mat({ color: spines[Math.floor(r() * spines.length)] }), { rx: lean, noBevel: true });
        z += w + 0.004 + lean * 0.1;
      }
    }
  }
  // stockings hung on the shelf's top edge: a leg and a foot, white cuff; the last one says D
  const stockM = ps1Mat({ map: T.stocking });
  for (let i = 0; i < 4; i++) {
    const m = i === 3 ? stockM : ps1Mat({ color: [0x8a1414, 0x1a5a2a, 0x8a1414][i] }), z = 5.5 + i * 0.3;
    prop(3.37, 1.68, z, 0.04, 0.26, 0.12, m); prop(3.37, 1.58, z + 0.06, 0.04, 0.08, 0.18, m);
    prop(3.37, 1.8, z, 0.05, 0.06, 0.14, ps1Mat({ color: 0xe8e0d0 }));
  }
  // the Christmas tree, half decorated: a cone of branches on a trunk, a few ornaments, the star not on yet
  const pineM = ps1Mat({ color: 0x1e3a22, emissive: 0x020602 });
  cyl(4.15, 0.12, 9.15, 0.04, 0.05, 0.24, M.wood, { seg: 6 });
  cyl(4.15, 0.06, 9.15, 0.22, 0.22, 0.12, ps1Mat({ color: 0x8a1414 }));
  for (let i = 0; i < 4; i++) cone(4.15, 0.55 + i * 0.3, 9.15, 0.55 - i * 0.12, 0.55, pineM, { seg: 9, ry: i * 0.5 });
  { const orn = [0xc02020, 0xd0b030, 0x3060c0, 0xc0c0c0];
    for (let i = 0; i < 9; i++) { const a = i * 2.2, h = 0.5 + (i % 4) * 0.28, r = 0.48 - (i % 4) * 0.11; sph(4.15 + Math.cos(a) * r, h, 9.15 + Math.sin(a) * r, 0.035, ps1Mat({ color: orn[i % 4], emissive: 0x100804 }), { detail: 0 }); } }
  colliders.push({ minX: 3.7, maxX: 4.6, minZ: 8.7, maxZ: 9.6, minY: 0, maxY: 1.6 });
  // the box of ornaments, open, the star lying on top
  prop(3.25, 0.12, 8.95, 0.4, 0.24, 0.3, ps1Mat({ map: T.cardboard }), { solid: true });
  for (let i = 0; i < 6; i++) sph(3.12 + (i % 3) * 0.12, 0.26, 8.88 + Math.floor(i / 3) * 0.13, 0.045, ps1Mat({ color: [0xc02020, 0xd0b030, 0x3060c0][i % 3] }), { detail: 0 });
  { const st = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.035 : 0.08, a = i / 10 * Math.PI * 2; i ? st.lineTo(Math.sin(a) * r, Math.cos(a) * r) : st.moveTo(Math.sin(a) * r, Math.cos(a) * r); }
    const sm = new THREE.Mesh(new THREE.ExtrudeGeometry(st, { depth: 0.02, bevelEnabled: false }), ps1Mat({ color: 0xe0c040, emissive: 0x302008 })); sm.position.set(3.3, 0.29, 8.95); sm.rotation.x = -Math.PI / 2; scene.add(sm); }
  // your bed: an oval cushion inside a raised rim
  const bedM = ps1Mat({ map: T.dogBed });
  refs.dogBed = cyl(4.2, 0.04, 7.0, 0.36, 0.38, 0.08, bedM, { sx: 1.15, seg: 14 });
  tor(4.2, 0.1, 7.0, 0.36, 0.07, bedM, { rx: Math.PI / 2, sx: 1.15, seg: 14, tube: 6 });
  spots.dogBed = new THREE.Vector3(4.2, 0, 7.0);
  // Lily's crayons scattered on the rug, and her paper
  const cray = [0xc03030, 0x3050a0, 0xe0c020, 0x30a030, 0x111111];
  for (let i = 0; i < 7; i++) { const a = Math.random() * 3; const x = 5.0 + Math.random() * 0.6, z = 6.4 + Math.random() * 0.4; cyl(x, 0.012, z, 0.006, 0.006, 0.07, ps1Mat({ color: cray[i % 5] }), { rz: Math.PI / 2, ry: a, seg: 6 }); }
  spots.lilyDraw = new THREE.Vector3(5.3, 0, 6.55);

  // ---- kitchen -------------------------------------------------------------
  // east counters with cabinets
  // plain wood carcasses: the doors and knobs are real pieces, added below
  const carcass = ps1Mat({ map: T.wood, color: 0x9a7a58 });
  prop(13.7, 0.45, 7.3, 0.6, 0.9, 4.5, carcass, { solid: true, planar: true, noBevel: true });
  prop(13.68, 0.92, 7.3, 0.64, 0.04, 4.5, M.counter, { planar: true, uvScale: 0.5 });
  // wall cabinets either side of the window (not across it), each with real doors
  const upDoor = ps1Mat({ color: 0x6a4a2e, emissive: 0x0a0604 }), upKnob = ps1Mat({ color: 0xc0a050, emissive: 0x201808 });
  for (const [z0, z1] of [[5.08, 6.4], [7.9, 9.52]]) {
    const zc = (z0 + z1) / 2, len = z1 - z0;
    prop(13.8, 1.85, zc, 0.4, 0.7, len, carcass, { planar: true });
    const n = Math.max(2, Math.round(len / 0.45));
    for (let i = 0; i < n; i++) {
      const z = z0 + (i + 0.5) * len / n;
      prop(13.585, 1.85, z, 0.035, 0.62, len / n - 0.04, upDoor);
      prop(13.555, 1.6, z + (i % 2 ? -1 : 1) * (len / n / 2 - 0.07), 0.03, 0.04, 0.04, upKnob);
    }
  }
  // south counter with sink under the window
  prop(12.3, 0.45, 9.7, 2.6, 0.9, 0.6, carcass, { solid: true, planar: true, noBevel: true });
  prop(12.3, 0.92, 9.68, 2.6, 0.04, 0.64, M.counter, { planar: true, uvScale: 0.5 });
  // the sink: a steel basin set into the counter, a gooseneck faucet, two taps
  prop(11.75, 0.935, 9.66, 0.62, 0.02, 0.42, M.metal, { noBevel: true });
  prop(11.75, 0.93, 9.66, 0.54, 0.02, 0.34, ps1Mat({ color: 0x2a2c30 }), { noBevel: true });
  cyl(11.75, 1.04, 9.9, 0.015, 0.015, 0.2, M.metal, { seg: 6 });
  tor(11.75, 1.14, 9.82, 0.08, 0.013, M.metal, { arc: Math.PI, seg: 8, tube: 4, ry: Math.PI / 2 });
  for (const sx of [-0.12, 0.12]) { cyl(11.75 + sx, 0.97, 9.9, 0.02, 0.02, 0.04, M.metal, { seg: 6 }); prop(11.75 + sx, 0.995, 9.9, 0.06, 0.012, 0.012, M.metal); }
  // dishes standing in a drying rack
  prop(12.75, 0.96, 9.7, 0.45, 0.03, 0.22, ps1Mat({ color: 0xc8c8c0 }));
  for (let i = 0; i < 4; i++) cyl(12.6 + i * 0.1, 1.06, 9.7, 0.09, 0.09, 0.015, ps1Mat({ color: 0xd8d4c4 }), { rz: Math.PI / 2, seg: 12 });
  // stove top on the east counter
  prop(13.68, 0.945, 8.6, 0.6, 0.01, 0.7, ps1Mat({ color: 0xd8d4c8 }), { noBevel: true });
  // the kettle on a burner: round body, a spout, a handle over the top, a knob on the lid
  const kettleM = ps1Mat({ color: 0x8a2a1a, emissive: 0x100404 });
  sph(13.55, 1.04, 8.42, 0.1, kettleM, { sy: 0.85 });
  cyl(13.47, 1.06, 8.42, 0.012, 0.02, 0.12, kettleM, { rz: 1.0, seg: 6 });
  tor(13.55, 1.12, 8.42, 0.07, 0.01, ps1Mat({ color: 0x1a1a1a }), { arc: Math.PI, seg: 8, tube: 4, ry: Math.PI / 2 });
  sph(13.55, 1.13, 8.42, 0.02, ps1Mat({ color: 0x1a1a1a }), { detail: 0 });
  // the radio: a wooden case, a round speaker grille, a dial, an antenna
  prop(13.7, 1.03, 6.0, 0.2, 0.17, 0.32, ps1Mat({ map: T.wood, color: 0x6a4a2a }));
  cyl(13.595, 1.03, 5.92, 0.055, 0.055, 0.01, ps1Mat({ color: 0x2a2018 }), { rz: Math.PI / 2, seg: 12 });
  prop(13.595, 1.06, 6.1, 0.01, 0.04, 0.09, ps1Mat({ color: 0xd8c890, emissive: 0x201808 }), { noBevel: true });
  cyl(13.75, 1.25, 6.12, 0.004, 0.004, 0.32, M.metal, { rz: -0.3, seg: 4 });
  // her pill bottles: orange, white caps
  for (let i = 0; i < 3; i++) { cyl(13.6, 0.995, 6.5 + i * 0.07, 0.022, 0.022, 0.08, ps1Mat({ color: 0xc07a20, emissive: 0x100800 }), { seg: 8 }); cyl(13.6, 1.045, 6.5 + i * 0.07, 0.025, 0.025, 0.02, ps1Mat({ color: 0xe8e8e0 }), { seg: 8 }); }
  // fridge
  prop(9.55, 0.9, 9.62, 0.75, 1.8, 0.7, ps1Mat({ map: T.fridge }), { solid: true });
  const chrome = ps1Mat({ color: 0xb8b8b0, emissive: 0x181818 });
  prop(9.83, 1.25, 9.255, 0.035, 0.5, 0.045, chrome); prop(9.83, 0.55, 9.255, 0.035, 0.3, 0.045, chrome); // handles
  prop(9.55, 1.32, 9.262, 0.74, 0.012, 0.02, ps1Mat({ color: 0x3a3a38 }), { noBevel: true }); // the freezer seam
  prop(9.55, 0.03, 9.27, 0.7, 0.05, 0.03, ps1Mat({ color: 0x1a1a1a }), { noBevel: true }); // kick grille
  // cabinet doors, knobs and drawers along both counters
  const cabDoor = ps1Mat({ color: 0x6a4a2e, emissive: 0x0a0604 }), knobM = ps1Mat({ color: 0xc0a050, emissive: 0x201808 });
  for (let z = 5.35; z < 9.4; z += 0.5) {
    if (Math.abs(z - 8.6) < 0.35) continue; // the stove
    prop(13.385, 0.42, z, 0.04, 0.62, 0.44, cabDoor); prop(13.355, 0.6, z + 0.15, 0.03, 0.04, 0.04, knobM);
    prop(13.385, 0.82, z, 0.04, 0.12, 0.44, cabDoor); prop(13.355, 0.82, z, 0.03, 0.03, 0.08, knobM);
  }
  for (let x = 11.3; x < 13.5; x += 0.5) {
    prop(x, 0.42, 9.385, 0.44, 0.62, 0.04, cabDoor); prop(x - 0.15, 0.6, 9.355, 0.04, 0.04, 0.03, knobM);
  }
  // the stove: a door with a window, knobs, four burners
  prop(13.385, 0.45, 8.6, 0.04, 0.55, 0.6, ps1Mat({ color: 0x2a2a28 }));
  prop(13.36, 0.5, 8.6, 0.02, 0.22, 0.4, ps1Mat({ color: 0x0a0a0a, emissive: 0x050302 }), { noBevel: true });
  for (let i = 0; i < 4; i++) prop(13.36, 0.85, 8.37 + i * 0.15, 0.04, 0.06, 0.06, ps1Mat({ color: 0xd8d8d0 }));
  for (const [bx, bz] of [[13.55, 8.42], [13.55, 8.78], [13.82, 8.42], [13.82, 8.78]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 3, 10), ps1Mat({ color: 0x1a1a1a }));
    ring.rotation.x = Math.PI / 2; ring.position.set(bx, 0.957, bz); scene.add(ring);
  }
  // your water bowl by the fridge
  cyl(10.6, 0.035, 9.6, 0.12, 0.1, 0.07, M.metal, { seg: 12 });
  cyl(10.6, 0.06, 9.6, 0.1, 0.1, 0.01, ps1Mat({ color: 0x3a4a6a, emissive: 0x060a14 }), { seg: 12 });
  spots.bowl = new THREE.Vector3(10.45, 0, 9.2);
  // table + 4 chairs + 4 place settings (one is still set for Danny)
  // the table: a top with an apron, four turned legs
  prop(11.25, 0.76, 7.1, 1.4, 0.05, 1.0, M.woodL);
  prop(11.25, 0.7, 7.1, 1.3, 0.08, 0.9, M.woodL);
  for (const [x, z] of [[10.6, 6.65], [11.9, 6.65], [10.6, 7.55], [11.9, 7.55]]) { cyl(x, 0.36, z, 0.035, 0.025, 0.72, M.woodL, { seg: 8 }); sph(x, 0.55, z, 0.04, M.woodL, { detail: 0 }); colliders.push({ minX: x - 0.035, maxX: x + 0.035, minZ: z - 0.035, maxZ: z + 0.035, minY: 0, maxY: 0.74 }); }
  // chairs with spindle backs
  const chair = (x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    prop(0, 0.45, 0, 0.42, 0.04, 0.42, M.woodL, { parent: g });
    for (const [a, b] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) cyl(a, 0.22, b, 0.018, 0.014, 0.45, M.woodL, { parent: g, seg: 6 });
    for (const a of [-0.19, 0.19]) cyl(a, 0.72, -0.19, 0.018, 0.018, 0.55, M.woodL, { parent: g, seg: 6 });
    for (let i = 0; i < 4; i++) cyl(-0.12 + i * 0.08, 0.7, -0.19, 0.008, 0.008, 0.46, M.woodL, { parent: g, seg: 4 });
    prop(0, 0.98, -0.19, 0.44, 0.06, 0.04, M.woodL, { parent: g });
    return g;
  };
  chair(11.25, 6.3, 0); chair(11.25, 7.95, Math.PI); chair(10.2, 7.1, Math.PI / 2); chair(12.3, 7.1, -Math.PI / 2);
  // four places set: plate, fork, knife, glass. One is still set for Danny.
  const plate = ps1Mat({ color: 0xd8d4c4 }), glassM = ps1Mat({ color: 0xa8b8c0, emissive: 0x101418 });
  for (const [x, z, ry] of [[11.25, 6.75, 0], [11.25, 7.45, Math.PI], [10.75, 7.1, Math.PI / 2], [11.75, 7.1, -Math.PI / 2]]) {
    cyl(x, 0.792, z, 0.11, 0.09, 0.015, plate, { seg: 14 });
    const g = new THREE.Group(); g.position.set(x, 0.79, z); g.rotation.y = ry; scene.add(g);
    prop(-0.15, 0, 0, 0.02, 0.008, 0.18, M.metal, { parent: g, noBevel: true }); prop(0.15, 0, 0, 0.02, 0.008, 0.2, M.metal, { parent: g, noBevel: true });
    cyl(0.17, 0.06, -0.12, 0.03, 0.026, 0.11, glassM, { parent: g, seg: 8 });
  }
  spots.dannyChair = new THREE.Vector3(11.25, 0, 6.3);
  spots.motherChair = new THREE.Vector3(11.25, 0, 7.95);
  spots.sink = new THREE.Vector3(11.75, 0, 9.15);
  // wall clock & calendar & phone
  // a round wall clock with a rim; the calendar; the wall phone with its coiled cord
  refs.clock = prop(12.8, 2.0, 5.08, 0.3, 0.3, 0.02, ps1Mat({ map: T.clockFace }), { noBevel: true });
  tor(12.8, 2.0, 5.085, 0.16, 0.02, ps1Mat({ color: 0x3a2a1a }), { seg: 16, tube: 4 });
  refs.clockHand = prop(12.8, 2.0, 5.1, 0.015, 0.13, 0.01, M.black, { noBevel: true });
  prop(9.95, 1.5, 9.25, 0.3, 0.38, 0.01, ps1Mat({ map: T.calendar }), { ry: Math.PI });
  const phoneM = ps1Mat({ color: 0xc8c0a0 });
  prop(9.07, 1.4, 6.0, 0.05, 0.22, 0.11, phoneM);
  prop(9.12, 1.42, 6.0, 0.05, 0.22, 0.06, phoneM); sph(9.12, 1.53, 6.0, 0.03, phoneM, { sz: 1.4, detail: 0 }); sph(9.12, 1.31, 6.0, 0.03, phoneM, { sz: 1.4, detail: 0 });
  for (let i = 0; i < 8; i++) tor(9.1, 1.27 - i * 0.035, 6.04, 0.015, 0.004, ps1Mat({ color: 0xa8a080 }), { rx: Math.PI / 2, seg: 6, tube: 3 }); // the cord
  // CO detector on the wall by the hall door, round, its LED dark; its battery fallen below
  cyl(10.6, 1.4, 5.085, 0.075, 0.07, 0.035, ps1Mat({ color: 0xe0dcd0 }), { rx: Math.PI / 2, seg: 14 });
  refs.detector = prop(10.6, 1.4, 5.105, 0.1, 0.1, 0.005, ps1Mat({ map: T.detector }), { noBevel: true });
  // a pedal bin
  cyl(13.6, 0.3, 5.4, 0.17, 0.15, 0.6, M.metal, { solid: true, seg: 12 });
  cyl(13.6, 0.61, 5.4, 0.175, 0.175, 0.03, ps1Mat({ color: 0x8a8a84 }), { seg: 12 });
  prop(13.6, 0.03, 5.2, 0.12, 0.02, 0.08, M.black);

  // ---- hall ---------------------------------------------------------------
  prop(7, 0.005, 4.25, 12, 0.01, 0.7, ps1Mat({ map: T.runner }), { planar: true, uvScale: 0.8 });
  const fam = ps1Mat({ map: T.photoFamily, unique: true });
  refs.hallPhotos = [];
  for (const x of [3.0, 4.0, 7.2, 8.3]) refs.hallPhotos.push(prop(x, 1.42, 3.585, 0.42, 0.32, 0.01, fam));
  refs.hallPhotoMat = fam;
  // thermostat cranked to 78
  prop(12.6, 1.45, 3.57, 0.12, 0.12, 0.02, ps1Mat({ map: T.thermostat }));
  // a small hall table with a drawer, and the old phone on it
  prop(0.4, 0.78, 4.25, 0.42, 0.04, 0.82, M.wood, { solid: true });
  prop(0.4, 0.69, 4.25, 0.38, 0.14, 0.76, M.wood); cyl(0.6, 0.69, 4.25, 0.015, 0.015, 0.03, ps1Mat({ color: 0xc0a050 }), { rz: Math.PI / 2, seg: 6 });
  for (const [x, z] of [[0.24, 3.9], [0.56, 3.9], [0.24, 4.6], [0.56, 4.6]]) cyl(x, 0.38, z, 0.022, 0.016, 0.76, M.wood, { seg: 6 });
  colliders.push({ minX: 0.19, maxX: 0.61, minZ: 3.84, maxZ: 4.66, minY: 0, maxY: 0.8 });
  const blk = ps1Mat({ color: 0x1a1a1a });
  prop(0.4, 0.85, 4.1, 0.2, 0.08, 0.16, blk); cyl(0.4, 0.895, 4.1, 0.045, 0.045, 0.01, ps1Mat({ color: 0xd8d0c0 }), { seg: 10 });
  prop(0.4, 0.92, 4.1, 0.05, 0.04, 0.22, blk); sph(0.4, 0.92, 3.99, 0.035, blk, { detail: 0 }); sph(0.4, 0.92, 4.21, 0.035, blk, { detail: 0 });

  // ---- parents' room --------------------------------------------------------
  // their bed: four posts, side rails, a mattress, the quilt hanging over the edges, plump pillows
  prop(1.4, 0.22, 1.1, 1.6, 0.18, 2.0, M.wood, { solid: true });
  colliders.push({ minX: 0.6, maxX: 2.2, minZ: 0.1, maxZ: 2.1, minY: 0, maxY: 0.5 });
  prop(1.4, 0.42, 1.12, 1.56, 0.2, 1.94, ps1Mat({ color: 0xe8e4d8 }));
  prop(1.4, 0.55, 1.2, 1.64, 0.08, 1.78, M.quilt, { planar: true, uvScale: 0.7 });
  for (const sx of [0.585, 2.215]) prop(sx, 0.4, 1.2, 0.03, 0.3, 1.78, M.quilt, { planar: true, uvScale: 0.7, noBevel: true });
  prop(1.4, 0.4, 2.105, 1.64, 0.3, 0.03, M.quilt, { planar: true, uvScale: 0.7, noBevel: true });
  prop(1.4, 0.85, 0.08, 1.7, 0.7, 0.06, M.wood); prop(1.4, 1.22, 0.08, 1.74, 0.08, 0.08, M.wood);
  for (const [x, z, h] of [[0.57, 0.08, 1.3], [2.23, 0.08, 1.3], [0.57, 2.12, 0.6], [2.23, 2.12, 0.6]]) { cyl(x, h / 2, z, 0.04, 0.04, h, M.wood, { seg: 8 }); sph(x, h + 0.03, z, 0.05, M.wood, { detail: 0 }); }
  const pillowM = ps1Mat({ color: 0xe8e4dc });
  sph(0.95, 0.66, 0.38, 0.24, pillowM, { sx: 1.0, sy: 0.32, sz: 0.62 }); sph(1.85, 0.66, 0.38, 0.24, pillowM, { sx: 1.0, sy: 0.32, sz: 0.62 });
  // nightstands: a drawer and a knob each; a tissue box on hers
  for (const x of [0.35, 2.5]) { prop(x, 0.3, 0.4, 0.4, 0.6, 0.4, M.wood, { solid: true }); prop(x, 0.47, 0.605, 0.34, 0.15, 0.02, M.woodL); sph(x, 0.47, 0.62, 0.018, ps1Mat({ color: 0xc0a050 }), { detail: 0 }); }
  prop(2.5, 0.68, 0.4, 0.14, 0.12, 0.1, ps1Mat({ color: 0xe8e4e0 })); prop(2.5, 0.75, 0.4, 0.05, 0.03, 0.04, ps1Mat({ color: 0xf8f8f8 })); // tissue box
  { const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.17, 8), ps1Mat({ color: 0xc8b080 })); sh.position.set(0.35, 0.86, 0.4); scene.add(sh);
    const bs = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.18, 8), ps1Mat({ color: 0x6a5a40 })); bs.position.set(0.35, 0.69, 0.4); scene.add(bs); } // bedside lamp
  // the dresser: six drawers with knobs; a framed mirror on top
  prop(3.8, 0.55, 0.35, 1.0, 1.1, 0.5, M.wood, { solid: true });
  for (let r = 0; r < 3; r++) for (const sx of [-0.24, 0.24]) { prop(3.8 + sx, 0.25 + r * 0.32, 0.605, 0.44, 0.28, 0.02, M.woodL); sph(3.8 + sx, 0.25 + r * 0.32, 0.62, 0.018, ps1Mat({ color: 0xc0a050 }), { detail: 0 }); }
  prop(3.8, 1.42, 0.16, 0.66, 0.66, 0.04, M.wood);
  prop(3.8, 1.42, 0.185, 0.56, 0.56, 0.01, ps1Mat({ color: 0x506070, emissive: 0x0a1018 }), { noBevel: true }); // mirror
  spots.parentBedF = new THREE.Vector3(1.85, 0.62, 1.2);
  spots.parentBedM = new THREE.Vector3(0.95, 0.62, 1.2);
  spots.parentBedSide = new THREE.Vector3(2.5, 0, 1.4);

  // ---- Lily's room ---------------------------------------------------------
  // Lily's bed: a white frame with a round-topped headboard, her purple blanket, a pillow, her bear
  const whiteW = ps1Mat({ color: 0xe8e0d8 });
  prop(7.25, 0.18, 1.1, 0.9, 0.2, 1.8, whiteW, { solid: true });
  prop(7.25, 0.36, 1.12, 0.86, 0.16, 1.74, ps1Mat({ color: 0xf0ece4 }));
  prop(7.25, 0.46, 1.2, 0.94, 0.06, 1.6, ps1Mat({ color: 0x8a90c8 }));
  for (const sx of [6.785, 7.715]) prop(sx, 0.36, 1.2, 0.03, 0.22, 1.6, ps1Mat({ color: 0x8a90c8 }), { noBevel: true });
  sph(7.25, 0.53, 0.4, 0.22, ps1Mat({ color: 0xf0e8f0 }), { sx: 1.0, sy: 0.33, sz: 0.55 });
  prop(7.25, 0.55, 0.1, 0.9, 0.6, 0.05, whiteW);
  cyl(7.25, 0.85, 0.1, 0.45, 0.45, 0.05, whiteW, { rx: Math.PI / 2, seg: 16, sy: 0.5 });
  // the teddy bear, sitting up against the pillow
  const bearM = ps1Mat({ color: 0x8a6a4a }), bearL = ps1Mat({ color: 0xc8a888 });
  const bear = new THREE.Group(); bear.position.set(6.92, 0.5, 0.56); bear.rotation.y = 0.5; scene.add(bear);
  sph(0, 0.1, 0, 0.09, bearM, { parent: bear, sy: 1.15 }); sph(0, 0.25, 0.01, 0.07, bearM, { parent: bear });
  sph(0, 0.23, 0.065, 0.03, bearL, { parent: bear, detail: 0 }); sph(0, 0.24, 0.093, 0.01, M.black, { parent: bear, detail: 0 });
  for (const sx of [-1, 1]) { sph(sx * 0.055, 0.31, 0, 0.025, bearM, { parent: bear, detail: 0 }); sph(sx * 0.025, 0.27, 0.062, 0.008, M.black, { parent: bear, detail: 0 }); sph(sx * 0.09, 0.12, 0.02, 0.035, bearM, { parent: bear, sy: 1.5, detail: 0 }); sph(sx * 0.05, 0.03, 0.07, 0.04, bearM, { parent: bear, sz: 1.4, detail: 0 }); }
  // nightlight
  prop(4.6, 0.33, 1.6, 0.02, 0.1, 0.07, ps1Mat({ color: 0xe8e4dc }));
  sph(4.63, 0.33, 1.6, 0.04, ps1Mat({ color: 0xffb0c8, unlit: true }), { sx: 0.6 });
  // dollhouse of the farmhouse, with a figure in its basement
  prop(5.3, 0.3, 2.9, 0.8, 0.6, 0.4, ps1Mat({ map: T.dollhouse }), { solid: true, ry: Math.PI });
  for (const sd of [-1, 1]) prop(5.3 + sd * 0.2, 0.71, 2.9, 0.48, 0.03, 0.46, ps1Mat({ color: 0x6a2a24 }), { rz: -sd * 0.6 }); // a pitched roof
  prop(5.3, 0.88, 2.9, 0.12, 0.08, 0.1, ps1Mat({ color: 0x8a4a3a })); // its chimney
  // toys: a red rubber ball, a blue toy truck with wheels
  sph(6.0, 0.08, 2.2, 0.08, ps1Mat({ color: 0xc03030, emissive: 0x100202 }));
  { const tr = new THREE.Group(); tr.position.set(5.0, 0.04, 0.9); tr.rotation.y = 0.4; scene.add(tr); const bl = ps1Mat({ color: 0x3050a0 });
    prop(0.04, 0.06, 0, 0.22, 0.06, 0.14, bl, { parent: tr }); prop(-0.1, 0.1, 0, 0.1, 0.1, 0.13, bl, { parent: tr }); prop(-0.14, 0.11, 0, 0.012, 0.06, 0.1, ps1Mat({ color: 0xa8c0d0 }), { parent: tr, noBevel: true });
    for (const [x, z] of [[-0.09, -0.075], [-0.09, 0.075], [0.09, -0.075], [0.09, 0.075]]) cyl(x, 0.0, z, 0.035, 0.035, 0.03, M.black, { parent: tr, rx: Math.PI / 2, seg: 8 }); }
  // drawings taped on the walls
  const dw = ps1Mat({ map: T.drawingWall });
  prop(4.57, 1.3, 0.8, 0.01, 0.3, 0.3, dw); prop(7.93, 1.3, 2.3, 0.01, 0.3, 0.3, dw); prop(6.0, 1.4, 0.07, 0.3, 0.3, 0.01, ps1Mat({ map: T.drawing }));
  spots.lilyBed = new THREE.Vector3(7.25, 0.52, 1.2);
  spots.lilyBedSide = new THREE.Vector3(6.4, 0, 1.3);
  spots.lilyDoor = new THREE.Vector3(5.95, 0, 3.1);

  // ---- laundry ---------------------------------------------------------------
  // the washer and dryer: white boxes, round doors with dark glass, a control panel with knobs
  const wht = ps1Mat({ color: 0xe0dcd0, emissive: 0x0a0a08 });
  for (const x of [10.95, 11.65]) {
    prop(x, 0.45, 0.4, 0.65, 0.9, 0.65, wht, { solid: true });
    prop(x, 0.84, 0.74, 0.63, 0.1, 0.03, ps1Mat({ color: 0xb8b4a8 })); for (let k = 0; k < 2; k++) cyl(x - 0.15 + k * 0.3, 0.84, 0.76, 0.03, 0.03, 0.02, ps1Mat({ color: 0x5a5a5a }), { rx: Math.PI / 2, seg: 8 });
    tor(x, 0.45, 0.735, 0.18, 0.03, ps1Mat({ color: 0xa8a8a0 }), { seg: 16, tube: 5 });
    cyl(x, 0.45, 0.73, 0.16, 0.16, 0.01, ps1Mat({ color: 0x1a2028, emissive: 0x05080c }), { rx: Math.PI / 2, seg: 16 });
  }
  // a deep utility sink with a tap
  prop(12.2, 0.45, 1.8, 0.5, 0.9, 0.6, M.enamel, { solid: true });
  prop(12.2, 0.88, 1.8, 0.4, 0.03, 0.48, ps1Mat({ color: 0x8a8a84 }), { noBevel: true });
  cyl(12.4, 1.02, 1.8, 0.015, 0.015, 0.22, M.metal, { seg: 6 }); prop(12.33, 1.12, 1.8, 0.14, 0.02, 0.02, M.metal);
  // a round laundry basket with his flannel shirt in it
  cyl(12.05, 0.2, 2.95, 0.23, 0.19, 0.4, ps1Mat({ color: 0xc8c0a0 }), { solid: true, seg: 12, open: true });
  cyl(12.05, 0.02, 2.95, 0.19, 0.19, 0.02, ps1Mat({ color: 0xa8a080 }), { seg: 12 });
  sph(12.05, 0.36, 2.95, 0.2, ps1Mat({ map: T.flannel }), { sy: 0.35 });
  // a shelf: detergent, bleach, a box of soap
  prop(11.6, 1.7, 0.2, 1.6, 0.04, 0.35, M.wood);
  prop(11.05, 1.84, 0.2, 0.22, 0.24, 0.14, ps1Mat({ color: 0xd04020 }));
  cyl(11.4, 1.86, 0.2, 0.07, 0.07, 0.28, ps1Mat({ color: 0xe8e8e0 }), { seg: 10 }); cyl(11.4, 2.02, 0.2, 0.025, 0.025, 0.05, ps1Mat({ color: 0x2050a0 }), { seg: 8 });
  cyl(11.7, 1.85, 0.2, 0.08, 0.08, 0.26, ps1Mat({ color: 0x2050a0 }), { seg: 10 });
  prop(12.05, 1.8, 0.2, 0.2, 0.16, 0.12, ps1Mat({ color: 0x30a030 }));
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
  prop(0, 2.05, 0, 0.5, 0.3, 0.5, M.metal, { parent: fur }); // the draft hood
  // the round flue pipe up into the ceiling, with a band clamp over the cracked joint
  cyl(0, 2.45, 0, 0.11, 0.11, 0.55, M.metal, { parent: fur, seg: 10 });
  tor(0, 2.35, 0, 0.115, 0.018, ps1Mat({ color: 0x6a3a18 }), { parent: fur, rx: Math.PI / 2, seg: 10, tube: 4 });
  refs.flueCrack = new THREE.Vector3(7.6, BASE_Y + 2.35, -1.85);
  cyl(0.3, 2.66, 0, 0.09, 0.09, 0.6, M.metal, { parent: fur, rz: Math.PI / 2, seg: 10 });
  // the gas line with a red valve handle, the pilot's little window, riveted panel seams
  cyl(-0.75, 0.6, 0.2, 0.025, 0.025, 1.2, ps1Mat({ color: 0x2a2a2a }), { parent: fur, seg: 6 }); cyl(-0.7, 0.3, 0.2, 0.025, 0.025, 0.12, ps1Mat({ color: 0x2a2a2a }), { parent: fur, rz: Math.PI / 2, seg: 6 });
  prop(-0.75, 0.75, 0.24, 0.12, 0.025, 0.03, ps1Mat({ color: 0xc02020 }), { parent: fur });
  prop(0.35, 0.95, 0.56, 0.1, 0.06, 0.01, ps1Mat({ color: 0x3060ff, unlit: true }), { parent: fur, noBevel: true });
  for (const y of [0.3, 1.2, 1.7]) prop(0, y, 0.556, 1.28, 0.012, 0.005, ps1Mat({ color: 0x2a2a28 }), { parent: fur, noBevel: true });
  // ducts snaking along the ceiling (the "arms")
  prop(10.0, -0.55, -1.85, 4.8, 0.3, 0.45, M.metal);
  prop(8.4, -0.55, 0.8, 0.45, 0.3, 5.0, M.metal);
  colliders.push({ minX: 6.9, maxX: 8.3, minZ: -2.45, maxZ: -1.25, minY: BASE_Y, maxY: -0.5 });
  refs.furnace = fur;
  spots.furnace = new THREE.Vector3(7.6, BASE_Y, -1.1);
  // the water heater: a tall white cylinder, pipes out of the top, a gas valve
  cyl(6.55, BASE_Y + 0.75, -3.3, 0.3, 0.3, 1.5, M.enamel, { solid: true, seg: 14 });
  cyl(6.55, BASE_Y + 1.52, -3.3, 0.28, 0.3, 0.04, ps1Mat({ color: 0xa8a49c }), { seg: 14 });
  for (const dx of [-0.12, 0.12]) cyl(6.55 + dx, BASE_Y + 1.95, -3.3, 0.025, 0.025, 0.8, ps1Mat({ color: 0xa86a30 }), { seg: 6 });
  prop(6.55, BASE_Y + 0.35, -2.99, 0.12, 0.08, 0.04, ps1Mat({ color: 0x2a2a2a })); prop(6.55, BASE_Y + 0.35, -2.96, 0.04, 0.04, 0.03, ps1Mat({ color: 0xc02020 }));
  // the workbench: a thick top, legs, a vise on one end; a pegboard of tools; a coffee can of nails
  prop(10.5, BASE_Y + 0.85, -3.7, 2.4, 0.08, 0.6, M.wood);
  for (const x of [9.4, 11.6]) for (const z of [-3.9, -3.5]) cyl(x, BASE_Y + 0.42, z, 0.04, 0.04, 0.84, M.wood, { seg: 6 });
  colliders.push({ minX: 9.3, maxX: 11.7, minZ: -4.0, maxZ: -3.4, minY: BASE_Y, maxY: BASE_Y + 0.89 });
  prop(10.5, BASE_Y + 0.25, -3.7, 2.2, 0.03, 0.5, M.wood);
  prop(11.55, BASE_Y + 0.95, -3.45, 0.18, 0.12, 0.14, ps1Mat({ color: 0x2a4a6a })); cyl(11.55, BASE_Y + 0.95, -3.33, 0.012, 0.012, 0.2, M.metal, { rx: Math.PI / 2, seg: 6 });
  prop(10.5, BASE_Y + 1.6, -3.95, 2.4, 1.0, 0.03, ps1Mat({ color: 0x8a7a58 }));
  const steel = ps1Mat({ color: 0x8a8a88 }), handleM = ps1Mat({ color: 0x8a4a20 });
  { const g = new THREE.Group(); g.position.set(9.7, BASE_Y + 1.6, -3.92); scene.add(g); prop(0, 0, 0, 0.03, 0.3, 0.025, handleM, { parent: g }); prop(0, 0.16, 0, 0.12, 0.04, 0.035, steel, { parent: g }); }   // hammer
  { const g = new THREE.Group(); g.position.set(10.05, BASE_Y + 1.6, -3.92); g.rotation.z = 0.2; scene.add(g); prop(0, 0, 0, 0.025, 0.28, 0.012, steel, { parent: g }); tor(0, 0.16, 0, 0.03, 0.01, steel, { parent: g, arc: 4.5, seg: 8, tube: 3 }); } // wrench
  { const g = new THREE.Group(); g.position.set(10.6, BASE_Y + 1.6, -3.925); scene.add(g); prop(0, -0.05, 0, 0.12, 0.4, 0.005, steel, { parent: g, noBevel: true }); prop(0, 0.19, 0, 0.1, 0.1, 0.03, handleM, { parent: g }); } // saw
  { const g = new THREE.Group(); g.position.set(11.1, BASE_Y + 1.6, -3.92); scene.add(g); cyl(0, 0.08, 0, 0.02, 0.02, 0.12, ps1Mat({ color: 0xd0a020 }), { parent: g, seg: 6 }); cyl(0, -0.06, 0, 0.005, 0.005, 0.18, steel, { parent: g, seg: 4 }); } // screwdriver
  cyl(9.8, BASE_Y + 0.95, -3.75, 0.06, 0.06, 0.13, ps1Mat({ color: 0x2a5a2a }), { seg: 10 });
  // shelves with jars of preserves: boards, and round jars with lids
  const shelfB = ps1Mat({ map: T.wood, color: 0x8a6a48 });
  for (let i = 0; i < 5; i++) prop(6.3, BASE_Y + 0.05 + i * 0.45, 0.5, 0.4, 0.03, 1.6, shelfB, { noBevel: true });
  for (const z of [-0.29, 1.29]) prop(6.3, BASE_Y + 1.0, z, 0.4, 2.0, 0.03, shelfB, { noBevel: true });
  colliders.push({ minX: 6.1, maxX: 6.5, minZ: -0.3, maxZ: 1.3, minY: BASE_Y, maxY: BASE_Y + 2 });
  { const fill = [0xa02a1a, 0xd0a020, 0x5a7a2a, 0x8a2a4a, 0xc86a20];
    for (let r = 0; r < 4; r++) for (let k = 0; k < 7; k++) { const z = -0.15 + k * 0.21, y = BASE_Y + 0.07 + r * 0.45; cyl(6.35, y + 0.08, z, 0.055, 0.055, 0.16, ps1Mat({ color: fill[(r * 3 + k) % 5], emissive: 0x080402 }), { seg: 8 }); cyl(6.35, y + 0.17, z, 0.058, 0.058, 0.02, ps1Mat({ color: 0xc8b040 }), { seg: 8 }); } }
  // the chest freezer: the lid seam and its handle
  prop(9.5, BASE_Y + 0.45, 2.9, 1.4, 0.9, 0.7, M.enamel, { solid: true });
  prop(9.5, BASE_Y + 0.78, 2.548, 1.38, 0.012, 0.01, ps1Mat({ color: 0x5a5a58 }), { noBevel: true });
  prop(9.5, BASE_Y + 0.75, 2.53, 0.3, 0.04, 0.03, ps1Mat({ color: 0x8a8a84 }));
  // Christmas boxes, taped shut
  prop(7.2, BASE_Y + 0.25, 2.8, 0.7, 0.5, 0.5, M.card, { solid: true });
  prop(7.25, BASE_Y + 0.7, 2.8, 0.6, 0.4, 0.45, M.card);
  for (const [y, w] of [[BASE_Y + 0.505, 0.7], [BASE_Y + 0.905, 0.6]]) prop(7.22, y, 2.8, w + 0.01, 0.006, 0.07, ps1Mat({ color: 0xa08050 }), { noBevel: true });
  // Danny's boxes, one open
  const dbox = ps1Mat({ map: T.boxDanny });
  prop(13.3, BASE_Y + 0.3, -3.3, 0.7, 0.6, 0.6, [M.card, M.card, M.card, M.card, dbox, M.card], { solid: true });
  prop(13.3, BASE_Y + 0.85, -3.35, 0.6, 0.5, 0.5, [M.card, M.card, M.card, M.card, dbox, M.card]);
  prop(12.4, BASE_Y + 0.25, -3.4, 0.6, 0.5, 0.5, [M.card, M.card, M.card, M.card, dbox, M.card], { solid: true });
  prop(12.4, BASE_Y + 0.52, -3.12, 0.6, 0.02, 0.25, M.card, { rx: -0.9, noBevel: true }); // open flaps
  prop(12.4, BASE_Y + 0.52, -3.68, 0.6, 0.02, 0.25, M.card, { rx: 0.9, noBevel: true });
  for (const [x, y, w] of [[13.3, BASE_Y + 0.605, 0.7], [13.3, BASE_Y + 1.105, 0.6]]) prop(x, y, -3.32, w + 0.01, 0.006, 0.07, ps1Mat({ color: 0xa08050 }), { noBevel: true });
  // Danny's bicycle leaning
  const bike = new THREE.Group(); bike.position.set(11.0, BASE_Y, -3.1); bike.rotation.z = 0.08; scene.add(bike);
  const tyre = ps1Mat({ color: 0x111111 }), frameM = ps1Mat({ color: 0x2050c0, emissive: 0x020610 }), spoke = ps1Mat({ color: 0x9a9a9a });
  for (const wx of [-0.5, 0.5]) {
    tor(wx, 0.33, 0, 0.3, 0.025, tyre, { parent: bike, seg: 16, tube: 4 });
    for (let k = 0; k < 6; k++) prop(wx, 0.33, 0, 0.005, 0.58, 0.005, spoke, { parent: bike, rz: k * Math.PI / 6, noBevel: true });
    cyl(wx, 0.33, 0, 0.03, 0.03, 0.05, spoke, { parent: bike, rx: Math.PI / 2, seg: 6 });
  }
  const tube = (x0, y0, x1, y1) => { const L = Math.hypot(x1 - x0, y1 - y0); cyl((x0 + x1) / 2, (y0 + y1) / 2, 0, 0.018, 0.018, L, frameM, { parent: bike, rz: -Math.atan2(x1 - x0, y1 - y0), seg: 6 }); };
  tube(-0.5, 0.33, -0.05, 0.33); tube(-0.05, 0.33, -0.15, 0.75); tube(-0.15, 0.72, 0.38, 0.72); tube(-0.05, 0.33, 0.38, 0.72); tube(0.5, 0.33, 0.38, 0.85); tube(-0.5, 0.33, -0.15, 0.72);
  prop(-0.17, 0.79, 0, 0.18, 0.04, 0.08, M.black, { parent: bike }); // the seat
  cyl(0.38, 0.88, 0, 0.015, 0.015, 0.42, spoke, { parent: bike, rx: Math.PI / 2, seg: 6 }); for (const sz of [-0.21, 0.21]) cyl(0.38, 0.88, sz, 0.022, 0.022, 0.08, M.black, { parent: bike, rx: Math.PI / 2, seg: 6 }); // handlebars
  colliders.push({ minX: 10.3, maxX: 11.7, minZ: -3.3, maxZ: -2.9, minY: BASE_Y, maxY: BASE_Y + 1 });
  // hockey stick
  { const g = new THREE.Group(); g.position.set(13.82, BASE_Y, -2.4); g.rotation.z = 0.1; scene.add(g);
    prop(0, 0.68, 0, 0.035, 1.25, 0.025, M.woodL, { parent: g }); prop(0, 1.2, 0, 0.04, 0.2, 0.03, M.black, { parent: g });
    prop(-0.01, 0.04, 0.1, 0.04, 0.07, 0.26, M.woodL, { parent: g, rx: 0.1 }); prop(-0.01, 0.04, 0.1, 0.045, 0.03, 0.2, M.black, { parent: g }); }
  spots.dannyBoxes = new THREE.Vector3(12.4, BASE_Y, -2.7);
  // pull-string bulb
  prop(10.0, -0.45, -1.2, 0.01, 0.3, 0.01, M.black);

  // ======================================================================
  // ITEMS
  // Danny's jacket, folded: the body, a collar, both sleeves folded across, the zip
  const jacketMesh = new THREE.Group();
  const jm = ps1Mat({ map: T.jacket });
  prop(0, 0, 0, 0.42, 0.06, 0.34, jm, { parent: jacketMesh });
  prop(0, 0.03, -0.15, 0.3, 0.05, 0.08, jm, { parent: jacketMesh });
  for (const sx of [-1, 1]) cyl(sx * 0.1, 0.045, 0.02, 0.045, 0.04, 0.3, jm, { parent: jacketMesh, rz: Math.PI / 2, ry: sx * 0.35, seg: 8 });
  prop(0, 0.032, 0.06, 0.012, 0.004, 0.24, ps1Mat({ color: 0xc8c0a0 }), { parent: jacketMesh, noBevel: true });
  jacketMesh.position.set(12.4, BASE_Y + 0.53, -3.4);
  jacketMesh.rotation.y = 0.3;
  scene.add(jacketMesh);
  addItem('jacket', "Danny's jacket", jacketMesh, { scent: 'danny' });

  // his tennis ball: fuzzy yellow-green, with the two curving white seams
  const ball = new THREE.Group(); ball.position.set(2.3, 0.05, 7.4); scene.add(ball);
  sph(0, 0, 0, 0.05, ps1Mat({ color: 0xc8e040, emissive: 0x141a04 }), { parent: ball, detail: 2 });
  const seam = ps1Mat({ color: 0xf0f0e8, emissive: 0x202020 });
  // the real seam: one continuous curve that wraps the ball like a baseball's
  { class Seam extends THREE.Curve { getPoint(t, out = new THREE.Vector3()) { const a = t * Math.PI * 2, A = 0.75, B = 0.25, C = 2 * Math.sqrt(A * B);
      out.set(A * Math.cos(a) + B * Math.cos(3 * a), A * Math.sin(a) - B * Math.sin(3 * a), C * Math.sin(2 * a)).normalize().multiplyScalar(0.0505); return out; } }
    ball.add(new THREE.Mesh(new THREE.TubeGeometry(new Seam(), 48, 0.0035, 3, true), seam)); }
  addItem('ball', 'tennis ball', ball, { scent: 'dannyFaint' });
  // your leash: coiled up, the handle loop, the clasp
  const leash = new THREE.Group(); const lm = ps1Mat({ color: 0xa02020 });
  for (let i = 0; i < 3; i++) tor(0, 0.008 + i * 0.008, 0, 0.09 - i * 0.012, 0.008, lm, { parent: leash, rx: Math.PI / 2, seg: 12, tube: 3 });
  tor(0.15, 0.008, 0, 0.05, 0.008, lm, { parent: leash, rx: Math.PI / 2, seg: 10, tube: 3 });
  prop(-0.12, 0.01, 0.04, 0.05, 0.02, 0.025, M.metal, { parent: leash }); tor(-0.15, 0.01, 0.04, 0.015, 0.004, M.metal, { parent: leash, rx: Math.PI / 2, seg: 8, tube: 3 });
  leash.position.set(0.35, 0.03, 9.3); leash.rotation.y = 0.6; scene.add(leash);
  addItem('leash', 'leash', leash);
  // a 9-volt battery: black and gold, with its two snap terminals
  const battery = new THREE.Group(); battery.position.set(10.55, 0.025, 5.35); battery.rotation.y = 0.7; scene.add(battery);
  prop(0, 0, 0, 0.05, 0.04, 0.085, ps1Mat({ color: 0x1a1a1a }), { parent: battery });
  prop(0, 0, 0.012, 0.052, 0.042, 0.03, ps1Mat({ color: 0xc8a020, emissive: 0x181000 }), { parent: battery, noBevel: true });
  cyl(-0.012, 0.0, -0.05, 0.008, 0.008, 0.012, M.metal, { parent: battery, rx: Math.PI / 2, seg: 6 });
  cyl(0.012, 0.0, -0.05, 0.009, 0.009, 0.012, M.metal, { parent: battery, rx: Math.PI / 2, seg: 6 });
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
/** the highest surface under (x, z) that you could be standing on from height y.
 *  Besides the soft things listed above, the top of anything solid and low enough to jump
 *  onto counts: the stool, the washer, boxes, the freezer, nightstands, the hall table... */
const anySurf = { name: 'something' };
/** something you could land on near (x, z), coming down from height y: its top and edges */
export function landingNear(x, z, y, m) {
  let best = null;
  const consider = (x0, x1, z0, z1, top, name) => {
    if (top > y + 0.02 || top < y - 0.9) return;
    if (x < x0 - m || x > x1 + m || z < z0 - m || z > z1 + m) return;
    if (!best || top > best.top) best = { x0, x1, z0, z1, top, name };
  };
  for (const s of SURFACES) consider(s.x0, s.x1, s.z0, s.z1, s.top, s.name);
  for (const c of colliders) {
    if (c.disabled || c.seg || c.tag === 'wall' || c.door) continue;
    const ground = c.minY < -1.4 ? BASE_Y : 0;
    if (c.maxY - ground < 0.08 || c.maxY - ground > 1.0 || c.maxX - c.minX < 0.22 || c.maxZ - c.minZ < 0.22) continue;
    consider(c.minX, c.maxX, c.minZ, c.maxZ, c.maxY, c.tag === 'stool' ? 'the stool' : 'something');
  }
  return best;
}
export function surfaceAt(x, z, y) {
  let best = null;
  for (const s of SURFACES) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1 && y >= s.top - 0.14 && (!best || s.top > best.top)) best = s;
  for (const c of colliders) {
    if (c.disabled || c.seg || c.tag === 'wall' || c.door) continue;
    const top = c.maxY, base = c.minY;
    const ground = base < -1.4 ? BASE_Y : 0;
    if (top - ground < 0.08 || top - ground > 1.0 || c.maxX - c.minX < 0.22 || c.maxZ - c.minZ < 0.22) continue;
    if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ && y >= top - 0.14 && (!best || top > best.top)) {
      best = Object.assign(anySurf, { top, name: c.tag === 'stool' ? 'the stool' : 'something' });
    }
  }
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
