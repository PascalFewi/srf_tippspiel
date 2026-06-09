/**
 * CORS-Proxy für odds-api.io als Cloudflare Worker.
 *
 * Zweck: Browser blockieren Cross-Origin-Requests, wenn die Ziel-API keine
 * CORS-Header schickt. Dieser Worker leitet den Request 1:1 an odds-api.io
 * weiter und setzt die nötigen Access-Control-Header.
 *
 * Deploy (Cloudflare):
 *   1. Auf dash.cloudflare.com -> Workers & Pages -> Create -> Worker
 *   2. Diesen Code einfügen, deployen.
 *   3. In js/config.js  API_BASE  auf  https://DEIN-WORKER.workers.dev/v3  setzen.
 *
 * Der API-Key bleibt in der Query (?apiKey=...) — er wird nur durchgereicht,
 * nicht gespeichert oder geloggt. Optional unten ALLOW_ORIGIN einschränken,
 * damit nicht jeder deinen Worker als offenen Proxy nutzt.
 */

const UPSTREAM = "https://api.odds-api.io";
const ALLOW_ORIGIN = "*"; // z. B. "https://deine-domain.ch" zum Einschränken

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }
    if (request.method !== "GET") {
      return withCors(new Response("Only GET", { status: 405 }));
    }

    const url = new URL(request.url);
    const target = UPSTREAM + url.pathname + url.search;

    try {
      const upstream = await fetch(target, { headers: { Accept: "application/json" } });
      const body = await upstream.text();
      return withCors(new Response(body, {
        status: upstream.status,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }));
    } catch {
      return withCors(new Response(JSON.stringify({ error: "upstream_unreachable" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }));
    }
  },
};

function withCors(res) {
  res.headers.set("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "*");
  return res;
}
