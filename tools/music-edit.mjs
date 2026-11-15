#!/usr/bin/env node
// Re-cuts a generated track on its own bar lines so that its shape matches the film's bar plan, and starts it exactly on
// its first downbeat. The track's tempo is steady, so whole bars can be dropped, moved or repeated; each join gets a
// short crossfade taken from the audio that really followed.
//   node tools/music-edit.mjs audio/music/c2.mp3 --first 0.041 --bpm 124 --bars 1-18,21-36,9-10,37-38 --out audio/music/C.wav
// The last range runs on to the end of the file, so the track's own tail rings out.

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const src = argv[0];
const opt = (k, d) => (argv.includes('--' + k) ? argv[argv.indexOf('--' + k) + 1] : d);
const SR = 48000, CH = 2, first = +opt('first', 0), bpm = +opt('bpm', 124), out = opt('out');
const ranges = opt('bars').split(',').map((r) => r.split('-').map(Number)).map(([a, b]) => [a, b ?? a]);
const barLen = (4 * 60) / bpm;

const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', src, '-ac', String(CH), '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 29 });
const x = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
const N = x.length / CH;
const at = (bar) => Math.round((first + (bar - 1) * barLen) * SR);     // sample where a bar starts

const X = Math.round(0.012 * SR);                                       // crossfade length
const parts = ranges.map(([a, b], i) => ({ s: at(a), e: i === ranges.length - 1 ? N : at(b + 1) }));
const total = parts.reduce((n, p) => n + (p.e - p.s), 0);
const y = new Float32Array(total * CH);
let w = 0;
parts.forEach((p, i) => {
  for (let k = p.s; k < p.e; k++, w++) {
    const j = k - p.s;
    for (let c = 0; c < CH; c++) {
      let v = k >= 0 && k < N ? x[k * CH + c] : 0;
      if (i > 0 && j < X) {
        // fade this part in over what the previous part would have played next
        const prev = parts[i - 1].e + j, f = j / X;
        const pv = prev < N ? x[prev * CH + c] : 0;
        v = v * Math.sin((f * Math.PI) / 2) + pv * Math.cos((f * Math.PI) / 2);
      }
      y[w * CH + c] = v;
    }
  }
});
// a short fade at the very start (the cut lands on the downbeat's attack), and a clean end
const fin = Math.round(0.003 * SR), fout = Math.round(0.4 * SR);
for (let k = 0; k < fin; k++) for (let c = 0; c < CH; c++) y[k * CH + c] *= k / fin;
for (let k = 0; k < fout; k++) for (let c = 0; c < CH; c++) y[(total - 1 - k) * CH + c] *= k / fout;

const pcm = Buffer.alloc(total * CH * 2);
for (let i = 0; i < total * CH; i++) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(y[i] * 32767))), i * 2);
const head = Buffer.alloc(44);
head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVEfmt ', 8); head.writeUInt32LE(16, 16);
head.writeUInt16LE(1, 20); head.writeUInt16LE(CH, 22); head.writeUInt32LE(SR, 24); head.writeUInt32LE(SR * CH * 2, 28);
head.writeUInt16LE(CH * 2, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(pcm.length, 40);
fs.writeFileSync(out, Buffer.concat([head, pcm]));
const bars = ranges.reduce((n, [a, b]) => n + b - a + 1, 0);
console.log(`${out}: ${bars} bars, ${(total / SR).toFixed(2)} s, from ${src} bars ${opt('bars')}`);
