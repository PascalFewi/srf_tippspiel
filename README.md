# Tippoptimierer

Frontend-only Oberfläche, die für jedes Spiel den Tipp mit dem höchsten
**Erwartungswert** rechnet — aus den Correct-Score-Quoten von
[odds-api.io](https://odds-api.io/). Kein Backend, keine Datenbank, kein
Key-Storage. Der API-Key bleibt im Browser und geht nur an odds-api.io.

Der EV-optimale Tipp ist nicht zwingend das wahrscheinlichste Resultat: Die
5 Ausgangspunkte aggregieren über viele Scorelines, deshalb kann z. B. ein
Heimsieg-Tipp besser sein als das wahrscheinlichste Einzelresultat (oft ein Remis).

## Struktur

```
tippoptimierer/
├── index.html          Markup
├── styles.css          Styles
├── js/
│   ├── config.js       Konstanten (API_BASE, Schema-Defaults …)
│   ├── scoring.js      Punktefunktion (parametrierbar)
│   ├── probability.js  De-Vig: Quoten -> Wahrscheinlichkeiten
│   ├── optimizer.js    Erwartungswert + Tipp-Gittersuche
│   ├── parser.js       Correct-Score-Markt -> {(h,a): quote}
│   ├── api.js          HTTP-Calls gegen odds-api.io
│   ├── format.js       Anzeige-Formatierung
│   ├── ui.js           DOM/Rendering
│   └── app.js          Controller (Einstieg)
├── proxy/
│   └── worker.js       Cloudflare Worker als CORS-Proxy (optional)
└── README.md
```

## Lokal starten

Es sind echte ES-Module — **`index.html` per Doppelklick (`file://`) funktioniert
nicht**, der Browser blockt Modul-Imports. Über einen lokalen Server starten:

```bash
cd tippoptimierer
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```


## CORS

Die App ruft odds-api.io direkt aus dem Browser. Klappt nur, wenn odds-api.io
CORS-Header schickt. Falls nicht (Fehlermeldung „CORS" in der App):

1. `proxy/worker.js` als Cloudflare Worker deployen (Anleitung im File).
2. In `js/config.js` `API_BASE` auf die Worker-URL setzen, z. B.
   `https://dein-worker.workers.dev/v3`.

## Konfiguration

Alles in `js/config.js`:

- `API_BASE` — odds-api.io oder Proxy-URL
- `DEFAULT_LEAGUE` — Wettbewerb-Slug (Default WM 2026)
- `DEFAULT_WEIGHTS` — Punkteschema (SRF: Ausgang 5, Heim 1, Gast 1, Differenz 3)
- `BATCH` — Events pro `/odds/multi`-Request (max. 10; spart Kontingent)

## Hinweise

- **Free Tier:** 100 Anfragen/Stunde, 1 Buchmacher pro Stunde. Ein volles
  Programm kostet dank `/odds/multi` nur ~8 Anfragen.
- **De-Vig:** proportionale Methode. Bei hoher Marge (Correct Score: oft 20–28 %)
  leichter Favourite-Longshot-Bias; für die Tipp-Wahl unkritisch. Genauigkeits-
  Upgrade wäre Shin/Power — isoliert in `probability.js`.
- Diese Seite ist keine offizielle odds-api.io-Software und nicht mit dem
  Anbieter verbunden.
