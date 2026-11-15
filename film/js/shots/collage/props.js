// The Collage shot's cut-out actors, drawn in code in the manner of old engravings (black line and hatching on cream
// paper, cut out with a white edge): an arm with a hand that slaps things down, a pair of tailor's scissors, and the
// red grease-pencil marks. No photographs.

import { rng, TAU, deg } from '../../util.js';
import { PAL } from './paper.js';

const SKIN = '#EBE2CC', LINE = PAL.ink;

/** Add a capsule (a finger) to path P: from (x, y) along angle a, length L, width w. */
function capsule(P, x, y, a, L, w) {
  const c = Math.cos(a), s = Math.sin(a), r = w / 2, ex = x + c * L, ey = y + s * L;
  P.moveTo(x - s * r, y + c * r);
  P.lineTo(ex - s * r - c * r, ey + c * r - s * r);
  P.arc(ex - c * r, ey - s * r, r, a + Math.PI / 2, a - Math.PI / 2, true);
  P.lineTo(x + s * r, y - c * r);
  P.closePath();
}

/**
 * An arm cut out of an engraving: sleeve, cuff, the back of a hand. Local frame: the wrist is at (0, 0), fingers point
 * along +x, the thumb is on the -y side. pose 'flat' (an open hand, to slap with) or 'point'.
 * Returns { c, sh, ox, oy, hit }: sprite, shadow, where the wrist is in them, and the middle of the palm (local).
 */
export function makeArm(makeCanvas, pose = 'flat', seed = 3) {
  const W = 1400, H = 560, ox = 1030, oy = 290, R = rng(seed);
  const c = makeCanvas(W, H), g = c.getContext('2d');
  const point = pose === 'point';
  // fingers: [base x, base y, angle, length, width]
  const F = point
    ? [[138, -52, deg(-3), 176, 37], [146, -16, deg(4), 74, 40], [142, 22, deg(8), 68, 38], [132, 56, deg(13), 58, 33]]
    : [[138, -54, deg(-5), 152, 36], [146, -17, deg(-1), 170, 38], [144, 21, deg(3), 154, 36], [135, 56, deg(8), 118, 31]];
  const TH = point ? [[44, -62, deg(-24), 78, 42], [112, -94, deg(4), 62, 36]] : [[38, -60, deg(-58), 74, 44], [76, -122, deg(-34), 66, 37]];
  const palm = new Path2D('M -12 -58 C 30 -74 96 -84 150 -76 L 162 -30 L 160 30 L 150 74 C 100 84 34 78 -12 58 Z');
  const cuff = new Path2D('M -78 -80 L -6 -68 L -6 68 L -78 80 Z');
  const sleeve = new Path2D('M -1010 -150 C -700 -128 -300 -104 -72 -90 L -72 90 C -300 104 -700 128 -1010 150 Z');
  const sil = new Path2D();
  sil.addPath(sleeve); sil.addPath(cuff); sil.addPath(palm);
  const fingers = F.map(([x, y, a, L, w]) => { const P = new Path2D(); capsule(P, x, y, a, L, w); sil.addPath(P); return P; });
  const thumb = TH.map(([x, y, a, L, w]) => { const P = new Path2D(); capsule(P, x - Math.cos(a) * 14, y - Math.sin(a) * 14, a, L + 14, w); sil.addPath(P); return P; });

  // shadow
  const sh = makeCanvas(W, H), s = sh.getContext('2d');
  s.filter = 'blur(12px)'; s.translate(ox, oy); s.fillStyle = '#000'; s.strokeStyle = '#000'; s.lineWidth = 16; s.lineJoin = 'round'; s.fill(sil); s.stroke(sil);

  g.translate(ox, oy);
  g.lineJoin = 'round'; g.lineCap = 'round';
  // the white the scissors left around it, not quite even
  g.strokeStyle = PAL.white; g.fillStyle = PAL.white;
  g.save(); g.translate(2, -1.5); g.lineWidth = 17; g.stroke(sil); g.restore();
  g.save(); g.translate(-1.5, 2.5); g.lineWidth = 21; g.stroke(sil); g.restore();
  g.fill(sil);

  const part = (P, fill) => { g.strokeStyle = LINE; g.lineWidth = 6.4; g.stroke(P); g.fillStyle = fill; g.fill(P); };

  // sleeve: black cloth, the light on it engraved as pale lines
  part(sleeve, '#211D1A');
  g.save(); g.clip(sleeve);
  g.strokeStyle = 'rgba(235,226,204,0.78)';
  for (let i = 0; i < 26; i++) {
    const y0 = -132 + i * 4.6, x0 = -1000 + R() * 60, x1 = -110 - R() * 320 - i * 12;
    g.lineWidth = 1.1 + R() * 0.9;
    g.beginPath(); g.moveTo(x0, y0 - 6); g.bezierCurveTo(-700, y0 * 0.93, -400, y0 * 0.8, x1, y0 * 0.72); g.stroke();
  }
  for (let i = 0; i < 5; i++) {                                      // folds at the wrist
    const x = -96 - i * 30 - R() * 10;
    g.lineWidth = 2 + R() * 1.4;
    g.beginPath(); g.moveTo(x, -84 + R() * 20); g.quadraticCurveTo(x - 26 - R() * 12, R() * 20 - 10, x + 4, 78 - R() * 30); g.stroke();
  }
  g.strokeStyle = 'rgba(235,226,204,0.5)'; g.lineWidth = 1;
  for (let i = 0; i < 40; i++) { const x = -980 + i * 22 + R() * 8; g.beginPath(); g.moveTo(x, 86 + R() * 30); g.lineTo(x + 14, 124 + R() * 20); g.stroke(); }
  g.restore();

  // cuff
  part(cuff, '#F7F3E8');
  g.strokeStyle = LINE; g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(-66, -77); g.lineTo(-66, 77); g.moveTo(-18, -69); g.lineTo(-18, 69); g.stroke();
  g.lineWidth = 1.1;
  for (let y = 26; y < 76; y += 5) { g.beginPath(); g.moveTo(-62, y + 2); g.lineTo(-22, y - 2); g.stroke(); }
  g.fillStyle = '#F7F3E8'; g.lineWidth = 2.4; g.beginPath(); g.arc(-42, -44, 9, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = LINE; g.beginPath(); g.arc(-45, -44, 1.7, 0, TAU); g.arc(-39, -44, 1.7, 0, TAU); g.fill();

  // thumb and fingers: outline, skin, then the engraver's lines
  const digit = (P, [x, y, a, L, w], nail, creases) => {
    part(P, SKIN);
    g.save(); g.clip(P); g.translate(x, y); g.rotate(a);
    g.strokeStyle = LINE;
    for (let u = 6; u < L - 4; u += 5.2) {                            // shading along the far side, following the round of it
      const d = w * (0.3 + 0.16 * Math.sin(u * 0.11 + w) + R() * 0.07) * (u > L - w * 0.7 ? 0.5 : 1);
      g.lineWidth = 0.9 + R() * 0.7;
      g.beginPath(); g.moveTo(u, w / 2 + 1); g.quadraticCurveTo(u + 3.5, w / 2 - d * 0.5, u + 1.5, w / 2 - d); g.stroke();
    }
    g.lineWidth = 1;
    for (let u = 10; u < L - 8; u += 9) { g.beginPath(); g.moveTo(u, -w / 2); g.lineTo(u + 1.5, -w / 2 + 3.5 + R() * 3); g.stroke(); }
    g.lineWidth = 1.6;
    for (const k of creases) for (const o of [-2.6, 2.6]) { g.beginPath(); g.moveTo(L * k + o, -w * 0.3); g.quadraticCurveTo(L * k + o + 3.2, 0, L * k + o, w * 0.3); g.stroke(); }
    if (nail) {
      g.lineWidth = 1.8; g.fillStyle = '#F4EEDF';
      const n0 = L - w * 0.86, nw = w * 0.56;
      g.beginPath(); g.moveTo(n0, -nw / 2); g.lineTo(L - w * 0.36, -nw / 2); g.quadraticCurveTo(L - 3, 0, L - w * 0.36, nw / 2); g.lineTo(n0, nw / 2); g.quadraticCurveTo(n0 - 4, 0, n0, -nw / 2);
      g.fill(); g.stroke();
    }
    g.restore();
  };
  part(thumb[0], SKIN);
  digit(thumb[1], [TH[1][0] - Math.cos(TH[1][2]) * 14, TH[1][1] - Math.sin(TH[1][2]) * 14, TH[1][2], TH[1][3] + 14, TH[1][4]], true, [0.3]);
  g.fillStyle = SKIN; g.fill(thumb[0]);
  g.save(); g.clip(thumb[0]); g.strokeStyle = LINE; g.lineWidth = 1.1;
  for (let i = 0; i < 12; i++) { const [x, y, a] = TH[0]; g.beginPath(); g.moveTo(x + Math.cos(a) * i * 6 + 14, y + Math.sin(a) * i * 6 + 14); g.lineTo(x + Math.cos(a) * i * 6 + 30, y + Math.sin(a) * i * 6 + 2); g.stroke(); }
  g.restore();
  for (let i = 3; i >= 0; i--) digit(fingers[i], F[i], true, point && i > 0 ? [0.34] : [0.36, 0.67]);

  // the back of the hand over their roots
  g.fillStyle = SKIN; g.fill(palm);
  g.strokeStyle = LINE; g.lineWidth = 3.2;
  g.stroke(new Path2D('M -12 -58 C 30 -74 96 -84 150 -76')); g.stroke(new Path2D('M 150 74 C 100 84 34 78 -12 58'));
  g.save(); g.clip(palm);
  g.lineWidth = 1.5;                                                 // knuckles
  for (const [x, y] of F) { g.beginPath(); g.arc(x + 4, y, 15, deg(-70), deg(70)); g.stroke(); g.beginPath(); g.arc(x - 6, y, 13, deg(-50), deg(50)); g.stroke(); }
  g.lineWidth = 1.2;                                                 // tendons
  for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(4, -22 + i * 14); g.quadraticCurveTo(70, F[i][1] * 0.72, 118, F[i][1] * 0.96); g.stroke(); }
  g.lineWidth = 1;                                                   // shade on the far side and at the wrist
  for (let i = 0; i < 34; i++) { const x = -10 + i * 5.2; g.beginPath(); g.moveTo(x, 86); g.quadraticCurveTo(x + 9, 62, x + 5 + R() * 3, 40 + 12 * Math.sin(i * 0.5) + R() * 6); g.stroke(); }
  for (let i = 0; i < 16; i++) { const y = -52 + i * 6.6; g.beginPath(); g.moveTo(-12, y); g.lineTo(6 + R() * 14, y + 2); g.stroke(); }
  for (let i = 0; i < 14; i++) { const x = 20 + i * 8; g.beginPath(); g.moveTo(x, -80); g.lineTo(x + 3, -70 + R() * 4); g.stroke(); }
  g.restore();
  return { c, sh, ox, oy, hit: point ? [300, -52] : [112, 0] };
}

/** Tailor's scissors out of an engraving. Local frame: the pivot is at (0, 0), the blades point along +x. open in degrees. */
export function makeScissors(makeCanvas, open = 36) {
  const W = 800, H = 480, ox = 330, oy = 240;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  const blade = (sgn) => {
    const P = new Path2D();
    P.moveTo(-34, -15 * sgn); P.lineTo(60, -22 * sgn); P.quadraticCurveTo(250, -20 * sgn, 404, 3 * sgn); P.lineTo(60, 13 * sgn); P.lineTo(-34, 14 * sgn); P.closePath();
    return P;
  };
  const handle = (sgn) => {
    const P = new Path2D();
    P.moveTo(-30, -14 * sgn); P.lineTo(-150, 4 * sgn); P.lineTo(-150, 30 * sgn); P.lineTo(-30, 14 * sgn); P.closePath();
    P.ellipse(-228, 44 * sgn, 92, 58, deg(-8) * sgn, 0, TAU);
    return P;
  };
  const hole = (sgn) => { const P = new Path2D(); P.ellipse(-230, 45 * sgn, 60, 33, deg(-8) * sgn, 0, TAU); return P; };
  const halves = [-1, 1].map((sgn) => ({ sgn, rot: deg(open / 2) * sgn, b: blade(sgn), h: handle(sgn), o: hole(sgn) }));

  const sh = makeCanvas(W, H), s = sh.getContext('2d');
  s.filter = 'blur(11px)'; s.translate(ox, oy); s.fillStyle = '#000';
  for (const v of halves) { s.save(); s.rotate(v.rot); s.fill(v.b); s.fill(v.h); s.restore(); }

  g.translate(ox, oy); g.lineJoin = 'round';
  // the white edge: all of it first, so no half shows through the other
  for (const v of halves) { g.save(); g.rotate(v.rot); g.strokeStyle = PAL.white; g.fillStyle = PAL.white; g.lineWidth = 18; g.stroke(v.b); g.stroke(v.h); g.fill(v.b); g.fill(v.h); g.restore(); }
  for (const v of halves) {
    const R = rng(40 + v.sgn);
    g.save(); g.rotate(v.rot);
    // handle: black japanned steel
    g.strokeStyle = LINE; g.lineWidth = 5; g.stroke(v.h); g.fillStyle = '#211D1A'; g.fill(v.h);
    g.save(); g.clip(v.h); g.strokeStyle = 'rgba(235,226,204,0.75)'; g.lineWidth = 1.4;
    for (let i = 0; i < 30; i++) { const a = deg(200 + i * 4.4); g.beginPath(); g.arc(-228, 44 * v.sgn, 84 - (i % 3) * 5, a, a + deg(2.6 + R() * 2)); g.stroke(); }
    for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(-140 + i * 9, -6 * v.sgn); g.lineTo(-134 + i * 9, 6 * v.sgn); g.stroke(); }
    g.restore();
    g.fillStyle = PAL.white; g.fill(v.o); g.strokeStyle = LINE; g.lineWidth = 3; g.stroke(v.o);
    // blade: bright steel, ruled with the engraver's lines
    g.lineWidth = 5; g.stroke(v.b); g.fillStyle = '#EFE9DA'; g.fill(v.b);
    g.save(); g.clip(v.b); g.strokeStyle = LINE;
    for (let i = 0; i < 9; i++) { g.lineWidth = 0.9 + (i > 5 ? 0.9 : 0); g.beginPath(); g.moveTo(-30, (-12 + i * 1.5) * v.sgn - 8 * v.sgn); g.quadraticCurveTo(240, (-19 + i * 2.5) * v.sgn, 400, (2 + i * 0.4) * v.sgn); g.stroke(); }
    g.lineWidth = 2; g.beginPath(); g.moveTo(60, 6 * v.sgn); g.lineTo(396, 4 * v.sgn); g.stroke();
    g.restore();
    g.restore();
  }
  g.fillStyle = '#EFE9DA'; g.strokeStyle = LINE; g.lineWidth = 3.5; g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.fill(); g.stroke();
  g.lineWidth = 2.5; g.beginPath(); g.moveTo(-8, -5); g.lineTo(8, 5); g.stroke();
  // the finger holes are cut out too, leaving a rim of white
  for (const v of halves) for (const [k, r] of [[g, 0], [s, 4]]) {
    k.save(); k.rotate(v.rot); k.globalCompositeOperation = 'destination-out'; k.fillStyle = '#000'; k.filter = 'none';
    k.beginPath(); k.ellipse(-230, 45 * v.sgn, 50 - r, 23 - r, deg(-8) * v.sgn, 0, TAU); k.fill(); k.restore();
  }
  return { c, sh, ox, oy };
}

/** A tick in red grease pencil, about 60 px, around (0, 0). k from 0 to 1 draws it on. */
export function tick(g, k = 1, seed = 1) {
  if (k <= 0) return;
  const R = rng(seed), pts = [[-26, -4], [-8, 18], [30, -30]];
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  for (let pass = 0; pass < 3; pass++) {
    g.strokeStyle = pass === 2 ? 'rgba(255,120,100,0.35)' : `rgba(206,40,32,${0.62 + pass * 0.2})`;
    g.lineWidth = [11, 7.5, 2.5][pass];
    const j = () => (R() - 0.5) * 3;
    g.beginPath(); g.moveTo(pts[0][0] + j(), pts[0][1] + j()); g.lineTo(pts[1][0] + j(), pts[1][1] + j());
    if (k > 0.5) g.lineTo(pts[2][0] + j(), pts[2][1] + j());
    g.stroke();
  }
  g.restore();
}

/** A loop of red grease pencil round an ellipse (rx, ry) at (0, 0): k from 0 to 1 draws it on, once and a bit round. */
export function ring(g, rx, ry, k = 1, seed = 2) {
  if (k <= 0) return;
  const R = rng(seed), n = 72, turns = 1.12, ph = deg(-150);
  const wob = Array.from({ length: n + 1 }, () => (R() - 0.5) * 7);
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  for (let pass = 0; pass < 3; pass++) {
    g.strokeStyle = pass === 2 ? 'rgba(255,120,100,0.3)' : `rgba(206,40,32,${0.6 + pass * 0.22})`;
    g.lineWidth = [12, 8, 2.5][pass];
    g.beginPath();
    const m = Math.floor(n * k);
    for (let i = 0; i <= m; i++) {
      const u = i / n, a = ph + u * turns * TAU, grow = 1 + 0.05 * u;
      const x = Math.cos(a) * (rx * grow + wob[i]) + pass * 1.5, y = Math.sin(a) * (ry * grow + wob[(i * 7) % n]) - pass;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.stroke();
  }
  g.restore();
}
