#!/usr/bin/env node
// Finishing touches for generated sounds, from measurements (tools/sfx-stats.mjs), since nobody here can hear them:
// tune a pitched sound to the music's key, cut a tail, fade an end. Reads "post" in audio/sfx.json:
//   "post": { "shift": -2.05, "to": 0.6, "fadeOut": 0.04, "from": 0 }     shift in semitones, times in seconds
//   "post": { "src": "iso_pop", "shift": 3 }                              made from another sound's download
// The untouched download (<name>.mp3) is always the source and <name>.wav (what the mix uses) is rewritten,
// so running this twice changes nothing.   node tools/sfx-post.mjs [--only a,b]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
for (const s of JSON.parse(fs.readFileSync(path.join(ROOT, 'audio/sfx.json'), 'utf8'))) {
  if (!s.post || (only && !only.includes(s.name))) continue;
  const src = path.join(ROOT, 'audio/sfx', `${s.post.src || s.name}.mp3`), out = path.join(ROOT, 'audio/sfx', `${s.name}.wav`);
  if (!fs.existsSync(src)) { console.log(`no ${path.basename(src)} yet`); continue; }
  const p = s.post, f = [];
  if (p.from != null || p.to != null) f.push(`atrim=${p.from ?? 0}${p.to != null ? ':' + p.to : ''}`, 'asetpts=PTS-STARTPTS');
  if (p.shift) {
    const r = Math.pow(2, p.shift / 12);
    // like a sampler: play the recording faster or slower (a higher note is also shorter). This keeps a hit crisp;
    // a phase vocoder smears it. "keep": true holds the length instead, for a sustained sound.
    f.push(p.keep ? `rubberband=pitch=${r.toFixed(6)}` : `aresample=48000,asetrate=${Math.round(48000 * r)},aresample=48000`);
  }
  if (p.fadeOut && p.to != null) f.push(`afade=t=out:st=${Math.max(0, p.to - (p.from ?? 0) - p.fadeOut).toFixed(3)}:d=${p.fadeOut}`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-af', f.join(',') || 'anull', '-ar', '48000', '-ac', '2', out]);
  console.log(`${s.name}: ${f.join(', ')}`);
}
