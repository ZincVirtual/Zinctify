/* Si algo falla al arrancar, se enseña el error en pantalla en vez de dejarla en blanco. */
(function () {
  function show(msg) {
    try {
      if (document.getElementById("zt-guard")) return;
      var d = document.createElement("div");
      d.id = "zt-guard";
      d.style.cssText = "position:fixed;inset:0;z-index:99999;background:#0b1230;color:#f2f2f7;padding:20px;font:14px/1.5 sans-serif;overflow:auto";
      d.textContent = "Zinctify: error al arrancar / startup error\n\n" + msg + "\n\n" + navigator.userAgent;
      d.style.whiteSpace = "pre-wrap";
      var b = document.createElement("button");
      b.textContent = "Recargar / Reload";
      b.style.cssText = "display:block;margin:16px 0;padding:10px 16px;font:inherit";
      b.onclick = function () { location.reload(); };
      d.appendChild(b);
      document.body.appendChild(d);
    } catch (e) { /* nada */ }
  }
  window.addEventListener("error", function (e) { show((e.message || "error") + (e.filename ? "\n" + e.filename + ":" + e.lineno + ":" + e.colno : "")); });
  window.addEventListener("unhandledrejection", function (e) { if (document.getElementById("app") && !document.getElementById("app").firstChild) show(String(e.reason && (e.reason.stack || e.reason))); });
})();
