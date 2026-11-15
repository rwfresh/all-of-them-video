// Shared 3D kit: fonts, extruded lettering, the chrome and compact-disc materials, the studio backdrop.

import * as THREE from 'three';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';

export async function loadFonts() {
  const l = new TTFLoader();
  const [anton, archivo, serif] = await Promise.all([
    l.loadAsync('/assets/fonts/Anton-Regular.ttf'),
    l.loadAsync('/assets/fonts/ArchivoBlack-Regular.ttf'),
    l.loadAsync('/assets/fonts/LiberationSerif-BoldItalic.ttf'),
  ]);
  return { anton: new Font(anton), archivo: new Font(archivo), serif: new Font(serif) };
}

/**
 * Extruded letters, one mesh per character so each can move on its own.
 * Returns { group, letters: [{ mesh, x, w, ch }], width, height }. The word is centred on the origin.
 */
export function makeLetters(font, text, material, o = {}) {
  const size = o.size ?? 1, depth = o.depth ?? 0.35, bevel = o.bevel ?? 0.035, tracking = o.tracking ?? 0;
  const scale = size / font.data.resolution;
  const group = new THREE.Group();
  const letters = [];
  let x = 0, yMin = Infinity, yMax = -Infinity;
  for (const ch of text) {
    const g = font.data.glyphs[ch] || font.data.glyphs['?'];
    const adv = g.ha * scale;
    if (ch !== ' ') {
      const shapes = font.generateShapes(ch, size);
      const geo = new THREE.ExtrudeGeometry(shapes, {
        depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.85, bevelOffset: 0,
        bevelSegments: o.bevelSegments ?? 6, curveSegments: o.curveSegments ?? 14,
      });
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      // centre each letter on its own origin so it can spin and scale about its middle
      const cx = (bb.min.x + bb.max.x) / 2;
      geo.translate(-cx, 0, -depth / 2);
      yMin = Math.min(yMin, bb.min.y); yMax = Math.max(yMax, bb.max.y);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.x = x + cx;
      let outline = null;
      if (o.outline) {
        // a slightly fatter copy just behind the letter: reads as a dark keyline that separates it from the backdrop
        outline = new THREE.ExtrudeGeometry(shapes, {
          depth, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelOffset: o.outline, bevelSegments: 1,
          curveSegments: o.curveSegments ?? 14,
        });
        outline.translate(-cx, 0, -depth / 2 - bevel - 0.02);
        mesh.add(new THREE.Mesh(outline, o.outlineMaterial));
      }
      letters.push({ mesh, x: x + cx, w: bb.max.x - bb.min.x, ch, outline });
      group.add(mesh);
    }
    x += adv + tracking;
  }
  const width = x - tracking;
  const cy = (yMin + yMax) / 2;
  for (const l of letters) {
    l.mesh.geometry.translate(0, -cy, 0);
    if (l.outline) l.outline.translate(0, -cy, 0);
    l.x -= width / 2; l.mesh.position.x = l.x;
  }
  return { group, letters, width, height: yMax - yMin, depth, bevel };
}

const CHROME_VERT = /* glsl */`
varying vec3 vWorldPos, vWorldN, vObj, vUp, vRight;
void main() {
  vObj = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  mat3 m = mat3(modelMatrix);
  vWorldN = normalize(transpose(inverse(m)) * normal);
  vUp = normalize(m * vec3(0.0, 1.0, 0.0));
  vRight = normalize(m * vec3(1.0, 0.0, 0.0));
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

// The classic sky-over-desert chrome: the reflection is a sharp horizon, blue above, warm below. Flat faces are
// "pillowed" (the normal bends with height) so every letter face sweeps from sky to ground through the horizon line.
const CHROME_FRAG = /* glsl */`
uniform vec3 uSky0, uSky1, uSky2, uGnd0, uGnd1, uGnd2, uTint, uSideA, uSideB;
uniform float uHalfH, uBend, uBendX, uEnvRot, uHorizon, uGain, uFrontZ, uBevel, uGlint, uGlintX, uWave, uSoftbox;
varying vec3 vWorldPos, vWorldN, vObj, vUp, vRight;
vec3 env(vec3 r) {
  float a = uEnvRot;
  r.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * r.xz;
  float az = atan(r.z, r.x);
  float y = r.y - uHorizon + uWave * (sin(az * 5.0) * 0.5 + sin(az * 11.0 + 1.3) * 0.25);
  vec3 sky = mix(uSky2, mix(uSky1, uSky0, smoothstep(0.12, 0.85, y)), smoothstep(0.0, 0.14, y));
  vec3 gnd = mix(uGnd0, mix(uGnd1, uGnd2, smoothstep(-0.2, -0.85, y)), smoothstep(0.0, -0.2, y));
  vec3 c = y > 0.0 ? sky : gnd;
  c += vec3(3.0, 2.9, 2.7) * exp(-abs(y) * 90.0) * step(0.0, y);          // hot horizon line
  // studio softboxes: two bright strips high in the sky give moving speculars
  float sb = smoothstep(0.972, 0.996, cos(az - 0.9)) + 0.7 * smoothstep(0.98, 0.997, cos(az + 2.2));
  c += vec3(4.0, 4.2, 5.0) * sb * smoothstep(0.10, 0.2, y) * smoothstep(0.95, 0.7, y) * uSoftbox;
  return c;
}
void main() {
  vec3 N = normalize(vWorldN);
  if (!gl_FrontFacing) N = -N;
  float h = clamp(vObj.y / uHalfH, -1.2, 1.2);
  // how deep into the extrusion this fragment is: 0 on the face and bevel, 1 on the side walls
  float side = smoothstep(uFrontZ - uBevel * 1.15, uFrontZ - uBevel * 2.2, vObj.z);
  vec3 Nb = normalize(N + (vUp * h * uBend + vRight * vWorldPos.x * uBendX) * (1.0 - side));
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 R = reflect(-V, Nb);
  float fres = pow(1.0 - max(dot(Nb, V), 0.0), 5.0);
  vec3 face = env(R) * mix(uTint, vec3(1.0), fres) * uGain;
  // travelling glint: a bright bar that sweeps across the word (object-space x in world units)
  float gx = vWorldPos.x + vWorldPos.y * 0.45 - uGlintX;
  face += vec3(9.0, 9.5, 11.0) * uGlint * exp(-gx * gx * 26.0) * (1.0 - side);
  // side walls: deep saturated colour falling to black with depth, with a soft top light
  float d = clamp((uFrontZ - vObj.z) / max(uFrontZ * 2.0, 1e-3), 0.0, 1.0);
  vec3 wall = mix(uSideA, uSideB, smoothstep(0.0, 1.0, d)) * (0.35 + 0.65 * max(dot(N, normalize(vec3(0.3, 0.9, 0.5))), 0.0));
  wall += env(reflect(-V, N)) * 0.06;
  gl_FragColor = vec4(mix(face, wall, side), 1.0);
}`;

const lin = (hex) => new THREE.Color(hex);   // three converts sRGB hex to linear working space

const CHROME_LOOKS = {
  chrome: {
    sky: ['#0a2aa8', '#2f7cf0', '#d0ecff'], gnd: ['#0c0402', '#8a3c0e', '#ffe2a0'], tint: '#f4f6ff',
    side: ['#040c52', '#01020a'],
  },
  gold: {
    sky: ['#5e2a00', '#e79418', '#fff6c4'], gnd: ['#2a0e00', '#b4610c', '#ffdf7a'], tint: '#ffd27a',
    side: ['#b3260e', '#1a0202'],
  },
  red: {
    sky: ['#5a0008', '#ff2a2a', '#ffd0c4'], gnd: ['#1a0003', '#9a0a12', '#ff8a6a'], tint: '#ff9a8a',
    side: ['#6a0010', '#120003'],
  },
};

export function chromeMaterial(look = 'chrome', o = {}) {
  const L = CHROME_LOOKS[look];
  return new THREE.ShaderMaterial({
    vertexShader: CHROME_VERT, fragmentShader: CHROME_FRAG, side: THREE.DoubleSide,
    uniforms: {
      uSky0: { value: lin(L.sky[0]) }, uSky1: { value: lin(L.sky[1]) }, uSky2: { value: lin(L.sky[2]) },
      uGnd0: { value: lin(L.gnd[0]) }, uGnd1: { value: lin(L.gnd[1]) }, uGnd2: { value: lin(L.gnd[2]) },
      uTint: { value: lin(L.tint) }, uSideA: { value: lin(L.side[0]) }, uSideB: { value: lin(L.side[1]) },
      uHalfH: { value: o.halfH ?? 0.5 }, uBend: { value: o.bend ?? 0.55 }, uEnvRot: { value: 0 },
      uHorizon: { value: o.horizon ?? 0 }, uGain: { value: o.gain ?? 1 }, uFrontZ: { value: o.frontZ ?? 0.2 },
      uBevel: { value: o.bevel ?? 0.035 }, uGlint: { value: 0 }, uGlintX: { value: 0 }, uWave: { value: o.wave ?? 0.035 },
      uBendX: { value: o.bendX ?? 0.05 }, uSoftbox: { value: o.softbox ?? 1 },
    },
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Studio backdrop: a full-frame shader behind everything. Royal-blue cyclorama, slow rotating light rays, sparkles.

const BACKDROP_FRAG = /* glsl */`
uniform float uTime, uRays, uGain, uAspect, uStars;
uniform vec2 uCenter;
uniform vec3 uInner, uOuter, uRayColor;
varying vec2 vUv;
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 p = (vUv - uCenter) * vec2(uAspect, 1.0);
  float r = length(p);
  float a = atan(p.y, p.x);
  vec3 c = mix(uInner, uOuter, smoothstep(0.0, 0.95, r));
  // rays: two counter-rotating sets, soft edged, fading toward the rim
  float r1 = smoothstep(0.15, 0.95, sin(a * 9.0 + uTime * 0.35) * 0.5 + 0.5);
  float r2 = smoothstep(0.35, 1.0, sin(a * 23.0 - uTime * 0.22 + 1.7) * 0.5 + 0.5);
  float rays = (r1 * 0.7 + r2 * 0.3) * smoothstep(0.02, 0.35, r) * smoothstep(1.35, 0.25, r);
  c += uRayColor * rays * uRays;
  // drifting haze
  c *= 0.86 + 0.28 * vnoise(p * 2.2 + vec2(uTime * 0.05, -uTime * 0.03));
  // hot core
  c += uRayColor * 0.55 * exp(-r * r * 9.0) * uRays;
  // sparkles
  vec2 g = vUv * vec2(uAspect, 1.0) * 26.0;
  vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  float rnd = hash21(id);
  float tw = pow(max(0.0, sin(uTime * (1.5 + rnd * 3.0) + rnd * 40.0)), 8.0);
  vec2 o = (vec2(hash21(id + 3.1), hash21(id + 7.7)) - 0.5) * 0.7;
  float d = length(f - o);
  float star = step(0.86, rnd) * tw * (exp(-d * d * 900.0) * 4.0 + exp(-abs(f.x - o.x) * 60.0) * exp(-abs(f.y - o.y) * 9.0) * 0.6 + exp(-abs(f.y - o.y) * 60.0) * exp(-abs(f.x - o.x) * 9.0) * 0.6);
  c += vec3(1.0, 1.0, 1.2) * star * uStars;
  gl_FragColor = vec4(c * uGain, 1.0);
}`;

export function makeBackdrop(o = {}) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
    fragmentShader: BACKDROP_FRAG, depthTest: false, depthWrite: false,
    uniforms: {
      uTime: { value: 0 }, uRays: { value: o.rays ?? 0.5 }, uGain: { value: o.gain ?? 1 }, uAspect: { value: 16 / 9 },
      uStars: { value: o.stars ?? 1 }, uCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uInner: { value: lin(o.inner ?? '#1840d8') }, uOuter: { value: lin(o.outer ?? '#01051e') },
      uRayColor: { value: lin(o.rayColor ?? '#3f7dff') },
    },
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}

// ---------------------------------------------------------------------------------------------------------------
// Additive sprites: 4-point star glints and lens flares, drawn in HDR so the bloom picks them up.

const GLINT_FRAG = /* glsl */`
uniform float uGain, uRot; uniform vec3 uColor;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float c = cos(uRot), s = sin(uRot); p = mat2(c, -s, s, c) * p;
  float r = length(p);
  float core = exp(-r * r * 60.0) * 3.0;
  float cross = exp(-abs(p.y) * 55.0) * exp(-abs(p.x) * 3.2) + exp(-abs(p.x) * 55.0) * exp(-abs(p.y) * 3.2);
  vec2 q = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p;
  float diag = (exp(-abs(q.y) * 70.0) * exp(-abs(q.x) * 6.5) + exp(-abs(q.x) * 70.0) * exp(-abs(q.y) * 6.5)) * 0.45;
  float halo = exp(-r * 5.0) * 0.25;
  float v = (core + cross + diag + halo) * smoothstep(1.0, 0.6, r);
  gl_FragColor = vec4(uColor * v * uGain, 1.0);
}`;

export function makeGlint(color = '#ffffff') {
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv;
      vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      vec2 sc = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
      mv.xy += position.xy * sc;
      gl_Position = projectionMatrix * mv; }`,
    fragmentShader: GLINT_FRAG, transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uGain: { value: 1 }, uRot: { value: 0 }, uColor: { value: lin(color) } },
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  m.frustumCulled = false;
  m.renderOrder = 900;
  return m;
}
