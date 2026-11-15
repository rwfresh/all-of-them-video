// A starter shot: a studio backdrop, a chrome word that slams in on a spoken word, one super. Replace it.
// Times inside a shot are local (lt = seconds since the shot began) and come from the cue sheet, never from constants.

import * as THREE from 'three';
import { makeLetters, chromeMaterial, makeBackdrop } from '../stage.js';
import { ease, tw, seg, spring, decay, clamp, lerp, noise1 } from '../util.js';
import { superText, fills, FONT } from '../supers.js';

export function makeHello(ctx) {
  const { fonts, shot, mark } = ctx;
  const S = shot.hello;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);
  const backdrop = makeBackdrop({ rays: 0.4 });
  scene.add(backdrop);

  const mat = chromeMaterial('chrome');
  const keyline = new THREE.MeshBasicMaterial({ color: '#020a30' });
  const word = makeLetters(fonts.anton, 'YOUR FILM', mat, { size: 1.5, depth: 0.4, bevel: 0.05, tracking: 0.05, outline: 0.05, outlineMaterial: keyline });
  mat.uniforms.uHalfH.value = word.height / 2;
  mat.uniforms.uFrontZ.value = word.depth / 2 + word.bevel;
  mat.uniforms.uBevel.value = word.bevel;
  const root = new THREE.Group();
  root.add(word.group);
  root.scale.setScalar(7 / word.width);        // fit to a width: extruded text is larger than its nominal size
  root.rotation.set(-0.1, 0.15, 0);
  scene.add(root);

  const tHit = mark('one', 'film') - S.t0;      // the word lands as "film" is spoken
  const tSuper = mark('two', 'Every') - S.t0;

  return {
    name: 'hello',
    sfx: [{ t: tHit, s: 'slam', a: 'peak' }],   // 'peak': the sound's loudest moment lands on the cue
    samples: (lt) => (Math.abs(lt - tHit) < 0.4 ? 16 : 3),
    render(lt, post, renderer) {
      const fall = tw(lt, tHit - 0.2, tHit, ease.inQuart);
      const hit = lt - tHit;
      root.visible = lt >= tHit - 0.2;
      root.position.z = lerp(9, 0, fall);
      const shake = decay(hit, 0.08) * 0.06;
      cam.position.set((noise1(lt * 43) - 0.5) * shake * 6, (noise1(lt * 47 + 9) - 0.5) * shake * 6, lerp(10.6, 10, seg(lt, 0, S.dur)));
      cam.lookAt(0, 0, 0);
      mat.uniforms.uEnvRot.value = 0.5 + lt * 0.2;
      const bu = backdrop.material.uniforms;
      bu.uTime.value = lt; bu.uRays.value = 0.3 + 0.4 * decay(hit, 0.3);
      renderer.setRenderTarget(post.scene);
      renderer.render(scene, cam);
    },
    overlay(g, lt) {
      const b = lt - tSuper;
      if (b <= 0) return false;
      superText(g, 'EVERY FRAME IS A FUNCTION OF TIME', 960, 860, { font: FONT.black, size: 64, fill: fills.white, skew: 0.12, scale: lerp(1.5, 1, clamp(spring(b, 4, 0.45))), alpha: clamp(b / 0.05) });
      return true;
    },
    // vhs: 0 gives a clean picture; raise it toward 1 for the taped look
    look(lt) { return { bloom: 0.25, streak: 0.15, flash: 0.4 * decay(lt - tHit, 0.06), vhs: 0, noise: 0, scan: 0, vignette: 0.6 }; },
  };
}
