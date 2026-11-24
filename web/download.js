"use strict";
(() => {
  const TXT = {
    es: { lead: "Lleva Zinctify a tu ordenador y a tu móvil.", back: "Volver a Zinctify", soon: "Próximamente", missing: "Aún no disponible en este servidor",
      note: "Windows puede avisar de «editor desconocido» al instalar: pulsa «Más información» y «Ejecutar de todos modos».", rec: "Recomendado",
      win: "Descargar para Windows", lin: "Descargar para Linux", and: "Android", winSub: "Instalador (.exe)", linSub: "AppImage", andSub: "APK" },
    en: { lead: "Take Zinctify to your computer and phone.", back: "Back to Zinctify", soon: "Coming soon", missing: "Not available on this server yet",
      note: "Windows may warn about an “unknown publisher” during setup: click “More info” and then “Run anyway”.", rec: "Recommended",
      win: "Download for Windows", lin: "Download for Linux", and: "Android", winSub: "Installer (.exe)", linSub: "AppImage", andSub: "APK" },
  };
  let pref = "auto";
  try { pref = localStorage.getItem("zinctify.lang") || "auto"; } catch (e) { /* ignorar */ }
  let lang = pref in TXT ? pref : "";
  if (!lang) for (const l of (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"])) { const c = String(l).slice(0, 2).toLowerCase(); if (c in TXT) { lang = c; break; } }
  lang = lang || "en";
  const T = TXT[lang];
  document.documentElement.lang = lang;
  document.getElementById("lead").textContent = T.lead;
  document.getElementById("back").textContent = T.back;
  document.getElementById("note").textContent = T.note;

  const ICON = {
    win: "M3 5.5l7.5-1v7H3zM11.5 4.3L21 3v8.5h-9.5zM3 12.5h7.5v7L3 18.5zM11.5 12.5H21V21l-9.5-1.3z",
    lin: "M12 2c-2.2 0-3.5 2-3.5 4.6 0 1.3-.4 2.3-1.3 3.6C6 11.9 5 13.7 5 15.6c0 1 .3 1.7.8 2.2-.4.6-1.3 1-2.3 1.4-.6.3-.6.9-.1 1.2 1 .6 2.4.9 3.4 1 .9.1 1.4-.4 1.8-1 .9.4 1.8.6 3.4.6s2.5-.2 3.4-.6c.4.6.9 1.1 1.8 1 1-.1 2.4-.4 3.4-1 .5-.3.5-.9-.1-1.2-1-.4-1.9-.8-2.3-1.4.5-.5.8-1.2.8-2.2 0-1.9-1-3.7-2.2-5.4-.9-1.3-1.3-2.3-1.3-3.6C15.5 4 14.2 2 12 2zm-1.6 4.4a.9.9 0 110 1.8.9.9 0 010-1.8zm3.2 0a.9.9 0 110 1.8.9.9 0 010-1.8z",
    and: "M6 18c0 .6.4 1 1 1h1v3.2a1.3 1.3 0 002.6 0V19h2.8v3.2a1.3 1.3 0 002.6 0V19h1c.6 0 1-.4 1-1V8H6zM3.3 8a1.3 1.3 0 00-1.3 1.3v6.4a1.3 1.3 0 002.6 0V9.3A1.3 1.3 0 003.3 8zm17.4 0a1.3 1.3 0 00-1.3 1.3v6.4a1.3 1.3 0 002.6 0V9.3A1.3 1.3 0 0020.7 8zM15.5 2.2l1.2-1.6a.4.4 0 00-.6-.5l-1.3 1.7A6 6 0 0012 1.2c-.9 0-1.7.2-2.8.6L7.9.1a.4.4 0 00-.6.5l1.2 1.6A5.7 5.7 0 006 7h12a5.7 5.7 0 00-2.5-4.8zM9.5 5.2a.7.7 0 110-1.4.7.7 0 010 1.4zm5 0a.7.7 0 110-1.4.7.7 0 010 1.4z",
  };
  const NS = "http://www.w3.org/2000/svg";
  const svg = (d) => { const s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); const p = document.createElementNS(NS, "path"); p.setAttribute("d", d); s.append(p); return s; };
  const mb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(0) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
  const ua = navigator.userAgent || "";
  const mine = /Windows/i.test(ua) ? "windows" : /Android/i.test(ua) ? "android" : /Linux|X11/i.test(ua) ? "linux" : "";

  function button({ kind, icon, label, sub, tag, href, off }) {
    const el = document.createElement(off ? "div" : "a");
    el.className = "dl" + (off ? " off" : "") + (kind === mine && !off ? " main" : "");
    if (off) el.setAttribute("aria-disabled", "true"); else el.href = href;
    const txt = document.createElement("span"); txt.className = "txt";
    const n = document.createElement("span"); n.className = "name"; n.textContent = label;
    const s = document.createElement("span"); s.className = "sub"; s.textContent = sub;
    txt.append(n); if (sub) txt.append(s);
    el.append(svg(icon), txt);
    if (tag) { const t = document.createElement("span"); t.className = "tag"; t.textContent = tag; el.append(t); }
    return el;
  }

  const box = document.getElementById("buttons");
  const draw = (info) => {
    const w = info && info.windows, l = info && info.linux, a = info && info.android;
    box.replaceChildren(
      button({ kind: "windows", icon: ICON.win, label: T.win, sub: w ? `${T.winSub} · ${mb(w.size)}` : T.missing, href: "/download/windows", off: !w, tag: w && mine === "windows" ? T.rec : "" }),
      button({ kind: "linux", icon: ICON.lin, label: T.lin, sub: l ? `${T.linSub} · ${mb(l.size)}` : T.missing, href: "/download/linux", off: !l, tag: l && mine === "linux" ? T.rec : "" }),
      button({ kind: "android", icon: ICON.and, label: T.and, sub: a ? `${T.andSub} · ${mb(a.size)}` : T.missing, href: "/download/android", off: !a, tag: a && mine === "android" ? T.rec : "" }));
  };
  draw(null);
  fetch("/web/downloads").then((r) => r.json()).then(draw).catch(() => draw(null));
})();
