#!/usr/bin/env node
// Small ElevenLabs client for the film's sound: voices, speech (with word timings), voice design, sound effects, music.
// Reads ELEVENLABS_API_KEY from ./.env and never prints it.
//
//   node tools/eleven.mjs voices [search]
//   node tools/eleven.mjs tts --voice ID --text "..." --out a.mp3 [--model eleven_v3] [--stability 0.4] [--speed 1.05] [--seed 7]
//       writes a.mp3 and a.json (word timings)
//   node tools/eleven.mjs design --desc "..." --text "..." --outdir dir        three voice previews, not saved to the account
//   node tools/eleven.mjs sfx --text "..." --out a.mp3 [--dur 2.5] [--influence 0.5]
//   node tools/eleven.mjs music --prompt "..." --ms 45000 --out a.mp3

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const KEY = (env.match(/^ELEVENLABS_API_KEY=(.*)$/m) || [])[1]?.trim();
if (!KEY) { console.error('ELEVENLABS_API_KEY is empty in .env'); process.exit(1); }
const API = 'https://api.elevenlabs.io';

function args(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { const n = argv[i + 1]; if (n === undefined || n.startsWith('--')) a[argv[i].slice(2)] = true; else { a[argv[i].slice(2)] = n; i++; } }
    else a._.push(argv[i]);
  }
  return a;
}

async function call(method, url, body, raw = false) {
  const res = await fetch(API + url, {
    method, headers: { 'xi-api-key': KEY, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const t = await res.text();
    const e = new Error(`${method} ${url.split('?')[0]} -> HTTP ${res.status}: ${t.slice(0, 400)}`);
    e.status = res.status; throw e;
  }
  return raw ? Buffer.from(await res.arrayBuffer()) : res.json();
}

/** Word timings from ElevenLabs' character alignment. */
export function wordsFrom(al) {
  const words = [];
  let cur = null;
  al.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) { cur = null; return; }
    if (!cur) { cur = { w: '', t0: al.character_start_times_seconds[i], t1: 0 }; words.push(cur); }
    cur.w += ch; cur.t1 = al.character_end_times_seconds[i];
  });
  return words.map((w) => ({ w: w.w, t0: +w.t0.toFixed(3), t1: +w.t1.toFixed(3) }));
}

export async function tts(o) {
  const settings = { stability: +(o.stability ?? 0.4), similarity_boost: +(o.similarity ?? 0.8), style: +(o.style ?? 0.5), use_speaker_boost: true };
  if (o.speed) settings.speed = +o.speed;
  const body = { text: o.text, model_id: o.model || 'eleven_v3', voice_settings: settings };
  if (o.seed) body.seed = +o.seed;
  const j = await call('POST', `/v1/text-to-speech/${o.voice}/with-timestamps?output_format=${o.format || 'mp3_44100_128'}`, body);
  fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
  fs.writeFileSync(o.out, Buffer.from(j.audio_base64, 'base64'));
  const words = wordsFrom(j.alignment);
  fs.writeFileSync(o.out.replace(/\.\w+$/, '.json'), JSON.stringify({ text: o.text, model: body.model_id, voice: o.voice, words }, null, 1));
  return { words };
}

async function main() {
  const a = args(process.argv.slice(2));
  const cmd = a._[0];
  if (cmd === 'voices') {
    const q = new URLSearchParams({ page_size: '100' });
    if (a._[1]) q.set('search', a._[1]);
    const j = await call('GET', `/v2/voices?${q}`);
    for (const v of j.voices) console.log([v.voice_id, v.name, v.category, Object.values(v.labels || {}).join('/'), (v.description || '').slice(0, 90)].join(' | '));
    console.log(`${j.voices.length} voices${j.has_more ? ' (more available)' : ''}`);
  } else if (cmd === 'tts') {
    const r = await tts(a);
    console.log(`${a.out}: ${r.words.length} words, ${r.words.at(-1).t1.toFixed(2)} s`);
  } else if (cmd === 'design') {
    const j = await call('POST', '/v1/text-to-voice/design', { voice_description: a.desc, text: a.text, model_id: a.model || 'eleven_ttv_v3', guidance_scale: +(a.guidance ?? 5) });
    fs.mkdirSync(a.outdir, { recursive: true });
    j.previews.forEach((p, i) => {
      const f = path.join(a.outdir, `${a.name || 'design'}_${i + 1}.mp3`);
      fs.writeFileSync(f, Buffer.from(p.audio_base_64, 'base64'));
      console.log(`${f} | generated_voice_id ${p.generated_voice_id} | ${p.duration_secs?.toFixed?.(1) ?? '?'} s`);
    });
  } else if (cmd === 'sfx') {
    const body = { text: a.text, prompt_influence: +(a.influence ?? 0.5) };
    if (a.dur) body.duration_seconds = +a.dur;
    if (a.model) body.model_id = a.model;
    if (a.loop) body.loop = true;
    const buf = await call('POST', `/v1/sound-generation?output_format=${a.format || 'mp3_44100_128'}`, body, true);
    fs.mkdirSync(path.dirname(path.resolve(a.out)), { recursive: true });
    fs.writeFileSync(a.out, buf);
    console.log(`${a.out}: ${buf.length} bytes`);
  } else if (cmd === 'music') {
    const body = { prompt: a.prompt, music_length_ms: +(a.ms || 45000), force_instrumental: true };
    if (a.model) body.model_id = a.model;
    const buf = await call('POST', `/v1/music?output_format=${a.format || 'mp3_44100_128'}`, body, true);
    fs.mkdirSync(path.dirname(path.resolve(a.out)), { recursive: true });
    fs.writeFileSync(a.out, buf);
    console.log(`${a.out}: ${buf.length} bytes`);
  } else {
    console.error('usage: eleven.mjs voices|tts|design|sfx|music ...'); process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e.message); process.exit(1); });
