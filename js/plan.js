// 2D plan (SVG, units in metres). House mode: drag rooms. Room mode: drag furniture.
import { T, CATALOG, itemRect, fits, doorZones, wallLength, showerEntry, overlap, rect, r2 } from './model.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e); return e;
};
const fmt = v => (Math.round(v * 100) / 100).toFixed(2).replace('.', ',');
const LABEL = { base_duche: 'Duche', banheira: 'Banheira', sanita: 'Sanita', lavatorio: 'Lavatório', toalheiro: '', cama_casal: 'Cama', cama_solteiro: 'Cama',
  mesa_cabeceira: '', roupeiro: 'Roupeiro', comoda: 'Cómoda', secretaria: 'Secretária', estante: 'Estante', sofa: 'Sofá', poltrona: '', mesa_centro: '',
  movel_tv: 'TV', mesa_jantar: 'Mesa', tapete: '', bancada: 'Bancada', frigorifico: 'Frigo', planta: '' };

export class PlanView {
  constructor(host, cb) {
    this.host = host; this.cb = cb;
    this.svg = el('svg', { width: '100%', height: '100%' }, host);
    this.svg.style.touchAction = 'none';
    this.drag = null; this.lastTap = 0;
    this.svg.addEventListener('pointerdown', e => this.down(e));
    this.svg.addEventListener('pointermove', e => this.move(e));
    this.svg.addEventListener('pointerup', e => this.up(e));
    this.svg.addEventListener('pointercancel', e => this.up(e));
  }

  pt(e) { const p = this.svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(this.svg.getScreenCTM().inverse()); }

  render(project, mode, roomId, sel) {
    this.project = project; this.mode = mode; this.roomId = roomId; this.sel = sel;
    const svg = this.svg; svg.innerHTML = '';
    const rooms = mode === 'house' ? project.rooms : project.rooms.filter(r => r.id === roomId);
    if (!rooms.length) { svg.setAttribute('viewBox', '0 0 10 6'); el('text', { x: 5, y: 3, 'font-size': 0.35, 'text-anchor': 'middle', fill: '#8a8f94' }, svg).textContent = 'Ainda não há divisões. Toca em “+ Divisão”.'; return; }
    const xs = rooms.flatMap(r => [r.x, r.x + r.w]), zs = rooms.flatMap(r => [r.z, r.z + r.l]);
    const m = mode === 'house' ? 0.6 : 0.95;
    const x0 = Math.min(...xs) - m, z0 = Math.min(...zs) - m, x1 = Math.max(...xs) + m, z1 = Math.max(...zs) + m;
    svg.setAttribute('viewBox', `${x0} ${z0} ${x1 - x0} ${z1 - z0}`);
    this.k = Math.max(x1 - x0, z1 - z0) / 12;   // text scale
    const defs = el('defs', {}, svg);
    defs.innerHTML = `<pattern id="hatch" width="0.08" height="0.08" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="0.08" height="0.08" fill="#e6f0f5"/><line x1="0" y1="0" x2="0" y2="0.08" stroke="#c6dce7" stroke-width="0.02"/></pattern>
      <marker id="arw" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#6b7177"/></marker>`;

    // floors
    for (const r of rooms) {
      const gR = el('g', { 'data-room': r.id }, svg);
      el('rect', { x: r.x, y: r.z, width: r.w, height: r.l, fill: r.type === 'wc' ? '#f1f5f7' : '#faf8f4', class: 'floor' }, gR);
      if (mode === 'house' && sel?.roomId === r.id) el('rect', { x: r.x, y: r.z, width: r.w, height: r.l, fill: 'rgba(47,111,143,.08)', stroke: '#2f6f8f', 'stroke-width': 0.03 }, gR);
    }
    // furniture (both modes; non-interactive in house mode)
    for (const r of rooms) this.drawItems(r, svg, mode === 'room');
    // walls
    const wallG = el('g', { fill: '#3a3f45' }, svg);
    for (const r of rooms) {
      el('rect', { x: r.x - T / 2, y: r.z - T / 2, width: r.w + T, height: T / 2 }, wallG);
      el('rect', { x: r.x - T / 2, y: r.z + r.l, width: r.w + T, height: T / 2 }, wallG);
      el('rect', { x: r.x - T / 2, y: r.z, width: T / 2, height: r.l }, wallG);
      el('rect', { x: r.x + r.w, y: r.z, width: T / 2, height: r.l }, wallG);
    }
    for (const r of rooms) this.drawOpenings(r, svg);
    // overlaps between rooms
    if (mode === 'house') {
      for (const a of rooms) for (const b of rooms) if (a !== b && a.id < b.id && overlap(rect(a.x, a.z, a.x + a.w, a.z + a.l), rect(b.x, b.z, b.x + b.w, b.z + b.l), 0.01)) {
        const o = rect(Math.max(a.x, b.x), Math.max(a.z, b.z), Math.min(a.x + a.w, b.x + b.w), Math.min(a.z + a.l, b.z + b.l));
        el('rect', { x: o.x0, y: o.z0, width: o.x1 - o.x0, height: o.z1 - o.z0, fill: 'rgba(200,50,40,.25)', stroke: '#c83228', 'stroke-width': 0.02 }, svg);
      }
      for (const r of rooms) {
        const fs = Math.min(this.k * 0.42, r.w * 0.11), fs2 = Math.min(this.k * 0.32, r.w * 0.085);
        const t = el('text', { x: r.x + r.w / 2, y: r.z + r.l / 2, 'font-size': fs, 'text-anchor': 'middle', fill: '#23272b', 'font-weight': 600, 'pointer-events': 'none', 'paint-order': 'stroke', stroke: 'rgba(255,255,255,.85)', 'stroke-width': this.k * 0.12 }, svg);
        t.textContent = r.name;
        const t2 = el('text', { x: r.x + r.w / 2, y: r.z + r.l / 2 + fs * 1.2, 'font-size': fs2, 'text-anchor': 'middle', fill: '#555', 'pointer-events': 'none', 'paint-order': 'stroke', stroke: 'rgba(255,255,255,.85)', 'stroke-width': this.k * 0.1 }, svg);
        t2.textContent = `${fmt(r.w)} × ${fmt(r.l)} m · ${fmt(r.w * r.l)} m²`;
      }
    } else this.drawDims(rooms[0], svg);
  }

  drawOpenings(r, svg) {
    const P = (wall, s, n = 0) => {
      switch (wall) {
        case 'A': return [r.x + s, r.z + n];
        case 'C': return [r.x + s, r.z + r.l - n];
        case 'D': return [r.x + n, r.z + s];
        case 'B': return [r.x + r.w - n, r.z + s];
      }
    };
    const band = (wall, s0, s1, n0, n1, attrs) => {
      const [ax, az] = P(wall, s0, n0), [bx, bz] = P(wall, s1, n1);
      return el('rect', { x: Math.min(ax, bx), y: Math.min(az, bz), width: Math.abs(bx - ax), height: Math.abs(bz - az), ...attrs }, svg);
    };
    const line = (a, b, attrs) => el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], ...attrs }, svg);
    const bad = new Set(validate(r));
    for (const d of r.doors) {
      const col = bad.has(d.id) ? '#c83228' : '#8b6b45';
      band(d.wall, d.off, d.off + d.width, -T, 0.002, { fill: '#fff' });
      if (d.kind === 'batente') {
        const hs = d.hinge === 'end' ? d.off + d.width : d.off, os = d.hinge === 'end' ? d.off : d.off + d.width;
        const n = d.swing === 'out' ? -1 : 1;
        const h = P(d.wall, hs), tip = P(d.wall, hs, n * d.width), start = P(d.wall, os);
        line(h, tip, { stroke: col, 'stroke-width': 0.035 });
        // arc from closed tip to open tip
        const cross = (start[0] - h[0]) * (tip[1] - h[1]) - (start[1] - h[1]) * (tip[0] - h[0]);
        el('path', { d: `M${start[0]} ${start[1]} A${d.width} ${d.width} 0 0 ${cross > 0 ? 1 : 0} ${tip[0]} ${tip[1]}`, fill: 'none', stroke: '#a7a19a', 'stroke-width': 0.012, 'stroke-dasharray': '0.04 0.03' }, svg);
      } else if (d.kind === 'correr_emb') {
        const dir = d.hinge === 'end' ? 1 : -1, ps0 = dir < 0 ? d.off - d.width : d.off + d.width, ps1 = dir < 0 ? d.off : d.off + 2 * d.width;
        band(d.wall, Math.min(ps0, ps1), Math.max(ps0, ps1), -T * 0.85, -T * 0.15, { fill: '#fff', stroke: col, 'stroke-width': 0.012, 'stroke-dasharray': '0.03 0.02' });
        line(P(d.wall, d.off, -T / 2), P(d.wall, d.off + d.width, -T / 2), { stroke: col, 'stroke-width': 0.03 });
        const a = P(d.wall, d.off + d.width / 2, 0.15), b = P(d.wall, d.off + d.width / 2 + dir * d.width * 0.4, 0.15);
        line(a, b, { stroke: col, 'stroke-width': 0.012, 'marker-end': 'url(#arw)' });
      } else if (d.kind === 'correr_ext') {
        const dir = d.hinge === 'end' ? 1 : -1;
        line(P(d.wall, d.off - 0.03, 0.05), P(d.wall, d.off + d.width + 0.03, 0.05), { stroke: col, 'stroke-width': 0.03 });
        line(P(d.wall, d.off + d.width / 2, 0.18), P(d.wall, d.off + d.width / 2 + dir * d.width * 0.4, 0.18), { stroke: col, 'stroke-width': 0.012, 'marker-end': 'url(#arw)' });
      }
    }
    for (const w of r.windows) {
      const col = bad.has(w.id) ? '#c83228' : '#4f9fc4';
      band(w.wall, w.off, w.off + w.width, -T / 2, 0, { fill: '#fff', stroke: col, 'stroke-width': 0.01 });
      line(P(w.wall, w.off, -T / 4), P(w.wall, w.off + w.width, -T / 4), { stroke: col, 'stroke-width': 0.012 });
    }
  }

  drawItems(r, svg, interactive) {
    const zones = doorZones(r);
    for (const it of r.items) {
      const c = CATALOG[it.kind]; if (!c) continue;
      const selected = interactive && this.sel?.itemId === it.id;
      const bad = interactive && !fits(r, it, r.items, zones) && !c.floor;
      const g = el('g', { transform: `translate(${r.x + it.x} ${r.z + it.z}) rotate(${-it.rot}) scale(${it.flip && it.kind !== 'base_duche' ? -1 : 1} 1)`, 'data-item': interactive ? it.id : '', class: interactive ? 'item' : '' }, svg);
      const stroke = bad ? '#c83228' : selected ? '#2f6f8f' : '#8d877e', sw = selected || bad ? 0.03 : 0.012;
      const w = it.w, d = it.d, R = (x, y, ww, hh, a = {}) => el('rect', { x, y, width: ww, height: hh, rx: 0.02, fill: '#fff', stroke, 'stroke-width': sw, ...a }, g);
      const E = (cx, cy, rx, ry, a = {}) => el('ellipse', { cx, cy, rx, ry, fill: '#fff', stroke, 'stroke-width': sw, ...a }, g);
      const L = (x1, y1, x2, y2, a = {}) => el('line', { x1, y1, x2, y2, stroke, 'stroke-width': sw * 0.8, ...a }, g);
      switch (it.kind) {
        case 'base_duche': {
          R(-w / 2, -d / 2, w, d, { fill: 'url(#hatch)' });
          const [e0, e1] = showerEntry(it);
          const gx0 = it.flip ? -w / 2 : e1, gx1 = it.flip ? e0 : w / 2;
          if (gx1 - gx0 > 0.25) L(gx0, d / 2, gx1, d / 2, { stroke: '#4f9fc4', 'stroke-width': 0.035 });
          el('circle', { cx: 0, cy: 0, r: 0.04, fill: 'none', stroke: '#7aa7bd', 'stroke-width': 0.012 }, g);
          break; }
        case 'banheira': R(-w / 2, -d / 2, w, d); R(-w / 2 + 0.07, -d / 2 + 0.07, w - 0.14, d - 0.14, { rx: 0.15, fill: '#e6f0f5' }); break;
        case 'sanita': R(-0.18, -d / 2, 0.36, 0.18); E(0, d / 2 - 0.2, 0.18, 0.2); E(0, d / 2 - 0.2, 0.11, 0.13, { fill: 'none' }); break;
        case 'lavatorio': R(-w / 2, -d / 2, w, d, { fill: '#e8dccb' }); E(0, 0.03, Math.min(0.17, w * 0.32) * 1.2, 0.13); break;
        case 'cama_casal': case 'cama_solteiro': {
          R(-w / 2, -d / 2, w, d); R(-w / 2, -d / 2, w, 0.07, { fill: '#d9cfc0' });
          const n = it.kind === 'cama_casal' ? 2 : 1, pw = (w - 0.12) / n;
          for (let i = 0; i < n; i++) R(-w / 2 + 0.06 + i * pw + 0.03, -d / 2 + 0.12, pw - 0.06, 0.3);
          L(-w / 2, -d / 2 + 0.6, w / 2, -d / 2 + 0.6); break; }
        case 'sofa': R(-w / 2, -d / 2, w, d, { fill: '#ebe5dc' }); R(-w / 2, -d / 2, w, 0.2); R(-w / 2, -d / 2, 0.16, d); R(w / 2 - 0.16, -d / 2, 0.16, d); break;
        case 'poltrona': R(-w / 2, -d / 2, w, d, { fill: '#ebe5dc' }); R(-w / 2, -d / 2, w, 0.16); break;
        case 'mesa_jantar': {
          const td = Math.max(0.7, d - 0.9); R(-w / 2, -td / 2, w, td, { fill: '#e8dccb' });
          const n = Math.max(1, Math.floor(w / 0.6));
          for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n; R(x - 0.21, td / 2 + 0.05, 0.42, 0.42); R(x - 0.21, -td / 2 - 0.47, 0.42, 0.42); }
          break; }
        case 'tapete': R(-w / 2, -d / 2, w, d, { fill: 'none', 'stroke-dasharray': '0.05 0.04' }); break;
        case 'planta': el('circle', { cx: 0, cy: 0, r: w / 2, fill: '#dfe9d9', stroke, 'stroke-width': sw }, g); break;
        case 'bancada': R(-w / 2, -d / 2, w, d, { fill: '#eee9e2' }); R(-w / 4 - 0.25, -0.2, 0.5, 0.4, { fill: '#dfe3e6' });
          { const hx = w > 1.4 ? w / 4 : w / 2 - 0.35; for (const [x, z] of [[-0.14, -0.12], [0.14, -0.12], [-0.14, 0.12], [0.14, 0.12]]) el('circle', { cx: hx + x, cy: z, r: 0.07, fill: 'none', stroke, 'stroke-width': sw }, g); }
          break;
        case 'roupeiro': R(-w / 2, -d / 2, w, d, { fill: '#efeae3' }); L(-w / 2, -d / 2, w / 2, d / 2); L(-w / 2, d / 2, w / 2, -d / 2); break;
        case 'secretaria': R(-w / 2, -d / 2, w, d, { fill: '#e8dccb' }); R(-0.21, d / 2 - 0.16, 0.42, 0.42); break;
        case 'mesa_cabeceira': R(-w / 2, -d / 2, w, d, { fill: '#e8dccb' }); el('circle', { cx: 0, cy: -0.03, r: 0.1, fill: 'none', stroke, 'stroke-width': sw }, g); break;
        case 'movel_tv': R(-w / 2, -d / 2, w, d, { fill: '#e8dccb' }); L(-Math.min(1.45, w * 0.9) / 2, -d / 2 + 0.02, Math.min(1.45, w * 0.9) / 2, -d / 2 + 0.02, { stroke: '#222', 'stroke-width': 0.035 }); break;
        case 'estante': R(-w / 2, -d / 2, w, d, { fill: '#e8dccb' }); for (let i = 1; i < 4; i++) L(-w / 2 + i * w / 4, -d / 2, -w / 2 + i * w / 4, d / 2); break;
        case 'toalheiro': R(-w / 2, -d / 2, w, d, { fill: '#cfd4d8' }); break;
        default: R(-w / 2, -d / 2, w, d, { fill: '#f0ece6' });
      }
      if (interactive) R(-w / 2, -d / 2, w, d, { fill: 'transparent', stroke: 'none' });
      const lbl = LABEL[it.kind];
      if (lbl && Math.min(it.w, it.d) > 0.3) {
        const t = el('text', { x: r.x + it.x, y: r.z + it.z + 0.04, 'font-size': Math.min(0.13, this.k * 0.28), 'text-anchor': 'middle', fill: '#555', 'pointer-events': 'none', 'paint-order': 'stroke', stroke: 'rgba(255,255,255,.8)', 'stroke-width': 0.025 }, svg);
        t.textContent = lbl;
      }
    }
  }

  drawDims(r, svg) {
    const k = this.k, fs = k * 0.36;
    const g = el('g', { stroke: '#6b7177', 'stroke-width': 0.01, fill: 'none' }, svg);
    const tx = (x, y, s, rot = 0, a = {}) => { const t = el('text', { x, y, 'font-size': fs, 'text-anchor': 'middle', fill: '#3a3f45', transform: rot ? `rotate(${rot} ${x} ${y})` : '', ...a }, svg); t.textContent = s; return t; };
    const o = 0.42;
    el('line', { x1: r.x, y1: r.z - o, x2: r.x + r.w, y2: r.z - o, 'marker-start': 'url(#arw)', 'marker-end': 'url(#arw)' }, g);
    tx(r.x + r.w / 2, r.z - o - 0.05, `${fmt(r.w)} m`);
    el('line', { x1: r.x - o, y1: r.z, x2: r.x - o, y2: r.z + r.l, 'marker-start': 'url(#arw)', 'marker-end': 'url(#arw)' }, g);
    tx(r.x - o - 0.05, r.z + r.l / 2, `${fmt(r.l)} m`, -90);
    // wall letters
    const L = (x, y, s) => { el('circle', { cx: x, cy: y, r: fs * 0.85, fill: '#2f6f8f' }, svg); tx(x, y + fs * 0.35, s, 0, { fill: '#fff', 'font-weight': 700 }); };
    L(r.x + r.w / 2, r.z - 0.75, 'A'); L(r.x + r.w + 0.4, r.z + r.l / 2, 'B'); L(r.x + r.w / 2, r.z + r.l + 0.4, 'C'); L(r.x - 0.78, r.z + r.l / 2, 'D');
    // opening distances
    for (const op of [...r.doors, ...r.windows]) {
      const Lw = wallLength(r, op.wall), a = op.off, b = Lw - op.off - op.width;
      const pos = (s) => ({ A: [r.x + s, r.z - 0.16], C: [r.x + s, r.z + r.l + 0.13], D: [r.x - 0.1, r.z + s], B: [r.x + r.w + 0.1, r.z + s] }[op.wall]);
      const rot = (op.wall === 'B' || op.wall === 'D') ? -90 : 0;
      if (a > 0.04) { const [x, y] = pos(a / 2); tx(x, y, fmt(a), rot, { 'font-size': fs * 0.8, fill: '#8b6b45' }); }
      if (b > 0.04) { const [x, y] = pos(op.off + op.width + b / 2); tx(x, y, fmt(b), rot, { 'font-size': fs * 0.8, fill: '#8b6b45' }); }
      const [x, y] = pos(op.off + op.width / 2); tx(x, y, fmt(op.width), rot, { 'font-size': fs * 0.8, fill: op.sill !== undefined ? '#4f9fc4' : '#2f6f8f', 'font-weight': 700 });
    }
    // distances of the selected item to the walls
    const it = r.items.find(i => i.id === this.sel?.itemId);
    if (it) {
      const q = itemRect(it), dg = el('g', { stroke: '#2f6f8f', 'stroke-width': 0.01, 'stroke-dasharray': '0.03 0.02' }, svg);
      const cx = r.x + (q.x0 + q.x1) / 2, cz = r.z + (q.z0 + q.z1) / 2;
      const seg = (x1, y1, x2, y2, v, tx0, ty0) => { if (v < 0.03) return; el('line', { x1, y1, x2, y2 }, dg); tx(tx0, ty0, fmt(v), 0, { 'font-size': fs * 0.8, fill: '#2f6f8f', 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': 0.03 }); };
      seg(cx, r.z, cx, r.z + q.z0, q.z0, cx + 0.12, r.z + q.z0 / 2);
      seg(cx, r.z + q.z1, cx, r.z + r.l, r.l - q.z1, cx + 0.12, r.z + (q.z1 + r.l) / 2);
      seg(r.x, cz, r.x + q.x0, cz, q.x0, r.x + q.x0 / 2, cz - 0.05);
      seg(r.x + q.x1, cz, r.x + r.w, cz, r.w - q.x1, r.x + (q.x1 + r.w) / 2, cz - 0.05);
    }
  }

  // ---------- interaction ----------
  down(e) {
    const p = this.pt(e);
    const itemEl = e.target.closest('[data-item]');
    if (this.mode === 'room') {
      const r = this.project.rooms.find(x => x.id === this.roomId);
      const id = itemEl?.getAttribute('data-item');
      if (id) {
        const it = r.items.find(i => i.id === id);
        this.drag = { kind: 'item', it, r, sx: p.x, sy: p.y, ox: it.x, oz: it.z, moved: false };
        this.svg.setPointerCapture(e.pointerId);
        this.cb.selectItem(id);
      } else this.cb.selectItem(null);
      return;
    }
    // house: find room under pointer (topmost)
    const r = [...this.project.rooms].reverse().find(r => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.z && p.y <= r.z + r.l);
    if (!r) { this.cb.selectRoom(null); return; }
    const now = Date.now();
    if (now - this.lastTap < 350 && this.lastRoom === r.id) { this.cb.openRoom(r.id); this.lastTap = 0; return; }
    this.lastTap = now; this.lastRoom = r.id;
    this.drag = { kind: 'room', r, sx: p.x, sy: p.y, ox: r.x, oz: r.z, moved: false };
    this.svg.setPointerCapture(e.pointerId);
    this.cb.selectRoom(r.id);
  }

  move(e) {
    if (!this.drag) return;
    const p = this.pt(e), D = this.drag;
    const dx = p.x - D.sx, dz = p.y - D.sy;
    if (!D.moved && Math.hypot(dx, dz) < 0.04) return;
    if (!D.moved) this.cb.startDrag?.();
    D.moved = true;
    if (D.kind === 'room') {
      let x = Math.round((D.ox + dx) * 20) / 20, z = Math.round((D.oz + dz) * 20) / 20;
      const snap = 0.2;
      let bx = null, bz = null;
      for (const o of this.project.rooms) {
        if (o === D.r) continue;
        for (const cx of [o.x + o.w + T, o.x - D.r.w - T, o.x, o.x + o.w - D.r.w]) if (Math.abs(x - cx) < snap && (bx === null || Math.abs(x - cx) < Math.abs(x - bx))) bx = cx;
        for (const cz of [o.z + o.l + T, o.z - D.r.l - T, o.z, o.z + o.l - D.r.l]) if (Math.abs(z - cz) < snap && (bz === null || Math.abs(z - cz) < Math.abs(z - bz))) bz = cz;
      }
      D.r.x = r2(bx ?? x); D.r.z = r2(bz ?? z);
    } else {
      const { it, r } = D, q = itemRect(it), hw = (q.x1 - q.x0) / 2, hd = (q.z1 - q.z0) / 2;
      let x = Math.round((D.ox + dx) * 20) / 20, z = Math.round((D.oz + dz) * 20) / 20;
      x = Math.min(r.w - hw, Math.max(hw, x)); z = Math.min(r.l - hd, Math.max(hd, z));
      if (x - hw < 0.1) x = hw; if (r.w - x - hw < 0.1) x = r.w - hw;
      if (z - hd < 0.1) z = hd; if (r.l - z - hd < 0.1) z = r.l - hd;
      it.x = r2(x); it.z = r2(z);
    }
    this.cb.dragging();
  }

  up(e) {
    if (!this.drag) return;
    const moved = this.drag.moved; this.drag = null;
    if (moved) this.cb.changed();
  }
}

function validate(r) {
  const out = [];
  for (const o of [...r.doors, ...r.windows]) { const L = wallLength(r, o.wall); if (o.off < -0.001 || o.off + o.width > L + 0.001) out.push(o.id); }
  return out;
}
