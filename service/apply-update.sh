#!/usr/bin/env bash
# Lo ejecuta systemd como root justo antes de arrancar Zinctify (ExecStartPre=+).
# 1) Si hay una actualizacion descargada y comprobada, guarda una copia de la version actual y coloca los archivos nuevos.
# 2) Si la ultima actualizacion colocada no llego a confirmarse (el servidor se cayo al arrancar), vuelve a la copia anterior.
# Nunca falla: si algo sale mal, el servidor arranca igual con lo que haya.
APP="${ZINCTIFY_APP:-/opt/zinctify}"
DATA="${ZINCTIFY_DATA:-/var/lib/zinctify}"
U="$DATA/update"
BK="$DATA/backups/last"
ITEMS="zinctify.py web service README.md"

log() { echo "[apply-update] $*"; }

if [ -f "$U/pending-verify" ]; then
  # La actualizacion anterior aun no se confirmo (hay que llevar 30 s funcionando). Si el servidor se ha caido
  # al arrancar tres veces seguidas, se vuelve a la version anterior. Un reinicio a mano no cuenta como fallo.
  n=$(cat "$U/pending-verify" 2>/dev/null); case "$n" in ''|*[!0-9]*) n=1;; esac
  n=$((n + 1))
  if [ "$n" -ge 3 ] && [ -d "$BK" ]; then
    log "La versión nueva no arranca bien: vuelvo a la anterior."
    for i in $ITEMS; do
      if [ -e "$BK/$i" ]; then rm -rf "$APP/$i"; cp -a "$BK/$i" "$APP/$i"; fi
    done
    bad=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$U/applied.json" 2>/dev/null | head -1)
    echo "{\"ts\": $(date +%s), \"version\": \"$bad\", \"reason\": \"La versión nueva no arrancaba bien y se volvió a la anterior\"}" > "$U/rolled-back.json"
    rm -f "$U/pending-verify" "$U/ready.json"
    rm -rf "$U/staged"
    exit 0
  fi
  echo "$n" > "$U/pending-verify"
fi

if [ -f "$U/ready.json" ] && [ -f "$U/staged/zinctify.py" ] && [ -d "$U/staged/web" ]; then
  log "Colocando la actualización…"
  rm -rf "$BK"; mkdir -p "$BK"
  for i in $ITEMS; do
    [ -e "$APP/$i" ] && cp -a "$APP/$i" "$BK/$i"
  done
  ok=1
  for i in $(ls -A "$U/staged"); do
    case "$i" in .*) continue;; esac
    rm -rf "$APP/$i" && cp -a "$U/staged/$i" "$APP/$i" || ok=0
  done
  chown -R root:root "$APP" 2>/dev/null
  chmod -R u=rwX,go=rX "$APP" 2>/dev/null
  if [ "$ok" = 1 ]; then
    echo 1 > "$U/pending-verify"
    cp "$U/ready.json" "$U/applied.json" 2>/dev/null
    rm -f "$U/rolled-back.json"
    log "Hecho. Se confirmará cuando el servidor lleve 30 s funcionando."
  else
    log "Algo falló al copiar: restauro la copia."
    for i in $ITEMS; do [ -e "$BK/$i" ] && { rm -rf "$APP/$i"; cp -a "$BK/$i" "$APP/$i"; }; done
  fi
  rm -f "$U/ready.json"
  rm -rf "$U/staged"
fi
exit 0
