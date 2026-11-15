// Open: the real Claude Code terminal, full frame. "make me a video." / "In what style?" / "all of them."
// As "all of them." is typed, each letter passes through other styles' lettering before it settles: the first hint
// of what is coming. Enter lands on the next bar line and the first style takes over.
//
// layers() draws chosen parts of this screen, so the shot that takes over can redraw them its own way.

import { REAL, DOCK, drawWelcome, drawOut, drawPrompt, rule, monoText, typed, cursorRect } from '../term.js';
import { ease, tw, lerp } from '../util.js';

/** Baselines of the real screen's rows. The reply and the input sit on the dock rows every later shot uses. */
export const ROWS = { cmd: 734, reply: DOCK.rowB, rule1: 896, input: DOCK.rowC, rule2: 1000, hint: 1046 };

/** The colour of a suggested prompt: dim, but readable on the thumbnail (frame 0). */
export const GHOST = '#77756f';

/**
 * A suggested prompt, dim, from letter n on. Frame 0 shows the whole of "make me a video." this way, so the first
 * frame (the thumbnail) says what the film is; the ending types the same suggestion back in, so the film loops.
 */
export function ghost(g, text, n = 0, upTo = text.length, y = ROWS.input) {
  if (upTo > n) monoText(g, text.slice(n, upTo), DOCK.x + (2 + n) * DOCK.adv, y, DOCK.size, GHOST);
}

/** A prompt already sent, as Claude Code shows it: on a grey band. */
export function historyCmd(g, text, y, band = 1, pal = REAL) {
  const adv = DOCK.adv, x = DOCK.x;
  g.save();
  g.globalAlpha *= band;
  g.fillStyle = pal.band;
  g.fillRect(x - 18, y - 60, (text.length + 2) * adv + 36, 84);
  g.restore();
  monoText(g, '>', x, y, DOCK.size, pal.dim);
  monoText(g, text, x + 2 * adv, y, DOCK.size, pal.fg);
}

// lettering borrowed from the styles to come: [font, colour, glow, vertical nudge]
const FLICK = [
  ['400 86px "VT323"', '#7CFC8A', 0, 0],
  ['400 62px "Abril Fatface"', '#E9D7A5', 0, 0],
  ['400 62px "Archivo Black"', '#E03C31', 0, 0],
  ['700 60px "JetBrains Mono"', '#00E5FF', 22, 0],
  ['400 72px "Anton"', '#FFC62B', 0, 2],
  ['italic 700 66px "Lib Serif"', '#FF4FD8', 26, 0],
];

/** The fonts the borrowed lettering needs. */
export const flickFonts = (font) => Promise.all([
  font('VT323', '/assets/fonts/VT323-Regular.ttf'),
  font('Abril Fatface', '/assets/collage/AbrilFatface-Regular.ttf'),
  font('Archivo Black', '/assets/fonts/ArchivoBlack-Regular.ttf'),
  font('Anton', '/assets/fonts/Anton-Regular.ttf'),
  font('Lib Serif', '/assets/fonts/LiberationSerif-BoldItalic.ttf', { weight: '700', style: 'italic' }),
]);

/** Letter i of a row in a borrowed style's lettering, centred in its cell (cx is the cell's left edge); `age` in beats picks the style. */
export function flick(g, ch, cx, y, i, age) {
  const [fnt, col, glow, dy] = FLICK[(i * 5 + Math.floor(age / 0.125)) % FLICK.length];
  g.save();
  g.font = fnt; g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  if (glow) { g.shadowColor = col; g.shadowBlur = glow; }
  g.fillText(ch, cx + DOCK.adv / 2, y + dy);
  g.restore();
}

export default async function make(ctx) {
  const { W, H, script, font } = ctx;
  await flickFonts(font);
  const F = script.shots.open.first;

  /** The prompt being typed, each fresh letter flickering through the styles for a beat. */
  function typedRow(g, c, blink) {
    const { x, adv, size } = DOCK, y = ROWS.input;
    monoText(g, '>', x, y, size, REAL.dim);
    for (let i = 0; i < c.n; i++) {
      const ch = c.text[i];
      if (ch === ' ') continue;
      const age = c.keyAge(i), cx = x + (2 + i) * adv;
      if (age >= 1) { monoText(g, ch, cx, y, size, REAL.fg); continue; }
      flick(g, ch, cx, y, i, age);
    }
    if (c.cursor && blink) {
      const r = cursorRect(x + (2 + c.n) * adv, y, size);
      g.fillStyle = REAL.fg;
      g.fillRect(r.x, r.y, r.w, r.h);
    }
  }

  /** This shot's two rows: the reply (B) and the input (C). */
  function dock(g, env, part) {
    const { ab } = env, m = env.term;
    if (part !== 'C' && m.last) drawOut(g, m.last, DOCK.x, ROWS.reply, DOCK.size, REAL, ab);
    if (part === 'B') return;
    const n1 = typed(F, ab);
    if (ab < F.enterAt) {
      const fresh = n1 > 0 && ab - F.keys[n1 - 1] < 0.75;
      ghost(g, F.text, n1);                       // the suggestion waiting in the input, as on a fresh session
      drawPrompt(g, F.text, n1, fresh || m.blink, ROWS.input);
      if ((fresh || m.blink) && n1 < F.text.length) monoText(g, F.text[n1], DOCK.x + (2 + n1) * DOCK.adv, ROWS.input, DOCK.size, REAL.bg);   // the letter under the block cursor
    } else if (m.rowC.mode === 'typing') typedRow(g, m.rowC, m.blink);
    else drawPrompt(g, '', 0, m.blink, ROWS.input);
  }

  function layers(g, env, on = {}) {
    const show = (k) => on[k] !== false;
    const { ab } = env, m = env.term;
    if (show('bg')) { g.fillStyle = REAL.bg; g.fillRect(0, 0, W, H); }
    drawWelcome(g, { border: show('border'), title: show('title'), inside: show('inside') });
    const n1 = typed(F, ab), sent = ab >= F.enterAt;
    if (sent && show('history')) {
      // Enter: the line jumps from the input up into the history
      const up = tw(ab, F.enterAt, F.enterAt + 0.3, ease.outCubic);
      historyCmd(g, F.text, lerp(ROWS.input, ROWS.cmd, up), up);
    }
    if (show('rules')) { rule(g, ROWS.rule1); rule(g, ROWS.rule2); }
    if (!env.noDock) {
      if (show('reply')) dock(g, env, 'B');
      if (show('input')) dock(g, env, 'C');
    }
    if (show('hint')) monoText(g, '? for shortcuts', DOCK.x, ROWS.hint, 30, REAL.faint);
  }

  return {
    layers,
    dock,
    render(g, env) { layers(g, env); },
    // the room the terminal sits in, as at the end of the film (so the loop's seam is not a jump into silence)
    sfx: [{ b: 0, s: 'room_tone', g: 0.22, a: 'start', len: 4.4, fadeOut: 1.2 }],
  };
}
