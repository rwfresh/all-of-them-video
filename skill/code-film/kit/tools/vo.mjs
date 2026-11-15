#!/usr/bin/env node
// Records every voice line in film/cues.json with ElevenLabs and writes the real durations and word timings back
// into the cue sheet, so picture and captions follow the voice.
//   node tools/vo.mjs --voice ID [--only id1,id2] [--speed 1.12] [--stability 0.4] [--style 0.6] [--take 2]
//   node tools/vo.mjs --reuse --tempo 1.12      keep the recorded takes, speed them up, rewrite the timings
//   node tools/vo.mjs --reuse --tempo 1.38 --pitch -2     and lower the voice two semitones at that speed (0 clears it)
// A sped-up voice measures the same pitch but sounds higher and smaller; --pitch brings it back down. The pitch is
// kept in cues.json (voice.pitch) and used again until it is changed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tts } from './eleven.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const a = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));
const cuesPath = path.join(ROOT, 'film/cues.json');
const cues = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));
const only = a.only ? String(a.only).split(',') : null;
const tempo = +(a.tempo || 1);
const pitch = a.pitch !== undefined ? +a.pitch : +(cues.voice?.pitch ?? 0);          // semitones; negative is lower
const voice = a.voice || cues.voice?.id;
if (!voice) { console.error('pass --voice ID'); process.exit(1); }
cues.voice = { tempo, pitch, id: voice, model: a.model || cues.voice?.model || 'eleven_v4', speed: +(a.speed || cues.voice?.speed || 1.12), stability: +(a.stability || cues.voice?.stability || 0.4), style: +(a.style || cues.voice?.style || 0.6) };

for (const l of cues.lines) {
  if (only && !only.includes(l.id)) continue;
  const out = path.join(ROOT, 'audio/vo', `${l.id}.mp3`);
  // --reuse keeps the takes already on disk and only redoes the timing (for a new --tempo)
  const words = a.reuse
    ? JSON.parse(fs.readFileSync(out.replace(/\.mp3$/, '.json'), 'utf8')).words
    : (await tts({ voice: l.voice || voice, model: cues.voice.model, text: l.say || l.text, out, stability: l.stability ?? cues.voice.stability, style: cues.voice.style, speed: l.speed ?? cues.voice.speed, seed: a.take ? +a.take * 101 + 7 : undefined })).words;
  // tighten the read: a pitchman talks fast. atempo changes speed, not pitch; rubberband changes both, each on its own
  const af = pitch ? `rubberband=tempo=${tempo}:pitch=${Math.pow(2, pitch / 12).toFixed(5)}:pitchq=quality:formant=shifted` : `atempo=${tempo}`;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', out, '-af', af, '-ar', '48000', '-ac', '1', out.replace(/\.mp3$/, '.wav')]);
  for (const w of words) { w.t0 = +(w.t0 / tempo).toFixed(3); w.t1 = +(w.t1 / tempo).toFixed(3); }
  // drop audio tags like "[excited]" from the timings: they are directions, not speech
  const spoken = []; let inTag = false;
  for (const w of words) {
    if (w.w.startsWith('[')) inTag = true;
    if (!inTag) spoken.push(w);
    if (w.w.endsWith(']')) inTag = false;
  }
  l.words = spoken;
  l.dur = +(spoken.at(-1).t1 + 0.1).toFixed(3);
  console.log(`${l.id.padEnd(8)} ${l.dur.toFixed(2)} s  ${spoken.length} words  (${(spoken.length / l.dur).toFixed(1)} words/s)`);
}
console.log(`tempo ${tempo}, pitch ${pitch > 0 ? '+' : ''}${pitch} semitones`);
let s = JSON.stringify(cues, null, 2);
s = s.replace(/\{\s+"w": ("[^"]*"),\s+"t0": ([\d.]+),\s+"t1": ([\d.]+)\s+\}/g, '{ "w": $1, "t0": $2, "t1": $3 }');
fs.writeFileSync(cuesPath, s + '\n');
