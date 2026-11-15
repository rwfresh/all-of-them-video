#!/usr/bin/env node
// Measures sound files, for someone who cannot hear them: where each one starts, where its loudest moment is, where
// it ends, and its strongest pitches. Also guesses the key of a stretch of music, to check tonal sounds against it.
//   node tools/sfx-stats.mjs audio/sfx/line_*.wav
//   node tools/sfx-stats.mjs --key audio/music/cut/A.wav [--from 0 --to 30.9]
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const SR = 48000;
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes('--' + k) ? argv[argv.indexOf('--' + k) + 1] : d);

function load(file, from, to) {
  const a = ['-v', 'error'];
  if (from != null) a.push('-ss', String(from));
  if (to != null) a.push('-t', String(to - (from || 0)));
  const b = execFileSync('ffmpeg', [...a, '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 29 });
  return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.byteLength / 4));
}

function fft(re, im) {
  const N = re.length;
  for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

/** Magnitude spectrum of N samples of x from i0 (zero padded), Hann window. */
function spectrum(x, i0, N) {
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = (x[i0 + i] || 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  fft(re, im);
  const m = new Float64Array(N / 2);
  for (let i = 0; i < N / 2; i++) m[i] = Math.hypot(re[i], im[i]);
  return m;
}

const noteOf = (hz) => { const midi = 69 + 12 * Math.log2(hz / 440), r = Math.round(midi); return `${NOTES[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}${(midi - r) * 100 >= 0 ? '+' : ''}${((midi - r) * 100).toFixed(0)}c`; };

export function chroma(x) {
  const N = 1 << 15, c = new Float64Array(12);
  for (let i0 = 0; i0 < Math.max(1, x.length - N); i0 += N / 2) {
    const m = spectrum(x, i0, N);
    for (let k = 1; k < N / 2; k++) {
      const f = (k * SR) / N;
      if (f < 60 || f > 2000) continue;
      const pc = ((Math.round(12 * Math.log2(f / 261.6256)) % 12) + 12) % 12;
      c[pc] += m[k] * m[k];
    }
  }
  const mx = Math.max(...c) || 1;
  return Array.from(c, (v) => v / mx);
}

const corr = (a, b) => {
  const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length;
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return n / Math.sqrt(da * db || 1);
};
const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const roll = (a, k) => a.map((_, i) => a[(i - k + 12) % 12]);

if (argv.includes('--key')) {
  const file = opt('key'), from = argv.includes('--from') ? +opt('from') : null, to = argv.includes('--to') ? +opt('to') : null;
  const c = chroma(load(file, from, to));
  console.log(`${path.basename(file)}${from != null ? ` ${from}-${to} s` : ''}: ` + c.map((v, i) => `${NOTES[i]} ${v.toFixed(2)}`).join('  '));
  const ks = [];
  for (let k = 0; k < 12; k++) { ks.push([corr(roll(MAJ, k), c), NOTES[k] + ' major']); ks.push([corr(roll(MIN, k), c), NOTES[k] + ' minor']); }
  ks.sort((a, b) => b[0] - a[0]);
  console.log('  key guess: ' + ks.slice(0, 3).map(([r, n]) => `${n} (${r.toFixed(2)})`).join(', '));
} else {
  for (const file of argv.filter((a) => !a.startsWith('--'))) {
    const x = load(file);
    let pk = 0, pi = 0;
    for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > pk) { pk = v; pi = i; } }
    let on = 0; while (on < x.length && Math.abs(x[on]) < 0.05 * pk) on++;
    let end = x.length - 1; while (end > 0 && Math.abs(x[end]) < 0.02 * pk) end--;
    const N = 1 << 15, m = spectrum(x, Math.max(0, Math.min(pi, x.length - N)), N);
    const peaks = [];
    for (let k = 2; k < N / 2 - 1; k++) { const f = (k * SR) / N; if (f > 50 && f < 5000 && m[k] > m[k - 1] && m[k] >= m[k + 1]) peaks.push([m[k], f]); }
    peaks.sort((a, b) => b[0] - a[0]);
    const top = peaks.slice(0, 3).map(([v, f]) => `${f.toFixed(0)} Hz ${noteOf(f)}${v === peaks[0][0] ? '' : ` (${(20 * Math.log10(v / peaks[0][0])).toFixed(0)} dB)`}`).join(', ');
    console.log(`${path.basename(file).padEnd(20)} ${(x.length / SR).toFixed(2)} s  starts ${(on / SR).toFixed(3)}  peak at ${(pi / SR).toFixed(3)} (${(20 * Math.log10(pk)).toFixed(1)} dB)  ends ${(end / SR).toFixed(2)}  | ${top}`);
  }
}
