#!/usr/bin/env node
// Generates every sound effect listed in audio/sfx.json with ElevenLabs (skips files that already exist), plus the
// music bed. Each result is converted to 48 kHz WAV for the mix.
//   node tools/sfx.mjs [--only name1,name2] [--redo] [--music]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
const redo = argv.includes('--redo');
const run = (args) => execFileSync('node', [path.join(ROOT, 'tools/eleven.mjs'), ...args], { encoding: 'utf8' });
const wav = (mp3) => execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', mp3, '-ar', '48000', '-ac', '2', mp3.replace(/\.mp3$/, '.wav')]);
fs.mkdirSync(path.join(ROOT, 'audio/sfx'), { recursive: true });
for (const s of JSON.parse(fs.readFileSync(path.join(ROOT, 'audio/sfx.json'), 'utf8'))) {
  if (only && !only.includes(s.name)) continue;
  const out = path.join(ROOT, 'audio/sfx', `${s.name}.mp3`);
  if (fs.existsSync(out) && !redo) continue;
  try { process.stdout.write(run(['sfx', '--text', s.text, '--dur', String(s.dur), '--influence', String(s.influence), '--out', out])); wav(out); }
  catch (e) { console.log(`FAILED ${s.name}: ${String(e.stderr || e.message).slice(0, 300)}`); }
}
if (argv.includes('--music')) {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'audio/music.json'), 'utf8'));
  const out = path.join(ROOT, 'audio/music.mp3');
  if (!fs.existsSync(out) || redo) {
    try { process.stdout.write(run(['music', '--prompt', m.prompt, '--ms', String(m.ms), '--out', out])); wav(out); }
    catch (e) { console.log(`FAILED music: ${String(e.stderr || e.message).slice(0, 400)}`); }
  }
}
