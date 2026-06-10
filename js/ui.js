// Alles, was das DOM anfasst: Eingaben lesen, Status/Fehler/Leerzustand,
// und die Ergebnistabelle rendern. Enthält keine Rechenlogik.

import { CONFIG } from "./config.js";
import { formatDate, formatTime, formatEv } from "./format.js";

export const UI = {
  el: {},

  cache() {
    const ids = [
      "apiKey", "book", "scheme", "league", "weights", "wOut", "wHome", "wAway", "wDiff",
      "run", "status", "emptyMsg", "errMsg", "results", "resultsTitle", "resultsMeta", "rows", "footnote",
      "csvTips", "csvOdds",
    ];
    ids.forEach((id) => (this.el[id] = document.getElementById(id)));
  },

  readInputs() {
    const e = this.el;
    return {
      key: e.apiKey.value.trim(),
      book: e.book.value,
      league: e.league.value.trim() || CONFIG.DEFAULT_LEAGUE,
      weights: {
        out: +e.wOut.value || 0,
        home: +e.wHome.value || 0,
        away: +e.wAway.value || 0,
        diff: +e.wDiff.value || 0,
      },
    };
  },

  toggleWeights(custom) {
    this.el.weights.classList.toggle("show", custom);
    if (!custom) {
      const d = CONFIG.DEFAULT_WEIGHTS;
      this.el.wOut.value = d.out;
      this.el.wHome.value = d.home;
      this.el.wAway.value = d.away;
      this.el.wDiff.value = d.diff;
    }
  },

  status(t) { this.el.status.textContent = t; },
  showError(html) { this.el.errMsg.innerHTML = html; this.el.errMsg.classList.add("show"); },
  clearError() { this.el.errMsg.classList.remove("show"); },
  showEmpty(text) {
    this.el.emptyMsg.textContent = text;
    this.el.emptyMsg.classList.add("show");
    this.el.results.style.display = "none";
  },
  hideEmpty() { this.el.emptyMsg.classList.remove("show"); },

  renderResults(rows, weights, requests, book) {
    this._lastRows = rows;
    this._lastBook = book;
    this._renderRows(rows);
    const withTips = rows.filter((r) => r.tips).length;
    this.el.resultsTitle.textContent = `${rows.length} Spiele`;
    this.el.resultsMeta.textContent = `${withTips} mit Quoten · ${requests} Anfragen · ${book}`;
    const w = weights;
    this.el.footnote.innerHTML =
      `Schema: Ausgang ${w.out} · Heim-Tore ${w.home} · Gast-Tore ${w.away} · Differenz ${w.diff}. ` +
      `<b>EV</b> = erwartete Punkte pro Tipp, aus den entvigten Correct-Score-Quoten (proportionale Methode). ` +
      `Der grün markierte Tipp maximiert den Erwartungswert — nicht zwingend das wahrscheinlichste Resultat.`;
    this.el.results.style.display = "block";
  },

  _renderRows(rows) {
    const labels = ["Beste Wahl", "2. Wahl", "3. Wahl", "4. Wahl", "5. Wahl"];
    const tbody = this.el.rows;
    tbody.innerHTML = "";

    for (const r of rows) {
      const tr = document.createElement("tr");

      const when = document.createElement("td");
      when.className = "when";
      when.innerHTML = r.date
        ? `<span class="d">${formatDate(r.date)}</span><br><span class="t">${formatTime(r.date)}</span>`
        : `<span class="t">–</span>`;
      tr.appendChild(when);

      const fx = document.createElement("td");
      fx.className = "fixture";
      fx.innerHTML = `${r.home}<span class="vs">–</span>${r.away}` + (r.book ? `<span class="lg">${r.book}</span>` : "");
      tr.appendChild(fx);

      if (r.tips) {
        const top = r.tips[0].ev || 1;
        r.tips.forEach((t, i) => {
          const td = document.createElement("td");
          td.className = "pick r" + (i + 1);
          td.setAttribute("data-label", labels[i]);
          const pct = Math.max(6, Math.round((t.ev / top) * 100));
          td.innerHTML =
            `<div class="tip">${t.H}:${t.A}</div>` +
            `<div class="ev">EV ${formatEv(t.ev)}</div>` +
            `<div class="bar"><i style="width:${pct}%"></i></div>`;
          tr.appendChild(td);
        });
      } else {
        const td = document.createElement("td");
        td.colSpan = 5;
        td.className = "nodata";
        td.textContent = r.reason || "keine Correct-Score-Quoten";
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }
  },

  // CSV-Helfer: de-CH nutzt Komma als Dezimaltrenner, darum Semikolon als
  // Spaltentrenner und UTF-8-BOM, damit Excel Umlaute richtig liest.
  _saveCsv(rows, filename) {
    const sep = ";";
    const cell = (v) => {
      const s = String(v ?? "");
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const text = rows.map((r) => r.map(cell).join(sep)).join("\r\n");
    const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Eine Zeile pro Spiel mit den fünf besten Tipps und ihren Erwartungswerten.
  downloadTips() {
    const rows = this._lastRows;
    if (!rows || !rows.length) return;

    const header = ["Datum", "Anpfiff", "Heim", "Gast", "Buchmacher"];
    for (let i = 1; i <= 5; i++) header.push(`${i}. Wahl`, `EV ${i}`);

    const out = [header];
    for (const r of rows) {
      const c = [
        r.date ? formatDate(r.date) : "",
        r.date ? formatTime(r.date) : "",
        r.home,
        r.away,
        r.book ?? this._lastBook ?? "",
      ];
      for (let i = 0; i < 5; i++) {
        const t = r.tips && r.tips[i];
        c.push(t ? `${t.H}:${t.A}` : "", t ? formatEv(t.ev) : "");
      }
      if (!r.tips) c[5] = r.reason || "keine Correct-Score-Quoten";
      out.push(c);
    }
    this._saveCsv(out, "tippoptimierer-tipps.csv");
  },

  // Lange Form: eine Zeile pro Resultat mit der rohen Buchmacher-Quote.
  downloadOdds() {
    const rows = this._lastRows;
    if (!rows || !rows.length) return;

    const out = [["Datum", "Anpfiff", "Heim", "Gast", "Buchmacher", "Resultat", "Quote"]];
    for (const r of rows) {
      const base = [
        r.date ? formatDate(r.date) : "",
        r.date ? formatTime(r.date) : "",
        r.home,
        r.away,
        r.book ?? this._lastBook ?? "",
      ];
      if (r.scores && Object.keys(r.scores).length) {
        Object.entries(r.scores)
          .sort((a, b) => a[1] - b[1])  // nach Quote aufsteigend (wahrscheinlichstes zuerst)
          .forEach(([k, odd]) => {
            const [h, a] = k.split(",");
            out.push([...base, `${h}:${a}`, String(odd).replace(".", ",")]);
          });
      } else {
        out.push([...base, r.reason || "keine Correct-Score-Quoten", ""]);
      }
    }
    this._saveCsv(out, "tippoptimierer-quoten.csv");
  },
};
