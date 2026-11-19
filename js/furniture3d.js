// Procedural 3D furniture. Local coords: origin at the centre of the footprint on the floor,
// x across the width (-w/2..w/2), z from the back/wall (-d/2) to the front (+d/2), y up.
import * as THREE from 'three';
import { showerEntry } from './model.js';

let G, MM;
function B(x0, y0, z0, x1, y1, z1, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0) || 0.001, Math.abs(y1 - y0) || 0.001, Math.abs(z1 - z0) || 0.001), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.castShadow = m.receiveShadow = true; G.add(m); return m;
}
function C(r, h, x, y, z, mat, axis = 'y', seg = 28, r2 = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, h, seg), mat);
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; G.add(m); return m;
}
function S(r, x, y, z, mat, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; G.add(m); return m;
}
function legs(x0, z0, x1, z1, h, r, mat) { for (const x of [x0, x1]) for (const z of [z0, z1]) C(r, h, x, h / 2, z, mat, 'y', 10); }
function chair(x, z, faceZ, M) {
  // faceZ: +1 means the sitter faces +z (back of the chair at -z)
  const s = faceZ;
  B(x - 0.21, 0.43, z - 0.21, x + 0.21, 0.47, z + 0.21, M.wood);
  B(x - 0.21, 0.47, z - s * 0.21, x + 0.21, 0.88, z - s * 0.18, M.wood);
  legs(x - 0.18, z - 0.18, x + 0.18, z + 0.18, 0.43, 0.014, M.dark);
}

const BUILD = {
  base_duche(w, d, it, ctx) {
    B(-w / 2, 0, -d / 2, w / 2, 0.035, d / 2, MM.base);
    B(-0.05, 0.036, -0.03, 0.05, 0.038, 0.03, MM.metal);
    const [e0, e1] = showerEntry(it);
    const gx0 = it.flip ? -w / 2 : e1, gx1 = it.flip ? e0 : w / 2;
    if (gx1 - gx0 > 0.25) {
      B(gx0, 0.035, d / 2 - 0.012, gx1, 2.0, d / 2 - 0.004, MM.glass);
      const px = it.flip ? gx1 : gx0; B(px - 0.006, 0.035, d / 2 - 0.016, px + 0.006, 2.0, d / 2, MM.metal);
      B(gx0, 1.98, d / 2 - 0.016, gx1, 2.0, d / 2, MM.metal);
    }
    if (!ctx.touchL) B(-w / 2, 0.035, -d / 2, -w / 2 + 0.008, 2.0, d / 2 - 0.012, MM.glass);
    if (!ctx.touchR) B(w / 2 - 0.008, 0.035, -d / 2, w / 2, 2.0, d / 2 - 0.012, MM.glass);
    const sx = it.flip ? -w / 2 + Math.min(0.35, w * 0.3) : w / 2 - Math.min(0.35, w * 0.3);
    const bz = -d / 2;
    C(0.012, 1.2, sx, 1.55, bz + 0.05, MM.metal);
    B(sx - 0.12, 1.02, bz, sx + 0.12, 1.1, bz + 0.07, MM.metal);
    C(0.012, 0.28, sx, 2.15, bz + 0.18, MM.metal, 'z');
    C(0.12, 0.015, sx, 2.13, bz + Math.min(0.32, d * 0.45), MM.metal, 'y', 40);
    C(0.018, 0.22, sx + (it.flip ? 0.15 : -0.15), 1.35, bz + 0.06, MM.metal);
  },
  banheira(w, d) {
    B(-w / 2, 0, -d / 2, w / 2, 0.55, d / 2, MM.ceramic);
    B(-w / 2 + 0.07, 0.5, -d / 2 + 0.07, w / 2 - 0.07, 0.552, d / 2 - 0.07, MM.water);
    C(0.015, 0.16, 0, 0.62, -d / 2 + 0.04, MM.metal); C(0.012, 0.12, 0, 0.68, -d / 2 + 0.09, MM.metal, 'z');
  },
  sanita(w, d) {
    B(-0.18, 0.25, -d / 2, 0.18, 0.42, -d / 2 + 0.2, MM.ceramic);
    const p = C(0.18, 0.17, 0, 0.335, d / 2 - 0.2, MM.ceramic, 'y', 40); p.scale.set(1, 1, 1.1);
    const s = C(0.185, 0.025, 0, 0.43, d / 2 - 0.2, MM.white, 'y', 40); s.scale.set(1, 1, 1.1);
    B(-0.18, 0.42, -d / 2 + 0.02, 0.18, 0.445, -d / 2 + 0.2, MM.white);
    B(-0.12, 1.0, -d / 2, 0.12, 1.16, -d / 2 + 0.012, MM.plate);
    B(-0.05, 1.06, -d / 2 + 0.011, 0.05, 1.1, -d / 2 + 0.016, MM.metal);
  },
  lavatorio(w, d) {
    B(-w / 2, 0.35, -d / 2, w / 2, 0.82, d / 2 - 0.01, MM.wood);
    B(-w / 2 + 0.01, 0.58, d / 2 - 0.011, w / 2 - 0.01, 0.585, d / 2 - 0.008, MM.dark);
    B(-0.08, 0.68, d / 2 - 0.01, 0.08, 0.69, d / 2 + 0.002, MM.metal);
    B(-w / 2, 0.82, -d / 2, w / 2, 0.86, d / 2, MM.top);
    const b = C(Math.min(0.17, w * 0.32), 0.03, 0, 0.849, 0.03, MM.bowl, 'y', 36); b.scale.set(1.2, 1, 0.85);
    C(0.014, 0.18, 0, 0.95, -d / 2 + 0.06, MM.metal); C(0.01, 0.12, 0, 1.03, -d / 2 + 0.11, MM.metal, 'z');
    const mw = Math.min(w, 0.9) / 2;
    B(-mw, 1.05, -d / 2, mw, 1.8, -d / 2 + 0.012, MM.mirror);
    B(-mw - 0.012, 1.04, -d / 2, mw + 0.012, 1.05, -d / 2 + 0.02, MM.metal); B(-mw - 0.012, 1.8, -d / 2, mw + 0.012, 1.812, -d / 2 + 0.02, MM.metal);
    B(-mw - 0.012, 1.04, -d / 2, -mw, 1.812, -d / 2 + 0.02, MM.metal); B(mw, 1.04, -d / 2, mw + 0.012, 1.812, -d / 2 + 0.02, MM.metal);
    B(-mw + 0.05, 1.86, -d / 2, mw - 0.05, 1.89, -d / 2 + 0.04, MM.light);
  },
  toalheiro(w, d) {
    const z = -d / 2 + 0.05;
    C(0.013, 0.8, -w / 2 + 0.04, 1.3, z, MM.metal); C(0.013, 0.8, w / 2 - 0.04, 1.3, z, MM.metal);
    for (let y = 0.95; y <= 1.66; y += 0.08) C(0.009, w - 0.08, 0, y, z, MM.metal, 'x');
    B(-w / 2 + 0.08, 1.4, z - 0.03, w / 2 - 0.08, 1.62, z + 0.05, MM.towel);
  },
  cama_casal(w, d) { BUILD._bed(w, d, 2); },
  cama_solteiro(w, d) { BUILD._bed(w, d, 1); },
  _bed(w, d, n) {
    B(-w / 2, 0.06, -d / 2 + 0.06, w / 2, 0.3, d / 2, MM.wood);
    B(-w / 2 + 0.02, 0.3, -d / 2 + 0.08, w / 2 - 0.02, 0.5, d / 2 - 0.02, MM.white);
    B(-w / 2 - 0.02, 0, -d / 2, w / 2 + 0.02, 1.05, -d / 2 + 0.07, MM.fabric);
    B(-w / 2 - 0.005, 0.32, -d / 2 + 0.55, w / 2 + 0.005, 0.56, d / 2 + 0.01, MM.bedding);
    B(-w / 2 - 0.006, 0.555, d / 2 - 0.5, w / 2 + 0.006, 0.57, d / 2 - 0.2, MM.accent);
    const pw = (w - 0.12) / n;
    for (let i = 0; i < n; i++) { const x0 = -w / 2 + 0.06 + i * pw; const p = B(x0 + 0.03, 0.5, -d / 2 + 0.12, x0 + pw - 0.03, 0.64, -d / 2 + 0.45, MM.white); p.scale.y = 1; }
  },
  mesa_cabeceira(w, d) {
    B(-w / 2, 0.12, -d / 2, w / 2, 0.5, d / 2, MM.wood);
    B(-w / 2 + 0.02, 0.33, d / 2, w / 2 - 0.02, 0.334, d / 2 + 0.002, MM.dark);
    legs(-w / 2 + 0.03, -d / 2 + 0.03, w / 2 - 0.03, d / 2 - 0.03, 0.12, 0.01, MM.dark);
    C(0.06, 0.03, 0, 0.515, -0.03, MM.metal); C(0.008, 0.25, 0, 0.64, -0.03, MM.metal);
    C(0.09, 0.16, 0, 0.8, -0.03, MM.shade, 'y', 24, 0.12);
  },
  roupeiro(w, d) {
    const h = 2.2;
    B(-w / 2, 0, -d / 2, w / 2, 0.08, d / 2 - 0.03, MM.dark);
    B(-w / 2, 0.08, -d / 2, w / 2, h, d / 2, MM.lacquer);
    const n = Math.max(2, Math.round(w / 0.5));
    for (let i = 1; i < n; i++) { const x = -w / 2 + i * w / n; B(x - 0.002, 0.1, d / 2, x + 0.002, h - 0.02, d / 2 + 0.002, MM.dark); }
    for (let i = 0; i < n; i++) { const x = -w / 2 + (i + (i % 2 ? 0.12 : 0.88)) * w / n; B(x - 0.008, 0.95, d / 2, x + 0.008, 1.35, d / 2 + 0.025, MM.metal); }
  },
  comoda(w, d) {
    B(-w / 2, 0.1, -d / 2, w / 2, 0.85, d / 2, MM.wood);
    legs(-w / 2 + 0.04, -d / 2 + 0.04, w / 2 - 0.04, d / 2 - 0.04, 0.1, 0.012, MM.dark);
    for (const y of [0.35, 0.6]) B(-w / 2 + 0.01, y, d / 2, w / 2 - 0.01, y + 0.004, d / 2 + 0.002, MM.dark);
    for (const y of [0.24, 0.48, 0.73]) B(-0.1, y, d / 2, 0.1, y + 0.012, d / 2 + 0.02, MM.metal);
    C(0.06, 0.25, w / 4, 0.975, 0, MM.accent); S(0.09, -w / 4, 0.94, 0, MM.leaf, 1, 0.8, 1);
  },
  secretaria(w, d) {
    B(-w / 2, 0.72, -d / 2, w / 2, 0.75, d / 2, MM.wood);
    legs(-w / 2 + 0.03, -d / 2 + 0.03, w / 2 - 0.03, d / 2 - 0.03, 0.72, 0.015, MM.dark);
    chair(0, d / 2 + 0.05, -1, MM);
    B(-0.17, 0.75, -0.05, 0.17, 0.77, 0.18, MM.dark); B(-0.17, 0.77, -0.07, 0.17, 0.99, -0.05, MM.screen);
    C(0.05, 0.02, w / 2 - 0.15, 0.76, -d / 2 + 0.12, MM.metal); C(0.006, 0.4, w / 2 - 0.15, 0.96, -d / 2 + 0.12, MM.metal); C(0.06, 0.1, w / 2 - 0.15, 1.18, -d / 2 + 0.12, MM.shade, 'y', 20, 0.09);
  },
  estante(w, d) {
    const h = 2.0, t = 0.025;
    B(-w / 2, 0, -d / 2, -w / 2 + t, h, d / 2, MM.wood); B(w / 2 - t, 0, -d / 2, w / 2, h, d / 2, MM.wood);
    B(-w / 2, 0, -d / 2, w / 2, h, -d / 2 + 0.01, MM.wood);
    const shelves = 5; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const books = [0x8a5a34, 0x2f4858, 0xc9b79c, 0x6b7a5a, 0xa44a3f, 0xe8e0d0, 0x33363b];
    for (let i = 0; i <= shelves; i++) {
      const y = i * (h - t) / shelves; B(-w / 2, y, -d / 2, w / 2, y + t, d / 2, MM.wood);
      if (i === shelves) break;
      let x = -w / 2 + t + 0.02; const lim = w / 2 - t - 0.02 - (rnd() < 0.5 ? 0.25 : 0);
      while (x < lim - 0.05) {
        const bw = 0.025 + rnd() * 0.035, bh = 0.18 + rnd() * 0.12;
        if (x + bw > lim) break;
        B(x, y + t, -d / 2 + 0.03, x + bw, y + t + bh, d / 2 - 0.05, new THREE.MeshStandardMaterial({ color: books[Math.floor(rnd() * books.length)], roughness: 0.8 }));
        x += bw + 0.003;
      }
    }
  },
  sofa(w, d) {
    const a = 0.16;
    B(-w / 2, 0.08, -d / 2, w / 2, 0.42, d / 2, MM.fabric);
    B(-w / 2, 0.42, -d / 2, w / 2, 0.82, -d / 2 + 0.2, MM.fabric);
    B(-w / 2, 0.42, -d / 2, -w / 2 + a, 0.62, d / 2, MM.fabric); B(w / 2 - a, 0.42, -d / 2, w / 2, 0.62, d / 2, MM.fabric);
    const n = w > 1.9 ? 3 : 2, cw = (w - 2 * a) / n;
    for (let i = 0; i < n; i++) {
      const x0 = -w / 2 + a + i * cw;
      B(x0 + 0.005, 0.42, -d / 2 + 0.2, x0 + cw - 0.005, 0.52, d / 2 - 0.01, MM.fabric2);
      B(x0 + 0.01, 0.52, -d / 2 + 0.18, x0 + cw - 0.01, 0.8, -d / 2 + 0.34, MM.fabric2).rotation.x = -0.12;
    }
    legs(-w / 2 + 0.05, -d / 2 + 0.05, w / 2 - 0.05, d / 2 - 0.05, 0.08, 0.018, MM.dark);
    B(-w / 2 + a + 0.05, 0.52, -d / 2 + 0.3, -w / 2 + a + 0.45, 0.82, -d / 2 + 0.42, MM.accent).rotation.z = 0.15;
  },
  poltrona(w, d) {
    const a = 0.12;
    B(-w / 2, 0.1, -d / 2, w / 2, 0.42, d / 2, MM.fabric);
    B(-w / 2, 0.42, -d / 2, w / 2, 0.85, -d / 2 + 0.16, MM.fabric);
    B(-w / 2, 0.42, -d / 2, -w / 2 + a, 0.6, d / 2, MM.fabric); B(w / 2 - a, 0.42, -d / 2, w / 2, 0.6, d / 2, MM.fabric);
    B(-w / 2 + a, 0.42, -d / 2 + 0.16, w / 2 - a, 0.52, d / 2, MM.fabric2);
    legs(-w / 2 + 0.05, -d / 2 + 0.05, w / 2 - 0.05, d / 2 - 0.05, 0.1, 0.016, MM.wood);
  },
  mesa_centro(w, d) {
    B(-w / 2, 0.36, -d / 2, w / 2, 0.4, d / 2, MM.wood);
    B(-w / 2 + 0.04, 0.12, -d / 2 + 0.04, w / 2 - 0.04, 0.14, d / 2 - 0.04, MM.wood);
    legs(-w / 2 + 0.04, -d / 2 + 0.04, w / 2 - 0.04, d / 2 - 0.04, 0.36, 0.014, MM.dark);
    B(-0.2, 0.4, -0.08, 0.05, 0.44, 0.1, MM.accent); C(0.05, 0.16, 0.22, 0.48, 0, MM.lacquer);
  },
  movel_tv(w, d) {
    B(-w / 2, 0.12, -d / 2, w / 2, 0.5, d / 2, MM.wood);
    legs(-w / 2 + 0.05, -d / 2 + 0.05, w / 2 - 0.05, d / 2 - 0.05, 0.12, 0.012, MM.dark);
    const n = Math.max(2, Math.round(w / 0.45));
    for (let i = 1; i < n; i++) { const x = -w / 2 + i * w / n; B(x - 0.002, 0.14, d / 2, x + 0.002, 0.48, d / 2 + 0.002, MM.dark); }
    const tw = Math.min(1.45, w * 0.9) / 2, th = tw * 2 * 0.5625;
    B(-tw, 1.0, -d / 2, tw, 1.0 + th, -d / 2 + 0.035, MM.dark);
    B(-tw + 0.01, 1.01, -d / 2 + 0.035, tw - 0.01, 0.99 + th, -d / 2 + 0.037, MM.screen);
  },
  mesa_jantar(w, d) {
    const tw = w, td = Math.max(0.7, d - 0.9);
    B(-tw / 2, 0.72, -td / 2, tw / 2, 0.76, td / 2, MM.wood);
    legs(-tw / 2 + 0.06, -td / 2 + 0.06, tw / 2 - 0.06, td / 2 - 0.06, 0.72, 0.022, MM.dark);
    const n = Math.max(1, Math.floor(tw / 0.6));
    for (let i = 0; i < n; i++) {
      const x = -tw / 2 + (i + 0.5) * tw / n;
      chair(x, td / 2 + 0.16, -1, MM); chair(x, -td / 2 - 0.16, 1, MM);
    }
    C(0.07, 0.2, 0, 0.86, 0, MM.lacquer); S(0.1, 0, 1.0, 0, MM.leaf, 1, 0.7, 1);
  },
  tapete(w, d) { B(-w / 2, 0, -d / 2, w / 2, 0.012, d / 2, MM.rug); },
  planta() {
    C(0.15, 0.35, 0, 0.175, 0, MM.pot, 'y', 24, 0.12);
    for (const [x, y, z, r] of [[0, 0.7, 0, 0.2], [0.1, 0.9, 0.05, 0.16], [-0.1, 0.85, -0.05, 0.17], [0.02, 1.08, -0.02, 0.13]]) S(r, x, y, z, MM.leaf);
  },
  bancada(w, d) {
    B(-w / 2, 0, -d / 2, w / 2, 0.1, d / 2 - 0.05, MM.dark);
    B(-w / 2, 0.1, -d / 2, w / 2, 0.86, d / 2 - 0.02, MM.lacquer);
    const n = Math.max(1, Math.round(w / 0.6));
    for (let i = 1; i < n; i++) { const x = -w / 2 + i * w / n; B(x - 0.002, 0.12, d / 2 - 0.02, x + 0.002, 0.84, d / 2 - 0.018, MM.dark); }
    for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n; B(x - 0.1, 0.78, d / 2 - 0.02, x + 0.1, 0.79, d / 2, MM.metal); }
    B(-w / 2, 0.86, -d / 2, w / 2, 0.9, d / 2, MM.top);
    const sx = -w / 4, hx = w > 1.4 ? w / 4 : w / 2 - 0.35;
    B(sx - 0.25, 0.86, -0.2, sx + 0.25, 0.902, 0.2, MM.sink);
    C(0.014, 0.3, sx, 1.05, -d / 2 + 0.06, MM.metal); C(0.01, 0.2, sx, 1.19, -d / 2 + 0.15, MM.metal, 'z');
    B(hx - 0.3, 0.9, -0.25, hx + 0.3, 0.906, 0.25, MM.dark);
    for (const [x, z] of [[-0.14, -0.12], [0.14, -0.12], [-0.14, 0.12], [0.14, 0.12]]) C(0.07, 0.002, hx + x, 0.908, z, MM.metal, 'y', 24);
    B(-w / 2, 1.5, -d / 2, w / 2, 2.2, -d / 2 + 0.35, MM.lacquer);
    for (let i = 1; i < n; i++) { const x = -w / 2 + i * w / n; B(x - 0.002, 1.52, -d / 2 + 0.35, x + 0.002, 2.18, -d / 2 + 0.352, MM.dark); }
    B(-w / 2 + 0.02, 1.48, -d / 2 + 0.05, w / 2 - 0.02, 1.5, -d / 2 + 0.33, MM.light);
  },
  frigorifico(w, d) {
    B(-w / 2, 0, -d / 2, w / 2, 1.9, d / 2, MM.steel);
    B(-w / 2 + 0.01, 1.2, d / 2, w / 2 - 0.01, 1.205, d / 2 + 0.002, MM.dark);
    B(w / 2 - 0.07, 1.25, d / 2, w / 2 - 0.05, 1.6, d / 2 + 0.03, MM.metal); B(w / 2 - 0.07, 0.75, d / 2, w / 2 - 0.05, 1.12, d / 2 + 0.03, MM.metal);
  },
};

export function buildItem(it, mats, ctx = {}) {
  G = new THREE.Group(); MM = mats;
  (BUILD[it.kind] || ((w, d) => B(-w / 2, 0, -d / 2, w / 2, 0.5, d / 2, mats.wood)))(it.w, it.d, it, ctx);
  return G;
}
