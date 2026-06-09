// Punktelogik des Tippspiels — parametriert über Gewichte w.
//
// w = { out, home, away, diff }
//   out  : Punkte für richtigen Ausgang (Sieg/Remis/Niederlage)
//   home : Punkte für exakte Heim-Tore
//   away : Punkte für exakte Gast-Tore
//   diff : Punkte für richtige Tordifferenz (impliziert richtigen Ausgang)

export function points(H, A, h, a, w) {
  let p = 0;
  if (Math.sign(H - A) === Math.sign(h - a)) p += w.out;   // richtiger Ausgang
  if (H === h) p += w.home;                                // Heim-Tore exakt
  if (A === a) p += w.away;                                // Gast-Tore exakt
  if ((H - A) === (h - a)) p += w.diff;                    // Differenz exakt
  return p;
}
