// 12/15 Collage / Cut-out: "cut what's boring." The jury's HUD is paper after all. Its lock brackets turn into dashed
// cut lines, a pair of scissors snips along them and the whole picture flies apart. Under it: kraft paper, a sheet of
// newsprint set from this film's cue sheet, a red diagonal, and on a black disc the Claude Code mascot, cut out in two.
//
// Then the fixing. A hand slaps down a deck: one print for every Update(shots/...) line Claude is about to print, each
// that very shot, in halftone. On every line the top print flies off the deck into the mascot's head (its top lifts on
// a hinge to take it) and the count of files goes up. On beat 5 the cursor, a block of red paper, knocks the lid right
// open and the prints spill back out in arcs, each with its tick in red grease pencil, and land all over the board;
// the count becomes the number of fixes the result line gives. CUT. FIX. AGAIN. land on beats 1, 3 and 7.
//
// One clock for everything: the whole picture, the terminal's rows included, is held on a step of six pictures a beat
// (12.4 a second at this tempo: five frames a step, now and then four), so every beat and half-beat is a step. A cue
// that falls between two steps lands on the next one, and the sound cues below are given at the step, not the cue, so
// picture and sound stay together. Everything at rest is re-placed by up to 2 px on every step, as if by hand.
// No photographs: the pictures are this film's own frames (assets/thumbs), the hands and scissors are drawn in code.

import { DOCK, swapDock, termModel, mascot, MASCOT, REAL } from '../term.js';
import { clamp, lerp, hash, rng, TAU, deg } from '../util.js';
import { PAL, path, roughRect, tornEdge, fibres, makeKraft, makeNewsprint, makeGrain, dust, halftone, makePiece, tape, splitPoly, clipPoly, centroid } from './collage/paper.js';
import { makeArm, makeScissors, tick, ring } from './collage/props.js';

const SPS = 6;                                                     // pictures a beat
const hold = (lb, max = Infinity) => Math.min(Math.floor(lb * SPS + 1e-6) / SPS, max);
const landing = (at) => Math.ceil(at * SPS - 1e-6);                // the first step at or after a cue

// where the prints come to rest after the spill (centre x, y, tilt in degrees), in the order they come out:
// far and near by turns, so the arcs cross. None lands within 40 px of the ring round the count (see `CLEAR` below)
const SPOTS = [
  [232, 318, -9], [1772, 252, 7], [716, 318, -4], [700, 702, -6], [1040, 132, -5], [1075, 958, -5], [478, 368, 5], [960, 622, 5], [800, 122, -8],
  [1800, 985, 4], [250, 478, 7], [1060, 748, 7], [905, 234, 6], [1806, 530, -4], [1215, 152, 8], [1130, 530, -3], [640, 468, 4],
  [1420, 978, 6], [520, 222, -6], [1790, 520, -4], [860, 500, 8], [330, 180, 4], [1560, 110, -7], [1000, 880, -5],
];
const PRINT = { w: 256, h: 144 }, BIG = { w: 340, h: 191 };        // a print on the board, and on the deck
const DECK = { x: 418, y: 404, rot: -5 };
// the grease-pencil ring round the count (centre, radii) and the clear zone round it: no print lands within CLEAR px of
// the ring's stroke, so the count reads on its own. SPOT: the resting places that keep it clear
const RING = { x: 1462, y: 790, rx: 178, ry: 170 }, CLEAR = 40;
const SPOT = SPOTS.filter(([x, y, r]) => {
  const a = deg(r), ex = RING.rx * 1.05 + 8 + CLEAR, ey = RING.ry * 1.05 + 8 + CLEAR;   // the ring grows 5% as it goes round; its stroke is 12 px
  for (let k = 0; k < 64; k++) {                                     // points round the print's edge, white border included
    const t = (k % 16) / 16, side = k >> 4, hw = PRINT.w / 2 + 6, hh = PRINT.h / 2 + 6;
    const [u, v] = [[-hw + 2 * hw * t, -hh], [hw, -hh + 2 * hh * t], [hw - 2 * hw * t, hh], [-hw, hh - 2 * hh * t]][side];
    const px = x + u * Math.cos(a) - v * Math.sin(a) - RING.x, py = y + u * Math.sin(a) + v * Math.cos(a) - RING.y;
    if ((px / ex) ** 2 + (py / ey) ** 2 < 1) return false;
  }
  return true;
});
// the arms' shoulders, far outside the frame: each arm swings about its own
const ARM = { L: { x: -520, y: 560, flip: 1 }, T: { x: 1000, y: -640, flip: 1 } };

// the red diagonal and the three words on it
const BAND = { a: [100, 700], b: [1820, 110], th: 150 };
const WORDS = [{ text: 'CUT.', at: 1, t: 0.15, tilt: -2 }, { text: 'FIX.', at: 3, t: 0.475, tilt: 1.6 }, { text: 'AGAIN.', at: 7, t: 0.79, tilt: -1.2 }];
// the story, in steps
const ST = { deck: 3, tag: 3, knock: 30, spill: 31, shut: 41, ring: 43, pat: 44, rest: 48 };

// the HUD's three brackets, if that shot is not there to say
const BRACKETS = [{ x: 1372, y: 438, w: 204, h: 164 }, { x: 232, y: 508, w: 244, h: 208 }, { x: 724, y: 632, w: 220, h: 158 }];

const FACES = [
  { fam: 'Anton', url: '/assets/fonts/Anton-Regular.ttf' },
  { fam: 'Archivo Black', url: '/assets/fonts/ArchivoBlack-Regular.ttf' },
  { fam: 'Abril Fatface', url: '/assets/collage/AbrilFatface-Regular.ttf' },
  { fam: 'Alfa Slab One', url: '/assets/collage/AlfaSlabOne-Regular.ttf' },
  { fam: 'Special Elite', url: '/assets/collage/SpecialElite-Regular.ttf' },
  { fam: 'Liberation Serif', url: '/assets/fonts/LiberationSerif-Bold.ttf', weight: '700' },
  { fam: 'Liberation Serif', url: '/assets/fonts/LiberationSerif-BoldItalic.ttf', weight: '700', style: 'italic' },
  { fam: 'JetBrains Mono', weight: '700' },
];
const SKINS = [
  { bg: PAL.cream, ink: PAL.ink }, { bg: PAL.ink, ink: PAL.cream }, { bg: PAL.white, ink: PAL.ink }, { bg: PAL.red, ink: PAL.white },
  { bg: PAL.cream, ink: PAL.ink }, { bg: PAL.ink, ink: PAL.white }, { bg: '#D9D0B8', ink: PAL.ink }, { bg: PAL.yellow, ink: PAL.ink }, { bg: PAL.white, ink: PAL.redDark },
];

export default async function make(ctx) {
  const { W, H, shot, script, cues, clock, makeCanvas, image } = ctx;
  await Promise.all(FACES.filter((f) => f.url).map((f) => ctx.font(f.fam, f.url, { weight: f.weight || '400', style: f.style || 'normal' })));
  const mg = makeCanvas(8, 8).getContext('2d');
  const fontOf = (f, px) => `${f.style || 'normal'} ${f.weight || '400'} ${px}px "${f.fam}"`;
  // every face at the size where its small letters stand 31 px tall, so the row reads as one line
  for (const f of FACES) { mg.font = fontOf(f, 100); f.px = clamp(31 / (mg.measureText('x').actualBoundingBoxAscent / 100), 44, 68); }

  // ---- the cue sheet: one print for every Update line, and the result ----
  const S = script.shots[shot.name];
  const NAME = /shots\/(?:\d+-)?([a-z]+)\.js/;
  const updates = S.out.filter((o) => NAME.test(o.text)).slice(0, SPOT.length);
  const names = updates.map((o) => o.text.match(NAME)[1]);
  const result = S.out.find((o) => o.kind === 'result');
  const fixes = result && result.text.match(/(\d+)\s+([a-z]+)/i);    // "26 fixes applied": the number, and its word
  const N = updates.length;
  /** Everything this shot draws is a function of the held time: the step, and the terminal as it stands on that step. */
  const frameOf = (env) => { const hb = hold(env.lb, shot.beats), step = Math.round(hb * SPS); return { hb, step, term: termModel(script, shot.name, shot.b0 + hb) }; };

  // ---- paper ----
  const kraft = makeKraft(makeCanvas, W, H);
  const grain = makeGrain(makeCanvas);
  const lines = cues.shots.flatMap((s) => [s.prompt, ...(s.out || []).map((o) => o.text)]).filter(Boolean);
  // the shots the film counts are the numbered ones (the open and the end have no number)
  const numbered = cues.shots.filter((s) => s.num != null).length;
  const news = makeNewsprint(makeCanvas, 1010, 600, lines, 'CUE SHEET', `${numbered} SHOTS  ·  ${Math.round(clock.totalBeats / cues.beatsPerBar)} BARS  ·  ${Math.round(clock.totalBeats)} BEATS  ·  ${clock.bpm} BPM`);

  const bandAng = Math.atan2(BAND.b[1] - BAND.a[1], BAND.b[0] - BAND.a[0]), bandLen = Math.hypot(BAND.b[0] - BAND.a[0], BAND.b[1] - BAND.a[1]);
  const onBand = (t) => [lerp(BAND.a[0], BAND.b[0], t), lerp(BAND.a[1], BAND.b[1], t)];

  const DISC_AT = [1456, 584];
  // the ground with everything that never moves: kraft, the newsprint, a black disc, the red diagonal
  const base = makeCanvas(W, H);
  {
    const g = base.getContext('2d'), R = rng(909);
    g.drawImage(kraft, 0, 0);
    // newsprint, top left, a little askew
    g.save(); g.translate(60, 196); g.rotate(deg(-3.2));
    g.save(); g.translate(5, 8); g.filter = 'blur(7px)'; path(g, news.pts); g.fillStyle = 'rgba(40,22,4,0.4)'; g.fill(); g.restore();
    g.drawImage(news.c, 0, 0);
    g.restore();
    // a black disc for the mascot to sit on, cut by hand
    g.save(); g.translate(DISC_AT[0], DISC_AT[1]);
    const disc = Array.from({ length: 40 }, (_, i) => { const a = (i / 40) * TAU, r = 376 + (R() - 0.5) * 9; return [Math.cos(a) * r, Math.sin(a) * r]; });
    g.save(); g.translate(5, 8); g.filter = 'blur(8px)'; path(g, disc); g.fillStyle = 'rgba(40,22,4,0.45)'; g.fill(); g.restore();
    path(g, disc); g.fillStyle = PAL.ink; g.fill();
    g.save(); path(g, disc); g.clip(); fibres(g, 800, 800, R, { dark: 'rgba(0,0,0,', light: 'rgba(120,110,95,', n: 500, blotch: 0 }); g.restore();
    g.restore();
    // the red diagonal: a long strip of red paper, one edge torn
    g.save(); g.translate(BAND.a[0], BAND.a[1]); g.rotate(bandAng);
    const x0 = -260, x1 = bandLen + 260, h = BAND.th / 2;
    const strip = [[x0, -h], ...tornEdge([x0, -h], [x1, -h + 4], R, 3.2, 9), [x1, -h + 4], [x1, h - 3], ...tornEdge([x1, h - 3], [x0, h], R, 1.2, 60), [x0, h]];
    g.save(); g.translate(4, 9); g.filter = 'blur(8px)'; path(g, strip); g.fillStyle = 'rgba(40,22,4,0.45)'; g.fill(); g.restore();
    path(g, strip); g.fillStyle = PAL.red; g.fill();
    g.save(); path(g, strip); g.clip();
    g.translate(x0, -h); fibres(g, x1 - x0, 2 * h, R, { dark: 'rgba(120,10,6,', light: 'rgba(255,170,150,', n: 2600, blotch: 10 });
    g.restore();
    // the torn edge shows the paper's white core
    g.strokeStyle = 'rgba(250,240,225,0.7)'; g.lineWidth = 2.2; g.beginPath(); strip.slice(0, strip.findIndex((p) => p[0] === x1) + 1).forEach((p, i) => (i ? g.lineTo(p[0], p[1] + 1) : g.moveTo(p[0], p[1] + 1))); g.stroke();
    g.restore();
  }

  // ---- the prints: this film's own frames, printed in halftone and cut out. Each twice: big for the deck, small for the board ----
  const PIECES = await Promise.all(updates.map(async (o, i) => {
    const [x, y, rot] = SPOT[i];
    let src;
    try { src = await image(`/assets/thumbs/${names[i]}.png`); }
    catch { src = makeCanvas(960, 540); const q = src.getContext('2d'); q.fillStyle = `hsl(${(i * 47) % 360} 45% 36%)`; q.fillRect(0, 0, 960, 540); }
    const ang = deg(45 + ((i * 15) % 30));
    const ht = halftone(makeCanvas, src, PRINT.w, PRINT.h, 4.6, ang), hb = halftone(makeCanvas, src, BIG.w, BIG.h, 5.4, ang);
    const R = rng(4100 + i * 31);
    return {
      i, name: names[i], x, y, rot, w: PRINT.w, h: PRINT.h, color: ht.color,
      pc: makePiece(makeCanvas, ht.c, PRINT.w, PRINT.h, 300 + i * 17, 40), big: makePiece(makeCanvas, hb.c, BIG.w, BIG.h, 300 + i * 17, 48),
      L: landing(o.at),                                             // the step its line prints: it is in the mascot's mouth
      out: ST.spill + Math.floor(i / 2),                            // the step it comes back out
      lie: [(R() - 0.5) * 22, (R() - 0.5) * 16, (R() - 0.5) * 9],  // how it lies in the deck
      spin: (R() < 0.5 ? -1 : 1) * (24 + R() * 30),
      // its red tick (the seed for it), or 0: only the prints well away from the count get one, so the red near it is the ring
      tick: Math.hypot(x - RING.x, y - RING.y) > 560 ? 11 + i : 0,
    };
  }));
  const LAST = N ? PIECES[N - 1].L : ST.knock - 1;

  // ---- the actors ----
  const armFlat = makeArm(makeCanvas, 'flat', 3);
  const scOpen = makeScissors(makeCanvas, 38), scShut = makeScissors(makeCanvas, 5);

  // ---- the three words, each on its own strip of black paper ----
  const WORD = WORDS.map((wd, i) => {
    const px = 158, R = rng(60 + i);
    mg.font = `400 ${px}px "Anton"`; mg.letterSpacing = '6px';
    const tw = mg.measureText(wd.text).width, w = Math.ceil(tw + 92), h = 196, pad = 30;
    const c = makeCanvas(w + 2 * pad, h + 2 * pad), g = c.getContext('2d');
    const pts = roughRect(pad, pad, w, h, R, 4, 2);
    const sh = makeCanvas(w + 2 * pad, h + 2 * pad), s = sh.getContext('2d'); s.filter = 'blur(9px)'; path(s, pts); s.fillStyle = '#000'; s.fill();
    path(g, pts); g.fillStyle = PAL.ink; g.fill();
    g.save(); path(g, pts); g.clip(); fibres(g, w + 60, h + 60, R, { dark: 'rgba(0,0,0,', light: 'rgba(130,118,100,', n: 260, blotch: 0 });
    g.font = `400 ${px}px "Anton"`; g.letterSpacing = '6px'; g.textBaseline = 'alphabetic'; g.fillStyle = PAL.white;
    g.fillText(wd.text, pad + 46, pad + h / 2 + px * 0.365);
    // letterpress: the ink did not take everywhere
    g.fillStyle = 'rgba(27,24,21,0.55)';
    for (let k = 0; k < 420; k++) g.fillRect(pad + R() * w, pad + R() * h, 0.8 + R() * 2.2, 0.8 + R() * 1.6);
    g.restore();
    mg.letterSpacing = '0px';
    const [x, y] = onBand(wd.t);
    return { ...wd, c, sh, w: w + 2 * pad, h: h + 2 * pad, x, y, rot: bandAng + deg(wd.tilt) };
  });

  // ---- the count on the black disc: a big cut-out numeral for every file taken in, then the number of fixes ----
  const DISC = DISC_AT;
  const numeral = (text, i) => {
    const f = [FACES[0], FACES[2], FACES[3], FACES[1]][i % 4], px = (f.fam === 'Anton' ? 430 : 360) * (text.length > 1 ? 0.86 : 1), c = makeCanvas(640, 480), g = c.getContext('2d'), R = rng(700 + i);
    g.font = fontOf(f, px); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const m = g.measureText(text), yb = 240 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    g.fillStyle = [PAL.white, PAL.red, PAL.cream, PAL.yellow][i % 4]; g.fillText(text, 320, yb);
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 320; k++) { g.globalAlpha = 0.5 + R() * 0.5; g.fillRect(R() * 640, R() * 480, 1 + R() * 2.4, 1 + R() * 1.6); }
    return { c, rot: deg((R() - 0.5) * 10) };
  };
  const NUM = PIECES.map((P, i) => numeral(String(i + 1), i));
  const NUM_FIX = fixes ? numeral(fixes[1], 1) : null;               // red

  // ---- Claude Code's mascot, cut out in two parts: its top is a lid on a hinge ----
  // (the shape is the terminal's own block mascot, from term.js)
  const QW = 24, QH = 48;
  const MASC = (() => {
    const t = makeCanvas(MASCOT.cols * QW, MASCOT.rows * QH), tg = t.getContext('2d');
    mascot(tg, 0, 0, QW, QH, REAL.orange);
    const part = (r0, r1, c0, c1, seed, eyes) => {
      const pw = (c1 - c0 + 1) * QW, ph = (r1 - r0 + 1) * QH, pad = 28, c = makeCanvas(pw + 2 * pad, ph + 2 * pad), g = c.getContext('2d'), R = rng(seed);
      const pts = roughRect(pad - 10, pad - 10, pw + 20, ph + 20, R, 3.4, 1);
      const sh = makeCanvas(pw + 2 * pad, ph + 2 * pad), sg = sh.getContext('2d'); sg.filter = 'blur(8px)'; path(sg, pts); sg.fillStyle = '#000'; sg.fill();
      path(g, pts); g.fillStyle = PAL.white; g.fill();
      if (eyes) { g.fillStyle = PAL.ink; g.fillRect(pad + 2, pad + 2, pw - 4, ph - 4); }
      g.drawImage(t, c0 * QW, r0 * QH, pw, ph, pad, pad, pw, ph);
      g.save(); g.beginPath(); g.rect(pad, pad, pw, ph); g.clip(); g.translate(pad, pad); fibres(g, pw, ph, R, { dark: 'rgba(120,50,20,', light: 'rgba(255,220,190,', n: 190, blotch: 0 }); g.restore();
      return { c, sh, pad, pw, ph, x: c0 * QW, y: r0 * QH };
    };
    return { w: MASCOT.cols * QW, h: MASCOT.rows * QH, up: part(0, 1, 3, 14, 71, true), lo: part(2, 4, 1, 16, 72, false) };
  })();
  const MX = DISC[0] - MASC.w / 2, MY = 400;                        // its top left
  const HINGE = [MX + MASC.up.x + MASC.up.pw, MY + MASC.up.ph];      // the lid's hinge: the foot of its right end
  const MOUTH = [DISC[0] + 10, MY + 74], REST = [DISC[0] + 6, 756];  // where prints come out; where the count sits
  /** How far the lid is open on a step, in degrees: a wedge to take a print in, right over for the spill. */
  const lidAt = (step) => {
    if (step === ST.knock || step === ST.shut - 1) return 35;
    if (step > ST.knock && step < ST.shut - 1) return 70;
    return PIECES.some((P) => P.L === step) ? 11 : 0;
  };

  // ---- ransom letters: one scrap a letter, cut from different printing ----
  const scraps = new Map();
  function scrap(ch, face, skin, seed, big = 1) {
    const key = `${ch}|${FACES.indexOf(face)}|${SKINS.indexOf(skin)}|${seed}|${big}`;
    if (scraps.has(key)) return scraps.get(key);
    const R = rng(seed * 7919 + ch.charCodeAt(0) * 31);
    const thin = /[.,'`:;!|il]/.test(ch), deep = /[gjpqy,;]/.test(ch);
    const w = ((thin ? 25 : 33.5) + R() * 2) * big, top = (51 + R() * 5) * big, bot = ((deep ? 15 : 9) + R() * 3) * big;
    const cw = Math.ceil(64 * big), chh = Math.ceil(100 * big), bx = cw / 2, by = Math.ceil(66 * big);
    const c = makeCanvas(cw, chh), g = c.getContext('2d');
    const pts = roughRect(bx - w / 2, by - top, w, top + bot, R, 1.7 * big, R() < 0.5 ? 1 : 0);
    g.save(); g.translate(1.5, 2.6); path(g, pts); g.fillStyle = 'rgba(40,22,4,0.4)'; g.fill(); g.restore();
    path(g, pts); g.fillStyle = skin.bg; g.fill();
    g.save(); path(g, pts); g.clip();
    g.fillStyle = skin.bg === PAL.ink ? 'rgba(140,128,110,0.25)' : 'rgba(70,50,30,0.16)';
    for (let k = 0; k < 14; k++) g.fillRect(R() * cw, R() * chh, 1 + R() * 1.5, 1);
    const px = face.px * big;
    g.font = fontOf(face, px); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = skin.ink;
    const mw = g.measureText(ch).width, sx = Math.min(1, (w - 5 * big) / Math.max(1, mw));
    g.translate(bx, by); g.scale(sx, 1); g.fillText(ch, 0, 0);
    g.restore();
    const out = { c, bx, by };
    scraps.set(key, out);
    return out;
  }
  const ransoms = new Map();
  /** A line of text as ransom letters: which printing each is cut from, and how it lies. The same text is always cut the same way. */
  function ransom(text, big = 1) {
    const key = text + '|' + big;
    if (ransoms.has(key)) return ransoms.get(key);
    let seed = 17; for (const ch of text) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const R = rng(seed);
    let pf = -1, ps = -1;
    const out = [...text].map((ch, i) => {
      if (ch === ' ') return null;
      let f, s;
      do { f = Math.floor(R() * FACES.length); } while (f === pf);
      do { s = Math.floor(R() * SKINS.length); } while (s === ps || (SKINS[s].bg === PAL.red && /[^a-zA-Z0-9]/.test(ch)));   // the only plain red block is the cursor
      pf = f; ps = s;
      return { ch, sp: scrap(ch, FACES[f], SKINS[s], (seed % 997) + i, big), rot: deg((R() - 0.5) * 9), dy: (R() - 0.5) * 5, seed: seed + i * 13 };
    });
    ransoms.set(key, out);
    return out;
  }

  // ---- the corner mark: "12/15" on red, the style's name in cut letters ----
  const TAG = (() => {
    if (!ctx.tag) return null;
    const c = makeCanvas(620, 150), g = c.getContext('2d'), R = rng(1215);
    const num = `${ctx.tag.num}/${ctx.tag.of}`;
    g.font = '400 66px "Anton"'; g.letterSpacing = '2px';
    const nw = g.measureText(num).width + 38;
    g.save(); g.translate(22 + nw / 2, 76); g.rotate(deg(-3.5));
    const pts = roughRect(-nw / 2, -45, nw, 90, R, 3, 1);
    g.save(); g.translate(2, 4); path(g, pts); g.fillStyle = 'rgba(40,22,4,0.4)'; g.fill(); g.restore();
    path(g, pts); g.fillStyle = PAL.red; g.fill();
    g.fillStyle = PAL.white; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText(num, 1, 25);
    g.restore(); g.letterSpacing = '0px';
    const L = ransom(ctx.tag.name, 1.22);
    L.forEach((l, i) => {
      if (!l) return;
      g.save(); g.translate(22 + nw + 40 + i * 48, 96 + l.dy); g.rotate(l.rot * 0.8);
      g.drawImage(l.sp.c, -l.sp.bx, -l.sp.by);
      g.restore();
    });
    return c;
  })();

  // ---- small helpers ----
  const rot2 = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  /** Placed by hand: up to 2 px and a fraction of a degree off, different on every step. */
  const jit = (id, step) => [(hash(id * 13.7 + step * 7.31) - 0.5) * 4, (hash(id * 5.3 + step * 3.17) - 0.5) * 4, deg((hash(id * 9.1 + step * 1.93) - 0.5) * 0.6)];
  for (const w of WORD) w.step = Math.round(w.at * SPS);

  /** The red paper block that is this shot's cursor, w by h around (0, 0). */
  function block(g, x, y, a = 0, s = 1, lift = 0) {
    g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
    const pts = [[-15, -31], [14.5, -30], [15.5, 29], [-14, 30.5]];
    g.save(); g.translate(2 + lift * 0.5, 3 + lift); path(g, pts); g.fillStyle = `rgba(40,22,4,${0.42 - Math.min(0.2, lift * 0.012)})`; g.fill(); g.restore();
    path(g, pts); g.fillStyle = PAL.red; g.fill();
    g.fillStyle = 'rgba(255,190,170,0.35)'; g.fillRect(-12, -28, 5, 54);
    g.restore();
  }
  const cellX = (col) => DOCK.x + (col + 0.5) * DOCK.adv;
  const CMD = (S.prompt || '').length;
  const KNOCK = [HINGE[0] - MASC.up.pw - 30, MY + 66];              // where the cursor hits the lid: its free end

  /** Where the cursor block is while it is away from the prompt row to knock the lid open; null when it is home. */
  function blockAway(step) {
    const k = step - ST.knock;
    if (k < -2 || k > 1) return null;
    const a = [cellX(2 + CMD), DOCK.rowC - 20], b = [cellX(2), DOCK.rowC - 20];
    if (k === -2) return { x: lerp(a[0], KNOCK[0], 0.3), y: lerp(a[1], KNOCK[1], 0.3) - 170, rot: deg(30), s: 1.4, lift: 30 };
    if (k === -1) return { x: lerp(a[0], KNOCK[0], 0.74), y: lerp(a[1], KNOCK[1], 0.74) - 150, rot: deg(72), s: 1.6, lift: 36 };
    if (k === 0) return { x: KNOCK[0], y: KNOCK[1], rot: deg(104), s: 1.45, lift: 8 };
    return { x: lerp(KNOCK[0], b[0], 0.5), y: lerp(KNOCK[1], b[1], 0.5) - 40, rot: deg(-44), s: 1.5, lift: 36 };
  }

  // ---- the terminal's two rows (given the held frame F) ----
  const STRIPS = ['#EFE7D3', '#E2D9C2', '#F5F0E3'];
  const strips = new Map();
  function stripPts(x0, x1, y0, y1, seed) {
    const key = `${x0}|${x1}|${seed}`;
    if (!strips.has(key)) { const R = rng(seed); strips.set(key, [[x0, y0 + R() * 3], [x1 - 6, y0 - 1 + R() * 4], ...tornEdge([x1 - 6, y0], [x1, y1], R, 3.5, 7), [x1 - 2, y1 - R() * 3], [x0 + 3, y1 + R() * 2], ...tornEdge([x0 + 3, y1], [x0, y0], R, 3, 8)]); }
    return strips.get(key);
  }
  function rowB(g, F, o, idx) {
    const y = DOCK.rowB, isRes = o.kind === 'result', col0 = isRes ? 5 : 2;
    const text = o.kind === 'say' ? o.text.slice(0, o.chars) : o.text;
    const k = Math.floor(o.age * SPS + 1e-6);
    const x0 = DOCK.x - 34, x1 = cellX(col0 + o.text.length) + 12;
    const pts = stripPts(x0, x1, y - 62, y + 24, 500 + idx * 7 + o.text.length);
    const [jx, jy] = jit(70 + idx, F.step);
    g.save();
    // slapped down: a step in the air, then flat
    if (k <= 0) { g.translate(x0 + 200, y - 20); g.rotate(deg(-1.7)); g.scale(1.05, 1.05); g.translate(-x0 - 200 - 5, -y + 20 - 9); }
    else g.translate(jx * 0.4, jy * 0.4);
    g.save(); g.translate(k <= 0 ? 10 : 2.5, k <= 0 ? 16 : 5); g.filter = 'blur(4px)'; path(g, pts); g.fillStyle = 'rgba(40,22,4,0.42)'; g.fill(); g.restore();
    path(g, pts); g.fillStyle = isRes ? PAL.red : STRIPS[idx % STRIPS.length]; g.fill();
    const ink = isRes ? PAL.white : PAL.ink;
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const cut = o.kind === 'tool' ? Math.max(0, text.indexOf('(')) : 0;
    if (cut) {                                                       // the tool's name: a black label
      const lp = roughRect(cellX(col0) - 23, y - 51, cut * DOCK.adv + 10, 66, rng(900 + idx), 2, 0);
      path(g, lp); g.fillStyle = PAL.ink; g.fill();
    }
    g.font = '400 54px "Special Elite"';
    for (let i = 0; i < text.length; i++) {
      if (text[i] === ' ') continue;
      g.fillStyle = i < cut ? PAL.white : ink;
      const mw = g.measureText(text[i]).width, sx = Math.min(1, 34 / mw);
      g.save(); g.translate(cellX(col0 + i), y + (hash(i * 3.1 + idx) - 0.5) * 2.4); g.scale(sx, 1); g.fillText(text[i], 0, 0); g.restore();
    }
    if (isRes) {                                                      // the elbow
      g.strokeStyle = PAL.white; g.lineWidth = 5; g.lineCap = 'butt'; g.lineJoin = 'miter';
      g.beginPath(); g.moveTo(cellX(2), y - 44); g.lineTo(cellX(2), y - 7); g.lineTo(cellX(2) + 28, y - 7); g.stroke();
    } else {                                                          // Claude's bullet: a round sticker
      const done = o.kind !== 'tool' || o.age >= 0.35;
      g.fillStyle = 'rgba(40,22,4,0.35)'; g.beginPath(); g.arc(cellX(0) + 1.5, y - 17, 15, 0, TAU); g.fill();
      g.fillStyle = done ? PAL.red : PAL.ink; g.beginPath(); g.arc(cellX(0), y - 19, 14.5, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.arc(cellX(0) - 4, y - 23, 4.5, 0, TAU); g.fill();
    }
    g.restore();
  }
  function rowC(g, F, c, blink) {
    const y = DOCK.rowC;
    const draw = (l, col, k) => {
      const [jx, jy, jr] = jit(l.seed, F.step);
      g.save(); g.translate(cellX(col) + (k > 0 ? jx * 0.3 : 0), y + l.dy + (k > 0 ? jy * 0.3 : -9)); g.rotate(l.rot + (k > 0 ? jr * 0.6 : deg(8)));
      if (k <= 0) g.scale(1.2, 1.2);
      g.drawImage(l.sp.c, -l.sp.bx, -l.sp.by);
      g.restore();
    };
    draw(ransom('>')[0], 0, 9);
    const L = ransom(c.text);
    for (let i = 0; i < c.n; i++) if (L[i]) draw(L[i], 2 + i, c.mode === 'typing' ? Math.floor(c.keyAge(i) * SPS + 1e-6) : 9);
    if (!blockAway(F.step) && (c.mode === 'cmd' || (c.cursor && blink))) {
      const k = F.step - ST.knock, home = k === 2 || k === 3;          // just back from the mascot
      block(g, cellX(2 + c.n), y - 20 + (home ? 3 : 0), deg(home ? -6 : 2.5), home ? 1.12 : 1);
    }
  }
  /** Both rows (part 'B' or 'C' draws one). Whoever asks, they stand as they do on this shot's current step. */
  function dock(g, env, part) {
    const F = frameOf(env), m = F.term;
    if (part !== 'C' && m.last) rowB(g, F, m.last, m.out.length - 1);
    if (part === 'B') return;
    rowC(g, F, m.rowC, m.blink);
  }

  // ---- the hand-over in: the HUD's picture cut along its own brackets ----
  const cuts = new Map();
  function cutPlan(br) {
    const key = JSON.stringify(br);
    if (cuts.has(key)) return cuts.get(key);
    const b = (br.length >= 3 ? [...br] : [...BRACKETS]).sort((p, q) => p.x - q.x);
    const l = b[0], m = b[Math.floor(b.length / 2)], r = b[b.length - 1];   // the cuts run along the left, middle and right ones
    const ext = (a, c) => { const dx = c[0] - a[0], dy = c[1] - a[1]; return [[a[0] - dx * 9, a[1] - dy * 9], [a[0] + dx * 9, a[1] + dy * 9]]; };
    const H1 = ext([l.x, l.y], [r.x + r.w, r.y]);                   // along the tops of the left and right brackets
    const lines = [
      H1,
      ext([l.x, l.y + l.h], [m.x + m.w, m.y + m.h]),                // along the feet of the left and middle ones
      ext([l.x + l.w - 16, 0], [l.x + l.w + 22, H]),                // down the left one's right side
      ext([m.x + 26, 0], [m.x - 20, H]),                            // down the middle one's left side
      ext([r.x - 24, 0], [r.x + 20, H]),                            // down the right one's left side
    ];
    let cells = [[[0, 0], [W, 0], [W, H], [0, H]]];
    for (const [a, c] of lines) cells = cells.flatMap((p) => splitPoly(p, a, c).filter(Boolean));
    const wins = b.slice(0, 5).map((q, i) => ({ pts: roughRect(q.x - 4, q.y - 4, q.w + 8, q.h + 8, rng(30 + i), 3, 1), win: true }));
    const out = cells.map((pts, i) => {
      const [cx, cy] = centroid(pts);
      return { pts, c: [cx, cy], holes: wins.map((w) => clipPoly(w.pts, pts)).filter(Boolean), rel: cx > 1000 ? 2 : 1, spin: deg((hash(i * 3.3) - 0.5) * 9), dir: [cx - W / 2, cy - 560 + 120] };
    });
    for (const [i, w] of wins.entries()) { const [cx, cy] = centroid(w.pts); out.push({ pts: w.pts, c: [cx, cy], holes: [], rel: cx > 1000 ? 2 : 1, spin: deg(i % 2 ? 11 : -9), dir: [(cx - W / 2) * 0.5, -500], win: true }); }
    for (const p of out) { const d = Math.hypot(p.dir[0], p.dir[1]) || 1; p.dir = [p.dir[0] / d, p.dir[1] / d]; }
    const plan = { cells: out, lines, H1, wins };
    cuts.set(key, plan);
    return plan;
  }
  // Paper does not move by itself: the HUD is cut up as it stood on the last frame before this shot, not as it goes on
  // running under it. It is painted once more, at that instant, on a sheet of this shot's own (the same picture every
  // time, so it is kept). If the neighbour cannot be painted that way, its live picture is used.
  let sheet = null;
  function hudSheet(env) {
    if (sheet) return sheet;
    try {
      const o = env.otherEnv, t = shot.t0 - 0.5 / ctx.fps, dt = o.t - t, db = dt / o.spb, ab = o.ab - db;
      const fenv = { ...o, t, lt: o.lt - dt, ab, lb: o.lb - db, frame: Math.round(t * ctx.fps), term: termModel(script, o.term.name, ab) };
      const c = makeCanvas(W, H), q = c.getContext('2d');
      q.save(); env.otherImpl.render(q, fenv); q.restore();
      sheet = { c, env: fenv };
    } catch { sheet = { c: null, env: null }; }
    return sheet;
  }
  function handover(g, env, F) {
    const hs = F.step;
    if (hs > 8) return;
    const still = hudSheet(env).c || env.other;
    let br = BRACKETS;
    try { const h = env.otherImpl && env.otherImpl.handoff && env.otherImpl.handoff(env.otherEnv); if (h && h.brackets && h.brackets.length >= 3) br = h.brackets.slice(0, 5).map(({ x, y, w, h: hh }) => ({ x, y, w, h: hh })); } catch { /* the stand-ins will do */ }
    const plan = cutPlan(br);
    for (const p of plan.cells) {
      const n = hs - p.rel;
      const d = n < 0 ? 0 : n === 0 ? 9 : 70 * n + 42 * n * n;
      if (d > 1700) continue;
      const a = n <= 0 ? (n === 0 ? p.spin * 0.12 : 0) : p.spin * n * (p.win ? 1.4 : 0.6);
      g.save();
      g.translate(p.c[0] + p.dir[0] * d, p.c[1] + p.dir[1] * d + (n > 0 ? 7 * n * n : 0)); g.rotate(a); g.translate(-p.c[0], -p.c[1]);
      const outline = () => {
        g.beginPath();
        p.pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath();
        for (const hole of p.holes) { hole.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); }
      };
      if (n >= 0) { g.save(); g.shadowColor = 'rgba(30,16,2,0.5)'; g.shadowBlur = 18; g.shadowOffsetX = 5; g.shadowOffsetY = 10 + 4 * n; outline(); g.fillStyle = PAL.white; g.fill('evenodd'); g.restore(); }
      g.save(); outline(); g.clip('evenodd'); g.drawImage(still, 0, 0); g.restore();
      if (n >= 0) { outline(); g.strokeStyle = PAL.white; g.lineWidth = p.win ? 9 : 7; g.lineJoin = 'round'; g.stroke(); }
      g.restore();
    }
    // the brackets, now dashed cut lines; they are gone once the scissors have been through
    if (hs <= 1) {
      g.save(); g.strokeStyle = PAL.white; g.lineWidth = 6; g.setLineDash([26, 15]); g.lineDashOffset = hs * 13; g.lineCap = 'butt';
      g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 4;
      for (const [a, c] of plan.lines) { if (hs === 1 && a === plan.H1[0]) continue; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(c[0], c[1]); g.stroke(); }
      if (hs === 0) for (const w of plan.wins) { path(g, w.pts); g.stroke(); }
      g.restore();
    }
    // the scissors run along the first cut, shut on the odd steps
    if (hs <= 3) {
      const [a, c] = plan.H1, ang = Math.atan2(c[1] - a[1], c[0] - a[0]), x = -150 + 700 * hs, t = (x - a[0]) / (c[0] - a[0]), y = a[1] + (c[1] - a[1]) * t;
      const sc = hs % 2 ? scShut : scOpen, k = 1.3;
      g.save(); g.translate(x, y); g.rotate(ang); g.scale(k, k);
      g.save(); g.globalAlpha = 0.4; g.drawImage(sc.sh, -sc.ox + 14, -sc.oy + 22); g.restore();
      g.drawImage(sc.c, -sc.ox, -sc.oy);
      g.restore();
    }
  }

  // ---- arms and prints ----
  /** Where arm A's hand is when it reaches for (x, y), pulled `back` px toward the shoulder and swung `turn` degrees about it. */
  function reach(A, x, y, back, turn) {
    const dx = x - A.x, dy = y - A.y, L = Math.hypot(dx, dy), a = Math.atan2(dy, dx) + deg(turn) * A.flip, r = L - back;
    return [A.x + Math.cos(a) * r, A.y + Math.sin(a) * r, a];
  }
  function drawArm(g, arm, x, y, a, s, lift, flip) {
    // (x, y) is where the middle of the palm goes
    const [hx, hy] = arm.hit;
    g.save(); g.globalAlpha = 0.36 - lift * 0.004; g.translate(x + 8 + lift * 0.9, y + 12 + lift * 1.2); g.rotate(a); g.scale(s, s * flip); g.drawImage(arm.sh, -arm.ox - hx, -arm.oy - hy); g.restore();
    g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s * flip); g.drawImage(arm.c, -arm.ox - hx, -arm.oy - hy); g.restore();
  }
  /** One print (pc: its sprite), centre at (x, y). lift: how far above the paper it is. checked: its red tick. */
  function print(g, pc, x, y, a, s = 1, lift = 0, checked = 0) {
    g.save(); g.globalAlpha = 0.5 - Math.min(0.26, lift * 0.006); g.translate(x + 3 + lift * 0.7, y + 5 + lift); g.rotate(a); g.scale(s, s); g.drawImage(pc.sh, -pc.w / 2 - pc.pad, -pc.h / 2 - pc.pad); g.restore();
    g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
    g.drawImage(pc.c, -pc.w / 2 - pc.pad, -pc.h / 2 - pc.pad);
    if (checked) { g.translate(pc.w / 2 - 50, pc.h / 2 - 36); tick(g, 1, checked); }
    g.restore();
  }
  const INTO = [MX + 52, MY + 94];                                  // where a print sits while the mascot takes it in
  /** A burst of short strokes round (x, y), for a hit. */
  function marks(g, x, y, rx, ry, n, w, k, seed) {
    g.save(); g.translate(x, y); g.strokeStyle = PAL.ink; g.lineCap = 'butt'; g.lineWidth = w;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + hash(seed + i) * 0.3, r0 = 1 + k * 0.16, r1 = r0 + 0.1 + hash(i * 2.3 + seed) * 0.14 - k * 0.05;
      g.beginPath(); g.moveTo(Math.cos(a) * rx * r0, Math.sin(a) * ry * r0); g.lineTo(Math.cos(a) * rx * r1, Math.sin(a) * ry * r1); g.stroke();
    }
    g.restore();
  }
  // three prints get a strip of tape at the end, patted on by a hand: which, where on them, the tape's tilt
  const TAPES = [[2, 0.36, -0.5, 24], [12, -0.38, -0.5, -30], [16, 0.34, 0.5, 16]].filter(([i]) => i < N).map(([i, u, v, r], j) => ({ P: PIECES[i], u, v, r, step: ST.pat + j, seed: 80 + j }));
  const tapeAt = (t) => { const [ox, oy] = rot2(t.u * t.P.w, t.v * t.P.h, deg(t.P.rot)); return [t.P.x + ox, t.P.y + oy]; };

  function scene(g, F) {
    const { step } = F;
    // a knock through the table on every hit
    let sx = 0, sy = 0;
    if (step === ST.deck) { sx -= 3; sy += 7; }
    if (WORD.some((w) => w.step === step)) { sx -= 4; sy += 7; }
    if (step === ST.knock) { sx += 6; sy -= 7; }
    if (PIECES.some((P) => P.out + 2 === step)) { sx += (hash(step * 3.3) - 0.5) * 6; sy += 2 + hash(step * 1.7) * 3; }
    if (TAPES.some((t) => t.step === step)) sy += 3;
    g.fillStyle = PAL.kraft; g.fillRect(0, 0, W, H);
    g.save(); g.translate(sx, sy);
    g.drawImage(base, 0, 0);

    const hands = [], air = [];

    // the deck: the prints not yet taken, the next one on top. A hand slaps it down
    const next = PIECES.findIndex((P) => step < P.L - 1);
    if (next >= 0 && step >= ST.deck - 1) {
      const k = step - ST.deck, A = ARM.L;
      const pose = k < 0 ? { back: 430, turn: 6, s: 1.12, lift: 34 } : k === 0 ? { back: 0, turn: 0, s: 1, lift: 0 } : k === 1 ? { back: 120, turn: -3, s: 1.06, lift: 22 } : { back: 640, turn: -7, s: 1.12, lift: 34 };
      const [hx, hy, ha] = reach(A, DECK.x, DECK.y, pose.back, pose.turn), a0 = Math.atan2(DECK.y - A.y, DECK.x - A.x);
      const [dx, dy, da] = k < 0 ? [hx, hy, ha - a0] : [DECK.x, DECK.y, 0];
      for (let q = Math.min(N - 1, next + 4); q >= next; q--) {
        const P = PIECES[q], [jx, jy, jr] = q === next && k > 0 ? jit(31, step) : [0, 0, 0];
        print(g, P.big, dx + P.lie[0] + jx * 0.5, dy + P.lie[1] + jy * 0.5, deg(DECK.rot + P.lie[2]) + da + jr, k < 0 ? 1.1 : k === 0 ? 0.985 : 1, k < 0 ? pose.lift : 0);
      }
      if (k <= 2) hands.push([A, hx, hy, ha, pose, 1.25]);
      if (k === 0 || k === 1) marks(g, DECK.x, DECK.y, BIG.w / 2 + 44, BIG.h / 2 + 40, 16, k ? 4 : 8, k, 5);
    }
    // a print in the air between the deck and the mascot
    for (const P of PIECES) if (step === P.L - 1) air.push([P.big, lerp(DECK.x, INTO[0], 0.52), lerp(DECK.y, INTO[1], 0.52) - 150, deg(18 + P.lie[2] * 2), 0.9, 44, 0]);

    // the mascot on its disc
    {
      const open = lidAt(step), up = MASC.up, lo = MASC.lo, [jx, jy, jr] = jit(55, step), [kx, ky] = jit(56, step);
      const chomp = open === 0 && (PIECES.some((P) => P.L + 1 === step) || step === ST.shut);
      // the inside of its head, seen when the lid is up: dark red paper
      if (open > 0) {
        g.fillStyle = '#641711'; g.fillRect(MX + up.x + 4, MY + 6, up.pw - 8, up.ph + 6);
        g.fillStyle = 'rgba(20,6,4,0.45)'; g.fillRect(MX + up.x + 4, MY + 6, up.pw - 8, 26);
      }
      // a print going in: half of it in the wedge
      const eat = PIECES.find((P) => P.L === step);
      if (eat) print(g, eat.big, INTO[0], INTO[1], deg(-9), 0.7, 6);
      // prints on their way out: just showing over the top of the body
      for (const P of PIECES) if (step === P.out) print(g, P.pc, MOUTH[0] + (P.i % 2 ? 66 : -62), MOUTH[1] - 4, deg(P.i % 2 ? 17 : -15), 0.66, 4, P.tick);
      // the body
      g.save(); g.translate(MX + lo.x + lo.pw / 2 + kx * 0.5, MY + lo.y + lo.ph / 2 + ky * 0.5 + (chomp ? 6 : 0)); if (chomp) g.scale(1.03, 0.94);
      g.save(); g.globalAlpha = 0.45; g.translate(4, 8); g.drawImage(lo.sh, -lo.pw / 2 - lo.pad, -lo.ph / 2 - lo.pad); g.restore();
      g.drawImage(lo.c, -lo.pw / 2 - lo.pad, -lo.ph / 2 - lo.pad);
      g.restore();
      // the lid, on its hinge
      g.save(); g.globalAlpha = 0.45; g.translate(HINGE[0] + jx * 0.5 + 4 + open * 0.2, HINGE[1] + jy * 0.5 + 8 + open * 0.3); g.rotate(deg(open) + jr); g.drawImage(up.sh, -up.pw - up.pad, -up.ph - up.pad); g.restore();
      g.save(); g.translate(HINGE[0] + jx * 0.5, HINGE[1] + jy * 0.5 + (chomp ? 5 : 0)); g.rotate(deg(open) + jr); g.drawImage(up.c, -up.pw - up.pad, -up.ph - up.pad); g.restore();
      // the count: files taken in, then the fixes the result line gives; under it, in cut letters, what is counted
      // a file counts on the step its Update line prints, the step it goes into the head
      const taken = PIECES.filter((P) => P.L <= step).length, RS = result ? landing(result.at) : Infinity, fixed = !!NUM_FIX && step >= RS;
      if (fixed || taken) {
        const Nn = fixed ? NUM_FIX : NUM[taken - 1], fresh = fixed ? step === RS : PIECES[taken - 1].L === step, [nx, ny, nr] = jit(57, step), sc = fresh ? 0.6 : 0.52;
        g.save(); g.translate(REST[0] + nx * 0.5, REST[1] + ny * 0.5); g.rotate(Nn.rot + nr + (fresh ? deg(5) : 0)); g.scale(sc, sc); g.drawImage(Nn.c, -320, -240); g.restore();
        const n = fixed ? +fixes[1] : taken, noun = fixed ? fixes[2] : 'files';
        const one = n === 1 ? noun.replace(/(x|ch|sh|ss)es$/i, '$1').replace(/s$/i, '') : noun;   // 1 FILE, 1 FIX
        const word = ransom(one.toUpperCase(), 0.86), x0 = REST[0] - ((word.length - 1) * 34) / 2;
        word.forEach((l, i) => {
          if (!l) return;
          const [lx, ly, lr] = jit(l.seed, step);
          g.save(); g.translate(x0 + i * 34 + lx * 0.3, REST[1] + 160 + l.dy + ly * 0.3); g.rotate(l.rot + lr); g.drawImage(l.sp.c, -l.sp.bx, -l.sp.by); g.restore();
        });
      }
    }

    // the prints that have landed, in the order they came out, each with its tick
    for (const P of PIECES) {
      const e = step - P.out;
      if (e === 1) {                                                // in the air, on its arc
        const d = Math.hypot(P.x - MOUTH[0], P.y - MOUTH[1]);
        air.push([P.pc, (MOUTH[0] + P.x) / 2, Math.max(96, (MOUTH[1] + P.y) / 2 - 130 - 0.17 * d), deg(P.rot + P.spin), 1.14, 46, P.tick]);
      }
      if (e < 2) continue;
      const [jx, jy, jr] = jit(P.i + 1, step);
      print(g, P.pc, P.x + jx * 0.5, P.y + jy * 0.5, deg(P.rot) + jr, e === 2 ? 1.05 : 1, 0, P.tick);
      if (e === 2 || e === 3) marks(g, P.x, P.y, P.w / 2 + 26, P.h / 2 + 24, 10, e === 2 ? 5 : 3, e - 2, P.i);
    }
    // tape, patted on
    for (const t of TAPES) {
      const k = step - t.step;
      if (k < 0) continue;
      const [x, y] = tapeAt(t), [jx, jy] = jit(t.P.i + 1, step);
      g.save(); g.translate(x + jx * 0.5, y + jy * 0.5); g.rotate(deg(t.P.rot + t.r) + (k === 0 ? deg(7) : 0)); if (k === 0) g.scale(1.2, 1.2);
      tape(g, 112, 34, t.seed);
      g.restore();
      const A = ARM.T;
      if (k === 0) { const [hx, hy, ha] = reach(A, x, y + 16, 0, 0); hands.push([A, hx, hy, ha, { lift: 0 }, 0.9]); }
    }
    if (TAPES.length) {                                              // the patting hand comes, and goes
      const A = ARM.T, first = tapeAt(TAPES[0]), last = tapeAt(TAPES[TAPES.length - 1]);
      if (step === ST.pat - 1) { const [hx, hy, ha] = reach(A, first[0], first[1], 250, 5); hands.push([A, hx, hy, ha, { lift: 30 }, 0.96]); }
      if (step === ST.pat + TAPES.length) { const [hx, hy, ha] = reach(A, last[0], last[1], 520, -6); hands.push([A, hx, hy, ha, { lift: 34 }, 1]); }
    }

    // the three words, over everything on the board
    for (const [i, w] of WORD.entries()) {
      const k = step - w.step;
      if (k < 0) continue;
      const [jx, jy, jr] = jit(40 + i, step);
      const s = k === 0 ? 1.2 : k === 1 ? 0.975 : 1, a = w.rot + (k === 0 ? deg(3.5) : jr * 0.6);
      g.save(); g.translate(w.x + jx * 0.5, w.y + jy * 0.5); g.rotate(a); g.scale(s, s);
      g.save(); g.globalAlpha = 0.5; g.translate(k === 0 ? 16 : 4, k === 0 ? 22 : 7); g.drawImage(w.sh, -w.w / 2, -w.h / 2); g.restore();
      g.drawImage(w.c, -w.w / 2, -w.h / 2);
      g.restore();
    }

    // a ring in red grease pencil round the count
    { const k = step - ST.ring; if (k >= 0) { g.save(); g.translate(RING.x, RING.y); g.rotate(deg(-6)); ring(g, RING.rx, RING.ry, clamp((k + 1) / 5), 21); g.restore(); } }

    // the lid knocked open: a pop
    { const k = step - ST.knock; if (k === 0 || k === 1) marks(g, MX + MASC.w / 2, MY + 30, 250, 150, 18, k ? 5 : 9, k, 9); }

    // everything in the air
    for (const [pc, x, y, a, s, lift, checked] of air) print(g, pc, x, y, a, s, lift, checked);
    const bl = blockAway(step);
    if (bl) block(g, bl.x, bl.y, bl.rot, bl.s, bl.lift);
    for (const [A, hx, hy, ha, pose, s] of hands) drawArm(g, armFlat, hx, hy, ha, s * (pose.lift ? 1.05 : 1), pose.lift, A.flip);
    g.restore();
  }

  function tagDraw(g, F) {
    if (!TAG) return;
    const k = F.step - ST.tag;
    if (k < 0) return;
    const [jx, jy, jr] = jit(99, F.step);
    g.save(); g.translate(132 + jx * 0.4, 84 + jy * 0.4); g.rotate(k === 0 ? deg(-4) : jr * 0.4); if (k === 0) g.scale(1.12, 1.12);
    g.drawImage(TAG, 0, 0);
    g.restore();
  }

  return {
    dock,
    /** For the shot that follows: the prints lying on the paper at this instant (x, y: each one's centre; rot in radians). */
    handoff(env) {
      const { step } = frameOf(env);
      return {
        pieces: PIECES.filter((P) => step >= P.out + 2).map((P) => ({ x: P.x, y: P.y, w: P.w, h: P.h, rot: deg(P.rot), color: P.color, name: P.name })),
        paper: PAL.kraft,
      };
    },
    // every cue is given at the step the picture shows it (see the top of this file)
    sfx: [
      { b: 1 / SPS, s: 'collage_snip', a: 'peak', g: 0.8 },           // the scissors shut, twice
      { b: 3 / SPS, s: 'collage_snip', a: 'peak', g: 0.9 },
      { b: 2 / SPS, s: 'collage_rip', g: 0.7 },                      // the old picture comes apart
      { b: ST.deck / SPS, s: 'collage_slap', a: 'peak', g: 1 },      // the deck is slapped down
      ...PIECES.map((P) => ({ b: P.L / SPS, s: 'collage_slap', a: 'peak', g: P.L % SPS === 0 ? 0.6 : 0.44 })),   // each print taken in
      ...WORDS.map((w) => ({ b: w.at, s: 'collage_slam', a: 'peak', g: 0.9 })),
      { b: ST.knock / SPS, s: 'collage_pop', a: 'peak', g: 1 },      // the lid is knocked open
      { b: ST.spill / SPS, s: 'collage_spill', g: 0.8 },             // the prints spill out
      { b: ST.ring / SPS, s: 'collage_pencil', g: 0.6 },             // the grease pencil goes round the count
      { b: ST.pat / SPS, s: 'collage_tape', g: 0.6 },                // tape off the roll, then two more pats
      ...TAPES.slice(1).map((t) => ({ b: t.step / SPS, s: 'collage_slap', a: 'peak', g: 0.36 })),
    ],
    render(g, env) {
      const F = frameOf(env), handing = !!(env.other && env.role === 'in');
      scene(g, F);
      if (handing) handover(g, env, F);
      tagDraw(g, F);
      // grain and dust over everything, new on every step
      g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.8;
      const ox = Math.floor(hash(F.step * 1.7) * 512), oy = Math.floor(hash(F.step * 2.9) * 512);
      for (let y = -oy; y < H; y += 512) for (let x = -ox; x < W; x += 512) g.drawImage(grain, x, y);
      g.restore();
      dust(g, W, H, F.step);
      if (env.noDock) return;
      if (handing && env.otherImpl && env.otherImpl.dock) swapDock(g, { ...env, otherEnv: hudSheet(env).env || env.otherEnv }, dock, clamp((F.step + 1) / 6));
      else dock(g, env);
    },
  };
}
