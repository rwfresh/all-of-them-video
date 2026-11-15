// This film's own parts: which shot factory draws each shot named in cues.json, and what is drawn over every shot.

import { bookShot } from './shots/book.js';
import { loadFonts as loadType } from './type.js';
import { loadSpreads } from './spreads/index.js';

/** Everything that must be ready before the first frame: the cut-letter fonts and the spread modules. */
export async function loadFonts() {
  const [fonts] = await Promise.all([loadType(), loadSpreads()]);
  return fonts;
}

// every font the 2D canvases use, so the page waits for them before the first frame
export const FONTS = ['400 40px "Schoolbook"', '700 40px "Schoolbook"', 'italic 400 40px "Schoolbook"', '600 40px "Bookman"', '400 40px "Anton"'];

export const FACTORIES = Object.fromEntries(['cover', 'sam', 'idea', 'promo', 'post', 'game', 'empire', 'kim', 'end'].map((n) => [n, bookShot(n)]));

// ---------------------------------------------------------------- captions: one sentence at a time, on a paper label

/** Split every voice line into its sentences; each sentence is one caption, timed from the recorded words. */
export function buildCaptions(tl) {
  const caps = [];
  for (const l of Object.values(tl.lines)) {
    if (l.cc === false) continue;
    // `cc` may hold a shorter caption: the opening words of the line, when the picture itself shows the rest
    // (a speech bubble that says the punchline). It keeps the spoken timing of those opening words.
    const all = l.text.split(/\s+/);
    const src = typeof l.cc === 'string' ? l.cc.split(/\s+/) : all;
    const timed = l.words && l.words.length === all.length;
    let n = 0;
    const total = all.join(' ').length;
    const words = src.map((w, i) => { const o = { w, t0: l.at + (timed ? l.words[i].t0 : l.dur * (n / total)) }; n += w.length + 1; return o; });
    // a shortened caption leaves the screen when the words it leaves out begin
    const lineEnd = src.length < all.length && timed ? l.at + l.words[src.length].t0 - 0.12 : l.end + 0.35;
    let cur = null;
    for (const w of words) {
      if (!cur) { cur = { text: w.w, t0: w.t0 - 0.05, t1: lineEnd, line: l.id }; caps.push(cur); }
      else cur.text += ' ' + w.w;
      if (/[.!?:]["”]?$/.test(w.w)) { cur.end = true; cur = null; }
    }
  }
  caps.sort((a, b) => a.t0 - b.t0);
  // a caption stays until the next one starts, but never more than a short beat after its line
  caps.forEach((c, i) => { const next = caps[i + 1]; if (next && next.t0 < c.t1 + 0.6) c.t1 = next.t0; });
  return caps;
}

const INK = '#2a2622', LABEL = '#fffaf0', EDGE = '#d8ccb2';
const h1 = (n) => { const q = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return q - Math.floor(q); };
let GRAIN = null;
/** A speckle of paper fibre, laid over the label so it is not a flat fill. */
function grainPattern(g) {
  if (!GRAIN) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'), img = x.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) { const v = h1(i * 0.731 + 5.1) < 0.5 ? 0 : 255; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = Math.floor(h1(i * 1.37) * 22); }
    x.putImageData(img, 0, 0);
    x.strokeStyle = 'rgba(120, 96, 60, 0.10)'; x.lineWidth = 1;
    for (let k = 0; k < 90; k++) { const px = h1(k * 3.1) * 256, py = h1(k * 7.7) * 256, a = h1(k * 1.9) * 6.283, L = 6 + h1(k * 5.3) * 16; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * L, py + Math.sin(a) * L); x.stroke(); }
    GRAIN = c;
  }
  return g.createPattern(GRAIN, 'repeat');
}

/** The outline of a strip cut with scissors: a rounded rectangle whose edge wanders a pixel or two. */
function cutStrip(g, w, h, seed) {
  const r = 9, pts = [], per = 2 * (w + h);
  const edge = (x0, y0, x1, y1) => { const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 46)); for (let i = 0; i < n; i++) pts.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]); };
  edge(-w / 2 + r, -h / 2, w / 2 - r, -h / 2); pts.push([w / 2 - r * 0.3, -h / 2 + r * 0.3]);
  edge(w / 2, -h / 2 + r, w / 2, h / 2 - r); pts.push([w / 2 - r * 0.3, h / 2 - r * 0.3]);
  edge(w / 2 - r, h / 2, -w / 2 + r, h / 2); pts.push([-w / 2 + r * 0.3, h / 2 - r * 0.3]);
  edge(-w / 2, h / 2 - r, -w / 2, -h / 2 + r); pts.push([-w / 2 + r * 0.3, -h / 2 + r * 0.3]);
  g.beginPath();
  pts.forEach(([x, y], i) => {
    const u = (i / pts.length) * Math.PI * 2, d = 1.5 * Math.sin(3 * u + seed * 30) + 0.9 * Math.sin(7 * u + seed * 77) + 0.5 * Math.sin(13 * u + seed * 11);
    const nx = Math.abs(x) > w / 2 - r - 1 ? Math.sign(x) : 0, ny = Math.abs(y) > h / 2 - 1 ? Math.sign(y) : 0;
    const px = x + nx * d, py = y + ny * d;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  });
  g.closePath();
  void per;
}

/** The caption: big schoolbook type on a strip of cream paper, cut by hand and set down a little crooked. */
export function caption(g, text, age = 1) {
  g.save();
  let size = 68;
  g.font = `700 ${size}px "Schoolbook"`;
  let w = g.measureText(text).width;
  if (w > 1560) { size *= 1560 / w; g.font = `700 ${size}px "Schoolbook"`; w = 1560; }
  const padX = 46, h = size * 1.62, bw = w + padX * 2;
  const seed = h1(text.length * 3.7 + text.charCodeAt(0) * 0.13 + text.charCodeAt(text.length - 2) * 0.71);
  const tilt = (seed < 0.5 ? -1 : 1) * (0.007 + 0.006 * h1(seed * 9.1));           // 0.4 to 0.75 degrees, never level
  const pop = age < 2 / 30 ? 1.07 : 1;                                             // two frames large, then down: on twos
  g.translate(960, 968);
  g.rotate(tilt);
  g.scale(pop, pop);
  // a soft shadow for the height off the table, then a tight one where the paper nearly touches it
  cutStrip(g, bw, h, seed);
  g.shadowColor = 'rgba(70, 38, 0, 0.30)'; g.shadowBlur = 20; g.shadowOffsetX = 3; g.shadowOffsetY = 10;
  g.fillStyle = EDGE; g.fill();
  g.shadowColor = 'rgba(60, 30, 0, 0.5)'; g.shadowBlur = 3; g.shadowOffsetX = 1; g.shadowOffsetY = 3;
  g.fill();
  g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0;
  // the sheet itself sits three pixels up, so the darker card edge shows along the bottom
  g.translate(0, -3);
  cutStrip(g, bw, h, seed);
  g.fillStyle = LABEL; g.fill();
  g.save(); g.clip(); g.fillStyle = grainPattern(g); g.fillRect(-bw / 2 - 4, -h / 2 - 4, bw + 8, h + 8); g.restore();
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillText(text, 0, size * 0.33);
  g.restore();
}
