// 11/15 Cyberpunk HUD / FUI: "find what's wrong." The tape pauses on Synthwave's last frame, then rewinds (◀◀ on the
// deck's display, tracking bands running up the picture, the picture rolling over) to the frame the jury really
// reviewed: the same moment of the first cut (assets/hud/synth_v1.png), shown in its true colour for half a second under
// a big FIRST CUT and its file name, so the viewer sees it is not the picture they just watched (no palms, a tighter
// title). Then a scan beam crosses it and in its wake it becomes a hologram: dimmed to a third and drawn
// as thin cyan edge lines on a plane that turns slowly in space.
// The display draws itself on behind the beam: corners, tag, scan header, a radar whose dial is this film (one arc a
// shot), rulers. The cursor leaves the prompt row as a reticle, and on beats 2.5, 3.25 and 4 lock
// brackets snap onto what the jury found in that frame; each opens a window of the frame's true colour. The radar's
// hand sweeps the film once and flags every file the next shot goes on to update. On beat 5 the result comes back and
// everything flips to alert orange with the score.
//
// Every number and name is real: the score and the fix count are read from this shot's result line in the cue sheet,
// the file being scanned from this shot's own `file` in the cue sheet, the flagged files from Collage's, the frame
// number from the clock. Every read-out names the first cut's paused frame: nothing on screen counts the film playing.

import { DOCK, swapDock } from '../term.js';
import { THREE, drawQuad, FULLSCREEN_VERT } from '../gl.js';
import { clamp, lerp, seg, smooth, ease, decay, hash, TAU } from '../util.js';

// ---- what the jury found in the paused frame -------------------------------------------------------------------------
// Real findings of jury round 1 on this frame of version 1 (film/out/review/round1.md) that still differ from the
// finished film: the word space between OF and THEM collapses, the script's "d" touches the base of THEM, there are no
// palm trees. (The jury also found no floor reflection; the finished film has none either, so it is not flagged here.)
// `box` is in the version 1 still's pixels, `at` the local beat the brackets lock, `label` plain words (a line break
// stacks it), `plate` where the label sits on screen (top left), `tab` where the bracket's number goes (default above
// it). `ghost` is optional: dashed guide lines (the still's pixels) for something that is missing.
// These stay in this order and place: Collage cuts the picture along them.
export const FLAWS = [
  { at: 3.25, label: 'SCRIPT\nTOUCHES\nTITLE', box: { x: 1372, y: 438, w: 204, h: 164 }, plate: { x: 1622, y: 516 } },
  { at: 4, label: 'NO PALM\nTREES', box: { x: 232, y: 508, w: 244, h: 208 }, plate: { x: 496, y: 538 } },
  { at: 2.5, label: 'NO WORD\nSPACE', box: { x: 996, y: 312, w: 120, h: 198 }, plate: { x: 772, y: 512 }, tab: 'right' },
];

const CY = [0, 229, 255], CY_HOT = [196, 250, 255], OR = [255, 106, 0], OR_HOT = [255, 218, 176];
const MONO = '"Share Tech Mono"', WIDE = '"Michroma"', OSD = '"VT323"';
const T_REW0 = 0.5;                        // PAUSE gives way to ◀◀: the tape goes back
const T_SWAP = 0.78;                       // the picture rolls over from the live frame to the first cut's
const T_V1 = 1.0;                          // the tape stops on the first cut: true colour, FIRST CUT and its file name
const T_BEAM0 = 1.9, T_BEAM1 = 2.45;       // the scan beam crosses the frame: 16 pictures
const T_HOME0 = 4.3, T_HOME1 = 4.78;       // it comes back
const T_SWEEP = 2.0, SWEEP_BEATS = 3;      // the radar's hand goes round the film once by the verdict
const STAGGER = 0.083;                     // 40 ms between pieces of the display drawing on
const SETTLE = 0.14;                       // a read-out is settled four pictures after it appears
const TURN = (5 * Math.PI) / 180, FOCAL = 2200;

const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const outExpo = ease.outExpo;

// The hologram: the reviewed frame on a plane that turns about its upright axis. Dim teal body, cyan edge lines, scan
// lines, a brighter wake just behind the scan beam, and inside each lock a window of the frame's true colour.
const HOLO_FRAG = /* glsl */`
uniform sampler2D tSrc, tEdge;
uniform vec2 uRes;
uniform vec3 uPose;            // sine and cosine of the turn, scale
uniform float uF, uFrame, uGain, uSplit, uBeam, uBand;
uniform vec4 uBox[4];          // each lock's box in the still's pixels: x0, y0, x1, y1
uniform vec2 uWin[4];          // how far its window is open (0 to 1), its flash
varying vec2 vUv;
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
void main() {
  vec2 fc = gl_FragCoord.xy;
  float top = uRes.y - fc.y;                                  // screen row, from the head of the frame
  float Xs = fc.x - 0.5 * uRes.x, Ys = top - 0.5 * uRes.y;
  float xs = Xs * uF / (uF * uPose.y - Xs * uPose.x);
  float Z = uF + xs * uPose.x;
  vec2 p = vec2(xs, Ys * Z / uF) / uPose.z + 0.5 * uRes;       // where this pixel falls on the still
  vec3 bg = vec3(0.006, 0.058, 0.072);
  vec3 col = bg;
  float line = 0.5 + 0.5 * cos(6.2831853 * fc.y / 4.0);        // two dark rows in every four
  if (p.x >= 0.0 && p.x <= uRes.x && p.y >= 0.0 && p.y <= uRes.y) {
    // now and then a band of rows slips sideways, as a projection does
    float slip = step(0.997, hash11(floor(p.y / 18.0) * 3.1 + floor(uFrame / 3.0) * 7.7)) * (hash11(floor(uFrame / 3.0) * 1.3 + floor(p.y / 18.0)) - 0.5) * 22.0;
    vec2 uv = vec2((p.x + slip) / uRes.x, 1.0 - p.y / uRes.y);
    vec3 src = texture2D(tSrc, uv).rgb;
    float luma = dot(src, vec3(0.299, 0.587, 0.114));
    float d = uSplit / uRes.x;
    float e = texture2D(tEdge, uv).r, eR = texture2D(tEdge, uv + vec2(d, 0.0)).r, eB = texture2D(tEdge, uv - vec2(d, 0.0)).r;
    float split = step(0.5, uSplit);
    vec3 lines = vec3(eR * split * 0.95, e * 0.898, mix(e, eB, split));
    float near = 0.72 + 0.28 * smoothstep(0.955, 1.045, uF / Z);                 // the nearer side burns brighter
    float wake = top < uBeam ? exp(-(uBeam - top) / 120.0) : 0.0;                // fresh from the beam
    float band = smoothstep(0.035, 0.0, abs(fract(p.y / uRes.y + uBand) - 0.5));  // one soft band climbing the plane
    float flick = 0.95 + 0.05 * hash11(uFrame * 1.7);
    vec3 body = max(bg, vec3(0.16, 0.74, 0.86) * pow(luma, 1.1) * 0.30);
    col = body + lines * 0.90 * uGain * near * flick * (1.0 + 2.4 * wake + 0.5 * band) + vec3(0.0, 0.30, 0.36) * wake * 0.5;
    col *= 1.0 - 0.30 * line;
    // the plane's own edge, so it reads as a thing in space when it turns
    float edge = min(min(p.x, uRes.x - p.x), min(p.y, uRes.y - p.y));
    col += vec3(0.0, 0.898, 1.0) * 0.55 * smoothstep(3.5, 1.0, edge);
    for (int i = 0; i < 4; i++) {
      vec2 c = 0.5 * (uBox[i].xy + uBox[i].zw), h = 0.5 * (uBox[i].zw - uBox[i].xy) * uWin[i].x;
      if (uWin[i].x > 0.0 && abs(p.x - c.x) < h.x && abs(p.y - c.y) < h.y) col = src * 0.92 * (1.0 - 0.10 * line) + vec3(uWin[i].y);
    }
  }
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// The finishing pass over the whole frame: colour fringing, scan lines (on the hologram's own rows), glitches,
// vignette, grain; and below the scan beam, the tremble and noise bar of a paused tape.
const POST_FRAG = /* glsl */`
uniform sampler2D tSrc;
uniform vec2 uRes;
uniform float uFrame, uCA, uScan, uGlitch, uPause, uGrain, uVig, uAlert, uBand, uBeam;
varying vec2 vUv;
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  vec2 uv = vUv;
  float py = uv.y * uRes.y;
  float tape = uPause * step(uv.y, uBeam);                 // only what the beam has not reached is still tape
  float odd = mod(uFrame, 2.0) < 1.0 ? 1.0 : -1.0;
  uv.y += odd * 1.6 / uRes.y * tape;
  float barY = 0.13 + 0.035 * sin(uFrame * 0.7);
  float bar = smoothstep(0.05, 0.0, abs(uv.y - barY)) * tape;
  uv.x += (hash21(vec2(floor(py / 2.0), uFrame)) - 0.5) * 0.07 * bar + 0.004 * tape * sin(py * 0.02 + uFrame);
  // restrained glitches: a few rows slip sideways
  if (uGlitch > 0.001) {
    float band = floor(uv.y * 26.0 + hash11(uFrame) * 26.0);
    float on = step(1.0 - 0.24 * uGlitch, hash21(vec2(band, uFrame)));
    uv.x += on * (hash21(vec2(band, uFrame + 3.0)) - 0.5) * 0.045 * uGlitch;
  }
  vec2 d = uv - 0.5;
  vec2 off = d * (uCA + uGlitch * 0.005) + vec2(uGlitch * 0.002, 0.0);
  vec3 c = vec3(texture2D(tSrc, uv + off).r, texture2D(tSrc, uv).g, texture2D(tSrc, uv - off).b);
  c += bar * 0.4 * hash21(vec2(floor(uv.x * uRes.x * 0.5), py + uFrame));
  c *= 1.0 - uScan * (0.5 + 0.5 * cos(6.2831853 * (floor(py) + 0.5) / 4.0));
  float b = fract(uBand - vUv.y);
  c *= 1.0 + 0.10 * smoothstep(0.10, 0.0, b) * smoothstep(0.0, 0.004, b);
  float v = dot(d * vec2(0.92, 1.0), d * vec2(0.92, 1.0));
  c *= 1.0 - uVig * pow(v, 1.25) * 1.5;
  c += uAlert * vec3(1.0, 0.24, 0.0) * pow(v, 1.6) * 1.9;
  c += (hash21(uv * uRes + uFrame * 17.13) - 0.5) * uGrain;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export default async function make(ctx) {
  const { W, H, fps, shot, clock, font, image, makeCanvas, useGL, blitGL, music } = ctx;
  await Promise.all([
    font('Share Tech Mono', '/assets/hud/ShareTechMono-Regular.ttf'),
    font('Michroma', '/assets/hud/Michroma-Regular.ttf'),
    font('VT323', '/assets/fonts/VT323-Regular.ttf'),
  ]);
  await Promise.all([document.fonts.load(`40px ${MONO}`), document.fonts.load(`40px ${WIDE}`), document.fonts.load('96px "VT323"')]);
  let V1 = null;
  try { V1 = await image('/assets/hud/synth_v1.png'); } catch (e) { console.warn(`[hud] the version 1 frame is missing, scanning the live one: ${e.message || e}`); }

  // ---- real numbers and names -----------------------------------------------------------------------------------------
  const result = (shot.out || []).find((o) => o.kind === 'result') || { at: 5, text: '' };
  const rm = /([\d.]+)\s*\/\s*(\d+)\D+?(\d+)\s*(\w+)/.exec(result.text);
  const VERDICT = rm ? { score: rm[1], of: rm[2], n: rm[3], word: rm[4].toUpperCase() } : { score: '-.-', of: '10', n: '0', word: 'FIXES' };
  const T_ALERT = result.at;
  const fpb = fps * clock.spb;                                               // pictures in a beat
  const totalBars = clock.shots.reduce((a, s) => a + s.bars, 0);
  const stillT = shot.t0 - 0.5 / fps, stillFrame = Math.round(stillT * fps);
  const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  // the first cut's file, as the cue sheet names it for this shot (only if its frame is here to show)
  const after = clock.shots[shot.index + 1];
  const FILE = V1 && shot.file ? String(shot.file) : null;
  const REWIND = !!V1;                                                       // no first-cut frame: no rewind, scan the live one
  // the files the jury flags are the ones the next shot goes on to update: numbered shots, and the two that have no number
  const upd = ((after && after.out) || []).map((o) => /shots\/(?:(\d+)-)?([\w-]+)\.js/.exec(o.text)).filter(Boolean);
  const flagged = clock.shots.filter((s) => upd.some((m) => (m[1] ? +m[1] === s.num : m[2] === s.name)));
  const dialAt = (beats) => -Math.PI / 2 + (beats / clock.totalBeats) * TAU;
  // when the radar's hand is over a shot, to the nearest eighth of a beat (the grid the typing runs on)
  const passAt = (s) => Math.round((T_SWEEP + ((s.b0 + s.b1) / 2 / clock.totalBeats) * SWEEP_BEATS) * 8) / 8;
  const FLAGS = flagged.map((s) => ({ idx: s.index, a: dialAt((s.b0 + s.b1) / 2), at: passAt(s) }));
  const ORDER = FLAWS.map((f, i) => i).sort((a, b) => FLAWS[a].at - FLAWS[b].at);     // the locks in the order they land
  const rank = FLAWS.map((f, i) => ORDER.indexOf(i));

  // ---- the scan beam, and when the display draws on behind it ----------------------------------------------------------
  const BEAM_A = -12, BEAM_B = H + 12;
  const beamY = (lb) => lerp(BEAM_A, BEAM_B, ease.inOutCubic(seg(lb, T_BEAM0, T_BEAM1)));
  /** The local beat at which the beam reaches screen row y. */
  const beamAt = (y) => { const v = clamp((y - BEAM_A) / (BEAM_B - BEAM_A)), p = v < 0.5 ? Math.cbrt(v / 4) : 1 - Math.cbrt(2 * (1 - v)) / 2; return T_BEAM0 + p * (T_BEAM1 - T_BEAM0); };
  const T_CORNER = beamAt(54), T_TAG = beamAt(90) + STAGGER * 0.5, T_ZONE = beamAt(64) + STAGGER * 1.5, T_RADAR = beamAt(76) + STAGGER * 2.5;
  const T_DATA = beamAt(900) + STAGGER, T_FOOT = beamAt(1026);
  const T_LIFT = Math.round(beamAt(560) * 8) / 8;                                              // the beam is past the title: the cursor leaves the row

  // ---- the plane the hologram is on -----------------------------------------------------------------------------------
  /** Pushed in on slowly, with a small punch at each lock and a bigger one at the verdict; still once the next shot has it. */
  const push = (lb) => {
    let s = 1 + 0.0315 * clamp((lb - T_BEAM0) / (8 - T_BEAM0)) + 0.012 * decay((lb - T_ALERT) * clock.spb, 0.09);
    for (const f of FLAWS) s += 0.004 * decay((lb - f.at) * clock.spb, 0.07);
    return s;
  };
  /** A few degrees one way, then the other; at rest from beat 8, when the next shot cuts along the brackets. */
  const turn = (lb) => (lb <= T_BEAM1 ? 0 : -TURN * Math.sin((TAU * (Math.min(lb, 8) - T_BEAM1)) / ((8 - T_BEAM1) * 4 / 3)));
  const pose = (lb) => { const a = turn(lb); return { s: push(lb), sin: Math.sin(a), cos: Math.cos(a) }; };
  /** A point of the still, on screen. */
  const proj = (x, y, P) => { const xs = (x - W / 2) * P.s, Z = FOCAL + xs * P.sin; return [W / 2 + (FOCAL * xs * P.cos) / Z, H / 2 + (FOCAL * (y - H / 2) * P.s) / Z]; };
  const flawQuad = (f, P) => { const b = f.box; return [proj(b.x, b.y, P), proj(b.x + b.w, b.y, P), proj(b.x + b.w, b.y + b.h, P), proj(b.x, b.y + b.h, P)]; };
  const boundsOf = (q) => { const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]), x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; };
  const flawRect = (f, lb) => boundsOf(flawQuad(f, pose(lb)));

  // ---- pictures made once ---------------------------------------------------------------------------------------------
  /**
   * Take lettering off a sky or a floor. The box that holds it (padded, with soft edges) is filled either with the
   * mirror image from across the middle of the frame, or by running the picture just above it down into the picture
   * just below it, which needs nothing from the rest of the frame.
   */
  function patch(c, cg, x, y, w, h, mirror = false) {
    const pad = 20, m = pad + 20, tw = w + 2 * m, th = h + 2 * m;
    const t = makeCanvas(tw, th), tg = t.getContext('2d'), k = makeCanvas(tw, th), kg = k.getContext('2d');
    if (mirror) { tg.translate(tw, 0); tg.scale(-1, 1); tg.drawImage(c, W - (x - m) - tw, y - m, tw, th, 0, 0, tw, th); tg.setTransform(1, 0, 0, 1, 0, 0); }
    else {
      const sw = Math.ceil(tw / 16), strip = (sy) => { const q = makeCanvas(sw, 1), qg = q.getContext('2d'); qg.imageSmoothingQuality = 'high'; qg.drawImage(c, x - m, sy, tw, 12, 0, 0, sw, 1); return q; };
      tg.imageSmoothingQuality = 'high';
      tg.drawImage(strip(y - m), 0, 0, sw, 1, 0, 0, tw, th);
      kg.imageSmoothingQuality = 'high';
      kg.drawImage(strip(y + h + m - 12), 0, 0, sw, 1, 0, 0, tw, th);
      const fade = kg.createLinearGradient(0, m - pad, 0, th - m + pad);
      fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
      kg.globalCompositeOperation = 'destination-in'; kg.fillStyle = fade; kg.fillRect(0, 0, tw, th);
      tg.drawImage(k, 0, 0);
      kg.globalCompositeOperation = 'source-over'; kg.clearRect(0, 0, tw, th);
    }
    kg.filter = 'blur(6px)'; kg.fillStyle = '#000'; kg.fillRect(m - pad, m - pad, w + 2 * pad, h + 2 * pad); kg.filter = 'none';
    tg.globalCompositeOperation = 'destination-in'; tg.drawImage(k, 0, 0);
    cg.drawImage(t, x - m, y - m);
  }
  /** A picture without the tape deck's own lettering (its tag, its counter), and without the prompt row if it has one. */
  function cleaned(src, row) {
    const c = makeCanvas(), cg = c.getContext('2d');
    cg.drawImage(src, 0, 0, W, H);
    patch(c, cg, 160, 100, 400, 48);
    patch(c, cg, 1430, 92, 330, 58);
    if (row) patch(c, cg, 164, 896, 776, 96, true);                          // the floor is the same either side of the middle
    return c;
  }
  /** Thin edge lines of a picture (blur, gradient, keep the ridge of each edge, keep weak ridges that touch strong ones). */
  function edgesOf(src) {
    const b = makeCanvas(), bg = b.getContext('2d', { willReadFrequently: true });
    bg.filter = 'blur(2px)'; bg.drawImage(src, 0, 0, W, H); bg.filter = 'none';
    const px = bg.getImageData(0, 0, W, H).data, N = W * H;
    const L = new Float32Array(N), M = new Float32Array(N), D = new Uint8Array(N), E = new Uint8Array(N);
    for (let i = 0, j = 0; i < N; i++, j += 4) L[i] = 0.299 * px[j] + 0.587 * px[j + 1] + 0.114 * px[j + 2];
    let max = 0;
    for (let y = 1; y < H - 1; y++) for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
      const gx = L[i - W + 1] + 2 * L[i + 1] + L[i + W + 1] - L[i - W - 1] - 2 * L[i - 1] - L[i + W - 1];
      const gy = L[i + W - 1] + 2 * L[i + W] + L[i + W + 1] - L[i - W - 1] - 2 * L[i - W] - L[i - W + 1];
      const m = Math.hypot(gx, gy), ax = Math.abs(gx), ay = Math.abs(gy);
      M[i] = m; if (m > max) max = m;
      D[i] = ay < 0.4142 * ax ? 0 : ay > 2.4142 * ax ? 2 : gx * gy > 0 ? 1 : 3;
    }
    const lo = 0.06 * max, hi = 0.16 * max, stack = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
      const m = M[i];
      if (m < lo) continue;
      const o = D[i] === 0 ? 1 : D[i] === 2 ? W : D[i] === 1 ? W + 1 : W - 1;
      if (m >= M[i - o] && m >= M[i + o]) { if (m >= hi) { E[i] = 2; stack.push(i); } else E[i] = 1; }
    }
    // follow each line from its strong ridges through the weak ones that touch them; specks (stars, grain) are dropped
    const NB = [-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1], keep = new Uint8Array(N);
    for (const s0 of stack) {
      if (keep[s0]) continue;
      const comp = [s0]; keep[s0] = 1;
      for (let h = 0; h < comp.length; h++) { const i = comp[h]; for (const o of NB) { const j = i + o; if (E[j] && !keep[j]) { keep[j] = 1; comp.push(j); } } }
      if (comp.length < 44) for (const i of comp) keep[i] = 2;
    }
    const img = bg.createImageData(W, H), q = img.data;
    for (let i = 0, j = 0; i < N; i++, j += 4) { const v = keep[i] === 1 ? 255 : 0; q[j] = v; q[j + 1] = v; q[j + 2] = v; q[j + 3] = 255; }
    bg.putImageData(img, 0, 0);
    // one-pixel ridges become lines about a pixel and a half wide
    const out = makeCanvas(), og = out.getContext('2d');
    og.fillStyle = '#000'; og.fillRect(0, 0, W, H);
    og.globalCompositeOperation = 'lighter'; og.filter = 'blur(0.65px)';
    og.drawImage(b, 0, 0); og.drawImage(b, 0, 0);
    return out;
  }
  const texes = new Map();
  const texOf = (canvas) => {
    if (!texes.has(canvas)) { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; texes.set(canvas, t); }
    return texes.get(canvas);
  };
  // what is scanned: the version 1 frame; or, if that file is gone, the live frame itself (made when it first arrives)
  const scans = new Map();
  const scanOf = (src, row) => { if (!scans.has(src)) { const colour = cleaned(src, row); scans.set(src, { colour, edges: edgesOf(colour) }); } return scans.get(src); };
  if (V1) scanOf(V1, true);
  // the live frame without the deck's lettering, for the tape while it goes back
  const cleans = new Map();
  const cleanOf = (still) => { if (!cleans.has(still)) cleans.set(still, cleaned(still, false)); return cleans.get(still); };

  // PAUSE, as the tape deck writes it
  const PZ = { x: 150, y: 168, w: 320, h: 84 };
  const pz = makeCanvas(PZ.w, PZ.h), pg = pz.getContext('2d');
  pg.font = '96px "VT323"'; pg.textBaseline = 'alphabetic';
  {
    const x = 18, y = 64, bars = (dx, dy) => { pg.fillRect(x + 218 + dx, y - 52 + dy, 16, 52); pg.fillRect(x + 246 + dx, y - 52 + dy, 16, 52); };
    pg.fillStyle = 'rgba(0,0,0,0.85)';
    for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [4, 4]]) { pg.fillText('PAUSE', x + dx, y + dy); bars(dx, dy); }
    pg.globalCompositeOperation = 'lighter';
    for (const [col, dx] of [['rgb(255,0,0)', -2.2], ['rgb(0,255,0)', 0], ['rgb(0,0,255)', 2.2]]) { pg.fillStyle = col; pg.fillText('PAUSE', x + dx, y); bars(dx, 0); }
  }

  // ---- the reticle's route --------------------------------------------------------------------------------------------
  const HOME_CMD = { x: DOCK.x + (2 + (shot.prompt || '').length) * DOCK.adv + 18, y: DOCK.rowC - 22 };     // where the cursor stood on Enter
  const HOME_NEW = { x: DOCK.x + 2 * DOCK.adv + 18, y: DOCK.rowC - 22 };                                  // where the next prompt starts
  const STOPS = ORDER.map((i) => { const f = FLAWS[i]; return { at: f.at, x: f.box.x + f.box.w / 2, y: f.box.y + f.box.h / 2 }; });
  /** Where the reticle is: on the row (docked), or out in the picture. Returns { x, y, docked, moving } */
  function reticleAt(lb) {
    if (lb < T_LIFT) return { ...HOME_CMD, docked: true, moving: 0 };
    if (lb >= T_HOME1) return { ...HOME_NEW, docked: true, moving: 0 };
    const P = pose(lb), first = STOPS[0];
    if (lb < first.at) {
      // straight up from the row to where the words should part
      const [fx, fy] = proj(first.x, first.y, P), p = outExpo(seg(lb, T_LIFT, first.at - 0.04));
      return { x: lerp(HOME_CMD.x, fx, p), y: lerp(HOME_CMD.y, fy, p), docked: false, moving: 1 - p };
    }
    let from = null;
    for (const k of STOPS) {
      const [kx, ky] = proj(k.x, k.y, P);
      if (lb >= k.at) { from = { x: kx, y: ky }; continue; }
      if (lb >= k.at - 0.3) { const p = outExpo(seg(lb, k.at - 0.3, k.at)); return { x: lerp(from.x, kx, p), y: lerp(from.y, ky, p), docked: false, moving: 1 - p }; }
      break;
    }
    if (lb >= T_HOME0) { const p = ease.inOutCubic(seg(lb, T_HOME0, T_HOME1)); return { x: lerp(from.x, HOME_NEW.x, p), y: lerp(from.y, HOME_NEW.y, p) - 60 * Math.sin(p * Math.PI), docked: false, moving: Math.sin(p * Math.PI) }; }
    return { x: from.x + 2.5 * Math.sin(lb * 5.1), y: from.y + 2.5 * Math.cos(lb * 4.3), docked: false, moving: 0 };      // hovering: it breathes a little
  }

  // ---- layers ---------------------------------------------------------------------------------------------------------
  const ui = makeCanvas(), u = ui.getContext('2d');                              // everything that glows
  const DY = 740, DH = 320;
  const dl = makeCanvas(W, DH), d = dl.getContext('2d');                         // the two rows
  const scanTile = makeCanvas(4, 4), stg = scanTile.getContext('2d');
  stg.fillStyle = 'rgba(0,0,0,0.22)'; stg.fillRect(0, 1, 4, 2);
  const scanPat = d.createPattern(scanTile, 'repeat');

  // hex grid, drawn once: fainter in the middle, where the hologram is
  const HEX_R = 34, HEX_W = HEX_R * 1.5, HEX_H = HEX_R * Math.sqrt(3);
  const hexPath = (c, cx, cy, r = HEX_R) => { c.moveTo(cx + r, cy); for (let i = 1; i < 6; i++) c.lineTo(cx + r * Math.cos(i * TAU / 6), cy + r * Math.sin(i * TAU / 6)); c.closePath(); };
  const hexCentre = (i, j) => [i * HEX_W, j * HEX_H + (i & 1 ? HEX_H / 2 : 0)];
  const hexes = makeCanvas(), hx = hexes.getContext('2d');
  hx.strokeStyle = rgba(CY, 1); hx.lineWidth = 1.2;
  hx.beginPath();
  for (let i = -1; i <= W / HEX_W + 1; i++) for (let j = -1; j <= H / HEX_H + 1; j++) { const [cx, cy] = hexCentre(i, j); hexPath(hx, cx, cy); }
  hx.stroke();
  hx.globalCompositeOperation = 'destination-in';
  const hg = hx.createRadialGradient(W / 2, H * 0.5, 160, W / 2, H * 0.5, 1150);
  hg.addColorStop(0, 'rgba(0,0,0,0.05)'); hg.addColorStop(0.5, 'rgba(0,0,0,0.3)'); hg.addColorStop(1, 'rgba(0,0,0,1)');
  hx.fillStyle = hg; hx.fillRect(0, 0, W, H);
  hx.globalCompositeOperation = 'source-over';

  // the soundtrack's level across the whole film, for the strip at the foot
  const WAVE_N = 150;
  const wave = Array.from({ length: WAVE_N }, (_, i) => { let v = 0; for (let k = 0; k < 6; k++) v += music.at(((i + k / 6) / WAVE_N) * clock.duration).rms; return v / 6; });
  const waveMax = Math.max(0.001, ...wave);

  // the two passes on the shared GPU renderer
  const holo = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT, fragmentShader: HOLO_FRAG, depthTest: false, depthWrite: false,
    uniforms: {
      tSrc: { value: null }, tEdge: { value: null }, uRes: { value: new THREE.Vector2(W, H) }, uPose: { value: new THREE.Vector3(0, 1, 1) }, uF: { value: FOCAL },
      uFrame: { value: 0 }, uGain: { value: 1 }, uSplit: { value: 0 }, uBeam: { value: 1e5 }, uBand: { value: 0 },
      uBox: { value: FLAWS.slice(0, 4).map((f) => new THREE.Vector4(f.box.x, f.box.y, f.box.x + f.box.w, f.box.y + f.box.h)) },
      uWin: { value: [0, 1, 2, 3].map(() => new THREE.Vector2(0, 0)) },
    },
  });
  while (holo.uniforms.uBox.value.length < 4) holo.uniforms.uBox.value.push(new THREE.Vector4(0, 0, 0, 0));
  const post = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false,
    uniforms: {
      tSrc: { value: null }, uRes: { value: new THREE.Vector2(W, H) }, uFrame: { value: 0 }, uCA: { value: 0.0016 }, uScan: { value: 0.08 },
      uGlitch: { value: 0 }, uPause: { value: 0 }, uGrain: { value: 0.035 }, uVig: { value: 0.5 }, uAlert: { value: 0 }, uBand: { value: 0 }, uBeam: { value: 0 },
    },
  });

  // ---- small drawing helpers ------------------------------------------------------------------------------------------
  function txt(c, str, x, y, size, color, o = {}) {
    c.font = `${size}px ${o.font || MONO}`;
    c.textAlign = o.align || 'left'; c.textBaseline = 'alphabetic';
    c.letterSpacing = `${o.track || 0}px`;
    c.fillStyle = color;
    c.fillText(str, x, y);
    c.letterSpacing = '0px';
  }
  const widthOf = (c, str, size, fnt = MONO, track = 0) => { c.font = `${size}px ${fnt}`; c.letterSpacing = `${track}px`; const w = c.measureText(str).width; c.letterSpacing = '0px'; return w; };
  const typeOn = (str, age, rate = 0.03) => (age < 0 ? '' : str.slice(0, Math.min(str.length, Math.floor(age / rate) + 1)));
  /**
   * Big lettering that assembles out of bars for four pictures, then is itself: it never shows a number it is not.
   * Returns the width of the settled text.
   */
  function assembled(c, str, x, y, size, color, age, frame, seed, fnt = WIDE) {
    const w = widthOf(c, str, size, fnt);
    if (age >= SETTLE) { txt(c, str, x, y, size, color, { font: fnt }); return w; }
    if (age < 0) return w;
    const hgt = size * 0.72, rows = 5, k = Math.floor(frame / 2);
    c.fillStyle = color;
    for (let r = 0; r < rows; r++) {
      const a = hash(k * 3.7 + r * 11.3 + seed), b2 = hash(k * 5.1 + r * 7.9 + seed + 4);
      c.fillRect(x + w * Math.min(a, b2) * 0.6, y - hgt + (r * hgt) / rows + 2, w * (0.25 + 0.75 * Math.abs(a - b2)), hgt / rows - 5);
    }
    return w;
  }
  function corners(c, x, y, w, h, arm, lw) {
    c.lineWidth = lw; c.lineCap = 'butt'; c.lineJoin = 'miter';
    c.beginPath();
    c.moveTo(x, y + arm); c.lineTo(x, y); c.lineTo(x + arm, y);
    c.moveTo(x + w - arm, y); c.lineTo(x + w, y); c.lineTo(x + w, y + arm);
    c.moveTo(x + w, y + h - arm); c.lineTo(x + w, y + h); c.lineTo(x + w - arm, y + h);
    c.moveTo(x + arm, y + h); c.lineTo(x, y + h); c.lineTo(x, y + h - arm);
    c.stroke();
  }
  /** The same marks on a four-cornered shape that is not square to the screen. */
  function quadCorners(c, q, arm, lw) {
    c.lineWidth = lw; c.lineCap = 'butt'; c.lineJoin = 'miter';
    c.beginPath();
    for (let i = 0; i < 4; i++) {
      const p = q[i], a = q[(i + 3) % 4], b = q[(i + 1) % 4], la = Math.hypot(a[0] - p[0], a[1] - p[1]) || 1, lb2 = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
      c.moveTo(p[0] + ((a[0] - p[0]) * arm) / la, p[1] + ((a[1] - p[1]) * arm) / la); c.lineTo(p[0], p[1]); c.lineTo(p[0] + ((b[0] - p[0]) * arm) / lb2, p[1] + ((b[1] - p[1]) * arm) / lb2);
    }
    c.stroke();
  }
  const quadPath = (c, q) => { c.beginPath(); q.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); };
  /** A straight line that grows from its first end. */
  function grow(c, x0, y0, x1, y1, p) { if (p <= 0) return; c.beginPath(); c.moveTo(x0, y0); c.lineTo(lerp(x0, x1, p), lerp(y0, y1, p)); c.stroke(); }
  /** A plate with one cut corner. */
  function platePath(c, x, y, w, h, cut = 16) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w, y + h - cut); c.lineTo(x + w - cut, y + h); c.lineTo(x, y + h); c.closePath(); }

  // ---- the pieces -----------------------------------------------------------------------------------------------------
  function drawFrame(c, lb, P, al) {
    const pulse = al * 0.35 * decay((lb - Math.floor(lb)) * 0.48, 0.1);
    c.strokeStyle = rgba(P, 0.9); c.lineWidth = 3 + 3 * pulse;
    const X0 = 96, X1 = 1824, Y0 = 54, Y1 = 1026;
    // each corner as the beam passes it: the head pair, then the foot pair
    for (const [x, y, sx, sy, t0] of [[X0, Y0, 1, 1, T_CORNER], [X1, Y0, -1, 1, T_CORNER + STAGGER], [X0, Y1, 1, -1, T_FOOT], [X1, Y1, -1, -1, T_FOOT + STAGGER]]) {
      const L = 64 * outExpo(seg(lb, t0, t0 + 0.4));
      if (L <= 0) continue;
      c.beginPath(); c.moveTo(x + sx * L, y); c.lineTo(x, y); c.lineTo(x, y + sy * L); c.stroke();
      c.fillStyle = rgba(P, 0.9); c.fillRect(x + sx * 12 - 4, y + sy * 12 - 4, 8, 8);
    }
    // rulers: the left edge in rows (each tick as the beam reaches it), the foot in columns; real pixels
    c.strokeStyle = rgba(CY, 0.5); c.lineWidth = 1.5;
    c.beginPath();
    for (let y = 330; y <= 750; y += 30) { if (lb < beamAt(y) + 0.03) break; const major = (y - 330) % 150 === 0; c.moveTo(96, y); c.lineTo(96 + (major ? 16 : 7), y); }
    const q = outExpo(seg(lb, T_FOOT, T_FOOT + 0.5));
    for (let x = 240; x <= 240 + 860 * q; x += 30) { const major = (x - 240) % 240 === 0; c.moveTo(x, 1026); c.lineTo(x, 1026 - (major ? 14 : 6)); }
    c.stroke();
    for (let y = 330; y <= 750; y += 150) if (lb >= beamAt(y) + 0.1) txt(c, String(y).padStart(4, '0'), 118, y + 6, 18, rgba(CY, 0.5));
    // caution hatching along the foot of the frame once the verdict is in
    if (al > 0) {
      const w = 1500 * outExpo(seg(lb, T_ALERT, T_ALERT + 0.5));
      c.save();
      c.beginPath(); c.rect(W / 2 - w / 2, 1040, w, 8); c.clip();
      c.strokeStyle = rgba(OR, 0.85); c.lineWidth = 5;
      c.beginPath();
      const march = (lb * 24) % 24;
      for (let x = W / 2 - w / 2 - 40 + march; x < W / 2 + w / 2 + 40; x += 24) { c.moveTo(x, 1052); c.lineTo(x + 14, 1036); }
      c.stroke();
      c.restore();
    }
  }

  function drawHeader(c, lb, P, PH, tag) {
    const p = outExpo(seg(lb, T_TAG, T_TAG + 0.4));
    if (p <= 0 || !tag) return;
    const label = `${tag.num}/${tag.of} ${tag.name}`;
    const tw_ = widthOf(c, label, 46, WIDE, 2);
    const x = 132, y = 90, w = (tw_ + 76) * p, h = 88;
    platePath(c, x, y, w, h, 18);
    c.fillStyle = 'rgba(0,13,17,0.9)'; c.fill();
    c.strokeStyle = rgba(P, 0.9); c.lineWidth = 2; c.stroke();
    c.fillStyle = rgba(P, 1); c.fillRect(x, y, 8, h);
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    txt(c, typeOn(label, lb - T_TAG - 0.08, 0.035), 168, 152, 46, rgba(PH, 1), { font: WIDE, track: 2 });
    c.restore();
    // small marks under the plate
    c.fillStyle = rgba(P, 0.7);
    for (let i = 0; i < 5; i++) if (p > i / 5) c.fillRect(x + i * 18, y + h + 10, 10, 4);
  }

  const RAD = { x: 1650, y: 204, r: 128 };
  function drawRadar(c, lb, P, PH) {
    const p = ease.inOutCubic(seg(lb, T_RADAR, Math.max(T_RADAR + 0.3, T_SWEEP + 0.06)));
    if (p <= 0) return;
    const { x, y, r } = RAD, a0 = -Math.PI / 2;
    c.save();
    // the dial: dark glass, rings, a cross
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = `rgba(0,13,17,${0.62 * p})`; c.fill();
    c.strokeStyle = rgba(P, 0.9); c.lineWidth = 2;
    c.beginPath(); c.arc(x, y, r, a0, a0 + TAU * p); c.stroke();
    c.strokeStyle = rgba(P, 0.35); c.lineWidth = 1.5;
    c.beginPath(); c.arc(x, y, r * 0.66, a0, a0 - TAU * p, true); c.stroke();
    c.beginPath(); c.moveTo(x - r * p, y); c.lineTo(x + r * p, y); c.moveTo(x, y - r * p); c.lineTo(x, y + r * p); c.stroke();
    // two broken rings that turn against each other
    c.strokeStyle = rgba(P, 0.55); c.lineWidth = 3;
    c.setLineDash([r * 0.85 * 0.5, r * 0.85 * 0.35]); c.lineDashOffset = -lb * 26;
    c.beginPath(); c.arc(x, y, r * 0.85, a0, a0 + TAU * p); c.stroke();
    c.lineWidth = 2; c.setLineDash([10, 14]); c.lineDashOffset = lb * 18;
    c.beginPath(); c.arc(x, y, r * 0.47, a0, a0 + TAU * p); c.stroke();
    c.setLineDash([]);
    // the rim is the film: one arc a shot, one tick a bar; an arc turns orange when the hand has flagged its file
    for (const s of clock.shots) {
      const s0 = dialAt(s.b0) + 0.012, s1 = dialAt(s.b1) - 0.012;
      if ((s0 - a0) / TAU > p) break;
      const fl = FLAGS.find((f) => f.idx === s.index), found = fl && lb >= fl.at;
      c.strokeStyle = found ? rgba(mixc(OR, OR_HOT, decay((lb - fl.at) * 0.48, 0.1)), 1) : rgba(P, s.num ? 0.5 : 0.22);
      c.lineWidth = found ? 7 : 4;
      c.beginPath(); c.arc(x, y, r + 9, s0, Math.min(s1, a0 + TAU * p)); c.stroke();
    }
    c.strokeStyle = rgba(P, 0.6); c.lineWidth = 1.5;
    c.beginPath();
    for (let b = 0; b < totalBars; b++) { const a = dialAt(b * clock.bpb); if ((a - a0) / TAU > p) break; c.moveTo(x + Math.cos(a) * (r + 15), y + Math.sin(a) * (r + 15)); c.lineTo(x + Math.cos(a) * (r + 21), y + Math.sin(a) * (r + 21)); }
    c.stroke();
    // where the tape stands: a marker outside the rim
    if (p >= 1) {
      const a = dialAt(shot.b0), mx = x + Math.cos(a) * (r + 21), my = y + Math.sin(a) * (r + 21);
      c.save(); c.translate(mx, my); c.rotate(a);
      c.fillStyle = rgba(PH, 1); c.beginPath(); c.moveTo(-9, 0); c.lineTo(5, -8); c.lineTo(5, 8); c.closePath(); c.fill();
      c.restore();
    }
    let under = null, since0 = 1;
    if (lb >= T_SWEEP) {
      // the hand, with the wedge of light it drags
      const turns = (lb - T_SWEEP) / SWEEP_BEATS, th = a0 + turns * TAU;
      const cg = c.createConicGradient(th, x, y);
      cg.addColorStop(0, rgba(P, 0)); cg.addColorStop(0.72, rgba(P, 0)); cg.addColorStop(0.94, rgba(P, 0.2)); cg.addColorStop(1, rgba(P, 0.55));
      c.fillStyle = cg;
      c.beginPath(); c.arc(x, y, r - 2, 0, TAU); c.fill();
      c.strokeStyle = rgba(PH, 1); c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(th) * r, y + Math.sin(th) * r); c.stroke();
      // flagged files: blips that flare each time the hand passes
      for (const f of FLAGS) {
        if (lb < f.at) continue;
        const since = ((((th - f.a) % TAU) + TAU) % TAU) / TAU * SWEEP_BEATS;      // beats since the hand last crossed it
        const fresh = decay(since * 0.48, 0.16), first = lb - f.at;
        const br = r * (0.58 + 0.26 * hash(f.idx * 1.7 + 0.3)), bx = x + Math.cos(f.a) * br, by = y + Math.sin(f.a) * br;
        const col = mixc(OR, OR_HOT, fresh);
        c.fillStyle = rgba(col, 0.5 + 0.5 * fresh);
        c.beginPath(); c.arc(bx, by, 4.5 + 3 * fresh, 0, TAU); c.fill();
        if (first < 1.0) { c.strokeStyle = rgba(col, 1 - first); c.lineWidth = 2; c.beginPath(); c.arc(bx, by, 6 + 22 * outExpo(first), 0, TAU); c.stroke(); }
      }
      const beat = (turns - Math.floor(turns)) * clock.totalBeats;
      under = clock.shots.find((s) => beat >= s.b0 && beat < s.b1) || null;
      if (under) since0 = ((beat - under.b0) / clock.totalBeats) * SWEEP_BEATS;
    }
    // the hub names the shot under the hand
    c.beginPath(); c.arc(x, y, 40, 0, TAU); c.fillStyle = 'rgba(0,13,17,0.94)'; c.fill();
    c.strokeStyle = rgba(P, 0.9); c.lineWidth = 2; c.stroke();
    const pop = decay(since0 * 0.48, 0.05);
    if (under && under.num) txt(c, String(under.num).padStart(2, '0'), x + 1, y + 14, 36 + 5 * pop, rgba(PH, 1), { font: WIDE, align: 'center' });
    else { c.fillStyle = rgba(PH, 0.9); c.fillRect(x - 20, y - 3, 16, 6); c.fillRect(x + 4, y - 3, 16, 6); }
    c.restore();
  }

  const ZONE = { x0: 660, x1: 1420, y: 64, h: 232 };
  function drawZone(c, lb, P, PH, al, env) {
    const p = outExpo(seg(lb, T_ZONE, T_ZONE + 0.45));
    if (p <= 0) return;
    const { x0, x1 } = ZONE, frame = env.frame;
    // the panel: faint glass with marks at its corners
    c.fillStyle = `rgba(0,13,17,${0.62 * p})`; c.fillRect(x0 - 28, ZONE.y, (x1 - x0 + 56) * p, ZONE.h);
    c.strokeStyle = rgba(P, 0.8);
    corners(c, x0 - 28, ZONE.y, (x1 - x0 + 56) * p, ZONE.h, 16, 2);
    if (lb < T_ALERT) {
      // what is being scanned, how far the scan is, and a light for each lock
      txt(c, typeOn(FILE ? 'JURY SCAN · FIRST CUT' : 'JURY SCAN', lb - T_ZONE - 0.1, 0.02), x0, 110, 30, rgba(PH, 1), { font: WIDE, track: 3 });
      const pct = clamp((lb - T_SWEEP) / SWEEP_BEATS);
      if (lb >= T_SWEEP) txt(c, `${String(Math.floor(pct * 100)).padStart(3, '0')}%`, x1, 110, 30, rgba(P, 0.9), { align: 'right' });
      c.strokeStyle = rgba(P, 0.35); c.lineWidth = 1.5; grow(c, x0, 128, x1, 128, p);
      c.strokeStyle = rgba(PH, 1); c.lineWidth = 4; grow(c, x0, 128, x1, 128, pct);
      if (FILE) txt(c, typeOn(FILE, lb - T_ZONE - 0.25, 0.022), x0, 194, 46, rgba(PH, 1));
      txt(c, typeOn(`FRAME ${stillFrame} · ${mmss(stillT)}`, lb - T_ZONE - 0.45, 0.022), x0, 256, 34, rgba(P, 0.85));
      FLAWS.forEach((f, i) => {
        const k = rank[i], bx = x1 - (FLAWS.length - k) * 74 + 10, by = 222, on = lb >= f.at, a = seg(lb, T_ZONE + 0.3 + k * 0.05, T_ZONE + 0.4 + k * 0.05);
        if (a <= 0) return;
        const flash = decay((lb - f.at) * 0.48, 0.08);
        if (on) { c.fillStyle = rgba(mixc(OR, [255, 255, 255], flash), 1); c.fillRect(bx, by, 64, 40); } else { c.strokeStyle = rgba(P, 0.6 * a); c.lineWidth = 2; c.strokeRect(bx + 1, by + 1, 62, 38); }
        txt(c, `0${k + 1}`, bx + 32, by + 30, 28, on ? 'rgba(0,13,17,1)' : rgba(P, 0.7 * a), { align: 'center' });
      });
      return;
    }
    // the verdict
    const age = lb - T_ALERT, slam = outExpo(seg(age, 0, 0.25));
    const hot = mixc(OR, OR_HOT, decay(age * 0.48, 0.18));
    txt(c, 'JURY SCORE', x0, 110, 30, rgba(OR_HOT, 1), { font: WIDE, track: 3 });
    txt(c, 'RUBRIC.MD', x1, 110, 30, rgba(OR, 0.9), { align: 'right' });
    c.strokeStyle = rgba(OR, 1); c.lineWidth = 4; grow(c, x0, 128, x1, 128, 1);
    // how many fixes, in a box of its own; the score takes the room that is left
    const nw = widthOf(c, VERDICT.n, 76, WIDE), ww = widthOf(c, VERDICT.word, 42);
    const cw = 30 + nw + 14 + ww + 24, ch = 100, cx = x1 - cw;
    let size = 138;
    while (size > 90 && widthOf(c, VERDICT.score, size, WIDE) + 14 + widthOf(c, `/ ${VERDICT.of}`, size * 0.33, WIDE) > cx - x0 - 22) size -= 4;
    c.save();
    c.translate(x0, 254); c.scale(lerp(1.28, 1, slam), lerp(1.28, 1, slam)); c.translate(-x0, -254);
    const bw = assembled(c, VERDICT.score, x0 - 6, 254, size, rgba(hot, 1), age, frame, 5);
    if (age >= SETTLE) txt(c, `/ ${VERDICT.of}`, x0 + bw + 12, 254, size * 0.33, rgba(OR, 0.95), { font: WIDE });
    c.restore();
    const cp = outExpo(seg(age, 0.1, 0.4));
    if (cp > 0) {
      const cy = 152 + 14 * (1 - cp);
      c.globalAlpha = cp;
      platePath(c, cx, cy, cw, ch, 18);
      c.fillStyle = rgba(OR, 0.16); c.fill();
      c.strokeStyle = rgba(OR, 1); c.lineWidth = 2.5; c.stroke();
      c.fillStyle = rgba(OR, 1); c.fillRect(cx, cy, 8, ch);
      assembled(c, VERDICT.n, cx + 30, cy + 78, 76, rgba(OR_HOT, 1), age - 0.1, frame, 9);
      txt(c, VERDICT.word, cx + 44 + nw, cy + 74, 42, rgba(OR_HOT, 1));
      c.globalAlpha = 1;
    }
    // a meter: the score out of its maximum, drawn
    const segs = Math.max(1, Math.round(+VERDICT.of) || 10), val = +VERDICT.score || 0, gap = 8, sw = (x1 - x0 - gap * (segs - 1)) / segs;
    for (let i = 0; i < segs; i++) {
      const on = seg(age, 0.2 + i * 0.05, 0.25 + i * 0.05);
      if (on <= 0) continue;
      const sx = x0 + i * (sw + gap), fill = clamp(val - i);
      c.strokeStyle = rgba(OR, 0.6); c.lineWidth = 1.5; c.strokeRect(sx + 0.75, 270.75, sw - 1.5, 10.5);
      if (fill > 0) { c.fillStyle = rgba(OR, 1); c.fillRect(sx, 270, sw * fill, 12); }
    }
  }

  function drawData(c, lb, P, PH, env) {
    const p = outExpo(seg(lb, T_DATA, T_DATA + 0.45));
    if (p <= 0) return;
    const x0 = 1160, x1 = 1788, y0 = 892, h = 44, frame = env.frame;
    // the soundtrack's level across the film, and where the paused frame stands in it (no counters here: the only
    // frame and time on screen are the first cut's, in the panel at the head)
    c.strokeStyle = rgba(P, 0.35); c.lineWidth = 1.5; grow(c, x0, y0 + h, x1, y0 + h, p);
    const now = clamp(stillT / clock.duration), n = Math.floor(WAVE_N * p);
    c.beginPath();
    for (let i = 0; i < n; i++) { const x = x0 + (i / (WAVE_N - 1)) * (x1 - x0), y = y0 + h - (wave[i] / waveMax) * (h - 4); i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.strokeStyle = rgba(P, 0.9); c.lineWidth = 2; c.stroke();
    if (n > 1) { c.lineTo(x0 + ((n - 1) / (WAVE_N - 1)) * (x1 - x0), y0 + h); c.lineTo(x0, y0 + h); c.closePath(); c.fillStyle = rgba(P, 0.12); c.fill(); }
    if (p >= 1) {
      const nx = x0 + now * (x1 - x0);
      c.strokeStyle = rgba(PH, 1); c.lineWidth = 2; c.beginPath(); c.moveTo(nx, y0 - 6); c.lineTo(nx, y0 + h + 6); c.stroke();
      c.fillStyle = rgba(PH, 1); c.beginPath(); c.moveTo(nx - 6, y0 - 12); c.lineTo(nx + 6, y0 - 12); c.lineTo(nx, y0 - 3); c.closePath(); c.fill();
    }
  }

  function drawReticle(c, lb, P, PH) {
    const rt = reticleAt(lb);
    if (rt.docked) return;
    const { x, y } = rt;
    // hairlines to the rulers, with a mark on each
    c.strokeStyle = rgba(P, 0.3); c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(96, y); c.lineTo(1824, y); c.moveTo(x, 54); c.lineTo(x, 1026); c.stroke();
    c.fillStyle = rgba(PH, 0.9);
    c.beginPath(); c.moveTo(96, y - 7); c.lineTo(110, y); c.lineTo(96, y + 7); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(x - 7, 1026); c.lineTo(x, 1012); c.lineTo(x + 7, 1026); c.closePath(); c.fill();
    // ghosts behind it while it flies
    if (rt.moving > 0.05) for (let e = 1; e <= 4; e++) { const g2 = reticleAt(lb - e * 0.024); if (!g2.docked) { c.strokeStyle = rgba(P, 0.36 / e); corners(c, g2.x - 36, g2.y - 36, 72, 72, 18, 4); } }
    const sz = 72 + 16 * rt.moving;
    c.strokeStyle = rgba(PH, 1);
    corners(c, x - sz / 2, y - sz / 2, sz, sz, 18, 4.5);
    c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(x - 14, y); c.lineTo(x - 4, y); c.moveTo(x + 4, y); c.lineTo(x + 14, y); c.moveTo(x, y - 14); c.lineTo(x, y - 4); c.moveTo(x, y + 4); c.lineTo(x, y + 14); c.stroke();
    c.strokeStyle = rgba(P, 0.8); c.lineWidth = 2.5; c.setLineDash([22, 14]); c.lineDashOffset = -lb * 46;
    c.beginPath(); c.arc(x, y, 60, 0, TAU); c.stroke(); c.setLineDash([]);
    c.lineWidth = 2; c.strokeStyle = rgba(P, 0.55);
    c.beginPath(); for (let q = 0; q < 4; q++) { const a = q * TAU / 4 + lb * 0.8; c.moveTo(x + Math.cos(a) * 68, y + Math.sin(a) * 68); c.lineTo(x + Math.cos(a) * 80, y + Math.sin(a) * 80); } c.stroke();
    // where it is: small figures that travel with it (texture, not a line to read). They go on whichever side of the
    // reticle keeps 16 px clear of every label on the glass, and are left out when no side does.
    if (lb < T_HOME0 + 0.1) {
      const str = `X${String(Math.round(x)).padStart(4, '0')} Y${String(Math.round(y)).padStart(4, '0')}`, tw = widthOf(c, str, 22);
      const avoid = labelRects(lb), CLEAR = 16;
      const sides = x > 1440 ? [[-1, -30], [1, -30], [-1, 50], [1, 50]] : [[1, -30], [-1, -30], [1, 50], [-1, 50]];
      for (const [sx, dy] of sides) {
        const tx = x + sx * 92, r = { x: sx > 0 ? tx : tx - tw, y: y + dy - 18, w: tw, h: 24 };
        if (r.x < 96 || r.x + r.w > 1824 || r.y < 54 || r.y + r.h > 1026) continue;
        if (avoid.some((a) => r.x < a.x + a.w + CLEAR && r.x + r.w > a.x - CLEAR && r.y < a.y + a.h + CLEAR && r.y + r.h > a.y - CLEAR)) continue;
        txt(c, str, tx, y + dy, 22, rgba(PH, 0.85), { align: sx > 0 ? 'left' : 'right' });
        break;
      }
    }
  }

  /** Every label on the glass at this beat, in screen pixels: the lock plates, their number tabs, the tag, the panel. */
  function labelRects(lb) {
    const out = [];
    FLAWS.forEach((f, i) => {
      if (lb < f.at) return;
      const { tab, B } = lockGeom(f, lb);
      out.push(tab, B);
      if (lb >= f.at + 0.18) out.push(plateRect(f));
    });
    for (let y = 330; y <= 750; y += 150) if (lb >= beamAt(y) + 0.1) out.push({ x: 116, y: y - 12, w: 50, h: 20 });     // the ruler's figures
    if (lb >= T_TAG) out.push({ x: 132, y: 90, w: 520, h: 98 });
    if (lb >= T_ZONE) out.push({ x: ZONE.x0 - 28, y: ZONE.y, w: ZONE.x1 - ZONE.x0 + 56, h: ZONE.h });
    return out;
  }

  /** The lock brackets on the turning plane, their number tabs, their labels on the glass. */
  const LABEL = 40, LINE_H = 48;
  function plateRect(f) { const lines = f.label.split('\n'), lw = Math.max(...lines.map((s) => widthOf(u, s, LABEL, MONO, 1))); return { x: f.plate.x, y: f.plate.y, w: lw + 36, h: lines.length * LINE_H + 14 }; }
  /** A lock's bracket on screen: the plane's quad, its bounds, the snapped bracket and the rectangle of its number tab. */
  function lockGeom(f, lb) {
    const P = pose(lb), age = lb - f.at;
    const again = decay((lb - T_ALERT) * clock.spb, 0.06);                                                // every bracket jumps with the verdict
    const q0 = flawQuad(f, P), R = boundsOf(q0), snap = outExpo(seg(age, 0, 0.3));
    const k = (lerp(1.4, 1, snap) + 0.14 * again) * (1 + 8 / Math.min(R.w, R.h));
    const mx = (q0[0][0] + q0[2][0]) / 2, my = (q0[0][1] + q0[2][1]) / 2;
    const q = q0.map((p) => [mx + (p[0] - mx) * k, my + (p[1] - my) * k]), B = boundsOf(q);
    const [tx, ty] = f.tab === 'in' ? [B.x + 10, B.y + 10] : f.tab === 'right' ? [B.x + B.w + 6, B.y] : [B.x, B.y - 30];
    return { P, again, R, q, B, tab: { x: tx, y: ty, w: 46, h: 26 } };
  }
  function drawLocks(c, lb, al) {
    FLAWS.forEach((f, i) => {
      const age = lb - f.at;
      if (age < 0) return;
      const { P, again, R, q, B, tab } = lockGeom(f, lb);
      const flash = Math.max(decay(age * 0.48, 0.07), again), breathe = 0.5 + 0.5 * Math.sin((lb - f.at) * Math.PI);          // one swell a beat
      const col = al > 0 ? mixc(OR, OR_HOT, flash) : mixc(mixc(OR, OR_HOT, 0.25), [255, 255, 255], flash);
      c.strokeStyle = rgba(col, 0.4 + 0.2 * breathe); c.lineWidth = 1.5; c.setLineDash([6, 8]);
      quadPath(c, q); c.stroke(); c.setLineDash([]);
      c.strokeStyle = rgba(col, 1);
      quadCorners(c, q, Math.min(34, Math.min(B.w, B.h) * 0.3), 5 + 2 * flash + 1.2 * breathe * al);
      // what should be there and is not, as dashed guide lines inside the bracket
      if (f.ghost && age > 0.3) {
        const gh = f.ghost, on = seg(age, 0.3, 0.7), b = f.box;
        c.save();
        quadPath(c, [proj(b.x, gh.horizon, P), proj(b.x + b.w * on, gh.horizon, P), proj(b.x + b.w * on, b.y + b.h, P), proj(b.x, b.y + b.h, P)]); c.clip();
        c.strokeStyle = rgba([255, 240, 220], 0.85 * (0.75 + 0.25 * Math.sin(lb * Math.PI * 2))); c.lineWidth = 2.5; c.setLineDash([10, 8]); c.lineDashOffset = -lb * 10;
        c.beginPath();
        for (let a = 0; a <= 64; a++) { const [gx, gy] = proj(gh.circle.x + gh.circle.r * Math.cos((a / 64) * TAU), gh.circle.y + gh.circle.r * Math.sin((a / 64) * TAU), P); a ? c.lineTo(gx, gy) : c.moveTo(gx, gy); }
        for (const y of gh.rows) { const hw = Math.sqrt(Math.max(0, gh.circle.r ** 2 - (gh.circle.y - y) ** 2)), [ax, ay] = proj(gh.circle.x - hw, y, P), [bx, by] = proj(b.x + b.w, y, P); c.moveTo(ax, ay); c.lineTo(bx, by); }
        c.stroke();
        c.restore();
      }
      // a number tab on the bracket
      const { x: tx, y: ty } = tab;
      c.fillStyle = rgba(col, 1); c.fillRect(tx, ty, 46, 26);
      txt(c, `0${rank[i] + 1}`, tx + 6, ty + 21, 24, 'rgba(0,13,17,1)');
      // the label: a plate at a fixed place on the glass, tied to the bracket by a line
      const lines = f.label.split('\n'), la = age - 0.18;
      if (la < 0) return;
      const { x: px, y: py, w: pw, h: ph } = plateRect(f);
      const open = outExpo(seg(la, 0, 0.3)), leftward = px < R.x;
      c.strokeStyle = rgba(col, 0.9); c.lineWidth = 2;
      const ax = leftward ? R.x - 4 : R.x + R.w + 4, ay = clamp(py + 16, R.y, R.y + R.h), ex = leftward ? px + pw : px;
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, ex, open), lerp(ay, py + 16, open)); c.stroke();
      c.fillStyle = rgba(col, 1); c.fillRect(ax - 4, ay - 4, 8, 8);
      c.save();
      c.beginPath(); c.rect(px, py, pw * open, ph); c.clip();
      platePath(c, px, py, pw, ph, 16);
      c.fillStyle = 'rgba(0,13,17,0.9)'; c.fill();
      c.strokeStyle = rgba(col, 0.9); c.lineWidth = 2; c.stroke();
      c.fillStyle = rgba(col, 1); c.fillRect(px, py, 7, ph);
      let done = 0;
      lines.forEach((s, j) => { txt(c, typeOn(s, la - 0.12 - done * 0.02, 0.02), px + 22, py + 43 + j * LINE_H, LABEL, rgba(al > 0 ? OR_HOT : [255, 226, 196], 1), { track: 1 }); done += s.length; });
      c.restore();
    });
  }

  // ---- the tape: paused, rewound to the first cut, stopped there ------------------------------------------------------
  // the tracking bands' noise, made once: short white streaks, densest in the middle rows of the band
  const NOISE_H = 120, noise = makeCanvas(W + 240, NOISE_H);
  {
    const ng = noise.getContext('2d');
    for (let i = 0; i < 2600; i++) {
      const y = NOISE_H * (0.5 + (hash(i * 1.17 + 3) - 0.5) * (0.35 + 0.65 * hash(i * 2.9 + 1)));
      ng.fillStyle = `rgba(255,255,255,${0.25 + 0.7 * hash(i * 5.3 + 7)})`;
      ng.fillRect(hash(i * 3.7 + 2) * (W + 240), Math.round(y), 6 + 160 * hash(i * 7.1 + 5) ** 2, 1 + Math.floor(hash(i * 9.3 + 4) * 3));
    }
    const fade = ng.createLinearGradient(0, 0, 0, NOISE_H);
    fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(0.5, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
    ng.globalCompositeOperation = 'destination-in'; ng.fillStyle = fade; ng.fillRect(0, 0, W + 240, NOISE_H);
  }
  // three bands that run UP the picture, as they do when the tape goes back (screens a beat, where they start, height)
  const BANDS = [{ sp: 2.4, ph: 0.1, h: 120 }, { sp: 3.1, ph: 0.55, h: 70 }, { sp: 1.8, ph: 0.82, h: 104 }];
  const GAP = 70;                                                            // the black blanking bar as the picture rolls
  /** The tape's picture at this beat, full frame. */
  function tapePicture(g, lb, live, frame) {
    if (!REWIND || lb < T_REW0) { g.drawImage(live, 0, 0, W, H); return; }
    const first = scanOf(V1, true).colour;                                   // the first cut's frame without the deck's lettering
    if (lb >= T_V1) { g.drawImage(first, 0, 0); return; }
    // going back: the picture slips sideways in the bands and leans; halfway it rolls up a whole frame onto the first cut
    const k = lb - T_REW0, held = Math.floor(lb * fpb / 2) / fpb * 2;       // the tape's wobble moves on every other picture
    const roll = ease.inOutCubic(seg(lb, T_SWAP - 0.12, T_SWAP + 0.12)) * (H + GAP);
    const bandY = BANDS.map((b) => { const run = H + b.h; return H + b.h / 2 - (((k * b.sp * H) + b.ph * run) % run); });
    const fromLive = cleanOf(live), STRIP = 6;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += STRIP) {
      let dx = 7 * Math.sin(y * 0.011 + held * 31) + 14 * (1 - y / H) * Math.sin(held * 17);
      BANDS.forEach((b, i) => { const d = Math.abs(y - bandY[i]) / (b.h / 2); if (d < 1) dx += (hash(Math.floor(y / STRIP) * 1.3 + frame * 7.1 + i) - 0.5) * 150 * (1 - d); });
      const sy = y + roll;
      if (sy < H) g.drawImage(fromLive, 0, sy, W, STRIP, dx, y, W, STRIP);
      else if (sy >= H + GAP && sy < 2 * H + GAP) g.drawImage(first, 0, sy - H - GAP, W, STRIP, dx, y, W, STRIP);
    }
    g.save(); g.globalCompositeOperation = 'lighter';
    BANDS.forEach((b, i) => { g.globalAlpha = 0.8; g.drawImage(noise, -240 * hash(frame * 3.3 + i), bandY[i] - b.h / 2, W + 240, b.h); });
    g.restore();
  }
  /** VCR display lettering on the frame: black edge, then red, green and blue a little apart (as Synthwave's deck). */
  function osdText(g, str, x, y, size, split = 1.5) {
    g.save();
    g.font = `${size}px ${OSD}`; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.globalAlpha = 0.9; g.fillStyle = '#000';
    for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, -2], [-2, 2], [2, 2], [4, 4]]) g.fillText(str, x + dx, y + dy);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1;
    g.fillStyle = 'rgb(255,0,0)'; g.fillText(str, x - split, y);
    g.fillStyle = 'rgb(0,255,0)'; g.fillText(str, x, y);
    g.fillStyle = 'rgb(0,0,255)'; g.fillText(str, x + split, y);
    g.restore();
    return widthOf(g, str, size, OSD);
  }
  function osdShape(g, fn, split = 1.5) {
    g.save();
    g.globalAlpha = 0.9; g.fillStyle = '#000';
    for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [4, 4]]) { g.save(); g.translate(dx, dy); fn(g); g.fill(); g.restore(); }
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1;
    ['rgb(255,0,0)', 'rgb(0,255,0)', 'rgb(0,0,255)'].forEach((col, i) => { g.save(); g.translate((i - 1) * split, 0); g.fillStyle = col; fn(g); g.fill(); g.restore(); });
    g.restore();
  }
  /** Two triangles pointing back: the deck's rewind sign, s tall, its left point at x and its foot on y. */
  const rewSign = (x, y, s) => (c) => { c.beginPath(); for (const o of [0, s * 0.5]) { c.moveTo(x + o, y - s / 2); c.lineTo(x + o + s * 0.5, y - s); c.lineTo(x + o + s * 0.5, y); c.closePath(); } };
  const OSD_X = 168, OSD_Y1 = 168, OSD_Y2 = 250;                            // where every shot keeps its tag, and the line below
  /** The deck's own display: PAUSE, then ◀◀ while it goes back, then what it stopped on, in plain words. */
  function deckDisplay(g, lb) {
    if (!REWIND || lb < T_REW0) { if (lb < T_BEAM0) g.drawImage(pz, PZ.x, PZ.y); return; }
    if (lb < T_V1) {
      osdShape(g, rewSign(OSD_X, OSD_Y1, 64), 2.5);
      osdText(g, 'REW', OSD_X + 116, OSD_Y1, 128, 2.5);
      return;
    }
    const settle = lb < T_V1 + 0.08 ? 4 : 1.5;                                 // the colours part as it stops, then close
    osdText(g, 'FIRST CUT', OSD_X, OSD_Y1, 128, settle);
    osdText(g, FILE || '', OSD_X + 4, OSD_Y2, 80, settle);
  }

  /** The hologram behind the beam (drawn on the GPU), the paused tape ahead of it. */
  function drawPicture(g, R, live, lb, env) {
    const beam = beamY(lb);
    if (beam > 0) {
      const sc = scanOf(V1 || live, !!V1), P = pose(lb), hu = holo.uniforms, split = 2 / fpb;
      hu.tSrc.value = texOf(sc.colour); hu.tEdge.value = texOf(sc.edges);
      hu.uPose.value.set(P.sin, P.cos, P.s);
      hu.uFrame.value = env.frame;
      hu.uBeam.value = beam < BEAM_B ? beam : 1e5;
      hu.uBand.value = (lb * 0.07) % 1;
      const flip = decay((lb - T_ALERT) * env.spb, 0.06);
      hu.uGain.value = (lb >= T_ALERT ? 0.9 : 1) + 1.0 * flip;
      // for two pictures on each lock, and on the verdict, the lines part into red, green and blue
      let sp = lb >= T_ALERT && lb < T_ALERT + split ? 26 : 0;
      FLAWS.slice(0, 4).forEach((f, i) => {
        const age = lb - f.at;
        if (age >= 0 && age < split) sp = Math.max(sp, 16);
        hu.uWin.value[i].set(age < 0.02 ? 0 : outExpo(seg(age, 0.02, 0.3)), 0.5 * decay(age * 0.48, 0.06));
      });
      hu.uSplit.value = sp;
      drawQuad(R, holo);
      blitGL(g, R);
    }
    if (beam < H) {
      // the tape ahead of the beam: paused, rewinding, stopped on the first cut; the deck's display on it
      g.save();
      g.beginPath(); g.rect(0, Math.max(0, beam), W, H); g.clip();
      tapePicture(g, lb, live, env.frame);
      deckDisplay(g, lb);
      g.restore();
    }
    // hex grid over the hologram, a few cells lit and changing on the half-beat
    if (beam > 0) {
      const al = lb >= T_ALERT ? 1 : 0;
      g.save();
      g.beginPath(); g.rect(0, 0, W, beam); g.clip();
      const beat = decay((lb - Math.floor(lb)) * 0.48, 0.12);
      g.globalAlpha = 0.3 + 0.1 * beat;
      g.drawImage(hexes, 0, 0);
      const stepH = Math.floor(lb * 2);
      g.globalAlpha = 1;
      for (let k = 0; k < 14; k++) {
        const i = Math.floor(hash(stepH * 1.37 + k * 7.1) * (W / HEX_W)), j = Math.floor(hash(stepH * 2.11 + k * 3.3) * (H / HEX_H));
        const [cx, cy] = hexCentre(i, j);
        if (cx > 380 && cx < 1540 && cy > 300 && cy < 780) continue;                 // the middle stays clear
        g.beginPath(); hexPath(g, cx, cy, HEX_R - 3);
        g.fillStyle = rgba(al > 0 && k % 3 === 0 ? OR : CY, 0.05 + 0.13 * hash(k + stepH * 0.7));
        g.fill();
      }
      // cells light as the beam uncovers them, and a ring of them runs out from the verdict
      const ring = lb - T_ALERT, lit = [];
      if (beam < H + 150) for (let i = -1; i <= W / HEX_W + 1; i++) for (let j = -1; j <= H / HEX_H + 1; j++) { const [cx, cy] = hexCentre(i, j), k = 1 - (beam - cy) / 150; if (k > 0 && k <= 1 && hash(i * 12.9 + j * 78.2) > 0.45) lit.push([cx, cy, CY, 0.3 * k]); }
      if (ring >= 0 && ring < 1.4) {
        const rad = 1700 * ease.outCubic(ring / 1.4), fade = 1 - ring / 1.4;
        for (let i = -1; i <= W / HEX_W + 1; i++) for (let j = -1; j <= H / HEX_H + 1; j++) { const [cx, cy] = hexCentre(i, j), k = 1 - Math.abs(Math.hypot(cx - 1040, cy - 190) - rad) / 130; if (k > 0) lit.push([cx, cy, OR, 0.42 * k * fade]); }
      }
      for (const [cx, cy, col, a] of lit) { g.beginPath(); hexPath(g, cx, cy, HEX_R - 3); g.fillStyle = rgba(col, a); g.fill(); }
      g.restore();
    }
    // the beam itself: a thin white core, a wide cyan fall-off behind it, a little light ahead
    if (beam > -8 && beam < H + 8) {
      const gr = g.createLinearGradient(0, beam - 120, 0, beam);
      gr.addColorStop(0, rgba(CY, 0)); gr.addColorStop(0.6, rgba(CY, 0.1)); gr.addColorStop(1, rgba(CY, 0.42));
      g.save(); g.globalCompositeOperation = 'lighter';
      g.fillStyle = gr; g.fillRect(0, beam - 120, W, 120);
      const ga = g.createLinearGradient(0, beam, 0, beam + 26);
      ga.addColorStop(0, rgba(CY, 0.3)); ga.addColorStop(1, rgba(CY, 0));
      g.fillStyle = ga; g.fillRect(0, beam, W, 26);
      g.restore();
      u.fillStyle = 'rgba(255,255,255,1)'; u.fillRect(0, beam - 2, W, 4);
    }
    // a darker bed for the two rows
    const bed = g.createLinearGradient(0, 760, 0, 1080);
    bed.addColorStop(0, 'rgba(0,10,14,0)'); bed.addColorStop(0.35, `rgba(0,10,14,${0.62 * seg(lb, 0.2, 1)})`); bed.addColorStop(1, `rgba(0,10,14,${0.76 * seg(lb, 0.2, 1)})`);
    g.fillStyle = bed; g.fillRect(0, 760, W, 320);
  }

  // ---- the two rows, as HUD read-outs ---------------------------------------------------------------------------------
  const SIZE = 66;                                             // Share Tech Mono at this size fills the 36 px cells
  const cellX = (i) => DOCK.x + i * DOCK.adv + DOCK.adv / 2;
  /** One letter, centred in its cell: a dark edge, then its colour with the channels a hair apart. */
  function glyph(ch, i, y, col, o = {}) {
    const x = cellX(i), sc = o.scale || 1, a = o.alpha ?? 1, split = o.split ?? 1.3;
    d.save();
    d.translate(x, y - DY - SIZE * 0.3); d.scale(sc, sc); d.translate(-x, -(y - DY - SIZE * 0.3));
    d.font = `${SIZE}px ${MONO}`; d.textAlign = 'center'; d.textBaseline = 'alphabetic';
    d.globalAlpha = 0.75 * a; d.fillStyle = '#000d11';
    for (const [dx, dy] of [[-3, 0], [3, 0], [0, 3], [0, -3]]) d.fillText(ch, x + dx, y - DY + dy);
    d.globalCompositeOperation = 'lighter'; d.globalAlpha = a;
    d.fillStyle = `rgb(${col[0] | 0},0,0)`; d.fillText(ch, x - split, y - DY);
    d.fillStyle = `rgb(0,${col[1] | 0},0)`; d.fillText(ch, x, y - DY);
    d.fillStyle = `rgb(0,0,${col[2] | 0})`; d.fillText(ch, x + split, y - DY);
    d.restore();
  }
  /** The cursor at rest on the row: a small reticle with a block in it. */
  function rowCursor(i, lit, P, PH, morph = 1) {
    const x = DOCK.x + i * DOCK.adv + 2, y = DOCK.rowC - DY - 50, w = 32, h = 56;
    d.save();
    d.strokeStyle = rgba(PH, 1);
    corners(d, x, y, w, h, 9, 3);
    if (lit) { d.fillStyle = rgba(PH, 0.92); const m = 6 * morph; d.fillRect(x + m, y + m, w - 2 * m, h - 2 * m); }
    d.restore();
  }

  function dock(g, env, part) {
    const m = env.term, lb = env.lb, frame = env.frame;
    const al = lb >= T_ALERT ? 1 : 0, P = al ? OR : CY, PH = al ? OR_HOT : CY_HOT;
    d.setTransform(1, 0, 0, 1, 0, 0); d.globalAlpha = 1; d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, W, DH);
    // the result is printed once the big read-out above it has settled; until then the line before it stays
    let l = m.last, age = l ? l.age : 0;
    if (l && l.kind === 'result') { if (l.age < SETTLE + 0.02) { l = m.out[m.out.length - 2] || null; age = 9; } else age = l.age - SETTLE - 0.02; }
    if (part !== 'C' && l) {
      const y = DOCK.rowB, isRes = l.kind === 'result';
      const col = isRes ? OR_HOT : CY_HOT, dim = isRes ? OR : CY;
      const shown = l.kind === 'say' ? l.chars : Math.min(l.text.length, Math.floor(age / 0.014) + 1);
      const start = isRes ? 5 : 2;
      d.save();
      if (isRes) {
        // the elbow before a result
        d.strokeStyle = rgba(dim, 1); d.lineWidth = 4;
        d.beginPath(); d.moveTo(cellX(2), y - DY - 46); d.lineTo(cellX(2), y - DY - 8); d.lineTo(cellX(3) + 8, y - DY - 8); d.stroke();
      } else {
        // a hexagon for the bullet: hollow while the call runs, solid when it is done
        const bx = cellX(0), by = y - DY - 21, run = l.kind === 'tool' && age < 0.6;
        d.beginPath(); hexPath(d, bx, by, 15);
        d.strokeStyle = rgba(col, 1); d.lineWidth = 3; d.stroke();
        if (!run || (frame >> 2) % 2) { d.beginPath(); hexPath(d, bx, by, run ? 6 : 9); d.fillStyle = rgba(col, 1); d.fill(); }
      }
      d.restore();
      const k = l.kind === 'tool' ? Math.max(0, l.text.indexOf('(')) : 0;
      for (let i = 0; i < shown; i++) {
        if (l.text[i] === ' ') continue;
        glyph(l.text[i], start + i, y, i < k || isRes ? col : mixc(dim, col, 0.35), { alpha: i < k || isRes ? 1 : 0.92 });
      }
      if (shown < l.text.length) { d.fillStyle = rgba(col, 0.9); d.fillRect(DOCK.x + (start + shown) * DOCK.adv + 4, y - DY - 46, 26, 48); }
    }
    if (part !== 'B') {
      const c = m.rowC, y = DOCK.rowC;
      // the input field: a rule with a tick at every cell, so the grid shows
      d.save();
      d.strokeStyle = rgba(P, 0.5); d.lineWidth = 2;
      d.beginPath(); d.moveTo(DOCK.x + 2 * DOCK.adv, y - DY + 20); d.lineTo(DOCK.x + 2 * DOCK.adv + 24 * DOCK.adv, y - DY + 20);
      for (let i = 2; i <= 26; i++) { const x = DOCK.x + i * DOCK.adv; d.moveTo(x, y - DY + 20); d.lineTo(x, y - DY + (i % 4 === 2 ? 30 : 26)); }
      d.stroke();
      d.restore();
      glyph('>', 0, y, P, { alpha: 0.95 });
      const clearing = c.mode === 'typing' && c.n === 0 && m.prompt && m.typing ? seg(lb, m.typing.start - 1, m.typing.start - 0.75) : -1;
      if (c.mode === 'cmd' || (clearing >= 0 && clearing < 1)) {
        // the command that started this shot; when the next one is due it is wiped, last letter first
        const text = m.prompt || c.text, keep = clearing >= 0 ? Math.ceil(text.length * (1 - clearing)) : text.length;
        for (let i = 0; i < keep; i++) if (text[i] !== ' ') glyph(text[i], 2 + i, y, mixc(P, PH, 0.3), { alpha: 0.8 });
        if (clearing >= 0) { d.fillStyle = rgba(PH, 0.9); d.fillRect(DOCK.x + (2 + keep) * DOCK.adv + 4, y - DY - 46, 26, 48); }
        else if (lb < T_LIFT) rowCursor(2 + text.length, true, P, PH, seg(lb, T_LIFT - 0.45, T_LIFT - 0.05));       // the cursor, about to leave
      } else {
        for (let i = 0; i < c.n; i++) {
          if (c.text[i] === ' ') continue;
          const kAge = c.keyAge(i), pop = decay(kAge * 0.48, 0.05);
          glyph(c.text[i], 2 + i, y, mixc(PH, [255, 255, 255], pop), { scale: 1 + 0.22 * pop, split: 1.3 + 4 * pop });
          if (kAge < 0.4) {                                             // each key gets a little lock of its own
            const k = lerp(1.5, 1, outExpo(seg(kAge, 0, 0.25)));
            d.save(); d.strokeStyle = rgba(PH, 1 - seg(kAge, 0.15, 0.4));
            corners(d, cellX(2 + i) - 18 * k, y - DY - 22 - 28 * k, 36 * k, 56 * k, 8, 2.5);
            d.restore();
          }
        }
        // the cursor is the reticle: it is drawn here only when it is home
        if (c.cursor && (lb >= T_HOME1 || lb < 0)) rowCursor(2 + c.n, m.blink, P, PH, 0);
      }
    }
    // onto the frame: scan lines through it, a glow under it
    d.save(); d.globalCompositeOperation = 'destination-out'; d.fillStyle = scanPat; d.fillRect(0, 0, W, DH); d.restore();
    g.save();
    g.globalCompositeOperation = 'lighter'; g.globalAlpha *= 0.55; g.filter = 'blur(9px)';
    g.drawImage(dl, 0, DY);
    g.restore();
    g.drawImage(dl, 0, DY);
  }

  // warm both passes up, so the first frame asked for is not a black one
  {
    const R = useGL();
    if (V1) { const sc = scanOf(V1, true); holo.uniforms.tSrc.value = texOf(sc.colour); holo.uniforms.tEdge.value = texOf(sc.edges); drawQuad(R, holo); }
    post.uniforms.tSrc.value = texOf(ui);
    drawQuad(R, post);
    R.getContext().finish();
  }

  return {
    dock,
    samples: () => 1,
    /**
     * What Collage can take hold of, in frame pixels at this instant: the lock brackets (with their labels), the colour
     * the display is in, and the other boxes on the glass (label plates, the tag, the score panel, the radar's square).
     * The plane is at rest from beat 8, so the brackets hold still while they are cut along.
     */
    handoff(env) {
      const lb = Math.max(0, env.lb), on = FLAWS.filter((f) => lb >= f.at);
      const tagW = env.tag ? widthOf(u, `${env.tag.num}/${env.tag.of} ${env.tag.name}`, 46, WIDE, 2) + 76 : 0;
      return {
        brackets: on.map((f) => { const R = flawRect(f, lb); return { x: Math.round(R.x), y: Math.round(R.y), w: Math.round(R.w), h: Math.round(R.h), label: f.label.replace(/\n/g, ' ') }; }),
        color: lb >= T_ALERT ? '#FF6A00' : '#00E5FF',
        panels: [
          ...on.filter((f) => lb >= f.at + 0.5).map((f) => ({ kind: 'label', ...plateRect(f) })),
          { kind: 'tag', x: 132, y: 90, w: Math.round(tagW), h: 88 },
          { kind: 'score', x: ZONE.x0 - 28, y: ZONE.y, w: ZONE.x1 - ZONE.x0 + 56, h: ZONE.h },
          { kind: 'radar', x: RAD.x - RAD.r - 21, y: RAD.y - RAD.r - 21, w: 2 * RAD.r + 42, h: 2 * RAD.r + 42 },
        ],
      };
    },
    sfx: [
      ...(REWIND ? [{ b: T_REW0, s: 'hud_rewind', g: 0.7 }, { b: T_V1, s: 'hud_stop', a: 'peak', g: 0.8 }] : []),
      { b: T_BEAM0, s: 'hud_boot', g: 0.7 },
      { b: T_LIFT, s: 'hud_probe', a: 'peak', g: 0.5 },
      ...FLAWS.map((f) => ({ b: f.at, s: 'hud_lock', a: 'peak', g: 0.9 })),
      ...FLAGS.map((f) => ({ b: f.at, s: 'hud_blip', a: 'peak', g: 0.3 })),
      { b: T_ALERT, s: 'hud_alarm', a: 'peak', g: 1.0 },
    ].sort((a, b) => a.b - b.b),
    render(g, env) {
      const lb = Math.max(0, env.lb), spb = env.spb;
      const live = env.other || V1;
      const al = lb >= T_ALERT ? 1 : 0;
      const flip = decay((lb - T_ALERT) * spb, 0.05);                       // the instant of the verdict
      const P = al ? OR : CY, PH = al ? mixc(OR_HOT, [255, 255, 255], flip) : CY_HOT;
      const R = useGL();

      u.setTransform(1, 0, 0, 1, 0, 0); u.globalAlpha = 1; u.globalCompositeOperation = 'source-over'; u.clearRect(0, 0, W, H);
      if (live) drawPicture(g, R, live, lb, env);
      else { g.fillStyle = '#021418'; g.fillRect(0, 0, W, H); g.globalAlpha = 0.4; g.drawImage(hexes, 0, 0); g.globalAlpha = 1; }

      drawFrame(u, lb, P, al);
      drawHeader(u, lb, P, PH, env.tag);
      drawRadar(u, lb, P, PH);
      drawZone(u, lb, P, PH, al, env);
      drawData(u, lb, P, PH, env);
      drawLocks(u, lb, al);
      drawReticle(u, lb, P, PH);

      // the glass: a wide glow under the linework, then the linework
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.62 + 0.3 * flip; g.filter = 'blur(11px)'; g.drawImage(ui, 0, 0); g.restore();
      g.drawImage(ui, 0, 0);
      if (flip > 0.02) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,120,30,${0.3 * flip})`; g.fillRect(0, 0, W, H); g.restore(); }

      // the finishing pass
      const tex = texOf(g.canvas); tex.needsUpdate = true;
      const pu = post.uniforms;
      let glitch = 0.9 * decay(lb * spb, 0.05) + 1.0 * decay((lb - T_ALERT) * spb, 0.045);
      if (REWIND) glitch += 0.25 * (lb >= T_REW0 && lb < T_V1 ? 1 : 0) + 0.6 * decay((lb - T_V1) * spb, 0.03);   // going back, and the stop
      for (const f of FLAWS) glitch += 0.35 * (lb >= f.at && lb < f.at + 0.07 ? 1 : 0);
      for (const b of [6.5, 7.75, 9.25]) glitch += 0.22 * (lb >= b && lb < b + 0.06 ? 1 : 0);        // small ones in the hold
      pu.tSrc.value = tex;
      pu.uFrame.value = env.frame;
      pu.uGlitch.value = Math.min(1, glitch);
      pu.uPause.value = 1 - smooth(seg(lb, T_BEAM1 - 0.3, T_BEAM1));
      pu.uBeam.value = 1 - clamp(beamY(lb) / H);
      pu.uAlert.value = al * (0.1 + 0.16 * decay((lb - Math.floor(lb)) * spb, 0.14) + 0.5 * flip);
      pu.uBand.value = (lb * 0.11) % 1;
      drawQuad(R, post);
      blitGL(g, R);

      if (env.noDock) return;
      if (env.other && env.otherImpl && env.otherImpl.dock && env.role === 'in' && lb < 0.8) swapDock(g, env, dock, seg(lb, 0.08, 0.62));
      else dock(g, env);
    },
  };
}
