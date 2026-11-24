#!/usr/bin/env bash
# Instala Zinctify como servicio de systemd.
# Uso:  sudo bash service/install-service.sh        (desde la carpeta donde esta zinctify.py)
#       sudo bash service/install-service.sh --uninstall   (quita el servicio; no borra tus datos)
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then echo "Ejecutalo con sudo."; exit 1; fi
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$(dirname "$HERE")"
APP=/opt/zinctify
DATA=/var/lib/zinctify

if [ "${1:-}" = "--uninstall" ]; then
  systemctl disable --now zinctify 2>/dev/null || true
  rm -f /etc/systemd/system/zinctify.service
  systemctl daemon-reload
  echo "Servicio quitado. Se conservan $APP, $DATA y /etc/zinctify.env."
  exit 0
fi

[ -f "$SRC/zinctify.py" ] && [ -f "$SRC/web/index.html" ] || { echo "No encuentro zinctify.py y web/ junto a la carpeta service/."; exit 1; }
command -v python3 >/dev/null || { echo "Falta python3: apt install python3"; exit 1; }
command -v ffmpeg  >/dev/null || { echo "Falta ffmpeg: apt install ffmpeg"; exit 1; }

# usuario sin login propio del servicio
id zinctify >/dev/null 2>&1 || useradd --system --home-dir "$DATA" --shell /usr/sbin/nologin zinctify

# programa
mkdir -p "$APP" "$DATA"
install -m 0644 "$SRC/zinctify.py" "$APP/zinctify.py"
rm -rf "$APP/web" && cp -r "$SRC/web" "$APP/web"
rm -rf "$APP/service" && cp -r "$SRC/service" "$APP/service" && chmod 0755 "$APP/service/apply-update.sh"
[ -f "$SRC/README.md" ] && install -m 0644 "$SRC/README.md" "$APP/README.md"

# datos: si ya tenias una carpeta zinctify-data / minisonic-data, se copia la primera vez.
# Se copia a una carpeta temporal y solo al terminar se coloca, para que un corte no deje la base de datos a medias.
if [ ! -e "$DATA/zinctify.db" ] && [ ! -e "$DATA/minisonic.db" ]; then
  for old in "$PWD/zinctify-data" "$SRC/zinctify-data" "$PWD/minisonic-data" "$SRC/minisonic-data"; do
    if [ -d "$old" ]; then
      echo "Encuentro tus datos en $old ($(du -sh --exclude=transcode --exclude=duplicadas-eliminadas "$old" 2>/dev/null | cut -f1)). Copiando (la cache de audio y la carpeta duplicadas-eliminadas NO se copian; se quedan donde estan)..."
      rm -rf "$DATA.tmp" && mkdir -p "$DATA.tmp"
      if command -v rsync >/dev/null; then
        rsync -a --info=progress2 --exclude=transcode/ --exclude=duplicadas-eliminadas/ "$old"/ "$DATA.tmp"/
      else
        tar -C "$old" --exclude=./transcode --exclude=./duplicadas-eliminadas -cf - . | tar -C "$DATA.tmp" -xf -
      fi
      cp -a "$DATA.tmp"/. "$DATA"/ && rm -rf "$DATA.tmp"
      echo "Datos copiados."
      break
    fi
  done
fi
chown -R zinctify:zinctify "$DATA"

# ajustes (no se pisan si ya existen). Todo va dentro de este script: no hace falta ningun otro archivo.
if [ ! -f /etc/zinctify.env ]; then
cat > /etc/zinctify.env <<'ENVEOF'
# Ajustes de Zinctify. Tras cambiar algo: sudo systemctl restart zinctify
# La carpeta de musica se puede poner desde la web (Administracion -> Resumen).
# Si prefieres ponerla aqui, quita el # de la linea siguiente:
#ZINCTIFY_MUSIC_DIR=/ruta/a/tu/musica
ZINCTIFY_PORT=4534
ZINCTIFY_SCAN_MINUTES=10
#ZINCTIFY_TRANSCODE_MB=2048
ENVEOF
chown root:zinctify /etc/zinctify.env
chmod 0640 /etc/zinctify.env
fi

cat > /etc/systemd/system/zinctify.service <<'UNITEOF'
[Unit]
Description=Zinctify (servidor de musica compatible con Subsonic)
Documentation=file:///opt/zinctify/README.md
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=zinctify
Group=zinctify
WorkingDirectory=/opt/zinctify
# Ajustes (puerto, carpeta de musica opcional...) en /etc/zinctify.env
EnvironmentFile=-/etc/zinctify.env
Environment=ZINCTIFY_DATA_DIR=/var/lib/zinctify
# Actualizacion desde Administracion: antes de arrancar (como root, el «+») se colocan los archivos descargados
Environment=ZINCTIFY_SELF_UPDATE=1
ExecStartPre=+/bin/bash /opt/zinctify/service/apply-update.sh
ExecStart=/usr/bin/python3 /opt/zinctify/zinctify.py
Restart=always
RestartSec=5
# Con ffmpeg en marcha, darle tiempo a cerrar bien la base de datos al parar
TimeoutStopSec=20

# Aislamiento: solo puede escribir en su carpeta de datos; la musica la lee
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/lib/zinctify
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true

[Install]
WantedBy=multi-user.target
UNITEOF
chmod 0644 /etc/systemd/system/zinctify.service
systemctl daemon-reload
systemctl enable --now zinctify
sleep 2
systemctl --no-pager --lines=8 status zinctify || true

PORT=$(grep -E '^ZINCTIFY_PORT=' /etc/zinctify.env | cut -d= -f2 || true)
echo
echo "Listo. Abre http://IP_DEL_SERVIDOR:${PORT:-4534}"
echo "  Ver el registro:  journalctl -u zinctify -f"
echo "  Reiniciar:        sudo systemctl restart zinctify"
echo "  Ajustes:          /etc/zinctify.env"
echo "  Importante: el usuario 'zinctify' tiene que poder LEER tu carpeta de musica (permisos de lectura)."
