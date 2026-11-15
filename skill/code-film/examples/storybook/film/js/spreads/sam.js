// Spread 1: "This is Sam." A desk, a laptop, a plant. Three folds deep.

import { PAL, LAYER as L, rr, poly, piece } from '../paper.js';
import * as art from '../art.js';

export function build(env) {
  const wall = env.fold({ z: -0.98, beta: 66 });
  env.span(wall, (g, side, clip) => {
    g.put(rr(6.1, 2.3, [0.3, 0.3, 0, 0], 0, 1.15), PAL.mint, { z: 0 });
    g.put(rr(6.1, 0.13, 0, 0, 0.065), PAL.white, { z: L * 0.6 });
    if (side === 'L') g.add(art.windowPane({ clip, x: -1.6, y: 1.38, z: L }));
    if (side === 'R') {
      g.add(art.poster({ clip, x: 1.25, y: 1.45, z: L, rot: -0.04 }));
      g.add(art.shelf({ clip, x: 2.35, y: 1.05, z: L * 0.5 }));
    }
  });
  const seat = env.fold({ z: -0.3, beta: 82 });
  const sam = env.span(seat, (g, side, clip) => {
    g.put(rr(1.02, 1.25, [0.3, 0.3, 0.05, 0.05], 0, 0.72), PAL.plum, { z: 0 });       // chair back
    g.add(art.person({ clip, y: 0.5, z: L, s: 1.16, shirt: PAL.red, hair: PAL.umber, skin: PAL.tan }));
  });
  const front = env.fold({ z: 0.32, beta: 85 });
  env.span(front, (g, side, clip) => {
    g.add(art.desk({ clip, z: 0 }));
    g.add(art.laptop({ clip, x: 0, y: 0.665, z: L * 1.5, s: 0.92 }));
    if (side === 'L') {
      g.add(art.mug({ clip, x: -0.95, y: 0.665, z: L * 1.5 }));
      g.add(art.books({ clip, x: -1.42, y: 0.665, z: L * 1.2 }));
    } else g.add(art.plant({ clip, x: 1.3, y: 0.665, z: L * 1.5, s: 1.15 }));
  });
  // a rug on the page, in two halves
  const rug = (s) => poly([[0.035 * s, -0.95], [1.5 * s, -0.95], [1.9 * s, -0.62], [1.9 * s, -0.28], [1.5 * s, 0.05], [0.035 * s, 0.05]], [0, 0.3, 0.2, 0.2, 0.3, 0]);
  env.pages.right.add(piece(rug(1), '#f0c7a0', { z: 0.004, cast: false }));
  env.pages.left.add(piece(rug(-1), '#f0c7a0', { z: 0.004, cast: false }));
  return {
    key: { pos: [0, 6.3, 9.4], target: [0, 0.78, -0.1], focus: [0, 1.2, -0.25], aperture: 0.11 },
    sfx: [{ t: 0.82, s: 'paper_pop', g: 0.6 }],
    animate() {},
  };
}
