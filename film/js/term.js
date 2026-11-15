// The terminal that runs through the whole film: one scripted Claude Code session, read from the cue sheet.
//
// buildScript() turns the cue sheet into keystroke times (in beats, so typing is part of the rhythm).
// termModel() answers, for one shot at one moment: what is on the two rows every skin shows.
//   row B  the latest thing Claude printed (a tool call, its result, a sentence)
//   row C  the prompt: the command that started this shot, then the next one as it is typed
// Every skin draws those two rows on the same grid (DOCK), so the words stay put while their look changes.
// The drawing functions below are the real Claude Code look, used by the opening, the ending and unbuilt shots.

export const MONO = '"JetBrains Mono"';

/** Where the two rows sit in every shot. x is the column of the ">" sign; the text starts two columns in. */
export const DOCK = { x: 168, size: 60, adv: 36, rowB: 850, rowC: 960, cols: 44, left: 132, right: 1788 };

/** The real terminal's colours. */
export const REAL = {
  bg: '#0c0c0e', fg: '#ecebe8', dim: '#8d8b87', faint: '#55534f', orange: '#D97757', green: '#5fc27a',
  band: '#2b2b30', rule: '#6b6965',
};

/** Beats of each keystroke relative to the first: letters run at `rate`, a space takes `space`, a full stop breathes. */
function keyTimes(text, p) {
  const rel = [0];
  for (let i = 0; i < text.length - 1; i++) {
    let d = text[i] === ' ' ? p.space : p.rate;
    if (/[.,?!]/.test(text[i]) && text[i + 1] === ' ') d += p.pause ?? p.space;
    rel.push(rel[i] + d);
  }
  return rel;
}

export function buildScript(cues, clock) {
  const T = { rate: 0.125, space: 0.25, lead: 0.5, clear: 1, ...(cues.typing || {}) };
  const shots = {};
  const keys = [];
  clock.shots.forEach((s, i) => {
    const next = clock.shots[i + 1];
    const S = { name: s.name, b0: s.b0, b1: s.b1, beats: s.beats, prompt: s.prompt || null, out: s.out || [], next: null, own: null, first: null, clear: T.clear };
    if (next && next.prompt) {
      const p = { ...T, ...(next.type || {}) };
      const rel = keyTimes(next.prompt, p);
      const start = next.b0 - p.lead - rel[rel.length - 1];
      S.next = { text: next.prompt, keys: rel.map((r) => start + r), enterAt: next.b0 };
    }
    if (s.first) {
      const rel = keyTimes(s.first.text, { ...T, ...s.first });
      S.first = { text: s.first.text, keys: rel.map((r) => s.b0 + s.first.start + r), enterAt: s.b0 + s.first.enter };
    }
    shots[s.name] = S;
  });
  clock.shots.forEach((s, i) => { if (i > 0) shots[s.name].own = shots[clock.shots[i - 1].name].next; });
  for (const S of Object.values(shots)) {
    for (const blk of [S.first, S.next]) {
      if (!blk) continue;
      blk.keys.forEach((b, k) => keys.push({ b, ch: blk.text[k] }));
      keys.push({ b: blk.enterAt, ch: '\n' });
    }
  }
  keys.sort((a, b) => a.b - b.b);
  return { shots, keys, T };
}

/** How many characters of a typing block have been typed by absolute beat ab. */
export const typed = (blk, ab) => { let n = 0; while (n < blk.keys.length && blk.keys[n] <= ab + 1e-9) n++; return n; };

/**
 * What the terminal shows in shot `name` at absolute beat `ab`.
 *   out     every line printed so far in this shot: { kind: say|tool|result|spin, text, at, age (beats), chars (revealed) }
 *   last    the newest of them, or null (row B)
 *   rowC    { mode: cmd|typing|idle, text, n (characters showing), cursor (draw it?), keyAge(i) (beats since letter i was typed) }
 *   typing  the next prompt: { text, n, start, end, enterAt (local beats), age (beats since the last key), entered }
 *   blink   true while the cursor is in the lit half of its blink (it blinks on the beat; it stays lit while typing)
 */
export function termModel(script, name, ab) {
  const S = script.shots[name];
  const lb = ab - S.b0;
  const out = [];
  for (const o of S.out) {
    if (lb < o.at || (o.until !== undefined && lb >= o.until)) continue;
    const age = lb - o.at;
    out.push({ kind: o.kind, text: o.text, at: o.at, age, chars: o.kind === 'say' ? Math.min(o.text.length, Math.floor(age / (o.rate ?? 0.03)) + 1) : o.text.length });
  }
  let typing = null;
  if (S.next) {
    const n = typed(S.next, ab);
    typing = {
      text: S.next.text, n, start: S.next.keys[0] - S.b0, end: S.next.keys[S.next.keys.length - 1] - S.b0,
      enterAt: S.next.enterAt - S.b0, age: n ? ab - S.next.keys[n - 1] : Infinity, entered: ab >= S.next.enterAt,
    };
  }
  const never = () => Infinity;
  let rowC;
  if (lb < 0 && S.own) {
    // before this shot's bar line its own prompt is still being typed (in the previous shot's skin)
    rowC = { mode: 'typing', text: S.own.text, n: typed(S.own, ab), cursor: true, keyAge: (i) => ab - S.own.keys[i] };
  } else if (typing && lb >= typing.start - S.clear) {
    rowC = { mode: 'typing', text: typing.text, n: typing.n, cursor: !typing.entered, keyAge: (i) => ab - S.next.keys[i] };
  } else if (S.prompt) {
    rowC = { mode: 'cmd', text: S.prompt, n: S.prompt.length, cursor: false, keyAge: never };
  } else {
    rowC = { mode: 'idle', text: '', n: 0, cursor: true, keyAge: never };
  }
  const active = rowC.mode === 'typing' && rowC.n > 0 && rowC.keyAge(rowC.n - 1) < 0.75;
  const blink = active || ab - Math.floor(ab) < 0.5;
  return { name, lb, ab, prompt: S.prompt, out, last: out[out.length - 1] || null, typing, rowC, blink };
}

// ---------------------------------------------------------------------------------------------------------------------
// The real look

export function setMono(g, size, bold = false) {
  g.font = `${bold ? 700 : 400} ${size}px ${MONO}`;
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
}

/** Monospace text placed letter by letter on the grid (advance = 0.6 of the size), so every skin can share positions. */
export function monoText(g, s, x, y, size, color, bold = false) {
  setMono(g, size, bold);
  g.fillStyle = color;
  const adv = size * 0.6;
  for (let i = 0; i < s.length; i++) if (s[i] !== ' ') g.fillText(s[i], x + i * adv, y);
}

/** The round bullet Claude Code puts before what it says and does. */
export function bullet(g, x, y, size, color) {
  g.fillStyle = color;
  g.beginPath();
  g.arc(x + size * 0.3, y - size * 0.31, size * 0.2, 0, Math.PI * 2);
  g.fill();
}

/** The little elbow before a tool's result. */
export function elbow(g, x, y, size, color) {
  g.strokeStyle = color; g.lineWidth = size * 0.07; g.lineCap = 'butt'; g.lineJoin = 'miter';
  g.beginPath();
  g.moveTo(x + size * 0.3, y - size * 0.74);
  g.lineTo(x + size * 0.3, y - size * 0.1);
  g.lineTo(x + size * 0.75, y - size * 0.1);
  g.stroke();
}

/** The block cursor's rectangle for a letter cell at (x, baseline y). */
export const cursorRect = (x, y, size) => ({ x, y: y - size * 0.86, w: size * 0.6, h: size * 1.1 });

/** One printed line in the real look, on row baseline y. */
export function drawOut(g, line, x, y, size, pal = REAL, ab = 0) {
  const adv = size * 0.6;
  if (line.kind === 'say') {
    bullet(g, x, y, size, pal.fg);
    monoText(g, line.text.slice(0, line.chars), x + 2 * adv, y, size, pal.fg);
  } else if (line.kind === 'tool') {
    bullet(g, x, y, size, line.age < 0.35 ? pal.dim : pal.green);     // grey while it runs, green when done
    const k = line.text.indexOf('(');
    monoText(g, line.text.slice(0, k), x + 2 * adv, y, size, pal.fg, true);
    monoText(g, line.text.slice(k), x + (2 + k) * adv, y, size, pal.fg);
  } else if (line.kind === 'result') {
    elbow(g, x + 2 * adv, y, size, pal.dim);
    monoText(g, line.text, x + 5 * adv, y, size, pal.dim);
  } else if (line.kind === 'spin') {
    star(g, x + size * 0.3, y - size * 0.31, size * 0.3, pal.orange, ab);
    monoText(g, line.text, x + 2 * adv, y, size, pal.orange);
  }
}

/** Claude Code's working star: its arms breathe, four changes a beat. */
export function star(g, cx, cy, r, color, ab = 0) {
  const k = Math.floor(ab * 4) % 4;
  const arms = [6, 8, 6, 4][k], len = [1, 0.8, 0.6, 0.8][k];
  g.strokeStyle = color; g.lineWidth = r * 0.3; g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2 - Math.PI / 2;
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * r * len, cy + Math.sin(a) * r * len);
  }
  g.stroke();
}

/** The prompt row in the real look: ">" then the typed letters, and the block cursor after them. */
export function drawPrompt(g, text, n, cursorOn, y = DOCK.rowC, pal = REAL, x = DOCK.x, size = DOCK.size) {
  const adv = size * 0.6;
  monoText(g, '>', x, y, size, pal.dim);
  monoText(g, text.slice(0, n), x + 2 * adv, y, size, pal.fg);
  if (cursorOn) {
    const c = cursorRect(x + (2 + n) * adv, y, size);
    g.fillStyle = pal.fg;
    g.fillRect(c.x, c.y, c.w, c.h);
  }
}

export function rule(g, y, pal = REAL, x0 = DOCK.left, x1 = DOCK.right) {
  g.fillStyle = pal.rule;
  g.fillRect(x0, y - 1, x1 - x0, 2);
}

/** Both rows in the real look (part 'B' or 'C' draws one of them). Used by shots that are not built yet. */
export function drawDockReal(g, m, pal = REAL, part = null) {
  if (part !== 'C' && m.last) drawOut(g, m.last, DOCK.x, DOCK.rowB, DOCK.size, pal, m.ab);
  if (part === 'B') return;
  const c = m.rowC;
  if (c.mode === 'cmd') { monoText(g, '>', DOCK.x, DOCK.rowC, DOCK.size, pal.dim); monoText(g, c.text, DOCK.x + 2 * DOCK.adv, DOCK.rowC, DOCK.size, pal.dim); }
  else drawPrompt(g, c.text, c.n, c.cursor && m.blink, DOCK.rowC, pal);
}

/**
 * The hand-over of the prompt row. Both shots keep the prompt's letters on the same grid, so while one picture gives
 * way to the next the letters change costume one column at a time, left to right: the new skin's letters replace the
 * old skin's. Call it from the shot that owns the hand-over, after drawing the picture, with p from 0 to 1.
 * Needs dock(g, env, part) on both shots (the director then tells the other shot not to draw its own rows).
 */
export function swapDock(g, env, ownDock, p = env.x) {
  const other = env.otherImpl && env.otherImpl.dock;
  const incoming = env.role === 'out' ? (gg) => other(gg, env.otherEnv, 'C') : (gg) => ownDock(gg, env, 'C');
  const outgoing = env.role === 'out' ? (gg) => ownDock(gg, env, 'C') : (gg) => other(gg, env.otherEnv, 'C');
  const outgoingB = env.role === 'out' ? (gg) => ownDock(gg, env, 'B') : (gg) => other(gg, env.otherEnv, 'B');
  const incomingB = env.role === 'out' ? (gg) => other(gg, env.otherEnv, 'B') : (gg) => ownDock(gg, env, 'B');
  const pp = Math.min(1, Math.max(0, p));
  const k = Math.floor(pp * (DOCK.cols + 4));
  const xk = DOCK.x - DOCK.adv + k * DOCK.adv, top = DOCK.rowC - 96, h = 170;
  g.save(); g.beginPath(); g.rect(xk, top, 1920 - xk, h); g.clip(); if (other || env.role === 'out') outgoing(g); g.restore();
  g.save(); g.beginPath(); g.rect(0, top, xk, h); g.clip(); incoming(g); g.restore();
  // what the outgoing shot last printed leaves quickly; the incoming shot's row B is its own from the start
  const a = 1 - Math.min(1, pp * 4);
  if (a > 0 && (other || env.role === 'out')) { g.save(); g.globalAlpha *= a; outgoingB(g); g.restore(); }
  incomingB(g);
}

/** Claude Code's mascot, drawn as the block characters it is made of. (x, y) is the top left; q is one quarter-block. */
export function mascot(g, x, y, qw, qh, color) {
  // quarter-blocks of:   ▐▛███▜▌  /  ▝▜█████▛▘  /  ▘▘ ▝▝      (17 columns, 5 rows)
  const rows = [
    [[3, 14]],                       // head
    [[3, 4], [6, 11], [13, 14]],     // head with the two eyes left open
    [[1, 16]],                       // arms
    [[3, 14]],                       // body
    [[4, 4], [6, 6], [11, 11], [13, 13]],   // feet
  ];
  g.fillStyle = color;
  rows.forEach((spans, r) => spans.forEach(([a, b]) => g.fillRect(x + a * qw, y + r * qh, (b - a + 1) * qw + 0.5, qh + 0.5)));
}
export const MASCOT = { cols: 17, rows: 5 };

/** The welcome box of a fresh session. Its border is one rounded rectangle (BOX), which the first shot unravels. */
export const BOX = { x: DOCK.left, y: 56, w: DOCK.right - DOCK.left, h: 584, r: 16 };
export const WELCOME = { version: 'v2.1.319', model: 'Fable 5.2', cwd: '~/Work/all-of-them' };

export function roundRectPath(g, b = BOX) {
  g.beginPath();
  g.moveTo(b.x + b.r, b.y);
  g.arcTo(b.x + b.w, b.y, b.x + b.w, b.y + b.h, b.r);
  g.arcTo(b.x + b.w, b.y + b.h, b.x, b.y + b.h, b.r);
  g.arcTo(b.x, b.y + b.h, b.x, b.y, b.r);
  g.arcTo(b.x, b.y, b.x + b.w, b.y, b.r);
  g.closePath();
}

export function drawWelcome(g, o = {}) {
  const pal = o.pal || REAL, b = BOX;
  const cx = b.x + b.w / 2;
  if (o.border !== false) {
    g.strokeStyle = pal.orange; g.lineWidth = 3; g.lineJoin = 'round';
    roundRectPath(g, b);
    g.stroke();
  }
  if (o.title !== false) {
    // the title sits in a gap in the top border
    const tx = b.x + 72, size = 40, label = 'Claude Code', ver = ' ' + WELCOME.version;
    const w = (label.length + ver.length) * size * 0.6;
    g.fillStyle = pal.bg;
    g.fillRect(tx - 16, b.y - 24, w + 32, 48);
    monoText(g, label, tx, b.y + 14, size, pal.orange, true);
    monoText(g, ver, tx + label.length * size * 0.6, b.y + 14, size, pal.dim);
  }
  if (o.inside !== false) {
    const center = (s, y, size, color, bold) => monoText(g, s, cx - (s.length * size * 0.6) / 2, y, size, color, bold);
    center('Welcome back!', b.y + 116, 48, pal.fg, true);
    const qw = 22, qh = 44;
    mascot(g, cx - (MASCOT.cols * qw) / 2 - qw / 2, b.y + 164, qw, qh, pal.orange);
    center(WELCOME.model, b.y + 468, 44, pal.fg);
    center(WELCOME.cwd, b.y + 532, 44, pal.dim);
  }
}
