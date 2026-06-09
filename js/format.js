// Anzeige-Formatierung (de-CH).

const dateFmt = new Intl.DateTimeFormat("de-CH", { weekday: "short", day: "2-digit", month: "short" });
const timeFmt = new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit" });

export function formatDate(d) { return d ? dateFmt.format(d) : "–"; }
export function formatTime(d) { return d ? timeFmt.format(d) : ""; }
export function formatEv(n) { return n.toFixed(2).replace(".", ","); }
