#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Zinctify 0.2 - servidor de musica que habla la API Subsonic/OpenSubsonic.

Solo usa la libreria estandar de Python 3.9+ y dos programas externos: ffprobe
(leer tags) y ffmpeg (caratulas). En Debian: sudo apt install ffmpeg

Que hace:
  - Escanea una carpeta de musica y guarda artistas/albumes/canciones en SQLite.
  - Normaliza los textos (espacios raros, comillas curvas, guiones bajos, tildes
    y mayusculas) para que "Daft_Punk", "Daft Punk" y "daft punk" sean UN artista.
  - Habla Subsonic: ping, getArtists, getAlbum, search3, stream, getCoverArt...
  - Guarda cada reproduccion (scrobble) y las usa para el Wrapped en /api/wrapped.
  - Gestiona radios de internet (las URLs; Icecast solo hace falta para EMITIR).

Uso rapido:
  python3 zinctify.py --music-dir /ruta/a/tu/musica
"""
import argparse
import base64
import difflib
import gzip
import hashlib
import hmac
import json
import mimetypes
import os
import random
import re
import secrets
import shutil
import smtplib
import ssl
import sqlite3
import subprocess
import sys
import threading
import time
import traceback
import unicodedata
from datetime import datetime, timezone
from email.message import EmailMessage
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, unquote, urlencode, urljoin, urlparse
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

API_VERSION = "1.16.1"
SERVER_NAME = "Zinctify"
SERVER_VERSION = "1.3.0"
SERVER_STARTED = int(time.time())
XMLNS = "http://subsonic.org/restapi"

AUDIO_EXTS = {".mp3", ".flac", ".ogg", ".opus", ".m4a", ".aac", ".wav", ".wma", ".ape", ".wv", ".alac"}
COVER_BASENAMES = ("cover", "folder", "front", "album", "albumart")
COVER_EXTS = (".jpg", ".jpeg", ".png", ".webp")
CONTENT_TYPES = {
    ".mp3": "audio/mpeg", ".flac": "audio/flac", ".ogg": "audio/ogg", ".opus": "audio/ogg",
    ".m4a": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/x-wav", ".wma": "audio/x-ms-wma",
}
# Nombres neutros: la interfaz web los traduce al idioma del usuario.
UNKNOWN_ARTIST = "Unknown Artist"
UNKNOWN_ALBUM = "Unknown Album"

# True: "Beyonce" y "Beyonce" con tilde se agrupan como el mismo artista.
# Ponlo en False si prefieres que las tildes cuenten como letras distintas.
FOLD_ACCENTS = True


STATIC_TYPES = {".webmanifest": "application/manifest+json", ".woff": "font/woff", ".woff2": "font/woff2", ".otf": "font/otf", ".ttf": "font/ttf",
                ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon"}


class Config:
    """Se rellena en main()."""
    music_dir = ""
    data_dir = ""
    db_path = ""
    cover_dir = ""
    web_dir = ""
    transcode_mb = 2048


CFG = Config()


def log(msg):
    sys.stderr.write("[%s] %s\n" % (time.strftime("%H:%M:%S"), msg))
    sys.stderr.flush()


# ---------------------------------------------------------------------------
# Normalizacion de textos (aqui se arregla el problema de los caracteres raros)
# ---------------------------------------------------------------------------

def _build_translate():
    t = {}
    for ch in "\u2018\u2019\u201a\u201b\u2032\u00b4`":      # comillas simples tipograficas
        t[ord(ch)] = "'"
    for ch in "\u201c\u201d\u201e\u2033":                   # comillas dobles tipograficas
        t[ord(ch)] = '"'
    for ch in "\u2010\u2011\u2012\u2013\u2014\u2015\u2212":  # guiones raros
        t[ord(ch)] = "-"
    for ch in "\u200b\u200c\u200d\u2060\ufeff\u00ad":        # caracteres invisibles
        t[ord(ch)] = None
    return t


_TRANSLATE = _build_translate()


_MOJIBAKE_HINT = re.compile("[\u00c2\u00c3\u00c5\u00e2\u00ef][\u0080-\u00bf\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013-\u203a\u20ac\u2122]")


def fix_mojibake(s):
    """'BeyoncÃ©' -> 'Beyoncé'. Pasa cuando un programa guardo bytes UTF-8 declarandolos como Latin-1.
    Solo cambia el texto si al deshacer el error sale UTF-8 valido (casi nunca falla por casualidad)."""
    if not s or not _MOJIBAKE_HINT.search(s):
        return s
    for _ in range(2):                                  # a veces esta roto dos veces
        fixed = None
        for enc in ("cp1252", "latin-1"):
            try:
                fixed = s.encode(enc).decode("utf-8")
                break
            except (UnicodeEncodeError, UnicodeDecodeError):
                continue
        if fixed is None or fixed == s:
            break
        s = fixed
        if not _MOJIBAKE_HINT.search(s):
            break
    return s


def clean_text(s):
    """Version 'bonita' para mostrar: sin invisibles, espacios raros ni comillas curvas."""
    if s is None:
        return ""
    s = unicodedata.normalize("NFC", fix_mojibake(str(s)))
    s = s.translate(_TRANSLATE)
    s = "".join(c for c in s if c in "\t\r\n" or unicodedata.category(c) != "Cc")
    s = re.sub(r"\s+", " ", s).strip()      # \s incluye el espacio no separable (U+00A0)
    if "_" in s and " " not in s:           # "Daft_Punk" -> "Daft Punk"
        s = s.replace("_", " ")
    return s


def norm_key(s):
    """Clave de comparacion: dos textos 'iguales para una persona' dan la misma clave."""
    s = clean_text(s).replace("_", " ")
    s = unicodedata.normalize("NFKD", s)
    if FOLD_ACCENTS:
        s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.casefold()
    return re.sub(r"\s+", " ", s).strip()


# ---------------------------------------------------------------------------
# Varios artistas en una cancion: "*NSYNC, Nelly" -> dos artistas (*NSYNC y Nelly)
# ---------------------------------------------------------------------------

SPLIT_VERSION = "2"      # sube este numero si cambias las reglas: fuerza a releer la biblioteca

# Nombres que llevan un separador (coma, &, /...) pero son UN solo artista.
# Puedes anadir los tuyos en <data-dir>/artistas-sin-separar.txt (un nombre por linea).
NO_SPLIT_BUILTIN = [
    "Simon & Garfunkel", "Earth, Wind & Fire", "Tyler, The Creator", "AC/DC", "Hall & Oates",
    "Crosby, Stills, Nash & Young", "Crosby, Stills & Nash", "Sonny & Cher", "Brooks & Dunn",
    "Mumford & Sons", "Years & Years", "Iron & Wine", "Matt & Kim", "Nico & Vinz", "Ike & Tina Turner",
    "Peaches & Herb", "Echo & The Bunnymen", "Kool & The Gang", "Hootie & The Blowfish",
    "Katrina & The Waves", "Huey Lewis & The News", "Tom Petty & The Heartbreakers",
    "Bob Marley & The Wailers", "Bruce Springsteen & The E Street Band", "Derek & The Dominos",
    "Marina & The Diamonds", "Gloria Estefan & Miami Sound Machine", "Big Brother & The Holding Company",
    "Florence & The Machine", "Belle & Sebastian", "Emerson, Lake & Palmer", "Sly & The Family Stone",
]
NO_SPLIT_FILE = "artistas-sin-separar.txt"
_no_split_extra = []
_protect_res = []

_SEP = re.compile(r"\s*;\s*|\s+(?:feat\.?|ft\.?|featuring)\s+|\s+(?:x|×|vs\.?)\s+|\s+&\s+|\s*,\s*|\s+/\s+",
                  re.IGNORECASE)
_SEP_PAREN = re.compile(r"\s*[\(\[]\s*(?:feat\.?|ft\.?|featuring)\s+([^\)\]]+)[\)\]]", re.IGNORECASE)
_SLASH = re.compile(r"(?<=\w{3})/(?=\w{3})")      # "Chris Brown/Tyga" si; "AC/DC" no


def load_no_split():
    """Lee artistas-sin-separar.txt (lo crea con un ejemplo si no existe) y prepara las reglas."""
    global _no_split_extra, _protect_res
    path = os.path.join(CFG.data_dir, NO_SPLIT_FILE)
    if not os.path.exists(path):
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write("# Artistas cuyo nombre lleva una coma, & o / y NO debe separarse en dos.\n"
                        "# Un nombre por linea. Las lineas que empiezan por # se ignoran.\n"
                        "# Ejemplo:\n# Sofi Tukker & Friends\n")
        except OSError:
            pass
    extra = []
    try:
        with open(path, encoding="utf-8") as f:
            extra = [clean_text(l) for l in f if l.strip() and not l.lstrip().startswith("#")]
    except OSError:
        pass
    _no_split_extra = [x for x in extra if x]
    names = sorted(set(NO_SPLIT_BUILTIN + _no_split_extra), key=len, reverse=True)   # los largos primero
    _protect_res = [re.compile(r"(?<!\w)" + re.escape(n) + r"(?!\w)", re.IGNORECASE) for n in names]


def split_signature():
    """Cambia si cambian las reglas o tu lista: asi se vuelve a leer la biblioteca sola."""
    h = hashlib.md5("\n".join(NO_SPLIT_BUILTIN + ["--"] + _no_split_extra).encode("utf-8")).hexdigest()[:10]
    return "%s:%s" % (SPLIT_VERSION, h)


def split_artists(raw, album_artist=None):
    """'*NSYNC, Nelly' -> ['*NSYNC', 'Nelly']. Separa por ; , & / feat. ft. x vs (y los nulos de ID3).
    No separa nombres protegidos ('Simon & Garfunkel') ni un artista igual al artista del album."""
    text = clean_text(str(raw or "").replace("\x00", ";"))
    if not text:
        return []
    if album_artist and norm_key(album_artist) == norm_key(text):
        return [text]
    holders = {}

    def hold(m):
        key = "%d" % len(holders)
        holders[key] = m.group(0)
        return key
    for pat in _protect_res:
        text = pat.sub(hold, text)
    parts = []
    for chunk in _SEP.split(_SEP_PAREN.sub(r" feat. \1", text)):
        parts.extend(_SLASH.split(chunk))
    out, seen = [], set()
    for part in parts:
        for key, val in holders.items():
            part = part.replace(key, val)
        name = clean_text(part)
        nk = norm_key(name)
        if name and nk not in seen:
            seen.add(nk)
            out.append(name)
    return out


def first_int(v):
    m = re.match(r"\s*(\d+)", str(v or ""))
    return int(m.group(1)) if m else None


def safe_float(v, default=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def iso(ts):
    return datetime.fromtimestamp(int(ts), timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


# ---------------------------------------------------------------------------
# Base de datos
# ---------------------------------------------------------------------------

SCHEMA = """
CREATE TABLE IF NOT EXISTS artists(
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, nkey TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS albums(
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, nkey TEXT NOT NULL,
  artist_id INTEGER NOT NULL, year INTEGER, genre TEXT, cover_src TEXT,
  created INTEGER NOT NULL, UNIQUE(artist_id, nkey));
CREATE TABLE IF NOT EXISTS songs(
  id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL UNIQUE, mtime REAL NOT NULL,
  size INTEGER NOT NULL, title TEXT NOT NULL, nkey TEXT NOT NULL,
  album_id INTEGER NOT NULL, artist_id INTEGER NOT NULL,
  track INTEGER, disc INTEGER, year INTEGER, genre TEXT, duration INTEGER, bitrate INTEGER,
  suffix TEXT, content_type TEXT, has_art INTEGER DEFAULT 0, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS songs_album ON songs(album_id);
CREATE INDEX IF NOT EXISTS songs_nkey ON songs(nkey);
CREATE INDEX IF NOT EXISTS songs_created ON songs(created);
CREATE INDEX IF NOT EXISTS songs_genre ON songs(genre COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS songs_artist ON songs(artist_id);
-- Una cancion puede tener varios artistas (pos 0 = el principal, el mismo que songs.artist_id).
CREATE TABLE IF NOT EXISTS song_artists(
  song_id INTEGER NOT NULL, artist_id INTEGER NOT NULL, pos INTEGER NOT NULL,
  PRIMARY KEY(song_id, artist_id));
CREATE INDEX IF NOT EXISTS song_artists_artist ON song_artists(artist_id);
-- Cada reproduccion guarda una "foto" de los textos: asi el Wrapped no se rompe si
-- reescaneas la biblioteca o cambias los tags de una cancion.
CREATE TABLE IF NOT EXISTS plays(
  id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT NOT NULL, ts INTEGER NOT NULL,
  song_id INTEGER, title TEXT NOT NULL, artist TEXT NOT NULL, album TEXT NOT NULL,
  genre TEXT, duration INTEGER);
CREATE INDEX IF NOT EXISTS plays_user_ts ON plays(user, ts);
CREATE INDEX IF NOT EXISTS plays_song ON plays(song_id);
CREATE INDEX IF NOT EXISTS plays_ts ON plays(ts);
-- Los artistas de cada reproduccion (tambien como "foto"), para que el Wrapped cuente a cada uno.
CREATE TABLE IF NOT EXISTS play_artists(
  play_id INTEGER NOT NULL, artist TEXT NOT NULL, PRIMARY KEY(play_id, artist));
CREATE TABLE IF NOT EXISTS radios(
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, stream_url TEXT NOT NULL,
  homepage_url TEXT);
-- pw_hash: contrasena de la web (con hash, no se puede recuperar).
-- api_key: "clave para apps" que usan Feishin/Symfonium...; Subsonic obliga a guardarla en claro.
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pw_hash TEXT NOT NULL, api_key TEXT NOT NULL, is_admin INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL);
-- Playlists de los usuarios (privadas por defecto) y su biblioteca (lo guardado con el corazon).
CREATE TABLE IF NOT EXISTS playlists(
  id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL, name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '', public INTEGER NOT NULL DEFAULT 0, cover INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL, updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS playlist_songs(
  id INTEGER PRIMARY KEY AUTOINCREMENT, playlist_id INTEGER NOT NULL, song_id INTEGER NOT NULL,
  pos INTEGER NOT NULL, added INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS playlist_songs_pl ON playlist_songs(playlist_id, pos);
CREATE TABLE IF NOT EXISTS library(
  user_id INTEGER NOT NULL, kind TEXT NOT NULL, item_id INTEGER NOT NULL, saved_at INTEGER NOT NULL,
  last_played INTEGER, PRIMARY KEY(user_id, kind, item_id));
CREATE TABLE IF NOT EXISTS sessions(
  token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL);
-- Tiempo escuchando radios (para el Wrapped): una fila por usuario, radio y dia.
CREATE TABLE IF NOT EXISTS radio_listen(
  user TEXT NOT NULL, radio_id TEXT NOT NULL, day INTEGER NOT NULL, name TEXT NOT NULL, seconds INTEGER NOT NULL DEFAULT 0, starts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user, radio_id, day));
-- Chat entre amigos: el contenido (texto o elemento compartido) se guarda cifrado y nunca se borra.
CREATE TABLE IF NOT EXISTS chat_messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT, sender_id INTEGER NOT NULL, recipient_id INTEGER NOT NULL, ts INTEGER NOT NULL, body TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS chat_to ON chat_messages(recipient_id, id);
CREATE INDEX IF NOT EXISTS chat_pair ON chat_messages(sender_id, recipient_id, id);
CREATE TABLE IF NOT EXISTS chat_reads(user_id INTEGER NOT NULL, other_id INTEGER NOT NULL, last_id INTEGER NOT NULL, PRIMARY KEY(user_id, other_id));
-- Recuperar contrasena por correo: un codigo de 6 cifras (solo su hash) y, ya verificado, un permiso de un solo uso.
CREATE TABLE IF NOT EXISTS pw_resets(
  user_id INTEGER PRIMARY KEY, code_hash TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
  ok_hash TEXT, ok_expires INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS settings(
  name TEXT PRIMARY KEY, value TEXT NOT NULL);
-- Sesion de Spotify de cada usuario (OAuth PKCE), solo para leer sus playlists al importarlas.
CREATE TABLE IF NOT EXISTS spotify_tokens(
  user_id INTEGER PRIMARY KEY, access TEXT NOT NULL, refresh TEXT NOT NULL, exp INTEGER NOT NULL);
-- Correcciones de metadatos aceptadas por el administrador. Los archivos de musica NO se tocan:
-- al leer cada archivo se aplican estos valores por encima de sus tags.
CREATE TABLE IF NOT EXISTS overrides(
  path TEXT PRIMARY KEY, title TEXT, artist TEXT, album TEXT, album_artist TEXT);
-- Propuestas del escaner de metadatos (MusicBrainz, Deezer...). status: pending / accepted / rejected.
CREATE TABLE IF NOT EXISTS suggestions(
  id INTEGER PRIMARY KEY AUTOINCREMENT, song_id INTEGER NOT NULL, field TEXT NOT NULL,
  current TEXT NOT NULL, suggested TEXT NOT NULL, score REAL NOT NULL, providers TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', created INTEGER NOT NULL, UNIQUE(song_id, field, suggested));
CREATE INDEX IF NOT EXISTS suggestions_status ON suggestions(status, score);
-- Duplicadas: grupos marcados como "no son duplicadas" y archivos que el administrador ha ocultado.
CREATE TABLE IF NOT EXISTS dup_dismissed(key TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS ignored_paths(path TEXT PRIMARY KEY, ts INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS follows(
  follower_id INTEGER NOT NULL, followed_id INTEGER NOT NULL, ts INTEGER NOT NULL,
  PRIMARY KEY(follower_id, followed_id));
CREATE INDEX IF NOT EXISTS follows_followed ON follows(followed_id);
-- Papelera de cada usuario: lo que esta aqui se salta al reproducir.
CREATE TABLE IF NOT EXISTS trash(
  user_id INTEGER NOT NULL, kind TEXT NOT NULL, item_id INTEGER NOT NULL, ts INTEGER NOT NULL,
  PRIMARY KEY(user_id, kind, item_id));
-- Foto y biografia de cada artista (la foto vive en data/images/artist-N.jpg|gif).
CREATE TABLE IF NOT EXISTS artist_info(
  artist_id INTEGER PRIMARY KEY, bio TEXT, photo INTEGER NOT NULL DEFAULT 0, source TEXT);
-- Letras guardadas: sincronizadas (LRC) y/o sin sincronizar. found=0 es "no la hay" (se vuelve a intentar a la semana).
CREATE TABLE IF NOT EXISTS lyrics(
  song_id INTEGER PRIMARY KEY, synced TEXT, plain TEXT, source TEXT, found INTEGER NOT NULL DEFAULT 1, fetched INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS meta_checked(song_id INTEGER PRIMARY KEY, ts INTEGER NOT NULL);
-- Playlists importadas de otro servicio y vinculadas a el. tracks = JSON con cada cancion de origen y la del servidor que le toco.
CREATE TABLE IF NOT EXISTS playlist_links(
  playlist_id INTEGER PRIMARY KEY, source TEXT NOT NULL, url TEXT NOT NULL, title TEXT NOT NULL DEFAULT '',
  auto INTEGER NOT NULL DEFAULT 1, last_sync INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT '',
  tracks TEXT NOT NULL DEFAULT '[]');
-- Playlists colaborativas: quien puede editarlas ademas del dueno. status: pending (invitado) / accepted.
CREATE TABLE IF NOT EXISTS playlist_members(
  playlist_id INTEGER NOT NULL, user_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  invited_by INTEGER NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY(playlist_id, user_id));
CREATE INDEX IF NOT EXISTS playlist_members_user ON playlist_members(user_id);
-- Campana de notificaciones. UNIQUE evita avisar dos veces de lo mismo.
CREATE TABLE IF NOT EXISTS notifications(
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, kind TEXT NOT NULL, ref TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}', ts INTEGER NOT NULL, read INTEGER NOT NULL DEFAULT 0, UNIQUE(user_id, kind, ref));
CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id, ts);
"""

_local = threading.local()


STATIC_CACHE = {}          # archivo de la web -> ((mtime, tamaño), bytes, bytes gzip, etag): no se lee ni se comprime en cada petición


def db():
    """Una conexion SQLite por hilo (el servidor atiende cada peticion en un hilo)."""
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(CFG.db_path, timeout=30)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")          # con WAL es seguro y escribe bastante menos en disco
        conn.execute("PRAGMA temp_store=MEMORY")
        conn.execute("PRAGMA cache_size=-32768")           # 32 MB de caché por conexión
        conn.execute("PRAGMA mmap_size=268435456")         # lee la base de datos mapeada en memoria
        _local.conn = conn
    return conn


def init_db():
    conn = sqlite3.connect(CFG.db_path)
    conn.executescript(SCHEMA)
    cols = {r[1] for r in conn.execute("PRAGMA table_info(songs)")}
    for col, kind in (("artist_display", "TEXT"), ("artist_nkey", "TEXT"), ("loudness", "REAL")):   # versiones anteriores
        if col not in cols:
            conn.execute("ALTER TABLE songs ADD COLUMN %s %s" % (col, kind))
    if "pinned" not in {r[1] for r in conn.execute("PRAGMA table_info(library)")}:
        conn.execute("ALTER TABLE library ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0")
    for tbl in ("follows", "library"):                      # campanita: avisar o no de lo nuevo (por defecto si)
        if "notify" not in {r[1] for r in conn.execute("PRAGMA table_info(%s)" % tbl)}:
            conn.execute("ALTER TABLE %s ADD COLUMN notify INTEGER NOT NULL DEFAULT 1" % tbl)
    ucols = {r[1] for r in conn.execute("PRAGMA table_info(users)")}
    for col, kind in (("email", "TEXT"), ("display_name", "TEXT"), ("bio", "TEXT"), ("avatar", "INTEGER DEFAULT 0"),
                      ("prefs", "TEXT"), ("banner", "INTEGER DEFAULT 0")):
        if col not in ucols:
            conn.execute("ALTER TABLE users ADD COLUMN %s %s" % (col, kind))
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(email COLLATE NOCASE) WHERE email IS NOT NULL")
    conn.commit()
    # Reproducciones antiguas: reparte "A, B" entre sus artistas para el Wrapped.
    old = conn.execute("SELECT id, artist FROM plays WHERE id NOT IN (SELECT play_id FROM play_artists)").fetchall()
    for pid, artist in old:
        for name in split_artists(artist) or [UNKNOWN_ARTIST]:
            conn.execute("INSERT OR IGNORE INTO play_artists(play_id, artist) VALUES(?,?)", (pid, name))
    conn.commit()
    conn.close()


def prefer_name(old, new):
    """Si un nombre esta todo en mayusculas o todo en minusculas y aparece otra variante
    con mayusculas normales ("Daft Punk"), se queda con la normal."""
    def mixed(s):
        return s != s.lower() and s != s.upper()

    def accents(s):                      # "Beyoncé" gana a "Beyonce": la version sin tildes es la degradada
        return sum(1 for c in s if ord(c) > 127)
    if mixed(new) != mixed(old):
        return new if mixed(new) else old
    return new if accents(new) > accents(old) else old


def get_or_create_artist(conn, name):
    name = clean_text(name) or UNKNOWN_ARTIST
    nkey = norm_key(name)
    row = conn.execute("SELECT id, name FROM artists WHERE nkey=?", (nkey,)).fetchone()
    if row:
        best = prefer_name(row["name"], name)
        if best != row["name"]:
            conn.execute("UPDATE artists SET name=? WHERE id=?", (best, row["id"]))
        return row["id"]
    return conn.execute("INSERT INTO artists(name, nkey) VALUES(?,?)", (name, nkey)).lastrowid


def get_or_create_album(conn, name, artist_id, year, genre, mtime):
    name = clean_text(name) or UNKNOWN_ALBUM
    nkey = norm_key(name)
    row = conn.execute("SELECT id, name FROM albums WHERE artist_id=? AND nkey=?", (artist_id, nkey)).fetchone()
    if row:
        conn.execute("UPDATE albums SET name=?, created=MIN(created, ?), year=COALESCE(year, ?), "
                     "genre=COALESCE(genre, ?) WHERE id=?",
                     (prefer_name(row["name"], name), mtime, year, genre, row["id"]))
        return row["id"]
    return conn.execute("INSERT INTO albums(name, nkey, artist_id, year, genre, created) VALUES(?,?,?,?,?,?)",
                        (name, nkey, artist_id, year, genre, mtime)).lastrowid


# ---------------------------------------------------------------------------
# Escaneo de la biblioteca
# ---------------------------------------------------------------------------

SCAN = {"scanning": False, "count": 0, "last": None}
_scan_lock = threading.Lock()


def probe(path):
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", path],
            capture_output=True, timeout=60)
        if out.returncode != 0:
            return None
        return json.loads(out.stdout.decode("utf-8", "replace") or "{}")
    except (OSError, subprocess.SubprocessError, ValueError):
        return None


def find_folder_cover(dirpath, filenames):
    lower = {fn.lower(): fn for fn in filenames}
    for base in COVER_BASENAMES:
        for ext in COVER_EXTS:
            if base + ext in lower:
                return os.path.join(dirpath, lower[base + ext])
    return None


def index_file(conn, path, st, folder_cover):
    info = probe(path)
    if not info:
        return False
    streams = info.get("streams", [])
    audio = [s for s in streams if s.get("codec_type") == "audio"]
    if not audio:
        return False
    fmt = info.get("format", {})
    tags = {str(k).lower(): str(v) for k, v in (fmt.get("tags") or {}).items()}
    for k, v in (audio[0].get("tags") or {}).items():      # ogg/opus guardan los tags en el stream
        tags.setdefault(str(k).lower(), str(v))
    has_art = any(s.get("codec_type") == "video" for s in streams)

    album_artist_tag = tags.get("album_artist") or tags.get("albumartist")
    title = clean_text(tags.get("title")) or clean_text(os.path.splitext(os.path.basename(path))[0])
    ov = conn.execute("SELECT * FROM overrides WHERE path=?", (path,)).fetchone()
    if ov:                                    # correcciones aceptadas en el panel de administracion
        if ov["title"]:
            title = clean_text(ov["title"])
        if ov["artist"]:
            tags["artist"] = ov["artist"]
        if ov["album"]:
            tags["album"] = ov["album"]
        if ov["album_artist"]:
            album_artist_tag = ov["album_artist"]
    loudness = None
    try:                                                   # ReplayGain ya escrito en el archivo: nos ahorra medirlo
        loudness = -18.0 - float(re.sub(r"[^0-9.+-]", "", tags.get("replaygain_track_gain", "")) or "x")
    except ValueError:
        pass
    raw_artist = tags.get("artist") or album_artist_tag or ""
    names = split_artists(raw_artist, album_artist_tag) or [UNKNOWN_ARTIST]
    artist_display = ", ".join(names) if "\x00" in raw_artist else (clean_text(raw_artist) or UNKNOWN_ARTIST)
    aa_names = split_artists(album_artist_tag) if album_artist_tag else []
    album_artist = aa_names[0] if aa_names else names[0]       # el album cuelga del artista principal
    album = clean_text(tags.get("album")) or UNKNOWN_ALBUM
    m = re.search(r"(\d{4})", tags.get("date") or tags.get("year") or tags.get("originaldate") or "")
    year = int(m.group(1)) if m else None
    genre = clean_text(tags.get("genre")) or None
    track = first_int(tags.get("track") or tags.get("tracknumber"))
    disc = first_int(tags.get("disc") or tags.get("discnumber"))
    duration = int(round(safe_float(fmt.get("duration") or audio[0].get("duration"))))
    bitrate = int(round(safe_float(fmt.get("bit_rate") or audio[0].get("bit_rate")) / 1000.0))
    ext = os.path.splitext(path)[1].lower()
    ctype = CONTENT_TYPES.get(ext) or mimetypes.guess_type(path)[0] or "application/octet-stream"

    artist_ids = [get_or_create_artist(conn, n) for n in names]
    artist_id = artist_ids[0]
    album_artist_id = get_or_create_artist(conn, album_artist)
    album_id = get_or_create_album(conn, album, album_artist_id, year, genre, int(st.st_mtime))

    conn.execute("""
        INSERT INTO songs(path, mtime, size, title, nkey, album_id, artist_id, track, disc, year, genre,
                          duration, bitrate, suffix, content_type, has_art, created, artist_display, artist_nkey,
                          loudness)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(path) DO UPDATE SET
          mtime=excluded.mtime, size=excluded.size, title=excluded.title, nkey=excluded.nkey,
          album_id=excluded.album_id, artist_id=excluded.artist_id, track=excluded.track,
          disc=excluded.disc, year=excluded.year, genre=excluded.genre, duration=excluded.duration,
          bitrate=excluded.bitrate, suffix=excluded.suffix, content_type=excluded.content_type,
          has_art=excluded.has_art, created=excluded.created,
          artist_display=excluded.artist_display, artist_nkey=excluded.artist_nkey,
          loudness=CASE WHEN songs.mtime = excluded.mtime AND songs.size = excluded.size
                        THEN COALESCE(excluded.loudness, songs.loudness) ELSE excluded.loudness END
        """, (path, st.st_mtime, st.st_size, title, norm_key(title), album_id, artist_id, track, disc,
              year, genre, duration, bitrate, ext.lstrip("."), ctype, 1 if has_art else 0, int(st.st_mtime),
              artist_display, norm_key(artist_display + " " + " ".join(names)), loudness))
    song_id = conn.execute("SELECT id FROM songs WHERE path=?", (path,)).fetchone()["id"]
    conn.execute("DELETE FROM song_artists WHERE song_id=?", (song_id,))
    conn.executemany("INSERT OR IGNORE INTO song_artists(song_id, artist_id, pos) VALUES(?,?,?)",
                     [(song_id, a, i) for i, a in enumerate(artist_ids)])

    cover_src = folder_cover or (path if has_art else None)
    if cover_src:
        conn.execute("UPDATE albums SET cover_src=? WHERE id=? AND (cover_src IS NULL OR cover_src='')",
                     (cover_src, album_id))
    return True


def tag_issues(text):
    """Cosas raras en un tag: lista de avisos (vacia si el texto esta bien)."""
    out = []
    if "\ufffd" in text:
        out.append("tiene el caracter de sustitucion U+FFFD (el texto ya se perdio al guardarlo)")
    if fix_mojibake(text) != text:
        out.append("parece UTF-8 mal leido (mojibake); Zinctify lo arregla como '%s'" % fix_mojibake(text))
    odd = sorted({c for c in text if unicodedata.category(c) in ("Cf", "Co", "Cn", "Cc") and c not in "\t\r\n"})
    if odd:
        out.append("caracteres invisibles/de control: " + " ".join("U+%04X" % ord(c) for c in odd))
    spaces = sorted({c for c in text if c != " " and unicodedata.category(c) == "Zs"})
    if spaces:
        out.append("espacios raros: " + " ".join("U+%04X" % ord(c) for c in spaces))
    if "_" in text and " " not in text:
        out.append("guiones bajos en vez de espacios")
    return out


def check_tags():
    """python3 zinctify.py --check-tags: revisa todos los archivos y escribe un informe con los tags raros."""
    report = os.path.join(CFG.data_dir, "informe-tags.txt")
    n_files = n_bad = 0
    with open(report, "w", encoding="utf-8") as out:
        for dirpath, dirnames, filenames in os.walk(CFG.music_dir, followlinks=True):
            dirnames.sort()
            for fn in sorted(filenames):
                if os.path.splitext(fn)[1].lower() not in AUDIO_EXTS:
                    continue
                path = os.path.join(dirpath, fn)
                info = probe(path)
                if not info:
                    continue
                n_files += 1
                tags = {str(k).lower(): str(v) for k, v in ((info.get("format") or {}).get("tags") or {}).items()}
                for st in info.get("streams", []):
                    for k, v in (st.get("tags") or {}).items():
                        tags.setdefault(str(k).lower(), str(v))
                problems = []
                for key in ("artist", "album_artist", "albumartist", "album", "title", "genre"):
                    val = tags.get(key)
                    if val:
                        problems += ["  %s = %r -> %s" % (key, val, msg) for msg in tag_issues(val.replace("\x00", ";"))]
                if problems:
                    n_bad += 1
                    out.write(os.path.relpath(path, CFG.music_dir) + "\n" + "\n".join(problems) + "\n\n")
    log("Revisados %d archivos; %d con tags raros. Informe: %s" % (n_files, n_bad, report))


def cleanup_orphans(conn):
    conn.execute("DELETE FROM playlist_songs WHERE song_id NOT IN (SELECT id FROM songs)")
    conn.execute("DELETE FROM albums WHERE id NOT IN (SELECT DISTINCT album_id FROM songs)")
    conn.execute("DELETE FROM song_artists WHERE song_id NOT IN (SELECT id FROM songs)")
    conn.execute("DELETE FROM artists WHERE id NOT IN (SELECT artist_id FROM songs UNION "
                 "SELECT artist_id FROM albums UNION SELECT artist_id FROM song_artists)")


def reindex_path(path):
    """Vuelve a leer UN archivo (por ejemplo tras aceptar una correccion)."""
    conn = sqlite3.connect(CFG.db_path, timeout=60)
    conn.row_factory = sqlite3.Row
    try:
        folder = os.path.dirname(path)
        ok = index_file(conn, path, os.stat(path), find_folder_cover(folder, os.listdir(folder)))
        cleanup_orphans(conn)
        conn.commit()
        return ok
    finally:
        conn.close()


def scan_library(full=False):
    if not _scan_lock.acquire(blocking=False):
        return                                   # ya hay un escaneo en marcha
    SCAN.update(scanning=True, count=0)
    started = time.time()
    try:
        root = CFG.music_dir
        if not root:
            return                               # aun sin carpeta configurada
        if not os.path.isdir(root):
            log("ERROR: la carpeta de musica no existe o no esta montada: %s" % root)
            return
        conn = sqlite3.connect(CFG.db_path, timeout=60)
        conn.row_factory = sqlite3.Row
        sig = split_signature()
        row = conn.execute("SELECT value FROM settings WHERE name='split_sig'").fetchone()
        if not full and (row["value"] if row else None) != sig:
            log("Cambiaron las reglas de artistas (o es la primera vez con esta version): releo toda la biblioteca.")
            full = True
        existing = {r["path"]: (r["mtime"], r["size"]) for r in conn.execute("SELECT path, mtime, size FROM songs")}
        ignored = {r[0] for r in conn.execute("SELECT path FROM ignored_paths")}
        seen, indexed, walk_errors, new_paths = set(), 0, [], []
        for dirpath, dirnames, filenames in os.walk(root, followlinks=True, onerror=walk_errors.append):
            dirnames.sort()
            dirnames[:] = [d for d in dirnames if not d.startswith(".")]          # .carpetas ocultas fuera
            audio = sorted(f for f in filenames if os.path.splitext(f)[1].lower() in AUDIO_EXTS)
            if not audio:
                continue
            folder_cover = find_folder_cover(dirpath, filenames)
            for fn in audio:
                path = os.path.join(dirpath, fn)
                if path in ignored:
                    continue
                try:
                    st = os.stat(path)
                except OSError:
                    continue
                seen.add(path)
                SCAN["count"] += 1
                if not full and existing.get(path) == (st.st_mtime, st.st_size):
                    continue                     # sin cambios desde el ultimo escaneo
                try:
                    if index_file(conn, path, st, folder_cover):
                        indexed += 1
                        if path not in existing:
                            new_paths.append(path)
                    else:
                        log("Ignorado (no se pudo leer como audio): %s" % path)
                except Exception:
                    log("Error indexando %s:\n%s" % (path, traceback.format_exc()))
            conn.commit()

        removed = 0
        if walk_errors:
            log("AVISO: hubo carpetas ilegibles; no borro nada de la biblioteca en este escaneo")
        elif not seen and existing:
            log("AVISO: no encontre audio pero la biblioteca tenia canciones; no borro nada (carpeta sin montar?)")
        else:
            gone = [p for p in existing if p not in seen]
            conn.executemany("DELETE FROM songs WHERE path=?", [(p,) for p in gone])
            removed = len(gone)
        cleanup_orphans(conn)
        if not walk_errors:
            conn.execute("INSERT OR REPLACE INTO settings(name, value) VALUES('split_sig', ?)", (sig,))
        conn.commit()
        if existing and new_paths:                                   # la primera vez no se avisa de toda la biblioteca
            try:
                notify_new_music(conn, new_paths)
            except Exception:
                log("Error creando avisos de musica nueva:\n%s" % traceback.format_exc())
        conn.close()
        LIB_EPOCH[0] += 1
        log("Escaneo terminado: %d archivos, %d indexados, %d borrados, %.1fs"
            % (SCAN["count"], indexed, removed, time.time() - started))
        if new_paths and get_setting("meta_auto", "on") != "off":
            threading.Thread(target=auto_meta, args=(new_paths,), daemon=True).start()
        if new_paths:
            threading.Thread(target=lyrics_for_new, args=(new_paths,), daemon=True).start()
        threading.Thread(target=rematch_all_links, daemon=True).start()
    except Exception:
        log("Error en el escaneo:\n%s" % traceback.format_exc())
    finally:
        SCAN["scanning"] = False
        SCAN["last"] = int(time.time())
        _scan_lock.release()


def periodic_scan(minutes):
    while True:
        time.sleep(minutes * 60)
        scan_library()



# ---------------------------------------------------------------------------
# Utilidades de la API
# ---------------------------------------------------------------------------

ERR_EN = [
    ("Esa versión ya se probó y no arrancó bien en este servidor. Espera a una versión más nueva.", "That version was already tried and did not start properly on this server. Wait for a newer version."),
    ("Ya tienes la última versión", "You already have the latest version"),
    ("Primero escribe el repositorio de GitHub (usuario/nombre)", "First enter the GitHub repository (user/name)"),
    ("El repositorio se escribe así: usuario/nombre", "The repository is written like this: user/name"),
    ("No hay ninguna versión publicada en ese repositorio de GitHub", "No version has been published in that GitHub repository"),
    ("Ya se está actualizando", "An update is already in progress"),
    ("Primero tienes que seguir a este usuario", "You have to follow this user first"),
    ("Primero tienes que guardarlo en tu biblioteca", "You have to save it to your library first"),
    ("Falta el identificador del dispositivo", "Missing device identifier"),
    ("Ese dispositivo ya no está conectado", "That device is no longer connected"),
    ("Ese usuario no existe", "That user doesn't exist"),
    ("Solo puedes chatear con tus amigos (os tenéis que seguir los dos)", "You can only chat with your friends (you both have to follow each other)"),
    ("No se puede compartir eso", "That can't be shared"),
    ("Escribe un mensaje", "Write a message"),
    ("Demasiados mensajes seguidos; espera un momento", "Too many messages in a row; wait a moment"),
    ("El anfitrión no te ha dado permiso para hacer esto", "The host hasn't given you permission to do this"),
    ("Solo el anfitrión puede cambiar la cola entera", "Only the host can replace the whole queue"),
    ("No puedes quitar la canción que está sonando", "You can't remove the song that is playing"),
    ("Este correo no está vinculado a ninguna cuenta", "This email is not linked to any account"),
    ("La recuperación por correo no está activada en este servidor. Pídele al administrador que te cambie la contraseña.", "Email recovery is not enabled on this server. Ask the administrator to change your password."),
    ("El correo no está configurado. Avisa al administrador.", "Email is not set up. Tell the administrator."),
    ("No se pudo enviar el correo. Avisa al administrador.", "The email could not be sent. Tell the administrator."),
    ("Acabas de pedir un código. Espera un minuto para pedir otro.", "You just asked for a code. Wait a minute to ask for another."),
    ("Has pedido demasiados códigos. Inténtalo de nuevo en una hora.", "You have asked for too many codes. Try again in an hour."),
    ("Demasiados intentos; espera unos minutos", "Too many attempts; wait a few minutes"),
    ("El código no es correcto o ha caducado", "The code is wrong or has expired"),
    ("Demasiados fallos: el código se ha anulado. Pide uno nuevo.", "Too many failures: the code has been cancelled. Ask for a new one."),
    ("La sesión de recuperación ha caducado. Empieza de nuevo.", "The recovery session has expired. Start again."),
    ("Esta sala es solo para los amigos del anfitrión", "This room is only for the host's friends"),
    ("Solo el anfitrión puede cambiar esto", "Only the host can change this"),
    ("La clave debe tener entre 8 y 64 caracteres y no puede llevar espacios", "The key must be 8 to 64 characters long with no spaces"),
    ("Usuario o clave incorrectos. En las apps usa la «clave para apps» (Perfil → Conectar tus apps), no la contraseña de la web",
     "Wrong username or key. In apps use the “app key” (Profile → Connect your apps), not your web password"),
    ("Clave de API no valida", "Invalid API key"),
    ("Usa apiKey o usuario y clave, no las dos cosas", "Use either apiKey or username and key, not both"),
    ("Pega un enlace que empiece por http:// o https://", "Paste a link starting with http:// or https://"),
    ("Pega un enlace o una lista de canciones.", "Paste a link or a list of songs."),
    ("No he encontrado canciones en eso.", "I couldn't find any songs in that."),
    ("Esa canción ya no está en la playlist", "That song is no longer in the playlist"),
    ("Datos no válidos", "Invalid data"),
    ("El administrador aún no ha configurado Spotify (Client ID y dirección de redirección).", "The administrator hasn't set up Spotify yet (Client ID and redirect address)."),
    ("Este usuario no muestra esa lista.", "This user doesn't show that list."),
    ("La conexión con Spotify ha caducado o no es válida; pulsa «Conectar Spotify» otra vez.", "The Spotify connection expired or is invalid; press “Connect Spotify” again."),
    ("Spotify no ha devuelto una sesión válida.", "Spotify didn't return a valid session."),
    ("Esa dirección no contiene el código de Spotify (debe tener «code=» y «state=»).", "That address doesn't contain Spotify's code (it must have “code=” and “state=”)."),
    ("La dirección debe empezar por https:// (o http://127.0.0.1). Spotify no acepta otras.", "The address must start with https:// (or http://127.0.0.1). Spotify accepts no others."),
    ("No reconozco ese enlace. Funcionan Spotify, YouTube, SoundCloud y Deezer; o pega la lista como texto.", "I don't recognize that link. Spotify, YouTube, SoundCloud and Deezer work; or paste the list as text."),
    ("Esa playlist no está vinculada a ningún servicio.", "That playlist isn't linked to any service."),
    ("Activa antes «Buscar letras que falten en internet».", "First enable “Look up missing lyrics online”."),
    ("Escribe la ruta de la carpeta de música", "Type the path of the music folder"),
    ("La imagen pesa más de 20 MB", "The image is larger than 20 MB"),
    ("No se pudo leer esa imagen. Prueba con JPG, PNG, WEBP o GIF.", "That image couldn't be read. Try JPG, PNG, WEBP or GIF."),
    ("No se pudo mover el archivo (¿la carpeta de música es de solo lectura?). Usa «Ocultar».", "The file couldn't be moved (is the music folder read-only?). Use \"Hide\"."),
    ("Canción no encontrada", "Song not found"),
    ("Artista no encontrado", "Artist not found"),
    ("Usuario no encontrado", "User not found"),
    ("No puedes seguirte a ti mismo", "You can't follow yourself"),
    ("Datos no válidos", "Invalid data"),
    ("Esa carpeta no existe en el servidor", "That folder doesn't exist on the server"),
    ("Zinctify no tiene permiso para leer esa carpeta", "Zinctify isn't allowed to read that folder"),
    ("Falta el parametro obligatorio: %s", "Missing required parameter: %s"),
    ("ID no válido o no encontrado: %s", "Invalid or unknown ID: %s"),
    ("El usuario debe tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo",
     "The username must be 3-32 characters: letters, numbers, dot, hyphen or underscore"),
    ("La contraseña debe tener al menos %d caracteres", "The password must be at least %d characters long"),
    ("Nombre de usuario no válido: %s", "Invalid username: %s"),
    ("Ese nombre de usuario ya existe", "That username already exists"),
    ("Solo el administrador puede hacer esto", "Only an administrator can do this"),
    ("Artista no encontrado", "Artist not found"),
    ("Album no encontrado", "Album not found"),
    ("Cancion no encontrada", "Song not found"),
    ("Radio no encontrada", "Radio station not found"),
    ("Ya tienes importaciones en marcha; espera a que terminen.", "You already have imports running; wait for them to finish."),
    ("Esa importación ya no existe", "That import no longer exists"),
    ("Esa sala ya no existe", "That room no longer exists"),
    ("La cola de la sala está llena (máximo 500 canciones)", "The room queue is full (500 songs maximum)"),
    ("No estás en esa sala", "You are not in that room"),
    ("La sala todavía no tiene canciones", "The room has no songs yet"),
    ("No hay canciones para esa sala", "There are no songs for that room"),
    ("Acción no válida", "Invalid action"),
    ("El enlace debe empezar por http://, https:// o #/", "The link must start with http://, https:// or #/"),
    ("La imagen debe ser una dirección http:// o https://", "The image must be an http:// or https:// address"),
    ("Archivo no encontrado en disco", "File not found on disk"),
    ("Sin caratula", "No cover art"),
    ("Esta operación requiere POST", "This operation requires POST"),
    ("Funcion de la API no implementada: %s", "API function not implemented: %s"),
    ("Origen no permitido", "Origin not allowed"),
    ("JSON no válido", "Invalid JSON"),
    ("Ruta no encontrada", "Route not found"),
    ("Inicia sesión para continuar", "Sign in to continue"),
    ("Demasiados intentos fallidos; espera unos minutos", "Too many failed attempts; wait a few minutes"),
    ("Usuario o contraseña incorrectos", "Wrong username or password"),
    ("Usuario o clave incorrectos", "Wrong username or key"),
    ("El registro está cerrado. Pide una cuenta al administrador.",
     "Sign-up is closed. Ask the administrator for an account."),
    ("La contraseña actual no es correcta", "The current password is not correct"),
    ("Usuario no encontrado", "User not found"),
    ("No puedes borrar tu propia cuenta", "You can't delete your own account"),
    ("Tiene que quedar al menos un administrador", "At least one administrator must remain"),
    ("Error interno del servidor", "Internal server error"),
    ("Elige al menos un servicio de metadatos", "Pick at least one metadata service"),
    ("Ya hay un escaneo de metadatos en marcha", "A metadata scan is already running"),
    ("Accion no valida", "Invalid action"),
    ("Escribe un correo electrónico válido", "Enter a valid email address"),
    ("Ese correo ya está en uso", "That email is already in use"),
    ("Imagen no válida", "Invalid image"),
    ("Playlist no encontrada", "Playlist not found"),
    ("Tipo de lista no soportado: %s", "Unsupported list type: %s"),
    ("streamUrl debe ser una URL http:// o https://", "streamUrl must be an http:// or https:// URL"),
]
_ERR_RES = [(re.compile("^" + re.escape(es).replace("%s", "(.*)").replace("%d", "(\\d+)") + "$", re.S), en)
            for es, en in ERR_EN]


def tr(message, lang):
    """Traduce un mensaje de error al ingles si el cliente lo pide; si no, se queda en espanol."""
    if lang != "en":
        return message
    for rx, en in _ERR_RES:
        m = rx.match(message)
        if m:
            return en % m.groups() if m.groups() else en
    return message


class ApiError(Exception):
    def __init__(self, code, message):
        Exception.__init__(self, message)
        self.code = code
        self.message = message


def arg(p, name, default=None):
    v = p.get(name)
    return v[0] if v else default


def arg_int(p, name, default):
    try:
        return int(arg(p, name, default))
    except (TypeError, ValueError):
        return default


def need(p, name):
    v = arg(p, name)
    if v is None or v == "":
        raise ApiError(10, "Falta el parametro obligatorio: %s" % name)
    return v


def parse_id(value, prefix):
    if value and value.startswith(prefix + "-") and value[len(prefix) + 1:].isdigit():
        return int(value[len(prefix) + 1:])
    raise ApiError(70, "ID no válido o no encontrado: %s" % value)


# ---------------------------------------------------------------------------
# Usuarios, sesiones web y contrasenas
# ---------------------------------------------------------------------------

PBKDF2_ITERS = 600000
SESSION_DAYS = 30
USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,32}$")
MIN_PASSWORD = 8
_dummy_hash = []
_FAILS = {}                                   # ip -> momentos de los intentos fallidos recientes


def hash_password(pw, salt=None):
    salt = salt or os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), salt, PBKDF2_ITERS)
    return "pbkdf2$%d$%s$%s" % (PBKDF2_ITERS, salt.hex(), dk.hex())


def verify_password(pw, stored):
    try:
        scheme, iters, salt, want = stored.split("$")
        got = hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), bytes.fromhex(salt), int(iters)).hex()
        return scheme == "pbkdf2" and hmac.compare_digest(got, want)
    except (ValueError, AttributeError):
        return False


def dummy_hash():
    """Para tardar lo mismo cuando el usuario no existe (no revelar que cuentas hay)."""
    if not _dummy_hash:
        _dummy_hash.append(hash_password("no-existe"))
    return _dummy_hash[0]


def too_many_fails(ip):
    now = time.time()
    recent = [t for t in _FAILS.get(ip, []) if now - t < 300]
    _FAILS[ip] = recent
    return len(recent) >= 10


def note_fail(ip):
    _FAILS.setdefault(ip, []).append(time.time())


def get_setting(name, default=None):
    r = db().execute("SELECT value FROM settings WHERE name=?", (name,)).fetchone()
    return r["value"] if r else default


def set_setting(name, value):
    conn = db()
    conn.execute("INSERT INTO settings(name, value) VALUES(?,?) "
                 "ON CONFLICT(name) DO UPDATE SET value=excluded.value", (name, value))
    conn.commit()


def user_count():
    return db().execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]


def signup_state():
    """'first' (no hay cuentas: la primera sera administradora), 'open' o 'closed'."""
    if user_count() == 0:
        return "first"
    return "open" if get_setting("signup", "closed") == "open" else "closed"


def validate_credentials(username, password):
    if not USERNAME_RE.match(username or ""):
        raise ApiError(0, "El usuario debe tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo")
    if len(password or "") < MIN_PASSWORD:
        raise ApiError(0, "La contraseña debe tener al menos %d caracteres" % MIN_PASSWORD)


def create_user(username, password, api_key=None, admin=None, check=True, email=None):
    """admin=None: sera administrador solo si es la primera cuenta.
    El correo es obligatorio al crear cuentas desde la web; las anteriores (o la del arranque por variables
    de entorno) pueden no tenerlo y lo anaden luego en su perfil."""
    if check:
        validate_credentials(username, password)
    elif not USERNAME_RE.match(username or ""):
        raise ApiError(0, "Nombre de usuario no válido: %s" % username)
    email = clean_email(email, required=check)
    conn = db()
    try:
        conn.execute("INSERT INTO users(username, pw_hash, api_key, is_admin, created, email) "
                     "VALUES(?,?,?,COALESCE(?, (SELECT COUNT(*) = 0 FROM users)),?,?)",
                     (username, hash_password(password), api_key or secrets.token_hex(10), admin,
                      int(time.time()), email))
        conn.commit()
    except sqlite3.IntegrityError as e:
        conn.rollback()
        if "email" in str(e):
            raise ApiError(0, "Ese correo ya está en uso")
        raise ApiError(0, "Ese nombre de usuario ya existe")
    return conn.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()


def session_token(handler):
    m = re.search(r"(?:^|;\s*)zinctify_session=([^;\s]+)", handler.headers.get("Cookie") or "")
    return m.group(1) if m else None


def token_hash(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def session_user(handler):
    token = session_token(handler)
    if token:
        row = db().execute(
            "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash=? AND s.expires>?",
            (token_hash(token), int(time.time()))).fetchone()
        if row:
            return row
    # Native clients use the app key as a bearer credential for the same account routes.
    app_key = (handler.headers.get("X-Zinctify-App-Key") or "").strip()
    if app_key:
        return db().execute("SELECT * FROM users WHERE api_key=?", (app_key,)).fetchone()
    return None


def new_session(user_id):
    token = secrets.token_urlsafe(32)
    conn = db()
    conn.execute("DELETE FROM sessions WHERE expires < ?", (int(time.time()),))
    conn.execute("INSERT INTO sessions(token_hash, user_id, expires) VALUES(?,?,?)",
                 (token_hash(token), user_id, int(time.time()) + SESSION_DAYS * 86400))
    conn.commit()
    return token


def session_cookie(handler, token, max_age=SESSION_DAYS * 86400):
    secure = "; Secure" if (handler.headers.get("X-Forwarded-Proto") or "").lower() == "https" else ""
    return "zinctify_session=%s; Path=/; HttpOnly; SameSite=Strict; Max-Age=%d%s" % (token, max_age, secure)


def require_admin(username):
    r = db().execute("SELECT is_admin FROM users WHERE username=?", (username,)).fetchone()
    if not r or not r["is_admin"]:
        raise ApiError(50, "Solo el administrador puede hacer esto")


def authenticate(p, handler=None):
    """Devuelve (usuario, None) si va bien o (None, (codigo, mensaje)) si falla.
    Acepta la cookie de sesion de la web y lo que usan las apps Subsonic:
      - apiKey=...            (OpenSubsonic: Feishin, Symfonium... en versiones nuevas)
      - u + t + s             (token md5(clave + sal); funciona con la «clave para apps»)
      - u + p / u + p=enc:hex (clave en claro; vale la «clave para apps» o la contrasena de la cuenta)"""
    user = arg(p, "u")
    api_key = arg(p, "apiKey")
    ip = handler.client_address[0] if handler is not None else None
    if not user and not api_key:
        if handler is not None:
            row = session_user(handler)
            if row:
                handler.via_cookie = True
                return row["username"], None
        return None, (10, "Falta el parametro u")
    if ip and too_many_fails(ip):
        return None, (40, "Demasiados intentos fallidos; espera unos minutos")
    if api_key:                                          # autenticacion por clave de API (OpenSubsonic)
        if user:
            return None, (43, "Usa apiKey o usuario y clave, no las dos cosas")
        rows = db().execute("SELECT username, api_key FROM users").fetchall()
        found = None
        for r in rows:                                   # sin atajos: tiempo constante por cada usuario
            if hmac.compare_digest(r["api_key"].encode("utf-8"), api_key.encode("utf-8")):
                found = r["username"]
        if found:
            return found, None
        if ip:
            note_fail(ip)
        return None, (44, "Clave de API no valida")
    row = db().execute("SELECT username, api_key, pw_hash FROM users WHERE username=?", (user.strip(),)).fetchone()
    if row is None:
        if ip:
            note_fail(ip)
        return None, (40, BAD_CREDS)
    expected = row["api_key"]
    token, salt, pw = arg(p, "t"), arg(p, "s"), arg(p, "p")
    if token and salt:                                   # autenticacion moderna: md5(clave + sal)
        calc = hashlib.md5((expected + salt).encode("utf-8")).hexdigest()
        ok = hmac.compare_digest(calc, token.lower())
    elif pw is not None:                                 # autenticacion antigua: p=... o p=enc:<hex>
        if pw.startswith("enc:"):
            try:
                pw = bytes.fromhex(pw[4:]).decode("utf-8")
            except ValueError:
                pw = None
        ok = pw is not None and (hmac.compare_digest(pw.encode("utf-8"), expected.encode("utf-8"))
                                 or verify_password(pw, row["pw_hash"]))
    else:
        return None, (10, "Falta el parametro p, o t y s")
    if ok:
        return row["username"], None
    if ip:
        note_fail(ip)
    return None, (40, BAD_CREDS)


BAD_CREDS = "Usuario o clave incorrectos. En las apps usa la «clave para apps» (Perfil → Conectar tus apps), no la contraseña de la web"


def envelope(payload=None, error=None):
    r = {"status": "failed" if error else "ok", "version": API_VERSION, "type": SERVER_NAME,
         "serverVersion": SERVER_VERSION, "openSubsonic": True}
    if error:
        r["error"] = {"code": error[0], "message": error[1]}
    if payload:
        r.update(payload)
    return r


def xml_scalar(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    return str(v)


def xml_fill(el, d):
    """dict -> XML: los valores simples son atributos; dict/lista son elementos hijos."""
    for k, v in d.items():
        if v is None:
            continue
        if isinstance(v, list):
            for item in v:
                child = ET.SubElement(el, k)
                if isinstance(item, dict):
                    xml_fill(child, item)
                else:
                    child.text = xml_scalar(item)
        elif isinstance(v, dict):
            xml_fill(ET.SubElement(el, k), v)
        else:
            el.set(k, xml_scalar(v))


def like_pattern(q):
    return "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def token_filter(expr, tokens):
    if not tokens:
        return "1=1", []
    return (" AND ".join("%s LIKE ? ESCAPE '\\'" % expr for _ in tokens),
            [like_pattern(t) for t in tokens])


# ---------------------------------------------------------------------------
# Consultas y conversion a JSON de Subsonic
# ---------------------------------------------------------------------------

ALBUM_SELECT = """
SELECT al.*, ar.name AS artist_name,
  (SELECT COUNT(*) FROM songs s WHERE s.album_id = al.id) AS song_count,
  (SELECT COALESCE(SUM(s.duration), 0) FROM songs s WHERE s.album_id = al.id) AS duration
FROM albums al JOIN artists ar ON ar.id = al.artist_id
"""

SONG_SELECT = """
SELECT s.*, al.name AS album_name, COALESCE(s.artist_display, ar.name) AS artist_name
FROM songs s JOIN albums al ON al.id = s.album_id JOIN artists ar ON ar.id = s.artist_id
"""


def song_list(rows):
    """Convierte filas de canciones a JSON, anadiendo la lista de artistas de cada una (OpenSubsonic)."""
    rows = list(rows)
    by_song = {}
    ids = [r["id"] for r in rows]
    for i in range(0, len(ids), 500):
        chunk = ids[i:i + 500]
        q = ("SELECT sa.song_id, ar.id, ar.name FROM song_artists sa JOIN artists ar ON ar.id = sa.artist_id "
             "WHERE sa.song_id IN (%s) ORDER BY sa.song_id, sa.pos" % ",".join("?" * len(chunk)))
        for x in db().execute(q, chunk):
            by_song.setdefault(x["song_id"], []).append({"id": "ar-%d" % x["id"], "name": x["name"]})
    out = []
    for r in rows:
        d = song_json(r)
        arts = by_song.get(r["id"])
        if arts:
            d["artists"] = arts
            d["displayArtist"] = d["artist"]
        out.append(d)
    return out


def album_json(r):
    d = {"id": "al-%d" % r["id"], "name": r["name"], "artist": r["artist_name"],
         "artistId": "ar-%d" % r["artist_id"], "coverArt": "al-%d" % r["id"],
         "songCount": r["song_count"], "duration": r["duration"], "created": iso(r["created"])}
    if r["year"]:
        d["year"] = r["year"]
    if r["genre"]:
        d["genre"] = r["genre"]
    return d


def song_json(r):
    d = {"id": "so-%d" % r["id"], "parent": "al-%d" % r["album_id"], "isDir": False,
         "title": r["title"], "album": r["album_name"], "artist": r["artist_name"],
         "albumId": "al-%d" % r["album_id"], "artistId": "ar-%d" % r["artist_id"],
         "coverArt": "al-%d" % r["album_id"], "size": r["size"], "contentType": r["content_type"],
         "suffix": r["suffix"], "duration": r["duration"] or 0, "bitRate": r["bitrate"] or 0,
         "path": os.path.relpath(r["path"], CFG.music_dir), "isVideo": False, "type": "music",
         "mediaType": "song", "created": iso(r["created"])}
    for out_key, col in (("track", "track"), ("discNumber", "disc"), ("year", "year"), ("genre", "genre")):
        if r[col] is not None and r[col] != "":
            d[out_key] = r[col]
    lu = r["loudness"] if "loudness" in r.keys() else None
    if lu is not None and lu > -900:                      # sonoridad medida (LUFS); -18 LUFS = referencia ReplayGain
        d["loudnessLufs"] = round(lu, 2)
        d["replayGain"] = {"trackGain": round(-18.0 - lu, 2)}
    return d


def radio_json(r):
    d = {"id": "ra-%d" % r["id"], "name": r["name"], "streamUrl": r["stream_url"]}
    if r["homepage_url"]:
        d["homePageUrl"] = r["homepage_url"]
    if find_image(radio_cover_base(r["id"])):
        d["coverArt"] = "ra-%d" % r["id"]
    return d


def index_letter(nkey):
    c = nkey[:1].upper()
    return c if c.isalpha() else "#"


def build_artist_index():
    rows = db().execute(
        "SELECT ar.id, ar.name, ar.nkey, (SELECT COUNT(*) FROM albums al WHERE al.artist_id = ar.id) AS album_count "
        "FROM artists ar ORDER BY ar.nkey").fetchall()
    groups, order = {}, []
    for r in rows:
        letter = index_letter(r["nkey"])
        if letter not in groups:
            groups[letter] = []
            order.append(letter)
        groups[letter].append({"id": "ar-%d" % r["id"], "name": r["name"],
                               "albumCount": r["album_count"], "coverArt": "ar-%d" % r["id"]})
    return {"ignoredArticles": "", "index": [{"name": l, "artist": groups[l]} for l in order]}


# ---------------------------------------------------------------------------
# Endpoints (funciones de la API Subsonic)
# ---------------------------------------------------------------------------

ENDPOINTS = {}


def endpoint(*names):
    def deco(fn):
        for n in names:
            ENDPOINTS[n] = fn
        return fn
    return deco


# Respuestas vacias para funciones que los clientes llaman al arrancar y que aun no implementamos.
EMPTY = {
    "getStarred": {"starred": {}}, "getStarred2": {"starred2": {}},
    "getArtistInfo": {"artistInfo": {}}, "getArtistInfo2": {"artistInfo2": {}},
    "getAlbumInfo": {"albumInfo": {}}, "getAlbumInfo2": {"albumInfo": {}},
    "getTopSongs": {"topSongs": {}}, "getSimilarSongs": {"similarSongs": {}},
    "getSimilarSongs2": {"similarSongs2": {}}, "getPlaylists": {"playlists": {"playlist": []}},
    "getPodcasts": {"podcasts": {"channel": []}}, "getNewestPodcasts": {"newestPodcasts": {"episode": []}},
    "getNowPlaying": {"nowPlaying": {"entry": []}}, "getBookmarks": {"bookmarks": {"bookmark": []}},
    "getPlayQueue": {},
}
for _name, _payload in EMPTY.items():
    ENDPOINTS[_name] = (lambda payload: (lambda user, p: payload))(_payload)


@endpoint("ping")
def ep_ping(user, p):
    return {}


@endpoint("getOpenSubsonicExtensions")
def ep_extensions(user, p):
    return {"openSubsonicExtensions": [{"name": "formPost", "versions": [1]}, {"name": "apiKeyAuthentication", "versions": [1]},
                                {"name": "songLyrics", "versions": [1]}]}


@endpoint("getLicense")
def ep_license(user, p):
    return {"license": {"valid": True, "email": "", "licenseExpires": "2099-12-31T00:00:00.000Z"}}


@endpoint("getMusicFolders")
def ep_folders(user, p):
    return {"musicFolders": {"musicFolder": [{"id": 1, "name": "Music"}]}}


@endpoint("getUser")
def ep_user(user, p):
    r = db().execute("SELECT is_admin FROM users WHERE username=?", (user,)).fetchone()
    adm = bool(r and r["is_admin"])
    return {"user": {"username": user, "scrobblingEnabled": True, "adminRole": adm, "settingsRole": adm,
                     "downloadRole": True, "uploadRole": False, "playlistRole": True, "coverArtRole": True,
                     "commentRole": False, "podcastRole": True, "streamRole": True, "jukeboxRole": False,
                     "shareRole": False, "folder": [1]}}


@endpoint("getArtists")
def ep_getArtists(user, p):
    return {"artists": build_artist_index()}


@endpoint("getIndexes")
def ep_getIndexes(user, p):
    idx = build_artist_index()
    idx["lastModified"] = int(time.time() * 1000)
    return {"indexes": idx}


@endpoint("getArtist")
def ep_getArtist(user, p):
    aid = parse_id(need(p, "id"), "ar")
    ar = db().execute("SELECT id, name FROM artists WHERE id=?", (aid,)).fetchone()
    if not ar:
        raise ApiError(70, "Artista no encontrado")
    rows = db().execute(ALBUM_SELECT + " WHERE al.artist_id=? ORDER BY al.year, al.nkey", (aid,)).fetchall()
    albums = [album_json(r) for r in rows]
    # Discos de otros donde este artista colabora en alguna cancion ("aparece en").
    extra = db().execute(
        ALBUM_SELECT + " WHERE al.artist_id != ? AND al.id IN (SELECT s.album_id FROM songs s "
        "JOIN song_artists sa ON sa.song_id = s.id WHERE sa.artist_id = ?) ORDER BY al.year, al.nkey",
        (aid, aid)).fetchall()
    for r in extra:
        d = album_json(r)
        d["appearsOn"] = True
        albums.append(d)
    info = db().execute("SELECT bio FROM artist_info WHERE artist_id=?", (aid,)).fetchone()
    return {"artist": {"id": "ar-%d" % ar["id"], "name": ar["name"], "albumCount": len(albums), "bio": (info["bio"] if info else "") or "",
                       "coverArt": "ar-%d" % ar["id"], "album": albums}}


@endpoint("getAlbum")
def ep_getAlbum(user, p):
    alid = parse_id(need(p, "id"), "al")
    r = db().execute(ALBUM_SELECT + " WHERE al.id=?", (alid,)).fetchone()
    if not r:
        raise ApiError(70, "Album no encontrado")
    songs = db().execute(SONG_SELECT + " WHERE s.album_id=? ORDER BY COALESCE(s.disc,1), COALESCE(s.track,0), s.nkey",
                         (alid,)).fetchall()
    d = album_json(r)
    d["song"] = song_list(songs)
    return {"album": d}


@endpoint("getSong")
def ep_getSong(user, p):
    sid = parse_id(need(p, "id"), "so")
    r = db().execute(SONG_SELECT + " WHERE s.id=?", (sid,)).fetchone()
    if not r:
        raise ApiError(70, "Cancion no encontrada")
    return {"song": song_list([r])[0]}


@endpoint("getAlbumList2")
def ep_getAlbumList2(user, p):
    typ = arg(p, "type", "alphabeticalByName")
    size = max(1, min(arg_int(p, "size", 10), 500))
    offset = max(0, arg_int(p, "offset", 0))
    join, where, join_args, where_args = "", "", [], []
    if typ == "alphabeticalByName":
        order = "al.nkey"
    elif typ == "alphabeticalByArtist":
        order = "ar.nkey, al.nkey"
    elif typ == "newest":
        order = "al.created DESC, al.id DESC"
    elif typ == "random":
        order = "RANDOM()"
    elif typ == "byYear":
        a, b = arg_int(p, "fromYear", 0), arg_int(p, "toYear", 9999)
        where, where_args = "WHERE al.year BETWEEN ? AND ?", [min(a, b), max(a, b)]
        order = "al.year, al.nkey" if a <= b else "al.year DESC, al.nkey"
    elif typ == "byGenre":
        where, where_args = "WHERE al.genre = ? COLLATE NOCASE", [need(p, "genre")]
        order = "al.nkey"
    elif typ in ("frequent", "recent"):
        join = ("JOIN (SELECT s.album_id AS album_id, COUNT(*) AS c, MAX(pl.ts) AS last_ts "
                "FROM plays pl JOIN songs s ON s.id = pl.song_id WHERE pl.user = ? GROUP BY s.album_id) st "
                "ON st.album_id = al.id")
        join_args = [user]
        order = "st.c DESC, st.last_ts DESC" if typ == "frequent" else "st.last_ts DESC"
    elif typ == "starred":
        return {"albumList2": {"album": []}}
    else:
        raise ApiError(0, "Tipo de lista no soportado: %s" % typ)
    sql = "%s %s %s ORDER BY %s LIMIT ? OFFSET ?" % (ALBUM_SELECT, join, where, order)
    rows = db().execute(sql, join_args + where_args + [size, offset]).fetchall()
    return {"albumList2": {"album": [album_json(r) for r in rows]}}


@endpoint("getRandomSongs")
def ep_getRandomSongs(user, p):
    size = max(1, min(arg_int(p, "size", 10), 500))
    where, args = [], []
    if arg(p, "genre"):
        where.append("s.genre = ? COLLATE NOCASE")
        args.append(arg(p, "genre"))
    if arg(p, "fromYear"):
        where.append("s.year >= ?")
        args.append(arg_int(p, "fromYear", 0))
    if arg(p, "toYear"):
        where.append("s.year <= ?")
        args.append(arg_int(p, "toYear", 9999))
    sql = SONG_SELECT + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY RANDOM() LIMIT ?"
    rows = db().execute(sql, args + [size]).fetchall()
    return {"randomSongs": {"song": song_list(rows)}}


@endpoint("getGenres")
def ep_getGenres(user, p):
    rows = db().execute(
        "SELECT genre AS value, COUNT(*) AS song_count, COUNT(DISTINCT album_id) AS album_count FROM songs "
        "WHERE genre IS NOT NULL AND genre != '' GROUP BY genre COLLATE NOCASE ORDER BY genre COLLATE NOCASE")
    return {"genres": {"genre": [{"value": r["value"], "songCount": r["song_count"],
                                  "albumCount": r["album_count"]} for r in rows]}}



# ---------------------------------------------------------------------------
# Buscador tolerante: "Thats life" encuentra "That's Life", "sinatara" encuentra "Sinatra"...
# ---------------------------------------------------------------------------

LIB_EPOCH = [0]                  # sube cuando cambia la biblioteca: la busqueda reconstruye su indice


def fuzz_key(s):
    s = norm_key(s).replace("&", " and ")
    s = re.sub(r"[\u2019\u2018'`\u00b4]", "", s)           # that's -> thats
    return re.sub(r"[^\w]+", " ", s).strip()


class SearchIndex:
    """Palabras -> elementos. Cada elemento tiene campos con distinto peso (titulo > artista > album)."""

    def __init__(self):
        self.post = {}                      # palabra -> {indice: peso del campo}
        self.words = []
        self.sorted_words = []
        self.squashed = {}                  # indice -> campos sin espacios ("dondeestas")
        self.memo = {}

    def add(self, idx, fields):
        self.squashed[idx] = [fuzz_key(t).replace(" ", "") for t, _w in fields if t]
        for text, weight in fields:
            for w in fuzz_key(text).split():
                d = self.post.setdefault(w, {})
                if d.get(idx, 0) < weight:
                    d[idx] = weight

    def finish(self):
        self.sorted_words = sorted(self.post)
        self.by_len = {}
        for w in self.sorted_words:
            self.by_len.setdefault(len(w), []).append(w)

    def expand(self, tok):
        """Palabras del indice que 'se parecen' a lo escrito, con su calidad (1 = exacta). Se recuerda el resultado:
        al importar miles de canciones las mismas palabras (artistas, 'love', 'the'...) se repiten muchisimo."""
        hit = self.memo.get(tok)
        if hit is not None:
            return hit
        out = self._expand(tok)
        if len(self.memo) < 20000:
            self.memo[tok] = out
        return out

    def _expand(self, tok):
        out = {}
        if tok in self.post:
            out[tok] = 1.0
        if len(tok) >= 2:
            import bisect
            i = bisect.bisect_left(self.sorted_words, tok)
            n = 0
            while i < len(self.sorted_words) and self.sorted_words[i].startswith(tok) and n < 60:
                w = self.sorted_words[i]
                out.setdefault(w, 0.92 - min(0.2, 0.02 * (len(w) - len(tok))))
                i += 1
                n += 1
        if len(tok) >= 3:
            # solo se comparan palabras de largo parecido (con cutoff 0.74 las demas nunca pasarian): mucho mas rapido
            spread = max(2, int(len(tok) * 0.4))
            cands = [w for L in range(len(tok) - spread, len(tok) + spread + 1) for w in self.by_len.get(L, ())]
            for w in difflib.get_close_matches(tok, cands, n=8, cutoff=0.74):
                out.setdefault(w, 0.85 * difflib.SequenceMatcher(None, tok, w).ratio())
        return out

    def search(self, query, limit, squash=True):
        toks = fuzz_key(query).split()
        if not toks:
            return []
        scores = {}
        for t in toks:
            best = {}
            for w, q in self.expand(t).items():
                for idx, fw in self.post[w].items():
                    v = q * fw
                    if v > best.get(idx, 0):
                        best[idx] = v
            for idx, v in best.items():
                scores[idx] = scores.get(idx, 0) + v
                hits = scores.setdefault(("h", idx), 0) + 1
                scores[("h", idx)] = hits
        need = max(1, int(len(toks) * 0.6 + 0.5)) if len(toks) > 1 else 1
        ranked = [(sc / len(toks), idx) for idx, sc in scores.items()
                  if not isinstance(idx, tuple) and scores[("h", idx)] >= need]
        ranked.sort(key=lambda x: -x[0])
        if not ranked and len(toks) >= 1 and squash:
            ranked = self.squashed_search("".join(toks))      # "dondeestas" -> "Donde Estas"
        return [idx for _sc, idx in ranked[:limit]]

    def squashed_search(self, q):
        if len(q) < 4:
            return []
        out = []
        for idx, fields in self.squashed.items():
            best = 0.0
            for f in fields:
                if q in f:
                    best = max(best, 0.9)
                elif abs(len(f) - len(q)) <= max(3, len(q) // 3):
                    m = difflib.SequenceMatcher(None, q, f)
                    if m.real_quick_ratio() >= 0.82 and m.ratio() >= 0.82:
                        best = max(best, m.ratio() * 0.8)
            if best:
                out.append((best, idx))
        out.sort(key=lambda x: -x[0])
        return out


_search_cache = {"sig": None, "songs": None, "albums": None, "artists": None, "song_ids": [], "album_ids": [], "artist_ids": []}
_search_lock = threading.Lock()


def search_indexes():
    conn = db()
    n, mx = conn.execute("SELECT COUNT(*), COALESCE(MAX(id),0) FROM songs").fetchone()
    sig = (LIB_EPOCH[0], n, mx, SCAN["last"])
    with _search_lock:
        if _search_cache["sig"] == sig:
            return _search_cache
        si, ai, ri = SearchIndex(), SearchIndex(), SearchIndex()
        song_ids, album_ids, artist_ids = [], [], []
        for r in conn.execute("SELECT s.id, s.title, COALESCE(s.artist_display, ar.name) AS artist, al.name AS album "
                              "FROM songs s JOIN albums al ON al.id = s.album_id JOIN artists ar ON ar.id = s.artist_id"):
            si.add(len(song_ids), ((r["title"], 1.0), (r["artist"], 0.7), (r["album"], 0.5)))
            song_ids.append(r["id"])
        for r in conn.execute("SELECT al.id, al.name, ar.name AS artist FROM albums al JOIN artists ar ON ar.id = al.artist_id"):
            ai.add(len(album_ids), ((r["name"], 1.0), (r["artist"], 0.7)))
            album_ids.append(r["id"])
        for r in conn.execute("SELECT id, name FROM artists"):
            ri.add(len(artist_ids), ((r["name"], 1.0),))
            artist_ids.append(r["id"])
        for x in (si, ai, ri):
            x.finish()
        _search_cache.update(sig=sig, songs=si, albums=ai, artists=ri, song_ids=song_ids, album_ids=album_ids, artist_ids=artist_ids)
        return _search_cache


def run_search(query, n_artists=8, n_albums=12, n_songs=30, squash=True):
    """Devuelve (filas_artistas, filas_albumes, filas_canciones) ordenadas por parecido."""
    ix = search_indexes()
    conn = db()

    a_ids = [ix["artist_ids"][i] for i in ix["artists"].search(query, n_artists, squash)] if n_artists else []
    b_ids = [ix["album_ids"][i] for i in ix["albums"].search(query, n_albums, squash)] if n_albums else []
    s_pool = min(150, max(n_songs * 3, 30)) if n_songs else 0         # se piden más para poder subir las que tienen buenos metadatos
    s_ids = [ix["song_ids"][i] for i in ix["songs"].search(query, s_pool, squash)] if s_pool else []
    def rows_for(sql, col, ids):
        if not ids:
            return []
        got = {r["id"]: r for r in conn.execute(sql + " WHERE %s IN (%s)" % (col, ",".join("?" * len(ids))), ids)}
        return [got[i] for i in ids if i in got]
    artists = rows_for("SELECT ar.id, ar.name, (SELECT COUNT(*) FROM albums al WHERE al.artist_id = ar.id) AS album_count FROM artists ar", "ar.id", a_ids)
    albums = rows_for(ALBUM_SELECT, "al.id", b_ids)
    songs = rows_for(SONG_SELECT, "s.id", s_ids)
    if songs:
        # Orden final: el de parecido, pero las canciones con metadatos bien puestos suben hasta 15 puestos
        # (y los videoclips o archivos sueltos sin etiquetas bajan).
        songs = [r for _, r in sorted(enumerate(songs), key=lambda t: t[0] - 15 * meta_quality(t[1]))][:n_songs]
    return artists, albums, songs


_VIDEOISH = re.compile(r"official\s*(music\s*)?video|video\s*oficial|videoclip|video\s*clip|lyric(s)?\s*video|music\s*video|\b(4k|1080p|720p|hd)\b|"
                       r"\bmeme\b|reaction|karaoke|full\s*album|\(audio\)|\[official|\bremix\s*contest\b", re.I)


def meta_quality(r):
    """0 a 1: lo bien etiquetada que está una canción (artista, álbum, pista, año, género, duración razonable, título limpio)."""
    q = 0.0
    if (r["artist_name"] or "").strip() and r["artist_name"] != UNKNOWN_ARTIST:
        q += 0.25
    if (r["album_name"] or "").strip() and r["album_name"] != UNKNOWN_ALBUM:
        q += 0.25
    if r["track"]:
        q += 0.1
    if r["year"]:
        q += 0.1
    if (r["genre"] or "").strip():
        q += 0.1
    if r["duration"] and 60 <= r["duration"] <= 900:
        q += 0.1
    q += -0.3 if _VIDEOISH.search(r["title"] or "") else 0.1
    return max(0.0, min(1.0, q))


@endpoint("search3")
def ep_search3(user, p):
    q = (arg(p, "query", "") or "").strip().strip('"')
    ac, bc, sc = arg_int(p, "artistCount", 20), arg_int(p, "albumCount", 20), arg_int(p, "songCount", 20)
    if not q:      # Subsonic: una busqueda vacia lista todo (los clientes la usan para sincronizar)
        conn = db()
        artists = conn.execute("SELECT ar.id, ar.name, (SELECT COUNT(*) FROM albums al WHERE al.artist_id = ar.id) AS album_count "
                               "FROM artists ar ORDER BY ar.nkey LIMIT ? OFFSET ?", (ac, arg_int(p, "artistOffset", 0))).fetchall()
        albums = conn.execute(ALBUM_SELECT + " ORDER BY al.nkey LIMIT ? OFFSET ?", (bc, arg_int(p, "albumOffset", 0))).fetchall()
        songs = conn.execute(SONG_SELECT + " ORDER BY s.nkey LIMIT ? OFFSET ?", (sc, arg_int(p, "songOffset", 0))).fetchall()
    else:
        artists, albums, songs = run_search(q, ac, bc, sc)
    return {"searchResult3": {
        "artist": [{"id": "ar-%d" % r["id"], "name": r["name"], "albumCount": r["album_count"],
                    "coverArt": "ar-%d" % r["id"]} for r in artists],
        "album": [album_json(r) for r in albums],
        "song": song_list(songs)}}


# --- compatibilidad con apps Subsonic antiguas y nuevas (Substreamer, Symfonium, Feishin, DSub, Ultrasonic...) ---

@endpoint("tokenInfo")
def ep_tokenInfo(user, p):
    return {"tokenInfo": {"username": user}}


@endpoint("star", "unstar", "setRating", "savePlayQueue", "createBookmark", "deleteBookmark", "updateUser", "changePassword")
def ep_noop(user, p):
    return {}


@endpoint("getAvatar")
def ep_avatar_unsupported(user, p):
    raise ApiError(70, "Sin avatar")


@endpoint("getAlbumList")
def ep_getAlbumList(user, p):
    r = ep_getAlbumList2(user, p)["albumList2"]
    return {"albumList": {"album": [dict(a, title=a["name"], isDir=True, parent=a["artistId"]) for a in r["album"]]}}


@endpoint("search2")
def ep_search2(user, p):
    r = ep_search3(user, p)["searchResult3"]
    return {"searchResult2": {"artist": [{"id": a["id"], "name": a["name"]} for a in r["artist"]],
                              "album": [dict(a, title=a["name"], isDir=True) for a in r["album"]], "song": r["song"]}}


@endpoint("getMusicDirectory")
def ep_getMusicDirectory(user, p):
    raw = need(p, "id")
    if raw.startswith("ar-"):
        a = ep_getArtist(user, p)["artist"]
        return {"directory": {"id": a["id"], "name": a["name"],
                              "child": [dict(x, title=x["name"], isDir=True, parent=a["id"]) for x in a["album"]]}}
    d = ep_getAlbum(user, p)["album"]
    return {"directory": {"id": d["id"], "name": d["name"], "parent": d["artistId"],
                          "child": [dict(x, isDir=False) for x in d["song"]]}}


@endpoint("getSongsByGenre")
def ep_getSongsByGenre(user, p):
    size = max(1, min(arg_int(p, "count", 10), 500))
    offset = max(0, arg_int(p, "offset", 0))
    rows = db().execute(SONG_SELECT + " WHERE s.genre = ? COLLATE NOCASE ORDER BY s.nkey LIMIT ? OFFSET ?",
                        (need(p, "genre"), size, offset)).fetchall()
    return {"songsByGenre": {"song": song_list(rows)}}


@endpoint("getLyrics")
def ep_getLyrics(user, p):
    return {"lyrics": {"artist": arg(p, "artist", ""), "title": arg(p, "title", ""), "value": ""}}


@endpoint("scrobble")
def ep_scrobble(user, p):
    ids = p.get("id", [])
    if not ids:
        raise ApiError(10, "Falta el parametro obligatorio: id")
    if (arg(p, "submission", "true") or "true").lower() == "false":
        return {}                                        # "ahora suena": no cuenta como reproduccion
    times = p.get("time", [])
    conn = db()
    for i, raw in enumerate(ids):
        try:
            sid = parse_id(raw, "so")
        except ApiError:
            continue
        s = conn.execute(SONG_SELECT + " WHERE s.id=?", (sid,)).fetchone()
        if not s:
            continue
        ts = int(times[i]) // 1000 if i < len(times) and times[i].isdigit() else int(time.time())
        play_id = conn.execute(
            "INSERT INTO plays(user, ts, song_id, title, artist, album, genre, duration) VALUES(?,?,?,?,?,?,?,?)",
            (user, ts, s["id"], s["title"], s["artist_name"], s["album_name"], s["genre"], s["duration"])).lastrowid
        names = [x["name"] for x in conn.execute(
            "SELECT ar.name FROM song_artists sa JOIN artists ar ON ar.id = sa.artist_id "
            "WHERE sa.song_id=? ORDER BY sa.pos", (s["id"],))] or [s["artist_name"]]
        conn.executemany("INSERT OR IGNORE INTO play_artists(play_id, artist) VALUES(?,?)",
                         [(play_id, n) for n in names])
    conn.commit()
    return {}


@endpoint("getInternetRadioStations")
def ep_radios(user, p):
    rows = db().execute("SELECT * FROM radios ORDER BY name COLLATE NOCASE").fetchall()
    return {"internetRadioStations": {"internetRadioStation": [radio_json(r) for r in rows]}}


def check_stream_url(url):
    if not re.match(r"^https?://\S+$", url):
        raise ApiError(10, "streamUrl debe ser una URL http:// o https://")


@endpoint("createInternetRadioStation")
def ep_radio_create(user, p):
    require_admin(user)
    url, name = need(p, "streamUrl"), clean_text(need(p, "name"))
    check_stream_url(url)
    conn = db()
    conn.execute("INSERT INTO radios(name, stream_url, homepage_url) VALUES(?,?,?)",
                 (name, url, arg(p, "homepageUrl")))
    conn.commit()
    return {}


@endpoint("updateInternetRadioStation")
def ep_radio_update(user, p):
    require_admin(user)
    rid = parse_id(need(p, "id"), "ra")
    url, name = need(p, "streamUrl"), clean_text(need(p, "name"))
    check_stream_url(url)
    conn = db()
    cur = conn.execute("UPDATE radios SET name=?, stream_url=?, homepage_url=? WHERE id=?",
                       (name, url, arg(p, "homepageUrl"), rid))
    conn.commit()
    if cur.rowcount == 0:
        raise ApiError(70, "Radio no encontrada")
    return {}


@endpoint("deleteInternetRadioStation")
def ep_radio_delete(user, p):
    require_admin(user)
    rid = parse_id(need(p, "id"), "ra")
    conn = db()
    cur = conn.execute("DELETE FROM radios WHERE id=?", (rid,))
    conn.commit()
    if cur.rowcount == 0:
        raise ApiError(70, "Radio no encontrada")
    remove_image(radio_cover_base(rid))
    return {}


@endpoint("startScan")
def ep_startScan(user, p):
    require_admin(user)
    full = (arg(p, "fullScan", "false") or "false").lower() == "true"
    if not SCAN["scanning"]:
        threading.Thread(target=scan_library, args=(full,), daemon=True).start()
    return {"scanStatus": {"scanning": True, "count": SCAN["count"]}}


@endpoint("getScanStatus")
def ep_scanStatus(user, p):
    return {"scanStatus": {"scanning": SCAN["scanning"], "count": SCAN["count"]}}


# ---------------------------------------------------------------------------
# Wrapped (endpoint propio, no es parte de Subsonic)
# ---------------------------------------------------------------------------

def build_wrapped(user, year, limit):
    conn = db()
    start = int(datetime(year, 1, 1).timestamp())
    end = int(datetime(year + 1, 1, 1).timestamp())
    base = "FROM plays WHERE user=? AND ts>=? AND ts<?"
    args = (user, start, end)

    t = conn.execute("SELECT COUNT(*) AS n, COALESCE(SUM(duration),0) AS secs, "
                     "COUNT(DISTINCT artist || '|' || title) AS songs " + base, args).fetchone()
    # Artistas: cada colaborador cuenta por separado ("*NSYNC, Nelly" suma a los dos).
    pa_base = ("FROM play_artists pa JOIN plays p ON p.id = pa.play_id "
               "WHERE p.user=? AND p.ts>=? AND p.ts<?")
    n_artists = conn.execute("SELECT COUNT(DISTINCT pa.artist COLLATE NOCASE) " + pa_base, args).fetchone()[0]
    top_artists = [dict(r) for r in conn.execute(
        "SELECT MIN(pa.artist) AS name, COUNT(*) AS plays " + pa_base +
        " GROUP BY pa.artist COLLATE NOCASE ORDER BY plays DESC, SUM(p.duration) DESC LIMIT ?", args + (limit,))]

    def top(select, group, extra=""):
        sql = "SELECT %s, COUNT(*) AS plays %s %s GROUP BY %s ORDER BY plays DESC, SUM(duration) DESC LIMIT ?" % (
            select, base, extra, group)
        return [dict(r) for r in conn.execute(sql, args + (limit,))]

    def bucket(fmt, size, first):
        out = [0] * size
        sql = "SELECT CAST(strftime('%s', ts, 'unixepoch', 'localtime') AS INTEGER) AS b, COUNT(*) AS n %s GROUP BY b" % (fmt, base)
        for r in conn.execute(sql, args):
            idx = r["b"] - first
            if 0 <= idx < size:
                out[idx] = r["n"]
        return out

    rr = [dict(r) for r in conn.execute(
        "SELECT MIN(name) AS name, SUM(seconds) AS secs, SUM(starts) AS sessions FROM radio_listen WHERE user=? AND day>=? AND day<? "
        "GROUP BY radio_id HAVING SUM(seconds) >= 30 ORDER BY secs DESC LIMIT ?", (user, start - 86400, end, limit))]
    top_radios = [{"name": r["name"], "minutes": int(round(r["secs"] / 60.0)), "sessions": r["sessions"]} for r in rr]
    return {
        "topRadios": top_radios, "radioMinutes": sum(r["minutes"] for r in top_radios),
        "year": year, "user": user, "totalPlays": t["n"], "minutesListened": int(round(t["secs"] / 60.0)),
        "uniqueSongs": t["songs"], "uniqueArtists": n_artists,
        "topArtists": top_artists,
        "topSongs": top("title, artist", "title, artist"),
        "topAlbums": top("album, artist", "album, artist"),
        "topGenres": top("genre AS name", "genre COLLATE NOCASE", "AND genre IS NOT NULL AND genre != ''"),
        "playsByMonth": bucket("%m", 12, 1),
        "playsByHour": bucket("%H", 24, 0),
    }


# ---------------------------------------------------------------------------
# Caratulas
# ---------------------------------------------------------------------------

def cover_candidates(cid):
    """Lista de archivos donde buscar la imagen (carpeta o tag incrustado), por orden de preferencia."""
    kind, _, num = cid.partition("-")
    if not num.isdigit():
        return []
    n, conn, out = int(num), db(), []
    if kind == "so":
        r = conn.execute("SELECT album_id FROM songs WHERE id=?", (n,)).fetchone()
        return cover_candidates("al-%d" % r["album_id"]) if r else []
    if kind == "ar":
        for row in conn.execute(
                "SELECT id FROM albums WHERE artist_id=? OR id IN (SELECT s.album_id FROM songs s "
                "JOIN song_artists sa ON sa.song_id = s.id WHERE sa.artist_id=?) "
                "ORDER BY (artist_id=?) DESC, year, nkey LIMIT 5", (n, n, n)):
            out.extend(cover_candidates("al-%d" % row["id"]))
        return out
    if kind == "al":
        r = conn.execute("SELECT cover_src FROM albums WHERE id=?", (n,)).fetchone()
        if r and r["cover_src"]:
            out.append(r["cover_src"])
        for x in conn.execute("SELECT path FROM songs WHERE album_id=? AND has_art=1 "
                              "ORDER BY COALESCE(disc,1), COALESCE(track,0)", (n,)):
            out.append(x["path"])
    return out


_COVER_SEM = threading.BoundedSemaphore(3)       # como mucho 3 ffmpeg a la vez generando portadas
_COVER_LOCKS = {}
_COVER_GUARD = threading.Lock()


def render_cover(src, size):
    """Convierte la imagen a JPEG del tamano pedido (sin agrandar) y la guarda en cache.
    Una misma portada pedida a la vez por varias peticiones se genera una sola vez, y no se lanzan
    mas de 3 ffmpeg simultaneos (antes, una playlist de miles de canciones los lanzaba todos de golpe)."""
    st = os.stat(src)
    ck = hashlib.md5(("%s|%s|%s" % (src, st.st_mtime, size)).encode("utf-8", "replace")).hexdigest()
    out = os.path.join(CFG.cover_dir, ck + ".jpg")
    if os.path.exists(out):
        return out
    with _COVER_GUARD:
        lock = _COVER_LOCKS.setdefault(ck, threading.Lock())
    try:
        with lock:
            if os.path.exists(out):
                return out
            with _COVER_SEM:
                return _render_cover_now(src, size, out)
    finally:
        with _COVER_GUARD:
            _COVER_LOCKS.pop(ck, None)


_PREWARM = {}


def prewarm_covers(album_ids, key, size=120):
    """Genera en segundo plano las portadas (miniaturas) de una playlist grande, de una en una y por orden, para que al bajar por la
    lista ya esten hechas y no haya que esperar a ffmpeg. Va de una en una para dejar sitio a lo que se pide en directo."""
    now = time.time()
    ids = list(dict.fromkeys(album_ids))[:20000]
    if len(ids) < 8 or now - _PREWARM.get(key, 0) < 600:
        return
    _PREWARM[key] = now
    if len(_PREWARM) > 500:
        for k in sorted(_PREWARM, key=_PREWARM.get)[:250]:
            _PREWARM.pop(k, None)

    def work():
        done = 0
        for aid in ids:
            try:
                for src in cover_candidates("al-%d" % aid):
                    if os.path.exists(src):
                        render_cover(src, size)
                        break
                done += 1
            except Exception:
                pass
            time.sleep(0.005)
        log("Portadas de %s preparadas (%d)" % (key, done))
    threading.Thread(target=work, daemon=True).start()


def _render_cover_now(src, size, out):
    tmp = "%s.%d.tmp" % (out, threading.get_ident())
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", src, "-an", "-frames:v", "1",
           "-vf", "scale='min(%d,iw)':-2" % size, "-q:v", "3", "-f", "mjpeg", tmp]
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=60)
        if r.returncode == 0 and os.path.exists(tmp) and os.path.getsize(tmp) > 0:
            os.replace(tmp, out)
            return out
    except (OSError, subprocess.SubprocessError):
        pass
    if os.path.exists(tmp):
        os.remove(tmp)
    return None


# ---------------------------------------------------------------------------
# Servidor HTTP
# ---------------------------------------------------------------------------

BINARY = {"stream", "download", "getCoverArt", "radioStream"}
# Con la cookie de la web, lo que modifica datos exige POST (defensa extra contra CSRF).
MUTATING = {"createInternetRadioStation", "updateInternetRadioStation", "deleteInternetRadioStation",
            "startScan", "scrobble", "createPlaylist", "updatePlaylist", "deletePlaylist"}
PUBLIC = {"getOpenSubsonicExtensions"}      # segun OpenSubsonic, no requiere autenticacion


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = SERVER_NAME + "/" + SERVER_VERSION
    timeout = 120

    def req_lang(self):
        """Idioma del cliente: cabecera X-Lang (la pone la web) o Accept-Language. Sin nada: espanol."""
        v = (self.headers.get("X-Lang") or self.headers.get("Accept-Language") or "es").strip().lower()
        return "es" if v.startswith("es") else "en"

    def log_request(self, code="-", size="-"):
        log("%s %s %s" % (self.command, self.path.split("?")[0], code))   # sin query: no registra contrasenas

    # --- respuestas ---
    def send_bytes(self, status, ctype, body, headers=None, pre_gz=None):
        # Las respuestas de texto (JSON, JS, CSS...) se comprimen: una playlist de 6000 canciones pasa de ~3,4 MB a unos 400 KB
        gz = False
        if pre_gz is not None and "gzip" in (self.headers.get("Accept-Encoding") or "") and self.command != "HEAD":
            body = pre_gz
            gz = True
        elif (len(body) > 1400 and "gzip" in (self.headers.get("Accept-Encoding") or "") and self.command != "HEAD"
                and (ctype.startswith("text/") or ctype.startswith("application/json") or ctype.startswith("application/javascript")
                     or ctype.startswith("image/svg"))):
            body = gzip.compress(body, 5)
            gz = True
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        if gz:
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Vary", "Accept-Encoding")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self._started = True
        if self.command != "HEAD":
            self.wfile.write(body)

    def send_json(self, status, obj, headers=None):
        self.send_bytes(status, "application/json; charset=utf-8",
                        json.dumps(obj, ensure_ascii=False).encode("utf-8"), headers)

    def send_api(self, env, fmt):
        if fmt in ("json", "jsonp"):
            self.send_json(200, {"subsonic-response": env})
        else:
            root = ET.Element("subsonic-response")
            root.set("xmlns", XMLNS)
            xml_fill(root, env)
            body = ('<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode")).encode("utf-8")
            self.send_bytes(200, "text/xml; charset=utf-8", body)

    def send_file(self, path, ctype, download_name=None):
        try:
            f = open(path, "rb")
        except OSError:
            raise ApiError(70, "Archivo no encontrado en disco")
        with f:
            size = os.fstat(f.fileno()).st_size
            start, end, status = 0, size - 1, 200
            m = re.match(r"^bytes=(\d*)-(\d*)$", (self.headers.get("Range") or "").strip())
            if m and (m.group(1) or m.group(2)):
                if m.group(1):
                    start = int(m.group(1))
                    if m.group(2):
                        end = min(int(m.group(2)), size - 1)
                else:                                    # "bytes=-N": los ultimos N bytes
                    start = max(size - int(m.group(2)), 0)
                if start > end or start >= size:
                    self.send_bytes(416, "text/plain", b"", {"Content-Range": "bytes */%d" % size})
                    return
                status = 206
            length = end - start + 1
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", str(length))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length")
            if status == 206:
                self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
            if download_name:
                self.send_header("Content-Disposition", "attachment; filename*=UTF-8''" + quote(download_name))
            self.end_headers()
            self._started = True
            if self.command == "HEAD":
                return
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(65536, remaining))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    self.close_connection = True
                    return
                remaining -= len(chunk)

    # --- endpoints binarios ---
    def serve_stream(self, p, download):
        sid = parse_id(need(p, "id"), "so")
        r = db().execute("SELECT path, content_type, suffix, bitrate, mtime FROM songs WHERE id=?", (sid,)).fetchone()
        if not r:
            raise ApiError(70, "Cancion no encontrada")
        max_br = arg_int(p, "maxBitRate", 0)
        fmt = (arg(p, "format") or "").lower()
        if not download and fmt != "raw" and (max_br > 0 or fmt == "mp3"):
            src = r["bitrate"] or 0
            already = (src and max_br > 0 and src <= max_br and fmt in ("", r["suffix"])) or \
                      (fmt == "mp3" and r["suffix"] == "mp3" and (max_br == 0 or (src and src <= max_br)))
            if not already:
                out = transcoded_file(sid, r["path"], r["mtime"], max(32, min(max_br or 320, 320)))
                if out:
                    return self.send_file(out, "audio/mpeg")
                log("No se pudo recodificar %s; se envia el original" % r["path"])
        self.send_file(r["path"], r["content_type"], os.path.basename(r["path"]) if download else None)

    def serve_radio(self, p):
        """Reenvía una radio de internet a través del servidor. Hace falta cuando la web va por HTTPS y la radio
        por HTTP: el navegador bloquea ese contenido mixto. Solo se pueden pedir radios ya guardadas (nada de URLs libres)."""
        rid = parse_id(need(p, "id"), "ra")
        r = db().execute("SELECT stream_url FROM radios WHERE id=?", (rid,)).fetchone()
        if not r:
            raise ApiError(70, "Radio no encontrada")
        try:
            up = urlopen(Request(r["stream_url"], headers={"User-Agent": "Zinctify", "Icy-MetaData": "0"}), timeout=15)
        except Exception as e:
            log("Radio %s no disponible: %s" % (r["stream_url"], e))
            self.send_bytes(502, "text/plain; charset=utf-8", b"Radio no disponible")
            return
        try:
            self.send_response(200)
            self.send_header("Content-Type", up.headers.get("Content-Type") or "audio/mpeg")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Connection", "close")
            self.end_headers()
            self.close_connection = True
            while True:
                chunk = up.read(8192)
                if not chunk:
                    break
                self.wfile.write(chunk)
        finally:
            up.close()

    def serve_cover(self, p, user=None):
        cid = need(p, "id")
        if cid.startswith("pl-"):
            me = sub_user(user) if user else None
            pl = playlist_row(parse_pl(cid)) if me else None
            cf = find_image(playlist_cover_base(pl["id"])) if pl and pl["cover"] and (pl["owner_id"] == me["id"] or pl["public"]) else None
            if cf:
                with open(cf, "rb") as f:
                    return self.send_bytes(200, image_mime(cf), f.read(), {"Cache-Control": "private, max-age=86400"})
            raise ApiError(70, "Sin caratula")
        if cid.startswith("ra-") and cid[3:].isdigit():
            rf = find_image(radio_cover_base(int(cid[3:])))
            if rf:
                with open(rf, "rb") as f:
                    return self.send_bytes(200, image_mime(rf), f.read(), {"Cache-Control": "public, max-age=300"})
            raise ApiError(70, "Sin caratula")
        if cid.startswith("ar-") and cid[3:].isdigit():
            pf = find_image(artist_photo_base(int(cid[3:])))
            if pf:
                with open(pf, "rb") as f:
                    return self.send_bytes(200, image_mime(pf), f.read(), {"Cache-Control": "public, max-age=3600"})
        size = arg_int(p, "size", 0)
        size = 1200 if size <= 0 else max(32, min(size, 2000))
        for src in cover_candidates(need(p, "id")):
            if not os.path.exists(src):
                continue
            out = render_cover(src, size)
            if out:
                etag = '"%s"' % os.path.basename(out)[:-4]
                if (self.headers.get("If-None-Match") or "") == etag:          # el navegador ya la tiene: 304 sin cuerpo
                    self.send_response(304)
                    self.send_header("ETag", etag)
                    self.send_header("Cache-Control", "public, max-age=86400")
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    self._started = True
                    return
                with open(out, "rb") as f:
                    body = f.read()
                return self.send_bytes(200, "image/jpeg", body, {"Cache-Control": "public, max-age=86400", "ETag": etag})
        raise ApiError(70, "Sin caratula")

    # --- enrutado ---
    def serve_rest(self, name, params):
        fmt = (arg(params, "f", "xml") or "xml").lower()
        try:
            user = None
            if name not in PUBLIC:
                user, err = authenticate(params, self)
                if err:
                    raise ApiError(*err)
                if self.via_cookie and name in MUTATING and self.command != "POST":
                    raise ApiError(0, "Esta operación requiere POST")
            if name in ("stream", "download"):
                return self.serve_stream(params, name == "download")
            if name == "radioStream":
                return self.serve_radio(params)
            if name == "getCoverArt":
                return self.serve_cover(params, user)
            fn = ENDPOINTS.get(name)
            if fn is None:
                raise ApiError(0, "Funcion de la API no implementada: %s" % name)
            self.send_api(envelope(fn(user, params)), fmt)
        except ApiError as e:
            msg = tr(e.message, self.req_lang())
            if name in BINARY and e.code == 70:
                self.send_bytes(404, "text/plain; charset=utf-8", msg.encode("utf-8"))
            else:
                self.send_api(envelope(error=(e.code, msg)), fmt)
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True
        except Exception:
            log("Error interno en %s:\n%s" % (name, traceback.format_exc()))
            if getattr(self, "_started", False):
                self.close_connection = True
            else:
                self.send_api(envelope(error=(0, tr("Error interno del servidor", self.req_lang()))), fmt)

    def serve_static(self, path):
        """Sirve la interfaz web (carpeta web/). Solo archivos dentro de esa carpeta."""
        rel = "index.html" if path in ("", "/") else path.lstrip("/")
        base = os.path.realpath(CFG.web_dir) if CFG.web_dir else ""
        full = os.path.realpath(os.path.join(base, rel)) if base else ""
        if not base or not full.startswith(base + os.sep) or not os.path.isfile(full):
            if path in ("", "/"):
                msg = ("%s %s funcionando (la API Subsonic en /rest/ va bien).\n"
                       "Pero no encuentro la interfaz web. Busqué: %s\n"
                       "Crea una carpeta llamada 'web' junto a zinctify.py con index.html, style.css y app.js\n"
                       "(o indica otra con --web-dir) y reinicia el servidor.\n\n"
                       "%s %s is running (the Subsonic API at /rest/ works).\n"
                       "But the web interface was not found. Looked for: %s\n"
                       "Create a folder named 'web' next to zinctify.py with index.html, style.css and app.js\n"
                       "(or use --web-dir) and restart the server.\n"
                       % (SERVER_NAME, SERVER_VERSION, os.path.join(CFG.web_dir or "?", "index.html"),
                          SERVER_NAME, SERVER_VERSION, os.path.join(CFG.web_dir or "?", "index.html")))
                return self.send_bytes(200, "text/plain; charset=utf-8", msg.encode("utf-8"))
            return self.send_bytes(404, "text/plain; charset=utf-8", b"No encontrado\n")
        ctype = (STATIC_TYPES.get(os.path.splitext(full)[1].lower()) or mimetypes.guess_type(full)[0]
                 or "application/octet-stream")
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        headers = {"Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff"}
        if "/fonts/" in full.replace(os.sep, "/"):
            headers["Cache-Control"] = "public, max-age=604800"
        if full.endswith(".html"):
            headers["Content-Security-Policy"] = ("default-src 'self'; img-src 'self' data: blob: https: http:; media-src * blob:; "
                                                  "style-src 'self' 'unsafe-inline'; frame-ancestors 'none'")
        try:
            st = os.stat(full)
            hit = STATIC_CACHE.get(full)
            if not hit or hit[0] != (st.st_mtime_ns, st.st_size):
                with open(full, "rb") as f:
                    data = f.read()
                compressible = ctype.startswith("text/") or ctype.startswith("application/javascript") or ctype.startswith("application/json") or ctype.startswith("image/svg")
                hit = ((st.st_mtime_ns, st.st_size), data, gzip.compress(data, 9) if compressible and len(data) > 1400 else None,
                       '"%x-%x"' % (st.st_mtime_ns // 1000, st.st_size))
                if len(STATIC_CACHE) > 300:
                    STATIC_CACHE.clear()
                STATIC_CACHE[full] = hit
            _, data, gz_data, etag = hit
            headers["ETag"] = etag
            if self.headers.get("If-None-Match") == etag:         # el navegador ya lo tiene: no se vuelve a enviar
                self.send_response(304)
                for k, v in headers.items():
                    self.send_header(k, v)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self._started = True
                return
            if gz_data is not None:
                headers["Vary"] = "Accept-Encoding"
                return self.send_bytes(200, ctype, data, headers, pre_gz=gz_data)
        except OSError as e:
            log("No puedo leer %s: %s" % (full, e))
            msg = ("No puedo leer %s (%s).\nProbablemente son los permisos: ejecuta  sudo chmod -R a+rX %s\n"
                   "Cannot read %s (%s). Probably file permissions: run  sudo chmod -R a+rX %s\n"
                   % (full, e.strerror, base, full, e.strerror, base))
            return self.send_bytes(500, "text/plain; charset=utf-8", msg.encode("utf-8"))
        self.send_bytes(200, ctype, data, headers)

    def serve_web(self, name, raw_body):
        """Rutas JSON de la interfaz: /web/login, /web/signup, /web/me, /web/admin/..."""
        self._cookie_header = None
        try:
            origin = self.headers.get("Origin")
            if origin and urlparse(origin).netloc != (self.headers.get("Host") or ""):
                raise ApiError(50, "Origen no permitido")
            data = {}
            if self.command == "POST" and name.startswith("upload/"):
                data = {k: v[0] for k, v in parse_qs(urlparse(self.path).query).items()}
                data["raw"] = raw_body
            elif self.command == "POST":
                try:
                    data = json.loads(raw_body.decode("utf-8") or "{}")
                except ValueError:
                    data = None
                if not isinstance(data, dict):
                    raise ApiError(0, "JSON no válido")
            fn = WEB_ROUTES.get(("POST" if self.command == "POST" else "GET", name))
            if fn is None:
                raise ApiError(70, "Ruta no encontrada")
            payload = fn(self, data)
            headers = {"Cache-Control": "no-store"}
            if self._cookie_header:
                headers["Set-Cookie"] = self._cookie_header
            self.send_json(200, payload, headers)
        except ApiError as e:
            status = {40: 401, 50: 403, 60: 429, 70: 404}.get(e.code, 400)
            self.send_json(status, {"error": tr(e.message, self.req_lang())})
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True
        except Exception:
            log("Error interno en /web/%s:\n%s" % (name, traceback.format_exc()))
            self.send_json(500, {"error": tr("Error interno del servidor", self.req_lang())})

    def serve_spotify_callback(self, params):
        """Spotify vuelve aqui tras el login; canjea el codigo y devuelve a la interfaz."""
        code = (params.get("code") or [""])[0]
        state = (params.get("state") or [""])[0]
        err = (params.get("error") or [""])[0]
        msg = ""
        if err or not code:
            msg = "Spotify ha cancelado la conexión (%s)." % (err or "sin código")
        else:
            try:
                sp_finish(code, state)
            except ApiError as e:
                msg = tr(e.message, self.req_lang())
        if msg:
            page = ("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
                    "<title>Zinctify</title><body style='font-family:sans-serif;background:#111;color:#eee;padding:2em'>"
                    "<h2>No se ha podido conectar Spotify</h2><p>%s</p><p><a style='color:#6cf' href='/'>Volver a Zinctify</a></p>"
                    % msg.replace("&", "&amp;").replace("<", "&lt;"))
            return self.send_bytes(400, "text/html; charset=utf-8", page.encode("utf-8"))
        self.send_response(302)
        self.send_header("Location", "/#/")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def serve_wrapped(self, params):
        user, err = authenticate(params, self)
        if err:
            return self.send_json(401, {"error": tr(err[1], self.req_lang())})
        year = arg_int(params, "year", datetime.now().year)
        limit = max(1, min(arg_int(params, "limit", 10), 100))
        self.send_json(200, build_wrapped(user, year, limit))

    def dispatch(self):
        try:
            self._dispatch()
        finally:
            # Red de seguridad: si una escritura fallo a medias, no dejes la base de datos bloqueada
            # (los navegadores reutilizan la conexion, y con ella esta conexion de SQLite).
            conn = getattr(_local, "conn", None)
            if conn is not None and conn.in_transaction:
                conn.rollback()

    def _dispatch(self):
        self._started = False
        self.via_cookie = False
        url = urlparse(self.path)
        path = url.path
        params = parse_qs(url.query, keep_blank_values=True)
        raw_body = b""
        if self.command == "POST":
            length = int(self.headers.get("Content-Length") or 0)
            limit = (MAX_IMAGE + 4096) if path.startswith("/web/upload/") else (32 << 20 if path in ("/web/import/playlist", "/web/import/start") else (1 << 20))
            if length > limit:
                if path.startswith("/web/upload/") and length <= (200 << 20):
                    left = length                           # se lee y descarta, para que el navegador reciba el aviso
                    while left > 0:
                        chunk = self.rfile.read(min(left, 1 << 20))
                        if not chunk:
                            break
                        left -= len(chunk)
                    return self.send_json(413, {"error": tr("La imagen pesa más de 20 MB", self.req_lang())})
                self.close_connection = True            # no leemos cuerpos enormes
                return self.send_bytes(413, "text/plain; charset=utf-8", b"Peticion demasiado grande\n")
            raw_body = self.rfile.read(length) if length else b""
            if not path.startswith("/web/"):            # /web/ usa JSON; /rest/ usa formulario
                for k, v in parse_qs(raw_body.decode("utf-8", "replace"), keep_blank_values=True).items():
                    params.setdefault(k, []).extend(v)
        if path.startswith("/rest/"):
            name = path[len("/rest/"):]
            if name.endswith(".view"):
                name = name[:-5]
            self.serve_rest(name, params)
        elif path == "/api/wrapped":
            self.serve_wrapped(params)
        elif path.startswith("/web/"):
            self.serve_web(path[len("/web/"):], raw_body)
        elif path.startswith("/updates/") and self.command in ("GET", "HEAD"):
            serve_update(self, path)
        elif path in ("/download/windows", "/download/linux", "/download/android") and self.command in ("GET", "HEAD"):
            serve_download(self, path.rsplit("/", 1)[1])
        elif path == "/spotify-callback" and self.command == "GET":
            self.serve_spotify_callback(params)
        elif path.startswith("/img/") and self.command in ("GET", "HEAD"):
            image_response(self, path)
        elif self.command in ("GET", "HEAD"):
            self.serve_static(path)
        else:
            self.send_bytes(404, "text/plain; charset=utf-8", b"No encontrado\n")

    do_GET = dispatch
    do_POST = dispatch
    do_HEAD = dispatch

    def do_OPTIONS(self):                                # preflight CORS (por si haces un cliente web)
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Range, Content-Type")
        self.send_header("Content-Length", "0")
        self.end_headers()


# ---------------------------------------------------------------------------
# Rutas de la interfaz web (/web/...): cuentas, sesion y administracion
# ---------------------------------------------------------------------------

WEB_ROUTES = {}


def web_route(method, name):
    def deco(fn):
        WEB_ROUTES[(method, name)] = fn
        return fn
    return deco


def logged_in(h):
    row = session_user(h)
    if not row:
        raise ApiError(40, "Inicia sesión para continuar")
    return row


def admin_only(h):
    row = logged_in(h)
    if not row["is_admin"]:
        raise ApiError(50, "Solo el administrador puede hacer esto")
    return row


def start_session(h, row):
    h._cookie_header = session_cookie(h, new_session(row["id"]))
    return {"user": public_user(row), "apiKey": row["api_key"]}


@web_route("GET", "me")
def web_me(h, data):
    row = session_user(h)
    out = {"server": SERVER_NAME, "version": SERVER_VERSION, "signup": signup_state(), "user": None,
           "radios": get_setting("radios_enabled", "0") == "1"}
    if row:
        out["user"] = public_user(row)
        out["apiKey"] = row["api_key"]
    return out


@web_route("POST", "login")
def web_login(h, data):
    ip = h.client_address[0]
    if too_many_fails(ip):
        raise ApiError(60, "Demasiados intentos fallidos; espera unos minutos")
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))
    row = db().execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    ok = verify_password(password, row["pw_hash"] if row else dummy_hash())
    if not row or not ok:
        note_fail(ip)
        raise ApiError(40, "Usuario o contraseña incorrectos")
    return start_session(h, row)


@web_route("POST", "signup")
def web_signup(h, data):
    if signup_state() == "closed":
        raise ApiError(50, "El registro está cerrado. Pide una cuenta al administrador.")
    row = create_user(str(data.get("username", "")).strip(), str(data.get("password", "")),
                      email=data.get("email"))
    return start_session(h, row)


@web_route("POST", "logout")
def web_logout(h, data):
    token = session_token(h)
    if token:
        conn = db()
        conn.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash(token),))
        conn.commit()
    h._cookie_header = session_cookie(h, "", 0)
    return {"ok": True}


@web_route("POST", "password")
def web_password(h, data):
    row = logged_in(h)
    if not verify_password(str(data.get("current", "")), row["pw_hash"]):
        raise ApiError(40, "La contraseña actual no es correcta")
    new = str(data.get("new", ""))
    validate_credentials(row["username"], new)
    conn = db()
    conn.execute("UPDATE users SET pw_hash=? WHERE id=?", (hash_password(new), row["id"]))
    conn.execute("DELETE FROM sessions WHERE user_id=? AND token_hash != ?",       # cierra las demas sesiones
                 (row["id"], token_hash(session_token(h))))
    conn.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Recuperar la contrasena por correo (codigo de 6 cifras)
# ---------------------------------------------------------------------------

RESET_CODE_MIN = 10          # minutos de validez del codigo
RESET_OK_MIN = 10            # minutos para escribir la contrasena nueva tras verificar el codigo
RESET_MAX_TRIES = 5
_RESET_IP = {}               # ip -> momentos de peticiones recientes
_RESET_SENT = {}             # id de usuario -> momentos de envios recientes


def smtp_config():
    c = {k: get_setting("smtp_" + k, "") for k in ("host", "port", "user", "pass", "from", "security")}
    c["port"] = int(c["port"] or 587)
    c["security"] = c["security"] or "starttls"
    return c


def smtp_ready():
    c = smtp_config()
    return bool(c["host"] and (c["from"] or c["user"]))


def send_mail(to, subject, body):
    """Envia un correo por el SMTP configurado. Lanza ApiError si no se puede."""
    c = smtp_config()
    if not c["host"]:
        raise ApiError(0, "El correo no está configurado. Avisa al administrador.")
    msg = EmailMessage()
    msg["From"] = c["from"] or c["user"]
    msg["To"] = to
    msg["Subject"] = subject
    msg["Message-ID"] = "<%s@zinctify>" % secrets.token_hex(12)
    msg.set_content(body)
    try:
        ctx = ssl.create_default_context()
        if c["security"] == "ssl":
            srv = smtplib.SMTP_SSL(c["host"], c["port"], timeout=15, context=ctx)
        else:
            srv = smtplib.SMTP(c["host"], c["port"], timeout=15)
        with srv:
            if c["security"] == "starttls":
                srv.starttls(context=ctx)
            if c["user"]:
                srv.login(c["user"], c["pass"])
            srv.send_message(msg)
    except (smtplib.SMTPException, OSError) as e:
        log("smtp: %s" % e)
        raise ApiError(0, "No se pudo enviar el correo. Avisa al administrador.")


def reset_throttle(h):
    ip = h.client_address[0]
    now = time.time()
    recent = [t for t in _RESET_IP.get(ip, []) if now - t < 600]
    if len(recent) >= 12:
        raise ApiError(60, "Demasiados intentos; espera unos minutos")
    recent.append(now)
    _RESET_IP[ip] = recent


def _hash_code(code, salt=None):
    salt = salt or secrets.token_hex(8)
    return "%s$%s" % (salt, hashlib.sha256((salt + code).encode()).hexdigest())


def _check_code(code, stored):
    try:
        salt, _ = stored.split("$")
    except ValueError:
        return False
    return hmac.compare_digest(_hash_code(code, salt), stored)


def user_by_email(email):
    email = str(email or "").strip()
    if not email:
        return None
    return db().execute("SELECT * FROM users WHERE email=? COLLATE NOCASE", (email,)).fetchone()


@web_route("POST", "reset/request")
def web_reset_request(h, data):
    reset_throttle(h)
    if not smtp_ready():
        raise ApiError(0, "La recuperación por correo no está activada en este servidor. Pídele al administrador que te cambie la contraseña.")
    user = user_by_email(data.get("email"))
    if not user:
        raise ApiError(70, "Este correo no está vinculado a ninguna cuenta")
    now = time.time()
    sent = [t for t in _RESET_SENT.get(user["id"], []) if now - t < 3600]
    if sent and now - sent[-1] < 60:
        raise ApiError(60, "Acabas de pedir un código. Espera un minuto para pedir otro.")
    if len(sent) >= 3:
        raise ApiError(60, "Has pedido demasiados códigos. Inténtalo de nuevo en una hora.")
    code = "%06d" % secrets.randbelow(1000000)
    en = h.req_lang() == "en"
    if en:
        subject = "Zinctify: your recovery code"
        body = ("Hi %s,\n\nYour Zinctify recovery code is: %s\n\nIt expires in %d minutes. "
                "If you didn't ask for it, ignore this email: your password hasn't changed.\n") % (user["username"], code, RESET_CODE_MIN)
    else:
        subject = "Zinctify: tu código de recuperación"
        body = ("Hola %s,\n\nTu código de recuperación de Zinctify es: %s\n\nCaduca en %d minutos. "
                "Si no lo has pedido tú, ignora este correo: tu contraseña no ha cambiado.\n") % (user["username"], code, RESET_CODE_MIN)
    send_mail(user["email"], subject, body)
    sent.append(now)
    _RESET_SENT[user["id"]] = sent
    conn = db()
    conn.execute("INSERT INTO pw_resets(user_id, code_hash, expires, attempts, ok_hash, ok_expires, created) VALUES(?,?,?,0,NULL,0,?) "
                 "ON CONFLICT(user_id) DO UPDATE SET code_hash=excluded.code_hash, expires=excluded.expires, attempts=0, "
                 "ok_hash=NULL, ok_expires=0, created=excluded.created",
                 (user["id"], _hash_code(code), int(now) + RESET_CODE_MIN * 60, int(now)))
    conn.commit()
    return {"ok": True, "minutes": RESET_CODE_MIN}


@web_route("POST", "reset/verify")
def web_reset_verify(h, data):
    reset_throttle(h)
    bad = ApiError(40, "El código no es correcto o ha caducado")
    user = user_by_email(data.get("email"))
    code = re.sub(r"\s", "", str(data.get("code", "")))
    if not user:
        raise bad
    conn = db()
    r = conn.execute("SELECT * FROM pw_resets WHERE user_id=?", (user["id"],)).fetchone()
    if not r or r["expires"] < time.time() or r["attempts"] >= RESET_MAX_TRIES or r["ok_hash"]:
        raise bad
    if not (code.isdigit() and len(code) == 6 and _check_code(code, r["code_hash"])):
        conn.execute("UPDATE pw_resets SET attempts = attempts + 1 WHERE user_id=?", (user["id"],))
        conn.commit()
        left = RESET_MAX_TRIES - r["attempts"] - 1
        if left <= 0:
            raise ApiError(40, "Demasiados fallos: el código se ha anulado. Pide uno nuevo.")
        raise bad
    token = secrets.token_urlsafe(24)
    conn.execute("UPDATE pw_resets SET ok_hash=?, ok_expires=? WHERE user_id=?",
                 (hashlib.sha256(token.encode()).hexdigest(), int(time.time()) + RESET_OK_MIN * 60, user["id"]))
    conn.commit()
    return {"ok": True, "token": token}


@web_route("POST", "reset/confirm")
def web_reset_confirm(h, data):
    reset_throttle(h)
    bad = ApiError(40, "La sesión de recuperación ha caducado. Empieza de nuevo.")
    user = user_by_email(data.get("email"))
    token = str(data.get("token", ""))
    if not user or not token:
        raise bad
    conn = db()
    r = conn.execute("SELECT * FROM pw_resets WHERE user_id=?", (user["id"],)).fetchone()
    if not r or not r["ok_hash"] or r["ok_expires"] < time.time() or \
            not hmac.compare_digest(r["ok_hash"], hashlib.sha256(token.encode()).hexdigest()):
        raise bad
    new = str(data.get("password", ""))
    validate_credentials(user["username"], new)
    conn.execute("UPDATE users SET pw_hash=? WHERE id=?", (hash_password(new), user["id"]))
    conn.execute("DELETE FROM sessions WHERE user_id=?", (user["id"],))
    conn.execute("DELETE FROM pw_resets WHERE user_id=?", (user["id"],))
    conn.commit()
    return {"ok": True}


@web_route("GET", "admin/smtp")
def web_admin_smtp(h, data):
    admin_only(h)
    c = smtp_config()
    return {"host": c["host"], "port": c["port"], "user": c["user"], "hasPass": bool(c["pass"]),
            "from": c["from"], "security": c["security"]}


@web_route("POST", "admin/smtp")
def web_admin_smtp_save(h, data):
    admin_only(h)
    host = str(data.get("host", "")).strip()
    sec = str(data.get("security", "starttls"))
    if sec not in ("starttls", "ssl", "none"):
        sec = "starttls"
    try:
        port = int(data.get("port") or 587)
    except (TypeError, ValueError):
        port = 587
    set_setting("smtp_host", host)
    set_setting("smtp_port", str(port))
    set_setting("smtp_user", str(data.get("user", "")).strip())
    set_setting("smtp_from", str(data.get("from", "")).strip())
    set_setting("smtp_security", sec)
    if data.get("password"):                       # vacio = no cambiar la que ya hay
        set_setting("smtp_pass", str(data.get("password")))
    return {"ok": True}


@web_route("POST", "admin/smtp-test")
def web_admin_smtp_test(h, data):
    me = admin_only(h)
    to = str(data.get("to") or me["email"] or "").strip()
    if not EMAIL_RE.match(to):
        raise ApiError(0, "Escribe un correo electrónico válido")
    send_mail(to, "Zinctify: correo de prueba", "Si lees esto, el envío de correo de Zinctify funciona.\n")
    return {"ok": True, "to": to}


# ---------------------------------------------------------------------------
# Chat entre amigos
# ---------------------------------------------------------------------------
# Los mensajes se guardan cifrados con una clave que vive en el servidor (chat.key, en la carpeta de datos):
# quien copie o lea la base de datos sin esa clave no ve nada. No es cifrado de extremo a extremo: el servidor
# puede descifrarlos para enseñarselos a sus dos participantes. Esquema: HMAC-SHA256 en modo contador + etiqueta HMAC.

_CHAT_KEYS = []


def chat_keys():
    if not _CHAT_KEYS:
        path = os.path.join(CFG.data_dir, "chat.key")
        if not os.path.exists(path):
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "wb") as f:
                f.write(secrets.token_bytes(32))
        with open(path, "rb") as f:
            master = f.read()
        _CHAT_KEYS.extend([hmac.new(master, b"enc", "sha256").digest(), hmac.new(master, b"mac", "sha256").digest()])
    return _CHAT_KEYS


def _chat_stream(key, nonce, n):
    out = bytearray()
    i = 0
    while len(out) < n:
        out += hmac.new(key, nonce + i.to_bytes(8, "big"), "sha256").digest()
        i += 1
    return bytes(out[:n])


def chat_seal(obj, sender_id, recipient_id):
    ek, mk = chat_keys()
    plain = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode()
    nonce = secrets.token_bytes(16)
    ct = bytes(a ^ b for a, b in zip(plain, _chat_stream(ek, nonce, len(plain))))
    aad = ("%d:%d" % (sender_id, recipient_id)).encode()
    tag = hmac.new(mk, b"v1" + aad + nonce + ct, "sha256").digest()
    return "v1." + base64.b64encode(nonce + ct + tag).decode()


def chat_open(body, sender_id, recipient_id):
    try:
        ek, mk = chat_keys()
        raw = base64.b64decode(body[3:])
        nonce, ct, tag = raw[:16], raw[16:-32], raw[-32:]
        aad = ("%d:%d" % (sender_id, recipient_id)).encode()
        if not hmac.compare_digest(tag, hmac.new(mk, b"v1" + aad + nonce + ct, "sha256").digest()):
            return {"t": "[mensaje ilegible]"}
        return json.loads(bytes(a ^ b for a, b in zip(ct, _chat_stream(ek, nonce, len(ct)))).decode())
    except (ValueError, KeyError, TypeError, UnicodeDecodeError):
        return {"t": "[mensaje ilegible]"}


CHAT_SHARE_TYPES = ("song", "album", "artist", "playlist")
_CHAT_SENT = {}


def chat_msg(row, me_id):
    d = chat_open(row["body"], row["sender_id"], row["recipient_id"])
    m = {"id": row["id"], "ts": row["ts"], "mine": row["sender_id"] == me_id, "text": d.get("t", "")}
    if isinstance(d.get("s"), dict):
        m["share"] = d["s"]
    return m


def chat_friend(me, username):
    other = db().execute("SELECT * FROM users WHERE username=? COLLATE NOCASE", (str(username or ""),)).fetchone()
    if not other or other["id"] == me["id"]:
        raise ApiError(0, "Ese usuario no existe")
    if not mutual_friends(me["username"], other["username"]):
        raise ApiError(50, "Solo puedes chatear con tus amigos (os tenéis que seguir los dos)")
    return other


def chat_user(u):
    return {"username": u["username"], "displayName": u["display_name"] or "", "avatar": u["avatar"] or 0}


@web_route("POST", "chat/send")
def web_chat_send(h, data):
    me = logged_in(h)
    other = chat_friend(me, data.get("to"))
    text = str(data.get("text", "")).strip()[:2000]
    obj = {"t": text}
    sh = data.get("share")
    if isinstance(sh, dict):
        kind = str(sh.get("type", ""))
        if kind not in CHAT_SHARE_TYPES or not str(sh.get("id", "")).strip():
            raise ApiError(0, "No se puede compartir eso")
        obj["s"] = {"type": kind, "id": str(sh["id"])[:64], "name": str(sh.get("name", ""))[:200]}
    if not text and "s" not in obj:
        raise ApiError(0, "Escribe un mensaje")
    now = time.time()
    recent = [t for t in _CHAT_SENT.get(me["id"], []) if now - t < 10]
    if len(recent) >= 12:
        raise ApiError(60, "Demasiados mensajes seguidos; espera un momento")
    recent.append(now)
    _CHAT_SENT[me["id"]] = recent
    conn = db()
    cur = conn.execute("INSERT INTO chat_messages(sender_id, recipient_id, ts, body) VALUES(?,?,?,?)",
                       (me["id"], other["id"], int(now), chat_seal(obj, me["id"], other["id"])))
    conn.execute("INSERT INTO chat_reads(user_id, other_id, last_id) VALUES(?,?,?) ON CONFLICT(user_id, other_id) DO UPDATE SET last_id=MAX(last_id, excluded.last_id)",
                 (me["id"], other["id"], cur.lastrowid))
    conn.commit()
    row = conn.execute("SELECT * FROM chat_messages WHERE id=?", (cur.lastrowid,)).fetchone()
    return {"message": chat_msg(row, me["id"])}


@web_route("POST", "chat/messages")
def web_chat_messages(h, data):
    me = logged_in(h)
    other = chat_friend(me, data.get("user"))
    try:
        limit = max(1, min(100, int(data.get("limit") or 40)))
    except (TypeError, ValueError):
        limit = 40
    before = data.get("before")
    q = ("SELECT * FROM chat_messages WHERE ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?))"
         + (" AND id<?" if isinstance(before, int) else "") + " ORDER BY id DESC LIMIT ?")
    args = [me["id"], other["id"], other["id"], me["id"]] + ([before] if isinstance(before, int) else []) + [limit]
    rows = db().execute(q, args).fetchall()
    rows.reverse()
    return {"user": chat_user(other), "messages": [chat_msg(r, me["id"]) for r in rows], "more": len(rows) == limit}


@web_route("POST", "chat/read")
def web_chat_read(h, data):
    me = logged_in(h)
    other = chat_friend(me, data.get("user"))
    conn = db()
    last = conn.execute("SELECT COALESCE(MAX(id),0) FROM chat_messages WHERE sender_id=? AND recipient_id=?", (other["id"], me["id"])).fetchone()[0]
    conn.execute("INSERT INTO chat_reads(user_id, other_id, last_id) VALUES(?,?,?) ON CONFLICT(user_id, other_id) DO UPDATE SET last_id=MAX(last_id, excluded.last_id)",
                 (me["id"], other["id"], last))
    conn.commit()
    return {"ok": True}


@web_route("POST", "chat/poll")
def web_chat_poll(h, data):
    """Consulta ligera: mensajes nuevos para mi desde `after` y cuantos tengo sin leer de cada amigo."""
    me = logged_in(h)
    conn = db()
    after = data.get("after")
    last = conn.execute("SELECT COALESCE(MAX(id),0) FROM chat_messages WHERE recipient_id=?", (me["id"],)).fetchone()[0]
    msgs = []
    if isinstance(after, int) and last > after:
        for r in conn.execute("SELECT m.*, u.username AS su, u.display_name AS sd, u.avatar AS sa FROM chat_messages m JOIN users u ON u.id=m.sender_id "
                              "WHERE m.recipient_id=? AND m.id>? ORDER BY m.id LIMIT 100", (me["id"], after)).fetchall():
            m = chat_msg(r, me["id"])
            m["from"] = {"username": r["su"], "displayName": r["sd"] or "", "avatar": r["sa"] or 0}
            msgs.append(m)
    unread = {r["username"]: r["n"] for r in conn.execute(
        "SELECT u.username, COUNT(*) AS n FROM chat_messages m JOIN users u ON u.id=m.sender_id "
        "LEFT JOIN chat_reads cr ON cr.user_id=m.recipient_id AND cr.other_id=m.sender_id "
        "WHERE m.recipient_id=? AND m.id > COALESCE(cr.last_id,0) GROUP BY u.username", (me["id"],))}
    return {"last": last, "messages": msgs, "unread": unread}


@web_route("POST", "chat/friends")
def web_chat_friends(h, data):
    """Mis amigos con los que puedo chatear, del que he hablado mas recientemente al mas antiguo."""
    me = logged_in(h)
    conn = db()
    rows = conn.execute(
        "SELECT u.* FROM users u JOIN follows a ON a.follower_id=? AND a.followed_id=u.id "
        "JOIN follows b ON b.follower_id=u.id AND b.followed_id=? ", (me["id"], me["id"])).fetchall()
    out = []
    for u in rows:
        last = conn.execute("SELECT * FROM chat_messages WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?) ORDER BY id DESC LIMIT 1",
                            (me["id"], u["id"], u["id"], me["id"])).fetchone()
        item = chat_user(u)
        item["ts"] = last["ts"] if last else 0
        if last:
            m = chat_msg(last, me["id"])
            item["last"] = {"mine": m["mine"], "text": m["text"] or (m.get("share", {}).get("name", "")), "share": bool(m.get("share"))}
        out.append(item)
    out.sort(key=lambda x: (-x["ts"], x["username"].lower()))
    return {"friends": out}


# ---------------------------------------------------------------------------
# Reproducir en...: tus dispositivos comparten lo que suena
# ---------------------------------------------------------------------------
# Cada dispositivo (navegador, cliente de escritorio...) avisa cada 1-2 s. Solo uno es el "activo" (el que tiene el audio);
# ese cuenta en que punto va, y los demas lo muestran y lo manejan a distancia. Se puede pasar la reproduccion de uno a otro.

PLAY = {}                 # usuario -> {"devices": {id: {name, kind, seen}}, "active": id|None, "state": {...}, "cmds": {id: [...]}}
PLAY_LOCK = threading.Lock()
DEVICE_TTL = 12           # segundos sin avisar y el dispositivo desaparece de la lista


def _play_now_pos(st, now):
    return st["pos"] + (now - st["at"] if st.get("playing") else 0)


@web_route("POST", "play/sync")
def web_play_sync(h, data):
    me = logged_in(h)
    now = time.time()
    did = re.sub(r"[^A-Za-z0-9_-]", "", str(data.get("id") or ""))[:40]
    if not did:
        raise ApiError(0, "Falta el identificador del dispositivo")
    with PLAY_LOCK:
        u = PLAY.setdefault(me["username"], {"devices": {}, "active": None, "state": None, "cmds": {}})
        u["devices"][did] = {"name": str(data.get("name") or "Dispositivo")[:40], "kind": str(data.get("kind") or "web")[:12], "seen": now}
        for k in [k for k, d in u["devices"].items() if now - d["seen"] > DEVICE_TTL]:
            del u["devices"][k]
            u["cmds"].pop(k, None)
            if u["active"] == k:
                u["active"] = None
                if u["state"]:
                    u["state"]["pos"] = _play_now_pos(u["state"], now)
                    u["state"].update(playing=False, at=now)
        if data.get("claim") and u["active"] != did:
            if u["active"] and u["active"] in u["devices"]:
                u["cmds"].setdefault(u["active"], []).append({"cmd": "stop"})
            u["active"] = did
        np = data.get("np")
        if u["active"] == did and isinstance(np, dict):
            st = u["state"] or {}
            try:
                pos = max(0.0, float(np.get("pos") or 0))
            except (TypeError, ValueError):
                pos = 0.0
            st.update(playing=bool(np.get("playing")), pos=pos, at=now, index=int(np.get("index") or 0))
            if isinstance(np.get("track"), dict):
                st["track"] = np["track"]
            q = data.get("queue")
            if isinstance(q, dict) and isinstance(q.get("items"), list) and len(q["items"]) <= 800:
                st["queue"] = q["items"]
                st["pending"] = q["pending"] if isinstance(q.get("pending"), list) else []
                st["qv"] = st.get("qv", 0) + 1
            if np.get("volume") is not None:
                try:
                    st["volume"] = max(0.0, min(1.0, float(np["volume"])))
                except (TypeError, ValueError):
                    pass
            u["state"] = st
        out_cmds = u["cmds"].pop(did, [])
        st = u["state"]
        view = None
        if st and st.get("track"):
            view = {"playing": bool(st.get("playing")), "pos": round(_play_now_pos(st, now), 2), "track": st["track"], "index": st.get("index", 0),
                    "qv": st.get("qv", 0), "volume": st.get("volume")}
            if data.get("wantQueue") and data.get("haveQv") != st.get("qv", 0):      # la cola solo se envia cuando cambia
                view["queue"] = st.get("queue") or []
                view["pending"] = st.get("pending") or []
        active = u["active"]
        return {"active": active, "state": view if active and active != did else None, "cmds": out_cmds,
                "devices": [{"id": k, "name": d["name"], "kind": d["kind"], "active": k == active} for k, d in sorted(u["devices"].items(), key=lambda kv: kv[1]["name"])]}


@web_route("POST", "play/transfer")
def web_play_transfer(h, data):
    """Pasa la reproduccion a otro dispositivo: el nuevo empieza donde iba el anterior y el anterior se calla."""
    me = logged_in(h)
    to = str(data.get("to") or "")
    now = time.time()
    with PLAY_LOCK:
        u = PLAY.get(me["username"])
        if not u or to not in u["devices"]:
            raise ApiError(0, "Ese dispositivo ya no está conectado")
        if u["active"] == to:
            return {"ok": True}
        st = u["state"]
        if u["active"] and u["active"] in u["devices"]:
            u["cmds"].setdefault(u["active"], []).append({"cmd": "stop"})
        if st and st.get("track"):
            u["cmds"].setdefault(to, []).append({"cmd": "take", "state": {
                "queue": st.get("queue") or [], "pending": st.get("pending") or [], "index": st.get("index", 0), "track": st["track"],
                "pos": round(_play_now_pos(st, now), 2), "playing": bool(st.get("playing"))}})
        u["active"] = to
        return {"ok": True}


@web_route("POST", "play/command")
def web_play_command(h, data):
    """Un dispositivo que no suena manda una orden (pausa, siguiente...) al que si suena."""
    me = logged_in(h)
    cmd = str(data.get("cmd") or "")
    if cmd not in ("play", "pause", "next", "prev", "seek", "jump", "volume", "load"):
        raise ApiError(0, "Acción no válida")
    with PLAY_LOCK:
        u = PLAY.get(me["username"])
        if not u or not u["active"] or u["active"] not in u["devices"]:
            return {"ok": False}
        item = {"cmd": cmd}
        if cmd == "jump":                                    # salta a una cancion de la cola (posicion en la cola)
            try:
                item["index"] = max(0, int(data.get("index")))
            except (TypeError, ValueError):
                raise ApiError(0, "Acción no válida")
        elif cmd == "volume":
            try:
                item["volume"] = max(0.0, min(1.0, float(data.get("volume"))))
            except (TypeError, ValueError):
                raise ApiError(0, "Acción no válida")
        elif cmd == "load":                                  # pone a sonar otra cosa (cola nueva) en el dispositivo activo
            items = data.get("items")
            if not isinstance(items, list) or not items or len(items) > 800 or not all(isinstance(x, dict) and x.get("id") for x in items):
                raise ApiError(0, "Acción no válida")
            try:
                idx = max(0, min(int(data.get("index") or 0), len(items) - 1))
            except (TypeError, ValueError):
                idx = 0
            item.update(items=items, index=idx)
        if cmd == "seek":
            try:
                item["pos"] = max(0.0, float(data.get("pos") or 0))
            except (TypeError, ValueError):
                item["pos"] = 0.0
        u["cmds"].setdefault(u["active"], []).append(item)
        st = u["state"]
        if st and cmd in ("play", "pause", "seek"):          # que el que mira lo vea al instante, sin esperar al siguiente aviso
            now = time.time()
            st["pos"] = item["pos"] if cmd == "seek" else _play_now_pos(st, now)
            st["at"] = now
            if cmd in ("play", "pause"):
                st["playing"] = cmd == "play"
        return {"ok": True}


@web_route("POST", "set-key")
def web_set_key(h, data):
    """El usuario elige su propia «clave para apps» (p. ej. para no tener que recordar otra). Se guarda en claro: Subsonic lo exige."""
    row = logged_in(h)
    key = str(data.get("key") or "").strip()
    if len(key) < 8 or len(key) > 64 or re.search(r"\s", key):
        raise ApiError(0, "La clave debe tener entre 8 y 64 caracteres y no puede llevar espacios")
    conn = db()
    conn.execute("UPDATE users SET api_key=? WHERE id=?", (key, row["id"]))
    conn.commit()
    return {"apiKey": key}


@web_route("POST", "regen-key")
def web_regen_key(h, data):
    row = logged_in(h)
    key = secrets.token_hex(10)
    conn = db()
    conn.execute("UPDATE users SET api_key=? WHERE id=?", (key, row["id"]))
    conn.commit()
    return {"apiKey": key}


@web_route("GET", "admin/state")
def web_admin_state(h, data):
    admin_only(h)
    conn = db()
    users = [{"username": r["username"], "isAdmin": bool(r["is_admin"]), "created": iso(r["created"]),
              "plays": r["plays"], "email": r["email"]}
             for r in conn.execute(
                 "SELECT u.username, u.is_admin, u.created, u.email, "
                 "(SELECT COUNT(*) FROM plays p WHERE p.user = u.username) AS plays "
                 "FROM users u ORDER BY u.created, u.id")]

    def one(sql):
        return conn.execute(sql).fetchone()[0]
    now = int(time.time())
    start = now - 14 * 86400
    by_day = [0] * 14
    for r in conn.execute("SELECT (ts - ?) / 86400 AS d, COUNT(*) AS n FROM plays WHERE ts >= ? GROUP BY d", (start, start)):
        if 0 <= r["d"] < 14:
            by_day[r["d"]] = r["n"]
    try:
        db_mb = round(os.path.getsize(CFG.db_path) / 1048576.0, 1)
    except OSError:
        db_mb = 0
    return {"musicDir": CFG.music_dir, "musicDirOk": bool(CFG.music_dir) and os.path.isdir(CFG.music_dir),
            "users": users, "signupOpen": get_setting("signup", "closed") == "open",
            "scan": {"scanning": SCAN["scanning"], "count": SCAN["count"], "last": SCAN["last"]},
            "library": {"songs": one("SELECT COUNT(*) FROM songs"), "albums": one("SELECT COUNT(*) FROM albums"),
                        "artists": one("SELECT COUNT(*) FROM artists"), "radios": one("SELECT COUNT(*) FROM radios"),
                        "hours": int(round(one("SELECT COALESCE(SUM(duration),0) FROM songs") / 3600.0))},
            "plays": {"total": one("SELECT COUNT(*) FROM plays"),
                      "last7": one("SELECT COUNT(*) FROM plays WHERE ts >= %d" % (now - 7 * 86400)),
                      "byDay": by_day, "startTs": start},
            "server": {"version": SERVER_VERSION, "uptime": now - SERVER_STARTED, "dbMB": db_mb},
            "loudness": {"enabled": get_setting("loudness_analysis", "on") != "off",
                         "done": one("SELECT COUNT(*) FROM songs WHERE loudness IS NOT NULL"),
                         "total": one("SELECT COUNT(*) FROM songs")}}


@web_route("POST", "admin/signup")
def web_admin_signup(h, data):
    admin_only(h)
    set_setting("signup", "open" if data.get("open") else "closed")
    return {"signupOpen": bool(data.get("open"))}


@web_route("POST", "admin/delete-user")
def web_admin_delete(h, data):
    me = admin_only(h)
    conn = db()
    target = conn.execute("SELECT * FROM users WHERE username=?", (str(data.get("username", "")),)).fetchone()
    if not target:
        raise ApiError(70, "Usuario no encontrado")
    if target["id"] == me["id"]:
        raise ApiError(0, "No puedes borrar tu propia cuenta")
    conn.execute("DELETE FROM sessions WHERE user_id=?", (target["id"],))
    conn.execute("DELETE FROM plays WHERE user=?", (target["username"],))
    conn.execute("DELETE FROM users WHERE id=?", (target["id"],))
    conn.commit()
    return {"ok": True}


@web_route("POST", "admin/set-admin")
def web_admin_set_admin(h, data):
    admin_only(h)
    conn = db()
    target = conn.execute("SELECT * FROM users WHERE username=?", (str(data.get("username", "")),)).fetchone()
    if not target:
        raise ApiError(70, "Usuario no encontrado")
    make = bool(data.get("isAdmin"))
    if not make and target["is_admin"]:
        if conn.execute("SELECT COUNT(*) FROM users WHERE is_admin=1").fetchone()[0] <= 1:
            raise ApiError(0, "Tiene que quedar al menos un administrador")
    conn.execute("UPDATE users SET is_admin=? WHERE id=?", (1 if make else 0, target["id"]))
    conn.commit()
    return {"ok": True}


@web_route("POST", "admin/create-user")
def web_admin_create(h, data):
    admin_only(h)
    create_user(str(data.get("username", "")).strip(), str(data.get("password", "")), admin=0,
                email=data.get("email"))
    return {"ok": True}


@web_route("POST", "admin/music-dir")
def web_admin_music_dir(h, data):
    admin_only(h)
    raw = str(data.get("path") or "").strip()
    if not raw:
        raise ApiError(0, "Escribe la ruta de la carpeta de música")
    path = os.path.abspath(os.path.expanduser(raw))
    if not os.path.isdir(path):
        raise ApiError(0, "Esa carpeta no existe en el servidor")
    if not os.access(path, os.R_OK | os.X_OK):
        raise ApiError(0, "Zinctify no tiene permiso para leer esa carpeta")
    set_setting("music_dir", path)
    CFG.music_dir = path
    if not SCAN["scanning"]:
        threading.Thread(target=scan_library, args=(True,), daemon=True).start()
    return {"ok": True, "musicDir": path}


@web_route("POST", "admin/scan")
def web_admin_scan(h, data):
    admin_only(h)
    if not SCAN["scanning"]:
        threading.Thread(target=scan_library, args=(bool(data.get("full")),), daemon=True).start()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Escaner de metadatos: compara tus canciones con servicios externos y PROPONE correcciones
# ---------------------------------------------------------------------------
# Nunca escribe en tus archivos: las correcciones que aceptes se guardan en la base de datos
# (tabla overrides) y se aplican por encima de los tags. Se envian a estos servicios el titulo y
# el artista de cada cancion (nada mas). SoundCloud no esta: ya no da claves de API a apps nuevas.

PROVIDERS = [
    # id, nombre, segundos minimos entre peticiones, necesita clave
    ("musicbrainz", "MusicBrainz", 1.1, False),
    ("deezer", "Deezer", 0.3, False),
    ("itunes", "Apple Music (iTunes)", 3.0, False),
    ("spotify", "Spotify", 0.3, True),
]
PROVIDER_IDS = [p[0] for p in PROVIDERS]
DEFAULT_PROVIDERS = ["musicbrainz", "deezer"]
META_FIELDS = ("title", "artist", "album")
META_MIN_SCORE = 0.8                 # por debajo de esto no se propone nada
META = {"running": False, "stop": False, "total": 0, "done": 0, "suggested": 0, "errors": {},
        "started": None, "finished": None, "providers": []}
_meta_lock = threading.Lock()
_last_call = {}
_spotify_token = {"value": None, "exp": 0}


class MetaError(Exception):
    pass


def http_json(url, headers=None, data=None, timeout=15):
    hdrs = {"User-Agent": "Zinctify/%s (self-hosted music server)" % SERVER_VERSION, "Accept": "application/json"}
    hdrs.update(headers or {})
    try:
        with urlopen(Request(url, data=data, headers=hdrs), timeout=timeout) as resp:
            return json.loads(resp.read(2 << 20).decode("utf-8", "replace"))
    except Exception as e:                                   # red caida, 429, JSON raro...
        raise MetaError("%s: %s" % (urlparse(url).netloc, str(e)[:120]))


def _wait(provider, interval):
    gap = time.time() - _last_call.get(provider, 0)
    if gap < interval:
        time.sleep(interval - gap)
    _last_call[provider] = time.time()


def _lucene(text):
    return text.replace("\\", " ").replace('"', " ")


def search_musicbrainz(title, artist):
    q = 'recording:"%s"' % _lucene(title) + (' AND artist:"%s"' % _lucene(artist) if artist else "")
    d = http_json("https://musicbrainz.org/ws/2/recording/?" + urlencode({"query": q, "fmt": "json", "limit": 5}))
    out = []
    for r in d.get("recordings", []):
        credit = "".join((c.get("name") or "") + (c.get("joinphrase") or "") for c in r.get("artist-credit", []))
        rel = (r.get("releases") or [{}])[0].get("title") or ""
        out.append({"title": r.get("title") or "", "artist": credit, "album": rel})
    return out


def search_deezer(title, artist):
    q = 'track:"%s"' % _lucene(title) + (' artist:"%s"' % _lucene(artist) if artist else "")
    d = http_json("https://api.deezer.com/search?" + urlencode({"q": q, "limit": 5}))
    return [{"title": r.get("title") or "", "artist": (r.get("artist") or {}).get("name") or "",
             "album": (r.get("album") or {}).get("title") or ""} for r in d.get("data", [])]


def search_itunes(title, artist):
    d = http_json("https://itunes.apple.com/search?" + urlencode(
        {"term": (artist + " " + title).strip(), "entity": "song", "limit": 5}))
    return [{"title": r.get("trackName") or "", "artist": r.get("artistName") or "",
             "album": r.get("collectionName") or ""} for r in d.get("results", [])]


def search_spotify(title, artist):
    if time.time() > _spotify_token["exp"] - 30:
        cid, secret = get_setting("spotify_id", ""), get_setting("spotify_secret", "")
        if not cid or not secret:
            raise MetaError("Spotify: faltan el Client ID y el Client Secret")
        auth = base64.b64encode(("%s:%s" % (cid, secret)).encode()).decode()
        tok = http_json("https://accounts.spotify.com/api/token", data=b"grant_type=client_credentials",
                        headers={"Authorization": "Basic " + auth, "Content-Type": "application/x-www-form-urlencoded"})
        _spotify_token.update(value=tok.get("access_token"), exp=time.time() + int(tok.get("expires_in", 3600)))
    q = 'track:"%s"' % _lucene(title) + (' artist:"%s"' % _lucene(artist) if artist else "")
    d = http_json("https://api.spotify.com/v1/search?" + urlencode({"q": q, "type": "track", "limit": 5}),
                  headers={"Authorization": "Bearer " + str(_spotify_token["value"])})
    return [{"title": r.get("name") or "", "artist": ", ".join(a.get("name") or "" for a in r.get("artists", [])),
             "album": (r.get("album") or {}).get("name") or ""} for r in (d.get("tracks") or {}).get("items", [])]


SEARCHERS = {"musicbrainz": search_musicbrainz, "deezer": search_deezer, "itunes": search_itunes,
             "spotify": search_spotify}

_EXTRAS = re.compile(r"\s*[\(\[][^\)\]]*[\)\]]|\s+-\s+.*$")


def core_title(t):
    """'Halo (Remastered)' -> 'Halo'."""
    return clean_text(_EXTRAS.sub("", t)) or clean_text(t)


def extras(t):
    return norm_key(" ".join(re.findall(r"[\(\[][^\)\]]*[\)\]]|\s-\s.*$", t)))


def sim(a, b):
    ka, kb = norm_key(a), norm_key(b)
    if not ka or not kb:
        return 0.0
    return difflib.SequenceMatcher(None, ka, kb).ratio()


def text_fix(current, cand):
    """Para titulo/album: propone el texto del servicio solo si es 'lo mismo escrito mejor'
    (otra tilde, otra mayuscula, un caracter raro...), no si anade '(Remastered)' o es otra cosa."""
    cand = clean_text(cand)
    if not cand or cand == current:
        return None
    if sim(core_title(cand), core_title(current)) >= 0.85 and extras(cand) == extras(current):
        return cand
    return None


def artist_fix(current, cand):
    """Para el artista: sustituye nombre a nombre y conserva los separadores que ya tenias."""
    cur_names, cand_names = split_artists(current), split_artists(cand)
    out = current
    changed = False
    for cn in cur_names:
        best = max(cand_names, key=lambda x: sim(cn, x), default=None)
        if best and best != cn and sim(cn, best) >= 0.85:
            out = out.replace(cn, best)
            changed = True
    return out if changed and out != current else None


def meta_enabled():
    raw = get_setting("meta_providers")
    chosen = [x for x in (DEFAULT_PROVIDERS if raw is None else raw.split(",")) if x in PROVIDER_IDS]
    configured = bool(get_setting("spotify_id")) and bool(get_setting("spotify_secret"))
    return [x for x in chosen if x != "spotify" or configured]


def evaluate(song, candidates):
    """Devuelve ([(campo, actual, propuesta)], puntuacion) para el mejor candidato, o ([], 0)."""
    cur_names = split_artists(song["artist"]) or [song["artist"]]
    best, best_score = None, 0.0
    for c in candidates:
        t_sim = sim(core_title(c["title"]), core_title(song["title"]))
        a_sim = max((sim(a, b) for a in cur_names for b in split_artists(c["artist"])), default=0.0)
        if t_sim < 0.85 or a_sim < 0.75:
            continue
        score = 0.6 * t_sim + 0.4 * a_sim
        if score > best_score:
            best, best_score = c, score
    if not best or best_score < META_MIN_SCORE:
        return [], 0.0
    found = []
    for field, cur, new in (("title", song["title"], text_fix(song["title"], best["title"])),
                            ("artist", song["artist"], artist_fix(song["artist"], best["artist"])),
                            ("album", song["album"], text_fix(song["album"], best["album"]))):
        if new:
            found.append((field, cur, new))
    return found, best_score


def meta_save(conn, song_id, provider, field, cur, new, score):
    row = conn.execute("SELECT id, providers, score, status FROM suggestions WHERE song_id=? AND field=? AND suggested=?",
                       (song_id, field, new)).fetchone()
    if row:
        provs = row["providers"].split(",")
        if provider not in provs and row["status"] == "pending":
            conn.execute("UPDATE suggestions SET providers=?, score=? WHERE id=?",
                         (",".join(provs + [provider]), min(1.0, max(row["score"], score) + 0.05), row["id"]))
        return False
    conn.execute("INSERT INTO suggestions(song_id, field, current, suggested, score, providers, created) "
                 "VALUES(?,?,?,?,?,?,?)", (song_id, field, cur, new, round(score, 3), provider, int(time.time())))
    return True


def auto_meta(paths):
    """Archivos nuevos: se les pasa el escaner de metadatos solos (las propuestas quedan pendientes de revisar)."""
    if len(paths) > 500:
        log("%d archivos nuevos: demasiados para el escaneo automatico; lanza el escaner de metadatos a mano." % len(paths))
        return
    for _ in range(360):                                     # espera (hasta 1 h) si ya hay una pasada en marcha
        if not META["running"]:
            break
        time.sleep(10)
    providers = meta_enabled()
    if providers:
        log("Escaneo de metadatos automatico de %d archivo(s) nuevo(s)." % len(paths))
        meta_run(providers, len(paths), False, only_paths=paths)


def meta_run(providers, limit, recheck, only_paths=None):
    if not _meta_lock.acquire(blocking=False):
        return
    META.update(running=True, stop=False, total=0, done=0, suggested=0, errors={}, started=int(time.time()),
                finished=None, providers=list(providers))
    conn = sqlite3.connect(CFG.db_path, timeout=60)
    conn.row_factory = sqlite3.Row
    fails = {p: 0 for p in providers}
    interval = {p[0]: p[2] for p in PROVIDERS}
    try:
        base = ("SELECT s.id, s.title, COALESCE(s.artist_display, ar.name) AS artist, al.name AS album "
                "FROM songs s JOIN albums al ON al.id = s.album_id JOIN artists ar ON ar.id = s.artist_id ")
        if only_paths:
            rows = conn.execute(base + "WHERE s.path IN (%s) ORDER BY s.id" % ",".join("?" * len(only_paths)),
                                list(only_paths)).fetchall()
        else:
            rows = conn.execute(base + ("" if recheck else "WHERE s.id NOT IN (SELECT song_id FROM meta_checked) ") +
                                "ORDER BY s.id LIMIT ?", (limit,)).fetchall()
        META["total"] = len(rows)
        for song in rows:
            if META["stop"]:
                break
            query_artist = (split_artists(song["artist"]) or [""])[0]
            query_title = core_title(song["title"])
            answered = False
            for prov in providers:
                if fails[prov] >= 5 or META["stop"]:
                    continue
                try:
                    _wait(prov, interval[prov])
                    cands = SEARCHERS[prov](query_title, query_artist)
                    fails[prov] = 0
                    answered = True
                except MetaError as e:
                    fails[prov] += 1
                    META["errors"][prov] = str(e)
                    if fails[prov] >= 5:
                        META["errors"][prov] += " (desactivado en esta pasada tras 5 fallos seguidos)"
                    continue
                found, score = evaluate(song, cands)
                for field, cur, new in found:
                    if meta_save(conn, song["id"], prov, field, cur, new, score):
                        META["suggested"] += 1
            if answered:
                conn.execute("INSERT OR REPLACE INTO meta_checked(song_id, ts) VALUES(?,?)", (song["id"], int(time.time())))
            conn.commit()
            META["done"] += 1
            if all(f >= 5 for f in fails.values()):
                break                                   # ningun servicio responde: no sigas
    except Exception:
        log("Error en el escaner de metadatos:\n%s" % traceback.format_exc())
        META["errors"]["interno"] = "error inesperado (mira la consola del servidor)"
    finally:
        conn.commit()
        conn.close()
        META.update(running=False, finished=int(time.time()))
        _meta_lock.release()


def meta_counts(conn):
    def one(sql):
        return conn.execute(sql).fetchone()[0]
    return {"pending": one("SELECT COUNT(*) FROM suggestions WHERE status='pending'"),
            "accepted": one("SELECT COUNT(*) FROM suggestions WHERE status='accepted'"),
            "rejected": one("SELECT COUNT(*) FROM suggestions WHERE status='rejected'"),
            "checked": one("SELECT COUNT(*) FROM meta_checked"), "songs": one("SELECT COUNT(*) FROM songs"),
            "overrides": one("SELECT COUNT(*) FROM overrides")}


@web_route("GET", "admin/meta")
def web_meta_state(h, data):
    admin_only(h)
    enabled = set(meta_enabled())
    chosen = get_setting("meta_providers")
    chosen = set(DEFAULT_PROVIDERS) if chosen is None else set(chosen.split(","))
    configured = bool(get_setting("spotify_id")) and bool(get_setting("spotify_secret"))
    return {"providers": [{"id": pid, "name": name, "needsKey": key, "selected": pid in chosen,
                           "ready": pid in enabled or (not key)} for pid, name, _i, key in PROVIDERS],
            "spotifyId": get_setting("spotify_id", ""), "spotifySecretSet": bool(get_setting("spotify_secret")),
            "spotifyReady": configured, "auto": get_setting("meta_auto", "on") != "off", "lyricsOnline": lyrics_online_enabled(), "job": dict(META), "counts": meta_counts(db())}


@web_route("POST", "admin/meta/config")
def web_meta_config(h, data):
    admin_only(h)
    chosen = [x for x in data.get("providers", []) if x in PROVIDER_IDS]
    set_setting("meta_providers", ",".join(chosen))
    if "spotifyId" in data:
        set_setting("spotify_id", str(data.get("spotifyId") or "").strip()[:100])
    secret = str(data.get("spotifySecret") or "").strip()[:100]
    if secret:
        set_setting("spotify_secret", secret)
        _spotify_token["exp"] = 0
    if "lyricsOnline" in data:
        set_setting("lyrics_online", "on" if data.get("lyricsOnline") else "off")
    if "auto" in data:
        set_setting("meta_auto", "on" if data.get("auto") else "off")
    if data.get("clearSpotify"):
        set_setting("spotify_id", "")
        set_setting("spotify_secret", "")
    return {"ok": True}


@web_route("POST", "admin/meta/run")
def web_meta_run(h, data):
    admin_only(h)
    providers = meta_enabled()
    if not providers:
        raise ApiError(0, "Elige al menos un servicio de metadatos")
    if META["running"]:
        raise ApiError(0, "Ya hay un escaneo de metadatos en marcha")
    try:
        limit = max(1, min(int(data.get("limit", 200)), 20000))
    except (TypeError, ValueError):
        limit = 200
    threading.Thread(target=meta_run, args=(providers, limit, bool(data.get("recheck"))), daemon=True).start()
    return {"ok": True}


@web_route("POST", "admin/meta/stop")
def web_meta_stop(h, data):
    admin_only(h)
    META["stop"] = True
    return {"ok": True}


@web_route("POST", "admin/meta/list")
def web_meta_list(h, data):
    admin_only(h)
    status = data.get("status") if data.get("status") in ("pending", "accepted", "rejected") else "pending"
    try:
        offset = max(0, int(data.get("offset", 0)))
    except (TypeError, ValueError):
        offset = 0
    conn = db()
    rows = conn.execute(
        "SELECT g.id, g.song_id, g.field, g.current, g.suggested, g.score, g.providers, g.status, s.path, "
        "s.title AS song_title, COALESCE(s.artist_display, ar.name) AS song_artist "
        "FROM suggestions g JOIN songs s ON s.id = g.song_id JOIN artists ar ON ar.id = s.artist_id "
        "WHERE g.status=? ORDER BY g.score DESC, g.song_id, g.field LIMIT 50 OFFSET ?", (status, offset)).fetchall()
    total = conn.execute("SELECT COUNT(*) FROM suggestions WHERE status=?", (status,)).fetchone()[0]
    return {"total": total, "items": [
        {"id": r["id"], "songId": r["song_id"], "field": r["field"], "current": r["current"], "suggested": r["suggested"],
         "score": r["score"], "providers": r["providers"].split(","), "status": r["status"],
         "file": os.path.relpath(r["path"], CFG.music_dir), "song": r["song_title"], "artist": r["song_artist"]}
        for r in rows]}


def apply_suggestions(conn, ids):
    """Acepta propuestas: guarda la correccion (overrides) y vuelve a leer esos archivos."""
    paths = set()
    for sid in ids:
        r = conn.execute("SELECT g.field, g.suggested, g.status, s.path FROM suggestions g "
                         "JOIN songs s ON s.id = g.song_id WHERE g.id=?", (sid,)).fetchone()
        if not r or r["status"] != "pending" or r["field"] not in META_FIELDS:
            continue
        conn.execute("INSERT OR IGNORE INTO overrides(path) VALUES(?)", (r["path"],))
        conn.execute("UPDATE overrides SET %s=? WHERE path=?" % r["field"], (r["suggested"], r["path"]))
        conn.execute("UPDATE suggestions SET status='accepted' WHERE id=?", (sid,))
        paths.add(r["path"])
    conn.commit()
    for path in paths:
        try:
            reindex_path(path)
        except OSError:
            log("No se pudo releer %s" % path)
    return len(paths)


@web_route("POST", "admin/meta/decide")
def web_meta_decide(h, data):
    admin_only(h)
    conn = db()
    action = data.get("action")
    if action not in ("accept", "reject", "reopen"):
        raise ApiError(0, "Accion no valida")
    if data.get("minScore") is not None:                       # "todas las de confianza alta"
        try:
            floor = float(data["minScore"])
        except (TypeError, ValueError):
            floor = 0.95
        ids = [r[0] for r in conn.execute("SELECT id FROM suggestions WHERE status='pending' AND score>=? "
                                          "ORDER BY score DESC LIMIT 500", (floor,))]
    else:
        ids = [int(x) for x in data.get("ids", []) if str(x).isdigit()][:500]
    if action == "accept":
        n = apply_suggestions(conn, ids)
    else:
        status = "rejected" if action == "reject" else "pending"
        conn.executemany("UPDATE suggestions SET status=? WHERE id=?", [(status, i) for i in ids])
        conn.commit()
        n = len(ids)
    return {"ok": True, "changed": n}


@web_route("POST", "admin/meta/overrides")
def web_meta_overrides(h, data):
    admin_only(h)
    rows = db().execute("SELECT * FROM overrides ORDER BY path LIMIT 200").fetchall()
    return {"items": [{"file": os.path.relpath(r["path"], CFG.music_dir), "title": r["title"], "artist": r["artist"],
                       "album": r["album"]} for r in rows]}


@web_route("POST", "admin/meta/undo")
def web_meta_undo(h, data):
    admin_only(h)
    conn = db()
    path = os.path.join(CFG.music_dir, str(data.get("file", "")))
    row = conn.execute("SELECT path FROM overrides WHERE path=?", (path,)).fetchone()
    if not row:
        raise ApiError(70, "Ruta no encontrada")
    conn.execute("DELETE FROM overrides WHERE path=?", (path,))
    conn.execute("UPDATE suggestions SET status='rejected' WHERE status='accepted' AND song_id IN "
                 "(SELECT id FROM songs WHERE path=?)", (path,))
    conn.commit()
    try:
        reindex_path(path)
    except OSError:
        pass
    return {"ok": True}


# ---------------------------------------------------------------------------
# Perfil, imagenes, playlists, biblioteca y preferencias
# ---------------------------------------------------------------------------

EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s.]{2,}$")
PREF_DEFAULTS = {"quality": "original", "normalize": False, "normTarget": -14, "libraryView": "grid",
                 "showFollowers": True, "showFollowing": True, "showListening": True, "animLevel": 50, "crossfade": 0, "chatSound": True}
QUALITY_KBPS = {"high": 320, "normal": 160, "low": 96}


def clean_email(value, required):
    email = str(value or "").strip()
    if not email:
        if required:
            raise ApiError(0, "Escribe un correo electrónico válido")
        return None
    if len(email) > 254 or not EMAIL_RE.match(email):
        raise ApiError(0, "Escribe un correo electrónico válido")
    return email


def get_prefs(row):
    prefs = dict(PREF_DEFAULTS)
    try:
        saved = json.loads(row["prefs"] or "{}")
        if isinstance(saved, dict):
            prefs.update({k: v for k, v in saved.items() if k in PREF_DEFAULTS})
    except (ValueError, KeyError, TypeError):
        pass
    return prefs


def user_by_id(uid):
    return db().execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()



# ---------------------------------------------------------------------------
# Canciones duplicadas
# ---------------------------------------------------------------------------

DUP_DURATION_TOLERANCE = 3          # segundos de diferencia para considerar que es la misma grabacion


def dup_confidence(c):
    """0-1: lo seguro que es que sean la misma grabacion (mismo titulo y artista ya se da por hecho)."""
    durs = [x["duration"] or 0 for x in c]
    spread = max(durs) - min(durs)
    score = 0.75 + (0.15 if spread <= 1 else 0.10 if spread <= 2 else 0.05)
    if len({x["album"] for x in c}) == 1:
        score += 0.05
    if len({x["size"] for x in c}) == 1:
        score += 0.05                                   # mismo tamano: casi seguro una copia exacta
    return round(min(score, 1.0), 2)


def find_duplicates():
    """Misma cancion = mismo titulo y mismo artista (ya normalizados: sin tildes ni mayusculas) y duracion casi igual."""
    conn = db()
    rows = conn.execute(
        "SELECT s.id, s.path, s.title, s.nkey, s.artist_id, s.duration, s.bitrate, s.size, s.suffix, s.mtime, "
        "al.name AS album, COALESCE(s.artist_display, ar.name) AS artist, "
        "(SELECT COUNT(*) FROM plays p WHERE p.song_id = s.id) AS plays "
        "FROM songs s JOIN albums al ON al.id = s.album_id JOIN artists ar ON ar.id = s.artist_id").fetchall()
    dismissed = {r[0] for r in conn.execute("SELECT key FROM dup_dismissed")}
    buckets = {}
    for r in rows:
        buckets.setdefault((r["nkey"], r["artist_id"]), []).append(r)
    groups = []
    for (_nk, _ar), items in buckets.items():
        if len(items) < 2:
            continue
        items.sort(key=lambda r: r["duration"] or 0)
        cluster = [items[0]]
        clusters = []
        for r in items[1:]:
            if abs((r["duration"] or 0) - (cluster[-1]["duration"] or 0)) <= DUP_DURATION_TOLERANCE:
                cluster.append(r)
            else:
                clusters.append(cluster)
                cluster = [r]
        clusters.append(cluster)
        for c in clusters:
            if len(c) < 2:
                continue
            key = hashlib.sha1("|".join(sorted(str(x["id"]) for x in c)).encode()).hexdigest()[:16]
            if key in dismissed:
                continue
            lossless = {"flac", "wav", "alac", "aiff", "ape", "wv"}
            best = max(c, key=lambda r: ((r["suffix"] or "").lower() in lossless, r["bitrate"] or 0, r["size"] or 0))
            groups.append({"key": key, "recommended": best["id"], "confidence": dup_confidence(c), "songs": [
                {"id": r["id"], "title": r["title"], "artist": r["artist"], "album": r["album"],
                 "file": os.path.relpath(r["path"], CFG.music_dir), "size": r["size"], "bitrate": r["bitrate"],
                 "suffix": r["suffix"], "duration": r["duration"], "plays": r["plays"]}
                for r in sorted(c, key=lambda r: r["id"])]})
    groups.sort(key=lambda g: (g["songs"][0]["artist"].casefold(), g["songs"][0]["title"].casefold()))
    return groups


@web_route("POST", "admin/dups")
def web_dups(h, data):
    admin_only(h)
    groups = find_duplicates()
    return {"groups": groups, "total": len(groups)}


def resolve_dup(conn, keep, remove, mode):
    """Deja 'keep' y quita el resto: mode 'trash' mueve el archivo a la papelera de duplicadas; 'hide' solo lo oculta."""
    trash = os.path.join(CFG.data_dir, "duplicadas-eliminadas")
    done = 0
    for sid in remove:
        row = conn.execute("SELECT id, path FROM songs WHERE id=?", (sid,)).fetchone()
        if not row:
            continue
        path = row["path"]
        if mode == "trash":
            if os.path.exists(path):
                os.makedirs(trash, exist_ok=True)
                dest = os.path.join(trash, "%d-%s" % (sid, os.path.basename(path)))
                try:
                    shutil.move(path, dest)
                except OSError:
                    raise ApiError(0, "No se pudo mover el archivo (¿la carpeta de música es de solo lectura?). Usa «Ocultar».")
        else:
            conn.execute("INSERT OR REPLACE INTO ignored_paths(path, ts) VALUES(?,?)", (path, int(time.time())))
        # lo que apuntaba a la eliminada pasa a apuntar a la que te quedas
        conn.execute("DELETE FROM playlist_songs WHERE song_id=? AND playlist_id IN "
                     "(SELECT playlist_id FROM playlist_songs WHERE song_id=?)", (sid, keep))
        conn.execute("UPDATE playlist_songs SET song_id=? WHERE song_id=?", (keep, sid))
        conn.execute("UPDATE plays SET song_id=? WHERE song_id=?", (keep, sid))
        conn.execute("DELETE FROM songs WHERE id=?", (sid,))
        conn.execute("DELETE FROM overrides WHERE path=?", (path,))
        conn.execute("DELETE FROM meta_checked WHERE song_id=?", (sid,))
        conn.execute("DELETE FROM suggestions WHERE song_id=?", (sid,))
        done += 1
    return done


@web_route("POST", "admin/dups/resolve")
def web_dups_resolve(h, data):
    """keep: id de la que te quedas. remove: las demas. mode: 'trash' u 'hide'."""
    admin_only(h)
    conn = db()
    try:
        keep = int(data.get("keep"))
        remove = [int(x) for x in data.get("remove") or []]
    except (TypeError, ValueError):
        raise ApiError(0, "Datos no válidos")
    mode = "hide" if data.get("mode") == "hide" else "trash"
    remove = [x for x in remove if x != keep]
    if not remove or not conn.execute("SELECT 1 FROM songs WHERE id=?", (keep,)).fetchone():
        raise ApiError(70, "Canción no encontrada")
    done = resolve_dup(conn, keep, remove, mode)
    cleanup_orphans(conn)
    conn.commit()
    LIB_EPOCH[0] += 1
    return {"removed": done, "mode": mode}


@web_route("POST", "admin/dups/resolve-all")
def web_dups_resolve_all(h, data):
    """Todos los grupos con confianza >= minimo (95 % por defecto): te quedas con la recomendada y quitas/ocultas el resto."""
    admin_only(h)
    try:
        minimum = max(0.5, min(1.0, float(data.get("min", 0.95))))
    except (TypeError, ValueError):
        minimum = 0.95
    mode = "hide" if data.get("mode") == "hide" else "trash"
    conn = db()
    groups = groups_done = removed = 0
    errors = 0
    for g in find_duplicates():
        if g["confidence"] < minimum:
            continue
        groups += 1
        try:
            removed += resolve_dup(conn, g["recommended"], [s["id"] for s in g["songs"] if s["id"] != g["recommended"]], mode)
            groups_done += 1
        except ApiError:
            errors += 1
        conn.commit()
    cleanup_orphans(conn)
    conn.commit()
    LIB_EPOCH[0] += 1
    return {"groups": groups_done, "removed": removed, "errors": errors, "mode": mode}


@web_route("POST", "admin/dups/dismiss")
def web_dups_dismiss(h, data):
    admin_only(h)
    key = str(data.get("key") or "")[:32]
    if key:
        conn = db()
        conn.execute("INSERT OR IGNORE INTO dup_dismissed(key) VALUES(?)", (key,))
        conn.commit()
    return {"ok": True}


@web_route("POST", "admin/dups/ignored")
def web_dups_ignored(h, data):
    """Lista de archivos ocultos y, si se pide, vuelve a mostrar uno (restore)."""
    admin_only(h)
    conn = db()
    if data.get("restore"):
        conn.execute("DELETE FROM ignored_paths WHERE path=?", (os.path.join(CFG.music_dir, str(data["restore"])),))
        conn.commit()
        if not SCAN["scanning"]:
            threading.Thread(target=scan_library, daemon=True).start()
    return {"items": [os.path.relpath(r[0], CFG.music_dir) for r in conn.execute("SELECT path FROM ignored_paths ORDER BY ts DESC")]}



# ---------------------------------------------------------------------------
# Papelera
# ---------------------------------------------------------------------------

TRASH_KINDS = {"song": ("so", "songs"), "album": ("al", "albums"), "artist": ("ar", "artists")}


def trash_target(kind, raw_id):
    if kind not in TRASH_KINDS:
        raise ApiError(0, "Datos no válidos")
    prefix, table = TRASH_KINDS[kind]
    iid = parse_id(str(raw_id), prefix)
    if not db().execute("SELECT 1 FROM %s WHERE id=?" % table, (iid,)).fetchone():
        raise ApiError(70, "ID no válido o no encontrado: %s" % raw_id)
    return iid


@web_route("POST", "trash")
def web_trash(h, data):
    """Lo que tienes en la papelera: ids (para saltarlo al reproducir) y la lista con nombres."""
    me = logged_in(h)
    conn = db()
    ids = {"song": [], "album": [], "artist": []}
    items = []
    for r in conn.execute("SELECT kind, item_id, ts FROM trash WHERE user_id=? ORDER BY ts DESC", (me["id"],)):
        prefix, _t = TRASH_KINDS[r["kind"]]
        sid = "%s-%d" % (prefix, r["item_id"])
        ids[r["kind"]].append(sid)
        if r["kind"] == "song":
            x = conn.execute("SELECT s.title AS name, COALESCE(s.artist_display, ar.name) AS sub FROM songs s "
                             "JOIN artists ar ON ar.id = s.artist_id WHERE s.id=?", (r["item_id"],)).fetchone()
        elif r["kind"] == "album":
            x = conn.execute("SELECT al.name AS name, ar.name AS sub FROM albums al JOIN artists ar ON ar.id = al.artist_id "
                             "WHERE al.id=?", (r["item_id"],)).fetchone()
        else:
            x = conn.execute("SELECT name, '' AS sub FROM artists WHERE id=?", (r["item_id"],)).fetchone()
        if x:
            items.append({"kind": r["kind"], "id": sid, "name": x["name"], "sub": x["sub"], "coverArt": sid if r["kind"] != "song" else None, "ts": r["ts"]})
    return {"ids": ids, "items": items}


@web_route("POST", "trash/add")
def web_trash_add(h, data):
    me = logged_in(h)
    kind = str(data.get("kind", ""))
    iid = trash_target(kind, data.get("id"))
    conn = db()
    conn.execute("INSERT OR IGNORE INTO trash(user_id, kind, item_id, ts) VALUES(?,?,?,?)", (me["id"], kind, iid, int(time.time())))
    conn.commit()
    return {"ok": True}


@web_route("POST", "trash/remove")
def web_trash_remove(h, data):
    """Restaura uno (kind + id) o todo (all=true)."""
    me = logged_in(h)
    conn = db()
    if data.get("all"):
        conn.execute("DELETE FROM trash WHERE user_id=?", (me["id"],))
    else:
        kind = str(data.get("kind", ""))
        iid = trash_target(kind, data.get("id"))
        conn.execute("DELETE FROM trash WHERE user_id=? AND kind=? AND item_id=?", (me["id"], kind, iid))
    conn.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Perfil de artista: foto, biografia y canciones populares
# ---------------------------------------------------------------------------

def artist_photo_base(aid):
    return os.path.join(image_dir(), "artist-%d" % aid)


def http_bytes(url, limit=12 << 20, timeout=20):
    try:
        with urlopen(Request(url, headers={"User-Agent": "Zinctify/%s (self-hosted music server)" % SERVER_VERSION}), timeout=timeout) as resp:
            data = resp.read(limit + 1)
    except Exception as e:
        raise MetaError("%s: %s" % (urlparse(url).netloc, str(e)[:120]))
    if len(data) > limit:
        raise MetaError("Imagen demasiado grande")
    return data


def artist_row(raw_id):
    aid = parse_id(str(raw_id), "ar")
    ar = db().execute("SELECT id, name FROM artists WHERE id=?", (aid,)).fetchone()
    if not ar:
        raise ApiError(70, "Artista no encontrado")
    return ar


@web_route("POST", "artist/page")
def web_artist_page(h, data):
    me = logged_in(h)
    ar = artist_row(data.get("id"))
    conn = db()
    info = conn.execute("SELECT bio, photo FROM artist_info WHERE artist_id=?", (ar["id"],)).fetchone()
    # populares: las mas escuchadas (entre todos los usuarios); si aun no hay reproducciones, las primeras
    rows = conn.execute(
        SONG_SELECT + " WHERE s.id IN (SELECT song_id FROM song_artists WHERE artist_id=?) "
        "ORDER BY (SELECT COUNT(*) FROM plays p WHERE p.song_id = s.id) DESC, s.nkey LIMIT 10", (ar["id"],)).fetchall()
    stats = conn.execute(
        "SELECT (SELECT COUNT(*) FROM song_artists WHERE artist_id=?) AS songs, "
        "(SELECT COUNT(*) FROM plays p WHERE p.song_id IN (SELECT song_id FROM song_artists WHERE artist_id=?)) AS plays, "
        "(SELECT COUNT(DISTINCT user) FROM plays p WHERE p.song_id IN (SELECT song_id FROM song_artists WHERE artist_id=?)) AS listeners",
        (ar["id"],) * 3).fetchone()
    every = conn.execute(SONG_SELECT + " WHERE s.id IN (SELECT song_id FROM song_artists WHERE artist_id=?) "
                         "ORDER BY al.year, al.nkey, COALESCE(s.disc,1), COALESCE(s.track,0), s.nkey LIMIT 500", (ar["id"],)).fetchall()
    return {"id": "ar-%d" % ar["id"], "name": ar["name"], "bio": (info["bio"] if info else "") or "",
            "photo": (info["photo"] if info else 0) or 0, "popular": song_list(rows), "songs": song_list(every),
            "songCount": stats["songs"], "plays": stats["plays"], "listeners": stats["listeners"]}


@web_route("POST", "artist/update")
def web_artist_update(h, data):
    admin_only(h)
    ar = artist_row(data.get("id"))
    bio = str(data.get("bio") or "").strip()[:4000]
    conn = db()
    conn.execute("INSERT INTO artist_info(artist_id, bio, source) VALUES(?,?,'manual') "
                 "ON CONFLICT(artist_id) DO UPDATE SET bio=excluded.bio, source='manual'", (ar["id"], bio))
    if data.get("removePhoto"):
        remove_image(artist_photo_base(ar["id"]))
        conn.execute("UPDATE artist_info SET photo=0 WHERE artist_id=?", (ar["id"],))
    conn.commit()
    return {"ok": True}


@web_route("POST", "upload/artist-photo")
def web_upload_artist_photo(h, data):
    admin_only(h)
    ar = artist_row(data.get("id"))
    write_square_image(check_image(data.get("raw")), artist_photo_base(ar["id"]), 640)
    conn = db()
    conn.execute("INSERT INTO artist_info(artist_id, photo) VALUES(?,?) ON CONFLICT(artist_id) DO UPDATE SET photo=excluded.photo",
                 (ar["id"], int(time.time())))
    conn.commit()
    return {"ok": True, "photo": int(time.time())}


def wiki_summary(name, lang):
    base = "https://%s.wikipedia.org/api/rest_v1/page/summary/" % lang
    for title in (name + " (musician)", name + " (band)", name + " (cantante)", name + " (grupo musical)", name):
        try:
            d = http_json(base + quote(title.replace(" ", "_")))
        except MetaError:
            continue
        if d.get("type") == "standard" and d.get("extract") and re.search(
                r"music|singer|band|rapper|compos|cantan|grupo|músic|dj|produc", (d.get("description", "") + " " + d["extract"]).lower()):
            return d["extract"]
    return ""


@web_route("POST", "artist/autofill")
def web_artist_autofill(h, data):
    """Busca la foto (Deezer) y una biografia (Wikipedia) de este artista. Necesita internet en el servidor."""
    admin_only(h)
    ar = artist_row(data.get("id"))
    lang = "es" if str(data.get("lang") or "es").startswith("es") else "en"
    got = {"photo": False, "bio": False}
    conn = db()
    info = conn.execute("SELECT bio, photo FROM artist_info WHERE artist_id=?", (ar["id"],)).fetchone()
    errors = []
    if not (info and info["photo"]) or data.get("force"):
        try:
            d = http_json("https://api.deezer.com/search/artist?" + urlencode({"q": ar["name"], "limit": 5}))
            cands = [x for x in d.get("data", []) if fuzz_key(x.get("name", "")) == fuzz_key(ar["name"])]
            pic = (cands[0] if cands else {}).get("picture_xl") or ""
            if pic and "/images/artist//" not in pic:
                write_square_image(check_image(http_bytes(pic)), artist_photo_base(ar["id"]), 640)
                conn.execute("INSERT INTO artist_info(artist_id, photo, source) VALUES(?,?,'deezer') "
                             "ON CONFLICT(artist_id) DO UPDATE SET photo=excluded.photo", (ar["id"], int(time.time())))
                got["photo"] = True
        except (MetaError, ApiError) as e:
            errors.append(str(getattr(e, "message", e)))
    if not (info and info["bio"]) or data.get("force"):
        try:
            text = wiki_summary(ar["name"], lang) or (wiki_summary(ar["name"], "en") if lang != "en" else "")
            if text:
                conn.execute("INSERT INTO artist_info(artist_id, bio, source) VALUES(?,?,'wikipedia') "
                             "ON CONFLICT(artist_id) DO UPDATE SET bio=excluded.bio, source='wikipedia'", (ar["id"], text[:4000]))
                got["bio"] = True
        except MetaError as e:
            errors.append(str(e))
    conn.commit()
    LIB_EPOCH[0] += 0
    return {"found": got, "errors": errors[:2]}


# ---------------------------------------------------------------------------
# Letras (sincronizadas si se puede)
# ---------------------------------------------------------------------------

LRC_TIME = re.compile(r"\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]")


def parse_lrc(text):
    """LRC -> [{"t": segundos, "text": ...}] ordenado. Admite varias marcas por linea y [offset:ms]."""
    out, offset = [], 0.0
    for raw in (text or "").replace("\r", "").split("\n"):
        m = re.match(r"\s*\[offset:\s*([-+]?\d+)\]", raw, re.I)
        if m:
            offset = int(m.group(1)) / 1000.0
            continue
        stamps = list(LRC_TIME.finditer(raw))
        if not stamps:
            continue
        line = re.sub(r"<\d+:\d+(?:[.:]\d+)?>", "", LRC_TIME.sub("", raw)).strip()      # quita marcas y tiempos por palabra
        for st in stamps:
            frac = st.group(3) or "0"
            t = int(st.group(1)) * 60 + int(st.group(2)) + int(frac) / (10 ** len(frac)) + offset
            out.append({"t": round(max(0.0, t), 2), "text": line})
    out.sort(key=lambda x: x["t"])
    return out


def embedded_lyrics(path):
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format_tags", "-of", "json", path],
                           capture_output=True, timeout=20)
        tags = {k.lower(): v for k, v in (json.loads(r.stdout or b"{}").get("format", {}).get("tags") or {}).items()}
    except Exception:
        return ""
    for k in ("lyrics", "unsyncedlyrics", "uslt", "lyrics-eng", "syncedlyrics"):
        if tags.get(k):
            return tags[k]
    for k, v in tags.items():
        if k.startswith("lyrics") and v:
            return v
    return ""


def lyrics_online_enabled():
    return get_setting("lyrics_online", "on") != "off"


NOISE_RE = re.compile(r"\s*[\(\[][^\)\]]*(remaster|remastered|remasterizad|mono|stereo|live|version|versión|edit|radio|deluxe|bonus|explicit|"
                      r"official|video|vídeo|lyric|letra|audio|hd|hq|4k|feat|ft\.|with)[^\)\]]*[\)\]]", re.I)
DASH_NOISE_RE = re.compile(r"\s+[-–—]\s*(\d{4}\s+)?(remaster(ed)?|remasterizad[oa]|mono|stereo|live|radio edit|single version|album version|"
                           r"official.*|lyric.*|audio.*|video.*)(\s+\d{4})?\s*$", re.I)
FEAT_RE = re.compile(r"\s+(feat\.?|ft\.?|featuring|con)\s+.*$", re.I)


def clean_title(t):
    """Quita (Remastered 2011), [Official Video], - Radio Edit, feat. X... para buscar y comparar."""
    t = str(t or "")
    for _ in range(3):
        t = NOISE_RE.sub("", t)
    t = DASH_NOISE_RE.sub("", t)
    t = FEAT_RE.sub("", t)
    return re.sub(r"\s+", " ", t).strip() or str(t).strip()


def text_sim(a, b):
    a, b = fuzz_key(a), fuzz_key(b)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    return difflib.SequenceMatcher(None, a, b).ratio()


def pick_lrclib(cands, title, artist, duration):
    """De todos los candidatos de LRCLIB se queda con el mejor: mismo titulo/artista, duracion parecida y, a ser posible, sincronizada."""
    best, best_score = None, 0.0
    for c in cands or []:
        if not isinstance(c, dict) or not (c.get("syncedLyrics") or c.get("plainLyrics")):
            continue
        ts = max(text_sim(clean_title(title), clean_title(c.get("trackName") or c.get("name") or "")), 0.0)
        ars = text_sim(artist, c.get("artistName") or "")
        if ts < 0.75 or ars < 0.45:
            continue
        score = ts * 0.6 + ars * 0.25
        dur = c.get("duration")
        if duration and dur:
            diff = abs(float(dur) - float(duration))
            if diff > 10:
                continue                                         # otra version (en directo, mezcla larga...): se desfasaria
            score += 0.15 * max(0.0, 1 - diff / 10)
        else:
            score += 0.05
        if c.get("syncedLyrics"):
            score += 0.3                                         # la sincronizada gana a la de texto
        if score > best_score:
            best, best_score = c, score
    return best


def lrclib_lookup(title, artist, album, duration):
    """LRCLIB, de lo mas exacto a lo mas flexible. Devuelve {"syncedLyrics","plainLyrics"} o None.
    Si no hay red en NINGUNA consulta lanza MetaError (se reintentara); un "no encontrada" no lo es."""
    ctitle = clean_title(title)
    first = (artist or "").split(",")[0].split(" feat")[0].strip()
    net_errors = tried = 0
    plain_only = None

    def call(path, params):
        nonlocal net_errors, tried
        tried += 1
        try:
            return http_json("https://lrclib.net/api/" + path + "?" + urlencode(params))
        except MetaError as e:
            if "404" in str(e) or "Not Found" in str(e):
                return None
            net_errors += 1
            return None

    steps = [("get", {"track_name": title, "artist_name": artist, "album_name": album or "", "duration": int(duration or 0)}),
             ("get", {"track_name": ctitle, "artist_name": first, "album_name": album or "", "duration": int(duration or 0)}),
             ("get", {"track_name": ctitle, "artist_name": first, "duration": int(duration or 0)})]
    for path, params in steps:
        d = call(path, params)
        if isinstance(d, dict) and d.get("syncedLyrics"):
            return d
        if isinstance(d, dict) and d.get("plainLyrics") and not plain_only:
            plain_only = d
    for params in ({"track_name": ctitle, "artist_name": first}, {"q": "%s %s" % (first, ctitle)}, {"track_name": ctitle}):
        d = call("search", params)
        best = pick_lrclib(d if isinstance(d, list) else [], title, artist, duration)
        if best and best.get("syncedLyrics"):
            return best
        if best and not plain_only:
            plain_only = best
    if plain_only:
        return plain_only
    if tried and net_errors == tried:
        raise MetaError("lrclib.net: sin conexión")
    return None


def netease_lookup(title, artist, album, duration):
    """Segunda fuente (NetEase, sin clave): suele tener letras sincronizadas que LRCLIB no tiene. Misma forma de respuesta."""
    ctitle, first = clean_title(title), (artist or "").split(",")[0].strip()
    res = http_json("https://music.163.com/api/search/get?" + urlencode({"s": "%s %s" % (first, ctitle), "type": 1, "limit": 6, "offset": 0}),
                    headers={"Referer": "https://music.163.com/"})
    best, best_score = None, 0.0
    for sg in ((res or {}).get("result") or {}).get("songs") or []:
        ts = text_sim(ctitle, clean_title(sg.get("name") or ""))
        names = " ".join(a.get("name", "") for a in (sg.get("artists") or sg.get("ar") or []))
        ars = max(text_sim(first, names), 1.0 if fuzz_key(first) and fuzz_key(first) in fuzz_key(names) else 0.0)
        dur = (sg.get("duration") or sg.get("dt") or 0) / 1000.0
        if ts < 0.8 or ars < 0.6 or (duration and dur and abs(dur - duration) > 8):
            continue
        score = ts + ars
        if score > best_score:
            best, best_score = sg, score
    if not best:
        return None
    d = http_json("https://music.163.com/api/song/lyric?" + urlencode({"id": best["id"], "lv": 1, "kv": 1, "tv": -1}),
                  headers={"Referer": "https://music.163.com/"})
    lrc = ((d or {}).get("lrc") or {}).get("lyric") or ""
    if not parse_lrc(lrc):
        return None
    return {"syncedLyrics": lrc, "plainLyrics": ""}


def online_lyrics(row):
    """Prueba los proveedores en orden. Devuelve (synced, plain, fuente) o None. MetaError solo si no hubo red en ninguno."""
    title, artist, album, dur = row["title"], row["artist"], row["album"], row["duration"]
    net_err = ok_calls = 0
    plain, plain_src = "", ""
    for name, fn in (("lrclib", lrclib_lookup), ("netease", netease_lookup)):
        try:
            d = fn(title, artist, album, dur)
            ok_calls += 1
        except MetaError:
            net_err += 1
            continue
        if not d:
            continue
        if d.get("syncedLyrics") and parse_lrc(d["syncedLyrics"]):
            return d["syncedLyrics"], d.get("plainLyrics") or "", name
        if d.get("plainLyrics") and not plain:
            plain, plain_src = d["plainLyrics"], name
    if plain:
        return "", plain, plain_src
    if net_err and not ok_calls:
        raise MetaError("sin conexión")
    return None


def find_lyrics(sid, refresh=False):
    """Orden: archivo .lrc junto a la cancion -> etiquetas del archivo -> guardada -> LRCLIB (si esta activado)."""
    conn = db()
    row = conn.execute("SELECT s.id, s.path, s.title, s.duration, COALESCE(s.artist_display, ar.name) AS artist, al.name AS album "
                       "FROM songs s JOIN artists ar ON ar.id = s.artist_id JOIN albums al ON al.id = s.album_id WHERE s.id=?", (sid,)).fetchone()
    if not row:
        raise ApiError(70, "Canción no encontrada")
    manual = conn.execute("SELECT * FROM lyrics WHERE song_id=? AND source='manual' AND found=1", (sid,)).fetchone()
    if manual:                                                     # una letra subida por el administrador manda sobre todo lo demas
        return {"synced": parse_lrc(manual["synced"]) if manual["synced"] else [], "plain": manual["plain"] or "", "source": "manual"}
    base = os.path.splitext(row["path"])[0]
    for ext in (".lrc", ".LRC"):
        if os.path.exists(base + ext):
            try:
                with open(base + ext, "r", encoding="utf-8", errors="replace") as f:
                    txt = f.read(1 << 20)
                lines = parse_lrc(txt)
                if lines:
                    return {"synced": lines, "plain": "", "source": "lrc"}
                if txt.strip():
                    return {"synced": [], "plain": txt.strip(), "source": "lrc"}
            except OSError:
                pass
    cached = conn.execute("SELECT * FROM lyrics WHERE song_id=?", (sid,)).fetchone()
    if cached and (not refresh or cached["source"] == "manual") and (cached["found"] or time.time() - cached["fetched"] < 7 * 86400):
        if cached["found"]:
            return {"synced": parse_lrc(cached["synced"]) if cached["synced"] else [], "plain": cached["plain"] or "", "source": cached["source"]}
        return {"synced": [], "plain": "", "source": "none"}
    tag = embedded_lyrics(row["path"])
    if tag:
        lines = parse_lrc(tag)
        if not lines and lyrics_online_enabled():                    # las etiquetas solo traen texto: se intenta conseguirla sincronizada
            try:
                got = online_lyrics(row)
            except MetaError:
                got = None
            if got and got[0]:
                conn.execute("INSERT OR REPLACE INTO lyrics(song_id, synced, plain, source, found, fetched) VALUES(?,?,?,?,1,?)",
                             (sid, got[0], got[1] or tag.strip(), got[2], int(time.time())))
                conn.commit()
                return {"synced": parse_lrc(got[0]), "plain": "", "source": got[2]}
        res = {"synced": lines, "plain": "" if lines else tag.strip(), "source": "tags"}
        conn.execute("INSERT OR REPLACE INTO lyrics(song_id, synced, plain, source, found, fetched) VALUES(?,?,?,?,1,?)",
                     (sid, tag if lines else "", res["plain"], "tags", int(time.time())))
        conn.commit()
        return res
    if lyrics_online_enabled():
        try:
            got = online_lyrics(row)
        except MetaError:
            return {"synced": [], "plain": "", "source": "offline"}           # sin red: no se apunta como "no hay", se reintenta
        if got:
            synced, plain, src = got
            conn.execute("INSERT OR REPLACE INTO lyrics(song_id, synced, plain, source, found, fetched) VALUES(?,?,?,?,1,?)",
                         (sid, synced, plain, src, int(time.time())))
            conn.commit()
            return {"synced": parse_lrc(synced), "plain": plain if not synced else "", "source": src}
    conn.execute("INSERT OR REPLACE INTO lyrics(song_id, synced, plain, source, found, fetched) VALUES(?,?,?,?,0,?)",
                 (sid, "", "", "none", int(time.time())))
    conn.commit()
    return {"synced": [], "plain": "", "source": "none"}


@web_route("POST", "lyrics")
def web_lyrics(h, data):
    logged_in(h)
    return find_lyrics(parse_id(str(data.get("id")), "so"), bool(data.get("refresh")))


@endpoint("getLyricsBySongId")
def ep_getLyricsBySongId(user, p):
    res = find_lyrics(parse_id(need(p, "id"), "so"))
    lines = ([{"start": int(l["t"] * 1000), "value": l["text"]} for l in res["synced"]] if res["synced"]
             else [{"value": ln} for ln in res["plain"].split("\n")])
    return {"lyricsList": {"structuredLyrics": [{"lang": "xxx", "synced": bool(res["synced"]), "line": lines}] if lines else []}}


# ---- letras: subir una propia y buscar las de toda la biblioteca ----

@web_route("POST", "lyrics/save")
def web_lyrics_save(h, data):
    me = logged_in(h)
    if not me["is_admin"]:
        raise ApiError(50, "Solo el administrador puede hacer esto")
    sid = parse_id(str(data.get("id")), "so")
    text = str(data.get("text") or "").strip()[:200000]
    conn = db()
    if not conn.execute("SELECT 1 FROM songs WHERE id=?", (sid,)).fetchone():
        raise ApiError(70, "Canción no encontrada")
    if not text:                                                   # vaciar = volver a buscar sola
        conn.execute("DELETE FROM lyrics WHERE song_id=?", (sid,))
        conn.commit()
        return find_lyrics(sid, True)
    lines = parse_lrc(text)
    conn.execute("INSERT OR REPLACE INTO lyrics(song_id, synced, plain, source, found, fetched) VALUES(?,?,?,?,1,?)",
                 (sid, text if lines else "", "" if lines else text, "manual", int(time.time())))
    conn.commit()
    return {"synced": lines, "plain": "" if lines else text, "source": "manual"}


LYR = {"running": False, "done": 0, "total": 0, "synced": 0, "plain": 0, "none": 0, "error": "", "stop": False}


def lyrics_candidates(mode):
    conn = sqlite3.connect(CFG.db_path, timeout=60)
    conn.row_factory = sqlite3.Row
    week = int(time.time()) - 7 * 86400
    if mode == "upgrade":            # las que solo tienen texto: se intenta conseguirlas sincronizadas
        q = "SELECT s.id FROM songs s JOIN lyrics l ON l.song_id = s.id WHERE l.found=1 AND COALESCE(l.synced,'')='' AND l.source != 'manual' AND l.fetched < ?"
    else:                            # las que nunca se buscaron (o que no se encontraron hace mas de una semana)
        q = "SELECT s.id FROM songs s LEFT JOIN lyrics l ON l.song_id = s.id WHERE l.song_id IS NULL OR (l.found=0 AND l.fetched < ?)"
    ids = [r[0] for r in conn.execute(q + " ORDER BY s.id", (week,))]
    conn.close()
    return ids


def lyrics_job(ids, refresh):
    LYR.update(running=True, done=0, total=len(ids), synced=0, plain=0, none=0, error="", stop=False)
    try:
        for sid in ids:
            if LYR["stop"]:
                break
            try:
                r = find_lyrics(sid, refresh)
            except Exception:
                r = {"source": "none", "synced": [], "plain": ""}
            if r.get("source") == "offline":
                LYR["error"] = "Sin conexión con los servicios de letras: se para y se puede repetir más tarde."
                break
            LYR["synced" if r.get("synced") else "plain" if r.get("plain") else "none"] += 1
            LYR["done"] += 1
            time.sleep(0.5)                                        # sin agobiar a los servicios
    finally:
        LYR["running"] = False


@web_route("POST", "admin/lyrics")
def web_admin_lyrics(h, data):
    admin_only(h)
    act = data.get("action")
    if act == "start" and not LYR["running"]:
        if not lyrics_online_enabled():
            raise ApiError(0, "Activa antes «Buscar letras que falten en internet».")
        mode = "upgrade" if data.get("mode") == "upgrade" else "missing"
        ids = lyrics_candidates(mode)
        threading.Thread(target=lyrics_job, args=(ids, mode == "upgrade"), daemon=True).start()
        LYR.update(running=True, total=len(ids), done=0)
    elif act == "stop":
        LYR["stop"] = True
    return {"job": dict(LYR), "online": lyrics_online_enabled()}


def lyrics_for_new(paths):
    """Tras escanear, busca la letra de las canciones nuevas (si las letras en internet estan activadas)."""
    if not lyrics_online_enabled():
        return
    conn = sqlite3.connect(CFG.db_path, timeout=60)
    conn.row_factory = sqlite3.Row
    ids = []
    for i in range(0, len(paths), 500):
        chunk = paths[i:i + 500]
        ids += [r[0] for r in conn.execute("SELECT id FROM songs WHERE path IN (%s)" % ",".join("?" * len(chunk)), chunk)]
    conn.close()
    for sid in ids:
        try:
            if find_lyrics(sid).get("source") == "offline":
                return
        except Exception:
            pass
        time.sleep(0.5)


# ---- buscar usuarios y seguirlos ----

def user_card(me, r):
    d = _user_card(me, r)
    d["friend"] = d["isFollowing"] and d["followsMe"]               # os seguis mutuamente = amigos
    return d


def _user_card(me, r):
    conn = db()
    return {"username": r["username"], "displayName": r["display_name"] or "", "bio": r["bio"] or "",
            "avatar": r["avatar"] or 0, "banner": r["banner"] or 0,
            "followers": conn.execute("SELECT COUNT(*) FROM follows WHERE followed_id=?", (r["id"],)).fetchone()[0],
            "following": conn.execute("SELECT COUNT(*) FROM follows WHERE follower_id=?", (r["id"],)).fetchone()[0],
            "isFollowing": conn.execute("SELECT 1 FROM follows WHERE follower_id=? AND followed_id=?", (me["id"], r["id"])).fetchone() is not None,
            "notifyNew": bool((conn.execute("SELECT notify FROM follows WHERE follower_id=? AND followed_id=?", (me["id"], r["id"])).fetchone() or [1])[0]),
            "followsMe": conn.execute("SELECT 1 FROM follows WHERE follower_id=? AND followed_id=?", (r["id"], me["id"])).fetchone() is not None,
            "isMe": r["id"] == me["id"],
            "canSeeFollowers": r["id"] == me["id"] or bool(get_prefs(r)["showFollowers"]),
            "canSeeFollowing": r["id"] == me["id"] or bool(get_prefs(r)["showFollowing"])}


def _plain(t):
    t = unicodedata.normalize("NFKD", str(t or "").lower())
    return re.sub(r"[^a-z0-9 ]+", "", "".join(c for c in t if not unicodedata.combining(c))).strip()


def match_rank(q, name):
    """0 = igual, 1 = empieza por lo escrito, 2 = una palabra empieza por lo escrito (o lo contiene con 3+ letras), 3 = otra cosa."""
    a, b = _plain(q), _plain(name)
    if not a or not b:
        return 3
    if a == b:
        return 0
    if b.startswith(a):
        return 1
    if any(w.startswith(a) for w in b.split()) or (len(a) >= 3 and a in b):
        return 2
    return 3


@web_route("POST", "search")
def web_search(h, data):
    me = logged_in(h)
    q = str(data.get("q") or "").strip()[:100]
    artists, albums, songs = run_search(q, 8, 12, 30) if q else ([], [], [])
    idx = SearchIndex()
    rows = db().execute("SELECT * FROM users").fetchall()
    for i, r in enumerate(rows):
        idx.add(i, ((r["username"], 1.0), (r["display_name"] or "", 1.0)))
    idx.finish()
    found = [rows[i] for i in idx.search(q, 8)] if q else []
    # lo mas parecido a lo escrito va primero: nombre igual > empieza por lo escrito > lo contiene > resto
    found.sort(key=lambda r: min(match_rank(q, r["username"]), match_rank(q, r["display_name"] or "")))
    people = [user_card(me, r) for r in found]
    artists = sorted(artists, key=lambda r: match_rank(q, r["name"]))
    # orden de las secciones: si lo escrito se parece mucho a una persona o a un artista, van antes que las canciones
    user_hit = any(min(match_rank(q, r["username"]), match_rank(q, r["display_name"] or "")) <= 2 for r in found)
    artist_hit = any(match_rank(q, r["name"]) <= 2 for r in artists)
    order = []
    if user_hit:
        order.append("users")
    if artist_hit:
        order.append("artist")
    for k in ("song", "artist", "album", "users"):
        if k not in order:
            order.append(k)
    return {"artist": [{"id": "ar-%d" % r["id"], "name": r["name"], "albumCount": r["album_count"],
                        "coverArt": "ar-%d" % r["id"]} for r in artists],
            "album": [album_json(r) for r in albums], "song": song_list(songs), "users": people, "order": order}


@web_route("POST", "plays/recent")
def web_plays_recent(h, data):
    me = logged_in(h)
    limit = max(1, min(int(data.get("limit") or 50), 100))
    rows = db().execute(
        "SELECT id, ts, song_id, title, artist, album, duration FROM plays "
        "WHERE user=? ORDER BY ts DESC, id DESC LIMIT ?", (me["username"], limit)).fetchall()
    plays = []
    for row in rows:
        song = {"id": "so-%d" % row["song_id"] if row["song_id"] else "",
                "title": row["title"], "artist": row["artist"], "album": row["album"],
                "duration": row["duration"] or 0,
                "coverArt": "so-%d" % row["song_id"] if row["song_id"] else None}
        plays.append({"id": row["id"], "timestamp": row["ts"], "song": song})
    return {"plays": plays}


@web_route("POST", "user/profile")
def web_user_profile(h, data):
    me = logged_in(h)
    r = db().execute("SELECT * FROM users WHERE username=?", (str(data.get("username") or ""),)).fetchone()
    if not r:
        raise ApiError(70, "Usuario no encontrado")
    card = user_card(me, r)
    pls = db().execute("SELECT * FROM playlists WHERE owner_id=? AND public=1 ORDER BY updated DESC", (r["id"],)).fetchall()
    return {"user": card, "playlists": [playlist_info(me, playlist_row(p["id"])) for p in pls]}


@web_route("POST", "user/follow")
def web_user_follow(h, data):
    me = logged_in(h)
    r = db().execute("SELECT * FROM users WHERE username=?", (str(data.get("username") or ""),)).fetchone()
    if not r:
        raise ApiError(70, "Usuario no encontrado")
    if r["id"] == me["id"]:
        raise ApiError(0, "No puedes seguirte a ti mismo")
    conn = db()
    if data.get("follow"):
        cur = conn.execute("INSERT OR IGNORE INTO follows(follower_id, followed_id, ts) VALUES(?,?,?)", (me["id"], r["id"], int(time.time())))
        if cur.rowcount:
            notify_follow(me, r)
    else:
        conn.execute("DELETE FROM follows WHERE follower_id=? AND followed_id=?", (me["id"], r["id"]))
        conn.execute("DELETE FROM notifications WHERE user_id=? AND kind='follower' AND ref=?", (r["id"], str(me["id"])))
    conn.commit()
    return {"user": user_card(me, r)}


@web_route("POST", "user/notify")
def web_user_notify(h, data):
    """La campanita de un perfil que sigues: avisar o no cuando publique playlists nuevas. Que te sigan y los mensajes avisan siempre."""
    me = logged_in(h)
    r = db().execute("SELECT * FROM users WHERE username=?", (str(data.get("username") or ""),)).fetchone()
    if not r:
        raise ApiError(70, "Usuario no encontrado")
    conn = db()
    cur = conn.execute("UPDATE follows SET notify=? WHERE follower_id=? AND followed_id=?", (1 if data.get("notify") else 0, me["id"], r["id"]))
    conn.commit()
    if not cur.rowcount:
        raise ApiError(0, "Primero tienes que seguir a este usuario")
    return {"user": user_card(me, r)}


@web_route("POST", "library/notify")
def web_library_notify(h, data):
    """La campanita de un artista guardado: avisar o no cuando llegue musica nueva suya."""
    me = logged_in(h)
    kind = str(data.get("kind", "artist"))
    iid = library_target(me, kind, data.get("id"))
    conn = db()
    cur = conn.execute("UPDATE library SET notify=? WHERE user_id=? AND kind=? AND item_id=?", (1 if data.get("notify") else 0, me["id"], kind, iid))
    conn.commit()
    if not cur.rowcount:
        raise ApiError(0, "Primero tienes que guardarlo en tu biblioteca")
    return {"ok": True}


@web_route("POST", "user/follows")
def web_user_follows(h, data):
    me = logged_in(h)
    conn = db()
    kind = "followers" if data.get("kind") == "followers" else "following"
    col, other = ("followed_id", "follower_id") if kind == "followers" else ("follower_id", "followed_id")
    target = conn.execute("SELECT * FROM users WHERE username=?", (str(data.get("username") or me["username"]),)).fetchone()
    if not target:
        raise ApiError(70, "Usuario no encontrado")
    card = _user_card(me, target)
    if not card["canSeeFollowers" if kind == "followers" else "canSeeFollowing"]:
        raise ApiError(0, "Este usuario no muestra esa lista.")
    rows = conn.execute("SELECT u.* FROM follows f JOIN users u ON u.id = f.%s WHERE f.%s=? ORDER BY f.ts DESC" % (other, col),
                        (target["id"],)).fetchall()
    return {"users": [user_card(me, r) for r in rows]}


# ---- imagenes (foto de perfil, portada de playlist): siempre se guardan como JPEG cuadrado ----

def image_dir():
    d = os.path.join(CFG.data_dir, "images")
    os.makedirs(d, exist_ok=True)
    return d


MAX_IMAGE = 20 * 1024 * 1024


def check_image(raw):
    """Acepta cualquier imagen que ffmpeg sepa leer (jpg, png, webp, gif, bmp, tiff, avif...), hasta 20 MB."""
    if not isinstance(raw, (bytes, bytearray)) or not raw:
        raise ApiError(0, "Imagen no válida")
    if len(raw) > MAX_IMAGE:
        raise ApiError(0, "La imagen pesa más de 20 MB")
    return bytes(raw)


def write_square_image(raw, base, size, height=None):
    """Recorta la imagen a cuadrado y la guarda como <base>.jpg, o <base>.gif si era un GIF (conserva la animacion)."""
    is_gif = raw[:6] in (b"GIF87a", b"GIF89a")
    ext = ".gif" if is_gif else ".jpg"
    dest = base + ext
    tid = threading.get_ident()
    tmp_in, tmp_out = "%s.%d.in" % (base, tid), "%s.%d.tmp" % (base, tid)
    if height:       # banner: se recorta a la proporcion size:height (por ejemplo 3:1) en vez de a cuadrado
        crop = "crop='min(iw,ih*%d/%d)':'min(ih,iw*%d/%d)',scale=%d:%d:flags=lanczos" % (size, height, height, size, size, height)
    else:
        crop = "crop='min(iw,ih)':'min(iw,ih)',scale=%d:%d:flags=lanczos" % (size, size)
    try:
        with open(tmp_in, "wb") as f:
            f.write(raw)
        if is_gif:
            cmd = ["ffmpeg", "-v", "error", "-y", "-t", "12", "-i", tmp_in, "-an", "-vf",
                   crop + ",fps=15,split[a][b];[a]palettegen[p];[b][p]paletteuse", "-f", "gif", tmp_out]
        else:
            cmd = ["ffmpeg", "-v", "error", "-y", "-i", tmp_in, "-an", "-frames:v", "1", "-vf", crop,
                   "-q:v", "3", "-f", "mjpeg", tmp_out]
        r = subprocess.run(cmd, capture_output=True, timeout=120)
        if r.returncode != 0 or not os.path.exists(tmp_out) or os.path.getsize(tmp_out) == 0:
            raise ApiError(0, "No se pudo leer esa imagen. Prueba con JPG, PNG, WEBP o GIF.")
        for old in (base + ".jpg", base + ".gif"):
            remove_file(old)
        os.replace(tmp_out, dest)
    except (OSError, subprocess.SubprocessError):
        raise ApiError(0, "No se pudo leer esa imagen. Prueba con JPG, PNG, WEBP o GIF.")
    finally:
        for t in (tmp_in, tmp_out):
            if os.path.exists(t):
                os.remove(t)


def find_image(base):
    for ext in (".jpg", ".gif"):
        if os.path.exists(base + ext):
            return base + ext
    return None


def image_mime(path):
    return "image/gif" if path.endswith(".gif") else "image/jpeg"


def remove_file(path):
    try:
        os.remove(path)
    except OSError:
        pass


def avatar_base(uid):
    return os.path.join(image_dir(), "avatar-%d" % uid)


def banner_base(uid):
    return os.path.join(image_dir(), "banner-%d" % uid)


def radio_cover_base(rid):
    return os.path.join(image_dir(), "radio-%d" % rid)


def playlist_cover_base(pid):
    return os.path.join(image_dir(), "playlist-%d" % pid)


def remove_image(base):
    for ext in (".jpg", ".gif"):
        remove_file(base + ext)


# ---- perfil ----

def public_user(row):
    return {"username": row["username"], "isAdmin": bool(row["is_admin"]), "email": row["email"],
            "displayName": row["display_name"] or "", "bio": row["bio"] or "",
            "avatar": row["avatar"] or 0, "banner": row["banner"] or 0, "prefs": get_prefs(row)}


@web_route("POST", "profile")
def web_profile(h, data):
    me = logged_in(h)
    conn = db()
    if "displayName" in data:
        name = str(data.get("displayName") or "").strip()[:40]
        conn.execute("UPDATE users SET display_name=? WHERE id=?", (name or None, me["id"]))
    if "bio" in data:
        conn.execute("UPDATE users SET bio=? WHERE id=?", (str(data.get("bio") or "").strip()[:300] or None, me["id"]))
    if "email" in data:
        email = clean_email(data.get("email"), required=True)
        if (me["email"] or "").lower() != email.lower():
            if not verify_password(str(data.get("currentPassword", "")), me["pw_hash"]):
                raise ApiError(40, "La contraseña actual no es correcta")
            try:
                conn.execute("UPDATE users SET email=? WHERE id=?", (email, me["id"]))
            except sqlite3.IntegrityError:
                conn.rollback()
                raise ApiError(0, "Ese correo ya está en uso")
    conn.commit()
    return {"user": public_user(user_by_id(me["id"]))}


@web_route("POST", "profile/avatar")
def web_profile_avatar(h, data):
    me = logged_in(h)
    conn = db()
    if data.get("remove"):
        remove_image(avatar_base(me["id"]))
        conn.execute("UPDATE users SET avatar=0 WHERE id=?", (me["id"],))
    else:
        raise ApiError(0, "Imagen no válida")
        conn.execute("UPDATE users SET avatar=? WHERE id=?", (int(time.time()), me["id"]))
    conn.commit()
    return {"user": public_user(user_by_id(me["id"]))}


@web_route("POST", "profile/banner")
def web_profile_banner(h, data):
    me = logged_in(h)
    conn = db()
    remove_image(banner_base(me["id"]))
    conn.execute("UPDATE users SET banner=0 WHERE id=?", (me["id"],))
    conn.commit()
    return {"user": public_user(user_by_id(me["id"]))}


@web_route("POST", "prefs")
def web_prefs(h, data):
    me = logged_in(h)
    prefs = get_prefs(me)
    if data.get("quality") in ("original", "high", "normal", "low"):
        prefs["quality"] = data["quality"]
    if "normalize" in data:
        prefs["normalize"] = bool(data["normalize"])
    if data.get("normTarget") in (-19, -16, -14, -11):
        prefs["normTarget"] = data["normTarget"]
    if data.get("libraryView") in ("grid", "list", "compact"):
        prefs["libraryView"] = data["libraryView"]
    for k in ("showFollowers", "showFollowing", "showListening", "chatSound"):
        if k in data:
            prefs[k] = bool(data[k])
    if "crossfade" in data:
        try:
            prefs["crossfade"] = max(0, min(12, int(data["crossfade"])))
        except (TypeError, ValueError):
            pass
    if "animLevel" in data:
        try:
            prefs["animLevel"] = max(0, min(100, int(data["animLevel"])))
        except (TypeError, ValueError):
            pass
    conn = db()
    conn.execute("UPDATE users SET prefs=? WHERE id=?", (json.dumps(prefs), me["id"]))
    conn.commit()
    return {"prefs": prefs}


# ---- playlists ----

def parse_pl(value):
    s = str(value or "")
    if s.startswith("pl-"):
        s = s[3:]
    if not s.isdigit():
        raise ApiError(70, "Playlist no encontrada")
    return int(s)


def playlist_row(pid):
    return db().execute(
        "SELECT p.*, u.username AS owner_name, u.display_name AS owner_display FROM playlists p "
        "JOIN users u ON u.id = p.owner_id WHERE p.id=?", (pid,)).fetchone()


def member_status(me_id, pid):
    r = db().execute("SELECT status FROM playlist_members WHERE playlist_id=? AND user_id=?", (pid, me_id)).fetchone()
    return r["status"] if r else None


def can_view(me, pl):
    return bool(pl) and (pl["owner_id"] == me["id"] or bool(pl["public"]) or member_status(me["id"], pl["id"]) is not None)


def can_edit(me, pl):
    """El dueno y los colaboradores que aceptaron la invitacion pueden cambiar las canciones."""
    return bool(pl) and (pl["owner_id"] == me["id"] or member_status(me["id"], pl["id"]) == "accepted")


def visible_playlist(me, pid):
    pl = playlist_row(pid)
    if not can_view(me, pl):
        raise ApiError(70, "Playlist no encontrada")
    return pl


def editable_playlist(me, pid):
    pl = playlist_row(pid)
    if not can_edit(me, pl):
        raise ApiError(70, "Playlist no encontrada")
    return pl


def own_playlist(me, pid):
    pl = playlist_row(pid)
    if not pl or pl["owner_id"] != me["id"]:
        raise ApiError(70, "Playlist no encontrada")
    return pl


def playlist_info(me, pl):
    conn = db()
    n, dur = conn.execute("SELECT COUNT(*), COALESCE(SUM(s.duration),0) FROM playlist_songs ps "
                          "JOIN songs s ON s.id = ps.song_id WHERE ps.playlist_id=?", (pl["id"],)).fetchone()
    saved = conn.execute("SELECT 1 FROM library WHERE user_id=? AND kind='playlist' AND item_id=?",
                         (me["id"], pl["id"])).fetchone() is not None
    mine = pl["owner_id"] == me["id"]
    status = "owner" if mine else member_status(me["id"], pl["id"])
    collabs = conn.execute("SELECT COUNT(*) FROM playlist_members WHERE playlist_id=? AND status='accepted'", (pl["id"],)).fetchone()[0]
    return {"id": "pl-%d" % pl["id"], "name": pl["name"], "description": pl["description"] or "",
            "public": bool(pl["public"]), "owned": mine, "canEdit": mine or status == "accepted",
            "collaborative": collabs > 0, "collaborators": collabs, "myStatus": status,
            "linkSource": (conn.execute("SELECT source FROM playlist_links WHERE playlist_id=?", (pl["id"],)).fetchone() or [None])[0],
            "author": pl["owner_display"] or pl["owner_name"], "authorUsername": pl["owner_name"],
            "cover": pl["cover"] or 0, "songCount": n, "duration": dur, "saved": saved,
            "created": iso(pl["created"]), "changed": iso(pl["updated"])}


def song_ids_from(data):
    """Canciones a anadir: songIds ("so-1" o 1) y/o albumId ("al-1")."""
    conn = db()
    out = []
    for x in (data.get("songIds") or [])[:5000]:
        s = str(x)
        s = s[3:] if s.startswith("so-") else s
        if s.isdigit():
            out.append(int(s))
    if data.get("albumId"):
        aid = parse_id(str(data["albumId"]), "al")
        out += [r[0] for r in conn.execute("SELECT id FROM songs WHERE album_id=? ORDER BY disc, track, id", (aid,))]
    if not out:
        return []
    have = {r[0] for r in conn.execute("SELECT id FROM songs WHERE id IN (%s)" % ",".join("?" * len(out)), out)}
    return [i for i in out if i in have]


def append_songs(pid, song_ids):
    if not song_ids:
        return
    conn = db()
    pos = conn.execute("SELECT COALESCE(MAX(pos), 0) FROM playlist_songs WHERE playlist_id=?", (pid,)).fetchone()[0]
    now = int(time.time())
    conn.executemany("INSERT INTO playlist_songs(playlist_id, song_id, pos, added) VALUES(?,?,?,?)",
                     [(pid, sid, pos + i + 1, now) for i, sid in enumerate(song_ids)])
    conn.execute("UPDATE playlists SET updated=? WHERE id=?", (now, pid))


def create_playlist(me, name, public=False):
    conn = db()
    now = int(time.time())
    name = (str(name or "").strip() or "Playlist")[:100]
    pid = conn.execute("INSERT INTO playlists(owner_id, name, description, public, cover, created, updated) "
                       "VALUES(?,?,?,?,0,?,?)", (me["id"], name, "", 1 if public else 0, now, now)).lastrowid
    conn.execute("INSERT OR IGNORE INTO library(user_id, kind, item_id, saved_at) VALUES(?,?,?,?)",
                 (me["id"], "playlist", pid, now))
    return pid


@web_route("POST", "playlist/create")
def web_pl_create(h, data):
    me = logged_in(h)
    pid = create_playlist(me, data.get("name"))
    append_songs(pid, song_ids_from(data))
    db().commit()
    return {"playlist": playlist_info(me, playlist_row(pid))}


@web_route("POST", "playlist/mine")
def web_pl_mine(h, data):
    me = logged_in(h)
    rows = db().execute("SELECT * FROM playlists WHERE owner_id=? OR id IN (SELECT playlist_id FROM playlist_members "
                        "WHERE user_id=? AND status='accepted') ORDER BY updated DESC", (me["id"], me["id"])).fetchall()
    return {"playlists": [{"id": "pl-%d" % r["id"], "name": r["name"],
                           "songCount": db().execute("SELECT COUNT(*) FROM playlist_songs WHERE playlist_id=?",
                                                     (r["id"],)).fetchone()[0]} for r in rows]}


@web_route("POST", "playlist/get")
def web_pl_get(h, data):
    me = logged_in(h)
    pl = visible_playlist(me, parse_pl(data.get("id")))
    rows = db().execute(
        "SELECT ps.id AS entry_id, s.*, al.name AS album_name, COALESCE(s.artist_display, ar.name) AS artist_name "
        "FROM playlist_songs ps JOIN songs s ON s.id = ps.song_id JOIN albums al ON al.id = s.album_id "
        "JOIN artists ar ON ar.id = s.artist_id WHERE ps.playlist_id=? ORDER BY ps.pos, ps.id", (pl["id"],)).fetchall()
    songs = song_list(rows)
    for d, r in zip(songs, rows):
        d["entryId"] = r["entry_id"]
    prewarm_covers([r["album_id"] for r in rows], "pl-%d" % pl["id"])
    return {"playlist": playlist_info(me, pl), "songs": songs}


@web_route("POST", "playlist/update")
def web_pl_update(h, data):
    me = logged_in(h)
    pl = own_playlist(me, parse_pl(data.get("id")))
    conn = db()
    if "name" in data:
        name = str(data.get("name") or "").strip()[:100]
        if name:
            conn.execute("UPDATE playlists SET name=? WHERE id=?", (name, pl["id"]))
    if "description" in data:
        conn.execute("UPDATE playlists SET description=? WHERE id=?", (str(data.get("description") or "").strip()[:500], pl["id"]))
    if "public" in data:
        conn.execute("UPDATE playlists SET public=? WHERE id=?", (1 if data.get("public") else 0, pl["id"]))
        if data.get("public") and not pl["public"]:
            notify_playlist_public(me, pl["id"])
    conn.execute("UPDATE playlists SET updated=? WHERE id=?", (int(time.time()), pl["id"]))
    conn.commit()
    return {"playlist": playlist_info(me, playlist_row(pl["id"]))}


@web_route("POST", "playlist/cover")
def web_pl_cover(h, data):
    me = logged_in(h)
    pl = own_playlist(me, parse_pl(data.get("id")))
    conn = db()
    if data.get("remove"):
        remove_image(playlist_cover_base(pl["id"]))
        conn.execute("UPDATE playlists SET cover=0 WHERE id=?", (pl["id"],))
    else:
        raise ApiError(0, "Imagen no válida")
    conn.commit()
    return {"playlist": playlist_info(me, playlist_row(pl["id"]))}


@web_route("POST", "upload/avatar")
def web_upload_avatar(h, data):
    me = logged_in(h)
    write_square_image(check_image(data.get("raw")), avatar_base(me["id"]), 256)
    conn = db()
    conn.execute("UPDATE users SET avatar=? WHERE id=?", (int(time.time()), me["id"]))
    conn.commit()
    return {"user": public_user(user_by_id(me["id"]))}


@web_route("POST", "upload/banner")
def web_upload_banner(h, data):
    me = logged_in(h)
    write_square_image(check_image(data.get("raw")), banner_base(me["id"]), 1500, 500)
    conn = db()
    conn.execute("UPDATE users SET banner=? WHERE id=?", (int(time.time()), me["id"]))
    conn.commit()
    return {"user": public_user(user_by_id(me["id"]))}


@web_route("POST", "upload/playlist-cover")
def web_upload_pl_cover(h, data):
    me = logged_in(h)
    pl = own_playlist(me, parse_pl(data.get("id")))
    write_square_image(check_image(data.get("raw")), playlist_cover_base(pl["id"]), 512)
    conn = db()
    conn.execute("UPDATE playlists SET cover=?, updated=? WHERE id=?", (int(time.time()), int(time.time()), pl["id"]))
    conn.commit()
    return {"playlist": playlist_info(me, playlist_row(pl["id"]))}


def radio_row(raw_id):
    rid = parse_id(str(raw_id or ""), "ra")
    r = db().execute("SELECT * FROM radios WHERE id=?", (rid,)).fetchone()
    if not r:
        raise ApiError(70, "Radio no encontrada")
    return r


@web_route("POST", "upload/radio-cover")
def web_upload_radio_cover(h, data):
    admin_only(h)
    r = radio_row(data.get("id"))
    write_square_image(check_image(data.get("raw")), radio_cover_base(r["id"]), 512)
    return {"ok": True, "coverArt": "ra-%d" % r["id"]}


@web_route("POST", "radio/cover-remove")
def web_radio_cover_remove(h, data):
    admin_only(h)
    r = radio_row(data.get("id"))
    remove_image(radio_cover_base(r["id"]))
    return {"ok": True}


def radio_logo_candidates(page_url):
    """Direcciones donde suele estar el logo de una web: og:image, apple-touch-icon, icon y /favicon.ico."""
    out = []
    try:
        html = http_bytes(page_url, limit=1 << 20, timeout=12).decode("utf-8", "replace")
    except MetaError:
        html = ""
    for tag in re.findall(r"<(?:meta|link)\b[^>]*>", html, re.I):
        low = tag.lower()
        m = re.search(r'(?:content|href)\s*=\s*["\']([^"\']+)["\']', tag, re.I)
        if not m:
            continue
        if "og:image" in low or "twitter:image" in low:
            out.append((0, m.group(1)))
        elif "apple-touch-icon" in low:
            out.append((1, m.group(1)))
        elif "rel=\"icon\"" in low or "rel='icon'" in low or "shortcut icon" in low:
            out.append((2, m.group(1)))
    out.sort(key=lambda x: x[0])
    urls = [urljoin(page_url, u) for _, u in out]
    urls.append(urljoin(page_url, "/favicon.ico"))
    seen, res = set(), []
    for u in urls:
        if u not in seen and re.match(r"^https?://", u):
            seen.add(u)
            res.append(u)
    return res[:6]


@web_route("POST", "radio/cover-fetch")
def web_radio_cover_fetch(h, data):
    """Busca el logo de la radio en su pagina web (o en la del servidor del stream). Necesita internet en el servidor."""
    admin_only(h)
    r = radio_row(data.get("id"))
    pages = []
    if r["homepage_url"]:
        pages.append(r["homepage_url"])
    pu = urlparse(r["stream_url"])
    if pu.scheme in ("http", "https") and pu.netloc:
        pages.append("%s://%s/" % (pu.scheme, pu.netloc))
    errors = []
    for page in pages:
        if not re.match(r"^https?://", page):
            continue
        for u in radio_logo_candidates(page):
            try:
                raw = http_bytes(u, limit=5 << 20, timeout=12)
                if len(raw) < 200:
                    continue
                write_square_image(raw, radio_cover_base(r["id"]), 512)
                return {"ok": True, "coverArt": "ra-%d" % r["id"], "from": u}
            except (MetaError, ApiError) as e:
                errors.append(str(getattr(e, "message", e))[:100])
    raise ApiError(0, "No se ha encontrado ningún logo. Sube la imagen a mano.")


def delete_playlist(pid):
    conn = db()
    conn.execute("DELETE FROM playlist_songs WHERE playlist_id=?", (pid,))
    conn.execute("DELETE FROM library WHERE kind='playlist' AND item_id=?", (pid,))
    conn.execute("DELETE FROM playlist_members WHERE playlist_id=?", (pid,))
    conn.execute("DELETE FROM playlist_links WHERE playlist_id=?", (pid,))
    conn.execute("DELETE FROM notifications WHERE ref=? AND kind IN ('collab_invite','follow_playlist','collab_accept')", ("pl-%d" % pid,))
    conn.execute("DELETE FROM playlists WHERE id=?", (pid,))
    conn.commit()
    remove_image(playlist_cover_base(pid))


@web_route("POST", "playlist/delete")
def web_pl_delete(h, data):
    me = logged_in(h)
    pid = parse_pl(data.get("id"))
    pl = playlist_row(pid)
    if not pl or (pl["owner_id"] != me["id"] and not me["is_admin"]):
        raise ApiError(70, "Playlist no encontrada")
    delete_playlist(pid)
    return {"ok": True}


@web_route("POST", "playlist/add")
def web_pl_add(h, data):
    me = logged_in(h)
    pl = editable_playlist(me, parse_pl(data.get("id")))
    ids = song_ids_from(data)
    append_songs(pl["id"], ids)
    db().commit()
    return {"added": len(ids), "playlist": playlist_info(me, playlist_row(pl["id"]))}


@web_route("POST", "playlist/move")
def web_pl_move(h, data):
    """Mueve una cancion de la playlist: va justo antes de 'beforeEntryId' (o al final si no se indica)."""
    me = logged_in(h)
    pl = editable_playlist(me, parse_pl(data.get("id")))
    try:
        eid = int(data.get("entryId"))
        before = int(data["beforeEntryId"]) if data.get("beforeEntryId") not in (None, "") else None
    except (TypeError, ValueError):
        raise ApiError(10, "Datos no válidos")
    conn = db()
    order = [r[0] for r in conn.execute("SELECT id FROM playlist_songs WHERE playlist_id=? ORDER BY pos, id", (pl["id"],))]
    if eid not in order or (before is not None and before not in order):
        raise ApiError(70, "Esa canción ya no está en la playlist")
    if before != eid:
        order.remove(eid)
        order.insert(order.index(before) if before is not None else len(order), eid)
        conn.executemany("UPDATE playlist_songs SET pos=? WHERE id=?", [(i + 1, e) for i, e in enumerate(order)])
        conn.execute("UPDATE playlists SET updated=? WHERE id=?", (int(time.time()), pl["id"]))
        conn.commit()
    return {"playlist": playlist_info(me, playlist_row(pl["id"]))}


@web_route("POST", "playlist/remove")
def web_pl_remove(h, data):
    me = logged_in(h)
    pl = editable_playlist(me, parse_pl(data.get("id")))
    entries = [int(x) for x in (data.get("entryIds") or []) if str(x).isdigit()][:5000]
    conn = db()
    conn.executemany("DELETE FROM playlist_songs WHERE id=? AND playlist_id=?", [(e, pl["id"]) for e in entries])
    conn.execute("UPDATE playlists SET updated=? WHERE id=?", (int(time.time()), pl["id"]))
    conn.commit()
    return {"playlist": playlist_info(me, playlist_row(pl["id"]))}


# ---------------------------------------------------------------------------
# Notificaciones (la campana), amigos y playlists colaborativas
# ---------------------------------------------------------------------------

def push_notice(user_id, kind, ref, data, conn=None):
    """Crea (o renueva) un aviso. Si ya existia uno igual lo vuelve a poner como no leido."""
    conn = conn or db()
    conn.execute("INSERT INTO notifications(user_id, kind, ref, data, ts, read) VALUES(?,?,?,?,?,0) "
                 "ON CONFLICT(user_id, kind, ref) DO UPDATE SET data=excluded.data, ts=excluded.ts, read=0",
                 (user_id, kind, str(ref), json.dumps(data, ensure_ascii=False), int(time.time())))


def notify_follow(me, other):
    mutual = db().execute("SELECT 1 FROM follows WHERE follower_id=? AND followed_id=?", (other["id"], me["id"])).fetchone() is not None
    push_notice(other["id"], "follower", me["id"], {"username": me["username"], "mutual": mutual})


def notify_playlist_public(me, pid):
    pl = playlist_row(pid)
    for r in db().execute("SELECT follower_id FROM follows WHERE followed_id=? AND notify=1", (me["id"],)).fetchall():
        push_notice(r[0], "follow_playlist", "pl-%d" % pid, {"username": me["username"], "playlistId": "pl-%d" % pid, "name": pl["name"]})


def notify_new_music(conn, paths):
    """Avisa a quien guardo (corazon) a un artista de que tiene musica nueva en la biblioteca."""
    paths = list(paths)
    albums = {}                                                    # album_id -> {artists, songs}
    for i in range(0, len(paths), 500):
        chunk = paths[i:i + 500]
        for r in conn.execute("SELECT s.id, s.album_id, s.artist_id, al.artist_id AS aa FROM songs s JOIN albums al ON al.id = s.album_id "
                              "WHERE s.path IN (%s)" % ",".join("?" * len(chunk)), chunk):
            a = albums.setdefault(r["album_id"], {"artists": set(), "songs": 0})
            a["songs"] += 1
            a["artists"].update([r["artist_id"], r["aa"]])
            a["artists"].update(x[0] for x in conn.execute("SELECT artist_id FROM song_artists WHERE song_id=?", (r["id"],)))
    for album_id, a in albums.items():
        info = conn.execute("SELECT al.name, (SELECT COUNT(*) FROM songs WHERE album_id=al.id) AS total FROM albums al WHERE al.id=?", (album_id,)).fetchone()
        if not info:
            continue
        for artist_id in a["artists"]:
            art = conn.execute("SELECT name FROM artists WHERE id=?", (artist_id,)).fetchone()
            if not art:
                continue
            for u in conn.execute("SELECT user_id FROM library WHERE kind='artist' AND item_id=? AND notify=1", (artist_id,)).fetchall():
                push_notice(u[0], "artist_music", "al-%d" % album_id,
                            {"artistId": "ar-%d" % artist_id, "artist": art["name"], "albumId": "al-%d" % album_id,
                             "album": info["name"], "newSongs": a["songs"], "whole": a["songs"] >= info["total"]}, conn)
    conn.commit()


@web_route("POST", "notifications")
def web_notifications(h, data):
    me = logged_in(h)
    conn = db()
    out = []
    for r in conn.execute("SELECT * FROM notifications WHERE user_id=? ORDER BY ts DESC, id DESC LIMIT 60", (me["id"],)).fetchall():
        d = json.loads(r["data"] or "{}")
        item = {"id": r["id"], "kind": r["kind"], "ts": r["ts"], "read": bool(r["read"]), **d}
        if d.get("username"):
            u = conn.execute("SELECT * FROM users WHERE username=?", (d["username"],)).fetchone()
            if not u:
                continue
            item["displayName"] = u["display_name"] or ""
            item["avatar"] = u["avatar"] or 0
            if r["kind"] == "follower":
                item["friend"] = conn.execute("SELECT 1 FROM follows WHERE follower_id=? AND followed_id=?", (me["id"], u["id"])).fetchone() is not None \
                    and conn.execute("SELECT 1 FROM follows WHERE follower_id=? AND followed_id=?", (u["id"], me["id"])).fetchone() is not None
                item["following"] = conn.execute("SELECT 1 FROM follows WHERE follower_id=? AND followed_id=?", (me["id"], u["id"])).fetchone() is not None
        if r["kind"] == "collab_invite":                           # la invitacion solo vale mientras siga pendiente
            if member_status(me["id"], parse_pl(d.get("playlistId"))) != "pending":
                continue
        out.append(item)
    unread = sum(1 for x in out if not x["read"])
    return {"items": out, "unread": unread}


@web_route("POST", "notifications/count")
def web_notifications_count(h, data):
    me = logged_in(h)
    return {"unread": db().execute("SELECT COUNT(*) FROM notifications WHERE user_id=? AND read=0", (me["id"],)).fetchone()[0]}


@web_route("POST", "notifications/read")
def web_notifications_read(h, data):
    me = logged_in(h)
    conn = db()
    if data.get("all"):
        conn.execute("UPDATE notifications SET read=1 WHERE user_id=?", (me["id"],))
    else:
        ids = [int(x) for x in (data.get("ids") or []) if str(x).isdigit()][:200]
        conn.executemany("UPDATE notifications SET read=1 WHERE user_id=? AND id=?", [(me["id"], i) for i in ids])
    conn.commit()
    return {"ok": True}


@web_route("POST", "notifications/clear")
def web_notifications_clear(h, data):
    me = logged_in(h)
    conn = db()
    if data.get("all"):
        conn.execute("DELETE FROM notifications WHERE user_id=? AND kind != 'collab_invite'", (me["id"],))
    else:
        ids = [int(x) for x in (data.get("ids") or []) if str(x).isdigit()][:200]
        conn.executemany("DELETE FROM notifications WHERE user_id=? AND id=? AND kind != 'collab_invite'", [(me["id"], i) for i in ids])
    conn.commit()
    return {"ok": True}


@web_route("POST", "user/friends")
def web_user_friends(h, data):
    me = logged_in(h)
    rows = db().execute("SELECT u.* FROM follows a JOIN follows b ON b.follower_id = a.followed_id AND b.followed_id = a.follower_id "
                        "JOIN users u ON u.id = a.followed_id WHERE a.follower_id=? ORDER BY u.username COLLATE NOCASE", (me["id"],)).fetchall()
    return {"users": [user_card(me, r) for r in rows]}


# ---- colaboradores de una playlist ----

def member_card(me, r):
    d = user_card(me, r)
    d["status"] = r["status"]
    return d


@web_route("POST", "playlist/members")
def web_pl_members(h, data):
    me = logged_in(h)
    pl = visible_playlist(me, parse_pl(data.get("id")))
    rows = db().execute("SELECT u.*, m.status FROM playlist_members m JOIN users u ON u.id = m.user_id WHERE m.playlist_id=? "
                        "ORDER BY m.ts", (pl["id"],)).fetchall()
    owner = db().execute("SELECT * FROM users WHERE id=?", (pl["owner_id"],)).fetchone()
    owner_card = user_card(me, owner)
    owner_card["status"] = "owner"
    members = [member_card(me, r) for r in rows if pl["owner_id"] == me["id"] or r["status"] == "accepted"]
    return {"owner": owner_card, "members": members}


@web_route("POST", "playlist/invite")
def web_pl_invite(h, data):
    me = logged_in(h)
    pl = own_playlist(me, parse_pl(data.get("id")))
    u = db().execute("SELECT * FROM users WHERE username=?", (str(data.get("username") or ""),)).fetchone()
    if not u:
        raise ApiError(70, "Usuario no encontrado")
    if u["id"] == me["id"]:
        raise ApiError(0, "Ya eres el dueño de esta playlist")
    conn = db()
    if member_status(u["id"], pl["id"]):
        raise ApiError(0, "Ese usuario ya está invitado")
    conn.execute("INSERT INTO playlist_members(playlist_id, user_id, status, invited_by, ts) VALUES(?,?,?,?,?)",
                 (pl["id"], u["id"], "pending", me["id"], int(time.time())))
    push_notice(u["id"], "collab_invite", "pl-%d" % pl["id"], {"username": me["username"], "playlistId": "pl-%d" % pl["id"], "name": pl["name"]})
    conn.commit()
    return {"ok": True}


@web_route("POST", "playlist/respond")
def web_pl_respond(h, data):
    me = logged_in(h)
    pid = parse_pl(data.get("id"))
    pl = playlist_row(pid)
    conn = db()
    if not pl or member_status(me["id"], pid) != "pending":
        raise ApiError(70, "Invitación no encontrada")
    ref = "pl-%d" % pid
    if data.get("accept"):
        conn.execute("UPDATE playlist_members SET status='accepted' WHERE playlist_id=? AND user_id=?", (pid, me["id"]))
        conn.execute("INSERT OR IGNORE INTO library(user_id, kind, item_id, saved_at) VALUES(?,?,?,?)", (me["id"], "playlist", pid, int(time.time())))
        push_notice(pl["owner_id"], "collab_accept", "%s:%d" % (ref, me["id"]), {"username": me["username"], "playlistId": ref, "name": pl["name"]})
    else:
        conn.execute("DELETE FROM playlist_members WHERE playlist_id=? AND user_id=?", (pid, me["id"]))
    conn.execute("DELETE FROM notifications WHERE user_id=? AND kind='collab_invite' AND ref=?", (me["id"], ref))
    conn.commit()
    return {"ok": True, "playlist": playlist_info(me, playlist_row(pid)) if data.get("accept") else None}


@web_route("POST", "playlist/leave")
def web_pl_leave(h, data):
    """Un colaborador se va de la playlist (o el dueno echa a alguien con 'username')."""
    me = logged_in(h)
    pid = parse_pl(data.get("id"))
    pl = playlist_row(pid)
    if not pl:
        raise ApiError(70, "Playlist no encontrada")
    conn = db()
    target = me
    if data.get("username") and data.get("username") != me["username"]:
        if pl["owner_id"] != me["id"]:
            raise ApiError(70, "Playlist no encontrada")
        target = conn.execute("SELECT * FROM users WHERE username=?", (str(data["username"]),)).fetchone()
        if not target:
            raise ApiError(70, "Usuario no encontrado")
    conn.execute("DELETE FROM playlist_members WHERE playlist_id=? AND user_id=?", (pid, target["id"]))
    conn.execute("DELETE FROM library WHERE user_id=? AND kind='playlist' AND item_id=?", (target["id"], pid))
    conn.execute("DELETE FROM notifications WHERE user_id=? AND kind='collab_invite' AND ref=?", (target["id"], "pl-%d" % pid))
    conn.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Importar playlists de otros servicios y vincularlas
#   Solo se lee la LISTA de canciones (titulo y artista) y se empareja con lo que ya hay en el servidor:
#   no se descarga musica. Spotify, YouTube, SoundCloud y Deezer por enlace; ademas, texto o CSV pegado.
# ---------------------------------------------------------------------------

_warn = threading.local()


def warn(msg):
    """Avisos de una importacion (p. ej. 'solo se han podido leer 100'); se enseñan al usuario en vez de callarlos."""
    if not hasattr(_warn, "l"):
        _warn.l = []
    _warn.l.append(msg)


def take_warnings():
    w = getattr(_warn, "l", [])
    _warn.l = []
    return w


BROWSER_UA = "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0"


def http_page(url, headers=None, data=None, limit=8 << 20, timeout=25):
    hdrs = {"User-Agent": BROWSER_UA, "Accept-Language": "en-US,en;q=0.8", "Cookie": "CONSENT=YES+1; SOCS=CAI"}
    hdrs.update(headers or {})
    try:
        with urlopen(Request(url, data=data, headers=hdrs), timeout=timeout) as resp:
            return resp.read(limit).decode("utf-8", "replace")
    except Exception as e:
        raise MetaError("%s: %s" % (urlparse(url).netloc, str(e)[:120]))


def find_key(obj, key):
    """Primer valor de 'key' en cualquier sitio de un JSON anidado."""
    if isinstance(obj, dict):
        if key in obj:
            return obj[key]
        for v in obj.values():
            r = find_key(v, key)
            if r is not None:
                return r
    elif isinstance(obj, list):
        for v in obj:
            r = find_key(v, key)
            if r is not None:
                return r
    return None


def find_all(obj, key, out=None):
    out = [] if out is None else out
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == key:
                out.append(v)
            else:
                find_all(v, key, out)
    elif isinstance(obj, list):
        for v in obj:
            find_all(v, key, out)
    return out


def json_after(text, marker):
    """JSON que empieza justo despues de 'marker' en un HTML (var x = {...};)."""
    i = text.find(marker)
    if i < 0:
        return None
    i += len(marker)
    while i < len(text) and text[i] in " \t\r\n=":
        i += 1
    try:
        return json.JSONDecoder().raw_decode(text[i:])[0]
    except ValueError:
        return None


def split_names(s):
    return [x.strip() for x in re.split(r",|&|;|\bfeat\.?\b|\bft\.?\b|\bx\b| y | and ", str(s or ""), flags=re.I) if x.strip()]


def track(title, artist="", duration=None, album=""):
    try:
        d = float(duration) if duration else None
    except (TypeError, ValueError):
        d = None
    return {"title": str(title or "").strip(), "artist": str(artist or "").strip(), "duration": d, "album": str(album or "").strip()}


_ctx = threading.local()          # usuario en nombre del que se importa (para usar su sesion de Spotify)
_SP_PENDING = {}                  # state -> (user_id, verifier, caduca)
_SP_LOCK = threading.Lock()
SP_SCOPE = "playlist-read-private playlist-read-collaborative"


def sp_client_id():
    return (get_setting("spotify_id", "") or "").strip()


def sp_redirect():
    return (get_setting("spotify_redirect", "") or "").strip()


def sp_token_request(fields):
    """POST a accounts.spotify.com/api/token; devuelve el JSON o lanza ApiError con el motivo."""
    req = Request("https://accounts.spotify.com/api/token", data=urlencode(fields).encode(),
                  headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Zinctify/%s" % SERVER_VERSION})
    try:
        with urlopen(req, timeout=20) as resp:
            return json.loads(resp.read(1 << 20).decode("utf-8", "replace"))
    except HTTPError as e:
        try:
            d = json.loads(e.read(4096).decode("utf-8", "replace"))
            why = d.get("error_description") or d.get("error") or str(e)
        except Exception:
            why = str(e)
        raise ApiError(0, "Spotify ha rechazado la conexión: %s" % why[:150])
    except Exception as e:
        raise ApiError(0, "No he podido hablar con Spotify: %s" % str(e)[:120])


def sp_save_tokens(uid, tok, old_refresh=""):
    refresh = tok.get("refresh_token") or old_refresh
    if not tok.get("access_token") or not refresh:
        raise ApiError(0, "Spotify no ha devuelto una sesión válida.")
    conn = db()
    conn.execute("INSERT INTO spotify_tokens(user_id, access, refresh, exp) VALUES(?,?,?,?) "
                 "ON CONFLICT(user_id) DO UPDATE SET access=excluded.access, refresh=excluded.refresh, exp=excluded.exp",
                 (uid, tok["access_token"], refresh, int(time.time()) + int(tok.get("expires_in", 3600))))
    conn.commit()


def sp_user_token(uid):
    """Token de acceso valido del usuario (lo renueva si hace falta) o None si no ha conectado Spotify."""
    r = db().execute("SELECT * FROM spotify_tokens WHERE user_id=?", (uid,)).fetchone()
    if not r:
        return None
    if r["exp"] - 60 > time.time():
        return r["access"]
    try:
        tok = sp_token_request({"grant_type": "refresh_token", "refresh_token": r["refresh"], "client_id": sp_client_id()})
    except ApiError:
        return None
    sp_save_tokens(uid, tok, r["refresh"])
    return tok.get("access_token")


def sp_begin(uid):
    cid, redirect = sp_client_id(), sp_redirect()
    if not cid or not redirect:
        raise ApiError(0, "El administrador aún no ha configurado Spotify (Client ID y dirección de redirección).")
    verifier = secrets.token_urlsafe(64)[:96]
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    state = secrets.token_urlsafe(24)
    with _SP_LOCK:
        now = time.time()
        for k in [k for k, v in _SP_PENDING.items() if v[2] < now]:
            del _SP_PENDING[k]
        _SP_PENDING[state] = (uid, verifier, now + 900)
    return "https://accounts.spotify.com/authorize?" + urlencode({
        "client_id": cid, "response_type": "code", "redirect_uri": redirect, "scope": SP_SCOPE,
        "state": state, "code_challenge_method": "S256", "code_challenge": challenge})


def sp_finish(code, state):
    with _SP_LOCK:
        pend = _SP_PENDING.pop(state, None)
    if not pend or pend[2] < time.time():
        raise ApiError(0, "La conexión con Spotify ha caducado o no es válida; pulsa «Conectar Spotify» otra vez.")
    tok = sp_token_request({"grant_type": "authorization_code", "code": code, "redirect_uri": sp_redirect(),
                            "client_id": sp_client_id(), "code_verifier": pend[1]})
    sp_save_tokens(pend[0], tok)
    return pend[0]


def sp_get(path, token, params=None):
    """GET a la API de Spotify. Devuelve (estado_http, json)."""
    url = "https://api.spotify.com/v1/" + path + ("?" + urlencode(params) if params else "")
    req = Request(url, headers={"Authorization": "Bearer " + token, "Accept": "application/json",
                                "User-Agent": "Zinctify/%s" % SERVER_VERSION})
    try:
        with urlopen(req, timeout=20) as resp:
            return resp.status, json.loads(resp.read(4 << 20).decode("utf-8", "replace"))
    except HTTPError as e:
        if e.code == 429:
            time.sleep(min(int(e.headers.get("Retry-After") or 2), 10))
        try:
            err = json.loads(e.read(4096).decode("utf-8", "replace")).get("error")
            err = err.get("message") if isinstance(err, dict) else err
        except Exception:
            err = ""
        return e.code, {"_err": str(err or "")[:140]}
    except Exception as e:
        raise MetaError("api.spotify.com: %s" % str(e)[:120])


def sp_track(t):
    if not isinstance(t, dict) or not t.get("name"):
        return None
    artists = ", ".join(a.get("name", "") for a in (t.get("artists") or []) if isinstance(a, dict))
    return track(t["name"], artists, (t.get("duration_ms") or 0) / 1000.0, (t.get("album") or {}).get("name", ""))


def import_spotify_api(kind, sid, token):
    """Lee una playlist o album completo con la sesion del usuario.
    Devuelve (titulo, canciones) o None; en _ctx.sp_diag deja los codigos HTTP que dio Spotify."""
    diag = _ctx.sp_diag = []
    title = ""
    if kind == "playlist":
        st, meta = sp_get("playlists/" + sid, token, {"fields": "name"})
        diag.append("playlist %d%s" % (st, (" «%s»" % meta["_err"]) if st != 200 and meta.get("_err") else ""))
        title = meta.get("name") or "" if st == 200 else ""
        endpoints = ["playlists/%s/items" % sid, "playlists/%s/tracks" % sid]
    else:
        st, meta = sp_get("albums/" + sid, token)
        diag.append("álbum %d%s" % (st, (" «%s»" % meta["_err"]) if st != 200 and meta.get("_err") else ""))
        title = meta.get("name") or "" if st == 200 else ""
        endpoints = ["albums/%s/tracks" % sid]
    for endpoint in endpoints:
        out, offset, retries, ok = [], 0, 0, False
        while offset < 5000:
            st, page = sp_get(endpoint, token, {"limit": 50, "offset": offset})
            if st == 429 and retries < 4:
                retries += 1
                continue
            if offset == 0:
                diag.append("%s %d%s" % (endpoint.rsplit("/", 1)[1], st, (" «%s»" % page["_err"]) if st != 200 and page.get("_err") else ""))
            if st != 200:
                if offset:
                    warn("Spotify dejó de responder tras %d canciones; faltan algunas." % len(out))
                    ok = True
                break
            ok = True
            items = page.get("items") or []
            for it in items:
                t = (it.get("item") or it.get("track") or it) if isinstance(it, dict) else None
                tr = sp_track(t)
                if tr:
                    if kind == "album" and not tr["album"]:
                        tr["album"] = title
                    out.append(tr)
            offset += len(items)
            if not items or not page.get("next"):
                break
        if ok and out:
            return title or "Spotify", out
    return None


def import_spotify(url):
    m = re.search(r"open\.spotify\.com/(?:intl-[a-z]+/)?(playlist|album)/([A-Za-z0-9]+)", url)
    if not m:
        raise ApiError(0, "Enlace de Spotify no válido (usa el de una playlist o un álbum).")
    uid = getattr(_ctx, "uid", None)
    token = sp_user_token(uid) if uid and sp_client_id() else None
    if token:
        got = import_spotify_api(m.group(1), m.group(2), token)
        if got and got[1]:
            return got
        warn("Con tu sesión de Spotify no he podido leer esa lista [respuestas de Spotify: %s]. Spotify solo deja leer completas las tuyas "
             "o en las que colaboras; guárdala primero como copia en tu biblioteca de Spotify. Uso el método limitado a 100 canciones."
             % ", ".join(getattr(_ctx, "sp_diag", []) or ["sin respuesta"]))
    html = http_page("https://open.spotify.com/embed/%s/%s" % (m.group(1), m.group(2)))
    mm = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if not mm:
        raise ApiError(0, "Spotify no ha devuelto la lista (puede que la playlist sea privada o que Spotify haya cambiado su página).")
    data = json.loads(mm.group(1))
    entity = find_key(data, "entity") or data
    items = find_key(entity, "trackList") or find_key(data, "trackList") or []
    title = (entity.get("name") or entity.get("title") or "") if isinstance(entity, dict) else ""
    out = [track(t.get("title"), t.get("subtitle"), (t.get("duration") or 0) / 1000.0) for t in items if isinstance(t, dict) and t.get("title")]
    if len(out) >= 100:
        warn("Spotify solo deja leer las primeras 100 canciones de una playlist sin iniciar sesión, y esta tiene al menos 100: puede que falten más. "
             "Para importarla entera, expórtala a CSV (por ejemplo con Exportify) y súbelo en «sube un archivo CSV».")
    return title or "Spotify", out


def yt_title(raw, channel):
    """Los videos de YouTube suelen llamarse 'Artista - Cancion (Official Video)'."""
    title, artist = clean_title(raw), ""
    chan = re.sub(r"\s*-\s*Topic$|VEVO$|\s*Official$", "", str(channel or ""), flags=re.I).strip()
    m = re.match(r"^(.{1,80}?)\s+[-–—]\s+(.+)$", title)
    if m:
        artist, title = m.group(1).strip(), m.group(2).strip()
    else:
        artist = chan
    return title.strip('"“”'), artist


from html import unescape as html_unescape


def yt_text(x):
    """Texto de un campo de YouTube: {simpleText}, {runs:[...]} o {content}."""
    if isinstance(x, str):
        return x
    if isinstance(x, dict):
        if x.get("simpleText"):
            return str(x["simpleText"])
        if x.get("runs"):
            return "".join(str(r.get("text", "")) for r in x["runs"] if isinstance(r, dict))
        if x.get("content"):
            return str(x["content"])
    return ""


def yt_secs(txt):
    m = re.match(r"^(?:(\d+):)?(\d{1,2}):(\d{2})$", str(txt or "").strip())
    return (int(m.group(1) or 0) * 3600 + int(m.group(2)) * 60 + int(m.group(3))) if m else None


def yt_collect(blob, out, seen):
    """Saca los videos de cualquier estructura de YouTube (la vieja playlistVideoRenderer y la nueva lockupViewModel)."""
    def add(vid, raw, chan, dur):
        raw = str(raw or "").strip()
        if not raw or raw in ("[Deleted video]", "[Private video]", "Deleted video", "Private video") or (vid and vid in seen):
            return
        if vid:
            seen.add(vid)
        t, a = yt_title(raw, chan)
        tr = track(t, a, dur)
        tr["hint"] = "%s %s" % (raw, chan)
        out.append(tr)

    for key in ("playlistVideoRenderer", "playlistPanelVideoRenderer", "videoRenderer", "compactVideoRenderer"):
        for r in find_all(blob, key):
            if not isinstance(r, dict):
                continue
            chan = yt_text(r.get("shortBylineText") or r.get("longBylineText") or r.get("ownerText") or r.get("bylineText"))
            dur = r.get("lengthSeconds") or yt_secs(yt_text(r.get("lengthText")))
            add(r.get("videoId"), yt_text(r.get("title")), chan, dur)
    for r in find_all(blob, "lockupViewModel"):
        if not isinstance(r, dict) or "VIDEO" not in str(r.get("contentType", "VIDEO")).upper() or "PLAYLIST" in str(r.get("contentType", "")).upper():
            continue
        md = (r.get("metadata") or {}).get("lockupMetadataViewModel") or {}
        chan = ""
        for row in find_all(md, "metadataParts"):
            for part in row if isinstance(row, list) else []:
                chan = yt_text((part or {}).get("text"))
                if chan:
                    break
            if chan:
                break
        dur = None
        for txt in find_all(r.get("contentImage") or {}, "text"):
            dur = yt_secs(yt_text(txt) if not isinstance(txt, str) else txt)
            if dur:
                break
        add(r.get("contentId"), yt_text(md.get("title")), chan, dur)


def yt_rss(pid):
    """Plan B: el feed RSS publico de la lista (solo da las ultimas 15, pero casi nunca falla)."""
    xml = http_page("https://www.youtube.com/feeds/videos.xml?playlist_id=" + pid)
    title = re.search(r"<title>([^<]*)</title>", xml)
    out = []
    for ent in re.findall(r"<entry>(.*?)</entry>", xml, re.S):
        t = re.search(r"<title>([^<]*)</title>", ent)
        au = re.search(r"<author>\s*<name>([^<]*)</name>", ent)
        if t:
            raw = html_unescape(t.group(1))
            chan = html_unescape(au.group(1)) if au else ""
            tt, aa = yt_title(raw, chan)
            tr = track(tt, aa)
            tr["hint"] = "%s %s" % (raw, chan)
            out.append(tr)
    return html_unescape(title.group(1)) if title else "YouTube", out


def import_youtube(url):
    m = re.search(r"[?&]list=([A-Za-z0-9_-]+)", url)
    if not m:
        raise ApiError(0, "Enlace de YouTube no válido (tiene que ser una lista de reproducción).")
    pid = m.group(1)
    diag = []
    html = ""
    data = None
    try:
        html = http_page("https://www.youtube.com/playlist?list=%s&hl=en&gl=US" % pid)
    except MetaError as e:
        diag.append("página: %s" % e)
    mm = re.search(r"ytInitialData\s*=\s*", html)
    if mm:
        try:
            data = json.JSONDecoder().raw_decode(html[mm.end():])[0]
        except ValueError:
            data = None
    if html and not data:
        diag.append("sin datos en la página (%d bytes%s)" % (len(html), ", pide aceptar cookies" if "consent." in html[:3000] or "CONSENT" in html[:3000] else ""))
    title = "YouTube"
    out, seen = [], set()
    token = None
    key = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', html)
    ver = re.search(r'"INNERTUBE_CLIENT_VERSION":"([^"]+)"', html)
    vd = re.search(r'"VISITOR_DATA":"([^"]+)"', html) or re.search(r'"visitorData":"([^"]+)"', html)
    client = {"clientName": "WEB", "clientVersion": ver.group(1) if ver else "2.20250101.00.00", "hl": "en", "gl": "US"}
    if vd:
        client["visitorData"] = vd.group(1)

    def browse(body):
        url2 = "https://www.youtube.com/youtubei/v1/browse" + ("?key=" + key.group(1) if key else "")
        return json.loads(http_page(url2, data=json.dumps(body).encode(), headers={
            "Content-Type": "application/json", "Origin": "https://www.youtube.com",
            "X-Youtube-Client-Name": "1", "X-Youtube-Client-Version": client["clientVersion"]}))

    if data:
        t0 = find_key(data, "playlistHeaderRenderer") or find_key(data, "pageHeaderViewModel") or {}
        title = yt_text(find_key(t0, "title")) or yt_text((find_key(data, "microformatDataRenderer") or {}).get("title")) or "YouTube"
        yt_collect(data, out, seen)
        cc0 = find_all(data, "continuationCommand")
        token = cc0[0].get("token") if cc0 else None
    if not out:                                                   # la pagina no trae videos: se pide la lista directamente
        try:
            more = browse({"context": {"client": client}, "browseId": "VL" + pid})
            yt_collect(more, out, seen)
            cc0 = find_all(more, "continuationCommand")
            token = cc0[0].get("token") if cc0 else None
            if title == "YouTube":
                title = yt_text(find_key(find_key(more, "playlistHeaderRenderer") or {}, "title")) or title
            if not out:
                diag.append("la API no devolvió videos")
        except (MetaError, ValueError) as e:
            diag.append("API: %s" % str(e)[:80])
    pages, fail = 0, ""
    while token and pages < 60:                                   # cada trozo trae ~100; el resto se pide aparte
        pages += 1
        try:
            more = browse({"context": {"client": client}, "continuation": token})
        except (MetaError, ValueError) as e:
            fail = str(e)[:100]
            break
        before = len(out)
        yt_collect(more, out, seen)
        cc = find_all(more, "continuationCommand")
        token = cc[0].get("token") if cc and len(out) > before else None
    if not out:                                                   # plan B: feed RSS
        try:
            t2, out = yt_rss(pid)
            if out:
                title = t2 if title == "YouTube" else title
                warn("YouTube no ha dejado leer la lista completa; solo he podido coger las últimas %d canciones. "
                     "Si hay más, pega la lista como texto o sube un CSV." % len(out))
        except MetaError as e:
            diag.append("RSS: %s" % str(e)[:80])
    if not out:
        raise ApiError(0, "YouTube no ha devuelto ninguna canción de esa lista. ¿Es privada? Tiene que ser pública o «no listada». [%s]" % "; ".join(diag or ["sin detalles"]))
    if token:
        warn("YouTube solo ha dejado leer %d canciones (la lista tiene más)%s. Prueba de nuevo más tarde o pega la lista como texto." % (len(out), " — " + fail if fail else ""))
    return str(title or "YouTube"), out


def import_soundcloud(url):
    html = http_page(url)
    hyd = json_after(html, "window.__sc_hydration =")
    if not isinstance(hyd, list):
        raise ApiError(0, "SoundCloud no ha devuelto la lista (¿es privada, o ha cambiado la página?).")
    pl = next((x.get("data") for x in hyd if x.get("hydratable") in ("playlist", "systemPlaylist")), None)
    cid = next(((x.get("data") or {}).get("id") for x in hyd if x.get("hydratable") == "apiClient"), None)
    if not pl:
        raise ApiError(0, "Ese enlace de SoundCloud no es una playlist.")
    tracks = pl.get("tracks") or []
    full = {t["id"]: t for t in tracks if t.get("title")}
    missing = [t["id"] for t in tracks if t.get("id") and t["id"] not in full]
    for i in range(0, len(missing), 30):                          # las que vienen "a medias" se piden por lotes
        if not cid:
            break
        try:
            more = http_json("https://api-v2.soundcloud.com/tracks?" + urlencode({"ids": ",".join(map(str, missing[i:i + 30])), "client_id": cid}))
        except MetaError:
            break
        for t in more if isinstance(more, list) else []:
            full[t.get("id")] = t
    out = []
    lost = 0
    for t in tracks:
        t = full.get(t.get("id"))
        if not t:
            lost += 1
            continue
        artist = (t.get("publisher_metadata") or {}).get("artist") or (t.get("user") or {}).get("username") or ""
        title = t.get("title") or ""
        mm = re.match(r"^(.{1,80}?)\s+[-–—]\s+(.+)$", title)
        if mm:
            artist, title = mm.group(1), mm.group(2)
        out.append(track(clean_title(title), artist, (t.get("duration") or 0) / 1000.0))
    if lost:
        warn("SoundCloud no ha dado los datos de %d canciones (privadas o borradas, o no se pudo pedir el resto)." % lost)
    return pl.get("title") or "SoundCloud", out


def import_deezer(url):
    m = re.search(r"deezer\.com/(?:[a-z]{2}/)?(playlist|album)/(\d+)", url)
    if not m:
        raise ApiError(0, "Enlace de Deezer no válido.")
    kind, ident = m.groups()
    info = http_json("https://api.deezer.com/%s/%s" % (kind, ident))
    out, nxt = [], "https://api.deezer.com/%s/%s/tracks?limit=100" % (kind, ident)
    while nxt and len(out) < 100000:
        page = http_json(nxt)
        for t in page.get("data", []):
            out.append(track(t.get("title"), (t.get("artist") or {}).get("name"), t.get("duration"), (t.get("album") or {}).get("title")))
        nxt = page.get("next")
    if nxt:
        warn("Deezer: se han leído solo las primeras %d canciones." % len(out))
    return info.get("title") or "Deezer", out


def import_text(text):
    """Una cancion por linea ('Artista - Titulo') o un CSV con columnas de titulo y artista (p. ej. el de Exportify)."""
    import csv
    import io
    lines = [ln for ln in str(text).lstrip("\ufeff").splitlines() if ln.strip()]
    if not lines:
        return "", []
    out = []
    if "," in lines[0] or ";" in lines[0] or "\t" in lines[0]:
        sep = max(",;\t", key=lines[0].count)
        rows = list(csv.reader(io.StringIO("\n".join(lines)), delimiter=sep))
        head = [c.strip().lower() for c in rows[0]]
        def col(*names):
            for n in names:
                for i, c in enumerate(head):
                    if c == n or c.startswith(n):
                        return i
            return None
        ti, ai = col("track name", "title", "song", "name", "titulo", "título", "canción", "cancion"), col("artist name", "artist", "artista")
        if ti is not None and ai is not None:
            di, bi = col("duration (ms)", "duration_ms", "duration"), col("album name", "album", "álbum")
            for r in rows[1:]:
                if len(r) > max(ti, ai) and r[ti].strip():
                    dur = None
                    if di is not None and di < len(r) and r[di].strip().replace(".", "").isdigit():
                        dur = float(r[di]) / (1000.0 if float(r[di]) > 1000 else 1.0)
                    out.append(track(r[ti], split_names(r[ai])[0] if split_names(r[ai]) else r[ai], dur, r[bi] if bi is not None and bi < len(r) else ""))
            return "", out
    for ln in lines:
        ln = re.sub(r"^\s*\d+[\.\)]\s+", "", ln.strip())
        m = re.match(r"^(.+?)\s+[-–—]\s+(.+)$", ln)
        out.append(track(m.group(2), m.group(1)) if m else track(ln))
    return "", out


def import_source(url):
    host = (urlparse(url).netloc or "").lower()
    if "spotify." in host:
        return "spotify", import_spotify(url)
    if "youtube." in host or "youtu.be" in host:
        return "youtube", import_youtube(url)
    if "soundcloud." in host:
        return "soundcloud", import_soundcloud(url)
    if "deezer." in host:
        return "deezer", import_deezer(url)
    raise ApiError(0, "No reconozco ese enlace. Funcionan Spotify, YouTube, SoundCloud y Deezer; o pega la lista como texto.")


# ---- emparejar con la biblioteca ----

VERSION_WORDS = ("live", "en vivo", "remix", "acoustic", "acústica", "instrumental", "karaoke", "cover", "demo", "slowed", "sped up", "nightcore")


def version_flags(t):
    low = str(t).lower()
    return {w for w in VERSION_WORDS if re.search(r"\b" + re.escape(w) + r"\b", low)}


def score_song(row, title, artist, duration, hint=""):
    ts = text_sim(clean_title(title), clean_title(row["title"]))
    names = [row["artist_name"]] + split_names(row["artist_name"])
    src = split_names(artist) or ([artist] if artist else [])
    if src:
        asim = 0.0
        for a in src:
            for n in names:
                ka, kn = fuzz_key(a), fuzz_key(n)
                s = text_sim(a, n)
                if len(ka) >= 3 and len(kn) >= 3 and (ka in kn or kn in ka):
                    s = max(s, 0.92)
                asim = max(asim, s)
    else:
        asim = 0.0
    if asim < 0.7 and hint and fuzz_key(row["artist_name"]) and fuzz_key(row["artist_name"]) in fuzz_key(hint):
        asim = max(asim, 0.9)                                      # el nombre del artista aparece en el titulo del video
    if not src and not hint:
        asim = 0.6
    pen = 0.0
    if duration and row["duration"] and abs(duration - row["duration"]) > 12:
        pen += 0.2
    if version_flags(title) != version_flags(row["title"]):
        pen += 0.25
    score = 0.65 * ts + 0.35 * asim - pen
    return score, ts, asim


_title_map = {"sig": None, "map": {}}


def title_map():
    """clave de titulo limpio -> ids de canciones. Se construye una vez por cambio de biblioteca (no una vez por cancion)."""
    ix = search_indexes()
    if _title_map["sig"] is not None and _title_map["sig"] == ix["sig"]:
        return _title_map["map"]
    m = {}
    for sid, title in db().execute("SELECT id, title FROM songs"):
        m.setdefault(fuzz_key(clean_title(title)), []).append(sid)
    _title_map.update(sig=ix["sig"], map=m)
    return m


def _accept(row, tr):
    a, b = fuzz_key(clean_title(tr["title"])), fuzz_key(clean_title(row["title"]))
    if a != b and difflib.SequenceMatcher(None, a, b).quick_ratio() < 0.82:
        return 0.0                      # el titulo ni de lejos se parece: no hace falta puntuar el resto
    score, ts, asim = score_song(row, tr["title"], tr.get("artist", ""), tr.get("duration"), tr.get("hint", ""))
    return score if (ts >= 0.82 and asim >= 0.55 and score >= 0.78) else 0.0


def match_track(tr):
    """Devuelve (song_id o None, puntuacion). Primero por titulo exacto (casi instantaneo); la busqueda difusa solo si no hay ninguna con ese titulo."""
    title, artist = tr["title"], tr.get("artist", "")
    ids = title_map().get(fuzz_key(clean_title(title)))
    if ids:
        best, best_score = None, 0.0
        for row in _songs_rows(ids[:200]):
            sc = _accept(row, tr)
            if sc > best_score:
                best, best_score = row["id"], sc
        if best:
            return best, best_score
        return None, 0.0         # el titulo existe pero de otro artista: la busqueda difusa no encontraria nada mejor
    queries = list(dict.fromkeys(q for q in ("%s %s" % (artist, clean_title(title)), clean_title(title), "%s %s" % (artist, title)) if q.strip()))
    seen, best, best_score = set(), None, 0.0
    for q in queries:
        if best_score >= 0.95:
            break
        try:
            _, _, songs = run_search(q.strip(), 0, 0, 15, squash=False)
        except Exception:
            continue
        for row in songs:
            if row["id"] in seen:
                continue
            seen.add(row["id"])
            sc = _accept(row, tr)
            if sc > best_score:
                best, best_score = row["id"], sc
    return best, best_score


def _songs_rows(ids):
    return db().execute(SONG_SELECT + " WHERE s.id IN (%s)" % ",".join("?" * len(ids)), list(ids)).fetchall()


def track_key(tr):
    first = (split_names(tr.get("artist")) or [""])[0]
    return fuzz_key(clean_title(tr["title"])) + "|" + fuzz_key(first)


def link_entry(tr, song_id=None):
    e = {"k": track_key(tr), "t": tr["title"], "a": tr.get("artist", ""), "d": tr.get("duration"), "s": song_id}
    if tr.get("hint"):
        e["h"] = tr["hint"]
    return e


def apply_matches(pid, entries, progress=None):
    """Empareja los que aun no tienen cancion y anade al final de la playlist las nuevas (sin repetir). Devuelve cuantas anadio."""
    conn = db()
    have = {r[0] for r in conn.execute("SELECT song_id FROM playlist_songs WHERE playlist_id=?", (pid,))}
    added = []
    for n, e in enumerate(entries):
        if progress and n % 10 == 0:
            progress(n, len(entries))
        if e.get("s") is None and not e.get("tried"):
            sid, _ = match_track({"title": e["t"], "artist": e["a"], "duration": e["d"], "hint": e.get("h", "")})
            if sid:
                e["s"] = sid
                if sid not in have:
                    added.append(sid)
                    have.add(sid)
    if progress:
        progress(len(entries), len(entries))
    append_songs(pid, added)
    return len(added)


def entries_stats(entries):
    return {"total": len(entries), "matched": sum(1 for e in entries if e.get("s")),
            "unmatchedTotal": sum(1 for e in entries if not e.get("s")),
            "unmatched": [{"title": e["t"], "artist": e["a"]} for e in entries if not e.get("s")][:500]}


_link_lock = threading.Lock()


def sync_link(pid, fetch=True):
    """Pone al dia una playlist vinculada: canciones nuevas del origen + intento de nuevo con las que faltaban."""
    with _link_lock:
        conn = db()
        lk = conn.execute("SELECT * FROM playlist_links WHERE playlist_id=?", (pid,)).fetchone()
        if not lk or not playlist_row(pid):
            return None
        entries = json.loads(lk["tracks"] or "[]")
        status = "ok"
        if fetch and lk["url"]:                       # los CSV y listas de texto no tienen origen en internet: solo se vuelven a emparejar
            try:
                _ctx.uid = playlist_row(pid)["owner_id"]
                _, (_, src) = import_source(lk["url"])
                known = {e["k"] for e in entries}
                for tr in src:
                    if tr["title"] and track_key(tr) not in known:
                        entries.append(link_entry(tr))
                        known.add(track_key(tr))
            except (MetaError, ApiError) as e:
                status = "error: %s" % (e.message if isinstance(e, ApiError) else e)
                take_warnings()
        for w in take_warnings():
            if status == "ok":
                status = "aviso: " + w
        added = apply_matches(pid, entries)
        conn.execute("UPDATE playlist_links SET tracks=?, last_sync=?, status=? WHERE playlist_id=?",
                     (json.dumps(entries, ensure_ascii=False), int(time.time()) if fetch and not status.startswith("error") else lk["last_sync"], status, pid))
        conn.commit()
        return dict(entries_stats(entries), added=added, status=status)


def rematch_all_links():
    """Tras un escaneo: si llegaron canciones que antes faltaban, se anaden a las playlists vinculadas (sin tocar internet)."""
    try:
        for r in db().execute("SELECT playlist_id FROM playlist_links WHERE tracks LIKE '%\"s\": null%'").fetchall():
            sync_link(r[0], fetch=False)
    except Exception:
        log("Error al emparejar playlists vinculadas:\n%s" % traceback.format_exc())


def link_sync_loop():
    while True:
        time.sleep(600)
        try:
            hours = float(get_setting("import_sync_hours", "6") or 6)
            if hours <= 0:
                continue
            due = int(time.time() - hours * 3600)
            for r in db().execute("SELECT playlist_id FROM playlist_links WHERE auto=1 AND last_sync < ?", (due,)).fetchall():
                sync_link(r[0])
                time.sleep(3)
        except Exception:
            log("Error sincronizando playlists vinculadas:\n%s" % traceback.format_exc())


def link_info(pid):
    lk = db().execute("SELECT * FROM playlist_links WHERE playlist_id=?", (pid,)).fetchone()
    if not lk:
        return None
    return dict(entries_stats(json.loads(lk["tracks"] or "[]")), source=lk["source"], url=lk["url"], title=lk["title"],
                auto=bool(lk["auto"]), lastSync=lk["last_sync"], status=lk["status"])


IMPORT_MAX = 100000                 # tope de seguridad, no un limite practico
IMPORT_JOBS = {}
IMPORT_LOCK = threading.Lock()


def run_import(me, data, progress=None):
    """Lee la lista (enlace o texto), crea la playlist y empareja cada cancion con la biblioteca."""
    url = str(data.get("url") or "").strip()
    text = str(data.get("text") or "")
    if url and not re.match(r"^https?://", url):
        raise ApiError(0, "Pega un enlace que empiece por http:// o https://")
    if not url and not text.strip():
        raise ApiError(0, "Pega un enlace o una lista de canciones.")
    take_warnings()
    _ctx.uid = me["id"]
    if progress:
        progress("reading", 0, 0)
    try:
        if url:
            source, (ext_title, src) = import_source(url)
        else:
            source, (ext_title, src) = "text", import_text(text)
    except MetaError as e:
        raise ApiError(0, "No he podido leer esa playlist: %s" % e)
    src = [t for t in src if t["title"]]
    if len(src) > IMPORT_MAX:
        warn("La lista tiene %d canciones; se importan las primeras %d." % (len(src), IMPORT_MAX))
        src = src[:IMPORT_MAX]
    if not src:
        raise ApiError(0, "No he encontrado canciones en eso.")
    name = (str(data.get("name") or "").strip() or ext_title or "Playlist importada")[:100]
    pid = create_playlist(me, name)
    entries, seen = [], set()
    for tr in src:
        k = track_key(tr)
        if k not in seen:
            seen.add(k)
            entries.append(link_entry(tr))
    if progress:
        progress("matching", 0, len(entries))
        title_map()                                # se prepara el indice una vez, antes de empezar a contar
    apply_matches(pid, entries, (lambda d, n: progress("matching", d, n)) if progress else None)
    conn = db()
    if progress:
        progress("saving", len(entries), len(entries))
    # tambien se vincula la lista pegada o el CSV: se guarda para volver a emparejar cuando lleguen canciones nuevas al servidor
    conn.execute("INSERT INTO playlist_links(playlist_id, source, url, title, auto, last_sync, status, tracks) VALUES(?,?,?,?,1,?,?,?)",
                 (pid, source, url, ext_title, int(time.time()), "ok", json.dumps(entries, ensure_ascii=False)))
    conn.commit()
    res = entries_stats(entries)
    res.update(playlist=playlist_info(me, playlist_row(pid)), source=source, linked=True, warnings=take_warnings())
    return res


@web_route("POST", "import/playlist")
def web_import_playlist(h, data):
    return run_import(logged_in(h), data)


@web_route("POST", "import/start")
def web_import_start(h, data):
    """Empieza la importacion en segundo plano y devuelve un id para ir preguntando por el progreso."""
    me = logged_in(h)
    now = time.time()
    with IMPORT_LOCK:
        for k in [k for k, j in IMPORT_JOBS.items() if now - j["updated"] > 3600]:
            del IMPORT_JOBS[k]
        if sum(1 for j in IMPORT_JOBS.values() if j["user"] == me["id"] and j["state"] == "running") >= 2:
            raise ApiError(0, "Ya tienes importaciones en marcha; espera a que terminen.")
        jid = secrets.token_hex(8)
        job = {"user": me["id"], "state": "running", "phase": "reading", "done": 0, "total": 0, "t0": now, "tm": None, "updated": now}
        IMPORT_JOBS[jid] = job

    def progress(phase, done, total):
        t = time.time()
        if phase == "matching" and job["tm"] is None:
            job["tm"] = t
        job.update(phase=phase, done=done, total=total, updated=t)
        if phase == "matching":
            sm = job.setdefault("samples", [])
            sm.append((t, done))
            while len(sm) > 2 and t - sm[1][0] > 20:      # el tiempo estimado usa solo los ultimos ~20 s (no todo el historial)
                sm.pop(0)

    def work():
        try:
            job["result"] = run_import(me, data, progress)
            job["state"] = "done"
        except ApiError as e:
            job.update(state="error", error=e.message)
        except Exception:
            log("Error importando playlist:\n%s" % traceback.format_exc())
            job.update(state="error", error="Error interno del servidor")
        job["updated"] = time.time()

    threading.Thread(target=work, daemon=True).start()
    return {"job": jid}


@web_route("POST", "import/progress")
def web_import_progress(h, data):
    me = logged_in(h)
    job = IMPORT_JOBS.get(str(data.get("job") or ""))
    if not job or job["user"] != me["id"]:
        raise ApiError(70, "Esa importación ya no existe")
    now = time.time()
    out = {"state": job["state"], "phase": job["phase"], "done": job["done"], "total": job["total"], "elapsed": round(now - job["t0"], 1)}
    sm = job.get("samples") or []
    if job["state"] == "running" and len(sm) >= 2 and sm[-1][1] > sm[0][1] and sm[-1][0] - sm[0][0] >= 2:
        rate = (sm[-1][0] - sm[0][0]) / (sm[-1][1] - sm[0][1])       # segundos por cancion, reciente
        out["eta"] = round(rate * (job["total"] - job["done"]))      # segundos que faltan
    if job["state"] == "done":
        out["result"] = job["result"]
    elif job["state"] == "error":
        out["error"] = job["error"]
    return out


@web_route("POST", "import/link")
def web_import_link(h, data):
    me = logged_in(h)
    pl = own_playlist(me, parse_pl(data.get("id")))
    return {"link": link_info(pl["id"])}


@web_route("POST", "import/sync")
def web_import_sync(h, data):
    me = logged_in(h)
    pl = own_playlist(me, parse_pl(data.get("id")))
    if not db().execute("SELECT 1 FROM playlist_links WHERE playlist_id=?", (pl["id"],)).fetchone():
        raise ApiError(0, "Esa playlist no está vinculada a ningún servicio.")
    res = sync_link(pl["id"])
    return {"link": link_info(pl["id"]), "added": res["added"] if res else 0}


@web_route("POST", "import/unlink")
def web_import_unlink(h, data):
    me = logged_in(h)
    pl = own_playlist(me, parse_pl(data.get("id")))
    db().execute("DELETE FROM playlist_links WHERE playlist_id=?", (pl["id"],))
    db().commit()
    return {"ok": True}


@web_route("POST", "import/auto")
def web_import_auto(h, data):
    me = logged_in(h)
    pl = own_playlist(me, parse_pl(data.get("id")))
    db().execute("UPDATE playlist_links SET auto=? WHERE playlist_id=?", (1 if data.get("auto") else 0, pl["id"]))
    db().commit()
    return {"link": link_info(pl["id"])}


def sp_status(me):
    row = db().execute("SELECT 1 FROM spotify_tokens WHERE user_id=?", (me["id"],)).fetchone()
    return {"ready": bool(sp_client_id() and sp_redirect()), "connected": bool(row)}


@web_route("POST", "spotify/status")
def web_spotify_status(h, data):
    return sp_status(logged_in(h))


@web_route("POST", "spotify/start")
def web_spotify_start(h, data):
    return {"url": sp_begin(logged_in(h)["id"])}


@web_route("POST", "spotify/paste")
def web_spotify_paste(h, data):
    """Alternativa: pegar la direccion a la que Spotify ha redirigido (si la pagina no cargo)."""
    me = logged_in(h)
    q = parse_qs(urlparse(str(data.get("url") or "").strip()).query)
    code, state = (q.get("code") or [""])[0], (q.get("state") or [""])[0]
    if not code or not state:
        raise ApiError(0, "Esa dirección no contiene el código de Spotify (debe tener «code=» y «state=»).")
    with _SP_LOCK:
        pend = _SP_PENDING.get(state)
    if not pend or pend[0] != me["id"]:
        raise ApiError(0, "La conexión con Spotify ha caducado o no es válida; pulsa «Conectar Spotify» otra vez.")
    sp_finish(code, state)
    return sp_status(me)


@web_route("POST", "spotify/disconnect")
def web_spotify_disconnect(h, data):
    me = logged_in(h)
    db().execute("DELETE FROM spotify_tokens WHERE user_id=?", (me["id"],))
    db().commit()
    return sp_status(me)


@web_route("POST", "admin/spotify/config")
def web_admin_spotify_config(h, data):
    admin_only(h)
    if "clientId" in data:
        set_setting("spotify_id", str(data.get("clientId") or "").strip()[:100])
    if "redirect" in data:
        r = str(data.get("redirect") or "").strip()[:300]
        if r and not re.match(r"^(https://|http://(127\.0\.0\.1|\[::1\])(:\d+)?/)", r):
            raise ApiError(0, "La dirección debe empezar por https:// (o http://127.0.0.1). Spotify no acepta otras.")
        set_setting("spotify_redirect", r)
    return {"clientId": sp_client_id(), "redirect": sp_redirect()}


@web_route("GET", "admin/spotify/config")
def web_admin_spotify_get(h, data):
    admin_only(h)
    return {"clientId": sp_client_id(), "redirect": sp_redirect()}


@web_route("POST", "admin/import/config")
def web_admin_import_config(h, data):
    admin_only(h)
    if "hours" in data:
        try:
            hours = max(0.0, min(float(data["hours"]), 720.0))
        except (TypeError, ValueError):
            raise ApiError(0, "Número de horas no válido")
        set_setting("import_sync_hours", str(hours))
    return {"hours": float(get_setting("import_sync_hours", "6") or 6)}


# ---- descargas del cliente de escritorio ----
# Los instaladores se dejan en <datos>/downloads/ (un .exe para Windows y un .AppImage para Linux).
DOWNLOAD_KINDS = {"windows": ".exe", "linux": ".appimage", "android": ".apk"}


def downloads_dir():
    return os.path.join(CFG.data_dir, "downloads")


def find_download(kind):
    """Instalador mas reciente de esa plataforma, o None."""
    ext = DOWNLOAD_KINDS.get(kind)
    folder = downloads_dir()
    if not ext or not os.path.isdir(folder):
        return None
    best = None
    for name in os.listdir(folder):
        full = os.path.join(folder, name)
        if name.lower().endswith(ext) and os.path.isfile(full):
            mt = os.path.getmtime(full)
            if not best or mt > best[0]:
                best = (mt, name, full)
    return best


@web_route("GET", "downloads")
def web_downloads(h, data):
    out = {}
    for kind in DOWNLOAD_KINDS:
        b = find_download(kind)
        m = re.search(r"(\d+)\.(\d+)\.(\d+)", b[1]) if b else None
        out[kind] = {"name": b[1], "size": os.path.getsize(b[2]), "version": m.group(0) if m else ""} if b else None
    return out


def serve_download(handler, kind):
    b = find_download(kind)
    if not b:
        return handler.send_bytes(404, "text/plain; charset=utf-8", b"No hay instalador para esa plataforma en este servidor.\n")
    size = os.path.getsize(b[2])
    handler.send_response(200)
    handler.send_header("Content-Type", "application/vnd.android.package-archive" if kind == "android" else "application/octet-stream")
    handler.send_header("Content-Length", str(size))
    handler.send_header("Content-Disposition", 'attachment; filename="%s"' % b[1].replace('"', ""))
    handler.send_header("X-Content-Type-Options", "nosniff")
    handler.end_headers()
    handler._started = True
    if handler.command == "HEAD":
        return
    with open(b[2], "rb") as f:
        while True:
            chunk = f.read(1 << 20)
            if not chunk:
                break
            handler.wfile.write(chunk)


UPDATE_TYPES = {".yml": "text/yaml; charset=utf-8", ".exe": "application/octet-stream", ".appimage": "application/octet-stream",
                ".blockmap": "application/octet-stream"}


def serve_update(handler, path):
    """Archivos de actualizacion del cliente de escritorio (latest.yml, latest-linux.yml e instaladores) de la carpeta downloads."""
    name = unquote(path[len("/updates/"):])
    ext = os.path.splitext(name)[1].lower()
    full = os.path.join(downloads_dir(), name)
    if (not re.match(r"^[A-Za-z0-9._ +()-]+$", name) or ".." in name or ext not in UPDATE_TYPES
            or not os.path.isfile(full)):
        return handler.send_bytes(404, "text/plain; charset=utf-8", b"No encontrado\n")
    size = os.path.getsize(full)
    handler.send_response(200)
    handler.send_header("Content-Type", UPDATE_TYPES[ext])
    handler.send_header("Content-Length", str(size))
    handler.send_header("Cache-Control", "no-cache")
    handler.send_header("X-Content-Type-Options", "nosniff")
    handler.end_headers()
    handler._started = True
    if handler.command == "HEAD":
        return
    with open(full, "rb") as f:
        while True:
            chunk = f.read(1 << 20)
            if not chunk:
                break
            handler.wfile.write(chunk)


# ---- biblioteca del usuario (el corazon): playlists, albumes y artistas guardados ----

def library_target(me, kind, raw_id):
    """Comprueba que existe (y que se puede ver) y devuelve su id numerico."""
    if kind == "playlist":
        pl = visible_playlist(me, parse_pl(raw_id))
        return pl["id"]
    prefix = {"album": "al", "artist": "ar"}.get(kind)
    if not prefix:
        raise ApiError(0, "Accion no valida")
    iid = parse_id(str(raw_id), prefix)
    table = "albums" if kind == "album" else "artists"
    if not db().execute("SELECT 1 FROM %s WHERE id=?" % table, (iid,)).fetchone():
        raise ApiError(70, "ID no válido o no encontrado: %s" % raw_id)
    return iid


@web_route("POST", "library")
def web_library(h, data):
    me = logged_in(h)
    conn = db()
    items = []
    for r in conn.execute("SELECT * FROM library WHERE user_id=?", (me["id"],)).fetchall():
        stamp = r["last_played"] or r["saved_at"]
        pinned = bool(r["pinned"])
        if r["kind"] == "playlist":
            pl = playlist_row(r["item_id"])
            if not can_view(me, pl):
                continue
            info = playlist_info(me, pl)
            items.append({"kind": "playlist", "id": info["id"], "name": info["name"], "author": info["author"], "collaborative": info["collaborative"],
                          "cover": info["cover"], "owned": info["owned"], "public": info["public"], "stamp": stamp, "pinned": pinned})
        elif r["kind"] == "album":
            a = conn.execute("SELECT al.id, al.name, ar.name AS artist FROM albums al JOIN artists ar ON ar.id = al.artist_id "
                             "WHERE al.id=?", (r["item_id"],)).fetchone()
            if a:
                items.append({"kind": "album", "id": "al-%d" % a["id"], "name": a["name"], "author": a["artist"],
                              "coverArt": "al-%d" % a["id"], "stamp": stamp, "pinned": pinned})
        elif r["kind"] == "artist":
            a = conn.execute("SELECT id, name FROM artists WHERE id=?", (r["item_id"],)).fetchone()
            if a:
                items.append({"kind": "artist", "id": "ar-%d" % a["id"], "name": a["name"],
                              "coverArt": "ar-%d" % a["id"], "stamp": stamp, "pinned": pinned, "notify": bool(r["notify"])})
    items.sort(key=lambda x: (x["pinned"], x["stamp"]), reverse=True)   # fijadas arriba; luego lo ultimo escuchado
    return {"items": items}


@web_route("POST", "home/recommend")
def web_home_recommend(h, data):
    """Discos recomendados para la Home según lo que más escucha esta persona (artistas y géneros de los últimos 6 meses)."""
    me = logged_in(h)
    conn = db()
    since = int(time.time()) - 180 * 86400
    names = [r[0] for r in conn.execute(
        "SELECT pa.artist FROM play_artists pa JOIN plays p ON p.id = pa.play_id WHERE p.user=? AND p.ts>=? "
        "GROUP BY pa.artist ORDER BY COUNT(*) DESC LIMIT 6", (me["username"], since)).fetchall()]
    genres = [r[0] for r in conn.execute(
        "SELECT genre FROM plays WHERE user=? AND ts>=? AND genre IS NOT NULL AND genre != '' "
        "GROUP BY genre COLLATE NOCASE ORDER BY COUNT(*) DESC LIMIT 3", (me["username"], since)).fetchall()]
    if not names and not genres:
        return {"albums": [], "basedOn": []}
    art_ids = []
    for n in names:
        row = conn.execute("SELECT id FROM artists WHERE name=? COLLATE NOCASE", (n,)).fetchone()
        if row:
            art_ids.append(row[0])
    conds, args = [], []
    if art_ids:
        conds.append("al.artist_id IN (%s)" % ",".join("?" * len(art_ids)))
        args += art_ids
    if genres:
        conds.append("al.genre IN (%s) COLLATE NOCASE" % ",".join("?" * len(genres)))
        args += genres
    if not conds:
        return {"albums": [], "basedOn": names}
    # primero los discos que casi no has escuchado; dentro de eso, al azar
    rows = conn.execute(
        ALBUM_SELECT + " WHERE (" + " OR ".join(conds) + ") ORDER BY "
        "(SELECT COUNT(*) FROM plays p WHERE p.user=? AND p.ts>=? AND p.album = al.name COLLATE NOCASE) ASC, RANDOM() LIMIT 12",
        args + [me["username"], since]).fetchall()
    return {"albums": [album_json(r) for r in rows], "basedOn": names[:3] or genres}


def _songs_by_ids(ids):
    ids = list(dict.fromkeys(ids))
    out = []
    for i in range(0, len(ids), 500):
        chunk = ids[i:i + 500]
        out += db().execute(SONG_SELECT + " WHERE s.id IN (%s)" % ",".join("?" * len(chunk)), chunk).fetchall()
    by = {r["id"]: r for r in out}
    return [by[i] for i in ids if i in by]


@web_route("POST", "home/mixes")
def web_home_mixes(h, data):
    """Mixes automáticos (diario y por género) y «Redescubre». Cambian cada día pero no entre recargas."""
    me = logged_in(h)
    conn = db()
    now = int(time.time())
    rnd = random.Random("%s-%s" % (me["username"], time.strftime("%Y-%m-%d")))
    since = now - 180 * 86400
    top_genres = [r[0] for r in conn.execute(
        "SELECT genre FROM plays WHERE user=? AND ts>=? AND genre IS NOT NULL AND genre != '' "
        "GROUP BY genre COLLATE NOCASE ORDER BY COUNT(*) DESC LIMIT 3", (me["username"], since)).fetchall()]
    top_songs = [r[0] for r in conn.execute(
        "SELECT song_id FROM plays WHERE user=? AND ts>=? AND song_id IS NOT NULL GROUP BY song_id ORDER BY COUNT(*) DESC LIMIT 60",
        (me["username"], since)).fetchall()]
    mixes = []

    def add(mid, name, sub, ids):
        songs = song_list(_songs_by_ids(ids))
        if len(songs) >= 5:
            mixes.append({"id": mid, "name": name, "subtitle": sub, "songs": songs})

    # Mix diario: tus canciones más escuchadas mezcladas con otras de tus géneros
    if top_songs:
        mine = rnd.sample(top_songs, min(len(top_songs), 20))
        extra = []
        for g in top_genres:
            extra += [r[0] for r in conn.execute("SELECT id FROM songs WHERE genre=? COLLATE NOCASE", (g,)).fetchall()]
        extra = [i for i in extra if i not in set(top_songs)]
        mix = mine + rnd.sample(extra, min(len(extra), 20))
        rnd.shuffle(mix)
        add("daily", "Mix diario", "Daily Mix", mix)
    for n, g in enumerate(top_genres):
        ids = [r[0] for r in conn.execute("SELECT id FROM songs WHERE genre=? COLLATE NOCASE", (g,)).fetchall()]
        rnd.shuffle(ids)
        add("genre-%d" % n, "Mix %s" % g, "%s Mix" % g, ids[:30])
    # Redescubre: canciones que has oído varias veces pero hace más de 90 días que no suenan
    old = [r[0] for r in conn.execute(
        "SELECT song_id FROM plays WHERE user=? AND song_id IS NOT NULL GROUP BY song_id "
        "HAVING COUNT(*) >= 3 AND MAX(ts) < ? ORDER BY COUNT(*) DESC LIMIT 80", (me["username"], now - 90 * 86400)).fetchall()]
    rnd.shuffle(old)
    redis = None
    old_songs = song_list(_songs_by_ids(old[:40])) if len(old) >= 5 else []
    if len(old_songs) >= 5:
        redis = {"id": "rediscover", "name": "Redescubre", "subtitle": "Rediscover", "songs": old_songs}
    return {"mixes": mixes, "rediscover": redis}


@web_route("POST", "library/pin")
def web_library_pin(h, data):
    me = logged_in(h)
    kind = str(data.get("kind", ""))
    iid = library_target(me, kind, data.get("id"))
    conn = db()
    conn.execute("INSERT OR IGNORE INTO library(user_id, kind, item_id, saved_at) VALUES(?,?,?,?)", (me["id"], kind, iid, int(time.time())))
    conn.execute("UPDATE library SET pinned=? WHERE user_id=? AND kind=? AND item_id=?",
                 (1 if data.get("pinned") else 0, me["id"], kind, iid))
    conn.commit()
    return {"ok": True}


@web_route("POST", "library/save")
def web_library_save(h, data):
    me = logged_in(h)
    kind = str(data.get("kind", ""))
    iid = library_target(me, kind, data.get("id"))
    conn = db()
    if data.get("saved"):
        conn.execute("INSERT OR IGNORE INTO library(user_id, kind, item_id, saved_at) VALUES(?,?,?,?)",
                     (me["id"], kind, iid, int(time.time())))
    elif not (kind == "playlist" and playlist_row(iid)["owner_id"] == me["id"]):     # las tuyas se borran, no se quitan
        conn.execute("DELETE FROM library WHERE user_id=? AND kind=? AND item_id=?", (me["id"], kind, iid))
    conn.commit()
    return {"ok": True}


@web_route("POST", "library/touch")
def web_library_touch(h, data):
    """La web avisa cuando empiezas a escuchar un disco/artista/playlist: sube en tu biblioteca."""
    me = logged_in(h)
    kind = str(data.get("kind", ""))
    prefix = {"album": "al", "artist": "ar", "playlist": "pl"}.get(kind)
    raw = str(data.get("id", ""))
    if prefix and raw.startswith(prefix + "-") and raw[3:].isdigit():
        conn = db()
        conn.execute("UPDATE library SET last_played=? WHERE user_id=? AND kind=? AND item_id=?",
                     (int(time.time()), me["id"], kind, int(raw[3:])))
        conn.commit()
    return {"ok": True}


# ---- imagenes servidas: /img/avatar/<usuario>, /img/playlist/<id> (hace falta sesion) ----

def image_response(handler, path):
    me = session_user(handler)
    if not me:
        return handler.send_bytes(401, "text/plain; charset=utf-8", b"401\n")
    parts = path.strip("/").split("/")
    file = None
    if len(parts) == 3 and parts[1] == "avatar":
        u = db().execute("SELECT id, avatar FROM users WHERE username=?", (parts[2],)).fetchone()
        if u and u["avatar"]:
            file = find_image(avatar_base(u["id"]))
    elif len(parts) == 3 and parts[1] == "ad" and re.match(r"^[0-9a-f]{12}$", parts[2]):
        file = find_image(ad_base(parts[2]))
    elif len(parts) == 3 and parts[1] == "banner":
        u = db().execute("SELECT id, banner FROM users WHERE username=?", (parts[2],)).fetchone()
        if u and u["banner"]:
            file = find_image(banner_base(u["id"]))
    elif len(parts) == 3 and parts[1] == "playlist" and parts[2].isdigit():
        pl = playlist_row(int(parts[2]))
        if pl and pl["cover"] and can_view(me, pl):
            file = find_image(playlist_cover_base(pl["id"]))
    if not file or not os.path.exists(file):
        return handler.send_bytes(404, "text/plain; charset=utf-8", b"404\n")
    with open(file, "rb") as f:
        handler.send_bytes(200, image_mime(file), f.read(),
                           {"Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff"})


# ---- API Subsonic de playlists (para Feishin, Symfonium...) ----

def sub_user(username):
    return db().execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()


def sub_playlist(me, pl, entries=False):
    info = playlist_info(me, pl)
    d = {"id": info["id"], "name": info["name"], "comment": info["description"], "owner": pl["owner_name"],
         "public": info["public"], "songCount": info["songCount"], "duration": info["duration"],
         "created": info["created"], "changed": info["changed"]}
    if info["cover"]:
        d["coverArt"] = info["id"]
    if entries:
        rows = db().execute(SONG_SELECT + " JOIN playlist_songs ps ON ps.song_id = s.id WHERE ps.playlist_id=? "
                            "ORDER BY ps.pos, ps.id", (pl["id"],)).fetchall()
        d["entry"] = song_list(rows)
    return d


@endpoint("getPlaylists")
def ep_getPlaylists(user, p):
    me = sub_user(user)
    rows = db().execute("SELECT p.*, u.username AS owner_name, u.display_name AS owner_display FROM playlists p "
                        "JOIN users u ON u.id = p.owner_id WHERE p.owner_id=? OR p.public=1 OR p.id IN "
                        "(SELECT playlist_id FROM playlist_members WHERE user_id=? AND status='accepted') "
                        "ORDER BY p.owner_id != ?, p.name COLLATE NOCASE", (me["id"], me["id"], me["id"])).fetchall()
    return {"playlists": {"playlist": [sub_playlist(me, r) for r in rows]}}


@endpoint("getPlaylist")
def ep_getPlaylist(user, p):
    me = sub_user(user)
    return {"playlist": sub_playlist(me, visible_playlist(me, parse_pl(need(p, "id"))), entries=True)}


def sub_song_ids(values):
    ids = {"songIds": [v for v in (values or [])]}
    return song_ids_from(ids)


@endpoint("createPlaylist")
def ep_createPlaylist(user, p):
    me = sub_user(user)
    if arg(p, "playlistId"):                                  # reemplaza el contenido de una playlist tuya
        pl = own_playlist(me, parse_pl(arg(p, "playlistId")))
        pid = pl["id"]
        if arg(p, "name"):
            db().execute("UPDATE playlists SET name=? WHERE id=?", (arg(p, "name")[:100], pid))
        db().execute("DELETE FROM playlist_songs WHERE playlist_id=?", (pid,))
    else:
        pid = create_playlist(me, need(p, "name"))
    append_songs(pid, sub_song_ids(p.get("songId")))
    db().commit()
    return {"playlist": sub_playlist(me, playlist_row(pid), entries=True)}


@endpoint("updatePlaylist")
def ep_updatePlaylist(user, p):
    me = sub_user(user)
    pl = editable_playlist(me, parse_pl(need(p, "playlistId")))
    conn = db()
    if pl["owner_id"] == me["id"]:                            # nombre y visibilidad: solo el dueno
        if arg(p, "name"):
            conn.execute("UPDATE playlists SET name=? WHERE id=?", (arg(p, "name")[:100], pl["id"]))
        if arg(p, "comment") is not None:
            conn.execute("UPDATE playlists SET description=? WHERE id=?", (arg(p, "comment")[:500], pl["id"]))
        if arg(p, "public") is not None:
            was = pl["public"]
            conn.execute("UPDATE playlists SET public=? WHERE id=?", (1 if arg(p, "public") == "true" else 0, pl["id"]))
            if not was and arg(p, "public") == "true":
                notify_playlist_public(me, pl["id"])
    drop = sorted({int(i) for i in (p.get("songIndexToRemove") or []) if str(i).isdigit()}, reverse=True)
    if drop:
        ids = [r[0] for r in conn.execute("SELECT id FROM playlist_songs WHERE playlist_id=? ORDER BY pos, id", (pl["id"],))]
        conn.executemany("DELETE FROM playlist_songs WHERE id=?", [(ids[i],) for i in drop if i < len(ids)])
    append_songs(pl["id"], sub_song_ids(p.get("songIdToAdd")))
    conn.execute("UPDATE playlists SET updated=? WHERE id=?", (int(time.time()), pl["id"]))
    conn.commit()
    return {}


@endpoint("deletePlaylist")
def ep_deletePlaylist(user, p):
    me = sub_user(user)
    pl = own_playlist(me, parse_pl(need(p, "id")))
    delete_playlist(pl["id"])
    return {}


# ---- calidad de audio: recodificar a MP3 con ffmpeg (con cache) ----

_tc_guard = threading.Lock()
_tc_locks = {}
_tc_slots = threading.Semaphore(2)               # como mucho 2 recodificaciones a la vez


def prune_transcode_cache(folder):
    limit = CFG.transcode_mb * 1048576
    files = []
    for fn in os.listdir(folder):
        fp = os.path.join(folder, fn)
        if fn.endswith(".mp3"):
            try:
                st = os.stat(fp)
                files.append((st.st_mtime, st.st_size, fp))
            except OSError:
                pass
    total = sum(f[1] for f in files)
    for _mtime, size, fp in sorted(files):
        if total <= limit * 0.8:
            break
        remove_file(fp)
        total -= size


def transcoded_file(song_id, path, mtime, kbps):
    folder = os.path.join(CFG.data_dir, "transcode")
    os.makedirs(folder, exist_ok=True)
    out = os.path.join(folder, "%d-%d-%d.mp3" % (song_id, int(mtime), kbps))
    if os.path.exists(out):
        os.utime(out)
        return out
    with _tc_guard:
        lock = _tc_locks.setdefault(out, threading.Lock())
    with lock:
        if os.path.exists(out):
            return out
        tmp = out + ".part"
        with _tc_slots:
            r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-vn", "-map", "0:a:0", "-map_metadata", "-1",
                                "-c:a", "libmp3lame", "-b:a", "%dk" % kbps, "-f", "mp3", tmp],
                               capture_output=True, timeout=900)
        if r.returncode != 0 or not os.path.exists(tmp):
            remove_file(tmp)
            return None
        os.replace(tmp, out)
        prune_transcode_cache(folder)
    return out


# ---- volumen: medimos la sonoridad (LUFS) de cada cancion en segundo plano ----

LOUD = {"current": None}


def measure_loudness(path):
    try:
        r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-vn", "-af", "ebur128=framelog=quiet",
                            "-f", "null", "-"], capture_output=True, timeout=1800,
                           preexec_fn=lambda: os.nice(10))             # con prioridad baja
        found = re.findall(r"I:\s+(-?\d+(?:\.\d+)?)\s+LUFS", r.stderr.decode("utf-8", "replace"))
        return float(found[-1]) if found else None
    except (OSError, subprocess.SubprocessError, ValueError):
        return None


def loudness_loop():
    conn = sqlite3.connect(CFG.db_path, timeout=60)
    conn.row_factory = sqlite3.Row
    while True:
        try:
            on = conn.execute("SELECT value FROM settings WHERE name='loudness_analysis'").fetchone()
            rows = [] if (on and on["value"] == "off") else conn.execute(
                "SELECT id, path FROM songs WHERE loudness IS NULL ORDER BY id LIMIT 25").fetchall()
            if not rows:
                LOUD["current"] = None
                time.sleep(10)
                continue
            for r in rows:
                LOUD["current"] = r["id"]
                value = measure_loudness(r["path"])
                conn.execute("UPDATE songs SET loudness=? WHERE id=?", (value if value is not None else -1000.0, r["id"]))
                conn.commit()
        except Exception:
            log("Error midiendo volumen:\n%s" % traceback.format_exc())
            time.sleep(60)


@web_route("POST", "admin/loudness")
def web_admin_loudness(h, data):
    admin_only(h)
    set_setting("loudness_analysis", "on" if data.get("enabled") else "off")
    return {"ok": True}


# ---- anuncios (banner rotativo de la Home) ----

BANNER_MAX = 10


def clean_banners(raw):
    out = []
    for b in (raw if isinstance(raw, list) else [])[:BANNER_MAX]:
        if not isinstance(b, dict):
            continue
        title = str(b.get("title") or "").strip()[:80]
        text = str(b.get("text") or "").strip()[:400]
        link = str(b.get("link") or "").strip()[:500]
        image = str(b.get("image") or "").strip()[:500]
        color = str(b.get("color") or "").strip()
        lang = str(b.get("lang") or "").strip().lower()
        lang = lang if lang in ("es", "en") else ""        # vacio = se ve en todos los idiomas
        if link and not re.match(r"^(https?://|#/|/[^/])", link):
            raise ApiError(0, "El enlace debe empezar por http://, https:// o #/")
        if image and not re.match(r"^(https?://|/img/ad/[0-9a-f]{12}$)", image):
            raise ApiError(0, "La imagen debe ser una dirección http:// o https://")
        if color and not re.match(r"^#[0-9a-fA-F]{6}$", color):
            color = ""
        if title or text:
            out.append({"title": title, "text": text, "link": link, "image": image, "color": color, "lang": lang})
    return out


DEFAULT_BANNERS = [
    {"lang": "es", "color": "#6d28d9", "title": "¡Zinctify 0.8.0 ya está aquí!", "link": "#/changelog",
     "text": "Banner de perfil, una Home nueva con recomendaciones, radios que funcionan por HTTPS y mucho más. Toca para ver todas las novedades."},
    {"lang": "en", "color": "#6d28d9", "title": "Zinctify 0.8.0 is here!", "link": "#/changelog",
     "text": "Profile banners, a new Home with recommendations, radios that work over HTTPS and much more. Tap to see everything that's new."},
    {"lang": "es", "color": "#0f766e", "title": "Ya puedes descargar el cliente de escritorio", "link": "/download.html",
     "text": "Zinctify para Windows y Linux: icono en la bandeja, teclas multimedia, Discord Rich Presence y actualizaciones automáticas."},
    {"lang": "en", "color": "#0f766e", "title": "The desktop client is now available", "link": "/download.html",
     "text": "Zinctify for Windows and Linux: tray icon, media keys, Discord Rich Presence and automatic updates."},
    {"lang": "es", "color": "#b45309", "title": "Personaliza tu perfil con un banner", "link": "#/profile",
     "text": "Sube una imagen o un GIF para decorar la cabecera de tu perfil. Lo encontrarás en Perfil → Banner."},
    {"lang": "en", "color": "#b45309", "title": "Customize your profile with a banner", "link": "#/profile",
     "text": "Upload an image or a GIF to decorate the header of your profile. You'll find it in Profile → Banner."},
]


def load_banners():
    raw = get_setting("home_banners", None)
    if raw is None:                      # nunca se han guardado anuncios: se ofrecen los de ejemplo (siguen desactivados)
        return clean_banners([dict(b, image="") for b in DEFAULT_BANNERS])
    try:
        return clean_banners(json.loads(raw or "[]"))
    except (ValueError, ApiError):
        return []


def ad_base(name):
    return os.path.join(image_dir(), "ad-" + name)


def cleanup_ad_images(banners):
    """Borra las imagenes subidas que ya no usa ningun anuncio."""
    used = {b["image"].rsplit("/", 1)[-1] for b in banners if b["image"].startswith("/img/ad/")}
    try:
        for f in os.listdir(image_dir()):
            m = re.match(r"^ad-([0-9a-f]{12})\.(jpg|gif)$", f)
            if m and m.group(1) not in used:
                remove_file(os.path.join(image_dir(), f))
    except OSError:
        pass


@web_route("POST", "upload/ad-image")
def web_upload_ad_image(h, data):
    admin_only(h)
    name = secrets.token_hex(6)
    write_square_image(check_image(data.get("raw")), ad_base(name), 1600, 400)
    return {"url": "/img/ad/" + name}


@web_route("POST", "home/banners")
def web_home_banners(h, data):
    logged_in(h)
    on = get_setting("home_banner_on", "off") == "on"
    lang = str(data.get("lang") or "").lower()
    shown = [b for b in load_banners() if not b["lang"] or b["lang"] == lang] if on else []
    return {"enabled": on, "banners": shown, "seconds": max(3, min(60, int(get_setting("home_banner_secs", "7") or 7)))}


@web_route("POST", "admin/radios/visible")
def web_admin_radios_visible(h, data):
    admin_only(h)
    if "enabled" in data:
        set_setting("radios_enabled", "1" if data.get("enabled") else "0")
    return {"enabled": get_setting("radios_enabled", "0") == "1"}


@web_route("POST", "admin/banners")
def web_admin_banners(h, data):
    admin_only(h)
    if "banners" in data or "enabled" in data:
        if "banners" in data:
            cleaned = clean_banners(data.get("banners"))
            set_setting("home_banners", json.dumps(cleaned, ensure_ascii=False))
            cleanup_ad_images(cleaned)
        if "enabled" in data:
            set_setting("home_banner_on", "on" if data.get("enabled") else "off")
        if "seconds" in data:
            try:
                set_setting("home_banner_secs", str(max(3, min(60, int(data["seconds"])))))
            except (TypeError, ValueError):
                pass
    return {"enabled": get_setting("home_banner_on", "off") == "on", "banners": load_banners(),
            "seconds": max(3, min(60, int(get_setting("home_banner_secs", "7") or 7)))}


# ---- amigos escuchando ahora y salas de "escuchar juntos" (todo en memoria: se pierde al reiniciar el servidor) ----

NOW = {}                 # usuario -> {"song": id|None, "title", "artist", "radio", "playing", "ts"}
NOW_LOCK = threading.Lock()
LISTEN_FRESH = 90        # segundos sin avisos y se considera que ya no escucha


@web_route("POST", "now/update")
def web_now_update(h, data):
    me = logged_in(h)
    if not get_prefs(me)["showListening"]:
        with NOW_LOCK:
            NOW.pop(me["username"], None)
        return {"ok": True}
    sid = None
    raw = str(data.get("song") or "")
    if raw.startswith("so-") and raw[3:].isdigit():
        sid = int(raw[3:])
    with NOW_LOCK:
        if not data.get("playing") and sid is None and not data.get("title"):
            NOW.pop(me["username"], None)
        else:
            NOW[me["username"]] = {"song": sid, "title": str(data.get("title") or "")[:120], "artist": str(data.get("artist") or "")[:120],
                                   "radio": bool(data.get("radio")), "playing": bool(data.get("playing")), "ts": time.time()}
    return {"ok": True}


@web_route("POST", "radio/listen")
def web_radio_listen(h, data):
    """El navegador avisa cada ~20 s de cuanto llevas escuchando una radio; alimenta el Wrapped."""
    me = logged_in(h)
    rid = str(data.get("id") or "")[:40]
    if not rid:
        return {"ok": True}
    try:
        secs = max(0, min(120, int(data.get("seconds") or 0)))
    except (TypeError, ValueError):
        secs = 0
    name = str(data.get("name") or "")[:120] or rid
    row = db().execute("SELECT name FROM radios WHERE CAST(id AS TEXT)=? OR 'ra-' || id=?", (rid, rid)).fetchone()
    if row:
        name = row["name"]
    day = int(time.time()) // 86400 * 86400
    conn = db()
    conn.execute("INSERT INTO radio_listen(user, radio_id, day, name, seconds, starts) VALUES(?,?,?,?,?,?) "
                 "ON CONFLICT(user, radio_id, day) DO UPDATE SET seconds = seconds + excluded.seconds, starts = starts + excluded.starts, name = excluded.name",
                 (me["username"], rid, day, name, secs, 1 if data.get("start") else 0))
    conn.commit()
    return {"ok": True}


@web_route("POST", "friends/now")
def web_friends_now(h, data):
    """Lo que escuchan ahora mismo las personas a las que sigues (y que no han ocultado su actividad)."""
    me = logged_in(h)
    conn = db()
    names = {r["username"]: r for r in conn.execute(
        "SELECT u.* FROM follows f JOIN users u ON u.id = f.followed_id WHERE f.follower_id=?", (me["id"],)).fetchall()}
    now = time.time()
    with NOW_LOCK:
        live = {n: dict(v) for n, v in NOW.items() if n in names and v["playing"] and now - v["ts"] <= LISTEN_FRESH}
    songs = {r["id"]: r for r in _songs_by_ids([v["song"] for v in live.values() if v["song"]])}
    out = []
    for n, v in sorted(live.items(), key=lambda kv: -kv[1]["ts"]):
        u = names[n]
        if not get_prefs(u)["showListening"]:
            continue
        item = {"username": n, "displayName": u["display_name"] or "", "avatar": u["avatar"] or 0,
                "title": v["title"], "artist": v["artist"], "radio": v["radio"]}
        if v["song"] in songs:
            item["song"] = song_list([songs[v["song"]]])[0]
        out.append(item)
    return {"friends": out}


ROOMS = {}
ROOM_LOCK = threading.Lock()
ROOM_MEMBER_TTL = 15
ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def room_now_pos(r, now=None):
    now = now or time.time()
    return r["pos"] + (now - r["pos_ts"] if r["playing"] else 0)


def room_purge(now):
    for code in list(ROOMS):
        r = ROOMS[code]
        r["members"] = {u: t for u, t in r["members"].items() if now - t <= ROOM_MEMBER_TTL}
        if not r["members"] and now - r["updated"] > 600:
            del ROOMS[code]


ROOM_VIS = ("public", "private", "friends")


def mutual_friends(name_a, name_b):
    """Amigos = os seguis los dos."""
    if name_a == name_b:
        return True
    row = db().execute(
        "SELECT (SELECT COUNT(*) FROM follows f JOIN users a ON a.id=f.follower_id JOIN users b ON b.id=f.followed_id "
        "WHERE a.username=? AND b.username=?) + (SELECT COUNT(*) FROM follows f JOIN users a ON a.id=f.follower_id "
        "JOIN users b ON b.id=f.followed_id WHERE a.username=? AND b.username=?)", (name_a, name_b, name_b, name_a)).fetchone()
    return row[0] == 2


def room_can_join(r, me_name):
    """Publica: cualquiera. Privada: quien tenga el codigo. Solo amigos: los amigos del anfitrion."""
    if me_name in r["members"] or me_name == r["host"]:
        return True
    if r.get("visibility") == "friends" and not mutual_friends(r["host"], me_name):
        raise ApiError(50, "Esta sala es solo para los amigos del anfitrión")
    return True


def clean_room_name(v):
    return clean_text(str(v or "")).strip()[:40]


ROOM_PERMS = ("play", "skip", "add", "move", "propose")   # pausar/buscar · cambiar de canción · añadir canciones · mover, quitar y mezclar · proponer playlists
ROOM_PERMS_DEFAULT = {"play": True, "skip": False, "add": True, "move": False, "propose": True}
ROOM_PROPOSAL_TTL = 90          # segundos que dura una votación
ROOM_PROPOSAL_MAX_OPEN = 3


def room_prop_tick(r, now):
    """Cierra las votaciones: gana el si con mas de la mitad de la sala; pierde con la mitad o mas de noes; al caducar, gana el si si hay mas si que no."""
    props = r.get("proposals")
    if not props:
        return
    members = set(r["members"])
    n = max(1, len(members))
    for p in props:
        if p["status"] != "open":
            continue
        votes = {u: v for u, v in p["votes"].items() if u in members}
        yes = sum(1 for v in votes.values() if v)
        no = sum(1 for v in votes.values() if not v)
        verdict = None
        if yes * 2 > n:
            verdict = "approved"
        elif no * 2 >= n:
            verdict = "rejected"
        elif now >= p["expires"]:
            verdict = "approved" if yes > no else "rejected"
        if not verdict:
            continue
        p["status"] = verdict
        p["closed"] = now
        if verdict == "approved":
            rows = _songs_by_ids(p["ids"])
            room = 500 - len(r["songs"])
            rows = rows[:max(0, room)]
            if rows:
                if not r["songs"]:
                    r["songs"] = song_list(rows)
                    r.update(index=0, playing=True, pos=0.0, pos_ts=now)
                else:
                    r["pos"] = room_now_pos(r, now)
                    r["pos_ts"] = now
                    r["songs"] += song_list(rows)
                r["version"] += 1
                r["updated"] = now
    r["proposals"] = [p for p in props if p["status"] == "open" or now - p.get("closed", now) < 40][-8:]


def room_prop_view(r):
    return [{"id": p["id"], "by": p["by"], "playlist": p["playlist"], "preview": p["preview"], "total": p["total"], "votes": p["votes"],
             "status": p["status"], "left": max(0, int(p["expires"] - time.time())) if p["status"] == "open" else 0} for p in r.get("proposals", [])]


def room_perms_of(r, name):
    if name == r["host"]:
        return {k: True for k in ROOM_PERMS}
    p = dict(r.get("defaults") or ROOM_PERMS_DEFAULT)
    p.update(r.get("perms", {}).get(name, {}))
    return {k: bool(p.get(k)) for k in ROOM_PERMS}


def room_need(r, name, key):
    if not room_perms_of(r, name)[key]:
        raise ApiError(50, "El anfitrión no te ha dado permiso para hacer esto")


def room_view(r, me_name, since=None, chat_since=None):
    now = time.time()
    room_prop_tick(r, now)
    names = sorted(r["members"])
    info = []
    if names:
        q = "SELECT username, display_name, avatar FROM users WHERE username IN (%s)" % ",".join("?" * len(names))
        rows = {u["username"]: u for u in db().execute(q, names)}
        for n in names:
            u = rows.get(n)
            info.append({"username": n, "displayName": (u["display_name"] if u else "") or "", "avatar": (u["avatar"] if u else 0) or 0})
    return {"code": r["code"], "host": r["host"], "visibility": r.get("visibility", "private"), "name": r.get("name", ""), "version": r["version"], "index": r["index"], "playing": r["playing"],
            "pos": round(room_now_pos(r, now), 2), "songs": None if since == r["version"] else r["songs"],      # sin cambios: no se reenvía la lista
            "members": names, "memberInfo": info, "you": me_name,
            "perms": {n: room_perms_of(r, n) for n in names}, "defaults": dict(r.get("defaults") or ROOM_PERMS_DEFAULT),
            "proposals": room_prop_view(r),
            "chat": [m for m in r.get("chat", []) if chat_since is None or m["id"] > chat_since][-60:]}


def room_get(code, me):
    r = ROOMS.get(str(code or "").upper().strip())
    if not r:
        raise ApiError(70, "Esa sala ya no existe")
    return r


def room_set_queue(r, ids, index):
    rows = _songs_by_ids(ids)
    if not rows:
        raise ApiError(0, "No hay canciones para esa sala")
    r["songs"] = song_list(rows[:500])
    r["index"] = max(0, min(int(index or 0), len(r["songs"]) - 1))


@web_route("POST", "room/create")
def web_room_create(h, data):
    me = logged_in(h)
    now = time.time()
    with ROOM_LOCK:
        room_purge(now)
        for rr in ROOMS.values():                    # solo una sala a la vez por persona
            rr["members"].pop(me["username"], None)
        code = "".join(secrets.choice(ROOM_CODE_CHARS) for _ in range(5))
        while code in ROOMS:
            code = "".join(secrets.choice(ROOM_CODE_CHARS) for _ in range(5))
        vis = str(data.get("visibility") or "private")
        if vis not in ROOM_VIS:
            raise ApiError(0, "Acción no válida")
        r = {"code": code, "host": me["username"], "visibility": vis, "name": clean_room_name(data.get("name")),
             "members": {me["username"]: now}, "songs": [], "index": 0, "playing": False,
             "pos": 0.0, "pos_ts": now, "version": 1, "updated": now, "perms": {}, "defaults": dict(ROOM_PERMS_DEFAULT)}
        ids = [int(x[3:]) for x in (data.get("ids") or []) if isinstance(x, str) and x.startswith("so-") and x[3:].isdigit()]
        if ids:
            room_set_queue(r, ids, data.get("index"))
            r["playing"] = True
        ROOMS[code] = r
        return {"room": room_view(r, me["username"])}


@web_route("POST", "room/join")
def web_room_join(h, data):
    me = logged_in(h)
    now = time.time()
    with ROOM_LOCK:
        room_purge(now)
        r = room_get(data.get("code"), me)
        room_can_join(r, me["username"])
        for rr in ROOMS.values():
            if rr is not r:
                rr["members"].pop(me["username"], None)
        r["members"][me["username"]] = now
        r["updated"] = now
        return {"room": room_view(r, me["username"])}


@web_route("POST", "room/leave")
def web_room_leave(h, data):
    me = logged_in(h)
    with ROOM_LOCK:
        r = ROOMS.get(str(data.get("code") or "").upper())
        if r:
            r["members"].pop(me["username"], None)
            if r["host"] == me["username"] and r["members"]:
                r["host"] = sorted(r["members"])[0]
            r["updated"] = time.time()
    return {"ok": True}


@web_route("POST", "room/state")
def web_room_state(h, data):
    me = logged_in(h)
    now = time.time()
    with ROOM_LOCK:
        r = room_get(data.get("code"), me)
        room_can_join(r, me["username"])              # quien no esta dentro tambien pasa por los permisos
        r["members"][me["username"]] = now
        room_purge(now)
        cs = data.get("chatSince")
        return {"room": room_view(r, me["username"], data.get("since"), cs if isinstance(cs, int) else None)}


@web_route("POST", "room/chat")
def web_room_chat(h, data):
    """Chat de la sala: solo vive en memoria, asi que desaparece cuando la sala se cierra."""
    me = logged_in(h)
    text = str(data.get("text", "")).strip()[:500]
    if not text:
        raise ApiError(0, "Escribe un mensaje")
    with ROOM_LOCK:
        r = room_get(data.get("code"), me)
        if me["username"] not in r["members"]:
            raise ApiError(50, "No estás en esa sala")
        now = time.time()
        recent = [m for m in r.get("chat", []) if m["user"] == me["username"] and now - m["ts"] < 10]
        if len(recent) >= 8:
            raise ApiError(60, "Demasiados mensajes seguidos; espera un momento")
        r["chat_seq"] = r.get("chat_seq", 0) + 1
        r.setdefault("chat", []).append({"id": r["chat_seq"], "user": me["username"], "text": text, "ts": now})
        del r["chat"][:-200]
        return {"ok": True, "id": r["chat_seq"]}


@web_route("POST", "room/list")
def web_room_list(h, data):
    """Salas a las que puedes entrar sin codigo: las publicas y las de tus amigos. Las privadas no salen."""
    me = logged_in(h)
    now = time.time()
    with ROOM_LOCK:
        room_purge(now)
        rooms = [dict(r) for r in ROOMS.values() if r["members"] and r.get("visibility", "private") != "private"]
    out = []
    for r in rooms:
        vis = r.get("visibility")
        if vis == "friends" and not mutual_friends(r["host"], me["username"]):
            continue
        cur = r["songs"][r["index"]] if r["songs"] and 0 <= r["index"] < len(r["songs"]) else None
        u = db().execute("SELECT display_name FROM users WHERE username=?", (r["host"],)).fetchone()
        out.append({"code": r["code"], "name": r.get("name", ""), "host": r["host"], "hostName": (u["display_name"] if u else "") or "",
                    "visibility": vis, "members": len(r["members"]), "playing": bool(r["playing"]),
                    "title": cur["title"] if cur else "", "artist": cur["artist"] if cur else "", "mine": me["username"] in r["members"]})
    out.sort(key=lambda x: (-x["members"], x["name"].lower()))
    return {"rooms": out[:50]}


@web_route("POST", "room/settings")
def web_room_settings(h, data):
    """Solo el anfitrion cambia el nombre y quien puede entrar."""
    me = logged_in(h)
    with ROOM_LOCK:
        r = room_get(data.get("code"), me)
        if r["host"] != me["username"]:
            raise ApiError(50, "Solo el anfitrión puede cambiar esto")
        if "visibility" in data:
            vis = str(data.get("visibility"))
            if vis not in ROOM_VIS:
                raise ApiError(0, "Acción no válida")
            r["visibility"] = vis
        if "name" in data:
            r["name"] = clean_room_name(data.get("name"))
        r["version"] += 1
        r["updated"] = time.time()
        return {"room": room_view(r, me["username"])}


@web_route("POST", "room/perms")
def web_room_perms(h, data):
    """Solo el anfitrion decide que puede hacer cada invitado (username) o los invitados nuevos (username vacio)."""
    me = logged_in(h)
    with ROOM_LOCK:
        r = room_get(data.get("code"), me)
        if r["host"] != me["username"]:
            raise ApiError(50, "Solo el anfitrión puede cambiar esto")
        given = data.get("perms") if isinstance(data.get("perms"), dict) else {}
        patch = {k: bool(given[k]) for k in ROOM_PERMS if k in given}
        who = str(data.get("username") or "")
        if who:
            if who == r["host"] or who not in r["members"]:
                raise ApiError(0, "Acción no válida")
            r.setdefault("perms", {}).setdefault(who, {}).update(patch)
        else:
            r.setdefault("defaults", dict(ROOM_PERMS_DEFAULT)).update(patch)
        r["version"] += 1
        r["updated"] = time.time()
        return {"room": room_view(r, me["username"])}


@web_route("POST", "room/control")
def web_room_control(h, data):
    """Cualquiera de la sala puede pausar, saltar o cambiar la lista; el estado lo manda el servidor."""
    me = logged_in(h)
    now = time.time()
    act = str(data.get("action") or "")
    with ROOM_LOCK:
        r = room_get(data.get("code"), me)
        if me["username"] not in r["members"]:
            raise ApiError(50, "No estás en esa sala")
        r["members"][me["username"]] = now
        try:
            pos = max(0.0, float(data.get("pos") or 0))
        except (TypeError, ValueError):
            pos = 0.0
        n = len(r["songs"])
        who = me["username"]
        if act == "queue":
            if n:
                room_need(r, who, "move")
                if r["host"] != who:
                    raise ApiError(50, "Solo el anfitrión puede cambiar la cola entera")
            else:
                room_need(r, who, "add")
            ids = [int(x[3:]) for x in (data.get("ids") or []) if isinstance(x, str) and x.startswith("so-") and x[3:].isdigit()]
            room_set_queue(r, ids, data.get("index"))
            r.update(playing=True, pos=0.0)
        elif act == "add":                 # se anade al final de la cola; si la sala estaba vacia, empieza a sonar
            room_need(r, who, "add")
            ids = [int(x[3:]) for x in (data.get("ids") or []) if isinstance(x, str) and x.startswith("so-") and x[3:].isdigit()]
            rows = _songs_by_ids(ids)
            if not rows:
                raise ApiError(0, "No hay canciones para esa sala")
            if n + len(rows) > 500:
                raise ApiError(0, "La cola de la sala está llena (máximo 500 canciones)")
            if n == 0:
                r["songs"] = song_list(rows)
                r.update(index=0, playing=True, pos=0.0)
            else:
                r["songs"] += song_list(rows)
                r["pos"] = room_now_pos(r, now)
        elif act == "propose":             # propone una playlist a la sala: se somete a votacion
            room_need(r, who, "propose")
            m = re.match(r"^pl-(\d+)$", str(data.get("playlist") or ""))
            pl = playlist_row(int(m.group(1))) if m else None
            if not can_view(me, pl):
                raise ApiError(70, "Playlist no encontrada")
            ids = [x["song_id"] for x in db().execute("SELECT song_id FROM playlist_songs WHERE playlist_id=? ORDER BY pos LIMIT 500", (pl["id"],))]
            rows = _songs_by_ids(ids)
            if not rows:
                raise ApiError(0, "La playlist está vacía")
            room_prop_tick(r, now)
            opened = [p for p in r.get("proposals", []) if p["status"] == "open"]
            if len(opened) >= ROOM_PROPOSAL_MAX_OPEN:
                raise ApiError(0, "Ya hay demasiadas votaciones abiertas")
            if any(p["playlist"]["id"] == "pl-%d" % pl["id"] for p in opened):
                raise ApiError(0, "Esa playlist ya se está votando")
            r["prop_seq"] = r.get("prop_seq", 0) + 1
            prev = [{"id": x["id"], "title": x["title"], "artist": x["artist"], "duration": x.get("duration") or 0, "coverArt": x.get("coverArt")} for x in song_list(rows[:30])]
            r.setdefault("proposals", []).append({
                "id": r["prop_seq"], "by": who, "status": "open", "expires": now + ROOM_PROPOSAL_TTL, "ids": [x["id"] for x in rows],
                "playlist": {"id": "pl-%d" % pl["id"], "name": pl["name"], "cover": pl["cover"] or 0}, "preview": prev, "total": len(rows), "votes": {who: True}})
            room_prop_tick(r, now)
        elif act == "vote":
            try:
                pid = int(data.get("proposal"))
            except (TypeError, ValueError):
                raise ApiError(0, "Acción no válida")
            p = next((x for x in r.get("proposals", []) if x["id"] == pid and x["status"] == "open"), None)
            if not p:
                raise ApiError(0, "Esa votación ya ha terminado")
            p["votes"][who] = bool(data.get("yes"))
            room_prop_tick(r, now)
        elif n == 0:
            raise ApiError(0, "La sala todavía no tiene canciones")
        elif act == "shuffle":             # mezcla lo que queda por sonar; la cancion actual no se toca
            room_need(r, who, "move")
            rest = r["songs"][r["index"] + 1:]
            if len(rest) > 1:
                random.shuffle(rest)
                r["pos"] = room_now_pos(r, now)
                r["songs"] = r["songs"][:r["index"] + 1] + rest
        elif act == "play":
            room_need(r, who, "play")
            r.update(playing=True, pos=pos)
        elif act == "pause":
            room_need(r, who, "play")
            r.update(playing=False, pos=pos)
        elif act == "seek":
            room_need(r, who, "play")
            r.update(pos=pos)
        elif act == "next":
            room_need(r, who, "skip")
            if data.get("from") is not None and int(data.get("from")) != r["index"]:
                return {"room": room_view(r, me["username"])}      # otra persona ya avanzó: no se salta dos veces
            if r["index"] + 1 < n:
                r.update(index=r["index"] + 1, pos=0.0, playing=True)
            else:
                r.update(playing=False, pos=0.0)
        elif act == "prev":
            room_need(r, who, "skip")
            if room_now_pos(r, now) > 3 or r["index"] == 0:
                r.update(pos=0.0)
            else:
                r.update(index=r["index"] - 1, pos=0.0, playing=True)
        elif act == "jump":
            room_need(r, who, "skip")
            r.update(index=max(0, min(int(data.get("index") or 0), n - 1)), pos=0.0, playing=True)
        elif act == "move":                # mueve una cancion de la cola de sitio; la que suena sigue sonando
            room_need(r, who, "move")
            try:
                src, dst = int(data.get("from")), int(data.get("to"))
            except (TypeError, ValueError):
                raise ApiError(0, "Acción no válida")
            if not (0 <= src < n and 0 <= dst < n):
                raise ApiError(0, "Acción no válida")
            if src != dst:
                cur = r["index"]
                r["pos"] = room_now_pos(r, now)
                song = r["songs"].pop(src)
                r["songs"].insert(dst, song)
                if cur == src:
                    cur = dst
                elif src < cur <= dst:
                    cur -= 1
                elif dst <= cur < src:
                    cur += 1
                r["index"] = cur
        elif act == "remove":              # quita una cancion de la cola (no la que suena)
            room_need(r, who, "move")
            try:
                at = int(data.get("index"))
            except (TypeError, ValueError):
                raise ApiError(0, "Acción no válida")
            if not (0 <= at < n):
                raise ApiError(0, "Acción no válida")
            if at == r["index"]:
                raise ApiError(0, "No puedes quitar la canción que está sonando")
            r["pos"] = room_now_pos(r, now)
            del r["songs"][at]
            if at < r["index"]:
                r["index"] -= 1
        else:
            raise ApiError(0, "Acción no válida")
        r["pos_ts"] = now
        r["version"] += 1
        r["updated"] = now
        return {"room": room_view(r, me["username"])}


class Server(ThreadingHTTPServer):
    request_queue_size = 64


# ---------------------------------------------------------------------------
# Actualizaciones desde GitHub: el servidor mira si hay una version nueva publicada (Releases), avisa en Administracion
# y, si el administrador lo pide, descarga el servidor y los clientes (Windows, Linux, Android) y se reinicia.
# ---------------------------------------------------------------------------

UPDATE_API = os.environ.get("ZINCTIFY_UPDATE_API", "https://api.github.com").rstrip("/")
SELF_UPDATE = os.environ.get("ZINCTIFY_SELF_UPDATE") == "1"           # lo pone el servicio de systemd: el script service/apply-update.sh coloca los archivos al arrancar
REPO_RE = re.compile(r"^[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}$")
UPDATE_HOSTS = ("github.com", "githubusercontent.com")
UPDATE_CLIENT_EXT = (".exe", ".appimage", ".apk", ".blockmap")
UPDATE_CLIENT_NAMES = ("latest.yml", "latest-linux.yml")
UPDATE_MAX_BYTES = 1500 << 20
UPDATE_LOCK = threading.Lock()
UPDATE_STATE = {"phase": "idle", "msg": "", "progress": 0.0, "error": ""}
RESTART = {"want": False, "server": None}


def update_dir():
    d = os.path.join(CFG.data_dir, "update")
    os.makedirs(d, exist_ok=True)
    return d


def parse_version(v):
    m = re.search(r"(\d+)\.(\d+)\.(\d+)", str(v or ""))
    return tuple(int(x) for x in m.groups()) if m else None


def update_state(**kw):
    with UPDATE_LOCK:
        UPDATE_STATE.update(kw)


def update_url_ok(url):
    u = urlparse(url)
    if UPDATE_API.startswith("http://") and url.startswith(UPDATE_API):      # solo para pruebas en local (ZINCTIFY_UPDATE_API)
        return True
    host = (u.hostname or "").lower()
    return u.scheme == "https" and any(host == d or host.endswith("." + d) for d in UPDATE_HOSTS)


def gh_json(url):
    req = Request(url, headers={"User-Agent": "Zinctify/%s" % SERVER_VERSION, "Accept": "application/vnd.github+json"})
    try:
        with urlopen(req, timeout=20) as resp:
            raw = resp.read(4 << 20)
    except HTTPError as e:
        if e.code == 404:
            raise ApiError(0, "No hay ninguna versión publicada en ese repositorio de GitHub")
        if e.code in (403, 429):
            raise ApiError(0, "GitHub no deja consultar ahora mismo (demasiadas consultas). Prueba más tarde.")
        raise ApiError(0, "GitHub respondió con el error %d" % e.code)
    except Exception as e:
        raise ApiError(0, "No se pudo conectar con GitHub: %s" % str(e)[:120])
    try:
        return json.loads(raw.decode("utf-8", "replace"))
    except ValueError:
        raise ApiError(0, "GitHub devolvió una respuesta que no se entiende")


def update_check():
    """Mira la ultima release del repositorio y guarda lo que encuentra. No descarga nada."""
    repo = get_setting("update_repo", "")
    if not REPO_RE.match(repo or ""):
        raise ApiError(0, "Primero escribe el repositorio de GitHub (usuario/nombre)")
    rel = gh_json("%s/repos/%s/releases/latest" % (UPDATE_API, repo))
    tag = str(rel.get("tag_name") or "")
    ver = parse_version(tag)
    assets = []
    for a in rel.get("assets") or []:
        name = str(a.get("name") or "")
        url = str(a.get("browser_download_url") or "")
        if re.match(r"^[A-Za-z0-9._ +()-]{1,160}$", name) and update_url_ok(url):
            assets.append({"name": name, "url": url, "size": int(a.get("size") or 0), "digest": str(a.get("digest") or "")})
    info = {"checked": int(time.time()), "tag": tag, "version": ".".join(map(str, ver)) if ver else "", "name": str(rel.get("name") or tag),
            "notes": str(rel.get("body") or "")[:4000], "url": str(rel.get("html_url") or ""), "published": str(rel.get("published_at") or ""),
            "newer": bool(ver and ver > parse_version(SERVER_VERSION)), "assets": assets}
    set_setting("update_info", json.dumps(info, ensure_ascii=False))
    return info


def update_info():
    try:
        return json.loads(get_setting("update_info", "") or "{}")
    except ValueError:
        return {}


def update_can_install():
    """(puede, motivo): hace falta que el servicio sepa colocar los archivos nuevos, o que la carpeta del programa se pueda escribir."""
    if SELF_UPDATE:
        return True, ""
    if os.environ.get("INVOCATION_ID"):
        return False, "Este servicio de systemd es de una versión anterior. Una sola vez, en el servidor: sudo bash service/install-service.sh (no borra tus datos). Después se actualizará desde aquí."
    app = os.path.dirname(os.path.abspath(__file__))
    if not os.access(app, os.W_OK):
        return False, "El programa no tiene permiso para escribir en %s." % app
    return True, ""


def update_sums(assets, incoming):
    """sha256 conocidos: del campo digest de GitHub y/o del archivo SHA256SUMS de la release."""
    sums = {}
    for a in assets:
        m = re.match(r"^sha256:([0-9a-f]{64})$", a.get("digest") or "")
        if m:
            sums[a["name"]] = m.group(1)
    sf = next((a for a in assets if a["name"].upper() in ("SHA256SUMS", "SHA256SUMS.TXT")), None)
    if sf:
        path = os.path.join(incoming, "SHA256SUMS")
        update_download(sf["url"], path, 1 << 20, None)
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                m = re.match(r"^([0-9a-fA-F]{64})\s+\*?(.+?)\s*$", line)
                if m:
                    sums[m.group(2)] = m.group(1).lower()
    return sums


def update_download(url, dest, limit, on_bytes):
    if not update_url_ok(url):
        raise ApiError(0, "Dirección de descarga no permitida")
    req = Request(url, headers={"User-Agent": "Zinctify/%s" % SERVER_VERSION})
    done = 0
    with urlopen(req, timeout=40) as resp:
        if not update_url_ok(resp.geturl()):
            raise ApiError(0, "La descarga se redirigió a un sitio no permitido")
        with open(dest, "wb") as f:
            while True:
                chunk = resp.read(1 << 20)
                if not chunk:
                    break
                done += len(chunk)
                if done > limit:
                    raise ApiError(0, "Archivo demasiado grande")
                f.write(chunk)
                if on_bytes:
                    on_bytes(len(chunk))


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


UPDATE_ALLOWED_TOP = ("zinctify.py", "web/", "service/", "README.md", "LICENSE", "NOTICE.md", "THIRD-PARTY-NOTICES.md")


def update_extract(zip_path, dest):
    import zipfile
    total = 0
    with zipfile.ZipFile(zip_path) as z:
        for zi in z.infolist():
            name = zi.filename.replace("\\", "/")
            if zi.is_dir():
                continue
            if name.startswith("/") or ".." in name.split("/") or not name.startswith(UPDATE_ALLOWED_TOP):
                continue
            total += zi.file_size
            if total > 300 << 20:
                raise ApiError(0, "El paquete del servidor es demasiado grande")
            out = os.path.join(dest, *name.split("/"))
            os.makedirs(os.path.dirname(out), exist_ok=True)
            with z.open(zi) as src, open(out, "wb") as dst:
                shutil.copyfileobj(src, dst)
            if name in ("zinctify.py",) or name.endswith(".sh"):
                os.chmod(out, 0o755)


def update_validate(staged, tag):
    import py_compile
    main_py = os.path.join(staged, "zinctify.py")
    if not os.path.isfile(main_py) or not os.path.isfile(os.path.join(staged, "web", "index.html")):
        raise ApiError(0, "El paquete no trae zinctify.py y la carpeta web")
    try:
        py_compile.compile(main_py, cfile=os.path.join(staged, ".check.pyc"), doraise=True)
    except py_compile.PyCompileError as e:
        raise ApiError(0, "El zinctify.py nuevo no es válido: %s" % str(e)[:150])
    with open(main_py, "r", encoding="utf-8", errors="replace") as f:
        m = re.search(r'^SERVER_VERSION = "([^"]+)"', f.read(), re.M)
    if not m or parse_version(m.group(1)) != parse_version(tag):
        raise ApiError(0, "La versión que trae el paquete (%s) no coincide con la de la release (%s)" % (m.group(1) if m else "?", tag))


def update_install_clients(incoming, names):
    """Deja los instaladores nuevos (Windows, Linux, Android) donde el servidor los ofrece y borra los de versiones anteriores."""
    folder = downloads_dir()
    os.makedirs(folder, exist_ok=True)
    new_ext = {os.path.splitext(n)[1].lower() for n in names if os.path.splitext(n)[1].lower() in (".exe", ".appimage", ".apk")}
    for old in os.listdir(folder):
        ext = os.path.splitext(old)[1].lower()
        if (ext in new_ext or ext == ".blockmap") and old not in names and os.path.isfile(os.path.join(folder, old)):
            try:
                os.remove(os.path.join(folder, old))
            except OSError:
                pass
    for n in names:
        os.replace(os.path.join(incoming, n), os.path.join(folder, n))


def update_write_marker(name, data):
    with open(os.path.join(update_dir(), name), "w", encoding="utf-8") as f:
        json.dump(data, f)


def update_apply_inprocess(app_dir):
    """Sin systemd (arranque a mano): copia los archivos nuevos sobre el programa, guardando antes una copia en <datos>/backups/last."""
    staged = os.path.join(update_dir(), "staged")
    bk = os.path.join(CFG.data_dir, "backups", "last")
    shutil.rmtree(bk, ignore_errors=True)
    os.makedirs(bk, exist_ok=True)
    for item in ("zinctify.py", "web", "service", "README.md"):
        src = os.path.join(app_dir, item)
        if os.path.isdir(src):
            shutil.copytree(src, os.path.join(bk, item))
        elif os.path.isfile(src):
            shutil.copy2(src, os.path.join(bk, item))
    for item in os.listdir(staged):
        if item.startswith("."):
            continue
        src, dst = os.path.join(staged, item), os.path.join(app_dir, item)
        if os.path.isdir(src):
            shutil.rmtree(dst, ignore_errors=True)
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)
    shutil.rmtree(staged, ignore_errors=True)
    try:
        os.remove(os.path.join(update_dir(), "ready.json"))
    except OSError:
        pass


def update_install_worker(info):
    try:
        incoming = os.path.join(update_dir(), "incoming")
        staged = os.path.join(update_dir(), "staged")
        for d in (incoming, staged):
            shutil.rmtree(d, ignore_errors=True)
            os.makedirs(d, exist_ok=True)
        assets = info.get("assets") or []
        pkg = next((a for a in assets if re.match(r"^zinctify-server-.+\.zip$", a["name"], re.I)), None)
        if not pkg:
            raise ApiError(0, "La release no trae el paquete del servidor (zinctify-server-X.Y.Z.zip)")
        clients = [a for a in assets if a["name"] in UPDATE_CLIENT_NAMES or os.path.splitext(a["name"])[1].lower() in UPDATE_CLIENT_EXT]
        todo = [pkg] + clients
        total = sum(max(a["size"], 1) for a in todo)
        got = [0]

        def on_bytes(n):
            got[0] += n
            update_state(progress=min(0.9, got[0] / total * 0.9))
        update_state(phase="downloading", msg="Descargando la versión %s…" % info["version"], progress=0.0, error="")
        sums = update_sums(assets, incoming)
        if pkg["name"] not in sums:
            raise ApiError(0, "La release no trae la suma de comprobación del paquete (SHA256SUMS): no se instala sin poder verificarlo")
        for a in todo:
            update_state(msg="Descargando %s…" % a["name"])
            dest = os.path.join(incoming, a["name"])
            update_download(a["url"], dest, UPDATE_MAX_BYTES, on_bytes)
            want = sums.get(a["name"])
            if want and sha256_file(dest) != want:
                raise ApiError(0, "La descarga de %s está dañada (la suma no coincide)" % a["name"])
        update_state(phase="installing", msg="Comprobando el paquete…", progress=0.92)
        update_extract(os.path.join(incoming, pkg["name"]), staged)
        update_validate(staged, info["tag"])
        update_state(msg="Instalando los clientes…", progress=0.96)
        update_install_clients(incoming, [a["name"] for a in clients])
        update_write_marker("ready.json", {"version": info["version"], "from": SERVER_VERSION, "ts": int(time.time())})
        shutil.rmtree(incoming, ignore_errors=True)
        update_state(phase="restarting", msg="Reiniciando el servidor…", progress=1.0)
        request_restart()
    except Exception as e:
        msg = e.message if isinstance(e, ApiError) else "%s" % str(e)[:200]
        log("Actualización fallida: %s" % msg)
        shutil.rmtree(os.path.join(update_dir(), "staged"), ignore_errors=True)
        update_state(phase="error", msg="", error=msg, progress=0.0)


def request_restart():
    RESTART["want"] = True
    srv = RESTART.get("server")
    if srv:
        threading.Timer(1.5, srv.shutdown).start()


def update_confirm_loop():
    """Tras arrancar con una version recien instalada, a los 30 s sin caerse se da por buena (si no, el servicio vuelve a la anterior)."""
    marker = os.path.join(update_dir(), "pending-verify")
    if os.path.exists(marker):
        time.sleep(30)
        try:
            os.remove(marker)
            update_write_marker("last.json", {"version": SERVER_VERSION, "ok": True, "ts": int(time.time())})
            log("Actualización a la versión %s confirmada." % SERVER_VERSION)
        except OSError:
            pass


def update_loop():
    time.sleep(90)
    while True:
        try:
            if get_setting("update_auto", "1") == "1" and REPO_RE.match(get_setting("update_repo", "") or ""):
                last = int(update_info().get("checked", 0) or 0)
                if time.time() - last > 6 * 3600:
                    update_check()
        except Exception as e:
            log("Comprobación de actualizaciones: %s" % (e.message if isinstance(e, ApiError) else str(e)[:120]))
        time.sleep(1800)


def update_status():
    info = update_info()
    ok, why = update_can_install()
    rolled = None
    try:
        with open(os.path.join(update_dir(), "rolled-back.json"), "r", encoding="utf-8") as f:
            rolled = json.load(f)
    except (OSError, ValueError):
        pass
    with UPDATE_LOCK:
        st = dict(UPDATE_STATE)
    has_pkg = any(re.match(r"^zinctify-server-.+\.zip$", a["name"], re.I) for a in info.get("assets", []))
    clients = sorted({("windows" if a["name"].lower().endswith(".exe") else "linux" if a["name"].lower().endswith(".appimage") else "android")
                      for a in info.get("assets", []) if os.path.splitext(a["name"])[1].lower() in (".exe", ".appimage", ".apk")})
    failed = bool(rolled and rolled.get("version") and parse_version(rolled["version"]) == parse_version(info.get("version")))
    return {"current": SERVER_VERSION, "repo": get_setting("update_repo", ""), "auto": get_setting("update_auto", "1") == "1",
            "checked": info.get("checked", 0), "available": bool(info.get("newer")) and has_pkg and not failed, "newer": bool(info.get("newer")),
            "version": info.get("version", ""), "notes": info.get("notes", ""), "url": info.get("url", ""), "published": info.get("published", ""),
            "hasPackage": has_pkg, "clients": clients, "canInstall": ok, "whyNot": why, "state": st, "rolledBack": rolled}


@web_route("POST", "admin/update")
def web_admin_update(h, data):
    admin_only(h)
    return update_status()


@web_route("POST", "admin/update/settings")
def web_admin_update_settings(h, data):
    admin_only(h)
    repo = str(data.get("repo", "")).strip()
    repo = re.sub(r"^https?://github\.com/", "", repo).strip("/")
    repo = re.sub(r"\.git$", "", repo)
    if repo and not REPO_RE.match(repo):
        raise ApiError(0, "El repositorio se escribe así: usuario/nombre")
    if repo != get_setting("update_repo", ""):
        set_setting("update_info", "")
    set_setting("update_repo", repo)
    set_setting("update_auto", "1" if data.get("auto", True) else "0")
    return update_status()


@web_route("POST", "admin/update/check")
def web_admin_update_check(h, data):
    admin_only(h)
    update_check()
    return update_status()


@web_route("POST", "admin/update/install")
def web_admin_update_install(h, data):
    admin_only(h)
    ok, why = update_can_install()
    if not ok:
        raise ApiError(0, why)
    info = update_check()                     # se vuelve a mirar justo antes: se instala lo ultimo publicado
    if not info.get("newer"):
        raise ApiError(0, "Ya tienes la última versión")
    if not update_status()["available"]:
        raise ApiError(0, "Esa versión ya se probó y no arrancó bien en este servidor. Espera a una versión más nueva.")
    with UPDATE_LOCK:
        if UPDATE_STATE["phase"] in ("downloading", "installing", "restarting"):
            raise ApiError(0, "Ya se está actualizando")
        UPDATE_STATE.update(phase="downloading", msg="Empezando…", progress=0.0, error="")
    threading.Thread(target=update_install_worker, args=(info,), daemon=True).start()
    return update_status()


def main():
    def env(name, default=None):
        """ZINCTIFY_X; si no existe, vale la antigua MINISONIC_X (para quien ya lo tenia instalado)."""
        return os.environ.get(name, os.environ.get(name.replace("ZINCTIFY_", "MINISONIC_"), default))
    ap = argparse.ArgumentParser(description="Zinctify: servidor de musica compatible con Subsonic")
    ap.add_argument("--music-dir", default=env("ZINCTIFY_MUSIC_DIR"), help="(opcional) carpeta con tu musica; tambien se puede poner en Administracion")
    ap.add_argument("--data-dir", default=env("ZINCTIFY_DATA_DIR", "./minisonic-data" if (os.path.isdir("./minisonic-data") and not os.path.isdir("./zinctify-data")) else "./zinctify-data"),
                    help="donde guardar la base de datos y la cache de caratulas")
    ap.add_argument("--host", default=env("ZINCTIFY_HOST", "0.0.0.0"))
    ap.add_argument("--port", type=int, default=int(env("ZINCTIFY_PORT", "4534")))
    ap.add_argument("--user", default=env("ZINCTIFY_USER"),
                    help="(opcional) crea este administrador en el primer arranque si aun no hay usuarios")
    ap.add_argument("--password", default=env("ZINCTIFY_PASS"),
                    help="contrasena de ese administrador; mejor usa ZINCTIFY_PASS: los argumentos se ven con 'ps'")
    ap.add_argument("--web-dir", default=env("ZINCTIFY_WEB_DIR", os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "web")), help="carpeta con la interfaz web")
    ap.add_argument("--scan-interval", type=int, default=int(env("ZINCTIFY_SCAN_MINUTES", "10")),
                    help="minutos entre reescaneos automaticos (0 = desactivado)")
    ap.add_argument("--transcode-mb", type=int, default=int(env("ZINCTIFY_TRANSCODE_MB", "2048")),
                    help="tamano maximo de la cache de audio transcodificado, en MB")
    ap.add_argument("--check-tags", action="store_true",
                    help="no arranca el servidor: revisa los tags y escribe informe-tags.txt con los archivos raros")
    args = ap.parse_args()
    for tool in ("ffprobe", "ffmpeg"):
        if not shutil.which(tool):
            sys.exit("Falta %s. Instalalo con: sudo apt install ffmpeg" % tool)

    CFG.music_dir = os.path.abspath(args.music_dir) if args.music_dir else ""
    CFG.data_dir = os.path.abspath(args.data_dir)
    CFG.db_path = os.path.join(CFG.data_dir, "zinctify.db")
    old_db = os.path.join(CFG.data_dir, "minisonic.db")
    if not os.path.exists(CFG.db_path) and os.path.exists(old_db):
        CFG.db_path = old_db                      # instalacion anterior: sigue usando su base de datos
    CFG.cover_dir = os.path.join(CFG.data_dir, "covers")
    CFG.transcode_mb = max(64, args.transcode_mb)
    CFG.web_dir = os.path.abspath(args.web_dir)
    if not os.path.isfile(os.path.join(CFG.web_dir, "index.html")):
        alt = os.path.join(os.getcwd(), "web")
        if os.path.isfile(os.path.join(alt, "index.html")):
            CFG.web_dir = alt
        else:
            log("AVISO: no encuentro la interfaz web. Busqué %s/index.html. "
                "Crea una carpeta 'web' junto a zinctify.py con index.html, style.css y app.js "
                "(o usa --web-dir /ruta)." % CFG.web_dir)
    os.makedirs(CFG.cover_dir, exist_ok=True)
    if args.check_tags:
        if not CFG.music_dir:
            ap.error("--check-tags necesita --music-dir")
        check_tags()
        return
    load_no_split()
    init_db()
    saved = get_setting("music_dir", "")          # la carpeta puesta desde Administración manda sobre --music-dir
    if saved:
        CFG.music_dir = saved
    if not CFG.music_dir:
        log("Todavía no hay carpeta de música: ponla en Administración → Resumen (o arranca con --music-dir).")

    if args.user and args.password and user_count() == 0:
        # Compatibilidad: la contrasena de siempre sirve para la web y como clave para tus apps.
        create_user(args.user, args.password, api_key=args.password, admin=1, check=False)
        log("Creado el administrador '%s' a partir de ZINCTIFY_USER/ZINCTIFY_PASS." % args.user)
    if user_count() == 0:
        log("Todavía no hay usuarios: abre http://IP:%d en el navegador y crea la primera cuenta (será administradora)."
            % args.port)
    threading.Thread(target=scan_library, daemon=True).start()
    threading.Thread(target=loudness_loop, daemon=True).start()
    threading.Thread(target=link_sync_loop, daemon=True).start()
    if args.scan_interval > 0:
        threading.Thread(target=periodic_scan, args=(args.scan_interval,), daemon=True).start()

    threading.Thread(target=update_loop, daemon=True).start()
    threading.Thread(target=update_confirm_loop, daemon=True).start()
    srv = Server((args.host, args.port), Handler)
    RESTART["server"] = srv
    try:
        import signal
        signal.signal(signal.SIGTERM, lambda *_: threading.Thread(target=srv.shutdown, daemon=True).start())
    except (ValueError, OSError, AttributeError):
        pass
    log("Zinctify %s escuchando en http://%s:%d  (musica: %s)" % (SERVER_VERSION, args.host, args.port, CFG.music_dir))
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        log("Parando...")
    finally:
        srv.server_close()
    if RESTART["want"]:
        if SELF_UPDATE:
            log("Reiniciando para terminar la actualización (el servicio coloca los archivos nuevos al arrancar).")
            sys.exit(0)
        try:
            update_apply_inprocess(os.path.dirname(os.path.abspath(__file__)))
            update_write_marker("pending-verify", {"ts": int(time.time())})
            log("Archivos nuevos colocados. Arrancando de nuevo…")
            os.execv(sys.executable, [sys.executable] + sys.argv)
        except Exception as e:
            log("No se pudo terminar la actualización: %s" % e)


if __name__ == "__main__":
    main()
