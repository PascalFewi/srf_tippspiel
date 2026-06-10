// Controller: liest Eingaben, holt Daten, rechnet, rendert. Orchestriert nur —
// die eigentliche Logik liegt in den Fachmodulen.

import { CONFIG } from "./config.js";
import { deVig } from "./probability.js";
import { bestTips } from "./optimizer.js";
import { parseCorrectScore } from "./parser.js";
import { fetchEvents, fetchOddsMulti } from "./api.js";
import { UI } from "./ui.js";

const ERR = {
  cors: "Der Browser hat den Zugriff auf odds-api.io blockiert (<b>CORS</b>). " +
        "Das passiert, wenn die API keine direkten Browser-Aufrufe erlaubt. Lösung: den Proxy aus " +
        "<code>proxy/worker.js</code> deployen und in <code>js/config.js</code> die Worker-URL als <code>API_BASE</code> eintragen.",
  auth: "Der <b>API-Key</b> wurde abgelehnt. Prüf den Schlüssel auf odds-api.io (Free Tier genügt).",
  rate: "<b>Stundenlimit erreicht</b> (HTTP 429). Warte bis zur nächsten vollen Stunde — ein Buchmacher pro Stunde.",
};

function dateOf(ev) {
  const v = ev.date || ev.commence_time;
  return v ? new Date(v).getTime() : 0;
}

async function fetchAllOdds(key, events, book, countRequest) {
  const oddsById = {};
  for (let i = 0; i < events.length; i += CONFIG.BATCH) {
    const batch = events.slice(i, i + CONFIG.BATCH);
    const ids = batch.map((e) => e.id ?? e.eventId).filter((x) => x != null);
    UI.status(`Hole Quoten … ${Math.min(i + CONFIG.BATCH, events.length)} / ${events.length}`);
    const res = await fetchOddsMulti(key, ids, book);
    countRequest();
    for (const eo of res) if (eo && eo.id != null) oddsById[eo.id] = eo;
    if (i + CONFIG.BATCH < events.length) {
      await new Promise((r) => setTimeout(r, CONFIG.BATCH_DELAY_MS));
    }
  }
  return oddsById;
}

function toRow(ev, oddsById, book, weights) {
  const id = ev.id ?? ev.eventId;
  const home = ev.home ?? ev.homeTeam ?? "Heim";
  const away = ev.away ?? ev.awayTeam ?? "Gast";
  const ts = dateOf(ev);
  const date = ts ? new Date(ts) : null;

  const parsed = oddsById[id] ? parseCorrectScore(oddsById[id], book) : null;
  if (!parsed) return { home, away, date, tips: null, reason: "keine Correct-Score-Quoten" };

  const { dist } = deVig(parsed.scores);
  return { home, away, date, book: parsed.book, tips: bestTips(dist, weights, 5) };
}

async function run() {
  UI.clearError();
  UI.hideEmpty();

  const { key, book, league, weights } = UI.readInputs();
  if (!key) {
    UI.showError("Trag zuerst deinen <b>Free-Tier-API-Key</b> ein.");
    UI.el.apiKey.focus();
    return;
  }

  UI.el.run.disabled = true;
  let requests = 0;
  try {
    UI.status("Hole Spielprogramm …");
    const events = await fetchEvents(key, league);
    requests++;

    if (!events.length) {
      UI.showEmpty("Für diesen Wettbewerb sind aktuell keine Spiele gelistet. " +
                   "Correct-Score-Märkte öffnen meist erst wenige Tage vor Anpfiff.");
      UI.status("");
      return;
    }

    events.sort((a, b) => dateOf(a) - dateOf(b));
    const oddsById = await fetchAllOdds(key, events, book, () => requests++);
    const rows = events.map((ev) => toRow(ev, oddsById, book, weights));

    UI.renderResults(rows, weights, requests, book);
    UI.status(`Fertig · ${requests} Anfragen.`);
  } catch (e) {
    UI.el.results.style.display = "none";
    UI.showError(ERR[e.kind] || ("Abruf fehlgeschlagen: <b>" + (e.message || "unbekannt") + "</b>. Prüf Wettbewerb-Slug und Buchmacher."));
    UI.status("");
  } finally {
    UI.el.run.disabled = false;
  }
}

function init() {
  UI.cache();
  UI.el.scheme.addEventListener("change", (e) => UI.toggleWeights(e.target.value === "custom"));
  UI.el.run.addEventListener("click", run);
  UI.el.csv.addEventListener("click", () => UI.downloadCsv());
  UI.el.apiKey.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
}

init();
