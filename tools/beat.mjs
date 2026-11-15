#!/usr/bin/env node
// Measures a music file against the film's bar plan, since nobody making the film can hear it:
// its tempo, where its first downbeat falls, how steady the tempo is, how loud each bar is, and where the drop lands.
//   node tools/beat.mjs audio/music/a.mp3 [--bpm 124] [--from 31 --to 62 --kick] [--first 0.04] [--json]
// Method: onset strength (rise of energy in low and wide bands, 5.8 ms steps), then the tempo and phase whose beat grid
// collects the most onset strength. Drift is checked by fitting the phase again in each quarter of the track.

import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const file = argv[0];
const opt = (k, d) => (argv.includes('--' + k) ? argv[argv.indexOf('--' + k) + 1] : d);
const SR = 22050, HOP = 128, DT = HOP / SR;

function pcm(filter) {
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-af', filter, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
}
function energy(x) {
  const n = Math.floor(x.length / HOP), e = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < HOP; k++) { const v = x[i * HOP + k]; s += v * v; } e[i] = Math.sqrt(s / HOP); }
  return e;
}
function onsets(e) {
  const o = new Float32Array(e.length);
  for (let i = 4; i < e.length; i++) o[i] = Math.max(0, Math.log(1e-4 + e[i]) - Math.log(1e-4 + e[i - 4]));
  return o;
}
const full = pcm('anull'), low = pcm('lowpass=f=140');
const eFull = energy(full), eLow = energy(low);
const oF = onsets(eFull), oL = onsets(eLow);
const on = new Float32Array(oF.length);
for (let i = 0; i < on.length; i++) on[i] = oF[i] + 2 * oL[i];
const dur = full.length / SR;
const A0 = +opt('from', 0), A1 = +opt('to', dur);          // measure tempo inside this window (the part with a kick is the most exact)
if (argv.includes('--kick')) for (let i = 0; i < on.length; i++) on[i] = oL[i];

/** Onset strength collected by a beat grid of period p seconds starting at phase ph, between times a and b. */
function score(p, ph, a = 0, b = dur) {
  let s = 0, n = 0;
  for (let t = ph + Math.ceil((a - ph) / p) * p; t < b; t += p) {
    const i = Math.round(t / DT);
    if (i >= 1 && i < on.length - 1) { s += Math.max(on[i - 1], on[i], on[i + 1]); n++; }
  }
  return n ? s / n : 0;
}
function bestPhase(p, a, b) {
  let best = [0, -1];
  for (let ph = 0; ph < p; ph += DT / 2) { const s = score(p, ph, a, b); if (s > best[1]) best = [ph, s]; }
  return best;
}

// tempo: coarse then fine
const hint = +opt('bpm', 0);
let lo = hint ? hint - 3 : 90, hi = hint ? hint + 3 : 150, best = { bpm: 0, s: -1, ph: 0 };
for (const step of argv.includes('--exact') ? [] : [0.25, 0.02, 0.002]) {
  for (let bpm = lo; bpm <= hi; bpm += step) {
    const p = 60 / bpm, [ph, s] = bestPhase(p, A0, A1);
    if (s > best.s) best = { bpm, s, ph };
  }
  lo = best.bpm - step * 2; hi = best.bpm + step * 2;
}
if (argv.includes('--exact')) { const [ph, sc] = bestPhase(60 / hint, A0, A1); best = { bpm: hint, s: sc, ph }; }   // trust the tempo, find the phase
const P = 60 / best.bpm;

// drift: the best phase in each quarter of the track, against the whole-track grid
const drift = [];
for (let q = 0; q < 4; q++) {
  const a = (q * dur) / 4, b = ((q + 1) * dur) / 4;
  let [ph] = bestPhase(P, a, b);
  let d = ph - best.ph;
  d -= Math.round(d / P) * P;
  drift.push(Math.round(d * 1000));
}

// downbeat: which of the four beat phases carries the most low-band onset strength on its bar lines
let down = { k: 0, s: -1 };
for (let k = 0; k < 4; k++) {
  let s = 0, n = 0;
  for (let t = best.ph + k * P; t < dur; t += 4 * P) { const i = Math.round(t / DT); if (i > 0 && i < oL.length - 1) { s += Math.max(oL[i - 1], oL[i], oL[i + 1]); n++; } }
  s /= n || 1;
  if (s > down.s) down = { k, s };
}
let first = best.ph + down.k * P;
while (first - 4 * P >= -0.02) first -= 4 * P;      // the earliest bar line in the file
if (argv.includes('--first')) first = +opt('first');

// loudness of each bar (RMS in dB), and the biggest jump from one bar to the next: the drop
const bars = [];
for (let t = first, n = 1; t + 4 * P <= dur + 0.05; t += 4 * P, n++) {
  const a = Math.max(0, Math.round(t * SR)), b = Math.min(full.length, Math.round((t + 4 * P) * SR));
  let s = 0, sl = 0;
  for (let i = a; i < b; i++) { s += full[i] * full[i]; sl += low[i] * low[i]; }
  bars.push({ bar: n, t: +t.toFixed(3), db: +(10 * Math.log10(1e-9 + s / (b - a))).toFixed(1), low: +(10 * Math.log10(1e-9 + sl / (b - a))).toFixed(1) });
}
const jumps = bars.slice(1).map((b, i) => ({ bar: b.bar, t: b.t, up: +(b.db - bars[i].db).toFixed(1) })).sort((a, b) => b.up - a.up);

const res = { file, duration: +dur.toFixed(2), bpm: +best.bpm.toFixed(3), beat: +P.toFixed(4), firstDownbeat: +first.toFixed(3), driftMsByQuarter: drift, bars, biggestRises: jumps.slice(0, 4) };
if (argv.includes('--json')) console.log(JSON.stringify(res));
else {
  console.log(`${file}: ${res.duration} s, ${res.bpm} BPM (a beat is ${res.beat} s), first bar line at ${res.firstDownbeat} s`);
  console.log(`  beat grid drift by quarter of the track (ms): ${drift.join(', ')}`);
  console.log('  bar: level dB (low band)   [film plan: theme from 3, groove 9, breakdown 19, build 22, DROP 25, breathe 33, lift 35, outro 37]');
  console.log('  ' + bars.map((b) => `${b.bar}:${b.db}`).join('  '));
  console.log('  biggest rises: ' + jumps.slice(0, 4).map((j) => `bar ${j.bar} (+${j.up} dB at ${j.t} s)`).join(', '));
}
