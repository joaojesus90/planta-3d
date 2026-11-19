import * as Mdl from './model.js';
import { PlanView, traceToWorld } from './plan.js';
import { View3D } from './scene3d.js';

const { ROOM_TYPES, WALL_INFO, DOOR_KINDS, CATALOG, STYLES, T, newRoom, newDoor, newWindow, autoFurnish, addItemAuto,
  wallLength, styleById, r2, exampleProject, itemRect, doorZones, fits, uid } = Mdl;

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
const fmt = v => (Math.round(v * 100) / 100).toString().replace('.', ',');
const KEY = 'planta3d-v1';

const S = {
  project: null, mode: 'house', roomId: null, sel: { roomId: null, itemId: null },
  view: '3d', tab: 'medidas', trace: null, tool: null, toolPts: [], doorsOpen: true, wallCut: true, wallAll: false, undo: [], camKey: '', dirty3d: true,
};
const room = () => S.project.rooms.find(r => r.id === S.roomId);

// ---------- persistence ----------
function save() { try { localStorage.setItem(KEY, JSON.stringify(S.project)); } catch (e) { } }
function load() { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function snapshot() { S.undo.push(JSON.stringify(S.project)); if (S.undo.length > 40) S.undo.shift(); }
function undo() {
  const s = S.undo.pop(); if (!s) { toast('Nada para desfazer'); return; }
  S.project = JSON.parse(s);
  if (S.mode === 'room' && !room()) S.mode = 'house';
  changed();
}
function toast(msg, ms = 2200) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, ms); }

function b64u(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64u(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); const b = atob(s); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
async function encodeProject(p) {
  const s = JSON.stringify(p);
  if ('CompressionStream' in window) {
    const st = new Blob([s]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return 'z' + b64u(new Uint8Array(await new Response(st).arrayBuffer()));
  }
  return 'j' + b64u(new TextEncoder().encode(s));
}
async function decodeProject(code) {
  const bytes = unb64u(code.slice(1));
  if (code[0] === 'z') {
    const st = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return JSON.parse(await new Response(st).text());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
function sanitize(p) {
  if (!p || !Array.isArray(p.rooms)) throw new Error('formato');
  p.name = p.name || 'Projeto';
  p.rooms = p.rooms.map(r => ({ ...newRoom(), ...r, doors: (r.doors || []).map(d => ({ ...newDoor(), ...d })), windows: (r.windows || []).map(w => ({ ...newWindow(), ...w })),
    items: (r.items || []).filter(i => CATALOG[i.kind]).map(i => ({ id: uid(), rot: 0, flip: false, ...i })) }));
  return p;
}

// ---------- views ----------
const plan = new PlanView($('#planHost'), {
  selectRoom: id => { if (id !== S.sel.roomId) S.sel.opId = null; S.sel.roomId = id; renderPanel(); renderPlan(); renderView(); },
  openRoom: id => openRoom(id),
  selectItem: id => { S.sel.itemId = id; S.sel.opId = null; if (id) S.tab = 'mobiliario'; renderPanel(); renderPlan(); },
  selectOp: (rid, oid) => { S.sel.opId = oid; S.sel.itemId = null; if (S.mode === 'house') S.sel.roomId = rid; else S.tab = 'aberturas'; renderPanel(); renderPlan(); renderView(); },
  startDrag: () => snapshot(),
  dragging: () => renderPlan(),
  changed: (info = {}) => {
    const r = info.room;
    if (r && info.kind === 'item') r.auto = false;
    if (r && (info.kind === 'resize' || info.kind === 'op') && r.auto) autoFurnish(r);
    changed();
  },
  traceChanged: () => { if (S.trace) S.trace.calibrated = true; saveTrace(); renderPanel(); },
  toast: m => toast(m, 3500),
  toolPoint: p => { S.toolPts.push(p); if (S.toolPts.length > 2) S.toolPts = [p]; renderPlan(); renderView(); if (S.toolPts.length === 2) askCalibration(); },
  rectDrawn: r => openWizard({ x: r.x0, z: r.z0, w: r.x1 - r.x0, l: r.z1 - r.z0 }),
});
let v3d = null;
try { v3d = new View3D($('#threeHost')); } catch (e) { console.error(e); }

function openRoom(id) { S.tool = null; S.toolPts = []; S.mode = 'room'; S.roomId = id; S.sel = { roomId: id, itemId: null }; changed({ save: false }); }
function openHouse() { S.mode = 'house'; S.sel.itemId = null; changed({ save: false }); }

function changed({ save: sv = true } = {}) {
  if (sv) save();
  $('#projName').value = S.project.name;
  renderChips(); renderView(); renderPanel(); renderPlan();
  S.dirty3d = true; rebuild3D();
}

function renderChips() {
  const c = $('#roomChips');
  c.innerHTML = `<button class="chip ${S.mode === 'house' ? 'on' : ''}" data-r="">Casa inteira</button>` +
    S.project.rooms.map(r => `<button class="chip ${S.mode === 'room' && S.roomId === r.id ? 'on' : ''}" data-r="${r.id}">${esc(r.name)}</button>`).join('');
  c.querySelectorAll('.chip').forEach(b => b.onclick = () => b.dataset.r ? openRoom(b.dataset.r) : openHouse());
}

function renderView() {
  document.querySelectorAll('#viewSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === S.view));
  $('#planHost').style.display = S.view === 'plan' ? '' : 'none';
  $('#threeHost').style.display = S.view === '3d' ? '' : 'none';
  $('#overlay3d').style.display = S.view === '3d' ? '' : 'none';
  $('#overlayPlan').style.display = S.view === 'plan' ? '' : 'none';
  $('#camPorta').style.display = S.mode === 'room' && room()?.doors.length ? '' : 'none';
  $('#btnDoors').textContent = S.doorsOpen ? 'Fechar portas' : 'Abrir portas';
  $('#btnWalls').textContent = S.mode === 'house' ? (S.wallCut ? 'Paredes altas' : 'Paredes baixas') : (S.wallAll ? 'Esconder paredes da frente' : 'Mostrar todas as paredes');
  const hint = S.view === 'plan'
    ? (S.mode === 'house' && S.tool === 'photo' ? 'Arrasta a foto · puxa um canto laranja para a redimensionar à proporção'
      : S.sel.opId ? 'Arrasta a porta ou janela ao longo das paredes · as distâncias atualizam-se'
      : S.mode === 'house' && S.tool === 'calib' ? (S.toolPts.length ? 'Agora toca no segundo ponto' : 'Toca no primeiro ponto de uma medida que conheces')
      : S.mode === 'house' && S.tool === 'rect' ? 'Arrasta de canto a canto para criar · toca numa divisão e puxa os cantos para a ajustar'
      : S.mode === 'house' && S.sel.roomId ? 'Puxa os cantos ou os lados para redimensionar · arrasta o meio para mover'
      : S.mode === 'house' ? 'Toca numa divisão para a mover ou redimensionar · toca duas vezes para abrir' : 'Arrasta os móveis · toca num móvel para o editar')
    : 'Arrasta para rodar · dois dedos para aproximar e deslocar';
  const hn = $('#hint');
  if (hn.textContent !== hint) { hn.textContent = hint; hn.style.opacity = 1; clearTimeout(hn._t); hn._t = setTimeout(() => hn.style.opacity = 0, 5000); }
  if (!v3d && S.view === '3d') $('#hint').textContent = 'O 3D não está disponível neste browser.';
}

function renderPlan() { plan.render(S.project, S.mode, S.roomId, S.sel, { trace: S.trace, tool: S.mode === 'house' ? S.tool : null, toolPts: S.toolPts }); renderPlanTools(); }

function selRoomForTools() { return S.mode === 'room' ? room() : S.project.rooms.find(r => r.id === S.sel.roomId); }
function selOp() { const r = selRoomForTools(); const o = r && [...r.doors, ...r.windows].find(x => x.id === S.sel.opId); return o ? { r, o, isDoor: r.doors.includes(o) } : null; }

function opQuickHtml(o, isDoor, attr = 'data-oq') {
  let h = `<b style="align-self:center;font-size:13px;white-space:nowrap;padding:0 4px;background:rgba(255,255,255,.92);border-radius:10px">${isDoor ? 'Porta' : 'Janela'} ${fmt(o.width)} m</b>`;
  if (isDoor) {
    h += `<button ${attr}="kind">${DOOR_KINDS[o.kind]} ▾</button>`;
    if (o.kind !== 'vao') h += `<button ${attr}="hinge">${o.kind === 'batente' ? '↔ Dobradiça' : '↔ Lado'}</button>`;
    if (o.kind === 'batente') h += `<button ${attr}="swing">${o.swing === 'in' ? '⤓ Abre p/ dentro' : '⤒ Abre p/ fora'}</button>`;
  }
  h += `<button ${attr}="narrow">− 10 cm</button><button ${attr}="wide">+ 10 cm</button><button ${attr}="del" style="color:#c83228">🗑</button>`;
  return h;
}
// Quick changes to a door or window, used by the plan toolbar and the wizard.
function opAction(r, o, a) {
  const isDoor = r.doors.includes(o), L = wallLength(r, o.wall), K = Object.keys(DOOR_KINDS);
  if (a === 'kind') o.kind = K[(K.indexOf(o.kind) + 1) % K.length];
  if (a === 'hinge') o.hinge = o.hinge === 'start' ? 'end' : 'start';
  if (a === 'swing') o.swing = o.swing === 'in' ? 'out' : 'in';
  if (a === 'narrow' || a === 'wide') {
    const c = o.off + o.width / 2;
    o.width = r2(Math.min(L, Math.max(isDoor ? 0.5 : 0.3, o.width + (a === 'wide' ? 0.1 : -0.1))));
    o.off = r2(Math.min(Math.max(0, c - o.width / 2), L - o.width));
  }
  if (a === 'del') { const list = isDoor ? r.doors : r.windows; list.splice(list.indexOf(o), 1); return 'deleted'; }
}
// Put a new door or window on the wall with the most free space, in the middle of the largest gap.
function addOpening(r, isDoor) {
  const width = isDoor ? 0.8 : 1.0;
  let best = null;
  for (const wall of ['C', 'A', 'B', 'D']) {
    const L = wallLength(r, wall);
    const used = [...r.doors, ...r.windows].filter(o => o.wall === wall).map(o => [o.off - 0.1, o.off + o.width + 0.1]).sort((a, b) => a[0] - b[0]);
    let cur = 0; const gaps = [];
    for (const [a, b] of used) { if (a > cur) gaps.push([cur, a]); cur = Math.max(cur, b); }
    if (cur < L) gaps.push([cur, L]);
    const bonus = isDoor && wall === 'C' ? 0.8 : 0;   // doors default to the bottom wall when there is room
    for (const [a, b] of gaps) if (b - a >= Math.min(width, L) && (!best || b - a + bonus > best.score)) best = { wall, a, b, len: b - a, score: b - a + bonus };
  }
  if (!best) { toast('Não há espaço livre nas paredes.'); return null; }
  const w = Math.min(width, best.len), off = isDoor ? best.a + Math.min(0.2, best.len - w) : best.a + (best.len - w) / 2;
  const o = isDoor ? newDoor({ wall: best.wall, off: r2(off), width: w }) : newWindow({ wall: best.wall, off: r2(off), width: w });
  (isDoor ? r.doors : r.windows).push(o);
  return o;
}

function renderPlanTools() {
  const host = $('#overlayPlan'); if (!host) return;
  const tr = S.mode === 'house' && S.trace, r = selRoomForTools(), so = selOp();
  let a = '';
  if (tr) {
    a += `<button data-tool="calib" class="${S.tool === 'calib' ? 'warm' : ''}">📏 Escala</button>`;
    a += `<button data-tool="photo" class="${S.tool === 'photo' ? 'warm' : ''}">🖼 Foto</button>`;
    a += `<button data-tool="rect" class="${S.tool === 'rect' ? 'on' : ''}">▭ Divisão</button>`;
    if (S.tool) a += `<button data-tool="none">✓ Terminar</button>`;
  }
  if (r && S.tool !== 'calib' && S.tool !== 'photo') a += `<button data-tool="addDoor">+ Porta</button><button data-tool="addWin">+ Janela</button>`;
  a += `<button data-tool="fit" title="Ajustar vista">⤢</button>`;
  host.innerHTML = `<div class="ov-row scroll">${a}</div>` + (so ? `<div class="ov-row scroll">${opQuickHtml(so.o, so.isDoor)}</div>` : '');
  host.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => {
    const t = b.dataset.tool;
    if (t === 'fit') { plan.fitView(); renderPlan(); return; }
    if (t === 'addDoor' || t === 'addWin') {
      snapshot(); const o = addOpening(r, t === 'addDoor'); if (!o) return;
      S.sel.opId = o.id; if (r.auto) autoFurnish(r); changed();
      toast('Arrasta-a ao longo das paredes. As distâncias aparecem enquanto arrastas.', 3500); return;
    }
    setTool(t === 'none' || S.tool === t ? null : t);
  });
  host.querySelectorAll('[data-oq]').forEach(b => b.onclick = () => {
    if (!so) return; snapshot();
    if (opAction(so.r, so.o, b.dataset.oq) === 'deleted') S.sel.opId = null;
    if (so.r.auto) autoFurnish(so.r);
    changed();
  });
}

function setTool(t) {
  S.tool = t; S.toolPts = []; if (t === 'calib' || t === 'photo') S.sel.opId = null;
  if (t) { S.mode = 'house'; S.view = 'plan'; }
  changed({ save: false });
  if (t === 'calib') toast('Toca em dois pontos do esboço cuja distância real conheces (por exemplo, as pontas de uma parede).', 4500);
  if (t === 'photo') toast('Arrasta a foto para a mover e puxa um canto laranja para a aumentar ou diminuir (mantém a proporção).', 5000);
  if (t === 'rect') toast('Arrasta de um canto de uma divisão até ao canto oposto. Dois dedos para aproximar.', 4500);
}

// ---------- sketch (photo trace) ----------
const TKEY = KEY + '-trace';
function saveTrace() {
  try { if (S.trace) localStorage.setItem(TKEY, JSON.stringify(S.trace)); else localStorage.removeItem(TKEY); }
  catch (e) { toast('A foto é grande demais para ficar guardada no browser: fica só nesta sessão.', 4000); }
}
async function decodeImage(file) {
  // 1) createImageBitmap respects the photo orientation and copes with large photos
  if (window.createImageBitmap) {
    try { const b = await createImageBitmap(file, { imageOrientation: 'from-image' }); return { src: b, w: b.width, h: b.height }; } catch (e) { }
    try { const b = await createImageBitmap(file); return { src: b, w: b.width, h: b.height }; } catch (e) { }
  }
  // 2) classic <img>, with onload (img.decode() fails on some iPhones)
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    return { src: img, w: img.naturalWidth, h: img.naturalHeight };
  } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
}
async function loadSketch(file) {
  if (!file) return;
  toast('A preparar a foto…', 8000);
  let im;
  try { im = await decodeImage(file); }
  catch (e) {
    const heic = /heic|heif/i.test(file.type + file.name);
    toast(heic ? 'Este browser não abre fotos HEIC. Tira uma captura de ecrã da foto ou muda a câmara para "Mais compatível" (JPEG).' : 'Não consegui abrir essa imagem. Experimenta outra foto ou uma captura de ecrã.', 6000);
    return;
  }
  try {
    const max = 1600, f = Math.min(1, max / Math.max(im.w, im.h));
    const w = Math.round(im.w * f), h = Math.round(im.h * f);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.drawImage(im.src, 0, 0, w, h);
    if (im.src.close) im.src.close();
    // greyscale + auto levels, so pencil lines stand out on white paper
    const d = g.getImageData(0, 0, w, h), px = d.data, hist = new Uint32Array(256);
    for (let i = 0; i < px.length; i += 4) { const y = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) | 0; px[i] = y; hist[y]++; }
    const n = w * h; let acc = 0, lo = 0, hi = 255;
    for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > n * 0.01) { lo = i; break; } }
    acc = 0; for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > n * 0.35) { hi = i; break; } }
    const span = Math.max(20, hi - lo);
    for (let i = 0; i < px.length; i += 4) { const v = Math.max(0, Math.min(255, (px[i] - lo) * 255 / span)); px[i] = px[i + 1] = px[i + 2] = v; }
    g.putImageData(d, 0, 0);
    const rs = S.project.rooms;
    S.trace = { img: c.toDataURL('image/jpeg', 0.72), iw: w, ih: h, x: rs.length ? Math.min(...rs.map(r => r.x)) : 0, z: rs.length ? Math.min(...rs.map(r => r.z)) : 0,
      s: 8 / Math.max(w, h), rot: 0, op: 0.6, show: true, calibrated: false };
    saveTrace(); plan.fitView(); setTool('calib');
  } catch (e) { console.error(e); toast('Não consegui processar a foto (' + (e.message || e) + ').', 6000); }
}
$('#sketchInput').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) loadSketch(f); });
function askCalibration() {
  const [a, b] = S.toolPts, dist = Math.hypot(a.x - b.x, a.z - b.z);
  const sh = $('#sheet');
  sh.innerHTML = `<h2>Acertar a escala</h2><p class="muted">Quantos metros mede, na realidade, a distância entre os dois pontos que marcaste?</p>
    <div class="row">${inputM('Distância real', 'dist', dist)}<span></span></div><p class="warn" id="cErr"></p>
    <div class="navbtns"><button data-c="cancel">Cancelar</button><button class="primary" data-c="ok">Aplicar escala</button></div>`;
  $('#modal').hidden = false;
  const inp = sh.querySelector('input'); inp.select();
  sh.querySelector('[data-c=cancel]').onclick = () => { closeModal(); S.toolPts = []; renderPlan(); };
  sh.querySelector('[data-c=ok]').onclick = () => {
    const D = num(inp.value); if (D <= 0.1) { sh.querySelector('#cErr').textContent = 'Indica uma distância maior do que 0,10 m.'; return; }
    const f = D / dist, t = S.trace;
    t.x = a.x + (t.x - a.x) * f; t.z = a.z + (t.z - a.z) * f; t.s *= f; t.calibrated = true;
    saveTrace(); closeModal(); plan.fitView(); setTool('rect');
  };
}
function rotateTrace(deg) {
  const t = S.trace, c = traceToWorld(t, t.iw / 2, t.ih / 2);
  t.rot = deg;
  const c2 = traceToWorld(t, t.iw / 2, t.ih / 2);
  t.x += c.x - c2.x; t.z += c.z - c2.z;
}
function traceCard() {
  const t = S.trace;
  if (!t) return `<div class="card"><b>📷 Partir de um esboço em papel</b>
    <p class="muted" style="margin:6px 0">Tira uma foto ao esboço, de cima, com o papel inteiro e boa luz. Ela fica por baixo da planta e desenhas as divisões por cima, já no sítio certo.</p>
    <div class="btns"><button class="primary" data-act="sketch">Carregar foto do esboço</button></div></div>`;
  const n = S.project.rooms.length;
  return `<div class="card"><b>📷 Esboço</b>
    <div class="status"><span>${t.calibrated ? '✅' : '🟡'}</span><span><b>1. Escala</b> ${t.calibrated ? 'acertada.' : 'por acertar: marca dois pontos de uma medida que conheças.'}</span></div>
    <div class="status"><span>${n ? '✅' : '🟡'}</span><span><b>2. Divisões</b> ${n ? `${n} desenhada${n > 1 ? 's' : ''}.` : 'arrasta de canto a canto por cima de cada divisão.'} Para acertar uma divisão ao esboço, toca nela e puxa os cantos ou os lados.</span></div>
    <p class="muted" style="margin:6px 0">Duas formas de pôr a foto à escala: <b>📏 Escala</b>, marcando uma medida que conheças, ou <b>🖼 Ajustar foto</b>, criando primeiro uma divisão com as medidas reais e encaixando a foto por cima dela (move e redimensiona à proporção pelos cantos).</p>
    <div class="btns"><button data-act="calib" class="${S.tool === 'calib' ? 'primary' : ''}">📏 Escala</button><button data-act="photoTool" class="${S.tool === 'photo' ? 'primary' : ''}">🖼 Ajustar foto</button><button data-act="drawRect" class="${S.tool === 'rect' ? 'primary' : ''}">▭ Desenhar divisão</button>${S.tool ? '<button data-act="toolOff">Terminar</button>' : ''}</div>
    <label class="f" style="margin-top:10px">Visibilidade da foto<input type="range" min="0.15" max="1" step="0.05" value="${t.op}" data-tr="op"></label>
    <label class="f" style="margin-top:6px">Endireitar a foto (${fmt(t.rot)}°)<input type="range" min="-20" max="20" step="0.5" value="${t.rot}" data-tr="rot"></label>
    <div class="btns"><button data-act="traceShow">${t.show ? 'Ocultar foto' : 'Mostrar foto'}</button><button data-act="sketch">Trocar foto</button><button class="danger" data-act="traceDel">Remover foto</button></div></div>`;
}

function rebuild3D() {
  if (!v3d || S.view !== '3d' || !S.dirty3d) return;
  S.dirty3d = false;
  const rooms = S.mode === 'house' ? S.project.rooms : [room()].filter(Boolean);
  if (!rooms.length) { v3d.build([{ ...newRoom({ w: 0.01, l: 0.01 }), h: 0.01 }]); return; }
  v3d.build(rooms, { cut: S.mode === 'house' && S.wallCut ? 1.15 : null });
  v3d.wallMode = S.mode === 'room' && S.wallAll ? 'all' : 'auto';
  v3d.setDoorsOpen(S.doorsOpen);
  const key = S.mode + (S.roomId || '') + rooms.length;
  if (key !== S.camKey) { S.camKey = key; requestAnimationFrame(() => v3d.view('geral')); }
}

// ---------- panel ----------
function renderPanel() {
  const p = $('#panel');
  if (S.mode === 'house') p.innerHTML = housePanel(); else p.innerHTML = roomPanel();
  bindPanel(p);
}

function swatch(st) { return `<span class="swatch-mini">${st.sw.map(c => `<i style="background:${c}"></i>`).join('')}</span>`; }
function inputM(label, f, v, extra = '') { return `<label class="f">${label}<span class="unit"><input data-f="${f}" inputmode="decimal" value="${fmt(v)}" ${extra}></span></label>`; }

function housePanel() {
  const rs = S.project.rooms;
  if (!rs.length) return `${traceCard()}<div class="card"><h2>Começa a tua casa</h2><p class="muted">Cria a primeira divisão: eu pergunto-te as medidas, as portas, as janelas e o estilo.</p>
    <div class="btns"><button class="primary" data-act="add">+ Nova divisão</button><button data-act="example">Ver exemplo</button></div></div>`;
  const total = rs.reduce((a, r) => a + r.w * r.l, 0);
  return `<h2>Casa inteira</h2>${traceCard()}
    <p class="muted">${rs.length} divisões · ${fmt(total)} m² úteis. Na planta, toca numa divisão para a selecionar: arrasta o meio para a mover, ou puxa os cantos e os lados para a redimensionar (as paredes alinham sozinhas). Toca duas vezes para a abrir.</p>
    ${rs.map(r => { const st = styleById(r.style), on = S.sel.roomId === r.id; return `<div class="card ${on ? 'sel' : ''}" data-room="${r.id}">
      <div class="row" style="justify-content:space-between"><div><b>${esc(r.name)}</b><br><small class="muted">${ROOM_TYPES[r.type]?.label || ''} · ${fmt(r.w)} × ${fmt(r.l)} m · ${fmt(r.w * r.l)} m²</small></div>
      <div style="flex:0">${swatch(st)}</div></div>
      ${on ? `<div class="row" style="margin-top:8px">${inputM('Posição X (a partir da esquerda)', 'x', r.x)}${inputM('Posição Y (a partir de cima)', 'z', r.z)}</div>` : ''}
      <div class="btns"><button class="primary" data-act="open">Abrir</button><button data-act="select">${on ? 'Selecionada' : 'Selecionar'}</button><button data-act="dup">Duplicar</button><button class="danger" data-act="del">Remover</button></div>
    </div>`; }).join('')}
    <div class="btns"><button class="primary" data-act="add">+ Nova divisão</button><button data-act="allStyle">Mesmo estilo em todas</button></div>`;
}

function roomPanel() {
  const r = room(); if (!r) return '';
  const tabs = [['medidas', 'Medidas'], ['aberturas', 'Portas e janelas'], ['estilo', 'Estilo'], ['mobiliario', 'Mobiliário']];
  let h = `<h2>${esc(r.name)} <small class="muted">${fmt(r.w)} × ${fmt(r.l)} m</small></h2>
    <div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  if (S.tab === 'medidas') h += medidasTab(r);
  if (S.tab === 'aberturas') h += aberturasTab(r);
  if (S.tab === 'estilo') h += estiloTab(r);
  if (S.tab === 'mobiliario') h += mobiliarioTab(r);
  return h;
}

function medidasTab(r) {
  return `<div class="card">
    <div class="row"><label class="f">Nome<input data-f="name" value="${esc(r.name)}"></label>
    <label class="f">Tipo<select data-f="type">${Object.entries(ROOM_TYPES).map(([k, v]) => `<option value="${k}" ${r.type === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label></div>
    <div class="row" style="margin-top:8px">${inputM('Largura (paredes A e C)', 'w', r.w)}${inputM('Comprimento (paredes B e D)', 'l', r.l)}</div>
    <div class="row" style="margin-top:8px">${inputM('Pé-direito', 'h', r.h)}<span></span></div>
    <p class="muted">Medidas interiores, de parede a parede. Na planta, a parede A é a de cima e as outras seguem no sentido dos ponteiros do relógio.</p>
  </div>
  <div class="card"><b>Posição na casa</b>
    <div class="row" style="margin-top:8px">${inputM('X (a partir da esquerda)', 'x', r.x)}${inputM('Y (a partir de cima)', 'z', r.z)}</div></div>
  <div class="btns"><button data-act="refurnish">Redistribuir mobiliário</button><button data-act="dupRoom">Duplicar divisão</button><button class="danger" data-act="delRoom">Remover divisão</button></div>`;
}

function openingEditor(r, o, i, isDoor) {
  const L = wallLength(r, o.wall), [e0, e1] = WALL_INFO[o.wall].ends;
  const end = L - o.off - o.width, bad = o.off < -0.001 || end < -0.001;
  const wallOpts = Object.entries(WALL_INFO).map(([k, v]) => `<option value="${k}" ${o.wall === k ? 'selected' : ''}>${v.label}, ${fmt(wallLength(r, k))} m</option>`).join('');
  const on = S.sel.opId === o.id || (W && W.selOp === o.id);
  let h = `<div class="card ${on ? 'sel' : ''}" data-op="${o.id}" data-door="${isDoor ? 1 : 0}">
    <div class="row" style="justify-content:space-between"><div style="flex:1"><b>${isDoor ? 'Porta' : 'Janela'} ${i + 1}</b><br><small class="muted">${isDoor ? DOOR_KINDS[o.kind] + ' · ' : ''}parede ${o.wall} · ${fmt(o.width)} m · a ${fmt(o.off)} m da ${e0} e ${fmt(end)} m da ${e1}</small></div><button class="btn danger" style="flex:0" data-act="delOp">Remover</button></div>
    <details ${on || bad ? 'open' : ''} style="margin-top:6px"><summary class="muted" style="cursor:pointer">Ajustar ao centímetro</summary>
    <div class="row" style="margin-top:6px"><label class="f">Parede<select data-f="wall">${wallOpts}</select></label>
    ${isDoor ? `<label class="f">Tipo<select data-f="kind">${Object.entries(DOOR_KINDS).map(([k, v]) => `<option value="${k}" ${o.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>` : ''}</div>
    <div class="row" style="margin-top:6px">${inputM('Largura', 'width', o.width)}${isDoor ? inputM('Altura', 'height', o.height) : inputM('Altura da janela', 'height', o.height)}</div>
    <div class="row" style="margin-top:6px">${inputM(`Distância à parede ${e0}`, 'off', o.off)}${inputM(`Distância à parede ${e1}`, 'offEnd', end)}</div>`;
  if (isDoor && o.kind === 'batente') h += `<div class="row" style="margin-top:6px">
      <label class="f">Abre para<select data-f="swing"><option value="in" ${o.swing === 'in' ? 'selected' : ''}>Dentro da divisão</option><option value="out" ${o.swing === 'out' ? 'selected' : ''}>Fora da divisão</option></select></label>
      <label class="f">Dobradiça do lado da<select data-f="hinge"><option value="start" ${o.hinge === 'start' ? 'selected' : ''}>Parede ${e0}</option><option value="end" ${o.hinge === 'end' ? 'selected' : ''}>Parede ${e1}</option></select></label></div>`;
  if (isDoor && (o.kind === 'correr_emb' || o.kind === 'correr_ext')) h += `<div class="row" style="margin-top:6px">
      <label class="f">Desliza para o lado da<select data-f="hinge"><option value="start" ${o.hinge === 'start' ? 'selected' : ''}>Parede ${e0}</option><option value="end" ${o.hinge === 'end' ? 'selected' : ''}>Parede ${e1}</option></select></label><span></span></div>`;
  if (!isDoor) h += `<div class="row" style="margin-top:6px">${inputM('Altura do peitoril (chão até à janela)', 'sill', o.sill)}<span></span></div>`;
  h += '</details>';
  if (bad) h += `<p class="warn">Não cabe nesta parede: a soma das distâncias e da largura tem de dar ${fmt(L)} m.</p>`;
  if (isDoor && o.kind === 'correr_emb') {
    const room0 = o.hinge === 'end' ? end : o.off;
    if (room0 < o.width) h += `<p class="warn">Para a porta entrar na parede são precisos cerca de ${fmt(o.width)} m livres desse lado, só há ${fmt(Math.max(0, room0))} m.</p>`;
  }
  return h + '</div>';
}

function aberturasTab(r) {
  return `<p class="muted">Na <b>Planta</b>, arrasta cada porta ou janela ao longo das paredes: as distâncias às paredes vão aparecendo. Toca numa para mudar o tipo, o lado de abertura ou a largura.</p><h3>Portas</h3>${r.doors.map((d, i) => openingEditor(r, d, i, true)).join('') || '<p class="muted">Sem portas.</p>'}
    <div class="btns"><button data-act="addDoor">+ Adicionar porta</button></div>
    <h3>Janelas</h3>${r.windows.map((w, i) => openingEditor(r, w, i, false)).join('') || '<p class="muted">Sem janelas.</p>'}
    <div class="btns"><button data-act="addWin">+ Adicionar janela</button></div>
    <p class="muted">${r.auto ? 'O mobiliário reorganiza-se sozinho quando mudas portas ou janelas.' : 'Se quiseres que eu volte a arrumar os móveis, usa “Redistribuir” no separador Mobiliário.'}</p>`;
}

function themesHtml(cur) {
  return `<div class="themes">${STYLES.map(s => `<button class="theme ${cur === s.id ? 'on' : ''}" data-style="${s.id}"><div class="sw">${s.sw.map(c => `<i style="background:${c}"></i>`).join('')}</div>${s.name}</button>`).join('')}</div>`;
}
function estiloTab(r) {
  const st = styleById(r.style);
  return `${themesHtml(r.style)}<div class="card" style="margin-top:10px"><b>${st.name}</b><p class="muted" style="margin:6px 0 0">${st.desc}</p></div>
    <div class="btns"><button data-act="styleAll">Aplicar este estilo a todas as divisões</button></div>
    <p class="muted">As cores e texturas são aproximadas. Confirma sempre com amostras reais.</p>`;
}

function mobiliarioTab(r) {
  const groups = {};
  for (const [k, c] of Object.entries(CATALOG)) (groups[c.group] ||= []).push([k, c]);
  const it = r.items.find(i => i.id === S.sel.itemId);
  let h = `<div class="row"><label class="f">Adicionar peça<select id="addKind">${Object.entries(groups).map(([g, list]) => `<optgroup label="${g}">${list.map(([k, c]) => `<option value="${k}">${c.label}</option>`).join('')}</optgroup>`).join('')}</select></label>
    <button class="btn primary" style="flex:0;align-self:flex-end" data-act="addItem">Adicionar</button></div>`;
  if (it) {
    const q = itemRect(it), bad = !CATALOG[it.kind].floor && !fits(r, it, r.items, doorZones(r));
    h += `<div class="card sel" style="margin-top:10px"><b>${CATALOG[it.kind].label}</b>
      <div class="row" style="margin-top:8px">${inputM('Largura', 'iw', it.w)}${inputM('Profundidade', 'id', it.d)}</div>
      <div class="row" style="margin-top:6px">${inputM('Distância à parede D (esquerda)', 'ix', q.x0)}${inputM('Distância à parede A (cima)', 'iz', q.z0)}</div>
      <div class="btns"><button data-act="rot">Rodar 90°</button><button data-act="flip">Espelhar</button><button data-act="dupItem">Duplicar</button><button class="danger" data-act="delItem">Remover</button><button data-act="desel">Fechar</button></div>
      ${bad ? '<p class="warn">Esta peça choca com outra, ou ocupa a passagem de uma porta ou uma janela.</p>' : ''}</div>`;
  }
  h += `<h3>Nesta divisão</h3>${r.items.map(i => `<div class="list-item ${i.id === S.sel.itemId ? 'on' : ''}" data-item="${i.id}"><span>${CATALOG[i.kind].label}</span><small>${fmt(i.w)} × ${fmt(i.d)} m</small></div>`).join('') || '<p class="muted">Sem móveis.</p>'}
    <div class="card" style="margin-top:8px">${r.auto ? '✅ <b>Arrumação automática ligada</b><br><small class="muted">Os móveis reorganizam-se sozinhos quando mudas paredes, portas ou janelas. Desliga-se quando mexes num móvel.</small><div class="btns"><button data-act="autoOff">Desligar</button></div>'
      : '🟡 <b>Arrumação automática desligada</b><br><small class="muted">Os móveis ficam onde os puseste.</small><div class="btns"><button data-act="autoOn">Voltar a arrumar e ligar</button></div>'}</div>
    <div class="btns"><button data-act="refurnish">Redistribuir agora</button><button data-act="clearItems" class="danger">Remover tudo</button></div>
    <p class="muted">Na planta podes arrastar cada peça. As peças a vermelho chocam com outra ou com a passagem de uma porta.</p>`;
  return h;
}

let confirmKey = null;
function confirmTwice(btn, key, label) {
  if (confirmKey === key) { confirmKey = null; return true; }
  confirmKey = key; btn.textContent = label || 'Toca de novo para confirmar';
  setTimeout(() => { if (confirmKey === key) confirmKey = null; }, 3000);
  return false;
}

function bindOpenings(container, r, onDone) {
  container.querySelectorAll('.card[data-op]').forEach(card => {
    const isDoor = card.dataset.door === '1';
    const list = isDoor ? r.doors : r.windows;
    const o = list.find(x => x.id === card.dataset.op);
    card.querySelectorAll('[data-f]').forEach(inp => inp.onchange = () => {
      snapshot();
      const f = inp.dataset.f, v = inp.value;
      if (f === 'wall') { o.wall = v; const L = wallLength(r, v); if (o.width > L) o.width = r2(L); if (o.off + o.width > L) o.off = r2(Math.max(0, L - o.width)); }
      else if (f === 'kind' || f === 'swing' || f === 'hinge') o[f] = v;
      else if (f === 'offEnd') o.off = r2(wallLength(r, o.wall) - o.width - num(v));
      else o[f] = r2(Math.max(0, num(v)));
      onDone();
    });
    card.querySelector('[data-act="delOp"]').onclick = () => { snapshot(); list.splice(list.indexOf(o), 1); onDone(); };
  });
}

function bindPanel(p) {
  const r = room();
  p.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; renderPanel(); });
  p.querySelectorAll('[data-style]').forEach(b => b.onclick = () => {
    if (!r) return; snapshot(); r.style = b.dataset.style; changed();
  });
  p.querySelectorAll('[data-tr]').forEach(inp => {
    inp.oninput = () => { const v = parseFloat(inp.value); if (inp.dataset.tr === 'op') S.trace.op = v; else rotateTrace(v); renderPlan(); };
    inp.onchange = () => { saveTrace(); renderPanel(); };
  });
  if (S.mode === 'house') {
    p.querySelectorAll('[data-room]').forEach(card => {
      const rr = S.project.rooms.find(x => x.id === card.dataset.room);
      card.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
        const a = b.dataset.act;
        if (a === 'open') openRoom(rr.id);
        if (a === 'select') { S.sel.roomId = rr.id; renderPanel(); renderPlan(); }
        if (a === 'dup') { snapshot(); const c = JSON.parse(JSON.stringify(rr)); c.id = uid(); c.name += ' (cópia)'; c.x = r2(Math.max(...S.project.rooms.map(q => q.x + q.w)) + T); c.items.forEach(i => i.id = uid()); c.doors.forEach(i => i.id = uid()); c.windows.forEach(i => i.id = uid()); S.project.rooms.push(c); changed(); }
        if (a === 'del' && confirmTwice(b, 'del' + rr.id)) { snapshot(); S.project.rooms.splice(S.project.rooms.indexOf(rr), 1); changed(); }
      });
      card.querySelectorAll('[data-f]').forEach(inp => inp.onchange = () => { snapshot(); rr[inp.dataset.f] = r2(num(inp.value)); changed(); });
    });
  }
  p.querySelectorAll('[data-act]').forEach(b => {
    if (b.closest('[data-room]') || b.closest('[data-op]')) return;
    b.onclick = () => {
      const a = b.dataset.act;
      if (a === 'add') openWizard();
      if (a === 'sketch') { const fi = $('#sketchInput'); fi.value = ''; fi.click(); }
      if (a === 'calib') setTool(S.tool === 'calib' ? null : 'calib');
      if (a === 'photoTool') setTool(S.tool === 'photo' ? null : 'photo');
      if (a === 'drawRect') setTool(S.tool === 'rect' ? null : 'rect');
      if (a === 'toolOff') setTool(null);
      if (a === 'traceShow') { S.trace.show = !S.trace.show; saveTrace(); changed({ save: false }); }
      if (a === 'traceDel' && confirmTwice(b, 'traceDel')) { S.trace = null; S.tool = null; saveTrace(); plan.fitView(); changed({ save: false }); }
      if (a === 'example') { snapshot(); S.project = exampleProject(); changed(); }
      if (a === 'allStyle') { S.tab = 'estilo'; if (S.project.rooms[0]) openRoom(S.project.rooms[0].id); }
      if (!r) return;
      if (a === 'refurnish') { snapshot(); autoFurnish(r); r.auto = true; S.sel.itemId = null; changed(); toast('Mobiliário redistribuído'); }
      if (a === 'delRoom' && confirmTwice(b, 'delRoom')) { snapshot(); S.project.rooms.splice(S.project.rooms.indexOf(r), 1); openHouse(); save(); }
      if (a === 'dupRoom') { snapshot(); const c = JSON.parse(JSON.stringify(r)); c.id = uid(); c.name += ' (cópia)'; c.x = r2(Math.max(...S.project.rooms.map(q => q.x + q.w)) + T); [c.items, c.doors, c.windows].forEach(l => l.forEach(i => i.id = uid())); S.project.rooms.push(c); openRoom(c.id); save(); }
      if (a === 'addDoor' || a === 'addWin') { snapshot(); const o = addOpening(r, a === 'addDoor'); if (o) { S.sel.opId = o.id; if (r.auto) autoFurnish(r); changed(); } }
      if (a === 'autoOn') { snapshot(); r.auto = true; autoFurnish(r); changed(); }
      if (a === 'autoOff') { r.auto = false; save(); renderPanel(); }
      if (a === 'styleAll') { snapshot(); S.project.rooms.forEach(x => x.style = r.style); changed(); toast('Estilo aplicado a todas as divisões'); }
      if (a === 'addItem') { snapshot(); r.auto = false; const it = addItemAuto(r, $('#addKind').value); S.sel.itemId = it.id; changed(); }
      if (a === 'clearItems' && confirmTwice(b, 'clear')) { snapshot(); r.auto = false; r.items = []; S.sel.itemId = null; changed(); }
      const it = r.items.find(i => i.id === S.sel.itemId);
      if (it) {
        if (['rot', 'flip', 'dupItem', 'delItem'].includes(a)) r.auto = false;
        if (a === 'rot') { snapshot(); it.rot = (it.rot + 90) % 360; const q = itemRect(it), hw = (q.x1 - q.x0) / 2, hd = (q.z1 - q.z0) / 2; it.x = r2(Math.min(r.w - hw, Math.max(hw, it.x))); it.z = r2(Math.min(r.l - hd, Math.max(hd, it.z))); changed(); }
        if (a === 'flip') { snapshot(); it.flip = !it.flip; changed(); }
        if (a === 'dupItem') { snapshot(); const c = addItemAuto(r, it.kind); c.w = it.w; c.d = it.d; S.sel.itemId = c.id; changed(); }
        if (a === 'delItem') { snapshot(); r.items.splice(r.items.indexOf(it), 1); S.sel.itemId = null; changed(); }
        if (a === 'desel') { S.sel.itemId = null; renderPanel(); renderPlan(); }
      }
    };
  });
  if (!r) return;
  p.querySelectorAll('.list-item[data-item]').forEach(li => li.onclick = () => { S.sel.itemId = li.dataset.item; renderPanel(); renderPlan(); });
  p.querySelectorAll('[data-f]').forEach(inp => {
    if (inp.closest('[data-op]')) return;
    inp.onchange = () => {
      snapshot();
      const f = inp.dataset.f, v = inp.value;
      if (f === 'name') r.name = v || 'Divisão';
      else if (f === 'type') r.type = v;
      else if (['w', 'l', 'h'].includes(f)) {
        r[f] = r2(Math.max(0.5, num(v)));
        r.items = r.items.filter(i => { const q = itemRect(i); return q.x1 <= r.w + 0.01 && q.z1 <= r.l + 0.01; });
        if (r.auto) autoFurnish(r);
      }
      else if (f === 'x' || f === 'z') r[f] = r2(num(v));
      else {
        const it = r.items.find(i => i.id === S.sel.itemId); if (!it) return;
        r.auto = false;
        if (f === 'iw') it.w = r2(Math.max(0.1, num(v)));
        if (f === 'id') it.d = r2(Math.max(0.1, num(v)));
        const q = itemRect(it), dx = q.x1 - q.x0, dz = q.z1 - q.z0;
        if (f === 'ix') it.x = r2(num(v) + dx / 2);
        if (f === 'iz') it.z = r2(num(v) + dz / 2);
      }
      changed();
    };
  });
  bindOpenings(p, r, () => { if (r.auto) autoFurnish(r); changed(); });
}

// ---------- wizard ----------
let W = null;
const STEPS_FULL = ['Tipo', 'Medidas', 'Portas e janelas', 'Estilo'];
const STEPS_QUICK = ['Tipo e estilo'];
function openWizard(pre) {
  const n = S.project.rooms.length + 1;
  W = { step: 0, auto: true, steps: pre ? STEPS_QUICK : STEPS_FULL, draft: newRoom({ type: 'wc', w: 2, l: 2.5, style: S.project.rooms.at(-1)?.style || 'calacatta' }) };
  W.draft.name = ''; W.n = n;
  if (pre) {
    const q = v => Math.round(v * 20) / 20;
    Object.assign(W.draft, { x: r2(pre.x), z: r2(pre.z), w: q(pre.w), l: q(pre.l) });
    W.keepPos = true; W.measured = { w: q(pre.w), l: q(pre.l) };
  }
  const o = addOpening(W.draft, true); if (o) W.selOp = o.id;
  renderWizard(); $('#modal').hidden = false;
}
function closeModal() { $('#modal').hidden = true; W = null; }
function wizValid() {
  const d = W.draft, st = W.steps[W.step];
  if (st === 'Medidas' && (d.w < 0.6 || d.l < 0.6)) return 'As medidas têm de ter pelo menos 0,60 m.';
  if (st === 'Portas e janelas') {
    for (const o of [...d.doors, ...d.windows]) { const L = wallLength(d, o.wall); if (o.off < -0.001 || o.off + o.width > L + 0.001) return 'Há uma porta ou janela que não cabe na parede escolhida.'; }
  }
  return null;
}
function renderWizard() {
  const d = W.draft, sh = $('#sheet'), st = W.steps[W.step], last = W.step === W.steps.length - 1;
  const typeHtml = `<div class="typegrid">${Object.entries(ROOM_TYPES).map(([k, v]) => `<button data-type="${k}" class="${d.type === k ? 'on' : ''}">${v.label}</button>`).join('')}</div>
    <label class="f" style="margin-top:12px">Nome (opcional)<input id="wName" value="${esc(d.name)}" placeholder="${esc(ROOM_TYPES[d.type].label)}"></label>`;
  const styleHtml = `${themesHtml(d.style)}<p class="muted" style="margin-top:8px">${styleById(d.style).desc}</p>
    <label class="row" style="margin-top:10px;gap:8px"><input type="checkbox" id="wAuto" ${W.auto ? 'checked' : ''} style="flex:0;width:20px;height:20px"> <span>Colocar mobiliário automaticamente (podes editar depois)</span></label>`;
  let body = '';
  if (st === 'Tipo') body = `<p class="muted">Que divisão queres desenhar?</p>${typeHtml}`;
  if (st === 'Tipo e estilo') body = `<p class="muted">📏 Desenhada no esboço: <b>${fmt(d.w)} × ${fmt(d.l)} m</b>. Depois podes afinar puxando os cantos, e arrastar a porta para o sítio certo.</p>${typeHtml}<h3>Estilo</h3>${styleHtml}`;
  if (st === 'Medidas') body = `<p class="muted">Medidas interiores, de parede a parede. A parede A fica em cima na planta, B à direita, C em baixo e D à esquerda.</p>
    <div class="row">${inputM('Largura (paredes A e C)', 'w', d.w)}${inputM('Comprimento (paredes B e D)', 'l', d.l)}</div>
    <div class="row" style="margin-top:8px">${inputM('Pé-direito', 'h', d.h)}<span></span></div><div class="wizprev" id="wPrev"></div>`;
  if (st === 'Portas e janelas') {
    const so = [...d.doors, ...d.windows].find(o => o.id === W.selOp);
    body = `<p class="muted"><b>Arrasta a porta</b> ao longo das paredes até ao sítio certo: as distâncias vão aparecendo. Toca numa porta ou janela para mudar o tipo, o lado ou a largura.</p>
    <div class="row" style="gap:6px"><button class="btn" data-w="addDoor">+ Porta</button><button class="btn" data-w="addWin">+ Janela</button></div>
    <div class="wizprev" id="wPrev" style="height:320px"></div>
    ${so ? `<div class="ov-row scroll" style="gap:6px;margin-bottom:8px">${opQuickHtml(so, d.doors.includes(so), 'data-woq')}</div>` : ''}
    ${d.doors.map((o, i) => openingEditor(d, o, i, true)).join('')}${d.windows.map((o, i) => openingEditor(d, o, i, false)).join('')}
    ${!d.doors.length && !d.windows.length ? '<p class="muted">Sem portas nem janelas.</p>' : ''}`;
  }
  if (st === 'Estilo') body = `<p class="muted">Escolhe o estilo. Podes mudar mais tarde.</p>${styleHtml}`;
  sh.innerHTML = `<h2>Nova divisão</h2>${W.steps.length > 1 ? `<div class="steps">${W.steps.map((x, i) => `<i class="${i <= W.step ? 'on' : ''}"></i>`).join('')}</div>
    <div class="muted" style="margin-bottom:8px"><b>${W.step + 1}. ${st}</b></div>` : ''}${body}<p class="warn" id="wErr"></p>
    <div class="navbtns"><button data-w="${W.step ? 'back' : 'cancel'}">${W.step ? 'Voltar' : 'Cancelar'}</button><button class="primary" data-w="${last ? 'create' : 'next'}">${last ? 'Criar divisão' : 'Seguinte'}</button></div>`;
  const prev = sh.querySelector('#wPrev');
  if (prev) {
    const pv = new PlanView(prev, {
      selectItem() { }, selectRoom() { }, openRoom() { }, startDrag() { },
      selectOp: (rid, oid) => { W.selOp = oid; pv.render({ rooms: [d] }, 'room', d.id, { opId: oid }); },
      opTapped: () => renderWizard(),
      dragging: () => pv.render({ rooms: [d] }, 'room', d.id, { opId: W.selOp }),
      changed: () => renderWizard(),
    });
    pv.render({ rooms: [d] }, 'room', d.id, { opId: st === 'Portas e janelas' ? W.selOp : null });
    if (st !== 'Portas e janelas') prev.style.pointerEvents = 'none';
  }
  sh.querySelectorAll('[data-type]').forEach(b => b.onclick = () => { d.type = b.dataset.type; renderWizard(); });
  const nm = sh.querySelector('#wName'); if (nm) nm.oninput = () => d.name = nm.value;
  sh.querySelectorAll('[data-f]').forEach(inp => { if (inp.closest('[data-op]')) return; inp.onchange = () => {
    d[inp.dataset.f] = r2(Math.max(0, num(inp.value)));
    for (const o of [...d.doors, ...d.windows]) { const L = wallLength(d, o.wall); if (o.width > L) o.width = r2(L); o.off = r2(Math.min(Math.max(0, o.off), L - o.width)); }
    renderWizard(); }; });
  sh.querySelectorAll('[data-style]').forEach(b => b.onclick = () => { d.style = b.dataset.style; renderWizard(); });
  const au = sh.querySelector('#wAuto'); if (au) au.onchange = () => W.auto = au.checked;
  bindOpenings(sh, d, () => renderWizard());
  sh.querySelectorAll('[data-woq]').forEach(b => b.onclick = () => {
    const o = [...d.doors, ...d.windows].find(x => x.id === W.selOp); if (!o) return;
    if (opAction(d, o, b.dataset.woq) === 'deleted') W.selOp = null;
    renderWizard();
  });
  sh.querySelectorAll('[data-w]').forEach(b => b.onclick = () => {
    const a = b.dataset.w;
    if (a === 'cancel') return closeModal();
    if (a === 'back') { W.step--; return renderWizard(); }
    if (a === 'addDoor' || a === 'addWin') { const o = addOpening(d, a === 'addDoor'); if (o) W.selOp = o.id; return renderWizard(); }
    // read any value still being typed
    sh.querySelectorAll('input[data-f]').forEach(inp => { if (document.activeElement === inp) inp.dispatchEvent(new Event('change')); });
    const err = wizValid(); if (err) { sh.querySelector('#wErr').textContent = err; return; }
    if (a === 'next') { W.step++; return renderWizard(); }
    if (a === 'create') {
      snapshot();
      d.name = d.name.trim() || ROOM_TYPES[d.type].label + (S.project.rooms.some(r => r.name === ROOM_TYPES[d.type].label) ? ' ' + W.n : '');
      const keep = W.keepPos;
      if (!keep && S.project.rooms.length) { d.x = r2(Math.max(...S.project.rooms.map(r => r.x + r.w)) + T); d.z = r2(Math.min(...S.project.rooms.map(r => r.z))); }
      d.auto = W.auto; if (W.auto) autoFurnish(d);
      S.project.rooms.push(d); const id = d.id; closeModal(); S.tab = 'medidas';
      if (keep) { S.sel.roomId = id; S.sel.opId = d.doors[0]?.id || null; changed(); toast('Divisão criada. Puxa os cantos para a acertar ao esboço e arrasta a porta para o sítio dela.', 4500); }
      else { openRoom(id); save(); toast('Divisão criada. Na planta podes arrastar as portas e, na casa inteira, encaixar a divisão.', 4000); }
    }
  });
}

// ---------- project menu ----------
function openMenu() {
  const sh = $('#sheet');
  sh.innerHTML = `<h2>Projeto</h2>
    <label class="f" style="margin-top:10px">Nome do projeto<input id="mName" value="${esc(S.project.name)}"></label>
    <h3>Partilhar e guardar</h3>
    <div class="btns"><button class="primary" data-m="share">Copiar link de partilha</button><button data-m="download">Descarregar ficheiro</button><button data-m="openFile">Abrir ficheiro</button></div>
    <input type="file" id="mFile" accept=".json,application/json" hidden>
    <div class="btns"><button data-m="copy">Copiar dados</button><button data-m="paste">Colar dados</button></div>
    <div id="mExtra"></div>
    <h3>Começar de novo</h3>
    <div class="btns"><button data-m="example">Carregar exemplo</button><button class="danger" data-m="new">Projeto vazio</button></div>
    <p class="muted">O projeto fica guardado automaticamente neste browser. Para o enviar a alguém, usa o link de partilha: o projeto inteiro vai dentro do link.</p>
    <div class="navbtns"><button data-m="close">Fechar</button></div>`;
  $('#modal').hidden = false;
  const extra = sh.querySelector('#mExtra');
  sh.querySelector('#mName').onchange = e => { S.project.name = e.target.value || 'Projeto'; changed(); };
  const showText = (txt, note) => { extra.innerHTML = `<p class="muted">${note}</p><textarea readonly>${esc(txt)}</textarea>`; extra.querySelector('textarea').select(); };
  const copy = async (txt, ok, note) => { try { await navigator.clipboard.writeText(txt); toast(ok); } catch (e) { showText(txt, note); } };
  sh.querySelectorAll('[data-m]').forEach(b => b.onclick = async () => {
    const a = b.dataset.m;
    if (a === 'close') closeModal();
    if (a === 'share') { const url = location.href.split('#')[0] + '#p=' + await encodeProject(S.project); copy(url, 'Link copiado', 'Copia este link:'); }
    if (a === 'copy') copy(JSON.stringify(S.project), 'Dados copiados', 'Copia estes dados:');
    if (a === 'download') {
      try {
        const blob = new Blob([JSON.stringify(S.project, null, 1)], { type: 'application/json' });
        const aEl = document.createElement('a'); aEl.href = URL.createObjectURL(blob); aEl.download = (S.project.name || 'projeto').replace(/[^\w\-]+/g, '_') + '.json';
        document.body.appendChild(aEl); aEl.click(); aEl.remove();
      } catch (e) { showText(JSON.stringify(S.project), 'Não foi possível descarregar aqui. Copia estes dados:'); }
    }
    if (a === 'openFile') sh.querySelector('#mFile').click();
    if (a === 'paste') {
      extra.innerHTML = `<p class="muted">Cola aqui os dados de um projeto:</p><textarea id="mPaste"></textarea><div class="btns"><button class="primary" id="mDoPaste">Abrir</button></div>`;
      extra.querySelector('#mDoPaste').onclick = () => { try { snapshot(); S.project = sanitize(JSON.parse(extra.querySelector('#mPaste').value)); S.mode = 'house'; closeModal(); changed(); toast('Projeto aberto'); } catch (e) { toast('Os dados não são válidos'); } };
    }
    if (a === 'example') { snapshot(); S.project = exampleProject(); S.mode = 'house'; closeModal(); changed(); }
    if (a === 'new' && confirmTwice(b, 'new')) { snapshot(); S.project = { name: 'Projeto', rooms: [] }; S.mode = 'house'; closeModal(); changed(); }
  });
  sh.querySelector('#mFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { snapshot(); S.project = sanitize(JSON.parse(await f.text())); S.mode = 'house'; closeModal(); changed(); toast('Projeto aberto'); } catch (err) { toast('Ficheiro inválido'); }
  };
}

// ---------- top-level wiring ----------
$('#btnAdd').onclick = () => openWizard();
$('#btnMenu').onclick = openMenu;
$('#btnUndo').onclick = undo;
$('#projName').onchange = e => { S.project.name = e.target.value || 'Projeto'; save(); };
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.querySelectorAll('#viewSeg button').forEach(b => b.onclick = () => { S.view = b.dataset.v; renderView(); if (S.view === '3d') { S.dirty3d = true; rebuild3D(); } else renderPlan(); try { localStorage.setItem(KEY + '-view', S.view); } catch (e) { } });
document.querySelectorAll('[data-cam]').forEach(b => b.onclick = () => v3d?.view(b.dataset.cam));
$('#btnDoors').onclick = () => { S.doorsOpen = !S.doorsOpen; v3d?.setDoorsOpen(S.doorsOpen); renderView(); };
$('#btnWalls').onclick = () => { if (S.mode === 'house') S.wallCut = !S.wallCut; else S.wallAll = !S.wallAll; renderView(); S.dirty3d = true; rebuild3D(); };

(async function init() {
  let p = null;
  const m = location.hash.match(/^#p=(.+)$/);
  if (m) { try { p = sanitize(await decodeProject(m[1])); toast('Projeto partilhado aberto'); } catch (e) { toast('O link de partilha não é válido'); } }
  if (!p) { const l = load(); if (l) try { p = sanitize(l); } catch (e) { } }
  if (!p) { p = exampleProject(); p.name = 'Exemplo'; setTimeout(() => toast('Isto é um exemplo. Toca em “+ Divisão” para criares a tua.', 4500), 400); }
  S.project = p;
  try { const t = localStorage.getItem(TKEY); if (t) S.trace = JSON.parse(t); } catch (e) { }
  try { S.view = localStorage.getItem(KEY + '-view') || '3d'; } catch (e) { }
  if (!v3d) S.view = 'plan';
  changed({ save: !!m });
})();
