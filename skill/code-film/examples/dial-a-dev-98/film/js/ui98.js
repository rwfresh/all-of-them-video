// A tiny 1998 desktop toolkit drawn on a 960x540 canvas: bevelled windows, buttons, fields, progress bars,
// pixel icons and crisp bitmap text. Nothing is anti-aliased, as on a real VGA desktop of the time.

export const UW = 960, UH = 540;

export const C = {
  face: '#c0c0c0', hi: '#ffffff', light: '#dfdfdf', shadow: '#808080', dark: '#000000',
  desk: '#008080', title: '#000080', title2: '#1084d0', titleOff: '#808080', text: '#000000', sel: '#000080',
  white: '#ffffff', red: '#d40000', yellow: '#ffff00', green: '#008000', paper: '#ffffe1',
};

// ---------------------------------------------------------------------------------------------------------------
// Bitmap text. Canvas text is anti-aliased, so each string is drawn once to a scratch canvas, thresholded to hard
// pixels and cached.

const scratch = document.createElement('canvas');
const sg = scratch.getContext('2d', { willReadFrequently: true });
const cache = new Map();

const FONTS = {
  ui: { css: '400 16px "DotGothic16"', h: 16, base: 13 },
  big: { css: '400 32px "DotGothic16"', h: 32, base: 26 },
  mono: { css: '400 16px "VT323"', h: 16, base: 12 },
  mono2: { css: '400 32px "VT323"', h: 32, base: 24 },
  sans: { css: '700 13px "Lib Sans"', h: 16, base: 12 },
};

function glyphs(str, font, color, bold) {
  const key = `${font}|${color}|${bold ? 1 : 0}|${str}`;
  let c = cache.get(key);
  if (c) return c;
  const f = FONTS[font];
  sg.font = f.css;
  const w = Math.max(1, Math.ceil(sg.measureText(str).width) + (bold ? 2 : 1));
  scratch.width = w; scratch.height = f.h + 4;
  sg.font = f.css; sg.textBaseline = 'alphabetic'; sg.fillStyle = '#fff';
  sg.fillText(str, 0, f.base + 2);
  const img = sg.getImageData(0, 0, w, f.h + 4);
  const d = img.data;
  const r = parseInt(color.slice(1, 3), 16), gg = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
  const H = f.h + 4;
  const on = new Uint8Array(w * H);
  for (let i = 0; i < on.length; i++) on[i] = d[i * 4 + 3] > 96 ? 1 : 0;
  if (bold) {
    // Bold for bitmap type: thicken each stroke by one pixel to the right, but only where that leaves the gap to
    // the next stroke open. A plain double-strike fills in W and M and turns them into blobs.
    const need = f.h >= 32 ? 3 : 2;
    const src = on.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < w - 1; x++) {
      if (!src[y * w + x] || src[y * w + x + 1]) continue;
      let clear = true;
      for (let k = 1; k <= need; k++) if (x + k < w && src[y * w + x + k]) { clear = false; break; }
      if (clear) on[y * w + x + 1] = 1;
    }
  }
  for (let i = 0; i < on.length; i++) { d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = on[i] ? 255 : 0; }
  c = document.createElement('canvas'); c.width = w; c.height = f.h + 4;
  c.getContext('2d').putImageData(img, 0, 0);
  c.tw = w;
  if (cache.size > 6000) cache.clear();
  cache.set(key, c);
  return c;
}

export function textW(str, font = 'ui', bold = false) {
  sg.font = FONTS[font].css;
  return Math.ceil(sg.measureText(str).width) + (bold ? 1 : 0);
}

/** Draw crisp text. (x, y) is the top-left of the text line. o: { font, color, bold, align, scale } */
export function text(g, str, x, y, o = {}) {
  if (!str) return 0;
  const font = o.font ?? 'ui', color = o.color ?? C.text;
  const c = glyphs(str, font, color, !!o.bold);
  const sc = o.scale ?? 1;
  let dx = Math.round(x);
  if (o.align === 'center') dx = Math.round(x - (c.tw * sc) / 2);
  else if (o.align === 'right') dx = Math.round(x - c.tw * sc);
  g.imageSmoothingEnabled = false;
  g.drawImage(c, dx, Math.round(y) - 2 * sc, c.width * sc, c.height * sc);
  return c.tw * sc;
}

// ---------------------------------------------------------------------------------------------------------------
// Bevels and widgets.

const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
export const rect = R;

/** Filled circle made of whole pixels. */
export function disc(g, cx, cy, r, color) {
  g.fillStyle = color;
  for (let y = -r; y <= r; y++) { const hw = Math.floor(Math.sqrt(r * r - y * y)); g.fillRect(Math.round(cx) - hw, Math.round(cy) + y, hw * 2 + 1, 1); }
}

/** Raised 3D panel (window frame, button). */
export function raised(g, x, y, w, h, face = C.face) {
  R(g, x, y, w, h, face);
  R(g, x, y, w - 1, 1, C.light); R(g, x, y, 1, h - 1, C.light);
  R(g, x + 1, y + 1, w - 3, 1, C.hi); R(g, x + 1, y + 1, 1, h - 3, C.hi);
  R(g, x, y + h - 1, w, 1, C.dark); R(g, x + w - 1, y, 1, h, C.dark);
  R(g, x + 1, y + h - 2, w - 2, 1, C.shadow); R(g, x + w - 2, y + 1, 1, h - 2, C.shadow);
}

/** Sunken field (text box, list, progress well). */
export function sunken(g, x, y, w, h, fill = C.white) {
  R(g, x, y, w, h, fill);
  R(g, x, y, w - 1, 1, C.shadow); R(g, x, y, 1, h - 1, C.shadow);
  R(g, x + 1, y + 1, w - 3, 1, C.dark); R(g, x + 1, y + 1, 1, h - 3, C.dark);
  R(g, x, y + h - 1, w, 1, C.hi); R(g, x + w - 1, y, 1, h, C.hi);
  R(g, x + 1, y + h - 2, w - 2, 1, C.light); R(g, x + w - 2, y + 1, 1, h - 2, C.light);
}

export function button(g, x, y, w, h, label, o = {}) {
  if (o.down) {
    R(g, x, y, w, h, C.face);
    R(g, x, y, w, 1, C.dark); R(g, x, y, 1, h, C.dark);
    R(g, x + 1, y + 1, w - 2, 1, C.shadow); R(g, x + 1, y + 1, 1, h - 2, C.shadow);
    R(g, x, y + h - 1, w, 1, C.hi); R(g, x + w - 1, y, 1, h, C.hi);
  } else raised(g, x, y, w, h);
  if (o.focus) { g.strokeStyle = C.dark; g.lineWidth = 1; g.strokeRect(Math.round(x) - 0.5, Math.round(y) - 0.5, w + 1, h + 1); }
  const off = o.down ? 1 : 0;
  text(g, label, x + w / 2 + off, y + (h - 16) / 2 + off, { align: 'center', bold: o.bold, font: o.font ?? 'ui', color: o.color ?? C.text });
}

/** A window with a gradient title bar. Returns the client rectangle { x, y, w, h }. */
export function win(g, x, y, w, h, title, o = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  // drop shadow keeps overlapping windows readable on tape
  R(g, x + 6, y + 6, w, h, 'rgba(0,0,0,0.28)');
  raised(g, x, y, w, h);
  const tb = g.createLinearGradient(x + 3, 0, x + w - 3, 0);
  if (o.active === false) { tb.addColorStop(0, '#808080'); tb.addColorStop(1, '#b5b5b5'); }
  else if (o.alert) { tb.addColorStop(0, '#8a0000'); tb.addColorStop(1, '#e03020'); }
  else { tb.addColorStop(0, C.title); tb.addColorStop(1, C.title2); }
  g.fillStyle = tb; g.fillRect(x + 3, y + 3, w - 6, 20);
  let tx = x + 7;
  if (o.icon) { o.icon(g, x + 5, y + 5, 1); tx += 18; }
  text(g, title, tx, y + 5, { color: '#ffffff', bold: true });
  // close box
  raised(g, x + w - 21, y + 5, 16, 15);
  text(g, 'x', x + w - 17, y + 3, { bold: true });
  if (o.minmax !== false) {
    raised(g, x + w - 39, y + 5, 16, 15); R(g, x + w - 35, y + 8, 8, 7, C.dark); R(g, x + w - 34, y + 10, 6, 4, C.face);
    raised(g, x + w - 55, y + 5, 16, 15); R(g, x + w - 51, y + 15, 6, 2, C.dark);
  }
  return { x: x + 4, y: y + 25, w: w - 8, h: h - 29 };
}

/** Chunky block progress bar. p in 0..1. */
export function progress(g, x, y, w, h, p, color = C.title) {
  sunken(g, x, y, w, h, C.face);
  const n = Math.floor((w - 6) / 10), k = Math.round(n * Math.min(1, Math.max(0, p)));
  for (let i = 0; i < k; i++) R(g, x + 3 + i * 10, y + 3, 8, h - 6, color);
}

export function menuBar(g, x, y, w, items) {
  R(g, x, y, w, 20, C.face);
  let cx = x + 6;
  for (const it of items) { text(g, it, cx, y + 2); cx += textW(it) + 14; }
}

// ---------------------------------------------------------------------------------------------------------------
// Pixel art. Each sprite is rows of characters; a palette maps characters to colours ('.' is transparent).

export function sprite(g, rows, pal, x, y, s = 1) {
  x = Math.round(x); y = Math.round(y);
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      const c = pal[row[i]];
      if (c) { g.fillStyle = c; g.fillRect(x + i * s, y + j * s, s, s); }
    }
  }
}

const PAL = { k: '#000000', w: '#ffffff', g: '#c0c0c0', d: '#808080', b: '#000080', c: '#00a8a8', y: '#ffff00', o: '#e09000', r: '#d40000', n: '#0050d0', e: '#f4e8c0', m: '#804000', l: '#55ff55', s: '#a0e0ff' };

const SPR = {
  cursor: ['k..........', 'kk.........', 'kwk........', 'kwwk.......', 'kwwwk......', 'kwwwwk.....', 'kwwwwwk....', 'kwwwwwwk...', 'kwwwwwwwk..', 'kwwwwwwwwk.', 'kwwwwwkkkkk', 'kwwkwwk....', 'kwk.kwwk...', 'kk..kwwk...', 'k....kwwk..', '.....kwwk..', '......kk...'],
  hourglass: ['kkkkkkkkkkk', 'kwwwwwwwwwk', '.kwwwwwwwk.', '.kwyyyyywk.', '..kwyyywk..', '...kwywk...', '....kwk....', '...kwwwk...', '..kwwywwk..', '.kwwyyywwk.', '.kwyyyyywk.', 'kwwwwwwwwwk', 'kkkkkkkkkkk'],
  computer: ['..kkkkkkkkkkkk..', '.kggggggggggggk.', '.kgkkkkkkkkkkgk.', '.kgkccccccccdgk.', '.kgkccccccccdgk.', '.kgkccccccccdgk.', '.kgkccccccccdgk.', '.kgkccccccccdgk.', '.kgkddddddddwgk.', '.kggggggggggggk.', '..kkkkkkkkkkkk..', '....kggggggk....', '.kkkkkkkkkkkkkk.', '.kggggggggglggk.', '.kgkkkkkkggggdk.', '.kkkkkkkkkkkkkk.'],
  folder: ['................', '..kkkkk.........', '.kyyyyyk........', 'kyyyyyyykkkkkkk.', 'kyeeeeeeeeeeeeyk', 'kyeeeeeeeeeeeeok', 'kyeeeeeeeeeeeeok', 'kyeeeeeeeeeeeeok', 'kyeeeeeeeeeeeeok', 'kyeeeeeeeeeeeeok', 'kyeeeeeeeeeeeeok', 'kyeeeeeeeeeeeeok', 'kyoooooooooooook', '.kkkkkkkkkkkkkk.', '................', '................'],
  doc: ['..kkkkkkkkk.....', '..kwwwwwwwkk....', '..kwwwwwwwkwk...', '..kwkkkkkwkkkk..', '..kwwwwwwwwwwk..', '..kwkkkkkkkkwk..', '..kwwwwwwwwwwk..', '..kwkkkkkkkkwk..', '..kwwwwwwwwwwk..', '..kwkkkkkkkkwk..', '..kwwwwwwwwwwk..', '..kwkkkkkkwwwk..', '..kwwwwwwwwwwk..', '..kwwwwwwwwwwk..', '..kkkkkkkkkkkk..', '................'],
  bin: ['....kkkkkkkk....', '..kkggggggggkk..', '.kggggggggggggk.', '.kkkkkkkkkkkkkk.', '..kgdgdgdgdgdk..', '..kgdgdgdgdgdk..', '..kgdgdgdgdgdk..', '..kgdgdgdgdgdk..', '..kgdgdgdgdgdk..', '..kgdgdgdgdgdk..', '..kgdgdgdgdgdk..', '..kgdgdgdgdgdk..', '..kgdgdgdgdgdk..', '...kggggggggk...', '....kkkkkkkk....', '................'],
  disc: ['.....kkkkkk.....', '...kkwwsswwkk...', '..kwwsswwwwwwk..', '.kwsswwwwwwsswk.', '.kwswwwwwwwwswk.', 'kwswwwkkkkwwwssk', 'kwwwwkwwwwkwwwsk', 'kwwwwkwddwkwwwwk', 'kwwwwkwddwkwwwwk', 'kswwwkwwwwkwwwwk', 'ksswwwkkkkwwwswk', '.kwswwwwwwwwswk.', '.kwsswwwwwwsswk.', '..kwwwwwwsswwk..', '...kkwwsswwkk...', '.....kkkkkk.....'],
  phone: ['................', '..kkkkkkkkkkkk..', '.kddddddddddddk.', 'kddkkkkkkkkkkddk', 'kdk..........kdk', 'kkk..kkkkkk..kkk', '....kggggggk....', '...kgggkkgggk...', '..kgggkwwkgggk..', '..kggkwkkwkggk..', '..kggkwkkwkggk..', '..kgggkwwkgggk..', '..kggggkkggggk..', '..kggggggggggk..', '..kkkkkkkkkkkk..', '................'],
  errX: ['....kkkkkkkk....', '..kkrrrrrrrrkk..', '.krrrrrrrrrrrrk.', '.krrwwrrrrwwrrk.', 'krrrwwwrrwwwrrrk', 'krrrrwwwwwwrrrrk', 'krrrrrwwwwrrrrrk', 'krrrrrwwwwrrrrrk', 'krrrrwwwwwwrrrrk', 'krrrwwwrrwwwrrrk', '.krrwwrrrrwwrrk.', '.krrrrrrrrrrrrk.', '..kkrrrrrrrrkk..', '....kkkkkkkk....', '................', '................'],
  warn: ['.......kk.......', '......kyyk......', '......kyyk......', '.....kyyyyk.....', '.....kykkyk.....', '....kyykkyyk....', '....kyykkyyk....', '...kyyykkyyyk...', '...kyyykkyyyk...', '..kyyyykkyyyyk..', '..kyyyyyyyyyyk..', '.kyyyyykkyyyyyk.', '.kyyyyykkyyyyyk.', 'kyyyyyyyyyyyyyyk', 'kkkkkkkkkkkkkkkk', '................'],
  info: ['....kkkkkkkk....', '..kkwwwwwwwwkk..', '.kwwwwwnnwwwwwk.', '.kwwwwwnnwwwwwk.', 'kwwwwwwwwwwwwwwk', 'kwwwwwnnnwwwwwwk', 'kwwwwwwnnwwwwwwk', 'kwwwwwwnnwwwwwwk', 'kwwwwwwnnwwwwwwk', 'kwwwwwwnnwwwwwwk', '.kwwwwnnnnwwwwk.', '.kwwwwwwwwwwwwk.', '..kkwwwwwwwwkk..', '....kkkkwwkk....', '.......kwk......', '........k.......'],
  ok: ['....kkkkkkkk....', '..kkllllllllkk..', '.kllllllllllllk.', '.kllllllllllwwk.', 'klllllllllwwwllk', 'kllllllllwwwlllk', 'klwwllllwwwllllk', 'kllwwllwwwlllllk', 'klllwwwwwllllllk', 'kllllwwwlllllllk', '.kllllwllllllk..', '.kllllllllllllk.', '..kkllllllllkk..', '....kkkkkkkk....', '................', '................'],
  modem: ['................', '................', '................', '................', '.kkkkkkkkkkkkkk.', 'kggggggggggggggk', 'kgrgglgglggygggk', 'kggggggggggggggk', 'kgkkkkkkkkkkkkgk', 'kggggggggggggggk', '.kkkkkkkkkkkkkk.', '..kk........kk..', '................', '................', '................', '................'],
  lock: ['.....kkkkkk.....', '....kyyyyyyk....', '...kyykkkkyyk...', '...kyk....kyk...', '...kyk....kyk...', '..kkkkkkkkkkkk..', '.kyyyyyyyyyyyyk.', '.kyyyyykkyyyyyk.', '.kyyyykkkkyyyyk.', '.kyyyyykkyyyyyk.', '.kyyyyykkyyyyyk.', '.kyyyyyyyyyyyyk.', '.kooooooooooook.', '..kkkkkkkkkkkk..', '................', '................'],
};

export const icon = Object.fromEntries(Object.keys(SPR).map((k) => [k, (g, x, y, s = 1) => sprite(g, SPR[k], PAL, x, y, s)]));

/** Desktop icon with a caption under it. */
export function deskIcon(g, name, label, x, y) {
  icon[name](g, x, y, 2);
  text(g, label, x + 16, y + 36, { color: '#ffffff', align: 'center' });
}

/** Desktop background, icons and task bar. `clock` is a string like "11:42 PM". */
export function desktop(g, o = {}) {
  R(g, 0, 0, UW, UH, o.color ?? C.desk);
  const icons = o.icons ?? [['computer', 'My PC'], ['folder', 'My Stuff'], ['doc', 'TODO.TXT'], ['bin', 'Trash']];
  icons.forEach(([n, l], i) => deskIcon(g, n, l, 28, 22 + i * 74));
  // task bar
  raised(g, -2, UH - 30, UW + 4, 32);
  button(g, 3, UH - 26, 62, 22, 'Menu', { bold: true });
  let tx = 72;
  for (const t of o.tasks ?? []) {
    const w = Math.min(170, textW(t.label, 'ui', true) + 34);
    button(g, tx, UH - 26, w, 22, '', { down: t.active });
    if (t.icon) icon[t.icon](g, tx + 5, UH - 23 + (t.active ? 1 : 0), 1);
    text(g, t.label, tx + 25, UH - 23 + (t.active ? 1 : 0), { bold: t.active });
    tx += w + 4;
  }
  sunken(g, UW - 92, UH - 26, 88, 22, C.face);
  text(g, o.clock ?? '11:42 PM', UW - 48, UH - 23, { align: 'center' });
}

export function cursor(g, x, y, kind = 'cursor') {
  if (kind === 'hourglass') icon.hourglass(g, x - 5, y - 6, 1); else icon.cursor(g, x, y, 1);
}

/** Message box with an icon, text lines and buttons. Returns its rectangle. */
export function dialog(g, x, y, title, lines, o = {}) {
  const w = o.w ?? Math.max(220, Math.max(...lines.map((l) => textW(l))) + 96);
  const h = o.h ?? 74 + lines.length * 18 + (o.buttons === false ? -30 : 0);
  const c = win(g, x, y, w, h, title, { alert: o.alert, minmax: false, active: o.active });
  (icon[o.icon ?? 'errX'])(g, c.x + 12, c.y + 10, 2);
  lines.forEach((l, i) => text(g, l, c.x + 58, c.y + 12 + i * 18));
  if (o.buttons !== false) {
    const labels = o.buttons ?? ['OK'];
    const bw = 76, total = labels.length * bw + (labels.length - 1) * 8;
    labels.forEach((l, i) => button(g, c.x + (c.w - total) / 2 + i * (bw + 8), c.y + c.h - 30, bw, 23, l, { focus: i === 0, down: o.down === i }));
  }
  return { x, y, w, h };
}
