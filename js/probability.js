// Wandelt Buchmacher-Quoten in eine Wahrscheinlichkeitsverteilung um.
//
// Proportionale De-Vig-Methode: p(s) = (1/quote_s) / Summe_s(1/quote_s).
// Entfernt die Buchmacher-Marge (Overround). Bei sehr hoher Marge — wie sie
// im Correct-Score-Markt üblich ist — hat diese Methode einen leichten
// Favourite-Longshot-Bias; für die Tipp-Wahl unkritisch, als Genauigkeits-
// Upgrade käme hier die Shin- oder Power-Methode rein.

export function deVig(scores) {
  let sum = 0;
  const implied = {};
  for (const [k, odd] of Object.entries(scores)) {
    const q = 1 / odd;
    implied[k] = q;
    sum += q;
  }
  const dist = {};
  for (const [k, q] of Object.entries(implied)) dist[k] = q / sum;
  return { dist, overround: sum };  // overround > 1 = Marge
}
