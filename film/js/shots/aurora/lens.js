// The last pass of the Aurora shot, on the film's one WebGL renderer: the liquid-glass lens, then grain.
//
// The lens is a real refraction, not a zoomed copy. The glass is a shallow dome with a rounded bevel at its rim; for
// every pixel the surface normal is worked out, the ray from the eye is bent by Snell's law (GLSL refract) and followed
// down through the glass to the picture underneath. Nine rays are bent with slightly different indices, red end to
// blue end: in the middle they agree, so the picture is simply magnified; at the bevel they part, which is the band
// of colour at the rim. On top: a bright edge toward the key light, a softer one opposite, and a shadow on the picture.
// Before it is glass (uK = 0) it is drawn as what it was: one highlight of the picture before, out of focus.
//
// Grain is added last, after everything, so that no gradient in the picture can band.

import * as THREE from 'three';
import { drawQuad, FULLSCREEN_VERT } from '../../gl.js';

const FRAG = /* glsl */`
precision highp float;
uniform sampler2D tScene;
uniform vec2 uRes;
uniform vec3 uLens;      // centre (frame pixels, y down) and radius
uniform float uK;        // 0: only a soft disc of light. 1: glass
uniform float uA;        // how much of it is there at all
uniform vec3 uTint;      // the colour of the highlight it was
uniform vec2 uSquash;    // the lens drawn out a little along its travel: unit direction * amount
uniform float uSeed, uGrain, uVig;
varying vec2 vUv;

// an integer hash (PCG): no pattern in it at any scale, which a grain over smooth light must not have
uint pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float rnd(uvec2 p, uint k) { return float(pcg(p.x + pcg(p.y + pcg(k)))) / 4294967295.0; }
vec3 scene(vec2 px) { return texture2D(tScene, vec2(px.x / uRes.x, 1.0 - px.y / uRes.y)).rgb; }

void main() {
  vec2 px = vec2(vUv.x * uRes.x, (1.0 - vUv.y) * uRes.y);
  vec3 col = scene(px);
  float R = uLens.z;
  if (R > 1.0) {
    vec2 d = px - uLens.xy;
    // liquid: stretched slightly along the way it is moving
    float along = dot(d, normalize(uSquash + vec2(1e-5, 0.0)));
    float amt = length(uSquash);
    d -= normalize(uSquash + vec2(1e-5, 0.0)) * along * amt;
    float len = length(d), r = len / R;
    vec2 dir = d / max(len, 1e-3);

    float inside = (1.0 - smoothstep(1.0 - 1.2 / R, 1.0 + 1.2 / R, r)) * uA;

    // its shadow on the picture, down and to the right, and the light it gathers into that shadow
    float sd = length(d - vec2(0.07, 0.15) * R) / R;
    float shadow = (1.0 - smoothstep(0.82, 1.36, sd)) * 0.34 * uK;
    float caustic = exp(-pow(length(d - vec2(0.46, 0.60) * R * 1.52) / (R * 0.20), 2.0)) * 0.10 * uK;
    col = col * (1.0 - shadow * (1.0 - inside)) + caustic * (1.0 - inside) * vec3(0.75, 0.9, 1.0);

    if (inside > 0.0) {
      float rr = min(r, 1.0);
      float bevel = smoothstep(0.64, 1.0, rr);
      float slope = (0.52 * rr + 2.1 * bevel * bevel * bevel) * uK;
      vec3 n = normalize(vec3(dir * slope, 1.0));
      vec3 acc = vec3(0.0), wsum = vec3(0.0);
      for (int i = 0; i < 9; i++) {
        float f = float(i) / 8.0;                                        // red end 0 .. blue end 1
        float ior = 1.5 + (f - 0.5) * (0.012 + 0.32 * bevel);
        vec3 T = refract(vec3(0.0, 0.0, -1.0), n, 1.0 / ior);
        vec2 off = T.xy / max(-T.z, 0.3) * R;                            // the glass is as deep as its radius
        vec3 w = max(vec3(1.0 - smoothstep(0.0, 0.62, f), 1.0 - abs(f - 0.5) * 2.2, smoothstep(0.38, 1.0, f)), 0.0);
        acc += scene(px + off) * w; wsum += w;
      }
      vec3 g = acc / wsum;

      vec2 L = normalize(vec2(-0.56, -0.83));                            // the key light, upper left
      float facing = dot(dir, L);
      float edge = smoothstep(0.915, 0.972, rr) * (1.0 - smoothstep(0.988, 1.0, rr));
      float key = pow(max(facing, 0.0), 4.0) * edge * 1.15;
      float fill = pow(max(-facing, 0.0), 2.5) * smoothstep(0.80, 0.975, rr) * (1.0 - smoothstep(0.988, 1.0, rr)) * 0.34;
      float ring = (1.0 - smoothstep(0.0, 1.5, abs(len - (R - 1.5)))) * 0.30;
      // the soft window of the key light, lying on the dome
      vec2 wq = (d / R - vec2(-0.40, -0.47)); wq = vec2(dot(wq, vec2(0.83, -0.56)), dot(wq, vec2(0.56, 0.83)));
      float window = exp(-(wq.x * wq.x * 5.5 + wq.y * wq.y * 38.0)) * 0.11;
      // thick glass is a little darker just inside its rim, away from the light
      float shade = smoothstep(0.62, 0.95, rr) * (1.0 - smoothstep(0.95, 1.0, rr)) * (0.5 - 0.5 * facing) * 0.11;

      // the light that came in at the upper left gathers inside the far rim, in the colour of what is under the glass
      float gather = pow(max(-facing, 0.0), 1.6) * smoothstep(0.40, 0.90, rr) * (1.0 - smoothstep(0.90, 0.995, rr));
      g = g * (1.0 + 0.05 * uK) * (1.0 - shade * uK) + vec3(0.006, 0.008, 0.018) * uK;
      g += gather * (g * 0.9 + vec3(0.05, 0.09, 0.16)) * uK;
      g += (key * vec3(1.0, 0.98, 0.96) + fill * vec3(0.72, 0.9, 1.0) + ring + window) * uK;
      // before it is glass it is one more highlight out of focus: a disc of light with an edge, like the others
      float disc = (0.7 + 0.3 * exp(-pow((rr - 0.95) / 0.04, 2.0))) * clamp((1.0 - rr) / 0.028, 0.0, 1.0);
      g = mix(col + (1.0 - col) * uTint * 0.42 * disc, g, smoothstep(0.0, 1.0, uK));
      col = mix(col, g, inside);
    }
  }
  vec2 q = (vUv - 0.5) * vec2(1.0, 0.86);
  col *= 1.0 - uVig * smoothstep(0.34, 0.86, length(q));
  uvec2 ip = uvec2(gl_FragCoord.xy); uint k = uint(uSeed);
  float n = rnd(ip, k) + rnd(ip, k + 7919u) - 1.0;                                          // triangular, -1 to 1
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col += n * uGrain * mix(1.0, 0.5, smoothstep(0.25, 0.95, lum));
  gl_FragColor = vec4(col, 1.0);
}`;

export function makeLensPass(canvas, W, H) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  const uniforms = {
    tScene: { value: tex }, uRes: { value: new THREE.Vector2(W, H) }, uLens: { value: new THREE.Vector3(0, 0, 0) },
    uK: { value: 0 }, uA: { value: 0 }, uTint: { value: new THREE.Vector3(1, 0.9, 0.93) }, uSquash: { value: new THREE.Vector2(0, 0) }, uSeed: { value: 0 }, uGrain: { value: 0 }, uVig: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: FRAG, uniforms, depthTest: false, depthWrite: false });
  return {
    /** Draw the picture in `canvas` through the lens to the renderer's own canvas. o: { x, y, r, k, a, sx, sy, seed, grain, vig } */
    draw(R, o) {
      tex.needsUpdate = true;
      uniforms.uLens.value.set(o.x, o.y, o.r);
      uniforms.uK.value = o.k;
      uniforms.uA.value = o.a ?? 1;
      if (o.tint) uniforms.uTint.value.set(o.tint[0] / 255, o.tint[1] / 255, o.tint[2] / 255);
      uniforms.uSquash.value.set(o.sx || 0, o.sy || 0);
      uniforms.uSeed.value = o.seed;
      uniforms.uGrain.value = o.grain;
      uniforms.uVig.value = o.vig;
      R.setRenderTarget(null);
      drawQuad(R, material);
    },
  };
}
