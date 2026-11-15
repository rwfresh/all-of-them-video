// 10/15 Synthwave / VHS: "play it." The tape takes the picture before it (the same picture, now on tape: it leans,
// then loses vertical hold once), a VCR's PLAY appears where the prompt's ">" was, and the picture locks onto a low
// flight over a neon grid, between two rows of palms, toward a striped sun. For the beat before the drop the music is
// silent and the tape holds its breath: the ground nearly stops and the picture dims. On beat 4 a chrome title slams
// in, lit from behind: ALL OF THEM, held clear of the glow behind it. A pink neon script writes on under it. From beat 12 the tape
// is paused.
//
// The world is three.js on the shared renderer, in linear HDR, through the kit's post chain (bloom, tone curve, tape
// pass). Motion blur is done here, inside the chain, so samples() stays 1. The on-screen display and the terminal's two
// rows are drawn over the tape picture, clean, as a VCR draws them.

import * as THREE from 'three';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { Post, Pass } from '../post.js';
import { makeLetters, chromeMaterial, makeGlint } from '../stage.js';
import { DOCK, swapDock } from '../term.js';
import { lerp, seg, smooth, ease, tw, decay, rng, noise1 } from '../util.js';
import { makeSky, makeTerrain, HAND_FRAG } from './synth/world.js';
import { makePalms } from './synth/palms.js';

const FLASH = new THREE.Color(1.0, 0.82, 0.95);
const T_HOLD = 3;           // the music stops and the tape holds its breath
const T_HIT = 4;            // the title lands (the drop)
const T_NEON = 6;           // the script starts to write
const T_NEON_END = 7.4;
const T_PAUSE = 12;         // the tape pauses on the next bar line
const DROPS = [2.5, 9.0];   // the tape repeats a few frames here, then skips to catch up (the first one tears too)
const TITLE = 'ALL OF THEM';
const SCRIPT = 'in code';
const OSD = '"VT323"';
const ROLL0 = 0.07, ROLL1 = 0.30;   // seconds: the old picture sits on the tape, then rolls out; locked at ROLL1
const S_HIT = 2 * T_HOLD + 0.5 * (2 - 1.75 * 0.75) + 0.25 * (T_HIT - T_HOLD - 0.5);   // rows of ground passed at the hit

/** Rows of ground passed by tape beat b: two a beat on the way in, almost none while the tape holds its breath, then
 *  a lurch and four a beat after the drop. */
function scrollAt(b) {
  if (b <= T_HOLD) return 2 * b;
  if (b < T_HIT) {
    const u = seg(b, T_HOLD, T_HOLD + 0.5);          // the speed falls from 2 rows a beat to a quarter of one
    return 2 * T_HOLD + 0.5 * (2 * u - 1.75 * (u - (1 - (1 - u) ** 4) / 4)) + 0.25 * Math.max(0, b - T_HOLD - 0.5);
  }
  return S_HIT + 4 * (b - T_HIT) + (1 - Math.exp(-(b - T_HIT) * 5));
}

/**
 * Word spaces set by the room a reader sees between two letters' outlines, not by the font's one space: L|O is an open
 * pair and F|T a tight one, so the same advance reads as two different gaps. Measure each gap on scan lines across
 * the capitals (deep notches count only so far) and move the later words until every word space measures the same.
 * Returns the width added.
 */
function evenWordSpaces(font, text, word, size, extra = 0) {
  const outline = (ch) => font.generateShapes(ch, size).map((s) => s.getPoints(10));
  const capH = Math.max(...outline('H').flat().map((p) => p.y));
  const ys = Array.from({ length: 16 }, (_, j) => capH * (0.05 + 0.9 * (j + 0.5) / 16));
  const scan = (ch) => {
    const polys = outline(ch), all = polys.flat();
    const cx = (Math.min(...all.map((p) => p.x)) + Math.max(...all.map((p) => p.x))) / 2;
    return ys.map((y) => {
      let lo = Infinity, hi = -Infinity;
      for (const P of polys) for (let i = 0; i < P.length; i++) {
        const a = P[i], b = P[(i + 1) % P.length];
        if ((a.y <= y) === (b.y <= y)) continue;
        const x = a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x) - cx;
        lo = Math.min(lo, x); hi = Math.max(hi, x);
      }
      return [lo, hi];
    });
  };
  const wordOf = [];
  let w = 0;
  for (const ch of text) { if (ch === ' ') w++; else wordOf.push(w); }
  const room = (i) => {                               // the gap between letter i and letter i + 1, as the eye takes it
    const A = scan(word.letters[i].ch), B = scan(word.letters[i + 1].ch);
    const g = ys.map((_, j) => (word.letters[i + 1].x + B[j][0]) - (word.letters[i].x + A[j][1])).filter(Number.isFinite);
    const least = Math.min(...g);
    return g.reduce((s, v) => s + Math.min(v, least + 0.3 * capH), 0) / g.length;
  };
  const joins = word.letters.map((_, i) => i).filter((i) => i + 1 < word.letters.length && wordOf[i + 1] !== wordOf[i]);
  const rooms = joins.map(room), target = Math.max(...rooms) + extra;
  let shift = 0;
  const shifts = word.letters.map(() => 0);
  joins.forEach((i, k) => { shift += target - rooms[k]; for (let j = i + 1; j < word.letters.length; j++) shifts[j] = shift; });
  word.letters.forEach((l, i) => { l.x += shifts[i] - shift / 2; l.mesh.position.x = l.x; });
  return { added: shift, rooms };
}

export default async function make(ctx) {
  const { W, H, fps, shot, font, makeCanvas, useGL, blitGL } = ctx;
  const HAND = (shot.enter && shot.enter.post) || 1.5;      // beats the hand-over lasts
  const [, , ttf] = await Promise.all([
    font('VT323', '/assets/fonts/VT323-Regular.ttf'),
    font('Mr Dafoe', '/assets/synth/MrDafoe-Regular.ttf'),
    // read the file with a plain fetch and hand the bytes to the parser (the loader's own streaming fetch is now and
    // then reported by the browser as an aborted request, though the font arrives)
    fetch('/assets/synth/RacingSansOne-Regular.ttf').then((r) => { if (!r.ok) throw new Error(`title font: HTTP ${r.status}`); return r.arrayBuffer(); }).then((buf) => new TTFLoader().parse(buf)),
  ]);
  await document.fonts.load(`88px ${OSD}`);
  await document.fonts.load('200px "Mr Dafoe"');

  // ---- the world ----------------------------------------------------------------------------------------------------
  const R0 = useGL();
  const post = new Post(R0, W, H);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(38, W / H, 0.1, 400);
  const sky = makeSky(), terrain = makeTerrain(W, H);
  // a pair of palms every 8 rows (one pair passes every two beats after the drop); the phase stands a pair about
  // 180 px in from each edge of the frame on the hit and again at beats 5.8, 7.8, 9.8 and 11.8
  const palms = makePalms(makeCanvas, { pairs: 9, spacing: 8, x: 8.5, height: 3.9, phase: 4.94 });
  scene.add(sky, terrain, palms.group);

  // the title: chrome that reflects a night sky over a hot horizon, black to violet to pink below it (the grid's own
  // colours, and no orange in it, so its lower edge stands off the sun)
  const chrome = chromeMaterial('chrome', { bend: 0.66, wave: 0.02, bendX: 0.03, softbox: 0.9 });
  const cu = chrome.uniforms;
  cu.uSky0.value.set('#0b0a6e'); cu.uSky1.value.set('#2f9bff'); cu.uSky2.value.set('#eafcff');
  cu.uGnd0.value.set('#06000d'); cu.uGnd1.value.set('#8a12a8'); cu.uGnd2.value.set('#ff70cc');
  cu.uTint.value.set('#f6f4ff'); cu.uSideA.value.set('#4a0a78'); cu.uSideB.value.set('#05000c');
  const keyline = new THREE.MeshBasicMaterial({ color: '#07001a' });
  const titleFont = new Font(ttf);
  const word = makeLetters(titleFont, TITLE, chrome, { size: 1.5, depth: 0.5, bevel: 0.055, tracking: 0.05, outline: 0.07, outlineMaterial: keyline });
  cu.uHalfH.value = word.height / 2;
  cu.uFrontZ.value = word.depth / 2 + word.bevel;
  cu.uBevel.value = word.bevel;
  const TITLE_Y = 3.02, TITLE_Z = -6;
  const fit = 10.2 / word.width;                     // the letters' size: the lockup as the font spaces it is 10.2 wide
  const spaced = evenWordSpaces(titleFont, TITLE, word, 1.5);
  const TITLE_W = (word.width + spaced.added) * fit;
  for (const l of word.letters) l.mesh.layers.enable(1);            // layer 1: the title alone, for its hold-out mask
  const lockup = new THREE.Group();
  lockup.add(word.group);
  lockup.scale.setScalar(fit);
  lockup.position.set(0, TITLE_Y, TITLE_Z);
  scene.add(lockup);
  const rnd = rng(1986);
  const seeds = word.letters.map(() => ({ x: (rnd() - 0.5) * 1.6, y: (rnd() - 0.5) * 1.2, rz: (rnd() - 0.5) * 0.7, ry: (rnd() - 0.5) * 1.2, rx: (rnd() - 0.5) * 1.0 }));
  const hw = TITLE_W / 2, hh = (word.height * fit) / 2;

  // The title holds out the glow. Bloom and the lens streak are added over the whole frame, so on the hit the sun and
  // the flare behind the word spread light over its faces and wash the middle letters to white. So the title is drawn
  // alone (layer 1) for every motion-blur sample and its coverage summed into maskAcc; after the chain's composite,
  // where the title is, its own tone-mapped picture (no bloom, no streak, no flash) goes back over the frame, inside a
  // thin dark edge. The glow stays all around the word; on the letters it does not land.
  const titleRT = new THREE.WebGLRenderTarget(W, H, { samples: 4, depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const maskAcc = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const maskAdd = new Pass(/* glsl */`
uniform sampler2D tSrc; uniform float uW; varying vec2 vUv;
void main() { gl_FragColor = vec4(vec3(texture2D(tSrc, vUv).a * uW), 1.0); }`,
  { tSrc: { value: titleRT.texture }, uW: { value: 1 } },
  { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
  const hold = new Pass(/* glsl */`
uniform sampler2D tHdr, tMask; uniform vec2 uTexel; uniform float uExposure, uSat, uAmt, uEdge;
varying vec2 vUv;
vec3 tonemap(vec3 x) { x = max(x, 0.0); return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  float m = clamp(texture2D(tMask, vUv).r, 0.0, 1.0), d = m;
  for (int i = 0; i < 16; i++) {                      // the edge: the coverage grown by about 3 px
    float a = float(i) * 0.3927;
    vec2 o = vec2(cos(a), sin(a)) * uTexel;
    d = max(d, texture2D(tMask, vUv + o * 1.6).r);
    d = max(d, texture2D(tMask, vUv + o * 3.3).r);
  }
  vec3 c = texture2D(tHdr, vUv).rgb * uExposure;
  c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, uSat);
  m *= uAmt;
  float e = max(0.0, min(d, 1.0) * uAmt - m) * uEdge;
  gl_FragColor = vec4(toSRGB(tonemap(c)) * m + vec3(0.016, 0.0, 0.045) * e, m + e);
}`,
  { tHdr: { value: post.accum.texture }, tMask: { value: maskAcc.texture }, uTexel: { value: new THREE.Vector2(1 / W, 1 / H) },
    uExposure: { value: 1 }, uSat: { value: 1 }, uAmt: { value: 0 }, uEdge: { value: 0.92 } },
  { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  let holdAmt = 0;
  // the chain's composite writes the tone-mapped frame (with its glow) into post.ldr; the hold goes over it there,
  // before the tape pass, so the letters still go to tape with everything else
  const compose = post.pComp.render.bind(post.pComp);
  post.pComp.render = (r, target) => {
    compose(r, target);
    if (holdAmt <= 0) return;
    const pc = post.pComp.uniforms, hu = hold.uniforms;
    hu.uExposure.value = pc.uExposure.value * pc.uFade.value; hu.uSat.value = pc.uSat.value; hu.uAmt.value = holdAmt;
    const auto = r.autoClear;
    r.autoClear = false; hold.render(r, target); r.autoClear = auto;
  };
  const clearMask = (R) => { R.setRenderTarget(maskAcc); R.setClearColor(0x000000, 0); R.clear(true, false, false); };
  /** Add the title's coverage at the current pose as one of K samples. */
  const addMask = (R, K) => {
    cam.layers.set(1);
    R.setRenderTarget(titleRT); R.setClearColor(0x000000, 0); R.clear();
    R.render(scene, cam);
    cam.layers.set(0);
    maskAdd.uniforms.uW.value = 1 / K;
    const auto = R.autoClear;
    R.autoClear = false; maskAdd.render(R, maskAcc); R.autoClear = auto;
  };

  // the light behind the title on the hit: it is behind the letters, so they cut it and stay readable
  const flare = makeGlint('#fff0d8');
  flare.material.depthTest = true;
  const glints = [0, 1, 2, 3].map(() => makeGlint('#eaf4ff'));
  scene.add(flare, ...glints);
  // where the star glints sit on the lockup (world units from its centre) and when each first fires (beats)
  const SPOTS = [[-hw + 0.25, hh * 0.9, 0.6, T_HIT + 0.12], [hw - 0.5, hh * 0.85, 0.6, T_HIT + 0.5], [-1.2, -hh * 0.8, 0.6, T_HIT + 1.1], [2.4, hh * 0.95, 0.6, T_HIT + 2.0]];

  // the neon script is lettered on a 2D canvas and laid over the scene inside the chain, so it glows and goes to tape
  const neon = makeCanvas(), ng = neon.getContext('2d');
  const neonTex = new THREE.CanvasTexture(neon);
  neonTex.colorSpace = THREE.NoColorSpace; neonTex.minFilter = THREE.LinearFilter; neonTex.magFilter = THREE.LinearFilter; neonTex.generateMipmaps = false;

  // the picture before this shot, for the hand-over
  const hand = new Pass(HAND_FRAG, { tOld: { value: null }, uSplit: { value: 1 }, uHasOld: { value: 0 }, uBar: { value: 0 }, uFrame: { value: 0 }, uSkew: { value: 0 } },
    { transparent: true, blending: THREE.NormalBlending });
  const oldTex = new Map();
  const texOf = (canvas) => {
    if (!oldTex.has(canvas)) {
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
      oldTex.set(canvas, t);
    }
    return oldTex.get(canvas);
  };

  /** The tape's own time: now and then it repeats a few frames, then skips ahead. Paused from the next bar line. */
  const tapeBeat = (lb) => {
    let b = Math.min(Math.max(lb, 0), T_PAUSE);
    for (const d of DROPS) if (b >= d && b < d + 0.17) b = d;
    return b;
  };
  const dropAmt = (lb) => { const d = DROPS[0]; return lb >= d - 0.02 && lb < d + 0.3 ? 1 - seg(lb, d + 0.17, d + 0.3) : 0; };

  const v3 = new THREE.Vector3();

  /** Set the whole world for tape beat b. The camera shake's jitter is read at bf, the frame's own beat: it jumps
   *  from frame to frame, never inside one frame's shutter (that would print the title twice). */
  function pose(b, spb, bf = b) {
    const hit = (b - T_HIT) * spb;                           // seconds since the title landed
    const N = word.letters.length;
    word.letters.forEach((l, i) => {
      // letters arrive from behind the camera, left to right, the last one exactly on the beat
      const t1 = T_HIT - (N - 1 - i) * 0.022;
      const p = tw(b, t1 - 0.42, t1, ease.inCubic);
      const s = seeds[i], m = l.mesh, a = (b - t1) * spb;
      const ring = a > 0 ? Math.exp(-a * 7.5) * Math.cos(a * 30) : 0;
      m.visible = b >= t1 - 0.42;
      m.position.set(l.x + s.x * (1 - p), s.y * (1 - p) + 0.012 * Math.sin(b * 0.9 + i * 0.7) * p, lerp(13.5 / fit, 0, p) + ring * 0.12);
      m.rotation.set(s.rx * (1 - p), s.ry * (1 - p) + 0.03 * Math.sin(b * 0.55 + i * 0.6) * p, s.rz * (1 - p));
      const sc = 1 + 0.2 * ring;
      m.scale.set(sc, sc, sc);
    });
    const squash = hit > 0 ? Math.exp(-hit * 8) * Math.sin(hit * 34) * 0.05 : 0;
    lockup.scale.set(fit * (1 + squash), fit * (1 - squash), fit);
    lockup.rotation.set(-0.05, 0.02 * Math.sin(b * 0.3), 0);

    // reflections drift, and a bar of light crosses the word after the hit and again through the hold
    cu.uEnvRot.value = 0.4 + b * 0.09;
    let sweep = -1;
    for (const t0 of [T_HIT + 0.3, T_HIT + 2.9, T_HIT + 4.8, T_HIT + 6.5]) { const v = seg(b, t0, t0 + 1.0); if (v > 0 && v < 1) sweep = v; }
    cu.uGlint.value = sweep >= 0 ? 0.42 * Math.sin(sweep * Math.PI) ** 0.5 : 0;
    cu.uGlintX.value = lerp(-hw - 2.5, hw + 2.5, ease.inOutCubic(Math.max(0, sweep)));

    // the beat before the drop: the tape holds its breath
    const breath = b >= T_HOLD && b < T_HIT ? smooth(seg(b, T_HOLD, T_HOLD + 0.3)) : 0;

    // camera: low and steady, a punch and a shake on the hit, then a slow push
    const shake = decay(hit, 0.1) * 0.085;
    const sway = 0.2 * Math.sin(b * 0.4 + 0.6);
    const push = ease.outCubic(seg(b, T_HIT, T_PAUSE));
    cam.fov = 38 + 3.5 * seg(b, T_HIT - 1, T_HIT - 0.05) * (b < T_HIT ? 1 : 0) - 2.6 * decay(hit, 0.16) - 0.6 * push;
    cam.position.set(sway + (noise1(bf * 61) - 0.5) * shake * 5, 1.05 + (noise1(bf * 67 + 9) - 0.5) * shake * 5, 5 - 0.55 * push);
    cam.lookAt(sway * 0.7, 1.05 + 0.0765 * 20, 5 - 20);
    cam.rotation.z += (noise1(bf * 53 + 3) - 0.5) * shake * 0.5;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    // the sky follows the camera's horizon; the sun climbs through the first bar and creeps after
    const su = sky.material.uniforms;
    v3.set(cam.position.x, cam.position.y, cam.position.z - 5000).project(cam);
    su.uHorizon.value = 0.5 + 0.5 * v3.y;
    v3.set(0, cam.position.y, -5000).project(cam);
    const rise = ease.outCubic(seg(b, 0.2, T_HIT + 0.2));
    su.uSun.value.set(0.5 + 0.5 * v3.x, su.uHorizon.value + lerp(-0.2, 0.135, rise) + 0.015 * seg(b, T_HIT, T_PAUSE));
    const scroll = scrollAt(b);
    su.uTime.value = scroll * 0.25;
    su.uStripe.value = scroll * 0.11;                   // the sun's bands slide with the ground
    // the beat lights the grid a little; the hit lights it more, but not so much that the title drowns in it
    const beatPulse = (b >= T_HOLD && b < T_HIT ? 0 : 1) * decay((b - Math.floor(b)) * spb, 0.09);
    const pulse = (b >= T_HIT ? 0.55 : 0.25) * beatPulse;
    su.uPulse.value = pulse + 0.45 * decay(hit, 0.22);
    su.uGain.value = 1 - 0.3 * breath;
    su.uSunGain.value = 1 - 0.2 * breath;

    // the ground rushes
    const tu = terrain.material.uniforms;
    tu.uScroll.value = scroll;
    tu.uPulse.value = pulse + 0.8 * decay(hit, 0.2);
    tu.uGain.value = 1 - 0.42 * breath;
    tu.uCam.value.copy(cam.position);
    tu.uRing.value = Math.max(0, b - T_HIT) * 26;
    tu.uRingAmt.value = b >= T_HIT ? 1.3 * decay(hit, 0.35) : 0;
    tu.uRingZ.value = TITLE_Z;
    palms.update(scroll, cam, { time: scroll * 0.5, gain: 1 - 0.42 * breath, rim: 3.2 + 3 * decay(hit, 0.25) });

    // no mirror of the title in the road: the road under it is a narrow strip between the hills, so the mirror could
    // only ever show pieces of letters, which read as a smear
    tu.uRefl.value.x = 0;

    // star glints on the lockup, and the flare where the word hits
    glints.forEach((g, i) => {
      const [x, y, z, t0] = SPOTS[i];
      const a = (b - t0) * spb;
      const again = Math.max(0, Math.sin((b - t0) * 0.9 + i * 1.7)) ** 6 * 0.5;
      const v = a < 0 ? 0 : Math.exp(-a * 3.0) * (0.65 + 0.35 * Math.sin(a * 11)) + again;
      g.position.set(lockup.position.x + x, TITLE_Y + y, TITLE_Z + z);
      g.scale.setScalar(0.4 + 0.5 * Math.min(1, v * 1.3));
      g.material.uniforms.uGain.value = v * 1.5;
      g.material.uniforms.uRot.value = a * 0.8 + i;
      g.visible = v > 0.01;
    });
    const fv = hit < 0 ? 0 : Math.exp(-hit * 3.6);
    flare.position.set(0.2, TITLE_Y + 0.05, TITLE_Z - 1.0);
    flare.scale.set(5 + 7 * fv, 2.6 + 3.2 * fv, 1);
    flare.material.uniforms.uGain.value = fv * 1.25;
    flare.material.uniforms.uRot.value = 0.12;
    flare.visible = fv > 0.01;
  }

  // ---- the neon script ----------------------------------------------------------------------------------------------
  // under the right half of the title, clear of it and well in from the right-hand palms
  const NEON = { cx: 1085, cy: 684, rot: -0.085, size: 232 };
  ng.font = `${NEON.size}px "Mr Dafoe"`;
  const neonW = ng.measureText(SCRIPT).width;

  /** Brightness of the tube: it stutters as it strikes, stutters once more when the word is complete, then hums. */
  function tube(b) {
    if (b < T_NEON) return 0;
    const f = Math.floor((b - T_NEON) * 16);                 // sixteenth-of-a-beat steps
    if (b < T_NEON + 0.5) return [1, 0.15, 1, 1, 0.3, 1, 1, 1][f] ?? 1;
    const e = Math.floor((b - T_NEON_END) * 16);
    if (b >= T_NEON_END + 0.25 && b < T_NEON_END + 0.75) return [0.25, 1, 1, 0.4, 1, 1, 0.2, 1][e - 4] ?? 1;
    return 0.96 + 0.04 * Math.sin(b * 37);
  }

  function drawNeon(b) {
    ng.setTransform(1, 0, 0, 1, 0, 0);
    ng.clearRect(0, 0, W, H);
    if (b < T_NEON) return false;
    const reveal = ease.inOutCubic(seg(b, T_NEON, T_NEON_END)), lum = tube(b);
    const pad = 60, x0 = -neonW / 2;
    ng.save();
    ng.translate(NEON.cx, NEON.cy);
    ng.rotate(NEON.rot);
    ng.font = `${NEON.size}px "Mr Dafoe"`;
    ng.textAlign = 'left'; ng.textBaseline = 'alphabetic'; ng.lineJoin = 'round';
    ng.beginPath();
    ng.rect(x0 - pad, -NEON.size * 1.2, (neonW + pad * 2) * reveal, NEON.size * 1.9);
    ng.clip();
    // a dark bed, so the tube separates from the sun and the title behind it
    ng.globalAlpha = 0.8;
    ng.shadowColor = 'rgba(6,0,18,1)'; ng.shadowBlur = 34;
    ng.strokeStyle = 'rgba(6,0,18,0.9)'; ng.lineWidth = 26;
    ng.strokeText(SCRIPT, x0, 0);
    // wide glow, tight glow, the tube, its hot core
    ng.globalAlpha = lum;
    ng.shadowColor = '#ff1fa8'; ng.shadowBlur = 46;
    ng.strokeStyle = '#ff1fa8'; ng.lineWidth = 9;
    ng.strokeText(SCRIPT, x0, 0);
    ng.shadowBlur = 9;
    ng.fillStyle = '#ff62cc';
    ng.fillText(SCRIPT, x0, 0);
    ng.shadowBlur = 0;
    ng.globalAlpha = lum * lum * 0.72;
    ng.fillStyle = '#ffe3f6';
    ng.fillText(SCRIPT, x0, 0);
    ng.restore();
    // the spark at the end of the tube while it writes
    if (reveal > 0 && reveal < 1) {
      ng.save();
      ng.translate(NEON.cx, NEON.cy);
      ng.rotate(NEON.rot);
      const sx = x0 - pad + (neonW + pad * 2) * reveal, sy = -NEON.size * 0.22;
      const gr = ng.createRadialGradient(sx, sy, 0, sx, sy, 70);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,140,220,0.8)'); gr.addColorStop(1, 'rgba(255,40,170,0)');
      ng.fillStyle = gr;
      ng.fillRect(sx - 70, sy - 70, 140, 140);
      ng.restore();
    }
    return true;
  }

  // ---- the on-screen display: blocky VCR lettering, drawn clean over the tape picture -------------------------------
  const layer = makeCanvas(), lg = layer.getContext('2d');
  const scan = makeCanvas(4, 20), sg = scan.getContext('2d');          // nine scan lines in twenty pixels, as the tape pass has
  for (let y = 0; y < 20; y++) { sg.fillStyle = `rgba(0,0,0,${0.34 * (0.5 + 0.5 * Math.cos((y / 20) * 9 * Math.PI * 2))})`; sg.fillRect(0, y, 4, 1); }
  const scanPat = lg.createPattern(scan, 'repeat');

  /** One run of OSD lettering: black edge, then red, green and blue a little apart, as a tube shows white. */
  function osd(str, x, y, size, o = {}) {
    const a = o.alpha ?? 1, split = o.split ?? 1.5;
    lg.save();
    lg.font = `${size}px ${OSD}`;
    lg.textBaseline = 'alphabetic';
    lg.textAlign = o.align || 'left';
    if (o.scale) { lg.translate(x, y - size * 0.25); lg.scale(o.scale, o.scale); lg.translate(-x, -(y - size * 0.25)); }
    lg.globalAlpha = 0.9 * a;
    lg.fillStyle = '#000';
    for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, -2], [-2, 2], [2, 2], [4, 4]]) lg.fillText(str, x + dx, y + dy);
    lg.globalCompositeOperation = 'lighter';
    lg.globalAlpha = a;
    const [r, gc, bl] = o.rgb || [255, 255, 255];
    lg.fillStyle = `rgb(${r},0,0)`; lg.fillText(str, x - split, y);
    lg.fillStyle = `rgb(0,${gc},0)`; lg.fillText(str, x, y);
    lg.fillStyle = `rgb(0,0,${bl})`; lg.fillText(str, x + split, y);
    lg.restore();
  }
  /** A solid OSD shape (a path the caller has set up as fn), edged and split the same way. */
  function osdShape(fn, o = {}) {
    const a = o.alpha ?? 1, split = o.split ?? 1.5;
    lg.save();
    lg.globalAlpha = 0.9 * a; lg.fillStyle = '#000';
    for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [4, 4]]) { lg.save(); lg.translate(dx, dy); fn(lg); lg.fill(); lg.restore(); }
    lg.globalCompositeOperation = 'lighter'; lg.globalAlpha = a;
    const cols = ['rgb(255,0,0)', 'rgb(0,255,0)', 'rgb(0,0,255)'];
    [-split, 0, split].forEach((dx, i) => { lg.save(); lg.translate(dx, 0); lg.fillStyle = cols[i]; fn(lg); lg.fill(); lg.restore(); });
    lg.restore();
  }
  const playTri = (x, y, s) => (c) => { c.beginPath(); c.moveTo(x, y - s * 0.52); c.lineTo(x + s * 0.5, y - s * 0.26); c.lineTo(x, y); c.closePath(); };
  const clearLayer = () => { lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalAlpha = 1; lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, W, H); };
  /** Put the layer on the frame: scan lines through it, a soft glow under it. */
  function flush(g) {
    lg.save();
    lg.globalCompositeOperation = 'destination-out';
    lg.fillStyle = scanPat;
    lg.fillRect(0, 0, W, H);
    lg.restore();
    g.save();
    g.globalCompositeOperation = 'screen';
    g.globalAlpha *= 0.5;
    g.filter = 'blur(7px)';
    g.drawImage(layer, 0, 0);
    g.restore();
    g.drawImage(layer, 0, 0);
  }

  const SIZE = 88;                                    // VT323 at this size fills the dock's 36 px cells; capitals 44 px
  const cellX = (i) => DOCK.x + i * DOCK.adv + DOCK.adv / 2;

  /** The terminal's two rows as OSD text. The prompt sign is the play triangle. The colours sit 1 px apart, no more:
   *  these rows are for reading. */
  const ROW_SPLIT = 1;
  function dock(g, env, part) {
    const m = env.term;
    clearLayer();
    if (part !== 'C' && m.last) {
      const l = m.last;
      lg.save();
      osdShape((c) => { c.beginPath(); c.rect(DOCK.x + 6, DOCK.rowB - 36, 24, 30); }, { rgb: [255, 255, 255], split: ROW_SPLIT });
      const k = Math.max(0, l.text.indexOf('('));
      for (let i = 0; i < (l.kind === 'say' ? l.chars : l.text.length); i++) {
        if (l.text[i] === ' ') continue;
        osd(l.text[i], cellX(2 + i), DOCK.rowB, SIZE, { align: 'center', alpha: i < k ? 1 : 0.9, split: ROW_SPLIT });
      }
      lg.restore();
    }
    if (part !== 'B') {
      const c = m.rowC, dim = c.mode === 'cmd' ? 0.86 : 1;
      osdShape(playTri(DOCK.x + 6, DOCK.rowC + 1, 78), { alpha: dim, split: ROW_SPLIT });
      for (let i = 0; i < c.n; i++) {
        if (c.text[i] === ' ') continue;
        const age = c.keyAge(i), pop = age < 0.14;
        osd(c.text[i], cellX(2 + i), DOCK.rowC, SIZE, { align: 'center', alpha: dim, split: ROW_SPLIT, scale: pop ? 1.16 : 0 });
      }
      if (c.cursor && m.blink) osdShape((cx) => { cx.beginPath(); cx.rect(DOCK.x + (2 + c.n) * DOCK.adv + 3, DOCK.rowC - 46, 30, 48); }, { split: ROW_SPLIT });
    }
    flush(g);
  }

  const clock2 = (t) => { const s = Math.floor(t); return `0:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

  /**
   * The deck's own display: the style tag on the first line (where every shot keeps its tag), PLAY and its triangle on
   * the second (the prompt's ">" flies up to become the triangle), the tape counter on the right. While the picture
   * before this one is still on the tape, nothing of this covers that picture's own tag or its counter.
   */
  function drawOsd(g, env) {
    const { lb } = env;
    clearLayer();
    const paused = lb >= T_PAUSE, taking = !!env.other && env.role === 'in', ts = lb * env.spb;
    const px = 168, py = 142, py2 = py + 78;
    if (paused) {
      osd('PAUSE', px, py2, 96);
      osdShape((c) => { c.beginPath(); c.rect(px + 218, py2 - 52, 16, 52); c.rect(px + 246, py2 - 52, 16, 52); });
    } else if (lb >= 0 && lb < T_HIT - 0.3) {
      // it blinks through the held breath and goes off just before the drop
      const on = lb < T_HOLD || Math.floor(lb * 8) % 2 === 0;
      if (on) {
        osd('PLAY', px, py2, 96);
        const fly = ease.outCubic(seg(lb, 0, 0.7));
        const tx = lerp(DOCK.x + 6, px + 178, fly), ty = lerp(DOCK.rowC + 1, py2 + 1, fly), ts2 = lerp(78, 96, fly);
        if (fly < 1) for (let e = 3; e >= 1; e--) {       // echoes on the way up
          const f2 = ease.outCubic(seg(lb - e * 0.045, 0, 0.7));
          osdShape(playTri(lerp(DOCK.x + 6, px + 178, f2), lerp(DOCK.rowC + 1, py2 + 1, f2), lerp(78, 96, f2)), { alpha: 0.22 });
        }
        osdShape(playTri(tx, ty, ts2), { split: fly < 1 ? 4 : 1.5 });
      }
    }
    // the counter comes up once the old picture's own counter has rolled out from under it; the tag once its tag has gone
    const counterIn = taking ? seg(ts, 0.12, 0.15) : 1;
    if (counterIn > 0) osd(`SP  ${clock2(env.t)}`, W - 168, py, 72, { align: 'right', alpha: 0.92 * counterIn });
    const tagIn = taking ? seg(ts, ROLL1 - 0.03, ROLL1 + 0.02) : 1;
    if (env.tag && tagIn > 0) osd(`${env.tag.num}/${env.tag.of} ${env.tag.name}`, px, py, 64, { alpha: 0.92 * tagIn });
    flush(g);
  }

  // The first picture drawn through a new chain comes out black (its targets and programs are still being set up), so
  // draw one before the film asks for any.
  for (let i = 0; i < 2; i++) {
    const R = useGL();
    pose(8, 0.5);
    post.begin();
    drawNeon(8); neonTex.needsUpdate = true;
    R.setRenderTarget(post.scene);
    R.render(scene, cam);
    post.add(1, neonTex, 1.9);
    holdAmt = 1; clearMask(R); addMask(R, 1);
    hand.uniforms.uBar.value = 0.03;
    R.autoClear = false; hand.render(R, post.accum); R.autoClear = true;
    post.finish(0, {});
    R.getContext().finish();
    await new Promise((r) => setTimeout(r, 30));
  }

  // ---- the frame ----------------------------------------------------------------------------------------------------
  return {
    dock,
    sfx: [
      { b: 0, s: 'tape_engage', g: 0.9 },
      { b: T_HIT - 0.16, s: 'whoosh_in', a: 'peak', g: 0.8 },   // the swell is cut just after its top, so it ends on the hit
      { b: T_HIT, s: 'chrome_slam', a: 'peak', g: 1.15 },
      { b: T_HIT + 0.35, s: 'glint', g: 0.6 },
      { b: T_NEON, s: 'neon_strike', g: 0.7 },
      { b: T_NEON_END + 0.3, s: 'neon_buzz', g: 0.5 },
      { b: T_PAUSE, s: 'tape_pause', g: 0.8 },
    ],
    render(g, env) {
      const { lb, spb } = env;
      const R = useGL();
      // the frame whose shutter takes in the hit is the hit frame: it shows the title landed, not half the flight and
      // half the slam doubled over each other
      const shutter = (0.5 / fps) / spb;                               // beats the shutter is open
      const tb = tapeBeat(lb);
      const snap = tb < T_HIT && tb + shutter / 2 > T_HIT;
      const b = snap ? T_HIT : tb;
      const ts = lb * spb;                                            // seconds into the shot
      // The hand-over. The old picture is put on the tape as it is and sits there for a few frames; then the tape
      // loses vertical hold once: the old picture rolls down and out, this one comes in from the top, and it locks.
      const hasOld = !!env.other && env.role === 'in' && ts < ROLL1 && lb < HAND;
      const sR = hasOld ? ease.inOutCubic(seg(ts, ROLL0, ROLL1)) : 1;
      const needWorld = sR > 0;

      post.begin();
      if (needWorld) {
        const near = Math.abs(lb - T_HIT) < 0.7 && lb < T_PAUSE;
        const K = lb >= T_PAUSE || b !== Math.min(Math.max(lb, 0), T_PAUSE) ? 1 : near ? (lb < T_HIT + 0.05 ? 28 : 10) : 4;
        const hasNeon = drawNeon(b);
        if (hasNeon) neonTex.needsUpdate = true;
        holdAmt = b >= T_HIT ? 1 : 0;
        if (holdAmt) clearMask(R);
        for (let k = 0; k < K; k++) {
          pose(K === 1 ? b : Math.max(snap ? T_HIT : 0, b + ((k + 0.5) / K - 0.5) * shutter), spb, b);
          R.setRenderTarget(post.scene);
          R.render(scene, cam);
          post.add(1 / K, hasNeon ? neonTex : null, 1.9);
          if (holdAmt) addMask(R, K);
        }
      } else holdAmt = 0;
      const bar = hasOld && sR > 0 ? 0.03 : 0;
      if (hasOld) {
        const u = hand.uniforms;
        u.uHasOld.value = 1;
        u.uSplit.value = sR;
        u.uBar.value = bar;
        u.uSkew.value = 0.03 * Math.exp(-ts * 16) * Math.cos(ts * 60);   // the top of the picture leans as the tape takes it
        u.uFrame.value = Math.round(env.t * 30);
        u.tOld.value = texOf(env.other); u.tOld.value.needsUpdate = true;
        R.autoClear = false;
        hand.render(R, post.accum);
        R.autoClear = true;
      }

      const hit = (b - T_HIT) * spb, paused = lb >= T_PAUSE;
      const taking = env.other && env.role === 'in' ? 1 : 0;
      const engage = 1 - smooth(seg(ts, 0, 0.75));                     // the tape settling after it takes the picture
      const breath = lb >= T_HOLD && lb < T_HIT ? smooth(seg(lb, T_HOLD, T_HOLD + 0.3)) : 0;
      // the roll, then one small bounce as the picture locks
      const lock = ts - ROLL1;
      const roll = hasOld ? sR : taking && lock < 0.25 ? -0.012 * Math.exp(-lock * 22) * Math.cos(lock * 46) : 0;
      const drop = dropAmt(lb);
      post.finish(env.t, {
        bloom: 0.2 + 0.06 * decay(hit, 0.2), streak: 0.1 + 0.3 * decay(hit, 0.25), thresh: 1.0, knee: 0.5,
        exposure: 1.0, flash: 0.03 * decay(hit, 0.04), flashColor: FLASH, sat: 1.06 - 0.22 * breath,
        vhs: 0.5 + 0.75 * engage + 0.3 * breath + 0.5 * decay(hit, 0.05) + 0.12 * drop + (paused ? 0.25 : 0),
        // no torn bands in the hand-over: the old picture has to stay readable
        glitch: Math.min(1, 0.05 * engage + 0.16 * drop + (paused ? 0.1 + 0.18 * decay((lb - T_PAUSE) * spb, 0.12) : 0)),
        scan: 0.11, noise: 0.42 + 0.45 * engage + 0.4 * breath + (paused ? 0.35 : 0), roll: ((roll % 1) + 1) % 1, vignette: 0.85,
      });
      blitGL(g, R);                                                   // an exact copy; drawImage of the GL canvas is not

      drawOsd(g, env);
      if (env.noDock) return;
      if (env.other && env.otherImpl && env.otherImpl.dock && env.role === 'in') swapDock(g, env, dock, seg(ts, 0.03, ROLL1));
      else dock(g, env);
    },
  };
}
