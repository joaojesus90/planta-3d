// 3D view: rooms, walls with openings, doors, windows and furniture.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { T, wallLength, styleById, itemRect, CATALOG } from './model.js';
import { getTex, specMaterial } from './textures.js';
import { buildItem } from './furniture3d.js';

const HT = T / 2;              // each room draws half of the wall thickness
const METALS = {
  chrome: { color: 0xd7dbe0, r: 0.15, m: 0.95 },
  gold:   { color: 0xd9b25f, r: 0.3, m: 1.0 },
  brass:  { color: 0xb08d57, r: 0.45, m: 0.9 },
  black:  { color: 0x262626, r: 0.6, m: 0.3 },
};

const matCache = {};
function styleMats(style) {
  if (matCache[style.id]) return matCache[style.id];
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const m = METALS[style.metal];
  const wood = std({ map: getTex(style.wood), roughness: 0.65 });
  const fabric = new THREE.Color(style.fabric);
  const mats = {
    ceramic: std({ color: 0xfbfbfa, roughness: 0.12 }),
    white: std({ color: 0xffffff, roughness: 0.3 }),
    bedding: std({ color: 0xf5f2eb, roughness: 0.9 }),
    metal: std({ color: m.color, roughness: m.r, metalness: m.m }),
    wood, lacquer: std({ color: style.lacquer, roughness: 0.35 }),
    fabric: std({ color: fabric, roughness: 0.95 }),
    fabric2: std({ color: fabric.clone().multiplyScalar(1.08), roughness: 0.95 }),
    accent: std({ color: style.accent, roughness: 0.8 }),
    rug: std({ color: fabric.clone().lerp(new THREE.Color(0xf2ede4), 0.45), roughness: 1 }),
    dark: std({ color: 0x2b2b2d, roughness: 0.5, metalness: 0.2 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xd6eef7, transparent: true, opacity: 0.22, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }),
    mirror: std({ color: 0xe4edf1, roughness: 0.04, metalness: 0.75 }),
    base: std({ color: style.base, roughness: 0.75 }),
    plate: std({ color: style.plate, roughness: 0.3 }),
    top: specMaterial(style.top, 0.6, 0.6),
    bowl: std({ color: 0xeef0f1, roughness: 0.15 }),
    water: std({ color: 0xdfe9ec, roughness: 0.1 }),
    towel: std({ color: 0xe0d4c0, roughness: 1 }),
    light: std({ color: 0xffffff, emissive: 0xfff2d8, emissiveIntensity: 1 }),
    shade: std({ color: 0xf3ead8, emissive: 0xffe3b0, emissiveIntensity: 0.5, roughness: 0.9 }),
    screen: std({ color: 0x0d1117, emissive: 0x1c2b3a, emissiveIntensity: 0.4, roughness: 0.2 }),
    leaf: std({ color: 0x4f7a4a, roughness: 0.9 }),
    pot: std({ color: style.id === 'med' ? 0xb5603f : style.lacquer, roughness: 0.7 }),
    sink: std({ color: 0xb9bdc2, roughness: 0.3, metalness: 0.8 }),
    steel: std({ color: 0xc9ccd0, roughness: 0.35, metalness: 0.6 }),
    door: std({ color: 0xf1ede6, roughness: 0.5 }),
    frame: std({ color: 0xf6f4f0, roughness: 0.45 }),
    winFrame: std({ color: 0x3a3d40, roughness: 0.5, metalness: 0.4 }),
  };
  return (matCache[style.id] = mats);
}

function box(x0, y0, z0, x1, y1, z1, mat, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.001, x1 - x0), Math.max(0.001, y1 - y0), Math.max(0.001, z1 - z0)), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}

// Wall frame data in room-local coords.
function wallFrame(room, wall) {
  // u: direction along the wall (increasing offset), n: inward normal, p0: start point at the inner face
  switch (wall) {
    case 'A': return { u: [1, 0], n: [0, 1], p0: [0, 0], orient: 'x' };
    case 'C': return { u: [1, 0], n: [0, -1], p0: [0, room.l], orient: 'x' };
    case 'D': return { u: [0, 1], n: [1, 0], p0: [0, 0], orient: 'z' };
    case 'B': return { u: [0, 1], n: [-1, 0], p0: [room.w, 0], orient: 'z' };
  }
}

// Openings in world coordinates, so a door also cuts the neighbour's half-wall.
function worldOpenings(rooms) {
  const out = [];
  for (const r of rooms) {
    for (const o of [...r.doors.map(d => ({ ...d, isDoor: true })), ...r.windows]) {
      const f = wallFrame(r, o.wall);
      const line = f.orient === 'x' ? r.z + f.p0[1] - f.n[1] * HT / 2 : r.x + f.p0[0] - f.n[0] * HT / 2;
      const base = f.orient === 'x' ? r.x : r.z;
      const y0 = o.isDoor ? 0 : o.sill, y1 = o.isDoor ? o.height : o.sill + o.height;
      out.push({ orient: f.orient, line, a0: base + o.off, a1: base + o.off + o.width, y0, y1 });
    }
  }
  return out;
}

export class View3D {
  constructor(host) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 200);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minDistance = 0.3; this.controls.maxDistance = 40;
    try { const pm = new THREE.PMREMGenerator(this.renderer); this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 0.6; } catch (e) { }
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d0c4, 1.1));
    this.sun = new THREE.DirectionalLight(0xffffff, 1.6); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.doorsOpen = true; this.wallMode = 'auto';
    this.walls = []; this.anims = []; this.wallItems = [];
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    const loop = () => { this.tick(); requestAnimationFrame(loop); };
    loop();
  }

  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  // rooms: rooms to draw; cut: wall height cap (null = full)
  build(rooms, { cut = null, focus = null } = {}) {
    this.root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map && o.material._own) o.material.map.dispose(); });
    this.root.clear(); this.walls = []; this.anims = []; this.wallItems = []; this.rooms = rooms; this.cut = cut;
    const openings = worldOpenings(rooms);
    for (const r of rooms) this.buildRoom(r, openings, cut);
    // bounds
    const xs = rooms.flatMap(r => [r.x, r.x + r.w]), zs = rooms.flatMap(r => [r.z, r.z + r.l]);
    this.bounds = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
    const b = this.bounds, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, span = Math.max(b.x1 - b.x0, b.z1 - b.z0);
    this.sun.position.set(cx - span, 8, cz + span * 1.2); this.sun.target.position.set(cx, 0, cz);
    const sc = this.sun.shadow.camera; sc.left = sc.bottom = -span; sc.right = sc.top = span; sc.near = 0.5; sc.far = 40; sc.updateProjectionMatrix();
    this.focus = focus;
  }

  buildRoom(room, openings, cut) {
    const style = styleById(room.style), M = styleMats(style);
    const wet = room.type === 'wc', kitchen = room.type === 'cozinha';
    const g = new THREE.Group(); g.position.set(room.x, 0, room.z); this.root.add(g);
    const H = room.h, Hc = cut ? Math.min(cut, H) : H;

    // floor
    const fspec = wet || kitchen ? style.wetFloor : style.dryFloor;
    const fm = specMaterial(fspec, room.w, room.l); fm._own = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.l), fm);
    floor.rotation.x = -Math.PI / 2; floor.position.set(room.w / 2, 0, room.l / 2); floor.receiveShadow = true; g.add(floor);

    // walls
    const wetKinds = ['base_duche', 'banheira'];
    for (const wall of ['A', 'B', 'C', 'D']) {
      const f = wallFrame(room, wall), L = wallLength(room, wall);
      let spec = style.dryWall;
      if (wet) {
        spec = style.wetWall;
        const near = room.items.some(it => wetKinds.includes(it.kind) && (() => {
          const r = itemRect(it);
          return { A: r.z0 < 0.03, C: r.z1 > room.l - 0.03, D: r.x0 < 0.03, B: r.x1 > room.w - 0.03 }[wall];
        })());
        if (near) spec = style.feature;
      }
      // the wall runs along 'orient'; A and C extend over the corners
      const ext = f.orient === 'x' ? HT : 0;
      const s0 = -ext, s1 = L + ext;
      const base = f.orient === 'x' ? room.x : room.z;
      const line = f.orient === 'x' ? room.z + f.p0[1] - f.n[1] * HT / 2 : room.x + f.p0[0] - f.n[0] * HT / 2;
      const ops = openings.filter(o => o.orient === f.orient && Math.abs(o.line - line) < 0.07 && o.a1 > base + s0 && o.a0 < base + s1)
        .map(o => ({ a0: Math.max(s0, o.a0 - base), a1: Math.min(s1, o.a1 - base), y0: o.y0, y1: o.y1 }))
        .sort((a, b) => a.a0 - b.a0);
      const pieces = []; let cur = s0;
      for (const o of ops) {
        if (o.a0 > cur) pieces.push([cur, o.a0, 0, Hc]);
        if (o.y0 > 0) pieces.push([o.a0, o.a1, 0, Math.min(o.y0, Hc)]);
        if (o.y1 < Hc) pieces.push([o.a0, o.a1, o.y1, Hc]);
        cur = Math.max(cur, o.a1);
      }
      if (cur < s1) pieces.push([cur, s1, 0, Hc]);
      const wg = new THREE.Group(); g.add(wg);
      for (const [a0, a1, y0, y1] of pieces) {
        if (a1 - a0 < 0.002 || y1 - y0 < 0.002) continue;
        const mat = specMaterial(spec, a1 - a0, y1 - y0); mat._own = true;
        // texture offset so neighbouring pieces line up
        if (mat.map) mat.map.offset.set(a0 / spec.tw, y0 / spec.th);
        // thickness goes outwards from the inner face
        const p = (s) => [f.p0[0] + f.u[0] * s, f.p0[1] + f.u[1] * s];
        const [ax, az] = p(a0), [bx, bz] = p(a1);
        const ox = -f.n[0] * HT, oz = -f.n[1] * HT;
        box(Math.min(ax, bx, ax + ox, bx + ox), y0, Math.min(az, bz, az + oz, bz + oz),
            Math.max(ax, bx, ax + ox, bx + ox), y1, Math.max(az, bz, az + oz, bz + oz), mat, wg);
      }
      // wall cap line when cut (dollhouse view)
      this.walls.push({ group: wg, p: new THREE.Vector3(room.x + f.p0[0], 0, room.z + f.p0[1]), n: new THREE.Vector3(f.n[0], 0, f.n[1]), room, wall });
    }

    // doors
    for (const d of room.doors) { const dg = new THREE.Group(); g.add(dg); this.buildDoor(room, d, dg, M, Hc); this.wallItems.push({ obj: dg, room, wall: d.wall }); }
    // windows
    for (const w of room.windows) { const wg = new THREE.Group(); g.add(wg); this.buildWindow(room, w, wg, M, Hc); this.wallItems.push({ obj: wg, room, wall: w.wall }); }

    // furniture
    for (const it of room.items) {
      const r = itemRect(it);
      const ctx = {};
      if (it.kind === 'base_duche') {
        // which local sides touch a wall (local -x = left)
        const t = ((it.rot % 360) + 360) % 360;
        const sides = { 0: [r.x0 < 0.03, r.x1 > room.w - 0.03], 180: [r.x1 > room.w - 0.03, r.x0 < 0.03],
          90: [r.z1 > room.l - 0.03, r.z0 < 0.03], 270: [r.z0 < 0.03, r.z1 > room.l - 0.03] }[t] || [true, true];
        ctx.touchL = sides[0]; ctx.touchR = sides[1];
      }
      const obj = buildItem(it, M, ctx);
      obj.position.set(it.x, 0, it.z); obj.rotation.y = it.rot * Math.PI / 180;
      if (it.flip && it.kind !== 'base_duche') obj.scale.x = -1;
      if (CATALOG[it.kind]?.tall && Hc < 2.2) obj.traverse(o => { if (o.isMesh && o.position.y > Hc + 0.3) o.visible = false; });
      g.add(obj);
      const cat = CATALOG[it.kind];
      if (cat && (cat.h >= 1.1 || it.kind === 'movel_tv')) {
        const w = { A: r.z0 < 0.04, C: r.z1 > room.l - 0.04, D: r.x0 < 0.04, B: r.x1 > room.w - 0.04 };
        const wall = { 0: 'A', 90: 'D', 180: 'C', 270: 'B' }[((it.rot % 360) + 360) % 360];
        if (wall && w[wall]) this.wallItems.push({ obj, room, wall });
      }
    }
    const lamp = new THREE.PointLight(0xfff1dc, 0.9, 0, 0); lamp.position.set(room.w / 2, H - 0.2, room.l / 2); g.add(lamp);
  }

  buildDoor(room, d, g, M, Hc) {
    if (d.kind === 'aberto') {
      // fill the floor where the wall used to be
      const f = wallFrame(room, d.wall), style = styleById(room.style);
      const spec = room.type === 'wc' || room.type === 'cozinha' ? style.wetFloor : style.dryFloor;
      const P = (s, n) => [f.p0[0] + f.u[0] * s + f.n[0] * n, f.p0[1] + f.u[1] * s + f.n[1] * n];
      const [ax, az] = P(d.off, -T - 0.002), [bx, bz] = P(d.off + d.width, 0.002);
      const w = Math.abs(bx - ax), l = Math.abs(bz - az);
      const m = specMaterial(spec, w, l); m._own = true;
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, l), m);
      pl.rotation.x = -Math.PI / 2; pl.position.set((ax + bx) / 2, 0.001, (az + bz) / 2); pl.receiveShadow = true; g.add(pl);
      return;
    }
    const f = wallFrame(room, d.wall);
    const P = (s, n = 0) => [f.p0[0] + f.u[0] * s + f.n[0] * n, f.p0[1] + f.u[1] * s + f.n[1] * n];
    const piece = (s0, s1, n0, n1, y0, y1, mat) => {
      const [ax, az] = P(s0, n0), [bx, bz] = P(s1, n1);
      return box(Math.min(ax, bx), y0, Math.min(az, bz), Math.max(ax, bx), y1, Math.max(az, bz), mat, g);
    };
    // frame (jambs + head) on the inner face
    const fw = 0.04;
    piece(d.off - fw, d.off, -HT, 0.015, 0, Math.min(d.height + fw, Hc), M.frame);
    piece(d.off + d.width, d.off + d.width + fw, -HT, 0.015, 0, Math.min(d.height + fw, Hc), M.frame);
    if (d.height < Hc) piece(d.off - fw, d.off + d.width + fw, -HT, 0.015, d.height, d.height + fw, M.frame);
    if (d.kind === 'vao') return;
    const lh = Math.min(d.height - 0.01, Hc);
    if (d.kind === 'batente') {
      const hingeS = d.hinge === 'end' ? d.off + d.width : d.off;
      const sign = d.hinge === 'end' ? -1 : 1;
      const out = d.swing === 'out';
      const [hx, hz] = P(hingeS, out ? -HT : 0);
      const pivot = new THREE.Group(); pivot.position.set(hx, 0, hz); g.add(pivot);
      const leaf = new THREE.Group(); pivot.add(leaf);
      box(0, 0.005, -0.02, d.width - 0.005, lh, 0.02, M.door, leaf);
      box(d.width - 0.08, 1.0, 0.02, d.width - 0.06, 1.02, 0.07, M.metal, leaf);
      box(d.width - 0.08, 1.0, -0.07, d.width - 0.06, 1.02, -0.02, M.metal, leaf);
      const closed = [f.u[0] * sign, f.u[1] * sign], open = out ? [-f.n[0], -f.n[1]] : [f.n[0], f.n[1]];
      const setA = (t) => { const vx = closed[0] * Math.cos(t) + open[0] * Math.sin(t), vz = closed[1] * Math.cos(t) + open[1] * Math.sin(t); pivot.rotation.y = Math.atan2(-vz, vx); };
      this.anims.push({ type: 'swing', set: setA, v: this.doorsOpen ? 1.35 : 0, max: 1.35 });
    } else {
      const emb = d.kind === 'correr_emb';
      const dir = d.hinge === 'end' ? 1 : -1;            // direction the leaf moves when opening
      const nOff = emb ? -HT / 2 : 0.04;
      const leaf = new THREE.Group(); g.add(leaf);
      const lw = emb ? d.width : d.width + 0.06;
      const [cx, cz] = P(0, nOff);
      leaf.position.set(cx, 0, cz);
      const L = new THREE.Group(); leaf.add(L);
      const along = f.orient === 'x';
      if (along) box(0, 0.005, -0.018, lw, lh, 0.018, M.door, L); else box(-0.018, 0.005, 0, 0.018, lh, lw, M.door, L);
      const hp = along ? [dir < 0 ? lw - 0.06 : 0.04, 0.95, f.n[1] * 0.02] : [f.n[0] * 0.02, 0.95, dir < 0 ? lw - 0.06 : 0.04];
      box(hp[0] - 0.01, hp[1], hp[2] - 0.01, hp[0] + 0.01, hp[1] + 0.2, hp[2] + 0.01, M.metal, L);
      if (!emb) piece(d.off - lw * (dir < 0 ? 1 : 0) - 0.05, d.off + d.width + lw * (dir > 0 ? 1 : 0) + 0.05, 0.02, 0.06, lh + 0.02, lh + 0.07, M.metal);
      const s0 = emb ? d.off : d.off - 0.03;
      const set = (t) => { const s = s0 + dir * t * d.width * (emb ? 0.94 : 1); const [x, z] = P(s, nOff); leaf.position.set(x, 0, z); };
      this.anims.push({ type: 'slide', set, v: this.doorsOpen ? 1 : 0, max: 1, emb, leaf, room, wall: d.wall });
    }
  }

  buildWindow(room, w, g, M, Hc) {
    if (w.sill >= Hc) return;
    const f = wallFrame(room, w.wall);
    const P = (s, n = 0) => [f.p0[0] + f.u[0] * s + f.n[0] * n, f.p0[1] + f.u[1] * s + f.n[1] * n];
    const piece = (s0, s1, n0, n1, y0, y1, mat) => {
      const [ax, az] = P(s0, n0), [bx, bz] = P(s1, n1);
      return box(Math.min(ax, bx), y0, Math.min(az, bz), Math.max(ax, bx), y1, Math.max(az, bz), mat, g);
    };
    const top = Math.min(w.sill + w.height, Hc), fw = 0.05;
    piece(w.off, w.off + w.width, -HT, 0.04, w.sill - 0.03, w.sill, M.frame);              // sill
    piece(w.off, w.off + fw, -HT, -0.01, w.sill, top, M.winFrame);
    piece(w.off + w.width - fw, w.off + w.width, -HT, -0.01, w.sill, top, M.winFrame);
    if (top === w.sill + w.height) piece(w.off, w.off + w.width, -HT, -0.01, top - fw, top, M.winFrame);
    piece(w.off, w.off + w.width, -HT, -0.01, w.sill, w.sill + fw, M.winFrame);
    if (w.width > 0.9) piece(w.off + w.width / 2 - 0.02, w.off + w.width / 2 + 0.02, -HT, -0.01, w.sill, top, M.winFrame);
    piece(w.off + fw, w.off + w.width - fw, -HT / 2 - 0.004, -HT / 2 + 0.004, w.sill + fw, top - (top === w.sill + w.height ? fw : 0), M.glass);
  }

  setDoorsOpen(v) { this.doorsOpen = v; }

  view(preset) {
    const b = this.bounds; if (!b) return;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, span = Math.max(b.x1 - b.x0, b.z1 - b.z0, 1.5);
    const rad = 0.5 * Math.hypot(b.x1 - b.x0, b.z1 - b.z0) + 0.3;
    const vh = this.camera.fov * Math.PI / 360, hh = Math.atan(Math.tan(vh) * this.camera.aspect);
    const dist = rad / Math.sin(Math.min(vh, hh)) * 0.9;
    const c = this.controls;
    if (preset === 'topo') { c.target.set(cx, 0, cz); this.camera.position.set(cx, dist * 1.1, cz + 0.001); }
    else if (preset === 'porta' && this.rooms.length === 1 && this.rooms[0].doors.length) {
      const r = this.rooms[0], d = r.doors[0], f = wallFrame(r, d.wall);
      const s = d.off + d.width / 2;
      const px = r.x + f.p0[0] + f.u[0] * s, pz = r.z + f.p0[1] + f.u[1] * s;
      this.camera.position.set(px - f.n[0] * 0.25, 1.6, pz - f.n[1] * 0.25);
      c.target.set(px + f.n[0] * 1.5, 1.2, pz + f.n[1] * 1.5);
    } else {
      c.target.set(cx, 0.5, cz);
      const dir = new THREE.Vector3(-0.38, 0.72, 0.58).normalize().multiplyScalar(dist);
      this.camera.position.set(cx + dir.x, 0.5 + dir.y, cz + dir.z);
    }
    c.update();
  }

  tick() {
    const cam = this.camera.position, tmp = new THREE.Vector3();
    for (const w of this.walls) {
      const outside = tmp.copy(cam).sub(w.p).dot(w.n) < -0.02;
      w.group.visible = this.wallMode === 'all' || this.cut || !outside;
      w.visible = w.group.visible;
    }
    for (const wi of this.wallItems) {
      const wv = this.walls.find(w => w.room === wi.room && w.wall === wi.wall);
      wi.obj.visible = !wv || wv.visible;
    }
    for (const a of this.anims) {
      const goal = this.doorsOpen ? a.max : 0;
      a.v += (goal - a.v) * 0.12; a.set(a.v);
      if (a.type === 'slide' && a.emb) {
        const wv = this.walls.find(w => w.room === a.room && w.wall === a.wall);
        a.leaf.visible = !wv || wv.visible || a.v < 0.05;
      }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
