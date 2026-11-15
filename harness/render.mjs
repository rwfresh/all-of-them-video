#!/usr/bin/env node
// Deterministic web page -> video renderer.
//
// The film is a web page that can draw any moment on request. Before it sets window.__ready = true it must define:
//   window.FILM = { width, height, fps, duration }
//   window.renderAt = async (t) => { ... }   // draw the frame for time t, in seconds
//
// Usage (run from the project root):
//   node harness/render.mjs film --stills 0,1.5,12        PNG stills  -> film/out/stills/
//   node harness/render.mjs film                           full render -> film/out/video.mp4
// Options:
//   --from 4 --to 9      render part of the film          --scale 0.5   half-size preview (layout unchanged)
//   --workers 3          parallel browsers                 --query a=b   extra query string for the page
//   --audio mix.wav      mux a soundtrack                  --out x.mp4   output path
//   --crf 14             x264 quality                      --page other.html
//   --info film.json     write the page's shots, lines and sound cues and exit
//   --lossless out.mkv   keep lossless frames (FFV1) instead of encoding H.264
//
// The pattern (a page with renderAt(t), captured frame by frame) follows the MIT-licensed harness in
// github.com/Vincentwei1021/mg-styles-15; this file is a separate, smaller implementation.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.FILM_CHROME || '/usr/bin/chromium';
// Hardware WebGL2 on NVIDIA under headless Chromium (verified with a renderer-string probe).
const GPU_ARGS = (process.env.FILM_GPU_ARGS || '--use-gl=angle --use-angle=gl-egl').split(' ').filter(Boolean);

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith('--')) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) a[k.slice(2)] = true;
      else { a[k.slice(2)] = next; i++; }
    } else a._.push(k);
  }
  return a;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.glsl': 'text/plain', '.hdr': 'application/octet-stream', '.wav': 'audio/wav', '.mp4': 'video/mp4',
};

function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      try {
        const u = new URL(req.url, 'http://x');
        if (u.pathname === '/__ls') {
          // the file names in one folder, so the page can see which shot modules exist without a failed request
          const d = path.join(ROOT, u.searchParams.get('dir') || '');
          const names = d.startsWith(ROOT) && fs.existsSync(d) ? fs.readdirSync(d) : [];
          res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          return res.end(JSON.stringify(names));
        }
        let p = path.join(ROOT, decodeURIComponent(u.pathname));
        if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
        if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
        if (!fs.existsSync(p)) { res.writeHead(404); return res.end('404 ' + u.pathname); }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        fs.createReadStream(p).pipe(res);
      } catch (e) { res.writeHead(500); res.end(String(e)); }
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const launch = () => puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  protocolTimeout: 600000,
  args: [...GPU_ARGS, '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit',
    '--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', '--hide-scrollbars', '--mute-audio'],
});

async function openPage(browser, url, w, h, scale, tag) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: scale });
  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error' || t === 'warn' || process.env.VERBOSE) console.log(`${tag}[page ${t}] ${m.text()}`);
  });
  page.on('pageerror', (e) => console.log(`${tag}[page error] ${e.message}`));
  page.on('requestfailed', (r) => console.log(`${tag}[request failed] ${r.url()} ${r.failure()?.errorText}`));
  await page.goto(url, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction('window.__ready === true', { timeout: +(process.env.FILM_READY_MS || 45000), polling: 100 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  return page;
}

const seek = (page, t) => page.evaluate((t) => window.renderAt(t), t);
const shot = (page, w, h) => page.screenshot({
  type: 'png', clip: { x: 0, y: 0, width: w, height: h }, optimizeForSpeed: true, captureBeyondViewport: false,
});

function ffmpeg(args) {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  return { p, done };
}

const write = (stream, buf) => new Promise((res, rej) => {
  stream.once('error', rej);
  if (!stream.write(buf)) stream.once('drain', res); else res();
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const filmDir = path.resolve(args._[0] || 'film');
  const rel = path.relative(ROOT, filmDir);
  const srv = await startServer();
  const scale = +(args.scale || 1);
  const q = new URLSearchParams(args.query || '');
  if (scale !== 1 && !q.has('rs')) q.set('rs', String(scale));   // the page renders smaller buffers for previews
  const url = `http://127.0.0.1:${srv.address().port}/${rel}/${args.page || 'index.html'}?${q}`;
  const browsers = [await launch()];

  try {
    const first = await openPage(browsers[0], url, 1920, 1080, scale, '');
    const cfg = await first.evaluate(() => window.FILM || {});
    const gpu = await first.evaluate(() => {
      const g = document.createElement('canvas').getContext('webgl2');
      const e = g && g.getExtension('WEBGL_debug_renderer_info');
      return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown';
    });
    if (/swiftshader|llvmpipe/i.test(gpu)) console.log(`WARNING: software WebGL (${gpu})`);
    const W = +(args.w || cfg.width || 1920), H = +(args.h || cfg.height || 1080);
    const FPS = +(args.fps || cfg.fps || 30), DUR = +(args.duration || cfg.duration || 10);
    await first.setViewport({ width: W, height: H, deviceScaleFactor: scale });
    const outDir = path.join(filmDir, 'out');
    fs.mkdirSync(outDir, { recursive: true });

    if (args.info) {
      // the page's own description of itself: shots, voice lines and sound cues with absolute times
      fs.writeFileSync(path.resolve(args.info), JSON.stringify(cfg, null, 1));
      console.log(path.resolve(args.info));
      return;
    }

    if (args.stills) {
      const dir = path.resolve(args.dir || path.join(outDir, 'stills'));
      fs.mkdirSync(dir, { recursive: true });
      for (const t of String(args.stills).split(',').map(Number)) {
        await seek(first, t);
        const f = path.join(dir, `t${t.toFixed(2).padStart(6, '0')}.png`);
        fs.writeFileSync(f, await shot(first, W, H));
        console.log(f);
      }
      return;
    }

    const f0 = Math.round(+(args.from || 0) * FPS);
    const f1 = Math.min(Math.round(DUR * FPS), Math.round(+(args.to || DUR) * FPS));
    const workers = Math.max(1, Math.min(+(args.workers || 3), f1 - f0));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'film-render-'));
    const out = path.resolve(args.out || path.join(outDir, 'video.mp4'));
    const t0 = performance.now();
    console.log(`render ${rel}: ${W}x${H} x${scale} @${FPS} fps, frames ${f0}-${f1}, ${workers} workers, GPU: ${gpu}`);

    const chunk = Math.ceil((f1 - f0) / workers);
    let done = 0;
    const segs = [];
    await Promise.all(Array.from({ length: workers }, async (_, w) => {
      const a = f0 + w * chunk, b = Math.min(f1, a + chunk);
      if (a >= b) return;
      const seg = path.join(tmp, `seg${String(w).padStart(2, '0')}.mkv`);
      segs[w] = seg;
      // One browser per worker: pages in one browser share a compositor and do not run in parallel.
      if (w) browsers[w] = await launch();
      const page = w ? await openPage(browsers[w], url, W, H, scale, `[w${w}] `) : first;
      const ff = ffmpeg(['-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
        '-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'bgr0', seg]);
      for (let f = a; f < b; f++) {
        await seek(page, f / FPS);
        await write(ff.p.stdin, await shot(page, W, H));
        if (++done % 60 === 0) {
          const el = (performance.now() - t0) / 1000;
          console.log(`  ${done}/${f1 - f0} frames, ${el.toFixed(0)} s (${(el / done).toFixed(2)} s/frame)`);
        }
      }
      ff.p.stdin.end();
      await ff.done;
    }));

    const list = path.join(tmp, 'list.txt');
    fs.writeFileSync(list, segs.filter(Boolean).map((s) => `file '${s}'`).join('\n'));
    if (args.lossless) {
      // keep the lossless frames as one file, to encode from more than once
      await ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.resolve(args.lossless)]).done;
      fs.rmSync(tmp, { recursive: true, force: true });
      console.log(`done -> ${path.resolve(args.lossless)} (lossless, ${((performance.now() - t0) / 1000).toFixed(0)} s)`);
      return;
    }
    const audio = args.audio ? path.resolve(args.audio) : null;
    const enc = ['-f', 'concat', '-safe', '0', '-i', list];
    if (audio) enc.push('-i', audio);
    enc.push('-map', '0:v:0');
    if (audio) enc.push('-map', '1:a:0', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest');
    enc.push('-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(args.crf || 14), '-profile:v', 'high',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-r', String(FPS), '-movflags', '+faststart', out);
    await ffmpeg(enc).done;
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`done -> ${out} (${((performance.now() - t0) / 1000).toFixed(0)} s${audio ? ', with audio' : ', no audio'})`);
  } finally {
    for (const b of browsers) if (b) await b.close().catch(() => {});
    srv.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
