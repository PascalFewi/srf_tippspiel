// Zentrale Konfiguration.
//
// API_BASE zeigt standardmässig direkt auf odds-api.io. Wenn der Browser die
// Calls per CORS blockt, deploy den Proxy aus proxy/worker.js und setze hier
// die Worker-URL ein, z. B.:
//   API_BASE: "https://dein-worker.deinsubdomain.workers.dev/v3"

export const CONFIG = {
  API_BASE: "https://oddsproxy.komqom.workers.dev/v3",
  MAX_GOALS: 7,            // Tipp-Gitter 0..7 je Seite
  BATCH: 10,               // /odds/multi: bis 10 Events pro Request
  BATCH_DELAY_MS: 250,     // sanfte Pause zwischen Batches
  DEFAULT_LEAGUE: "international-fifa-world-cup",
  DEFAULT_WEIGHTS: { out: 5, home: 1, away: 1, diff: 3 },  // SRF Tippspiel
};
