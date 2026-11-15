// Shot 2, the title slam: the chrome logo flies in letter by letter, then the gold "98" hits the screen.

import * as THREE from 'three';
import { makeLetters, chromeMaterial, makeBackdrop, makeGlint } from '../stage.js';
import { ease, tw, seg, spring, decay, clamp, lerp, rng, noise1, deg } from '../util.js';
import { superText, fills, burst, FONT } from '../supers.js';

export function makeTitle(ctx) {
  const { fonts, shot, mark } = ctx;
  const S = shot.title;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);
  const backdrop = makeBackdrop({ rays: 0.55 });
  scene.add(backdrop);

  // lockup: DIAL-A-DEV in chrome, 98 in gold, both sheared into an italic
  const chrome = chromeMaterial('chrome', { bend: 0.62 });
  const keyline = new THREE.MeshBasicMaterial({ color: '#020a30' });
  const keylineGold = new THREE.MeshBasicMaterial({ color: '#2a0a00' });
  const word = makeLetters(fonts.anton, 'DIAL-A-DEV', chrome, { size: 1.5, depth: 0.4, bevel: 0.05, tracking: 0.05, outline: 0.05, outlineMaterial: keyline });
  chrome.uniforms.uHalfH.value = word.height / 2;
  chrome.uniforms.uFrontZ.value = word.depth / 2 + word.bevel;
  chrome.uniforms.uBevel.value = word.bevel;

  const gold = chromeMaterial('gold', { bend: 0.6 });
  const num = makeLetters(fonts.anton, '98', gold, { size: 2.35, depth: 0.7, bevel: 0.07, tracking: 0.04, outline: 0.06, outlineMaterial: keylineGold });
  gold.uniforms.uHalfH.value = num.height / 2;
  gold.uniforms.uFrontZ.value = num.depth / 2 + num.bevel;
  gold.uniforms.uBevel.value = num.bevel;

  const lockup = new THREE.Group();
  const shear = new THREE.Group();
  shear.matrixAutoUpdate = false;
  shear.matrix.makeShear(0, 0, 0.16, 0, 0, 0);
  const gap = 0.22;
  const total = word.width + gap + num.width;
  word.group.position.set(-total / 2 + word.width / 2, 0, 0);
  const numHome = new THREE.Vector3(total / 2 - num.width / 2, (num.height - word.height) / 2 - 0.12, 0.25);
  num.group.position.copy(numHome);
  shear.add(word.group, num.group);
  lockup.add(shear);
  const fit = 7.35 / total;
  lockup.scale.setScalar(fit);
  lockup.position.set(0, 0.42, 0);
  lockup.rotation.set(-0.1, 0.2, 0);
  scene.add(lockup);

  const glints = [0, 1, 2, 3].map(() => { const g = makeGlint('#eaf2ff'); scene.add(g); return g; });
  const flare = makeGlint('#fff2c8'); scene.add(flare);

  const rnd = rng(98);
  const seeds = word.letters.map(() => ({ y: (rnd() - 0.5) * 3, x: (rnd() - 0.5) * 2.5, rx: (rnd() - 0.5) * 3, ry: (rnd() - 0.5) * 2.4, rz: (rnd() - 0.5) * 1.2 }));

  // local hit times, tied to the words of the voice line
  const tWord = mark('intro', 'Dial') - S.t0 - 0.1;        // letters start landing just before "Dial-A-Dev"
  const tNum = mark('intro', 'ninety') - S.t0 + 0.05;           // the 98 lands on "ninety-eight"

  const tTag = mark('discs', 'The') - S.t0 - 0.04;         // the tagline lands with "the artificial intelligence..."
  const tNew = mark('discs', 'coding') - S.t0;              // and the NEW! burst with "coding agent"

  function pose(lt) {
    // letters: fly in from behind the camera, staggered, and settle with a little overshoot
    word.letters.forEach((l, i) => {
      const t0 = tWord + i * 0.04;
      const p = tw(lt, t0, t0 + 0.4, ease.outCubic);
      const s = seeds[i];
      const m = l.mesh;
      m.position.set(l.x + s.x * (1 - p), s.y * (1 - p), lerp(7.5, 0, p));
      const settle = spring(lt - (t0 + 0.2), 3.4, 0.38);
      m.rotation.set(s.rx * (1 - p), s.ry * (1 - p) + 0.05 * Math.sin(lt * 1.6 + i * 0.5) * p, s.rz * (1 - p));
      const sc = lt < t0 ? 0.0001 : lerp(1.35, 1, clamp(settle));
      m.scale.set(sc, sc * (l.ch === '-' ? 1.7 : 1), sc);      // a fatter hyphen, so its underside does not read as '='
      m.visible = lt >= t0;
    });

    // the 98: drops in huge from the camera, hits, squashes, rings out
    const fall = tw(lt, tNum - 0.2, tNum, ease.inQuart);
    const hit = lt - tNum;
    const squash = hit > 0 ? Math.exp(-hit * 7) * Math.sin(hit * 34) * 0.12 : 0;
    num.group.visible = lt >= tNum - 0.2;
    num.group.position.set(numHome.x, numHome.y, lerp(13, numHome.z, fall));
    num.group.rotation.set(0, lerp(-1.1, 0, fall) + 0.07 * Math.sin(lt * 1.4), lerp(0.5, deg(-5), fall));
    num.group.scale.set(1 + squash, 1 - squash, 1);

    // camera: slow push with a hit shake
    const shake = decay(hit, 0.09) * 0.07 + decay(lt - (tWord + 0.36), 0.07) * 0.02;
    const push = ease.outCubic(seg(lt, 0, S.dur));
    cam.position.set(
      0.25 * Math.sin(lt * 0.5) + (noise1(lt * 43) - 0.5) * shake * 6,
      0.18 + (noise1(lt * 47 + 9) - 0.5) * shake * 6,
      lerp(10.6, 9.75, push) - decay(hit, 0.12) * 0.25,
    );
    cam.lookAt(0, 0.22, 0);
    cam.rotation.z += (noise1(lt * 39 + 3) - 0.5) * shake * 0.6;

    // reflections drift; one glint bar sweeps the word after the hit
    const rot = 0.5 + lt * 0.22;
    chrome.uniforms.uEnvRot.value = rot; gold.uniforms.uEnvRot.value = rot + 0.7;
    // a glint crosses the logo after the hit, and again with the tagline and the NEW! burst, so it never sits dead
    let sweep = 0;
    for (const t0 of [tNum + 0.18, tTag + 0.3, tNew + 0.4]) { const v = seg(lt, t0, t0 + 0.6); if (v > 0 && v < 1) sweep = v; }
    chrome.uniforms.uGlint.value = gold.uniforms.uGlint.value = sweep > 0 && sweep < 1 ? 0.9 : 0;
    chrome.uniforms.uGlintX.value = gold.uniforms.uGlintX.value = lerp(-5.5, 5.5, ease.inOutCubic(sweep));

    // backdrop: rays spin up on the hit
    const bu = backdrop.material.uniforms;
    bu.uTime.value = lt + 3;
    bu.uRays.value = 0.22 + 0.2 * seg(lt, tWord, tWord + 0.5) + 0.45 * decay(hit, 0.35);
    bu.uGain.value = 0.75 + 0.25 * seg(lt, 0, 0.3);
    bu.uCenter.value.set(0.5, 0.56);

    // star glints on the corners of the lockup
    const spots = [[-3.45, 0.98, 0.5, tWord + 0.5], [1.05, 1.0, 0.5, tWord + 0.72], [3.42, 1.42, 0.7, tNum + 0.06], [2.3, -0.42, 0.7, tNum + 0.5]];
    glints.forEach((g, i) => {
      const [x, y, z, t0] = spots[i];
      const a = lt - t0;
      const v = a < 0 ? 0 : Math.exp(-a * 3.2) * (0.6 + 0.4 * Math.sin(a * 9)) + 0.12 * Math.max(0, Math.sin(lt * 3 + i * 2));
      g.position.set(x, y, z);
      g.scale.setScalar(0.5 + 0.7 * Math.min(1, v * 1.4));
      g.material.uniforms.uGain.value = v * 2.4;
      g.material.uniforms.uRot.value = a * 0.9 + i;
      g.visible = v > 0.01;
    });
    // impact flare where the 98 lands
    const fv = hit < 0 ? 0 : Math.exp(-hit * 5.5);
    flare.position.set(2.7, 0.75, 1.2);
    flare.scale.setScalar(1.2 + 2.6 * fv);
    flare.material.uniforms.uGain.value = fv * 4.5;
    flare.material.uniforms.uRot.value = 0.2;
    flare.visible = fv > 0.01;
  }

  return {
    name: 'title',
    sfx: [{ t: 0, s: 'whip', g: 0.8 }, { t: tWord + 0.38, s: 'whoosh_hit', a: 'peak' }, { t: tNum, s: 'slam_big', a: 'peak', g: 1.1 }, { t: tNum + 0.18, s: 'sparkle', g: 0.7 }, { t: tTag, s: 'pop', g: 0.8 }, { t: tNew, s: 'pop' }],
    samples: (lt) => (lt < tNum + 0.45 ? 24 : 4),
    render(lt, post, renderer) {
      pose(lt);
      renderer.setRenderTarget(post.scene);
      renderer.render(scene, cam);
    },
    overlay(g, lt) {
      // "Introducing" sweeps in first, in the serif italic every infomercial used
      // it owns the frame while the word is spoken, then steps aside for the logo
      const a = tw(lt, 0.04, 0.36, ease.outQuart);
      const k = tw(lt, tWord - 0.12, tWord + 0.3, ease.inOutCubic);
      if (a > 0) {
        superText(g, 'Introducing...', lerp(lerp(-700, 960, a), 560, k), lerp(600, 250, k), {
          font: FONT.serif, weight: 700, italic: true, size: lerp(210, 92, k), fill: fills.yellow, strokeW: lerp(16, 9, k), shadow: lerp(10, 6, k),
        });
      }
      // tagline pops under the logo after the 98 lands
      const b = lt - tTag;
      if (b > 0) {
        const s = lerp(1.6, 1, clamp(spring(b, 4.2, 0.45)));
        superText(g, 'THE A.I. CODING AGENT', 960, 868, {
          font: FONT.black, size: 84, fill: fills.white, strokeW: 11, shadow: 7, skew: 0.14, scale: s, tracking: 3,
          alpha: clamp(b / 0.06),
        });
      }
      // NEW! burst, top right, spinning in
      const c = lt - tNew;
      if (c > 0) {
        const s = clamp(spring(c, 3.6, 0.4), 0, 1.4);
        burst(g, 1650, 196, { r: 124, points: 16, rot: lerp(-1.2, -0.2, clamp(c / 0.35)) + 0.03 * Math.sin(lt * 5), scale: s });
        superText(g, 'NEW!', 1650, 226, { font: FONT.impact, size: 86, fill: fills.yellow, rot: -0.2, scale: s, strokeW: 9, shadow: 5 });
      }
      return a > 0;
    },
    look(lt) {
      const hit = lt - tNum;
      return {
        bloom: 0.22 + 0.5 * decay(hit, 0.2), streak: 0.1 + 0.45 * decay(hit, 0.25), exposure: 1.0,
        flash: 0.15 * decay(lt, 0.05) + 0.5 * decay(hit, 0.06),
        vhs: 1, glitch: 0.9 * decay(lt, 0.035), noise: 0.8, scan: 0.1,
      };
    },
  };
}
