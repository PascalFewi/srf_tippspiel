// Alles, was das DOM anfasst: Eingaben lesen, Status/Fehler/Leerzustand,
// und die Ergebnistabelle rendern. Enthält keine Rechenlogik.

import { CONFIG } from "./config.js";
import { formatDate, formatTime, formatEv } from "./format.js";
import { bestTips } from "./optimizer.js";

export const UI = {
  el: {},

  cache() {
    const ids = [
      "apiKey", "book", "scheme", "league", "weights", "wOut", "wHome", "wAway", "wDiff",
      "run", "status", "emptyMsg", "errMsg", "results", "resultsTitle", "resultsMeta", "rows", "footnote",
      "csvTips", "csvOdds", "modal", "modalClose", "modalBody",
    ];
    ids.forEach((id) => (this.el[id] = document.getElementById(id)));
    this._initModal();
  },

  // Modal schliesst per Backdrop-/×-Klick (data-close) und per Escape.
  _initModal() {
    this.el.modal.addEventListener("click", (e) => {
      if (e.target.hasAttribute("data-close")) this.closeMatch();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.el.modal.hidden) this.closeMatch();
    });
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
    this._weights = weights;
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

      // Spiele mit Verteilung sind anklickbar -> Detail-Lightbox.
      if (r.dist) {
        tr.className = "clickable";
        tr.tabIndex = 0;
        tr.setAttribute("role", "button");
        tr.setAttribute("aria-label", `Details zu ${r.home} gegen ${r.away}`);
        tr.addEventListener("click", () => this.openMatch(r));
        tr.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.openMatch(r); }
        });
      }

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

  // ---- Detail-Lightbox: Wahrscheinlichkeits-Matrix + Top-10-Erwartungswerte ----

  closeMatch() {
    this.el.modal.hidden = true;
    document.body.classList.remove("modal-open");
    if (this._lastFocus) { this._lastFocus.focus(); this._lastFocus = null; }
  },

  openMatch(r) {
    if (!r || !r.dist) return;
    this._lastFocus = document.activeElement;
    this.el.modalBody.innerHTML = this._matchHtml(r);
    this.el.modal.hidden = false;
    document.body.classList.add("modal-open");
    this.el.modalClose.focus();
  },

  _matchHtml(r) {
    const dist = r.dist;
    const w = this._weights || CONFIG.DEFAULT_WEIGHTS;
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    // Verteilung als Lookup + Matrix-Dimensionen aus den real angebotenen Resultaten.
    const P = {};
    let maxH = 0, maxA = 0, maxP = 0;
    let pHome = 0, pDraw = 0, pAway = 0;
    let topKey = null, topP = 0;
    for (const [k, p] of Object.entries(dist)) {
      const c = k.indexOf(",");
      const h = +k.slice(0, c), a = +k.slice(c + 1);
      if (h > CONFIG.MAX_GOALS || a > CONFIG.MAX_GOALS) continue;
      P[h + "," + a] = p;
      if (h > maxH) maxH = h;
      if (a > maxA) maxA = a;
      if (p > maxP) maxP = p;
      if (p > topP) { topP = p; topKey = [h, a]; }
      if (h > a) pHome += p; else if (h === a) pDraw += p; else pAway += p;
    }

    const tips = bestTips(dist, w, 10);
    const bestKey = tips.length ? tips[0].H + "," + tips[0].A : null;
    const pct = (p) => {
      const v = p * 100;
      if (v < 0.05) return "";
      return (v >= 9.95 ? Math.round(v) : v.toFixed(1)) + "%";
    };

    // Heatmap: Sättigung relativ zur wahrscheinlichsten Zelle.
    const cellStyle = (p) => {
      if (!p) return "";
      const a = maxP ? p / maxP : 0;
      const fg = a > 0.55 ? "color:#fff;" : "";
      return `style="background:rgba(22,121,74,${(a * 0.9).toFixed(3)});${fg}"`;
    };

    // Matrix-Tabelle: Zeilen = Heim-Tore, Spalten = Gast-Tore, plus Σ-Marginalien.
    let head = `<th class="m-corner"><span>${esc(r.home)}</span><i>↓</i><i>→</i><span>${esc(r.away)}</span></th>`;
    for (let a = 0; a <= maxA; a++) head += `<th>${a}</th>`;
    head += `<th class="m-sum">Σ</th>`;

    let bodyRows = "";
    for (let h = 0; h <= maxH; h++) {
      let rowSum = 0;
      let cells = "";
      for (let a = 0; a <= maxA; a++) {
        const p = P[h + "," + a] || 0;
        rowSum += p;
        const key = h + "," + a;
        const mark = key === bestKey ? " m-best" : "";
        const title = pct(p) ? ` title="${esc(r.home)} ${h}:${a} ${esc(r.away)} — ${pct(p)}"` : "";
        cells += `<td class="m-cell${mark}" ${cellStyle(p)}${title}>${pct(p)}</td>`;
      }
      bodyRows += `<tr><th class="m-rowh">${h}</th>${cells}<td class="m-sum">${pct(rowSum)}</td></tr>`;
    }

    let foot = `<th class="m-sum">Σ</th>`;
    for (let a = 0; a <= maxA; a++) {
      let colSum = 0;
      for (let h = 0; h <= maxH; h++) colSum += P[h + "," + a] || 0;
      foot += `<td class="m-sum">${pct(colSum)}</td>`;
    }
    foot += `<td class="m-sum"></td>`;

    const evTop = tips[0] ? tips[0].ev : 1;
    const evList = tips.map((t, i) => {
      const bw = Math.max(6, Math.round((t.ev / evTop) * 100));
      const isBest = i === 0 ? " ev-best" : "";
      return `<li class="${isBest.trim()}">` +
        `<span class="ev-rank">${i + 1}</span>` +
        `<span class="ev-score">${t.H}:${t.A}</span>` +
        `<span class="ev-bar"><i style="width:${bw}%"></i></span>` +
        `<span class="ev-val">${formatEv(t.ev)}</span></li>`;
    }).join("");

    const when = r.date ? `${formatDate(r.date)} · ${formatTime(r.date)}` : "Termin offen";
    const bookLbl = r.book ? ` · ${esc(r.book)}` : "";
    const likely = topKey ? `${topKey[0]}:${topKey[1]}` : "–";

    return (
      `<div class="m-head">` +
        `<div class="m-title" id="modalTitle">${esc(r.home)} <span>–</span> ${esc(r.away)}</div>` +
        `<div class="m-sub">${esc(when)}${bookLbl}</div>` +
      `</div>` +
      `<div class="m-chips">` +
        `<span class="m-chip"><b>1</b> ${pct(pHome)}</span>` +
        `<span class="m-chip"><b>X</b> ${pct(pDraw)}</span>` +
        `<span class="m-chip"><b>2</b> ${pct(pAway)}</span>` +
        `<span class="m-chip ghost">Wahrscheinlichstes Resultat <b>${likely}</b> (${pct(topP)})</span>` +
      `</div>` +
      `<div class="m-body">` +
        `<div class="m-matrix">` +
          `<div class="m-cap">Wahrscheinlichkeit je Resultat — Zeilen: Tore ${esc(r.home)}, Spalten: Tore ${esc(r.away)}</div>` +
          `<div class="m-gridwrap"><table class="m-grid">` +
            `<thead><tr>${head}</tr></thead>` +
            `<tbody>${bodyRows}</tbody>` +
            `<tfoot><tr>${foot}</tr></tfoot>` +
          `</table></div>` +
          `<div class="m-legend"><span class="m-best-key"></span> bester Erwartungswert · dunkler = wahrscheinlicher</div>` +
        `</div>` +
        `<div class="m-evbox">` +
          `<h4>Top 10 Erwartungswerte</h4>` +
          `<ol class="m-evlist">${evList}</ol>` +
          `<p class="m-evnote">EV = erwartete Punkte pro Tipp (Schema: Ausgang ${w.out} · Heim ${w.home} · Gast ${w.away} · Differenz ${w.diff}). Der Tipp mit dem höchsten EV ist im Resultat-Gitter umrandet.</p>` +
        `</div>` +
      `</div>`
    );
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
