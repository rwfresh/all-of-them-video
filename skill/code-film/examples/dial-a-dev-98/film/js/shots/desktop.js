// The five desktop shots: the struggle (hook), the prompt, the dial-up, the overnight build and Phone-Line Guard.
// They share one screen stage, so the desktop carries over from cut to cut like one continuous demo.

import * as THREE from 'three';
import { makeScreenStage } from '../crt.js';
import * as U from '../ui98.js';
import { ease, tw, seg, spring, decay, clamp, lerp, rng, noise1, hash, smooth } from '../util.js';
import { superText, fills, burst, seal, banner, FONT } from '../supers.js';

let stage = null;
const getStage = () => (stage ||= makeScreenStage());

const PROMPT = ['make me a web site for my band', 'with flames. no bugs please'];
const CODE = [
  '<HTML><HEAD>', '<TITLE>THE MODEMS</TITLE>', '</HEAD>', '<BODY BGCOLOR="#000000"', '  BACKGROUND="stars.gif">', '<CENTER>',
  '<FONT SIZE=7 COLOR=YELLOW>', 'THE MODEMS</FONT>', '<BLINK>Welcome to our', 'OFFICIAL home page!!!', '</BLINK>',
  '<IMG SRC="flames.gif">', '<IMG SRC="constr.gif">', '<P>You are visitor', '<IMG SRC="count.cgi">', '<A HREF="tour.htm">',
  'Tour Dates</A>', '<A HREF="guest.htm">', 'Guestbook</A>', '<MARQUEE>*** NEXT SHOW:', "MOM'S GARAGE ***", '</MARQUEE>',
  '</CENTER></BODY>', '</HTML>', '', 'REM 0 bugs. Shipping...',
];

const clock = (minutes) => {
  const m = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0');
  return `${((h + 11) % 12) + 1}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
};

// ---------------------------------------------------------------------------------------------------------------
// Shared drawing

const APP = { x: 150, y: 40, w: 660, h: 430 };

function drawApp(g, o = {}) {
  const a = { ...APP, ...(o.rect || {}) };
  const c = U.win(g, a.x, a.y, a.w, a.h, o.title ?? 'Dial-A-Dev 98', { icon: U.icon.modem, active: o.active });
  U.menuBar(g, c.x, c.y, c.w, ['File', 'Dial', 'Agents', 'Help']);
  // banner
  const by = c.y + 22;
  const gr = g.createLinearGradient(c.x, 0, c.x + c.w, 0);
  gr.addColorStop(0, '#000080'); gr.addColorStop(1, '#0a56c8');
  g.fillStyle = gr; g.fillRect(c.x + 2, by, c.w - 4, 58);
  U.rect(g, c.x + 2, by + 58, c.w - 4, 3, '#ffff00');
  const lw = U.text(g, 'DIAL-A-DEV', c.x + 14, by + 13, { font: 'big', color: '#ffffff', bold: true });
  U.text(g, '98', c.x + 22 + lw, by + 13, { font: 'big', color: '#ffff00', bold: true });
  if (a.w > 560) {
    U.text(g, 'The A.I. Coding Agent', c.x + c.w - 12, by + 9, { align: 'right', color: '#ffffff', bold: true });
    U.text(g, 'Version 98.0  -  Disc 1 of 14', c.x + c.w - 12, by + 31, { align: 'right', color: '#a8c8ff' });
  }
  return { c, top: by + 61, a };
}

function drawPromptPane(g, o) {
  const { c, top } = drawApp(g, o);
  U.text(g, 'What do you want to make?', c.x + 14, top + 12, { bold: true });
  U.sunken(g, c.x + 12, top + 34, c.w - 24, 104);
  const typed = o.typed ?? 0;
  let left = typed, cx = c.x + 24, cy = top + 48;
  PROMPT.forEach((ln, i) => {
    const s = ln.slice(0, Math.max(0, left));
    const w = U.text(g, s, c.x + 24, top + 48 + i * 40, { font: 'big' });
    if (left >= 0 && left <= ln.length) { cx = c.x + 24 + w + 2; cy = top + 48 + i * 40; }
    left -= ln.length;
  });
  if (o.caret) U.rect(g, cx, cy + 2, 3, 30, '#000000');
  // options
  ['Overnight Ship', 'Phone-Line Guard', 'Year 2000 ready'].forEach((l, i) => {
    const x = c.x + 16 + i * 208, y = top + 152;
    U.sunken(g, x, y, 16, 16);
    U.text(g, 'x', x + 4, y - 2, { bold: true });
    U.text(g, l, x + 24, y);
  });
  const by = top + 186;
  U.button(g, c.x + c.w - 356, by, 132, 36, 'Dial', { bold: true, focus: true, down: o.dialDown, font: 'big' });
  U.button(g, c.x + c.w - 212, by, 96, 36, 'Cancel');
  U.button(g, c.x + c.w - 108, by, 96, 36, 'Help');
  // status bar
  U.sunken(g, c.x + 2, c.y + c.h - 24, c.w - 4, 22, U.C.face);
  U.icon.modem(g, c.x + 8, c.y + c.h - 23, 1);
  U.text(g, o.status ?? 'Ready. Modem not connected.', c.x + 30, c.y + c.h - 21);
  return { dial: { x: c.x + c.w - 356 + 66, y: by + 18 }, field: { x: c.x + c.w / 2, y: top + 86 }, c };
}

function drawMainframe(g, x, y, t) {
  U.raised(g, x, y, 64, 80, '#b8b8c8');
  U.sunken(g, x + 6, y + 6, 52, 30, '#101820');
  for (let i = 0; i < 2; i++) {
    const cx = x + 19 + i * 26, cy = y + 21;
    g.fillStyle = '#c0c0c0'; g.beginPath(); g.arc(cx, cy, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#101820'; g.beginPath(); g.arc(cx, cy, 3, 0, Math.PI * 2); g.fill();
    const a = t * 6 + i;
    U.rect(g, cx + Math.cos(a) * 6 - 1, cy + Math.sin(a) * 6 - 1, 3, 3, '#404040');
  }
  for (let i = 0; i < 18; i++) {
    const on = hash(i * 7.1 + Math.floor(t * 9)) > 0.5;
    U.rect(g, x + 8 + (i % 6) * 9, y + 44 + Math.floor(i / 6) * 9, 6, 5, on ? ['#ff3030', '#30ff30', '#ffd020'][i % 3] : '#404048');
  }
  U.text(g, 'THE MODEL', x + 32, y + 84, { align: 'center', bold: true });
}

function drawScope(g, x, y, w, h, lt, phase) {
  U.sunken(g, x, y, w, h, '#001808');
  const mid = y + h / 2;
  g.fillStyle = '#063818';
  for (let i = 1; i < 8; i++) g.fillRect(x + 2 + Math.round(i * (w - 4) / 8), y + 2, 1, h - 4);
  g.fillRect(x + 2, Math.round(mid), w - 4, 1);
  g.fillStyle = '#40ff60';
  let prev = mid;
  for (let i = 0; i < w - 6; i++) {
    const u = i / (w - 6), tt = lt * 6 + u * 4;
    let v;
    if (phase === 0) {                      // touch tones: two sines, gated on and off
      const gate = (Math.floor(lt * 11 + u * 3) % 2) ? 1 : 0.08;
      v = (Math.sin(u * 70 + lt * 40) * 0.55 + Math.sin(u * 113 + lt * 23) * 0.45) * gate;
    } else if (phase === 1) {               // handshake: chirps and noise bursts
      const seg5 = Math.floor(tt * 0.8);
      const kind = Math.floor(hash(seg5 * 3.3) * 3);
      v = kind === 0 ? Math.sin(u * (60 + 240 * (tt % 1.25))) * 0.9
        : kind === 1 ? (hash(i * 1.7 + Math.floor(lt * 60) * 13.1) - 0.5) * 1.9
        : Math.sin(u * 200) * Math.sin(u * 23 + lt * 30) * 0.95;
    } else if (phase === 2) {               // carrier locked: clean, steady
      v = Math.sin(u * 44 - lt * 18) * 0.5;
    } else v = 0;                           // no carrier
    const yy = Math.round(mid - v * (h / 2 - 5));
    const a = Math.min(prev, yy), b = Math.max(prev, yy);
    g.fillRect(x + 3 + i, a, 1, Math.max(1, b - a + 1));
    prev = yy;
  }
}

/** The band's home page, built up in steps. p 0..1 is how much has been written. */
function drawBandPage(g, x, y, w, h, p, lt) {
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  U.rect(g, x, y, w, h, p > 0.04 ? '#000000' : '#ffffff');
  if (p > 0.1) {
    const r = rng(42);
    for (let i = 0; i < 90; i++) {
      const sx = x + Math.floor(r() * w), sy = y + Math.floor(r() * h);
      const tw2 = hash(i + Math.floor(lt * 5)) > 0.8;
      U.rect(g, sx, sy, tw2 ? 2 : 1, tw2 ? 2 : 1, ['#ffffff', '#a0a0ff', '#ffff80'][i % 3]);
    }
  }
  const cx = x + w / 2;
  if (p > 0.24) {
    // flaming title: yellow over red, flickering edge
    const ty = y + 14;
    U.text(g, 'THE MODEMS', cx, ty, { font: 'big', color: '#ff2000', bold: true, align: 'center', scale: 2 });
    g.save(); g.beginPath();
    const fh = 30 + Math.round(4 * Math.sin(lt * 20));
    g.rect(x, ty, w, fh); g.clip();
    U.text(g, 'THE MODEMS', cx, ty, { font: 'big', color: '#ffff00', bold: true, align: 'center', scale: 2 });
    g.restore();
  }
  if (p > 0.38 && Math.floor(lt * 4) % 4 !== 3) {
    U.text(g, 'Welcome to our OFFICIAL home page!!!', cx, y + 86, { color: '#00ffff', bold: true, align: 'center' });
  }
  if (p > 0.5) {
    const by = y + 112, bh = 30, bx = x + 20, bw = w - 40;
    g.save(); g.beginPath(); g.rect(bx, by, bw, bh); g.clip();
    U.rect(g, bx, by, bw, bh, '#ffd000');
    g.fillStyle = '#000000';
    const off = Math.floor(lt * 30) % 32;
    for (let i = -2; i < bw / 16 + 2; i++) {
      g.beginPath(); g.moveTo(bx + i * 32 + off, by); g.lineTo(bx + i * 32 + 16 + off, by);
      g.lineTo(bx + i * 32 + off - 14, by + bh); g.lineTo(bx + i * 32 + off - 30, by + bh); g.closePath(); g.fill();
    }
    g.restore();
    const tw3 = U.textW('UNDER CONSTRUCTION', 'ui', true);
    U.rect(g, cx - tw3 / 2 - 8, by + 5, tw3 + 16, 20, '#000000');
    U.text(g, 'UNDER CONSTRUCTION', cx, by + 7, { color: '#ffd000', bold: true, align: 'center' });
  }
  if (p > 0.64) {
    U.text(g, 'You are visitor number', cx, y + 156, { color: '#ffffff', align: 'center' });
    const n = String(Math.min(42, Math.floor((p - 0.64) * 400))).padStart(6, '0');
    U.rect(g, cx - 62, y + 178, 124, 34, '#202020');
    U.rect(g, cx - 60, y + 180, 120, 30, '#000000');
    U.text(g, n, cx, y + 180, { font: 'mono2', color: '#40ff40', align: 'center' });
  }
  if (p > 0.78) {
    ['Tour Dates', 'Guestbook', 'E-mail us'].forEach((l, i) => {
      const lx = x + w * (0.2 + i * 0.3);
      const lw2 = U.text(g, l, lx, y + 228, { color: '#ffff00', bold: true, align: 'center' });
      U.rect(g, lx - lw2 / 2, y + 245, lw2, 1, '#ffff00');
    });
  }
  if (p > 0.9) {
    const msg = "*** NEXT SHOW: MOM'S GARAGE, SATURDAY ***  ";
    const mw = U.textW(msg, 'ui', true);
    const off = (lt * 110) % mw;
    U.rect(g, x, y + h - 30, w, 24, '#000080');
    for (let k = -1; k < w / mw + 2; k++) U.text(g, msg, x + k * mw - off + w, y + h - 27, { color: '#ffffff', bold: true });
  }
  g.restore();
}

function superPop(g, txt, x, y, b, o = {}) {
  if (b <= 0) return;
  const s = lerp(1.8, 1, clamp(spring(b, 4.2, 0.45)));
  superText(g, txt, x, y, { font: FONT.impact, size: 120, fill: fills.yellow, strokeW: 13, shadow: 8, skew: 0.12, alpha: clamp(b / 0.05), scale: s, ...o });
}

// ---------------------------------------------------------------------------------------------------------------
// Shot 1: the struggle. Black and white, error boxes multiplying across the screen.

export function makeStruggle(ctx) {
  const S = ctx.shot.struggle, st = getStage();
  const src = ['<HTML>', '<BODY BGCOLOR="#000000">', '<CENTER><FONT SIZE=7>', 'WELCOME TO MY BAND', '</FONT></CENTRE>', '<IMG SRC="flames.gif">', '<MARQUEE>under constr'];
  const tStamp = Math.min(S.dur - 0.34, ctx.lines.hook.end - S.t0 + 0.04);   // the X lands as the question ends
  function draw(g, lt) {
    U.desktop(g, { tasks: [{ label: 'HOMEPAGE.HTM', icon: 'doc', active: true }], clock: '11:42 PM' });
    const c = U.win(g, 100, 30, 610, 420, 'HOMEPAGE.HTM - Text Editor', { icon: U.icon.doc });
    U.menuBar(g, c.x, c.y, c.w, ['File', 'Edit', 'Search', 'Help']);
    U.sunken(g, c.x + 2, c.y + 22, c.w - 4, c.h - 24);
    let left = 118 + Math.floor(lt * 22);
    src.forEach((ln, i) => { U.text(g, ln.slice(0, Math.max(0, left)), c.x + 12, c.y + 32 + i * 34, { font: 'mono2' }); left -= ln.length; });
    // the error trail
    const n = Math.min(64, 13 + Math.floor(Math.pow(lt, 1.25) * 19));
    let last = { x: 0, y: 0 };
    for (let i = 0; i < n; i++) {
      const x = 130 + ((i * 26) % 540) + Math.floor(i / 21) * 9, y = 52 + ((i * 21) % 330);
      last = U.dialog(g, x, y, 'Error', ['Syntax error on line 5.', 'Expected </CENTER>.'], { icon: 'errX' });
    }
    const jx = (noise1(lt * 23) - 0.5) * 26, jy = (noise1(lt * 29 + 4) - 0.5) * 18;
    U.cursor(g, last.x + last.w / 2 + jx, last.y + last.h - 18 + jy);
  }
  return {
    name: 'struggle',
    sfx: [{ t: 0, s: 'vhs_start', g: 0.8 }, { t: 0.15, s: 'errors', g: 0.7, len: tStamp }, { t: tStamp, s: 'stamp', a: 'peak', g: 2.6 }, { t: tStamp + 0.16, s: 'static', g: 0.7 }],
    samples: () => 3,
    render(lt, post, r) {
      draw(st.g, lt);
      const k = ease.inQuad(seg(lt, 0, S.dur));
      const sh = 0.004 + 0.012 * k;
      st.render(r, post, {
        cx: 470 + (noise1(lt * 31) - 0.5) * 900 * sh, cy: 262 + (noise1(lt * 37 + 2) - 0.5) * 700 * sh,
        zoom: lerp(1.06, 1.3, ease.inOutCubic(seg(lt, 0, S.dur))), yaw: lerp(0.2, 0.05, k), pitch: -0.06,
        roll: -0.05 + (noise1(lt * 17 + 8) - 0.5) * sh * 3,
      }, { sat: 0, gain: 1.15 });
    },
    overlay(g, lt) {
      // the hook is on screen from the first frame
      const a = lerp(1.25, 1, clamp(spring(lt + 0.12, 3.6, 0.5)));
      superText(g, 'STILL WRITING CODE', 960, 300, { font: FONT.impact, size: 176, fill: fills.white, strokeW: 18, shadow: 10, skew: 0.1, scale: a, tracking: 2 });
      const b = lt - (ctx.mark('hook', 'by') - S.t0) + 0.25;
      if (b > 0) superPop(g, 'BY HAND?', 960, 560, b, { size: 250, strokeW: 22, shadow: 12 });
      // red X stamped over the whole sorry scene
      const c = lt - tStamp;
      if (c > 0) {
        const s = 1 + 0.45 * (1 - ease.outBack(seg(c, 0, 0.17), 2.6));        // slaps down, dips, settles
        g.save(); g.translate(960, 600); g.scale(s, s); g.globalAlpha = clamp(c / 0.04);
        for (const [rot, col, lw] of [[0.72, '#fff', 132], [-0.72, '#fff', 132], [0.72, '#e8112d', 96], [-0.72, '#e8112d', 96]]) {
          g.save(); g.rotate(rot); g.fillStyle = col; g.fillRect(-560, -lw / 2, 1120, lw); g.restore();
        }
        g.restore();
      }
      return true;
    },
    look(lt) {
      const c = lt - tStamp;
      return {
        bloom: 0.2, streak: 0.06, vhs: 1, noise: 1.5, scan: 0.14, exposure: 0.95,
        glitch: 0.35 * decay(c, 0.05) + (lt > 0.4 && hash(Math.floor(lt * 30)) > 0.93 ? 0.3 : 0),
        flash: 0.25 * decay(c, 0.04),
      };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Shot 4: the prompt. Type what you want, then press Dial.

export function makePrompt(ctx) {
  const S = ctx.shot.prompt, st = getStage();
  const total = PROMPT.join('').length;
  const tClick = S.dur - 0.22;
  let pane = null;
  function draw(g, lt) {
    U.desktop(g, { tasks: [{ label: 'Dial-A-Dev 98', icon: 'modem', active: true }], clock: '11:42 PM' });
    const typed = Math.floor(total * tw(lt, 0.18, tClick - 0.55, ease.linear));
    pane = drawPromptPane(g, { typed, caret: Math.floor(lt * 5) % 2 === 0 || typed < total, dialDown: lt > tClick && lt < tClick + 0.12 });
    // pointer: rests by the field, then travels to Dial and clicks
    const m = tw(lt, tClick - 0.5, tClick - 0.06, ease.inOutCubic);
    U.cursor(g, lerp(pane.field.x + 250, pane.dial.x + 4, m), lerp(pane.field.y + 60, pane.dial.y + 2, m) - Math.sin(m * Math.PI) * 26);
  }
  return {
    name: 'prompt',
    sfx: [{ t: 0.18, s: 'keyboard', g: 0.8, len: tClick - 0.7 }, { t: ctx.mark('prompt', 'plain') - S.t0 - 0.12, s: 'pop', g: 0.8 }, { t: tClick, s: 'mouse_click', g: 1.2 }],
    samples: () => 7,
    render(lt, post, r) {
      draw(st.g, lt);
      const k = ease.inOutCubic(seg(lt, 0, S.dur));
      const toBtn = tw(lt, tClick - 0.45, tClick, ease.inOutCubic);
      st.render(r, post, {
        cx: lerp(lerp(470, 480, k), 500, toBtn), cy: lerp(lerp(240, 235, k), 272, toBtn),
        zoom: lerp(1.22, 1.3, k) + 0.04 * toBtn + 0.05 * decay(lt - tClick, 0.06),
        yaw: lerp(-0.16, 0.1, k), pitch: lerp(0.07, -0.03, k), roll: lerp(0.02, -0.012, k),
      }, { gain: 1.08 });
    },
    overlay(g, lt) {
      const b = lt - (ctx.mark('prompt', 'plain') - S.t0) + 0.12;
      if (b <= 0) return false;
      const sc = clamp(spring(b, 3.8, 0.42), 0, 1.5);
      banner(g, 1440, 884, { w: 700, h: 140, rot: -0.04 + 0.012 * Math.sin(lt * 6), scale: sc });
      superText(g, 'PLAIN ENGLISH!', 1440, 920, { font: FONT.impact, size: 100, fill: fills.red, rot: -0.04, stroke: '#fff', strokeW: 9, shadow: 0, scale: sc, tracking: 2 });
      return true;
    },
    look(lt) {
      return { bloom: 0.16, streak: 0.08, vhs: 1, noise: 0.9, scan: 0.1, exposure: 1.0, flash: 0.25 * decay(lt, 0.05), glitch: 0.5 * decay(lt, 0.03) };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Shot 5: dialling up the model.

export function makeDial(ctx) {
  const S = ctx.shot.dial, st = getStage();
  const tShake = 0.75, tConn = S.dur - 0.85;
  const steps = [[0.1, 'Dialing 1-800-555-0198...'], [tShake, 'Handshaking...'], [tShake + 0.7, 'Verifying password...'], [tConn, 'CONNECTED at 56,000 bps']];
  function draw(g, lt) {
    U.desktop(g, { tasks: [{ label: 'Dial-A-Dev 98', icon: 'modem', active: false }, { label: 'Connecting...', icon: 'phone', active: true }], clock: '11:43 PM' });
    drawPromptPane(g, { typed: 99, active: false, status: 'Dialing...' });
    const x = 232, y = 96, w = 500, h = 318;
    const c = U.win(g, x, y, w, h, 'Connecting to The Model', { icon: U.icon.phone, minmax: false });
    // you ... the line ... the model
    U.icon.computer(g, c.x + 26, c.y + 22, 4);
    U.text(g, 'YOU', c.x + 58, c.y + 90, { align: 'center', bold: true });
    drawMainframe(g, c.x + c.w - 100, c.y + 12, lt);
    const x0 = c.x + 104, x1 = c.x + c.w - 112, ly = c.y + 52;
    for (let i = 0; i < 26; i++) U.rect(g, x0 + i * (x1 - x0) / 26, ly, 5, 2, '#808080');
    const dir = lt < tConn ? 1 : 2;
    for (let k = 0; k < 5; k++) {
      const u = ((lt * (lt < tConn ? 0.9 : 2.4) + k / 5) % 1);
      const back = k % dir === 1;
      const px = lerp(x0, x1, back ? 1 - u : u);
      U.rect(g, px - 4, ly - 4, 10, 10, lt < tConn ? '#000080' : (back ? '#008000' : '#000080'));
      U.rect(g, px - 2, ly - 2, 6, 6, lt < tConn ? '#4080ff' : (back ? '#40ff60' : '#4080ff'));
    }
    drawScope(g, c.x + 14, c.y + 112, c.w - 28, 58, lt, lt < tShake ? 0 : lt < tConn ? 1 : 2);
    steps.forEach(([t0, s], i) => {
      if (lt < t0) return;
      const done = i < steps.length - 1 && lt >= steps[i + 1][0];
      const last = i === steps.length - 1;
      U.text(g, (done || last ? '' : '> ') + s + (done ? '  OK' : ''), c.x + 16, c.y + 176 + i * 18, { bold: !done, color: last ? '#008000' : done ? '#606060' : '#000000' });
    });
    U.progress(g, c.x + 216, c.y + c.h - 24, c.w - 322, 20, lt < tConn ? seg(lt, 0, tConn) * 0.94 : 1, lt < tConn ? U.C.title : '#008000');
    U.button(g, c.x + c.w - 94, c.y + c.h - 26, 82, 23, lt < tConn ? 'Cancel' : 'OK', { focus: true });
    U.cursor(g, c.x + c.w - 60, c.y + c.h - 60, lt < tConn ? 'hourglass' : 'cursor');
  }
  return {
    name: 'dial',
    sfx: [{ t: 0.1, s: 'modem', g: 0.9, len: tConn - 0.12 }, { t: tConn, s: 'connect_chime' }, { t: tConn + 0.05, s: 'pop', g: 0.7 }],
    samples: () => 7,
    render(lt, post, r) {
      draw(st.g, lt);
      const k = ease.inOutCubic(seg(lt, 0, S.dur));
      const scr = lt > tShake && lt < tConn ? 1 : 0;            // the screech rattles the camera
      const sh = scr * 0.006;
      st.render(r, post, {
        cx: 482 + (noise1(lt * 53) - 0.5) * 900 * sh, cy: lerp(246, 268, k) + (noise1(lt * 59 + 2) - 0.5) * 700 * sh,
        zoom: lerp(1.36, 1.5, k) + 0.08 * decay(lt - tConn, 0.08),
        yaw: lerp(0.14, -0.1, k), pitch: lerp(-0.05, 0.04, k), roll: (noise1(lt * 41 + 5) - 0.5) * sh * 2,
      }, { gain: 1.08 });
    },
    overlay(g, lt) {
      const b = lt - tConn - 0.05;
      if (b <= 0) return false;
      seal(g, 1560, 262, { r: 200, rot: 0.08 + 0.03 * Math.sin(lt * 7), scale: clamp(spring(b, 3.8, 0.42), 0, 1.5) });
      superPop(g, 'CONNECTED!', 1560, 252, b, { size: 78, fill: fills.white, rot: 0.08, strokeW: 9, shadow: 5, skew: 0 });
      superPop(g, '56K', 1560, 344, b, { size: 104, fill: fills.yellow, rot: 0.08, strokeW: 10, shadow: 5, skew: 0 });
      return true;
    },
    look(lt) {
      const scr = lt > tShake && lt < tConn ? 1 : 0;
      return {
        bloom: 0.16 + 0.3 * decay(lt - tConn, 0.2), streak: 0.08, vhs: 1 + 0.4 * scr, noise: 0.9 + 0.8 * scr, scan: 0.1,
        glitch: 0.45 * decay(lt, 0.03) + scr * (hash(Math.floor(lt * 30) + 3) > 0.7 ? 0.22 : 0.03),
        flash: 0.3 * decay(lt - tConn, 0.06), flashColor: new THREE.Color(0.6, 1, 0.6),
      };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Shot 6: it writes the code overnight and ships by morning.

export function makeBuild(ctx) {
  const S = ctx.shot.build, st = getStage();
  const tDone = S.dur - 0.95;
  function draw(g, lt) {
    const p = ease.outQuad(seg(lt, 0, tDone));
    const mins = lerp(23 * 60 + 43, 31 * 60, p);            // 11:43 PM -> 7:00 AM
    const night = 1 - smooth(seg(p, 0.7, 1));
    const sky = `rgb(${Math.round(lerp(0, 0, night))},${Math.round(lerp(128, 40, night))},${Math.round(lerp(128, 72, night))})`;
    U.desktop(g, { color: sky, tasks: [{ label: 'Dial-A-Dev 98', icon: 'modem', active: true }, { label: 'Preview', icon: 'doc', active: false }], clock: clock(mins) });
    // code window
    const { c, top } = drawApp(g, { rect: { x: 16, y: 14, w: 470, h: 448 }, title: 'Dial-A-Dev 98 - writing HOMEPAGE.HTM' });
    U.sunken(g, c.x + 2, top + 4, c.w - 4, c.h - (top - c.y) - 34, '#000010');
    const chars = Math.floor(p * CODE.join('\n').length * 1.02);
    const rows = Math.floor((c.h - (top - c.y) - 46) / 18);
    let left = chars, lineNo = 0;
    const visible = [];
    for (const ln of CODE) { if (left < 0) break; visible.push(ln.slice(0, left)); left -= ln.length + 1; lineNo++; }
    const start = Math.max(0, visible.length - rows);
    visible.slice(start).forEach((ln, i) => U.text(g, ln, c.x + 10, top + 10 + i * 18, { font: 'mono', color: i + start === visible.length - 1 ? '#ffffff' : '#40ff60', scale: 1 }));
    U.sunken(g, c.x + 2, c.y + c.h - 24, c.w - 4, 22, U.C.face);
    U.text(g, lt < tDone ? `Writing code...  line ${lineNo} of ${CODE.length}   56,000 bps` : 'Shipped. 0 bugs.', c.x + 8, c.y + c.h - 21);
    // preview window
    const pv = U.win(g, 494, 40, 450, 400, 'Preview - THE MODEMS', { icon: U.icon.doc, active: false });
    U.rect(g, pv.x, pv.y, pv.w, 22, U.C.face);
    U.sunken(g, pv.x + 58, pv.y + 1, pv.w - 62, 20);
    U.text(g, 'Address', pv.x + 4, pv.y + 3);
    U.text(g, 'http://themodems.example/', pv.x + 64, pv.y + 3);
    drawBandPage(g, pv.x + 2, pv.y + 26, pv.w - 4, pv.h - 28, p, lt);
    // overnight ship: the moon crosses, the sun comes up. It sits in the empty right side of the code window.
    const o = U.win(g, 272, 176, 212, 176, 'Overnight Ship', { minmax: false });
    const skyCol = night > 0.5 ? '#000030' : '#60b0ff';
    U.sunken(g, o.x + 4, o.y + 4, o.w - 8, 46, skyCol);
    if (night > 0.5) for (let i = 0; i < 9; i++) U.rect(g, o.x + 12 + ((i * 53) % (o.w - 28)), o.y + 9 + ((i * 17) % 26), 1, 1, '#ffffff');
    if (p < 0.72) {
      const ax = o.x + 20 + (p / 0.72) * (o.w - 44), ay = o.y + 34 - Math.sin((p / 0.72) * Math.PI) * 16;
      U.disc(g, ax, ay, 7, '#ffffc0'); U.disc(g, ax + 4, ay - 2, 6, skyCol);
    } else {
      const sy = o.y + 50 - (p - 0.72) * 96, sx = o.x + o.w / 2;
      for (let k = 0; k < 8; k++) U.rect(g, sx + Math.round(Math.cos(k * 0.785) * 14) - 1, sy + Math.round(Math.sin(k * 0.785) * 14) - 1, 3, 3, '#ffe000');
      U.disc(g, sx, sy, 9, '#ffe000');
    }
    U.rect(g, o.x + 6, o.y + 42, o.w - 12, 6, night > 0.5 ? '#102010' : '#208020');
    U.text(g, lt < tDone ? 'Shipping while' : 'Good morning!', o.x + 6, o.y + 54, { bold: true });
    U.text(g, lt < tDone ? 'you sleep...' : 'It shipped.', o.x + 6, o.y + 72, { bold: true });
    if (lt >= tDone) U.icon.ok(g, o.x + o.w - 40, o.y + 56, 2);
    U.text(g, clock(mins), o.x + o.w / 2, o.y + 92, { font: 'big', align: 'center', color: lt < tDone ? '#000000' : '#008000' });
    U.progress(g, o.x + 4, o.y + 126, o.w - 8, 18, p, lt < tDone ? U.C.title : '#008000');
  }
  return {
    name: 'build',
    sfx: [{ t: 0.05, s: 'data_chatter', g: 0.55, len: tDone }, { t: ctx.mark('build', 'ships') - S.t0 - 0.1, s: 'pop', g: 0.8 }, { t: tDone, s: 'rooster', g: 0.9 }, { t: tDone, s: 'connect_chime', g: 0.6 }],
    samples: () => 7,
    render(lt, post, r) {
      draw(st.g, lt);
      const k = ease.inOutCubic(seg(lt, 0, S.dur));
      const a = tw(lt, 0, 1.5, ease.inOutCubic), b = tw(lt, 1.5, S.dur, ease.inOutCubic);
      st.render(r, post, {
        cx: lerp(lerp(300, 480, a), 610, b), cy: lerp(lerp(190, 262, a), 250, b),
        zoom: lerp(lerp(1.5, 1.06, a), 1.4, b) + 0.08 * decay(lt - tDone, 0.07),
        yaw: lerp(-0.2, 0.14, k), pitch: lerp(0.06, -0.04, k), roll: lerp(-0.02, 0.015, k),
      }, { gain: 1.08 });
    },
    overlay(g, lt) {
      const b = lt - (ctx.mark('build', 'ships') - S.t0) + 0.1;
      if (b <= 0) return false;
      superPop(g, 'SHIPS BY', 1410, 640, b, { size: 100, fill: fills.white, strokeW: 12, rot: -0.05 });
      superPop(g, 'MORNING!', 1430, 790, b - 0.08, { size: 140, strokeW: 15, shadow: 9, rot: -0.05 });
      return true;
    },
    look(lt) {
      return { bloom: 0.16 + 0.3 * decay(lt - tDone, 0.2), streak: 0.08, vhs: 1, noise: 0.9, scan: 0.1, flash: 0.25 * decay(lt, 0.05) + 0.35 * decay(lt - tDone, 0.06), glitch: 0.45 * decay(lt, 0.03) };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Shot 7: Phone-Line Guard. The lock drops on the phone; everyone who tries to pick up is refused.

export function makeGuard(ctx) {
  const S = ctx.shot.guard, st = getStage();
  const tLock = 0.42;
  const tTry = ctx.mark('guard', 'nobody') - S.t0 - 0.05;
  const tSafe = ctx.mark('guard', 'kills') - S.t0 + 0.1;
  const tries = ['Mom', 'Your sister', 'The fax machine', 'Grandma (long distance)'];
  function draw(g, lt) {
    U.desktop(g, { tasks: [{ label: 'Dial-A-Dev 98', icon: 'modem', active: false }, { label: 'Phone-Line Guard', icon: 'lock', active: true }], clock: '2:17 AM', color: '#002848' });
    const { c, top } = drawApp(g, { rect: { x: 16, y: 14, w: 470, h: 448 }, title: 'Dial-A-Dev 98 - writing HOMEPAGE.HTM', active: false });
    U.sunken(g, c.x + 2, top + 4, c.w - 4, c.h - (top - c.y) - 34, '#000010');
    CODE.slice(4, 22).forEach((ln, i) => U.text(g, ln, c.x + 10, top + 10 + i * 18, { font: 'mono', color: '#2a9a40' }));
    const x = 250, y = 70, w = 520, h = 372;
    const d = U.win(g, x, y, w, h, 'Phone-Line Guard', { icon: U.icon.lock, minmax: false });
    // the phone, big, with the lock dropping onto it
    const px = d.x + 26, py = d.y + 22;
    const ring = lt > tTry && lt < tSafe ? Math.round((hash(Math.floor(lt * 40)) - 0.5) * 6) : 0;
    U.sunken(g, d.x + 12, d.y + 10, 156, 156, '#e8e8f0');
    U.icon.phone(g, px + ring, py, 8);
    const drop = lt - tLock;
    if (drop > -0.25) {
      const yy = drop < 0 ? lerp(-150, 0, ease.inQuad(seg(drop, -0.25, 0))) : -Math.abs(Math.sin(drop * 14)) * 22 * Math.exp(-drop * 7);
      U.icon.lock(g, px + 24, py + 34 + Math.round(yy), 5);
    }
    U.text(g, 'LINE LOCKED', d.x + 90, d.y + 172, { align: 'center', bold: true, color: lt > tLock ? '#008000' : '#808080' });
    U.text(g, 'Phone line in use by:', d.x + 186, d.y + 12);
    U.text(g, 'DIAL-A-DEV 98', d.x + 186, d.y + 32, { font: 'big', bold: true, color: '#000080' });
    U.text(g, 'Pickup attempts tonight:', d.x + 186, d.y + 76);
    U.sunken(g, d.x + 184, d.y + 96, d.w - 198, 108);
    tries.forEach((who, i) => {
      const t0 = tTry + i * 0.34;
      if (lt < t0) return;
      const yy = d.y + 102 + i * 24;
      const fresh = lt - t0 < 0.14;
      if (fresh) U.rect(g, d.x + 187, yy - 1, d.w - 204, 22, '#d40000');
      U.text(g, who, d.x + 194, yy, { color: fresh ? '#ffffff' : '#000000' });
      U.text(g, 'BLOCKED', d.x + d.w - 24, yy, { align: 'right', bold: true, color: fresh ? '#ffff00' : '#d40000' });
    });
    U.text(g, 'Build in progress', d.x + 14, d.y + 214, { bold: true });
    const bp = lt < tSafe ? lerp(0.62, 0.97, seg(lt, 0, tSafe)) : 1;
    U.progress(g, d.x + 14, d.y + 236, d.w - 28, 24, bp, lt < tSafe ? U.C.title : '#008000');
    if (lt >= tSafe) {
      U.icon.ok(g, d.x + 14, d.y + 270, 2);
      U.text(g, 'Your build is safe. Mom has been notified.', d.x + 56, d.y + 278, { bold: true });
    } else {
      U.icon.warn(g, d.x + 14, d.y + 270, 2);
      U.text(g, 'Do not pick up the phone.', d.x + 56, d.y + 278, { bold: true });
    }
    U.button(g, d.x + d.w - 96, d.y + d.h - 30, 84, 24, 'OK', { focus: true });
  }
  return {
    name: 'guard',
    sfx: [{ t: tLock, s: 'lock_clunk', a: 'peak', g: 1.2 }, ...tries.map((_, i) => ({ t: tTry + i * 0.34, s: 'buzzer', g: 0.6 })), { t: tSafe, s: 'connect_chime' }, { t: tSafe + 0.08, s: 'pop', g: 0.7 }],
    samples: () => 7,
    render(lt, post, r) {
      draw(st.g, lt);
      const k = ease.inOutCubic(seg(lt, 0, S.dur));
      const hit = decay(lt - tLock, 0.08);
      const a = tw(lt, tTry - 0.2, tTry + 0.5, ease.inOutCubic), b = tw(lt, tSafe - 0.25, tSafe + 0.4, ease.inOutCubic);
      let nudge = 0;
      tries.forEach((_, i) => { nudge += decay(lt - (tTry + i * 0.34), 0.05); });
      st.render(r, post, {
        cx: lerp(lerp(470, 560, a), 520, b) + (noise1(lt * 47) - 0.5) * 14 * (hit + nudge * 0.5),
        cy: lerp(lerp(180, 222, a), 300, b) + (noise1(lt * 43 + 3) - 0.5) * 14 * (hit + nudge * 0.5),
        zoom: lerp(lerp(1.75, 1.7, a), 1.6, b) + 0.08 * hit,
        yaw: lerp(-0.18, 0.12, k), pitch: lerp(0.08, -0.05, k), roll: lerp(0.03, -0.02, k),
      }, { gain: 1.08, tint: 0.5 * Math.min(1, nudge) });
    },
    overlay(g, lt) {
      const b = lt - tLock - 0.05;
      if (b <= 0) return false;
      const out = 1 - tw(lt, tSafe - 0.2, tSafe, ease.inCubic);
      if (out > 0) {
        superPop(g, 'PHONE-LINE', 1500, 190, b, { size: 92, fill: fills.white, strokeW: 11, rot: -0.05, alpha: out * clamp(b / 0.05) });
        superPop(g, 'GUARD!', 1560, 318, b - 0.08, { size: 140, strokeW: 15, shadow: 9, rot: -0.05, alpha: out * clamp((b - 0.08) / 0.05) });
      }
      const c = lt - tSafe - 0.08;
      if (c > 0) {
        seal(g, 1640, 770, { r: 196, rot: -0.08 + 0.03 * Math.sin(lt * 7), scale: clamp(spring(c, 3.8, 0.42), 0, 1.5) });
        superPop(g, 'BUILD', 1640, 750, c, { size: 110, fill: fills.white, rot: -0.08, strokeW: 11, shadow: 6, skew: 0 });
        superPop(g, 'SAFE!', 1640, 860, c, { size: 124, fill: fills.yellow, rot: -0.08, strokeW: 12, shadow: 6, skew: 0 });
      }
      return true;
    },
    look(lt) {
      let nudge = 0;
      tries.forEach((_, i) => { nudge += decay(lt - (tTry + i * 0.34), 0.04); });
      return {
        bloom: 0.16 + 0.3 * decay(lt - tSafe, 0.2), streak: 0.08, vhs: 1, noise: 0.9, scan: 0.1,
        flash: 0.25 * decay(lt, 0.05) + 0.3 * decay(lt - tLock, 0.05) + 0.3 * decay(lt - tSafe, 0.06),
        glitch: 0.45 * decay(lt, 0.03) + 0.06 * Math.min(1, nudge),
      };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Shot 11, the payoff: back to black and white. The announcer says "do not pick up the phone". Mom picks up the phone.

export function makeCarrier(ctx) {
  const S = ctx.shot.carrier, st = getStage();
  const tPick = ctx.lines.mom.at - S.t0;        // "Hello?": the handset is up
  const tDead = tPick + 0.4;                    // the line drops
  const tStamp = tDead + 0.66;
  function draw(g, lt) {
    const dead = lt >= tDead;
    U.desktop(g, { tasks: [{ label: 'Dial-A-Dev 98', icon: 'modem', active: false }, { label: 'The Model', icon: 'phone', active: true }], clock: '6:58 AM' });
    const { c, top } = drawApp(g, { rect: { x: 16, y: 14, w: 470, h: 448 }, title: 'Dial-A-Dev 98 - writing HOMEPAGE.HTM', active: false });
    U.sunken(g, c.x + 2, top + 4, c.w - 4, c.h - (top - c.y) - 34, '#000010');
    CODE.slice(6, 24).forEach((ln, i) => U.text(g, dead ? ln.replace(/[A-Za-z]/g, (ch) => (hash(ch.charCodeAt(0) + i * 7 + Math.floor(lt * 12)) > 0.6 ? '#' : ch)) : ln, c.x + 10, top + 10 + i * 18, { font: 'mono', color: dead ? '#707070' : '#40ff60' }));
    const d = U.win(g, 236, 60, 500, 300, dead ? 'Connection lost' : 'Connected to The Model', { icon: U.icon.phone, minmax: false, alert: dead });
    U.icon.computer(g, d.x + 26, d.y + 12, 4);
    U.text(g, 'YOU', d.x + 58, d.y + 80, { align: 'center', bold: true });
    drawMainframe(g, d.x + d.w - 100, d.y + 4, dead ? 0 : lt);
    const x0 = d.x + 104, x1 = d.x + d.w - 112, ly = d.y + 42;
    for (let i = 0; i < 26; i++) if (!dead || Math.abs(i - 12.5) > 3) U.rect(g, x0 + i * (x1 - x0) / 26, ly, 5, 2, '#808080');
    if (!dead) {
      for (let k = 0; k < 5; k++) {
        const u = (lt * 2.4 + k / 5) % 1, back = k % 2 === 1, px = lerp(x0, x1, back ? 1 - u : u);
        U.rect(g, px - 4, ly - 4, 10, 10, back ? '#008000' : '#000080'); U.rect(g, px - 2, ly - 2, 6, 6, back ? '#40ff60' : '#4080ff');
      }
    } else U.icon.errX(g, (x0 + x1) / 2 - 16, ly - 16, 2);
    // the phone on the line: it rings, then the handset comes off
    const ring = !dead && lt < tPick ? Math.round((hash(Math.floor(lt * 40)) - 0.5) * 4) : 0;
    U.icon.phone(g, (x0 + x1) / 2 - 16 + ring, d.y + 58 + (lt >= tPick ? -10 : 0), 2);
    drawScope(g, d.x + 14, d.y + 100, d.w - 28, 44, lt, dead ? 3 : 2);
    if (!dead) {
      U.text(g, 'CONNECTED at 56,000 bps', d.x + 16, d.y + 152, { bold: true, color: '#008000' });
      U.text(g, 'Build in progress: 99%. Almost there!', d.x + 16, d.y + 172);
      U.progress(g, d.x + 14, d.y + 196, d.w - 28, 24, lerp(0.97, 0.995, seg(lt, 0, tDead)));
    } else {
      const blink = Math.floor((lt - tDead) * 6) % 2 === 0 || lt - tDead > 0.7;
      if (blink) U.text(g, 'NO CARRIER', d.x + d.w / 2, d.y + 146, { font: 'big', align: 'center', color: '#d40000', scale: 2 });
      U.progress(g, d.x + 14, d.y + 214, d.w - 28, 22, lerp(0.99, 0, ease.outCubic(seg(lt, tDead, tDead + 0.27))), '#d40000');
      U.text(g, 'Somebody picked up the phone.', d.x + d.w - 16, d.y + 244, { align: 'right', bold: true });
    }
  }
  return {
    name: 'carrier',
    // '__music_stop' is read by the mix: the music cuts dead when the line drops
    sfx: [{ t: 0.05, s: 'phone_ring', g: 0.5, len: Math.max(0.3, tPick - 0.1) }, { t: tPick - 0.04, s: 'handset', g: 1.3 }, { t: tDead, s: '__music_stop' }, { t: tDead, s: 'fail', g: 1.1 }, { t: tDead, s: 'static', g: 0.8 }, { t: tStamp, s: 'stamp', a: 'peak', g: 2.6 }],
    samples: () => 5,
    render(lt, post, r) {
      draw(st.g, lt);
      const k = ease.inOutCubic(seg(lt, 0, S.dur));
      const hit = decay(lt - tDead, 0.1) + decay(lt - tStamp, 0.07) * 0.6;
      st.render(r, post, {
        cx: 486 + (noise1(lt * 47) - 0.5) * 26 * hit, cy: lerp(214, 232, k) + (noise1(lt * 43 + 3) - 0.5) * 26 * hit,
        zoom: lerp(1.42, 1.56, k) + 0.06 * decay(lt - tDead, 0.1), yaw: lerp(0.12, -0.06, k), pitch: lerp(-0.04, 0.03, k),
        roll: lerp(-0.012, 0.01, k) + (noise1(lt * 31 + 8) - 0.5) * hit * 0.03,
      }, { sat: 0, gain: 1.1 });
    },
    overlay(g, lt) {
      const dd = lt - tStamp;
      if (dd <= 0) return false;
      // the last word from legal, stamped in red across the dead connection
      const sc = 1 + 0.5 * (1 - ease.outBack(seg(dd, 0, 0.17), 2.6));
      g.save(); g.translate(1010, 252); g.rotate(-0.1); g.scale(sc, sc); g.globalAlpha = clamp(dd / 0.04);
      g.fillStyle = 'rgba(255,255,255,0.95)'; g.fillRect(-470, -150, 940, 300);
      g.strokeStyle = '#e8112d'; g.lineWidth = 16; g.strokeRect(-448, -128, 896, 256);
      g.restore();
      superText(g, 'DO NOT PICK UP', 1000, 226, { font: FONT.impact, size: 124, fill: '#e8112d', stroke: null, shadow: 0, rot: -0.1, scale: sc, alpha: clamp(dd / 0.04), tracking: 2 });
      superText(g, 'THE PHONE', 1014, 352, { font: FONT.impact, size: 138, fill: '#e8112d', stroke: null, shadow: 0, rot: -0.1, scale: sc, alpha: clamp(dd / 0.04), tracking: 2 });
      return true;
    },
    look(lt) {
      return {
        bloom: 0.16, streak: 0.06, vhs: 1, noise: 1.4, scan: 0.14, exposure: 0.97,
        glitch: 0.5 * decay(lt, 0.035) + 0.9 * decay(lt - tDead, 0.06), flash: 0.2 * decay(lt - tStamp, 0.04),
        roll: 0.04 * decay(lt - tDead, 0.05),
      };
    },
  };
}
