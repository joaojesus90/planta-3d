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
    this.drag = null; this.lastTap = 0; this.ptrs = new Map(); this.pinch = null; this.userView = null; this.rectDraft = null;
    this.svg.addEventListener('wheel', e => this.wheel(e), { passive: false });
    this.svg.addEventListener('pointerdown', e => this.down(e));
    this.svg.addEventListener('pointermove', e => this.move(e));
    this.svg.addEventListener('pointerup', e => this.up(e));
    this.svg.addEventListener('pointercancel', e => this.up(e));
  }

  pt(e) { const p = this.svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(this.svg.getScreenCTM().inverse()); }

  render(project, mode, roomId, sel, ext = {}) {
    const key = mode + (roomId || '');
    if (key !== this.key) { this.userView = null; this.key = key; }
    this.project = project; this.mode = mode; this.roomId = roomId; this.sel = sel; this.ext = ext;
    const svg = this.svg; svg.innerHTML = '';
    const rooms = mode === 'house' ? project.rooms : project.rooms.filter(r => r.id === roomId);
    const tr = mode === 'house' && ext.trace && ext.trace.show ? ext.trace : null;
    if (!rooms.length && !tr) { this.fit = { x0: 0, z0: 0, w: 10, h: 6 }; svg.setAttribute('viewBox', '0 0 10 6'); el('text', { x: 5, y: 3, 'font-size': 0.35, 'text-anchor': 'middle', fill: '#8a8f94' }, svg).textContent = 'Ainda não há divisões. Toca em “+ Divisão”.'; return; }
    const xs = rooms.flatMap(r => [r.x, r.x + r.w]), zs = rooms.flatMap(r => [r.z, r.z + r.l]);
    if (tr) for (const [px, pz] of [[0, 0], [tr.iw, 0], [0, tr.ih], [tr.iw, tr.ih]]) { const q = traceToWorld(tr, px, pz); xs.push(q.x); zs.push(q.z); }
    const m = mode === 'house' ? 0.6 : 0.95;
    const x0 = Math.min(...xs) - m, x1 = Math.max(...xs) + m, span = Math.max(...zs) - Math.min(...zs) + 2 * m;
    const z0 = Math.min(...zs) - m - span * 0.22, z1 = Math.max(...zs) + m + span * 0.08;   // room for the toolbar and the hint
    this.fit = { x0, z0, w: x1 - x0, h: z1 - z0 };
    const v = this.userView || this.fit;
    svg.setAttribute('viewBox', `${v.x0} ${v.z0} ${v.w} ${v.h}`);
    this.k = Math.max(v.w, v.h) / 12;   // text scale follows the zoom
    const defs = el('defs', {}, svg);
    defs.innerHTML = `<pattern id="hatch" width="0.08" height="0.08" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="0.08" height="0.08" fill="#e6f0f5"/><line x1="0" y1="0" x2="0" y2="0.08" stroke="#c6dce7" stroke-width="0.02"/></pattern>
      <marker id="arw" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#6b7177"/></marker>`;

    if (tr) el('image', { href: tr.img, x: 0, y: 0, width: tr.iw, height: tr.ih, preserveAspectRatio: 'none', opacity: tr.op, 'pointer-events': 'none',
      transform: `translate(${tr.x} ${tr.z}) rotate(${tr.rot}) scale(${tr.s})` }, svg);
    // floors
    for (const r of rooms) {
      const gR = el('g', { 'data-room': r.id }, svg);
      el('rect', { x: r.x, y: r.z, width: r.w, height: r.l, fill: r.type === 'wc' ? '#f1f5f7' : '#faf8f4', 'fill-opacity': tr ? 0.55 : 1, class: 'floor' }, gR);
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
    if (mode === 'house' && this.ext?.tool !== 'calib') this.drawHandles(svg);
    this.drawTool(svg);
  }

  drawHandles(svg) {
    const r = this.project.rooms.find(o => o.id === this.sel?.roomId); if (!r) return;
    const k = this.k, g = el('g', {}, svg);
    el('rect', { x: r.x, y: r.z, width: r.w, height: r.l, fill: 'none', stroke: '#2f6f8f', 'stroke-width': k * 0.035, 'stroke-dasharray': `${k * 0.12} ${k * 0.08}`, 'pointer-events': 'none' }, g);
    const x0 = r.x, x1 = r.x + r.w, z0 = r.z, z1 = r.z + r.l, xm = (x0 + x1) / 2, zm = (z0 + z1) / 2;
    const H = [['nw', x0, z0], ['ne', x1, z0], ['sw', x0, z1], ['se', x1, z1], ['n', xm, z0], ['s', xm, z1], ['w', x0, zm], ['e', x1, zm]];
    for (const [h, x, z] of H) {
      const hg = el('g', { 'data-h': h, style: 'cursor:' + ({ n: 'ns', s: 'ns', e: 'ew', w: 'ew', nw: 'nwse', se: 'nwse', ne: 'nesw', sw: 'nesw' }[h]) + '-resize' }, g);
      el('circle', { cx: x, cy: z, r: k * 0.42, fill: 'transparent' }, hg);   // generous touch target
      if (h.length === 2) el('circle', { cx: x, cy: z, r: k * 0.15, fill: '#fff', stroke: '#2f6f8f', 'stroke-width': k * 0.05 }, hg);
      else el('rect', { x: x - k * 0.1, y: z - k * 0.1, width: k * 0.2, height: k * 0.2, rx: k * 0.03, fill: '#2f6f8f', stroke: '#fff', 'stroke-width': k * 0.03 }, hg);
    }
    if (this.drag?.kind === 'resize' && this.drag.moved) {
      const t = el('text', { x: xm, y: zm - k * 0.6, 'font-size': k * 0.4, 'text-anchor': 'middle', fill: '#2f6f8f', 'font-weight': 700, 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': k * 0.1, 'pointer-events': 'none' }, g);
      t.textContent = `${fmt(r.w)} × ${fmt(r.l)} m`;
    }
  }

  resizeTo(D, p) {
    const r = D.r, o = D.orig, q = this.snapPt(p, r), MIN = 0.5;
    let x0 = o.x, x1 = o.x + o.w, z0 = o.z, z1 = o.z + o.l;
    if (D.h.includes('w')) x0 = Math.min(q.x, x1 - MIN);
    if (D.h.includes('e')) x1 = Math.max(q.x, x0 + MIN);
    if (D.h.includes('n')) z0 = Math.min(q.z, z1 - MIN);
    if (D.h.includes('s')) z1 = Math.max(q.z, z0 + MIN);
    const dx = r2(x0 - o.x), dz = r2(z0 - o.z);
    r.x = r2(x0); r.z = r2(z0); r.w = r2(x1 - x0); r.l = r2(z1 - z0);
    // keep furniture and openings where they are in the house while the room grows or shrinks
    r.items.forEach((it, i) => { it.x = r2(D.items[i].x - dx); it.z = r2(D.items[i].z - dz); });
    [...r.doors, ...r.windows].forEach((op, i) => { op.off = r2(D.ops[i] - (op.wall === 'A' || op.wall === 'C' ? dx : dz)); });
  }

  finishResize(r) {
    for (const op of [...r.doors, ...r.windows]) {
      const L = wallLength(r, op.wall);
      if (op.width > L) op.width = r2(L);
      op.off = r2(Math.min(Math.max(0, op.off), L - op.width));
    }
    r.items = r.items.filter(it => { const q = itemRect(it); return q.x1 > 0 && q.z1 > 0 && q.x0 < r.w && q.z0 < r.l; });
    for (const it of r.items) {
      const q = itemRect(it), hw = (q.x1 - q.x0) / 2, hd = (q.z1 - q.z0) / 2;
      it.x = r2(Math.min(Math.max(hw, it.x), Math.max(hw, r.w - hw)));
      it.z = r2(Math.min(Math.max(hd, it.z), Math.max(hd, r.l - hd)));
    }
  }

  drawTool(svg) {
    const k = this.k, ext = this.ext || {};
    if (ext.tool === 'photo' && ext.trace) {
      const tr = ext.trace, C = [[0, 0], [tr.iw, 0], [tr.iw, tr.ih], [0, tr.ih]].map(([a, b]) => traceToWorld(tr, a, b));
      el('polygon', { points: C.map(q => `${q.x},${q.z}`).join(' '), fill: 'rgba(217,72,15,.04)', stroke: '#d9480f', 'stroke-width': k * 0.035, 'stroke-dasharray': `${k * 0.15} ${k * 0.1}`, 'pointer-events': 'none' }, svg);
      C.forEach((q, i) => {
        const g = el('g', { 'data-ph': i, style: 'cursor:nwse-resize' }, svg);
        el('circle', { cx: q.x, cy: q.z, r: k * 0.5, fill: 'transparent' }, g);
        el('circle', { cx: q.x, cy: q.z, r: k * 0.2, fill: '#d9480f', stroke: '#fff', 'stroke-width': k * 0.05 }, g);
      });
    }
    if (ext.tool === 'calib') {
      const pts = ext.toolPts || [];
      if (pts.length === 2) el('line', { x1: pts[0].x, y1: pts[0].z, x2: pts[1].x, y2: pts[1].z, stroke: '#d9480f', 'stroke-width': k * 0.05 }, svg);
      for (const q of pts) { el('circle', { cx: q.x, cy: q.z, r: k * 0.16, fill: 'rgba(217,72,15,.25)', stroke: '#d9480f', 'stroke-width': k * 0.04 }, svg); el('circle', { cx: q.x, cy: q.z, r: k * 0.03, fill: '#d9480f' }, svg); }
    }
    const d = this.rectDraft;
    if (d) {
      el('rect', { x: d.x0, y: d.z0, width: d.x1 - d.x0, height: d.z1 - d.z0, fill: 'rgba(47,111,143,.15)', stroke: '#2f6f8f', 'stroke-width': k * 0.04, 'stroke-dasharray': `${k * 0.15} ${k * 0.1}` }, svg);
      const t = el('text', { x: (d.x0 + d.x1) / 2, y: (d.z0 + d.z1) / 2, 'font-size': k * 0.4, 'text-anchor': 'middle', fill: '#2f6f8f', 'font-weight': 700, 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': k * 0.1 }, svg);
      t.textContent = `${fmt(d.x1 - d.x0)} × ${fmt(d.z1 - d.z0)} m`;
    }
  }

  fitView() { this.userView = null; }
  curView() { return this.userView || this.fit; }

  snapPt(p, exclude) {
    const tol = this.k * 0.15, rooms = this.project.rooms.filter(o => o !== exclude);
    const snap = (v, cands) => { let best = null; for (const c of cands) if (Math.abs(v - c) < tol && (best === null || Math.abs(v - c) < Math.abs(v - best))) best = c; return best ?? Math.round(v * 20) / 20; };
    return { x: r2(snap(p.x, rooms.flatMap(o => [o.x - T, o.x + o.w + T, o.x, o.x + o.w]))), z: r2(snap(p.y ?? p.z, rooms.flatMap(o => [o.z - T, o.z + o.l + T, o.z, o.z + o.l]))) };
  }

  wheel(e) {
    e.preventDefault();
    const sc = Math.exp(e.deltaY * 0.0015), ctm = this.svg.getScreenCTM(), v0 = this.curView(), w = this.pt(e);
    this.userView = this.zoomed(v0, ctm, sc, w, { x: e.clientX, y: e.clientY });
    this.cb.dragging();
  }
  // New view so that world point w sits under client point c, after scaling by sc.
  zoomed(v0, ctm, sc, w, c) {
    const a2 = ctm.a / sc, d2 = ctm.d / sc;
    return { x0: w.x - (c.x - ctm.e - ctm.a * v0.x0) / a2, z0: w.y - (c.y - ctm.f - ctm.d * v0.z0) / d2, w: v0.w * sc, h: v0.h * sc };
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
    // draggable areas (room view, or the selected room in the house view)
    const active = this.mode === 'room' || this.sel?.roomId === r.id;
    if (!active || this.ext?.tool === 'calib' || this.ext?.tool === 'photo') return;
    const k = this.k;
    for (const o of [...r.doors, ...r.windows]) {
      const on = this.sel?.opId === o.id;
      band(o.wall, o.off, o.off + o.width, -T - k * 0.12, Math.max(0.25, k * 0.35), { fill: on ? 'rgba(217,72,15,.16)' : 'rgba(47,111,143,.06)', stroke: on ? '#d9480f' : 'rgba(47,111,143,.35)',
        'stroke-width': k * (on ? 0.035 : 0.02), 'stroke-dasharray': on ? '' : `${k * 0.08} ${k * 0.06}`, 'data-op': o.id, 'data-oroom': r.id, style: 'cursor:grab' });
    }
    const so = [...r.doors, ...r.windows].find(o => o.id === this.sel?.opId);
    if (so && this.mode === 'house') this.drawOpLabels(r, so, svg, true);
  }

  drawOpLabels(r, op, svg, big) {
    const k = this.k, fs = k * 0.36 * (big ? 1.15 : 0.8);
    const Lw = wallLength(r, op.wall), a = op.off, b = Lw - op.off - op.width, [e0, e1] = { A: ['D', 'B'], C: ['D', 'B'], B: ['A', 'C'], D: ['A', 'C'] }[op.wall];
    const o = k * (big ? 0.42 : 0.3);
    const pos = (s) => ({ A: [r.x + s, r.z - o], C: [r.x + s, r.z + r.l + o + fs * 0.35], D: [r.x - o, r.z + s], B: [r.x + r.w + o, r.z + s] }[op.wall]);
    const rot = (op.wall === 'B' || op.wall === 'D') ? -90 : 0;
    const tx = (x, y, str, attrs) => { const t = el('text', { x, y, 'font-size': fs, 'text-anchor': 'middle', transform: rot ? `rotate(${rot} ${x} ${y})` : '', 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': fs * 0.25, 'pointer-events': 'none', ...attrs }, svg); t.textContent = str; };
    const col = big ? '#d9480f' : '#8b6b45';
    if (a > 0.02) { const [x, y] = pos(a / 2); tx(x, y, big ? `${fmt(a)} ↔ ${e0}` : fmt(a), { fill: col, 'font-weight': big ? 700 : 400 }); }
    if (b > 0.02) { const [x, y] = pos(op.off + op.width + b / 2); tx(x, y, big ? `${fmt(b)} ↔ ${e1}` : fmt(b), { fill: col, 'font-weight': big ? 700 : 400 }); }
    const [x, y] = pos(op.off + op.width / 2); tx(x, y, fmt(op.width), { fill: op.sill !== undefined ? '#4f9fc4' : '#2f6f8f', 'font-weight': 700 });
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
    for (const op of [...r.doors, ...r.windows]) this.drawOpLabels(r, op, svg, op.id === this.sel?.opId);
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
    try { this.svg.setPointerCapture(e.pointerId); } catch (err) { }
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.ptrs.size === 2) {
      if (this.drag?.moved && ['room', 'item', 'op', 'resize'].includes(this.drag.kind)) this.cb.changed({ kind: this.drag.kind, room: this.drag.r });
      this.drag = null; this.rectDraft = null;
      const [a, b] = [...this.ptrs.values()], ctm = this.svg.getScreenCTM();
      const m0 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const w = { x: (m0.x - ctm.e) / ctm.a, y: (m0.y - ctm.f) / ctm.d };
      this.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), v0: { ...this.curView() }, ctm, w };
      return;
    }
    if (this.ptrs.size > 2) return;
    const p = this.pt(e), tool = this.mode === 'house' ? this.ext?.tool : null;
    if (!this.userView && this.fit) this.userView = { ...this.fit };   // keep the view still while editing
    if (tool === 'photo' && this.ext?.trace) {
      const tr = this.ext.trace, ph = e.target.closest('[data-ph]');
      if (ph) {
        const C = [[0, 0], [tr.iw, 0], [tr.iw, tr.ih], [0, tr.ih]], i = +ph.getAttribute('data-ph'), ap = C[(i + 2) % 4];
        const aw = traceToWorld(tr, ap[0], ap[1]), cw = traceToWorld(tr, C[i][0], C[i][1]);
        this.drag = { kind: 'phScale', tr, s0: tr.s, ap, aw, d0: Math.hypot(cw.x - aw.x, cw.z - aw.z), moved: false, sx: e.clientX, sy: e.clientY };
      } else this.drag = { kind: 'phMove', tr, px: p.x, pz: p.y, ox: tr.x, oz: tr.z, moved: false, sx: e.clientX, sy: e.clientY };
      return;
    }
    const pan = (onTap) => { this.drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, v0: { ...this.curView() }, ctm: this.svg.getScreenCTM(), moved: false, onTap }; };
    const hEl = tool !== 'calib' && this.mode === 'house' && e.target.closest('[data-h]');
    if (hEl) {
      const r = this.project.rooms.find(o => o.id === this.sel?.roomId);
      if (r) { this.drag = { kind: 'resize', h: hEl.getAttribute('data-h'), r, orig: { x: r.x, z: r.z, w: r.w, l: r.l }, items: r.items.map(i => ({ x: i.x, z: i.z })), ops: [...r.doors, ...r.windows].map(o => o.off), moved: false, sx: e.clientX, sy: e.clientY }; return; }
    }
    const opEl = tool !== 'calib' && e.target.closest('[data-op]');
    if (opEl) {
      const r = this.project.rooms.find(o => o.id === opEl.getAttribute('data-oroom'));
      const op = r && [...r.doors, ...r.windows].find(o => o.id === opEl.getAttribute('data-op'));
      if (op) { this.drag = { kind: 'op', r, op, moved: false, sx: e.clientX, sy: e.clientY }; this.cb.selectOp?.(r.id, op.id); return; }
    }
    if (tool === 'calib') { this.drag = { kind: 'tap', sx: e.clientX, sy: e.clientY, p: { x: p.x, z: p.y }, moved: false }; return; }
    if (tool === 'rect') { this.drag = { kind: 'rect', p0: this.snapPt(p), moved: false, sx: e.clientX, sy: e.clientY }; return; }
    const itemEl = e.target.closest('[data-item]');
    if (this.mode === 'room') {
      const r = this.project.rooms.find(x => x.id === this.roomId);
      const id = itemEl?.getAttribute('data-item');
      if (id && r) {
        const it = r.items.find(i => i.id === id);
        this.drag = { kind: 'item', it, r, sx: p.x, sy: p.y, ox: it.x, oz: it.z, moved: false };
        this.cb.selectItem(id);
      } else pan(() => this.cb.selectItem(null));
      return;
    }
    const r = [...this.project.rooms].reverse().find(r => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.z && p.y <= r.z + r.l);
    if (!r) { pan(() => this.cb.selectRoom(null)); return; }
    const now = Date.now();
    if (now - this.lastTap < 350 && this.lastRoom === r.id) { this.cb.openRoom(r.id); this.lastTap = 0; return; }
    this.lastTap = now; this.lastRoom = r.id;
    this.drag = { kind: 'room', r, sx: p.x, sy: p.y, ox: r.x, oz: r.z, moved: false };
    this.cb.selectRoom(r.id);
  }

  move(e) {
    if (!this.ptrs.has(e.pointerId)) return;
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinch && this.ptrs.size === 2) {
      const [a, b] = [...this.ptrs.values()], P = this.pinch;
      const sc = Math.min(8, Math.max(0.05, P.d0 / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))));
      this.userView = this.zoomed(P.v0, P.ctm, sc, P.w, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      this.cb.dragging(); return;
    }
    const D = this.drag; if (!D) return;
    if (D.kind === 'op' || D.kind === 'phMove' || D.kind === 'phScale') {
      if (!D.moved && Math.hypot(e.clientX - D.sx, e.clientY - D.sy) < 4) return;
      if (!D.moved && D.kind === 'op') this.cb.startDrag?.();
      D.moved = true;
      const p = this.pt(e);
      if (D.kind === 'op') this.moveOpening(D.r, D.op, p.x - D.r.x, p.y - D.r.z);
      if (D.kind === 'phMove') { D.tr.x = D.ox + p.x - D.px; D.tr.z = D.oz + p.y - D.pz; }
      if (D.kind === 'phScale') {
        const f = Math.hypot(p.x - D.aw.x, p.y - D.aw.z) / Math.max(1e-6, D.d0);
        D.tr.s = Math.max(D.s0 * 0.05, D.s0 * f);
        const t0 = traceToWorld({ ...D.tr, x: 0, z: 0 }, D.ap[0], D.ap[1]);
        D.tr.x = D.aw.x - t0.x; D.tr.z = D.aw.z - t0.z;
      }
      this.cb.dragging(); return;
    }
    if (D.kind === 'resize') {
      if (!D.moved && Math.hypot(e.clientX - D.sx, e.clientY - D.sy) < 4) return;
      if (!D.moved) this.cb.startDrag?.();
      D.moved = true; this.resizeTo(D, this.pt(e)); this.cb.dragging(); return;
    }
    if (D.kind === 'pan' || D.kind === 'tap' || D.kind === 'rect') {
      const px = Math.hypot(e.clientX - D.sx, e.clientY - D.sy);
      if (!D.moved && px < 6) return;
      D.moved = true;
      if (D.kind === 'pan') {
        const v0 = D.v0;
        this.userView = { x0: v0.x0 - (e.clientX - D.sx) / D.ctm.a, z0: v0.z0 - (e.clientY - D.sy) / D.ctm.d, w: v0.w, h: v0.h };
        this.cb.dragging();
      }
      if (D.kind === 'rect') { const q = this.snapPt(this.pt(e)); this.rectDraft = rect(D.p0.x, D.p0.z, q.x, q.z); this.cb.dragging(); }
      return;
    }
    const p = this.pt(e);
    const dx = p.x - D.sx, dz = p.y - D.sy;
    if (!D.moved && Math.hypot(dx, dz) < this.k * 0.1) return;
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
    this.ptrs.delete(e.pointerId);
    if (this.pinch) { if (this.ptrs.size < 2) this.pinch = null; this.drag = null; return; }
    const D = this.drag; this.drag = null;
    if (!D) return;
    if (D.kind === 'tap') { if (!D.moved) this.cb.toolPoint?.(D.p); return; }
    if (D.kind === 'resize') { if (D.moved) { this.finishResize(D.r); this.cb.changed({ kind: 'resize', room: D.r }); } return; }
    if (D.kind === 'op') { if (D.moved) this.cb.changed({ kind: 'op', room: D.r }); else this.cb.opTapped?.(); return; }
    if (D.kind === 'phMove' || D.kind === 'phScale') { if (D.moved) this.cb.traceChanged?.(); return; }
    if (D.kind === 'pan') { if (!D.moved) D.onTap?.(); return; }
    if (D.kind === 'rect') {
      const r = this.rectDraft; this.rectDraft = null;
      if (r && r.x1 - r.x0 >= 0.5 && r.z1 - r.z0 >= 0.5) this.cb.rectDrawn?.(r);
      else if (!D.moved) {
        const hit = [...this.project.rooms].reverse().find(o => D.p0.x >= o.x - 0.05 && D.p0.x <= o.x + o.w + 0.05 && D.p0.z >= o.z - 0.05 && D.p0.z <= o.z + o.l + 0.05);
        this.cb.selectRoom(hit ? hit.id : null);
      } else { this.cb.dragging(); if (D.moved) this.cb.toast?.('Arrasta de um canto da divisão até ao canto oposto (mínimo 0,50 m).'); }
      return;
    }
    if (D.moved) this.cb.changed({ kind: D.kind, room: D.r });
  }

  // Slide an opening along the walls: it follows the pointer and jumps to the nearest wall.
  moveOpening(r, op, lx, lz) {
    const cands = [['A', Math.abs(lz), lx], ['C', Math.abs(lz - r.l), lx], ['D', Math.abs(lx), lz], ['B', Math.abs(lx - r.w), lz]]
      .filter(([w]) => wallLength(r, w) >= op.width).sort((a, b) => a[1] - b[1]);
    if (!cands.length) return;
    const [wall, , s] = cands[0], L = wallLength(r, wall);
    let off = Math.round((s - op.width / 2) * 20) / 20;
    if (off < 0.06) off = 0; if (L - op.width - off < 0.06) off = L - op.width;
    op.wall = wall; op.off = r2(Math.min(Math.max(0, off), L - op.width));
  }
}

export function traceToWorld(tr, px, pz) {
  const a = tr.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return { x: tr.x + tr.s * (px * c - pz * s), z: tr.z + tr.s * (px * s + pz * c) };
}

function validate(r) {
  const out = [];
  for (const o of [...r.doors, ...r.windows]) { const L = wallLength(r, o.wall); if (o.off < -0.001 || o.off + o.width > L + 0.001) out.push(o.id); }
  return out;
}
