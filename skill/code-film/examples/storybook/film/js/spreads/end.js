// Spread 8, the last one: a paper laptop showing the real game. The camera goes up to its screen (never past its
// paper frame), two real screens are shown crisp inside it, then we pull back and the book shuts. The end card
// itself (the address band and the robot's last word) lives on the cover: see cover.js.
//
// The real screens are two captures of https://builderwars.ai (public homepage, the site's own example data), taken
// at a 1280-pixel-wide layout: assets/screens/hi_top.png (the top 400 px at 3x) and hi_income.png (the example
// player's income card at 4x). Re-capture them if the homepage changes.

import * as THREE from 'three';
import { PAL, LAYER as L, rr, circ, poly, piece, stack } from '../paper.js';
import * as art from '../art.js';
import { rng, spring, ease, seg, lerp, clamp } from '../util.js';

const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(`missing ${src}`)); i.src = src; });
const TOP_IMG = await loadImage('/assets/screens/hi_top.png');
const CARD_IMG = await loadImage('/assets/screens/hi_income.png');

const CAM_FOV = 26;                    // the rig's lens (rig.js); the screen lock below depends on it
const SCW = 1440, SCH = 810;           // the two screens are painted at this size
const W0 = 1424, H0 = 801, OY = 66;    // the laptop screen on the 1920x1080 frame when the camera is locked: size, and how far above centre

// end-card framing on top of cover.js's `endKey`: camera elevation in degrees, distance factor, and a nudge of the target
const END_ELEV = 60, END_ZOOM = 0.975, END_TY = -0.085, END_TZ = 0.18;

const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// Screen A: the top of the homepage: the site's header (logo, sign-in button) and the headline. The goal sentence
// under the headline is cropped out (the film says the goal in its own words, and the two must not disagree), and
// the headline is moved down to the middle of the room that leaves.
const scrA = canvasOf(SCW, SCH);
{
  const c = scrA.getContext('2d'), k = SCW / 2000;                        // 2000 capture pixels across the screen
  c.imageSmoothingQuality = 'high';
  c.fillStyle = '#000'; c.fillRect(0, 0, SCW, SCH);
  c.drawImage(TOP_IMG, 178, 0, 2000, SCH / k, 0, 0, SCW, SCH);
  c.fillRect(0, 128, SCW, SCH - 128);                                     // everything under the header's rule
  c.drawImage(TOP_IMG, 178, 200 / k, 2000, 420 / k, 0, 200 + 50, SCW, 420);       // the headline alone, 50 px lower
  c.fillRect(1318, 0, SCW - 1318, 121);                                   // the nav link the crop cuts in half
  c.drawImage(TOP_IMG, 3244, 28, 366, 116, SCW - 45 - 356 * k, 28 * k, 366 * k, 116 * k);      // the sign-in button, brought into view
}
// Screen B: the example player's monthly income and its four streams, from "Watch your business grow".
const scrB = canvasOf(SCW, SCH);
{
  const c = scrB.getContext('2d'), w = Math.round((CARD_IMG.width * SCH) / CARD_IMG.height);
  c.imageSmoothingQuality = 'high';
  // the card is black inside a one-pixel grey border (4 px in this capture): draw it without the border on a black
  // screen, so its sides meet the screen without a seam
  c.fillStyle = '#000'; c.fillRect(0, 0, SCW, SCH);
  c.drawImage(CARD_IMG, 6, 6, CARD_IMG.width - 12, CARD_IMG.height - 12, (SCW - w) / 2, 0, w, SCH);
}
// fine grain laid over the glass, and the sheet of paper that wipes one screen to the next
const grain = canvasOf(256, 256);
{
  const c = grain.getContext('2d'), r = rng(31), img = c.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) { const v = 128 + (r() - 0.5) * 120; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  c.putImageData(img, 0, 0);
}
const sheet = canvasOf(900, SCH + 40);
{
  const c = sheet.getContext('2d'), r = rng(52), W = sheet.width, H = sheet.height;
  // hand-cut edges left and right
  c.beginPath();
  const n = 14, wob = () => (r() - 0.5) * 7;
  c.moveTo(6 + wob(), 0);
  for (let i = 1; i <= n; i++) c.lineTo(6 + wob(), (H * i) / n);
  for (let i = n; i >= 0; i--) c.lineTo(W - 6 + wob(), (H * i) / n);
  c.closePath();
  c.fillStyle = '#f6ecd8'; c.fill();
  c.save(); c.clip();
  for (let k = 0; k < 900; k++) {                                          // fibres
    const x = r() * W, y = r() * H, a = r() * Math.PI, len = 6 + r() * 26;
    c.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(120,96,60,0.10)'; c.lineWidth = 0.8 + r();
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); c.stroke();
  }
  const g1 = c.createLinearGradient(0, 0, W, 0);                           // the lighter core along both cut edges
  g1.addColorStop(0, 'rgba(255,252,244,0.9)'); g1.addColorStop(0.025, 'rgba(255,252,244,0)'); g1.addColorStop(0.975, 'rgba(255,252,244,0)'); g1.addColorStop(1, 'rgba(255,252,244,0.9)');
  c.fillStyle = g1; c.fillRect(0, 0, W, H);
  c.restore();
}

const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), O = new THREE.Vector3();

export function build(env) {
  const { book } = env;
  const S = env.shot, at = (line, word) => env.mark(line, word) - S.t0;

  // ---------------------------------------------------------------- the beats, all from the spoken words
  const tB = at('wars', 'Builder'), tL = at('wars', 'Launch'), tH = at('wars', 'Top');
  const tWend = env.lines.wars.end - S.t0, tE = at('end', 'The');
  const p1 = Math.max(1.3, Math.min(tL - 0.4, tB + 0.75));         // camera locked on the screen (after the page turn's camera blend)
  const p0 = Math.max(0.3, p1 - 1.05);                            // push starts
  const WIPE = 0.7;                                                  // 21 frames: a 9-frame wipe read as a flash
  const tWipe = Math.max(p1 + 1.35, tH - 0.42);                    // the sheet of paper crosses: screen A gives way to screen B
  const tPull = Math.max(tWend + 0.05, tWipe + WIPE + 1.3);        // back out to the paper
  const PULL = 0.5;
  const tClose = Math.max(tE + 0.05, tPull + PULL - 0.1);          // the book shuts on "The end."
  const CLOSE = 0.85;

  const realAlpha = (lt) => seg(lt, p1 - 0.02, p1 + 0.1) * (1 - seg(lt, tPull - 0.1, tPull + 0.02));
  const pushS = (lt) => 1 + 0.02 * seg(lt, p1, tPull);              // a slow creep toward the screen while it is held

  // ---------------------------------------------------------------- backdrop: one plum card, a lighter arch behind the laptop
  const back = env.fold({ z: -1.1, beta: 78 });
  const BW = 6.2, BH = 2.75;
  env.span(back, (g, side) => {
    g.put(rr(BW, BH, [0.3, 0.3, 0, 0], 0, BH / 2), '#5d4792', { z: 0 });
    g.put(rr(BW - 0.5, 0.05, 0.02, 0, BH - 0.2), PAL.gold, { z: L * 0.6 });
    if (side === 'R') g.put(rr(2.5, 2.3, [1.25, 1.25, 0, 0], 1.72, 1.15), '#6d55a6', { z: L * 0.3, cast: false });
    else g.put(rr(2.3, 1.75, [1.15, 1.15, 0, 0], -1.55, 0.875), '#6d55a6', { z: L * 0.3, cast: false });
  });

  // ---------------------------------------------------------------- middle fold: Sam and the robot on the left wing
  const mid = env.fold({ z: -0.25, beta: 86 });
  let point, bot;
  {
    const clip = mid.clipL, g = stack({ clip });
    mid.L.add(g);
    g.put(rr(3.0, 0.12, [0.04, 0.04, 0, 0], -1.58, 0.06), '#e9dcbd', { z: 0 });                  // a low riser to stand on
    const sx = -2.3, ss = 1.08, leg = 0.5;
    for (const x of [-0.17, 0.17]) {
      g.put(rr(0.21, leg + 0.1, 0.04, sx + x * ss, 0.1 + leg / 2), PAL.navy, { z: L * 0.6 });
      g.put(rr(0.3, 0.11, [0.05, 0.05, 0.02, 0.02], sx + x * ss + 0.02, 0.155), PAL.charcoal, { z: L * 1.0 });
    }
    const sam = art.person({ clip, x: sx, y: 0.1 + leg, z: L * 1.4, s: ss, shirt: PAL.red, hair: PAL.umber, skin: PAL.tan });
    // one arm hangs, the other points at the laptop (hinged at the shoulder)
    const rest = stack({ clip, x: -0.39, y: 0.6, z: -L * 0.5 });
    rest.put(rr(0.17, 0.56, 0.085, 0, -0.24), PAL.red, { z: 0 });
    rest.put(circ(0.09, 0, -0.52), PAL.tan, { z: L * 0.3 });
    rest.rotation.z = -0.16;
    point = stack({ clip, x: 0.39, y: 0.6, z: -L * 0.5 });
    point.put(rr(0.17, 0.6, 0.085, 0, -0.26), PAL.red, { z: 0 });
    point.put(circ(0.1, 0, -0.58), PAL.tan, { z: L * 0.3 });
    sam.add(rest, point);
    g.add(sam);
    // the coin robot stands by the fold, mirrored so its coin arm points away from the crease
    bot = art.coinBot({ clip, x: -0.64, y: 0.1, z: L * 1.4, s: 0.8 });
    bot.scale.x = -0.8;
    g.add(bot);
  }

  // ---------------------------------------------------------------- the laptop: rides the right wing, but stays a true rectangle
  const lap = new THREE.Group();
  lap.matrixAutoUpdate = false;
  book.group.add(lap);
  const SW = 2.8, SH = (SW * 9) / 16, XC = 1.62, YC = 0.385 + SH / 2;
  const texOf = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
  const texA = texOf(scrA), texB = texOf(scrB);
  const screenMat = new THREE.MeshBasicMaterial({ map: texA });            // a screen glows: no lighting
  {
    const g = stack({});
    lap.add(g);
    g.put(poly([[XC - 1.56, 0.03], [XC + 1.56, 0.03], [XC + 1.44, 0.24], [XC - 1.44, 0.24]], 0.03), PAL.lightgrey, { z: L * 0.6 });   // the deck
    g.put(rr(0.5, 0.04, 0.02, XC, 0.215), PAL.grey, { z: L * 0.9 });
    g.put(rr(SW + 0.2, 0.09, 0.03, XC, 0.27), PAL.grey, { z: L * 0.3 });                                                             // hinge
    g.put(rr(SW + 0.17, SH + 0.17, 0.09, XC, YC), '#343a4d', { z: L * 0.5 });                                                        // lid and bezel
    g.put(circ(0.014, XC, YC + SH / 2 + 0.043), PAL.grey, { z: L * 0.8 });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), screenMat);
    screen.position.set(XC, YC, L * 0.5 + 0.004);
    g.add(screen);
  }
  const SZ = L * 0.5 + 0.004;
  const screenC = new THREE.Vector3(), screenN = new THREE.Vector3(0, 0, 1), screenUp = new THREE.Vector3(0, 1, 0);

  // ---------------------------------------------------------------- flat on the pages: a pool of light under the scene
  for (const sgn of [1, -1]) {
    const page = sgn > 0 ? env.pages.right : env.pages.left;
    page.add(piece(poly([[0.035 * sgn, -1.05], [1.7 * sgn, -1.05], [2.5 * sgn, -0.55], [2.5 * sgn, 0.25], [1.7 * sgn, 0.6], [0.035 * sgn, 0.6]], [0, 0.5, 0.4, 0.4, 0.5, 0]), '#fbe7a6', { z: 0.004, cast: false }));
  }

  // ---------------------------------------------------------------- camera
  const WIDE0 = { pos: [0.55, 5.45, 9.0], target: [0.45, 1.0, -0.2], focus: [1.6, 1.0, -0.1], aperture: 0.09 };     // the page opens: laptop, Sam, robot
  const WIDE1 = { pos: [0.3, 6.3, 10.2], target: [0.2, 0.9, -0.25], focus: [1.0, 1.0, -0.1], aperture: 0.075 };     // after the screens, on the way to the cover
  // the end card: cover.js's `endKey`, seen from a little higher so the address reads larger (the letters lie flat on the
  // cover) and the standing robot takes less room above the book. Same distance, target nudged toward the reader.
  const CE = env.keys?.coverEnd ?? { pos: [1.7, 5.72, 5.1], target: [1.7, 0.42, -0.22], focus: [1.7, 0.2, 0.2], aperture: 0.03 };
  const ceD = Math.hypot(CE.pos[0] - CE.target[0], CE.pos[1] - CE.target[1], CE.pos[2] - CE.target[2]) * END_ZOOM;
  const endT = [CE.target[0], CE.target[1] + END_TY, CE.target[2] + END_TZ], el = (END_ELEV * Math.PI) / 180;
  const END = { pos: [endT[0], endT[1] + Math.sin(el) * ceD, endT[2] + Math.cos(el) * ceD], target: endT, focus: [endT[0], 0.2, 0.3], aperture: CE.aperture };
  const dist0 = ((SH / 2) / Math.tan((CAM_FOV * Math.PI) / 360)) * (1080 / H0);     // the screen is H0 pixels tall from here
  const OFF = OY / (H0 / SH);                                                     // camera lowered by this much, so the screen sits above the caption
  const mix3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];

  const sfx = [
    { t: tWipe + WIPE + 0.18, s: 'stamp', g: 0.6, a: 'peak' },                    // the PRETEND tag
    { t: 0.5, s: 'paper_pop', g: 0.7, a: 'peak' },
    { t: (p0 + p1) / 2, s: 'whoosh_in', g: 0.6, a: 'peak', len: 1.0 },           // peaks at the fastest moment of the push
    { t: tWipe + WIPE / 2, s: 'paper_slide', g: 0.45, a: 'peak' },
    { t: tPull + PULL / 2, s: 'whoosh_out', g: 0.55, a: 'peak', len: 1.0 },
    { t: tClose + CLOSE - 0.19, s: 'book_close', g: 0.9, a: 'peak' },            // the cover lands
    { t: tClose + 0.74, s: 'paper_slide', g: 0.6, a: 'peak' },                   // the address band comes across
    { t: tClose + 1.14, s: 'ta_da', g: 0.7, a: 'peak' },                         // and lands
    { t: tClose + 1.78, s: 'bubble_pop', g: 0.6, a: 'peak' },                    // the robot's last word
  ];

  return {
    close: { at: tClose, dur: CLOSE },
    sfx,
    key(lt) {
      const sm = (x) => x * x * (3 - 2 * x);                 // gentler than a cubic ease: the push is spread over its whole second
      const lock = sm(seg(lt, p0, p1)) * (1 - ease.inOutCubic(seg(lt, tPull, tPull + PULL)));
      const wide = lt < tPull ? WIDE0 : WIDE1;
      // square on the screen, a little below its centre
      const d = dist0 / pushS(lt);
      const st = [screenC.x - screenUp.x * OFF, screenC.y - screenUp.y * OFF, screenC.z - screenUp.z * OFF];
      const sp = [st[0] + screenN.x * d, st[1] + screenN.y * d, st[2] + screenN.z * d];
      let pos = mix3(wide.pos, sp, lock), target = mix3(wide.target, st, lock);
      let focus = mix3(wide.focus, st, lock), aperture = lerp(wide.aperture, 0, lock);
      // the book shuts: ease over to the end card
      const v = ease.inOutCubic(seg(lt, tClose - 0.05, tClose + 1.0));
      pos = mix3(pos, END.pos, v); target = mix3(target, END.target, v); focus = mix3(focus, END.focus, v); aperture = lerp(aperture, END.aperture, v);
      // the world adds a slow push toward the target through every shot; undo it so the screen lock is exact
      const f = clamp(lt / S.dur) * 0.03;
      const comp = pos.map((c, i) => (c - f * target[i]) / (1 - f));
      return { pos: comp, target, focus, aperture };
    },
    animate(lt, open) {
      const q = Math.floor(lt * 15 + 1e-4) / 15;            // paper acts on twos
      // the laptop follows its wing as the page opens, squared up so its screen is a true rectangle
      const m = mid.R.matrix;
      X.setFromMatrixColumn(m, 0); Y.setFromMatrixColumn(m, 1).normalize(); O.setFromMatrixPosition(m);
      X.addScaledVector(Y, -X.dot(Y)).normalize(); Z.crossVectors(X, Y);
      lap.matrix.makeBasis(X, Y.multiplyScalar(Math.max(0.002, mid.rise ?? 1)), Z).setPosition(O);
      lap.matrixWorldNeedsUpdate = true;
      lap.visible = open > 0.14;                            // like every pop-up: hidden while the book is nearly shut
      screenC.set(XC, YC, SZ).applyMatrix4(lap.matrix);
      screenN.copy(Z); screenUp.copy(Y);
      screenMat.map = q >= tWipe + WIPE / 2 ? texB : texA;  // the paper screen shows whichever real screen is up

      // Sam points at the laptop on "Builder Wars"; the robot nods along
      const up = clamp(spring(q - (tB - 0.1), 2.6, 0.5), 0, 1.2);
      point.rotation.z = lerp(0.16, 1.08, up);
      bot.userData.head.rotation.z = q > tB ? 0.07 * Math.sin((q - tB) * 5.2) : 0;
    },
    overlay(g, lt) {
      const a = realAlpha(lt);
      if (a <= 0) return false;
      const s = pushS(lt), w = W0 * s, h = H0 * s, x0 = 960 - w / 2, y0 = 540 - OY * s - h / 2;
      g.save();
      g.globalAlpha = a;
      g.beginPath(); g.roundRect(x0, y0, w, h, 8 * s); g.clip();
      const u = seg(Math.floor(lt * 15 + 1e-4) / 15, tWipe, tWipe + WIPE);      // the sheet moves on twos, like all the paper
      if (u <= 0) g.drawImage(scrA, x0, y0, w, h);
      else if (u >= 1) g.drawImage(scrB, x0, y0, w, h);
      else {
        const sw = w * 0.62, lead = x0 + w - ease.inOutCubic(u) * (w + sw), trail = lead + sw;
        g.drawImage(scrA, x0, y0, w, h);
        g.save(); g.beginPath(); g.rect(trail - 2, y0, x0 + w - trail + 2, h); g.clip(); g.drawImage(scrB, x0, y0, w, h); g.restore();
        // the sheet's shadow on the glass, either side of it
        for (const [xa, xb] of [[lead, lead - 34 * s], [trail, trail + 34 * s]]) {
          const gr = g.createLinearGradient(xa, 0, xb, 0);
          gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr; g.fillRect(Math.min(xa, xb), y0, Math.abs(xb - xa), h);
        }
        g.drawImage(sheet, lead, y0 - 20 * s, sw, h + 40 * s);
      }
      // the number on the second screen is in-game money: a red paper tag stuck on the glass says so
      const tg = Math.floor(lt * 15 + 1e-4) / 15 - (tWipe + WIPE + 0.18);
      if (tg > 0) {
        const k = tg < 2 / 15 ? 1.12 : 1, tw = 420 * s, th = 96 * s;
        g.save();
        g.translate(x0 + w - 300 * s, y0 + 118 * s); g.rotate(-0.09); g.scale(k, k);
        g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 14 * s; g.shadowOffsetY = 6 * s;
        g.fillStyle = '#b93a22'; g.beginPath(); g.roundRect(-tw / 2, -th / 2, tw, th, 10 * s); g.fill();
        g.shadowColor = 'transparent';
        g.fillStyle = '#e04e2e'; g.beginPath(); g.roundRect(-tw / 2 + 7 * s, -th / 2 + 7 * s, tw - 14 * s, th - 14 * s, 6 * s); g.fill();
        g.fillStyle = '#f6ecd8'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.font = `${66 * s}px "Anton"`;
        g.fillText('100% PRETEND', 0, 24 * s);
        g.restore();
      }
      // so the glass sits in the scene: a faint grain and a soft reflection from the key light's side
      g.globalCompositeOperation = 'soft-light'; g.globalAlpha = a * 0.2;
      g.fillStyle = g.createPattern(grain, 'repeat'); g.fillRect(x0, y0, w, h);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = a;
      const rf = g.createRadialGradient(x0 + w * 0.06, y0 - h * 0.1, 0, x0 + w * 0.06, y0 - h * 0.1, w * 0.62);
      rf.addColorStop(0, 'rgba(255,255,255,0.13)'); rf.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rf; g.fillRect(x0, y0, w, h);
      g.restore();
      return true;
    },
    look(lt) { return { vignette: lerp(0.5, 0.36, realAlpha(lt)) }; },
  };
}

