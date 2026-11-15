// Stands in for a shot that is not built yet: a plain card with the style's name and the terminal's two rows in the
// real look. With it the whole film can be watched for timing from the first day.

import { drawDockReal, monoText, rule, swapDock, REAL } from '../term.js';
import { smooth } from '../util.js';

export function makePlaceholder(ctx, error = null) {
  const { W, H, shot, tag } = ctx;
  const hue = (shot.index * 47) % 360;
  const dock = (g, env, part) => drawDockReal(g, env.term, REAL, part);
  return {
    placeholder: true,
    dock,
    render(g, env) {
      // the previous picture stays until a plain wipe brings this card in
      if (env.other && env.role === 'in') {
        g.drawImage(env.other, 0, 0);
        g.beginPath(); g.rect(0, 0, W * smooth(env.x), H); g.clip();
      }
      g.fillStyle = `hsl(${hue} 30% 12%)`;
      g.fillRect(0, 0, W, H);
      g.fillStyle = `hsl(${hue} 60% 62%)`;
      g.font = '400 150px "Anton", "Archivo Black", sans-serif';
      g.textBaseline = 'alphabetic';
      g.fillText(shot.style || shot.name.toUpperCase(), 160, 460);
      if (tag) monoText(g, `${tag.num}/${tag.of}`, 168, 240, 60, `hsl(${hue} 60% 62%)`, true);
      monoText(g, `${shot.name} · ${shot.bars} bars · beat ${Math.max(0, env.lb).toFixed(2)}`, 168, 560, 40, REAL.dim);
      if (error) monoText(g, error.slice(0, 70), 168, 640, 36, '#ff7a6b');
      // a beat marker, to check the clock against the music
      const b = env.lb - Math.floor(env.lb);
      g.fillStyle = `hsl(${hue} 60% 62% / ${(1 - b) * 0.9})`;
      g.fillRect(1640, 180, 120, 120);
      g.fillStyle = 'rgba(10,10,12,0.72)';
      g.fillRect(0, 780, W, 300);
      rule(g, 896); rule(g, 1000);
      g.restore(); g.save();                         // drop the wipe's clip: the prompt row has its own hand-over
      if (env.noDock) return;
      if (env.other && env.otherImpl.dock) swapDock(g, env, dock);
      else dock(g, env);
    },
  };
}
