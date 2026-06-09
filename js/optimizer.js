// Erwartungswert pro Tipp und Suche nach den besten Tipps.
//
// Wichtig: Die vier Punkte-Komponenten sind über (H, A) gekoppelt, also keine
// gierige Einzeloptimierung — wir suchen über das ganze Tipp-Gitter (0..MAX_GOALS).

import { CONFIG } from "./config.js";
import { points } from "./scoring.js";

// dist: { "h,a": wahrscheinlichkeit }
export function expectedValue(H, A, dist, w) {
  let ev = 0;
  for (const [k, p] of Object.entries(dist)) {
    const c = k.indexOf(",");
    const h = +k.slice(0, c);
    const a = +k.slice(c + 1);
    ev += p * points(H, A, h, a, w);
  }
  return ev;
}

export function bestTips(dist, w, topN = 3) {
  const out = [];
  for (let H = 0; H <= CONFIG.MAX_GOALS; H++) {
    for (let A = 0; A <= CONFIG.MAX_GOALS; A++) {
      out.push({ H, A, ev: expectedValue(H, A, dist, w) });
    }
  }
  out.sort((x, y) => y.ev - x.ev);
  return out.slice(0, topN);
}
