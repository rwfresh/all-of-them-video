// Loads every spread module on its own, so one broken spread leaves a blank page instead of a dead film.

export const NAMES = ['cover', 'sam', 'idea', 'promo', 'post', 'game', 'empire', 'kim', 'end'];
export const BUILDERS = {};

export async function loadSpreads() {
  await Promise.all(NAMES.map(async (name) => {
    try { BUILDERS[name] = (await import(`./${name}.js`)).build; }
    catch (e) { console.error(`[spread ${name}] failed to load: ${e.stack || e}`); }
  }));
  return BUILDERS;
}
