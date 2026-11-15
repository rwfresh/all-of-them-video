// One WebGL renderer for the whole film. A browser keeps only a few WebGL contexts alive at once, so shots that need
// the GPU share this one: draw with it, then copy the result onto your own 2D canvas with blitGL(g, R).
// Do NOT copy with g.drawImage(R.domElement): about one frame in a few hundred it returns the frame before (seen in
// the Synthwave shot, a different frame each run). blitGL reads the pixels back, which is exact every time.

import * as THREE from 'three';

let R = null;

/** The shared three.js renderer, reset to a known state. Call this at the start of every use. */
export function useGL(W = 1920, H = 1080) {
  if (!R) {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    R.setPixelRatio(1);
    R.setSize(W, H, false);
  }
  R.setRenderTarget(null);
  R.setViewport(0, 0, W, H);
  R.setScissorTest(false);
  R.autoClear = true;
  R.setClearColor(0x000000, 0);
  R.toneMapping = THREE.NoToneMapping;
  R.toneMappingExposure = 1;
  R.outputColorSpace = THREE.SRGBColorSpace;
  R.shadowMap.enabled = false;
  R.localClippingEnabled = false;
  return R;
}

const quadScene = new THREE.Scene();
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
quad.frustumCulled = false;
quadScene.add(quad);

/** Draw one full-frame shader (a THREE.ShaderMaterial; its vertex shader can be FULLSCREEN_VERT) to the current target. */
export function drawQuad(renderer, material) {
  quad.material = material;
  renderer.render(quadScene, quadCam);
}

export const FULLSCREEN_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

let rb = null;
/**
 * Copy what the shared renderer has just drawn (to its canvas, not a render target) onto a 2D context, exactly.
 * By default the copy is opaque. Pass { alpha: true } to keep transparency, for a GL layer over 2D drawing.
 */
export function blitGL(g, renderer, o = {}) {
  const gl = renderer.getContext(), W = renderer.domElement.width, H = renderer.domElement.height;
  if (!rb || rb.W !== W || rb.H !== H) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const cg = c.getContext('2d'), img = cg.createImageData(W, H);
    rb = { W, H, c, cg, img, bytes: new Uint8Array(img.data.buffer), u32: new Uint32Array(img.data.buffer) };
  }
  renderer.setRenderTarget(null);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, rb.bytes);
  if (o.alpha) {
    // the drawing buffer holds premultiplied colour; a 2D canvas wants it straight
    const b = rb.bytes;
    for (let i = 0; i < b.length; i += 4) {
      const a = b[i + 3];
      if (a && a < 255) { const f = 255 / a; b[i] = Math.min(255, b[i] * f); b[i + 1] = Math.min(255, b[i + 1] * f); b[i + 2] = Math.min(255, b[i + 2] * f); }
    }
  } else for (let i = 0; i < rb.u32.length; i++) rb.u32[i] |= 0xff000000;
  rb.cg.putImageData(rb.img, 0, 0);
  g.save();
  g.translate(0, H); g.scale(1, -1);                 // WebGL rows run bottom to top
  g.drawImage(rb.c, 0, 0);
  g.restore();
}

export { THREE };
