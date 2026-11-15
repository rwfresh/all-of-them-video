// Lettering cut from paper, one piece per letter, and the fonts it is cut from.

import * as THREE from 'three';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { paperMat } from './paper.js';
import { rng } from './util.js';

export async function loadFonts() {
  const l = new TTFLoader();
  const [bookman, school, anton] = await Promise.all([
    l.loadAsync('/assets/fonts/URWBookman-Demi.otf'),
    l.loadAsync('/assets/fonts/C059-Bold.otf'),
    l.loadAsync('/assets/fonts/Anton-Regular.ttf'),
  ]);
  return { bookman: new Font(bookman), school: new Font(school), anton: new Font(anton) };
}

/**
 * Cut-paper text. Returns a group whose children are the letters; userData.width is the set width.
 * o: align ('center' | 'left'), tracking (em), wobble (radians of random tilt), jitter (random lift in units), seed, z, clip.
 */
export function cutText(font, text, size, color, o = {}) {
  const g = new THREE.Group();
  const scale = size / font.data.resolution, r = rng(o.seed ?? 3);
  let x = 0;
  const letters = [];
  for (const ch of text) {
    const gl = font.data.glyphs[ch] || font.data.glyphs['?'];
    const adv = gl.ha * scale;
    if (ch !== ' ') {
      const geo = new THREE.ShapeGeometry(font.generateShapes(ch, size), 6);
      geo.computeBoundingBox();
      const bb = geo.boundingBox, cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2;
      geo.translate(-cx, -cy, 0);
      const m = new THREE.Mesh(geo, paperMat(color, o));
      m.position.set(x + cx, cy + (r() - 0.5) * (o.jitter ?? 0), (o.z ?? 0) + r() * 0.004);
      m.rotation.z = (r() - 0.5) * 2 * (o.wobble ?? 0);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m); letters.push(m);
    }
    x += adv + (o.tracking ?? 0) * size;
  }
  const width = x - (o.tracking ?? 0) * size;
  if ((o.align ?? 'center') === 'center') for (const m of letters) m.position.x -= width / 2;
  g.userData.width = width; g.userData.letters = letters;
  return g;
}

/**
 * A word or two cut from paper and fitted into a box: at most `w` wide and `h` tall (capital height), centred on
 * (0, 0) unless o.align is 'left' or 'right' (then it sits against that end of the box). Returns the group.
 * Use this for signs: cut letters cast their own small shadows, which printed type cannot.
 */
export function cutSign(font, text, w, h, color, o = {}) {
  const g = cutText(font, text, 1, color, { wobble: 0.012, seed: 7, ...o, align: 'center', z: 0 });
  // capital height of this face at size 1, measured from a flat-topped letter
  const probe = new THREE.ShapeGeometry(font.generateShapes('H', 1), 2); probe.computeBoundingBox();
  const cap = probe.boundingBox.max.y - probe.boundingBox.min.y; probe.dispose();
  const k = Math.min(w / g.userData.width, h / cap);
  g.scale.setScalar(k);
  const tw = g.userData.width * k;
  const x = o.align === 'left' ? -w / 2 + tw / 2 : o.align === 'right' ? w / 2 - tw / 2 : 0;
  g.position.set((o.x ?? 0) + x, (o.y ?? 0) - (cap * k) / 2, o.z ?? 0.012);
  g.userData.size = { width: tw, cap: cap * k };
  return g;
}
