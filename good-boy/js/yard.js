// Out back: the yard behind the farmhouse, reached through Biscuit's flap in the back door.
// Snow, the old oak with Danny's tire swing, the doghouse he built, the woodpile, the field
// gate, and the furnace's exhaust pipe drowning under a drift.
import * as THREE from '../vendor/three.module.js';
import { ps1Mat } from './ps1.js';
import { T } from './textures.js';
import { box, prop, colliders, refs, spots, light, lights, addItem, H } from './house.js';

export const yard = { digSpots: [], holes: [] };

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace;
  return t;
}
const solid = (x0, z0, x1, z1, y1 = 2, tag) => colliders.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: -0.5, maxY: y1, tag });

// a lumpy, faceted snow mound
function mound(scene, x, z, rx, ry, rz, mat, seed = 1) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const n = 1 + 0.12 * Math.sin(p.getX(i) * 5.1 + seed) * Math.cos(p.getZ(i) * 4.3 + seed * 2);
    p.setXYZ(i, p.getX(i) * n, Math.max(-0.15, y) * n, p.getZ(i) * n);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, 0, z); m.scale.set(rx, ry, rz);
  scene.add(m);
  return m;
}

export function buildYard(scene, M) {
  const snow = ps1Mat({ map: T.snowGround, emissive: 0x161a24 });
  const drift = ps1Mat({ map: T.drift, emissive: 0x1a1e2a });
  const fence = ps1Mat({ map: T.fence });
  const bark = ps1Mat({ map: T.bark });
  const dark = ps1Mat({ color: 0x0a0908 });

  // ---- the ground out back ----------------------------------------------------
  box(14.06, -0.3, -9.5, 46, 0.0, 14, snow, { uvScale: 2.2 });
  box(-6, -0.3, -9, 14.06, -0.01, -0.06, snow, { uvScale: 2.2 }); // behind the bedrooms

  // ---- a roof, so the house looks like a house from outside --------------------
  const roofM = ps1Mat({ map: T.drift, color: 0xb8c0d0, emissive: 0x101420 });
  const slope = Math.atan2(2.0, 5.4), len = Math.hypot(5.4, 2.0);
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(14.8, 0.12, len, 6, 1, 3), roofM);
    r.position.set(7, H + 0.15 + 1.0, 5 + s * 2.65);
    r.rotation.x = s * slope;
    scene.add(r);
  }
  // gable ends
  const gable = new THREE.Shape(); gable.moveTo(-5.2, 0); gable.lineTo(5.2, 0); gable.lineTo(0, 2.05); gable.lineTo(-5.2, 0);
  for (const gx of [0, 14]) {
    const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable), ps1Mat({ map: T.exterior, side: THREE.DoubleSide }));
    gm.position.set(gx, H + 0.15, 5); gm.rotation.y = Math.PI / 2;
    scene.add(gm);
  }
  // chimney with the furnace flue
  prop(9.2, H + 2.1, 3.0, 0.6, 2.2, 0.6, M.cinder);

  // ---- the back door with Biscuit's flap ---------------------------------------
  const doorM = ps1Mat({ map: T.door });
  // the door itself never opens tonight: only the flap at the bottom does
  prop(14.0, 1.02, 3.875, 0.06, 2.04, 0.25, doorM); solid(13.95, 3.75, 14.05, 4.0, 2.1);
  prop(14.0, 1.02, 4.625, 0.06, 2.04, 0.25, doorM); solid(13.95, 4.5, 14.05, 4.75, 2.1);
  prop(14.0, 1.3, 4.25, 0.06, 1.5, 0.5, doorM); colliders.push({ minX: 13.95, maxX: 14.05, minZ: 4.0, maxZ: 4.5, minY: 0.56, maxY: 2.1 });
  prop(14.0, 0.53, 4.25, 0.07, 0.04, 0.52, ps1Mat({ color: 0x2a2a2a })); // flap frame
  prop(14.0, 1.0, 4.62, 0.09, 0.05, 0.1, ps1Mat({ color: 0xb09040 })); // a knob nobody turns
  prop(13.96, 1.7, 4.25, 0.02, 0.36, 0.3, ps1Mat({ color: 0x8a9aa8, unlit: true })); // a little window, snowed over
  const flap = new THREE.Group(); flap.position.set(14.0, 0.52, 4.25); scene.add(flap);
  prop(0, -0.25, 0, 0.012, 0.5, 0.46, ps1Mat({ color: 0x6a6e78, emissive: 0x262c3a }), { parent: flap }); // snow-light through the plastic
  refs.flap = flap;
  // the storm cover: a panel that slides into the flap's frame from inside
  const cover = new THREE.Group(); cover.position.set(13.9, 0.27, 4.25); scene.add(cover);
  prop(0, 0, 0, 0.025, 0.5, 0.5, ps1Mat({ color: 0x8a7a5a }), { parent: cover });
  prop(-0.03, 0.18, 0, 0.04, 0.05, 0.12, ps1Mat({ color: 0x6a2a1a }), { parent: cover }); // a strap to pull it by
  refs.flapCover = cover;
  refs.flapCoverCol = { minX: 13.86, maxX: 13.94, minZ: 3.98, maxZ: 4.52, minY: 0, maxY: 0.55 };
  colliders.push(refs.flapCoverCol);
  spots.flapIn = new THREE.Vector3(13.55, 0, 4.25);
  spots.flapOut = new THREE.Vector3(14.5, 0, 4.25);
  // back step and porch light
  prop(14.45, 0.02, 4.25, 0.8, 0.04, 1.3, M.concrete);
  prop(14.12, 2.3, 4.25, 0.1, 0.12, 0.1, ps1Mat({ color: 0x2a2a2a }));
  light(10, 'porch', [14.35, 2.2, 4.25], 0xffc878, 7.5, [14.0, -0.5, -8, 30, 5, 14], { bulb: true, flicker: 0.12 });
  // cold moonlight over the yard and the field
  light(11, 'moon', [21, 14, -6], 0x46546e, 34, [14.0, -0.5, -10, 40, 8, 16]);

  // ---- fence, field gate -------------------------------------------------------
  const rails = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
    for (const y of [0.55, 1.05]) { const r = prop((x0 + x1) / 2, y, (z0 + z1) / 2, 0.05, 0.1, L, fence); r.rotation.y = ang; }
    const n = Math.max(1, Math.round(L / 2));
    for (let i = 0; i <= n; i++) { const f = i / n; prop(x0 + (x1 - x0) * f, 0.65, z0 + (z1 - z0) * f, 0.12, 1.3, 0.12, fence); }
    solid(Math.min(x0, x1) - 0.08, Math.min(z0, z1) - 0.08, Math.max(x0, x1) + 0.08, Math.max(z0, z1) + 0.08, 1.4);
  };
  rails(14.06, -6, 28, -6);
  rails(28, -6, 28, 3.35);
  rails(28, 4.65, 28, 13);
  rails(28, 13, 14.06, 13);
  rails(14.12, -6, 14.12, -0.06);
  rails(14.12, 10.06, 14.12, 13);
  // the gate: latched with a loop of chain. It was open, that night.
  const gate = new THREE.Group(); gate.position.set(28, 0, 3.35); scene.add(gate);
  for (const y of [0.4, 0.8, 1.2]) prop(0, y, 0.65, 0.05, 0.1, 1.3, fence, { parent: gate });
  prop(0, 0.8, 0.65, 0.05, 0.1, 1.5, fence, { parent: gate, rx: 0.65 });
  prop(0, 0.9, 1.27, 0.09, 0.14, 0.09, ps1Mat({ color: 0x5a5a5a }), { parent: gate });
  refs.gateCol = { minX: 27.9, maxX: 28.1, minZ: 3.3, maxZ: 4.7, minY: -0.5, maxY: 1.4, tag: 'gate' }; colliders.push(refs.gateCol);
  spots.gate = new THREE.Vector3(27.45, 0, 4.0);

  // ---- beyond the fence: the field running down toward the pond ---------------
  const pine = ps1Mat({ color: 0x0c1410, emissive: 0x020403 });
  const snowCap = ps1Mat({ map: T.drift, emissive: 0x141824 });
  const tree = (x, z, h, isSolid = false) => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(h * 0.28, h, 6, 1), pine); c.position.set(x, h / 2, z); scene.add(c);
    if (isSolid) solid(x - 0.35, z - 0.35, x + 0.35, z + 0.35, 3);
    const s = new THREE.Mesh(new THREE.ConeGeometry(h * 0.16, h * 0.3, 6, 1), snowCap); s.position.set(x, h * 0.86, z); scene.add(s);
  };
  for (let i = 0; i < 26; i++) {
    const z = -9 + i * 1.0 + Math.sin(i * 3.7) * 0.6;
    if (z > 1.6 && z < 6.4) continue; // the gap the path runs through, down to the pond
    tree(31 + Math.sin(i * 1.9) * 1.4, z, 3.2 + (i * 37 % 10) * 0.25, true);
  }
  for (let i = 0; i < 12; i++) { const z = -8 + i * 1.8; if (z > -1 && z < 7) continue; tree(36 + Math.sin(i * 2.3) * 2, z, 4 + (i * 13 % 7) * 0.4, true); }
  // the edge of the world, past the pond
  solid(28.1, -9.2, 44, -8.9, 3); solid(28.1, 13.4, 44, 13.7, 3); solid(43.6, -9.2, 44, 13.7, 3);
  for (let i = 0; i < 14; i++) tree(42.5 + Math.sin(i) * 0.8, -8 + i * 1.6, 4.5 + (i % 4) * 0.5);
  for (let i = 0; i < 14; i++) tree(15 + i * 1.1, -8.2 - Math.sin(i * 1.3) * 0.8, 3.5 + (i * 17 % 6) * 0.3);
  // the dead tree at the pond, far off: you can only see it in the lightning
  const dead = new THREE.Group(); dead.position.set(40.6, 0, 0.6); scene.add(dead);
  prop(0, 1.6, 0, 0.2, 3.2, 0.2, dark, { parent: dead });
  prop(0.5, 2.6, 0, 1.1, 0.08, 0.08, dark, { parent: dead, rz: 0.6 });
  prop(-0.4, 2.2, 0, 0.9, 0.07, 0.07, dark, { parent: dead, rz: -0.7 });
  // the pond: frozen over, except where it isn't
  const ice = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.02, 14), ps1Mat({ color: 0x8aa0b8, emissive: 0x1a2430 }));
  ice.position.set(38.0, 0.01, 3.2); scene.add(ice);
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.6, 0.025, 9), ps1Mat({ color: 0x05080c }));
  hole.position.set(38.6, 0.02, 3.6); scene.add(hole);
  for (let i = 0; i < 6; i++) { const a = i * 0.7 + 0.3; prop(38.6 + Math.cos(a) * 0.85, 0.022, 3.6 + Math.sin(a) * 0.85, 0.3, 0.012, 0.08, ps1Mat({ color: 0xc8d4e0 }), { ry: a }); } // broken edges
  solid(37.85, 2.85, 39.35, 4.35, 2, 'hole'); // you will not go near it
  for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2; prop(38.0 + Math.cos(a) * 3.55, 0.3, 3.2 + Math.sin(a) * 3.55, 0.03, 0.6, 0.03, ps1Mat({ color: 0x5a5030 }), { rz: Math.sin(i) * 0.2 }); } // reeds
  spots.pond = new THREE.Vector3(35.2, 0, 3.4);
  // a deer, standing in the field, watching. Most of the time it is not there.
  const deer = new THREE.Group(); deer.position.set(31.2, 0, -1.2); deer.rotation.y = -Math.PI / 2 + 0.3; scene.add(deer);
  const dm = ps1Mat({ color: 0x2a1c14, emissive: 0x050302 });
  prop(0, 1.0, 0, 0.32, 0.35, 0.95, dm, { parent: deer });
  for (const [x, z] of [[-0.1, -0.35], [0.1, -0.35], [-0.1, 0.35], [0.1, 0.35]]) prop(x, 0.42, z, 0.06, 0.84, 0.06, dm, { parent: deer });
  prop(0, 1.35, -0.55, 0.12, 0.42, 0.14, dm, { parent: deer, rx: 0.35 });
  prop(0, 1.58, -0.7, 0.16, 0.16, 0.26, dm, { parent: deer });
  for (const s of [-1, 1]) prop(s * 0.1, 1.74, -0.64, 0.04, 0.12, 0.03, dm, { parent: deer, rz: s * 0.5 });
  const eyeM = ps1Mat({ color: 0xd8f0c0, unlit: true, unique: true });
  for (const s of [-1, 1]) prop(s * 0.075, 1.62, -0.8, 0.025, 0.02, 0.01, eyeM, { parent: deer });
  deer.visible = false;
  refs.deer = deer;
  // something taller than a man, standing at the treeline. Only the lightning shows it.
  const fig = new THREE.Group(); scene.add(fig);
  const blk = ps1Mat({ color: 0x020202 });
  prop(0, 1.55, 0, 0.34, 1.5, 0.2, blk, { parent: fig });
  prop(0, 2.45, 0, 0.1, 0.3, 0.1, blk, { parent: fig });
  for (const sx of [-1, 1]) { prop(sx * 0.24, 1.3, 0, 0.07, 1.6, 0.07, blk, { parent: fig, rz: sx * 0.06 }); prop(sx * 0.1, 0.4, 0, 0.09, 0.8, 0.09, blk, { parent: fig }); }
  prop(0, 2.72, 0.03, 0.2, 0.3, 0.16, ps1Mat({ color: 0x8a8a84, unlit: true }), { parent: fig });
  for (const sx of [-1, 1]) prop(sx * 0.05, 2.76, 0.115, 0.045, 0.06, 0.01, blk, { parent: fig });
  prop(0, 2.63, 0.115, 0.05, 0.07, 0.01, blk, { parent: fig });
  fig.visible = false;
  refs.yardFigure = fig;

  // ---- the old oak, Danny's tire swing, and what you buried under it ------------
  const oak = new THREE.Group(); oak.position.set(22.8, 0, 8.7); scene.add(oak);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 3.6, 7, 3), bark); trunk.position.y = 1.8; oak.add(trunk);
  const limb = (x, y, z, l, rz, ry) => { const m = new THREE.Mesh(new THREE.BoxGeometry(l, 0.16, 0.16), bark); m.position.set(x, y, z); m.rotation.set(0, ry, rz); oak.add(m); const s = new THREE.Mesh(new THREE.BoxGeometry(l * 0.9, 0.05, 0.14), snowCap); s.position.set(x, y + 0.1, z); s.rotation.set(0, ry, rz); oak.add(s); };
  limb(-1.1, 3.0, 0, 2.4, 0.18, 0); limb(1.0, 3.3, 0.3, 2.0, -0.35, 0.4); limb(0.2, 3.5, -0.9, 1.8, 0.4, 1.5); limb(-0.4, 3.7, 0.8, 1.6, -0.5, -1.2);
  solid(22.4, 8.3, 23.2, 9.1, 3);
  // the tire swing, frozen stiff on its rope
  prop(21.75, 2.0, 8.7, 0.02, 1.95, 0.02, ps1Mat({ color: 0x8a7a5a }));
  const tire = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 4, 8), ps1Mat({ color: 0x161616 }));
  tire.position.set(21.75, 0.85, 8.7); tire.rotation.y = 0.4; scene.add(tire); refs.tire = tire;
  const tcap = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 3, 8, Math.PI), snowCap); tcap.position.set(21.75, 0.92, 8.7); tcap.rotation.y = 0.4; scene.add(tcap);
  // initials carved in the bark
  const carve = canvasTex(32, 16, (g) => { g.fillStyle = '#2a2420'; g.fillRect(0, 0, 32, 16); g.fillStyle = '#7a6a50'; g.font = 'bold 8px monospace'; g.fillText('D.H.', 3, 8); g.fillText('+B', 9, 15); });
  prop(22.8, 1.05, 8.33, 0.3, 0.16, 0.01, ps1Mat({ map: carve }), { ry: 0 });

  // ---- the doghouse Danny built you ----------------------------------------------
  const dh = new THREE.Group(); dh.position.set(17.6, 0, -2.6); dh.rotation.y = 0.25; scene.add(dh);
  const plank = ps1Mat({ map: T.planks, color: 0xa08060 });
  prop(0, 0.42, 0, 1.0, 0.84, 1.15, plank, { parent: dh, planar: false });
  for (const s of [-1, 1]) prop(s * 0.3, 1.05, 0, 0.72, 0.06, 1.3, roofM, { parent: dh, rz: s * -0.72 });
  prop(0, 0.3, 0.58, 0.42, 0.55, 0.01, dark, { parent: dh });
  const sign = canvasTex(48, 12, (g) => { g.fillStyle = '#6a4a2a'; g.fillRect(0, 0, 48, 12); g.fillStyle = '#e0c040'; g.font = 'bold 9px monospace'; g.fillText('BISCUIT', 4, 10); });
  prop(0, 0.72, 0.59, 0.5, 0.12, 0.01, ps1Mat({ map: sign }), { parent: dh });
  solid(16.95, -3.3, 18.25, -1.9, 1.3);
  spots.doghouse = new THREE.Vector3(17.75, 0, -1.55);

  // ---- woodpile, the shed, the clothesline with a sheet frozen on it -------------
  for (let i = 0; i < 4; i++) prop(21.2, 0.15 + i * 0.25, -5.4, 2.2 - i * 0.2, 0.24, 0.6, ps1Mat({ map: T.wood }), { planar: true });
  prop(21.2, 1.12, -5.4, 2.0, 0.08, 0.66, snowCap);
  solid(20.0, -5.8, 22.4, -5.0, 1.2);
  prop(22.6, 0.45, -5.0, 0.04, 0.6, 0.04, M.woodL, { rz: 0.4 }); prop(22.75, 0.72, -5.0, 0.04, 0.16, 0.14, M.metal); // an axe in the block
  prop(22.6, 0.18, -5.0, 0.36, 0.36, 0.36, ps1Mat({ map: T.wood }));
  const shed = ps1Mat({ map: T.exterior, color: 0x8a6050 });
  prop(25.6, 1.1, -4.4, 2.4, 2.2, 2.0, shed, { planar: true });
  prop(25.6, 2.3, -4.4, 2.6, 0.12, 2.2, roofM);
  prop(25.6, 0.95, -3.39, 0.8, 1.9, 0.02, ps1Mat({ map: T.door, color: 0x9a8070 }));
  solid(24.4, -5.4, 26.8, -3.4, 2.3);
  for (const x of [17.6, 21.6]) { prop(x, 1.0, 1.0, 0.07, 2.0, 0.07, M.woodL); prop(x, 1.95, 1.0, 0.07, 0.07, 0.7, M.woodL); solid(x - 0.06, 0.94, x + 0.06, 1.06, 2); }
  prop(19.6, 1.88, 1.0, 4.0, 0.01, 0.01, ps1Mat({ color: 0xaaaaaa }));
  const sheet = prop(19.0, 1.25, 1.0, 1.4, 1.25, 0.02, ps1Mat({ color: 0xc8ccd4, emissive: 0x141418, side: THREE.DoubleSide }), { seg: 3 });
  refs.sheet = sheet;
  // Lily's snowman, wearing Danny's hockey scarf
  const sm = new THREE.Group(); sm.position.set(16.4, 0, 7.2); scene.add(sm);
  const ball = (y, r) => { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), drift); b.position.y = y; sm.add(b); };
  ball(0.3, 0.32); ball(0.76, 0.23); ball(1.1, 0.16);
  prop(0, 0.95, 0, 0.36, 0.07, 0.36, ps1Mat({ color: 0x1a3a8a }), { parent: sm });
  prop(0.12, 0.8, 0.14, 0.08, 0.26, 0.04, ps1Mat({ color: 0x1a3a8a }), { parent: sm });
  for (const s of [-1, 1]) prop(s * 0.05, 1.14, 0.15, 0.025, 0.025, 0.02, dark, { parent: sm });
  prop(0, 1.08, 0.18, 0.025, 0.025, 0.08, ps1Mat({ color: 0xc06020 }), { parent: sm });
  solid(16.05, 6.85, 16.75, 7.55, 1.3);
  spots.snowman = new THREE.Vector3(16.4, 0, 7.75);

  // drifts against the house
  for (const [x, z, r] of [[14.4, 6.5, 0.7], [14.35, 8.6, 0.6], [14.3, -0.6, 0.5], [15.0, 12.2, 0.8], [27.4, -5.4, 0.9], [27.4, 12.3, 0.8]]) mound(scene, x, z, r, r * 0.55, r * 1.3, drift, x + z);

  // ---- hoofprints along the fence, where the deer came in close tonight ------------
  const hoof = canvasTex(8, 8, (g) => { g.clearRect(0, 0, 8, 8); g.fillStyle = '#3a404e'; g.fillRect(1, 1, 2, 5); g.fillRect(5, 1, 2, 5); });
  const hoofM = ps1Mat({ map: hoof });
  const DEER = [[27.6, -4.5], [26.4, -3.6], [25.4, -2.5], [24.5, -1.2], [23.8, 0.2], [23.6, 1.4], [24.6, 2.7], [25.9, 3.4], [27.0, 3.8]];
  for (let i = 0; i < DEER.length - 1; i++) {
    const [ax, az] = DEER[i], [bx, bz] = DEER[i + 1];
    const ang = Math.atan2(bx - ax, bz - az);
    for (let k = 0; k < 3; k++) { const f = k / 3; prop(ax + (bx - ax) * f + Math.cos(ang) * (k % 2 ? 0.08 : -0.08), 0.008, az + (bz - az) * f, 0.09, 0.004, 0.09, hoofM, { ry: ang }); }
  }

  // ---- the furnace pipe, and the drift that has buried it -----------------------------
  const pipe = ps1Mat({ map: T.metal });
  prop(14.2, 0.34, 1.6, 0.3, 0.14, 0.14, pipe);
  prop(14.37, 0.34, 1.6, 0.05, 0.2, 0.2, pipe);
  spots.vent = new THREE.Vector3(14.42, 0.34, 1.6);
  const ventDrift = mound(scene, 14.5, 1.6, 0.75, 0.62, 0.95, drift, 3);
  // inside, the pipe runs along the basement ceiling from the furnace to that wall
  prop(13.15, -0.55, -1.85, 1.5, 0.16, 0.16, pipe);
  prop(13.85, -0.42, -0.1, 0.16, 0.16, 3.5, pipe);

  // ---- things buried in the yard -------------------------------------------------
  const dirtM = ps1Mat({ map: T.dirt });
  const spot = (id, x, z, need, o = {}) => {
    const m = o.mound || mound(scene, x, z, o.r ?? 0.42, o.h ?? 0.22, o.r ?? 0.42, drift, x * 3 + z);
    if (o.hidden) m.visible = false; // nothing on top gives it away: you have to smell it
    const s = { id, pos: new THREE.Vector3(x, 0, z), r: o.reach ?? 0.85, need, progress: 0, done: false, mound: m, scent: o.scent, base: m.scale.clone(), dirt: dirtM, ...o };
    yard.digSpots.push(s);
    return s;
  };
  yard.vent = spot('vent', 14.75, 1.6, 4.5, { mound: ventDrift, scent: 'exhaust', reach: 0.95 });
  yard.tin = spot('tin', 22.0, 7.75, 5.5, { scent: 'tin', r: 0.5, h: 0.24, hidden: true, reach: 0.75 });
  yard.bone = spot('bone', 18.6, -3.45, 2.5, { scent: 'bone', r: 0.32, h: 0.16, hidden: true, reach: 0.7 });
  // snow piled against the bottom of the gate: dig under it
  yard.gateDig = spot('gateDig', 27.6, 4.0, 4.0, { scent: 'outside', r: 0.55, h: 0.3, reach: 0.9 });
  yard.mitten = spot('mitten', 34.95, 4.4, 4.0, { scent: 'dannyOld', r: 0.4, h: 0.15, hidden: true, reach: 0.8 });

  // the tin, once it is dug up
  const tinM = canvasTex(32, 16, (g) => { g.fillStyle = '#7a1a1a'; g.fillRect(0, 0, 32, 16); g.fillStyle = '#c8a040'; g.fillRect(0, 0, 32, 2); g.fillRect(0, 14, 32, 2); g.font = 'bold 6px monospace'; g.fillText('DANNY+', 2, 8); g.fillText('BISCUIT', 2, 13); for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(90,50,20,0.7)'; g.fillRect(Math.random() * 32, Math.random() * 16, 2, 1); } });
  const tin = new THREE.Group();
  prop(0, 0, 0, 0.24, 0.09, 0.16, ps1Mat({ map: tinM }), { parent: tin });
  prop(0, 0.05, 0, 0.25, 0.02, 0.17, ps1Mat({ color: 0xa08030 }), { parent: tin });
  tin.position.set(22.0, 0.05, 7.75); scene.add(tin); tin.visible = false;
  yard.tinItem = addItem('tin', "Danny's treasure tin", tin, { scent: 'danny' });
  yard.tinItem.gone = true;
  const bone = new THREE.Group();
  prop(0, 0, 0, 0.2, 0.035, 0.04, ps1Mat({ color: 0xd8cca8 }), { parent: bone });
  for (const s of [-1, 1]) prop(s * 0.1, 0, 0, 0.05, 0.05, 0.07, ps1Mat({ color: 0xd8cca8 }), { parent: bone });
  bone.position.set(18.6, 0.04, -3.45); scene.add(bone); bone.visible = false;
  yard.boneItem = addItem('bone', 'your old bone', bone, { scent: 'bone' });
  yard.boneItem.gone = true;

  const mit = new THREE.Group();
  prop(0, 0, 0, 0.12, 0.03, 0.16, ps1Mat({ color: 0xa02018 }), { parent: mit });
  prop(0.07, 0, -0.03, 0.05, 0.03, 0.07, ps1Mat({ color: 0xa02018 }), { parent: mit, ry: 0.5 });
  prop(0, 0.016, 0.06, 0.12, 0.005, 0.03, ps1Mat({ color: 0xe8e0d0 }), { parent: mit });
  mit.position.set(34.95, 0.03, 4.4); scene.add(mit); mit.visible = false;
  yard.mittenItem = addItem('mitten', "Danny's mitten", mit, { scent: 'danny' });
  yard.mittenItem.gone = true;
  yard.dirtM = dirtM;
  yard.scene = scene;
  lights[10].on = true;
}

/** a scraped patch where you have been digging */
export function digHole(x, z, size = 0.3, deep = false) {
  for (const h of yard.holes) if (Math.hypot(h.position.x - x, h.position.z - z) < size * 0.6) { h.scale.multiplyScalar(1.04); return; }
  const m = new THREE.Mesh(new THREE.CylinderGeometry(size, size * 0.8, 0.01, 7), deep ? yard.dirtM : ps1Mat({ color: 0x5a6478, emissive: 0x0a0c12 }));
  m.position.set(x, 0.006 + yard.holes.length * 0.0004, z);
  m.rotation.y = Math.random() * 3;
  yard.scene.add(m);
  yard.holes.push(m);
}

/** your paw prints, pressed into the snow behind you */
const prints = [];
let printMat = null, printI = 0;
export function pawPrint(x, z, yaw, side) {
  if (!printMat) {
    const c = document.createElement('canvas'); c.width = 8; c.height = 8;
    const g = c.getContext('2d'); g.fillStyle = '#4a5468'; g.fillRect(2, 4, 4, 3); g.fillRect(1, 1, 2, 2); g.fillRect(5, 1, 2, 2); g.fillRect(3, 0, 2, 2);
    const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace;
    printMat = ps1Mat({ map: t });
  }
  let m = prints[printI];
  if (!m) { m = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.08), printMat); m.rotation.order = 'YXZ'; yard.scene.add(m); prints[printI] = m; }
  printI = (printI + 1) % 160;
  m.position.set(x + Math.cos(yaw) * 0.06 * side, 0.007, z - Math.sin(yaw) * 0.06 * side);
  m.rotation.set(-Math.PI / 2, yaw, 0);
}

/** the flap swings away from whichever side you push it from, then slaps shut */
let flapA = 0, flapV = 0, flapWas = 0;
export function updateFlap(dt, dogPos, onSlap) {
  const f = refs.flap;
  if (!f) return;
  const dz = Math.abs(dogPos.z - 4.25), dx = dogPos.x - 14.0;
  let target = 0;
  if (dz < 0.3 && Math.abs(dx) < 0.42 && yard.flapOpen) target = (dx < 0 ? 1 : -1) * Math.min(1.35, (0.42 - Math.abs(dx)) * 4.5);
  if (target !== 0) { flapA += (target - flapA) * Math.min(1, dt * 18); flapV = 0; }
  else { flapV += -flapA * 60 * dt - flapV * 6 * dt; flapA += flapV * dt; }
  if (Math.abs(flapWas) > 0.25 && Math.sign(flapA) !== Math.sign(flapWas) && onSlap) onSlap(Math.min(1, Math.abs(flapV) * 0.15));
  flapWas = flapA;
  f.rotation.z = flapA;
}
