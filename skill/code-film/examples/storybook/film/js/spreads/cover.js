// The cover: the name of the game in cut paper. It is the first frame, so it is also the thumbnail.

import * as THREE from 'three';
import { PAL, LAYER as L, rr, poly, star, hole, stack, printed } from '../paper.js';
import { ease, tw, spring, clamp } from '../util.js';
import { cutText } from '../type.js';
import * as art from '../art.js';

export function build(env) {
  const { book, fonts, W, D } = env;
  const g = stack({ x: book.gap + (W + 0.1) / 2, y: 0 });
  env.pages.right.add(g);
  g.put(hole(rr(W - 0.22, D - 0.14, 0.12), rr(W - 0.34, D - 0.26, 0.08)), PAL.gold, { z: 0.006 });
  g.put(star(18, 1.2, 0.98, 0, 0.2, 0, 0.02), '#2f4a78', { z: 0.008 });
  const t1 = cutText(fonts.bookman, 'BUILDER', 1, PAL.cream, { wobble: 0.035, jitter: 0.02, seed: 5 });
  t1.scale.setScalar(2.5 / t1.userData.width); t1.position.set(0, 0.44, 0.03);
  const t2 = cutText(fonts.bookman, 'WARS', 1, PAL.gold, { wobble: 0.04, jitter: 0.02, seed: 9 });
  t2.scale.setScalar(2.3 / t2.userData.width); t2.position.set(0, -0.34, 0.03);
  g.add(t1, t2);
  g.put(poly([[-1.1, -0.92], [-1.25, -0.79], [-1.1, -0.66], [1.1, -0.66], [1.25, -0.79], [1.1, -0.92]], 0.01), '#b93a22', { z: 0.012 });
  g.add(printed(2.1, 0.3, (c, w, h) => {
    c.fillStyle = PAL.red; c.fillRect(0, 0, w, h);
    c.fillStyle = PAL.cream; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `italic ${h * 0.62}px "Schoolbook"`; c.fillText('A Very Simple Story', w / 2, h * 0.53);
  }, { x: 0, y: -0.79, z: 0.03, shape: rr(2.1, 0.3, 0.03) }));
  for (const [x, y, s, r] of [[-1.2, 0.98, 0.9, 0.2], [1.22, 0.96, 0.75, -0.3], [1.28, -0.2, 0.6, 0.5], [-1.3, -0.3, 0.65, -0.2]]) g.add(art.coin({ x, y, z: 0.02, s, rot: r }));

  // ---------------------------------------------------------------- the end card: the book shuts and the cover gets two things
  // a paper band with the address, slid across the lower cover
  const cx = book.gap + (W + 0.1) / 2;
  const band = stack({ x: cx, y: -0.84, z: 0.05 });
  band.put(rr(3.42, 0.56, 0.02), PAL.cream, { z: 0 });
  band.put(rr(3.42, 0.05, 0, 0, 0.215), PAL.red, { z: 0.004, core: false, cut: false });
  band.put(rr(3.42, 0.05, 0, 0, -0.215), PAL.red, { z: 0.004, core: false, cut: false });
  const url = cutText(fonts.bookman, 'builderwars.ai', 1, PAL.navy, { wobble: 0.012, seed: 21 });
  url.scale.setScalar(2.86 / url.userData.width); url.position.set(0, -0.105, 0.012);
  band.add(url);
  env.pages.right.add(band);
  // the coin robot, standing up from the top edge with the last word
  const hinge = new THREE.Group();
  hinge.position.set(cx + 0.72, 1.07, 0.02);
  const bot = art.coinBot({ x: 0, y: 0, z: 0, s: 0.56 });
  bot.userData.armL.rotation.z = -1.25; bot.userData.head.rotation.z = -0.09;
  const bubble = stack({ x: -1.16, y: 0.87, z: 0.02 });                 // large enough to read on a phone
  bubble.put(poly([[0.4, -0.17], [0.7, -0.35], [0.62, -0.12]], 0.01), PAL.white, { z: 0 });
  bubble.put(rr(1.64, 0.55, 0.24), PAL.white, { z: 0.004 });
  const say = cutText(fonts.school, 'It depends.', 1, PAL.ink, { seed: 4 });
  say.scale.setScalar(1.3 / say.userData.width); say.position.set(0, -0.085, 0.014);
  bubble.add(say);
  hinge.add(bot, bubble);
  env.pages.right.add(hinge);
  band.visible = hinge.visible = false;

  return {
    key: { pos: [1.7, 4.75, 4.45], target: [1.7, 0.1, 0.12], focus: [1.7, 0.1, 0.1], aperture: 0.035 },
    // the end card is the same cover seen from a little further back, so the robot fits above the book
    endKey: { pos: [1.7, 5.72, 5.1], target: [1.7, 0.42, -0.22], focus: [1.7, 0.2, 0.2], aperture: 0.03 },
    animate(T, { closeU, tClose }) {
      const q = Math.floor(T * 15 + 1e-4) / 15, t = q - tClose;
      band.visible = t > 0.72;
      band.position.x = cx + 4.2 * (1 - tw(t, 0.72, 1.14, ease.outBack));
      const up = clamp(spring(t - 1.75, 2.8, 0.48), 0, 1.2);
      hinge.visible = t > 1.75;
      hinge.rotation.x = (Math.PI / 2) * up;
    },
    // local times after the book starts to shut, for whoever places sounds: the band lands, the robot pops
    cues: { band: 0.95, robot: 1.8 },
  };
}
