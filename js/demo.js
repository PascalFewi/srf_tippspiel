// Lokaler Demo-/Testmodus: liest odds.csv (exakt das Format des „↓ Quoten"-
// Exports aus UI.downloadOdds) und baut daraus dieselben Zeilen wie der
// Controller aus der API — ohne API-Key, ohne Netzwerk.
//
// Aktiv nur mit ?demo in der URL. Ohne Parameter wird hier nichts ausgeführt,
// das deployte Verhalten bleibt also unverändert.

import { deVig } from "./probability.js";
import { bestTips, expectedGoals } from "./optimizer.js";

export function isDemo() {
  return new URLSearchParams(location.search).has("demo");
}

// ?demo=foo.csv erlaubt eine andere Datei; Standard ist odds.csv.
function demoFile() {
  return new URLSearchParams(location.search).get("demo") || "odds.csv";
}

const MONTHS = { jan: 0, feb: 1, "mär": 2, apr: 3, mai: 4, jun: 5, jul: 6, aug: 7, sep: 8, okt: 9, nov: 10, dez: 11 };

// "Di., 16. Juni" + "21:00" -> Date. Das Jahr fehlt im Export, darum aktuelles
// Jahr — nur für Anzeige und Sortierung relevant.
function parseWhen(datum, anpfiff) {
  const dm = /(\d+)\.\s*([A-Za-zÄÖÜäöü]+)/.exec(datum || "");
  if (!dm) return null;
  const mon = MONTHS[dm[2].toLowerCase().slice(0, 3)];
  if (mon == null) return null;
  const [hh, mm] = (anpfiff || "0:0").split(":").map((x) => +x || 0);
  const d = new Date();
  d.setMonth(mon, +dm[1]);
  d.setHours(hh, mm, 0, 0);
  return d;
}

// CSV aus _saveCsv: Semikolon-getrennt, de-CH-Dezimalkomma, BOM voran. In den
// hier genutzten Spalten kommen keine Sonderzeichen vor, darum naives Splitten.
function rows(text) {
  return text.replace(/^﻿/, "")
    .split(/\r?\n/).filter((l) => l.trim())
    .map((l) => l.split(";"));
}

export async function loadDemoRows(weights) {
  const file = demoFile();
  const res = await fetch(file);
  if (!res.ok) throw new Error(`${file} nicht gefunden (HTTP ${res.status})`);

  const lines = rows(await res.text());
  lines.shift();  // Kopfzeile weg

  // Lange Form -> je Spiel ein { scores }. Reihenfolge der Datei bleibt erhalten.
  const order = [];
  const byKey = new Map();
  for (const [datum, anpfiff, home, away, book, resultat, quote] of lines) {
    const key = `${datum}|${anpfiff}|${home}|${away}`;
    let m = byKey.get(key);
    if (!m) {
      m = { home, away, book, date: parseWhen(datum, anpfiff), scores: {} };
      byKey.set(key, m);
      order.push(m);
    }
    const sm = /(\d+)\s*[:-]\s*(\d+)/.exec(resultat || "");
    const odd = parseFloat(String(quote || "").replace(",", "."));
    if (sm && isFinite(odd) && odd > 1) m.scores[`${+sm[1]},${+sm[2]}`] = odd;
  }

  // Gleiche Logik wie app.js#toRow: <4 Resultate -> kein Markt.
  return order.map((m) => {
    if (Object.keys(m.scores).length < 4) {
      return { home: m.home, away: m.away, date: m.date, tips: null, reason: "keine Correct-Score-Quoten" };
    }
    const { dist } = deVig(m.scores);
    return {
      home: m.home, away: m.away, date: m.date, book: m.book,
      scores: m.scores, dist, eg: expectedGoals(dist), tips: bestTips(dist, weights, 5),
    };
  });
}
