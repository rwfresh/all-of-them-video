// The desktop is drawn on a 960x540 canvas and shown on a glowing picture tube that a virtual camera films:
// hard pixels with clean edges, visible scanlines up close, a phosphor mask on tight push-ins, a little glass sheen.

import * as THREE from 'three';
import { UW, UH } from './ui98.js';

const FRAG = /* glsl */`
uniform sampler2D tUI;
uniform vec2 uRes;
uniform float uGain, uScan, uMask, uSat, uTime, uTint;
varying vec2 vUv;
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
void main() {
  vec2 px = vUv * uRes;
  // sharp-bilinear: pixels stay square but their edges are anti-aliased at any zoom
  vec2 fw = max(fwidth(px), vec2(1e-5));
  vec2 fl = floor(px - 0.5) + 0.5;
  vec2 fr = clamp((px - fl - 0.5) / fw + 0.5, 0.0, 1.0);
  vec3 c = toLinear(texture2D(tUI, (fl + fr) / uRes).rgb);
  // a neighbour-averaged copy gives the tube its soft halo
  vec3 soft = vec3(0.0);
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) soft += toLinear(texture2D(tUI, (floor(px) + 0.5 + vec2(float(i), float(j)) * 1.5) / uRes).rgb);
  c = mix(c, soft / 9.0, 0.16);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c = mix(c, c * vec3(1.0, 0.25, 0.2) + vec3(0.25, 0.0, 0.0) * l, uTint);       // red alert wash
  // scanlines fade out when a screen row is thinner than about two film pixels, so they never shimmer
  float vis = smoothstep(0.55, 0.22, fw.y);
  c *= 1.0 - uScan * vis * (0.5 - 0.5 * cos(px.y * 6.2831853)) * 0.55;
  // aperture grille, only on tight close-ups
  float mv = smoothstep(0.22, 0.07, fw.x) * uMask;
  vec3 tri = 0.5 + 0.5 * cos((px.x * 3.0 + vec3(0.0, 1.0, 2.0)) * 2.0943951);
  c *= mix(vec3(1.0), 0.45 + 1.1 * tri, mv);
  // glass: faint diagonal sheen and darker corners
  vec2 q = vUv * 2.0 - 1.0;
  c += vec3(0.5, 0.6, 0.8) * 0.018 * smoothstep(0.25, 0.0, abs(q.x * 0.6 + q.y + 0.55));
  c *= 1.0 - 0.16 * dot(q, q) * 0.5;
  gl_FragColor = vec4(c * uGain, 1.0);
}`;

const FOV = 30;
const D0 = (9 / 2) / Math.tan((FOV / 2) * Math.PI / 180);   // distance at which the screen fills the frame

/**
 * A stage holding the screen. `draw(g)` paints the desktop; `view` aims the camera in screen pixels:
 * { cx, cy, zoom, yaw, pitch, roll }. zoom 1 shows the whole desktop.
 */
export function makeScreenStage() {
  const canvas = document.createElement('canvas');
  canvas.width = UW; canvas.height = UH;
  const g = canvas.getContext('2d', { willReadFrequently: false });
  g.imageSmoothingEnabled = false;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: FRAG,
    uniforms: {
      tUI: { value: tex }, uRes: { value: new THREE.Vector2(UW, UH) }, uGain: { value: 1.25 }, uScan: { value: 1 },
      uMask: { value: 1 }, uSat: { value: 1 }, uTime: { value: 0 }, uTint: { value: 0 },
    },
  });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010103);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), mat);
  scene.add(screen);
  const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 200);

  function aim(v) {
    const zoom = v.zoom ?? 1;
    const tx = ((v.cx ?? UW / 2) / UW - 0.5) * 16, ty = (0.5 - (v.cy ?? UH / 2) / UH) * 9;
    const d = D0 / zoom;
    const yaw = v.yaw ?? 0, pitch = v.pitch ?? 0;
    cam.position.set(tx + Math.sin(yaw) * Math.cos(pitch) * d, ty + Math.sin(pitch) * d, Math.cos(yaw) * Math.cos(pitch) * d);
    cam.up.set(Math.sin(v.roll ?? 0), Math.cos(v.roll ?? 0), 0);
    cam.lookAt(tx, ty, 0);
  }

  return {
    scene, cam, canvas, g, tex, mat, aim,
    render(renderer, post, view, look = {}) {
      tex.needsUpdate = true;
      const u = mat.uniforms;
      u.uSat.value = look.sat ?? 1; u.uGain.value = look.gain ?? 1.25; u.uTint.value = look.tint ?? 0;
      aim(view);
      renderer.setRenderTarget(post.scene);
      renderer.render(scene, cam);
    },
  };
}
