#!/usr/bin/env node
// Measures the music frame by frame so shots can move to it: overall level and eight frequency bands (40 Hz to 12 kHz),
// each scaled 0 to 1 against its own loud moments.   node tools/levels.mjs [audio/music/cut/C.wav]  -> film/data/levels.json
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cues = JSON.parse(fs.readFileSync(path.join(ROOT, 'film/cues.json'), 'utf8'));
const file = path.resolve(ROOT, process.argv[2] || cues.music?.file || 'audio/music.wav');
const SR = 24000, FPS = cues.fps || 60, NF = 1024;
const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
const x = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
const n = Math.floor((x.length / SR) * FPS);
const win = Float32Array.from({ length: NF }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (NF - 1)));
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
const edges = Array.from({ length: 9 }, (_, i) => 40 * Math.pow(12000 / 40, i / 8));
const bands = Array.from({ length: 8 }, () => new Float32Array(n)), rms = new Float32Array(n);
const re = new Float32Array(NF), im = new Float32Array(NF);
for (let f = 0; f < n; f++) {
  const c = Math.round((f / FPS) * SR);
  let s = 0;
  for (let i = 0; i < NF; i++) { const v = x[c - NF / 2 + i] || 0; re[i] = v * win[i]; im[i] = 0; s += v * v; }
  rms[f] = Math.sqrt(s / NF);
  fft(re, im);
  for (let b = 0; b < 8; b++) {
    const k0 = Math.max(1, Math.floor((edges[b] / SR) * NF)), k1 = Math.max(k0 + 1, Math.ceil((edges[b + 1] / SR) * NF));
    let e = 0;
    for (let k = k0; k < k1 && k < NF / 2; k++) e += re[k] * re[k] + im[k] * im[k];
    bands[b][f] = Math.sqrt(e / (k1 - k0));
  }
}
const norm = (a) => { const s = Float32Array.from(a).sort(); const top = s[Math.floor(s.length * 0.97)] || 1; return Array.from(a, (v) => +Math.min(1, v / top).toFixed(3)); };
fs.mkdirSync(path.join(ROOT, 'film/data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'film/data/levels.json'), JSON.stringify({ file: path.relative(ROOT, file), fps: FPS, n, rms: norm(rms), bands: bands.map(norm) }));
console.log(`film/data/levels.json: ${n} frames from ${path.relative(ROOT, file)}`);
