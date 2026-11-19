// Procedural canvas textures (no image files needed).
import * as THREE from 'three';

function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function noise(g, s, r, n, light, dark, a, rmax = 18) {
  for (let i = 0; i < n; i++) { g.fillStyle = r() < 0.5 ? light : dark; g.globalAlpha = a * r(); g.beginPath(); g.arc(r() * s, r() * s, 2 + r() * rmax, 0, 7); g.fill(); }
  g.globalAlpha = 1;
}
function grout(g, s, col, w) { g.strokeStyle = col; g.lineWidth = w; g.strokeRect(0, 0, s, s); }
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = n >> 8 & 255, b = n & 255;
  r = Math.min(255, Math.max(0, Math.round(r * f))); gg = Math.min(255, Math.max(0, Math.round(gg * f))); b = Math.min(255, Math.max(0, Math.round(b * f)));
  return `rgb(${r},${gg},${b})`;
}

function marble(base, vein, gold, groutCol, seed) {
  return (g, s) => {
    const r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    noise(g, s, r, 260, '#ffffff', '#000000', 0.05);
    const draw = (col, n, wmin, wmax, a) => {
      for (let i = 0; i < n; i++) {
        g.strokeStyle = col; g.globalAlpha = a * (0.5 + r() * 0.5); g.lineWidth = wmin + r() * (wmax - wmin);
        let x = r() * s * 1.4 - s * 0.2, y = -20; g.beginPath(); g.moveTo(x, y);
        while (y < s + 20) { x += (r() - 0.35) * 46; y += 10 + r() * 26; g.lineTo(x, y); }
        g.stroke();
      }
      g.globalAlpha = 1;
    };
    draw(vein, 7, 4, 14, 0.12); draw(vein, 9, 0.8, 2.5, 0.45);
    if (gold) draw(gold, 4, 1, 3, 0.75);
    grout(g, s, groutCol, 3);
  };
}
function planks(c1, c2, seed, n = 6) {
  return (g, s) => {
    const r = rng(seed), h = s / n;
    for (let i = 0; i < n; i++) {
      const cut = r() * s, f = 0.9 + r() * 0.18;
      for (const [x0, x1] of [[cut - s, cut], [cut, cut + s]]) {
        g.fillStyle = shade(c1, f * (0.96 + r() * 0.08)); g.fillRect(x0, i * h, x1 - x0, h);
      }
      for (let k = 0; k < 14; k++) {
        g.strokeStyle = c2; g.globalAlpha = 0.06 + r() * 0.12; g.lineWidth = 1 + r() * 2; g.beginPath();
        const y = i * h + r() * h; g.moveTo(0, y); g.bezierCurveTo(s / 3, y + 4 * r(), 2 * s / 3, y - 4 * r(), s, y); g.stroke();
      }
      g.globalAlpha = 1; g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, i * h, s, 1.5); g.fillRect(cut, i * h, 1.5, h);
    }
  };
}
function basket(c1, c2, seed) {
  return (g, s) => {
    const r = rng(seed), c = s / 2, p = c / 3;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 3; k++) {
      g.fillStyle = shade(c1, 0.9 + r() * 0.18);
      const hor = (i + j) % 2 === 0;
      const x = i * c + (hor ? 0 : k * p), y = j * c + (hor ? k * p : 0), w = hor ? c : p, h = hor ? p : c;
      g.fillRect(x, y, w, h);
      for (let q = 0; q < 6; q++) {
        g.strokeStyle = c2; g.globalAlpha = 0.06 + r() * 0.1; g.lineWidth = 1 + r() * 1.5; g.beginPath();
        if (hor) { const yy = y + r() * h; g.moveTo(x, yy); g.lineTo(x + w, yy + (r() - 0.5) * 3); }
        else { const xx = x + r() * w; g.moveTo(xx, y); g.lineTo(xx + (r() - 0.5) * 3, y + h); }
        g.stroke();
      }
      g.globalAlpha = 1; g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5; g.strokeRect(x, y, w, h);
    }
  };
}
function woodGrain(base, line, seed) {
  return (g, s) => {
    const r = rng(seed); g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) { g.strokeStyle = line; g.globalAlpha = 0.06 + r() * 0.16; g.lineWidth = 1 + r() * 3; g.beginPath(); const y = r() * s; g.moveTo(0, y); g.bezierCurveTo(s / 3, y + 10 * r(), 2 * s / 3, y - 10 * r(), s, y); g.stroke(); }
    g.globalAlpha = 1;
  };
}
function flat(base, l, d, a, seed, n = 1600) { return (g, s) => { const r = rng(seed); g.fillStyle = base; g.fillRect(0, 0, s, s); noise(g, s, r, n, l, d, a); }; }

const GEN = {
  calacatta: marble('#f4f1ea', '#8f8a84', '#c9a24d', '#e3ddd2', 11),
  calacattaF: marble('#f1ede5', '#8f8a84', '#c9a24d', '#d8d1c4', 23),
  nero: marble('#19191b', '#e9e6e0', '#c9a24d', '#0e0e0f', 7),
  neroF: marble('#1d1d1f', '#d9d6d0', null, '#0b0b0c', 31),
  microL: flat('#d4cec5', '#ece7df', '#a9a298', 0.08, 5, 2200),
  microD: flat('#b7b0a6', '#d2ccc3', '#8c857b', 0.09, 9, 2200),
  concrete: (g, s) => { flat('#9c9a96', '#b8b6b2', '#73716d', 0.1, 41, 2600)(g, s); g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; g.strokeRect(0, 0, s, s); },
  greige: flat('#e4ddd2', '#f2ede5', '#c6bdb0', 0.06, 3),
  plaster: flat('#f1ece3', '#ffffff', '#d8d0c3', 0.07, 4),
  stoneL: (g, s) => { flat('#cdc9c2', '#e2ded8', '#a7a39c', 0.07, 12, 1800)(g, s); grout(g, s, '#b3aea6', 3); },
  stoneW: (g, s) => { flat('#d6ccbc', '#e8dfd0', '#b2a693', 0.07, 14, 1800)(g, s); grout(g, s, '#bfb3a0', 3); },
  subway: (g, s) => {
    const r = rng(8), w = s / 2, h = s / 4;
    for (let row = 0; row < 4; row++) for (let c = -1; c < 3; c++) {
      const x = c * w + (row % 2 ? w / 2 : 0), y = row * h, l = 94 + r() * 4;
      const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, `hsl(40,12%,${l}%)`); gr.addColorStop(1, `hsl(40,10%,${l - 4}%)`);
      g.fillStyle = gr; g.fillRect(x, y, w, h); g.strokeStyle = '#cfcac1'; g.lineWidth = 5; g.strokeRect(x, y, w, h);
    }
  },
  kitkat: (g, s) => {
    const r = rng(19), n = 8, w = s / n;
    for (let i = 0; i < n; i++) {
      const L = 62 + r() * 8; g.fillStyle = `hsl(95,14%,${L}%)`; g.fillRect(i * w, 0, w, s);
      g.strokeStyle = '#e9e4da'; g.lineWidth = 4; g.strokeRect(i * w, 0, w, s);
    }
  },
  zellige: (g, s) => {
    const r = rng(21), n = 4, t = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const L = 24 + r() * 14, gr = g.createRadialGradient(i * t + t * r(), j * t + t * r(), 4, i * t + t / 2, j * t + t / 2, t * 0.8);
      gr.addColorStop(0, `hsl(162,38%,${L + 10}%)`); gr.addColorStop(1, `hsl(165,42%,${L}%)`);
      g.fillStyle = gr; g.fillRect(i * t, j * t, t, t);
      g.strokeStyle = '#e6dfd2'; g.lineWidth = 6; g.strokeRect(i * t, j * t, t, t);
    }
  },
  terrazzo: (g, s) => {
    const r = rng(17); g.fillStyle = '#ebe6de'; g.fillRect(0, 0, s, s);
    const pal = ['#c9b8a3', '#8a8f8a', '#d9a77c', '#5f6b66', '#ffffff', '#b5654a', '#2f5d50'];
    for (let i = 0; i < 1100; i++) {
      g.fillStyle = pal[Math.floor(r() * pal.length)]; const x = r() * s, y = r() * s, z = 2 + r() * 6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + z, y + r() * z); g.lineTo(x + r() * z, y + z); g.lineTo(x - r() * z * 0.6, y + z * 0.5); g.fill();
    }
  },
  handmade: (g, s) => {
    const gr = g.createRadialGradient(s * 0.4, s * 0.4, 10, s / 2, s / 2, s * 0.7); gr.addColorStop(0, '#fbf8f2'); gr.addColorStop(1, '#ebe5da');
    g.fillStyle = gr; g.fillRect(0, 0, s, s); grout(g, s, '#d6cebf', 14);
  },
  hydraulic: (g, s) => {
    const blue = '#2c4f7c', cream = '#efe8da', terra = '#b5603f', C = [[0, 0], [s, 0], [0, s], [s, s]];
    g.fillStyle = cream; g.fillRect(0, 0, s, s);
    g.fillStyle = blue; C.forEach(([x, y]) => { g.beginPath(); g.arc(x, y, s * 0.28, 0, 7); g.fill(); });
    g.fillStyle = cream; C.forEach(([x, y]) => { g.beginPath(); g.arc(x, y, s * 0.16, 0, 7); g.fill(); });
    g.fillStyle = terra; C.forEach(([x, y]) => { g.beginPath(); g.arc(x, y, s * 0.08, 0, 7); g.fill(); });
    g.fillStyle = blue; g.beginPath(); g.moveTo(s / 2, s * 0.22); g.lineTo(s * 0.78, s / 2); g.lineTo(s / 2, s * 0.78); g.lineTo(s * 0.22, s / 2); g.closePath(); g.fill();
    g.fillStyle = cream; g.beginPath(); g.arc(s / 2, s / 2, s * 0.15, 0, 7); g.fill();
    g.fillStyle = terra; g.beginPath(); g.arc(s / 2, s / 2, s * 0.07, 0, 7); g.fill();
    grout(g, s, '#d6cdbd', 3);
  },
  terracotta: (g, s) => { flat('#b8663f', '#cf8158', '#8e4a2c', 0.12, 27, 1400)(g, s); grout(g, s, '#d9cbb8', 10); },
  brick: (g, s) => {
    const r = rng(33), rows = 8, h = s / rows, w = s / 2;
    g.fillStyle = '#cfc6b8'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < rows; i++) for (let c = -1; c < 3; c++) {
      const x = c * w + (i % 2 ? w / 2 : 0);
      g.fillStyle = `hsl(${12 + r() * 10},${40 + r() * 15}%,${30 + r() * 12}%)`; g.fillRect(x + 3, i * h + 3, w - 6, h - 6);
    }
    noise(g, s, r, 900, '#e8c2a8', '#3a1d12', 0.08, 5);
  },
  walnut: woodGrain('#5b3d28', '#1e0f05', 2),
  oakL: woodGrain('#d8bf98', '#78552d', 6),
  oakH: woodGrain('#b88a52', '#5a3714', 13),
  planksL: planks('#d7bd94', '#7a5a35', 51),
  planksH: planks('#b98b55', '#5a3714', 52),
  planksD: planks('#5e4330', '#1e0f05', 53),
  herringL: basket('#d5b98e', '#7a5a35', 61),
  herringH: basket('#b88a52', '#5a3714', 62),
};

const cache = {};
export function getTex(key) {
  if (cache[key]) return cache[key];
  let gen = GEN[key];
  if (!gen && key.startsWith('paint:')) { const c = key.slice(6); gen = flat(c, shade(c, 1.04), shade(c, 0.95), 0.06, 77); }
  if (!gen) gen = flat('#cccccc', '#dddddd', '#bbbbbb', 0.05, 1);
  const c = document.createElement('canvas'); c.width = c.height = 512;
  gen(c.getContext('2d'), 512);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  cache[key] = t; return t;
}

// Material from a style spec, with the texture repeated to match real size (w × h metres).
export function specMaterial(spec, w, h, extra = {}) {
  const m = new THREE.MeshStandardMaterial({ roughness: spec.r ?? 0.5, ...extra });
  if (spec.k) {
    const t = getTex(spec.k).clone(); t.needsUpdate = true; t.repeat.set(w / spec.tw, h / spec.th);
    m.map = t;
  } else m.color.set(spec.c);
  return m;
}
