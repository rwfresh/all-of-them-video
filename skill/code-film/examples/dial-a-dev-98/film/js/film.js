// This film's own parts: which shot factory draws each shot named in cues.json, and what is drawn over every shot.

import { osd, phoneBar } from './supers.js';
import { makeTitle } from './shots/title.js';
import { makeDiscs } from './shots/discs.js';
import { makeStruggle, makePrompt, makeDial, makeBuild, makeGuard, makeCarrier } from './shots/desktop.js';
import { makeWait, makeOffer, makeEnd } from './shots/sell.js';

// every font the 2D canvases use, so the page waits for them before the first frame
export const FONTS = ['400 40px "Anton"', '400 40px "Archivo Black"', 'italic 700 40px "Lib Serif"', '700 40px "Lib Serif"',
  '400 40px "Lib Sans"', '700 40px "Lib Sans"', '400 40px "VT323"', '400 16px "DotGothic16"'];

export const FACTORIES = {
  struggle: makeStruggle, title: makeTitle, discs: makeDiscs, prompt: makePrompt, dial: makeDial, build: makeBuild,
  guard: makeGuard, wait: makeWait, offer: makeOffer, end: makeEnd, carrier: makeCarrier,
};

// Shots that carry the standing lower-third with the product name and the number to call. It is on from the very
// first frame, in colour over the black-and-white opening, so the thumbnail already names the product.
const BAR = new Set(['struggle', 'prompt', 'dial', 'build', 'guard', 'carrier']);

/** Drawn over every shot, before the tape pass. True if it drew. */
export function furniture(g, t, shot) {
  let drew = false;
  if (BAR.has(shot)) { phoneBar(g, 1); drew = true; }
  if (t < 1.9) {
    // the VCR's own display, top right, clear of the desktop icons
    osd(g, 'PLAY', 1650, 118);
    g.fillStyle = '#f4f7f4'; g.beginPath(); g.moveTo(1790, 76); g.lineTo(1790, 120); g.lineTo(1828, 98); g.closePath(); g.fill();
    drew = true;
  }
  return drew;
}
