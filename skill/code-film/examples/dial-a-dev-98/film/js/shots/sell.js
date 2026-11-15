// The hard sell: "But wait, there's more!", the free-hours disc and the price, then the order card.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeLetters, chromeMaterial, makeBackdrop, makeGlint } from '../stage.js';
import { makeDisc, makeBox, discLabelCanvas } from '../product.js';
import { ease, tw, seg, spring, decay, clamp, lerp, rng, noise1, smooth, deg, TAU } from '../util.js';
import { superText, fills, burst, vgrad, arcText, FONT } from '../supers.js';

let envTex = null;
const studioEnv = (renderer) => (envTex ||= new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture);

/** Extruded word with its own chrome material, sheared into an italic. Returns { group, mat, w, h }. */
function word3d(font, str, look, size, o = {}) {
  const mat = chromeMaterial(look, { bend: o.bend ?? 0.6 });
  const L = makeLetters(font, str, mat, { size, depth: o.depth ?? size * 0.3, bevel: o.bevel ?? size * 0.032, tracking: o.tracking ?? 0.02 });
  mat.uniforms.uHalfH.value = L.height / 2;
  mat.uniforms.uFrontZ.value = L.depth / 2 + L.bevel;
  mat.uniforms.uBevel.value = L.bevel;
  const shear = new THREE.Group();
  shear.matrixAutoUpdate = false;
  shear.matrix.makeShear(0, 0, o.shear ?? 0.16, 0, 0, 0);
  shear.add(L.group);
  const group = new THREE.Group();
  group.add(shear);
  return { group, mat, w: L.width, h: L.height, letters: L.letters };
}

/** Slam: a word drops from the lens, hits and rings. Returns the hit time offset (negative before impact). */
function slam(obj, lt, t0, home, o = {}) {
  const fall = tw(lt, t0 - (o.lead ?? 0.16), t0, ease.inQuart);
  const hit = lt - t0;
  const sq = hit > 0 ? Math.exp(-hit * 8) * Math.sin(hit * 36) * (o.squash ?? 0.1) : 0;
  obj.visible = lt >= t0 - (o.lead ?? 0.16);
  obj.position.set(home.x, home.y, lerp(o.from ?? 12, home.z ?? 0, fall));
  obj.rotation.set(0, lerp(o.spin ?? -0.8, o.ry ?? 0, fall), lerp(o.roll ?? 0.3, o.rz ?? 0, fall));
  const s = o.scale ?? 1;
  obj.scale.set(s * (1 + sq), s * (1 - sq), s);
  return hit;
}

// ---------------------------------------------------------------------------------------------------------------
// Shot 8: BUT WAIT! THERE'S MORE!

export function makeWait(ctx) {
  const { fonts, shot, mark } = ctx;
  const S = shot.wait;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);
  const backdrop = makeBackdrop({ inner: '#b01206', outer: '#160002', rayColor: '#ff4a18', rays: 0.7, stars: 0.5 });
  scene.add(backdrop);
  const words = [
    { w: word3d(fonts.anton, 'BUT', 'gold', 2.1), t: mark('wait', 'But') - S.t0 + 0.04, home: null },
    { w: word3d(fonts.anton, 'WAIT!', 'gold', 2.1), t: mark('wait', 'wait') - S.t0 + 0.04, home: null },
    { w: word3d(fonts.anton, "THERE'S", 'chrome', 1.45), t: mark('wait', 'there') - S.t0 + 0.04, home: null },
    { w: word3d(fonts.anton, 'MORE!', 'chrome', 1.45), t: mark('wait', 'more') - S.t0 + 0.04, home: null },
  ];
  // two lines, centred
  const gap1 = 0.5, gap2 = 0.38;
  const w1 = words[0].w.w + gap1 + words[1].w.w, w2 = words[2].w.w + gap2 + words[3].w.w;
  const h1 = words[0].w.h, h2 = words[2].w.h, gapY = 0.5;
  words[0].home = new THREE.Vector3(-w1 / 2 + words[0].w.w / 2, gapY / 2 + h1 / 2, 0);
  words[1].home = new THREE.Vector3(w1 / 2 - words[1].w.w / 2, gapY / 2 + h1 / 2, 0);
  words[2].home = new THREE.Vector3(-w2 / 2 + words[2].w.w / 2, -(gapY / 2 + h2 / 2), 0.2);
  words[3].home = new THREE.Vector3(w2 / 2 - words[3].w.w / 2, -(gapY / 2 + h2 / 2), 0.2);
  const root = new THREE.Group();
  root.rotation.set(-0.12, 0.0, 0.035);
  root.scale.setScalar(Math.min(8.4 / Math.max(w1, w2), 4.5 / (h1 + h2 + gapY)));
  for (const w of words) root.add(w.w.group);
  scene.add(root);
  const glint = makeGlint('#fff6d0'); scene.add(glint);

  return {
    name: 'wait',
    sfx: [...words.map((w, i) => ({ t: w.t, s: i % 2 ? 'slam_big' : 'whoosh_hit', a: 'peak', g: i === 2 ? 0.8 : 1 })), { t: words[3].t + 0.2, s: 'audience', g: 0.6, len: 1.4 }],
    samples: () => 16,
    render(lt, post, r) {
      let shake = 0, last = -9;
      words.forEach((w, i) => {
        const hit = slam(w.w.group, lt, w.t, w.home, { spin: i % 2 ? 0.9 : -0.9, roll: i % 2 ? -0.3 : 0.3 });
        shake += decay(hit, 0.08);
        if (hit > 0) last = Math.max(last, w.t);
        w.w.mat.uniforms.uEnvRot.value = 0.6 + lt * 0.5 + i;
      });
      const bu = backdrop.material.uniforms;
      bu.uTime.value = lt * 5 + 2; bu.uRays.value = 0.4 + 0.45 * Math.min(1, shake); bu.uCenter.value.set(0.5, 0.5);
      cam.position.set((noise1(lt * 45) - 0.5) * shake * 0.5, (noise1(lt * 49 + 7) - 0.5) * shake * 0.5, lerp(11.6, 10.6, ease.outCubic(seg(lt, 0, S.dur))) - Math.min(1, shake) * 0.3);
      cam.lookAt(0, 0, 0);
      cam.rotation.z += (noise1(lt * 37 + 2) - 0.5) * shake * 0.05;
      const a = lt - last;
      glint.visible = a > 0 && a < 0.8;
      glint.position.set(2.6, 1.9, 1.2);
      glint.scale.setScalar(1 + 2 * Math.exp(-a * 5));
      glint.material.uniforms.uGain.value = Math.exp(-a * 5) * 3.5;
      glint.material.uniforms.uRot.value = 0.3 + a;
      r.setRenderTarget(post.scene);
      r.render(scene, cam);
    },
    look(lt) {
      let hit = 0;
      for (const w of words) hit += decay(lt - w.t, 0.05);
      return { bloom: 0.3 + 0.35 * Math.min(1, hit), streak: 0.2 + 0.4 * Math.min(1, hit), flash: 0.1 * Math.min(1.2, hit) + 0.15 * decay(lt, 0.04), exposure: 1 + 0.12 * Math.min(1, hit), flashColor: new THREE.Color(1, 0.9, 0.7), vhs: 1, glitch: 0.6 * decay(lt, 0.03), noise: 0.9, scan: 0.1 };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Shot 9: the offer. 500 free hours, then three easy payments of $19.95.

function freeHoursLabel() {
  const size = 1024, R = size / 2;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.translate(R, R);
  const base = g.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
  base.addColorStop(0, '#ffe600'); base.addColorStop(0.7, '#ffb000'); base.addColorStop(1, '#e85a00');
  g.fillStyle = base; g.fillRect(-R, -R, size, size);
  // sunburst
  g.fillStyle = 'rgba(255,255,255,0.28)';
  for (let i = 0; i < 18; i++) { g.save(); g.rotate((i / 18) * TAU); g.beginPath(); g.moveTo(0, 0); g.lineTo(R * 1.5, -R * 0.11); g.lineTo(R * 1.5, R * 0.11); g.closePath(); g.fill(); g.restore(); }
  arcText(g, '500 FREE HOURS', R * 0.655, -Math.PI / 2, { size: R * 0.3, fill: '#e8112d', stroke: '#ffffff', strokeW: R * 0.05, tracking: 5 });
  arcText(g, 'OF CONTEXT!', R * 0.66, Math.PI / 2, { size: R * 0.21, fill: '#0a1a6a', flip: true, tracking: 6 });
  return c;
}

export function makeOffer(ctx) {
  const { fonts, shot, mark, renderer } = ctx;
  const S = shot.offer;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 400);
  const backdrop = makeBackdrop({ rays: 0.4, stars: 1 });
  const colA = [new THREE.Color('#0a7f8a'), new THREE.Color('#01141c'), new THREE.Color('#3ff0d8')];
  const colB = [new THREE.Color('#1840d8'), new THREE.Color('#01051e'), new THREE.Color('#3f7dff')];
  scene.add(backdrop);
  scene.environment = studioEnv(renderer); scene.environmentIntensity = 0.6;
  const key = new THREE.DirectionalLight('#fff4e0', 2.8); key.position.set(2.5, 4, 6); scene.add(key);
  const rim = new THREE.DirectionalLight('#5a8cff', 2.2); rim.position.set(-4, 3, -3); scene.add(rim);

  // beat A, at the origin: the free-hours disc and a gold 500
  const disc = makeDisc(1);
  const tex = new THREE.CanvasTexture(freeHoursLabel()); tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 16;
  disc.material.uniforms.tLabel.value = tex;
  scene.add(disc);
  const n500 = word3d(fonts.anton, '500', 'gold', 2.5);
  const s500 = 3.5 / n500.w;
  scene.add(n500.group);

  // beat B, far to the right: the box and the price
  const BX = 60;
  const box = makeBox(); scene.add(box);
  const price = word3d(fonts.anton, '$19.95', 'gold', 2.3);
  const sPrice = 4.7 / price.w;
  scene.add(price.group);
  const extras = [3, 9].map((n) => { const d = makeDisc(n); scene.add(d); return d; });
  const glints = [0, 1, 2].map(() => { const g = makeGlint('#fff6d0'); scene.add(g); return g; });

  const t500 = mark('hours', 'five') - S.t0 + 0.05;
  const tFree = mark('hours', 'free') - S.t0;
  const tCtx = mark('hours', 'context') - S.t0;
  const tB = ctx.lines.price.at - S.t0 - 0.16;
  const tPay = mark('price', 'three') - S.t0;
  const tPrice = mark('price', 'nineteen') - S.t0 + 0.05;

  return {
    name: 'offer',
    sfx: [{ t: 0, s: 'whip' }, { t: t500, s: 'slam_big', a: 'peak' }, { t: tFree, s: 'pop' }, { t: tCtx, s: 'sparkle', g: 0.7 }, { t: tB - 0.16, s: 'whip' }, { t: tPay, s: 'pop' }, { t: tPrice, s: 'slam_big', a: 'peak', g: 1.1 }, { t: tPrice + 0.05, s: 'cash' }, { t: tPrice + 0.45, s: 'audience', g: 0.55 }],
    samples: (lt) => (Math.abs(lt - tB) < 0.3 || lt < 0.7 || Math.abs(lt - t500) < 0.3 || Math.abs(lt - tPrice) < 0.3 ? 20 : 4),
    render(lt, post, r) {
      // A: disc flies in from far away, label first, then turns its rainbow to the lens
      const din = tw(lt, 0, 0.6, ease.outCubic);
      const flip = tw(lt, tCtx - 0.1, tCtx + 0.5, ease.inOutCubic);
      const aside = tw(lt, t500 - 0.16, t500 + 0.22, ease.inOutCubic);      // the 500 shoves the disc over
      disc.position.set(lerp(lerp(-9, 0.3, din), -2.55, aside), lerp(3, 0.1, din) + 0.08 * Math.sin(lt * 1.7), lerp(-30, 0, din));
      disc.rotation.set(0.1 * Math.sin(lt * 1.3), Math.PI * (1 - flip) + lerp(5, 0.28, din) + 0.1 * Math.sin(lt * 0.9), lerp(8, 0, din) - lt * 0.5);
      disc.scale.setScalar(lerp(2.5, 2.05, aside));
      const u = disc.material.uniforms;
      u.uL.value[0].set(-4 + 3 * Math.sin(lt * 1.1), 4, 8); u.uL.value[1].set(4 - 3 * Math.sin(lt * 0.9 + 1), 2 + Math.cos(lt), 8); u.uL.value[2].set(Math.sin(lt * 1.4) * 2, 7, 3);
      u.uRainbow.value = 1.5;
      const h500 = slam(n500.group, lt, t500, new THREE.Vector3(2.3, 0.95, 0.4), { spin: 0.9, roll: -0.3, ry: -0.2, rz: -0.03, scale: s500 });
      n500.mat.uniforms.uEnvRot.value = 0.4 + lt * 0.3;

      // B: box spins in, price slams
      const bin = tw(lt, tB, tB + 0.6, ease.outBack);
      // the box holds the middle until the price needs the room
      box.position.set(lerp(BX - 0.9, BX - 3.2, tw(lt, tPay - 0.12, tPay + 0.36, ease.inOutCubic)), -1.75, 0);
      box.userData.glare.uniforms.uSweep.value = lerp(-0.7, 2.2, seg(lt, tB + 0.55, tB + 1.15));
      box.rotation.y = lerp(-2.4, 0.42, bin) + 0.08 * Math.sin(lt * 1.1);
      box.scale.setScalar(1.75 * lerp(0.6, 1, clamp(bin)));
      extras.forEach((d, i) => {
        const p = tw(lt, tB + 0.2 + i * 0.1, tB + 0.8 + i * 0.1, ease.outBack);
        d.position.set(BX - 4.9 + i * 0.7, lerp(-4, -1.55 + i * 0.5, p), -0.9 - i * 0.2);
        d.rotation.set(0.15 * Math.sin(lt * 1.2 + i), 0.5 - i * 0.2 + 0.1 * Math.sin(lt + i), lt * 0.4);
        d.scale.setScalar(1.05);
        const du = d.material.uniforms;
        du.uL.value[0].set(BX - 4 + 3 * Math.sin(lt), 4, 8); du.uL.value[1].set(BX + 2, 2, 8); du.uL.value[2].set(BX, 7, 3);
      });
      const hp = slam(price.group, lt, tPrice, new THREE.Vector3(BX + 1.85, -0.6, 0.4), { spin: -0.9, roll: 0.3, ry: -0.16, rz: 0.02, scale: sPrice });
      price.mat.uniforms.uEnvRot.value = 1.2 + lt * 0.3;
      const sw = seg(lt, tPrice + 0.2, tPrice + 0.8);
      price.mat.uniforms.uGlint.value = sw > 0 && sw < 1 ? 0.9 : 0;
      price.mat.uniforms.uGlintX.value = BX + lerp(-3, 6, ease.inOutCubic(sw));

      // camera: push on A, whip across to B, push on B
      const whip = tw(lt, tB - 0.16, tB + 0.14, ease.inOutCubic);
      const shake = decay(h500, 0.08) + decay(hp, 0.08);
      const pushA = ease.outCubic(seg(lt, 0, tB)), pushB = ease.outCubic(seg(lt, tB, S.dur));
      cam.position.set(lerp(0.25, BX, whip) + (noise1(lt * 45) - 0.5) * shake * 0.5, 0.1 + (noise1(lt * 49 + 3) - 0.5) * shake * 0.5, lerp(lerp(12.6, 11.4, pushA), lerp(12.4, 11.3, pushB), whip));
      cam.lookAt(lerp(0.0, BX, whip), 0, 0);
      const bu = backdrop.material.uniforms;
      bu.uTime.value = lt + 20; bu.uRays.value = 0.3 + 0.5 * Math.min(1, shake); bu.uCenter.value.set(0.5, 0.5);
      bu.uInner.value.lerpColors(colA[0], colB[0], whip); bu.uOuter.value.lerpColors(colA[1], colB[1], whip); bu.uRayColor.value.lerpColors(colA[2], colB[2], whip);

      const spots = [[2.9, 1.9, 1, t500 + 0.05, 0], [BX + 3.6, 0.6, 1, tPrice + 0.05, 0], [BX - 0.2, 0.55, 1, tPrice + 0.45, 0]];
      glints.forEach((gl, i) => {
        const [x, y, z, t0] = spots[i];
        const a = lt - t0;
        const v = a < 0 ? 0 : Math.exp(-a * 3.2) + 0.2 * Math.pow(Math.max(0, Math.sin(lt * 3 + i * 2)), 6);
        gl.position.set(x, y, z); gl.scale.setScalar(0.7 + 1.2 * Math.min(1, v));
        gl.material.uniforms.uGain.value = v * 2.8; gl.material.uniforms.uRot.value = a * 0.8 + i;
        gl.visible = v > 0.01;
      });
      r.setRenderTarget(post.scene);
      r.render(scene, cam);
    },
    overlay(g, lt) {
      const whip = tw(lt, tB - 0.16, tB + 0.14, ease.inOutCubic);
      const ax = -whip * 2600;                     // beat A's supers leave with the whip
      const bx = (1 - whip) * 2600;
      if (whip < 1) {
        const o = lt - 0.12;
        if (o > 0) {
          burst(g, 300 + ax, 190, { r: 172, points: 18, rot: -0.14 + 0.03 * Math.sin(lt * 6), scale: clamp(spring(o, 3.8, 0.42), 0, 1.5) });
          superText(g, 'ORDER', 300 + ax, 182, { font: FONT.impact, size: 84, fill: fills.yellow, rot: -0.14, strokeW: 9, shadow: 5, scale: clamp(spring(o, 3.8, 0.42), 0, 1.5) });
          superText(g, 'NOW!', 300 + ax, 258, { font: FONT.impact, size: 84, fill: fills.white, rot: -0.14, strokeW: 9, shadow: 5, scale: clamp(spring(o, 3.8, 0.42), 0, 1.5) });
        }
        const f = lt - tFree;
        if (f > 0) superText(g, 'FREE HOURS', 1330 + ax, 800, { font: FONT.impact, size: 150, fill: fills.yellow, strokeW: 15, shadow: 9, skew: 0.12, scale: lerp(1.8, 1, clamp(spring(f, 4.2, 0.45))), alpha: clamp(f / 0.05) });
        const c = lt - tCtx;
        if (c > 0) superText(g, 'OF CONTEXT!', 1330 + ax, 918, { font: FONT.black, size: 90, fill: fills.white, strokeW: 12, shadow: 7, skew: 0.14, scale: lerp(1.8, 1, clamp(spring(c, 4.2, 0.45))), alpha: clamp(c / 0.05) });
      }
      if (whip > 0) {
        superText(g, 'ALL FOR JUST', 1260 + bx, 210, { font: FONT.serif, weight: 700, italic: true, size: 96, fill: fills.white, strokeW: 10, shadow: 6 });
        const p = lt - tPay;
        if (p > 0) superText(g, '3 EASY PAYMENTS OF', 1260 + bx, 370, { font: FONT.impact, size: 124, fill: fills.yellow, strokeW: 13, shadow: 8, skew: 0.12, scale: lerp(1.8, 1, clamp(spring(p, 4.2, 0.45))), alpha: clamp(p / 0.05) });
      }
      return true;
    },
    look(lt) {
      const hit = decay(lt - t500, 0.06) + decay(lt - tPrice, 0.06);
      return { bloom: 0.26 + 0.4 * Math.min(1, hit), streak: 0.2 + 0.4 * Math.min(1, hit), thresh: 1.1, flash: 0.12 * decay(lt - t500, 0.06) + 0.5 * decay(lt - tPrice, 0.06) + 0.15 * decay(lt, 0.04), vhs: 1, glitch: 0.6 * decay(lt, 0.03), noise: 0.85, scan: 0.1 };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Shot 10: the order card. Box, logo, price, phone number, fine print. Ends on a composed hold.

const FINE = 'Requires 56K modem and a second phone line.   Allow 9 hours to install all 14 discs.   Do not pick up the phone while Dial-A-Dev is thinking.   Year 2000 ready.   Plus shipping and handling.   Void where prohibited.   ';

export function makeEnd(ctx) {
  const { fonts, shot, mark, renderer } = ctx;
  const S = shot.end;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);
  const backdrop = makeBackdrop({ rays: 0.35, stars: 1 });
  scene.add(backdrop);
  scene.environment = studioEnv(renderer); scene.environmentIntensity = 0.6;
  const key = new THREE.DirectionalLight('#fff4e0', 2.8); key.position.set(2.5, 4, 6); scene.add(key);
  const rim = new THREE.DirectionalLight('#5a8cff', 2.2); rim.position.set(-4, 3, -3); scene.add(rim);
  const box = makeBox(); scene.add(box);
  const discs = [2, 7, 12].map((n) => { const d = makeDisc(n); scene.add(d); return d; });
  const word = word3d(fonts.anton, 'DIAL-A-DEV', 'chrome', 1.0, { depth: 0.26 });
  const num = word3d(fonts.anton, '98', 'gold', 1.55, { depth: 0.4 });
  const lock = new THREE.Group();
  const total = word.w + 0.16 + num.w;
  word.group.position.set(-total / 2 + word.w / 2, 0, 0);
  num.group.position.set(total / 2 - num.w / 2, 0.14, 0.15);
  num.group.rotation.z = deg(-5);
  lock.add(word.group, num.group);
  const sLock = 5.5 / total;
  scene.add(lock);
  const glints = [0, 1].map(() => { const g = makeGlint('#eaf2ff'); scene.add(g); return g; });

  const tCall = mark('call', 'Call') - S.t0;
  const tLegal = ctx.lines.legal.at - S.t0;

  return {
    name: 'end',
    sfx: [{ t: 0, s: 'whip' }, { t: 0.55, s: 'sparkle', g: 0.6 }, { t: tCall, s: 'slam_big', a: 'peak', g: 0.9 }, { t: tCall + 0.2, s: 'phone_ring', g: 0.6 }],
    samples: (lt) => (lt < 0.9 || Math.abs(lt - tCall) < 0.3 ? 12 : 3),
    render(lt, post, r) {
      const bin = tw(lt, 0, 0.7, ease.outBack);
      box.position.set(-4.0, -2.15, 0);
      box.userData.glare.uniforms.uSweep.value = lerp(-0.7, 2.2, seg(lt, 0.75, 1.35));
      box.rotation.y = lerp(-2.6, 0.5, bin) + 0.1 * Math.sin(lt * 0.9);
      box.scale.setScalar(1.72 * lerp(0.6, 1, clamp(bin)));
      discs.forEach((d, i) => {
        const p = tw(lt, 0.25 + i * 0.1, 0.9 + i * 0.1, ease.outBack);
        d.position.set(-5.5 + i * 1.5, lerp(-6, 1.8 - Math.abs(i - 1) * 0.55, p), -1.0 - i * 0.15);
        d.rotation.set(0.14 * Math.sin(lt * 1.2 + i), (i - 1) * -0.3 + 0.12 * Math.sin(lt * 0.9 + i * 2), lt * 0.3 + i);
        d.scale.setScalar(0.95);
        const u = d.material.uniforms;
        u.uL.value[0].set(-8 + 3 * Math.sin(lt * 0.9), 4, 8); u.uL.value[1].set(0, 2 + Math.cos(lt), 8); u.uL.value[2].set(-4 + 2 * Math.sin(lt * 1.3), 7, 3);
        u.uRainbow.value = 1.5;
      });
      const lin = tw(lt, 0.1, 0.6, ease.outExpo);
      lock.position.set(2.3, lerp(6, 2.12, lin), 0);
      lock.rotation.set(-0.12, -0.12 + 0.05 * Math.sin(lt * 0.8), 0);
      lock.scale.setScalar(sLock);
      lock.visible = lt > 0.1;
      word.mat.uniforms.uEnvRot.value = 0.5 + lt * 0.25; num.mat.uniforms.uEnvRot.value = 1.2 + lt * 0.25;
      const sw = (lt % 2.6) / 0.7;
      word.mat.uniforms.uGlint.value = num.mat.uniforms.uGlint.value = sw < 1 ? 0.8 : 0;
      word.mat.uniforms.uGlintX.value = num.mat.uniforms.uGlintX.value = lerp(-1.5, 7, ease.inOutCubic(clamp(sw)));
      const hit = decay(lt - tCall, 0.08);
      cam.position.set(0.15 * Math.sin(lt * 0.5) + (noise1(lt * 45) - 0.5) * hit * 0.4, 0.05 + (noise1(lt * 49 + 3) - 0.5) * hit * 0.4, lerp(13.4, 13.0, ease.outCubic(seg(lt, 0, S.dur))));
      cam.lookAt(0, 0, 0);
      const bu = backdrop.material.uniforms;
      bu.uTime.value = lt + 30; bu.uRays.value = 0.28 + 0.4 * hit; bu.uCenter.value.set(0.32, 0.5);
      glints.forEach((gl, i) => {
        const v = 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(lt * 2.2 + i * 2.6)), 8);
        gl.position.set(i ? 5.2 : -0.5, i ? 3.0 : 2.75, 1); gl.scale.setScalar(0.5 + 0.6 * v);
        gl.material.uniforms.uGain.value = v * 2.0 * clamp(lin); gl.material.uniforms.uRot.value = lt * 0.6 + i;
        gl.visible = lt > 0.6;
      });
      r.setRenderTarget(post.scene);
      r.render(scene, cam);
    },
    overlay(g, lt) {
      const X = 1305;
      const p = lt - 0.55;
      if (p > 0) {
        superText(g, '3 EASY PAYMENTS OF $19.95', X, 470, { font: FONT.impact, size: 78, fill: fills.yellow, strokeW: 10, shadow: 6, skew: 0.12, scale: lerp(1.5, 1, clamp(spring(p, 4.2, 0.5))), alpha: clamp(p / 0.06), tracking: 2 });
      }
      const c = lt - tCall;
      if (c > 0) {
        const pulse = 1 + 0.045 * Math.sin(lt * 9);
        const s = lerp(2, 1, clamp(spring(c, 4.2, 0.45)));
        burst(g, 690, 560, { r: 150, points: 18, rot: -0.16 + 0.04 * Math.sin(lt * 6), scale: clamp(spring(c, 3.8, 0.42), 0, 1.5) * pulse });
        superText(g, 'CALL', 690, 553, { font: FONT.impact, size: 82, fill: fills.yellow, rot: -0.16, strokeW: 9, shadow: 5, scale: s * pulse });
        superText(g, 'NOW!', 690, 626, { font: FONT.impact, size: 82, fill: fills.white, rot: -0.16, strokeW: 9, shadow: 5, scale: s * pulse });
        superText(g, '1-800-555-0198', X - 10, 720, { font: FONT.impact, size: 164, fill: fills.white, strokeW: 17, shadow: 9, scale: s, alpha: clamp(c / 0.05), tracking: 3 });
        const blink = Math.floor(lt * 2.5) % 2 === 0 ? 1 : 0.35;
        superText(g, 'OPERATORS ARE STANDING BY', X - 10, 812, { font: FONT.black, size: 50, fill: fills.yellow, strokeW: 7, shadow: 4, alpha: clamp((c - 0.25) / 0.1) * blink, tracking: 3 });
      }
      // fine print crawl, fast, the way the lawyers liked it
      const l = lt - tLegal + 0.2;
      if (l > 0) {
        g.save();
        g.font = `400 28px ${FONT.sans}`; g.textBaseline = 'alphabetic';
        const w = g.measureText(FINE).width;
        g.fillStyle = 'rgba(0,0,20,0.8)'; g.fillRect(0, 900, 1920, 44);
        g.fillStyle = '#ffffff';
        const off = l * 620;
        for (let k = 0; k < 4; k++) g.fillText(FINE, 1920 - off + k * w, 932);
        g.restore();
      }
      return true;
    },
    look(lt) {
      const hit = decay(lt - tCall, 0.06);
      return { bloom: 0.26 + 0.35 * hit, streak: 0.2 + 0.35 * hit, thresh: 1.1, flash: 0.12 * hit + 0.15 * decay(lt, 0.04), exposure: 1 + 0.1 * hit, vhs: 1, glitch: 0.6 * decay(lt, 0.03), noise: 0.85, scan: 0.1 };
    },
  };
}
