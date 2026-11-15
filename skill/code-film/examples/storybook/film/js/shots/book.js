// Every paper shot is the same world at a different time: the shot only says which stretch of the story it covers.

import { getWorld } from '../world.js';

export const bookShot = (name) => (ctx) => {
  const world = getWorld(ctx), S = ctx.shot[name];
  return {
    name,
    shutter: 0,                         // stop motion: no motion blur; the passes go to focus, shadows and edges instead
    // every spread starts by turning its page; the first one opens the cover
    sfx: [...(name === 'cover' ? [{ t: 0.13, s: 'knock', g: 0.7, a: 'peak' }, { t: 0.35, s: 'knock', g: 0.9, a: 'peak' }] : [{ t: 0.1, s: name === 'sam' ? 'book_open' : 'page_turn', g: 1.0 }]), ...world.sfx(name)],
    samples: () => 32,
    render(lt, post, renderer, i, K) { world.render(S.t0 + lt, post, renderer, i, K); },
    overlay(g, lt) { return world.overlay(name, g, lt); },
    look(lt) { return { paper: true, bloom: 0.05, streak: 0, vignette: 0.5, grain: 0.024, exposure: 1.0, ...(world.look(name, lt) || {}) }; },
  };
};
