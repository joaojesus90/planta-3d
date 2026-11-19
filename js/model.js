// Data model, catalogue, styles and automatic furniture layout.
// Units: metres. Room local coordinates: x to the right (0..w), z downwards in the plan (0..l).
// Walls: A = top (z=0), B = right (x=w), C = bottom (z=l), D = left (x=0).

export const T = 0.10;          // wall thickness
export const EPS = 0.001;

export const ROOM_TYPES = {
  wc:         { label: 'Casa de banho' },
  quarto:     { label: 'Quarto' },
  sala:       { label: 'Sala' },
  cozinha:    { label: 'Cozinha' },
  escritorio: { label: 'Escritório' },
  outro:      { label: 'Outra (vazia)' },
};

export const WALL_INFO = {
  A: { label: 'A (cima)',     ends: ['D', 'B'], rot: 0 },
  B: { label: 'B (direita)',  ends: ['A', 'C'], rot: 270 },
  C: { label: 'C (baixo)',    ends: ['D', 'B'], rot: 180 },
  D: { label: 'D (esquerda)', ends: ['A', 'C'], rot: 90 },
};
export const ROT_WALL = { 0: 'A', 90: 'D', 180: 'C', 270: 'B' };

export const DOOR_KINDS = {
  batente:    'Batente',
  correr_emb: 'De correr embutida',
  correr_ext: 'De correr à vista',
  vao:        'Só vão (sem porta)',
};

export const uid = () => Math.random().toString(36).slice(2, 9);
export const r2 = v => Math.round(v * 100) / 100;

export function wallLength(room, wall) { return (wall === 'A' || wall === 'C') ? room.w : room.l; }

// Point on a wall at distance s from its start, in room local coords.
export function wallPoint(room, wall, s) {
  switch (wall) {
    case 'A': return { x: s, z: 0 };
    case 'C': return { x: s, z: room.l };
    case 'D': return { x: 0, z: s };
    case 'B': return { x: room.w, z: s };
  }
}

// Rect helpers {x0,z0,x1,z1}
export const rect = (x0, z0, x1, z1) => ({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
export const overlap = (a, b, e = EPS) => a.x0 < b.x1 - e && b.x0 < a.x1 - e && a.z0 < b.z1 - e && b.z0 < a.z1 - e;
export const inside = (a, b, e = 0.005) => a.x0 >= b.x0 - e && a.z0 >= b.z0 - e && a.x1 <= b.x1 + e && a.z1 <= b.z1 + e;
export function gap(a, b) {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1), dz = Math.max(0, a.z0 - b.z1, b.z0 - a.z1);
  return Math.hypot(dx, dz);
}

// Rect of a band along a wall: from s0 to s1 along the wall, depth into the room.
export function wallBand(room, wall, s0, s1, depth) {
  switch (wall) {
    case 'A': return rect(s0, 0, s1, depth);
    case 'C': return rect(s0, room.l - depth, s1, room.l);
    case 'D': return rect(0, s0, depth, s1);
    case 'B': return rect(room.w - depth, s0, room.w, s1);
  }
}

// ---------- Catalogue ----------
// w = width along the wall, d = depth, h = height. clear = free space needed in front.
// side = lateral clearance. wall = placed with its back against a wall. tall = must avoid windows.
export const CATALOG = {
  base_duche:    { label: 'Base de duche',            group: 'Casa de banho', w: 1.2, d: 0.8, h: 2.0,  clear: 0.6, wall: true },
  banheira:      { label: 'Banheira',                 group: 'Casa de banho', w: 1.7, d: 0.7, h: 0.55, clear: 0.6, wall: true },
  sanita:        { label: 'Sanita suspensa',          group: 'Casa de banho', w: 0.36, d: 0.54, h: 0.42, clear: 0.6, side: 0.15, wall: true, mount: true },
  lavatorio:     { label: 'Móvel com lavatório',      group: 'Casa de banho', w: 0.6, d: 0.46, h: 0.86, clear: 0.6, wall: true, mount: true },
  toalheiro:     { label: 'Toalheiro',                group: 'Casa de banho', w: 0.5, d: 0.1, h: 1.2,  clear: 0.0, wall: true, mount: true },
  cama_casal:    { label: 'Cama de casal',            group: 'Quarto', w: 1.6, d: 2.05, h: 1.0, clear: 0.6, side: 0.0, wall: true },
  cama_solteiro: { label: 'Cama de solteiro',         group: 'Quarto', w: 0.9, d: 1.95, h: 0.9, clear: 0.6, wall: true },
  mesa_cabeceira:{ label: 'Mesa de cabeceira',        group: 'Quarto', w: 0.45, d: 0.4, h: 0.5, clear: 0.0, wall: true },
  roupeiro:      { label: 'Roupeiro',                 group: 'Quarto', w: 1.5, d: 0.6, h: 2.2, clear: 0.7, wall: true, tall: true },
  comoda:        { label: 'Cómoda',                   group: 'Quarto', w: 1.0, d: 0.5, h: 0.85, clear: 0.6, wall: true },
  secretaria:    { label: 'Secretária com cadeira',   group: 'Quarto e escritório', w: 1.2, d: 0.6, h: 0.75, clear: 0.7, wall: true },
  estante:       { label: 'Estante',                  group: 'Quarto e escritório', w: 1.0, d: 0.35, h: 2.0, clear: 0.5, wall: true, tall: true, mount: true },
  sofa:          { label: 'Sofá',                     group: 'Sala', w: 2.2, d: 0.92, h: 0.85, clear: 0.35, wall: true },
  poltrona:      { label: 'Poltrona',                 group: 'Sala', w: 0.8, d: 0.8, h: 0.85, clear: 0.3 },
  mesa_centro:   { label: 'Mesa de centro',           group: 'Sala', w: 1.0, d: 0.55, h: 0.4, clear: 0.0 },
  movel_tv:      { label: 'Móvel de TV',              group: 'Sala', w: 1.6, d: 0.45, h: 0.5, clear: 0.3, wall: true },
  mesa_jantar:   { label: 'Mesa de jantar e cadeiras',group: 'Sala', w: 1.4, d: 1.7, h: 0.75, clear: 0.15 },
  tapete:        { label: 'Tapete',                   group: 'Sala', w: 2.0, d: 1.4, h: 0.01, floor: true },
  bancada:       { label: 'Bancada de cozinha',       group: 'Cozinha', w: 2.4, d: 0.6, h: 0.9, clear: 0.9, wall: true, mount: true },
  frigorifico:   { label: 'Frigorífico',              group: 'Cozinha', w: 0.6, d: 0.65, h: 1.9, clear: 0.8, wall: true, tall: true },
  planta:        { label: 'Planta',                   group: 'Decoração', w: 0.45, d: 0.45, h: 1.2, clear: 0.0 },
};

// ---------- Styles ----------
// Texture specs: {k: texture key, tw/th: real size of one texture repeat in metres, r: roughness} or {c: colour}.
export const STYLES = [
  { id: 'calacatta', name: 'Mármore Calacatta e dourado', sw: ['#f4f1ea', '#c9a24d', '#5b3d28'],
    desc: 'Mármore branco com veios cinza e dourados, metais dourados escovados e nogueira. Em porcelânico efeito mármore consegue-se o mesmo aspeto com menos manutenção.',
    wetWall: { k: 'calacatta', tw: 0.6, th: 1.2, r: 0.15 }, feature: { k: 'calacatta', tw: 0.6, th: 1.2, r: 0.15 },
    dryWall: { k: 'paint:#f2eee7', tw: 1, th: 1, r: 0.9 }, wetFloor: { k: 'calacattaF', tw: 0.6, th: 0.6, r: 0.2 },
    dryFloor: { k: 'herringL', tw: 0.8, th: 0.8, r: 0.5 }, top: { k: 'calacatta', tw: 0.6, th: 0.6, r: 0.15 },
    wood: 'walnut', lacquer: 0xf1ede6, fabric: 0xe6dccb, accent: 0xc9a24d, metal: 'gold', base: 0xf3f1ec, plate: 0xffffff },
  { id: 'nero', name: 'Mármore Nero e dourado', sw: ['#19191b', '#d9b25f', '#e4ddd2'],
    desc: 'Mármore negro com veios brancos, paredes greige, lacados pretos e dourado. Dramático, pede boa iluminação em espaços pequenos.',
    wetWall: { k: 'greige', tw: 1, th: 1, r: 0.7 }, feature: { k: 'nero', tw: 0.6, th: 1.2, r: 0.12 },
    dryWall: { k: 'paint:#e4ddd2', tw: 1, th: 1, r: 0.9 }, wetFloor: { k: 'neroF', tw: 0.6, th: 0.6, r: 0.2 },
    dryFloor: { k: 'planksD', tw: 1.2, th: 1.2, r: 0.5 }, top: { k: 'nero', tw: 0.6, th: 0.6, r: 0.15 },
    wood: 'walnut', lacquer: 0x1c1c1e, fabric: 0x3a3a3f, accent: 0xd9b25f, metal: 'gold', base: 0x2a2a2c, plate: 0x1e1e1e },
  { id: 'micro', name: 'Microcimento minimalista', sw: ['#d4cec5', '#232323', '#d8bf98'],
    desc: 'Superfícies contínuas sem juntas, metais pretos mate e carvalho claro. Dá sensação de mais espaço, exige bom aplicador.',
    wetWall: { k: 'microL', tw: 1, th: 1, r: 0.6 }, feature: { k: 'microL', tw: 1, th: 1, r: 0.5 },
    dryWall: { k: 'microL', tw: 1, th: 1, r: 0.7 }, wetFloor: { k: 'microD', tw: 1, th: 1, r: 0.55 },
    dryFloor: { k: 'microD', tw: 1, th: 1, r: 0.55 }, top: { c: 0xe7e3dc, r: 0.4 },
    wood: 'oakL', lacquer: 0xe9e5de, fabric: 0xb9b4ac, accent: 0x232323, metal: 'black', base: 0xc9c3b9, plate: 0x232323 },
  { id: 'nordico', name: 'Escandinavo', sw: ['#f5f3ee', '#cdc9c2', '#d8bf98'],
    desc: 'Luminoso e intemporal: azulejo metro branco nas zonas húmidas, paredes brancas, soalho de carvalho claro, têxteis cinza claro e cromados.',
    wetWall: { k: 'subway', tw: 0.3, th: 0.3, r: 0.12 }, feature: { k: 'subway', tw: 0.3, th: 0.3, r: 0.12 },
    dryWall: { k: 'paint:#f7f6f2', tw: 1, th: 1, r: 0.9 }, wetFloor: { k: 'stoneL', tw: 0.6, th: 0.6, r: 0.45 },
    dryFloor: { k: 'planksL', tw: 1.2, th: 1.2, r: 0.5 }, top: { c: 0xffffff, r: 0.2 },
    wood: 'oakL', lacquer: 0xffffff, fabric: 0xcfd0cf, accent: 0x9fb7c4, metal: 'chrome', base: 0xfbfbfa, plate: 0xffffff },
  { id: 'japandi', name: 'Japandi', sw: ['#e9e2d6', '#b88a52', '#2b2b2b'],
    desc: 'Mistura de japonês e escandinavo: tons de areia, madeira natural, linhas baixas, linho e apontamentos pretos. Calmo e sem excessos.',
    wetWall: { k: 'paint:#e9e2d6', tw: 1, th: 1, r: 0.8 }, feature: { k: 'kitkat', tw: 0.3, th: 0.3, r: 0.25 },
    dryWall: { k: 'paint:#ebe4d8', tw: 1, th: 1, r: 0.9 }, wetFloor: { k: 'stoneW', tw: 0.6, th: 0.6, r: 0.5 },
    dryFloor: { k: 'planksH', tw: 1.2, th: 1.2, r: 0.55 }, top: { c: 0xd8cbb5, r: 0.5 },
    wood: 'oakH', lacquer: 0x2b2b2b, fabric: 0xd9cfbf, accent: 0x7b8a6a, metal: 'black', base: 0xe2dbcf, plate: 0x2b2b2b },
  { id: 'zellige', name: 'Zellige verde e latão', sw: ['#2f6b5a', '#b08d57', '#ebe6de'],
    desc: 'Zellige verde esmeralda com brilho artesanal, estuque quente, terrazzo, nogueira, veludo verde e latão escovado.',
    wetWall: { k: 'plaster', tw: 1, th: 1, r: 0.8 }, feature: { k: 'zellige', tw: 0.4, th: 0.4, r: 0.1 },
    dryWall: { k: 'paint:#dfe3d6', tw: 1, th: 1, r: 0.9 }, wetFloor: { k: 'terrazzo', tw: 0.6, th: 0.6, r: 0.35 },
    dryFloor: { k: 'herringH', tw: 0.8, th: 0.8, r: 0.5 }, top: { c: 0xffffff, r: 0.2 },
    wood: 'walnut', lacquer: 0xf3efe7, fabric: 0x2f6b5a, accent: 0xb08d57, metal: 'brass', base: 0xfbfbfa, plate: 0xffffff },
  { id: 'med', name: 'Mediterrâneo português', sw: ['#2c4f7c', '#efe8da', '#b5603f'],
    desc: 'Mosaico hidráulico azul e creme, azulejo branco artesanal, paredes caiadas, tijoleira de barro nas salas, carvalho mel, linho e latão envelhecido.',
    wetWall: { k: 'plaster', tw: 1, th: 1, r: 0.85 }, feature: { k: 'handmade', tw: 0.1, th: 0.1, r: 0.15 },
    dryWall: { k: 'plaster', tw: 1, th: 1, r: 0.9 }, wetFloor: { k: 'hydraulic', tw: 0.2, th: 0.2, r: 0.4 },
    dryFloor: { k: 'terracotta', tw: 0.3, th: 0.3, r: 0.7 }, top: { c: 0xffffff, r: 0.2 },
    wood: 'oakH', lacquer: 0xf4efe5, fabric: 0xe8dfcf, accent: 0x2c4f7c, metal: 'brass', base: 0xfbfbfa, plate: 0xffffff },
  { id: 'industrial', name: 'Industrial', sw: ['#9a4f36', '#3b3b3b', '#8a5a34'],
    desc: 'Tijolo à vista, betão, metal preto, madeira escura e couro conhaque. Funciona melhor em salas e cozinhas amplas.',
    wetWall: { k: 'microD', tw: 1, th: 1, r: 0.6 }, feature: { k: 'brick', tw: 0.5, th: 0.5, r: 0.85 },
    dryWall: { k: 'paint:#d9d6d0', tw: 1, th: 1, r: 0.9 }, wetFloor: { k: 'concrete', tw: 1, th: 1, r: 0.6 },
    dryFloor: { k: 'concrete', tw: 1, th: 1, r: 0.6 }, top: { c: 0x3b3b3b, r: 0.5 },
    wood: 'walnut', lacquer: 0x2e2e2e, fabric: 0x8a5a34, accent: 0x9a4f36, metal: 'black', base: 0x8f8a84, plate: 0x2e2e2e },
];
export const styleById = id => STYLES.find(s => s.id === id) || STYLES[0];

// ---------- Defaults ----------
export function newRoom(opts = {}) {
  return {
    id: uid(), name: opts.name || 'Divisão', type: opts.type || 'outro',
    w: opts.w ?? 3, l: opts.l ?? 3, h: opts.h ?? 2.6, x: opts.x ?? 0, z: opts.z ?? 0,
    style: opts.style || 'calacatta', doors: opts.doors || [], windows: opts.windows || [], items: opts.items || [], auto: opts.auto ?? false,
  };
}
export const newDoor = (o = {}) => ({ id: uid(), wall: 'C', off: 0.3, width: 0.8, height: 2.0, kind: 'batente', swing: 'in', hinge: 'start', ...o });
export const newWindow = (o = {}) => ({ id: uid(), wall: 'A', off: 0.5, width: 1.0, sill: 0.9, height: 1.2, ...o });
export function newItem(kind, o = {}) {
  const c = CATALOG[kind];
  return { id: uid(), kind, x: 0, z: 0, rot: 0, w: c.w, d: c.d, flip: false, ...o };
}

// ---------- Geometry of items ----------
export function itemDims(it) {
  const a = ((Math.round(it.rot) % 360) + 360) % 360;
  if (a % 180 === 0) return { dx: it.w, dz: it.d };
  if (a % 90 === 0) return { dx: it.d, dz: it.w };
  const t = a * Math.PI / 180, c = Math.abs(Math.cos(t)), s = Math.abs(Math.sin(t));
  return { dx: it.w * c + it.d * s, dz: it.w * s + it.d * c };
}
export function itemRect(it) {
  const { dx, dz } = itemDims(it);
  return rect(it.x - dx / 2, it.z - dz / 2, it.x + dx / 2, it.z + dz / 2);
}
// Front direction (unit vector) for rot: 0 -> +z, 90 -> +x, 180 -> -z, 270 -> -x
export function frontDir(rot) { const t = rot * Math.PI / 180; return { x: Math.sin(t), z: Math.cos(t) }; }
// Local item coords: x across the width (-w/2..w/2), z from back (-d/2) to front (+d/2).
export function toWorld(it, lx, lz) {
  const t = it.rot * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  return { x: it.x + lx * c + lz * s, z: it.z - lx * s + lz * c };
}
function localRect(it, x0, z0, x1, z1) {
  const a = toWorld(it, x0, z0), b = toWorld(it, x1, z1);
  return rect(a.x, a.z, b.x, b.z);
}
// Shower entry: the open part of the front edge (the rest is fixed glass).
export function showerEntry(it) {
  const e = Math.min(0.7, it.w);
  return it.flip ? [it.w / 2 - e, it.w / 2] : [-it.w / 2, -it.w / 2 + e];
}
export function clearRect(it, depth) {
  const c = depth ?? (CATALOG[it.kind]?.clear || 0);
  if (!c) return null;
  let [x0, x1] = [-it.w / 2, it.w / 2];
  if (it.kind === 'base_duche') [x0, x1] = showerEntry(it);
  return localRect(it, x0, it.d / 2, x1, it.d / 2 + c);
}
function sideRect(it) {
  const s = CATALOG[it.kind]?.side || 0, r = itemRect(it);
  if (!s) return r;
  const f = frontDir(it.rot);
  return Math.abs(f.z) > 0.7 ? rect(r.x0 - s, r.z0, r.x1 + s, r.z1) : rect(r.x0, r.z0 - s, r.x1, r.z1 + s);
}

// ---------- Openings: zones that furniture must respect ----------
export function doorZones(room) {
  const zones = [];
  for (const d of room.doors) {
    const depth = d.kind === 'batente' && d.swing === 'in' ? Math.max(d.width, 0.8) : 0.8;
    zones.push({ type: 'door', r: wallBand(room, d.wall, d.off - 0.05, d.off + d.width + 0.05, depth) });
    if (d.kind === 'correr_emb') {
      const L = wallLength(room, d.wall);
      const s0 = d.hinge === 'end' ? d.off + d.width : Math.max(0, d.off - d.width - 0.05);
      const s1 = d.hinge === 'end' ? Math.min(L, d.off + 2 * d.width + 0.05) : d.off;
      zones.push({ type: 'pocket', r: wallBand(room, d.wall, s0, s1, 0.12) });
    }
  }
  for (const w of room.windows) zones.push({ type: 'window', sill: w.sill, r: wallBand(room, w.wall, w.off, w.off + w.width, 0.2) });
  return zones;
}
export function doorCenters(room) {
  return room.doors.map(d => { const p = wallPoint(room, d.wall, d.off + d.width / 2); return p; });
}

// ---------- Validation ----------
export function fits(room, it, others, zones) {
  const cat = CATALOG[it.kind], r = itemRect(it);
  const roomR = rect(0, 0, room.w, room.l);
  if (!inside(r, roomR)) return false;
  if (cat.floor) return true;
  const cl = clearRect(it);
  if (cl && !inside(cl, roomR, 0.02)) return false;
  const sr = sideRect(it);
  for (const z of zones) {
    if (z.type === 'door' && overlap(r, z.r)) return false;
    if (z.type === 'pocket' && cat.mount && overlap(r, z.r)) return false;
    if (z.type === 'window' && cat.tall && cat.h > z.sill && overlap(r, z.r)) return false;
  }
  for (const o of others) {
    if (o.id === it.id || CATALOG[o.kind]?.floor) continue;
    const or = itemRect(o);
    if (overlap(sr, or) || overlap(r, sideRect(o))) return false;
    const oc = clearRect(o);
    if (oc && overlap(r, oc)) return false;
    if (cl && overlap(cl, or)) return false;
  }
  return true;
}

// ---------- Automatic placement ----------
function wallCandidates(room, w, d, kind, walls = ['A', 'B', 'C', 'D']) {
  const out = [];
  for (const wall of walls) {
    const L = wallLength(room, wall), rot = WALL_INFO[wall].rot;
    if (w > L + EPS) continue;
    const steps = new Set();
    for (let s = 0; s <= L - w + EPS; s += 0.05) steps.add(r2(s));
    steps.add(r2(L - w)); steps.add(r2((L - w) / 2));
    for (const s of steps) {
      let x, z;
      if (wall === 'A') { x = s + w / 2; z = d / 2; }
      if (wall === 'C') { x = s + w / 2; z = room.l - d / 2; }
      if (wall === 'D') { x = d / 2; z = s + w / 2; }
      if (wall === 'B') { x = room.w - d / 2; z = s + w / 2; }
      out.push({ it: newItem(kind, { x, z, rot, w, d }), wall, s, L });
    }
  }
  return out;
}
function freeCandidates(room, w, d, kind) {
  const out = [];
  for (const rot of [0, 90]) {
    const dx = rot ? d : w, dz = rot ? w : d;
    for (let x = dx / 2; x <= room.w - dx / 2 + EPS; x += 0.1)
      for (let z = dz / 2; z <= room.l - dz / 2 + EPS; z += 0.1)
        out.push({ it: newItem(kind, { x: r2(x), z: r2(z), rot, w, d }), wall: null });
  }
  return out;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function score(room, c, items, prefs) {
  const it = c.it, doors = doorCenters(room);
  let s = 0;
  const dDoor = doors.length ? Math.min(...doors.map(p => dist(p, it))) : 3;
  if (prefs.farDoor) s += prefs.farDoor * dDoor;
  if (prefs.nearDoor) s -= prefs.nearDoor * dDoor;
  if (c.wall) {
    if (prefs.corner) { const e = Math.min(c.s, c.L - it.w - c.s); s -= prefs.corner * e; }
    if (prefs.center) s -= prefs.center * Math.abs(c.s + it.w / 2 - c.L / 2);
    if (prefs.longWall) s += prefs.longWall * c.L;
    if (prefs.doorWallPenalty && room.doors.some(d => d.wall === c.wall)) s -= prefs.doorWallPenalty;
    if (prefs.windowWall && room.windows.some(w => w.wall === c.wall)) {
      s += prefs.windowWall;
      const win = room.windows.find(w => w.wall === c.wall);
      s -= prefs.windowWall * 0.5 * Math.abs(c.s + it.w / 2 - (win.off + win.width / 2));
    }
  }
  if (prefs.near) {
    const t = items.filter(o => prefs.near.includes(o.kind));
    if (t.length) s -= (prefs.nearW || 3) * Math.min(...t.map(o => gap(itemRect(o), itemRect(it)) * 4 + dist(o, it) * 0.3));
  }
  if (prefs.cornerFree) {
    const cs = [{ x: 0, z: 0 }, { x: room.w, z: 0 }, { x: 0, z: room.l }, { x: room.w, z: room.l }];
    s -= prefs.cornerFree * Math.min(...cs.map(p => dist(p, it)));
  }
  if (prefs.open) {
    const solids = items.filter(o => !CATALOG[o.kind].floor);
    const r = itemRect(it);
    const g = Math.min(r.x0, r.z0, room.w - r.x1, room.l - r.z1, ...solids.map(o => gap(itemRect(o), r)));
    s += prefs.open * Math.min(g, 1.2);
  }
  if (prefs.opposite) {
    const t = items.find(o => o.kind === prefs.opposite);
    if (t) s -= 3 * (Math.abs(frontDir(t.rot).z) > 0.7 ? Math.abs(it.x - t.x) : Math.abs(it.z - t.z));
  }
  return s;
}

function placeOne(room, kind, items, { sizes, prefs = {}, walls } = {}) {
  const cat = CATALOG[kind], zones = doorZones(room);
  const sz = sizes || [[cat.w, cat.d]];
  for (const [w, d] of sz) {
    const cands = cat.wall ? wallCandidates(room, w, d, kind, walls) : freeCandidates(room, w, d, kind);
    let best = null, bestS = -Infinity;
    for (const c of cands) {
      if (!fits(room, c.it, items, zones)) continue;
      const sc = score(room, c, items, prefs);
      if (sc > bestS) { bestS = sc; best = c.it; }
    }
    if (best) { items.push(best); return best; }
  }
  return null;
}

// Put the shower entry on the side closest to the door.
function orientShower(room, sh, items) {
  const doors = doorCenters(room);
  if (!doors.length) return;
  const best = [false, true].map(f => {
    sh.flip = f; const [a, b] = showerEntry(sh); const p = toWorld(sh, (a + b) / 2, sh.d / 2);
    return { f, dd: Math.min(...doors.map(q => dist(p, q))), ok: fits(room, sh, items.filter(o => o !== sh), doorZones(room)) };
  }).filter(o => o.ok).sort((a, b) => a.dd - b.dd)[0];
  sh.flip = best ? best.f : false;
}

function oppositeWall(w) { return { A: 'C', C: 'A', B: 'D', D: 'B' }[w]; }

function placeInFront(room, kind, items, target, gapD, w, d) {
  const f = frontDir(target.rot), tr = itemRect(target);
  const td = Math.abs(f.z) > 0.7 ? tr.z1 - tr.z0 : tr.x1 - tr.x0;
  const off = td / 2 + gapD + d / 2;
  const it = newItem(kind, { x: r2(target.x + f.x * off), z: r2(target.z + f.z * off), rot: target.rot, w, d });
  if (fits(room, it, items, doorZones(room))) { items.push(it); return it; }
  return null;
}

// Fill a room with typical furniture for its type.
export function autoFurnish(room) {
  const items = [];
  const minDim = Math.min(room.w, room.l), area = room.w * room.l;
  const P = (k, o) => placeOne(room, k, items, o);

  if (room.type === 'wc') {
    // Shower: full width on a short, door-free wall when it fits; otherwise a corner base.
    let shower = null;
    const walls = ['A', 'B', 'C', 'D'].filter(w => !room.doors.some(d => d.wall === w))
      .sort((a, b) => wallLength(room, a) - wallLength(room, b));
    for (const w of walls) {
      const L = wallLength(room, w);
      if (L >= 0.9 && L <= 1.9) {
        const other = (w === 'A' || w === 'C') ? room.l : room.w;
        const d = other >= 2.0 ? 0.8 : 0.7;
        shower = P('base_duche', { sizes: [[r2(L), d]], walls: [w], prefs: { farDoor: 1 } });
        if (shower) break;
      }
    }
    if (!shower) shower = P('base_duche', { sizes: [[1.2, 0.8], [1.0, 0.8], [0.9, 0.9], [0.8, 0.8]], prefs: { corner: 4, farDoor: 1 } });
    if (shower) orientShower(room, shower, items);
    let ok = false;
    for (const sz of [[0.8, 0.46], [0.6, 0.46], [0.5, 0.45], [0.4, 0.4]]) {
      const n = items.length;
      const lav = P('lavatorio', { sizes: [sz], prefs: { near: ['base_duche'], nearW: 1, farDoor: 0.3 } });
      if (lav && P('sanita', { prefs: { near: ['lavatorio'], nearW: 1, farDoor: 0.5 } })) { ok = true; break; }
      items.length = n;
    }
    if (!ok) { P('sanita', { prefs: { farDoor: 0.5 } }); P('lavatorio', { sizes: [[0.6, 0.46], [0.4, 0.4]], prefs: { near: ['sanita'] } }); }
    P('toalheiro', { prefs: { near: ['base_duche', 'banheira'], nearW: 2 } });
  }

  if (room.type === 'quarto') {
    const casal = minDim >= 2.7;
    const bed = casal
      ? P('cama_casal', { sizes: [[1.6, 2.05], [1.4, 2.0]], prefs: { center: 2, farDoor: 0.6, doorWallPenalty: 1.5 } })
      : P('cama_solteiro', { prefs: { corner: 2, farDoor: 0.6 } });
    if (bed) {
      P('mesa_cabeceira', { prefs: { near: [bed.kind], nearW: 6 }, walls: [ROT_WALL[bed.rot]] });
      if (casal) P('mesa_cabeceira', { prefs: { near: [bed.kind], nearW: 6 }, walls: [ROT_WALL[bed.rot]] });
    }
    P('roupeiro', { sizes: [[2.0, 0.6], [1.8, 0.6], [1.5, 0.6], [1.2, 0.6], [1.0, 0.6]], prefs: { corner: 3, longWall: 0.2 } });
    if (area >= 11) P('comoda', { prefs: { center: 0.5, farDoor: 0.2 } });
    if (area >= 9) P('secretaria', { prefs: { windowWall: 3, corner: 0.5 } });
    P('planta', { prefs: { cornerFree: 2 } });
  }

  if (room.type === 'sala') {
    const sofa = P('sofa', { sizes: [[2.4, 0.92], [2.2, 0.92], [1.8, 0.9], [1.5, 0.85]], prefs: { center: 1, longWall: 0.6, farDoor: 0.4, doorWallPenalty: 1 } });
    if (sofa) {
      const tvWall = oppositeWall(ROT_WALL[sofa.rot]);
      P('movel_tv', { sizes: [[1.8, 0.45], [1.6, 0.45], [1.2, 0.4]], walls: [tvWall], prefs: { opposite: 'sofa' } })
        || P('movel_tv', { sizes: [[1.6, 0.45], [1.2, 0.4]], prefs: { opposite: 'sofa' } });
      const mc = placeInFront(room, 'mesa_centro', items, sofa, 0.45, 1.0, 0.55) || placeInFront(room, 'mesa_centro', items, sofa, 0.4, 0.8, 0.5);
      if (mc) {
        const rug = newItem('tapete', { x: mc.x, z: mc.z, rot: sofa.rot, w: Math.min(sofa.w + 0.2, 2.4), d: 1.6 });
        const rr = itemRect(rug);
        if (inside(rr, rect(0, 0, room.w, room.l))) items.push(rug);
        if (area >= 14) P('poltrona', { prefs: { near: ['mesa_centro'], nearW: 2 } });
      }
    }
    if (area >= 16) P('mesa_jantar', { sizes: [[1.6, 1.8], [1.4, 1.7], [1.2, 1.6]], prefs: { open: 3, farDoor: 0.2 } });
    P('estante', { sizes: [[1.2, 0.35], [1.0, 0.35], [0.8, 0.35]], prefs: { corner: 1 } });
    P('planta', { prefs: { cornerFree: 2 } });
  }

  if (room.type === 'cozinha') {
    let done = false;
    for (const L of [3.6, 3.3, 3.0, 2.7, 2.4, 2.1, 1.8, 1.5, 1.2]) {
      const n = items.length;
      if (P('bancada', { sizes: [[L, 0.6]], prefs: { corner: 2, doorWallPenalty: 1 } }) && P('frigorifico', { prefs: { near: ['bancada'], nearW: 4 } })) { done = true; break; }
      items.length = n;
    }
    if (!done) P('bancada', { sizes: [[2.4, 0.6], [1.8, 0.6], [1.2, 0.6]], prefs: { corner: 2 } });
    if (area >= 9) P('mesa_jantar', { sizes: [[1.2, 1.6], [0.9, 1.5]], prefs: { open: 3 } });
  }

  if (room.type === 'escritorio') {
    P('secretaria', { sizes: [[1.4, 0.7], [1.2, 0.6], [1.0, 0.6]], prefs: { windowWall: 3, center: 0.5 } });
    P('estante', { sizes: [[1.6, 0.35], [1.2, 0.35], [0.8, 0.35]], prefs: { corner: 1, longWall: 0.2 } });
    if (area >= 8) P('poltrona', { prefs: { cornerFree: 1 } });
    P('planta', { prefs: { cornerFree: 2 } });
  }

  room.items = items;
  return items;
}

// Add one piece to an existing room at the best free spot (or the centre if nothing fits).
export function addItemAuto(room, kind) {
  const items = [...room.items];
  const prefs = { tapete: {}, mesa_cabeceira: { near: ['cama_casal', 'cama_solteiro'], nearW: 6 }, planta: { cornerFree: 2 },
    sanita: { near: ['lavatorio'] }, toalheiro: { near: ['base_duche', 'banheira'] } }[kind] || { open: 1 };
  const it = placeOne(room, kind, items, { prefs });
  if (it) { room.items.push(it); return it; }
  const c = CATALOG[kind];
  const fallback = newItem(kind, { x: r2(room.w / 2), z: r2(room.l / 2), w: Math.min(c.w, room.w), d: Math.min(c.d, room.l) });
  room.items.push(fallback);
  return fallback;
}

// Check that every opening fits its wall.
export function validateOpenings(room) {
  const problems = [];
  for (const o of [...room.doors, ...room.windows]) {
    const L = wallLength(room, o.wall);
    if (o.off < -EPS || o.off + o.width > L + EPS) problems.push(o.id);
  }
  return problems;
}

// ---------- Example project: the 1,70 × 2,10 bathroom plus neighbours ----------
export function exampleProject() {
  const wc = newRoom({ name: 'Casa de banho', type: 'wc', w: 1.7, l: 2.1, x: 0, z: 0, style: 'calacatta',
    doors: [newDoor({ wall: 'D', off: 1.25, width: 0.7, kind: 'correr_emb', hinge: 'start' })] });
  const q = newRoom({ name: 'Quarto', type: 'quarto', w: 3.2, l: 3.6, x: 1.7 + T, z: 0, style: 'nordico',
    doors: [newDoor({ wall: 'C', off: 0.2, width: 0.8, swing: 'in', hinge: 'start' })],
    windows: [newWindow({ wall: 'A', off: 1.0, width: 1.2 })] });
  const s = newRoom({ name: 'Sala', type: 'sala', w: 4.2, l: 4.5, x: 1.7 + 3.2 + 2 * T, z: 0, style: 'japandi',
    doors: [newDoor({ wall: 'C', off: 0.3, width: 0.9, swing: 'in', hinge: 'start' })],
    windows: [newWindow({ wall: 'A', off: 1.0, width: 2.0, sill: 0.4, height: 1.8 }), newWindow({ wall: 'B', off: 1.5, width: 1.2 })] });
  [wc, q, s].forEach(r => { autoFurnish(r); r.auto = true; });
  return { name: 'Exemplo', rooms: [wc, q, s] };
}
