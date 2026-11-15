// The small 3D things on the terminal's rows: the cursor (one of the pills) and the round bullets. Each is lit in the
// shot's own studio and photographed once, straight on, into a sheet of sprites, so it sits exactly on the film's grid
// and can still pop, squash and cast a soft shadow. (The words themselves are set flat in the film's mono: crisp, dark
// plum on cream.)

import * as THREE from 'three';

const ADV = 36;                              // the film's grid: one letter every 36 px
const PAD = 14, ASC = 70, DESC = 26;         // a cell: the letter's advance plus padding; room above and below the baseline
const CW = ADV + PAD * 2, CH = ASC + DESC, S = 2;   // sprites are photographed at twice their size

export const INK = { plum: '#4A2B5E', soft: '#5d3d74', pink: '#e62a66' };

export async function makeSprites(ctx, env) {
  const { W, H, useGL, blitGL, makeCanvas } = ctx;

  const ballMat = (hex, glow = 0) => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.06, emissive: hex, emissiveIntensity: glow });
  const ball = (hex, glow) => () => { const m = new THREE.Mesh(new THREE.SphereGeometry(12.5, 40, 24), ballMat(hex, glow)); m.position.set(18, 19, 0); return m; };
  const jobs = new Map([
    // bullets: a small ball, grey while the tool runs, mint when it is done, plum when Claude speaks
    ['dotDone', ball('#35c98f', 0.12)], ['dotRun', ball('#a892b4', 0)], ['dotSay', ball(INK.plum, 0)],
    // the cursor: a pill of candy, the cursor block's size
    ['pill', () => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(17, 30, 24, 48), ballMat('#ff5a8a', 0.22)); m.position.set(18, 20.5, 0); return m; }],
  ]);

  // the little studio: the shot's softboxes for reflections, one key from the upper left
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentRotation.set(0.75, 0.2, 0);
  scene.environmentIntensity = 0.55;
  const key = new THREE.DirectionalLight('#fff4ec', 2.6);
  key.position.set(-0.55, 0.9, 0.75);
  scene.add(key, new THREE.HemisphereLight('#ffffff', '#ffc4d4', 1.1));
  const cam = new THREE.OrthographicCamera(-PAD, ADV + PAD, ASC, -DESC, -200, 200);
  cam.position.z = 100;

  const cells = new Map();
  const sheet = makeCanvas(W, H), sg = sheet.getContext('2d', { willReadFrequently: true });
  /** Photograph them all onto the shared canvas, cell by cell, and copy the sheet out. True if every cell has something in it. */
  function shoot() {
    const R = useGL();
    const cols = Math.floor(W / (CW * S));
    R.setClearColor(0x000000, 0);
    R.clear();
    R.setScissorTest(true);
    let i = 1;                                  // the first cell is a throwaway: the first draw with new materials can come out empty
    const list = [['warm', jobs.get('pill')], ...jobs];
    for (const [name, build] of list) {
      const n = name === 'warm' ? 0 : i++;
      const cx = (n % cols) * CW * S, cy = Math.floor(n / cols) * CH * S;        // from the bottom left, as WebGL counts
      const mesh = build();
      scene.add(mesh);
      R.setViewport(cx, cy, CW * S, CH * S);
      R.setScissor(cx, cy, CW * S, CH * S);
      R.render(scene, cam);
      scene.remove(mesh);
      mesh.geometry.dispose();
      if (name !== 'warm') cells.set(name, { x: cx, y: H - cy - CH * S });
    }
    R.setScissorTest(false);
    R.setViewport(0, 0, W, H);
    R.getContext().finish();
    sg.clearRect(0, 0, W, H);
    blitGL(sg, R, { alpha: true });
    R.clear();
    for (const c of cells.values()) {
      const d = sg.getImageData(c.x + CW * S / 2 - 8, c.y + CH * S / 2 - 8, 16, 16).data;
      let a = 0;
      for (let k = 3; k < d.length; k += 4) a += d[k];
      if (a < 255 * 8) return false;
    }
    return true;
  }
  for (let tries = 0; tries < 4 && !shoot(); tries++) await new Promise((r) => setTimeout(r, 30));

  /**
   * Draw one sprite with its cell's left edge at x and its baseline at y.
   * o: { sx, sy } squash about the foot, { dy } lift, { alpha }, { shadow: [colour, blur, offsetY] }.
   */
  function put(g, name, x, y, o = {}) {
    const c = cells.get(name);
    if (!c) return;
    g.save();
    if (o.alpha !== undefined) g.globalAlpha *= o.alpha;
    g.translate(x + ADV / 2, y + (o.dy || 0));
    g.scale(o.sx ?? 1, o.sy ?? 1);
    if (o.shadow) { g.shadowColor = o.shadow[0]; g.shadowBlur = o.shadow[1]; g.shadowOffsetY = o.shadow[2]; }
    g.drawImage(sheet, c.x, c.y, CW * S, CH * S, -ADV / 2 - PAD, -ASC, CW, CH);
    g.restore();
  }

  return { put, sheet };
}
