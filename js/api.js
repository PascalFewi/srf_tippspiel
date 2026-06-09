// HTTP-Calls gegen odds-api.io (bzw. den Proxy, je nach CONFIG.API_BASE).
// Wirft typisierte Fehler (.kind), damit der Controller passende Meldungen zeigt.

import { CONFIG } from "./config.js";

const q = encodeURIComponent;

function apiError(kind, message) {
  const e = new Error(message || kind);
  e.kind = kind;
  return e;
}

async function getJSON(url) {
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw apiError("cors");          // Netzwerk-/CORS-Block
  }
  if (res.status === 401 || res.status === 403) throw apiError("auth");
  if (res.status === 429) throw apiError("rate");
  if (!res.ok) throw apiError("http", "HTTP " + res.status);
  return res.json();
}

// Liste der Spiele für sport=football + league.
export async function fetchEvents(key, league) {
  const url = `${CONFIG.API_BASE}/events?apiKey=${q(key)}&sport=football&league=${q(league)}`;
  const data = await getJSON(url);
  return Array.isArray(data) ? data : (data.events || []);
}

// Quoten für bis zu 10 Events in einem Request (1 Anfrage gegen das Kontingent).
export async function fetchOddsMulti(key, ids, book) {
  const url = `${CONFIG.API_BASE}/odds/multi?apiKey=${q(key)}&eventIds=${ids.join(",")}&bookmakers=${q(book)}`;
  const data = await getJSON(url);
  return Array.isArray(data) ? data : (data.events || [data]);
}
