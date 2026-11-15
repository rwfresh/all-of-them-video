// Roadside palms: dark silhouettes with a pink rim of sunlight, standing on the verge and travelling with the grid.
// One palm is drawn once on a canvas (alpha = the silhouette, red = the rim light); every palm in the two rows is that
// drawing on a plane. They are far enough out that they leave the frame before they reach the title's depth, so the
// title is never covered.

import * as THREE from 'three';

/** Draw the palm. The trunk's foot is at the bottom, the crown leans a little toward +x (the sun's side). */
export function drawPalm(canvas) {
  const cw = canvas.width, ch = canvas.height;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, cw, ch);
  const u = cw / 512;                                   // drawn for a 512 x 768 canvas
  const C = { x: 268 * u, y: 250 * u };                 // the crown
  const foot = { x: 226 * u, y: ch + 4 };
  const mid = { x: 220 * u, y: 520 * u };
  const trunk = (t) => {
    const a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t;
    return { x: a * foot.x + b * mid.x + c * C.x, y: a * foot.y + b * mid.y + c * C.y };
  };
  const trunkPath = (side) => {
    // side 0: the whole trunk; side 1: only its sunward edge (for the rim)
    const L = [], Rr = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, p = trunk(t), q = trunk(Math.min(1, t + 0.01)), o = trunk(Math.max(0, t - 0.01));
      const dx = q.x - o.x, dy = q.y - o.y, n = Math.hypot(dx, dy) || 1;
      const w = (12 - 5.5 * t + 1.0 * Math.sin(t * 46)) * u;           // tapering, with the rings of old frond scars
      L.push([p.x + (dy / n) * w, p.y - (dx / n) * w]);
      Rr.push([p.x - (dy / n) * w, p.y + (dx / n) * w]);
    }
    return side ? Rr : [...L, ...Rr.reverse()];
  };
  // fronds: each leaves the crown at an angle from straight up and is pulled down by its own weight
  const FRONDS = [
    { a: -132, L: 150, g: 0.30 }, { a: -104, L: 200, g: 0.50 }, { a: -76, L: 228, g: 0.64 }, { a: -50, L: 240, g: 0.78 },
    { a: -27, L: 212, g: 0.66 }, { a: 5, L: 176, g: 0.50 }, { a: 33, L: 218, g: 0.64 }, { a: 56, L: 244, g: 0.76 },
    { a: 82, L: 230, g: 0.62 }, { a: 108, L: 196, g: 0.48 }, { a: 134, L: 146, g: 0.30 },
  ];
  const spine = (f, t) => {
    const r = (f.a * Math.PI) / 180, L = f.L * u;
    return { x: C.x + Math.sin(r) * L * t, y: C.y - Math.cos(r) * L * t + f.g * L * t * t };
  };
  g.fillStyle = '#000';
  g.strokeStyle = '#000';
  g.lineJoin = 'round'; g.lineCap = 'round';
  // trunk
  g.beginPath();
  trunkPath(0).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath(); g.fill();
  // crown: each frond is one blade with a toothed edge, its leaflets hanging from the spine on both sides
  const N = 34;
  for (const f of FRONDS) {
    const A = [], B = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, p = spine(f, t), q = spine(f, Math.min(1, t + 0.02)), o = spine(f, Math.max(0, t - 0.02));
      let dx = q.x - o.x, dy = q.y - o.y; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
      const len = (10 + 60 * Math.sin(Math.PI * Math.min(1, 0.06 + t * 0.98)) ** 0.75) * u * (i % 2 ? 1 : 0.62);
      for (const [arr, s] of [[A, 1], [B, -1]]) {
        let tx = -dy * s * 0.55 + dx * 0.35, ty = dx * s * 0.55 + dy * 0.35 + 0.78;
        const tn = Math.hypot(tx, ty); tx /= tn; ty /= tn;
        // the side of the spine that faces the sky carries short leaflets, the side that faces the ground long ones
        const k = dx * s > 0 ? 1 : 0.5 + 0.5 * Math.abs(dy);
        arr.push([p.x + tx * len * k, p.y + ty * len * k]);
      }
    }
    g.beginPath();
    A.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    B.reverse().forEach(([x, y]) => g.lineTo(x, y));
    g.closePath(); g.fill();
    g.lineWidth = 6 * u;
    g.beginPath();
    for (let i = 0; i <= 24; i++) { const p = spine(f, i / 24); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }
    g.stroke();
  }
  // the heart of the crown
  g.beginPath(); g.ellipse(C.x, C.y + 6 * u, 20 * u, 15 * u, 0, 0, Math.PI * 2); g.fill();

  // rim light, in the red channel: the sunward edge of the trunk and the spines of the fronds, fading toward the tips
  g.globalCompositeOperation = 'source-atop';
  g.strokeStyle = 'rgb(255,0,0)';
  g.lineWidth = 4.2 * u;
  g.globalAlpha = 1;
  g.beginPath();
  trunkPath(1).forEach(([x, y], i) => (i ? g.lineTo(x - 1.2 * u, y) : g.moveTo(x - 1.2 * u, y)));
  g.stroke();
  for (const f of FRONDS) {
    const k = f.a > -30 ? 1 : 0.55;                    // fronds on the far side catch less
    g.lineWidth = 3.6 * u;
    for (let i = 1; i < 24; i++) {
      const p = spine(f, i / 24), q = spine(f, (i + 1) / 24);
      g.globalAlpha = k * (1 - 0.7 * (i / 24));
      g.beginPath(); g.moveTo(p.x, p.y - 1.2 * u); g.lineTo(q.x, q.y - 1.2 * u); g.stroke();
    }
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  return canvas;
}

const PALM_VERT = /* glsl */`
varying vec2 vUv;
varying vec3 vW;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const PALM_FRAG = /* glsl */`
uniform sampler2D tPalm;
uniform vec3 uCam, uBody, uRim, uHaze;
uniform float uAlpha, uRimGain, uGain;
varying vec2 vUv;
varying vec3 vW;
void main() {
  vec4 t = texture2D(tPalm, vUv);
  float dist = length(vW.xz - uCam.xz);
  float fog = exp(-max(dist - 18.0, 0.0) * 0.03);
  vec3 c = uBody + uRim * t.r * uRimGain;
  gl_FragColor = vec4(mix(uHaze, c, fog) * uGain, t.a * uAlpha);
}`;

/**
 * Two rows of palms beside the road. update(scroll, cam, o) places them for the lattice's scroll, so they travel with
 * the ground: a pair every `spacing` rows, `phase` rows ahead of the lattice's zero.
 */
export function makePalms(makeCanvas, o = {}) {
  const N = o.pairs ?? 9, SP = o.spacing ?? 8, X = o.x ?? 7.5, H = o.height ?? 3.0, PH = o.phase ?? 0;
  const canvas = drawPalm(makeCanvas(512, 768));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  const geo = new THREE.PlaneGeometry(H * (512 / 768), H);
  geo.translate(0, H / 2, 0);                                    // the foot at the origin
  const group = new THREE.Group();
  const palms = [];
  for (let i = 0; i < N; i++) {
    for (const side of [-1, 1]) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: PALM_VERT, fragmentShader: PALM_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: {
          tPalm: { value: tex }, uCam: { value: new THREE.Vector3() }, uAlpha: { value: 1 }, uGain: { value: 1 },
          uBody: { value: new THREE.Vector3(0.0, 0.0, 0.004) }, uRim: { value: new THREE.Vector3(1.0, 0.07, 0.55) },
          uRimGain: { value: 1.5 }, uHaze: { value: new THREE.Vector3(0.30, 0.018, 0.25) },
        },
      });
      const m = new THREE.Mesh(geo, mat);
      m.scale.x = -side;                                         // the left row's crowns lean right, toward the sun
      m.frustumCulled = false;
      group.add(m);
      palms.push({ m, i, side, seed: (i * 7 + (side > 0 ? 3 : 0)) % 11 });
    }
  }
  const NEAR = 6, SPAN = SP * N;
  function update(scroll, cam, p = {}) {
    for (const pl of palms) {
      const raw = PH - SP * pl.i + scroll;
      const z = NEAR - ((((NEAR - raw) % SPAN) + SPAN) % SPAN);  // in (NEAR - SPAN, NEAR]
      pl.m.position.set(pl.side * X, -0.12, z);
      pl.m.rotation.z = (0.022 * Math.sin((p.time ?? 0) * 1.3 + pl.seed) + 0.012 * Math.sin((p.time ?? 0) * 2.9 + pl.seed * 2.1)) * -pl.side;
      // a palm comes out of the haze over three rows, just clear of where the neon script will be
      const far = THREE.MathUtils.smoothstep(z, p.fadeFar ?? -19.5, p.fadeNear ?? -16.5);
      const u = pl.m.material.uniforms;
      u.uAlpha.value = far;
      u.uGain.value = p.gain ?? 1;
      u.uRimGain.value = p.rim ?? 1.5;
      u.uCam.value.copy(cam.position);
      pl.m.visible = far > 0.004 && z < cam.position.z - 0.5;
    }
  }
  return { group, update, canvas };
}
