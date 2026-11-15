// Paper for the Collage shot: the kraft ground, newsprint set from the film's own cue sheet, halftone printing,
// scissor-cut and torn edges, tape, grain. Everything is drawn once in make() from seeded randomness.

import { rng, TAU } from '../../util.js';

export const PAL = {
  kraft: '#C9A77A', kraftDark: '#A98558', kraftLight: '#DCC09A',
  news: '#E6DEC9', newsInk: '#6E685B',
  white: '#F5F0E3', cream: '#EFE7D3',
  ink: '#1B1815', red: '#D8362A', redDark: '#B4281F', yellow: '#E7B32E',
};

export const path = (g, pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); };

/** A rectangle cut with scissors: straight facets, corners a little off, n extra points a side pushed in or out by `rough`. */
export function roughRect(x, y, w, h, R, rough = 3, n = 2) {
  const pts = [], c = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  for (let s = 0; s < 4; s++) {
    const a = c[s], b = c[(s + 1) % 4], nx = (b[1] - a[1]), ny = -(b[0] - a[0]), L = Math.hypot(nx, ny) || 1;
    pts.push([a[0] + (R() - 0.5) * rough * 1.6, a[1] + (R() - 0.5) * rough * 1.6]);
    const k = n + (R() < 0.4 ? 1 : 0);
    const ts = Array.from({ length: k }, () => 0.12 + R() * 0.76).sort((p, q) => p - q);
    for (const t of ts) { const o = (R() - 0.5) * 2 * rough; pts.push([a[0] + (b[0] - a[0]) * t + (nx / L) * o, a[1] + (b[1] - a[1]) * t + (ny / L) * o]); }
  }
  return pts;
}

/** A torn edge from a to b: many small uneven teeth. Returns the points between (a and b not included). */
export function tornEdge(a, b, R, amp = 5, step = 7) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.round(L / step)), nx = (b[1] - a[1]) / L, ny = -(b[0] - a[0]) / L, out = [];
  let drift = 0;
  for (let i = 1; i < n; i++) {
    drift = drift * 0.7 + (R() - 0.5) * amp * 1.2;
    const o = drift + (R() - 0.5) * amp, t = (i + (R() - 0.5) * 0.6) / n;
    out.push([a[0] + (b[0] - a[0]) * t + nx * o, a[1] + (b[1] - a[1]) * t + ny * o]);
  }
  return out;
}

/** Fibres, flecks and blotches on a sheet already filled with its colour. */
export function fibres(g, w, h, R, o = {}) {
  const dark = o.dark || 'rgba(88,58,26,', light = o.light || 'rgba(255,238,205,', n = o.n || (w * h) / 230;
  for (let i = 0; i < (o.blotch ?? 46); i++) {
    const x = R() * w, y = R() * h, r = 160 + R() * 460, gr = g.createRadialGradient(x, y, 0, x, y, r), c = R() < 0.5 ? dark : light;
    gr.addColorStop(0, c + (0.035 + R() * 0.04) + ')'); gr.addColorStop(1, c + '0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = R() * w, y = R() * h, a = (R() - 0.5) * (R() < 0.75 ? 0.5 : 3.1), L = 3 + R() * R() * 34, c = R() < 0.55 ? dark : light;
    g.strokeStyle = c + (0.05 + R() * 0.17) + ')'; g.lineWidth = 0.5 + R() * 0.9;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + (R() - 0.5) * 4, y + Math.sin(a) * L * 0.5 + (R() - 0.5) * 4, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
  }
  for (let i = 0; i < n * 0.6; i++) {
    g.fillStyle = (R() < 0.6 ? dark : light) + (0.08 + R() * 0.2) + ')';
    g.fillRect(R() * w, R() * h, 1 + R() * 1.6, 1 + R() * 1.2);
  }
}

/** The ground: kraft paper. */
export function makeKraft(makeCanvas, W, H) {
  const c = makeCanvas(W, H), g = c.getContext('2d'), R = rng(1201);
  g.fillStyle = PAL.kraft; g.fillRect(0, 0, W, H);
  // the fine ribs a paper machine leaves
  g.fillStyle = 'rgba(80,52,22,0.045)';
  for (let y = 0; y < H; y += 3) g.fillRect(0, y + (R() < 0.5 ? 0 : 1), W, 1);
  fibres(g, W, H, R);
  // a fold across it, pressed flat again
  g.strokeStyle = 'rgba(70,44,18,0.16)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-10, 742); g.lineTo(W + 10, 716); g.stroke();
  g.strokeStyle = 'rgba(255,240,210,0.2)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-10, 745); g.lineTo(W + 10, 719); g.stroke();
  const v = g.createRadialGradient(W / 2, H / 2, 500, W / 2, H / 2, 1250);
  v.addColorStop(0, 'rgba(60,36,10,0)'); v.addColorStop(1, 'rgba(60,36,10,0.26)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  return c;
}

/**
 * A sheet of newsprint, set in columns from the lines given (the film's own cue sheet), with a masthead.
 * Returns { c, pts } where pts is its outline (one long edge torn) in the canvas's own pixels.
 */
export function makeNewsprint(makeCanvas, w, h, lines, head, sub, seed = 77) {
  const c = makeCanvas(w, h), g = c.getContext('2d'), R = rng(seed);
  const pts = [[6, 8], [w - 10, 4], ...tornEdge([w - 10, 4], [w - 16, h - 8], R, 6, 6), [w - 16, h - 8], ...tornEdge([w - 16, h - 8], [8, h - 6], R, 5, 7), [8, h - 6]];
  g.save(); path(g, pts); g.clip();
  g.fillStyle = PAL.news; g.fillRect(0, 0, w, h);
  fibres(g, w, h, R, { dark: 'rgba(90,80,60,', light: 'rgba(255,252,240,', n: (w * h) / 420, blotch: 14 });
  g.fillStyle = PAL.ink; g.textBaseline = 'alphabetic';
  g.font = '700 74px "Abril Fatface", "Liberation Serif", serif';
  g.fillText(head, 34, 92);
  g.fillRect(34, 108, w - 80, 5); g.fillRect(34, 117, w - 80, 1.5);
  g.font = '700 19px "Liberation Serif", serif';
  g.fillText(sub, 36, 144);
  g.fillRect(34, 156, w - 80, 1.5);
  // columns of small type
  const colW = 168, gap = 22, top = 184;
  g.font = '400 12.5px "Liberation Serif", serif';
  g.fillStyle = PAL.newsInk;
  let k = Math.floor(R() * lines.length);
  for (let x = 36; x + colW < w - 30; x += colW + gap) {
    for (let y = top; y < h - 20; y += 15.5) {
      let s = '';
      while (s.length < 30) s += lines[k++ % lines.length] + ' ';
      g.save(); g.beginPath(); g.rect(x, y - 13, colW, 17); g.clip();
      g.globalAlpha = 0.72 + R() * 0.25;
      g.fillText(s, x - (R() < 0.12 ? -10 : 0), y);
      g.restore();
    }
    g.fillStyle = 'rgba(40,36,30,0.35)'; g.fillRect(x + colW + gap / 2, top - 12, 1, h - top - 10); g.fillStyle = PAL.newsInk;
  }
  g.restore();
  return { c, pts };
}

/** A film grain tile: coarse neutral speckle in clumps, strong enough to see, to lay over the finished frame. */
export function makeGrain(makeCanvas, n = 512, seed = 5) {
  const c = makeCanvas(n, n), g = c.getContext('2d'), d = g.createImageData(n, n), R = rng(seed);
  // clumps two pixels across, so the grain survives the encoder
  for (let y = 0; y < n; y += 2) for (let x = 0; x < n; x += 2) {
    const v = R() < 0.5 ? 0 : 255, a = Math.floor(Math.pow(R(), 1.6) * 118);
    for (const o of [0, 1, n, n + 1]) {
      const i = (y * n + x + o) * 4, aa = Math.max(0, a - (o ? Math.floor(R() * 40) : 0));
      d.data[i] = v; d.data[i + 1] = v; d.data[i + 2] = v; d.data[i + 3] = aa;
    }
  }
  g.putImageData(d, 0, 0);
  return c;
}

/** Dust on the glass for one picture: specks and a hair or two, different on every step (seeded by the step). */
export function dust(g, W, H, seed) {
  const R = rng(seed * 2654435 + 17);
  for (let i = 0; i < 26; i++) {
    const x = R() * W, y = R() * H, r = 0.8 + R() * R() * 3.4;
    g.fillStyle = R() < 0.6 ? `rgba(20,14,8,${0.35 + R() * 0.4})` : `rgba(255,250,236,${0.4 + R() * 0.4})`;
    g.beginPath(); g.ellipse(x, y, r, r * (0.5 + R() * 0.6), R() * 3.14, 0, TAU); g.fill();
  }
  g.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const x = R() * W, y = R() * H, a = R() * TAU, L = 30 + R() * 80;
    g.strokeStyle = `rgba(20,14,8,${0.3 + R() * 0.3})`; g.lineWidth = 0.9 + R() * 0.8;
    g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + Math.cos(a) * L * 0.4 + (R() - 0.5) * 40, y + Math.sin(a) * L * 0.4 + (R() - 0.5) * 40, x + Math.cos(a) * L * 0.7 + (R() - 0.5) * 40, y + Math.sin(a) * L * 0.7 + (R() - 0.5) * 40, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
  }
}

/**
 * Print a picture as cheap colour halftone on cream paper: flattened colours under a screen of black dots whose size
 * follows the picture's darkness. Returns { c, color } (color: the picture's average, as #rrggbb).
 */
export function halftone(makeCanvas, img, w, h, pitch = 6, angle = Math.PI / 4) {
  const c = makeCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, img.width, img.height, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h), p = d.data, lum = new Float32Array(w * h);
  const paper = [242, 234, 216];
  let sr = 0, sg = 0, sb = 0;
  for (let i = 0; i < w * h; i++) {
    let r = p[i * 4], gg = p[i * 4 + 1], b = p[i * 4 + 2];
    lum[i] = (0.299 * r + 0.587 * gg + 0.114 * b) / 255;
    // few inks: flatten each channel to steps, pull the colours a little toward grey, never darker than weak ink
    const q = (v) => Math.round(v / 46) * 46, m = (r + gg + b) / 3;
    r = q(r) * 0.84 + m * 0.16; gg = q(gg) * 0.84 + m * 0.16; b = q(b) * 0.84 + m * 0.16;
    r = 52 + r * 0.86; gg = 46 + gg * 0.86; b = 44 + b * 0.86;
    r = Math.min(255, r) * paper[0] / 255; gg = Math.min(255, gg) * paper[1] / 255; b = Math.min(255, b) * paper[2] / 255;
    p[i * 4] = r; p[i * 4 + 1] = gg; p[i * 4 + 2] = b;
    sr += r; sg += gg; sb += b;
  }
  g.putImageData(d, 0, 0);
  const ca = Math.cos(angle), sa = Math.sin(angle), N = Math.ceil(Math.hypot(w, h) / pitch / 2) + 2;
  g.fillStyle = 'rgba(22,18,16,0.84)';
  g.beginPath();
  for (let u = -N; u <= N; u++) for (let v = -N; v <= N; v++) {
    const x = w / 2 + (u * ca - v * sa) * pitch, y = h / 2 + (u * sa + v * ca) * pitch;
    if (x < -pitch || y < -pitch || x > w + pitch || y > h + pitch) continue;
    const xi = Math.min(w - 1, Math.max(0, Math.round(x))), yi = Math.min(h - 1, Math.max(0, Math.round(y)));
    const f = Math.pow(1 - lum[yi * w + xi], 1.15), r = pitch * 0.5 * Math.sqrt(f);     // at full black the dots just touch
    if (r < 0.55) continue;
    g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU);
  }
  g.fill();
  const n = w * h, hex = (v) => Math.round(v / n).toString(16).padStart(2, '0');
  return { c, color: `#${hex(sr)}${hex(sg)}${hex(sb)}` };
}

/**
 * One cut-out: the printed picture with a rough white scissor edge. Returns its sprite and its shadow (both padded
 * by `pad`; the picture's top left is at (pad, pad)), and the paper's outline around (0, 0) = the picture's centre.
 */
export function makePiece(makeCanvas, pic, w, h, seed, pad = 48) {
  const R = rng(seed);
  const m = [9 + R() * 6, 9 + R() * 7, 10 + R() * 7, 9 + R() * 6];
  const outer = roughRect(-m[3], -m[0], w + m[1] + m[3], h + m[0] + m[2], R, 4, 2);
  const inner = roughRect(0, 0, w, h, R, 1.6, 1);
  const c = makeCanvas(w + 2 * pad, h + 2 * pad), g = c.getContext('2d');
  g.translate(pad, pad);
  path(g, outer); g.fillStyle = PAL.white; g.fill();
  g.save(); path(g, outer); g.clip(); fibres(g, w + 40, h + 40, R, { dark: 'rgba(110,95,70,', light: 'rgba(255,255,250,', n: 90, blotch: 0 }); g.restore();
  g.save(); path(g, inner); g.clip(); g.drawImage(pic, 0, 0); g.restore();
  path(g, inner); g.strokeStyle = 'rgba(20,16,12,0.35)'; g.lineWidth = 1; g.stroke();
  path(g, outer); g.strokeStyle = 'rgba(70,50,30,0.3)'; g.lineWidth = 1; g.stroke();
  const sh = makeCanvas(w + 2 * pad, h + 2 * pad), s = sh.getContext('2d');
  s.filter = 'blur(10px)'; s.translate(pad, pad); path(s, outer); s.fillStyle = '#000'; s.fill();
  return { c, sh, pad, w, h, outer: outer.map(([x, y]) => [x - w / 2, y - h / 2]) };
}

/** A strip of masking tape, w by h around (0, 0), its two ends torn off the roll. */
export function tape(g, w, h, seed) {
  const R = rng(seed), a = [], b = [];
  for (let i = 0; i <= 6; i++) { a.push([-w / 2 + (i % 2 ? 4 : 0) + R() * 3, -h / 2 + (h * i) / 6]); b.push([w / 2 - (i % 2 ? 0 : 4) - R() * 3, h / 2 - (h * i) / 6]); }
  g.beginPath(); [...a, ...b].forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
  g.fillStyle = 'rgba(40,24,6,0.22)'; g.save(); g.translate(1.5, 3); g.fill(); g.restore();
  g.fillStyle = 'rgba(236,222,176,0.86)'; g.fill();
  g.save(); g.clip();
  g.strokeStyle = 'rgba(255,255,240,0.3)'; g.lineWidth = 1;
  for (let x = -w / 2; x < w / 2; x += 5 + R() * 4) { g.beginPath(); g.moveTo(x, -h / 2); g.lineTo(x + 2, h / 2); g.stroke(); }
  g.fillStyle = 'rgba(120,96,40,0.1)'; g.fillRect(-w / 2, h * 0.2, w, h * 0.3);
  g.restore();
}

/** Split a convex polygon by the line through a and b. Returns [left side, right side] (either may be null). */
export function splitPoly(poly, a, b) {
  const side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const L = [], Rr = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
    if (sp >= 0) L.push(p);
    if (sp <= 0) Rr.push(p);
    if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) { const t = sp / (sp - sq), x = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; L.push(x); Rr.push(x); }
  }
  return [L.length > 2 ? L : null, Rr.length > 2 ? Rr : null];
}

/** The part of polygon `poly` inside convex polygon `cell` (both wound the same way), or null. */
export function clipPoly(poly, cell) {
  let out = poly;
  const area = cell.reduce((s, p, i) => { const q = cell[(i + 1) % cell.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  for (let i = 0; i < cell.length && out; i++) {
    const a = cell[i], b = cell[(i + 1) % cell.length];
    const [l, r] = splitPoly(out, a, b);
    out = area > 0 ? l : r;
  }
  return out;
}

export const centroid = (poly) => { let x = 0, y = 0; for (const p of poly) { x += p[0]; y += p[1]; } return [x / poly.length, y / poly.length]; };
