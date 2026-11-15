// 08 Sticker Explainer: how it works. The one place Claude answers in words.
//
// A calm blue-grey canvas several screens wide and one continuous camera move across it. Claude's three sentences are
// set large on the canvas, each beside the thing it describes:
//   1  a browser page (a sticker: thick white outline, soft shadow) that draws whatever moment it is asked for
//   2  a wall of frames, one tile a second of film, lighting up as each is photographed, and a counter
//   3  the frames and the film's real waveform zipped into one .mp4 sticker
// then the camera pulls out and the counter becomes the title: the film's frame count.
// The cursor (the one orange thing) does the work in each place: playhead, shutter, zip pull. Then it goes home.
// Every number is the film's own: read from the clock, the cue sheet and the measured music.

import { DOCK, MONO, cursorRect, swapDock } from '../term.js';
import { clamp, lerp, seg, smooth, ease, tw, spring, decay, hash } from '../util.js';

const FAM = '"Inter Sticker"';
const C = {
  bg: '#E9EEF2', ink: '#1C2733', slate: '#415266', mid: '#6C7D8F', soft: '#A8B5C1', line: '#CCD6DE', pale: '#DBE3E9',
  white: '#FFFFFF', blue: '#2C5E8E', accent: '#FF5A36', shadow: 'rgba(28,39,51,0.24)',
};
const SC = { x: 960, y: 457 };          // where the camera's centre sits on screen: the middle of the stage above the prompt row

/** cubic-bezier(x1, y1, x2, y2) as an easing function. */
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const fx = (t) => ((ax * t + bx) * t + cx) * t, fy = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 26; i++) { const v = fx(t); if (Math.abs(v - x) < 1e-6) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return fy(t);
  };
}
const GLIDE = bezier(0.55, 0, 0.1, 1);     // a camera move: off smartly, a long soft landing
const PULL = bezier(0.5, 0, 0.15, 1);

// ---- when things happen (local beats) --------------------------------------------------------------------------------
const T = {
  card0: 0.1, card1: 0.64,          // just after Enter the page slides in, passes its place on beat 0.5, and settles
  dot: 0.12,                        // Claude's bullet is there before the words: it is about to answer
  fly0: 0.05, fly1: 0.9,            // the cursor leaves the prompt row and becomes the playhead
  hops: [1.5, 2.5, 3.5, 4.0],       // the page is asked for three moments (each print lands on the beat after), then for now
  ab0: 4.5, ab1: 5.5,               // camera: page -> wall. The first sentence has stood complete for 1.7 s by ab0
  ride1: 5.25,                      // the cursor reaches the first tile
  scan0: 5.25, scan1: 7.0,          // every tile photographed; the counter lands on scan1
  bc0: 7.05, bc1: 8.0,              // camera: wall -> zip
  strips: 7.3,                      // the two strips arrive
  zip0: 8.0, zip1: 9.0,             // the zip closes
  file: 9.0,                        // the .mp4 sticker is slapped down
  out0: 9.5, out1: 10.5,            // pull out to the title card; the number lands on out1
  home0: 9.5, home1: 10.15,         // the cursor flies home
  rest: 11.98,                      // from just before the next bar line nothing moves: the next shot works on a still picture
};

// ---- where things are. Each station is laid out as the screen looks when the camera rests on it ---------------------
const OA = { x: 0, y: 0 }, OB = { x: 1920, y: 0 }, OC = { x: 0, y: 866 };
const TEXT_X = DOCK.x + 2 * DOCK.adv;      // sentences start in the prompt's own text column
const BASE0 = 316, SIZE = 84, LEAD = 98;

const CAM = [
  { b: -1.5, x: 1016, y: 476, z: 0.9 },
  { b: 1, x: 960, y: 457, z: 1, e: ease.outCubic },
  { b: T.ab0, x: 972, y: 457, z: 1.03 },
  { b: T.ab1, x: OB.x + 960, y: 457, z: 1, e: GLIDE, dip: 0.06 },
  { b: T.bc0, x: OB.x + 972, y: 457, z: 1.03 },
  { b: T.bc1, x: 960, y: OC.y + 457, z: 1, e: GLIDE, dip: 0.12 },
  { b: T.out0, x: 972, y: OC.y + 457, z: 1.03 },
  { b: T.out1, x: 1920, y: 803, z: 0.47, e: PULL },
  { b: T.rest - 0.1, x: 1920, y: 803, z: 0.476, e: ease.outQuad }, // a last slow push that has come to rest by the bar line
];
function camera(lb) {
  if (lb <= CAM[0].b) return { cx: CAM[0].x, cy: CAM[0].y, z: CAM[0].z };
  for (let i = 1; i < CAM.length; i++) {
    const a = CAM[i - 1], b = CAM[i];
    if (lb > b.b) continue;
    const u = (b.e || ((x) => x))(seg(lb, a.b, b.b));
    return { cx: lerp(a.x, b.x, u), cy: lerp(a.y, b.y, u), z: a.z * Math.pow(b.z / a.z, u) * (1 - (b.dip || 0) * Math.sin(Math.PI * u)) };
  }
  const l = CAM[CAM.length - 1];
  return { cx: l.x, cy: l.y, z: l.z };
}
const toScreen = (wx, wy, cam) => [SC.x + (wx - cam.cx) * cam.z, SC.y + (wy - cam.cy) * cam.z];

const BR = { x: 1090, y: 222, w: 680, bar: 50, ch: 382.5 };            // the browser page
const PAGE_FROM = 300;                                                 // how far to the right it starts when Enter brings it in
const TL = { x0: 1090, x1: 1770, y: 772 };                             // the film's timeline under it
const PRINT = { w: 244, h: 137.25, slots: [{ x: 372, y: 676, r: -4 }, { x: 650, y: 700, r: 2.5 }, { x: 928, y: 672, r: -2 }] };
const WALL = { x: 240, y: 400, cols: 15, rows: 5, gap: 8, w: 1520 };
WALL.tw = (WALL.w - (WALL.cols - 1) * WALL.gap) / WALL.cols; WALL.th = (WALL.tw * 9) / 16;
WALL.h = WALL.rows * WALL.th + (WALL.rows - 1) * WALL.gap;
const NUM_B = { right: 1500, y: 842, size: 150 };                      // the counter, at the wall
const NUM_T = { left: 2030, y: 1440, maxW: 1660, cap: 220 };                     // and as the title (world)
const ZIP = { x0: 240, x1: 1360, y: 560, band: 70, seam: 12, n: 15 };
const FILE = { cx: 1615, cy: 560, w: 236, h: 296 };
const ROUTE1 = [[1794, 548], [OB.x + 222, 548]];
const ROUTE2 = [[OB.x + 1712, 718], [OB.x + 1712, 920], [116, 920], [116, OC.y + ZIP.y], [224, OC.y + ZIP.y]];

/** A polyline with rounded corners, flattened so it can be drawn part-way and followed. */
function route(pts, r = 44) {
  const P = [];
  const push = (x, y) => { const l = P[P.length - 1]; if (!l || Math.hypot(x - l[0], y - l[1]) > 0.01) P.push([x, y]); };
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (i === 0 || i === pts.length - 1) { push(p[0], p[1]); continue; }
    const a = pts[i - 1], b = pts[i + 1];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb2 = Math.hypot(b[0] - p[0], b[1] - p[1]), rr = Math.min(r, la / 2, lb2 / 2);
    const p0 = [p[0] + ((a[0] - p[0]) / la) * rr, p[1] + ((a[1] - p[1]) / la) * rr], p1 = [p[0] + ((b[0] - p[0]) / lb2) * rr, p[1] + ((b[1] - p[1]) / lb2) * rr];
    for (let k = 0; k <= 10; k++) { const t = k / 10, u = 1 - t; push(u * u * p0[0] + 2 * u * t * p[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * p[1] + t * t * p1[1]); }
  }
  const L = [0];
  for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const len = L[L.length - 1];
  const at = (s) => {
    s = clamp(s, 0, len);
    let i = 1;
    while (i < P.length - 1 && L[i] < s) i++;
    const u = L[i] > L[i - 1] ? (s - L[i - 1]) / (L[i] - L[i - 1]) : 0;
    return [lerp(P[i - 1][0], P[i][0], u), lerp(P[i - 1][1], P[i][1], u), Math.atan2(P[i][1] - P[i - 1][1], P[i][0] - P[i - 1][0])];
  };
  const trace = (g, s1) => {
    g.beginPath(); g.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length && L[i - 1] < s1; i++) {
      if (L[i] <= s1) g.lineTo(P[i][0], P[i][1]);
      else { const q = at(s1); g.lineTo(q[0], q[1]); }
    }
  };
  return { len, at, trace };
}

export default async function make(ctx) {
  const { W, H, font, image, makeCanvas, clock, shot } = ctx;
  await font('Inter Sticker', '/assets/sticker/Inter-Variable.ttf', { weight: '100 900' });

  const DUR = clock.duration, FRAMES = Math.round(DUR * ctx.fps), SECS = DUR.toFixed(2);
  const filmT = (lb) => clock.time(shot.b0 + lb);                     // the film's own time at a local beat
  const shotAt = (t) => clock.shots.find((s) => t >= s.t0 && t < s.t1) || clock.shots[clock.shots.length - 1];
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  // the name of the finished file, as the session's own commands spell it
  const FILENAME = (() => { for (const s of clock.shots) for (const o of s.out || []) { const m = /([\w-]+\.mp4)/.exec(o.text); if (m) return m[1]; } return 'film.mp4'; })();

  // ---- this film's own frames, one still a shot (tools/thumbs.mjs keeps them fresh) ----
  const BEST = { open: 7, line: 9.5, synth: 5.5 };                    // the local beat each still is taken at: the same table as tools/thumbs.mjs
  const thumbT = (name) => { const s = clock.shot[name]; return clock.time(s.b0 + (BEST[name] ?? s.beats * 0.6)); };
  const TH = {};
  await Promise.all(clock.shots.map(async (s) => {
    let bmp = null;
    try { bmp = await image(`/assets/thumbs/${s.name}.png`); } catch { /* drawn as a blank frame */ }
    const shrink = (w, h) => {
      const c = makeCanvas(w, h), cg = c.getContext('2d');
      cg.fillStyle = C.pale; cg.fillRect(0, 0, w, h);
      if (bmp) { cg.imageSmoothingQuality = 'high'; cg.drawImage(bmp, 0, 0, w, h); }
      return c;
    };
    const mid = shrink(480, 270), small = makeCanvas(192, 108);
    const sg = small.getContext('2d'); sg.imageSmoothingQuality = 'high'; sg.drawImage(mid, 0, 0, 192, 108);
    TH[s.name] = { full: bmp || mid, mid, small };
  }));

  // ---- the film's real loudness, as the bars of a waveform ----
  const NB = 140;
  const WAVE = Array.from({ length: NB }, (_, j) => {
    let m = 0;
    for (let k = 0; k < 8; k++) m = Math.max(m, ctx.music.at(((j + (k + 0.5) / 8) / NB) * DUR).rms);
    return ctx.music.ready ? m : 0.25 + 0.6 * hash(j * 1.7);
  });

  const R1 = route(ROUTE1, 0), R2 = route(ROUTE2, 46);

  // ---- type ----
  const scratch = makeCanvas(8, 8).getContext('2d');
  const setFont = (g, size, weight) => { g.font = `${weight} ${size}px ${FAM}`; g.textBaseline = 'alphabetic'; g.textAlign = 'left'; };
  function text(g, s, x, y, size, weight, color, align = 'left', track = 0) {
    setFont(g, size, weight);
    g.letterSpacing = `${track}px`;
    g.textAlign = align; g.fillStyle = color;
    g.fillText(s, x, y);
    g.letterSpacing = '0px'; g.textAlign = 'left';
  }
  function mono(g, s, x, y, size, color, bold = true, align = 'left') {
    g.font = `${bold ? 700 : 400} ${size}px ${MONO}`; g.textBaseline = 'alphabetic'; g.textAlign = align; g.fillStyle = color;
    g.fillText(s, x, y);
    g.textAlign = 'left';
  }
  /** A number whose digits sit in equal cells, so it does not shiver while it counts. Returns its width. */
  function digits(g, s, x, y, size, weight, color, align = 'right') {
    setFont(g, size, weight);
    const cell = g.measureText('0').width;
    const ws = [...s].map((ch) => (/\d/.test(ch) ? cell : g.measureText(ch).width));
    const total = ws.reduce((a, b) => a + b, 0);
    let cx = align === 'right' ? x - total : x;
    g.fillStyle = color; g.textAlign = 'center';
    [...s].forEach((ch, i) => { g.fillText(ch, cx + ws[i] / 2, y); cx += ws[i]; });
    g.textAlign = 'left';
    return total;
  }
  const digitsWidth = (s, size, weight) => { setFont(scratch, size, weight); const cell = scratch.measureText('0').width; return [...s].reduce((a, ch) => a + (/\d/.test(ch) ? cell : scratch.measureText(ch).width), 0); };

  // sentences: where each line breaks is a design decision for the approved copy; any other copy wraps by width
  const BREAKS = { 'A film is a web page that can draw any moment.': ['A film is a web page', 'that can draw', 'any moment.'] };
  const layouts = new Map();
  function layout(str, maxW) {
    const key = str + '|' + maxW;
    if (layouts.has(key)) return layouts.get(key);
    setFont(scratch, SIZE, 800);
    let lines = BREAKS[str];
    if (!lines) {
      lines = [];
      let cur = '';
      for (const w of str.split(' ')) {
        const tryLine = cur ? cur + ' ' + w : w;
        if (cur && scratch.measureText(tryLine).width > maxW) { lines.push(cur); cur = w; } else cur = tryLine;
      }
      if (cur) lines.push(cur);
    }
    const widest = Math.max(...lines.map((l) => scratch.measureText(l).width));
    const size = Math.min(SIZE, (SIZE * maxW) / widest);
    setFont(scratch, size, 800);
    const words = [];
    lines.forEach((l, li) => {
      let pos = 0;
      for (const w of l.split(' ')) { words.push({ w, x: scratch.measureText(l.slice(0, pos)).width, line: li }); pos += w.length + 1; }
    });
    const out = { size, words, lines: lines.length, width: (widest * size) / SIZE };
    layouts.set(key, out);
    return out;
  }
  const SAY = (shot.out || []).filter((o) => o.kind === 'say');
  const SAY_AT = [OA, OB, OC], SAY_W = [800, 1520, 1520];
  const SAY_SEEN = [-99, T.ab0 + 0.5, T.bc0 + 0.45];       // a sentence is set no earlier than its place comes into view
  /** How far the camera has pulled out to the title card (0 to 1), and how much the small labels still show. */
  const pulled = (lb) => PULL(seg(lb, T.out0, T.out1));
  const quiet = (lb) => 1 - smooth(seg(pulled(lb), 0.08, 0.5));

  // ---- stickers ----
  let Z = 1;                                   // the camera's zoom for the frame being drawn (canvas shadows ignore transforms)
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  /** The white die-cut edge and soft shadow that make a thing a sticker. */
  function backing(g, x, y, w, h, r = 12, o = 10, lift = 1) {
    g.save();
    g.shadowColor = C.shadow; g.shadowBlur = 26 * Z * lift; g.shadowOffsetY = 10 * Z * lift;
    g.fillStyle = C.white;
    rr(g, x - o, y - o, w + 2 * o, h + 2 * o, r + o); g.fill();
    g.restore();
  }
  function leader(g, pts, k = 1) {
    if (k <= 0) return;
    const rt = route(pts, 14);
    g.strokeStyle = C.mid; g.lineWidth = Math.max(3, 2 / Z); g.lineCap = 'round'; g.lineJoin = 'round';
    rt.trace(g, rt.len * k); g.stroke();
    g.fillStyle = C.mid; g.beginPath(); g.arc(pts[0][0], pts[0][1], 7, 0, Math.PI * 2); g.fill();
  }

  // =====================================================================================================================
  // Station A: the page that draws any moment

  // three moments far apart, out of order (the hero shot, the first style, the city), then back to now
  const pick = (name, i) => (clock.shot[name] ? name : clock.shots[Math.min(clock.shots.length - 1, 1 + i * 4)].name);
  const HOPS = [{ b: T.hops[0], name: pick('synth', 2) }, { b: T.hops[1], name: pick('line', 0) }, { b: T.hops[2], name: pick('iso', 1) }, { b: T.hops[3], name: null }];
  const hopT = (h, lb) => (h.name ? thumbT(h.name) : filmT(lb));
  /** The moment the page is showing: now, until it is asked for another. The playhead arrives on the beat. */
  function pageT(lb) {
    let t = filmT(lb);
    for (const h of HOPS) { const k = ease.inOutCubic(seg(lb, h.b - 0.14, h.b)); if (k > 0) t = lerp(t, hopT(h, lb), k); }
    return t;
  }
  const playX = (lb) => TL.x0 + (pageT(lb) / DUR) * (TL.x1 - TL.x0);

  function drawSentence(g, i, env, lb) {
    const o = SAY[i];                                // the cue sheet's line: the same text and beat env.term.out reports
    if (!o) return;
    const age = lb - Math.max(o.at, SAY_SEEN[i]);
    const L = layout(o.text, SAY_W[i]), ox = SAY_AT[i].x, oy = SAY_AT[i].y;
    // Claude's bullet, then the words in a quick cascade, in reading order: the whole sentence stands within half a beat.
    // The first bullet is there from Enter, breathing: an answer is coming.
    const early = i === 0 ? lb - T.dot : age;
    if (early < 0) return;
    const breathe = age < 0 ? 1 + 0.16 * Math.sin(early * Math.PI * 4) : 1;
    const bk = clamp(spring(early * env.spb, 4, 0.6), 0, 1.3) * breathe * (1 + 0.25 * decay(Math.max(0, age) * env.spb, 0.05) * (age >= 0 ? 1 : 0));
    g.fillStyle = C.ink;
    g.beginPath(); g.arc(ox + DOCK.x + 18, oy + BASE0 - L.size * 0.36, 17 * bk, 0, Math.PI * 2); g.fill();
    setFont(g, L.size, 800);
    L.words.forEach((wd, k) => {
      const a = age < 0 ? 0 : tw(age, 0.04 + k * 0.03, 0.16 + k * 0.03, ease.outCubic);
      if (a <= 0) return;
      g.globalAlpha = a;
      g.fillStyle = C.ink;
      g.fillText(wd.w, ox + TEXT_X + wd.x, oy + BASE0 + wd.line * LEAD * (L.size / SIZE) + (1 - a) * 18);
    });
    g.globalAlpha = 1;
  }

  /** The page's arrival on Enter: from the right, a little past its place, and back. 1 = far, 0 = home. */
  const arrive = (lb, late = 0) => 1 - ease.outBack(seg(lb, T.card0 + late, T.card1 + late), 1.15);
  function drawPage(g, lb) {
    const { x, y, w, bar, ch } = BR;
    backing(g, x, y, w, bar + ch, 14, 10, 1 + 1.2 * clamp(arrive(lb)));
    g.save();
    rr(g, x, y, w, bar + ch, 14); g.clip();
    g.fillStyle = '#F4F7F9'; g.fillRect(x, y, w, bar);
    g.fillStyle = C.soft;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x + 28 + i * 24, y + bar / 2, 7, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = C.white; rr(g, x + 104, y + 8, w - 122, bar - 16, 17); g.fill();
    g.globalAlpha = quiet(lb);
    mono(g, '127.0.0.1/film/index.html', x + 124, y + bar / 2 + 9, 25, C.mid, false);
    g.globalAlpha = 1;
    // the page itself: asked for a moment, it draws that frame from the top
    let cur = shotAt(filmT(lb)).name, prev = cur, k = 1;
    for (const h of HOPS) if (lb >= h.b) { prev = cur; cur = h.name || shotAt(filmT(lb)).name; k = ease.outCubic(clamp((lb - h.b) / 0.22)); }
    const cy = y + bar;
    g.imageSmoothingQuality = 'high';
    g.drawImage(TH[prev].full, x, cy, w, ch);
    if (k > 0) {
      g.save();
      g.beginPath(); g.rect(x, cy, w, ch * k); g.clip();
      g.drawImage(TH[cur].full, x, cy, w, ch);
      g.restore();
      if (k < 1) { g.fillStyle = C.white; g.fillRect(x, cy + ch * k - 3, w, 6); }
    }
    g.restore();
  }

  function drawCallout(g, lb) {
    const k = tw(lb, 1.1, 1.5, ease.outCubic), q = quiet(lb);
    if (k <= 0 || q <= 0) return;
    const label = `${W} × ${H} px`;
    setFont(g, 30, 600);
    const xl = BR.x + BR.w - g.measureText(label).width;
    g.globalAlpha = q;
    leader(g, [[xl - 52, BR.y - 10], [xl - 52, BR.y - 40], [xl - 14, BR.y - 40]], k);
    g.globalAlpha = tw(lb, 1.3, 1.6) * q;
    text(g, label, BR.x + BR.w, BR.y - 29, 30, 600, C.slate, 'right');
    g.globalAlpha = 1;
  }

  function drawTimeline(g, lb) {
    const span = TL.x1 - TL.x0, t = pageT(lb), here = shotAt(t);
    for (const s of clock.shots) {
      const x = TL.x0 + (s.t0 / DUR) * span, w = Math.max(2, (s.dur / DUR) * span - 3);
      g.fillStyle = s === here ? C.ink : C.soft;
      rr(g, x, TL.y - 6, w, 12, 3); g.fill();
    }
    const q = quiet(lb), p = pulled(lb);
    g.globalAlpha = q;
    mono(g, '0', TL.x0, TL.y + 54, 28, C.mid);
    mono(g, `${SECS} s`, TL.x1, TL.y + 54, 28, C.mid, true, 'right');
    g.globalAlpha = 1;
    // the moments already asked for stay marked
    HOPS.forEach((h) => {
      if (!h.name || lb < h.b + 0.3) return;
      g.fillStyle = C.ink;
      g.beginPath(); g.arc(TL.x0 + (thumbT(h.name) / DUR) * span, TL.y + 22, 6, 0, Math.PI * 2); g.fill();
    });
    // the call itself, with the moment asked for
    // (on the pulled-back card it is set larger, so it still reads; its small gloss goes quiet)
    const label = `renderAt(${t.toFixed(2)})`;
    mono(g, label, TL.x0, TL.y - lerp(44, 34, p), lerp(44, 62, p), C.ink);
    if (q > 0) { g.globalAlpha = q; text(g, 'time, in seconds', TL.x1, TL.y - 46, 30, 600, C.mid, 'right'); g.globalAlpha = 1; }
  }

  /** One printed frame: where it is, from the moment it leaves the page until it is stuck down. */
  function printPose(k, lb) {
    const h = HOPS[k], s = PRINT.slots[k];
    const p = seg(lb, h.b + 0.08, h.b + 0.5);
    if (p <= 0) return null;
    // it is the page's own picture: it comes off at the page's size, shrinks as it goes and is slapped down in its place
    const e = ease.inOutCubic(p), from = [BR.x + BR.w / 2, BR.y + BR.bar + BR.ch / 2];
    const slap = 1 + 0.1 * decay((lb - (h.b + 0.5)) * 0.4839, 0.05) * (p >= 1 ? 1 : 0);
    return {
      x: lerp(from[0], s.x, e), y: lerp(from[1], s.y, e) + 46 * Math.sin(Math.PI * e), r: lerp(0, s.r, e) * (Math.PI / 180) + 0.05 * Math.sin(Math.PI * e),
      sc: lerp(BR.w / PRINT.w, 1, ease.outCubic(p)) * slap, lift: 1 + 1.8 * Math.sin(Math.PI * e), a: 1, landed: p >= 1,
    };
  }
  function drawPrints(g, lb) {
    const { w, h } = PRINT;
    // the album's empty places
    PRINT.slots.forEach((s, k) => {
      const pose = printPose(k, lb), open = tw(lb, HOPS[k].b - 0.45, HOPS[k].b - 0.15, ease.outCubic);
      if ((pose && pose.landed) || open <= 0) return;
      g.save();
      g.translate(s.x, s.y); g.rotate((s.r * Math.PI) / 180); g.scale(0.92 + 0.08 * open, 0.92 + 0.08 * open);
      g.globalAlpha = open;
      g.strokeStyle = C.soft; g.lineWidth = 3; g.setLineDash([12, 10]);
      rr(g, -w / 2 - 10, -h / 2 - 10, w + 20, h + 20, 16); g.stroke();
      g.restore();
    });
    PRINT.slots.forEach((s, k) => {
      const pose = printPose(k, lb);
      if (!pose) return;
      g.save();
      g.globalAlpha = pose.a;
      g.translate(pose.x, pose.y); g.rotate(pose.r); g.scale(pose.sc, pose.sc);
      backing(g, -w / 2, -h / 2, w, h, 6, 10 / Math.max(1, pose.sc), pose.lift);
      g.save(); rr(g, -w / 2, -h / 2, w, h, 6); g.clip();
      g.imageSmoothingQuality = 'high';
      g.drawImage(TH[HOPS[k].name].mid, -w / 2, -h / 2, w, h);
      g.restore();
      const cap = tw(lb, HOPS[k].b + 0.5, HOPS[k].b + 0.75, ease.outCubic);
      if (cap * quiet(lb) > 0) { g.globalAlpha = cap * quiet(lb); mono(g, `t = ${thumbT(HOPS[k].name).toFixed(2)} s`, 0, h / 2 + 46, 28, C.slate, true, 'center'); }
      g.restore();
    });
  }

  // =====================================================================================================================
  // Station B: every frame photographed

  const ROW_T = (T.scan1 - T.scan0) / (WALL.rows - 1 + (DUR - (WALL.rows - 1) * WALL.cols) / WALL.cols);
  /** How many tiles (seconds of film) have been photographed. Row by row, like a carriage. */
  function scanned(lb) {
    if (lb <= T.scan0) return 0;
    const r = Math.floor((lb - T.scan0) / ROW_T), f = (lb - T.scan0) / ROW_T - r;
    return Math.min(DUR, r * WALL.cols + WALL.cols * f);
  }
  const litAt = (i) => T.scan0 + (Math.floor(i / WALL.cols) + (i % WALL.cols) / WALL.cols) * ROW_T;
  const NT = Math.ceil(DUR);
  const tileRect = (i) => {
    const c = i % WALL.cols, r = Math.floor(i / WALL.cols), part = Math.min(1, DUR - i);
    return { x: OB.x + WALL.x + c * (WALL.tw + WALL.gap), y: WALL.y + r * (WALL.th + WALL.gap), w: WALL.tw * part, h: WALL.th, part };
  };
  const TILE_SHOT = Array.from({ length: NT }, (_, i) => shotAt(Math.min(DUR - 0.01, i + 0.5)).name);

  function drawWall(g, lb, env) {
    const x = OB.x + WALL.x, y = WALL.y, n = scanned(lb);
    backing(g, x, y, WALL.w, WALL.h, 8);
    g.imageSmoothingQuality = 'high';
    for (let i = 0; i < WALL.cols * WALL.rows; i++) {
      const r = tileRect(i);
      if (i >= NT) continue;                     // the room left on the last row says where the film ends
      g.fillStyle = C.pale; rr(g, r.x, r.y, r.w, r.h, 4); g.fill();
      if (n <= i) continue;
      const src = TH[TILE_SHOT[i]].small;
      g.save(); rr(g, r.x, r.y, r.w, r.h, 4); g.clip();
      g.drawImage(src, 0, 0, src.width * r.part, src.height, r.x, r.y, r.w, r.h);
      const flash = decay((lb - litAt(i)) * env.spb, 0.05);
      if (flash > 0.01) { g.fillStyle = `rgba(255,255,255,${flash})`; g.fillRect(r.x, r.y, r.w, r.h); }
      g.restore();
    }
    // one slow gleam across the finished wall on the title card, gone before the bar line
    const gu = seg(lb, T.out1 + 0.15, T.rest - 0.15);
    if (gu > 0 && gu < 1) {
      const u = gu, gx = x - 300 + u * (WALL.w + 600);
      g.save(); rr(g, x, y, WALL.w, WALL.h, 6); g.clip();
      const gr = g.createLinearGradient(gx - 140, 0, gx + 140, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.transform(1, 0, -0.35, 1, 0, 0); g.fillRect(gx - 140, y, 280, WALL.h + 300);
      g.restore();
    }
    // where the film ends, in the room left on the last row
    const endA = tw(lb, T.scan1, T.scan1 + 0.3, ease.outCubic);
    if (endA * quiet(lb) > 0) { g.globalAlpha = endA * quiet(lb); mono(g, `${SECS} s`, x + WALL.w - 12, y + WALL.h - WALL.th / 2 + 10, 28, C.slate, true, 'right'); g.globalAlpha = 1; }

    // who is taking the pictures, and what a tile is worth
    const la = tw(lb, T.ab1 - 0.4, T.ab1 - 0.05, ease.outCubic), lb2 = tw(lb, T.ab1 - 0.25, T.ab1 + 0.1, ease.outCubic) * quiet(lb);
    const p = pulled(lb);
    const ix = x, iy = 744;
    if (la > 0) {
      g.save();
      g.globalAlpha = la; g.translate(0, (1 - la) * 14);
      // flat icon: a browser window with no page in it, only a lens
      g.fillStyle = C.ink; rr(g, ix, iy, 104, 96, 14); g.fill();
      g.fillStyle = C.slate; g.beginPath(); g.roundRect(ix, iy, 104, 24, [14, 14, 0, 0]); g.fill();
      g.fillStyle = C.soft; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(ix + 16 + i * 13, iy + 12, 4, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = C.white; g.beginPath(); g.arc(ix + 52, iy + 60, 25, 0, Math.PI * 2); g.fill();
      let snap = 0;                                   // its shutter snaps as each row begins
      for (let r = 0; r < WALL.rows; r++) snap = Math.max(snap, decay((lb - (T.scan0 + r * ROW_T)) * env.spb, 0.045));
      g.fillStyle = C.blue; g.beginPath(); g.arc(ix + 52, iy + 60, 17 * (1 - 0.75 * snap), 0, Math.PI * 2); g.fill();
      g.fillStyle = C.white; g.beginPath(); g.arc(ix + 45, iy + 53, 5, 0, Math.PI * 2); g.fill();
      // larger on the pulled-back card (z 0.476), so its capitals stay over 30 px on screen all the way out
      text(g, 'headless Chromium', ix + 132, iy + lerp(34, 82, p), lerp(46, 92, p), 800, C.ink);
      g.restore();
    }
    if (lb2 > 0) {
      g.save();
      g.globalAlpha = lb2; g.translate(0, (1 - lb2) * 14);
      g.fillStyle = C.pale; g.strokeStyle = C.slate; g.lineWidth = 3;
      rr(g, ix + 133.5, iy + 61.5, 64, 36, 5); g.fill(); g.stroke();
      text(g, `= 1 second = ${ctx.fps} frames`, ix + 212, iy + 96, 46, 600, C.slate);
      g.restore();
    }
  }

  /** The counter: at the wall while it counts, then the title's huge number. Its place and size in the world. */
  function numberPose(lb) {
    const full = fmt(FRAMES);
    const wB = digitsWidth(full, NUM_B.size, 900);
    const sizeT = Math.min(600, (NUM_B.size * NUM_T.maxW) / wB);
    const p = PULL(seg(lb, T.out0, T.out1));
    const land = lb >= T.out1 ? 1 + 0.03 * decay((lb - T.out1) * 0.4839, 0.07) : 1;
    return {
      left: lerp(OB.x + NUM_B.right - wB, NUM_T.left, p), y: lerp(NUM_B.y, NUM_T.y, p), size: NUM_B.size * Math.pow(sizeT / NUM_B.size, p) * land, p, sizeT,
      wB,
    };
  }
  function drawNumber(g, lb, env) {
    if (lb < T.scan0 - 0.1) return;
    const n = lb >= T.scan1 ? FRAMES : Math.round(scanned(lb) * ctx.fps);
    const P = numberPose(lb), s = fmt(n);
    const a = tw(lb, T.scan0 - 0.1, T.scan0 + 0.1);
    // a small kick when the count lands
    const kick = 1 + 0.05 * decay((lb - T.scan1) * env.spb, 0.08) * (lb >= T.scan1 ? 1 : 0);
    g.globalAlpha = a;
    const scale = P.size / NUM_B.size, wFull = P.wB * scale;
    g.save();
    g.translate(P.left + wFull, P.y); g.scale(kick, kick);
    digits(g, s, 0, 0, P.size, 900, C.accent, 'right');
    g.restore();
    if (P.p <= 0) {
      const ua = tw(lb, T.scan0, T.scan0 + 0.3);
      g.globalAlpha = ua;
      text(g, 'frames', OB.x + NUM_B.right + 22, NUM_B.y, 44, 800, C.slate);
    }
    g.globalAlpha = 1;
    // the title's small caption, a word at a time
    // (set to the number's own width, so the two lock up as one block)
    const words = ['frames', '·', 'every', 'one', 'drawn', 'in', 'code'];
    setFont(g, 100, 700);
    const capSize = (100 * (P.wB * (P.sizeT / NUM_B.size) - 16)) / g.measureText(words.join(' ')).width;
    setFont(g, capSize, 700);
    let x = NUM_T.left + 8;
    words.forEach((w, k) => {
      const wa = tw(lb, 9.9 + k * 0.06, 10.1 + k * 0.06, ease.outCubic), ww = g.measureText(w + ' ').width;
      if (wa > 0) { g.globalAlpha = wa; g.fillStyle = k === 0 ? C.ink : C.slate; g.fillText(w, x, NUM_T.y + NUM_T.cap + (1 - wa) * 24); }
      x += ww;
    });
    g.globalAlpha = 1;
  }

  // =====================================================================================================================
  // Station C: frames and sound, zipped into one file

  const zipX = (lb) => lerp(ZIP.x0, ZIP.x1, ease.inOutCubic(seg(lb, T.zip0, T.zip1)));
  const off = (d) => (d <= 0 ? 0 : 50 * (1 - Math.exp(-d / 130)) + 0.03 * d);
  const slope = (d) => (d <= 0 ? 0 : (50 / 130) * Math.exp(-d / 130) + 0.03);
  const STRIP_SHOT = Array.from({ length: ZIP.n }, (_, k) => shotAt(((k + 0.5) / ZIP.n) * DUR).name);

  function drawZip(g, lb, env) {
    const ox = OC.x, oy = OC.y, xs = zipX(lb), pitch = (ZIP.x1 - ZIP.x0) / ZIP.n, b = ZIP.band, hs = ZIP.seam / 2;
    const yT = oy + ZIP.y - hs - b, yB = oy + ZIP.y + hs;                    // the top of each band when closed
    if (lb < T.strips - 0.05) return;
    // what has been joined is one sticker
    if (xs > ZIP.x0 + 4) backing(g, ox + ZIP.x0, yT, xs - ZIP.x0, 2 * b + ZIP.seam, 6);
    const nowX = ZIP.x0 + (filmT(lb) / DUR) * (ZIP.x1 - ZIP.x0);
    g.imageSmoothingQuality = 'high';
    // the two strips are ribbons that run out from the left as the camera arrives
    const run = ZIP.x0 + (ZIP.x1 - ZIP.x0) * tw(lb, T.strips, T.strips + 0.55, ease.inOutCubic);
    const ribbon = (y0, sign, color) => {
      g.fillStyle = color;
      g.beginPath();
      for (let x = ZIP.x0; x < run + 6; x += 6) { const xx = Math.min(x, run); g.lineTo(ox + xx, y0 + sign * off(xx - xs)); }
      for (let x = run; x > ZIP.x0 - 6; x -= 6) { const xx = Math.max(x, ZIP.x0); g.lineTo(ox + xx, y0 + b + sign * off(xx - xs)); }
      g.closePath(); g.fill();
    };
    // the picture: a strip of film, one frame every fifteenth of the way through
    ribbon(yT, -1, C.ink);
    g.fillStyle = C.bg;
    for (let x = ZIP.x0 + 9; x < run - 10; x += pitch / 4) { const o = off(x + 4.5 - xs); rr(g, ox + x, yT + 6 - o, 9, 7, 2); g.fill(); }
    for (let k = 0; k < ZIP.n; k++) {
      const xc = ZIP.x0 + (k + 0.5) * pitch, d = xc - xs;
      const inn = clamp(spring((lb - (T.strips + 0.12 + k * 0.03)) * env.spb, 4, 0.7), 0, 1.2) * (xc + pitch / 2 <= run + pitch ? 1 : 0);
      if (inn <= 0) continue;
      const iw = pitch - 8, ih = (iw * 9) / 16;
      g.save();
      g.translate(ox + xc, yT + 19 + ih / 2 - off(d)); g.rotate(-Math.atan(slope(d))); g.scale(inn, inn);
      g.drawImage(TH[STRIP_SHOT[k]].small, -iw / 2, -ih / 2, iw, ih);
      g.restore();
    }
    // the sound: the film's real waveform
    ribbon(yB, 1, C.blue);
    const bw = (ZIP.x1 - ZIP.x0) / NB;
    for (let j = 0; j < NB; j++) {
      const bx = ZIP.x0 + (j + 0.5) * bw;
      if (bx > run - 4) break;
      const grow = tw(lb, T.strips + 0.15 + j * 0.003, T.strips + 0.5 + j * 0.003, ease.outCubic), hgt = (5 + WAVE[j] * 50) * grow;
      g.fillStyle = bx <= nowX && lb >= T.zip1 ? C.white : 'rgba(255,255,255,0.62)';
      rr(g, ox + bx - 2.5, yB + b / 2 + off(bx - xs) - hgt / 2, 5, hgt, 2.5); g.fill();
    }
    // the teeth
    const tp = 16, nt = Math.floor((ZIP.x1 - ZIP.x0) / tp);
    const teethIn = tw(lb, T.strips + 0.25, T.strips + 0.6);
    if (teethIn > 0) {
      g.globalAlpha = teethIn;
      g.fillStyle = C.soft;
      for (let i = 0; i < nt; i++) {
        const x1 = ZIP.x0 + i * tp + 4, x2 = x1 + 8;
        rr(g, ox + x1 - 4.5, oy + ZIP.y - hs - 2 - off(x1 - xs), 9, 12, 3); g.fill();
        rr(g, ox + x2 - 4.5, oy + ZIP.y + hs - 10 + off(x2 - xs), 9, 12, 3); g.fill();
      }
      g.globalAlpha = 1;
    }
    // what each strip is, in exact numbers
    const l1 = tw(lb, T.strips + 0.35, T.strips + 0.7, ease.outCubic), l2 = tw(lb, T.strips + 0.45, T.strips + 0.8, ease.outCubic);
    // (each label stands clear of its strip while the zip is open, and settles onto it as the pull goes by)
    const lx = ZIP.x0 + 48, la = `${fmt(FRAMES)} frames`, lbl = `${SECS} s of sound`;
    const LS = 44;                                   // capitals of 32 px at the station
    setFont(g, LS, 700);
    const o1 = off(lx + g.measureText(la).width + 20 - xs), o2 = off(lx + g.measureText(lbl).width + 20 - xs), o0 = off(ZIP.x0 + 16 - xs);
    const q = quiet(lb);
    if (l1 * q > 0) { g.globalAlpha = q; leader(g, [[ox + ZIP.x0 + 16, yT - 12 - o0], [ox + ZIP.x0 + 16, yT - 40 - o1], [ox + ZIP.x0 + 34, yT - 40 - o1]], l1); g.globalAlpha = l1 * q; text(g, la, ox + lx, yT - 24 - o1, LS, 700, C.slate); }
    if (l2 * q > 0) { g.globalAlpha = q; leader(g, [[ox + ZIP.x0 + 16, yB + b + 12 + o0], [ox + ZIP.x0 + 16, yB + b + 40 + o2], [ox + ZIP.x0 + 34, yB + b + 40 + o2]], l2); g.globalAlpha = l2 * q; text(g, lbl, ox + lx, yB + b + 56 + o2, LS, 700, C.slate); }
    g.globalAlpha = 1;
    // once it is one strip, the film plays along it: here is now
    if (lb >= T.zip1) {
      const pa = tw(lb, T.zip1, T.zip1 + 0.3), lvl = ctx.music.at(filmT(lb)).rms;
      g.globalAlpha = pa;
      g.fillStyle = C.white; g.fillRect(ox + nowX - 2, yT - 2, 4, 2 * b + ZIP.seam + 4);
      g.beginPath(); g.arc(ox + nowX, yT - 6, 7 + 4 * lvl, 0, Math.PI * 2); g.fill();
      g.strokeStyle = C.ink; g.lineWidth = 3; g.stroke();
      g.globalAlpha = 1;
    }
    // into one file
    const arrow = tw(lb, T.file - 0.12, T.file + 0.05);
    if (arrow > 0) {
      const ax0 = ox + ZIP.x1 + 34, ax1 = ox + FILE.cx - FILE.w / 2 - 26, ay = oy + ZIP.y;
      g.strokeStyle = C.mid; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
      const xe = lerp(ax0, ax1, arrow);
      g.beginPath(); g.moveTo(ax0, ay); g.lineTo(xe, ay); g.stroke();
      g.beginPath(); g.moveTo(xe - 13, ay - 11); g.lineTo(xe, ay); g.lineTo(xe - 13, ay + 11); g.stroke();
    }
    const fk = lb < T.file ? 0 : clamp(spring((lb - T.file) * env.spb, 3.6, 0.5), 0, 1.25);
    if (fk > 0) {
      const { w, h } = FILE, fold = 62;
      g.save();
      g.translate(ox + FILE.cx, oy + FILE.cy); g.rotate((-3 * Math.PI) / 180 * fk + (1 - Math.min(1, fk)) * -0.3); g.scale(lerp(1.5, 1, Math.min(1, fk)) * (0.4 + 0.6 * Math.min(1, fk * 1.4)), lerp(1.5, 1, Math.min(1, fk)) * (0.4 + 0.6 * Math.min(1, fk * 1.4)));
      const doc = (grow) => {
        g.beginPath();
        g.moveTo(-w / 2 - grow, -h / 2 + 18); g.arcTo(-w / 2 - grow, -h / 2 - grow, -w / 2 + 18, -h / 2 - grow, 18 + grow);
        g.lineTo(w / 2 - fold + grow * 0.4, -h / 2 - grow); g.lineTo(w / 2 + grow, -h / 2 + fold - grow * 0.4);
        g.lineTo(w / 2 + grow, h / 2 - 18); g.arcTo(w / 2 + grow, h / 2 + grow, w / 2 - 18, h / 2 + grow, 18 + grow);
        g.lineTo(-w / 2 + 18, h / 2 + grow); g.arcTo(-w / 2 - grow, h / 2 + grow, -w / 2 - grow, h / 2 - 18, 18 + grow);
        g.closePath();
      };
      g.save();
      g.shadowColor = C.shadow; g.shadowBlur = 26 * Z; g.shadowOffsetY = 10 * Z;
      g.fillStyle = C.white; doc(10); g.fill();
      g.restore();
      g.fillStyle = C.ink; doc(0); g.fill();
      g.fillStyle = C.slate;
      g.beginPath(); g.moveTo(w / 2 - fold, -h / 2); g.lineTo(w / 2 - fold, -h / 2 + fold - 14); g.quadraticCurveTo(w / 2 - fold, -h / 2 + fold, w / 2 - fold + 14, -h / 2 + fold); g.lineTo(w / 2, -h / 2 + fold); g.closePath(); g.fill();
      // a play button, and what kind of file
      g.fillStyle = C.white;
      g.beginPath(); g.arc(0, -22, 54, 0, Math.PI * 2); g.fill();
      g.fillStyle = C.ink;
      g.beginPath(); g.moveTo(-17, -50); g.lineTo(30, -22); g.lineTo(-17, 6); g.closePath(); g.fill();
      mono(g, '.mp4', 0, 108, 60, C.white, true, 'center');
      g.restore();
      // its name, dark enough to read at once, and set larger as the camera pulls back so it still reads on the card
      const na = tw(lb, T.file + 0.04, T.file + 0.2, ease.outCubic), p = pulled(lb);
      // (capitals over 30 px on screen at the station and on the card; kept inside title-safe at the station and
      // well clear of the title's caption on the card: there it ends under the sticker's right edge)
      if (na > 0) {
        const ns = lerp(44, 94, p);
        g.font = `700 ${ns}px ${MONO}`;
        const nw = g.measureText(FILENAME).width, right = lerp(1800, FILE.cx + w / 2 + 10, p);
        g.globalAlpha = na; mono(g, FILENAME, ox + Math.min(FILE.cx, right - nw / 2), oy + FILE.cy + h / 2 + lerp(66, 90, p), ns, C.slate, true, 'center'); g.globalAlpha = 1;
      }
    }
  }

  // =====================================================================================================================
  // The cursor: the one orange thing. Its rectangle on screen at any moment (null while it is back on the prompt row).

  const HOME = (() => { const c = cursorRect(DOCK.x + 2 * DOCK.adv, DOCK.rowC, DOCK.size); return { x: c.x + c.w / 2, y: c.y + c.h / 2, w: c.w, h: c.h }; })();
  const promptEnd = () => { const n = (shot.prompt || '').length, c = cursorRect(DOCK.x + (2 + n) * DOCK.adv, DOCK.rowC, DOCK.size); return { x: c.x + c.w / 2, y: c.y + c.h / 2, w: c.w, h: c.h }; };
  const qbez = (p0, c, p1, t) => [(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]];

  const LETGO = 0.1;                            // the part of the ride to the zip spent letting go of the wall
  function cursor(lb, cam) {
    const S = (wx, wy) => toScreen(wx, wy, cam), z = cam.z;
    const head = (l) => { const p = S(playX(l), TL.y); return { x: p[0], y: p[1], w: 18 * z, h: 60 * z, hollow: 0 }; };
    const lastTile = tileRect(NT - 1), firstTile = tileRect(0);
    const onTile = (i) => { const r = tileRect(clamp(Math.floor(i), 0, NT - 1)), p = S(r.x + r.w / 2, r.y + r.h / 2); return { x: p[0], y: p[1], w: (r.w + 12) * z, h: (r.h + 12) * z, hollow: 1 }; };
    const rider = (wx, wy) => { const p = S(wx, wy); return { x: p[0], y: p[1], w: 30 * z, h: 30 * z, hollow: 0 }; };
    const blend = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k), hollow: lerp(a.hollow, b.hollow, k) });
    const pull = (l) => { const p = S(OC.x + zipX(l), OC.y + ZIP.y); return { x: p[0], y: p[1], w: 40 * z, h: 84 * z, hollow: 0 }; };

    if (lb < T.fly0) return null;
    if (lb < T.fly1) {
      // off the prompt row and up to the timeline, in an arc
      const k = ease.inOutCubic(seg(lb, T.fly0, T.fly1)), a = promptEnd(), b = head(lb);
      const p = qbez([a.x, a.y], [a.x + 260, a.y - 330], [b.x, b.y], k);
      return { ...blend({ ...a, hollow: 0 }, b, k), x: p[0], y: p[1] };
    }
    if (lb < T.ab0) return head(lb);
    if (lb < T.ride1) {
      // along the first route to the wall
      const k = GLIDE(seg(lb, T.ab0, T.ride1)), a = head(T.ab0);
      const hw = [playX(T.ab0), TL.y];
      if (k < 0.22) { const u = k / 0.22, q = [lerp(hw[0], ROUTE1[0][0], u), lerp(hw[1], ROUTE1[0][1], u)]; return blend(head(lb), rider(q[0], q[1]), clamp(u * 3)); }
      if (k < 0.72) { const q = R1.at(((k - 0.22) / 0.5) * R1.len); return rider(q[0], q[1]); }
      const u = (k - 0.72) / 0.28, e = R1.at(R1.len), c = [firstTile.x + firstTile.w / 2, firstTile.y + firstTile.h / 2];
      void a;
      return blend(rider(lerp(e[0], c[0], u), lerp(e[1], c[1], u)), onTile(0), smooth(u));
    }
    if (lb < T.bc0) return onTile(scanned(lb));                              // the last frame is taken on scan1
    if (lb < T.zip0) {
      // it lets go of the wall, then rides the second route down to the zip
      const k = GLIDE(seg(lb, T.bc0, T.zip0));
      if (k < LETGO) { const u = ease.inOutCubic(k / LETGO), c = [lastTile.x + lastTile.w / 2, lastTile.y + lastTile.h / 2], s = R2.at(0); return blend(onTile(NT - 1), rider(lerp(c[0], s[0], u), lerp(c[1], s[1], u)), u); }
      const q = R2.at(((k - LETGO) / (1 - LETGO)) * R2.len);
      return blend(rider(q[0], q[1]), pull(lb), smooth(seg(k, 0.94, 1)));
    }
    if (lb < T.home0) return pull(lb);
    if (lb < T.home1) {
      const k = ease.inOutCubic(seg(lb, T.home0, T.home1)), a = pull(T.home0);
      const from = toScreen(OC.x + ZIP.x1, OC.y + ZIP.y, camera(lb));          // the zip's end slides away with the canvas
      const p = qbez(from, [lerp(from[0], HOME.x, 0.5), Math.min(from[1], HOME.y) - 60], [HOME.x, HOME.y], k);
      return { x: p[0], y: p[1], w: lerp(a.w, HOME.w, k), h: lerp(a.h, HOME.h, k), hollow: 0 };
    }
    return null;
  }
  function drawCursor(g, c) {
    if (!c) return;
    const lw = lerp(Math.min(c.w, c.h) / 2, 7, c.hollow), r = lerp(Math.min(5, c.w / 3), 8, c.hollow);
    g.strokeStyle = C.accent; g.lineWidth = lw; g.lineJoin = 'round';
    rr(g, c.x - c.w / 2 + lw / 2, c.y - c.h / 2 + lw / 2, c.w - lw, c.h - lw, Math.max(0, r - lw / 3));
    g.stroke();
    if (c.hollow < 0.02) { g.fillStyle = C.accent; rr(g, c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, r); g.fill(); }
  }

  // =====================================================================================================================
  // The prompt row: a label sticker, as long as what is on it

  function dock(g, env, part) {
    if (part === 'B') return;                       // Claude's lines are too long for a label here: they are on the canvas
    const m = env.term, c = m.rowC, lb = env.lb, y = DOCK.rowC;
    // the old prompt is taken back, right to left, before the next one is typed
    let n = c.n;
    if (c.mode === 'cmd' && m.typing) { const clearAt = m.typing.start - (ctx.script.T.clear ?? 1); n = Math.round(c.n * (1 - tw(lb, clearAt - 0.6, clearAt - 0.05, ease.inOutCubic))); }
    // a key adds a cell to the label and moves the cursor on, both in the same frame as the letter; the label's end
    // then gives a little (it is the only thing that eases, so the cursor never sits on the new letter)
    const give = c.mode === 'typing' && c.n > 0 ? 9 * (1 - tw(c.keyAge(c.n - 1), 0, 0.2, ease.outCubic)) : 0;
    const cols = 2 + n + 1;
    const x0 = DOCK.left, x1 = DOCK.x + cols * DOCK.adv + 22 + give;
    const zKeep = Z; Z = 1;
    backing(g, x0 + 10, y - 54, x1 - x0 - 20, 88, 14, 10, 1);
    Z = zKeep;
    g.font = `700 ${DOCK.size}px ${MONO}`; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.fillStyle = C.soft; g.fillText('>', DOCK.x, y);
    const tx = DOCK.x + 2 * DOCK.adv;
    const home = lb < T.fly0 || lb >= T.home1;
    if (c.cursor && home && m.blink) {
      const cr = cursorRect(tx + n * DOCK.adv, y, DOCK.size);
      g.fillStyle = C.accent; rr(g, cr.x, cr.y, cr.w, cr.h, 5); g.fill();
    }
    g.font = `700 ${DOCK.size}px ${MONO}`;
    for (let i = 0; i < n; i++) {             // letters after the cursor, so nothing is ever drawn over one
      if (c.text[i] === ' ') continue;
      const age = c.mode === 'typing' ? c.keyAge(i) : Infinity, pop = 1 + 0.12 * (1 - tw(age, 0, 0.16, ease.outCubic));
      g.fillStyle = C.ink;
      if (pop > 1.001) { g.save(); g.translate(tx + i * DOCK.adv + 18, y - 20); g.scale(pop, pop); g.fillText(c.text[i], -18, 20); g.restore(); }
      else g.fillText(c.text[i], tx + i * DOCK.adv, y);
    }
  }

  function drawTag(g, env) {
    if (!env.tag) return;
    const a = tw(env.lb, 0.15, 0.7, ease.outCubic);
    if (a <= 0) return;
    g.save();
    g.globalAlpha = a; g.translate((1 - a) * -24, 0);
    const num = `${env.tag.num}/${env.tag.of}`;
    setFont(g, 32, 800);
    const nw = g.measureText(num).width + 32;
    g.letterSpacing = '3px';
    const tw2 = g.measureText(env.tag.name).width;
    g.letterSpacing = '0px';
    const zKeep = Z; Z = 1;
    backing(g, DOCK.x, 104, nw + 18 + tw2 + 10, 50, 10, 8, 0.7);          // a label sticker, like the prompt's
    Z = zKeep;
    g.fillStyle = C.ink; rr(g, DOCK.x, 104, nw, 50, 10); g.fill();
    text(g, num, DOCK.x + 16, 141, 32, 800, C.white);
    text(g, env.tag.name, DOCK.x + nw + 18, 141, 32, 800, C.ink, 'left', 3);
    g.restore();
  }

  // =====================================================================================================================

  // ---- motion blur for the camera's moves ----
  // The canvas is painted once, with a margin, at the middle of the shutter; then it is smeared along the camera's own
  // move (a translation and a zoom about one fixed point) by repeated halving: n passes average 2^n evenly spaced
  // copies, so even the fastest move shows a continuous streak and never stepped ghost copies of the text.
  const BM = 200, SHUT = 0.5;                                          // margin (px) and shutter (of a frame), as the engine's
  const BW = W + 2 * BM, BH = H + 2 * BM;
  const BUF = [makeCanvas(BW, BH), makeCanvas(BW, BH)].map((c) => ({ c, g: c.getContext('2d', { alpha: false }) }));
  /** The screen map from the mid-shutter camera to the end-of-shutter camera, as p -> s p + t, or null when still. */
  function blurMap(env, lb) {
    if (env.lb >= T.rest) return null;
    const half = (SHUT / ctx.fps) / env.spb / 2, m = camera(lb), e = camera(lb + half);
    const s = e.z / m.z, tx = SC.x * (1 - s) + (m.cx - e.cx) * e.z, ty = SC.y * (1 - s) + (m.cy - e.cy) * e.z;
    const reach = Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => Math.hypot((s - 1) * x + tx, (s - 1) * y + ty)));
    if (reach < 0.75) return null;                                     // under 1.5 px of streak: paint it sharp
    return { s, tx, ty, n: clamp(Math.ceil(Math.log2(reach * 2)), 1, 9) };
  }
  /** That map raised to the power u (u = 1 is the end of the shutter, -1 its start), in buffer pixels. */
  function mapPow(B, u) {
    const s = Math.pow(B.s, u);
    let tx, ty;
    if (Math.abs(B.s - 1) < 1e-7) { tx = B.tx * u; ty = B.ty * u; }
    else { const qx = B.tx / (1 - B.s), qy = B.ty / (1 - B.s); tx = qx * (1 - s); ty = qy * (1 - s); }
    return [s, 0, 0, s, tx + BM * (1 - s), ty + BM * (1 - s)];
  }

  function render(g, env) {
    const lb = Math.min(env.lb, T.rest), cam = camera(lb);       // past the bar line the picture is held exactly still
    const B = blurMap(env, lb);
    if (!B) paintCanvas(g, env, lb, cam, 0);
    else {
      let src = BUF[0], dst = BUF[1];
      src.g.setTransform(1, 0, 0, 1, 0, 0);
      paintCanvas(src.g, env, lb, cam, BM);
      for (let k = 1; k <= B.n; k++) {
        const h = Math.pow(0.5, k);
        dst.g.setTransform(1, 0, 0, 1, 0, 0); dst.g.globalAlpha = 1;
        dst.g.fillStyle = C.bg; dst.g.fillRect(0, 0, BW, BH);
        dst.g.setTransform(...mapPow(B, -h)); dst.g.drawImage(src.c, 0, 0);
        dst.g.globalAlpha = 0.5;
        dst.g.setTransform(...mapPow(B, h)); dst.g.drawImage(src.c, 0, 0);
        dst.g.globalAlpha = 1; dst.g.setTransform(1, 0, 0, 1, 0, 0);
        [src, dst] = [dst, src];
      }
      g.drawImage(src.c, BM, BM, W, H, 0, 0, W, H);
    }

    drawCursor(g, cursor(lb, cam));
    drawTag(g, env);
    if (env.noDock) return;
    if (env.other && env.otherImpl && env.otherImpl.dock) swapDock(g, env, dock);
    else dock(g, env);
  }

  /** The canvas and everything stuck on it, through the camera; m is a margin of extra canvas painted round the frame. */
  function paintCanvas(g, env, lb, cam, m) {
    Z = cam.z;
    g.save();
    g.translate(m, m);
    g.fillStyle = C.bg; g.fillRect(-m, -m, W + 2 * m, H + 2 * m);
    g.save();
    g.translate(SC.x, SC.y); g.scale(cam.z, cam.z); g.translate(-cam.cx, -cam.cy);

    // the canvas: register crosses on a 160 px grid, so the camera's move can be felt
    const vx0 = cam.cx - (SC.x + m) / cam.z, vx1 = cam.cx + (W - SC.x + m) / cam.z, vy0 = cam.cy - (SC.y + m) / cam.z, vy1 = cam.cy + (H - SC.y + m) / cam.z;
    g.strokeStyle = '#D2DBE3'; g.lineWidth = Math.max(2, 1.5 / cam.z); g.lineCap = 'butt';
    g.beginPath();
    for (let x = Math.floor(vx0 / 160) * 160; x <= vx1; x += 160) for (let y = Math.floor(vy0 / 160) * 160 + 97; y <= vy1; y += 160) { g.moveTo(x - 8, y); g.lineTo(x + 8, y); g.moveTo(x, y - 8); g.lineTo(x, y + 8); }
    g.stroke();
    const seen = (x0, y0, x1, y1) => x1 > vx0 && x0 < vx1 && y1 > vy0 && y0 < vy1;

    // the routes between the stations, drawn as the cursor travels them
    const r1 = GLIDE(seg(lb, T.ab0, T.ride1)), r1k = clamp((r1 - 0.22) / 0.5);
    g.strokeStyle = C.mid; g.lineWidth = Math.max(4, 2.5 / cam.z); g.lineCap = 'round'; g.lineJoin = 'round';
    const arrowHead = (rt) => { const e = rt.at(rt.len); g.save(); g.translate(e[0], e[1]); g.rotate(e[2]); g.beginPath(); g.moveTo(-15, -12); g.lineTo(0, 0); g.lineTo(-15, 12); g.stroke(); g.restore(); };
    if (r1k > 0) {
      R1.trace(g, R1.len * r1k); g.stroke();
      g.fillStyle = C.mid; g.beginPath(); g.arc(ROUTE1[0][0], ROUTE1[0][1], 8, 0, Math.PI * 2); g.fill();
      if (r1k >= 1) arrowHead(R1);
    }
    const r2 = clamp((GLIDE(seg(lb, T.bc0, T.zip0)) - LETGO) / (1 - LETGO));
    if (r2 > 0) {
      R2.trace(g, R2.len * r2); g.stroke();
      g.fillStyle = C.mid; g.beginPath(); g.arc(ROUTE2[0][0], ROUTE2[0][1], 8, 0, Math.PI * 2); g.fill();
      if (r2 >= 1) arrowHead(R2);
    }

    if (seen(0, 0, 1920, 880)) {
      drawPrints(g, lb);
      if (lb >= T.card0) {
        // Enter brings the page in from the right; what hangs under it follows a moment later
        const slide = (late, draw) => {
          const k = arrive(lb, late);
          g.save();
          g.globalAlpha = clamp(seg(lb, T.card0 + late, T.card0 + late + 0.12));
          g.translate(PAGE_FROM * k, 0);
          g.translate(BR.x + BR.w / 2, BR.y + 240); g.rotate(0.035 * k); g.translate(-(BR.x + BR.w / 2), -(BR.y + 240));
          draw();
          g.restore();
        };
        slide(0, () => { drawPage(g, lb); drawCallout(g, lb); });
        slide(0.1, () => drawTimeline(g, lb));
      }
      drawSentence(g, 0, env, lb);
    }
    if (seen(OB.x, 0, OB.x + 1920, 880)) { drawWall(g, lb, env); drawSentence(g, 1, env, lb); }
    if (seen(0, OC.y, 1920, OC.y + 880)) { drawZip(g, lb, env); drawSentence(g, 2, env, lb); }
    drawNumber(g, lb, env);
    g.restore();
    g.restore();
  }

  /** For the shot that takes this picture over: the frame tiles in view, in frame pixels. */
  function handoff(env) {
    const lb = Math.min(env.lb, T.rest), cam = camera(lb), n = scanned(lb), tiles = [];
    const add = (x, y, w, h, kind) => {
      const p = toScreen(x, y, cam), r = { x: p[0], y: p[1], w: w * cam.z, h: h * cam.z, kind };
      if (r.x + r.w > 0 && r.x < W && r.y + r.h > 0 && r.y < H) tiles.push(r);
    };
    for (let i = 0; i < NT && i < n; i++) { const r = tileRect(i); add(r.x, r.y, r.w, r.h, 'wall'); }
    if (lb >= T.strips + 0.5) {
      const pitch = (ZIP.x1 - ZIP.x0) / ZIP.n, xs = zipX(lb);
      for (let k = 0; k < ZIP.n; k++) { const xc = ZIP.x0 + (k + 0.5) * pitch, iw = pitch - 8; add(OC.x + xc - iw / 2, OC.y + ZIP.y - ZIP.seam / 2 - ZIP.band + 19 - off(xc - xs), iw, (iw * 9) / 16, 'strip'); }
    }
    PRINT.slots.forEach((s, k) => { const p = printPose(k, lb); if (p && p.landed) add(s.x - PRINT.w / 2, s.y - PRINT.h / 2, PRINT.w, PRINT.h, 'print'); });
    if (lb >= T.card0) add(BR.x + PAGE_FROM * arrive(lb), BR.y + BR.bar, BR.w, BR.ch, 'page');
    const P = numberPose(lb), np = toScreen(P.left, P.y - P.size * 0.73, cam);
    return { tiles, bg: C.bg, ink: C.ink, accent: C.accent, number: { x: np[0], y: np[1], w: (P.wB * P.size) / NUM_B.size * cam.z, h: P.size * 0.73 * cam.z, text: fmt(FRAMES) } };
  }

  /** No engine motion blur: render() smears the camera's moves itself, continuously (see blurMap). */
  function samples() { return 1; }

  return {
    render, dock, handoff, samples,
    sfx: [
      { b: 0.5, s: 'sticker_slap', g: 0.45 },                                         // the page settles in its place
      ...T.hops.map((b) => ({ b, s: 'sticker_click', g: 0.6 })),                      // the playhead lands on a moment
      ...T.hops.slice(0, 3).map((b) => ({ b: b + 0.5, s: 'sticker_slap', g: 0.7 })),  // a printed frame is stuck down
      { b: T.ab0 + 0.4, s: 'sticker_whoosh', g: 0.5, a: 'peak' },                     // the camera travels (loudest mid-move)
      { b: T.scan0, s: 'sticker_count', g: 0.6 },                                     // the count runs (0.85 s)
      { b: T.scan1, s: 'sticker_ding', g: 0.7, a: 'peak' },                           // and lands
      { b: T.bc0 + 0.35, s: 'sticker_whoosh', g: 0.5, a: 'peak' },
      { b: T.zip0, s: 'sticker_zip', g: 0.8 },                                        // the zip closes (0.48 s)
      { b: T.file, s: 'sticker_slap', g: 0.9 },                                       // the file is stuck down
      { b: 9.95, s: 'sticker_whoosh', g: 0.6, a: 'peak' },
      { b: T.out1, s: 'sticker_thud', g: 0.8, a: 'peak' },                            // the title number lands
    ],
  };
}
