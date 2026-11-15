// 2D broadcast graphics drawn on the overlay canvas: supers, starbursts, price tags, closed captions.
// Coordinates are in 1920x1080 film pixels.

export const FONT = {
  impact: '"Anton"',
  black: '"Archivo Black"',
  serif: '"Lib Serif"',
  sans: '"Lib Sans"',
  mono: '"VT323"',
};

/** Vertical gradient fill helper. stops: [[offset, colour], ...] */
export function vgrad(g, y0, y1, stops) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

/**
 * Broadcast super: heavy type with an outline and a hard drop shadow, the way a 90s character generator set it.
 * o: { font, size, weight, italic, fill, stroke, strokeW, shadow, shadowColor, align, tracking, skew, rot, scaleX, scaleY, alpha }
 */
export function superText(g, text, x, y, o = {}) {
  const size = o.size ?? 80;
  g.save();
  g.translate(x, y);
  if (o.rot) g.rotate(o.rot);
  if (o.skew) g.transform(1, 0, -o.skew, 1, 0, 0);
  g.scale(o.scaleX ?? o.scale ?? 1, o.scaleY ?? o.scale ?? 1);
  g.globalAlpha *= o.alpha ?? 1;
  g.font = `${o.italic ? 'italic ' : ''}${o.weight ?? 400} ${size}px ${o.font ?? FONT.impact}`;
  g.textAlign = o.align ?? 'center';
  g.textBaseline = o.baseline ?? 'alphabetic';
  g.letterSpacing = `${o.tracking ?? 0}px`;
  g.lineJoin = 'round';
  g.miterLimit = 2;
  const sh = o.shadow ?? Math.max(3, size * 0.06);
  if (sh > 0) {
    g.fillStyle = o.shadowColor ?? 'rgba(0,0,0,0.85)';
    g.strokeStyle = g.fillStyle;
    g.lineWidth = o.strokeW ?? Math.max(4, size * 0.09);
    g.strokeText(text, sh, sh);
    g.fillText(text, sh, sh);
  }
  if (o.stroke !== null) {
    g.strokeStyle = o.stroke ?? '#000';
    g.lineWidth = o.strokeW ?? Math.max(4, size * 0.09);
    g.strokeText(text, 0, 0);
  }
  g.fillStyle = typeof o.fill === 'function' ? o.fill(g, size) : (o.fill ?? '#fff');
  g.fillText(text, 0, 0);
  if (o.shine) {
    // a thin highlight along the top of the letters
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(-4000, -size * 0.78, 8000, size * 0.2);
    g.restore();
  }
  g.restore();
}

export const fills = {
  yellow: (g, s) => vgrad(g, -s * 0.8, 0, [[0, '#fffbd0'], [0.45, '#ffe600'], [1, '#ffa800']]),
  white: (g, s) => vgrad(g, -s * 0.8, 0, [[0, '#ffffff'], [0.6, '#f2f6ff'], [1, '#b9c8ee']]),
  red: (g, s) => vgrad(g, -s * 0.8, 0, [[0, '#ff7a6a'], [0.5, '#f0142a'], [1, '#a00014']]),
  cyan: (g, s) => vgrad(g, -s * 0.8, 0, [[0, '#e8ffff'], [0.5, '#5ff0ff'], [1, '#12a6d8']]),
  green: (g, s) => vgrad(g, -s * 0.8, 0, [[0, '#eaffd0'], [0.5, '#7dff3a'], [1, '#1fae12']]),
};

/** Starburst polygon path centred on (0, 0). */
export function burstPath(g, rOuter, rInner, points, rot = 0, jitter = 0) {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i * Math.PI) / points;
    const j = jitter ? 1 + jitter * Math.sin(i * 12.9898) : 1;
    const r = (i % 2 ? rInner : rOuter * j);
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath();
}

/** A filled starburst with an outline and shadow. */
export function burst(g, x, y, o = {}) {
  const R = o.r ?? 150, r = o.inner ?? R * 0.78, n = o.points ?? 18;
  g.save();
  g.translate(x, y);
  g.rotate(o.rot ?? 0);
  g.scale(o.scale ?? 1, o.scale ?? 1);
  g.globalAlpha *= o.alpha ?? 1;
  burstPath(g, R, r, n, 0, o.jitter ?? 0.06);
  g.save(); g.translate(8, 10); g.fillStyle = 'rgba(0,0,0,0.6)'; burstPath(g, R, r, n, 0, o.jitter ?? 0.06); g.fill(); g.restore();
  burstPath(g, R, r, n, 0, o.jitter ?? 0.06);
  const gr = g.createRadialGradient(-R * 0.25, -R * 0.3, R * 0.05, 0, 0, R);
  const c = o.colors ?? ['#ff8a70', '#f0142a', '#9a0012'];
  gr.addColorStop(0, c[0]); gr.addColorStop(0.55, c[1]); gr.addColorStop(1, c[2]);
  g.fillStyle = gr; g.fill();
  g.lineWidth = o.lineW ?? 7; g.strokeStyle = o.stroke ?? '#fff'; g.lineJoin = 'miter'; g.stroke();
  g.restore();
}

/** Rounded rectangle path. */
export function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arcTo(x + w, y, x + w, y + r, r);
  g.lineTo(x + w, y + h - r); g.arcTo(x + w, y + h, x + w - r, y + h, r);
  g.lineTo(x + r, y + h); g.arcTo(x, y + h, x, y + h - r, r);
  g.lineTo(x, y + r); g.arcTo(x, y, x + r, y, r); g.closePath();
}

/**
 * Closed captions in the style of a 1998 TV decoder: white monospace capitals on black boxes, bottom centre.
 * `text` may hold up to two lines separated by \n. `reveal` 0..1 paints the words on in order.
 */
export function closedCaption(g, text, reveal = 1, o = {}) {
  const size = o.size ?? 46, lh = size * 1.18, yBase = o.y ?? 1006;
  const rows = text.toUpperCase().split('\n');
  const total = rows.join(' ').length;
  let shown = Math.ceil(total * reveal);
  g.save();
  g.font = `400 ${size}px ${FONT.mono}`;
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.letterSpacing = '2px';
  rows.forEach((row, i) => {
    const part = row.slice(0, Math.max(0, shown));
    shown -= row.length + 1;
    if (!part) return;
    const wFull = g.measureText(row).width, w = g.measureText(part).width;
    const x = Math.round(960 - wFull / 2), y = Math.round(yBase - (rows.length - 1 - i) * lh);
    g.fillStyle = 'rgba(0,0,0,0.92)';
    g.fillRect(x - 16, y - size * 0.74, w + 32, size * 0.98);
    g.fillStyle = '#fff';
    g.fillText(part, x, y);
  });
  g.restore();
}

/** VCR on-screen display text: blocky, bright, slightly outlined. */
export function osd(g, text, x, y, o = {}) {
  g.save();
  g.font = `400 ${o.size ?? 64}px ${FONT.mono}`;
  g.textAlign = o.align ?? 'left';
  g.textBaseline = 'alphabetic';
  g.letterSpacing = '4px';
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillText(text, x + 4, y + 4);
  g.fillStyle = o.color ?? '#f4f7f4';
  g.fillText(text, x, y);
  g.restore();
}

/** Round scalloped seal, like a guarantee sticker. */
export function seal(g, x, y, o = {}) {
  const R = o.r ?? 170, n = o.scallops ?? 28;
  g.save();
  g.translate(x, y); g.rotate(o.rot ?? 0); g.scale(o.scale ?? 1, o.scale ?? 1); g.globalAlpha *= o.alpha ?? 1;
  const path = () => {
    g.beginPath();
    for (let i = 0; i <= n * 8; i++) {
      const a = (i / (n * 8)) * Math.PI * 2, r = R * (1 + 0.045 * Math.cos(a * n));
      if (i) g.lineTo(Math.cos(a) * r, Math.sin(a) * r); else g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
  };
  g.save(); g.translate(8, 10); path(); g.fillStyle = 'rgba(0,0,0,0.6)'; g.fill(); g.restore();
  path();
  const c = o.colors ?? ['#d8ffb0', '#3ad820', '#0a7a08'];
  const gr = g.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.05, 0, 0, R * 1.05);
  gr.addColorStop(0, c[0]); gr.addColorStop(0.55, c[1]); gr.addColorStop(1, c[2]);
  g.fillStyle = gr; g.fill();
  g.lineWidth = 7; g.strokeStyle = o.stroke ?? '#fff'; g.stroke();
  g.beginPath(); g.arc(0, 0, R * 0.84, 0, Math.PI * 2);
  g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,0.85)'; g.setLineDash([10, 9]); g.stroke(); g.setLineDash([]);
  g.restore();
}

/** Slanted banner with notched ends. */
export function banner(g, x, y, o = {}) {
  const w = o.w ?? 520, h = o.h ?? 150, n = h * 0.3;
  g.save();
  g.translate(x, y); g.rotate(o.rot ?? 0); g.scale(o.scale ?? 1, o.scale ?? 1); g.globalAlpha *= o.alpha ?? 1;
  const path = () => {
    g.beginPath(); g.moveTo(-w / 2, -h / 2); g.lineTo(w / 2, -h / 2); g.lineTo(w / 2 - n, 0); g.lineTo(w / 2, h / 2);
    g.lineTo(-w / 2, h / 2); g.lineTo(-w / 2 + n, 0); g.closePath();
  };
  g.save(); g.translate(8, 10); path(); g.fillStyle = 'rgba(0,0,0,0.6)'; g.fill(); g.restore();
  path();
  const c = o.colors ?? ['#fffbd0', '#ffe600', '#f09a00'];
  g.fillStyle = vgrad(g, -h / 2, h / 2, [[0, c[0]], [0.5, c[1]], [1, c[2]]]); g.fill();
  g.lineWidth = o.lineW ?? 7; g.strokeStyle = o.stroke ?? '#000'; g.lineJoin = 'miter'; g.stroke();
  g.restore();
}

/** Text set around a circle, centred on `mid` (radians, 0 = right, -PI/2 = top). Assumes the origin is the centre. */
export function arcText(g, text, radius, mid, o = {}) {
  g.save();
  g.font = `${o.weight ?? 400} ${o.size ?? 40}px ${o.font ?? FONT.impact}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const gap = o.tracking ?? 2;
  const widths = [...text].map((ch) => g.measureText(ch).width + gap);
  const total = widths.reduce((a, b) => a + b, 0);
  const dir = o.flip ? -1 : 1;                  // flip: text reads along the bottom of the circle
  let a = mid - dir * (total / 2) / radius;
  [...text].forEach((ch, i) => {
    a += dir * (widths[i] / 2) / radius;
    g.save();
    g.translate(Math.cos(a) * radius, Math.sin(a) * radius);
    g.rotate(a + (o.flip ? -Math.PI / 2 : Math.PI / 2));
    if (o.stroke) { g.lineWidth = o.strokeW ?? 6; g.strokeStyle = o.stroke; g.lineJoin = 'round'; g.strokeText(ch, 0, 0); }
    g.fillStyle = o.fill ?? '#000'; g.fillText(ch, 0, 0);
    g.restore();
    a += dir * (widths[i] / 2) / radius;
  });
  g.restore();
}

const chromeFill = (g, s) => vgrad(g, -s * 0.82, 0, [[0, '#0b2a9a'], [0.3, '#3a8af0'], [0.5, '#eef8ff'], [0.52, '#1a0a05'], [0.75, '#a35a1a'], [1, '#ffe9a8']]);
const goldFill = (g, s) => vgrad(g, -s * 0.82, 0, [[0, '#7a3a00'], [0.3, '#f0a020'], [0.5, '#fff8d0'], [0.52, '#5a2000'], [0.78, '#d88a18'], [1, '#ffe070']]);

/** The infomercial's standing lower-third: product logo and the number to call, bottom left, above the captions. */
export function phoneBar(g, alpha = 1) {
  const x = 96, y = 862, w = 742, h = 84;
  g.save();
  g.globalAlpha *= alpha;
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x + 7, y + 8, w, h);
  g.fillStyle = vgrad(g, y, y + h, [[0, '#12309a'], [1, '#050f52']]); g.fillRect(x, y, w, h);
  g.fillStyle = '#ffe14a'; g.fillRect(x, y, w, 5); g.fillRect(x, y + h - 5, w, 5);
  g.font = `400 56px ${FONT.impact}`;
  const lw = g.measureText('DIAL-A-DEV').width + 9 * 1.5;
  g.restore();
  // flat, high-contrast lettering: at this size the chrome gradient turns to mush on tape
  superText(g, 'DIAL-A-DEV', x + 28, y + 65, { font: FONT.impact, size: 56, align: 'left', fill: '#ffffff', stroke: '#000418', strokeW: 7, shadow: 0, skew: 0.16, alpha, tracking: 1.5 });
  superText(g, '98', x + 44 + lw, y + 67, { font: FONT.impact, size: 68, align: 'left', fill: '#ffe14a', stroke: '#000418', strokeW: 7, shadow: 0, skew: 0.16, alpha });
  superText(g, '1-800-555-0198', x + w - 24, y + 64, { font: FONT.impact, size: 52, align: 'right', fill: '#ffe14a', stroke: '#000', strokeW: 6, shadow: 3, alpha, tracking: 1 });
}
