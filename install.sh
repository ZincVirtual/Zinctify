#!/usr/bin/env bash
# Zinctify installer.   Usage:  git clone <repo> && cd zinctify && ./install.sh
#   ./install.sh                 interactive install (asks for music folder and port)
#   ./install.sh --yes           no questions: default port, music folder set later from the web
#   ./install.sh --music /path --port 4534    answers given on the command line
#   ./install.sh --uninstall     removes the service (your data is kept)
# Installs the dependencies (python3, ffmpeg), copies Zinctify to /opt/zinctify, and starts it as a systemd service.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MUSIC=""; PORT=""; YES=0; UNINSTALL=0
while [ $# -gt 0 ]; do
  case "$1" in
    --music) MUSIC="${2:-}"; shift 2;;
    --port) PORT="${2:-}"; shift 2;;
    --yes|-y) YES=1; shift;;
    --uninstall) UNINSTALL=1; shift;;
    -h|--help) sed -n '2,8p' "$0"; exit 0;;
    *) echo "Unknown option: $1"; exit 1;;
  esac
done

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

# Needs root: asks for the password with sudo if it is not root already.
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null || { echo "Run this as root (sudo is not installed)."; exit 1; }
  echo "Zinctify is installed as a system service, so sudo is needed (it may ask for your password)."
  exec sudo -E bash "$0" "$@"
fi

if [ "$UNINSTALL" = 1 ]; then
  bash "$HERE/service/install-service.sh" --uninstall
  exit 0
fi

[ -f "$HERE/zinctify.py" ] && [ -f "$HERE/web/index.html" ] && [ -f "$HERE/service/install-service.sh" ] \
  || { echo "Run this script from inside the downloaded Zinctify folder (zinctify.py, web/ and service/ must be next to it)."; exit 1; }

# ---------- dependencies ----------
need=()
command -v python3 >/dev/null || need+=(python3)
command -v ffmpeg  >/dev/null || need+=(ffmpeg)
if [ ${#need[@]} -gt 0 ]; then
  say "Installing: ${need[*]}"
  if   command -v apt-get >/dev/null; then apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y "${need[@]}"
  elif command -v pacman  >/dev/null; then pacman -S --noconfirm --needed "${need[@]}"
  elif command -v dnf     >/dev/null; then dnf install -y "${need[@]}"
  elif command -v zypper  >/dev/null; then zypper --non-interactive install "${need[@]}"
  elif command -v apk     >/dev/null; then apk add "${need[@]}"
  else echo "I don't know your package manager. Install by hand: ${need[*]} and run this again."; exit 1; fi
fi
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' || { echo "Zinctify needs Python 3.9 or newer."; exit 1; }
command -v systemctl >/dev/null || { echo "This installer needs systemd. Without it you can still run:  python3 zinctify.py"; exit 1; }

# ---------- questions ----------
ENVF=/etc/zinctify.env
cur_port=""; cur_music=""
if [ -f "$ENVF" ]; then
  cur_port="$(grep -E '^ZINCTIFY_PORT=' "$ENVF" | tail -1 | cut -d= -f2 || true)"
  cur_music="$(grep -E '^ZINCTIFY_MUSIC_DIR=' "$ENVF" | tail -1 | cut -d= -f2 || true)"
fi
if [ "$YES" = 0 ] && [ -t 0 ]; then
  if [ -z "$MUSIC" ]; then
    read -r -p "Music folder (full path; leave empty to set it later from the web) [${cur_music}]: " MUSIC || true
    MUSIC="${MUSIC:-$cur_music}"
  fi
  if [ -z "$PORT" ]; then
    read -r -p "Port [${cur_port:-4534}]: " PORT || true
  fi
fi
PORT="${PORT:-${cur_port:-4534}}"
case "$PORT" in ''|*[!0-9]*) echo "The port must be a number."; exit 1;; esac
MUSIC="${MUSIC/#\~/${SUDO_USER:+$(getent passwd "$SUDO_USER" | cut -d: -f6)}}"
if [ -n "$MUSIC" ] && [ ! -d "$MUSIC" ]; then echo "That folder doesn't exist: $MUSIC"; exit 1; fi

# ---------- install ----------
say "Installing Zinctify"
bash "$HERE/service/install-service.sh" >/tmp/zinctify-install.log 2>&1 || { cat /tmp/zinctify-install.log; exit 1; }

setenv() {   # setenv KEY VALUE  -> sets it in /etc/zinctify.env (replaces the line, even if it was commented out)
  if grep -qE "^#?$1=" "$ENVF"; then sed -i -E "s|^#?$1=.*|$1=$2|" "$ENVF"; else echo "$1=$2" >> "$ENVF"; fi
}
setenv ZINCTIFY_PORT "$PORT"
[ -n "$MUSIC" ] && setenv ZINCTIFY_MUSIC_DIR "$MUSIC"
systemctl restart zinctify
sleep 2

# ---------- checks ----------
if ! systemctl is-active --quiet zinctify; then
  echo "Zinctify did not start. Last log lines:"; journalctl -u zinctify -n 20 --no-pager; exit 1
fi
if [ -n "$MUSIC" ] && ! runuser -u zinctify -- test -r "$MUSIC" 2>/dev/null; then
  echo
  echo "WARNING: the 'zinctify' user cannot read $MUSIC."
  echo "  Give read permission, e.g.:  sudo chmod -R a+rX \"$MUSIC\"   (and a+x on every parent folder, such as your home)"
fi
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
say "Done!"
echo "Open  http://${IP:-YOUR_SERVER_IP}:${PORT}  in your browser."
echo "The FIRST account you create becomes the administrator."
[ -z "$MUSIC" ] && echo "Then set your music folder in Administration -> Overview."
echo
echo "  Logs:       journalctl -u zinctify -f"
echo "  Restart:    sudo systemctl restart zinctify"
echo "  Settings:   /etc/zinctify.env"
echo "  Uninstall:  ./install.sh --uninstall   (keeps your data)"
echo "  If a firewall is active, allow port ${PORT}/tcp."
