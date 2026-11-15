// The physical product: the compact discs (with a real diffraction-grating shader) and the big retail box.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { superText, fills, burst, vgrad, rrect, FONT } from './supers.js';
import { rng } from './util.js';

export const PUBLISHER = 'BAUDWORKS';

// ---------------------------------------------------------------------------------------------------------------
// Disc label art (the printed side), drawn per disc number.

export function discLabelCanvas(n, total = 14, size = 1024) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const R = size / 2;
  g.translate(R, R);
  // silver print base with a brushed sheen
  const base = g.createLinearGradient(-R, -R, R, R);
  base.addColorStop(0, '#f4f6fb'); base.addColorStop(0.35, '#c9d0de'); base.addColorStop(0.5, '#ffffff');
  base.addColorStop(0.7, '#b4bccd'); base.addColorStop(1, '#e9edf5');
  g.fillStyle = base; g.fillRect(-R, -R, size, size);
  // blue printed top half with a horizon, echoing the logo chrome
  g.save();
  g.beginPath(); g.rect(-R, -R, size, R * 0.92); g.clip();
  g.fillStyle = vgrad(g, -R, -R * 0.08, [[0, '#030a4a'], [0.6, '#1a4fe0'], [1, '#bfe6ff']]);
  g.fillRect(-R, -R, size, size);
  g.restore();
  g.fillStyle = '#ffe600'; g.fillRect(-R, -R * 0.085, size, R * 0.03);
  // logo
  superText(g, 'DIAL-A-DEV', -R * 0.1, -R * 0.36, { font: FONT.impact, size: R * 0.3, fill: fills.white, skew: 0.16, strokeW: R * 0.03, shadow: R * 0.014 });
  superText(g, '98', R * 0.6, -R * 0.33, { font: FONT.impact, size: R * 0.4, fill: fills.yellow, skew: 0.16, strokeW: R * 0.034, shadow: R * 0.014 });
  // disc number
  g.fillStyle = '#0b1a6a';
  g.font = `400 ${R * 0.2}px ${FONT.black}`; g.textAlign = 'center';
  g.fillText('DISC', -R * 0.52, R * 0.36);
  g.font = `400 ${R * 0.52}px ${FONT.impact}`;
  g.fillStyle = '#e8112d';
  g.fillText(String(n), R * 0.08, R * 0.52);
  g.fillStyle = '#0b1a6a';
  g.font = `400 ${R * 0.2}px ${FONT.black}`;
  g.fillText(`of ${total}`, R * 0.56, R * 0.36);
  // small print around the bottom rim
  g.font = `700 ${R * 0.05}px ${FONT.sans}`;
  g.fillStyle = '#28324f';
  const small = `CD-ROM  •  THE A.I. CODING AGENT  •  © 1998 ${PUBLISHER} INTERACTIVE  •  INSERT DISCS IN ORDER  •`;
  const rad = R * 0.86;
  let a = Math.PI * 0.82;
  for (const ch of small) {
    const w = g.measureText(ch).width;
    g.save(); g.rotate(a - Math.PI / 2 - (w / 2) / rad * -1); g.translate(0, rad); g.rotate(Math.PI); g.fillText(ch, 0, 0); g.restore();
    a -= (w + R * 0.006) / rad;
  }
  return c;
}

export function discLabelTexture(n) {
  const t = new THREE.CanvasTexture(discLabelCanvas(n, 14, 512));
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------------------------------------------------------
// Disc material. The data side is a diffraction grating: tracks 1.6 micrometres apart run around the disc, so light
// reflects like a mirror along the tracks and splits into spectra across them. For each light the shader finds the
// wavelengths whose path difference is a whole number of waves and adds their colours.

const DISC_VERT = /* glsl */`
varying vec3 vWorldPos, vN, vAx, vAy; varying vec2 vP;
void main() {
  vP = position.xy;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  mat3 m = mat3(modelMatrix);
  vN = normalize(m * vec3(0.0, 0.0, 1.0));
  vAx = normalize(m * vec3(1.0, 0.0, 0.0));
  vAy = normalize(m * vec3(0.0, 1.0, 0.0));
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const DISC_FRAG = /* glsl */`
uniform sampler2D tLabel;
uniform vec3 uL[3]; uniform vec3 uLC[3];
uniform float uRainbow, uGain, uSeed;
varying vec3 vWorldPos, vN, vAx, vAy; varying vec2 vP;
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float vnoise1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash11(i), hash11(i + 1.0), f); }
vec3 bump3y(vec3 x, vec3 yo) { vec3 y = 1.0 - x * x; return clamp(y - yo, 0.0, 1.0); }
// Visible spectrum for a wavelength in nanometres (Zucconi's six-bump fit).
vec3 spectral(float w) {
  float x = (w - 400.0) / 300.0;
  if (x < 0.0 || x > 1.0) return vec3(0.0);
  const vec3 c1 = vec3(3.54585104, 2.93225262, 2.41593945), x1 = vec3(0.69549072, 0.49228336, 0.27699880), y1 = vec3(0.02312639, 0.15225084, 0.52607955);
  const vec3 c2 = vec3(3.90307140, 3.21182957, 3.96587128), x2 = vec3(0.11748627, 0.86755042, 0.66077860), y2 = vec3(0.84897130, 0.88445281, 0.73949448);
  return bump3y(c1 * (x - x1), y1) + bump3y(c2 * (x - x2), y2);
}
vec3 studio(vec3 r) {
  float az = atan(r.z, r.x);
  vec3 c = mix(vec3(0.004, 0.012, 0.08), vec3(0.03, 0.10, 0.45), smoothstep(-0.4, 0.9, r.y));
  c += vec3(2.2, 2.4, 3.0) * smoothstep(0.93, 0.99, cos(az - 1.2)) * smoothstep(0.1, 0.5, r.y);
  c += vec3(1.6, 1.3, 1.0) * smoothstep(0.95, 0.995, cos(az + 1.9)) * smoothstep(0.0, 0.4, r.y);
  return c;
}
void main() {
  float r = length(vP);
  bool front = gl_FrontFacing;
  vec3 N = normalize(vN) * (front ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec2 rd = vP / max(r, 1e-4);
  vec3 Rw = normalize(vAx * rd.x + vAy * rd.y);
  vec3 Tw = normalize(vAy * rd.x - vAx * rd.y);
  vec3 refl = studio(reflect(-V, N));
  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  vec3 col;
  // clear plastic hub with its moulded rings
  float hub = 1.0 - smoothstep(0.352, 0.36, r);
  float rings = exp(-pow((r - 0.128) * 160.0, 2.0)) + 0.8 * exp(-pow((r - 0.29) * 130.0, 2.0)) + 0.7 * exp(-pow((r - 0.352) * 200.0, 2.0));
  vec3 hubCol = vec3(0.05, 0.09, 0.22) + refl * (0.25 + 0.6 * fres) + vec3(0.7, 0.8, 1.0) * rings * (0.4 + 0.6 * abs(dot(Rw, normalize(vec3(0.4, 0.8, 0.3)))));
  if (front) {
    vec3 rainbow = vec3(0.0), spec = vec3(0.0);
    for (int k = 0; k < 3; k++) {
      vec3 Hs = normalize(uL[k] - vWorldPos) + V;      // point lights: the mirror image of each light is a hotspot, not the whole disc
      float along = dot(Hs, Tw);
      float across = abs(dot(Hs, Rw));
      float aniso = exp(-along * along * 34.0);
      vec3 c = vec3(0.0);
      for (int m = 1; m <= 7; m++) c += spectral(1600.0 * across / float(m)) / (0.6 + 0.4 * float(m));
      rainbow += c * aniso * uLC[k];
      spec += uLC[k] * aniso * exp(-across * across * 520.0) * 1.8;
    }
    float band = 0.86 + 0.14 * vnoise1(r * 70.0 + uSeed * 31.0);
    float written = smoothstep(0.0, 0.004, (0.55 + 0.42 * hash11(uSeed + 2.0)) - r);   // how far the data runs
    vec3 silver = vec3(0.78, 0.82, 0.9);
    col = refl * silver * (0.42 + 0.9 * fres) + rainbow * uRainbow * band * (0.65 + 0.35 * written) + spec;
    col += vec3(0.02, 0.03, 0.05);
    // outer clear rim
    col = mix(col, hubCol * 1.2, smoothstep(0.972, 0.98, r));
  } else {
    vec2 uv = vec2(0.5 - vP.x * 0.5, 0.5 + vP.y * 0.5);
    vec3 art = texture2D(tLabel, uv).rgb;
    art = mix(art / 12.92, pow((art + 0.055) / 1.055, vec3(2.4)), step(0.04045, art));
    float ndl = 0.35 + 0.65 * max(dot(N, normalize(vec3(0.3, 0.7, 0.65))), 0.0);
    col = art * ndl * 0.9 + refl * (0.05 + 0.5 * fres);
  }
  col = mix(col, hubCol, hub);
  gl_FragColor = vec4(col * uGain, 1.0);
}`;

const DISC_GEO = new THREE.RingGeometry(0.125, 1, 96, 1);

export function makeDisc(n) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: DISC_VERT, fragmentShader: DISC_FRAG, side: THREE.DoubleSide,
    uniforms: {
      tLabel: { value: discLabelTexture(n) },
      uL: { value: [new THREE.Vector3(-0.5, 0.6, 0.62), new THREE.Vector3(0.62, 0.25, 0.74), new THREE.Vector3(0.05, 0.95, 0.3)] },
      uLC: { value: [new THREE.Vector3(1.0, 0.98, 0.95), new THREE.Vector3(0.9, 0.95, 1.0), new THREE.Vector3(0.7, 0.75, 0.9)] },
      uRainbow: { value: 1.0 }, uGain: { value: 1.0 }, uSeed: { value: n * 1.37 },
    },
  });
  const mesh = new THREE.Mesh(DISC_GEO, mat);
  return mesh;
}

// ---------------------------------------------------------------------------------------------------------------
// Box art.

function drawMiniWindow(g, x, y, w, h) {
  g.save();
  g.translate(x, y);
  g.fillStyle = '#c0c0c0'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
  g.fillStyle = '#404040'; g.fillRect(0, h - 3, w, 3); g.fillRect(w - 3, 0, 3, h);
  const tb = g.createLinearGradient(6, 0, w - 6, 0); tb.addColorStop(0, '#000080'); tb.addColorStop(1, '#1084d0');
  g.fillStyle = tb; g.fillRect(6, 6, w - 12, 26);
  g.fillStyle = '#fff'; g.font = `700 17px ${FONT.sans}`; g.textAlign = 'left'; g.fillText('Dial-A-Dev 98', 14, 25);
  g.fillStyle = '#fff'; g.fillRect(12, 42, w - 24, h - 96);
  g.fillStyle = '#000'; g.font = `400 15px ${FONT.mono}`;
  ['> make me a web site', '  for my band', '', 'DIALING...', 'CONNECTED 56000', 'WRITING CODE ▓▓▓▓░'].forEach((s, i) => g.fillText(s, 20, 62 + i * 17));
  g.fillStyle = '#c0c0c0'; g.fillRect(w - 110, h - 44, 96, 30);
  g.fillStyle = '#fff'; g.fillRect(w - 110, h - 44, 96, 2); g.fillRect(w - 110, h - 44, 2, 30);
  g.fillStyle = '#404040'; g.fillRect(w - 110, h - 16, 96, 2); g.fillRect(w - 16, h - 44, 2, 30);
  g.fillStyle = '#000'; g.font = `700 15px ${FONT.sans}`; g.textAlign = 'center'; g.fillText('Dial', w - 62, h - 23);
  g.restore();
}

export function boxFrontCanvas(W = 1024, H = 1280) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  // sky
  g.fillStyle = vgrad(g, 0, H, [[0, '#02062a'], [0.42, '#0a2fc0'], [0.62, '#39a0ff'], [0.66, '#d9f4ff'], [0.662, '#06103a'], [1, '#02041a']]);
  g.fillRect(0, 0, W, H);
  // stars
  const r = rng(7);
  for (let i = 0; i < 160; i++) { const x = r() * W, y = r() * H * 0.5, s = r() * 2.2 + 0.4; g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; g.fillRect(x, y, s, s); }
  // perspective grid floor
  const hy = H * 0.662;
  g.save(); g.beginPath(); g.rect(0, hy, W, H - hy); g.clip();
  g.strokeStyle = 'rgba(80,200,255,0.75)'; g.lineWidth = 2.5;
  for (let i = -24; i <= 24; i++) { g.beginPath(); g.moveTo(W / 2, hy); g.lineTo(W / 2 + i * 150, H); g.stroke(); }
  for (let i = 1; i < 14; i++) { const y = hy + Math.pow(i / 14, 2.2) * (H - hy); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.fillStyle = vgrad(g, hy, H, [[0, 'rgba(2,4,26,0.0)'], [1, 'rgba(2,4,26,0.55)']]); g.fillRect(0, hy, W, H - hy);
  g.restore();
  // horizon flare
  const fl = g.createRadialGradient(W * 0.5, hy, 0, W * 0.5, hy, W * 0.6);
  fl.addColorStop(0, 'rgba(255,255,255,0.95)'); fl.addColorStop(0.08, 'rgba(190,230,255,0.6)'); fl.addColorStop(1, 'rgba(60,140,255,0)');
  g.fillStyle = fl; g.fillRect(0, hy - W * 0.6, W, W * 1.2);
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(0, hy - 2, W, 4);

  // publisher bar
  g.fillStyle = '#000'; g.fillRect(0, 0, W, 92);
  g.fillStyle = '#ffe600'; g.fillRect(0, 92, W, 8);
  g.fillStyle = '#fff'; g.font = `400 52px ${FONT.black}`; g.textAlign = 'left'; g.letterSpacing = '8px';
  g.fillText(PUBLISHER, 44, 66);
  g.letterSpacing = '0px';
  g.font = `italic 700 34px ${FONT.serif}`; g.textAlign = 'right'; g.fillStyle = '#9fc4ff';
  g.fillText('Interactive', W - 44, 62);

  // logo lockup
  const chromeFill = (gg, s) => vgrad(gg, -s * 0.82, 0, [[0, '#06125e'], [0.3, '#2a78e6'], [0.5, '#e8f6ff'], [0.52, '#1a0a05'], [0.75, '#a35a1a'], [1, '#ffe9a8']]);
  superText(g, 'DIAL-A-DEV', W * 0.385, 318, { font: FONT.impact, size: 168, fill: chromeFill, skew: 0.16, strokeW: 14, stroke: '#fff', shadow: 10, tracking: 1 });
  superText(g, 'DIAL-A-DEV', W * 0.385, 318, { font: FONT.impact, size: 168, fill: chromeFill, skew: 0.16, strokeW: 4, stroke: '#000820', shadow: 0, tracking: 1 });
  const goldFill = (gg, s) => vgrad(gg, -s * 0.82, 0, [[0, '#7a3a00'], [0.3, '#f0a020'], [0.5, '#fff8d0'], [0.52, '#5a2000'], [0.78, '#d88a18'], [1, '#ffe070']]);
  superText(g, '98', W * 0.865, 356, { font: FONT.impact, size: 268, fill: goldFill, skew: 0.16, strokeW: 16, stroke: '#fff', shadow: 10, rot: -0.07 });
  superText(g, '98', W * 0.865, 356, { font: FONT.impact, size: 268, fill: goldFill, skew: 0.16, strokeW: 5, stroke: '#3a1200', shadow: 0, rot: -0.07 });
  superText(g, 'The A.I. Coding Agent', W / 2, 466, { font: FONT.serif, weight: 700, italic: true, size: 78, fill: fills.yellow, strokeW: 9, shadow: 6 });

  // screenshot, tilted, with a print border
  g.save(); g.translate(W * 0.5, 760); g.rotate(-0.06);
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(-268, -190, 560, 400);
  g.fillStyle = '#fff'; g.fillRect(-286, -206, 560, 400);
  g.fillStyle = '#008080'; g.fillRect(-276, -196, 540, 380);
  drawMiniWindow(g, -236, -166, 460, 310);
  g.restore();

  // offer bursts
  burst(g, 190, 1010, { r: 176, points: 18, rot: 0.1, colors: ['#ff8a70', '#f0142a', '#8a0010'], lineW: 9 });
  superText(g, '14', 190, 1008, { font: FONT.impact, size: 140, fill: fills.yellow, rot: -0.12, strokeW: 12, shadow: 6 });
  superText(g, 'CD-ROMs!', 190, 1080, { font: FONT.impact, size: 62, fill: fills.white, rot: -0.12, strokeW: 8, shadow: 4 });
  burst(g, 850, 1040, { r: 150, points: 14, rot: -0.2, colors: ['#fffbd0', '#ffe600', '#f09a00'], stroke: '#000', lineW: 7 });
  superText(g, '500', 850, 1036, { font: FONT.impact, size: 104, fill: fills.red, rot: 0.1, strokeW: 9, stroke: '#fff', shadow: 0 });
  superText(g, 'FREE HOURS', 850, 1086, { font: FONT.impact, size: 44, fill: '#101010', rot: 0.1, stroke: null, shadow: 0 });

  // bottom strip
  g.fillStyle = '#f2f2f2'; g.fillRect(0, H - 86, W, 86);
  g.fillStyle = '#e8112d'; g.fillRect(0, H - 92, W, 8);
  g.fillStyle = '#101010'; g.font = `400 40px ${FONT.black}`; g.textAlign = 'left';
  g.fillText('CD-ROM', 40, H - 30);
  g.font = `700 30px ${FONT.sans}`;
  g.fillText('for your home PC', 250, H - 32);
  g.textAlign = 'right'; g.font = `400 34px ${FONT.black}`; g.fillStyle = '#0a2fc0';
  g.fillText('56K MODEM REQUIRED', W - 40, H - 30);
  return c;
}

export function boxSpineCanvas(W = 256, H = 1280) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = vgrad(g, 0, H, [[0, '#02062a'], [0.5, '#0a2fc0'], [1, '#02062a']]); g.fillRect(0, 0, W, H);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, 92); g.fillStyle = '#ffe600'; g.fillRect(0, 92, W, 8);
  g.save(); g.translate(W / 2 + 46, H / 2 + 20); g.rotate(Math.PI / 2);
  superText(g, 'DIAL-A-DEV', -90, 0, { font: FONT.impact, size: 150, fill: fills.white, skew: 0.16, strokeW: 10, shadow: 6 });
  superText(g, '98', 330, 0, { font: FONT.impact, size: 170, fill: fills.yellow, skew: 0.16, strokeW: 10, shadow: 6 });
  g.restore();
  g.fillStyle = '#f2f2f2'; g.fillRect(0, H - 86, W, 86); g.fillStyle = '#e8112d'; g.fillRect(0, H - 92, W, 8);
  g.fillStyle = '#101010'; g.font = `400 30px ${FONT.black}`; g.textAlign = 'center'; g.fillText('CD-ROM', W / 2, H - 32);
  return c;
}

const tex = (canvas) => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; return t; };

/** The retail big box, standing on y = 0. Size: 1.6 wide, 2.0 tall, 0.4 deep. */
export function makeBox() {
  const w = 1.6, h = 2.0, d = 0.4;
  const geo = new RoundedBoxGeometry(w, h, d, 3, 0.012);
  const front = tex(boxFrontCanvas());
  const spine = tex(boxSpineCanvas());
  const plain = (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, clearcoat: 0.9, clearcoatRoughness: 0.12 });
  const art = (map) => new THREE.MeshPhysicalMaterial({ map, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.0 });
  // box material order: +x, -x, +y, -y, +z, -z
  const mats = [art(spine), art(spine), plain('#0a1d7a'), plain('#020418'), art(front), plain('#06103a')];
  const mesh = new THREE.Mesh(geo, mats);
  mesh.position.y = h / 2;
  const group = new THREE.Group();
  group.add(mesh);
  // shrink-wrap glare: a bright diagonal band that can sweep across the front (uSweep from about -0.7 to 2.2)
  const glare = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uSweep: { value: -1 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uSweep; varying vec2 vUv; void main() { float d = vUv.x + vUv.y * 0.55 - uSweep; float band = exp(-d * d * 70.0) + 0.6 * exp(-(d - 0.2) * (d - 0.2) * 700.0); gl_FragColor = vec4(vec3(1.0, 1.0, 1.06) * band * 1.5, 1.0); }',
  }));
  glare.position.set(0, h / 2, d / 2 + 0.004);
  group.add(glare);
  group.userData = { w, h, d, glare: glare.material };
  return group;
}
