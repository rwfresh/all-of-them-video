#!/usr/bin/env node
// Builds the soundtrack: the music, already cut to the film's bars (cues.json "music": { "file", "gain" }), plus every
// sound cue the picture reports (film/out/film.json: keystrokes and each shot's own hits), then loudness to -14 LUFS.
//   node tools/mix.mjs [--music audio/music/cut/C.wav] [--sfx 0.8] [--mus 0.9] [--out audio/mix.wav]
// Sound effects are placed sample-exactly here (there are hundreds of keystrokes); ffmpeg does the final loudness pass.
// Refresh film.json first: node harness/render.mjs film --info film/out/film.json

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (...a) => path.join(ROOT, ...a);
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes('--' + k) ? argv[argv.indexOf('--' + k) + 1] : d);
const film = JSON.parse(fs.readFileSync(P('film/out/film.json'), 'utf8'));
const cues = JSON.parse(fs.readFileSync(P('film/cues.json'), 'utf8'));
const SR = 48000, CH = 2, DUR = film.duration, N = Math.ceil(DUR * SR);
const musFile = path.resolve(ROOT, opt('music', cues.music?.file || 'audio/music.wav'));
const MUS = +opt('mus', cues.music?.gain ?? 0.9), SFX = +opt('sfx', cues.mix?.sfx ?? 0.8), KEYS = +opt('keys', cues.mix?.keys ?? 0.5);
const outFile = path.resolve(ROOT, opt('out', 'audio/mix.wav'));

const decode = (file) => {
  const b = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', String(CH), '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 29 });
  return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.byteLength / 4));
};
const writeWav = (file, y) => {
  const pcm = Buffer.alloc(y.length * 3);
  for (let i = 0; i < y.length; i++) pcm.writeIntLE(Math.max(-8388608, Math.min(8388607, Math.round(y[i] * 8388607))), i * 3, 3);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(CH, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * CH * 3, 28); h.writeUInt16LE(CH * 3, 32); h.writeUInt16LE(24, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, pcm]));
};

// sound effects: each file peak-normalised, placed so its first audible moment (or its loudest, a: 'peak') lands on the cue
const bus = new Float32Array(N * CH);
const cache = {}, missing = new Set(), silent = new Set();
let placed = 0;
for (const c of film.sfx) {
  if (c.s.startsWith('__')) continue;
  const file = P('audio/sfx', `${c.s}.wav`);
  if (!fs.existsSync(file)) { missing.add(c.s); continue; }
  const w = (cache[c.s] ||= (() => {
    const x = decode(file);
    let peak = 0, at = 0;
    for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > peak) { peak = v; at = i; } }
    // where the sound really begins: generated files often open with a little silence, which would make the hit late
    let on = 0; while (on < x.length && Math.abs(x[on]) < 0.05 * peak) on++;
    return { x, peak, peakT: Math.floor(at / CH) / SR, onT: Math.max(0, Math.floor(on / CH) / SR - 0.003), n: x.length / CH };
  })());
  if (w.peak < 0.008) { silent.add(c.s); continue; }      // a failed take (under about -42 dB); a quiet room tone still passes
  // a: 'peak' puts the loudest moment on the cue. Without it the first audible moment goes there, except for a
  // percussive sound (loudest within 80 ms of its start), whose hit is what the ear hears as "on the beat"
  const byPeak = c.a === 'peak' || (c.a !== 'start' && w.peakT - w.onT < 0.08);
  const start = Math.round((c.t - (byPeak ? w.peakT : w.onT)) * SR);
  const len = Math.min(w.n, c.len ? Math.round(c.len * SR) : w.n);
  // cues.mix.trim: { name: dB } raises or lowers one sound everywhere it is used (from the jury's level measurements)
  const trim = Math.pow(10, ((cues.mix?.trim || {})[c.s] || 0) / 20);
  const gain = (0.7 / w.peak) * (c.g ?? 1) * (c.key ? KEYS : 1) * trim, fade = Math.min(len, Math.round((c.fadeOut ?? 0.05) * SR));
  const fin = Math.round((c.fadeIn ?? 0) * SR);
  for (let i = 0; i < len; i++) {
    const o = start + i;
    if (o < 0 || o >= N) continue;
    const f = (i > len - fade ? (len - i) / fade : 1) * (i < fin ? i / fin : 1);
    for (let ch = 0; ch < CH; ch++) bus[o * CH + ch] += w.x[i * CH + ch] * gain * f;
  }
  placed++;
}
fs.mkdirSync(P('audio/out'), { recursive: true });
writeWav(P('audio/out/stem_fx.wav'), bus);

const hasMus = fs.existsSync(musFile);
const pre = P('audio/out/premix.wav');
// cues.music.duck: [{ shot, from, to, db, fade }] pulls the music down between two local beats of a shot (down over
// `fade` seconds, back up at once on `to`): one beat of silence before the title's hit makes the hit land out of nothing
let musIn = musFile;
const ducks = (cues.music?.duck || []).map((d) => {
  const sh = film.shots.find((x) => x[0] === d.shot), spb = 60 / film.bpm;
  return sh ? { a: sh[1] + d.from * spb, b: sh[1] + d.to * spb, g: Math.pow(10, (d.db ?? -40) / 20), fade: d.fade ?? 0.05 } : null;
}).filter(Boolean);
if (hasMus && ducks.length) {
  const m = decode(musFile), y = new Float32Array(Math.min(m.length, N * CH));
  for (let i = 0; i < y.length / CH; i++) {
    const t = i / SR;
    let k = 1;
    for (const d of ducks) if (t >= d.a && t < d.b) k = Math.min(k, t < d.a + d.fade ? 1 + (d.g - 1) * ((t - d.a) / d.fade) : t > d.b - 0.004 ? d.g + (1 - d.g) * ((t - (d.b - 0.004)) / 0.004) : d.g);
    for (let ch = 0; ch < CH; ch++) y[i * CH + ch] = m[i * CH + ch] * k;
  }
  musIn = P('audio/out/music_ducked.wav');
  writeWav(musIn, y);
}
const graph = hasMus
  ? `[0:a]volume=${SFX}[fx];[1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=${MUS},apad=whole_dur=${DUR}[mus];[fx][mus]amix=inputs=2:normalize=0,atrim=0:${DUR},afade=t=out:st=${(DUR - 0.3).toFixed(3)}:d=0.3,alimiter=limit=0.89:attack=2:release=40:level=disabled[out]`
  : `[0:a]volume=${SFX},atrim=0:${DUR},alimiter=limit=0.89:attack=2:release=40:level=disabled[out]`;
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', P('audio/out/stem_fx.wav'), ...(hasMus ? ['-i', musIn] : []), '-filter_complex', graph, '-map', '[out]', '-c:a', 'pcm_s24le', '-ar', '48000', pre], { stdio: 'inherit' });

// Loudness to -14 LUFS by ONE fixed gain for the whole film. (ffmpeg's loudnorm falls back to riding the level when a
// film has a wide range, as this one does: it flattened the drop by about 2 dB. A fixed gain keeps the music's shape.)
const TARGET = +opt('lufs', -14), TP = -1.5;
const measure = (file) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const last = (re) => +(r.stderr.match(re) || []).pop().match(/-?[\d.]+/)[0];
  return { i: last(/I:\s+-?[\d.]+ LUFS/g), peak: last(/Peak:\s+-?[\d.]+ dBFS/g) };
};
const m = measure(pre);
let gain = TARGET - m.i;
const over = m.peak + gain - TP;                     // only if the gain would push peaks past the ceiling: catch them
const lim = over > 0 ? `,alimiter=limit=${Math.pow(10, TP / 20).toFixed(4)}:attack=2:release=60:level=disabled` : '';
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', pre, '-af', `volume=${gain.toFixed(2)}dB${lim}`, '-c:a', 'pcm_s16le', '-ar', '48000', outFile], { stdio: 'inherit' });
const chk = spawnSync('ffmpeg', ['-hide_banner', '-i', outFile, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
const pick = (re) => (chk.stderr.match(re) || []).pop();
console.log(`mix: ${outFile}`);
console.log(`  length ${DUR.toFixed(2)} s, ${placed} sound cues placed, music ${hasMus ? path.relative(ROOT, musFile) : 'none'}`);
console.log(`  premix ${m.i} LUFS, fixed gain ${gain.toFixed(2)} dB${lim ? ' + peak limiter' : ''} -> ${String(pick(/I:\s+(-?[\d.]+) LUFS/g))}, ${String(pick(/Peak:\s+(-?[\d.]+) dBFS/g))}`);
if (missing.size) console.log(`  no file yet for: ${[...missing].join(', ')}`);
if (silent.size) console.log(`  skipped near-silent: ${[...silent].join(', ')}`);
