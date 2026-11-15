// This film's own parts: which shot factory draws each shot named in cues.json, and what is drawn over every shot.

import { makeHello } from './shots/hello.js';

// every font the 2D canvases use, so the page waits for them before the first frame
export const FONTS = ['400 40px "Anton"', '400 40px "Archivo Black"', 'italic 700 40px "Lib Serif"', '400 40px "VT323"'];

export const FACTORIES = { hello: makeHello };

// Optional: draw something over every shot (a logo bug, a lower third). Return true if it drew.
// export function furniture(g, t, shotName) { return false; }

// Optional: your own caption style. The default is white monospace capitals on black boxes.
// export function caption(g, text) { ... }
