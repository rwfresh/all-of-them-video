// Director: loads the cue sheet, builds the shots and draws the frame for any time t.
// Every frame is a pure function of t, so the renderer can ask for frames in any order.

import * as THREE from 'three';
import { Post } from './post.js';
import { loadFonts } from './stage.js';
import { buildTimeline } from './timeline.js';
import { closedCaption } from './supers.js';
import * as film from './film.js';

const W = 1920, H = 1080, FPS = 30, SHUTTER = 0.55;
const params = new URLSearchParams(location.search);
const RS = +(params.get('rs') || 1);                 // render scale for quick previews
const MB = params.has('mb') ? +params.get('mb') : null;   // force a motion-blur sample count
const CLEAN = params.has('clean');                   // skip the tape pass, to judge the picture underneath
const NOCC = params.has('nocc');                     // hide the closed captions

const canvas = document.getElementById('film');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(Math.round(W * RS), Math.round(H * RS), false);
renderer.autoClear = true;

const overlay = document.createElement('canvas');
overlay.width = Math.round(W * RS); overlay.height = Math.round(H * RS);
const g = overlay.getContext('2d');
const overlayTex = new THREE.CanvasTexture(overlay);
overlayTex.colorSpace = THREE.NoColorSpace;
overlayTex.minFilter = THREE.LinearFilter; overlayTex.magFilter = THREE.LinearFilter; overlayTex.generateMipmaps = false;

/** Split each voice line into short pop-on captions, timed from word timings (recorded, or estimated by length). */
function buildCaptions(tl, cues) {
  const caps = [];
  for (const l of Object.values(tl.lines)) {
    if (l.cc === false) continue;
    const src = (typeof l.cc === 'string' ? l.cc : l.text).split(/\s+/);
    let words;
    if (l.words && typeof l.cc !== 'string' && l.words.length === src.length) words = l.words.map((w, i) => ({ w: src[i], t0: l.at + w.t0 }));
    else {
      let n = 0;
      const total = src.join(' ').length;
      words = src.map((w) => { const o = { w, t0: l.at + l.dur * (n / total) }; n += w.length + 1; return o; });
    }
    let cur = null;
    for (const w of words) {
      const full = cur && (cur.text + ' ' + w.w).length > 30;
      const pause = cur && /[,.!?]$/.test(cur.text) && cur.text.length > 12;
      if (!cur || full || pause) {
        if (cur) cur.t1 = w.t0 - 0.04;
        cur = { text: w.w, t0: w.t0 - 0.04, t1: l.end + 0.25, line: l.id };
        caps.push(cur);
      } else cur.text += ' ' + w.w;
    }
  }
  for (const c of cues.sounds || []) {
    const l = tl.lines[c.after];
    caps.push({ text: c.text, t0: l.end + (c.offset ?? 0.05), t1: l.end + (c.offset ?? 0.05) + c.dur, line: 'fx' });
  }
  return caps;
}

async function init() {
  const [cues, fonts] = await Promise.all([fetch(new URL('../cues.json', import.meta.url)).then((r) => r.json()), (film.loadFonts || loadFonts)()]);
  await Promise.all((film.FONTS || []).map((f) => document.fonts.load(f)));   // canvas text needs its fonts loaded first
  const tl = buildTimeline(cues);
  const caps = (film.buildCaptions || buildCaptions)(tl, cues);

  const post = new Post(renderer, Math.round(W * RS), Math.round(H * RS));
  const ctx = { fonts, tl, cues, shot: tl.shot, lines: tl.lines, mark: tl.mark, renderer, post, W, H, RS };
  const shots = tl.shots.map((s) => ({ ...s, impl: film.FACTORIES[s.name](ctx) }));
  const drawCaption = film.caption || ((c, text) => closedCaption(c, text, 1, { y: 1046, size: 78 }));

  window.FILM = {
    width: W, height: H, fps: FPS, duration: tl.duration,
    shots: tl.shots.map((s) => [s.name, +s.t0.toFixed(3), +s.t1.toFixed(3)]),
    lines: Object.values(tl.lines).map((l) => [l.id, +l.at.toFixed(3), +l.end.toFixed(3)]),
    // every sound cue, in absolute seconds, for the mix: the picture is the single source of hit times
    sfx: shots.flatMap((s) => (s.impl.sfx || []).map((c) => ({ ...c, t: +(s.t0 + c.t).toFixed(3), shot: s.name }))),
  };

  /** The film's own overlay plus closed captions: drawn over every shot. Returns true if anything was drawn. */
  function furniture(t, shot) {
    let drew = film.furniture ? film.furniture(g, t, shot) : false;
    if (!NOCC) {
      const c = caps.find((x) => t >= x.t0 && t < x.t1);
      if (c) { drawCaption(g, c.text, t - c.t0, c); drew = true; }
    }
    return drew;
  }

  window.renderAt = async (t) => {
    t = Math.min(Math.max(t, 0), tl.duration - 1e-4);
    const s = shots.find((x) => t >= x.t0 && t < x.t1) || shots[shots.length - 1];
    const lt = t - s.t0;
    const K = MB ?? s.impl.samples(lt);
    const shutter = s.impl.shutter ?? SHUTTER;      // 0 = no motion blur (stop motion): every pass draws the same instant
    post.begin();
    for (let i = 0; i < K; i++) {
      // sub-frame times spread across the open shutter, never reaching back before the cut
      const ts = Math.max(0, lt + ((i + 0.5) / K - 0.5) * (shutter / FPS));
      s.impl.render(ts, post, renderer, i, K);      // i of K: a shot may also move its lens and lights per pass
      g.setTransform(RS, 0, 0, RS, 0, 0);
      g.clearRect(0, 0, W, H);
      let drew = s.impl.overlay ? s.impl.overlay(g, ts) : false;
      drew = furniture(t, s.name) || drew;
      if (drew) overlayTex.needsUpdate = true;
      post.add(1 / K, drew ? overlayTex : null, 1);
    }
    const look = s.impl.look ? s.impl.look(lt) : {};
    post.finish(t, CLEAN ? { ...look, vhs: 0, glitch: 0, noise: 0, scan: 0, vignette: 0, grain: 0 } : look);
  };

  window.__ready = true;
}

init().catch((e) => { console.error(e.stack || String(e)); });
