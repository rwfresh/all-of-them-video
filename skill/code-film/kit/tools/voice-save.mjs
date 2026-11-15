// Saves one designed voice preview to the ElevenLabs account so it can be used for speech. Prints the new voice id.
//   node tools/voice-save.mjs <generated_voice_id> "<name>" "<description, 20-1000 characters>"
import fs from 'node:fs';
const KEY = (fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').match(/^ELEVENLABS_API_KEY=(.*)$/m) || [])[1]?.trim();
const [gen, name, desc] = process.argv.slice(2);
if (!gen || !name || !desc) { console.error('usage: voice-save.mjs <generated_voice_id> "<name>" "<description>"'); process.exit(1); }
const res = await fetch('https://api.elevenlabs.io/v1/text-to-voice', {
  method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ voice_name: name, voice_description: desc, generated_voice_id: gen }),
});
const j = await res.json();
console.log(res.status, j.voice_id || JSON.stringify(j).slice(0, 300));
