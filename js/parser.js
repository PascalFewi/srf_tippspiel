// Extrahiert den Correct-Score-Markt aus einer /odds-Antwort und macht daraus
// ein { "h,a": quote }-Objekt.
//
// odds-api.io liefert Einträge als { label: "1-0", odds: "6.500" }. Der Parser
// ist defensiv und akzeptiert auch alternative Felder (price/value bzw.
// explizite home/away-Integer), falls sich das Schema je Buchmacher unterscheidet.

const SCORE_RE = /(\d+)\s*[-:]\s*(\d+)/;

function isCorrectScore(name) {
  return /correct/i.test(name || "") && /score/i.test(name || "");
}

function parseEntries(entries) {
  const scores = {};
  for (const e of entries) {
    const odd = parseFloat(e.odds ?? e.price ?? e.value);
    if (!isFinite(odd) || odd <= 1) continue;

    let h, a;
    if (e.home != null && e.away != null &&
        /^\d+$/.test(String(e.home)) && /^\d+$/.test(String(e.away))) {
      h = +e.home;
      a = +e.away;
    } else {
      const m = SCORE_RE.exec(e.label ?? e.score ?? e.name ?? e.selection ?? "");
      if (!m) continue;            // z. B. "Any Other Home Win" -> übersprungen
      h = +m[1];
      a = +m[2];
    }
    scores[h + "," + a] = odd;
  }
  return scores;
}

// Bevorzugt den gewählten Buchmacher, fällt sonst auf den ersten mit
// brauchbarem Correct-Score-Markt zurück.
export function parseCorrectScore(eventOdds, preferredBook) {
  const books = (eventOdds && eventOdds.bookmakers) || {};
  const order = Object.keys(books).sort(
    (a, b) => (a === preferredBook ? -1 : b === preferredBook ? 1 : 0)
  );
  for (const book of order) {
    const market = (books[book] || []).find((m) => isCorrectScore(m.name));
    if (!market) continue;
    const scores = parseEntries(market.odds || []);
    if (Object.keys(scores).length >= 4) return { scores, book };
  }
  return null;
}
