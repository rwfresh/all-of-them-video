#!/usr/bin/env node
// Measures voice auditions, for when nobody has heard them yet: length, median pitch, pitch range and how much of the
// file is voiced. A wide range reads as sing-song; a low 10% figure can mean creak or laughter.
//   node tools/audition-stats.mjs audio/auditions/*.mp3
import { execFileSync } from 'node:child_process';
const SR = 16000, N = 640, HOP = 320, LMIN = Math.floor(SR / 420), LMAX = Math.floor(SR / 60);
for (const f of process.argv.slice(2)) {
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-ac', '1', '-ar', String(SR), '-f', 's16le', '-'], { maxBuffer: 1 << 28 });
  const x = new Int16Array(buf.buffer, buf.byteOffset, buf.length >> 1);
  const f0 = []; let voiced = 0, frames = 0, peak = 0;
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  for (let s = 0; s + N + LMAX < x.length; s += HOP) {
    frames++;
    let e = 0; for (let i = 0; i < N; i++) e += x[s + i] * x[s + i];
    if (Math.sqrt(e / N) < peak * 0.04) continue;
    let best = 0, bl = 0;
    for (let l = LMIN; l <= LMAX; l++) {
      let c = 0, e2 = 0; for (let i = 0; i < N; i++) { c += x[s + i] * x[s + i + l]; e2 += x[s + i + l] * x[s + i + l]; }
      const r = c / Math.sqrt(e * e2 + 1); if (r > best) { best = r; bl = l; }
    }
    if (best > 0.55) { f0.push(SR / bl); voiced++; }
  }
  f0.sort((a, b) => a - b);
  const q = (p) => f0[Math.floor(p * (f0.length - 1))];
  const st = 12 * Math.log2(q(0.9) / q(0.1));
  console.log(`${f.split('/').slice(-1)[0].padEnd(14)} ${(x.length / SR).toFixed(1).padStart(5)} s  median ${q(0.5).toFixed(0).padStart(4)} Hz  range ${st.toFixed(1).padStart(4)} st  (10%: ${q(0.1).toFixed(0)}, 90%: ${q(0.9).toFixed(0)})  speaking ${(100 * frames ? (100 * (f0.length) / frames) : 0).toFixed(0)}%`);
}
