// Director. Loads the cue sheet, builds every shot and draws the frame for any time t.
// Every frame is a pure function of t, so the renderer can ask for frames in any order and on several browsers at once.
//
// Each shot paints the whole 1920x1080 frame onto its own canvas. Around a bar line where one shot hands over to the
// next, both are painted and the one that owns the change (cues: enter.owner) is given the other's picture to work with.
// See SHOTS.md for the contract a shot module follows.

import { buildClock } from './clock.js';
import { buildScript, termModel } from './term.js';
import { makePlaceholder } from './shots/_placeholder.js';
import { useGL, blitGL } from './gl.js';
import * as util from './util.js';

const W = 1920, H = 1080;
const params = new URLSearchParams(location.search);
const ONLY = params.has('solo');                               // no hand-overs: every shot alone, to judge its own picture
const MB = params.has('mb') ? +params.get('mb') : null;        // force a motion-blur sample count
const LOAD = params.has('shots') ? new Set(params.get('shots').split(',')) : null;   // build only these shots (the rest are placeholder cards): quicker, and one broken shot cannot slow the others
const SHUTTER = 0.5;

const out = document.getElementById('film');
const og = out.getContext('2d', { alpha: false });

const loadedFonts = new Map();
/** Load a font file once and make it usable in canvas text. font('Anton', '/assets/fonts/Anton-Regular.ttf', { weight: '400' }) */
async function font(family, url, desc = {}) {
  const key = family + '|' + url + '|' + JSON.stringify(desc);
  if (!loadedFonts.has(key)) {
    loadedFonts.set(key, (async () => { const f = new FontFace(family, `url("${url}")`, desc); await f.load(); document.fonts.add(f); return f; })());
  }
  return loadedFonts.get(key);
}

const loadedImages = new Map();
/** Load an image file once (returns an ImageBitmap). */
async function image(url) {
  if (!loadedImages.has(url)) loadedImages.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.blob(); }).then((b) => createImageBitmap(b)));
  return loadedImages.get(url);
}

function makeCanvas(w = W, h = H) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

async function init() {
  const cues = await (await fetch(new URL('../cues.json', import.meta.url))).json();
  const clock = buildClock(cues);
  const script = buildScript(cues, clock);
  await Promise.all([
    font('JetBrains Mono', '/assets/fonts/JetBrainsMono-Regular.ttf', { weight: '400' }),
    font('JetBrains Mono', '/assets/fonts/JetBrainsMono-Bold.ttf', { weight: '700' }),
  ]);

  // which shot modules exist (the harness lists the folder; any other server just gets placeholders for missing ones)
  let have = null;
  try { const r = await fetch('/__ls?dir=film/js/shots'); if (r.ok) have = new Set(await r.json()); } catch { /* not the harness */ }

  // how loud the music is at any moment, measured from the real track (tools/levels.mjs), for shots that move to it
  let levels = null;
  try { const r = await fetch(new URL('../data/levels.json', import.meta.url)); if (r.ok) levels = await r.json(); } catch { /* none yet */ }
  const music = {
    ready: !!levels,
    /** { rms, low, mid, high, bands[8] }, each 0 to 1, at film time t (seconds). Zeros until the music is measured. */
    at(t) {
      if (!levels) return { rms: 0, low: 0, mid: 0, high: 0, bands: [0, 0, 0, 0, 0, 0, 0, 0] };
      const f = Math.min(levels.n - 1, Math.max(0, t * levels.fps)), i = Math.floor(f), j = Math.min(levels.n - 1, i + 1), u = f - i;
      const v = (a) => a[i] + (a[j] - a[i]) * u;
      const bands = levels.bands.map(v);
      return { rms: v(levels.rms), low: (bands[0] + bands[1]) / 2, mid: (bands[3] + bands[4]) / 2, high: (bands[6] + bands[7]) / 2, bands };
    },
  };

  const base = { W, H, fps: clock.fps, cues, clock, script, font, image, makeCanvas, useGL, blitGL, util, music };
  const shots = [];
  for (const s of clock.shots) {
    const canvas = makeCanvas();
    const g = canvas.getContext('2d');
    const tag = s.num ? { num: String(s.num).padStart(2, '0'), of: '15', name: s.style } : null;
    const ctx = { ...base, shot: s, tag };
    let impl = null, error = null;
    // a numbered style lives in NN-name.js (shots/01-line.js ...), exactly the names the terminal prints in the film
    const file = s.num ? `${String(s.num).padStart(2, '0')}-${s.name}.js` : `${s.name}.js`;
    if ((!LOAD || LOAD.has(s.name)) && (!have || have.has(file))) {
      try { impl = await (await import(`./shots/${file}`)).default(ctx); }
      catch (e) { error = e; if (have) console.error(`[shot ${s.name}] failed to load: ${e.stack || e}`); }
    }
    if (!impl) impl = makePlaceholder(ctx, error && have ? String(error.message || error) : null);
    shots.push({ ...s, canvas, g, impl, tag, warned: false });
  }

  window.FILM = {
    width: W, height: H, fps: clock.fps, duration: clock.duration, bpm: clock.bpm, offset: clock.offset,
    shots: shots.map((s) => [s.name, +s.t0.toFixed(4), +s.t1.toFixed(4)]),
    lines: [],
    // every sound cue in absolute seconds: the picture is the single source of hit times
    sfx: [
      ...shots.flatMap((s) => (s.impl.sfx || []).map((c) => ({ ...c, t: +clock.time(s.b0 + c.b).toFixed(4), shot: s.name }))),
      // keystrokes: the click's loudest moment on the cue, levels varied a little like a real hand
      ...script.keys.map((k, i) => ({ t: +clock.time(k.b).toFixed(4), s: k.ch === '\n' ? 'enter' : k.ch === ' ' ? 'space' : `key${1 + (i * 7) % 4}`, a: 'peak', g: +(k.ch === '\n' ? 1.5 : 0.8 + 0.35 * util.hash(i * 3.1)).toFixed(2), key: true })),
    ].sort((a, b) => a.t - b.t),
  };

  const envFor = (s, t, trans) => {
    const ab = clock.beat(t);
    return {
      t, lt: t - s.t0, ab, lb: ab - s.b0, beats: s.beats, dur: s.dur, spb: clock.spb, bpm: clock.bpm, W, H, fps: clock.fps,
      frame: Math.round(t * clock.fps), term: termModel(script, s.name, ab), tag: s.tag,
      other: null, otherImpl: null, otherEnv: null, x: null, role: null, noDock: false, ...trans,
    };
  };

  function paint(s, env) {
    const g = s.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; g.shadowBlur = 0; g.shadowColor = 'transparent';
    g.clearRect(0, 0, W, H);
    g.save();
    try { s.impl.render(g, env); }
    catch (e) {
      if (!s.warned) { console.error(`[shot ${s.name}] render failed at ${env.t.toFixed(3)} s: ${e.stack || e}`); s.warned = true; }
      g.restore(); g.save();
      g.fillStyle = '#300'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff'; g.font = '40px monospace'; g.fillText(`${s.name}: ${String(e.message || e).slice(0, 80)}`, 80, 120);
    }
    g.restore();
  }

  /** For a shot that enters with "freeze": the shot before it, stopped dead on its last frame (painted once, then kept). */
  function frozenFor(B) {
    if (!B.frozen) {
      const A = shots[shots.indexOf(B) - 1];
      const env = envFor(A, clock.time(B.b0) - 0.5 / clock.fps, { x: 0, role: 'under', noDock: !!(B.impl.dock && A.impl.dock) });
      paint(A, env);
      const c = makeCanvas();
      c.getContext('2d').drawImage(A.canvas, 0, 0);
      B.frozen = { canvas: c, env };
    }
    return B.frozen;
  }

  /** Paint the frame for time t and return the canvas that holds it. */
  function compose(t) {
    const ab = clock.beat(t);
    let i = shots.findIndex((s) => t >= s.t0 && t < s.t1);
    if (i < 0) i = t < shots[0].t0 ? 0 : shots.length - 1;
    const cur = shots[i], nxt = shots[i + 1], prv = shots[i - 1];
    let pair = null;
    if (!ONLY) {
      if (nxt && nxt.enter && ab >= nxt.b0 - (nxt.enter.pre || 0)) pair = [cur, nxt];
      else if (prv && cur.enter && ab < cur.b0 + (cur.enter.post || 0)) pair = [prv, cur];
    }
    if (pair) {
      const [A, B] = pair, en = B.enter;
      const w0 = B.b0 - (en.pre || 0), w1 = B.b0 + (en.post || 0);
      const x = (ab - w0) / (w1 - w0);
      const owner = en.owner === 'out' ? A : B, under = owner === A ? B : A;
      // when both shots can draw their prompt rows on request, the owner stages the rows' hand-over (term.js swapDock)
      const noDock = !!(owner.impl.dock && under.impl.dock);
      let underEnv, underCanvas = under.canvas;
      if (en.freeze && owner === B) {
        // enter.freeze: the outgoing shot stops dead on its last frame
        const fz = frozenFor(B);
        underEnv = fz.env; underCanvas = fz.canvas;
      } else {
        // a shot that lives on a frozen frame keeps it while the next shot takes over from it
        const fz = under.enter && under.enter.freeze && under.enter.owner !== 'out' ? frozenFor(under) : null;
        underEnv = envFor(under, t, { x, role: 'under', noDock, ...(fz ? { other: fz.canvas } : {}) });
        paint(under, underEnv);
      }
      paint(owner, envFor(owner, t, { x, role: en.owner === 'out' ? 'out' : 'in', other: underCanvas, otherImpl: under.impl, otherEnv: underEnv }));
      return { canvas: owner.canvas, shot: owner };
    }
    paint(cur, envFor(cur, t, {}));
    return { canvas: cur.canvas, shot: cur };
  }

  const acc = makeCanvas(), ag = acc.getContext('2d', { alpha: false });

  window.renderAt = async (t) => {
    t = Math.min(Math.max(t, 0), clock.duration - 1e-6);
    const first = compose(t);
    const K = MB ?? (first.shot.impl.samples ? first.shot.impl.samples(envFor(first.shot, t, {})) : 1);
    og.globalAlpha = 1;
    if (K <= 1) { og.drawImage(first.canvas, 0, 0); return; }
    // motion blur: average K instants across the open shutter
    for (let k = 0; k < K; k++) {
      const ts = Math.max(0, t + ((k + 0.5) / K - 0.5) * (SHUTTER / clock.fps));
      ag.globalAlpha = 1 / (k + 1);
      ag.drawImage(compose(ts).canvas, 0, 0);
    }
    og.drawImage(acc, 0, 0);
  };

  window.__ready = true;
}

init().catch((e) => { console.error(e.stack || String(e)); });
