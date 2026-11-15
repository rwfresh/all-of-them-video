// End: back in the real terminal. "Your turn.", then the credits as the terminal would print them: Read(CREDITS.md),
// the list of what the film was made with, and under it who made it, its letters passing through the styles' lettering
// as "all of them." did in the first seconds. Last, the first frame's suggested prompt types itself back in, so the
// film leads into its own beginning.
//
// The way in, from Variety Captions: its phone was playing this film. On the bar line the phone's film cuts to this
// terminal; the phone winds up, turns onto its side and grows, the picture staying upright as a phone's does, until
// its screen is the frame. So the loud world is left behind by the thing that was showing the film all along.

import { REAL, DOCK, drawWelcome, drawOut, drawPrompt, rule, monoText, elbow } from '../term.js';
import { ROWS, ghost, flick, flickFonts } from './open.js';
import { smooth, seg, lerp, ease } from '../util.js';

const T = { wind: 0.25, go: 0.5, land: 1.5, rest: 1.95, rate: 0.125 };   // local beats: winds up, turns and grows, lands, is still; the suggestion returns at the cue sheet's credits.again, a letter every `rate`
const LIST = 50;                 // the credit rows' type size (the terminal's own rows are 60)

export default async function make(ctx) {
  const { W, H } = ctx;
  const screen = ctx.makeCanvas(W, H), sg = screen.getContext('2d');
  const FIRST = ctx.script.shots.open.first.text;                // "make me a video.": what frame 0 suggests
  await flickFonts(ctx.font);

  // The credits, from the cue sheet. Every line prints on the reply row and pushes what is above it up the screen,
  // as a terminal does; the welcome box scrolls off the top.
  const C = ctx.shot.credits || { at: 99, step: 0.5, rows: [], sign: '', signAt: 99, again: 3 };
  const read = (ctx.shot.out || []).find((o) => o.kind === 'tool');
  const LINES = [
    // the pushes add up to a little more than the welcome box's bottom edge (640), so the box leaves the screen whole:
    // a box cut off by the top of the frame looked like a mistake on the last frame
    ...(read ? [{ at: read.at, push: 170, kind: 'tool' }] : []),
    ...C.rows.map((text, i) => ({ at: C.at + i * C.step, push: i ? 76 : 80, kind: 'row', text, first: i === 0 })),
    ...(C.sign ? [{ at: C.signAt, push: 170, kind: 'sign', text: C.sign }] : []),
  ];
  const pushed = (L, lb) => L.push * ease.outCubic(seg(lb, L.at, L.at + 0.3));
  const TX = DOCK.x + 2 * DOCK.adv;                              // where a line's text starts
  // all of them: one dot for each style, in its own colour, lit one by one beside the names
  const DOTS = ['#E9D7A5', '#E03C31', '#1E4FA3', '#B9A8F0', '#2B2BFF', '#FF5A4E', '#FF2E88', '#FF5A36', '#FFEC27', '#FF4FD8', '#00E5FF', '#D8352A', '#F58BB0', '#7B5CFF', '#FFD93B'];
  const DOT0 = C.signAt + 2.5, DOT_STEP = 0.166, DOT_X = 1404, DOT_PITCH = 26;

  function terminal(g, env) {
    const m = env.term, lb = env.lb;
    g.fillStyle = REAL.bg;
    g.fillRect(0, 0, W, H);
    // how far each thing has been pushed up: by every line printed after it
    const after = LINES.map((_, i) => LINES.slice(i + 1).reduce((a, L) => a + pushed(L, lb), 0));
    const all = LINES.reduce((a, L) => a + pushed(L, lb), 0);
    g.save(); g.translate(0, -all); drawWelcome(g); g.restore();
    const say = m.out.find((o) => o.kind === 'say');
    if (say) drawOut(g, say, DOCK.x, ROWS.reply - all, DOCK.size, REAL, env.ab);
    LINES.forEach((L, i) => {
      if (lb < L.at) return;
      const y = ROWS.reply - after[i], age = lb - L.at;
      if (L.kind === 'tool') { const o = m.out.find((x) => x.kind === 'tool'); if (o) drawOut(g, o, DOCK.x, y, DOCK.size, REAL, env.ab); }
      else if (L.kind === 'row') {
        if (L.first) elbow(g, TX, y, LIST, REAL.dim);
        monoText(g, L.text.slice(0, Math.floor(age / 0.012) + 1), DOCK.x + 5 * DOCK.adv, y, LIST, '#d2d0cb');
      } else {
        // who made it: each letter arrives in a borrowed style's lettering and settles into the terminal's own
        const n = Math.min(L.text.length, Math.floor(age / 0.0625) + 1);
        for (let k = 0; k < n; k++) {
          const ch = L.text[k], a = age - k * 0.0625, cx = TX + k * DOCK.adv;
          if (ch === ' ') continue;
          if (a < 0.75) flick(g, ch, cx, y, k, a); else monoText(g, ch, cx, y, DOCK.size, REAL.orange, true);
        }
        DOTS.forEach((col, k) => {
          const a = (lb - DOT0 - k * DOT_STEP) * env.spb;
          if (a < 0) return;
          const pop = a < 0.1 ? 1 + 0.5 * Math.sin(Math.PI * (a / 0.1)) : 1;      // a small pop as each one lights
          g.fillStyle = col;
          g.beginPath(); g.arc(DOT_X + k * DOT_PITCH, y - 19, 8 * Math.min(1, a / 0.04) * pop, 0, Math.PI * 2); g.fill();
        });
      }
    });
    rule(g, ROWS.rule1); rule(g, ROWS.rule2);
    // last, the first frame's suggestion types itself back into the empty prompt: the film leads into its beginning
    const n = Math.max(0, Math.min(FIRST.length, Math.floor((lb - C.again) / T.rate) + 1));
    if (lb >= C.again) ghost(g, FIRST, 0, n);
    drawPrompt(g, '', 0, m.blink, ROWS.input);
    if (m.blink && n > 0) monoText(g, FIRST[0], DOCK.x + 2 * DOCK.adv, ROWS.input, DOCK.size, REAL.bg);
    monoText(g, '? for shortcuts', DOCK.x, ROWS.hint, 30, REAL.faint);
  }

  return {
    render(g, env) {
      const v = env.otherImpl, lb = env.lb;
      const arriving = !!(env.other && env.role === 'in');
      if (!(arriving && v && v.layers && v.drawPhone && v.handoff && lb < T.rest)) {
        terminal(g, env);
        // a shot before this one that has no phone to hand over: its picture fades away over the terminal
        if (arriving && !(v && v.layers) ) { g.globalAlpha = 1 - smooth(env.x); g.drawImage(env.other, 0, 0); g.globalAlpha = 1; }
        return;
      }

      // this terminal, live, for the phone's screen
      sg.setTransform(1, 0, 0, 1, 0, 0);
      terminal(sg, env);

      // the loud world without its phone: its captions pop away by themselves
      g.save();
      v.layers(g, env.otherEnv, { phone: false });
      g.restore();

      const p0 = v.handoff(env.otherEnv).phone;                  // where the phone is held right now
      const u = seg(lb, T.go, T.land), e = ease.inOutCubic(u);
      const wind = smooth(seg(lb, T.wind, T.go)) * (1 - ease.outCubic(seg(lb, T.go, T.go + 0.3)));   // leans the wrong way first
      const k = 1 - smooth(seg(u, 0.5, 0.94));                    // the phone's edge and glass thin away as it fills the frame
      const bez = p0.bezel * k;
      const sw = lerp(p0.w - 2 * p0.bezel, H, e), sh = lerp(p0.h - 2 * p0.bezel, W, e);
      // lands a touch too big and settles to exactly the frame
      const over = lb < T.land - 0.2 ? 0 : 0.016 * Math.sin(Math.PI * seg(lb, T.land - 0.2, T.rest)) * (1 - seg(lb, T.land, T.rest));
      const P = {
        cx: lerp(p0.cx, W / 2, e), cy: lerp(p0.cy, H / 2, e) - 26 * wind,      // lifts as it winds up: clear of the reply row
        w: (sw + 2 * bez) * (1 + over), h: (sh + 2 * bez) * (1 + over),
        rot: lerp(p0.rot, -Math.PI / 2, e) + 0.07 * wind,
        r: lerp(p0.r, bez, e), k, sx: 1 + 0.04 * wind, sy: 1 - 0.05 * wind,
      };
      v.drawPhone(g, P, (gg, pw, ph) => {
        // the picture stays upright while the phone turns, and always covers the screen
        const c = Math.abs(Math.cos(P.rot)), s = Math.abs(Math.sin(P.rot));
        const z = Math.max((pw * c + ph * s) / W, (pw * s + ph * c) / H);
        // one last flick of the feed, like the ones in Variety's own shot: the still it was showing just before the
        // bar line scrolls up and away, and this terminal, live, follows it in
        const fl = v.screen ? 1 - ease.outQuart(seg(lb * env.spb, 0, 0.15)) : 0;
        if (fl > 0) {
          const o = env.otherEnv, was = { ...o, lb: o.beats - 0.02, lt: o.lt - (o.lb - (o.beats - 0.02)) * o.spb };
          const dy = (1 - fl) * (ph + 14);
          gg.save(); gg.translate(0, -dy); v.screen(gg, was, pw, ph); gg.restore();
          gg.fillStyle = '#0c0c0e'; gg.fillRect(-pw / 2, ph / 2 - dy, pw, 14);
          gg.beginPath(); gg.rect(-pw / 2, ph / 2 - dy + 14, pw, ph); gg.clip();
          gg.translate(0, fl * (ph + 14));
        }
        gg.rotate(-P.rot);
        gg.imageSmoothingEnabled = true; gg.imageSmoothingQuality = 'high';
        gg.drawImage(screen, (-W * z) / 2, (-H * z) / 2, W * z, H * z);
      });
      // Variety's rows stay in front of the phone, as they were in its own shot, until the phone starts to move
      // over them (otherwise the phone's lower edge eats the tops of "That part is yours.")
      const front = 1 - seg(lb, T.go, T.go + 0.22);
      if (front > 0 && v.dock) { g.save(); g.globalAlpha = front; v.dock(g, env.otherEnv); g.restore(); }
    },
    samples: (env) => (env.lb >= T.go && env.lb < T.land + 0.05 ? 10 : 1),
    sfx: [
      { b: T.go, s: 'end_turn', g: 0.6 },                         // a soft airy turn as the phone goes over
      { b: T.land, s: 'end_land', g: 0.7, a: 'peak' },            // it lands as the frame: one soft low thump
      // the room the terminal sits in: a quiet tone to the last frame, and one soft chord ringing out under "Your turn."
      { b: T.land - 0.5, s: 'room_tone', g: 0.22, a: 'start', len: 5.5, fadeIn: 0.6, fadeOut: 1.2 },
      { b: T.land, s: 'end_pad', g: 0.45, a: 'start', len: 4.4, fadeIn: 0.05, fadeOut: 2.4 },
      // the credits: a soft tick as each line prints, the chord again under the names, the room to the last frame
      ...LINES.filter((L) => L.kind !== 'sign').map((L) => ({ b: L.at, s: 'line_tick', g: 0.3, a: 'peak' })),
      ...LINES.filter((L) => L.kind === 'sign').flatMap((L) => [
        { b: L.at, s: 'end_pad', g: 0.5, a: 'start', len: 4.4, fadeIn: 0.05, fadeOut: 2.6 },
        { b: L.at + 0.25, s: 'iso_hero', g: 0.25, a: 'peak' },
      ]),
      { b: 8, s: 'room_tone', g: 0.22, a: 'start', len: 5.5, fadeIn: 1.2, fadeOut: 0.5 },
    ],
  };
}
