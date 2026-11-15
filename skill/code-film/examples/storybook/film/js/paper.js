// Cut paper: materials with fibre grain, shape helpers, printed cards. Everything in the book is built from these.
// Units: 1 = about 4 cm. A piece is a flat shape; depth comes from stacking pieces a couple of hundredths apart,
// so every layer drops a real shadow on the one behind it.

import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { rng } from './util.js';

export const PAL = {
  cream: '#f6ecd8', white: '#fffaf0', kraft: '#c9a27a', red: '#e04e2e', orange: '#f0873a', gold: '#f3b532', yellow: '#f8d458',
  green: '#5d9e55', leaf: '#3f8a5a', mint: '#a5d8bb', teal: '#1e9c94', sky: '#93d2ea', blue: '#3a7ad6', navy: '#243a5e',
  plum: '#6b4d94', lilac: '#b9a3dc', pink: '#f4a3ab', rose: '#e4687a', tan: '#ecbf96', peach: '#f6cfae', brown: '#8a5b3d',
  umber: '#5b3b2a', charcoal: '#2e3243', grey: '#a9b0b9', lightgrey: '#dde2e6', black: '#1d1e24', ink: '#2a2622',
};

export const LAYER = 0.02;           // default gap between stacked paper layers

// ---------------------------------------------------------------- textures

function canvas(n) { const c = document.createElement('canvas'); c.width = c.height = n; return c; }

/** Tileable fibre texture used as a bump map: speckle plus short light and dark fibres. */
function makeGrain() {
  const N = 512, c = canvas(N), g = c.getContext('2d'), r = rng(7);
  const img = g.createImageData(N, N);
  for (let i = 0; i < N * N; i++) { const v = 128 + (r() - 0.5) * 46; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  for (let k = 0; k < 3000; k++) {
    const x = r() * N, y = r() * N, a = r() * Math.PI, L = 5 + r() * 24;
    g.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.13)';
    g.lineWidth = 0.7 + r() * 1.1;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      g.beginPath(); g.moveTo(x + ox, y + oy);
      g.quadraticCurveTo(x + ox + Math.cos(a) * L * 0.5 + (r() - 0.5) * 4, y + oy + Math.sin(a) * L * 0.5 + (r() - 0.5) * 4, x + ox + Math.cos(a) * L, y + oy + Math.sin(a) * L);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8;
  return t;
}

/** Tileable near-white mottle multiplied into the paper colour, so a flat sheet is never one flat value. */
function makeMottle() {
  const N = 512, c = canvas(N), g = c.getContext('2d'), r = rng(19);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, N, N);
  for (let k = 0; k < 260; k++) {
    const x = r() * N, y = r() * N, R = 18 + r() * 70, dark = r() < 0.6;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, R);
      gr.addColorStop(0, dark ? 'rgba(120,100,80,0.028)' : 'rgba(255,255,255,0.04)'); gr.addColorStop(1, 'rgba(128,128,128,0)');
      g.fillStyle = gr; g.fillRect(x + ox - R, y + oy - R, R * 2, R * 2);
    }
  }
  const img = g.getImageData(0, 0, N, N);
  for (let i = 0; i < N * N; i++) { const n = (r() - 0.5) * 9; for (let k = 0; k < 3; k++) img.data[i * 4 + k] = Math.max(0, Math.min(255, img.data[i * 4 + k] + n)); }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

let GRAIN = null, MOTTLE = null;
const GRAIN_REPEAT = 0.36;           // tiles per unit: fibres a few pixels long on screen
function grain(rx = GRAIN_REPEAT, ry = rx) {
  if (!GRAIN) { GRAIN = makeGrain(); GRAIN.repeat.set(GRAIN_REPEAT, GRAIN_REPEAT); }
  if (rx === GRAIN_REPEAT && ry === GRAIN_REPEAT) return GRAIN;
  const t = GRAIN.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return t;
}
function mottle() {
  if (!MOTTLE) { MOTTLE = makeMottle(); MOTTLE.repeat.set(0.23, 0.23); }
  return MOTTLE;
}

// ---------------------------------------------------------------- materials

const MATS = new Map();
/** Matte paper in a flat colour. `clip` is an optional world-space THREE.Plane (the fold line of a pop-up). */
export function paperMat(color, o = {}) {
  const key = `${color}|${o.bump ?? 1}|${o.clip ? o.clip.uuid : ''}|${o.rough ?? ''}|${o.emissive ?? ''}|${o.plain ? 1 : 0}`;
  let m = MATS.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, roughness: o.rough ?? 0.94, metalness: 0, side: THREE.DoubleSide,
      map: o.plain ? null : mottle(), bumpMap: grain(), bumpScale: (o.bump ?? 1) * 1.6,
    });
    m.shadowSide = THREE.DoubleSide;
    if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.emissiveIntensity ?? 1; }
    if (o.clip) { m.clippingPlanes = [o.clip]; m.clipShadows = true; }
    MATS.set(key, m);
  }
  return m;
}

// ---------------------------------------------------------------- shapes

/** Rounded rectangle centred on (cx, cy). r may be a number or [tl, tr, br, bl]. */
export function rr(w, h, r = 0, cx = 0, cy = 0) {
  const R = Array.isArray(r) ? r : [r, r, r, r];
  const [tl, tr, br, bl] = R.map((v) => Math.min(v, w / 2, h / 2));
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  const s = new THREE.Shape();
  s.moveTo(x0 + bl, y0);
  s.lineTo(x1 - br, y0); if (br) s.quadraticCurveTo(x1, y0, x1, y0 + br);
  s.lineTo(x1, y1 - tr); if (tr) s.quadraticCurveTo(x1, y1, x1 - tr, y1);
  s.lineTo(x0 + tl, y1); if (tl) s.quadraticCurveTo(x0, y1, x0, y1 - tl);
  s.lineTo(x0, y0 + bl); if (bl) s.quadraticCurveTo(x0, y0, x0 + bl, y0);
  return s;
}

export function circ(r, cx = 0, cy = 0) { const s = new THREE.Shape(); s.absarc(cx, cy, r, 0, Math.PI * 2, false); return s; }
export function ell(rx, ry, cx = 0, cy = 0, rot = 0) { const s = new THREE.Shape(); s.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false, rot); return s; }

/** Polygon through points [[x, y], ...] with every corner rounded by radius r (or per-point radii). */
export function poly(pts, r = 0) {
  const s = new THREE.Shape(), n = pts.length;
  const rad = (i) => (Array.isArray(r) ? r[i] ?? 0 : r);
  const P = (i) => pts[(i + n) % n];
  const corner = (i) => {
    const p = P(i), a = P(i - 1), b = P(i + 1);
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]), db = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const k = Math.min(rad(i), da / 2, db / 2);
    return { p, in: [p[0] + ((a[0] - p[0]) / da) * k, p[1] + ((a[1] - p[1]) / da) * k], out: [p[0] + ((b[0] - p[0]) / db) * k, p[1] + ((b[1] - p[1]) / db) * k], k };
  };
  const c0 = corner(0);
  s.moveTo(c0.out[0], c0.out[1]);
  for (let i = 1; i <= n; i++) {
    const c = corner(i);
    s.lineTo(c.in[0], c.in[1]);
    if (c.k > 0) s.quadraticCurveTo(c.p[0], c.p[1], c.out[0], c.out[1]);
  }
  return s;
}

/** Regular star or burst with `n` points. */
export function star(n, ro, ri, cx = 0, cy = 0, rot = 0, round = 0) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const a = rot + (i * Math.PI) / n, r = i % 2 ? ri : ro; pts.push([cx + Math.sin(a) * r, cy + Math.cos(a) * r]); }
  return poly(pts, round);
}

/** A heart, width w, centred near (cx, cy). */
export function heart(w, cx = 0, cy = 0) {
  const s = new THREE.Shape(), k = w / 2;
  s.moveTo(cx, cy - k * 0.95);
  s.bezierCurveTo(cx - k * 0.2, cy - k * 0.62, cx - k * 1.08, cy - k * 0.1, cx - k * 1.0, cy + k * 0.42);
  s.bezierCurveTo(cx - k * 0.94, cy + k * 0.98, cx - k * 0.22, cy + k * 1.06, cx, cy + k * 0.5);
  s.bezierCurveTo(cx + k * 0.22, cy + k * 1.06, cx + k * 0.94, cy + k * 0.98, cx + k * 1.0, cy + k * 0.42);
  s.bezierCurveTo(cx + k * 1.08, cy - k * 0.1, cx + k * 0.2, cy - k * 0.62, cx, cy - k * 0.95);
  return s;
}

const svgLoader = new SVGLoader();
/** Shapes from SVG path data (y down, as drawn). Returned shapes are flipped to y up and scaled by k. */
export function svg(d, k = 1, ox = 0, oy = 0) {
  const data = svgLoader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`);
  const out = [];
  const map = (path) => path.getPoints(16).map((p) => new THREE.Vector2(p.x * k + ox, -p.y * k + oy));
  for (const p of data.paths) for (const sh of SVGLoader.createShapes(p)) {
    const s = new THREE.Shape(map(sh));
    for (const h of sh.holes) s.holes.push(new THREE.Path(map(h)));
    out.push(s);
  }
  return out;
}

/** Cut a hole (another shape's outline) into a shape. */
export function hole(shape, h) { shape.holes.push(new THREE.Path(h.getPoints(24))); return shape; }

// ---------------------------------------------------------------- pieces

// ---- hand cutting: no scissor line is perfectly straight, and cut paper shows a lighter core along its edge

const hash1 = (n) => { const q = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return q - Math.floor(q); };
const LIGHT = new Map();
function coreColor(hex) {
  let v = LIGHT.get(hex);
  if (!v) {
    const c = new THREE.Color(hex), lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    v = '#' + c.lerp(new THREE.Color('#fffaf0'), lum < 0.06 ? 0.22 : 0.5).getHexString();
    LIGHT.set(hex, v);
  }
  return v;
}

/** The outline of a shape as it comes off the scissors (a slow, slight wander), and the same outline a hair wider for the core. */
function handCut(shape, segments) {
  const raw = shape.getPoints(segments);
  if (raw.length > 2 && raw[0].distanceTo(raw[raw.length - 1]) < 1e-6) raw.pop();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const q of raw) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
  const size = Math.max(x1 - x0, y1 - y0);
  if (raw.length < 3 || size < 0.1 || size > 30) return null;
  const pts = [];
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i], b = raw[(i + 1) % raw.length], n = Math.max(1, Math.min(60, Math.ceil(a.distanceTo(b) / 0.12)));
    for (let k = 0; k < n; k++) pts.push(new THREE.Vector2().lerpVectors(a, b, k / n));
  }
  const N = pts.length, sign = THREE.ShapeUtils.area(pts) >= 0 ? 1 : -1;
  let per = 0; const at = [0];
  for (let i = 0; i < N; i++) { per += pts[i].distanceTo(pts[(i + 1) % N]); at.push(per); }
  const seed = hash1(pts[0].x * 13.7 + pts[0].y * 7.3 + N * 0.31 + size);
  const amp = 0.0055 * Math.min(1, Math.max(0.3, size / 0.5)), rimW = 0.0075 * Math.min(1, Math.max(0.45, size / 0.4));
  const f1 = Math.max(1, Math.round(per / 0.9)), f2 = Math.max(2, Math.round(per / 0.47)), f3 = Math.max(3, Math.round(per / 0.21));
  const cut = [], rim = [];
  for (let i = 0; i < N; i++) {
    const a = pts[(i - 1 + N) % N], b = pts[(i + 1) % N];
    let tx = b.x - a.x, ty = b.y - a.y; const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L;
    const nx = ty * sign, ny = -tx * sign, u = (at[i] / per) * Math.PI * 2;
    const d = amp * (0.6 * Math.sin(f1 * u + seed * 40) + 0.3 * Math.sin(f2 * u + seed * 91) + 0.16 * Math.sin(f3 * u + seed * 17));
    cut.push(new THREE.Vector2(pts[i].x + nx * d, pts[i].y + ny * d));
    rim.push(new THREE.Vector2(pts[i].x + nx * (d + rimW), pts[i].y + ny * (d + rimW)));
  }
  return { cut, rim };
}

/**
 * A flat piece of coloured paper. o: x, y, z, rot (radians), sx, sy, clip, bump, name.
 * Unless o.cut === false, its outline is cut by hand (a slight wander) and it shows a lighter paper core along the edge.
 */
export function piece(shape, color, o = {}) {
  const hc = o.cut === false || o.plain ? null : handCut(shape, o.segments ?? 22);
  let geo;
  if (hc) { const sh = new THREE.Shape(hc.cut); sh.holes = shape.holes; geo = new THREE.ShapeGeometry(sh, o.segments ?? 22); }
  else geo = new THREE.ShapeGeometry(shape, o.segments ?? 22);
  const m = new THREE.Mesh(geo, o.material || paperMat(color, o));
  m.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
  if (o.rot) m.rotation.z = o.rot;
  if (o.sx || o.sy) m.scale.set(o.sx ?? 1, o.sy ?? 1, 1);
  m.castShadow = o.cast ?? true; m.receiveShadow = o.receive ?? true;
  if (o.name) m.name = o.name;
  if (hc && o.core !== false && !o.material) {
    const rs = new THREE.Shape(hc.rim); rs.holes = shape.holes;
    const rim = new THREE.Mesh(new THREE.ShapeGeometry(rs, o.segments ?? 22), paperMat(coreColor(color), { clip: o.clip, bump: o.bump }));
    rim.position.z = -0.0009;                     // just behind the sheet, so only the edge shows
    rim.castShadow = false; rim.receiveShadow = true;
    rim.userData.core = true;
    m.add(rim);
  }
  return m;
}

/** A group you can keep adding layered pieces to: add(shape, color, { x, y, z, ... }) and it returns the group. */
export function stack(o = {}) {
  const g = new THREE.Group();
  g.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
  if (o.rot) g.rotation.z = o.rot;
  if (o.s) g.scale.setScalar(o.s);
  g.userData.clip = o.clip;
  g.put = (shape, color, p = {}) => { const m = piece(shape, color, { clip: g.userData.clip, ...p }); g.add(m); return m; };
  return g;
}

// ---------------------------------------------------------------- printed paper

/**
 * A rectangular card printed from a 2D canvas: draw(g, W, H) paints W x H pixels (y down).
 * w, h in units; ppu = pixels per unit. o.shape cuts the card to a shape (given in units, centred on the card).
 */
export function printed(w, h, draw, o = {}) {
  const ppu = o.ppu ?? 320;
  const c = document.createElement('canvas');
  c.width = Math.round(w * ppu); c.height = Math.round(h * ppu);
  const g = c.getContext('2d');
  draw(g, c.width, c.height, ppu);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  let geo;
  if (o.shape) {
    geo = new THREE.ShapeGeometry(o.shape, 22);
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  } else geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.94, metalness: 0, side: THREE.DoubleSide, bumpMap: grain(w * GRAIN_REPEAT, h * GRAIN_REPEAT), bumpScale: 1.6 * (o.bump ?? 1),
  });
  mat.shadowSide = THREE.DoubleSide;
  if (o.clip) { mat.clippingPlanes = [o.clip]; mat.clipShadows = true; }
  if (o.alpha) { mat.alphaTest = 0.5; mat.transparent = false; }
  const m = new THREE.Mesh(geo, mat);
  m.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
  if (o.rot) m.rotation.z = o.rot;
  m.castShadow = o.cast ?? true; m.receiveShadow = o.receive ?? true;
  m.userData.canvas = c; m.userData.tex = tex;
  return m;
}

/** Ink printed straight onto whatever is behind it: a transparent decal that casts no shadow. */
export function ink(w, h, draw, o = {}) {
  const ppu = o.ppu ?? 320;
  const c = document.createElement('canvas');
  c.width = Math.round(w * ppu); c.height = Math.round(h * ppu);
  draw(c.getContext('2d'), c.width, c.height, ppu);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16;
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  if (o.clip) mat.clippingPlanes = [o.clip];
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0.002);
  if (o.rot) m.rotation.z = o.rot;
  m.castShadow = false; m.receiveShadow = true;
  return m;
}

/** Text helper for canvases: fits `text` into maxW by shrinking, returns the size used. */
export function fitText(g, text, font, size, maxW) {
  let s = size;
  g.font = font.replace('%', s);
  const w = g.measureText(text).width;
  if (w > maxW) { s = (size * maxW) / w; g.font = font.replace('%', s); }
  return s;
}
